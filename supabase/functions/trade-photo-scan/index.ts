import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY      = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VISION_PROMPT = `Eres un asistente experto para instaladores españoles (fontaneros, electricistas, técnicos de climatización, etc.).

Analiza la imagen y detecta:
- Materiales o componentes visibles que puedan necesitar reparación, sustitución o instalación
- Trabajos de mano de obra necesarios (instalación, sustitución, reparación)
- Averías o problemas visibles

REGLA CRÍTICA: NO incluyas precios. Solo identifica materiales y tareas.
Los precios los aplica el sistema según el catálogo del instalador.

Devuelve JSON EXACTAMENTE con esta estructura (sin markdown, solo JSON puro):
{
  "items": [
    { "descripcion": "string", "tipo": "material", "cantidad": 1, "unidad": "ud" },
    { "descripcion": "string", "tipo": "mano_de_obra", "cantidad": 1, "unidad": "h" }
  ],
  "notes": "observaciones opcionales sobre la instalación o avería"
}

Reglas:
- tipo: "material" para productos físicos | "mano_de_obra" para trabajos
- unidades válidas: "ud" | "ml" | "m2" | "m3" | "h" | "kg" | "jornada"
- cantidad siempre número positivo
- Si no detectas nada relevante, devuelve items array vacío
- Descripción en español, concisa y técnica (ej: "Grifo monomando cocina", "Diferencial 2P 40A", "Mano de obra sustitución calentador")`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  // Verificar JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Sin autorización' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Token inválido' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json() as { image_base64: string; mime_type?: string };
    const { image_base64, mime_type = 'image/jpeg' } = body;

    if (!image_base64) {
      return new Response(JSON.stringify({ error: 'Falta image_base64' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Llamada a GPT-4o Vision
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: VISION_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mime_type};base64,${image_base64}`,
                detail: 'high',
              },
            },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI Vision error ${res.status}: ${err}`);
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const rawText = data.choices[0]?.message?.content ?? '{}';

    let parsed: { items?: Array<{ descripcion: string; tipo: string; cantidad: number; unidad?: string }>; notes?: string };
    try {
      const clean = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = { items: [], notes: 'No se pudo parsear la respuesta' };
    }

    return new Response(
      JSON.stringify({ items: parsed.items ?? [], notes: parsed.notes ?? '' }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );

  } catch (e: unknown) {
    const msg = (e as Error).message ?? 'Error desconocido';
    console.error('[trade-photo-scan]', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
