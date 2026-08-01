# MKT Fase 1 — Guía de Clasificación y Lote Piloto

**Versión:** 1.0  
**Fecha:** 2026-08-01  
**Referencia:** MKT-ARCH-01 v2.0 · Fase 1 Fundación  
**Fuente de datos:** `trade_global_catalog` WHERE oficio = 'Fontanería' (101 registros reales)  
**Estado:** PENDIENTE DE APROBACIÓN HUMANA — no se ha modificado ningún dato

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
- `Grifo monomando lavabo alto brillo` — solo hay un grifo de lavabo monomando estándar
- `Grifo bañera monomando` — única fila de este tipo
- `Inodoro suspendido con cisterna` — única referencia de inodoro suspendido
- `Bidé suspendido` — única referencia

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
- Existe en el catálogo al menos otra fila con el mismo nombre base pero diferente medida
- El atributo diferenciador es técnicamente significativo (no solo estético)
- Un proveedor puede suministrar versiones distintas del mismo tipo de producto

**Señales en el código del catálogo:**
- El sufijo del código gc (`FON-CU-015`, `FON-CU-022`, `FON-CU-028`...) varía solo en la medida
- La descripción es idéntica excepto por un número al final

**Ejemplos reales del catálogo:**
- `Tubo cobre 15mm`, `Tubo cobre 22mm`, `Tubo cobre 42mm` → variantes del UP "Tubo cobre"
- `Termo eléctrico 50L`, `Termo eléctrico 80L`, `Termo eléctrico 100L` → variantes del UP "Termo eléctrico"
- `Válvula esférica 1/2" latón`, `Válvula esférica 3/4" latón`, `Válvula esférica 1" latón` → variantes del UP "Válvula esférica latón"
- `Plato ducha 80x80cm resina`, `Plato ducha 90x90cm resina` → variantes del UP "Plato ducha resina"

**Acción:** Crear el UP padre (si no existe), luego crear la variante vinculada a él.  
La variante queda en `trade_marketplace_universal_product_variants`, no como UP independiente.

---

#### 🔴 PARTIDA NO COMERCIAL

**Definición:** Servicio, mano de obra, partida de trabajo o coste no adquirible a un proveedor de materiales. Aparece en presupuestos pero no puede comprarse en el Marketplace.

**Criterios:**
- Su unidad es `h` (horas), o su descripción contiene verbos de acción: "instalar", "desatascar", "sustituir", "detectar", "desplazamiento"
- No existe un artículo físico que un distribuidor pueda suministrar
- El precio es de mano de obra, no de material

**Señales en el código gc:**
- Familia = `Mano de obra`, `Instalaciones`, o `Mantenimiento`
- Prefijo de código: `FON-MO-*`, `FON-INS-*`, `FON-MAN-*`

**Ejemplos reales del catálogo:**
- `Oficial 1ª fontanero (hora)` — servicio puro
- `Instalar calentador gas` — trabajo de instalación
- `Desatasco hidro-jet profesional` — servicio de mantenimiento
- `Desplazamiento (precio fijo)` — coste de traslado

**Acción:** No crear UP. Conservar en `trade_global_catalog` para uso exclusivo del Motor IA en presupuestos.

---

#### 🟡 DUPLICADO

**Definición:** Registro que describe el mismo producto que otra fila del catálogo, con descripción diferente pero referenciando el mismo artículo físico.

**Criterios:**
- Dos filas del mismo oficio+familia tienen la misma función y dimensiones
- La diferencia es solo de redacción, no de especificación técnica
- Un proveedor no podría distinguirlos para suministrar uno u otro

**Señales:**
- Mismo rango de precio
- Misma unidad
- Descripción casi idéntica (sinónimos, abreviaturas)

**Ejemplos:** En el catálogo de fontanería analizado no se han detectado duplicados evidentes. Si apareciese uno, la acción sería: crear un único UP con el nombre más preciso y registrar el código del gc descartado en el campo `merged_into_id`.

**Acción:** Crear un único UP. Registrar cuál es el registro gc canónico y cuál el fusionado.

---

#### ⚪ REQUIERE REVISIÓN

**Definición:** Registro que no encaja con claridad en ninguna categoría anterior, o cuya clasificación correcta depende de información adicional que no está en el catálogo.

**Criterios:**
- Combina producto + servicio en una sola línea (e.g., "Llave de paso nueva + instalación")
- Tiene una medida en el nombre pero no hay otros calibres en el catálogo (¿es UP o variante huérfana?)
- La descripción es ambigua sobre si es material o trabajo
- El precio no es coherente con el tipo esperado

**Ejemplos reales del catálogo:**
- `Llave de paso nueva + instalación` — ¿material + servicio como conjunto? ¿Separar en UP + partida?
- `Sustitución sifón bajo lavabo` — ¿servicio puro? ¿Incluye el sifón como material?
- `Válvula de seguridad 3/4" 3bar` — único calibre: ¿UP o variante sin hermanos?
- `Grifo lavadero/exterior 1/2"` — el 1/2" es estándar del mercado: ¿UP o variante de "Grifo lavadero"?
- `Plato ducha 100x70cm extra plano` — distinta forma (rectangular) y material (no especifica resina): ¿variante de plato ducha resina o UP propio?

**Acción:** Anotar la pregunta específica y esperar decisión humana antes de clasificar.

---

### 1.2 Árbol de decisión

```
¿Es un servicio, mano de obra o trabajo?
  ├── SÍ → PARTIDA NO COMERCIAL
  └── NO ↓

¿Existen otras filas en el catálogo con el mismo nombre base
 pero diferente medida/capacidad/material?
  ├── SÍ → VARIANTE (del UP padre correspondiente)
  └── NO ↓

¿Tiene una medida en el nombre que es la única de ese tipo?
  ├── SÍ → REQUIERE REVISIÓN (¿UP con atributo único o variante sin hermanos?)
  └── NO ↓

¿Existe otra fila que describe el mismo artículo con distinto texto?
  ├── SÍ → DUPLICADO
  └── NO → PRODUCTO UNIVERSAL
```

---

### 1.3 Atributos de variante mínimos por tipo de producto

| Tipo de producto | Atributo diferenciador | Formato | Ejemplos |
|-----------------|----------------------|---------|---------|
| Tubería (cobre, multicapa, PVC, PE) | Diámetro exterior nominal | mm o DN-mm | 15mm, DN50, 16x2mm |
| Accesorios de tubería (codos, tes, reducciones) | Diámetro(s) | mm | 15mm, 22-15mm (reducción) |
| Válvulas (esféricas, retención) | Diámetro conexión | pulgadas | 1/2", 3/4", 1" |
| Termos eléctricos | Capacidad | litros | 50L, 80L, 100L, 150L |
| Calentadores de gas | Caudal máximo | L/min | 11L/min, 14L/min |
| Aerotermos | Capacidad + refrigerante | L + ref | 80L R290, 200L R290 |
| Grupos de presión | Potencia del motor | kW | 0.55kW, 1kW |
| Vasos de expansión | Capacidad | litros | 8L, 18L, 35L |
| Platos de ducha | Dimensiones + material | cm × cm + material | 80x80 resina, 90x90 resina |
| Bañeras | Dimensiones | cm × cm | 160x70, 180x80 |
| Lavabos / sanitarios individuales | Ancho o formato | cm | 60cm, 65cm |
| Tubo PVC saneamiento | Diámetro nominal | mm | 32mm, 40mm, 50mm, 75mm, 110mm, 125mm, 160mm |
| Abrazaderas | Diámetro de agarre | mm | 15mm, 22mm |

**Atributos mínimos que debe tener toda variante registrada:**
1. `product_id` → FK al UP padre
2. Atributo diferenciador (al menos 1): diámetro, longitud, capacidad, potencia, material, conexión
3. `unidad` / formato de venta (ud, ml, m)
4. `activo = true`

---

## Parte 2 — Lote Piloto: 40 Registros Seleccionados

**Criterio de selección:**
- Representatividad: todas las familias de fontanería incluidas
- Equilibrio: casos claros + casos dudosos en proporción realista
- Sin cherry-picking: se incluyen los casos incómodos

---

### PARTIDAS NO COMERCIALES propuestas (19 registros)

Todas proceden de las familias `Mano de obra`, `Instalaciones` y `Mantenimiento`.

| # | codigo | descripcion | unidad | precio_ref | familia | Clasificación propuesta | Motivo |
|---|--------|-------------|--------|-----------|---------|------------------------|--------|
| 1 | FON-MO-OF | Oficial 1ª fontanero (hora) | h | 38.00 | Mano de obra | 🔴 PARTIDA NC | Servicio puro: coste de tiempo de trabajo |
| 2 | FON-MO-AYU | Ayudante fontanero (hora) | h | 28.00 | Mano de obra | 🔴 PARTIDA NC | Servicio puro |
| 3 | FON-MO-OFI | Oficial fontanero + peón (hora) | h | 65.00 | Mano de obra | 🔴 PARTIDA NC | Servicio puro |
| 4 | FON-MO-GUAR | Guardia de avería urgente (hora) | h | 65.00 | Mano de obra | 🔴 PARTIDA NC | Servicio puro |
| 5 | FON-MO-DES | Desplazamiento (precio fijo) | ud | 25.00 | Mano de obra | 🔴 PARTIDA NC | Coste logístico, no material |
| 6 | FON-INS-BANO | Instalación completa baño nuevo | ud | 680.00 | Instalaciones | 🔴 PARTIDA NC | Servicio completo, no material |
| 7 | FON-INS-CAL | Instalar calentador gas | ud | 195.00 | Instalaciones | 🔴 PARTIDA NC | Trabajo de instalación |
| 8 | FON-INS-WCS | Instalar inodoro suspendido | ud | 180.00 | Instalaciones | 🔴 PARTIDA NC | Trabajo de instalación |
| 9 | FON-INS-LAVT | Instalar lavabo completo | ud | 95.00 | Instalaciones | 🔴 PARTIDA NC | Trabajo de instalación |
| 10 | FON-INS-DUC | Instalar plato ducha c/desagüe | ud | 145.00 | Instalaciones | 🔴 PARTIDA NC | Trabajo de instalación |
| 11 | FON-INS-TERM | Instalar termo eléctrico | ud | 120.00 | Instalaciones | 🔴 PARTIDA NC | Trabajo de instalación |
| 12 | FON-INS-ACOM | Acometida agua 1/2" | ud | 280.00 | Instalaciones | 🔴 PARTIDA NC | Servicio de infraestructura |
| 13 | FON-MAN-DESH | Desatasco hidro-jet profesional | ud | 180.00 | Mantenimiento | 🔴 PARTIDA NC | Servicio de mantenimiento |
| 14 | FON-MAN-DESM | Desatasco mecánico cañería | ud | 95.00 | Mantenimiento | 🔴 PARTIDA NC | Servicio de mantenimiento |
| 15 | FON-MAN-DES | Desatasco sifón o ramal | ud | 65.00 | Mantenimiento | 🔴 PARTIDA NC | Servicio de mantenimiento |
| 16 | FON-MAN-DETF | Detección fuga con cámara termográfica | ud | 120.00 | Mantenimiento | 🔴 PARTIDA NC | Servicio diagnóstico |
| 17 | FON-MAN-JUN | Sustitución juntas grifo | ud | 35.00 | Mantenimiento | 🔴 PARTIDA NC | Trabajo de mantenimiento (las juntas tienen valor mínimo, el precio es de la mano de obra) |

---

### CASOS DUDOSOS — REQUIERE REVISIÓN (3 registros)

Incluidos deliberadamente en el piloto.

| # | codigo | descripcion | unidad | precio_ref | Clasificación propuesta | Pregunta abierta |
|---|--------|-------------|--------|-----------|------------------------|-----------------|
| 18 | FON-INS-LLAVE | Llave de paso nueva + instalación | ud | 85.00 | ⚪ REQUIERE REVISIÓN | ¿Se divide en UP "Válvula de paso" (material) + partida "Instalación de llave de paso" (servicio)? ¿O se mantiene como partida mixta? El precio (85€) sugiere que incluye el material. |
| 19 | FON-MAN-SIF | Sustitución sifón bajo lavabo | ud | 45.00 | ⚪ REQUIERE REVISIÓN | ¿Es servicio puro (mano de obra de 45€) o incluye el sifón (~5-8€ en el mercado)? Si incluye el sifón, parte de ese 45€ es material. Afecta a si la familia Mantenimiento tiene algún componente de material comprable. |
| 20 | FON-GRF-LAR | Grifo lavadero/exterior 1/2" | ud | 18.50 | ⚪ REQUIERE REVISIÓN | El 1/2" es la conexión estándar para grifos exteriores. En el gc solo hay uno. ¿Es UP (la conexión 1/2" es el único calibre del mercado para este uso) o variante sin hermanos (podría haber 3/4" para jardín)? |

---

### VARIANTES propuestas (13 registros)

Ordenadas por UP padre propuesto.

**Familia Tubería:**

| # | codigo | descripcion | unidad | precio_ref | UP padre propuesto | Atributo variante |
|---|--------|-------------|--------|-----------|-------------------|------------------|
| 21 | FON-CU-015 | Tubo cobre 15mm (por metro) | ml | 3.20 | "Tubo cobre" | diámetro: 15mm |
| 22 | FON-CU-022 | Tubo cobre 22mm (por metro) | ml | 5.80 | "Tubo cobre" | diámetro: 22mm |
| 23 | FON-MC-016 | Tubo multicapa 16x2mm (por metro) | ml | 1.85 | "Tubo multicapa" | diámetro: 16x2mm |
| 24 | FON-PE-20 | Tubo PE-100 20mm (por metro) | ml | 0.85 | "Tubo PE-100" | diámetro: 20mm |
| 25 | FON-PVC-20 | Tubo PVC presión 20mm (por metro) | ml | 0.95 | "Tubo PVC presión" | diámetro: 20mm |
| 26 | FON-PVC-S110 | Tubo PVC saneamiento 110mm | ml | 5.20 | "Tubo PVC saneamiento" | diámetro: 110mm |

**Familia Accesorios:**

| # | codigo | descripcion | unidad | precio_ref | UP padre propuesto | Atributo variante |
|---|--------|-------------|--------|-----------|-------------------|------------------|
| 27 | FON-ACC-C15T | Codo 90° cobre 15mm | ud | 1.80 | "Codo 90° cobre" | diámetro: 15mm |
| 28 | FON-ACC-C22T | Codo 90° cobre 22mm | ud | 3.20 | "Codo 90° cobre" | diámetro: 22mm |
| 29 | FON-ACC-T15 | Té cobre 15mm igual | ud | 2.40 | "Té cobre" | diámetro: 15mm |

**Familia Válvulas:**

| # | codigo | descripcion | unidad | precio_ref | UP padre propuesto | Atributo variante |
|---|--------|-------------|--------|-----------|-------------------|------------------|
| 30 | FON-VAL-ESF15 | Válvula esférica 1/2" latón | ud | 6.50 | "Válvula esférica latón" | conexión: 1/2" |
| 31 | FON-VAL-ESF22 | Válvula esférica 3/4" latón | ud | 9.80 | "Válvula esférica latón" | conexión: 3/4" |

**Familia Sanitarios:**

| # | codigo | descripcion | unidad | precio_ref | UP padre propuesto | Atributo variante |
|---|--------|-------------|--------|-----------|-------------------|------------------|
| 32 | FON-SAN-DUC-P | Plato ducha 80x80cm resina | ud | 130.00 | "Plato ducha resina" | dimensiones: 80×80cm |
| 33 | FON-SAN-DUC-P90 | Plato ducha 90x90cm resina | ud | 155.00 | "Plato ducha resina" | dimensiones: 90×90cm |

---

### PRODUCTOS UNIVERSALES propuestos (5 registros)

| # | codigo | descripcion | unidad | precio_ref | nombre_canonico propuesto | categoria | Motivo |
|---|--------|-------------|--------|-----------|--------------------------|-----------|--------|
| 34 | FON-GRF-LAV | Grifo monomando lavabo alto brillo | ud | 45.00 | Grifo monomando lavabo | font-griferias | Único grifo de lavabo monomando estándar en el gc |
| 35 | FON-GRF-BAN | Grifo bañera monomando | ud | 85.00 | Grifo monomando bañera | font-griferias | Único de este tipo |
| 36 | FON-GRF-COC | Grifo monomando cocina alto | ud | 55.00 | Grifo monomando cocina alto | font-griferias | Único de este tipo |
| 37 | FON-GRF-TER-DUC | Kit ducha termostático | ud | 120.00 | Kit ducha termostático | font-griferias | Función diferente al monomando; único de este tipo |
| 38 | FON-SAN-WC-S | Inodoro suspendido con cisterna | ud | 320.00 | Inodoro suspendido con cisterna | font-sanitarios | Único inodoro suspendido completo |

---

### CASOS DUDOSOS — REQUIERE REVISIÓN — Productos (2 registros)

| # | codigo | descripcion | unidad | precio_ref | Pregunta abierta |
|---|--------|-------------|--------|-----------|-----------------|
| 39 | FON-VAL-SEG | Válvula de seguridad 3/4" 3bar | ud | 12.90 | Solo aparece una referencia de este tipo. ¿Es UP directo (el 3/4" y 3bar son los estándares del mercado para termos) o hay que crear el UP "Válvula de seguridad" y esta es una variante sin hermanos en el gc? |
| 40 | FON-SAN-DUC-PX | Plato ducha 100x70cm extra plano | ud | 195.00 | Diferente material implícito (extra plano = piedra o Krion, no resina) y forma rectangular ≠ cuadrado. ¿Es variante de "Plato ducha resina" (erróneo: material diferente) o UP propio "Plato ducha extra plano"? El precio (195€ vs 130–155€ para resina) refuerza que es un producto distinto. |

---

## Parte 3 — UPs propuestos (para aprobación antes de crear)

### UPs padre necesarios para las variantes del piloto

| UP padre propuesto | Categoría | Variantes en el gc total | Variantes en el piloto |
|-------------------|-----------|------------------------|----------------------|
| Tubo cobre | font-tuberias | 6 (15, 18, 22, 28, 35, 42mm) | 2 (15, 22mm) |
| Tubo multicapa | font-tuberias | 4 (16, 20, 25, 32mm) | 1 (16mm) |
| Tubo PE-100 | font-tuberias | 5 (20, 25, 32, 40, 50mm) | 1 (20mm) |
| Tubo PVC presión | font-tuberias | 5 (20, 25, 32, 40, 50mm) | 1 (20mm) |
| Tubo PVC saneamiento | font-desague | 7 (32, 40, 50, 75, 110, 125, 160mm) | 1 (110mm) |
| Codo 90° cobre | font-tuberias | 2 (15, 22mm) | 2 (15, 22mm) |
| Té cobre | font-tuberias | 2 (15, 22mm) | 1 (15mm) |
| Válvula esférica latón | font-tuberias | 3 (1/2", 3/4", 1") | 2 (1/2", 3/4") |
| Plato ducha resina | font-sanitarios | 2 (80x80, 90x90) | 2 (80x80, 90x90) |

### UPs directos del piloto

| nombre_canonico | Categoría | global_catalog_id |
|----------------|-----------|------------------|
| Grifo monomando lavabo | font-griferias | FON-GRF-LAV |
| Grifo monomando bañera | font-griferias | FON-GRF-BAN |
| Grifo monomando cocina alto | font-griferias | FON-GRF-COC |
| Kit ducha termostático | font-griferias | FON-GRF-TER-DUC |
| Inodoro suspendido con cisterna | font-sanitarios | FON-SAN-WC-S |

**Total UPs que se crearían al aprobar el piloto:** 9 UPs padre + 5 UPs directos = **14 UPs**  
**Total variantes que se crearían:** 13 variantes (vinculadas a los 9 UPs padre)  
**Clasificados como PARTIDA NC (no se crean UPs):** 17 registros  
**Pendientes de decisión humana (REQUIERE REVISIÓN):** 5 registros  
**Registros del piloto sin clasificar:** 1 (FON-GRF-LAR — grifo lavadero)

---

## Parte 4 — Mapa familia → categoría (para el piloto)

| familia gc | Categoría Marketplace | slug | ¿Mapa exacto? |
|-----------|----------------------|------|--------------|
| Tubería | Tuberías y Uniones | font-tuberias | ✅ Exacto |
| Accesorios | Tuberías y Uniones | font-tuberias | ✅ Correcto (accesorios = uniones) |
| Válvulas | Tuberías y Uniones | font-tuberias | ✅ Correcto (válvulas = control de tubería) |
| Saneamiento | Desagüe y Saneamiento | font-desague | ✅ Exacto |
| Grifería | Griferías | font-griferias | ✅ Exacto |
| Sanitarios | Sanitarios | font-sanitarios | ✅ Exacto |
| Equipos ACS | Calefacción | font-calefaccion | ⚠️ Aproximado — "Calefacción" no es sinónimo de ACS. Los termos, aerotermos y calentadores son equipos de agua caliente sanitaria, no de calefacción. No existe categoría "Equipos ACS" en el árbol actual. |
| Instalaciones | N/A | N/A | ❌ Partida no comercial |
| Mantenimiento | N/A | N/A | ❌ Partida no comercial |
| Mano de obra | N/A | N/A | ❌ Partida no comercial |

**Categoría vacía tras el piloto:** `Herramientas Fontanería` (font-herramientas).  
El gc de fontanería no contiene ninguna fila con familia "Herramientas". Esa categoría del Marketplace no tendrá contenido desde este catálogo.

---

## Parte 5 — Duplicados detectados

**En el lote seleccionado:** ninguno confirmado.

**Caso potencial no incluido en el piloto:**
- `FON-GRF-DUC` ("Kit ducha monomando c/teleducha", 65€) vs `FON-GRF-TER-DUC` ("Kit ducha termostático", 120€): descripciones similares pero funciones distintas (monomando vs termostático). **No son duplicados** — son dos UPs diferentes.

---

## Parte 6 — Resumen cuantitativo del piloto

| Clasificación | Registros en piloto | % del piloto | % estimado del total gc fontanería |
|--------------|--------------------:|:---:|:---:|
| 🔴 Partida no comercial | 17 | 42.5% | ~19% (19/101) |
| 🔵 Variante | 13 | 32.5% | estimado ~50% |
| 🟢 Producto universal | 5 | 12.5% | estimado ~20% |
| ⚪ Requiere revisión | 5 | 12.5% | estimado ~10% |
| 🟡 Duplicado | 0 | 0% | estimado ~1% |
| **Total** | **40** | **100%** | — |

> ⚠️ **Observación importante sobre la proporción real del catálogo:**
>
> Las familias `Mano de obra` (5), `Instalaciones` (8) y `Mantenimiento` (6) suman **19 de 101 registros = 18.8%** del catálogo de fontanería. Estos son 100% partidas no comerciales.
>
> La familia `Tubería` (20 registros) y `Accesorios` (12 registros) son prácticamente 100% variantes.
>
> Esto significa que el catálogo de fontanería tiene ~30% de registros que no generarán UPs pero sí alimentan el Motor IA (presupuestos).

---

## Parte 7 — Riesgos identificados

| # | Riesgo | Impacto | Observación |
|---|--------|---------|------------|
| R1 | La categoría "Equipos ACS" no existe — los 13 registros de termos, calentadores y aerotermos no tienen categoría exacta | Medio | El mapa familia → categoría necesita o una nueva categoría "Equipos ACS" o aceptar el mapa aproximado a "Calefacción". Esta decisión afecta a ~13% del catálogo de fontanería y a oficios enteros (Calefacción: 42 registros en gc también mezclan ACS y calefacción). |
| R2 | La categoría "Herramientas Fontanería" quedará vacía | Bajo | El gc no tiene herramientas de fontanería como categoría propia. Se puede mantener la categoría para uso futuro o eliminarla del árbol. |
| R3 | Las 5 "Requiere revisión" bloquean la decisión de 5 registros | Bajo | Son preguntas simples que requieren 5 decisiones humanas, no trabajo técnico. |
| R4 | Los UPs padre (e.g., "Tubo cobre") son muy genéricos sin marca | Bajo | Es intencional: son UPs genéricos. Los proveedores ofertan sus versiones de marca como offerings vinculadas al UP. |
| R5 | Las 213 offerings existentes de OBRAMAT Demo tienen descripciones diferentes a los nombres canónicos de los UPs propuestos | Medio | El matching de esas offerings contra estos UPs necesitará revisión uno a uno (no matcheo automático). Por ejemplo: ¿"GRIFO MONO LAVABO BAÑO CROMO 35MM" en OBRAMAT matchea con UP "Grifo monomando lavabo"? Probablemente sí, pero hay que verificarlo. |
| R6 | Los 14 UPs que se crearían en el piloto cubren solo ~14% del catálogo de fontanería | Bajo | Es el objetivo del piloto: calidad sobre cantidad. Los 87 registros restantes de fontanería se clasifican en una segunda iteración. |
| R7 | El código del gc no tiene EAN real — los UPs creados tampoco tendrán EAN | Bajo | Sin EAN, el matching con offerings es por texto + oficio/familia. Esto es aceptable para el piloto. Los EANs reales vendrán de los proveedores cuando suban sus catálogos. |

---

## Parte 8 — Preguntas para aprobación humana

Las siguientes decisiones no pueden tomarse sin criterio del responsable del catálogo:

**Decisiones de clasificación (5 registros):**

1. `FON-INS-LLAVE` — "Llave de paso nueva + instalación":
   - Opción A: PARTIDA NC (el conjunto se cobra como trabajo)
   - Opción B: Dividir en UP "Válvula de paso" (material) + partida "Instalación de llave" (trabajo)

2. `FON-MAN-SIF` — "Sustitución sifón bajo lavabo":
   - Opción A: PARTIDA NC (el precio incluye material + trabajo, se trata como servicio)
   - Opción B: REQUIERE REVISIÓN (hay un sifón comprable implícito)

3. `FON-GRF-LAR` — "Grifo lavadero/exterior 1/2\"":
   - Opción A: PRODUCTO UNIVERSAL (1/2" es el estándar, no hay otras medidas)
   - Opción B: VARIANTE de UP "Grifo lavadero/exterior" (aunque no haya más calibres en el gc)

4. `FON-VAL-SEG` — "Válvula de seguridad 3/4\" 3bar":
   - Opción A: PRODUCTO UNIVERSAL (estándar para termos eléctricos, no hay más variantes en el gc)
   - Opción B: VARIANTE del UP "Válvula de seguridad" (aunque sea el único calibre en el gc)

5. `FON-SAN-DUC-PX` — "Plato ducha 100x70cm extra plano":
   - Opción A: VARIANTE de "Plato ducha resina" (mismo tipo, diferente tamaño y material)
   - Opción B: PRODUCTO UNIVERSAL propio "Plato ducha extra plano" (material diferente, forma rectangular)
   - **Recomendación:** Opción B — el precio (195€ vs 130–155€) y el material distinto justifican un UP propio.

**Decisión de arquitectura del catálogo (1 decisión):**

6. Familia "Equipos ACS" (13 registros: termos, calentadores, aerotermos, grupos de presión, vasos de expansión):
   - Opción A: Mapear a categoría "Calefacción" (font-calefaccion) — impreciso pero funcional
   - Opción B: Crear nueva categoría "Equipos ACS" en el árbol de categorías del Marketplace
   - **Implicación de Opción B:** Requiere INSERT en trade_marketplace_categories (migración de datos pequeña, no de código)

---

## Conclusión del análisis del piloto

El catálogo de fontanería es más complejo de lo que sugiere el conteo de 101 registros:

- **~19% son partidas no comerciales** (mano de obra, instalaciones, mantenimiento) — correctas para presupuestos, excluidas del Marketplace.
- **~50–55% son variantes** — requieren crear UPs padre antes de poder registrarlas.
- **~20% son productos universales directos** — los más simples de crear.
- **~5–10% requieren una decisión humana previa** — no se pueden clasificar automáticamente.

El piloto de 40 registros genera **14 UPs propuestos** y **13 variantes**, con **5 preguntas abiertas** que necesitan respuesta antes de poder crear esos UPs.

**Siguiente paso tras aprobación:** Crear en producción los 9 UPs padre + 5 UPs directos del piloto, sus 13 variantes, y asignar category_id a los 5 UPs directos. Estimado: 1–2 horas de trabajo en SQL bajo supervisión.

---

*Análisis completado 2026-08-01 · Solo lectura · Sin modificaciones de datos*  
*Basado en los 101 registros reales de trade_global_catalog WHERE oficio = 'Fontanería'*
