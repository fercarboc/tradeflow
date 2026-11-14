import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY   = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const ALLOWED_ORIGINS = ['https://trabflow.com', 'https://www.trabflow.com', 'http://localhost:5173', 'http://localhost:4173'];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': (ALLOWED_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

// ── Límites por plan ──────────────────────────────────────────────────────────
const PHOTO_LIMITS = {
  basico:       5,
  profesional:  Infinity,
  empresa:      Infinity,
  empresa_plus: Infinity,
};

// ── Resuelve org_id + plan del usuario autenticado ────────────────────────────
async function resolveOrgAndPlan(supabase: ReturnType<typeof createClient>, userId: string) {
  const [ownRes, memberRes] = await Promise.all([
    supabase.from('trade_organizations').select('id, oficio').eq('owner_id', userId).maybeSingle(),
    supabase.from('trade_org_members').select('org_id').eq('user_id', userId).eq('activo', true).maybeSingle(),
  ]);
  const orgId = ownRes.data?.id ?? memberRes.data?.org_id ?? null;
  if (!orgId) return { orgId: null, plan: 'basico' as const, oficio: null as string | null };

  let oficio: string | null = (ownRes.data as { oficio?: string | null } | null)?.oficio ?? null;
  if (!ownRes.data) {
    const { data: o } = await supabase.from('trade_organizations').select('oficio').eq('id', orgId).maybeSingle();
    oficio = (o as { oficio?: string | null } | null)?.oficio ?? null;
  }

  const { data: sub } = await supabase
    .from('trade_subscriptions')
    .select('plan, status')
    .eq('org_id', orgId)
    .maybeSingle();

  const plan = (sub?.plan ?? 'basico') as 'basico' | 'profesional' | 'empresa' | 'empresa_plus';
  return { orgId, plan, oficio };
}

// ── Cuenta usos de foto IA este mes ──────────────────────────────────────────
async function countPhotoUsageThisMonth(supabase: ReturnType<typeof createClient>, orgId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('trade_ai_usage')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('feature', 'photo')
    .gte('created_at', monthStart.toISOString());

  return count ?? 0;
}

const AI_SYSTEM_PROMPT = `Eres TrabFlow AI, un sistema inteligente universal de presupuestos para profesionales, instaladores, técnicos y empresas de servicios.

Tu función es analizar imágenes y convertirlas automáticamente en presupuestos profesionales editables.

Funciona para CUALQUIER OFICIO: fontanería, electricidad, climatización, calefacción, albañilería, reformas, carpintería, cerrajería, ventanas, pintura, suelos, cocinas, baños, persianas, cubiertas, jardinería, piscinas, energía solar, telecomunicaciones, CCTV, automatización, mantenimiento industrial, limpieza, mudanzas, cristalería, pladur, escayola, impermeabilización, ascensores, talleres mecánicos, vehículos, electrodomésticos, informática y cualquier otro oficio técnico.

========================
PASO 1: IDENTIFICACIÓN PRECISA
========================

Antes de generar el presupuesto, identifica con MÁXIMA PRECISIÓN el elemento visible:
- ¿Qué tipo EXACTO de elemento es? (no confundas similares)
- ¿En qué estado se encuentra?
- ¿Cuántas unidades o qué dimensiones tiene?

DIFERENCIACIÓN CRÍTICA DE ELEMENTOS SIMILARES:

RADIADORES DE CALEFACCIÓN (agua caliente):
  - Radiador panel hierro/aluminio: cuerpo rectangular con secciones/aletas verticales, montado en pared horizontal, conectado a tubería inferior o lateral. Típicamente 6-14 secciones. El más habitual en viviendas.
  - Radiador toallero: forma de escalera con barras horizontales paralelas, se instala en baños, suele ser inox o cromado.
  - Fan-coil: caja rectangular con rejillas de ventilación, más voluminoso que un radiador de panel.
  - Convector eléctrico: similar a radiador pero con cable eléctrico, sin conexión de agua.

NO confundas un radiador de panel de hierro/aluminio con un toallero. Son completamente distintos.

ELEMENTOS ELÉCTRICOS:
  - Base enchufe: elemento empotrado en pared, con ranuras para clavija. No lo generes si no aparece claramente.
  - Cuadro eléctrico: caja con disyuntores/PIAs, normalmente en pasillo o entrada.
  - Interruptor: elemento plano en pared con tecla.

========================
REGLA DE IMÁGENES
========================

Al analizar la imagen, detecta:
- El oficio implicado
- El tipo exacto de trabajo necesario
- Averías o daños visibles
- Elementos a sustituir o reparar
- Complejidad de la instalación

NO describes lo que ves. GENERAS el presupuesto de lo que hay que hacer.

INCORRECTO: "Se ve una bañera", "Hay un cuadro eléctrico"
CORRECTO: "Retirada de bañera existente", "Revisión y sustitución de protecciones"

========================
DETECCIÓN DE SUSTITUCIÓN
========================

Si detectas elementos que requieren sustitución:
- crea partida de RETIRADA/DESMONTAJE
- añade gestión de residuos si aplica
- crea partida de instalación/suministro del nuevo elemento
- añade adaptaciones necesarias (tuberías, accesorios, etc.)

EJEMPLO — Sustitución de radiador panel hierro/aluminio:
1. Desmontaje: "Retirada de radiador existente, incluyendo vaciado parcial de circuito" (1 ud, Desmontaje)
2. Material: "Radiador de aluminio [X] secciones gama media (Roca, BaxiRoca o similar)" (1 ud, Material)
3. Material: "Kit de conexión radiador: llaves de corte, reducción y tapón" (1 ud, Material)
4. Material: "Purgador automático de radiador" (1 ud, Material)
5. Material: "Accesorios: tubo, codos, juntas y teflón" (1 kit, Material)
6. Mano de obra: "Instalación radiador nuevo: conexión a circuito, purgado y comprobación" (2 h, Mano de obra)
7. Gestión residuos: "Retirada y gestión de radiador antiguo" (1 ud, Gestión residuos)

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
Si ves UN radiador, genera presupuesto para UN radiador, no múltiples partidas de materiales repetidas.

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
  "scene_detectada": "Una frase sencilla describiendo lo que se ve: p.ej. 'Baño con bañera antigua, azulejos deteriorados y lavabo de época'",
  "acciones_sugeridas": [
    "Cambiar bañera por plato de ducha y mampara",
    "Reforma completa del baño: azulejos, suelo y sanitarios",
    "Sustitución de lavabo y grifería",
    "Impermeabilización de paredes"
  ],
  "acciones_oficio": [
    { "oficio": "Fontanería", "del_profesional": true },
    { "oficio": "Reformas", "del_profesional": false },
    { "oficio": "Fontanería", "del_profesional": true },
    { "oficio": "Albañilería", "del_profesional": false }
  ],
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

Reglas para scene_detectada y acciones_sugeridas:
- scene_detectada: descripción en lenguaje natural de lo que se ve en la imagen, sin tecnicismos. Máximo 2 frases.
- acciones_sugeridas: entre 4 y 6 acciones concretas. NO te limites a un solo oficio: recorre TODO lo visible en la foto
  (paredes, techo, suelo, sanitarios, grifería, cisterna, muebles, puertas, ventanas, luminarias, mecanismos, radiadores…)
  y ofrece trabajos de los distintos oficios que encajen. Ejemplos:
  * Techo o paredes visibles: pintura (pintar techo/paredes, alisar gotelé, tratar humedades o manchas)
  * Baño: fontanería (cambiar cisterna o mecanismo, sustituir inodoro o bidé, grifería, plato de ducha y mampara), alicatado, pintura
  * Cocina: pintura, cambio de encimera o frentes, fontanería del fregadero, iluminación
  * Elementos eléctricos: sustitución de luminarias o mecanismos, revisión de cuadro
  * Climatización/calefacción: revisión o sustitución de equipos y radiadores
- Si se indica el OFICIO DEL PROFESIONAL, las 2-3 primeras acciones deben ser de ese oficio (siempre que la foto lo permita);
  el resto, de otros oficios visibles.
- acciones_oficio: mismo orden y longitud que acciones_sugeridas. "oficio" = oficio al que pertenece cada acción.
  "del_profesional" = true si ese oficio está entre los OFICIOS DEL PROFESIONAL indicados (o si no se indicó ninguno).
- partidas: si se pide una acción concreta, SOLO las de esa acción (nada de otros oficios ni de otras acciones).
  Si no se pide ninguna, las de TODAS las acciones sugeridas, resumidas (máximo 3 partidas por acción y 18 en total).

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

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors(req) });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Sin autorización' }), {
      status: 401, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }
  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Anon key → modo demo (sin límites, sin tracking)
  const isAnonRequest = SUPABASE_ANON_KEY && token === SUPABASE_ANON_KEY;

  let orgId: string | null = null;
  let plan: 'basico' | 'profesional' | 'empresa' | 'empresa_plus' = 'basico';
  let oficio: string | null = null;

  if (!isAnonRequest) {
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    // ── Verificar límite de plan ─────────────────────────────────────────────
    ({ orgId, plan, oficio } = await resolveOrgAndPlan(supabase, user.id));
  }

  const limit = isAnonRequest ? Infinity : (PHOTO_LIMITS[plan] ?? 5);

  if (orgId && limit !== Infinity) {
    const used = await countPhotoUsageThisMonth(supabase, orgId);
    if (used >= limit) {
      return new Response(JSON.stringify({
        error: `Has alcanzado el límite de ${limit} escáneres de foto IA este mes en el plan Básico. Actualiza a Pro para escáneres ilimitados.`,
        limit_reached: true,
        plan,
        used,
        limit,
      }), { status: 403, headers: { ...cors(req), 'Content-Type': 'application/json' } });
    }
  }

  try {
    const body = await req.json() as { image_base64: string; mime_type?: string; accion?: string };
    const { image_base64, mime_type = 'image/jpeg' } = body;
    // Acción elegida por el profesional tras el primer análisis: regenerar partidas solo de ese trabajo
    const accion = typeof body.accion === 'string' ? body.accion.trim().slice(0, 200) : '';

    if (!image_base64) {
      return new Response(JSON.stringify({ error: 'Falta image_base64' }), {
        status: 400, headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    // ── Claude Sonnet Vision ─────────────────────────────────────────────────
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: AI_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mime_type, data: image_base64 },
            },
            {
              type: 'text',
              text: [
                oficio ? `OFICIO DEL PROFESIONAL: ${oficio.slice(0, 80)}.` : 'Oficio del profesional: no indicado.',
                accion
                  ? `El profesional quiere presupuestar exactamente este trabajo: «${accion}». Genera las partidas SOLO de ese trabajo (con desmontajes, materiales, mano de obra y residuos si aplican). Mantén scene_detectada y acciones_sugeridas.`
                  : 'Primero identifica con máxima precisión todo lo visible (no confundas elementos similares). Propón trabajos de los distintos oficios posibles y genera las partidas de todas las acciones sugeridas.',
              ].join('\n'),
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

    // ── Registrar uso en trade_ai_usage ──────────────────────────────────────
    // La regeneración por acción elegida no cuenta como un escaneo nuevo
    if (orgId && !accion) {
      await supabase.from('trade_ai_usage').insert({ org_id: orgId, feature: 'photo' });
    }

    return new Response(
      JSON.stringify({ quote }),
      { headers: { ...cors(req), 'Content-Type': 'application/json' } },
    );

  } catch (e: unknown) {
    const msg = (e as Error).message ?? 'Error desconocido';
    console.error('[trade-photo-scan]', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...cors(req), 'Content-Type': 'application/json' } },
    );
  }
});


