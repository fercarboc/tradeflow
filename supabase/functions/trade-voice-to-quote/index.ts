import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY     = Deno.env.get('OPENAI_API_KEY') ?? '';
const ANTHROPIC_API_KEY  = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL        = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PARSING_PROMPT = `Eres un asistente de TradeFlow para instaladores españoles.
Analiza la transcripción de voz y extrae información estructurada de trabajos de instalación.

REGLA CRÍTICA: NO incluyas precios. Solo estructura las tareas y materiales.
Los precios los aplica el sistema según el catálogo de la empresa.

Devuelve JSON EXACTAMENTE con esta estructura (sin markdown, solo JSON puro):
{
  "tasks": [
    { "descripcion": "string", "tipo": "mano_de_obra", "cantidad": 1 }
  ],
  "materials": [
    { "descripcion": "string", "tipo": "material", "cantidad": 1, "unidad": "ud" }
  ],
  "urgency": "normal",
  "notes": ""
}

Reglas:
- tasks: mano de obra, instalaciones, revisiones
- materials: productos físicos, componentes, piezas
- urgency: "urgente" | "alta" | "normal" | "baja"
- unidades válidas: "ud" | "ml" | "m2" | "m3" | "h" | "kg" | "jornada"
- Si no hay materials o tasks, deja el array vacío []
- cantidad siempre número positivo`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  // Verify JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Sin autorización' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  try {
    // ── Step 1: Receive audio ────────────────────────────────────────────
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    if (!audioFile) {
      return new Response(JSON.stringify({ error: 'Falta el campo "audio" en el formulario' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── Step 2: Transcription (OpenAI Whisper) ───────────────────────────
    const whisperForm = new FormData();
    whisperForm.append('file', audioFile, 'audio.webm');
    whisperForm.append('model', 'gpt-4o-mini-transcribe');
    whisperForm.append('language', 'es');
    whisperForm.append('prompt', 'Transcripción de un instalador describiendo trabajos de fontanería, electricidad, climatización u otros oficios. Español de España.');

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

    // ── Step 3: Structured extraction (Claude Haiku) ─────────────────────
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `${PARSING_PROMPT}\n\nTexto del instalador: "${transcript}"`,
        }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error(`Claude error ${claudeRes.status}: ${err}`);
    }

    const claudeData = await claudeRes.json() as { content: Array<{ text: string }> };
    const rawText = claudeData.content[0]?.text ?? '{}';

    let parsed: { tasks?: Array<{ descripcion: string; tipo: string; cantidad: number }>; materials?: Array<{ descripcion: string; tipo: string; cantidad: number; unidad?: string }> };
    try {
      // Strip markdown code blocks if present
      const clean = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      // Fallback: return transcript only, no items
      parsed = { tasks: [], materials: [] };
    }

    // ── Step 4: Merge tasks + materials into flat items list ─────────────
    const items = [
      ...(parsed.tasks ?? []).map(t => ({
        descripcion: t.descripcion,
        tipo: 'mano_de_obra',
        cantidad: Number(t.cantidad) || 1,
      })),
      ...(parsed.materials ?? []).map(m => ({
        descripcion: m.descripcion,
        tipo: 'material',
        cantidad: Number(m.cantidad) || 1,
        unidad: m.unidad ?? 'ud',
      })),
    ];

    return new Response(
      JSON.stringify({ transcript, items }),
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
