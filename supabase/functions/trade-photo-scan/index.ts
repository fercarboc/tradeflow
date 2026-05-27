import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMPTY_QUOTE = {
  oficio: '',
  tipo_trabajo: '',
  resumen: '',
  partidas: [],
  subtotal: 0,
  iva: { tipo: 21, importe: 0 },
  total: 0,
  notas: '',
  nivel_confianza: 'bajo',
};

const AI_SYSTEM_PROMPT = `
Eres TradeFlow AI, un detector visual de partidas para presupuestos de instaladores y reformas.

El usuario puede subir SOLO una foto sin escribir nada.

Tu tarea:
1. Detectar el oficio principal.
2. Detectar el tipo de trabajo probable.
3. Detectar partidas reales de presupuesto.
4. NO poner precios.
5. NO inventar importes.
6. NO devolver materiales sueltos si realmente son trabajos completos.
7. Devolver partidas editables que luego el sistema buscará en el catálogo del usuario.

OFICIOS SOPORTADOS:
- fontaneria
- electricidad
- climatizacion
- calefaccion
- reformas
- albanileria
- carpinteria_madera
- carpinteria_metalica
- ventanas
- cerrajeria
- pintura
- suelos
- banos
- cocinas
- cubiertas
- persianas_toldos
- otros

EJEMPLOS:
Si ves cocina antigua:
- desmontaje y retirada de mobiliario de cocina existente
- demolición o preparación de alicatado
- adaptación de fontanería
- adaptación de electricidad
- instalación de mobiliario de cocina
- instalación de encimera
- instalación de fregadero y grifería
- remates finales

Si ves cuadro eléctrico:
- revisión de cuadro eléctrico
- adecuación de cuadro eléctrico
- instalación de protecciones magnetotérmicas
- instalación de diferencial
- ordenación de cableado
- etiquetado de circuitos
- comprobación de instalación

Si ves baño:
- retirada de sanitarios
- demolición de alicatado
- adaptación de fontanería
- instalación de plato de ducha o bañera
- instalación de sanitarios
- remates

REGLAS:
- No devuelvas 0 partidas salvo que la imagen sea irreconocible.
- No digas "falta información".
- No inventes medidas exactas.
- Usa cantidades estimadas razonables.
- Nunca incluyas precio_unitario, subtotal, total ni importe.
- Devuelve SOLO JSON válido, sin markdown.

Formato exacto:
{
  "oficio": "",
  "tipo_trabajo": "",
  "resumen": "",
  "partidas_detectadas": [
    {
      "descripcion": "",
      "cantidad": 1,
      "unidad": "ud",
      "categoria": ""
    }
  ],
  "notas": "",
  "nivel_confianza": "medio"
}
`;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupePartidas(partidas: any[]) {
  const seen = new Set<string>();

  return partidas.filter((p) => {
    const key = normalizeText(String(p?.descripcion ?? ''));
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scoreCatalogMatch(partidaDescripcion: string, catalogDescripcion: string, familia = '') {
  const partida = normalizeText(partidaDescripcion);
  const catalog = normalizeText(`${catalogDescripcion} ${familia}`);

  if (!partida || !catalog) return 0;
  if (catalog === partida) return 100;
  if (catalog.includes(partida) || partida.includes(catalog)) return 85;

  const partidaWords = partida.split(' ').filter((w) => w.length > 3);
  const catalogWords = catalog.split(' ').filter((w) => w.length > 3);

  if (partidaWords.length === 0 || catalogWords.length === 0) return 0;

  let matches = 0;

  for (const word of partidaWords) {
    if (catalogWords.includes(word)) matches++;
  }

  return Math.round((matches / partidaWords.length) * 100);
}

function findBestCatalogItem(partida: any, catalog: any[]) {
  let best: any = null;
  let bestScore = 0;

  for (const item of catalog) {
    const score = scoreCatalogMatch(
      String(partida.descripcion ?? ''),
      String(item.descripcion ?? ''),
      String(item.familia ?? ''),
    );

    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }

  if (bestScore >= 45) {
    return best;
  }

  return null;
}

async function getUserOrgId(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('trade_organizations')
    .select('id, iva_default')
    .eq('owner_id', userId)
    .single();

  if (error || !data?.id) {
    throw new Error('No se encontró organización para el usuario');
  }

  return {
    orgId: data.id,
    ivaDefault: Number(data.iva_default ?? 21),
  };
}

async function loadCatalog(supabase: any, orgId: string) {
  const { data, error } = await supabase
    .from('trade_catalog')
    .select('id, descripcion, precio_base, unidad, familia, activo')
    .eq('org_id', orgId)
    .eq('activo', true);

  if (error) {
    throw new Error(`Error cargando catálogo: ${error.message}`);
  }

  return data ?? [];
}

function buildQuoteFromDetected(parsed: any, catalog: any[], ivaDefault: number) {
  const detected = Array.isArray(parsed?.partidas_detectadas)
    ? parsed.partidas_detectadas
    : [];

  const uniquePartidas = dedupePartidas(detected);

  const partidas = uniquePartidas.map((p: any) => {
    const match = findBestCatalogItem(p, catalog);

    const cantidad = Number(p?.cantidad ?? 1);
    const unidad = match?.unidad ?? String(p?.unidad ?? 'ud');
    const precio = match ? Number(match.precio_base ?? 0) : 0;
    const subtotal = cantidad * precio;

    return {
      descripcion: String(p?.descripcion ?? 'Partida detectada'),
      cantidad,
      unidad,
      categoria: String(p?.categoria ?? ''),
      precio_unitario: precio,
      subtotal,
      catalog_id: match?.id ?? null,
      del_catalogo: Boolean(match),
      requiere_precio: !match,
      aviso: match ? null : 'No hay precio en catálogo para esta partida',
    };
  });

  const subtotal = partidas.reduce(
    (sum: number, p: any) => sum + Number(p.subtotal || 0),
    0,
  );

  const ivaImporte = subtotal * ivaDefault / 100;
  const total = subtotal + ivaImporte;

  const partidasSinPrecio = partidas.filter((p: any) => p.requiere_precio).length;

  return {
    oficio: String(parsed?.oficio ?? ''),
    tipo_trabajo: String(parsed?.tipo_trabajo ?? 'Presupuesto generado desde foto'),
    resumen: String(parsed?.resumen ?? 'Partidas detectadas automáticamente desde imagen.'),
    partidas,
    subtotal: Number(subtotal.toFixed(2)),
    iva: {
      tipo: ivaDefault,
      importe: Number(ivaImporte.toFixed(2)),
    },
    total: Number(total.toFixed(2)),
    notas: partidasSinPrecio > 0
      ? `Hay ${partidasSinPrecio} partida(s) sin precio en catálogo. Revisa y completa los precios antes de enviar el presupuesto.`
      : String(parsed?.notas ?? 'Precios aplicados desde catálogo.'),
    nivel_confianza: String(parsed?.nivel_confianza ?? 'medio'),
  };
}

async function callClaudeWithRetry(payload: unknown, retries = 3) {
  let lastError = '';

  for (let i = 0; i < retries; i++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) return res;

    lastError = `Claude Vision error ${res.status}: ${await res.text()}`;

    if (![429, 500, 529].includes(res.status)) break;

    await new Promise((resolve) => setTimeout(resolve, 1500 * (i + 1)));
  }

  throw new Error(lastError);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return jsonResponse({
        success: false,
        quote: EMPTY_QUOTE,
        error: 'Sin autorización',
      }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );

    if (authErr || !user) {
      return jsonResponse({
        success: false,
        quote: EMPTY_QUOTE,
        error: 'Token inválido',
      }, 401);
    }

    const { orgId, ivaDefault } = await getUserOrgId(supabase, user.id);
    const catalog = await loadCatalog(supabase, orgId);

    const body = await req.json() as {
      image_base64?: string;
      mime_type?: string;
      hint?: string;
    };

    const imageBase64 = String(body.image_base64 ?? '').trim();
    const mimeType = String(body.mime_type ?? 'image/jpeg');
    const hint = String(body.hint ?? '');

    if (!imageBase64) {
      return jsonResponse({
        success: false,
        quote: EMPTY_QUOTE,
        error: 'Falta image_base64',
      }, 400);
    }

    const claudeRes = await callClaudeWithRetry({
      model: CLAUDE_MODEL,
      max_tokens: 1800,
      system: AI_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `Analiza la foto y devuelve partidas de presupuesto SIN precios.
Pista opcional del usuario: ${hint || 'sin pista'}`,
            },
          ],
        },
      ],
    });

    const claudeData = await claudeRes.json();

    const rawText = Array.isArray(claudeData.content)
      ? String(claudeData.content[0]?.text ?? '{}')
      : '{}';

    let parsed: any = {};

    try {
      const clean = rawText
        .replace(/```json?/g, '')
        .replace(/```/g, '')
        .trim();

      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        oficio: '',
        tipo_trabajo: 'Presupuesto generado desde foto',
        resumen: 'La IA detectó la imagen pero devolvió un formato no válido.',
        partidas_detectadas: [],
        notas: 'Formato IA inválido.',
        nivel_confianza: 'bajo',
      };
    }

    const quote = buildQuoteFromDetected(parsed, catalog, ivaDefault);

    return jsonResponse({
      success: true,
      org_id: orgId,
      quote,
      raw_ai_text: rawText,
      error: null,
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error desconocido';
    console.error('[trade-photo-scan]', msg);

    return jsonResponse({
      success: false,
      quote: {
        ...EMPTY_QUOTE,
        notas: 'La IA no pudo procesar la imagen. Puedes crear el presupuesto manualmente.',
      },
      error: msg,
    }, 200);
  }
});