# RC1-C.4B Sprint B — Auditoría Fontanería Saltos Quiroga S.L.

**Versión:** 1.1  
**Fecha:** 2026-08-08  
**Estado:** COMPLETADO ✓ — 3 UPs + 20 offerings ejecutados  
**Actor:** Fontanería Saltos Quiroga S.L. (slug: `fontaneria-saltos-quiroga`, catálogo: `47fb567e-8ce9-4ee1-b5ec-a7aae3a05162`)

---

## 1. Resumen ejecutivo

Se han analizado las 170 referencias del catálogo Saltoki. Se ha cruzado cada referencia con los 60 UPs existentes en el sistema para detectar reutilizaciones, duplicados internos y conflictos.

**El 22% de las referencias queda descartado** por estar fuera del alcance de Fontanería Saltos Quiroga (electricidad, construcción, splits de marca real). **El 28% es duplicado interno** del propio catálogo Saltoki (misma referencia con y sin marca). **El 50% restante es válido** y de esas, se seleccionan los mejores 35 como plan de expansión.

**Decisión de diseño:** Se priorizan UPs con 0 offerings actuales (FSQ como primer proveedor) y UPs donde FSQ genera competencia visible contra STN y ObrasMat. El objetivo no es cantidad, sino amplitud perceptual del Marketplace.

---

## 2. Clasificación de las 170 referencias

### 2.1 Referencias descartadas (38)

| Motivo | Familia | Referencias | Razón |
|--------|---------|-------------|-------|
| Fuera del alcance FSQ | Electricidad | SAL-ELE-001..018 (18 refs) | Territorio de ElectroSuministros/ElectroDistribución |
| Fuera del alcance FSQ | Construcción | SAL-CON-001..008 (8 refs) | Morteros, siliconas, pinturas → ObrasMat/Pinturas |
| Marcas reales (prohibido) | Climatización | SAL-CLI-001..006 (6 refs) | Splits Daikin y LG — marcas reales en descripción y ref |
| Duplicados internos | Fontanería/Tuberías | 6 refs secundarias | Ver §2.2 |

### 2.2 Duplicados internos detectados (6 pares)

| Ref A | Ref B | Producto | Incidencia |
|-------|-------|---------|------------|
| SAL-FON-021 (Retube, rl) | SAL-FON-026 (sin marca, ud) | Tubo cobre 18mm 25m (71€ ambos) | Idénticos — mantener SAL-FON-021 |
| SAL-FON-022 (Retube, rl) | SAL-FON-027 (sin marca, ud) | Tubo cobre 22mm 25m (95€ ambos) | Idénticos — mantener SAL-FON-022 |
| SAL-FON-020 (Uponor, rl, 89€) | SAL-FON-025 (sin marca, ud, 89€) | Tubería multicapa PEX-AL-PEX 20mm 50m | Idénticos — mantener SAL-FON-020 |
| SAL-FON-023 (Grohe, 33€) | SAL-FON-028 (sin marca, 33€) | Ducha de mano + flexo 150cm cromado | Idénticos — mantener SAL-FON-023 |
| SAL-FON-024 (Hansgrohe, 309€) | SAL-FON-029 (sin marca, 308€) | Columna ducha termostática completa | Prácticamente idénticos — mantener SAL-FON-024 |
| SAL-TUB-101 (Uponor, 72€) | SAL-FON-019 (Uponor, 65€) | Tubería multicapa PEX-AL-PEX 16mm 50m | Precio distinto (misma referencia física) — elegir la más representativa |

**Acción recomendada:** No crear dos offerings para los duplicados. Usar siempre la referencia con mayor dato de calidad (con marca especificada, unidad coherente).

### 2.3 Referencias válidas (126) — distribución por familia

| Familia | Refs válidas | P1 | P2 | P3 | Observaciones |
|---------|-------------|-----|-----|-----|---------------|
| Grifería (SAL-GRF) | 15 | 12 | 2 | 1 | Core de FSQ |
| Fontanería/Grifería (SAL-FON) | ~20 | 10 | 5 | 5 | Overlap con SAL-GRF; eliminar dup |
| Sanitarios (SAL-SAN) | 15 | 8 | 4 | 3 | Alta visibilidad en demo |
| Saneamiento (SAL-SNM) | 10 | 6 | 2 | 2 | Desagüe/sifones, poco visible |
| Tuberías (SAL-TUB) | 15 | 5 | 5 | 5 | Problema unidades (ml vs rollo) |
| Válvulas (SAL-VAL) | 13 | 6 | 4 | 3 | Fáciles de añadir, alta relevancia técnica |
| ACS (SAL-ACS) | 20 | 6 | 8 | 6 | Overlap con STN — usar precio como diferenciador |
| Calefacción (SAL-CAL) | 15 | 3 | 6 | 6 | Overlap con STN |
| Climatización accesorios | 3 | 0 | 1 | 2 | SAL-CLI-007/008/009 — P3 o diferir |

---

## 3. Mapa de UPs: reutilización vs creación

### 3.1 UPs existentes reutilizables (verificados en BD)

| UP existente | ID | Offerings actuales | Familias FSQ que mapean |
|-------------|----|--------------------|------------------------|
| Grifo monomando lavabo | `7ba1e338` | 4 (ObrasMat×2, STN×2) | SAL-GRF-101, 109, 113; SAL-FON-001, 002 |
| Grifo monomando cocina alto | `145d1eaa` | 1 (ObrasMat 45€) | SAL-GRF-102, 107, 110; SAL-FON-003 |
| Grifo monomando bañera | `cacc3487` | **0** | SAL-GRF-105 |
| Grifo para lavadero/exterior 1/2" | `7e193787` | **0** | SAL-GRF-114 |
| Grifo monomando ducha | `3c77b38c` | 5 | SAL-FON-004; SAL-GRF-104 |
| Kit ducha termostático | `a6e059e1` | **0** | SAL-FON-029, SAL-FON-024 (columna) |
| Mampara de ducha | `0bb256f1` | 6 | SAL-SAN-107, SAL-SAN-108; SAL-FON-014, 015 |
| Plato de ducha resina | `54777b80` | 4 (ObrasMat, STN×3) | SAL-SAN-103, 104; SAL-FON-011, 012, 013 |
| Plato de ducha extraplano | `b5402538` | **0** | SAL-SAN-115 |
| Inodoro suspendido con cisterna | `0962108b` | 3 (ObrasMat×2, STN) | SAL-SAN-101 ⚠️ solo si incluye cisterna |
| Lavabo sobre encimera | `bf93aa66` | 2 (ObrasMat, STN) | SAL-SAN-102, SAL-FON-018 |
| Sifón y desagüe ducha | `8a235fa5` | 2 matched+1 pending | SAL-SNM-109; SAL-FON-030 |
| Tubo y sifón desagüe PVC | `8eec8021` | **0** | SAL-SNM-110 |
| Tubo cobre | `e1b76491` | 1 (ObrasMat 1.83€/ml) | SAL-TUB-103, 104, 105, 113; SAL-FON-021, 022 |
| Tubo multicapa | `ae30044d` | **0** | SAL-TUB-101, 102, 112; SAL-FON-019, 020 |
| Tubo PVC saneamiento | `344d3c07` | 1 (ObrasMat 4.20€/ml) | SAL-SNM-103, 107 |
| Tubo PVC presión | `eabf7417` | **0** | SAL-TUB-106, 107 |
| Tubo PE-100 | `58523c4d` | **0** | SAL-TUB-109 |
| Válvula esférica latón | `1b817393` | 1 (STN 6.50€) | SAL-VAL-101, 102, 103; SAL-FON-006, 007, 008 |
| Válvula de seguridad | `6056ea3d` | 1 (ObrasMat 8.50€) | SAL-ACS-008; SAL-VAL-108 |
| Válvula termostática radiador 1/2" | `e1b88d5f` | 1 (STN 19€) | SAL-VAL-109 |
| Cabezal termostático M30×1.5 | `a961cfec` | 1 (STN 24€) | SAL-CAL-109 |
| Termoacumulador eléctrico 50L | `fa253679` | 1 (STN 302€) | SAL-ACS-001, 103 |
| Termoacumulador eléctrico 80L | `098d373f` | 1 (STN 346€) | SAL-ACS-002, 104 |
| Calentador instantáneo gas natural 11L/min | `dc9db459` | 1 (STN 319€) | SAL-ACS-005, 101, 102 |
| Calentador instantáneo gas natural 14L/min | `f853a7b9` | 1 (STN 362€) | SAL-ACS-006 |
| Radiador de aluminio 10 elementos 600mm | `d85c9f5f` | 1 (STN 149€) | SAL-CAL-101 |
| Radiador panel acero 600×800mm | `c6f0bb03` | 1 (STN 99€) | SAL-CAL-103 |
| Caldera de condensación mural 24kW | `3b28af56` | 1 (STN 1.026€) | SAL-CAL-105 |

**UPs con 0 offerings** (FSQ como primer proveedor): `cacc3487`, `7e193787`, `b5402538`, `ae30044d`, `8eec8021`, `eabf7417`, `58523c4d`, `a6e059e1` — **8 UPs vacíos donde FSQ inaugura la cobertura**.

### 3.2 UPs nuevos a crear

| UP nuevo propuesto | Motivo | Refs FSQ | Prioridad |
|-------------------|--------|----------|-----------|
| Válvula antirretorno latón | No existe. Producto P1 en fontanería | SAL-VAL-104, 105 | P1 |
| Sifón botella lavabo | No existe. El UP "Sifón ducha" no cubre lavabo | SAL-FON-009; SAL-SNM-102 | P1 |
| Bote sifónico PVC | No existe. Accesorio esencial en saneamiento | SAL-SNM-101 | P1 |
| Grifo termostático ducha empotrado | "Grifo monomando ducha" no cubre termostático (diferencia de precio y función) | SAL-FON-005; SAL-GRF-108 | P2 |
| Inodoro de suelo compacto | "Inodoro suspendido" no cubre inodoros de suelo | SAL-SAN-101; SAL-FON-017 | P1 |
| Grifo bimando lavabo | No existe. El monomando no equivale al bimando clásico | SAL-GRF-103, 111 | P2 |
| Válvula reductora de presión | No existe. Relevante en instalaciones de presión alta | SAL-VAL-106, 107 | P2 |
| Purgador automático de aire | No existe. Componente estándar en calefacción | SAL-VAL-113 | P2 |
| Bañera acrílica | No existe ningún UP de bañera | SAL-SAN-105, 106; SAL-FON-031 | P2 |
| Inodoro suspendido Rimless | Diferente del "con cisterna" — se vende sin cisterna, requiere Geberit aparte | SAL-SAN-113 | P2 |

**Para la fase inicial (20 offerings): crear 3 UPs nuevos.** Los 7 restantes se crean en la fase ampliada (35 offerings).

---

## 4. Plan de ejecución — Fase Inicial (20 offerings)

**Catálogo FSQ:** `47fb567e-8ce9-4ee1-b5ec-a7aae3a05162`  
**Refs FSQ:** `SAL-FSQ-XXX-NNN` (se asignan en el momento de la inserción)  
**Precio:** coste × 1.08 = profesional_neto; coste × 1.35 = público_neto  
**IVA:** 21% | **Divisa:** EUR | **match_state:** matched | **venta_profesional:** true

### Grupo A — UPs con 0 offerings (FSQ inaugura la cobertura) — 5 offerings

| # | Ref Saltoki | UP reutilizado | ID UP | Precio coste | Prof neto | Decisión |
|---|-------------|---------------|-------|-------------|-----------|---------|
| 1 | SAL-GRF-105 | Grifo monomando bañera | `cacc3487` | 145.00€ | 156.60€ | UP vacío → +1 cobertura |
| 2 | SAL-GRF-114 | Grifo para lavadero/exterior 1/2" | `7e193787` | 18.50€ | 19.98€ | UP vacío → +1 cobertura |
| 3 | SAL-SAN-115 | Plato de ducha extraplano | `b5402538` | 195.00€ | 210.60€ | UP vacío → +1 cobertura |
| 4 | SAL-TUB-101 | Tubo multicapa ⚠️ unidad ml | `ae30044d` | 1.44€/ml* | 1.56€/ml | UP vacío; rollo 50m=72€ → ml equivalente |
| 5 | SAL-SNM-110 | Tubo y sifón desagüe PVC | `8eec8021` | 8.50€ | 9.18€ | UP vacío → +1 cobertura |

*Precio original rollo 50m = 72€ → precio/ml = 1.44€. La offering se crea en la unidad del UP (ml) con este precio unitario.

### Grupo B — UPs con competencia (FSQ genera 2º proveedor) — 7 offerings

| # | Ref Saltoki | UP | ID UP | Precio coste | Prof neto FSQ | Prof actual (STN/ObrasMat) | Diferencial |
|---|-------------|-----|-------|-------------|--------------|--------------------------|------------|
| 6 | SAL-ACS-005 | Calentador gas estanco 11L/min | `dc9db459` | 275.00€ | 297.00€ | STN 319€ | FSQ -7% vs STN |
| 7 | SAL-ACS-001 | Termoacumulador eléctrico 50L | `fa253679` | 125.00€ | 135.00€ | STN 302€ | FSQ -55% (gama diferente) |
| 8 | SAL-VAL-101 | Válvula esférica latón (1/2") | `1b817393` | 8.50€ | 9.18€ | STN 6.50€ | FSQ +41% (1/2" PN25) |
| 9 | SAL-VAL-109 | Válvula termostática radiador 1/2" | `e1b88d5f` | 14.50€ | 15.66€ | STN 19€ | FSQ -18% vs STN |
| 10 | SAL-ACS-008 | Válvula de seguridad 3 bar 3/4" | `6056ea3d` | 8.20€ | 8.86€ | ObrasMat 8.50€ | FSQ -4% vs ObrasMat |
| 11 | SAL-GRF-102 | Grifo monomando cocina alto | `145d1eaa` | 115.00€ | 124.20€ | ObrasMat 45€ | FSQ gama alta (diferenciación) |
| 12 | SAL-CAL-109 | Cabezal termostático M30×1.5 | `a961cfec` | 18.50€ | 19.98€ | STN 24€ | FSQ -17% vs STN |

### Grupo C — UPs con múltiples proveedores (FSQ añade variante) — 5 offerings

| # | Ref Saltoki | UP | ID UP | Precio coste | Prof neto | Nota |
|---|-------------|-----|-------|-------------|----------|------|
| 13 | SAL-GRF-101 | Grifo monomando lavabo (encastrado, gama alta) | `7ba1e338` | 95.00€ | 102.60€ | Extiende rango precio UP (36-102€) |
| 14 | SAL-SAN-107 | Mampara de ducha (frontal 1 hoja 80x195) | `0bb256f1` | 195.00€ | 210.60€ | Tamaño específico |
| 15 | SAL-SAN-103 | Plato de ducha resina (80x80 acrílica) | `54777b80` | 145.00€ | 156.60€ | Alternativa a STN (183-262€) |
| 16 | SAL-SAN-102 | Lavabo sobre encimera (redondo 42cm) | `bf93aa66` | 95.00€ | 102.60€ | 3 proveedores en UP |
| 17 | SAL-SNM-109 | Sifón y desagüe ducha (horizontal DN50) | `8a235fa5` | 24.00€ | 25.92€ | 3 proveedores matched |

### Grupo D — UPs nuevos (FSQ inaugura categoría) — 3 offerings

| # | Ref Saltoki | UP a crear | Familia | Precio coste | Prof neto |
|---|-------------|-----------|---------|-------------|----------|
| 18 | SAL-VAL-104 | **Válvula antirretorno latón** | Válvulas | 9.80€ | 10.58€ |
| 19 | SAL-FON-009 | **Sifón botella lavabo** | Saneamiento | 6.80€ | 7.34€ |
| 20 | SAL-SNM-101 | **Bote sifónico PVC** | Saneamiento | 14.50€ | 15.66€ |

---

## 5. Plan de ejecución — Fase Ampliada (35 offerings, +15 sobre las 20 iniciales)

Pendiente de aprobación de la fase inicial. Incluye:

| # | Ref Saltoki | UP | Acción UP | Precio coste | Prof neto |
|---|-------------|-----|----------|-------------|----------|
| 21 | SAL-ACS-002 | Termoacumulador 80L | Reutilizar (STN 346€) | 155.00€ | 167.40€ |
| 22 | SAL-ACS-006 | Calentador gas estanco 14L/min | Reutilizar (STN 362€) | 310.00€ | 334.80€ |
| 23 | SAL-GRF-109 | Grifo monomando lavabo (con vaciador) | Reutilizar | 89.00€ | 96.12€ |
| 24 | SAL-FON-001 | Grifo monomando lavabo (caño alto) | Reutilizar | 43.50€ | 46.98€ |
| 25 | SAL-GRF-103 | **Nuevo**: Grifo bimando lavabo clásico | Crear UP | 58.00€ | 62.64€ |
| 26 | SAL-VAL-102 | Válvula esférica latón (3/4") | Reutilizar | 11.00€ | 11.88€ |
| 27 | SAL-VAL-106 | **Nuevo**: Válvula reductora presión 1/2" | Crear UP | 45.00€ | 48.60€ |
| 28 | SAL-VAL-113 | **Nuevo**: Purgador automático aire 1/2" | Crear UP | 8.00€ | 8.64€ |
| 29 | SAL-TUB-103 | Tubo cobre (rígida 15mm, barra 5m → ml) | Reutilizar | 2.90€/ml* | 3.13€/ml |
| 30 | SAL-TUB-102 | Tubo multicapa (20x2, rollo 50m → ml) | Reutilizar | 1.90€/ml* | 2.05€/ml |
| 31 | SAL-SNM-107 | Tubo PVC saneamiento (DN50, barra 3m) | Reutilizar | 2.60€/ml* | 2.81€/ml |
| 32 | SAL-SNM-102 | Sifón botella lavabo (cromo 1 1/4") | Reutilizar UP nuevo fase inicial | 18.00€ | 19.44€ |
| 33 | SAL-CAL-103 | Radiador panel acero 600×800mm | Reutilizar (STN 99€) | 88.00€ | 95.04€ |
| 34 | SAL-SAN-105 | **Nuevo**: Bañera acrílica | Crear UP | 210.00€ | 226.80€ |
| 35 | SAL-SAN-101 | **Nuevo**: Inodoro de suelo compacto | Crear UP | 185.00€ | 199.80€ |

*precio/ml calculado a partir del precio por barra/rollo

---

## 6. Incidencias detectadas

### INC-01 — Duplicados internos en catálogo Saltoki

6 pares de referencias idénticas o prácticamente idénticas. La diferencia es que una versión tiene marca especificada y la otra no.

**Impacto:** Si se crean offerings para ambas referencias, el Marketplace mostraría al mismo proveedor con el mismo producto dos veces al precio idéntico.  
**Acción:** En cada par, usar solo la referencia con mayor calidad de datos (con marca o con unidad coherente). Las referencias secundarias permanecen en `trade_supplier_products` pero sin offering.

### INC-02 — Unidad ml vs rollo/barra en tuberías

Los UPs de tubería existentes (Tubo cobre, Tubo multicapa, Tubo PVC saneamiento) usan `unidad = 'ml'`. Las referencias Saltoki se comercializan en rollos (50m, 100m) y barras (3m, 4m, 5m, 6m).

**Impacto:** Si se crea la offering con `unidad = 'rollo'`, el comparador de precios no puede comparar directamente con la offering de ObrasMat (precio/ml). Si se convierte a ml, el precio parece más bajo pero puede confundir.  
**Acción recomendada:** Crear offerings con `unidad = 'ml'` y precio/ml equivalente calculado. Guardar en `metadata` el formato original (rollo/barra y precio total). El comparador funciona correctamente y el instalador ve precios comparables.

### INC-03 — UP "Termoacumulador 100L WiFi" no cubre termos sin WiFi

SAL-ACS-003 (Thermor, 189€) y SAL-ACS-105 (Fleck, 265€) son termoacumuladores de 100L sin conectividad WiFi. El UP existente `9960eb1d` especifica "100L WiFi".

**Impacto:** Asignar estos productos al UP "WiFi" es un falso positivo — el comprador esperaría WiFi.  
**Acción:** Crear UP nuevo "Termoacumulador eléctrico 100L" (sin WiFi) en la fase ampliada. No incluir en fase inicial.

### INC-04 — Marcas reales en campo `marca` del catálogo Saltoki

Todas las referencias Saltoki tienen marcas reales: Grohe, Hansgrohe, Roca, Geberit, Grundfos, ABB, LG, Daikin, etc.

**Impacto:** Si se copia el campo `marca` a la `descripcion_comercial` de la offering, se violaría la regla de no usar marcas reales.  
**Acción:** Las descripciones de offering son siempre genéricas. El campo `marca` del catálogo legacy se ignora en el texto visible. Opcionalmente guardar en `metadata._marca_original` para referencia interna.

### INC-05 — Inodoro suspendido Rimless (SAL-SAN-113) no incluye cisterna

SAL-SAN-113 es un inodoro suspendido Rimless que se vende sin cisterna. Requiere cisterna empotrada (SAL-SAN-109 Geberit) y placa pulsadora (SAL-SAN-110) por separado. El UP existente `0962108b` es "Inodoro suspendido con cisterna".

**Impacto:** Asignar SAL-SAN-113 a ese UP implica que el comprador espera cisterna incluida — es un falso positivo.  
**Acción:** En la fase ampliada, crear UP "Inodoro suspendido Rimless" con descripción clara de que no incluye cisterna. No usar el UP `0962108b` para este producto.

### INC-06 — Caldera suelo 35kW sin UP equivalente

SAL-CAL-115 es caldera de condensación de suelo 35kW. STN tiene de pie 30kW y 45kW, pero no 35kW.

**Impacto:** No existe UP exacto. Fusionar con 30kW o 45kW sería incorrecto (diferencia de potencia significativa para el dimensionado).  
**Acción:** Crear UP "Caldera de condensación de pie 35kW" en fase ampliada. Diferir de la fase inicial.

### INC-07 — Splits Climatización con marcas reales (SAL-CLI-001..006)

Daikin (3 refs) y LG (3 refs). Los UPs genéricos de split existen (creados para STN). Podrían asignarse a esos UPs sin mencionar la marca.

**Impacto:** Crear offerings FSQ en splits STN activa competencia de precio entre FSQ y STN. Ventaja: comparador funciona. Riesgo: difumina la especialización de FSQ (¿fontanería o también splits?).  
**Acción recomendada:** Diferir splits de FSQ hasta Sprint C. FSQ se consolida como especialista en fontanería/ACS/válvulas primero. Los splits son complementarios, no el core.

---

## 7. Métricas de la auditoría

| Métrica | Valor |
|---------|-------|
| Referencias analizadas | 170 |
| Referencias descartadas (fuera alcance) | 26 (15.3%) |
| Duplicados internos eliminados | 6 (3.5%) |
| Referencias válidas totales | 138 (81.2%) |
| Referencias seleccionadas fase inicial | 20 (11.8%) |
| Referencias seleccionadas fase ampliada | 35 (20.6%) |
| Referencias diferidas (P3 o post-Sprint C) | 103 |
| UPs reutilizados (fase inicial) | 17 |
| UPs creados nuevos (fase inicial) | 3 |
| UPs reutilizados (fase ampliada) | 27 |
| UPs creados nuevos (fase ampliada) | 8 |
| UPs con 0 offerings donde FSQ inaugura | 5 (grupos A) |
| UPs con competencia nueva generada | 7 (grupo B) |
| Incidencias detectadas | 7 |

### Estado proyectado del Marketplace

| Estado | Offerings matched | Cobertura |
|--------|-----------------|-----------|
| Hoy (antes de FSQ) | 105 | 15.6% |
| Tras fase inicial (20 offerings) | 125 | 18.6% |
| Tras fase ampliada (35 offerings) | 140 | 20.8% |
| UPs con 2+ proveedores (hoy) | ~22 | — |
| UPs con 2+ proveedores (tras FSQ inicial) | ~29 | — |

### Amplitud perceptual del Marketplace

Con 20 offerings FSQ, el Marketplace pasa de 9 proveedores activos (solo STN con catálogo HVAC) a mostrar FSQ con:
- **5 familias de producto diferenciadas**: grifería, sanitarios, válvulas/sifones, tuberías, ACS
- **3 categorías de precio** dentro de cada familia: básico/medio/alto
- **7 UPs con competencia visible** entre FSQ y otros actores: el comparador de precios tiene material en 7 UPs nuevos

---

## 8. Recomendaciones

1. **Estrategia de precio FSQ:** FSQ es el distribuidor general de fontanería técnica, posicionado entre ObrasMat (lo más barato) y STN (gama alta). En ACS/termos, FSQ es significativamente más económico que STN (135€ vs 302€ en termo 50L) — esto no es un error, refleja la diferente gama de producto: STN vende termos de mayor calidad, FSQ distribuye la gama estándar de instalación.

2. **Priorizar UPs vacíos primero:** Los 5 UPs del Grupo A (donde FSQ sería el único proveedor) son los de mayor impacto en amplitud. Si solo hubiera que hacer 5 offerings, serían esas 5.

3. **No crear offering en "Grifo monomando lavabo" genérico barato:** El UP `7ba1e338` ya tiene 4 offerings entre 36-45€ (ObrasMat×2, STN×2). Añadir FSQ en ese rango de precio no añade valor visible. En cambio, SAL-GRF-101 (Grohe, 95€) extiende el rango del UP hacia arriba, lo que sí añade valor al comparador.

4. **Convertir tuberías a ml:** La inconsistencia de unidad (rollo vs ml) debe resolverse ahora, antes de insertar las offerings. Si en el futuro se añaden más tubería de ObrasMat en ml, el comparador funcionará correctamente.

5. **No crear offering de caldera STN para FSQ:** SAL-CAL-105 (caldera 24kW) mapea al mismo UP que STN-CAL-001. La diferencia de precio (STN 1.026€, FSQ estimado ~918€) es interesante, pero añadir caldera de FSQ distorsiona su posicionamiento como especialista en fontanería sanitaria. Diferir calderas FSQ a Sprint C.

---

## 9. Decisiones aprobadas y ejecutadas

| Decisión | Resolución | Ejecutado |
|---------|---------|-----------|
| D1 — Crear 3 UPs nuevos | ✅ Aprobado | Válvula antirretorno latón, Sifón botella lavabo, Bote sifónico PVC |
| D2 — Convertir tubería a €/ml | ✅ Aprobado | SAL-TUB-101: 72€/rollo → 1.44€/ml; metadata rollo+conversión |
| D3 — Gamas distintas en mismo UP | ✅ Aprobado | básica/estándar/profesional/premium en metadata.gama |
| D4 — Diferir splits CLI a Sprint C | ✅ Aprobado | SAL-CLI-001..006 excluidos de Sprint B |

---

## 10. Resultados de ejecución

**Fecha ejecución:** 2026-08-08  
**Commit:** ver git log RC1-C.4B Sprint B FSQ

| Métrica | Resultado |
|---------|-----------|
| UPs reutilizados | 17 |
| UPs nuevos creados | 3 |
| Total offerings creadas | 20 |
| Catálogo destino | `47fb567e-8ce9-4ee1-b5ec-a7aae3a05162` |
| Offerings matched antes | 105 |
| Offerings matched después | **125** |
| Cobertura antes | 15.6% |
| Cobertura después | **18.6%** (125/672) |

**Distribución de las 20 offerings:**
- Grupo A (5): FSQ primer proveedor en UPs vacíos → SAL-GRF-105/114, SAL-SAN-115, SAL-TUB-101, SAL-SNM-110
- Grupo B (7): competencia vs STN/ObrasMat → SAL-ACS-005/001/008, SAL-VAL-101/109, SAL-GRF-102, SAL-CAL-109
- Grupo C (5): variante en UPs multi-proveedor → SAL-GRF-101, SAL-SAN-107/103/102, SAL-SNM-109
- Grupo D (3): FSQ inaugura nuevas categorías → SAL-VAL-104, SAL-FON-009, SAL-SNM-101

*Pendiente Sprint C: ampliar FSQ con splits (SAL-CLI), calderas (diferir), y ramas de fontanería menor.*
