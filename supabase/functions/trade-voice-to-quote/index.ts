import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMPTY_QUOTE = {
  tipo_trabajo: '',
  resumen: '',
  partidas: [],
  mano_obra: { horas: 0, precio_hora: 0, subtotal: 0 },
  desplazamiento: 0,
  subtotal: 0,
  iva: { tipo: 21, importe: 0 },
  total: 0,
  notas: '',
  nivel_confianza: 'bajo',
};

const AI_SYSTEM_PROMPT = `
Eres TradeFlow AI, un motor de presupuestos para reformas, fontanería e instalaciones.

Interpretas dictados de instaladores en español y generas partidas de presupuesto.

REGLA CRÍTICA DE SUSTITUCIÓN:
Cuando el usuario diga:
- "cambiar X por Y"
- "sustituir X por Y"
- "reemplazar X por Y"
- "quitar X y poner Y"
- "retirar X y colocar Y"

Entonces:
- X es el elemento existente.
- NO presupuestes X como suministro nuevo.
- Crea una partida de retirada/desmontaje de X.
- Crea una partida de gestión de escombros si aplica.
- Crea una partida de suministro e instalación de Y.
- Añade adaptaciones necesarias: fontanería, electricidad, albañilería o remates.

EJEMPLO:
Texto: "Cambiar una bañera por plato de ducha"

Correcto:
- Retirada de bañera existente
- Gestión de escombros
- Adaptación de desagüe y fontanería
- Suministro e instalación de plato de ducha
- Remates de alicatado
- Instalación de mampara SOLO si se menciona o como partida opcional

Incorrecto:
- Suministro de bañera
- Instalación de bañera
- Bañera nueva

REGLA ANTI-DUPLICADOS:
No repitas partidas.
No dupliques "mano de obra" si ya está incluida en partidas.
Agrupa partidas parecidas.

REGLA DE PRECIOS:
Puedes proponer precios orientativos si no hay catálogo.
No inventes medidas exactas.
Usa cantidades razonables y nivel_confianza medio o bajo.

Devuelve SOLO JSON válido, sin markdown.

Formato exacto:
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
    .replace(/[^\w\s]/g, '')
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

function removeWrongOldElementPartidas(partidas: any[], transcript: string) {
  const text = normalizeText(transcript);

  const replacementRules = [
    {
      trigger: ['cambiar banera por plato', 'sustituir banera por plato', 'quitar banera y poner plato'],
      oldWords: ['banera nueva', 'suministro de banera', 'instalacion de banera', 'colocacion de banera'],
    },
  ];

  return partidas.filter((p) => {
    const desc = normalizeText(String(p?.descripcion ?? ''));

    for (const rule of replacementRules) {
      const applies = rule.trigger.some((t) => text.includes(t));
      if (!applies) continue;
      const isWrongOldItem = rule.oldWords.some((w) => desc.includes(w));
      if (isWrongOldItem) return false;
    }

    return true;
  });
}

function enforceReplacementLogic(partidas: any[], transcript: string) {
  const text = normalizeText(transcript);
  const result = [...partidas];

  const has = (needle: string) =>
    result.some((p) => normalizeText(String(p.descripcion)).includes(needle));

  const add = (partida: any) => {
    if (!has(normalizeText(partida.descripcion))) {
      result.push(partida);
    }
  };

  const isBathToShower =
    text.includes('cambiar banera por plato') ||
    text.includes('sustituir banera por plato') ||
    text.includes('reemplazar banera por plato') ||
    text.includes('quitar banera y poner plato') ||
    text.includes('retirar banera y colocar plato');

  if (isBathToShower) {
    add({ descripcion: 'Retirada de bañera existente', cantidad: 1, unidad: 'ud', precio_unitario: 180, subtotal: 180 });
    add({ descripcion: 'Gestión y retirada de escombros', cantidad: 1, unidad: 'ud', precio_unitario: 90, subtotal: 90 });
    add({ descripcion: 'Adaptación de desagüe y fontanería para plato de ducha', cantidad: 1, unidad: 'ud', precio_unitario: 220, subtotal: 220 });
    add({ descripcion: 'Suministro e instalación de plato de ducha', cantidad: 1, unidad: 'ud', precio_unitario: 480, subtotal: 480 });
    add({ descripcion: 'Remates de alicatado en zona de ducha', cantidad: 1, unidad: 'ud', precio_unitario: 280, subtotal: 280 });
  }

  return result;
}

function sanitizeQuote(input: any, transcript: string) {
  const quote = input && typeof input === 'object' ? input : {};

  let partidas = Array.isArray(quote.partidas) ? quote.partidas : [];
  partidas = removeWrongOldElementPartidas(partidas, transcript);
  partidas = enforceReplacementLogic(partidas, transcript);
  partidas = dedupePartidas(partidas);

  const cleanPartidas = partidas.map((p: any) => {
    const cantidad = Number(p?.cantidad ?? 1);
    const precio = Number(p?.precio_unitario ?? 0);

    return {
      descripcion: String(p?.descripcion ?? 'Partida estimada'),
      cantidad,
      unidad: String(p?.unidad ?? 'ud'),
      precio_unitario: precio,
      subtotal: Number(p?.subtotal ?? cantidad * precio),
    };
  });

  const manoObra = quote.mano_obra && typeof quote.mano_obra === 'object' ? quote.mano_obra : {};
  const horas = Number(manoObra.horas ?? 0);
  const precioHora = Number(manoObra.precio_hora ?? 0);
  const manoObraSubtotal = Number(manoObra.subtotal ?? horas * precioHora);

  const partidasSubtotal = cleanPartidas.reduce((sum: number, p: any) => sum + Number(p.subtotal || 0), 0);
  const desplazamiento = Number(quote.desplazamiento ?? 0);
  const subtotal = partidasSubtotal + manoObraSubtotal + desplazamiento;
  const ivaTipo = Number(quote?.iva?.tipo ?? 21);
  const ivaImporte = Number(subtotal * ivaTipo / 100);
  const total = subtotal + ivaImporte;

  return {
    tipo_trabajo: String(quote.tipo_trabajo ?? 'Presupuesto de reforma'),
    resumen: String(quote.resumen ?? 'Presupuesto generado a partir del dictado.'),
    partidas: cleanPartidas,
    mano_obra: {
      horas,
      precio_hora: precioHora,
      subtotal: manoObraSubtotal,
    },
    desplazamiento,
    subtotal,
    iva: {
      tipo: ivaTipo,
      importe: Number(ivaImporte.toFixed(2)),
    },
    total: Number(total.toFixed(2)),
    notas: String(quote.notas ?? 'Estimación orientativa. Confirmar medidas, calidades y estado real en visita.'),
    nivel_confianza: String(quote.nivel_confianza ?? 'medio'),
  };
}

async function transcribeAudio(audioBase64: string, mimeType = 'audio/webm') {
  const binary = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
  const blob = new Blob([binary], { type: mimeType });

  const formData = new FormData();
  formData.append('file', blob, 'audio.webm');
  formData.append('model', 'gpt-4o-mini-transcribe');
  formData.append('language', 'es');
  formData.append('prompt', 'Transcripción de un instalador español describiendo trabajos de reforma, fontanería, electricidad o presupuestos.');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`OpenAI transcription error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return String(data.text ?? '');
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

    lastError = `Claude error ${res.status}: ${await res.text()}`;

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
        transcript: '',
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
        transcript: '',
        quote: EMPTY_QUOTE,
        error: 'Token inválido',
      }, 401);
    }

    const body = await req.json() as {
      transcript?: string;
      audio_base64?: string;
      mime_type?: string;
    };

    let transcript = String(body.transcript ?? '').trim();

    if (!transcript && body.audio_base64) {
      transcript = await transcribeAudio(body.audio_base64, body.mime_type ?? 'audio/webm');
    }

    if (!transcript) {
      return jsonResponse({
        success: false,
        transcript: '',
        quote: EMPTY_QUOTE,
        error: 'Falta transcript o audio_base64',
      }, 400);
    }

    const claudeRes = await callClaudeWithRetry({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: AI_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Dictado del instalador: "${transcript}"

Genera el presupuesto respetando especialmente la regla de sustitución:
si se cambia X por Y, X se retira y Y se instala.`,
        },
      ],
    });

    const claudeData = await claudeRes.json();

    const rawText = Array.isArray(claudeData.content)
      ? claudeData.content[0]?.text ?? '{}'
      : '{}';

    let parsed: unknown = EMPTY_QUOTE;

    try {
      const clean = rawText
        .replace(/```json?/g, '')
        .replace(/```/g, '')
        .trim();

      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        ...EMPTY_QUOTE,
        notas: 'La IA respondió con formato inválido. Se generó una estructura editable.',
      };
    }

    const quote = sanitizeQuote(parsed, transcript);

    return jsonResponse({
      success: true,
      transcript,
      quote,
      error: null,
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error desconocido';
    console.error('[trade-voice-to-quote]', msg);

    return jsonResponse({
      success: false,
      transcript: '',
      quote: {
        ...EMPTY_QUOTE,
        notas: 'La IA no pudo procesar el dictado. Puedes crear el presupuesto manualmente.',
      },
      error: msg,
    }, 200);
  }
});