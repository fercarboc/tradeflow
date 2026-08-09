# RC1-C.5A — Perfiles comerciales de proveedores demo

**Versión:** 1.0  
**Fecha:** 2026-08-09  
**Estado:** DISEÑO — pendiente implantación en BD  
**Dependencia:** commit 5a712d3 (Sprint B completo, 140 offerings)

---

## 1. Propósito

Este documento define la **capa comercial** de cada proveedor demo. El objetivo es que la experiencia de usuario responda a tres preguntas:

1. ¿Quién vende? → identidad, trayectoria, especialización
2. ¿Qué vende? → familias de producto, UPs cubiertos, fortalezas de catálogo
3. ¿Por qué debería comprarle? → propuesta de valor, distintivos, confianza

---

## 2. Modelo de datos propuesto

### 2.1 `trade_marketplace_actor_profiles` (nueva tabla)

```sql
CREATE TABLE public.trade_marketplace_actor_profiles (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id             uuid NOT NULL REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,

  -- Identidad
  tagline              text,
  descripcion_corta    text,                    -- ≤ 160 chars (tarjeta de catálogo)
  descripcion_larga    text,                    -- texto completo del perfil
  founded_year         int,
  anios_experiencia    int GENERATED ALWAYS AS (EXTRACT(YEAR FROM now())::int - founded_year) STORED,

  -- Contacto
  telefono_comercial   text,
  email_comercial      text,
  website              text,

  -- Zona y logística
  zona_servicio        text[],                  -- ['Cantabria', 'Asturias', 'País Vasco']
  plazo_stock_h        int,                     -- plazo en horas para stock disponible
  plazo_pedido_dias    int,                     -- plazo en días para producto bajo pedido
  minimo_pedido_eur    numeric(10,2),

  -- Imagen corporativa
  color_primario       text,                    -- hex: '#1B4F8A'
  color_secundario     text,                    -- hex: '#E8F0FE'
  emoji_icono          text,                    -- emoji representativo del actor
  logo_placeholder     text,                    -- iniciales o símbolo ASCII

  -- Certificaciones y distintivos
  certificaciones      text[],
  especialidades       text[],                  -- etiquetas de especialidad

  -- Visual
  banner_config        jsonb,                   -- ver §2.2

  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),

  UNIQUE (actor_id)
);
```

### 2.2 Estructura `banner_config`

```jsonb
{
  "titulo":           "Calor eficiente para cada instalación",
  "subtitulo":        "ACS, calderas y aerotermia desde Cantabria",
  "cta_label":        "Ver catálogo",
  "cta_href":         "/marketplace?actor=sistemas-termicos-norte",
  "fondo_tipo":       "gradiente",                 -- gradiente | color | imagen
  "fondo_valor":      "linear-gradient(135deg, #1B4F8A, #2E86AB)",
  "texto_color":      "#FFFFFF",
  "badge_destacado":  "Especialista en eficiencia energética",
  "promocion_activa": false
}
```

### 2.3 `trade_marketplace_supplier_badges` (nueva tabla)

```sql
CREATE TYPE badge_tipo AS ENUM (
  'especialista', 'volumen', 'valoracion', 'entrega', 'certificado', 'experiencia', 'garantia'
);

CREATE TABLE public.trade_marketplace_supplier_badges (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id    uuid NOT NULL REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,
  tipo        badge_tipo NOT NULL,
  titulo      text NOT NULL,
  descripcion text,
  icono       text,          -- emoji
  activa      bool DEFAULT true,
  orden       int DEFAULT 0
);
```

---

## 3. Perfiles completos por proveedor

---

### 3.1 Obras y Materiales S.L. `obramat-demo` ★★★★☆

**Actor ID:** `85e73234-c74e-44e7-865a-1aca8312f9a5`  
**Offerings:** 36 · **Familias:** 11 · **Prioridad:** P1

| Campo | Valor |
|-------|-------|
| **Tagline** | *"Todo lo que necesita la obra, en un solo proveedor"* |
| **Descripción corta** | Distribuidor generalista de materiales de construcción y reforma. Amplio stock, precios competitivos, entrega en obra. |
| **Fundación** | 2007 |
| **Años experiencia** | 18 |
| **Zona de servicio** | Cantabria, Norte de Castilla y León, País Vasco, Asturias |
| **Plazo stock** | 24 h |
| **Plazo pedido** | 48–72 h |
| **Mínimo pedido** | 50 € |
| **Email comercial** | comercial@obramat-norte.demo |
| **Teléfono** | 942 XXX XXX |
| **Color primario** | #2C5F2E (verde obra) |
| **Color secundario** | #F5F5DC (beige neutro) |
| **Emoji icono** | 🏗️ |

**Descripción larga:**
> Obras y Materiales S.L. es el distribuidor de referencia para profesionales de la construcción y la reforma en el norte de España. Con más de 18 años de trayectoria, disponemos de un catálogo de más de 1.000 referencias en fontanería, electricidad, revestimientos, pinturas, carpintería y materiales de construcción. Entregamos en obra en 24 horas para productos en stock y gestionamos pedidos especiales en menos de 72 horas. Nuestro equipo comercial está disponible de lunes a viernes para asesoramiento técnico sin coste.

**Especialidades:**
- Materiales de construcción y reforma integral
- Fontanería general y ACS
- Electricidad doméstica e industrial
- Revestimientos y pavimentos
- Pinturas y tratamientos
- Carpintería y cerramientos
- Ferretería profesional

**Certificaciones:**
- ISO 9001:2015 (Gestión de Calidad)
- Distribuidor homologado de categoría A

**Distintivos propuestos:**
| Tipo | Título | Descripción | Icono |
|------|--------|-------------|-------|
| volumen | Distribuidor integral | Más de 1.000 referencias disponibles | 📦 |
| entrega | Entrega 24 h | Stock disponible entregado en 24 horas | ⚡ |
| experiencia | +18 años | Trayectoria contrastada en distribución profesional | 🏆 |
| valoracion | Bien valorado | 4,2 sobre 5 en valoraciones de instaladores | ⭐ |

**Productos destacados (propuesta):**
1. Kit fontanería instalación completa (DEMO-FON-KIT-001)
2. Enchufe schuko IP44 + marco (DEMO-ELE-IP44-001)
3. Plato ducha resina 80×80 (DEMO-SAN-PLA-001)
4. Extractor baño temporizado (DEMO-ELE-EXT-001)

---

### 3.2 Sistemas Térmicos del Norte S.L. `sistemas-termicos-norte` ★★★★★

**Actor ID:** `ce208430-...`  
**Offerings:** 35 · **Familias:** 7 · **Prioridad:** P1

| Campo | Valor |
|-------|-------|
| **Tagline** | *"Calor eficiente: ACS, climatización y energías renovables"* |
| **Descripción corta** | Distribuidor especializado en sistemas térmicos. Soluciones para toda la gama de instalaciones de calefacción y ACS. |
| **Fundación** | 2013 |
| **Años experiencia** | 12 |
| **Zona de servicio** | Cantabria, Asturias, Norte de Burgos, La Rioja |
| **Plazo stock** | 48 h |
| **Plazo pedido** | 5–7 días (equipos especiales) |
| **Mínimo pedido** | 150 € |
| **Email comercial** | tecnico@stn-calderas.demo |
| **Teléfono** | 942 XXX XXX |
| **Color primario** | #C1440E (naranja térmico) |
| **Color secundario** | #FFF3E0 (cálido neutro) |
| **Emoji icono** | 🔥 |

**Descripción larga:**
> Sistemas Térmicos del Norte S.L. es el especialista regional en distribución de equipos de calefacción, climatización y producción de agua caliente sanitaria. Trabajamos con instaladores certificados para garantizar la correcta selección e instalación de calentadores, calderas de condensación, bombas de calor y sistemas de aerotermia. Ofrecemos asesoramiento técnico previo, soporte post-instalación y gestión de garantías directa con el fabricante. Especialistas en transición energética hacia sistemas de alta eficiencia.

**Especialidades:**
- Calderas de condensación (mural, pie, biomasa)
- Bombas de calor y aerotermia
- ACS (calentadores gas, termoacumuladores, acumuladores)
- Split inverter climatización
- Radiadores y sistemas de emisión
- Control y domótica térmica

**Certificaciones:**
- Instalador habilitado RITE (Reglamento de Instalaciones Térmicas)
- Técnico certificado en aerotermia
- Manipulador de gases fluorados

**Distintivos propuestos:**
| Tipo | Título | Descripción | Icono |
|------|--------|-------------|-------|
| especialista | Especialista térmico | Único distribuidor especializado en ACS + calefacción + aerotermia | 🔥 |
| certificado | Instalador RITE | Personal técnico habilitado para instalaciones térmicas | ✅ |
| garantia | Garantía extendida | Gestión de garantías directa con fabricante | 🛡️ |
| valoracion | Mejor valorado | 4,5 sobre 5 en valoraciones de instaladores | ⭐ |
| entrega | Entrega programada | Coordinación de entrega con el instalador | 📅 |

**Productos destacados (propuesta):**
1. Calentador gas natural 11 L/min (STM-ACS-001)
2. Caldera condensación mural 24 kW (STM-CAL-001)
3. Bomba de calor aerotermia 8 kW (STM-BDC-002)
4. Termostato WiFi inteligente (STM-CON-001)

---

### 3.3 Fontanería Saltos Quiroga S.L. `fontaneria-saltos-quiroga` ★★★★☆

**Actor ID:** `ff426e57-...`  
**Offerings:** 20 · **Familias:** 7 · **Prioridad:** P1

| Campo | Valor |
|-------|-------|
| **Tagline** | *"Especialistas en agua y calor desde el norte"* |
| **Descripción corta** | Distribución técnica de fontanería, grifería y saneamiento. Catálogo profundo, asesoramiento especializado. |
| **Fundación** | 2000 |
| **Años experiencia** | 25 |
| **Zona de servicio** | Cantabria, Asturias, norte de España |
| **Plazo stock** | 24 h |
| **Plazo pedido** | 3–5 días |
| **Mínimo pedido** | 30 € |
| **Email comercial** | pedidos@fsquiroga.demo |
| **Teléfono** | 942 XXX XXX |
| **Color primario** | #005B8E (azul agua) |
| **Color secundario** | #E3F2FD (azul claro) |
| **Emoji icono** | 💧 |

**Descripción larga:**
> Fontanería Saltos Quiroga S.L. lleva 25 años siendo el proveedor de confianza de fontaneros e instaladores del norte de España. Nuestro catálogo cubre desde la grifería de cocina y baño hasta sistemas de saneamiento completos, tuberías multicapa, válvulas técnicas y accesorios de desagüe. A diferencia de los distribuidores generalistas, nuestra especialización nos permite ofrecer asesoramiento técnico real en instalaciones de fontanería sanitaria, tanto en obra nueva como en rehabilitación.

**Especialidades:**
- Grifería monomando (baño, cocina, bañera, exterior)
- Sanitarios (lavabos, platos de ducha, mamparas)
- Tuberías (multicapa PEX-AL-PEX, cobre)
- Válvulas (esfera, termostática, antirretorno, seguridad)
- Saneamiento (sifones, botes sifónicos, desagüe)
- ACS (termos, calentadores gas, válvulas)

**Certificaciones:**
- Distribuidor homologado categoría B
- 25 años de trayectoria verificada

**Distintivos propuestos:**
| Tipo | Título | Descripción | Icono |
|------|--------|-------------|-------|
| experiencia | 25 años | El distribuidor de fontanería más veterano del ecosistema | 🏆 |
| especialista | Fontanería técnica | Catálogo especializado en instalaciones sanitarias | 💧 |
| entrega | Entrega rápida | Stock disponible en 24 horas | ⚡ |

**Productos destacados (propuesta):**
1. Grifo monomando cocina caño alto (SAL-GRF-102)
2. Válvula esfera latón 1/2" PN25 (SAL-VAL-101)
3. Sifón ducha DN50 horizontal (SAL-SNM-109)
4. Termoacumulador 50L (SAL-ACS-001)

---

### 3.4 ElectroDistribución Cantábrica S.L. `electrodistribucion-cantabrica` ★★★★☆

**Actor ID:** `2512201e-...`  
**Offerings:** 15 · **Familias:** 6 · **Prioridad:** P1

| Campo | Valor |
|-------|-------|
| **Tagline** | *"Distribución eléctrica profesional para el norte"* |
| **Descripción corta** | Distribuidor mayorista de material eléctrico. Desde mecanismos hasta cuadros de protección. |
| **Fundación** | 2010 |
| **Años experiencia** | 15 |
| **Zona de servicio** | Cantabria, Asturias, norte de España |
| **Plazo stock** | 24 h |
| **Plazo pedido** | 3–5 días |
| **Mínimo pedido** | 40 € |
| **Email comercial** | distribucion@edc-cantabrica.demo |
| **Teléfono** | 942 XXX XXX |
| **Color primario** | #F5A623 (amarillo eléctrico) |
| **Color secundario** | #FFF8E1 (ámbar claro) |
| **Emoji icono** | ⚡ |

**Descripción larga:**
> ElectroDistribución Cantábrica S.L. es el distribuidor mayorista de referencia para electricistas e instaladores del norte. Nuestro catálogo abarca desde los mecanismos de instalación estándar hasta protecciones, cuadros de distribución, cableado técnico e iluminación LED profesional. Servimos tanto a instaladores autónomos como a empresas instaladoras con necesidades de aprovisionamiento recurrente. Disponemos de servicio de asesoramiento técnico para la selección correcta de protecciones y dimensionado de cuadros eléctricos.

**Especialidades:**
- Mecanismos eléctricos (interruptores, conmutadores, enchufes, pulsadores)
- Cableado técnico (unipolar, manguera, normalizado a metros)
- Protecciones (PIA monofásico/bifásico, diferenciales)
- Cuadros de distribución (empotrar, ICP-M)
- Iluminación técnica (downlight LED, apliques exteriores IP65)
- Canalizaciones y cajas estancas IP65

**Certificaciones:**
- Distribuidor autorizado categoría B
- Homologado para venta a instaladores autorizados (REBT)

**Distintivos propuestos:**
| Tipo | Título | Descripción | Icono |
|------|--------|-------------|-------|
| especialista | Mayorista eléctrico | Catálogo técnico completo para electricistas | ⚡ |
| entrega | Entrega 24 h | Material estándar entregado en 24 horas | 🚚 |
| certificado | REBT homologado | Venta a instaladores con carnet de instalador | ✅ |

**Productos destacados (propuesta):**
1. Magnetotérmico PIA 1P 10A curva C (SON-PRO-101)
2. Interruptor diferencial 2P 40A 30mA (SON-PRO-108)
3. Cuadro distribución empotrar 18M (SON-CUA-103)
4. Cable H07V-K 2,5mm² (SON-CAB-102)

---

### 3.5 Suministros Técnicos Norte S.L. `suministros-tecnicos-norte` ★★★★★

**Offerings:** 18 · **Familias:** 4 · **Prioridad:** P2

| Campo | Valor |
|-------|-------|
| **Tagline** | *"Grifería y accesorios para instalaciones exigentes"* |
| **Color primario** | #2C3E50 (gris grafito) |
| **Color secundario** | #ECF0F1 (gris claro) |
| **Emoji icono** | 🔩 |
| **Especialidades** | Grifería premium, accesorios técnicos baño, control térmico |
| **Plazo stock** | 48 h |
| **Distintivo clave** | "Gama premium" — el proveedor de mayor precio medio del ecosistema |

---

### 3.6 ElectroSuministros Cantábrico S.L. `electrosuministros-cantabrico` ★★★★☆

**Offerings:** 6 · **Familias:** 3 · **Prioridad:** P2

| Campo | Valor |
|-------|-------|
| **Tagline** | *"Electricidad doméstica con soluciones de instalación completas"* |
| **Color primario** | #6C3483 (violeta) |
| **Color secundario** | #EDE7F6 (lavanda claro) |
| **Emoji icono** | 🔌 |
| **Especialidades** | IP44 zonas húmedas, luminaria LED baño, extractor |
| **Distintivo clave** | "Especialista zonas húmedas IP44" |

---

### 3.7 Revestimientos y Obra Norte S.L. `revestimientos-obra-norte` ★★★☆☆

**Offerings:** 5 · **Prioridad:** P3

| Campo | Valor |
|-------|-------|
| **Tagline** | *"Revestimientos y acabados para profesionales de la reforma"* |
| **Color primario** | #8D6E63 (terracota) |
| **Emoji icono** | 🏠 |
| **Distintivo clave** | "Especialista cerámicos" |

---

### 3.8 Carpintería y Cerramientos Norte S.L. `carpinteria-cerramientos-norte` ★★★☆☆

**Offerings:** 3 · **Prioridad:** P3

| Campo | Valor |
|-------|-------|
| **Tagline** | *"Cerramientos y carpintería de calidad para reformas integrales"* |
| **Color primario** | #5D4037 (madera) |
| **Emoji icono** | 🚪 |
| **Distintivo clave** | "Fabricante y distribuidor" |

---

### 3.9 Pinturas Profesionales del Norte S.L. `pinturas-profesionales-norte` ★★★☆☆

**Offerings:** 2 · **Prioridad:** P3

| Campo | Valor |
|-------|-------|
| **Tagline** | *"Pinturas técnicas para resultados duraderos"* |
| **Color primario** | #1565C0 (azul cobalto) |
| **Emoji icono** | 🎨 |
| **Distintivo clave** | "Fabricante directo" |

---

## 4. Plan de implantación

### Fase 4.1 — Migración de datos (BD)

```sql
-- 1. Crear tabla trade_marketplace_actor_profiles
-- 2. Crear tabla trade_marketplace_supplier_badges
-- 3. INSERT perfiles para los 9 actores
-- 4. INSERT badges para los 4 actores P1 (prioridad)
-- 5. Añadir columna featured_offering_ids[] a actors (o tabla nueva)
```

### Fase 4.2 — Componentes frontend

```
SupplierProfileCard     → tarjeta en listado de proveedores
SupplierProfilePage     → página completa del proveedor
SupplierBadgeList       → lista de distintivos del proveedor
SupplierBannerHero      → banner principal del proveedor
```

### Fase 4.3 — Integración Marketplace

```
ScreenMarketplace
  └── ProveedorCard → usa profile.descripcion_corta + badges[0..2] + color_primario
  
ScreenProveedor
  └── ProveedorHero → usa banner_config
  └── ProveedorBio → usa descripcion_larga + anios_experiencia + zona_servicio
  └── ProveedorBadges → usa badges
  └── ProveedorCatalogo → offerings filtradas por actor
```

---

## 5. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| Información de perfil desactualizada | Alta | Bajo | Campo `updated_at` + proceso de revisión |
| Colores corporativos no accesibles | Media | Medio | Validar contraste WCAG AA antes de deploy |
| Zona de servicio muy amplia → expectativas falsas | Baja | Alto | Aclarar en UI que son datos demo |
| Banner_config JSONB con estructura variable | Media | Bajo | Validar con JSON Schema antes de INSERT |
