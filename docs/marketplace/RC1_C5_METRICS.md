# RC1-C.5A — Métricas demo de proveedores

**Versión:** 1.0  
**Fecha:** 2026-08-09  
**Estado:** DISEÑO — pendiente implantación en BD  
**Dependencia:** RC1_C5_SUPPLIER_PROFILES.md

---

## 1. Propósito

Las métricas demo deben crear la **percepción de actividad comercial real** sin datos reales. Los valores son ficticios pero internamente coherentes entre sí, entre proveedores y con el número de offerings de cada actor.

**Principios de coherencia:**
- Proveedor con más offerings → mayor volumen de pedidos
- Proveedor de producto técnico (STN) → ticket medio alto, menor volumen
- Proveedor mayorista (EDC, ObrasMat) → ticket medio bajo, mayor volumen
- Proveedor especialista (STN, FSQ) → valoración más alta, mayor fidelización
- Generalista (ObrasMat) → más incidencias, menor tasa de repetición

---

## 2. Modelo de datos propuesto

### 2.1 `trade_marketplace_supplier_metrics` (nueva tabla)

```sql
CREATE TABLE public.trade_marketplace_supplier_metrics (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id                 uuid NOT NULL REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,
  
  -- Periodo
  periodo_inicio           date NOT NULL,
  periodo_fin              date NOT NULL,
  tipo_periodo             text DEFAULT 'acumulado',   -- acumulado | mensual | trimestral

  -- Volumen
  pedidos_total            int NOT NULL DEFAULT 0,
  lineas_pedido_total      int NOT NULL DEFAULT 0,     -- sum de todas las líneas
  ventas_bruto_eur         numeric(12,2) NOT NULL DEFAULT 0,
  ventas_neto_eur          numeric(12,2) NOT NULL DEFAULT 0,

  -- Calidad
  valoracion_media         numeric(3,2),              -- 0.00 – 5.00
  num_valoraciones         int DEFAULT 0,
  tiempo_entrega_medio_h   numeric(5,1),              -- horas reales
  tasa_entrega_en_plazo    numeric(5,2),              -- % pedidos entregados en plazo
  tasa_incidencias         numeric(5,2),              -- % pedidos con incidencia
  tasa_devolucion          numeric(5,2),              -- % pedidos devueltos
  tasa_repeticion          numeric(5,2),              -- % compradores que repiten

  -- Producto
  offering_mas_vendida_ref text,
  familia_mas_vendida      text,
  ticket_medio_eur         numeric(10,2) GENERATED ALWAYS AS (
    CASE WHEN pedidos_total > 0 THEN ventas_neto_eur / pedidos_total ELSE 0 END
  ) STORED,

  created_at               timestamptz DEFAULT now()
);

CREATE INDEX ON public.trade_marketplace_supplier_metrics (actor_id, periodo_inicio);
```

### 2.2 `trade_marketplace_supplier_reviews` (nueva tabla)

```sql
CREATE TABLE public.trade_marketplace_supplier_reviews (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id     uuid NOT NULL REFERENCES public.trade_marketplace_actors(id),
  autor_alias  text NOT NULL,       -- "Instalador J.M.", "Empresa Reformas Norte" — ficticios
  puntuacion   int NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
  titulo       text,
  comentario   text,
  fecha        date NOT NULL,
  verificado   bool DEFAULT true,
  util_count   int DEFAULT 0,       -- "¿Te resultó útil? X personas"
  created_at   timestamptz DEFAULT now()
);
```

---

## 3. Datos demo pre-calculados

### 3.1 Métricas acumuladas (período demo: 2024-01-01 → 2026-08-09)

| Actor | Pedidos | Ventas neto (€) | Valoración | Entrega media (h) | En plazo (%) | Incidencias (%) | Devolución (%) | Repetición (%) | Ticket medio (€) |
|-------|---------|----------------|-----------|-----------------|-------------|----------------|---------------|---------------|-----------------|
| ObrasMat | 847 | 48.500 | 4.2 | 22 | 91% | 3.2% | 1.8% | 62% | 57.3 |
| STN | 312 | 187.400 | 4.5 | 38 | 94% | 1.8% | 0.9% | 78% | 600.6 |
| FSQ | 241 | 28.700 | 4.3 | 19 | 93% | 2.1% | 1.5% | 70% | 119.1 |
| EDC | 198 | 15.900 | 4.4 | 16 | 95% | 1.5% | 0.8% | 65% | 80.3 |
| STN-comp | 156 | 22.400 | 4.7 | 29 | 96% | 1.2% | 0.6% | 82% | 143.6 |
| ElectroSum | 89 | 4.200 | 4.1 | 28 | 88% | 2.8% | 2.1% | 55% | 47.2 |
| RevObra | 48 | 9.800 | 4.0 | 72 | 85% | 4.5% | 3.2% | 48% | 204.2 |
| Carpintería | 32 | 14.200 | 4.2 | 96 | 82% | 5.1% | 2.8% | 52% | 443.8 |
| Pinturas | 27 | 2.100 | 3.9 | 48 | 87% | 3.8% | 2.4% | 45% | 77.8 |

*Nota: STN = Sistemas Térmicos del Norte; STN-comp = Suministros Técnicos Norte (complementario).*

### 3.2 Datos por familia (ObrasMat — más completo)

| Familia | Pedidos | Ventas (€) | Offering más vendida |
|---------|---------|------------|---------------------|
| Fontanería | 218 | 9.200 | Kit fontanería instalación |
| Electricidad | 194 | 6.800 | Enchufe schuko IP44 |
| Revestimientos | 156 | 12.400 | Azulejo blanco 30×60 |
| Suelos | 112 | 8.700 | Pavimento antideslizante |
| Sanitarios | 89 | 7.600 | Lavabo sobre encimera |
| Pintura | 78 | 3.800 | Pintura plástica blanca |

### 3.3 Serie temporal mensual (últimos 6 meses — para sparklines)

**ObrasMat:**
```json
{
  "meses": ["Mar", "Abr", "May", "Jun", "Jul", "Ago"],
  "pedidos": [62, 71, 68, 85, 92, 78],
  "ventas": [3100, 3800, 3600, 4500, 5200, 4400]
}
```

**STN:**
```json
{
  "meses": ["Mar", "Abr", "May", "Jun", "Jul", "Ago"],
  "pedidos": [18, 22, 28, 34, 41, 35],
  "ventas": [9800, 13200, 16800, 21000, 26400, 22600]
}
```

**FSQ:**
```json
{
  "meses": ["Mar", "Abr", "May", "Jun", "Jul", "Ago"],
  "pedidos": [14, 18, 22, 28, 35, 29],
  "ventas": [1400, 1900, 2200, 2900, 3800, 3100]
}
```

**EDC:**
```json
{
  "meses": ["Mar", "Abr", "May", "Jun", "Jul", "Ago"],
  "pedidos": [12, 15, 18, 24, 30, 25],
  "ventas": [820, 1100, 1400, 1900, 2400, 1950]
}
```

---

## 4. Reseñas demo por proveedor

### 4.1 ObrasMat — 4.2 ⭐ (847 pedidos, 312 reseñas)

```
"J. Martínez, Reformas Norte SL" — ⭐⭐⭐⭐⭐ (5/5) — 2026-06-12
"Gran variedad de material. Pedí fontanería y electricidad a la vez y llegó todo en 24 horas.
Muy cómodo poder hacer un solo pedido para la obra."

"Instalador Autónomo — Santander" — ⭐⭐⭐⭐ (4/5) — 2026-05-28
"Buenos precios para materiales básicos. El extractor baño tardó 3 días en lugar de los 2
prometidos, pero sin mayor problema."

"Empresa Reformas Cantabria SL" — ⭐⭐⭐⭐ (4/5) — 2026-04-15
"Producto correcto, precio ajustado. Para materiales estándar es mi primera opción."
```

### 4.2 STN — 4.5 ⭐ (312 pedidos, 187 reseñas)

```
"Instalador Térmico A.R. — Torrelavega" — ⭐⭐⭐⭐⭐ (5/5) — 2026-07-08
"La caldera llegó perfectamente embalada y con toda la documentación técnica. El soporte
post-instalación es excelente. Llevan años siendo mi proveedor de calderas."

"Técnico Climatización — Santander" — ⭐⭐⭐⭐⭐ (5/5) — 2026-06-20
"La bomba de calor de 8kW se instaló sin ningún problema. Asesoramiento técnico
impecable antes del pedido. Muy recomendable para instalaciones de aerotermia."

"Empresa Calefacción Norte SL" — ⭐⭐⭐⭐ (4/5) — 2026-05-14
"Buen producto técnico aunque el plazo fue de 5 días. Para equipos especiales hay que
planificarlo con antelación."
```

### 4.3 FSQ — 4.3 ⭐ (241 pedidos, 124 reseñas)

```
"Fontanero autónomo — Laredo" — ⭐⭐⭐⭐⭐ (5/5) — 2026-07-15
"25 años llevan en el mercado y se nota. Tienen todo lo que necesita un fontanero.
El grifo de bañera llegó en 24 horas y la calidad es excelente."

"Reformas Integrales Cantabria" — ⭐⭐⭐⭐ (4/5) — 2026-06-03
"Especialistas de verdad. Me asesoraron bien sobre la válvula antirretorno correcta
para mi instalación."
```

### 4.4 EDC — 4.4 ⭐ (198 pedidos, 98 reseñas)

```
"Electricista autónomo — Santander" — ⭐⭐⭐⭐⭐ (5/5) — 2026-08-01
"Catálogo técnico completo. El cuadro de 18 módulos llegó perfecto y el precio es
claramente inferior al de las tiendas especializadas. Ya tengo proveedor de cabecera."

"Instalaciones Eléctricas Norte SL" — ⭐⭐⭐⭐ (4/5) — 2026-07-19
"Los PIAs a precio de mayorista, eso se agradece. La diferencial tardó un día más
de lo esperado pero sin incidencias."
```

---

## 5. Métricas de comparación entre actores

### 5.1 Tabla de posicionamiento

```
              Precio ←————————————————→ Calidad
Bajo          ObrasMat   EDC            STN-comp
              ElectroSum FSQ            STN
Alto          Carpintería
              RevObra

              General ←——————————→ Especialista
General       ObrasMat
              Carpintería RevObra
              Pinturas
Técnico                    FSQ     EDC
                           ElectroSum  STN-comp
Muy técnico                            STN
```

### 5.2 KPIs de comparación directa (4 proveedores P1)

| KPI | ObrasMat | STN | FSQ | EDC |
|-----|----------|-----|-----|-----|
| Precio medio offering (€) | 57 | 601 | 119 | 80 |
| Familias cubiertas | 11 | 7 | 7 | 6 |
| Offerings activas | 36 | 35 | 20 | 15 |
| Valoración media | 4.2 ⭐ | 4.5 ⭐ | 4.3 ⭐ | 4.4 ⭐ |
| Plazo habitual | 24 h | 48 h | 24 h | 24 h |
| Tasa repetición | 62% | 78% | 70% | 65% |
| Mejor para | Volumen + variedad | Equipos técnicos | Fontanería | Material eléctrico |

---

## 6. Plan de implantación

```
Paso 1: CREATE TABLE trade_marketplace_supplier_metrics
Paso 2: CREATE TABLE trade_marketplace_supplier_reviews
Paso 3: INSERT métricas acumuladas (9 actores)
Paso 4: INSERT series temporales (4 actores P1, últimos 6 meses)
Paso 5: INSERT reseñas demo (4 actores P1, 3-5 reseñas cada uno)
```

## 7. Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|-----------|
| Métricas incoherentes entre actores | Alta | Tabla de coherencia §3.1 como fuente única |
| Ticket medio irreal para producto técnico (STN) | Baja | STN tiene calderas/aerotermia de 800-3.000€, ticket alto es correcto |
| Reseñas que parezcan autogeneradas | Media | Variar longitud, tono, puntuación y fecha |
| Meses en serie temporal desconectados de realidad | Baja | Datos coherentes con estacionalidad de obra (picos Mar-Jul, bajada Ago) |
