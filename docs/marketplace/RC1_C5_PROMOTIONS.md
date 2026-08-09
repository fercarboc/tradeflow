# RC1-C.5A — Sistema de promociones y productos destacados

**Versión:** 1.0  
**Fecha:** 2026-08-09  
**Estado:** DISEÑO — pendiente implantación en BD  
**Dependencia:** RC1_C5_SUPPLIER_PROFILES.md

---

## 1. Propósito

Las promociones demo deben crear la percepción de un Marketplace activo y competitivo. Cada proveedor tiene una estrategia diferenciada. El objetivo no es simular descuentos reales sino mostrar:

- que los proveedores compiten activamente por captar pedidos
- que el Marketplace tiene herramientas de marketing para proveedores
- que hay motivos claros para preferir un proveedor sobre otro

---

## 2. Modelo de datos propuesto

### 2.1 `trade_marketplace_promotions` (nueva tabla)

```sql
CREATE TYPE promo_tipo AS ENUM (
  'descuento_porcentaje',   -- X% de descuento en offering(s)
  'pack_ahorro',            -- compra varias offerings juntas y ahorras
  'envio_gratis',           -- sin coste de envío si pedido > umbral
  'destacado_temporal',     -- aparece primero en resultados durante N días
  'liquidacion',            -- stock reducido, precio especial
  'novedad'                 -- producto nuevo en el catálogo del proveedor
);

CREATE TABLE public.trade_marketplace_promotions (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id             uuid NOT NULL REFERENCES public.trade_marketplace_actors(id),
  tipo                 promo_tipo NOT NULL,
  titulo               text NOT NULL,
  descripcion          text,
  fecha_inicio         date NOT NULL,
  fecha_fin            date,                     -- NULL = sin fecha fin
  activa               bool DEFAULT true,
  prioridad            int DEFAULT 0,            -- 0=normal, 1=destacada, 2=banner

  -- Config específica por tipo
  config               jsonb NOT NULL DEFAULT '{}',
  /*
    descuento_porcentaje: { pct: 10, offering_ids: [...] }
    pack_ahorro:          { offering_ids: [...], precio_pack: 89.90, ahorro_pct: 12 }
    envio_gratis:         { umbral_eur: 150 }
    destacado_temporal:   { dias: 30, offering_ids: [...] }
    liquidacion:          { offering_ids: [...], stock_max: 5 }
    novedad:              { offering_ids: [...], dias_nuevo: 30 }
  */

  created_at           timestamptz DEFAULT now()
);
```

### 2.2 `trade_marketplace_featured_offerings` (nueva tabla)

```sql
CREATE TABLE public.trade_marketplace_featured_offerings (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id      uuid NOT NULL REFERENCES public.trade_marketplace_actors(id),
  offering_id   uuid NOT NULL REFERENCES public.trade_marketplace_supplier_offerings(id),
  posicion      int NOT NULL DEFAULT 1,       -- 1 = primera posición
  razon         text,                          -- por qué está destacado
  activa        bool DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (actor_id, posicion)
);
```

---

## 3. Promociones demo por proveedor

---

### 3.1 Obras y Materiales S.L. — Estrategia: volumen y conveniencia

**Promoción A — "Pack inicio de obra"** (`pack_ahorro`)
```
Título:      Pack inicio de obra: fontanería + electricidad básica
Descripción: Lo esencial para arrancar cualquier instalación. 5 productos seleccionados,
             precio especial de pack. Ahorro del 8% sobre precio individual.
Fecha:       2026-08-01 → 2026-12-31
Prioridad:   2 (banner)
Config: {
  "offering_ids": [
    "DEMO-FON-KIT-001",   // kit fontanería
    "DEMO-ELE-IP44-001",  // enchufe schuko IP44
    "DEMO-SAN-LAV-001",   // lavabo encimera
    "DEMO-ELE-EXT-001",   // extractor baño
    "DEMO-ELE-INT-001"    // interruptor IP44
  ],
  "precio_pack": 89.90,
  "ahorro_pct": 8
}
```

**Promoción B — "Envío gratis en pedidos de obra"** (`envio_gratis`)
```
Título:      Envío gratuito a obra en pedidos desde 150 €
Descripción: Pedidos de 150 € o más se entregan directamente en obra sin coste adicional.
Fecha:       2026-07-01 → 2026-12-31
Config: { "umbral_eur": 150 }
```

**Productos destacados:**
| Posición | Ref | Razon |
|---------|-----|-------|
| 1 | DEMO-FON-KIT-001 | Mejor vendido — instaladores de obra nueva |
| 2 | DEMO-ELE-IP44-001 | Alta rotación, pedido frecuente |
| 3 | DEMO-SAN-PLA-001 | Margen alto, diferenciación vs competencia |
| 4 | DEMO-ELE-EXT-001 | Único proveedor en este UP entre los P1 |

---

### 3.2 Sistemas Térmicos del Norte S.L. — Estrategia: especialización técnica y solucion completa

**Promoción A — "Pack calefacción eficiente"** (`pack_ahorro`)
```
Título:      Pack calefacción completa: caldera + termostato + cabezales
Descripción: La instalación de calefacción completa en un solo pedido. Caldera de
             condensación 24kW, termostato WiFi y 5 cabezales termostáticos.
             10% de ahorro sobre precio individual.
Fecha:       2026-09-01 → 2027-03-31 (campaña otoño-invierno)
Prioridad:   2 (banner)
Config: {
  "offering_ids": [
    "STM-CAL-001",   // caldera 24kW
    "STM-CON-001",   // termostato WiFi
    "STM-REG-001",   // válvula termostática (x5 en metadata)
    "STM-REG-002"    // cabezal M30×1.5 (x5 en metadata)
  ],
  "precio_pack": 1425,
  "ahorro_pct": 10
}
```

**Promoción B — "Novedad: Aerotermia 2026"** (`novedad`)
```
Título:      Nuevas bombas de calor aerotermia hasta 16kW
Descripción: Incorporamos la gama completa de aerotermia: 6, 8, 12 y 16 kW.
             Instalación compatible con suelo radiante y fan-coils.
Fecha:       2026-08-08 → 2026-10-31
Config: {
  "offering_ids": ["STM-BDC-001","STM-BDC-002","STM-BDC-003","STM-BDC-004"],
  "dias_nuevo": 60
}
```

**Productos destacados:**
| Posición | Ref | Razon |
|---------|-----|-------|
| 1 | STM-BDC-002 | Aerotermia 8kW — el más solicitado de la gama |
| 2 | STM-CAL-001 | Caldera 24kW — el más vendido del catálogo |
| 3 | STM-CON-001 | Termostato WiFi — alta percepción de valor |
| 4 | STM-ACS-001 | Calentador gas 11L — rotación rápida |

---

### 3.3 Fontanería Saltos Quiroga S.L. — Estrategia: especialización + precio competitivo

**Promoción A — "Renovación de baño completa"** (`pack_ahorro`)
```
Título:      Renovación de baño: grifo bañera + lavabo + plato de ducha
Descripción: Todo lo que necesita para renovar el baño principal. Grifo monomando
             bañera con ducha, lavabo sobre encimera y plato extraplano.
             Ahorro del 7%.
Fecha:       2026-08-01 → 2026-12-31
Prioridad:   2 (banner)
Config: {
  "offering_ids": [
    "SAL-GRF-105",   // grifo bañera
    "SAL-SAN-102",   // lavabo encimera
    "SAL-SAN-115"    // plato extraplano
  ],
  "precio_pack": 389,
  "ahorro_pct": 7
}
```

**Promoción B — "Liquidación válvulas fin de temporada"** (`liquidacion`)
```
Título:      Válvulas de esfera en liquidación — stock limitado
Descripción: Últimas unidades de válvulas de esfera latón 1/2" PN25. Precio especial
             mientras dure el stock.
Fecha:       2026-08-09 → 2026-09-30
Config: {
  "offering_ids": ["SAL-VAL-101"],
  "stock_max": 15
}
```

**Productos destacados:**
| Posición | Ref | Razon |
|---------|-----|-------|
| 1 | SAL-GRF-102 | Grifo cocina premium — alta percepción de valor |
| 2 | SAL-VAL-101 | Válvula esfera — producto de alta rotación |
| 3 | SAL-TUB-101 | Tubería multicapa ml — diferenciador vs competencia |
| 4 | SAL-ACS-005 | Calentador 11L — competencia directa con STN |

---

### 3.4 ElectroDistribución Cantábrica S.L. — Estrategia: catálogo técnico + precio mayorista

**Promoción A — "Pack instalación doméstica completa"** (`pack_ahorro`)
```
Título:      Pack instalación eléctrica completa: mecanismos + cuadro + cable
Descripción: Todo lo necesario para una instalación doméstica estándar. Interruptor,
             conmutador, enchufe, pulsador, cuadro 18 módulos y 50m de cable 1,5mm².
             Ahorro del 9%.
Fecha:       2026-08-09 → 2026-12-31
Prioridad:   2 (banner)
Config: {
  "offering_ids": [
    "SON-MEC-101",  // interruptor
    "SON-MEC-102",  // conmutador
    "SON-MEC-103",  // enchufe
    "SON-MEC-105",  // pulsador
    "SON-CUA-103",  // cuadro 18M
    "SON-CAB-101"   // cable 1,5mm² 50ml
  ],
  "precio_pack": 67.90,
  "ahorro_pct": 9
}
```

**Promoción B — "Destacado: Cuadros y protecciones"** (`destacado_temporal`)
```
Título:      Cuadros y protecciones — precios de mayorista
Descripción: Accede a precios de distribuidor en toda la gama de cuadros eléctricos
             y protecciones (PIAs, diferenciales, ICP-M).
Fecha:       2026-08-09 → 2026-10-31
Config: {
  "offering_ids": [
    "SON-PRO-101","SON-PRO-104","SON-PRO-108",
    "SON-CUA-101","SON-CUA-103"
  ],
  "dias": 60
}
```

**Productos destacados:**
| Posición | Ref | Razon |
|---------|-----|-------|
| 1 | SON-PRO-108 | Diferencial 2P — el más técnico, diferenciador |
| 2 | SON-CUA-103 | Cuadro 18M — ticket alto, percepción de valor |
| 3 | SON-MEC-101 | Interruptor — alta rotación, primer pedido frecuente |
| 4 | SON-CAB-102 | Cable 2,5mm² — producto de consumo recurrente |

---

### 3.5 Suministros Técnicos Norte S.L. — Estrategia: calidad premium

**Promoción A — "Grifería premium: pruébala"** (`descuento_porcentaje`)
```
Título:      Primera compra de grifería premium — 5% de descuento
Descripción: Prueba nuestros grifos de gama alta con un descuento en el primer pedido.
Config: { "pct": 5, "offering_ids": ["todos los STN grifería"] }
```

**Productos destacados:** grifo lavabo alto, grifo cocina premium, cabezal termostático.

---

## 4. Sistema de campañas visuales

### 4.1 Campaña "Vuelta al trabajo — Otoño 2026"

```
Período:     2026-09-01 → 2026-11-30
Actores:     Todos los P1
Concepto:    La temporada de obra y rehabilitación arranca en septiembre.
             Cada proveedor muestra su producto estrella de otoño.

ObrasMat:    "Materiales para la reforma de otoño. Entrega en 24h."
STN:         "Instala calefacción antes del frío. Calderas en stock."
FSQ:         "Renovación de baño antes del invierno. Pack completo disponible."
EDC:         "Instalación eléctrica completa. Pack mecanismos + cuadro."
```

### 4.2 Campaña "Comparador de precios — ¿Quién da más?"

```
Período:     Permanente (sección Marketplace)
Concepto:    El Marketplace muestra side-by-side el precio de cada proveedor
             en UPs con 2+ offerings.
UPs con competencia real:
  - Cable H07V-K 1,5mm²: EDC 0.30€ · ElectroSum N/A · STN-comp N/A
  - Extractor baño: ElectroSum · ObrasMat · STN-comp
  - Lavabo encimera: ObrasMat · FSQ
  - Plato ducha resina: ObrasMat · FSQ
  - Mampara ducha: ObrasMat · FSQ
  - Luminaria baño IP44: ElectroSum · ObrasMat
  - Grifo monomando lavabo: STN-comp · FSQ
  - Calentador 11L: STN · FSQ
  - Termoacumulador 50L: STN · FSQ
  - Válvula esfera: STN-comp · FSQ
  - Válvula termostática radiador: STN · FSQ
  - Enchufe schuko IP44: ElectroSum · STN-comp
  - Sifón y desagüe ducha: STN-comp · FSQ
```

---

## 5. Plan de implantación

```
Paso 1: CREATE TABLE trade_marketplace_promotions
Paso 2: CREATE TABLE trade_marketplace_featured_offerings
Paso 3: INSERT 2 promociones × 5 actores = ~10 registros
Paso 4: INSERT 4 productos destacados × 9 actores = ~36 registros
Paso 5: Integrar en ScreenMarketplace: banner promo + sección "destacados"
Paso 6: Integrar en ScreenProveedor: tab "Ofertas" + "Destacados"
```

## 6. Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Pack con offerings de familias muy distintas (incoherente) | Revisar que el pack tenga sentido como "instalación completa" |
| Descuentos que parezcan irrisorios (5%) | Suficiente para demo; en producción el proveedor real fija su descuento |
| Fechas de campaña caducadas si el demo se usa en 2027 | Usar fechas dinámicas en la UI o actualizar en cada demo |
| Demasiadas promociones simultáneas → confusión visual | Máximo 1 banner activo por proveedor + 1 oferta de pack |
