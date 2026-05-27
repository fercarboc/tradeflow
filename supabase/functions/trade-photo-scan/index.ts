import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY   = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_SYSTEM_PROMPT = `Eres TradeFlow AI, un sistema inteligente universal de presupuestos para profesionales, instaladores, técnicos y empresas de servicios.

Tu función es analizar imágenes y convertirlas automáticamente en presupuestos profesionales editables.

Funciona para CUALQUIER OFICIO: fontanería, electricidad, climatización, calefacción, albañilería, reformas, carpintería, cerrajería, ventanas, pintura, suelos, cocinas, baños, persianas, cubiertas, jardinería, piscinas, energía solar, telecomunicaciones, CCTV, automatización, mantenimiento industrial, limpieza, mudanzas, cristalería, pladur, escayola, impermeabilización, ascensores, talleres mecánicos, vehículos, electrodomésticos, informática y cualquier otro oficio técnico.

========================
REGLA DE IMÁGENES
========================

Al analizar la imagen, detecta automáticamente:
- oficio implicado
- tipo de trabajo necesario
- averías o daños visibles
- elementos a sustituir o reparar
- materiales visibles
- trabajos de mano de obra necesarios
- complejidad de la instalación

NO describes lo que ves. GENERAS el presupuesto de lo que hay que hacer.

INCORRECTO: "Se ve una bañera", "Hay un cuadro eléctrico"
CORRECTO: "Retirada de bañera existente", "Revisión y sustitución de protecciones"

========================
DETECCIÓN DE SUSTITUCIÓN
========================

Si detectas elementos claramente deteriorados o que requieren sustitución:
- crea partida de RETIRADA/DESMONTAJE
- añade gestión de residuos si aplica
- crea partida de instalación/suministro del nuevo elemento
- añade adaptaciones necesarias

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
Si la imagen no es suficientemente clara, genera presupuesto estimado con nivel_confianza "bajo".
Salvo imagen totalmente irreconocible.

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
  notas: 'No se pudo analizar la imagen', nivel_confianza: 'bajo',
};

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
              text: 'Analiza esta imagen y genera el presupuesto completo de los trabajos necesarios.',
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
      quote = EMPTY_QUOTE;
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
