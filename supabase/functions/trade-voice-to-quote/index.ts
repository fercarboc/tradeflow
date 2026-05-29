import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY      = Deno.env.get('OPENAI_API_KEY') ?? '';
const ANTHROPIC_API_KEY   = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Límites por plan ──────────────────────────────────────────────────────────
const PLAN_LIMITS = {
  basico:       { quotes_month: 15 },
  profesional:  { quotes_month: Infinity },
  empresa:      { quotes_month: Infinity },
  empresa_plus: { quotes_month: Infinity },
};

// ── Resuelve org_id + plan del usuario autenticado ────────────────────────────
async function resolveOrgAndPlan(supabase: ReturnType<typeof createClient>, userId: string) {
  const [ownRes, memberRes] = await Promise.all([
    supabase.from('trade_organizations').select('id').eq('owner_id', userId).maybeSingle(),
    supabase.from('trade_org_members').select('org_id').eq('user_id', userId).eq('activo', true).maybeSingle(),
  ]);
  const orgId = ownRes.data?.id ?? memberRes.data?.org_id ?? null;
  if (!orgId) return { orgId: null, plan: 'basico' as const };

  const { data: sub } = await supabase
    .from('trade_subscriptions')
    .select('plan, status')
    .eq('org_id', orgId)
    .maybeSingle();

  const plan = (sub?.plan ?? 'basico') as 'basico' | 'profesional' | 'empresa' | 'empresa_plus';
  return { orgId, plan };
}

// ── Cuenta presupuestos creados este mes por la org ───────────────────────────
async function countQuotesThisMonth(supabase: ReturnType<typeof createClient>, orgId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('trade_quotes')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', monthStart.toISOString());

  return count ?? 0;
}

const AI_SYSTEM_PROMPT = `Eres TradeFlow AI, sistema de presupuestos por voz para profesionales y técnicos de servicios.

Tu trabajo es interpretar dictados y convertirlos en presupuestos profesionales con partidas estructuradas, detectando el oficio correcto y aplicando tarifas del catálogo.

========================
CATÁLOGO DE OFICIOS (€/hora)
========================

{
  "limpieza":              { "min": 15, "recomendado": 20, "max": 28 },
  "jardineria":            { "min": 18, "recomendado": 25, "max": 35 },
  "electricidad":          { "min": 35, "recomendado": 50, "max": 70 },
  "fontaneria":            { "min": 35, "recomendado": 50, "max": 75 },
  "climatizacion":         { "min": 40, "recomendado": 60, "max": 85 },
  "pintura":               { "min": 22, "recomendado": 32, "max": 45 },
  "albanileria":           { "min": 28, "recomendado": 40, "max": 60 },
  "carpinteria":           { "min": 30, "recomendado": 45, "max": 65 },
  "cerrajeria":            { "min": 40, "recomendado": 60, "max": 90 },
  "mecanica":              { "min": 35, "recomendado": 55, "max": 85 },
  "mecanica_especializada":{ "min": 45, "recomendado": 65, "max": 95 },
  "informatica":           { "min": 35, "recomendado": 60, "max": 95 },
  "instalador_cctv":       { "min": 35, "recomendado": 50, "max": 75 },
  "persianas":             { "min": 30, "recomendado": 45, "max": 65 },
  "multiservicio":         { "min": 25, "recomendado": 38, "max": 55 }
}

========================
REGLAS DE DETECCIÓN
========================

1. Un presupuesto puede tener varios oficios. Detecta uno por partida.
2. Partidas de MANO DE OBRA: aplica precio_unitario = tarifa recomendada del catálogo (€/h).
3. Partidas de MATERIAL o SUMINISTRO: precio_unitario = 0, requiere_revision = true.
4. Si el oficio no existe en el catálogo: crea sugerencia en sugerencias_catalogo y marca nuevo_oficio: true.
5. Nunca conviertas m² en horas directamente.
6. Nunca inventes precios de materiales.
7. Si hay m², personas y frecuencia (limpieza): calcula horas_mes = personas × horas_por_visita × dias_semana × 4.

========================
REGLAS PARA AUTOMOCIÓN
========================

Si detectas: correa distribución, embrague, turbo, frenos, motor, caja de cambios → crear partidas:
- Desmontaje de [componente]
- Suministro de [pieza] (precio_unitario = 0)
- Instalación de [componente]
- Revisión y prueba de funcionamiento

Oficio: mecanica_especializada

========================
REGLAS PARA SUSTITUCIÓN
========================

Cuando el usuario diga "cambiar X por Y", "sustituir X", "quitar X y poner Y":
- Crea partida de desmontaje/retirada
- Crea partida de suministro (precio = 0 si no hay precio)
- Crea partida de instalación/montaje

========================
FORMATO DE SALIDA OBLIGATORIO
========================

JSON válido. Sin markdown. Sin texto fuera del JSON.

{
  "resumen": {
    "texto_original": "",
    "tipo_presupuesto": "",
    "requiere_revision_general": false,
    "alertas": []
  },
  "oficios_detectados": [
    {
      "oficio": "",
      "existe_en_catalogo": true,
      "nuevo_oficio": false,
      "tarifa_hora": { "min": 0, "recomendado": 0, "max": 0 },
      "motivo": ""
    }
  ],
  "partidas": [
    {
      "concepto": "",
      "descripcion": "",
      "oficio": "",
      "tipo_partida": "mano_obra",
      "unidad": "hora",
      "cantidad": 0,
      "precio_unitario": 0,
      "total": 0,
      "precio_origen": "catalogo",
      "requiere_revision": false,
      "motivo_revision": ""
    }
  ],
  "calculos": {
    "subtotal": 0,
    "iva_porcentaje": 21,
    "iva": 0,
    "total": 0
  },
  "sugerencias_catalogo": []
}

tipo_partida: "mano_obra" | "material" | "servicio"
unidad: "hora" | "unidad" | "m2" | "mes" | "servicio" | "jornada" | "kit"
precio_origen: "catalogo" | "usuario" | "estimado" | "pendiente"

IMPORTANTE: Los calculos.subtotal, calculos.iva y calculos.total deben ser la suma real de todos los totales de partidas.`;

const EMPTY_QUOTE = {
  resumen: { texto_original: '', tipo_presupuesto: '', requiere_revision_general: true, alertas: ['No se pudo interpretar el dictado'] },
  oficios_detectados: [],
  partidas: [],
  calculos: { subtotal: 0, iva_porcentaje: 21, iva: 0, total: 0 },
  sugerencias_catalogo: [],
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return new Response(JSON.stringify({ error: 'Sin autorización' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Anon key → modo demo (sin límites de plan, sin tracking)
  const isAnonRequest = SUPABASE_ANON_KEY && token === SUPABASE_ANON_KEY;

  let userId: string | null = null;
  if (!isAnonRequest) {
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    userId = user.id;
  }

  // ── Verificar límite de plan (solo usuarios autenticados) ─────────────────
  let orgId: string | null = null;
  let plan: 'basico' | 'profesional' | 'empresa' | 'empresa_plus' = 'basico';
  let limit = PLAN_LIMITS.basico.quotes_month;

  if (userId) {
    ({ orgId, plan } = await resolveOrgAndPlan(supabase, userId));
    limit = PLAN_LIMITS[plan]?.quotes_month ?? 15;
  }

  if (orgId && limit !== Infinity) {
    const used = await countQuotesThisMonth(supabase, orgId);
    if (used >= limit) {
      return new Response(JSON.stringify({
        error: `Has alcanzado el límite de ${limit} presupuestos este mes en el plan Básico. Actualiza a Pro para presupuestos ilimitados.`,
        limit_reached: true,
        plan,
        used,
        limit,
      }), { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
  }

  try {
    // ── Demo/anon mode: accept JSON with text field directly ─────────────────
    let transcript = '';
    const contentType = req.headers.get('content-type') ?? '';

    if (isAnonRequest && contentType.includes('application/json')) {
      const body = await req.json() as { text?: string };
      transcript = body.text?.trim() ?? '';
      if (!transcript) {
        return new Response(JSON.stringify({ error: 'El campo "text" está vacío' }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // ── Step 1: Receive audio ──────────────────────────────────────────────
      const formData = await req.formData();
      const audioFile = formData.get('audio') as File | null;
      if (!audioFile) {
        return new Response(JSON.stringify({ error: 'Falta el campo "audio" en el formulario' }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      // Validar tamaño mínimo (audio muy corto/vacío falla en Whisper)
      if (audioFile.size < 100) {
        return new Response(JSON.stringify({ error: 'Audio demasiado corto — habla un poco más tiempo' }), {
          status: 422, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      // ── Step 2: Transcription (OpenAI Whisper) ─────────────────────────────
      // Preservar extensión original para que Whisper detecte el formato correctamente
      const originalName = audioFile.name || 'audio.webm';
      const whisperForm = new FormData();
      whisperForm.append('file', audioFile, originalName);
      whisperForm.append('model', 'gpt-4o-mini-transcribe');
      whisperForm.append('language', 'es');
      whisperForm.append('prompt', 'Transcripción de un profesional describiendo trabajos técnicos, instalaciones, reparaciones o reformas. Español de España.');

      const transcribeRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: whisperForm,
      });

      if (!transcribeRes.ok) {
        const err = await transcribeRes.text();
        throw new Error(`OpenAI STT error ${transcribeRes.status}: ${err}`);
      }

      const { text: sttText } = await transcribeRes.json() as { text: string };
      transcript = sttText ?? '';
      if (!transcript.trim()) {
        return new Response(JSON.stringify({ error: 'No se detectó voz en el audio' }), {
          status: 422, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Step 3: Generate quote structure (Claude Haiku) ──────────────────────
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: AI_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `El profesional dice: "${transcript}"` }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error(`Claude error ${claudeRes.status}: ${err}`);
    }

    const claudeData = await claudeRes.json() as { content: Array<{ text: string }> };
    const rawText = claudeData.content[0]?.text ?? '{}';

    let quote: Record<string, unknown>;
    try {
      const clean = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      quote = JSON.parse(clean);
    } catch {
      quote = { ...EMPTY_QUOTE, resumen: transcript };
    }

    // ── Registrar uso en trade_ai_usage ──────────────────────────────────────
    if (orgId) {
      await supabase.from('trade_ai_usage').insert({ org_id: orgId, feature: 'voice' });
    }

    return new Response(
      JSON.stringify({ transcript, quote }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );

  } catch (e: unknown) {
    const msg = (e as Error).message ?? 'Error desconocido';
    console.error('[trade-voice-to-quote]', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
