# MKT Fase 1 — Guía de Clasificación y Lote Piloto

**Versión:** 3.0 (migración aplicada en producción)
**Fecha:** 2026-08-01
**Referencia:** MKT-ARCH-01 v2.0 · Fase 1 Fundación
**Fuente de datos:** `trade_global_catalog` WHERE oficio = 'Fontanería' (101 registros reales)
**Estado:** ✅ COMPLETADO — Migración aplicada en producción 2026-08-01

---

## Decisiones humanas aplicadas (2026-08-01)

| Registro | Clasificación aprobada | Detalle |
|----------|----------------------|---------|
| FON-INS-LLAVE | 🔴 PARTIDA NC | Suministro + instalación combinados, sin desglose fiable |
| FON-MAN-SIF | 🔴 PARTIDA NC | El concepto principal es el servicio de sustitución |
| FON-GRF-LAR | 🟢 PRODUCTO UNIVERSAL | Nombre canónico: "Grifo para lavadero o exterior 1/2 pulgadas" |
| FON-VAL-SEG | 🔵 VARIANTE | UP padre: "Válvula de seguridad" · conexión=3/4 pulgadas · presión=3 bar |
| FON-SAN-DUC-PX | 🔵 VARIANTE | UP padre: "Plato de ducha extraplano" · 100x70 cm · rectangular |
| Equipos ACS | Nueva categoría | "Equipos de agua caliente sanitaria" · revisión individual de 13 registros |

---

## Parte 1 — Guía de Clasificación

### 1.1 Las cinco categorías

---

#### 🟢 PRODUCTO UNIVERSAL

**Definición:** Artículo físico adquirible a un proveedor, con una sola especificación relevante de identificación, donde no existe en el catálogo una versión con distinto tamaño, capacidad o material que compita directamente.

**Criterios:**
- Es un objeto físico que se puede pedir a un distribuidor
- Su descripción no contiene una medida que lo diferencie de otra fila similar del mismo catálogo
- Si tiene una medida en el nombre, es la única opción de ese tipo (no hay más diámetros del mismo producto)
- Se puede asignar a una categoría del Marketplace directamente

**Ejemplos reales del catálogo:**
- `Grifo monomando lavabo alto brillo` — único grifo de lavabo monomando estándar
- `Grifo bañera monomando` — única fila de este tipo
- `Inodoro suspendido con cisterna` — única referencia de inodoro suspendido completo
- `Grifo para lavadero o exterior 1/2 pulgadas` — 1/2" es el estándar del mercado para este uso

**Atributos mínimos del UP:**
- nombre_canonico: nombre genérico sin marca
- oficio, familia, subfamilia
- unidad (ud, ml, etc.)
- category_id (categoría del Marketplace)
- global_catalog_id (FK al registro de gc)
- validation_state = 'draft' (hasta revisión)

---

#### 🔵 VARIANTE

**Definición:** Especificación concreta de un producto más genérico, distinguida por al menos un atributo técnico mensurable (diámetro, longitud, capacidad, potencia, caudal, presión) que coexiste con otras filas del mismo tipo en el catálogo.

**Criterios:**
- Existe en el catálogo al menos otra fila con el mismo nombre base pero diferente medida; O
- Tiene una medida técnica que identifica una especificación concreta dentro de una familia de productos (aunque no haya hermanos en el catálogo actual)
- El atributo diferenciador es técnicamente significativo (no solo estético)

**Ejemplos reales del catálogo:**
- `Tubo cobre 15mm`, `Tubo cobre 22mm`, `Tubo cobre 42mm` → variantes del UP "Tubo cobre"
- `Válvula esférica 1/2" latón`, `Válvula esférica 3/4" latón` → variantes del UP "Válvula esférica latón"
- `Válvula de seguridad 3/4" 3bar` → variante del UP "Válvula de seguridad" (único en gc, pero es una especificación técnica concreta)
- `Plato de ducha 100x70cm extra plano` → variante del UP "Plato de ducha extraplano" (material diferente al de resina)

**Acción:** Crear el UP padre (si no existe), luego crear la variante vinculada a él en `trade_marketplace_universal_product_variants`.

---

#### 🔴 PARTIDA NO COMERCIAL

**Definición:** Servicio, mano de obra, partida de trabajo o coste no adquirible a un proveedor de materiales. Aparece en presupuestos pero no puede comprarse en el Marketplace.

**Criterios:**
- Su unidad es `h` (horas), o su descripción contiene verbos de acción: instalar, desatascar, sustituir, detectar, desplazamiento
- No existe un artículo físico que un distribuidor pueda suministrar de forma separada
- Los conjuntos suministro+instalación sin desglose fiable se tratan como partida no comercial

**Ejemplos reales del catálogo:**
- `Oficial 1ª fontanero (hora)` — servicio puro
- `Instalar calentador gas` — trabajo de instalación
- `Llave de paso nueva + instalación` — conjunto sin desglose fiable → PARTIDA NC
- `Sustitución sifón bajo lavabo` — el concepto principal es el servicio → PARTIDA NC

**Acción:** No crear UP. Conservar en `trade_global_catalog` para uso exclusivo del Motor IA en presupuestos.

---

#### 🟡 DUPLICADO

**Definición:** Registro que describe el mismo producto que otra fila del catálogo, con descripción diferente pero referenciando el mismo artículo físico.

En el lote analizado (101 registros de fontanería): **ningún duplicado confirmado**.

---

#### ⚪ REQUIERE REVISIÓN

**Definición:** Registro cuya clasificación depende de información adicional. En el piloto de 40 registros, todos los casos de Requiere Revisión han sido resueltos por decisión humana y reclasificados.

---

### 1.2 Árbol de decisión

```
¿Es un servicio, mano de obra, trabajo o conjunto sin desglose fiable?
  ├── SÍ → PARTIDA NO COMERCIAL
  └── NO ↓

¿Tiene una medida o especificación técnica en el nombre (diámetro, L, kW, bar)?
  ├── SÍ → VARIANTE (buscar UP padre; si no existe, crearlo como es_generico=true)
  └── NO ↓

¿Existe otra fila que describe el mismo artículo con distinto texto?
  ├── SÍ → DUPLICADO
  └── NO → PRODUCTO UNIVERSAL
```

---

### 1.3 Atributos de variante mínimos por tipo de producto

| Tipo de producto | Atributo diferenciador | Formato en jsonb | Ejemplos |
|-----------------|----------------------|-----------------|---------|
| Tubería (cobre, multicapa, PVC, PE) | diámetro | `{"diametro": "15 mm"}` | 15mm, 16x2mm, 110mm |
| Accesorios (codos, tes) | diámetro | `{"diametro": "15 mm", "angulo": "90°"}` | 15mm, 22mm |
| Válvulas esféricas | conexión + material | `{"conexion": "1/2 pulgada", "material": "latón"}` | 1/2, 3/4, 1 pulgada |
| Válvula de seguridad | conexión + presión máx | `{"conexion": "3/4 pulgada", "presion_max": "3 bar"}` | — |
| Termos eléctricos | capacidad | `{"capacidad": "50 L"}` | 50L, 80L, 100L, 150L |
| Calentadores de gas | caudal | `{"caudal": "11 L/min"}` | 11L/min, 14L/min |
| Aerotermos | capacidad + refrigerante | `{"capacidad": "80 L", "refrigerante": "R290"}` | — |
| Grupos de presión | potencia | `{"potencia": "0.55 kW"}` | 0.55kW, 1kW |
| Vasos de expansión | capacidad | `{"capacidad": "8 L"}` | 8L, 18L, 35L |
| Platos de ducha resina | dimensiones + forma | `{"dimensiones": "80x80 cm", "forma": "cuadrado"}` | — |
| Plato ducha extraplano | dimensiones + forma | `{"dimensiones": "100x70 cm", "forma": "rectangular"}` | — |
| Tubo PVC saneamiento | diámetro | `{"diametro": "110 mm", "uso": "saneamiento"}` | 32–160mm |

---

## Parte 2 — Lista definitiva del piloto (40 registros, todos clasificados)

### A. PARTIDAS NO COMERCIALES — 19 registros

*Ningún UP creado. Conservar en trade_global_catalog para Motor IA.*

| # | codigo | descripcion | familia | Motivo |
|---|--------|-------------|---------|--------|
| 1 | FON-MO-OF | Oficial 1ª fontanero (hora) | Mano de obra | Servicio puro |
| 2 | FON-MO-AYU | Ayudante fontanero (hora) | Mano de obra | Servicio puro |
| 3 | FON-MO-OFI | Oficial fontanero + peón (hora) | Mano de obra | Servicio puro |
| 4 | FON-MO-GUAR | Guardia de avería urgente (hora) | Mano de obra | Servicio puro |
| 5 | FON-MO-DES | Desplazamiento (precio fijo) | Mano de obra | Coste logístico |
| 6 | FON-INS-BANO | Instalación completa baño nuevo | Instalaciones | Servicio completo |
| 7 | FON-INS-CAL | Instalar calentador gas | Instalaciones | Trabajo de instalación |
| 8 | FON-INS-WCS | Instalar inodoro suspendido | Instalaciones | Trabajo de instalación |
| 9 | FON-INS-LAVT | Instalar lavabo completo | Instalaciones | Trabajo de instalación |
| 10 | FON-INS-DUC | Instalar plato ducha c/desagüe | Instalaciones | Trabajo de instalación |
| 11 | FON-INS-TERM | Instalar termo eléctrico | Instalaciones | Trabajo de instalación |
| 12 | FON-INS-ACOM | Acometida agua 1/2" | Instalaciones | Servicio infraestructura |
| 13 | FON-INS-LLAVE | Llave de paso nueva + instalación | Instalaciones | Conjunto sin desglose fiable ← decisión humana |
| 14 | FON-MAN-DESH | Desatasco hidro-jet profesional | Mantenimiento | Servicio mantenimiento |
| 15 | FON-MAN-DESM | Desatasco mecánico cañería | Mantenimiento | Servicio mantenimiento |
| 16 | FON-MAN-DES | Desatasco sifón o ramal | Mantenimiento | Servicio mantenimiento |
| 17 | FON-MAN-DETF | Detección fuga con cámara termográfica | Mantenimiento | Servicio diagnóstico |
| 18 | FON-MAN-JUN | Sustitución juntas grifo | Mantenimiento | Servicio mantenimiento |
| 19 | FON-MAN-SIF | Sustitución sifón bajo lavabo | Mantenimiento | Concepto principal = servicio ← decisión humana |

---

### B. VARIANTES — 15 registros (en 11 UPs padre)

*Requieren creación del UP padre antes de la variante.*

| # | codigo | descripcion | UP padre | Atributo diferenciador |
|---|--------|-------------|----------|----------------------|
| 20 | FON-CU-015 | Tubo cobre 15mm (por metro) | Tubo cobre | diámetro: 15 mm |
| 21 | FON-CU-022 | Tubo cobre 22mm (por metro) | Tubo cobre | diámetro: 22 mm |
| 22 | FON-MC-016 | Tubo multicapa 16x2mm (por metro) | Tubo multicapa | diámetro: 16x2 mm |
| 23 | FON-PE-20 | Tubo PE-100 20mm (por metro) | Tubo PE-100 | diámetro: 20 mm |
| 24 | FON-PVC-20 | Tubo PVC presión 20mm (por metro) | Tubo PVC presión | diámetro: 20 mm |
| 25 | FON-PVC-S110 | Tubo PVC saneamiento 110mm | Tubo PVC saneamiento | diámetro: 110 mm |
| 26 | FON-ACC-C15T | Codo 90° cobre 15mm | Codo 90° cobre | diámetro: 15 mm |
| 27 | FON-ACC-C22T | Codo 90° cobre 22mm | Codo 90° cobre | diámetro: 22 mm |
| 28 | FON-ACC-T15 | Té cobre 15mm igual | Té cobre | diámetro: 15 mm |
| 29 | FON-VAL-ESF15 | Válvula esférica 1/2" latón | Válvula esférica latón | conexión: 1/2 pulgada |
| 30 | FON-VAL-ESF22 | Válvula esférica 3/4" latón | Válvula esférica latón | conexión: 3/4 pulgada |
| 31 | FON-SAN-DUC-P | Plato ducha 80x80cm resina | Plato de ducha resina | 80x80 cm, cuadrado |
| 32 | FON-SAN-DUC-P90 | Plato ducha 90x90cm resina | Plato de ducha resina | 90x90 cm, cuadrado |
| 33 | FON-VAL-SEG | Válvula de seguridad 3/4" 3bar | Válvula de seguridad | conexión: 3/4 pulgada, presión: 3 bar ← decisión humana |
| 34 | FON-SAN-DUC-PX | Plato ducha 100x70cm extra plano | Plato de ducha extraplano | 100x70 cm, rectangular ← decisión humana |

---

### C. PRODUCTOS UNIVERSALES — 6 registros

*1 ya existe en producción (actualizar); 5 son nuevos.*

| # | codigo | gc_id (real) | nombre_canonico | Estado |
|---|--------|-------------|----------------|--------|
| 35 | FON-GRF-LAV | d1f03189-... | Grifo monomando lavabo | EXISTE (PZ-FON-001) — UPDATE category_id + global_catalog_id |
| 36 | FON-GRF-BAN | ba48e899-... | Grifo monomando bañera | Nuevo |
| 37 | FON-GRF-COC | 67fb8206-... | Grifo monomando cocina alto | Nuevo |
| 38 | FON-GRF-TER-DUC | 40df9784-... | Kit ducha termostático | Nuevo |
| 39 | FON-SAN-WC-S | 617eef24-... | Inodoro suspendido con cisterna | Nuevo |
| 40 | FON-GRF-LAR | bb5ea271-... | Grifo para lavadero o exterior 1/2 pulgadas | Nuevo ← decisión humana |

---

## Parte 3 — Resumen definitivo de operaciones

| Operación | Cantidad | Detalle |
|-----------|----------|---------|
| Categoría nueva a crear | 1 | "Equipos de agua caliente sanitaria" (slug: font-acs) |
| UPs padre a crear | 11 | Genéricos (es_generico=true, validation_state='draft') |
| UPs directos a crear | 5 | Productos únicos nuevos |
| UPs existentes a actualizar | 1 | PZ-FON-001: añadir category_id + global_catalog_id |
| Variantes a crear | 15 | Vinculadas a los 11 UPs padre |
| Partidas NC (sin acción) | 19 | Conservar en gc para Motor IA |
| **Total registros del piloto** | **40 / 40** | Todos clasificados |

**Estado esperado tras la migración:**

| Tabla | Antes | Después |
|-------|-------|---------|
| trade_marketplace_universal_products | 6 | 22 |
| trade_marketplace_universal_product_variants | 0 | 15 |
| trade_marketplace_categories | 25 | 26 |

---

## Parte 4 — Punto C: Conflictos con los 6 UPs existentes

| EAN | nombre_canonico | Conflicto | Acción |
|-----|----------------|----------|--------|
| PZ-FON-001 | Grifo monomando lavabo | NOMBRE IDENTICO al UP directo #35 | UPDATE: category_id + global_catalog_id |
| PZ-FON-002 | Tubo y sifón desagüe PVC | Sin conflicto | Ninguna |
| PZ-FON-003 | Plato de ducha (genérico) | Sin conflicto técnico — es el genérico; los propuestos son sublíneas con material | Ninguna |
| PZ-FON-004 | Grifo monomando ducha | Sin conflicto | Ninguna |
| PZ-FON-005 | Sifón y desagüe ducha | Sin conflicto | Ninguna |
| PZ-FON-006 | Mampara de ducha | Sin conflicto | Ninguna |

---

## Parte 5 — Pendiente: revisión individual Equipos ACS (13 registros)

*No incluidos en la migración SQL actual. Requieren aprobación separada.*

| codigo | descripcion | UP padre propuesto | Atributo diferenciador |
|--------|-------------|-------------------|----------------------|
| FON-EQU-TERM50 | Termo eléctrico 50L | Termo eléctrico | capacidad: 50 L |
| FON-EQU-TERM80 | Termo eléctrico 80L | Termo eléctrico | capacidad: 80 L |
| FON-EQU-TERM100 | Termo eléctrico 100L | Termo eléctrico | capacidad: 100 L |
| FON-EQU-TERM150 | Termo eléctrico 150L | Termo eléctrico | capacidad: 150 L |
| FON-EQU-CALGAS11 | Calentador gas estanco 11L/min | Calentador de gas estanco | caudal: 11 L/min |
| FON-EQU-CALGAS14 | Calentador gas estanco 14L/min | Calentador de gas estanco | caudal: 14 L/min |
| FON-EQU-AERO80 | Aerotermo ACS 80L R290 | Aerotermo ACS | capacidad: 80 L, refrigerante: R290 |
| FON-EQU-AERO200 | Aerotermo ACS 200L R290 | Aerotermo ACS | capacidad: 200 L, refrigerante: R290 |
| FON-EQU-VAR055 | Grupo presión variador 0.55kW | Grupo de presión con variador | potencia: 0.55 kW |
| FON-EQU-VAR1K | Grupo presión variador 1kW | Grupo de presión con variador | potencia: 1 kW |
| FON-EQU-EXP8 | Vaso expansión 8L | Vaso de expansión | capacidad: 8 L |
| FON-EQU-EXP18 | Vaso expansión 18L | Vaso de expansión | capacidad: 18 L |
| FON-EQU-EXP35 | Vaso expansión 35L | Vaso de expansión | capacidad: 35 L |

Si se aprueban: 5 UPs padre ACS adicionales + 13 variantes adicionales.

---

## Parte 6 — Mapa familia → categoría (definitivo con UUIDs reales)

| familia gc | Categoría Marketplace | UUID completo |
|-----------|----------------------|--------------|
| Tubería | Tuberías y Uniones | 3c629d1b-571d-44df-8f0e-8de7259f4f25 |
| Accesorios | Tuberías y Uniones | 3c629d1b-571d-44df-8f0e-8de7259f4f25 |
| Válvulas | Tuberías y Uniones | 3c629d1b-571d-44df-8f0e-8de7259f4f25 |
| Saneamiento | Desagüe y Saneamiento | d19b757a-d45c-4702-be34-b31bb8d56ec6 |
| Grifería | Griferías | 9ea5bf24-67f7-4e8e-91ba-10ed279f3999 |
| Sanitarios | Sanitarios | 671f3caf-e3da-49d5-8a8c-d7f81ca8b6c2 |
| Equipos ACS | Equipos de agua caliente sanitaria | (a crear, slug: font-acs) |
| Instalaciones | N/A — partida no comercial | — |
| Mantenimiento | N/A — partida no comercial | — |
| Mano de obra | N/A — partida no comercial | — |

---

## SQL de referencia

### DDL

- DDL: `docs/marketplace/sql/MKT_FASE1_PILOT_001_DDL.sql`
- DDL rollback: `docs/marketplace/sql/MKT_FASE1_PILOT_001_DDL_ROLLBACK.sql`
- Fix constraints EAN/GTIN: `docs/marketplace/sql/MKT_FASE1_PILOT_001_VARIANT_IDENTIFIERS_FIX.sql`
- Fix rollback: `docs/marketplace/sql/MKT_FASE1_PILOT_001_VARIANT_IDENTIFIERS_FIX_ROLLBACK.sql`

### DML

- Migración v4: `docs/marketplace/sql/MKT_FASE1_PILOT_001_v4.sql`
- Rollback v4: `docs/marketplace/sql/MKT_FASE1_PILOT_001_ROLLBACK_v4.sql`
- DRY RUN v3: `docs/marketplace/sql/MKT_FASE1_PILOT_001_DRY_RUN_v3.sql`

---

## Registro de ejecución

| Campo | Valor |
|---|---|
| Fecha ejecución | 2026-08-01 |
| Proyecto Supabase | dqqjaujnulutinskmqsu (eu-central-1) |
| UPs antes | 6 |
| UPs después | 22 (+16) |
| Variantes antes | 0 |
| Variantes después | 15 |
| Categorías antes | 25 |
| Categorías después | 26 (+1 font-acs) |
| DDL aplicado | `global_catalog_id uuid FK trade_global_catalog` + índice UNIQUE parcial en variants |
| Incidencia 1 | `chk_up_origen` no admitía `'pilot_fontaneria_2026_08_01'` → origen corregido a `'global_catalog'`; batch identificado por `especificaciones->>'_batch'='MKT_FASE1_PILOT_001'` |
| Incidencia 2 | `uq_variant_ean` / `uq_variant_gtin` con `NULLS NOT DISTINCT` impedían múltiples variantes sin EAN/GTIN → reemplazados por índices únicos parciales `WHERE columna IS NOT NULL` |
| Integridad final | 7/7 checks OK (sin duplicados, sin huérfanos, sin NC con relación marketplace, sin ajenos modificados) |
| Cobertura gc | 21/21 CUBIERTO (6 directos + 15 variantes) |
| Rollback disponible | `MKT_FASE1_PILOT_001_ROLLBACK_v4.sql` — válido mientras no se carguen UPs ajenos al lote |

---

*Versión 3.0 — Migración aplicada en producción 2026-08-01*
*Basado en 101 registros reales de trade_global_catalog — sin modificación de datos fuera del lote*
*Siguiente paso: MKT-FASE1-PILOT-002 — Validación funcional Motor IA → UP → variante → Marketplace*
