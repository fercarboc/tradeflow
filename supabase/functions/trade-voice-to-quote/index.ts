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

Partidas a generar SIEMPRE para piscina nueva:
1. concepto:"Replanteo, excavación y movimiento de tierras para vaso de piscina" | oficio:albanileria | mano_obra | precio_unitario: 40 €/h | estimar horas según tamaño
2. concepto:"Suministro de hormigón armado y materiales estructura vaso" | oficio:albanileria | material | precio_unitario: 0 | requiere_revision: true | motivo: "Precio varía según dimensiones y tipo de piscina"
3. concepto:"Construcción estructura vaso piscina (encofrado, ferrallado, hormigonado)" | oficio:albanileria | mano_obra | precio_unitario: 40 €/h
4. concepto:"Impermeabilización interior vaso piscina" | oficio:albanileria | mano_obra | precio_unitario: 40 €/h | unidad: m2
5. concepto:"Suministro e instalación sistema de filtración y depuradora" | oficio:fontaneria | material | precio_unitario: 0 | requiere_revision: true
6. concepto:"Instalación red hidráulica piscina (tuberías, skimmer, boquillas de impulsión y retorno)" | oficio:fontaneria | mano_obra | precio_unitario: 50 €/h
7. concepto:"Instalación eléctrica bomba depuradora, iluminación subacuática y cuadro de control" | oficio:electricidad | mano_obra | precio_unitario: 50 €/h
8. concepto:"Suministro e instalación liner/gresite/azulejo acabado interior" | oficio:albanileria | material | precio_unitario: 0 | requiere_revision: true
9. concepto:"Colocación acabados interiores vaso (gresite/liner/azulejo)" | oficio:albanileria | mano_obra | precio_unitario: 40 €/h | unidad: m2
10. concepto:"Suministro e instalación escalera/escalinata piscina" | oficio:albanileria | material | precio_unitario: 0 | requiere_revision: true
11. concepto:"Solado perimetral (terraza/bordillo piscina)" | oficio:albanileria | mano_obra | precio_unitario: 35 €/h | unidad: m2

Para piscina prefabricada (fibra/poliéster): reducir partidas, enfatizar suministro prefabricado (precio=0, requiere_revision) + instalación hidráulica + eléctrica.
Para reforma de piscina existente: solo las partidas afectadas (ej: solo cambio liner, solo renovación depuradora).

EJEMPLOS:
- "instalar piscina 8x4 en chalet": albanileria (estructura+acabados) + fontaneria (hidráulica) + electricidad (bomba+luz)
- "cambiar el liner de la piscina": albanileria mano_obra (vaciado, retirada liner viejo, colocación nuevo) + material liner (precio=0)
- "instalar jacuzzi exterior": fontaneria (conexión agua) + electricidad (bomba+calefacción) + albanileria (base/bancada si es necesaria)

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

EJEMPLOS:
- "puerta de madera resistente al fuego": carpinteria — desmontaje + suministro puerta RF (precio=0) + instalación
- "puerta cortafuegos para el garaje": cerrajeria — desmontaje + suministro puerta metálica RF EI60 (precio=0) + instalación
- "cambiar ventanas por PVC con doble acristalamiento": carpinteria — desmontaje + suministro ventanas PVC (precio=0) + instalación + sellado

========================
REGLAS PARA INSTALACIONES ESPECIALES (PISCINAS, ASCENSORES, SOLAR, DOMÓTICA)
========================

Cuando no encuentres el oficio exacto en el catálogo, NO inventes precios. En su lugar:
- Usa el oficio más cercano para la mano de obra (albanileria, fontaneria, electricidad, etc.)
- Marca los suministros y equipos especializados como material precio=0 + requiere_revision=true
- Añade la sugerencia al catálogo con nuevo_oficio: true
- Crea una alerta en resumen.alertas explicando qué requiere revisión

Ejemplos de trabajos especiales y a qué oficios mapear:
- Ascensor doméstico → electricidad (instalación) + albanileria (obra civil hueco)
- Paneles solares fotovoltaicos → energia_solar o electricidad si no existe
- Domótica / automatización → telecomunicaciones o electricidad
- Riego automático jardín → fontaneria + jardineria
- Barbacoa de obra → albanileria
- Chimenea de obra / hogar → albanileria + albanileria (suministro material precio=0)
- Sauna / baño turco → albanileria + fontaneria + electricidad
- Pérgola de madera → carpinteria
- Pérgola de aluminio → cerrajeria o carpinteria
- Cerramiento de terraza → carpinteria (vidrio/PVC) o cerrajeria (aluminio)

REGLA ANTI-ERROR: Si el usuario describe una reforma, obra o trabajos de instalación → tipo_presupuesto: "reforma". NUNCA confundas una reforma con un servicio de mantenimiento recurrente.

========================
BÚSQUEDA WEB — CUÁNDO Y CÓMO USARLA
========================

Tienes acceso a la herramienta de búsqueda web. Úsala así:

CUANDO BUSCAR (obligatorio):
- Si la BASE DE CONOCIMIENTO está vacía o tiene score < 0.3 para el trabajo descrito → BUSCA SIEMPRE
- Si el trabajo descrito involucra instalaciones poco comunes (piscinas, ascensores, domótica, energía solar, etc.) → BUSCA
- Si la descripción es muy específica y las plantillas existentes no la cubren bien → BUSCA

QUÉ BUSCAR:
- "presupuesto [tipo de trabajo] partidas instalador España 2024"
- "cómo hacer presupuesto de [trabajo] paso a paso"
- "partidas presupuesto [oficio] [trabajo específico] España"

CÓMO USAR EL RESULTADO WEB:
1. Compara las partidas encontradas en internet con las que ya tienes en la BASE DE CONOCIMIENTO
2. Si internet tiene partidas adicionales importantes que NO están en nuestra base → inclúyelas en "partidas" Y en "partidas_nuevas_detectadas"
3. Si nuestra base ya era suficientemente completa → "partidas_nuevas_detectadas" queda vacío
4. Marca las partidas que vienen de internet con precio_origen: "web"

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
  "partidas_nuevas_detectadas": [
    {
      "concepto": "",
      "oficio": "",
      "fuente": "web",
      "motivo": ""
    }
  ]
}

tipo_partida: "mano_obra" | "material" | "servicio"
unidad: "hora" | "unidad" | "m2" | "mes" | "servicio" | "jornada" | "kit"
precio_origen: "catalogo" | "usuario" | "estimado" | "pendiente" | "web"

IMPORTANTE: Los calculos.subtotal, calculos.iva y calculos.total deben ser la suma real de todos los totales de partidas.`;

const EMPTY_QUOTE = {
  resumen: { texto_original: '', tipo_presupuesto: '', requiere_revision_general: true, alertas: ['No se pudo interpretar el dictado'] },
  oficios_detectados: [],
  partidas: [],
  calculos: { subtotal: 0, iva_porcentaje: 21, iva: 0, total: 0 },
  sugerencias_catalogo: [],
};

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
      // ── Step 1: Receive audio ──────────────────────────────────────────────
      const formData = await req.formData();
      const audioFile = formData.get('audio') as File | null;
      if (!audioFile) {
        return new Response(JSON.stringify({ error: 'Falta el campo "audio" en el formulario' }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      // Validar tamaño mínimo (audio muy corto/vacío falla en Whisper)
      if (audioFile.size < 100) {
        return new Response(JSON.stringify({ error: 'Audio demasiado corto — habla un poco más tiempo' }), {
          status: 422, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      // ── Step 2: Transcription (OpenAI Whisper) ─────────────────────────────
      // Preservar extensión original para que Whisper detecte el formato correctamente
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

    // ── Step 2.5: Search knowledge base for matching actuaciones ─────────────
    let knowledgeContext = '';
    let matchedActuacionIds: string[] = [];
    let kbScore = 0;

    try {
      const { data: actuaciones } = await supabase.rpc('search_actuaciones_scored', {
        p_transcript: transcript.slice(0, 500),
        p_limit: 4,
      }) as { data: Array<{
        actuacion_id: string; oficio: string;
        partidas_obligatorias: string[]; partidas_auxiliares: string[];
        reglas_calculo: string; unidad: string; observaciones: string; score: number;
      }> | null };

      if (actuaciones && actuaciones.length > 0) {
        matchedActuacionIds = actuaciones.map(a => a.actuacion_id);
        kbScore = actuaciones[0].score ?? 0;

        const sections = actuaciones.map(a =>
          `ACTUACION: ${a.actuacion_id}
OFICIO: ${a.oficio}
PARTIDAS_OBLIGATORIAS: ${a.partidas_obligatorias.join(', ')}
PARTIDAS_AUXILIARES: ${a.partidas_auxiliares.join(', ')}
REGLAS_CALCULO: ${a.reglas_calculo}
UNIDAD: ${a.unidad}
OBSERVACIONES: ${a.observaciones}`
        ).join('\n\n');

        knowledgeContext = `\n\n========================
BASE DE CONOCIMIENTO — ACTUACIONES DETECTADAS (score: ${kbScore.toFixed(2)})
========================

${sections}

INSTRUCCIÓN: Si alguna de estas actuaciones coincide con lo que pide el profesional, ÚSALA como plantilla base para las partidas. Adapta cantidades y añade o quita partidas según el contexto específico. Si crees que faltan partidas importantes, usa la búsqueda web para completarlas.`;
      } else {
        knowledgeContext = `\n\n========================
BASE DE CONOCIMIENTO — SIN COINCIDENCIAS
========================
No se encontraron plantillas para este tipo de trabajo en la base de conocimiento local. USA LA BÚSQUEDA WEB para encontrar qué partidas incluye normalmente este trabajo en España.`;
      }
    } catch (kbErr) {
      console.warn('[knowledge-base] search error:', (kbErr as Error).message);
    }

    // ── Step 3: Generate quote structure (Claude Haiku + Web Search) ──────────
    // Si no hay KB o el score es bajo → forzar búsqueda web
    const needsWebSearch = matchedActuacionIds.length === 0 || kbScore < 0.3;

    const userMessage = needsWebSearch
      ? `El profesional dice: "${transcript}"

La BASE DE CONOCIMIENTO no tiene plantillas suficientes para este trabajo (score: ${kbScore.toFixed(2)}).
DEBES usar la búsqueda web para encontrar qué partidas incluye este tipo de trabajo en España.
Busca "presupuesto ${transcript.slice(0, 60)} partidas instalador España" o similar.
Genera el presupuesto más completo posible y reporta en "partidas_nuevas_detectadas" las partidas que encontraste en internet.`
      : `El profesional dice: "${transcript}"

Usa las ACTUACIONES de la BASE DE CONOCIMIENTO como base. Si detectas que faltan partidas importantes comparado con la práctica real, usa la búsqueda web para completarlas y repórtalas en "partidas_nuevas_detectadas".`;

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
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 2,
          }
        ],
        tool_choice: needsWebSearch ? { type: 'any' } : { type: 'auto' },
        system: AI_SYSTEM_PROMPT + knowledgeContext,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      // Si web_search no soportado, reintentar sin tool
      if (claudeRes.status === 400 && err.includes('web_search')) {
        console.warn('[claude] web_search not available, retrying without tool');
        const retryRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4096,
            system: AI_SYSTEM_PROMPT + knowledgeContext,
            messages: [{ role: 'user', content: `El profesional dice: "${transcript}"` }],
          }),
        });
        if (!retryRes.ok) {
          const retryErr = await retryRes.text();
          throw new Error(`Claude error ${retryRes.status}: ${retryErr}`);
        }
        const retryData = await retryRes.json() as { content: Array<{ type: string; text?: string }> };
        const retryText = retryData.content.filter(b => b.type === 'text').map(b => b.text).join('');
        let fallbackQuote: Record<string, unknown>;
        try {
          fallbackQuote = JSON.parse(retryText.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
        } catch {
          fallbackQuote = { ...EMPTY_QUOTE };
        }
        if (orgId) await supabase.from('trade_ai_usage').insert({ org_id: orgId, feature: 'voice' });
        return new Response(
          JSON.stringify({ transcript, quote: fallbackQuote, actuacion_ids_matched: matchedActuacionIds }),
          { headers: { ...CORS, 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`Claude error ${claudeRes.status}: ${err}`);
    }

    // Extraer texto del response (puede tener bloques de web_search_tool_result + text)
    const claudeData = await claudeRes.json() as { content: Array<{ type: string; text?: string }> };
    const textBlocks = claudeData.content.filter(b => b.type === 'text');
    const rawText = textBlocks[textBlocks.length - 1]?.text ?? '{}';

    let quote: Record<string, unknown>;
    try {
      const clean = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      quote = JSON.parse(clean);
    } catch {
      console.error('[claude] JSON parse failed, rawText:', rawText.slice(0, 200));
      quote = { ...EMPTY_QUOTE };
    }

    // ── Registrar uso en trade_ai_usage ──────────────────────────────────────
    if (orgId) {
      await supabase.from('trade_ai_usage').insert({
        org_id: orgId,
        feature: 'voice',
        metadata: {
          kb_score: kbScore,
          actuaciones_used: matchedActuacionIds.length,
          web_search_used: !needsWebSearch ? false : true,
          partidas_nuevas: ((quote as Record<string, unknown[]>).partidas_nuevas_detectadas ?? []).length,
        },
      });
    }

    // ── Incrementar uso de actuaciones (para scoring futuro) ─────────────────
    if (matchedActuacionIds.length > 0) {
      supabase.rpc('increment_actuacion_usage', { p_actuacion_ids: matchedActuacionIds }).then(() => {/* fire-and-forget */});
    }

    return new Response(
      JSON.stringify({ transcript, quote, actuacion_ids_matched: matchedActuacionIds }),
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
