# Sistema de Validación del Motor IA — Diseño Metodológico
## TrabFlow Technologies · Documento Técnico BM-2026-001

**Versión:** 1.0  
**Fecha:** 2026-07-07  
**Clasificación:** Uso interno / Anexo técnico para memorias de financiación  
**Aplicable a:** CDTI, ENISA, SODERCAN, Horizonte Europa, EIC Accelerator

---

## Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura del Sistema de Benchmark](#2-arquitectura-del-sistema-de-benchmark)
3. [Taxonomía](#3-taxonomía)
4. [Especificaciones de Benchmark](#4-especificaciones-de-benchmark)
5. [Protocolo Científico de Validación](#5-protocolo-científico-de-validación)
6. [Sistema de Puntuación](#6-sistema-de-puntuación)
7. [Métricas](#7-métricas)
8. [Protocolo de Evolución e Inmutabilidad](#8-protocolo-de-evolución-e-inmutabilidad)
9. [Distribución del Gold Dataset](#9-distribución-del-gold-dataset)
10. [Roadmap del Benchmark](#10-roadmap-del-benchmark)
11. [Comparativa con Benchmarks de Referencia Internacional](#11-comparativa-con-benchmarks-de-referencia-internacional)

---

## 1. Resumen Ejecutivo

TrabFlow Technologies desarrolla un motor de Inteligencia Artificial especializado en la generación automática de presupuestos técnicos para el sector de la instalación y construcción en España. El motor convierte descripciones en lenguaje natural — tanto escritas como transcritas de voz — en documentos de presupuesto estructurados con partidas, unidades y precios.

El presente documento define el **Sistema Oficial de Validación (SOV)**, un conjunto de benchmarks jerarquizados, metodología de evaluación reproducible y protocolo de evolución controlada, diseñados para:

- Demostrar el rendimiento del motor con rigor científico ante organismos de financiación pública y privada.
- Proporcionar una línea base inmutable contra la que comparar cada nueva versión del motor.
- Medir la mejora incremental de forma cuantificable y estadísticamente interpretable.
- Cubrir la totalidad de la casuística real de uso del sistema en producción.

El sistema está estructurado en cuatro niveles de benchmark:

| Nivel | Denominación | Consultas | Estado |
|---|---|---|---|
| BM-v60 | Benchmark de Referencia | 400 | **Congelado** (referencia histórica) |
| BM-v61 | Benchmark Extendido | 800 | En diseño |
| BM-v62 | Benchmark de Robustez | 1.500 | En diseño |
| BM-GD | Gold Dataset | ~2.000 | Objetivo final |

---

## 2. Arquitectura del Sistema de Benchmark

### 2.1 Principios de Diseño

El sistema se basa en seis principios fundamentales derivados de las mejores prácticas en evaluación de sistemas de IA de dominio especializado:

**P1 — Inmutabilidad.** Una vez publicado, ningún benchmark puede ser modificado. Los benchmarks solo pueden ampliarse mediante versiones sucesoras. Este principio garantiza la comparabilidad longitudinal y elimina el sesgo de retroajuste (*benchmark leakage*).

**P2 — Cobertura exhaustiva.** El benchmark debe cubrir la totalidad del espacio de entrada del sistema: todos los oficios, todos los niveles de complejidad lingüística, todos los mecanismos de recuperación del motor. Un benchmark que solo evalúa casos favorables no es científicamente válido.

**P3 — Representatividad.** La distribución de consultas debe reflejar la distribución observada en producción, ponderada para garantizar cobertura mínima en segmentos de baja frecuencia con alto impacto de fallo.

**P4 — Reproducibilidad.** Cada consulta tiene un identificador único, texto invariable y respuesta de referencia documentada. Cualquier laboratorio externo debe poder reproducir la evaluación con los mismos resultados.

**P5 — Independencia.** El equipo que diseña el benchmark es independiente del equipo que diseña el motor. Ninguna consulta del benchmark puede haber sido utilizada en el entrenamiento o ajuste del modelo subyacente.

**P6 — Gradualidad controlada.** Cada nueva versión del benchmark incrementa la dificultad de forma medida. No se introduce un nuevo nivel de dificultad sin haber validado primero el nivel anterior.

### 2.2 Jerarquía y Relación entre Niveles

```
BM-v60 (400) — Referencia congelada
    │
    ├── BM-v61 (800) — Superset de v60 + 400 consultas nuevas
    │       │
    │       └── BM-v62 (1.500) — Superset de v61 + 700 consultas nuevas
    │               │
    │               └── BM-GD (≈2.000) — Gold Dataset definitivo
    │                       Superset de v62 + ampliación hasta equilibrio de oficios
```

Cada benchmark sucede al anterior en un sentido estricto de superseting: las consultas del nivel N están íntegramente contenidas en el nivel N+1. Esto permite comparar rendimiento en el subconjunto común y en el total por separado.

### 2.3 Dimensiones de Evaluación

Cada consulta del benchmark se evalúa simultáneamente en cinco dimensiones independientes:

```
Consulta
  │
  ├── D1: Generación     → ¿Se produce un presupuesto válido?
  ├── D2: Estructura     → ¿Las partidas son correctas y completas?
  ├── D3: Precio         → ¿Los precios están dentro del rango de referencia?
  ├── D4: Latencia       → ¿El tiempo de respuesta es aceptable?
  └── D5: Estabilidad    → ¿La respuesta es consistente ante variantes?
```

---

## 3. Taxonomía

### 3.1 Taxonomía de Oficios

El Gold Dataset cubre **20 oficios** del sector instalaciones y construcción en España:

| ID | Oficio | Ámbito |
|---|---|---|
| OF-01 | Electricidad | Instalaciones eléctricas BT |
| OF-02 | Fontanería | Instalaciones de agua y saneamiento |
| OF-03 | Climatización / HVAC | Aire acondicionado, ventilación |
| OF-04 | Calefacción | Calderas, radiadores, suelo radiante |
| OF-05 | Gas | Instalaciones y aparatos de gas |
| OF-06 | Carpintería | Puertas, ventanas de madera, armarios |
| OF-07 | Albañilería y Obras | Tabiques, enfoscados, demoliciones |
| OF-08 | Pintura y Decoración | Interior, exterior, decorativo |
| OF-09 | Cerrajería | Cerraduras, puertas de seguridad, rejas |
| OF-10 | Suelos y Pavimentos | Parquet, tarima, baldosas, microcemento |
| OF-11 | Alicatado y Revestimientos | Azulejos, gresite, piedra natural |
| OF-12 | Impermeabilización | Cubiertas, terrazas, sótanos |
| OF-13 | Aislamiento Térmico y Acústico | SATE, cámaras, tejados |
| OF-14 | Energía Solar / Fotovoltaica | Paneles, baterías, autoconsumo |
| OF-15 | Telecomunicaciones | Antenas, fibra, redes LAN, ICT |
| OF-16 | Seguridad y Alarmas | CCTV, acceso, sensores |
| OF-17 | Carpintería de Aluminio y PVC | Ventanas, persianas, fachadas |
| OF-18 | Jardinería y Paisajismo | Césped, riego, diseño, podas |
| OF-19 | Piscinas | Construcción, mantenimiento, reforma |
| OF-20 | Reformas Integrales | Baños, cocinas, pisos, locales |

### 3.2 Taxonomía de Categorías por Oficio

Para cada oficio se definen entre 6 y 10 categorías temáticas. Cada categoría agrupa consultas con un núcleo conceptual común.

#### OF-01 — Electricidad

| CAT | Categoría | Ejemplos de trabajo |
|---|---|---|
| E-01 | Enchufes y mecanismos | Enchufes, interruptores, bases de corriente |
| E-02 | Cuadros eléctricos | ICP, diferencial, magnetotérmicos, RCD |
| E-03 | Iluminación general | Puntos de luz, fluorescentes, downlights |
| E-04 | Iluminación LED | Tiras LED, focos, retrofit, driver |
| E-05 | Averías y diagnóstico | Cortocircuitos, tierra, identificación de fallo |
| E-06 | Boletines y certificados | BIE, certificado instalador, inspección OCA |
| E-07 | Instalación nueva | Obra nueva, local comercial, nave |
| E-08 | Puntos de recarga EV | EVSE, Wallbox, cargador tipo 2 |
| E-09 | Domótica | KNX, Zigbee, persiana automatizada, termostato |

#### OF-02 — Fontanería

| CAT | Categoría | Ejemplos de trabajo |
|---|---|---|
| F-01 | Grifería | Grifo monomando, termostático, alcachofa |
| F-02 | Tuberías y bajantes | PVC, multicapa, cobre, desagüe |
| F-03 | Sanitarios | Inodoro, lavabo, plato de ducha, bañera |
| F-04 | Termos y acumuladores | Eléctrico, a gas, solar, bomba de calor |
| F-05 | Fugas y averías | Detección, reparación, sectorización |
| F-06 | Instalación nueva | Cocina, baño, local, obra nueva |
| F-07 | Filtros y tratamiento de agua | Osmosis, descalcificador, filtro de sedimentos |
| F-08 | Redes de incendio | BIE, sprinklers, presurización |

#### OF-03 — Climatización / HVAC

| CAT | Categoría |
|---|---|
| C-01 | Split 1×1 residencial |
| C-02 | Multi-split |
| C-03 | VRV / VRF industrial |
| C-04 | Conductos y difusores |
| C-05 | Mantenimiento preventivo |
| C-06 | Averías y diagnóstico |
| C-07 | Ventilación mecánica VMC |
| C-08 | Recuperador de calor |

#### OF-04 — Calefacción

| CAT | Categoría |
|---|---|
| K-01 | Caldera de gas |
| K-02 | Caldera de gasoil |
| K-03 | Bomba de calor aerotérmica |
| K-04 | Radiadores |
| K-05 | Suelo radiante |
| K-06 | Mantenimiento |
| K-07 | Averías |

#### OF-05 — Gas

| CAT | Categoría |
|---|---|
| G-01 | Instalación de gas natural |
| G-02 | Instalación de GLP / propano |
| G-03 | Aparatos de gas (cocina, calentador) |
| G-04 | Fugas y emergencias |
| G-05 | Boletín de gas / certificado |
| G-06 | Conversión gas natural ↔ GLP |

#### OF-06 — Carpintería

| CAT | Categoría |
|---|---|
| W-01 | Puertas de interior |
| W-02 | Puertas de entrada |
| W-03 | Armarios a medida |
| W-04 | Parquet y tarima de madera |
| W-05 | Escaleras |
| W-06 | Restauración y lacado |

*(Las tablas de categorías para OF-07 a OF-20 seguirán el mismo patrón. El catálogo completo de categorías se desarrolla en el documento de corpus BM-CAT-2026-001, fase de generación.)*

### 3.3 Niveles de Dificultad

El sistema define **seis niveles de dificultad** para cada consulta, basados en la complejidad lingüística, técnica y la ambigüedad de intención:

| Nivel | Denominación | Definición | Ejemplo |
|---|---|---|---|
| N1 | **Simple** | Solicitud directa, una acción, vocabulario técnico correcto | *"Cambiar un enchufe"* |
| N2 | **Normal** | Solicitud directa, puede incluir cantidad o localización | *"Cambiar tres enchufes en la cocina"* |
| N3 | **Complejo** | Múltiples actuaciones o partidas, alcance detallado | *"Cuadro eléctrico completo con diferencial y seis magnetotérmicos"* |
| N4 | **Ambiguo** | Intención no unívoca, requiere inferencia del contexto | *"Desde ayer salta la luz"* |
| N5 | **Coloquial** | Vocabulario no técnico, expresiones regionales, argot | *"Se me ha ido la corriente cuando pongo el horno"* |
| N6 | **Voz transcrita** | Transcripción de voz: disfluencias, repeticiones, fragmentación | *"Hola mira que necesito que vengas porque el cuadro hace un ruido raro y a veces se va la luz..."* |

**Distribución objetivo por nivel en el Gold Dataset:**

| Nivel | % objetivo | Consultas estimadas |
|---|---|---|
| N1 — Simple | 15% | ~300 |
| N2 — Normal | 25% | ~500 |
| N3 — Complejo | 20% | ~400 |
| N4 — Ambiguo | 15% | ~300 |
| N5 — Coloquial | 15% | ~300 |
| N6 — Voz transcrita | 10% | ~200 |
| **Total** | **100%** | **~2.000** |

### 3.4 Mecanismos IA Evaluados

Cada consulta del benchmark etiqueta los **mecanismos del motor** que pone a prueba. Una consulta puede activar uno o múltiples mecanismos simultáneamente.

| Código | Mecanismo | Descripción |
|---|---|---|
| M01 | Clasificación de oficio | El motor debe identificar el oficio correcto |
| M02 | Clasificación de actuación | El motor debe mapear a una actuación del catálogo |
| M03 | Recuperación semántica (Base Maestra) | El motor debe encontrar la actuación en kbContext |
| M04 | Resolución de sinónimos | El usuario usa terminología alternativa |
| M05 | Fallback a sugeridas | No hay match en catálogo; el motor genera partidas propias |
| M06 | Actuaciones múltiples | Una consulta contiene ≥2 trabajos distintos |
| M07 | Extracción de cantidad | El motor debe identificar la magnitud del trabajo |
| M08 | Inferencia de localización | El motor infiere superficie/ubicación del contexto |
| M09 | Manejo de ambigüedad | El motor debe seleccionar la interpretación más probable |
| M10 | Lenguaje coloquial / argot | El motor debe traducir a terminología técnica |
| M11 | Voz con disfluencias | El motor gestiona transcripciones ruidosas |
| M12 | Consulta incompleta | El motor completa la información faltante con defaults |
| M13 | Comparación de proveedores | El motor incorpora precios de proveedores externos |
| M14 | Reforma compleja multidisciplinar | El trabajo abarca varios oficios |
| M15 | Detección de contrato de mantenimiento | La consulta implica un contrato, no un presupuesto puntual |

### 3.5 Tipología Lingüística

Adicionalmente, cada consulta lleva una etiqueta de tipología lingüística:

| Código | Tipología | Descripción |
|---|---|---|
| L1 | Técnico formal | Vocabulario técnico correcto, sintaxis estándar |
| L2 | Técnico informal | Vocabulario técnico, sintaxis relajada |
| L3 | Coloquial estándar | Sin vocabulario técnico, castellano neutro |
| L4 | Coloquial regional | Expresiones regionales (castellano de España) |
| L5 | Con errores ortográficos | Errores tipográficos y ortográficos habituales |
| L6 | Voz transcrita limpia | Transcripción de voz fluida |
| L7 | Voz transcrita con ruido | Transcripción con disfluencias, muletillas, fragmentación |
| L8 | Multiidioma | Mezcla español + términos técnicos en inglés o catalán |

---

## 4. Especificaciones de Benchmark

### 4.1 BM-v60 — Benchmark de Referencia (CONGELADO)

| Parámetro | Valor |
|---|---|
| Consultas totales | 400 |
| Fecha de ejecución | 2026-07-04 |
| Motor evaluado | v59 (Edge Function v65) |
| Resultado — Tasa de Generación | **98,25%** (393/400) |
| Resultado — Cobertura de Catálogo | 92,5% (370/400) |
| TRUNCADO | 0 |
| VACÍO | 1 (excepción documentada) |
| ERROR_TECNICO | 6 (4 transitorios HTTP 503, 2 esperados HTTP 403) |
| Estado | **Congelado. No puede modificarse.** |

Este benchmark constituye la línea base absoluta del proyecto. Toda comparación de versiones futuras incluirá obligatoriamente los resultados sobre BM-v60.

### 4.2 BM-v61 — Benchmark Extendido (800 consultas)

**Objetivo:** Duplicar la cobertura del BM-v60 incorporando variedad lingüística, dificultad incrementada y casos límite no presentes en el benchmark de referencia.

**Composición:**
- 400 consultas de BM-v60 (mantenidas íntegramente)
- 400 consultas nuevas distribuidas según:

| Dimensión de ampliación | Consultas nuevas |
|---|---|
| Variedad lingüística (L3–L8) | 80 |
| Niveles de dificultad N4–N6 | 80 |
| Casos ambiguos con múltiples interpretaciones válidas | 40 |
| Errores habituales de instaladores (L5) | 40 |
| Múltiples formas de pedir el mismo trabajo (sinónimos) | 60 |
| Cobertura de mecanismos M09–M15 (hasta ahora poco representados) | 60 |
| Nuevos oficios con baja representación en v60 | 40 |
| **Total nuevas** | **400** |

**Criterios de diseño específicos:**

- Cada actuación del catálogo de actuaciones maestro debe aparecer al menos 2 veces.
- Al menos 30 consultas deben activar el mecanismo M06 (actuaciones múltiples).
- Al menos 20 consultas deben representar errores ortográficos frecuentes (M10+L5).
- Al menos 15 consultas de N6 (voz transcrita) deben incluir disfluencias reales.
- Ninguna consulta nueva puede ser una paráfrasis trivial de otra ya existente.

### 4.3 BM-v62 — Benchmark de Robustez (1.500 consultas)

**Objetivo:** Validar la robustez, generalización y estabilidad del motor ante la distribución completa de la casuística real, incluyendo casos extremos y distribuciones de cola larga.

**Composición:**
- 800 consultas de BM-v61 (mantenidas íntegramente)
- 700 consultas nuevas distribuidas según:

| Dimensión de ampliación | Consultas nuevas |
|---|---|
| Consultas muy cortas (1–5 palabras) | 50 |
| Consultas muy largas (>100 palabras) | 50 |
| Consultas por voz transcrita (L6+L7) | 100 |
| Consultas con errores ortográficos (L5) | 80 |
| Consultas con lenguaje coloquial extremo (L4) | 80 |
| Consultas técnicas altamente especializadas (N3+L1) | 80 |
| Consultas incompletas que requieren inferencia (M12) | 60 |
| Consultas con varias actuaciones (M06) | 60 |
| Consultas de dificultad muy alta (N4+N5+N6 combinados) | 80 |
| Consultas de nuevas regiones o tipologías no cubiertas | 60 |
| **Total nuevas** | **700** |

**Propiedades estadísticas objetivo:**

- Test de distribución de Kolmogorov-Smirnov entre distribución de consultas de benchmark y distribución observada en producción: p > 0,05.
- Coeficiente de variación de la tasa de generación entre niveles de dificultad: CV < 15%.
- Ningún oficio con representación < 3% del total.

### 4.4 BM-GD — Gold Dataset (≈2.000 consultas)

**Objetivo:** Benchmark definitivo del proyecto. Representación exhaustiva, equilibrada y científicamente rigurosa de todo el espacio de entrada del motor.

**Criterios de inclusión:**

1. **No trivialidad:** Cada consulta aporta información nueva sobre el comportamiento del motor que no puede inferirse de otras consultas del dataset.
2. **Equilibrio de oficios:** Cada uno de los 20 oficios tiene entre 90 y 110 consultas (tolerancia ±10%).
3. **Cobertura de categorías:** Cada categoría de cada oficio tiene al menos 5 consultas.
4. **Cobertura de niveles:** Cada oficio tiene consultas en los 6 niveles de dificultad.
5. **Cobertura de mecanismos:** Los 15 mecanismos IA están representados con al menos 20 consultas cada uno.
6. **Cobertura lingüística:** Las 8 tipologías lingüísticas están representadas con al menos 50 consultas cada una.

**Composición estimada:**

| Bloque | Consultas |
|---|---|
| Núcleo BM-v62 | 1.500 |
| Ampliación hasta equilibrio de oficios | ~300 |
| Cobertura de categorías faltantes | ~100 |
| Consultas de validación cruzada | ~100 |
| **Total** | **≈2.000** |

---

## 5. Protocolo Científico de Validación

### 5.1 Definición Formal de Respuesta

Para cada consulta `q_i` del benchmark, el motor produce una respuesta `r_i`. Se define la siguiente taxonomía de respuestas:

#### Clase A — CORRECTO (respuesta válida con precios de catálogo)

`r_i ∈ {OK_CATALOGO, OK_MIXTO}`

Condiciones necesarias y suficientes:
- La respuesta contiene al menos una partida (`partidas.length ≥ 1`).
- Al menos una partida tiene `origen ∈ {catalogo, mixto}`.
- `precio_unitario > 0` para todas las partidas con `origen = catalogo`.
- `stop_reason = "end_turn"`.
- La respuesta es parseable como JSON válido.

#### Clase B — GENERADO SIN PRECIO (respuesta válida sin precios de catálogo)

`r_i ∈ {SOLO_SUGERIDAS}`

Condiciones necesarias y suficientes:
- La respuesta contiene al menos una partida (`partidas.length ≥ 1`).
- Todas las partidas tienen `origen = "sugerida_ia"` o `precio_unitario = 0`.
- `stop_reason = "end_turn"`.
- La respuesta es parseable como JSON válido.

*Nota: SOLO_SUGERIDAS es un resultado válido del motor. El instalador puede completar los precios desde su catálogo externo; TradeFlow aprende de esa interacción. No es un fallo del motor, sino un gap del catálogo.*

#### Clase C — FALLO RECUPERABLE

`r_i ∈ {PRECIO_INVALIDO}`

Condiciones:
- La respuesta tiene estructura correcta pero contiene precios inválidos (`precio_unitario < 0` o no numérico).
- El motor ha generado el trabajo pero con datos de precio corruptos.

#### Clase D — FALLO IRRECUPERABLE

`r_i ∈ {VACÍO, TRUNCADO, ERROR_TECNICO}`

- **VACÍO:** La respuesta contiene 0 partidas o el array `partidas` está vacío.
- **TRUNCADO:** `stop_reason = "max_tokens"`. El modelo ha alcanzado el límite y la respuesta está incompleta.
- **ERROR_TECNICO:** Error HTTP 5xx, timeout, o respuesta no parseable.

### 5.2 Definición Formal de Respuesta Parcialmente Correcta

Para el cálculo de métricas de estructura y precio se requiere una evaluación más granular.

Dado un conjunto de partidas esperadas `P_ref = {p_1, ..., p_n}` (anotadas en el benchmark) y un conjunto de partidas generadas `P_gen = {g_1, ..., g_m}`:

**Partida correcta:** `g_j` es considerada correcta si existe `p_k ∈ P_ref` tal que:
- La descripción semántica coincide (similitud coseno > 0,85, o match exacto en código de actuación).
- La unidad de medida es compatible (`ud`, `m²`, `ml`, `h` → según tipo de actuación).

**Partida parcialmente correcta:** La descripción coincide pero la unidad difiere o el precio está fuera del rango de referencia en más de un 30%.

**Partida incorrecta:** No existe `p_k ∈ P_ref` que satisfaga las condiciones anteriores.

### 5.3 Definición de Fallo a Efectos del Benchmark

A efectos del benchmark, se define **fallo** como cualquier respuesta de Clase C o D:

```
Fallo = PRECIO_INVALIDO ∪ VACÍO ∪ TRUNCADO ∪ ERROR_TECNICO
```

Los fallos de Clase D (irrecuperables) se subdividen para análisis:
- **Fallo sistémico:** Si la misma consulta produce fallo en ≥90% de las ejecuciones de repetición → indica problema estructural del motor.
- **Fallo transitorio:** Si la misma consulta produce fallo en <50% de las ejecuciones de repetición → indica problema de infraestructura (HTTP 503, timeout).

Los fallos transitorios se excluyen del cálculo de métricas de motor (se incluyen en métricas de infraestructura).

---

## 6. Sistema de Puntuación

### 6.1 Score por Consulta

Para cada consulta `q_i`, se calculan cinco scores dimensionales en el rango [0, 1]:

#### SD1 — Score de Generación

```
SD1(i) = 1  si  r_i ∈ Clase A ∪ Clase B
SD1(i) = 0  si  r_i ∈ Clase C ∪ Clase D
```

#### SD2 — Score de Estructura

```
SD2(i) = |P_correctas| / |P_ref|
```

Solo computable cuando `|P_ref| > 0` (consultas con respuesta de referencia anotada). Para consultas sin anotación de referencia, SD2 no se calcula.

#### SD3 — Score de Precio

Para cada partida correcta `g_j` con precio de referencia `precio_ref_j`:

```
SP_j = max(0, 1 - |precio_gen_j - precio_ref_j| / precio_ref_j)
SD3(i) = mean(SP_j) para todas las partidas correctas con precio de referencia
```

Solo computable cuando existen partidas con precio de referencia anotado.

#### SD4 — Score de Latencia

```
SD4(i) = 1              si  lat_i ≤ 20.000 ms
SD4(i) = 1 - (lat_i - 20.000) / 30.000    si  20.000 < lat_i ≤ 50.000 ms
SD4(i) = 0              si  lat_i > 50.000 ms
```

#### SD5 — Score de Estabilidad

Para consultas con variantes de paráfrasis `{q_i^1, q_i^2, ..., q_i^k}`:

```
SD5(i) = proporción de variantes con misma clase de respuesta (A, B, C, D) que q_i
```

Para consultas sin variantes documentadas, SD5 no se calcula.

### 6.2 Score Agregado por Consulta

```
Score(i) = 0,40 × SD1(i) + 0,30 × SD2(i) + 0,20 × SD3(i) + 0,10 × SD4(i)
```

*(SD5 se reporta de forma independiente como métrica de robustez, no entra en el score agregado.)*

Los pesos reflejan la prioridad del producto: lo más importante es que se genere un presupuesto (SD1), luego que sea estructuralmente correcto (SD2), luego que los precios sean precisos (SD3), y finalmente que sea rápido (SD4).

### 6.3 Score Global del Motor (SGM)

```
SGM = (1/N) × Σ Score(i)  para i = 1..N
```

El SGM es el indicador sintético oficial del rendimiento del motor sobre un benchmark dado.

---

## 7. Métricas

### 7.1 Métricas Primarias

Estas métricas son las que se reportan de forma oficial en documentación de financiación:

#### TG — Tasa de Generación (métrica de producto)

```
TG = (N_A + N_B) / N_total × 100
```

donde N_A = respuestas Clase A, N_B = respuestas Clase B.

*Interpretación: Porcentaje de consultas para las que el motor produce un presupuesto accionable.*

#### TCC — Tasa de Cobertura de Catálogo

```
TCC = N_A / N_total × 100
```

*Interpretación: Porcentaje de consultas resueltas con precios del catálogo TradeFlow.*

#### TF — Tasa de Fallo

```
TF = (N_C + N_D) / N_total × 100
```

*Interpretación: Porcentaje de consultas que no producen un presupuesto válido.*

#### TT — Tasa de Truncado (crítico)

```
TT = N_TRUNCADO / N_total × 100
```

*Interpretación: Porcentaje de respuestas incompletas por alcanzar el límite de tokens. Debe ser 0% en producción.*

### 7.2 Métricas Secundarias de Calidad

#### Recall de Partidas (RP)

Solo computable para consultas con anotación de referencia:

```
RP = Σ(|P_correctas_i|) / Σ(|P_ref_i|) × 100
```

*Interpretación: Porcentaje de partidas esperadas que el motor genera correctamente.*

#### Precisión de Partidas (PP)

```
PP = Σ(|P_correctas_i|) / Σ(|P_gen_i|) × 100
```

*Interpretación: Porcentaje de partidas generadas que son correctas (sin ruido).*

#### F1 de Partidas

```
F1 = 2 × (RP × PP) / (RP + PP)
```

#### Desviación Media de Precio (DMP)

Para partidas con precio de referencia:

```
DMP = mean(|precio_gen - precio_ref| / precio_ref) × 100  [%]
```

### 7.3 Métricas de Latencia

| Métrica | Definición | Umbral de alerta |
|---|---|---|
| Lat_P50 | Mediana de latencia end-to-end | > 15s |
| Lat_P95 | Percentil 95 de latencia | > 30s |
| Lat_P99 | Percentil 99 de latencia | > 45s |
| Lat_max | Máximo observado | > 60s |
| TokOut_P95 | Percentil 95 de tokens de salida | > 6.000 |
| TokOut_max | Máximo de tokens de salida | = 8.192 (límite absoluto) |

### 7.4 Métricas de Robustez

#### RP — Robustez Parafrástica

Para grupos de consultas que representan variantes del mismo trabajo:

```
RP = (Ngrupos con clasificación uniforme) / (Ngrupos_total) × 100
```

Umbral de aceptación: RP ≥ 85%.

#### RO — Robustez Ortográfica

Diferencia en TG entre consultas con errores ortográficos y sus equivalentes limpias:

```
RO_degradación = TG(L1) - TG(L5)  [pp]
```

Umbral de aceptación: degradación ≤ 5 puntos porcentuales.

#### RV — Robustez de Voz

```
RV_degradación = TG(L1+L2) - TG(L6+L7)  [pp]
```

Umbral de aceptación: degradación ≤ 10 puntos porcentuales.

### 7.5 Métricas de Cobertura

#### CS — Cobertura Semántica del Catálogo

```
CS = (Nconsultas con kbContext no vacío) / N_total × 100
```

*Interpretación: Porcentaje de consultas para las que el sistema encuentra al menos una actuación relevante en la Base Maestra.*

#### CO — Cobertura de Oficios

```
CO_oficio = TG_oficio / TG_global × 100  [índice relativo]
```

Un CO_oficio < 80 indica que ese oficio tiene rendimiento significativamente por debajo de la media.

### 7.6 Umbrales de Aceptación para Promoción RC → Producción

Toda versión candidata a producción debe superar, sobre BM-v61 o superior:

| Métrica | Umbral mínimo | Tipo |
|---|---|---|
| TG (Tasa de Generación) | ≥ 95,0% | **Obligatorio** |
| TF (Tasa de Fallo) | ≤ 3,0% | **Obligatorio** |
| TT (Tasa de Truncado) | = 0,0% | **Obligatorio** |
| Lat_P95 | ≤ 35s | Recomendado |
| RP (Robustez Parafrástica) | ≥ 85,0% | Recomendado |
| RO_degradación | ≤ 5 pp | Recomendado |
| N_VACÍO en 800 consultas | ≤ 8 | Recomendado |

Ninguna versión puede desplegarse a producción con TT > 0 o TG < 95%.

---

## 8. Protocolo de Evolución e Inmutabilidad

### 8.1 Reglas de Inmutabilidad

**Regla I-1:** Una vez publicado un benchmark, su conjunto de consultas es inmutable. Está prohibido modificar el texto de cualquier consulta, su etiquetado o su respuesta de referencia.

**Regla I-2:** Si se detecta un error en una consulta (ambigüedad no intencional, error de anotación), el error se documenta en el registro de errores (BENCHMARK_ERRATA.md) pero la consulta permanece en el benchmark sin modificación. Esta regla elimina el *sesgo de corrección posterior*.

**Regla I-3:** Ninguna consulta del benchmark puede haber sido utilizada directamente en el ajuste, fine-tuning o few-shot prompting del motor evaluado. La violación de esta regla invalida los resultados del benchmark.

**Regla I-4:** El benchmark solo puede ampliarse, nunca contraerse. Un benchmark de nivel N es siempre un subconjunto del benchmark de nivel N+1.

### 8.2 Proceso de Extensión del Benchmark

Para publicar una nueva versión del benchmark (N → N+1):

1. **Propuesta:** Redactar documento de especificación de la nueva versión (distribución, criterios, dimensiones nuevas).
2. **Generación:** Generar las consultas nuevas siguiendo estrictamente la taxonomía definida en este documento.
3. **Revisión técnica:** Revisión por al menos dos personas independientes del equipo de motor IA.
4. **Validación de unicidad:** Comprobar que ninguna consulta nueva es paráfrasis trivial de una consulta existente (similitud coseno > 0,95 → rechazar).
5. **Publicación:** Asignar identificador de versión, fecha y hash SHA-256 del archivo de consultas. El hash garantiza la integridad futura.
6. **Ejecución de línea base:** Ejecutar el motor en producción actual sobre las consultas nuevas y documentar resultados.

### 8.3 Identificación y Trazabilidad

Cada consulta del benchmark tiene un identificador único con el formato:

```
BM-{VERSION}-{OFICIO}-{CATEGORIA}-{SECUENCIA}
```

Ejemplo: `BM-GD-OF01-E02-0042` → Gold Dataset, Electricidad, Cuadros eléctricos, consulta 42.

Cada consulta almacena adicionalmente:
- `nivel_dificultad`: N1–N6
- `tipologia_linguistica`: L1–L8
- `mecanismos_ia`: lista de M01–M15
- `texto`: texto exacto de la consulta
- `respuesta_referencia` (opcional): JSON de referencia para cálculo de SD2/SD3
- `notas`: justificación del caso, contexto de diseño

### 8.4 Versionado del Motor vs. Versionado del Benchmark

El versionado del motor (v59, v60, ...) y el versionado del benchmark (BM-v60, BM-v61, ...) son independientes. La matriz de resultados oficial es:

```
Resultado(motor_M, benchmark_B) → {TG, TCC, TF, Lat_P95, SGM}
```

Cada nueva versión del motor debe ejecutarse contra **todos** los benchmarks publicados hasta la fecha para garantizar la comparabilidad longitudinal.

---

## 9. Distribución del Gold Dataset

### 9.1 Distribución por Oficios

| Oficio | Consultas objetivo | % del total |
|---|---|---|
| OF-01 Electricidad | 105 | 5,25% |
| OF-02 Fontanería | 100 | 5,00% |
| OF-03 Climatización / HVAC | 100 | 5,00% |
| OF-04 Calefacción | 95 | 4,75% |
| OF-05 Gas | 95 | 4,75% |
| OF-06 Carpintería | 95 | 4,75% |
| OF-07 Albañilería y Obras | 105 | 5,25% |
| OF-08 Pintura y Decoración | 95 | 4,75% |
| OF-09 Cerrajería | 90 | 4,50% |
| OF-10 Suelos y Pavimentos | 95 | 4,75% |
| OF-11 Alicatado y Revestimientos | 95 | 4,75% |
| OF-12 Impermeabilización | 90 | 4,50% |
| OF-13 Aislamiento Térmico y Acústico | 90 | 4,50% |
| OF-14 Energía Solar / Fotovoltaica | 100 | 5,00% |
| OF-15 Telecomunicaciones | 90 | 4,50% |
| OF-16 Seguridad y Alarmas | 90 | 4,50% |
| OF-17 Carpintería de Aluminio y PVC | 95 | 4,75% |
| OF-18 Jardinería y Paisajismo | 90 | 4,50% |
| OF-19 Piscinas | 90 | 4,50% |
| OF-20 Reformas Integrales | 110 | 5,50% |
| **Total** | **2.000** | **100%** |

*Tolerancia: ±5 consultas por oficio. Máximo desequilibrio admisible entre el oficio con mayor representación (OF-20) y el de menor (OF-09, OF-12, OF-13, OF-15, OF-16, OF-18, OF-19): ratio ≤ 1,22.*

### 9.2 Distribución por Nivel de Dificultad

| Nivel | Consultas | % |
|---|---|---|
| N1 — Simple | 300 | 15% |
| N2 — Normal | 500 | 25% |
| N3 — Complejo | 400 | 20% |
| N4 — Ambiguo | 300 | 15% |
| N5 — Coloquial | 300 | 15% |
| N6 — Voz transcrita | 200 | 10% |
| **Total** | **2.000** | **100%** |

Cada oficio debe tener al menos 3 consultas en cada nivel de dificultad.

### 9.3 Distribución por Tipología Lingüística

| Tipología | Consultas | % |
|---|---|---|
| L1 — Técnico formal | 400 | 20% |
| L2 — Técnico informal | 300 | 15% |
| L3 — Coloquial estándar | 300 | 15% |
| L4 — Coloquial regional | 200 | 10% |
| L5 — Con errores ortográficos | 200 | 10% |
| L6 — Voz transcrita limpia | 200 | 10% |
| L7 — Voz transcrita con ruido | 200 | 10% |
| L8 — Multiidioma | 200 | 10% |
| **Total** | **2.000** | **100%** |

### 9.4 Distribución por Mecanismo IA

| Mecanismo | Consultas mínimas |
|---|---|
| M01 — Clasificación de oficio | 200 |
| M02 — Clasificación de actuación | 400 |
| M03 — Recuperación semántica | 400 |
| M04 — Resolución de sinónimos | 150 |
| M05 — Fallback a sugeridas | 100 |
| M06 — Actuaciones múltiples | 150 |
| M07 — Extracción de cantidad | 300 |
| M08 — Inferencia de localización | 100 |
| M09 — Manejo de ambigüedad | 150 |
| M10 — Lenguaje coloquial / argot | 200 |
| M11 — Voz con disfluencias | 100 |
| M12 — Consulta incompleta | 100 |
| M13 — Comparación de proveedores | 50 |
| M14 — Reforma multidisciplinar | 60 |
| M15 — Detección de contrato | 40 |

*(Una consulta puede activar múltiples mecanismos. La suma supera 2.000.)*

---

## 10. Roadmap del Benchmark

### Fase 1 — BM-v61 (Q3 2026)

**Objetivo:** Duplicar cobertura, validar robustez lingüística básica.

| Hito | Fecha estimada | Entregable |
|---|---|---|
| Especificación completa BM-v61 | 2026-07-21 | BM-SPEC-v61.md |
| Generación de 400 consultas nuevas | 2026-07-31 | benchmark_v61.json |
| Revisión técnica y de unicidad | 2026-08-07 | Informe de revisión |
| Publicación y hash SHA-256 | 2026-08-10 | Registro oficial |
| Ejecución sobre motor en producción | 2026-08-11 | Resultados BM-v61-M59 |

### Fase 2 — BM-v62 (Q4 2026)

**Objetivo:** Validación de robustez completa, cobertura de cola larga.

| Hito | Fecha estimada | Entregable |
|---|---|---|
| Especificación completa BM-v62 | 2026-10-01 | BM-SPEC-v62.md |
| Generación de 700 consultas nuevas | 2026-10-20 | benchmark_v62.json |
| Publicación y ejecución | 2026-10-31 | Resultados BM-v62 |

### Fase 3 — BM-GD Gold Dataset (Q1–Q2 2027)

**Objetivo:** Benchmark definitivo del proyecto. Calidad de referencia para publicación científica.

| Hito | Fecha estimada | Entregable |
|---|---|---|
| Auditoría de cobertura de BM-v62 | 2026-11-15 | GAP analysis |
| Generación de consultas de ampliación | 2026-12-31 | Corpus parcial |
| Anotación de respuestas de referencia | 2027-01-31 | Gold annotations |
| Revisión por experto externo del sector | 2027-02-28 | Informe de validación |
| Publicación Gold Dataset v1.0 | 2027-03-15 | BM-GD-v1.0.json + hash |
| Ejecución oficial sobre motor activo | 2027-03-16 | Resultados Gold |

---

## 11. Comparativa con Benchmarks de Referencia Internacional

El diseño del Sistema de Validación de TrabFlow sigue los principios establecidos en los benchmarks de referencia de la industria IA, adaptados al dominio de extracción de información y generación de documentos técnicos en lenguaje natural:

| Benchmark de referencia | Dominio | Principio adoptado |
|---|---|---|
| GLUE / SuperGLUE (Wang et al., 2018/2019) | NLP general | Múltiples tareas, métricas compuestas, benchmark público e inmutable |
| SQuAD 2.0 (Rajpurkar et al., 2018) | QA sobre documentos | Preguntas imposibles de responder como clase de fallo, F1 como métrica |
| HumanEval (Chen et al., 2021) | Generación de código | Pass@k como métrica de generación, evaluación funcional no superficial |
| MT-Bench (Zheng et al., 2023) | Modelos de chat | Evaluación multi-turno, juez externo para subjetividad |
| MTEB (Muennighoff et al., 2022) | Embeddings | Cobertura de múltiples tareas y dominios, distribución equilibrada |

**Diferenciadores del SOV TrabFlow:**

1. **Dominio especializado verificado por expertos del sector.** Las respuestas de referencia son validadas por instaladores profesionales, no por anotadores generalistas.
2. **Evaluación funcional, no superficial.** El criterio de corrección no es similitud de texto sino usabilidad real del presupuesto generado.
3. **Métricas de negocio alineadas con KPIs de producto.** La Tasa de Generación (TG) es directamente el KPI que mide el valor del producto para el instalador.
4. **Protocolo de evolución controlada.** El sistema de superseting garantiza comparabilidad longitudinal indefinida.
5. **Cobertura de variabilidad lingüística del sector.** El lenguaje coloquial técnico de los instaladores españoles es una dimensión de variabilidad que benchmarks generalistas no contemplan.

---

## Apéndices

### Apéndice A — Esquema JSON de una Consulta del Benchmark

```json
{
  "id": "BM-GD-OF01-E02-0042",
  "version_benchmark": "GD",
  "oficio": "OF-01",
  "categoria": "E-02",
  "nivel_dificultad": "N3",
  "tipologia_linguistica": "L1",
  "mecanismos_ia": ["M02", "M03", "M07"],
  "texto": "Sustituir cuadro eléctrico completo en vivienda de 90m2: ICP 40A, diferencial 40A/30mA, seis magnetotérmicos de 16A y dos de 10A, con cableado de tierra",
  "respuesta_referencia": {
    "partidas": [
      {
        "descripcion": "Cuadro de distribución empotrable",
        "unidades": 1,
        "unidad": "ud",
        "precio_unitario": 85.00
      },
      {
        "descripcion": "ICP 40A",
        "unidades": 1,
        "unidad": "ud",
        "precio_unitario": 45.00
      },
      {
        "descripcion": "Interruptor diferencial 40A/30mA",
        "unidades": 1,
        "unidad": "ud",
        "precio_unitario": 38.00
      },
      {
        "descripcion": "Magnetotérmico 16A",
        "unidades": 6,
        "unidad": "ud",
        "precio_unitario": 18.00
      },
      {
        "descripcion": "Magnetotérmico 10A",
        "unidades": 2,
        "unidad": "ud",
        "precio_unitario": 18.00
      },
      {
        "descripcion": "Mano de obra instalación cuadro eléctrico",
        "unidades": 4,
        "unidad": "h",
        "precio_unitario": 35.00
      }
    ]
  },
  "notas": "Consulta N3 que activa extracción de cantidades múltiples (6 y 2 magnetotérmicos de diferente amperaje). Valida M07 (cantidades) y M03 (recuperación cuadro eléctrico en Base Maestra).",
  "fecha_creacion": "2026-07-07",
  "hash_texto": "sha256:..."
}
```

### Apéndice B — Definición del Pipeline de Ejecución del Benchmark

```
[Archivo JSON de consultas]
        │
        ▼
[trade-benchmark-runner v4]
  ├── Lee consultas por lotes (configurable: 10/lote)
  ├── POST → trade-voice-to-quote (TRADE_TEST_KEY)
  ├── Clasifica respuesta → {OK_CATALOGO, OK_MIXTO, SOLO_SUGERIDAS, VACÍO, TRUNCADO, PRECIO_INVALIDO, ERROR_TECNICO}
  ├── Registra en trade_benchmark_results {run_id, query_id, categoria, lat_ms, tokens_in, tokens_out, stop_reason}
  └── Al finalizar → llama a recompute_run_stats(run_id)
        │
        ▼
[trade_benchmark_runs] → {ok_rate, queries_ok, queries_solo_sug, lat_p95_ms, tok_max, ...}
        │
        ▼
[AdminAIValidationSection] → Dashboard de resultados
```

### Apéndice C — Glosario

| Término | Definición |
|---|---|
| Actuación | Unidad de trabajo del catálogo TradeFlow. Agrupa partidas relacionadas bajo un tipo de servicio. |
| Base Maestra (kbContext) | Contexto de conocimiento inyectado en el prompt del motor con actuaciones y precios del catálogo de la organización. |
| Partida | Línea de presupuesto: descripción, unidades, precio unitario, importe. |
| Benchmark leakage | Contaminación del benchmark cuando las consultas se usan en el entrenamiento del modelo evaluado. |
| stop_reason | Campo de la respuesta del modelo que indica si terminó por decisión propia (`end_turn`) o por límite de tokens (`max_tokens`). |
| Tasa de Generación (TG) | Métrica primaria de producto: presupuestos accionables generados / total consultas. |
| Gold Dataset | Benchmark definitivo del proyecto, con cobertura exhaustiva y anotaciones de referencia validadas por expertos. |

---

*Documento preparado por: TrabFlow Technologies — Área de I+D*  
*Referencia: BM-2026-001 v1.0*  
*Próxima revisión programada: publicación de BM-v61*
