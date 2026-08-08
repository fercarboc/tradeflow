# RC1-C.4B Sprint B — Auditoría ElectroDistribución Cantábrica S.L.

**Versión:** 1.1  
**Fecha:** 2026-08-08  
**Estado:** COMPLETADO ✓ — 14 UPs + 15 offerings ejecutados  
**Actor:** ElectroDistribución Cantábrica S.L. (slug: `electrodistribucion-cantabrica`, catálogo: `ff706aad-1e20-437f-83dd-1382468c980e`)

---

## 1. Resumen ejecutivo

Se han analizado las 76 referencias del catálogo Sonepar. Se ha cruzado cada referencia con los 7 UPs eléctricos existentes y se han aplicado todas las validaciones obligatorias (IP20 ≠ IP44, interruptor ≠ pulsador, diferencial ≠ magnetotérmico, monofásico ≠ trifásico, interior ≠ exterior).

**El 33% de las referencias se descarta** por estar fuera del alcance P1/P2 (protecciones industriales, cables especializados, canalizaciones de infraestructura). **El 47% se difiere a Sprint C** — son productos válidos pero no prioritarios para el demo inicial. **El 20% restante (15 refs) forma el plan inicial**.

**Conclusión de diseño:** EDC se posiciona como el distribuidor eléctrico mayorista que equipa instalaciones residenciales y comerciales completas. El catálogo demo muestra las 6 familias de producto sin duplicar lo ya ofertado por ElectroSuministros Cantábrico S.L. (IP44 / doméstico). La diferenciación clave: **EDC = mayorista técnico** (mecanismos IP20, protecciones, cuadros, cable técnico); **ElectroSuministros = especialista instalación** (IP44, iluminación baño, domótica).

---

## 2. Clasificación de las 76 referencias

| Familia | Total | Descartados | Diferidos Sprint C | Seleccionados |
|---------|-------|-------------|-------------------|---------------|
| Cables | 15 | 5 | 7 | 3 |
| Canalizaciones | 13 | 4 | 8 | 1 |
| Cuadros | 6 | 3 | 1 | 2 |
| Luminaria | 12 | 3 | 7 | 2 |
| Mecanismos | 15 | 3 | 8 | 4 |
| Protecciones | 15 | 7 | 5 | 3 |
| **Total** | **76** | **25** | **36** | **15** |

### 2.1 Referencias descartadas (25)

| Ref | Descripción | Motivo descarte |
|-----|-------------|----------------|
| SON-CAB-108 | Cable apantallado 2x0.75 control 100m | P3 — automatización industrial |
| SON-CAB-109 | Cable RJ45 Cat6 UTP 305m | P3 — datos/telecomunicaciones |
| SON-CAB-110 | Cable fibra óptica OS2 4FO 200m | P3 — datos avanzados |
| SON-CAB-112 | Cable solar 6mm² rojo 100m | P3 — fotovoltaico especializado |
| SON-CAB-115 | Cable 16mm² negro rollo 50m | P2 — gran sección, diferente rollo (50m≠100m) |
| SON-CAN-101 | Tubo corrugado DN50 rollo 50m | Infraestructura enterrada |
| SON-CAN-102 | Tubo corrugado DN63 rollo 50m | Infraestructura enterrada |
| SON-CAN-112 | Bandeja perforada 100mm 3m | Industrial/comercial |
| SON-CAN-113 | Bandeja perforada 200mm 3m | Industrial/comercial |
| SON-CUA-104 | Armario metal opaco 400x600x200 | Cuadro industrial, no residencial |
| SON-CUA-105 | Embarrado cobre 3P+N 63A | Accesorio interno de cuadro |
| SON-CUA-106 | Peine distribución 3P 12M | Accesorio interno de cuadro |
| SON-LUM-108 | Lámpara LED E27 10W | Consumidor, no distribución profesional |
| SON-LUM-109 | Tubo LED T8 18W 120cm | Industrial/comercial |
| SON-LUM-112 | Tira LED 24V 14W/m 5m IP20 | Decorativo/nicho |
| SON-MEC-107 | Toma RJ45 Cat6 empotrar | P3 — datos |
| SON-MEC-108 | Toma TV-SAT empotrar | P3 — telecomunicaciones |
| SON-MEC-113 | Telerruptor 16A 230V | P3 — automatización |
| SON-PRO-106 | PIA 3P 32A curva C | Trifásico (monofásico ≠ trifásico) |
| SON-PRO-107 | PIA 4P 63A curva C | Industrial trifásico |
| SON-PRO-109 | Diferencial 4P 40A 30mA | Trifásico |
| SON-PRO-110 | Diferencial 4P 63A 300mA | Industrial — también 300mA≠30mA |
| SON-PRO-113 | Fusible NH00 160A 500V | Industrial pesado |
| SON-PRO-114 | Portafusibles NH00 3P 160A | Industrial pesado |
| SON-PRO-115 | Relé térmico 9-13A | Protección motores — industrial |

### 2.2 Referencias diferidas a Sprint C (36)

| Familia | Refs | Motivo diferimiento |
|---------|------|-------------------|
| Cables | CAB-103(4mm²), CAB-104(6mm²), CAB-106(3x2.5mm²), CAB-107(5x2.5mm²), CAB-111(libre halógenos), CAB-113(10mm²), CAB-114(2x1.5mm²) | Válidas P1/P2, ampliar en Sprint C cuando haya competencia |
| Canalizaciones | CAN-103..108 (tubos PVC, canales PVC), CAN-109/110 (cajas empotrar ud) | Válidas, sin UP destino; CAN-109/110 ≠ UP kit existente |
| Cuadros | CUA-102 (superficie 24M) | Válido P2, diferir |
| Luminaria | LUM-102(18W), LUM-103(panel 40W), LUM-104(regleta), LUM-106(foco carril), LUM-107(proyector ext.), LUM-110(emergencia), LUM-111(sensor PIR) | Válidas, ampliar en Sprint C |
| Mecanismos | MEC-104(enchufe+tapa), MEC-106(regulador LED), MEC-109/110/111(marcos), MEC-112(dif 25A), MEC-114(minutero), MEC-115(base industrial IP44) | Válidas P1/P2, diferir o crear competencia en UPs ya existentes |
| Protecciones | PRO-103(1P 20A), PRO-105(2P 40A), PRO-111(limitador sobreten.), PRO-112(IGA 2P 40A) | Válidas, diferir para ampliar en Sprint C |

### 2.3 Referencias seleccionadas para Sprint B (15)

| Ref | Descripción | Familia | Coste | Unidad |
|-----|-------------|---------|-------|--------|
| SON-CAB-101 | Cable unipolar 1.5mm² H07V-K rollo 100m | Cables | 28.00€/rollo | rollo→ml |
| SON-CAB-102 | Cable unipolar 2.5mm² H07V-K rollo 100m | Cables | 42.00€/rollo | rollo→ml |
| SON-CAB-105 | Cable manguera 3×1.5mm² H05VV-F rollo 100m | Cables | 68.00€/rollo | rollo→ml |
| SON-MEC-101 | Interruptor 10A 250V blanco empotrar | Mecanismos | 5.80€ | ud |
| SON-MEC-102 | Conmutador 10A 250V blanco empotrar | Mecanismos | 6.50€ | ud |
| SON-MEC-103 | Base enchufe schuko 16A 250V blanco | Mecanismos | 6.80€ | ud |
| SON-MEC-105 | Pulsador 10A timbre blanco empotrar | Mecanismos | 5.20€ | ud |
| SON-PRO-101 | PIA 1P 10A curva C 6kA | Protecciones | 12.50€ | ud |
| SON-PRO-104 | PIA 2P 25A curva C 6kA | Protecciones | 22.00€ | ud |
| SON-PRO-108 | Diferencial 2P 40A 30mA tipo AC | Protecciones | 45.00€ | ud |
| SON-CUA-101 | Caja empotrar ICP-M 4 módulos | Cuadros | 12.00€ | ud |
| SON-CUA-103 | Cuadro distribución empotrar 18 módulos | Cuadros | 28.00€ | ud |
| SON-LUM-101 | Downlight LED empotrar 9W 4000K | Luminaria | 18.00€ | ud |
| SON-LUM-105 | Aplique exterior LED 12W 4000K IP65 | Luminaria | 32.00€ | ud |
| SON-CAN-111 | Caja derivación estanca IP65 100×100mm | Canalizaciones | 6.80€ | ud |

---

## 3. Mapa de reutilización de UPs existentes

### 3.1 UPs reutilizables directamente (1)

| UP existente | ID | n_offerings actuales | Ref EDC | Motivo |
|-------------|-----|---------------------|---------|--------|
| Cable eléctrico H07V-K 1,5mm² | `fab5a9af` | 2 (electrosuministros, STN) | SON-CAB-101 | Mismo producto, EDC como 3er proveedor |

### 3.2 UPs existentes NO reutilizables

| UP existente | Motivo exclusión |
|-------------|-----------------|
| Mecanismo interruptor IP44 (`0d72f97f`) | IP44 ≠ IP20 — son productos distintos |
| Mecanismo pulsador IP44 (`1ad915a0`) | IP44 ≠ IP20 |
| Mecanismo enchufe schuko IP44 (`43cf0878`) | IP44 ≠ IP20 |
| Kit cajas empotrar (`4898dc86`) | Kit ≠ caja individual; precio y composición incompatibles |
| Luminaria baño LED IP44 (`8373f246`) | IP44 baño ≠ IP65 exterior |
| Extractor baño (`7b2c276a`) | Sin equivalente en catálogo Sonepar |

### 3.3 UPs nuevos a crear (13)

| # | Nombre canónico | Familia | Subfamilia | Unidad | Refs EDC |
|---|----------------|---------|-----------|--------|---------|
| 1 | Cable eléctrico H07V-K 2,5mm² | Cables y Conductores | — | ml | CAB-102 |
| 2 | Cable manguera H05VV-F 3×1,5mm² | Cables y Conductores | — | ml | CAB-105 |
| 3 | Interruptor simple empotrable | Mecanismos | Interruptores | ud | MEC-101 |
| 4 | Conmutador empotrable | Mecanismos | Interruptores | ud | MEC-102 |
| 5 | Base enchufe schuko empotrable | Mecanismos | Enchufes | ud | MEC-103 |
| 6 | Pulsador timbre empotrable | Mecanismos | Pulsadores | ud | MEC-105 |
| 7 | Magnetotérmico PIA monofásico curva C | Protecciones | PIA | ud | PRO-101 |
| 8 | Magnetotérmico PIA bifásico curva C | Protecciones | PIA | ud | PRO-104 |
| 9 | Interruptor diferencial 2P 30mA tipo AC | Protecciones | Diferenciales | ud | PRO-108 |
| 10 | Caja empotrar ICP-M | Cuadros | Cajas | ud | CUA-101 |
| 11 | Cuadro distribución empotrar | Cuadros | Cuadros | ud | CUA-103 |
| 12 | Downlight LED empotrar 9W | Iluminación | LED empotrado | ud | LUM-101 |
| 13 | Aplique LED exterior IP65 | Iluminación | LED exterior | ud | LUM-105 |

---

## 4. Plan de 15 offerings

### Grupo A: UP existente — EDC como 3er proveedor (1 offering)

| # | Ref | UP | Coste | Prof | Pub | Unidad | Stock |
|---|-----|-----|-------|------|-----|--------|-------|
| 1 | SON-CAB-101 | Cable H07V-K 1,5mm² (`fab5a9af`) | 0.28€/ml | 0.30 | 0.38 | ml | 800 ml |

*Normalización: 28€/rollo 100m → 0.28€/ml. Metadata: rollo_original=100m, precio_por_rollo=28.00*

### Grupo B: UPs nuevos — Mecanismos IP20 (4 offerings)

| # | Ref | UP nuevo | Coste | Prof | Pub | Stock |
|---|-----|---------|-------|------|-----|-------|
| 2 | SON-MEC-101 | Interruptor simple empotrable | 5.80 | 6.26 | 7.83 | 100 |
| 3 | SON-MEC-102 | Conmutador empotrable | 6.50 | 7.02 | 8.78 | 80 |
| 4 | SON-MEC-103 | Base enchufe schuko empotrable | 6.80 | 7.34 | 9.18 | 100 |
| 5 | SON-MEC-105 | Pulsador timbre empotrable | 5.20 | 5.62 | 7.02 | 80 |

*Todos IP20 interior — estrictamente distintos de los UPs IP44 existentes.*  
*Plazo 1 día (stock habitual en distribución eléctrica).*

### Grupo C: UPs nuevos — Cables normalizados a ml (2 offerings)

| # | Ref | UP nuevo | Coste/ml | Prof | Pub | Stock (ml) |
|---|-----|---------|----------|------|-----|-----------|
| 6 | SON-CAB-102 | Cable H07V-K 2,5mm² | 0.42 | 0.45 | 0.57 | 600 |
| 7 | SON-CAB-105 | Cable manguera H05VV-F 3×1,5mm² | 0.68 | 0.73 | 0.92 | 400 |

*CAB-102: 42€/rollo 100m → 0.42€/ml. CAB-105: 68€/rollo 100m → 0.68€/ml.*

### Grupo D: UPs nuevos — Protecciones P1 (3 offerings)

| # | Ref | UP nuevo | Coste | Prof | Pub | Stock |
|---|-----|---------|-------|------|-----|-------|
| 8 | SON-PRO-101 | Magnetotérmico PIA monofásico curva C | 12.50 | 13.50 | 16.88 | 60 |
| 9 | SON-PRO-104 | Magnetotérmico PIA bifásico curva C | 22.00 | 23.76 | 29.70 | 40 |
| 10 | SON-PRO-108 | Interruptor diferencial 2P 30mA tipo AC | 45.00 | 48.60 | 60.75 | 30 |

*PRO-101 = 1P 10A, PRO-104 = 2P 25A. Diferentes polos → UPs distintos (monofásico ≠ bifásico).*  
*PRO-108 es diferencial → diferente función que el PIA (diferencial ≠ magnetotérmico ✅).*  
*Descriptions en metadata: calibre (10A/25A/40A) para que el comparador tenga contexto.*

### Grupo E: UPs nuevos — Cuadros P2 (2 offerings)

| # | Ref | UP nuevo | Coste | Prof | Pub | Stock |
|---|-----|---------|-------|------|-----|-------|
| 11 | SON-CUA-101 | Caja empotrar ICP-M | 12.00 | 12.96 | 16.20 | 25 |
| 12 | SON-CUA-103 | Cuadro distribución empotrar | 28.00 | 30.24 | 37.80 | 20 |

### Grupo F: UPs nuevos — Iluminación técnica (2 offerings)

| # | Ref | UP nuevo | Coste | Prof | Pub | Stock |
|---|-----|---------|-------|------|-----|-------|
| 13 | SON-LUM-101 | Downlight LED empotrar 9W | 18.00 | 19.44 | 24.30 | 40 |
| 14 | SON-LUM-105 | Aplique LED exterior IP65 | 32.00 | 34.56 | 43.20 | 20 |

*LUM-101 interior (no IP44): diferente de "Luminaria baño LED IP44". LUM-105 exterior IP65: diferente de baño IP44.*

### Grupo G: UP nuevo — Canalización estanca (1 offering)

| # | Ref | UP nuevo | Coste | Prof | Pub | Stock |
|---|-----|---------|-------|------|-----|-------|
| 15 | SON-CAN-111 | Caja derivación estanca IP65 | 6.80 | 7.34 | 9.18 | 50 |

---

## 5. Incidencias

### I-001: Marcas reales en campo `marca` (no en descripción)
Todas las refs tienen marca real (Schneider, Prysmian, Philips, Legrand, etc.) en el campo `marca`, pero las `descripcion`es del catálogo son genéricas. Las offerings se crearán con `descripcion_comercial` genérica sin mencionar la marca. **No bloquea la ejecución.**

### I-002: Cables en unidad 'rollo' → normalizar a ml
Todos los cables están en €/rollo (100m o 50m). El UP existente "Cable H07V-K 1,5mm²" usa unidad 'ml'. Para que el comparador de precios funcione entre EDC y los otros dos proveedores del UP, EDC debe usar la misma unidad. Normalización: precio/rollo ÷ metros_por_rollo = €/ml. Metadata guarda: `unidad_original: "rollo"`, `metros_por_rollo: 100`, `precio_por_rollo: 28.00`.

### I-003: IP20 ≠ IP44 — mecanismos nuevos obligatorios
Los 3 UPs de mecanismos existentes son IP44 (zonas húmedas). Los mecanismos Sonepar son IP20 estándar. Crear UPs nuevos es obligatorio por la regla de validación. Como consecuencia, las 4 offerings de mecanismos inauguran categorías nuevas (EDC como primer proveedor). La competencia llegará en Sprint C (ObrasMat, ElectroSuministros).

### I-004: SON-MEC-112 (diferencial 2P 25A) ubicado en familia "Mecanismos"
El diferencial 25A está clasificado en "Mecanismos" por el catálogo Sonepar, pero funcionalmente es una protección. El UP "Interruptor diferencial 2P 30mA tipo AC" puede cubrir tanto el 25A (MEC-112) como el 40A (PRO-108) — son variantes de calibre del mismo producto. Para Sprint B se usa PRO-108 (40A, más representativo de instalaciones modernas). MEC-112 queda diferido a Sprint C como segunda offering del mismo UP.

### I-005: SON-CAN-109/110 — cajas empotrar individuales ≠ Kit existente
El UP `4898dc86` "Kit cajas empotrar y accesorios eléctricos" es un kit multi-producto. SON-CAN-109 (caja 1M, 1.80€) y SON-CAN-110 (caja 2M, 2.50€) son cajas individuales. No mapean al UP kit. Diferidos a Sprint C donde se puede evaluar crear UPs de "Caja empotrar 1 mecanismo" y "Caja empotrar 2 mecanismos".

### I-006: SON-CAB-115 — rollo 50m vs rollo 100m
SON-CAB-115 (cable 16mm² negro) tiene rollo de 50m a diferencia de todos los demás (100m). La normalización es igualmente válida (148€/50m = 2.96€/ml) pero el cable 16mm² es P2 de gran sección. Descartado para Sprint B, diferir Sprint C con UP propio "Cable eléctrico H07V-K 16mm²".

### I-007: Luminaria exterior (LUM-105) — diferenciación vs LUM-107
SON-LUM-105 (aplique exterior 12W IP65, 32€) es un aplique de pared. SON-LUM-107 (proyector 50W IP65, 65€) es un proyector de área. Son dos productos distintos que justificarían UPs distintos. Para Sprint B se incluye solo LUM-105 (más frecuente en instalaciones residenciales/comerciales pequeñas). LUM-107 diferido a Sprint C.

---

## 6. Validaciones aplicadas

| Regla | Verificación | Resultado |
|-------|-------------|-----------|
| interruptor ≠ pulsador | MEC-101 (interruptor) vs MEC-105 (pulsador) → UPs distintos | ✅ Cumple |
| IP20 ≠ IP44 | Mecanismos EDC IP20 ≠ UPs existentes IP44 | ✅ Cumple |
| empotrable ≠ superficie | MEC-101..105 empotrar; CUA-103 empotrar vs CUA-102 superficie | ✅ Cumple |
| monofásico ≠ trifásico | PRO-101 (1P), PRO-104 (2P) vs PRO-106 (3P) descartado | ✅ Cumple |
| interior ≠ exterior | LUM-101 interior; LUM-105 exterior IP65 → UPs distintos | ✅ Cumple |
| diferencial ≠ magnetotérmico | PRO-108 diferencial → UP distinto de PRO-101/104 magnetotérmico | ✅ Cumple |
| sin marcas reales | `descripcion_comercial` genérica en todas las offerings | ✅ Cumple |

---

## 7. Impacto en el comparador de precios

| Tipo UP | Providers tras Sprint B | Comentario |
|---------|------------------------|-----------|
| Cable H07V-K 1,5mm² | electrosuministros + STN + **EDC** | 3 proveedores → comparador pleno |
| Mecanismos IP20 (4 UPs) | solo EDC | Categorías inauguradas; Sprint C añade ObrasMat/ElectroSuministros |
| Cables 2,5mm² + manguera | solo EDC | Nuevas categorías; competencia en Sprint C |
| Protecciones (3 UPs) | solo EDC | Nuevas categorías; competencia en Sprint C |
| Cuadros (2 UPs) | solo EDC | Nuevas categorías |
| Luminaria técnica (2 UPs) | solo EDC | Diferenciada de IP44 baño (ya con 2 proveedores) |
| Caja derivación estanca | solo EDC | Complementa kit cajas existente |

---

## 8. Decisiones aprobadas y ejecutadas

| Decisión | Resolución | Ejecutado |
|---------|---------|-----------|
| D1 — Crear UPs nuevos | ✅ Aprobado | 14 UPs creados (audit contaba 13; caja derivación estanca suma el 14.º) |
| D2 — Normalizar cables a €/ml | ✅ Aprobado | CAB-101 0.28€/ml, CAB-102 0.42€/ml, CAB-105 0.68€/ml; metadata unidad_original+factor_conversion+unidad_normalizada |
| D3 — PIA 1P y PIA 2P como UPs distintos | ✅ Aprobado | "Magnetotérmico PIA monofásico curva C" ≠ "Magnetotérmico PIA bifásico curva C" |
| D4 — Diferir material industrial/trifásico a Sprint C | ✅ Aprobado | 25 descartados + 36 diferidos |

---

## 9. Resultados de ejecución

**Fecha ejecución:** 2026-08-08  
**Commit:** ver git log RC1-C.4B Sprint B EDC

| Métrica | Resultado |
|---------|-----------|
| UPs reutilizados | 1 (Cable H07V-K 1,5mm²) |
| UPs nuevos creados | 14 |
| Total offerings creadas | 15 |
| Catálogo destino | `ff706aad-1e20-437f-83dd-1382468c980e` |
| Offerings matched antes | 125 |
| Offerings matched después | **140** |
| Cobertura antes | 18.6% |
| Cobertura después | **20.8%** (140/672) |

**Distribución de las 15 offerings:**
- Grupo A (1): UP existente cable 1,5mm² — EDC como 3er proveedor → SON-CAB-101
- Grupo B (4): Mecanismos IP20 inaugurados — SON-MEC-101/102/103/105
- Grupo C (2): Cables nuevos normalizados a ml — SON-CAB-102/105
- Grupo D (3): Protecciones P1 — SON-PRO-101 (1P 10A) / PRO-104 (2P 25A) / PRO-108 (diferencial 2P 40A)
- Grupo E (2): Cuadros — SON-CUA-101/103
- Grupo F (2): Iluminación técnica — SON-LUM-101/105
- Grupo G (1): Canalización estanca — SON-CAN-111

*Pendiente Sprint C: ampliar EDC con cables adicionales (4+6mm², mangueras 3x2.5/5x2.5), protecciones (IGA, limitador), luminaria (downlight 18W, proyector IP65, emergencia, sensor PIR), mecanismos (minutero, regulador LED, diferencial 25A), canalizaciones (tubos PVC, canales, cajas empotrar individuales).*
