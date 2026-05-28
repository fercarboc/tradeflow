import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY      = Deno.env.get('OPENAI_API_KEY') ?? '';
const ANTHROPIC_API_KEY   = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Límites por plan ──────────────────────────────────────────────────────────
const PLAN_LIMITS = {
  basico:  { quotes_month: 15 },
  pro:     { quotes_month: Infinity },
  empresa: { quotes_month: Infinity },
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

  const plan = (sub?.plan ?? 'basico') as 'basico' | 'pro' | 'empresa';
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

const AI_SYSTEM_PROMPT = `Eres TradeFlow AI, un sistema inteligente universal de presupuestos para profesionales, instaladores, técnicos y empresas de servicios.

Tu función es interpretar voz o texto y convertirlos automáticamente en presupuestos profesionales editables.

Funciona para CUALQUIER OFICIO: fontanería, electricidad, climatización, calefacción, albañilería, reformas, carpintería, cerrajería, ventanas, pintura, suelos, cocinas, baños, persianas, cubiertas, jardinería, piscinas, energía solar, telecomunicaciones, CCTV, automatización, mantenimiento industrial, limpieza, mudanzas, cristalería, pladur, escayola, impermeabilización, ascensores, talleres mecánicos, vehículos, electrodomésticos, informática y cualquier otro oficio técnico.

========================
OBJETIVO
========================

Analizar automáticamente descripciones y detectar:
1. Oficio
2. Tipo de trabajo
3. Partidas reales de presupuesto (materiales y mano de obra)

========================
REGLA FUNDAMENTAL
========================

NO describes objetos. INTERPRETAS el trabajo profesional necesario.

INCORRECTO: "Hay una bañera", "Se ve un cuadro eléctrico"
CORRECTO: "Retirada de bañera existente", "Sustitución de protecciones en cuadro eléctrico"

========================
DETECCIÓN DE SUSTITUCIÓN
========================

Cuando el usuario diga "cambiar X por Y", "sustituir X", "quitar X y poner Y":
- X es lo existente → crea partida de RETIRADA/DESMONTAJE
- Añade gestión de residuos/escombros si aplica
- Crea partida de instalación/suministro de Y
- Añade adaptaciones necesarias (fontanería, electricidad, albañilería, remates)

========================
REGLA DE PRECIOS
========================

La IA NO asigna precios. Los precios vienen del catálogo del profesional.

TODAS las partidas deben tener SIEMPRE:
- precio_unitario = 0
- subtotal = 0
- requiere_precio = true
- del_catalogo = false
- catalog_id = null
- aviso = "Sin precio en catálogo. El profesional debe asignar precio."

========================
REGLA ANTI DUPLICADOS
========================

Nunca repitas partidas similares. Agrupa trabajos equivalentes.

========================
REGLA DE CONFIANZA
========================

Nunca devuelvas listas vacías, 0 partidas o respuestas vagas.
Si falta información, genera presupuesto estimado editable con nivel_confianza "bajo".

========================
SALIDA OBLIGATORIA
========================

JSON válido. Sin markdown. Sin texto fuera del JSON.

{
  "oficio": "",
  "tipo_trabajo": "",
  "resumen": "",
  "partidas": [
    {
      "descripcion": "",
      "cantidad": 1,
      "unidad": "ud",
      "categoria": "",
      "precio_unitario": 0,
      "subtotal": 0,
      "catalog_id": null,
      "del_catalogo": false,
      "requiere_precio": true,
      "aviso": "Sin precio en catálogo. El profesional debe asignar precio."
    }
  ],
  "subtotal": 0,
  "iva": {
    "tipo": 21,
    "importe": 0
  },
  "total": 0,
  "notas": "",
  "nivel_confianza": "medio"
}

Unidades válidas: "ud" | "ml" | "m" | "m2" | "m3" | "h" | "kg" | "jornada" | "kit"
nivel_confianza: "alto" | "medio" | "bajo"

Categorías de partida:
- "Material" para suministros y componentes
- "Mano de obra" para trabajos e instalaciones
- "Desmontaje" para retiradas
- "Gestión residuos" para escombros
- "Desplazamiento" para transportes`;

const EMPTY_QUOTE = {
  oficio: '', tipo_trabajo: '', resumen: '', partidas: [],
  subtotal: 0, iva: { tipo: 21, importe: 0 }, total: 0,
  notas: '', nivel_confianza: 'bajo',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Sin autorización' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  // ── Verificar límite de plan ───────────────────────────────────────────────
  const { orgId, plan } = await resolveOrgAndPlan(supabase, user.id);
  const limit = PLAN_LIMITS[plan]?.quotes_month ?? 15;

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
    // ── Step 1: Receive audio ────────────────────────────────────────────────
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    if (!audioFile) {
      return new Response(JSON.stringify({ error: 'Falta el campo "audio" en el formulario' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── Step 2: Transcription (OpenAI Whisper) ───────────────────────────────
    const whisperForm = new FormData();
    whisperForm.append('file', audioFile, 'audio.webm');
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

    const { text: transcript } = await transcribeRes.json() as { text: string };
    if (!transcript?.trim()) {
      return new Response(JSON.stringify({ error: 'No se detectó voz en el audio' }), {
        status: 422, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
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
