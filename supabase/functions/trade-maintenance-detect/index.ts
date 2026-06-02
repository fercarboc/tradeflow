import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY  = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL        = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Eres un experto en contratos de mantenimiento para instaladores y empresas técnicas en España.
Tu misión es analizar texto libre (dictado o escrito) y extraer toda la información relevante para generar un presupuesto de contrato de mantenimiento.

REGLAS OBLIGATORIAS:
1. Si detectas "mantenimiento", "contrato", "iguala", "servicio mensual", "revisión periódica" → es SIEMPRE un contrato de mantenimiento, nunca un presupuesto de obra.
2. SIEMPRE selecciona la plantilla base más cercana al oficio+sector. No generes contratos desde cero.
3. Fábricas, hospitales, supermercados, industrias alimentarias → propón guardia + preventivos automáticamente.
4. Si no hay precio explícito → propón un rango basado en la plantilla (precio_min a precio_max).
5. Los materiales/piezas están SIEMPRE excluidos por defecto. Solo inclúyelos si el cliente lo pide explícitamente.
6. SIEMPRE propón un importe mensual de referencia (a diferencia de presupuestos de obra puntual).
7. Si hay múltiples oficios → una partida separada por oficio en descripcion_servicios.
8. Detecta el sector automáticamente del contexto (hospital→hospitalario, restaurante→restauracion, etc.)
9. Clasifica la criticidad: CRÍTICO = parada de producción/salud, URGENTE = actividad comprometida, NORMAL = sin parada, PREVENTIVO = programado.
10. El SLA_nivel debe coincidir con la criticidad detectada.

CATÁLOGOS DISPONIBLES (usa los códigos exactos):
OFICIOS: fontaneria, electricidad, climatizacion, limpieza, jardineria, informatica, ascensores
SECTORES: oficinas, comunidad, industrial_general, alimentario, hospitalario, hotelero, retail, logistica, restauracion, gasolineras, educacion, farmaceutico, taller_automocion, supermercado
SLA_NIVELES: critico, urgente, normal, preventivo
FRECUENCIAS: diaria, semanal, quincenal, mensual, bimensual, trimestral, semestral, anual

Responde SIEMPRE con un JSON con esta estructura exacta (sin texto adicional):
{
  "oficio": "<codigo_oficio>",
  "sector": "<codigo_sector>",
  "plantilla_codigo": "<codigo_plantilla_mas_cercana_o_null>",
  "sla_nivel": "<nivel>",
  "nombre_cliente": "<nombre detectado o null>",
  "direccion_instalacion": "<direccion detectada o null>",
  "descripcion_servicios": "<descripcion detallada de los servicios incluidos>",
  "cuota_mensual_sugerida": <numero_euros_o_null>,
  "cuota_min": <numero_euros_o_null>,
  "cuota_max": <numero_euros_o_null>,
  "tipo_facturacion": "<mensual|trimestral|anual>",
  "incluye_preventivos": <true|false>,
  "num_visitas_preventivo": <numero>,
  "frecuencia_preventivo": "<frecuencia>",
  "incluye_guardia": <true|false>,
  "materiales_incluidos": <false>,
  "duracion_meses": <12|24|null>,
  "recargos_aplicables": ["<codigo_recargo>"],
  "variables_detectadas": {"<clave>": "<valor>"},
  "confianza": <0.0_a_1.0>,
  "resumen": "<frase breve de lo que se ha detectado, máx 80 chars>"
}`;

async function resolveOrg(supabase: ReturnType<typeof createClient>, userId: string) {
  const [ownRes, memberRes] = await Promise.all([
    supabase.from('trade_organizations').select('id, plan').eq('owner_id', userId).maybeSingle(),
    supabase.from('trade_org_members').select('org_id').eq('user_id', userId).eq('activo', true).maybeSingle(),
  ]);
  if (ownRes.data) return { orgId: ownRes.data.id, plan: ownRes.data.plan };
  if (memberRes.data) {
    const { data: org } = await supabase.from('trade_organizations').select('id, plan').eq('id', memberRes.data.org_id).maybeSingle();
    return { orgId: org?.id ?? null, plan: org?.plan ?? 'basico' };
  }
  return { orgId: null, plan: 'basico' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: CORS });
    }

    const { orgId, plan } = await resolveOrg(supabaseUser, user.id);
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'Organización no encontrada' }), { status: 404, headers: CORS });
    }
    if (!['empresa', 'empresa_plus'].includes(plan)) {
      return new Response(JSON.stringify({ error: 'El módulo de contratos requiere Plan Empresa o Empresa+' }), { status: 403, headers: CORS });
    }

    const body = await req.json() as { texto: string };
    if (!body.texto?.trim()) {
      return new Response(JSON.stringify({ error: 'texto requerido' }), { status: 400, headers: CORS });
    }

    // Load available plantillas for context
    const { data: plantillas } = await supabaseUser
      .from('trade_maintenance_plantillas')
      .select('codigo, nombre, sla_nivel, cuota_mensual_base, precio_min, precio_max')
      .eq('activo', true);

    const plantillasCtx = (plantillas ?? [])
      .map((p: Record<string, unknown>) => `${p.codigo}: ${p.nombre} (${p.precio_min}€-${p.precio_max}€/mes, SLA: ${p.sla_nivel})`)
      .join('\n');

    const userMessage = `PLANTILLAS DISPONIBLES:\n${plantillasCtx}\n\nTEXTO DEL INSTALADOR:\n${body.texto.trim()}`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return new Response(JSON.stringify({ error: 'Error IA', detail: errText }), { status: 502, headers: CORS });
    }

    const aiData = await aiRes.json() as { content: Array<{ text: string }> };
    const rawText = aiData.content[0]?.text ?? '{}';

    let parsed: Record<string, unknown>;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] ?? '{}');
    } catch {
      return new Response(JSON.stringify({ error: 'La IA no devolvió JSON válido', raw: rawText }), { status: 502, headers: CORS });
    }

    // Guardar trazabilidad en trade_ai_usage con el texto original
    await supabaseUser.from('trade_ai_usage').insert({
      org_id: orgId,
      feature: 'maintenance_detect',
      metadata: { texto: body.texto.trim().slice(0, 500), confianza: parsed.confianza ?? 0 },
    }).then(() => {/* fire-and-forget */});

    return new Response(JSON.stringify({ ok: true, data: parsed }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
