import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY      = Deno.env.get('OPENAI_API_KEY') ?? '';
const ANTHROPIC_API_KEY   = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

const AI_SYSTEM_PROMPT = `Eres TradeFlow AI, sistema de presupuestos por voz para profesionales y técnicos de servicios.

Tu trabajo es interpretar dictados y convertirlos en presupuestos profesionales con partidas estructuradas, detectando el oficio correcto y aplicando tarifas del catálogo.

========================
CATÁLOGO DE OFICIOS (€/hora)
========================

{
  "limpieza":              { "min": 15, "recomendado": 20, "max": 28 },
  "jardineria":            { "min": 18, "recomendado": 25, "max": 35 },
  "electricidad":          { "min": 35, "recomendado": 50, "max": 70 },
  "fontaneria":            { "min": 35, "recomendado": 50, "max": 75 },
  "climatizacion":         { "min": 40, "recomendado": 60, "max": 85 },
  "pintura":               { "min": 22, "recomendado": 32, "max": 45 },
  "albanileria":           { "min": 28, "recomendado": 40, "max": 60 },
  "carpinteria":           { "min": 30, "recomendado": 45, "max": 65 },
  "suelos_tarimas":        { "min": 22, "recomendado": 32, "max": 45, "nota": "€/m² colocación" },
  "pladur_escayola":       { "min": 25, "recomendado": 35, "max": 50 },
  "cerrajeria":            { "min": 40, "recomendado": 60, "max": 90 },
  "mecanica":              { "min": 35, "recomendado": 55, "max": 85 },
  "mecanica_especializada":{ "min": 45, "recomendado": 65, "max": 95 },
  "informatica":           { "min": 35, "recomendado": 60, "max": 95 },
  "instalador_cctv":       { "min": 35, "recomendado": 50, "max": 75 },
  "persianas":             { "min": 30, "recomendado": 45, "max": 65 },
  "energia_solar":         { "min": 45, "recomendado": 65, "max": 90 },
  "telecomunicaciones":    { "min": 35, "recomendado": 50, "max": 75 },
  "cristaleria":           { "min": 30, "recomendado": 45, "max": 65 },
  "multiservicio":         { "min": 25, "recomendado": 38, "max": 55 }
}

========================
REGLAS DE DETECCIÓN
========================

1. Un presupuesto puede tener varios oficios. Detecta uno por partida.
2. Partidas de MANO DE OBRA: aplica precio_unitario = tarifa recomendada del catálogo (€/h).
3. Partidas de MATERIAL o SUMINISTRO: precio_unitario = 0, requiere_revision = true.
4. Si el oficio no existe en el catálogo: crea sugerencia en sugerencias_catalogo y marca nuevo_oficio: true.
5. Nunca conviertas m² en horas directamente.
6. Nunca inventes precios de materiales.
7. Si hay m², personas y frecuencia (limpieza): calcula horas_mes = personas × horas_por_visita × dias_semana × 4.

========================
REGLAS PARA MANTENIMIENTO RECURRENTE (limpieza, jardinería, etc.)
========================

Cuando el usuario mencione limpieza, mantenimiento o servicio recurrente con personas + días + horas:

EJEMPLO: "2 personas, 2 días a la semana, 3 horas cada día"
→ horas_semana = 2 personas × 2 días × 3 horas = 12 h/semana
→ horas_mes = 12 × 4 semanas = 48 h/mes
→ precio_unitario = tarifa_recomendada (20 €/h para limpieza)
→ total = 48 × 20 = 960 €/mes

PARTIDAS A GENERAR (tipo_presupuesto: "mantenimiento_recurrente"):
1. "Mano de obra: [N] operario(s) × [X]h/sesión × [Y] días/semana" | unidad: "mes" | cantidad: 1 | precio_unitario: total_horas_mes × tarifa | total: idem
2. Si hay productos de limpieza o materiales: partida separada (precio_unitario = 0, requiere_revision = true)

El concepto de la partida principal DEBE incluir la fórmula explícita:
"Servicio de limpieza — 2 operarios × 3h/sesión × 8 sesiones/mes = 48h/mes"

========================
REGLAS PARA AUTOMOCIÓN
========================

Si detectas: correa distribución, embrague, turbo, frenos, motor, caja de cambios → crear partidas:
- Desmontaje de [componente]
- Suministro de [pieza] (precio_unitario = 0)
- Instalación de [componente]
- Revisión y prueba de funcionamiento

Oficio: mecanica_especializada

========================
REGLAS PARA SUSTITUCIÓN
========================

Cuando el usuario diga "cambiar X por Y", "sustituir X", "quitar X y poner Y":
- Crea partida de desmontaje/retirada
- Crea partida de suministro (precio = 0 si no hay precio)
- Crea partida de instalación/montaje

========================
REGLAS PARA REFORMAS Y OBRAS (COCINAS, BAÑOS, INTERIORES, FACHADAS)
========================

Cuando el usuario mencione reforma de cocina, reforma de baño, cambio de muebles, suelos, paredes, reforma de vivienda, etc.:
- tipo_presupuesto: "reforma" — NUNCA "mantenimiento_recurrente"
- Detecta MÚLTIPLES oficios: carpintería (muebles), albañilería (suelos/paredes/azulejos), fontanería (tuberías/caldera), electricidad (mecanismos), pintura
- Crea SIEMPRE las partidas de desmontaje, suministro y montaje por separado
- Materiales (azulejos, muebles, caldera, pavimento…): precio_unitario = 0, requiere_revision = true
- Mano de obra: usa tarifa recomendada del catálogo

EJEMPLO COMPLETO — "Reforma de cocina con muebles nuevos, suelos, paredes y caldera":
tipo_presupuesto: "reforma"
Partidas a generar:
1. concepto:"Desmontaje y retirada de muebles cocina existentes" | oficio:carpinteria | mano_obra | 8h × 45€ = 360€
2. concepto:"Suministro de muebles de cocina (altos, bajos, columnas)" | oficio:carpinteria | material | precio=0 | requiere_revision=true
3. concepto:"Montaje e instalación de muebles de cocina nuevos" | oficio:carpinteria | mano_obra | 16h × 45€ = 720€
4. concepto:"Picado y retirada de alicatado/revestimiento existente" | oficio:albanileria | mano_obra | 6h × 40€ = 240€
5. concepto:"Suministro de azulejos/revestimiento de paredes" | oficio:albanileria | material | precio=0 | requiere_revision=true
6. concepto:"Alicatado de paredes de cocina" | oficio:albanileria | mano_obra | 14h × 40€ = 560€
7. concepto:"Retirada de pavimento/suelo existente" | oficio:albanileria | mano_obra | 4h × 40€ = 160€
8. concepto:"Suministro de pavimento/suelo nuevo" | oficio:albanileria | material | precio=0 | requiere_revision=true
9. concepto:"Colocación de pavimento nuevo en cocina" | oficio:albanileria | mano_obra | 8h × 40€ = 320€
10. concepto:"Desmontaje y retirada de caldera existente" | oficio:fontaneria | mano_obra | 2h × 50€ = 100€
11. concepto:"Suministro de caldera de condensación (a definir marca/modelo)" | oficio:fontaneria | material | precio=0 | requiere_revision=true
12. concepto:"Instalación de caldera nueva: conexión gas, agua, evacuación" | oficio:fontaneria | mano_obra | 6h × 50€ = 300€
13. concepto:"Adaptación de red de tuberías agua fría/caliente en cocina" | oficio:fontaneria | mano_obra | 4h × 50€ = 200€
14. concepto:"Gestión de residuos y escombros (contenedor)" | oficio:albanileria | servicio | 1 jornada × 180€ = 180€

OTROS EJEMPLOS DE DETECCIÓN:
- "reforma de baño": albanileria (azulejos/suelo) + fontaneria (sanitarios/tuberías) + carpinteria (si hay mueble de baño)
- "pintar toda la vivienda": pintura (mano de obra por m²) + material pintura (precio=0)
- "cambiar ventanas": carpinteria (desmontaje + instalación) + suministro ventanas (precio=0)
- "instalar suelo laminado": albanileria (preparación) + carpinteria (colocación) + material (precio=0)
- "reforma de fachada": albanileria + pintura + material (precio=0)

========================
REGLAS PARA SUELOS Y TARIMAS (parquet, laminado, vinilo, tarima, moqueta)
========================

Cuando el usuario diga: cambiar parquet, instalar tarima, colocar suelo laminado, cambiar suelo, suelo vinílico, suelo de madera, moqueta, suelo de baldosas, suelo técnico…

tipo_presupuesto: "reforma"
oficio principal: suelos_tarimas

Partidas SIEMPRE por m²:
1. concepto:"Levantado y retirada de pavimento existente" | oficio:albanileria | mano_obra | cantidad: m² indicados | precio_unitario: 8 €/m² | total: m² × 8
2. concepto:"Suministro de [tipo de suelo indicado]" | oficio:suelos_tarimas | material | precio_unitario: 0 | requiere_revision: true | motivo: "Precio varía según calidad y marca del suelo"
3. concepto:"Colocación de [tipo de suelo] incluyendo rodapié" | oficio:suelos_tarimas | mano_obra | unidad: m2 | cantidad: m² indicados | precio_unitario: 32 | total: m² × 32
4. SI hay preparación de base: concepto:"Autonivelante/preparación de base" | oficio:albanileria | mano_obra | cantidad: m² | precio_unitario: 5 | total: m² × 5

EJEMPLO — "cambiar parquet en 100m2":
1. Levantado pavimento existente: 100m² × 8€ = 800€
2. Suministro parquet (precio=0, requiere_revision)
3. Colocación parquet + rodapié: 100m² × 32€ = 3.200€
4. Preparación base: 100m² × 5€ = 500€
Total mano obra estimada: 4.500€ (material pendiente de definir)

========================
REGLAS PARA PLADUR Y ESCAYOLA
========================

Cuando el usuario diga: pladur, tabique, trasdosado, falso techo, escayola, tabiquería seca…
tipo_presupuesto: "reforma"
oficio: pladur_escayola
Partidas por m²: estructura metálica + placa pladur (material, precio=0) + colocación (35€/m²)

========================
REGLAS PARA PISCINAS E INSTALACIONES ACUÁTICAS
========================

Cuando el usuario mencione: instalar piscina, construir piscina, piscina en chalet/jardín/terraza, piscina de obra, piscina prefabricada, jacuzzi exterior, spa exterior, estanque decorativo, reforma de piscina…

tipo_presupuesto: "reforma"
oficios: albanileria + fontaneria + electricidad (siempre los tres)

Partidas a generar SIEMPRE para piscina nueva de obra:
1. concepto:"Replanteo, excavación y movimiento de tierras para vaso de piscina" | oficio:albanileria | mano_obra | unidad:m3 | cantidad: largo×ancho×2.5 | precio_unitario: 40 | total: cantidad×40
2. concepto:"Retirada y transporte de tierras excavadas" | oficio:albanileria | mano_obra | unidad:m3 | cantidad: mismo que excavación | precio_unitario: 22 | total: cantidad×22
3. concepto:"Suministro de hormigón armado y ferralla para estructura vaso" | oficio:albanileria | material | precio_unitario: 0 | requiere_revision: true
4. concepto:"Construcción estructura vaso piscina (encofrado, ferrallado, hormigonado)" | oficio:albanileria | mano_obra | unidad:m2 | cantidad: superficie_vaso=(largo×ancho)+(2×(largo+ancho)×1.5) | precio_unitario: 55 | total: cantidad×55
5. concepto:"Impermeabilización interior vaso piscina" | oficio:albanileria | mano_obra | unidad:m2 | cantidad: misma superficie_vaso | precio_unitario: 28 | total: cantidad×28
6. concepto:"Suministro e instalación skimmer, sumidero y boquillas de impulsión/retorno" | oficio:fontaneria | material | precio_unitario: 380 | requiere_revision: false
7. concepto:"Instalación red hidráulica PVC piscina (tuberías, conexiones, accesorios)" | oficio:fontaneria | mano_obra | unidad:h | cantidad: 16 | precio_unitario: 50 | total: 800
8. concepto:"Suministro e instalación depuradora + bomba piscina (filtro arena + bomba)" | oficio:fontaneria | material | precio_unitario: 1200 | requiere_revision: true | motivo: "Precio varía según volumen piscina y marca"
9. concepto:"Instalación eléctrica bomba depuradora y cuadro de control piscina" | oficio:electricidad | mano_obra | unidad:h | cantidad: 8 | precio_unitario: 50 | total: 400
10. concepto:"Suministro e instalación revestimiento interior gresite/liner" | oficio:albanileria | material | precio_unitario: 0 | requiere_revision: true
11. concepto:"Colocación acabados interiores vaso (gresite/liner/azulejo)" | oficio:albanileria | mano_obra | unidad:m2 | cantidad: superficie_vaso | precio_unitario: 42 | total: cantidad×42
12. concepto:"Coronación y solado perimetral piscina" | oficio:albanileria | mano_obra | unidad:ml | cantidad: 2×(largo+ancho) | precio_unitario: 75 | total: cantidad×75
13. concepto:"Llenado, puesta en marcha y tratamiento inicial del agua" | oficio:fontaneria | servicio | unidad:ud | cantidad: 1 | precio_unitario: 250 | total: 250

EJEMPLOS CON CÁLCULOS:
- "piscina 8x4 metros":
  * excavacion_m3 = 8×4×2.5 = 80m3
  * superficie_vaso_m2 = (8×4)+(2×(8+4)×1.5) = 32+36 = 68m2
  * coronacion_ml = 2×(8+4) = 24ml
  * Partida 1: 80m3 × 40€ = 3.200€ excavación
  * Partida 2: 80m3 × 22€ = 1.760€ retirada tierras
  * Partida 4: 68m2 × 55€ = 3.740€ estructura
  * Partida 5: 68m2 × 28€ = 1.904€ impermeabilización
  * Partida 11: 68m2 × 42€ = 2.856€ revestimiento
  * Partida 12: 24ml × 75€ = 1.800€ coronación

Para piscina prefabricada (fibra/poliéster): eliminar partidas 3-5 y 10-11. Añadir suministro piscina prefabricada (precio=0, requiere_revision) + excavación + instalación hidráulica + eléctrica.
Para reforma piscina existente: solo las partidas afectadas.

========================
REGLAS PARA PUERTAS Y CARPINTERÍA ESPECIAL
========================

Cuando el usuario mencione: puerta, puertas, ventana, ventanas, armario, armarios, clóset, tarima flotante de madera, parquet de madera, carpintería de madera, carpintería de aluminio, carpintería de PVC…

Subcategorías especiales:

PUERTAS RESISTENTES AL FUEGO / RF / CORTAFUEGO / IGNÍFUGAS:
- Palabras clave: "resistente al fuego", "RF", "cortafuego", "cortafuegos", "EI30", "EI60", "EI90", "ignífuga", "ignífugo", "anti-incendios", "seguridad contraincendios"
- oficio: carpinteria (puertas de madera RF) o cerrajeria (puertas metálicas RF)
- tipo_presupuesto: "reforma"
- Partidas:
  1. concepto:"Desmontaje y retirada de puerta existente" | oficio:carpinteria | mano_obra | cantidad: 1 | precio_unitario: 45 | total: 45
  2. concepto:"Suministro de puerta [resistente al fuego EI60 / cortafuego] incluyendo marco y herrajes homologados" | oficio:carpinteria | material | precio_unitario: 0 | requiere_revision: true | motivo: "Precio varía según dimensiones, clasificación RF y fabricante"
  3. concepto:"Instalación y ajuste de puerta resistente al fuego (fijación marco, colgado hoja, regulación)" | oficio:carpinteria | mano_obra | cantidad: 1 | precio_unitario: 45 | total: 180 (aprox 4h)
  4. SI lleva cierre automático/pivote: concepto:"Suministro e instalación brazo cierre automático homologado" | oficio:cerrajeria | material | precio_unitario: 0 | requiere_revision: true

PUERTAS DE PASO NORMALES (interior, exterior, blindada, acorazada):
- oficio: carpinteria (madera/PVC) o cerrajeria (metálica/blindada/acorazada)
- Partidas: desmontaje existente + suministro nueva (precio=0) + instalación

VENTANAS (madera, aluminio, PVC, rotura puente térmico):
- oficio: carpinteria
- Partidas: desmontaje ventana existente + suministro nueva (precio=0) + instalación y sellado + persianas/contraventanas si aplica

ARMARIOS A MEDIDA (empotrados, modulares):
- oficio: carpinteria
- Partidas: diseño/medición + suministro materiales/módulos (precio=0) + montaje e instalación

========================
REGLAS PARA INSTALACIONES ESPECIALES
========================

Cuando no encuentres el oficio exacto en el catálogo, NO inventes precios. En su lugar:
- Usa el oficio más cercano para la mano de obra (albanileria, fontaneria, electricidad, etc.)
- Marca los suministros y equipos especializados como material precio=0 + requiere_revision=true
- Añade la sugerencia al catálogo con nuevo_oficio: true

REGLA ANTI-ERROR: Si el usuario describe una reforma, obra o trabajos de instalación → tipo_presupuesto: "reforma". NUNCA confundas una reforma con un servicio de mantenimiento recurrente.

========================
FORMATO DE SALIDA OBLIGATORIO
========================

JSON válido. Sin markdown. Sin texto fuera del JSON.

{
  "resumen": {
    "texto_original": "",
    "tipo_presupuesto": "",
    "requiere_revision_general": false,
    "alertas": []
  },
  "oficios_detectados": [
    {
      "oficio": "",
      "existe_en_catalogo": true,
      "nuevo_oficio": false,
      "tarifa_hora": { "min": 0, "recomendado": 0, "max": 0 },
      "motivo": ""
    }
  ],
  "partidas": [
    {
      "concepto": "",
      "descripcion": "",
      "oficio": "",
      "tipo_partida": "mano_obra",
      "unidad": "hora",
      "cantidad": 0,
      "precio_unitario": 0,
      "total": 0,
      "precio_origen": "catalogo",
      "requiere_revision": false,
      "motivo_revision": ""
    }
  ],
  "calculos": {
    "subtotal": 0,
    "iva_porcentaje": 21,
    "iva": 0,
    "total": 0
  },
  "sugerencias_catalogo": [],
  "partidas_nuevas_detectadas": []
}

tipo_partida: "mano_obra" | "material" | "servicio"
unidad: "hora" | "unidad" | "m2" | "m3" | "ml" | "mes" | "servicio" | "jornada" | "kit"
precio_origen: "catalogo" | "usuario" | "estimado" | "pendiente" | "tarifa_instalador"

IMPORTANTE: Los calculos.subtotal, calculos.iva y calculos.total deben ser la suma real de todos los totales de partidas.`;

const EMPTY_QUOTE = {
  resumen: { texto_original: '', tipo_presupuesto: '', requiere_revision_general: true, alertas: ['No se pudo interpretar el dictado'] },
  oficios_detectados: [],
  partidas: [],
  calculos: { subtotal: 0, iva_porcentaje: 21, iva: 0, total: 0 },
  sugerencias_catalogo: [],
};

// ── Enriquece precios de partidas con tarifas del instalador ──────────────────
// Arquitectura: IA genera partidas (ya sabe lo que necesita un trabajo)
// Catálogo traduce partidas → artículos tarifables reales con precio del instalador
interface Partida {
  concepto?: string;
  tipo_partida?: string;
  requiere_revision?: boolean;
  precio_unitario?: number;
  cantidad?: number;
  total?: number;
  precio_origen?: string;
  catalog_codigo?: string;
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return new Response(JSON.stringify({ error: 'Sin autorización' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Anon key → modo demo (sin límites de plan, sin tracking)
  const isAnonRequest = SUPABASE_ANON_KEY && token === SUPABASE_ANON_KEY;

  let userId: string | null = null;
  if (!isAnonRequest) {
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
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
      }), { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } });
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
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // ── Recibir audio ──────────────────────────────────────────────────────
      const formData = await req.formData();
      const audioFile = formData.get('audio') as File | null;
      if (!audioFile) {
        return new Response(JSON.stringify({ error: 'Falta el campo "audio" en el formulario' }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      if (audioFile.size < 100) {
        return new Response(JSON.stringify({ error: 'Audio demasiado corto — habla un poco más tiempo' }), {
          status: 422, headers: { ...CORS, 'Content-Type': 'application/json' },
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
      if (!transcript.trim()) {
        return new Response(JSON.stringify({ error: 'No se detectó voz en el audio' }), {
          status: 422, headers: { ...CORS, 'Content-Type': 'application/json' },
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
      }), { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ── Generar presupuesto con IA (Haiku — velocidad máxima ~3-5s) ───────────
    // Arquitectura: la IA ya sabe qué necesita cada trabajo (piscina, reforma, etc.)
    // No depende del KB (trade_actuaciones). El catálogo enriquece precios DESPUÉS.
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: AI_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `El profesional dice: "${transcript}"` }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error(`Claude error ${claudeRes.status}: ${err.slice(0, 200)}`);
    }

    const claudeData = await claudeRes.json() as { content: Array<{ type: string; text?: string }> };
    const allText = claudeData.content.filter(b => b.type === 'text').map(b => b.text ?? '').join('');

    let quote: Record<string, unknown>;
    try {
      const trimmed = allText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      if (trimmed.startsWith('{')) {
        quote = JSON.parse(trimmed);
      } else {
        const jsonMatch = allText.match(/\{[\s\S]*\}/);
        quote = JSON.parse(jsonMatch?.[0] ?? '{}');
      }
    } catch {
      console.error('[claude] JSON parse failed, sample:', allText.slice(0, 300));
      quote = { ...EMPTY_QUOTE };
    }

    // ── Enriquecer precios con catálogo del instalador ────────────────────────
    // INTENCIÓN (IA) → PARTIDAS (IA genera) → ARTÍCULOS (catálogo precio) → PRESUPUESTO
    if (orgId && quote.partidas) {
      await enrichWithCatalogPrices(supabase, orgId, quote);
    }

    // ── Registrar uso ─────────────────────────────────────────────────────────
    if (orgId) {
      supabase.from('trade_ai_usage').insert({
        org_id: orgId,
        feature: 'voice',
        metadata: {
          model: 'haiku',
          catalog_enriched: true,
          partidas_count: ((quote as Record<string, unknown[]>).partidas ?? []).length,
        },
      }).then(() => {/* fire-and-forget */});
    }

    return new Response(
      JSON.stringify({ transcript, quote }),
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
