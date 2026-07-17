import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY      = Deno.env.get('OPENAI_API_KEY') ?? '';
const ANTHROPIC_API_KEY   = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const TRADE_TEST_KEY       = Deno.env.get('TRADE_TEST_KEY') ?? '';
const BRAVE_SEARCH_KEY     = Deno.env.get('BRAVE_SEARCH_API_KEY') ?? '';

const ALLOWED_ORIGINS = ['https://trabflow.com', 'https://www.trabflow.com', 'http://localhost:5173', 'http://localhost:4173'];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

// ── Límites por plan ──────────────────────────────────────────────────────────
const PLAN_LIMITS = {
  basico:       { quotes_month: 15 },
  profesional:  { quotes_month: Infinity },
  empresa:      { quotes_month: Infinity },
  empresa_plus: { quotes_month: Infinity },
};

// ── Resuelve org_id + plan del usuario autenticado ────────────────────────────
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

// ── Cuenta presupuestos creados este mes por la org ───────────────────────────
async function countQuotesThisMonth(supabase: ReturnType<typeof createClient>, orgId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('trade_quotes')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', monthStart.toISOString());

  return count ?? 0;
}

const AI_SYSTEM_PROMPT = `Eres TradeFlow AI. Tu misión es que el instalador SIEMPRE obtenga un presupuesto con partidas. NUNCA devuelves partidas: [].

TARIFAS MANO DE OBRA (€/h recomendado):
limpieza=20 | jardineria=25 | electricidad=50 | fontaneria=50 | climatizacion=60 | pintura=32 | albanileria=40 | carpinteria=45 | suelos_tarimas=32€/m² | pladur_escayola=35 | cerrajeria=60 | mecanica=55 | mecanica_especializada=65 | informatica=60 | instalador_cctv=50 | persianas=45 | energia_solar=65 | telecomunicaciones=50 | cristaleria=45 | multiservicio=38 | contra_incendios=55 | impermeabilizacion=45 | tejados_cubiertas=50 | fachadas=45 | mantenimiento_general=40 | reforma_integral=45

REGLA CRÍTICA — NUNCA VACÍO:
Si la descripción tiene contenido, SIEMPRE generas al menos 1 partida. Si no encuentras el trabajo en catálogo, CREAS partidas con origen: "sugerida_ia", precio_unitario: 0, requiere_revision: true. El instalador pone los precios. La IA estructura el trabajo.

LÍMITE DE PARTIDAS según complejidad — OBLIGATORIO:
• Trabajo simple (1 oficio, 1-2 acciones): máximo 6 partidas.
• Trabajo medio (1-2 oficios, 3-5 acciones): máximo 10 partidas.
• Reforma integral (3+ oficios simultáneos) — dos modos según alcance:
  CASO 1 — Reforma mediana (piso, local, oficina, garaje, baño completo, cocina completa):
    Genera máximo 12 partidas técnicas individuales: demolición, fontanería, electricidad,
    alicatado, pintura, carpintería, pladur, pavimentos, etc. NO uses capítulos.
    Las partidas deben ser específicas y técnicas para poder enlazar con el catálogo.
  CASO 2 — Gran obra (chalet completo, edificio entero, obra nueva, rehabilitación integral
    de edificio completo, ampliación estructural con nueva planta): usa CAPÍTULOS agrupados
    (máximo 4 partidas):
    Cap.1 – Demolición y obra civil → 1 partida con importe estimado
    Cap.2 – Instalaciones (electricidad, fontanería, clima) → 1 partida
    Cap.3 – Acabados (pintura, suelos, carpintería, pladur) → 1 partida
    Cap.4 – Otros (gestión residuos, permisos, etc.) → 1 partida si aplica
    Cada capítulo: requiere_revision: true, precio orientativo estimado. MÁXIMO 4 partidas.

PROCESO (en orden):
1. Extrae oficio, actuaciones y parámetros clave (unidades, litros, m², kW...).
2. Genera el plan de trabajo COMPLETO (todas las fases: desmontaje + suministro + instalación + pruebas si aplica).
3. Por cada parte del plan: si está en el catálogo proporcionado → usa esa partida. Si NO → crea partida con origen: "sugerida_ia".
4. AGRUPA: NUNCA una partida por unidad. Si son 3 splits → UNA partida "Instalación 3 unidades split" cantidad=3. Si son 10 enchufes → UNA partida cantidad=10.
5. MANO DE OBRA → UNA sola partida de tipo mano_de_obra por oficio, con la SUMA TOTAL de horas de ese oficio. Concepto: "Mano de obra [oficio]" (ej: "Mano de obra fontanería", "Mano de obra albañilería"). precio_unitario = tarifa de la tabla. NUNCA generes partidas de mano de obra separadas por tarea individual (no "Instalación grifería" + "Instalación mampara": consolídalas en "Mano de obra fontanería" con horas sumadas). Si hay varios oficios → una partida de mano de obra por cada oficio distinto. MATERIALES → precio_unitario=0, requiere_revision=true, origen="sugerida_ia".
6. Para SUSTITUCIÓN ("cambiar X por Y"): genera desmontaje + suministro(precio=0) + instalación. Agrupados.
7. Para REFORMA: múltiples oficios, cada uno con sus partidas agrupadas. LÍMITE: 12 partidas totales.
8. calculos.subtotal = suma de todos los totales. iva = subtotal×0.21. total = subtotal+iva.

EXPANSIÓN DE BÚSQUEDA (si el término exacto no está en catálogo):
Antes de crear partida sugerida, considera sinónimos técnicos del sector:
- "termo eléctrico" = "termoacumulador", "calentador eléctrico", "acumulador ACS"
- "red PEX" = "tubería multicapa", "fontanería multicapa", "distribución PEX"
- "split" = "unidad split", "equipo climatizador", "bomba calor inverter"
- "fontanería completa" = "reforma fontanería", "renovación instalación agua"
- "wallbox" = "punto de carga vehículo eléctrico", "cargador coche eléctrico"

OFICIOS VÁLIDOS — usa EXACTAMENTE estos identificadores en el campo "oficio":
fontaneria | electricidad | energia_solar | climatizacion | pintura | albanileria | carpinteria | cerrajeria | suelos_alicatados | suelos_tarimas | pladur_escayola | telecomunicaciones | informatica | instalador_cctv | mecanica | mecanica_especializada | jardineria | cristaleria | persianas | limpieza | contra_incendios | impermeabilizacion | tejados_cubiertas | fachadas | mantenimiento_general | reforma_integral | multiservicio | gestion_residuos | gestoria_tramites | cocina_amueblada

REGLAS DE OFICIO — prioridad estricta, SOBREESCRIBEN la intuición general:
• contra_incendios → SIEMPRE para: detectores humo/CO/gas, rociadores sprinklers, BIE (bocas incendio equipadas), extintores, central alarma incendios, puertas cortafuego RF, señalización evacuación, extractores humos industrial. AUNQUE el elemento sea eléctrico, de agua o metálico: si el SISTEMA es contraincendios → contra_incendios.
• impermeabilizacion → SIEMPRE para: humedades en sótano/fachada/cubierta/piscina, láminas EPDM/TPO/PVC, proyección poliurea, pintura impermeabilizante en terrazas y cubiertas, juntas de dilatación con función estanca, drenaje de humedad. AUNQUE la solución sea pintura o mortero impermeabilizante → impermeabilizacion (no pintura, no albanileria).
• tejados_cubiertas → SIEMPRE para: tejas (árabe, plana, pizarra, hormigón), cubiertas planas/inclinadas/transitables, canalones, cumbreras, limahoyas, remates zinc/aluminio, panel sándwich, cubierta vegetal, goteras en tejado, lucernarios y velux. AUNQUE implique impermeabilización de la cubierta o canalones → tejados_cubiertas (no impermeabilizacion, no fachadas, no albanileria).
• fachadas → para: revestimiento exterior de edificio, aislamiento SATE, mortero monocapa, zócalos exteriores, enfoscado de fachada, rehabilitación de envolvente. Distinto de albañilería interior.
• mantenimiento_general → para: trabajos de mantenimiento y reparaciones puntuales en comunidad/edificio/vivienda que combinan 2+ oficios distintos SIN reforma mayor (ej: "revisar grifo, cambiar bombilla y ajustar puerta"). Cuando el trabajo se puede describir como "mantenimiento general del edificio/vivienda".
• reforma_integral → SIEMPRE cuando el trabajo incluye ≥3 oficios de reforma simultáneos (albanileria + fontaneria + electricidad + acabados…). El PRIMER elemento en oficios_detectados DEBE ser "reforma_integral".
• suelos_alicatados → baldosas, porcelánico, gres, alicatado baño/cocina. suelos_tarimas → parquet, tarima flotante, laminado, vinílico.

GUÍA GENERAL:
- Ventanas/puertas/armarios → carpinteria (madera/PVC) o cerrajeria (metal/aluminio/acero)
- Redes informáticas, cableado estructurado, WiFi, fibra, domótica → telecomunicaciones
- Paneles solares fotovoltaicos, aerotermia → energia_solar | Climatización, splits → climatizacion
- CCTV, alarmas intrusión, control acceso → instalador_cctv | Vehículos → mecanica

FORMATO DE SALIDA: JSON válido, sin markdown, sin texto fuera del JSON.
{
  "resumen": { "texto_original": "", "tipo_presupuesto": "reforma|mantenimiento_recurrente|servicio", "requiere_revision_general": false, "alertas": [] },
  "oficios_detectados": [{ "oficio": "", "existe_en_catalogo": true, "nuevo_oficio": false, "tarifa_hora": { "min": 0, "recomendado": 0, "max": 0 }, "motivo": "" }],
  "partidas": [{ "concepto": "", "descripcion": "", "oficio": "", "tipo_partida": "mano_obra", "unidad": "hora", "cantidad": 0, "precio_unitario": 0, "total": 0, "precio_origen": "catalogo", "origen": "catalogo", "requiere_revision": false, "motivo_revision": "" }],
  "calculos": { "subtotal": 0, "iva_porcentaje": 21, "iva": 0, "total": 0 },
  "sugerencias_catalogo": [],
  "partidas_nuevas_detectadas": []
}
tipo_partida: "mano_obra"|"material"|"servicio" — unidad: "hora"|"unidad"|"m2"|"m3"|"ml"|"mes"|"jornada"
origen: "catalogo" (encontrado en Base Maestra/catálogo) | "sugerida_ia" (creada por IA, precio pendiente de revisión del instalador)`;

const EMPTY_QUOTE = {
  resumen: { texto_original: '', tipo_presupuesto: '', requiere_revision_general: true, alertas: ['No se pudo interpretar el dictado'] },
  oficios_detectados: [],
  partidas: [],
  calculos: { subtotal: 0, iva_porcentaje: 21, iva: 0, total: 0 },
  sugerencias_catalogo: [],
};

// ── Post-proceso determinista de oficio (zero tokens de prompt) ──────────────
// Corrige oficios inequívocos basándose en keywords del transcript.
// Se aplica DESPUÉS de Claude y ANTES del enriquecimiento de catálogo.
// No modifica el prompt — coste en tokens: 0.
const OFICIO_ALIAS: Record<string, string> = {
  instalador_cctv: 'telecomunicaciones',
};
const OFICIO_KEYWORD_RULES: [RegExp, string][] = [
  [/\bwallbox\b|punto\s+de\s+carga.*veh[íi]culo|cargador.*veh[íi]culo\s+el[eé]ctrico/i, 'electricidad'],
  [/\b(velux|lucernario|claraboya|tragaluz)\b/i,                                         'tejados_cubiertas'],
  [/\bcctv\b|videovigilancia|c[aá]maras?\s+de\s+seguridad/i,                            'telecomunicaciones'],
  [/\brj[\s-]?45\b|roseta\s+de\s+red|punto\s+de\s+red\s+rj/i,                         'telecomunicaciones'],
  [/\brf[-\s]?[369]0\b|\bei[-\s]?[36]0\b|puerta\s+cortafuego/i,                        'contra_incendios'],
];
function applyOficioRules(transcript: string, quote: Record<string, unknown>): void {
  const oficios = quote.oficios_detectados as Array<{ oficio: string }> | undefined;
  if (!oficios?.length) return;
  const alias = OFICIO_ALIAS[oficios[0].oficio];
  if (alias) { oficios[0].oficio = alias; return; }
  for (const [re, oficio] of OFICIO_KEYWORD_RULES) {
    if (re.test(transcript)) { oficios[0].oficio = oficio; return; }
  }
}

// ── Enriquece precios de partidas con tarifas del instalador ──────────────────
// Arquitectura: IA genera partidas (ya sabe lo que necesita un trabajo)
// Catálogo traduce partidas → artículos tarifables reales con precio del instalador
interface Partida {
  concepto?: string;
  descripcion?: string;
  tipo_partida?: string;
  origen?: string;
  requiere_revision?: boolean;
  precio_unitario?: number;
  cantidad?: number;
  total?: number;
  precio_origen?: string;
  catalog_codigo?: string;
  // Motor de Catálogos de Proveedores
  supplier_key?: string;
  supplier_name?: string;
  supplier_product_id?: string;
  supplier_ref?: string;
  supplier_margen_pct?: number;
  supplier_precio_coste?: number;
}

interface Calculos {
  subtotal: number;
  iva_porcentaje: number;
  iva: number;
  total: number;
}

async function enrichWithCatalogPrices(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  quote: Record<string, unknown>,
): Promise<void> {
  const partidas = quote.partidas as Partida[] | undefined;
  if (!partidas || partidas.length === 0) return;

  // Cargar tarifas del instalador (primero) y catálogo global (fallback)
  const [{ data: tarifas }, { data: globalItems }] = await Promise.all([
    supabase
      .from('trade_tarifas')
      .select('descripcion, precio_base, unidad, codigo')
      .eq('org_id', orgId)
      .eq('activo', true),
    supabase
      .from('trade_global_catalog')
      .select('descripcion, precio_referencia, unidad, codigo, oficio')
      .eq('activo', true)
      .gt('precio_referencia', 0),  // solo items con precio de referencia real
  ]);

  const allItems = [
    ...(tarifas ?? []).map((t: Record<string, unknown>) => ({ ...t, precio: t.precio_base, fuente: 'tarifa_instalador' })),
    ...(globalItems ?? []).map((g: Record<string, unknown>) => ({ ...g, precio: g.precio_referencia, fuente: 'catalogo_global' })),
  ] as Array<{ descripcion: string; precio: number; unidad: string; codigo: string; fuente: string }>;

  if (allItems.length === 0) return;

  let recalculated = false;

  for (const partida of partidas) {
    // Solo enriquecer partidas que ya tienen precio estimado (mano_obra o servicios con precio)
    // No tocar partidas de materiales marcadas requiere_revision (precio=0 pendiente)
    if (partida.requiere_revision && (partida.precio_unitario ?? 0) === 0) continue;

    const concepto = (partida.concepto ?? '').toLowerCase();
    // Extraer palabras clave de más de 4 letras del concepto
    const keywords = concepto
      .split(/[\s,+()\/\-]+/)
      .filter((w: string) => w.length > 4);

    if (keywords.length === 0) continue;

    // Buscar mejor coincidencia: tarifa instalador primero, luego catálogo global
    const instaladorMatch = (tarifas ?? []).find((t: Record<string, unknown>) => {
      const desc = String(t.descripcion ?? '').toLowerCase();
      return keywords.some((kw: string) => desc.includes(kw));
    });

    const globalMatch = !instaladorMatch
      ? (globalItems ?? []).find((g: Record<string, unknown>) => {
          const desc = String(g.descripcion ?? '').toLowerCase();
          return keywords.some((kw: string) => desc.includes(kw));
        })
      : null;

    const match = instaladorMatch
      ? { descripcion: instaladorMatch.descripcion, precio: Number(instaladorMatch.precio_base), codigo: String(instaladorMatch.codigo), fuente: 'tarifa_instalador' }
      : globalMatch
      ? { descripcion: globalMatch.descripcion, precio: Number(globalMatch.precio_referencia), codigo: String(globalMatch.codigo), fuente: 'catalogo_global' }
      : null;

    if (match && match.precio > 0) {
      partida.precio_unitario = match.precio;
      partida.total = (partida.cantidad ?? 1) * match.precio;
      partida.precio_origen = match.fuente;
      partida.catalog_codigo = match.codigo;
      recalculated = true;
    } else if (partida.origen === 'catalogo' && (partida.precio_unitario ?? 0) <= 0) {
      // v58b: partida marcada como catálogo por la IA sin precio válido → reclasificar
      partida.origen = 'sugerida_ia';
      partida.requiere_revision = true;
    }
  }

  // Recalcular totales si alguna partida fue enriquecida
  if (recalculated) {
    const subtotal = partidas.reduce((s: number, p: Partida) => s + (p.total ?? 0), 0);
    const calculos = quote.calculos as Calculos | undefined;
    if (calculos) {
      calculos.subtotal = Math.round(subtotal * 100) / 100;
      calculos.iva = Math.round(subtotal * 0.21 * 100) / 100;
      calculos.total = Math.round(subtotal * 1.21 * 100) / 100;
    }
  }
}

// ── Motor de Catálogos de Proveedores ─────────────────────────────────────
// Solo actúa sobre materiales con requiere_revision=true y precio=0
// Busca en trade_supplier_products via RPC search_supplier_products
async function enrichWithSupplierProducts(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  quote: Record<string, unknown>,
): Promise<void> {
  const partidas = quote.partidas as Partida[] | undefined;
  if (!partidas || partidas.length === 0) return;

  const materialesPendientes = partidas.filter(
    p => p.tipo_partida === 'material' && p.requiere_revision === true && (p.precio_unitario ?? 0) === 0,
  );
  if (materialesPendientes.length === 0) return;

  let recalculated = false;

  for (const partida of materialesPendientes) {
    const texto = [partida.concepto, partida.descripcion].filter(Boolean).join(' ');
    if (!texto) continue;

    const { data, error } = await supabase.rpc('search_supplier_products', {
      material_text: texto,
      p_org_id: orgId,
      limit_per_catalog: 3,
    });

    if (error || !data || (data as unknown[]).length === 0) continue;

    // Mejor resultado: mayor score, primera posición
    const best = (data as Array<{
      catalog_key: string; supplier_name: string; product_id: string;
      ref_proveedor: string; descripcion: string; precio_coste: number;
      margen_pct: number; precio_venta: number; unidad: string; score: number;
    }>)[0];

    if (!best || best.precio_venta <= 0) continue;

    partida.precio_unitario = best.precio_venta;
    partida.supplier_precio_coste = best.precio_coste;
    partida.supplier_margen_pct = best.margen_pct;
    partida.total = (partida.cantidad ?? 1) * best.precio_venta;
    partida.precio_origen = `catalogo_proveedor_${best.catalog_key}`;
    partida.requiere_revision = false;
    partida.supplier_key = best.catalog_key;
    partida.supplier_name = best.supplier_name;
    partida.supplier_product_id = best.product_id;
    partida.supplier_ref = best.ref_proveedor;
    recalculated = true;
  }

  if (recalculated) {
    const subtotal = partidas.reduce((s: number, p: Partida) => s + (p.total ?? 0), 0);
    const calculos = quote.calculos as Calculos | undefined;
    if (calculos) {
      calculos.subtotal = Math.round(subtotal * 100) / 100;
      calculos.iva = Math.round(subtotal * 0.21 * 100) / 100;
      calculos.total = Math.round(subtotal * 1.21 * 100) / 100;
    }
  }
}

// ── Búsqueda web de precios cuando la Base Maestra no tiene matches ───────────
// Usa Brave Search API. Si no hay clave devuelve '' (degradación elegante).
async function searchWebForWork(transcript: string): Promise<string> {
  if (!BRAVE_SEARCH_KEY) return '';
  try {
    // Extraer keywords significativas del transcript (4+ letras, max 8)
    const keywords = transcript
      .toLowerCase()
      .split(/[\s,;.]+/)
      .filter(w => w.length >= 4)
      .slice(0, 6)
      .join(' ');
    const query = `precio coste presupuesto ${keywords} instalador España`;

    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=4&country=es&search_lang=es`,
      {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': BRAVE_SEARCH_KEY,
        },
      },
    );
    if (!res.ok) {
      console.warn('[web] Brave search error', res.status);
      return '';
    }
    const data = await res.json() as {
      web?: { results?: Array<{ title: string; description: string; url: string }> };
    };
    const results = (data.web?.results ?? []).slice(0, 3);
    if (results.length === 0) return '';

    let ctx = '\n\nREFERENCIA WEB (precios de mercado España — contexto adicional, no es normativa):\n';
    for (const r of results) {
      const snippet = r.description?.slice(0, 180).trim() ?? '';
      if (snippet) ctx += `- ${r.title}: ${snippet}\n`;
    }
    ctx += '\nUsa esta referencia solo como orientación de precio. Marca requiere_revision=true en todos los materiales.';
    return ctx;
  } catch (err) {
    console.warn('[web] searchWebForWork failed:', err);
    return '';
  }
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors(req) });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return new Response(JSON.stringify({ error: 'Sin autorización' }), { status: 401, headers: { ...cors(req), 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Anon key, service role key, o test key → modo sin tracking (demo / CI test runner)
  const isAnonRequest = (SUPABASE_ANON_KEY && token === SUPABASE_ANON_KEY) ||
                        (SUPABASE_SERVICE_KEY && token === SUPABASE_SERVICE_KEY) ||
                        (TRADE_TEST_KEY && token === TRADE_TEST_KEY);

  let userId: string | null = null;
  if (!isAnonRequest) {
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...cors(req), 'Content-Type': 'application/json' } });
    }
    userId = user.id;
  }

  // ── Verificar límite de plan (solo usuarios autenticados) ─────────────────
  let orgId: string | null = null;
  let plan: 'basico' | 'profesional' | 'empresa' | 'empresa_plus' = 'basico';
  let limit = PLAN_LIMITS.basico.quotes_month;

  if (userId) {
    ({ orgId, plan } = await resolveOrgAndPlan(supabase, userId));
    limit = PLAN_LIMITS[plan]?.quotes_month ?? 15;
  }

  if (orgId && limit !== Infinity) {
    const used = await countQuotesThisMonth(supabase, orgId);
    if (used >= limit) {
      return new Response(JSON.stringify({
        error: `Has alcanzado el límite de ${limit} presupuestos este mes en el plan Básico. Actualiza a Pro para presupuestos ilimitados.`,
        limit_reached: true,
        plan,
        used,
        limit,
      }), { status: 403, headers: { ...cors(req), 'Content-Type': 'application/json' } });
    }
  }

  try {
    // ── Demo/anon mode: accept JSON with text field directly ─────────────────
    let transcript = '';
    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const body = await req.json() as { text?: string };
      transcript = body.text?.trim() ?? '';
      if (!transcript) {
        return new Response(JSON.stringify({ error: 'El campo "text" está vacío' }), {
          status: 400, headers: { ...cors(req), 'Content-Type': 'application/json' },
        });
      }
    } else {
      // ── Recibir audio ──────────────────────────────────────────────────────
      const formData = await req.formData();
      const audioFile = formData.get('audio') as File | null;
      if (!audioFile) {
        return new Response(JSON.stringify({ error: 'Falta el campo "audio" en el formulario' }), {
          status: 400, headers: { ...cors(req), 'Content-Type': 'application/json' },
        });
      }

      if (audioFile.size < 100) {
        return new Response(JSON.stringify({ error: 'Audio demasiado corto — habla un poco más tiempo' }), {
          status: 422, headers: { ...cors(req), 'Content-Type': 'application/json' },
        });
      }

      // ── Transcripción (OpenAI Whisper) ─────────────────────────────────────
      const originalName = audioFile.name || 'audio.webm';
      const whisperForm = new FormData();
      whisperForm.append('file', audioFile, originalName);
      whisperForm.append('model', 'gpt-4o-mini-transcribe');
      whisperForm.append('language', 'es');
      whisperForm.append('prompt', 'Transcripción de un profesional describiendo trabajos técnicos, instalaciones, reparaciones o reformas. Español de España.');

      const transcribeRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: whisperForm,
      });

      if (!transcribeRes.ok) {
        const err = await transcribeRes.text();
        throw new Error(`OpenAI STT error ${transcribeRes.status}: ${err}`);
      }

      const { text: sttText } = await transcribeRes.json() as { text: string };
      transcript = sttText ?? '';
      console.log(`[stt][${requestId}] transcript(${transcript.length}): "${transcript.slice(0, 100)}"`);
      const meaningfulText = transcript.replace(/[\s.,!?¿¡\-–…"'()]+/g, '').trim();
      if (!meaningfulText || meaningfulText.length < 3) {
        return new Response(JSON.stringify({ error: 'No se detectó voz con claridad — acércate al micrófono e inténtalo de nuevo' }), {
          status: 422, headers: { ...cors(req), 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Detectar solicitud de contrato de mantenimiento sin plan empresa+ ────
    const maintenanceKeywords = /contrato.{0,15}mantenimiento|mantenimiento.{0,15}contrato|contrato.{0,15}recurrente|contrato.{0,15}mensual/i;
    if (maintenanceKeywords.test(transcript) && plan !== 'empresa_plus') {
      return new Response(JSON.stringify({
        error: 'Tu plan actual no permite generar contratos de mantenimiento. Actualiza al Plan Empresa+ para acceder a este módulo.',
        plan_restriction: true,
        required_plan: 'empresa_plus',
        plan,
      }), { status: 403, headers: { ...cors(req), 'Content-Type': 'application/json' } });
    }

    // ── Base Maestra IA: buscar actuaciones relevantes ────────────────────────
    // search_actuaciones_scored puntúa por coincidencia de palabras + usage_count
    interface ActuacionScored {
      actuacion_id: string;
      oficio: string;
      partidas_obligatorias: string[];
      partidas_auxiliares: string[];
      reglas_calculo: string;
      unidad: string;
      observaciones: string;
      precio_min: number | null;
      precio_max: number | null;
      score: number;
    }
    let kbActuaciones: ActuacionScored[] = [];
    let kbScore = 0;

    try {
      const { data: kbRows } = await supabase.rpc('search_actuaciones_scored', {
        p_transcript: transcript,
        p_limit: 5,
      });
      kbActuaciones = (kbRows ?? []) as ActuacionScored[];
      if (kbActuaciones.length > 0) {
        kbScore = kbActuaciones.reduce((s, a) => s + Number(a.score), 0) / kbActuaciones.length;
      }
    } catch (kbErr) {
      console.warn('[kb] search_actuaciones_scored error:', kbErr);
    }

    // ── Construir contexto KB para inyectar en el prompt ──────────────────────
    let kbContext = '';
    if (kbActuaciones.length > 0) {
      kbContext = '\n\nBASE MAESTRA (actuaciones validadas — referencia prioritaria para partidas y precios):\n';
      for (const a of kbActuaciones) {
        kbContext += `\n[${a.actuacion_id}] oficio=${a.oficio} unidad=${a.unidad}`;
        if (a.precio_min != null && a.precio_max != null) {
          kbContext += ` precio=${a.precio_min}-${a.precio_max}€/${a.unidad.split(',')[0].trim()}`;
        }
        kbContext += '\n';
        kbContext += `  partidas_obligatorias: ${a.partidas_obligatorias.join(', ')}\n`;
        if (a.partidas_auxiliares.length > 0) {
          kbContext += `  partidas_auxiliares: ${a.partidas_auxiliares.join(', ')}\n`;
        }
        if (a.reglas_calculo && a.reglas_calculo !== 'aprendido_automaticamente') {
          kbContext += `  reglas: ${a.reglas_calculo}\n`;
        }
      }
      kbContext += '\nIncorpora las partidas_obligatorias. Usa los rangos de precio como referencia para precio_unitario de mano de obra cuando no hay tarifa en catálogo.';
    }

    // ── Web search: fallback cuando la Base Maestra no tiene matches ──────────
    let webContext = '';
    let webSearchUsed = false;
    if (kbActuaciones.length === 0) {
      webContext = await searchWebForWork(transcript);
      webSearchUsed = webContext.length > 0;
    }

    // ── Generar presupuesto con IA ───────────────────────────────────────────
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8192,
        temperature: 0,
        system: AI_SYSTEM_PROMPT + kbContext + webContext,
        messages: [{ role: 'user', content: `El profesional dice: "${transcript}"` }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error(`Claude error ${claudeRes.status}: ${err.slice(0, 200)}`);
    }

    const claudeData = await claudeRes.json() as {
      content: Array<{ type: string; text?: string }>;
      stop_reason?: string;
      usage?: { input_tokens: number; output_tokens: number };
    };
    const allText = claudeData.content.filter(b => b.type === 'text').map(b => b.text ?? '').join('');

    // Diagnóstico: siempre logear stop_reason y tokens para detectar truncado
    console.log(`[claude] stop_reason=${claudeData.stop_reason} in=${claudeData.usage?.input_tokens} out=${claudeData.usage?.output_tokens} len=${allText.length}`);
    if (claudeData.stop_reason === 'max_tokens') {
      console.error('[claude] TRUNCADO — JSON incompleto. Últimos 200 chars:', allText.slice(-200));
    }

    // Extractor balanceado: busca el primer objeto JSON completo, ignorando texto pre/post
    function extractFirstJSON(text: string): string | null {
      let depth = 0;
      let start = -1;
      let inString = false;
      let escape = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') {
          if (start === -1) start = i;
          depth++;
        } else if (ch === '}') {
          depth--;
          if (depth === 0 && start !== -1) return text.substring(start, i + 1);
        }
      }
      return null;
    }

    let quote: Record<string, unknown>;
    try {
      // Strip markdown code fences first, then extract balanced JSON
      const cleaned = allText.replace(/```json?\s*/gi, '').replace(/```/g, '');
      const jsonStr = extractFirstJSON(cleaned);
      if (!jsonStr) throw new Error('No JSON object found in response');
      quote = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('[claude] JSON parse failed:', String(parseErr).slice(0, 100));
      console.error('[claude] allText (first 600):', allText.slice(0, 600));
      console.error('[claude] allText (last 200):', allText.slice(-200));
      quote = { ...EMPTY_QUOTE };
    }

    applyOficioRules(transcript, quote);

    // v58b: reclasificar partidas 'catalogo' con precio ≤ 0 antes del enriquecimiento
    // Aplica a TODOS los requests (incluyendo benchmarks con orgId=null)
    if (Array.isArray(quote.partidas)) {
      for (const p of (quote.partidas as Partida[])) {
        if (p.origen === 'catalogo' && (p.precio_unitario ?? 0) <= 0) {
          p.origen = 'sugerida_ia';
          p.requiere_revision = true;
        }
      }
    }

    // ── Enriquecer precios con catálogo del instalador ────────────────────────
    // INTENCIÓN (IA) → PARTIDAS (IA genera) → ARTÍCULOS (catálogo precio) → PRESUPUESTO
    if (orgId && quote.partidas) {
      await enrichWithCatalogPrices(supabase, orgId, quote);
      // Motor de Catálogos: materiales que quedaron sin precio → buscar en proveedores
      await enrichWithSupplierProducts(supabase, orgId, quote);
    }

    // ── Registrar uso ─────────────────────────────────────────────────────────
    if (orgId) {
      supabase.from('trade_ai_usage').insert({
        org_id: orgId,
        feature: 'voice',
        metadata: {
          model: 'haiku',
          kb_actuaciones: kbActuaciones.length,
          kb_score: kbScore,
          web_search_used: webSearchUsed,
          catalog_enriched: true,
          partidas_count: ((quote as Record<string, unknown[]>).partidas ?? []).length,
        },
      }).then(() => {/* fire-and-forget */});
    }

    // El frontend guarda trade_ai_feedback al confirmar el presupuesto (con final_partidas reales)
    return new Response(
      JSON.stringify({
        transcript,
        quote,
        actuacion_ids_matched: kbActuaciones.map(a => a.actuacion_id),
        kb_score: kbScore,
        web_search_used: webSearchUsed,
        _meta: {
          prompt_version: 'v58b',
          stop_reason: claudeData.stop_reason ?? 'end_turn',
          tokens_in:  claudeData.usage?.input_tokens  ?? 0,
          tokens_out: claudeData.usage?.output_tokens ?? 0,
        },
      }),
      { headers: { ...cors(req), 'Content-Type': 'application/json' } },
    );

  } catch (e: unknown) {
    const msg = (e as Error).message ?? 'Error desconocido';
    console.error('[trade-voice-to-quote]', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...cors(req), 'Content-Type': 'application/json' } },
    );
  }
});


