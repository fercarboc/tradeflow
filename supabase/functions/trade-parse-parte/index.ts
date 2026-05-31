import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const OPENAI_API_KEY    = Deno.env.get('OPENAI_API_KEY') ?? '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CatalogItem {
  id: string;
  codigo: string;
  descripcion: string;
  precioBase: number;
}

interface MaterialResult {
  id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioBase: number;
}

// ── Transcribe audio with Whisper ─────────────────────────────────────────────
async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const blob = new Blob([bytes], { type: mimeType });

  const form = new FormData();
  form.append('file', blob, `audio.${ext}`);
  form.append('model', 'whisper-1');
  form.append('language', 'es');
  form.append('prompt', 'Parte de trabajo de instalador, nombres de materiales y herramientas técnicas en español. Pueden mencionarse: juntas, latiguillos, grifos, válvulas, bombas, tuberías, calorifugado, termos, calderas, cuadros eléctricos, etc.');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper error ${res.status}`);
  const { text } = await res.json();
  return (text ?? '').trim();
}

// ── Parse parte with Claude ───────────────────────────────────────────────────
async function parseParte(
  transcripcion: string,
  catalog: CatalogItem[],
): Promise<{ materiales: MaterialResult[]; notas: string }> {
  const catalogSnippet = catalog
    .slice(0, 120)
    .map(c => `${c.id}|${c.codigo}|${c.descripcion}|${c.precioBase}`)
    .join('\n');

  const prompt = `Eres el asistente de partes de trabajo de un instalador profesional.

El instalador ha dictado este parte de trabajo:
"""
${transcripcion}
"""

Catálogo de materiales disponible (formato id|codigo|descripcion|precio):
${catalogSnippet || '(catálogo vacío)'}

Tu tarea:
1. Identifica los materiales/piezas que menciona el instalador.
2. Para cada material, encuentra la mejor coincidencia en el catálogo (por descripción similar). Si no hay coincidencia, inventa un item con id="nuevo", codigo="MANUAL" y el nombre que usó el instalador a un precio estimado razonable.
3. Extrae el texto restante como notas de cierre del trabajo.

Responde SOLO con JSON válido sin markdown, con esta estructura exacta:
{
  "materiales": [
    { "id": "uuid-del-catalogo-o-nuevo", "codigo": "CODIGO", "descripcion": "nombre del material", "cantidad": 1, "precioBase": 15.00 }
  ],
  "notas": "texto libre con las observaciones del instalador"
}

Reglas:
- cantidad siempre entero >= 1
- precioBase siempre número >= 0
- notas: incluye el estado final del trabajo ("todo queda funcionando", "pendiente revisión", etc.)
- Si el instalador menciona "todo correcto", "funciona bien", etc., inclúyelo en notas
- NO incluyas en materiales: herramientas reutilizables, mano de obra
- Solo materiales consumibles o piezas instaladas`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude error ${res.status}`);
  const data = await res.json();
  const raw = (data.content?.[0]?.text ?? '').trim();

  // Strip markdown fences if present
  const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    return { materiales: [], notas: transcripcion };
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = await req.json() as {
      audio?: string;
      mimeType?: string;
      text?: string;
      catalog: CatalogItem[];
    };

    let transcripcion = body.text ?? '';

    // Transcribe audio if provided
    if (body.audio && OPENAI_API_KEY) {
      transcripcion = await transcribeAudio(body.audio, body.mimeType ?? 'audio/webm');
    }

    if (!transcripcion.trim()) {
      return new Response(
        JSON.stringify({ error: 'No hay texto para procesar' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ transcripcion, materiales: [], notas: transcripcion }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    const { materiales, notas } = await parseParte(transcripcion, body.catalog ?? []);

    return new Response(
      JSON.stringify({ transcripcion, materiales, notas }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
