import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY       = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const ALLOWED_ORIGINS = ['https://trabflow.com', 'https://www.trabflow.com', 'http://localhost:5173', 'http://localhost:4173'];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

const PHOTO_VIZ_LIMITS: Record<string, number> = {
  basico:       3,
  profesional:  Infinity,
  empresa:      Infinity,
  empresa_plus: Infinity,
};

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

async function countUsageThisMonth(supabase: ReturnType<typeof createClient>, orgId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('trade_ai_usage')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('feature', 'photo_viz')
    .gte('created_at', monthStart.toISOString());

  return count ?? 0;
}

// ── 1. Transcribe audio with Whisper ──────────────────────────────────────────
async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
  const binary = atob(audioBase64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const ext  = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const blob = new Blob([bytes], { type: mimeType });

  const form = new FormData();
  form.append('file', blob, `audio.${ext}`);
  form.append('model', 'whisper-1');
  form.append('language', 'es');
  form.append('prompt', 'Reforma de cocina, baño, habitación. Cambio de materiales, fontanería, electricidad, carpintería, reformas del hogar.');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper error ${res.status}`);
  const { text } = await res.json();
  return (text ?? '').trim();
}

// ── 2. Analyze photo + request → quote outline + DALL-E prompt ────────────────
interface AnalysisResult {
  analisis: string;
  visualPrompt: string;
  resumen: string;
  partidas: { descripcion: string; cantidad: number; unidad: string; categoria: string }[];
}

async function analyzePhotoAndRequest(
  photoBase64: string,
  mimeType: string,
  descripcion: string,
): Promise<AnalysisResult> {
  const system = `Eres arquitecto de interiores y presupuestador profesional de reformas.
Analiza la foto de un espacio junto a la solicitud del cliente y genera:
1. Descripción breve del estado actual del espacio
2. Un prompt detallado en inglés para DALL-E 3 que muestre cómo quedaría el espacio DESPUÉS de la reforma (mismo ángulo, misma perspectiva, fotorrealista)
3. Resumen/título de la reforma solicitada
4. Lista de partidas de presupuesto (sin precios, el profesional los asignará)

Responde SOLO con JSON válido sin markdown:
{
  "analisis": "descripción breve del espacio actual en 1-2 frases",
  "visualPrompt": "Photorealistic interior design photo showing [specific changes described], same room angle and proportions, natural lighting, professional photography, magazine quality, detailed realistic materials",
  "resumen": "título descriptivo de la reforma (máx 60 chars)",
  "partidas": [
    { "descripcion": "nombre claro de la partida", "cantidad": 1, "unidad": "ud", "categoria": "Material|Mano de obra|Desmontaje|Gestión residuos" }
  ]
}

Reglas:
- visualPrompt SIEMPRE en inglés y muy descriptivo del resultado esperado
- Entre 6 y 14 partidas realistas para la reforma descrita
- Incluye desmontajes, materiales, mano de obra y gestión de residuos
- NO pongas precios (el profesional los asigna desde su catálogo)
- Adapta al oficio: fontanería, electricidad, carpintería, albañilería, etc.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1800,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${photoBase64}`, detail: 'high' },
            },
            {
              type: 'text',
              text: `El cliente solicita: "${descripcion}".\n\nGenera el análisis, el prompt visual y las partidas de presupuesto.`,
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GPT-4o error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw  = (data.choices?.[0]?.message?.content ?? '{}') as string;
  const clean = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(clean) as AnalysisResult;
}

// ── 3. Generate DALL-E 3 visualization ───────────────────────────────────────
async function generateVisualization(prompt: string): Promise<{ url: string | null; error: string | null }> {
  if (!OPENAI_API_KEY) return { url: null, error: 'No OPENAI_API_KEY' };
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { url: null, error: `DALL-E ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = await res.json();
    const url = (data.data?.[0]?.url ?? null) as string | null;
    return { url, error: null };
  } catch (e) {
    return { url: null, error: String(e) };
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Sin autorización' }), {
      status: 401, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }
  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const isAnonRequest = SUPABASE_ANON_KEY && token === SUPABASE_ANON_KEY;

  let orgId: string | null = null;
  let plan: 'basico' | 'profesional' | 'empresa' | 'empresa_plus' = 'basico';

  if (!isAnonRequest) {
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }
    ({ orgId, plan } = await resolveOrgAndPlan(supabase, user.id));
  }

  const limit = isAnonRequest ? Infinity : (PHOTO_VIZ_LIMITS[plan] ?? 3);

  if (orgId && limit !== Infinity) {
    const used = await countUsageThisMonth(supabase, orgId);
    if (used >= limit) {
      return new Response(JSON.stringify({
        error: `Has alcanzado el límite de ${limit} visualizaciones IA este mes en el plan Básico. Actualiza a Pro para visualizaciones ilimitadas.`,
        limit_reached: true,
        plan,
        used,
        limit,
      }), { status: 403, headers: { ...cors(req), 'Content-Type': 'application/json' } });
    }
  }

  try {
    const body = await req.json() as {
      photo: string;
      mimeType?: string;
      audio?: string;
      audioMimeType?: string;
      text?: string;
    };

    if (!body.photo) {
      return new Response(
        JSON.stringify({ error: 'Falta la foto' }),
        { status: 400, headers: { ...cors(req), 'Content-Type': 'application/json' } },
      );
    }

    let descripcion = body.text ?? '';
    if (body.audio && OPENAI_API_KEY) {
      descripcion = await transcribeAudio(body.audio, body.audioMimeType ?? 'audio/webm');
    }
    if (!descripcion.trim()) descripcion = 'Reformar y mejorar este espacio';

    const analysis = await analyzePhotoAndRequest(
      body.photo,
      body.mimeType ?? 'image/jpeg',
      descripcion,
    );

    const viz = await generateVisualization(analysis.visualPrompt);

    if (orgId) {
      await supabase.from('trade_ai_usage').insert({ org_id: orgId, feature: 'photo_viz' });
    }

    return new Response(
      JSON.stringify({
        transcripcion: descripcion,
        analisis: analysis.analisis,
        resumen: analysis.resumen,
        partidas: analysis.partidas,
        visualizacionUrl: viz.url,
        visualizacionB64: null,
        visualizacionError: viz.error,
      }),
      { headers: { ...cors(req), 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    console.error('[trade-presupuesto-foto]', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...cors(req), 'Content-Type': 'application/json' } },
    );
  }
});


