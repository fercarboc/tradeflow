# RC1-C.5A — Capa visual del Marketplace demo

**Versión:** 1.0  
**Fecha:** 2026-08-09  
**Estado:** DISEÑO — pendiente implantación en BD y frontend  
**Dependencia:** RC1_C5_SUPPLIER_PROFILES.md, RC1_C5_PROMOTIONS.md

---

## 1. Propósito

La capa visual traduce los datos de perfil y métricas en una experiencia de usuario que responde a la pregunta: **¿Por qué debería comprarle a este proveedor?**

Esta capa opera en tres niveles:
1. **Tarjeta de catálogo** — primer contacto en el listado de proveedores
2. **Banner del proveedor** — hero en la página de perfil
3. **Señales de confianza** — distintivos, métricas, valoraciones, zona de servicio

---

## 2. Sistema de identidad visual por proveedor

### 2.1 Paleta de colores

| Proveedor | Color primario | Color secundario | Emoción |
|-----------|--------------|-----------------|---------|
| ObrasMat | `#2C5F2E` verde obra | `#F5F5DC` beige | Solidez, amplitud |
| STN | `#C1440E` naranja térmico | `#FFF3E0` cálido | Calor, energía |
| FSQ | `#005B8E` azul agua | `#E3F2FD` azul claro | Agua, confianza |
| EDC | `#F5A623` amarillo eléctrico | `#FFF8E1` ámbar | Energía, técnica |
| STN-comp | `#2C3E50` grafito | `#ECF0F1` gris claro | Precisión, premium |
| ElectroSum | `#6C3483` violeta | `#EDE7F6` lavanda | Innovación, baño |
| RevObra | `#8D6E63` terracota | `#FBE9E7` salmón claro | Calidez, artesanía |
| Carpintería | `#5D4037` madera | `#EFEBE9` beige cálido | Natural, calidad |
| Pinturas | `#1565C0` azul cobalto | `#E3F2FD` azul claro | Creatividad, precisión |

### 2.2 Emoji + iniciales (placeholder de logo)

| Proveedor | Emoji | Iniciales | Uso |
|-----------|-------|-----------|-----|
| ObrasMat | 🏗️ | OM | Tarjeta cuando no hay logo real |
| STN | 🔥 | STN | — |
| FSQ | 💧 | FSQ | — |
| EDC | ⚡ | EDC | — |
| STN-comp | 🔩 | STN | — |
| ElectroSum | 🔌 | ESC | — |
| RevObra | 🏠 | RON | — |
| Carpintería | 🚪 | CCN | — |
| Pinturas | 🎨 | PPN | — |

---

## 3. Diseño de componentes UI

### 3.1 Tarjeta de proveedor en listado (`SupplierCard`)

```
┌─────────────────────────────────────────────────────────────────┐
│ [COLOR_PRIMARIO]                               [BADGE_DESTACADO] │
│                                                                   │
│  [EMOJI_ICONO]  NOMBRE DEL PROVEEDOR                             │
│  [INICIALES]    ─────────────────────                            │
│                 Descripción corta (≤ 160 chars)                   │
│                                                                   │
│  ─────────────────────────────────────────────────────────────   │
│  📦 N offerings   ⭐ X.X / 5   ⚡ Entrega en Xh   📍 Zona        │
│  ─────────────────────────────────────────────────────────────   │
│  [Badge 1]  [Badge 2]  [Badge 3]                                  │
│  ─────────────────────────────────────────────────────────────   │
│  [Producto 1]  [Producto 2]  [Producto 3]           Ver más →    │
└─────────────────────────────────────────────────────────────────┘
```

**Ejemplo — ObrasMat:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ██████████████████████████████████████████████ [Mejor valorado] │
│ (#2C5F2E)                                                         │
│  🏗️   Obras y Materiales S.L.                                    │
│  OM   ──────────────────────────────────────────────────────    │
│       Distribuidor generalista de materiales. Amplio stock,      │
│       precios competitivos, entrega en obra.                     │
│                                                                   │
│  📦 36 productos   ⭐ 4.2/5   ⚡ 24h   📍 Cantabria y alrededores │
│  ─────────────────────────────────────────────────────────────   │
│  [📦 Distribuidor integral] [⚡ Entrega 24h] [🏆 Amplia trayectoria] │
│  ─────────────────────────────────────────────────────────────   │
│  Kit fontanería · Extractor baño · Lavabo encimera   Ver más →  │
└─────────────────────────────────────────────────────────────────┘
```

**Ejemplo — STN:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ██████████████████████████████████████ [Especialista térmico]   │
│ (#C1440E)                                                         │
│  🔥   Sistemas Térmicos del Norte S.L.                           │
│  STN  ──────────────────────────────────────────────────────    │
│       Distribuidor especializado en sistemas térmicos. ACS,      │
│       calderas y aerotermia desde Cantabria.                     │
│                                                                   │
│  📦 35 productos   ⭐ 4.5/5   ⚡ 48h   📍 Cantabria · Asturias   │
│  ─────────────────────────────────────────────────────────────   │
│  [🔥 Especialista térmico] [✅ Gestión técnica RITE] [🛡️ Gestión de garantías] │
│  ─────────────────────────────────────────────────────────────   │
│  Calentador 11L · Caldera 24kW · Aerotermia 8kW   Ver más →    │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.2 Hero banner del proveedor (`SupplierBannerHero`)

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                        │
│  [GRADIENTE / COLOR_PRIMARIO]                           [EMOJI_BIG]  │
│                                                                        │
│    TÍTULO PRINCIPAL DE CAMPAÑA                                         │
│    Subtítulo descriptivo con propuesta de valor                        │
│                                                                        │
│    [BADGE 1]  [BADGE 2]  [BADGE 3]                                    │
│                                                                        │
│    [CTA: Ver catálogo →]          [⭐ X.X · N valoraciones]           │
│                                                                        │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│  📦 N ofertas   ⚡ Plazo Xh   📍 Zona de servicio   📞 Contactar      │
└──────────────────────────────────────────────────────────────────────┘
```

**Ejemplo — FSQ:**
```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                        │
│  [gradiente: #005B8E → #2E86AB]                                 💧   │
│                                                                        │
│    Especialistas en agua y calor desde el norte                        │
│    Fontanería técnica con 25 años de experiencia en Cantabria          │
│                                                                        │
│    [🏆 25 años]  [💧 Fontanería técnica]  [⚡ Entrega 24h]             │
│                                                                        │
│    [Ver catálogo FSQ →]               [⭐ 4.3 · 124 valoraciones]     │
│                                                                        │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│  📦 20 ofertas   ⚡ 24h stock / 3-5 días pedido   📍 Norte de España  │
└──────────────────────────────────────────────────────────────────────┘
```

---

### 3.3 Tarjeta de métrica (`MetricChip`)

```
[⭐ 4.5/5]   [⚡ Entrega 48h]   [📦 312 pedidos]   [🔄 78% repiten]
```

**Estados visuales:**
- Verde (`#2C5F2E`): valoración ≥ 4.3, entrega ≤ plazo prometido, repetición ≥ 70%
- Ámbar (`#F5A623`): valoración 3.8-4.2, retrasos ocasionales
- Rojo (`#C0392B`): valoración < 3.8, alta tasa incidencias (no aplicable a demo)

---

### 3.4 Diseño de la página de perfil de proveedor (`ScreenProveedor`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ [BANNER HERO — hero completo con gradiente, título, CTA]            │
├─────────────────────────────────────────────────────────────────────┤
│ TABS: Catálogo | Perfil | Destacados | Promociones | Opiniones       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│ TAB CATÁLOGO:                                                         │
│   [Filtro: Familia ▼] [Precio ▼] [Stock disponible ✓]               │
│   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                               │
│   │ UP 1 │ │ UP 2 │ │ UP 3 │ │ UP 4 │  → grid de offerings          │
│   └──────┘ └──────┘ └──────┘ └──────┘                               │
│                                                                       │
│ TAB PERFIL:                                                           │
│   Sobre nosotros (descripcion_larga)                                  │
│   Zona de servicio (mapa o lista)                                     │
│   Plazos de entrega                                                   │
│   Certificaciones y distintivos                                       │
│   Contacto                                                            │
│                                                                       │
│ TAB DESTACADOS:                                                       │
│   [Producto 1] [Producto 2] [Producto 3] [Producto 4]                │
│   (con descripción del por qué están destacados)                      │
│                                                                       │
│ TAB PROMOCIONES:                                                      │
│   Tarjeta pack_ahorro: precio normal vs precio pack + CTA             │
│   Tarjeta descuento: "10% descuento en [productos]"                   │
│                                                                       │
│ TAB OPINIONES:                                                        │
│   ⭐ X.X/5  (N valoraciones)                                          │
│   Barra distribución: ⭐⭐⭐⭐⭐ ████████ 68%                           │
│                       ⭐⭐⭐⭐   ████     21%                           │
│                       ⭐⭐⭐    ██        8%                            │
│                       ⭐⭐      █         3%                            │
│   [Comentario 1] [Comentario 2] [Comentario 3]                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.5 Tarjeta de promoción (`PromoCard`)

```
┌──────────────────────────────────────────────────────┐
│ 🏷️  PACK AHORRO                              ACTIVA  │
│ ──────────────────────────────────────────────────── │
│ Pack instalación doméstica completa                   │
│ Mecanismos + cuadro + cable para una habitación      │
│                                                       │
│ ~~79.50 €~~  →  67.90 €  (-14%)                      │
│                                                       │
│ Incluye: interruptor · conmutador · enchufe · pulsad │
│          cuadro 18M · cable 1.5mm² 50ml              │
│                                                       │
│ [Añadir pack al pedido →]          Hasta 31/12/2026  │
└──────────────────────────────────────────────────────┘
```

---

## 4. Señales de confianza — sistema de distintivos

### 4.1 Catálogo completo de badges

| ID | Tipo | Título | Descripción | Icono | Condición demo |
|----|------|--------|-------------|-------|---------------|
| B01 | volumen | Distribuidor integral | Más de 1.000 referencias disponibles | 📦 | ObrasMat |
| B02 | entrega | Entrega 24h | Stock disponible entregado en 24 horas | ⚡ | ObrasMat, FSQ, EDC |
| B03 | experiencia | Amplia trayectoria | Trayectoria contrastada | 🏆 | ObrasMat |
| B04 | experiencia | Larga trayectoria | El veterano del sector | 🥇 | FSQ |
| B05 | especialista | Especialista térmico | ACS + calefacción + aerotermia | 🔥 | STN |
| B06 | especialista | Gestión técnica RITE | Documentación y gestión de instalaciones RITE | ✅ | STN |
| B07 | garantia | Gestión de garantías | Gestión directa con fabricante | 🛡️ | STN |
| B08 | especialista | Fontanería técnica | Catálogo especializado | 💧 | FSQ |
| B09 | especialista | Mayorista eléctrico | Catálogo técnico completo | ⚡ | EDC |
| B10 | especialista | Material REBT compatible | Material apto para instalaciones eléctricas | ✅ | EDC |
| B11 | especialista | Gama premium | El proveedor de grifería de mayor calidad | 💎 | STN-comp |
| B12 | valoracion | Mejor valorado | 4.7 sobre 5 — el más valorado del ecosistema | ⭐ | STN-comp |
| B13 | especialista | Especialista IP44 | Zona húmedas y baños | 🚿 | ElectroSum |
| B14 | especialista | Cerámicos y revestimientos | Catálogo especializado | 🏠 | RevObra |
| B15 | especialista | Distribuidor directo | Venta directa de primera mano | 🎨 | Pinturas |

### 4.2 Asignación por actor

| Actor | Badges asignados |
|-------|-----------------|
| ObrasMat | B01, B02, B03 |
| STN | B05, B06, B07 |
| FSQ | B04, B08, B02 |
| EDC | B09, B10, B02 |
| STN-comp | B11, B12 |
| ElectroSum | B13 |
| RevObra | B14 |
| Carpintería | — (ampliar en Sprint C) |
| Pinturas | B15 |

---

## 5. Plantillas de banner por proveedor

### Especificaciones técnicas

```
Dimensiones: 1200 × 300 px (full-width en ScreenProveedor)
Formato React: <SupplierBannerHero config={banner_config} />
Colores: desde actor_profiles.color_primario y color_secundario
```

### Config banners (JSON — para campo `banner_config` en BD)

**ObrasMat:**
```json
{
  "titulo": "Todo lo que necesita la obra, en un solo proveedor",
  "subtitulo": "Materiales de construcción y reforma. Más de 1.000 referencias en stock.",
  "cta_label": "Ver catálogo completo",
  "fondo_tipo": "gradiente",
  "fondo_valor": "linear-gradient(135deg, #2C5F2E 0%, #4A7C59 100%)",
  "texto_color": "#FFFFFF",
  "badge_destacado": "Distribuidor integral · Entrega 24h",
  "promocion_activa": true,
  "promocion_texto": "Pack inicio de obra con 8% de descuento"
}
```

**STN:**
```json
{
  "titulo": "Calor eficiente: ACS, climatización y energías renovables",
  "subtitulo": "Calderas, bombas de calor y aerotermia. Instaladores RITE certificados.",
  "cta_label": "Explorar sistemas térmicos",
  "fondo_tipo": "gradiente",
  "fondo_valor": "linear-gradient(135deg, #C1440E 0%, #E67E22 100%)",
  "texto_color": "#FFFFFF",
  "badge_destacado": "Especialista en eficiencia energética",
  "promocion_activa": true,
  "promocion_texto": "Pack calefacción completa — ahorra un 10%"
}
```

**FSQ:**
```json
{
  "titulo": "Especialistas en agua y calor desde el norte",
  "subtitulo": "25 años de experiencia en fontanería técnica e instalaciones sanitarias.",
  "cta_label": "Ver catálogo de fontanería",
  "fondo_tipo": "gradiente",
  "fondo_valor": "linear-gradient(135deg, #005B8E 0%, #2E86AB 100%)",
  "texto_color": "#FFFFFF",
  "badge_destacado": "25 años · Catálogo técnico profundo",
  "promocion_activa": true,
  "promocion_texto": "Pack renovación de baño — todo en uno"
}
```

**EDC:**
```json
{
  "titulo": "Distribución eléctrica profesional para el norte",
  "subtitulo": "Material eléctrico a precio de mayorista. Mecanismos, protecciones y cuadros.",
  "cta_label": "Ver material eléctrico",
  "fondo_tipo": "gradiente",
  "fondo_valor": "linear-gradient(135deg, #B07D00 0%, #F5A623 100%)",
  "texto_color": "#FFFFFF",
  "badge_destacado": "Mayorista REBT · Entrega 24h",
  "promocion_activa": true,
  "promocion_texto": "Pack instalación doméstica completa — 9% de ahorro"
}
```

**STN-comp (Suministros Técnicos Norte):**
```json
{
  "titulo": "Grifería y accesorios para instalaciones exigentes",
  "subtitulo": "Gama premium de baño y cocina. El proveedor mejor valorado del Marketplace.",
  "cta_label": "Ver grifería premium",
  "fondo_tipo": "gradiente",
  "fondo_valor": "linear-gradient(135deg, #2C3E50 0%, #4A6278 100%)",
  "texto_color": "#FFFFFF",
  "badge_destacado": "⭐ 4.7/5 · Mejor valorado",
  "promocion_activa": false
}
```

---

## 6. Plan de implantación

### 6.1 Componentes React nuevos

```typescript
// Nuevos componentes a crear

// src/components/marketplace/SupplierCard.tsx
// → Tarjeta de proveedor en listado (§3.1)

// src/components/marketplace/SupplierBannerHero.tsx
// → Hero banner del proveedor (§3.2)

// src/components/marketplace/SupplierBadgeList.tsx
// → Lista de distintivos (§4)

// src/components/marketplace/MetricChipRow.tsx
// → Fila de chips de métricas (§3.3)

// src/components/marketplace/PromoCard.tsx
// → Tarjeta de promoción (§3.5)

// src/components/marketplace/SupplierReviewList.tsx
// → Lista de reseñas demo
```

### 6.2 Modificaciones a pantallas existentes

```typescript
// ScreenMarketplace → añadir grid de SupplierCard
// ScreenProveedor → añadir SupplierBannerHero + tabs completos
```

### 6.3 Nuevas consultas Supabase

```typescript
// supabase/queries/marketplace/supplier-profile.ts
// → getSupplierProfile(actorId)
// → getSupplierBadges(actorId)
// → getSupplierMetrics(actorId)
// → getSupplierPromotions(actorId)
// → getSupplierFeaturedOfferings(actorId)
// → getSupplierReviews(actorId, limit)
```

### 6.4 Secuencia de implementación

```
Semana 1: BD — tablas + INSERT datos demo
Semana 2: Componentes base (SupplierCard, SupplierBannerHero, SupplierBadgeList)
Semana 3: ScreenMarketplace — integrar SupplierCard en listado
Semana 4: ScreenProveedor — tabs completos (catálogo, perfil, destacados, promos, opiniones)
```

---

## 7. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| Colores con contraste insuficiente (WCAG AA) | Media | Medio | Validar con herramienta de contraste antes de commit |
| Banner demasiado grande en móvil | Alta | Alto | `max-height: 180px` en mobile, texto truncado |
| Tabs de ScreenProveedor con demasiado contenido para demo escaso | Media | Bajo | Mostrar tabs solo si tienen contenido (condicional) |
| Tiempo de desarrollo > estimado por complejidad de SupplierCard | Media | Medio | Diseño mobile-first, funcionalidad mínima primero |
| Datos de reseñas que parezcan autogenerados | Media | Alto | Variar tono, longitud, erratas ocasionales, fechas diferentes |
