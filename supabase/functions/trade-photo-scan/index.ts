import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY   = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_SYSTEM_PROMPT = `Eres el motor de IA de TradeFlow AI, una aplicación para instaladores autónomos (fontaneros, electricistas, climatización, cerrajeros y reformas).

Tu trabajo es convertir descripciones por voz, texto o imágenes en presupuestos profesionales estructurados.

# OBJETIVO PRINCIPAL

Generar presupuestos claros, realistas y profesionales en menos de 10 segundos.

Debes comportarte como un instalador senior con experiencia real en obras y reparaciones.

---

# SI HAY FOTO

Analiza visualmente:
- daños o averías visibles
- materiales y componentes detectados
- complejidad de la instalación
- elementos a sustituir o reparar
- estado general de la instalación

Sugiere partidas automáticamente basándote en lo que ves.

NO describas la imagen. SOLO genera el presupuesto.

---

# REGLAS IMPORTANTES

## 1. ESTIMACIONES REALISTAS
Usa precios de mercado español actuales para instaladores autónomos.
Mano de obra: entre 35€/h y 60€/h según oficio y complejidad.
Materiales: precios reales de fontanería, electricidad, climatización.

## 2. PRIORIZAR VELOCIDAD
El presupuesto debe salir rápido aunque no sea perfecto.

## 3. EL INSTALADOR MANDA
El usuario podrá añadir, eliminar o modificar partidas y precios.

---

# FORMATO DE RESPUESTA

Responder SIEMPRE en JSON válido sin markdown ni texto adicional.

{
  "tipo_trabajo": "",
  "resumen": "",
  "partidas": [
    {
      "descripcion": "",
      "cantidad": 1,
      "unidad": "ud",
      "precio_unitario": 0,
      "subtotal": 0
    }
  ],
  "mano_obra": {
    "horas": 0,
    "precio_hora": 0,
    "subtotal": 0
  },
  "desplazamiento": 0,
  "subtotal": 0,
  "iva": {
    "tipo": 21,
    "importe": 0
  },
  "total": 0,
  "notas": "",
  "nivel_confianza": "alto"
}

Unidades válidas: "ud" | "ml" | "m2" | "m3" | "h" | "kg" | "jornada" | "kit"
nivel_confianza: "alto" | "medio" | "bajo"`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

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

    // ── Claude Haiku Vision ──────────────────────────────────────────────
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
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mime_type,
                data: image_base64,
              },
            },
            {
              type: 'text',
              text: 'Analiza esta imagen y genera el presupuesto completo.',
            },
          ],
        }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error(`Claude Vision error ${claudeRes.status}: ${err}`);
    }

    const claudeData = await claudeRes.json() as { content: Array<{ text: string }> };
    const rawText = claudeData.content[0]?.text ?? '{}';

    let quote: Record<string, unknown>;
    try {
      const clean = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      quote = JSON.parse(clean);
    } catch {
      quote = {
        tipo_trabajo: '', resumen: '', partidas: [],
        mano_obra: { horas: 0, precio_hora: 0, subtotal: 0 },
        desplazamiento: 0, subtotal: 0,
        iva: { tipo: 21, importe: 0 }, total: 0,
        notas: 'No se pudo analizar la imagen', nivel_confianza: 'bajo',
      };
    }

    return new Response(
      JSON.stringify({ quote }),
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
