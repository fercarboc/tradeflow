import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY   = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Eres un redactor experto en contratos de mantenimiento para empresas instaladoras en España.
A partir de los datos estructurados de un presupuesto, genera el texto completo y profesional del contrato de mantenimiento.

INSTRUCCIONES:
- Usa lenguaje profesional y legal adecuado para España
- Adapta las cláusulas al SLA, sector y oficio detectados
- Incluye todas las secciones obligatorias
- Los importes en euros con IVA desglosado
- Usa el nombre del cliente y dirección si están disponibles

Responde SOLO con JSON (sin texto adicional) con esta estructura:
{
  "titulo": "CONTRATO DE MANTENIMIENTO — [OFICIO] — [CLIENTE]",
  "partes": {
    "prestador": "A completar por la empresa instaladora",
    "cliente": "<nombre_cliente o 'El CLIENTE'>",
    "direccion_servicio": "<direccion o 'A determinar'>"
  },
  "objeto": "<párrafo describiendo el objeto del contrato>",
  "servicios_incluidos": ["<servicio 1>", "<servicio 2>", ...],
  "servicios_excluidos": ["<exclusión 1>", "<exclusión 2>", ...],
  "sla": {
    "nivel": "<nivel>",
    "tiempo_respuesta": "<X horas/minutos>",
    "tiempo_resolucion": "<X horas>",
    "horario_cobertura": "<descripción horario>",
    "penalizacion": "<texto penalización si aplica>"
  },
  "preventivos": {
    "incluidos": <true|false>,
    "frecuencia": "<frecuencia>",
    "num_visitas_anio": <numero>,
    "descripcion": "<qué se hace en cada visita>"
  },
  "precio": {
    "cuota_mensual_neto": <numero>,
    "iva_pct": 21,
    "cuota_mensual_total": <numero>,
    "cuota_anual_total": <numero>,
    "tipo_facturacion": "<mensual|trimestral|anual>",
    "forma_pago": "Domiciliación bancaria el día <dia> de cada mes"
  },
  "duracion": {
    "vigencia_meses": <numero>,
    "renovacion_automatica": true,
    "preaviso_cancelacion_dias": <numero>,
    "clausula_duracion": "<texto cláusula>"
  },
  "materiales": {
    "incluidos": false,
    "clausula": "Los materiales, repuestos y piezas de sustitución no están incluidos en la cuota de mantenimiento. Se presupuestarán y facturarán por separado previo acuerdo con el cliente."
  },
  "clausulas_adicionales": ["<cláusula 1>", "<cláusula 2>", ...],
  "confidencialidad": "Las partes se comprometen a mantener la confidencialidad de la información intercambiada en el marco del presente contrato.",
  "jurisdiccion": "Para la resolución de cualquier controversia derivada del presente contrato, las partes se someten a los Juzgados y Tribunales del domicilio del PRESTADOR, con renuncia expresa a cualquier otro fuero que pudiera corresponderles.",
  "num_clausulas": <numero total de cláusulas generadas>
}`;

async function resolveOrg(supabase: ReturnType<typeof createClient>, userId: string) {
  const [ownRes, memberRes] = await Promise.all([
    supabase.from('trade_organizations').select('id, plan, nombre').eq('owner_id', userId).maybeSingle(),
    supabase.from('trade_org_members').select('org_id').eq('user_id', userId).eq('activo', true).maybeSingle(),
  ]);
  if (ownRes.data) return { orgId: ownRes.data.id, plan: ownRes.data.plan, orgNombre: ownRes.data.nombre };
  if (memberRes.data) {
    const { data: org } = await supabase.from('trade_organizations').select('id, plan, nombre').eq('id', memberRes.data.org_id).maybeSingle();
    return { orgId: org?.id ?? null, plan: org?.plan ?? 'basico', orgNombre: org?.nombre ?? '' };
  }
  return { orgId: null, plan: 'basico', orgNombre: '' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authErr } = await sb.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: CORS });
    }

    const { orgId, plan, orgNombre } = await resolveOrg(sb, user.id);
    if (!orgId) return new Response(JSON.stringify({ error: 'Organización no encontrada' }), { status: 404, headers: CORS });
    if (plan !== 'empresa_plus') return new Response(JSON.stringify({ error: 'Requiere Plan Empresa+' }), { status: 403, headers: CORS });

    const body = await req.json() as { presupuesto_id?: string; datos?: Record<string, unknown> };

    let datos: Record<string, unknown>;

    if (body.presupuesto_id) {
      const { data: presup, error: presupErr } = await sb
        .from('trade_maintenance_presupuestos')
        .select('*')
        .eq('id', body.presupuesto_id)
        .eq('org_id', orgId)
        .single();
      if (presupErr || !presup) return new Response(JSON.stringify({ error: 'Presupuesto no encontrado' }), { status: 404, headers: CORS });
      datos = presup as Record<string, unknown>;
    } else if (body.datos) {
      datos = body.datos;
    } else {
      return new Response(JSON.stringify({ error: 'Se requiere presupuesto_id o datos' }), { status: 400, headers: CORS });
    }

    // Load SLA details for context
    const { data: slaData } = await sb
      .from('trade_maintenance_sla')
      .select('*')
      .eq('nivel', datos.sla_nivel as string)
      .maybeSingle();

    // Load plantilla clauses if applicable
    const { data: plantillaData } = await sb
      .from('trade_maintenance_plantillas')
      .select('clausulas_adicionales, descripcion')
      .eq('id', datos.plantilla_id as string)
      .maybeSingle();

    const userMessage = `DATOS DEL PRESUPUESTO:
- Empresa instaladora: ${orgNombre}
- Cliente: ${(datos.nombre_cliente as string) ?? 'A determinar'}
- Dirección del servicio: ${(datos.direccion_instalacion as string) ?? 'A determinar'}
- Oficio: ${datos.oficio}
- Sector: ${datos.sector ?? 'general'}
- SLA: ${datos.sla_nivel} (${slaData ? `respuesta ${slaData.tiempo_respuesta_min}min, resolución ${slaData.tiempo_resolucion_min}min` : ''})
- Cuota mensual (neto): ${datos.cuota_mensual ?? 0}€
- IVA: ${datos.iva_pct ?? 21}%
- Tipo facturación: ${datos.tipo_facturacion ?? 'mensual'}
- Incluye preventivos: ${datos.incluye_preventivos ? `Sí, ${datos.num_visitas_preventivo} visitas, frecuencia ${datos.frecuencia_preventivo ?? 'mensual'}` : 'No'}
- Incluye guardia 24h: ${datos.incluye_guardia ? 'Sí' : 'No'}
- Materiales incluidos: No
- Duración: ${datos.duracion_meses ?? 12} meses con renovación automática
- Descripción de servicios: ${datos.descripcion_servicios ?? ''}
${plantillaData?.clausulas_adicionales ? `- Cláusulas plantilla: ${plantillaData.clausulas_adicionales}` : ''}

Genera el contrato completo y profesional en JSON.`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
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
      return new Response(JSON.stringify({ error: 'JSON inválido de la IA', raw: rawText }), { status: 502, headers: CORS });
    }

    // If presupuesto_id, save generated doc back to the record
    if (body.presupuesto_id) {
      await sb.from('trade_maintenance_presupuestos').update({
        ia_json: { ...(datos.ia_json as object ?? {}), documento: parsed },
        updated_at: new Date().toISOString(),
      }).eq('id', body.presupuesto_id);
    }

    return new Response(JSON.stringify({ ok: true, documento: parsed }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
