import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const OPENAI_API_KEY    = Deno.env.get('OPENAI_API_KEY') ?? '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Partida {
  descripcion: string;
  cantidad: number;
  unidad: string;
  categoria: string;
}

interface AnalysisResult {
  analisis: string;
  visualPrompt: string;
  resumen: string;
  partidas: Partida[];
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
              image_url: {
                url: `data:${mimeType};base64,${photoBase64}`,
                detail: 'high',
              },
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
async function generateVisualization(prompt: string): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
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
        response_format: 'url',
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.data?.[0]?.url ?? null) as string | null;
  } catch {
    return null;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

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
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // 1. Obtener descripción de texto
    let descripcion = body.text ?? '';
    if (body.audio && OPENAI_API_KEY) {
      descripcion = await transcribeAudio(body.audio, body.audioMimeType ?? 'audio/webm');
    }
    if (!descripcion.trim()) descripcion = 'Reformar y mejorar este espacio';

    // 2. Analizar foto + solicitud (GPT-4o Vision)
    const analysis = await analyzePhotoAndRequest(
      body.photo,
      body.mimeType ?? 'image/jpeg',
      descripcion,
    );

    // 3. Generar visualización con DALL-E 3 (en paralelo con la respuesta)
    const visualizacionUrl = await generateVisualization(analysis.visualPrompt);

    return new Response(
      JSON.stringify({
        transcripcion: descripcion,
        analisis: analysis.analisis,
        resumen: analysis.resumen,
        partidas: analysis.partidas,
        visualizacionUrl,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
