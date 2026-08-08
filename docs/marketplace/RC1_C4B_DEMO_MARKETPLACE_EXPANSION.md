# RC1-C.4B — Plan de expansión del Marketplace demo

**Versión:** 1.0  
**Fecha:** 2026-08-08  
**Estado:** STOP PARCIAL — plan de normalización y crecimiento  
**Objetivo:** Ecosistema demo completo para presentación a proveedores reales

---

## 1. Visión del ecosistema completo

El Marketplace demo debe mostrar a un proveedor real el **modelo de negocio completo** de TrabFlow:

```
Proveedor demo
├── Identidad y catálogo en el portal
├── Offerings activas (con precio, stock, plazo)
├── Competencia visible (2+ proveedores por UP)
├── Pedidos entrantes (simulados o reales de demo)
├── Métricas en portal proveedor (ventas, vistas, conversión)
└── Publicidad / posicionamiento (futuro)
```

Hoy ningún proveedor tiene todos estos elementos. El plan los activa por fases.

---

## 2. Estado actual del ecosistema

### Cobertura por proveedor (offerings matched)

| Proveedor | Offerings matched | UPs cubiertos | ¿Catálogo coherente? |
|-----------|-----------------|--------------|---------------------|
| Obras y Materiales S.L. | 36 | ~10 UPs | ⚠️ Parcial — 195 pending sin UP |
| Suministros Técnicos Norte S.L. | 18 | ~8 UPs | ✅ Coherente (fontanería premium) |
| ElectroSuministros Cantábrico S.L. | 6 | 4 UPs | ⚠️ Escaso |
| Revestimientos y Obra Norte S.L. | 5 | 4 UPs | ⚠️ Escaso |
| Carpintería y Cerramientos Norte S.L. | 3 | 3 UPs | ⚠️ Muy escaso |
| Pinturas Profesionales del Norte S.L. | 2 | 2 UPs | ⚠️ Muy escaso |
| Fontanería Saltos Quiroga S.L. | **0** | 0 | ❌ Actor inexistente |
| ElectroDistribución Cantábrica S.L. | **0** | 0 | ❌ Actor inexistente |
| Sistemas Térmicos del Norte S.L. | **0** | 0 | ❌ Actor inexistente |

**Total offerings matched:** 70 (en 70 UP×actor pairs)  
**Objetivo demo completo:** 200+ offerings matched en 9 proveedores

### Competencia por UP (proveedores que ofrecen el mismo producto)

| Estado | UPs | Descripción |
|--------|-----|------------|
| Sin competencia (1 proveedor) | ~40 UPs | Solo un actor tiene offering |
| Competencia real (2+ proveedores) | ~15 UPs | Demo funcional de comparador |
| Sin offering | ~70 UPs validated | Catálogo sin cobertura |

El comparador de precios solo muestra valor cuando hay 2+ proveedores por UP. Hoy solo ~15 UPs tienen competencia real.

---

## 3. Métrica de cobertura (fórmula aprobada)

```
Cobertura = offerings_matched_activas / productos_comerciales_validos

Hoy: 70 offerings matched / 672 productos comerciales = 10.4%

Nota: 672 = 891 total − 33 herramientas/EPIs − 186 HVAC legacy
(no incluye aún los catálogos de Fontanería Saltos, ElectroDistribución, Sistemas Térmicos)
```

**Objetivos de cobertura por fase:**

| Fase | Cobertura | Hito |
|------|----------|------|
| Hoy (línea base) | 10.4% | B0.5 — 70 offerings / 672 productos |
| Sprint A+B STN ✅ | 15.6% | +35 offerings STN (105 matched total) |
| Sprint B completo | ~21% | +20 Fontanería Saltos + 15 ElectroDistribución |
| Sprint C | 30%+ | +Revestimientos, Pinturas, Carpintería ampliados |
| Sprint D (completo) | 50%+ | Todos los proveedores con catálogo activo |
| Proveedores reales | 80%+ | Transición a datos reales |

---

## 4. Plan de expansión por proveedor

### 4.1 Obras y Materiales S.L. — AMPLIAR

**Situación:** 231 offerings (36 matched, 195 pending sin UP). El proveedor más rico en datos.

| Acción | Volumen | Prioridad |
|--------|---------|----------|
| Crear UPs para Electricidad (18 prods pending) | ~6-8 UPs nuevos | Alta |
| Crear UPs para Fontanería (13 prods pending) | ~5-6 UPs nuevos | Alta |
| Crear UPs para Pintura (15 prods pending) | ~4-5 UPs nuevos | Media |
| Crear UPs para Suelos/Revestimientos (30 prods pending) | ~6-8 UPs nuevos | Media |
| Mapear y promover 10 candidatos de similitud alta | 10 offerings | Inmediata |
| **Objetivo:** de 36 → 80+ offerings matched | | |

### 4.2 Fontanería Saltos Quiroga S.L. — CREAR

**Situación:** Catálogo Saltoki existe (170 prods) pero sin actor. Crear actor + primeras offerings.

| Acción | Volumen | Prioridad |
|--------|---------|----------|
| UPDATE supplier_name en catálogo `47fb567e` | 1 registro | Inmediata |
| INSERT actor `fontaneria-saltos-quiroga` | 1 actor | Inmediata |
| Auditar y deduplicar familias Fontanería/Grifería/ACS de Saltoki | 32+15+20 = 67 prods | Alta |
| Crear UPs para los 67 prods de fontanería | ~15-20 UPs | Alta |
| Crear offerings matched (mínimo demo) | 20 offerings | Alta |
| **Objetivo:** 20 offerings matched en 2 semanas |  |  |

**Familias prioritarias de Saltoki para demo:**
- Fontanería 32 prods → griferías, sifones, flexible, colectores
- Grifería 15 prods → grifos monomando ducha/bañera (diferenciación con STN)
- ACS 20 prods → termos, acumuladores
- Válvulas 13 prods → llaves, válvulas de seguridad
- Sanitarios 15 prods → lavabos, inodoros, platos de ducha

### 4.3 ElectroDistribución Cantábrica S.L. — CREAR

**Situación:** Catálogo Sonepar existe (76 prods: mecanismos, cables, protecciones) pero sin actor.

| Acción | Volumen | Prioridad |
|--------|---------|----------|
| UPDATE supplier_name en catálogo `ff706aad` | 1 registro | Inmediata |
| INSERT actor `electrodistribucion-cantabrica` | 1 actor | Inmediata |
| Deduplicar vs Novelec/Rexel (mismas familias) | 76+71+60=207 prods solapados | Alta |
| Elegir catálogo eléctrico representativo (Sonepar es el más grande) | — | Alta |
| Crear UPs para mecanismos, cables, protecciones | ~10-12 UPs | Alta |
| Crear offerings matched | 15 offerings | Alta |
| **Objetivo:** 15 offerings matched diferenciadas de ElectroSuministros |  |  |

**Decisión pendiente:** Novelec (71) y Rexel (60) tienen familias idénticas (cables, mecanismos, protecciones). Solo uno debería tener actor Marketplace. Recomendación: Sonepar (76, más grande) como ElectroDistribución; Novelec y Rexel permanecen como catálogos legacy sin actor.

### 4.4 Revestimientos y Obra Norte S.L. — AMPLIAR

**Situación:** Actor activo pero solo 5 offerings. Catálogo propio sin legacy.

| Acción | Volumen | Prioridad |
|--------|---------|----------|
| Crear UPs y offerings para azulejos (varios formatos) | 4-6 UPs | Alta |
| Crear UPs y offerings para pavimentos antideslizantes | 3-4 UPs | Alta |
| Crear UPs y offerings para morteros y adhesivos cerámicos | 3-4 UPs | Media |
| Crear UPs y offerings para impermeabilizantes | 2-3 UPs | Media |
| **Objetivo:** 20 offerings matched | | |

### 4.5 Pinturas Profesionales del Norte S.L. — AMPLIAR

**Situación:** Actor activo pero solo 2 offerings.

| Acción | Volumen | Prioridad |
|--------|---------|----------|
| Crear UPs y offerings para esmaltes y lacas | 3-4 UPs | Alta |
| Crear UPs y offerings para imprimaciones | 2-3 UPs | Alta |
| Crear UPs y offerings para pinturas de fachada | 2-3 UPs | Media |
| Añadir offerings a UPs de Bricomart Pintura (5 prods legacy) | 5 offerings | Media |
| **Objetivo:** 15 offerings matched | | |

**Nota:** Bricomart Pro tiene 5 prods de Pintura legacy sin actor. Podrían usarse para añadir offerings a Pinturas Profesionales.

### 4.6 Carpintería y Cerramientos Norte S.L. — AMPLIAR

**Situación:** Actor activo pero solo 3 offerings.

| Acción | Volumen | Prioridad |
|--------|---------|----------|
| Crear UPs y offerings para puertas de paso interior | 3-4 UPs | Alta |
| Crear UPs y offerings para ventanas PVC | 2-3 UPs | Alta |
| Crear UPs y offerings para rodapiés y molduras | 3-4 UPs | Media |
| **Objetivo:** 15 offerings matched | | |

### 4.7 Sistemas Térmicos del Norte S.L. — ✅ COMPLETADO (2026-08-08)

**Situación:** Actor creado, catálogo creado, 35 UPs + 35 offerings generados.

| Acción | Estado |
|--------|--------|
| CREATE catálogo nuevo `sistemas-termicos-norte` (id: `8a44c358`) | ✅ |
| INSERT actor `sistemas-termicos-norte` (id: `ce208430`) | ✅ |
| UPDATE supplier_name en los 6 catálogos HVAC (marcas eliminadas) | ✅ |
| 35 UPs genéricos creados (sin marca, validation_state=validated) | ✅ |
| 35 offerings matched en catálogo STN | ✅ |

**Familias creadas:**
- ACS: calentadores gas 11/14L, termoacumuladores eléctricos 50/80/100L WiFi, acumuladores 150/200/300L
- Calderas: condensación mural 24/30/35kW, mixta 24kW, pie 30/45kW, biomasa pellet 15/25kW
- Bomba de calor aerotermia: 6/8/12/16kW
- Split inverter: 2.150/3.400/5.200/7.000 frigorías
- Radiadores: aluminio 6/10 elem. 600mm, panel acero 600×800/1200mm
- Control: termostato WiFi, OpenTherm, válvula termostática 1/2", cabezal M30
- Accesorios: kit coaxial 60/100mm, vaso expansión 12L, gas R32 10kg

**Pendiente (expansión futura):** grifería premium de diseño, sanitarios técnicos (diferenciación con Suministros Técnicos Norte).

---

## 5. Estrategia de deduplicación de catálogos eléctricos

Sonepar, Novelec y Rexel tienen 207 referencias con familias casi idénticas. Crear actores para los tres generaría duplicidad masiva de UPs.

**Propuesta:**
1. Usar Sonepar (76 prods) como catálogo fuente de ElectroDistribución Cantábrica
2. Los UPs que se creen son genéricos (no específicos de Sonepar)
3. ElectroSuministros Cantábrico aporta offerings a esos mismos UPs (competencia)
4. Novelec y Rexel quedan como catálogos legacy archivados sin actor Marketplace

```
UP genérico "Cable eléctrico H07V-K 2,5mm²"
├── Offering: ElectroDistribución Cantábrica (precio Sonepar normalizado)
├── Offering: ElectroSuministros Cantábrico (precio competidor)
└── Offering: Obras y Materiales S.L. (precio generalista)
```

Este modelo muestra la competencia de precios sin triplicar los UPs.

---

## 6. Roadmap de ejecución (tras aprobación)

### Sprint A — Normalización de identidades (1-2 días, solo datos)

```
✅ Aprobación de 3 decisiones arquitectónicas (§5 RC1_C4B_DEMO_SUPPLIERS.md)
→ UPDATE supplier_name en 8 catálogos (eliminar marcas reales)
→ INSERT actor Fontanería Saltos Quiroga S.L.
→ INSERT actor ElectroDistribución Cantábrica S.L.
→ CREATE catálogo + INSERT actor Sistemas Térmicos del Norte S.L.
```

**Cobertura tras Sprint A:** ~10.4% (sin offerings nuevas aún, solo actores creados)

### Sprint B — Catálogos mínimos (3-5 días, creación de UPs y offerings)

```
✅ 35 offerings Sistemas Térmicos del Norte (ACS, caldera, bomba de calor, split, radiadores, control) — COMPLETADO 2026-08-08
✅ 20 offerings Fontanería Saltos Quiroga (fontanería, grifería, ACS) — COMPLETADO 2026-08-08
✅ 15 offerings ElectroDistribución Cantábrica (mecanismos IP20, cables ml, protecciones, cuadros, luminaria) — COMPLETADO 2026-08-08
⏳ 10 offerings adicionales en Revestimientos, Pinturas, Carpintería
```

**Cobertura tras Sprint B STN:** ~15.6%  
**Cobertura tras Sprint B FSQ:** ~18.6% (125 offerings ✅)  
**Cobertura tras Sprint B EDC:** ~20.8% (140 offerings ✅)  
**Cobertura tras Sprint B completo:** ~21%

### Sprint C — Ampliar y añadir competencia (1 semana, datos y validación)

```
→ 80 offerings Obras y Materiales (activar pending_review con nuevos UPs)
→ Añadir 2+ proveedores por UP (mínimo 20 UPs con competencia real)
→ Cerrar brecha de catálogos escasos (Carpintería, Pinturas)
```

**Cobertura tras Sprint C:** ~50%

### Sprint D — Proveedores reales (fase 4, tras piloto comercial)

```
→ Sustituir actores demo por proveedores reales
→ Mantener identidades demo como "modo demo" de fallback
→ Onboarding API v1 para proveedores reales
```

---

## 7. Resumen de volúmenes necesarios

| Entidad | Hoy | Objetivo demo completo | A crear |
|---------|-----|----------------------|---------|
| Actores activos | 7 | 9 (+ 2 nuevos de fondo) | +3 (Fontanería Saltos, ElectroDistribución, Sistemas Térmicos) |
| Catálogos con actor | 7 | 9 | +2 (Saltoki→actor, Sonepar→actor) + 1 nuevo (Sistemas Térmicos) |
| UPs validated | ~80 | ~140 | +60 aprox. |
| Offerings matched | 70 | 200+ | +130 aprox. |
| UPs con 2+ proveedores | ~15 | 60+ | +45 aprox. |

---

## 8. Dependencias críticas

```
[Aprobación decisiones arquitectónicas]
    └──▶ Sprint A (identidades + actores)
            └──▶ Sprint B (catálogos mínimos)
                    └──▶ Sprint C (ampliar + competencia)
                            └──▶ Demo presentable a proveedor real
```

La ejecución de Sprint A desbloquea todo lo demás. Duración estimada Sprint A: 1 día tras aprobación.
