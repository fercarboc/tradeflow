# RC1-C.5A.1 — Modelo de promociones locales

**Versión:** 1.0  
**Fecha:** 2026-08-09  
**Estado:** DISEÑO — pendiente aprobación  
**Dependencia:** RC1_C5A1_SUPPLIER_LOCATIONS.md, RC1_C5_PROMOTIONS.md v1.0

---

## 1. Principios

### 1.1 Publicidad ≠ Ranking

**Invariante del sistema:** ninguna promoción — ni nacional ni local — altera el orden del comparador de precios orgánico. El ranking siempre es `precio_profesional_resuelto ASC`.

Una promoción puede:
- Reducir el precio real de la offering (y por tanto mejorar su posición de ranking si resulta el más bajo)
- Aparecer en banner, sección "Destacados" o tab "Promociones" del proveedor
- Mostrar un chip `🏷 Oferta local` en la tarjeta del producto

Una promoción **no puede**:
- Hacer aparecer un producto primero en el comparador si su precio no es el más bajo
- Modificar el orden de resultados de `get_offerings_for_up`

### 1.2 Scope de la promoción

```
national  → aplica a todas las locations del actor (o sin location)
regional  → aplica a una comunidad autónoma
local     → aplica a una location específica
```

### 1.3 Distinción entre tipos de destacado

| Tipo | Efecto |
|------|--------|
| `home_banner` | Aparece en Home del Marketplace (banner rotatorio) |
| `perfil_proveedor` | Aparece en la página del proveedor (hero o sección promociones) |
| `seccion_patrocinada` | Aparece en una sección "Ofertas destacadas" en el listado |
| `comparador_chip` | Muestra chip `🏷 Oferta` en el comparador (sin cambiar orden) |

Nunca: "aparece primero en resultados de búsqueda".

---

## 2. Modelo de datos

### 2.1 `trade_marketplace_promotions` (tabla revisada)

```sql
CREATE TYPE promo_tipo AS ENUM (
  'descuento_porcentaje',   -- X% de descuento en offering(s)
  'pack_ahorro',            -- varias offerings juntas a precio especial
  'envio_gratis',           -- sin coste de envío desde umbral
  'recogida_gratis',        -- recogida en tienda sin coste
  'local_discount',         -- descuento específico de una tienda
  'clearance',              -- liquidación de stock (cantidad limitada)
  'discontinued',           -- producto descatalogado con precio de salida
  'local_campaign',         -- campaña local (apertura, aniversario, etc.)
  'excess_stock',           -- exceso de stock en una tienda
  'novedad',                -- producto nuevo en el catálogo
  'destacado_home',         -- aparece en Home del Marketplace
  'destacado_perfil'        -- aparece destacado en el perfil del proveedor
);

CREATE TYPE promo_scope AS ENUM (
  'national',
  'regional',
  'local'
);

CREATE TABLE public.trade_marketplace_promotions (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id             uuid NOT NULL REFERENCES public.trade_marketplace_actors(id),

  -- Scope
  tipo                 public.promo_tipo NOT NULL,
  scope                public.promo_scope NOT NULL DEFAULT 'national',
  location_id          uuid REFERENCES public.trade_marketplace_supplier_locations(id),  -- solo scope='local'
  comunidad_autonoma   text,                  -- solo scope='regional'

  -- Contenido
  titulo               text NOT NULL,
  descripcion          text,
  cta_label            text,

  -- Vigencia
  fecha_inicio         date NOT NULL,
  fecha_fin            date,                  -- NULL = sin fecha de fin
  activa               bool NOT NULL DEFAULT true,

  -- Visibilidad
  mostrar_en_home      bool NOT NULL DEFAULT false,
  mostrar_en_perfil    bool NOT NULL DEFAULT true,
  mostrar_chip_comparador bool NOT NULL DEFAULT false,

  -- Config específica por tipo (jsonb)
  config               jsonb NOT NULL DEFAULT '{}',
  /*
    descuento_porcentaje: { pct: 10, offering_ids: ["uuid",...] }
    pack_ahorro:          { offering_ids: [...], precio_pack: 89.90, ahorro_pct: 12 }
    envio_gratis:         { umbral_eur: 150 }
    clearance:            { offering_ids: [...], stock_max: 5, precio_clearance: 14.90 }
    local_discount:       { offering_ids: [...], precio_local: 32.90, pct: 10 }
    local_campaign:       { motivo: "apertura", oferta_especial: true }
    excess_stock:         { offering_ids: [...], cantidad_disponible: 20 }
    destacado_home:       { imagen_banner: null, eslogan: "texto" }
  */

  -- Datos demo
  synthetic            bool NOT NULL DEFAULT false,
  synthetic_dataset    text,

  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE INDEX ON public.trade_marketplace_promotions (actor_id, activa);
CREATE INDEX ON public.trade_marketplace_promotions (location_id, activa);
CREATE INDEX ON public.trade_marketplace_promotions (fecha_inicio, fecha_fin, activa);
```

### 2.2 Relación con `trade_marketplace_location_inventory`

Cuando una promoción es de tipo `clearance`, `local_discount` o `excess_stock`, el precio real se refleja también en `location_inventory.precio_local_profesional`. Ambas tablas se mantienen en sincronía:

- Al crear promoción local con descuento → también UPDATE `location_inventory`
- Al desactivar la promoción → revertir `location_inventory.precio_local` a NULL

---

## 3. Casos de uso con ejemplos demo

### Caso 1 — Liquidación de 3 unidades (ObrasMat Torrelavega)

```
Tipo: clearance
Scope: local (location: ObrasMat Torrelavega)
Oferta: Plato ducha resina 80×80
Precio normal: 98,90 €
Precio liquidación: 74,90 €
Stock disponible: 3 unidades
Fecha: 2026-08-09 → 2026-09-30

UI:
┌──────────────────────────────────────────┐
│ 🏷 Liquidación local — solo Torrelavega  │
│ Plato ducha resina 80×80                │
│ ~~98,90 €~~  →  74,90 €                 │
│ ⚠️ Quedan 3 unidades                    │
│ Solo disponible para recogida en tienda  │
└──────────────────────────────────────────┘
```

### Caso 2 — Promoción solo Cantabria (FSQ)

```
Tipo: descuento_porcentaje
Scope: regional (comunidad: Cantabria)
Oferta: Grifo monomando lavabo + Grifo bañera
Descuento: 8%
Fecha: 2026-09-01 → 2026-11-30 (campaña otoño)
Motivo: "Renovación de baño antes del invierno"

UI:
🏷 Oferta otoño en Cantabria
-8% en grifería seleccionada hasta noviembre
```

### Caso 3 — Recogida gratuita EDC Maliaño

```
Tipo: recogida_gratis
Scope: local (location: EDC Maliaño)
Condición: pedido > 40 €
Fecha: permanente (sin fecha fin)

UI:
✅ Recogida gratuita en Maliaño
Pedidos de más de 40 € sin coste adicional
```

### Caso 4 — Apertura tienda Pinturas Norte Santander

```
Tipo: local_campaign
Scope: local
Motivo: opening_campaign
Descuento especial: 15% en toda la gama de primeras marcas
Fecha: 2026-08-09 → 2026-09-08 (primer mes)

UI:
🎉 ¡Apertura! — Pinturas Profesionales Santander
15% en toda la gama durante el primer mes
```

### Caso 5 — Stock local disponible hoy (STN Santander)

```
Tipo: excess_stock
Scope: local
Offering: Calentador instantáneo gas natural 11 L/min
Stock: 8 unidades disponibles para recogida hoy
Fecha: 2026-08-09 → 2026-08-31

UI:
📦 Stock disponible hoy en Santander
8 unidades del calentador 11L disponibles para recogida
```

### Caso 6 — Pack destacado en Home (ObrasMat)

```
Tipo: pack_ahorro + destacado_home
Scope: national
Pack: Kit instalación fontanería completa
Precio pack: 89,90 € (vs 97,50 € individual)
Fecha: 2026-09-01 → 2026-12-31
mostrar_en_home: true

UI Home:
╔══════════════════════════════════════════╗
║ 🏗️ Obras y Materiales                   ║
║ Pack instalación fontanería completa      ║
║ 89,90 € — Ahorra 7,60 €                  ║
║ [Ver pack →]                             ║
╚══════════════════════════════════════════╝
```

---

## 4. Reglas de precio y ranking

### 4.1 Precio resultante con promoción

```
precio_resultante = MIN(
  precio_local_override (si existe),
  precio_nacional - descuento_pct (si existe),
  precio_pack / num_productos (si aplica)
)
```

Este precio sí entra al comparador **como precio real**. Si es el más bajo, aparece primero orgánicamente.

### 4.2 Lo que nunca hace una promoción

```
❌ Ordena el producto por encima de otros con precio más bajo
❌ Marca como "patrocinado" para aparecer antes en búsqueda
❌ Oculta otros proveedores en el comparador
❌ Modifica `match_state` o `activa` de offerings sin esa oferta
```

### 4.3 price_source

Cuando el precio de una offering resulta de una promoción:

```sql
price_source = 'local_promotion'   -- descuento en tienda específica
             | 'local_clearance'   -- liquidación
             | 'regional_discount' -- descuento regional
             | 'pack_discount'     -- precio de pack
             | 'professional_pvd'  -- precio normal (sin promoción)
```

---

## 5. Dataset demo de promociones locales

**Promociones demo a crear (~10-12 registros, todas `synthetic=true`):**

| Actor | Tipo | Scope | Descripción |
|-------|------|-------|-------------|
| ObrasMat | pack_ahorro | national | Pack inicio de obra 8% dto |
| ObrasMat | clearance | local (Torrelavega) | Plato ducha resina 3 uds liquidación |
| ObrasMat | envio_gratis | national | Pedidos > 150€ envío gratis |
| ObrasMat | destacado_home | national | Banner otoño 2026 |
| STN | pack_ahorro | national | Pack calefacción 10% dto |
| STN | excess_stock | local (Santander) | 8 calentadores disponibles hoy |
| FSQ | pack_ahorro | national | Pack renovación baño 7% dto |
| FSQ | descuento_porcentaje | regional (Cantabria) | -8% grifería otoño |
| FSQ | clearance | local (Santander) | Válvulas esfera liquidación |
| EDC | pack_ahorro | national | Pack instalación completa 9% dto |
| EDC | recogida_gratis | local (Maliaño) | Recogida gratuita > 40€ |
| STN-comp | descuento_porcentaje | national | Primera compra grifería -5% |

---

## 6. UI — Integración en tarjeta de producto

```
Grifo monomando lavabo

Desde 36,50 €  [FSQ] [STN-comp]

Recogida disponible:
  📍 FSQ Santander — hoy · 1,2 km de tu obra
  📍 FSQ Torrelavega — hoy · 18 km
  📍 FSQ Bilbao — bajo pedido (2 días) · 105 km

🏷 Oferta otoño Cantabria: -8% hasta noviembre [FSQ]
→ Precio con oferta: 33,58 €
```

---

## 7. UI — Integración en comparador

```
Grifo monomando lavabo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 FSQ        33,58 € 🏷 Otoño Cantabria  ✅ Hoy Santander
 STN-comp   44,90 €                      📦 Stock disponible
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ranking: precio más bajo primero (33,58 € real, no manipulado)
```

---

## 8. Portal Proveedor — Gestión de promociones locales

```
Portal → Marketing → Promociones

[+ Nueva promoción]

Listado:
  ID     Tipo              Scope      Vigencia           Estado
  #001   Pack ahorro       Nacional   01/09–31/12/2026   ✅ Activa
  #002   Liquidación       Torrelavega 09/08–30/09/2026  ✅ Activa
  #003   Recogida gratis   Maliaño    Sin límite         ✅ Activa
```

Un proveedor real puede crear sus propias promociones sin necesidad de intervención de admin.

---

## 9. Riesgos

| Riesgo | Prob | Mitigación |
|--------|------|-----------|
| Promoción modifica precio → entra a ranking en mejor posición → parece manipulación | Baja | Es correcto: si el precio real es más bajo, es legítimo aparecer antes. Documentar en FAQ |
| `mostrar_chip_comparador = true` confunde con posicionamiento pagado | Media | Texto del chip: "🏷 Oferta" sin "patrocinado"; mantener distintivo claro |
| Promoción activa pero sin `location_inventory` actualizado → precio incorrecto | Media | Al crear promoción local, trigger actualiza `location_inventory` |
| Demasiadas promociones activas → UI saturada | Media | Límite: max 2 promociones visibles por proveedor en Home; max 1 banner activo |

## 10. Rollback

```sql
DROP TABLE IF EXISTS public.trade_marketplace_promotions;
DROP TYPE IF EXISTS public.promo_tipo;
DROP TYPE IF EXISTS public.promo_scope;
```

Sin impacto en actores, offerings, pedidos ni locations.
