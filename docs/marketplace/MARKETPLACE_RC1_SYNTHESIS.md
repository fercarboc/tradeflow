# Síntesis RC1 — Fase Preparatoria B01-B06

**Versión:** 1.1  
**Fecha:** 2026-08-03  
**Estado:** PASOS 0–2 COMPLETADOS — PASO 3 (TypeScript) en ejecución

---

## 1. Estado de los bloqueantes

| Bloqueante | Descripción | Severidad | Estado análisis | Documento |
|---|---|---|---|---|
| B01 | `ship_supplier_order` — overload de 3 parámetros no guarda tracking | Alto | Completo | `MARKETPLACE_B01_TRACKING_ANALYSIS.md` |
| B02 | Catálogo insuficiente para demo (10 UPs comprables, 1 proveedor) | Crítico | Completo | `MARKETPLACE_DEMO_CATALOG_AUDIT.md` |
| B03 | No existe segundo proveedor | Crítico (demo) | Completo | `MARKETPLACE_MULTISUPPLIER_STRATEGY.md` |
| B04 | StepMateriales y StepComparar son código muerto | Bajo | Completo | `MARKETPLACE_LEGACY_CLEANUP.md` |
| B05 | `chk_cart_source` no incluye `'free'` ni `'reorder'` | Crítico (RC1) | Completo | `MARKETPLACE_SOURCE_TYPES.md` |
| B06 | Modelo comercial sin definir | Diseño | Completo | 3 docs (`COMMERCIAL_MODEL`, `RELATIONSHIP`, `PAYMENT`) |

---

## 2. Mapa de dependencias

```
B04 (limpiar código muerto)
  └── sin dependencias → puede ejecutarse PRIMERO (pre-RC1)

B05 (migración constraints)
  └── sin dependencias de datos
  └── bloqueante para: R1-C (CarritoProvider + create_cart con 'free')
  └── bloqueante para: R1-A (ScreenMarketplace sin carrito 'free' no funciona completo)
  └── debe ejecutarse ANTES de cualquier código de compra libre

B01 (fix tracking)
  └── sin dependencias externas
  └── Fix 2 (bulkShip): TypeScript solo, sin migración
  └── Fix 1 (deprecar 3-param): migración SQL, puede ir con B05 o separada
  └── Fix 3 (notas en SlideOver): TypeScript solo, 5 min

B03 (crear Saltoki Demo)
  └── depende de: B02 estar entendido (saber a qué UPs apuntar)
  └── sin dependencias técnicas — solo inserción de datos
  └── puede ir en paralelo con B05/B04

B02 (poblar catálogo)
  └── depende de: B03 completado (así el emparejamiento añade offerings de 2 proveedores)
  └── trabajo de administrador, sin código

B06 (modelo comercial)
  └── sin dependencias técnicas en RC1
  └── guía el diseño de R1-G (PortalClientes en RC2) y R1-H (trade_supplier_relationships)
  └── impacto inmediato en el checkout (form de formas de pago)
```

---

## 3. Orden de implementación recomendado

### Paso 0 — Limpieza ✅ COMPLETADO (2026-08-03, commit 6a187e7)

```
✅ StepMateriales.tsx eliminado (372 líneas de código muerto)
✅ StepComparar.tsx eliminado (375 líneas de código muerto)
✅ Build TypeScript sin errores en src/
```

### Paso 1 — Migración de base de datos ✅ COMPLETADO (2026-08-03)

```
✅ M-B05: chk_cart_source ampliado → 'free', 'reorder' añadidos
✅ M-B05: chk_cart_estado ampliado → 'saved' añadido
✅ M-B01: overload 3-param de ship_supplier_order ELIMINADO (DROP FUNCTION)
```

### Paso 2 — Datos del segundo proveedor ✅ COMPLETADO

```
Objetivo: catálogo demo con 2 proveedores y comparación de precios
Acciones completadas (2026-08-03):
  ✅ Catálogo STN creado: 1aec572f-d22c-4556-9fbf-315ec7b3ba02
  ✅ Actor "Suministros Técnicos Norte S.L." creado: aeca7bac-f559-4e01-8ba4-7fd1b7aae9b9
  ✅ 12 offerings importadas vía Supplier API v1 (import: d82b640d-...), todas pending_review
  ✅ Metadata _demo añadida a todas las offerings
  ✅ Invitación portal enviada a proveedor@inmostay.com

Pendiente (acción admin):
  ⏳ Matching de las 12 offerings STN a UPs (ver PRE_RC1_STN_MATCHING_MATRIX.md)
  ⏳ Punto de recogida Torrelavega (propuesta en matriz de matching)
  ⏳ Imágenes para UPs emparejadas

Documentos: PRE_RC1_STN_PROVIDER_CREATION.md, PRE_RC1_STN_IMPORT_RESULTS.md, PRE_RC1_STN_MATCHING_MATRIX.md
```

### Paso 3 — Fixes de TypeScript ⏳ EN EJECUCIÓN

```
Objetivo: corregir los bugs de B01 antes del código RC1
Pendiente:
  ⏳ Fix B01-2: actualizar bulkShipSupplierOrders → usar shipMarketplaceOrderWithTracking
  ⏳ Fix B01-3: pasar notas en doShip del PortalPedidoSlideOver
  ⏳ Actualizar tipos: CartSourceType (+free, +reorder) y CartEstado (+saved)

Riesgo: Bajo (cambios TypeScript, sin lógica compleja)
```

### Paso 3.5 — RC1-C.4A FASE A: Unificación de catálogo ✅ COMPLETADO (2026-08-08, commit 63c40f4 + post-A10)

```
Objetivo: elevar cobertura Presupuesto → Marketplace de 0% a ≥85% solo con cambios de datos

✅ A2: actor "OBRAMAT Demo" renombrado → "Obras y Materiales S.L." (slug obramat-demo conservado)
✅ A3: migración 20260808_01 — search_aliases text[] + create_cart_from_quote mejorado (PATH 3 alias)
✅ A4: aliases en 11 UPs (diferenciación suelo vs pared, mín 8 chars)
✅ A5: 2 offerings lavabo encimera × 2 proveedores
✅ A6: 6 UPs nuevos — silicona, kit fontanería, interruptor IP44, pulsador IP44, mueble 80cm, caja eléctrica
✅ A7: fix descripción UP eléctrico (eliminado "de fontanería")
✅ A8/A9: offerings revestimientos × 2 proveedores (competencia visible)
✅ A10: 12 offerings aprobadas y promovidas a matched
✅ Opción B ejecutada: interruptor IP44 (0d72f97f) ≠ pulsador IP44 (1ad915a0) — UPs separados
✅ Fix alias plato de ducha (44b86c78): PATH 3 resuelve antes que PATH 4 (UP con 5 offerings)
✅ Fix nombre UP kit eléctrico → "Kit cajas empotrar y accesorios eléctricos" (elimina falsos positivos)
✅ A11 validado: 23/27 (85%) MARKETPLACE, 4 UNRESOLVED estructurales, 0 falsos positivos

Cobertura: 0/27 (0%) → 23/27 (85%)
UPs en catálogo: 37 → 43
Offerings matched: 58 → 70
Documentos: RC1_C4A_*.md (6 documentos en docs/marketplace/)
```

### Paso 3.6 — B0.5 Auditoría catálogo legacy ✅ COMPLETADO (2026-08-08, STOP PARCIAL entregado)

```
Objetivo: entender el estado de las 891 referencias legacy antes de migración masiva

✅ Clasificación completa: A=18 / B=1 / C=653 / D=186 / E=33
✅ Cobertura catálogo→Marketplace: 2.7% (18/672 productos comerciales)
✅ 14 familias de obramat pending_review desglosadas (160 productos)
✅ 15 candidatos de mapeo rápido a UPs existentes identificados
✅ Falsos positivos prevenidos: OBR-ELE-011 ≠ UP IP44, EPDM ≠ membrana líquida
✅ Propuesta de migración en 2 fases con volúmenes estimados:
   · Fase inmediata: ~65 UPs nuevos obramat → cobertura ~26%
   · Fase diferida: 6 actores + ~200 UPs + 494 offerings → cobertura >60%

Documento: RC1_C4B_CATALOG_AUDIT.md
```

**Pendiente (aprobación humana requerida antes de continuar):**
- Validar lista de 15 candidatos de mapeo rápido (§4 del doc)
- Aprobar propuesta de migración por fases
- Decidir si RC1-C.4B resolver puede ejecutarse en paralelo a la migración de datos

### Paso 3.7 — RC1-C.4B Normalización identidades demo ✅ STOP PARCIAL entregado (2026-08-08)

```
Objetivo: eliminar todas las marcas reales del Marketplace demo y completar el ecosistema

Diagnóstico completado:
✅ 7 actores actuales auditados (70 offerings matched total)
✅ 12 catálogos legacy con marcas reales identificados (713 referencias expuestas)
✅ Identidades demo definitivas definidas para los 9 proveedores
✅ 3 decisiones de arquitectura identificadas (bloquean ejecución)
✅ Plan de expansión en 4 sprints documentado

Marcas reales a eliminar de BD (UPDATE supplier_name, pendiente aprobación):
  · Saltoki → Fontanería Saltos Quiroga S.L.
  · Sonepar → ElectroDistribución Cantábrica S.L.
  · Ariston/Saunier Duval/Daikin/Baxi/Junkers/Vaillant → Sistemas Térmicos del Norte S.L.
  · Würth, Novelec, Bricomart, Rexel → nombres pendientes de aprobación

Actores a crear (INSERT, pendiente aprobación):
  · Fontanería Saltos Quiroga S.L. (catálogo Saltoki, 170 prods)
  · ElectroDistribución Cantábrica S.L. (catálogo Sonepar, 76 prods)
  · Sistemas Térmicos del Norte S.L. (catálogo nuevo, ~35 prods seleccionados de 186)

Documentos:
  · RC1_C4B_DEMO_SUPPLIERS.md — actores, cambios, SQL propuesto, riesgos
  · RC1_C4B_SUPPLIER_IDENTITY_GUIDE.md — identidad completa de los 9 proveedores
  · RC1_C4B_DEMO_MARKETPLACE_EXPANSION.md — plan de expansión por sprints
```

**Decisiones bloqueantes (requieren aprobación):**
1. STN vs Fontanería Saltos Quiroga — roles complementarios o fusión?
2. ElectroSuministros vs ElectroDistribución Cantábrica — dos actores o uno?
3. HVAC brands — crear catálogo nuevo o migrar desde los 6 existentes?
4. Nombres demo para Würth, Novelec, Bricomart, Rexel — ¿aprobar propuesta o diferir?

### Paso 4 — RC1 (implementación real)

Con los pasos 0-3.6 completados, los bloqueantes de catálogo están analizados. La cobertura demo es del 85% (Presupuesto→Marketplace). La cobertura catálogo legacy→Marketplace es del 2.7% — migración en curso.

---

## 4. Quick wins (sin RC1)

Los siguientes cambios añaden valor inmediato sin empezar RC1:

| Quick Win | Acción | Impacto | Tiempo |
|---|---|---|---|
| QW-01 | Crear Saltoki Demo con 12 offerings | Demo con comparación real de 2 proveedores | 5h admin |
| QW-02 | Emparejar 10 offerings del backlog a UPs sin cobertura | +10 UPs comprables | 2h admin |
| QW-03 | Asignar imágenes a las 10 UPs con offerings | Experiencia visual del marketplace | 1h admin |
| QW-04 | Migración constraints B05 | Desbloquea el código de compra libre | 15 min dev |
| QW-05 | Fix bulkShipSupplierOrders | Bug de tracking resuelto en producción | 30 min dev |

**QW-01 a QW-03 no requieren código. Solo datos.** Se pueden hacer en las próximas 24-48 horas.

---

## 5. Riesgos para RC1

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El constraint B05 no se migra antes de empezar código | Alta (si se omite) | Bloqueante total | La migración M-B05 es paso 1 obligatorio |
| Confusión entre overloads ship_supplier_order en nuevo código | Media | Bug de producción | Deprecar 3-param con Fix M-B01 |
| Catálogo de solo 1 proveedor en el demo | Alta (si no se hace paso 2) | Demo no convincente | Paso 2 es prerrequisito del demo |
| CarritoProvider + localStorage conflicta con sessionStorage actual | Media | Bug de UX | Migración de sessionStorage → localStorage antes del deploy |
| RLS en trade_marketplace_carts bloquea create_cart sin presupuesto | Alta | Feature completa rota | Revisar políticas RLS antes de implementar create_cart |

---

## 6. Resumen de los documentos de la fase B01-B06

| Documento | Bloqueante | Páginas est. | Contenido |
|---|---|---|---|
| `MARKETPLACE_B01_TRACKING_ANALYSIS.md` | B01 | 4 | Análisis overloads, callers, fixes |
| `MARKETPLACE_DEMO_CATALOG_AUDIT.md` | B02 | 5 | Estado del catálogo, gaps, plan de acción |
| `MARKETPLACE_MULTISUPPLIER_STRATEGY.md` | B03 | 5 | Diseño Saltoki Demo, 12 offerings, diferenciación |
| `MARKETPLACE_LEGACY_CLEANUP.md` | B04 | 4 | Análisis StepMateriales y StepComparar, estrategia de borrado |
| `MARKETPLACE_SOURCE_TYPES.md` | B05 | 5 | Constraints actuales, migración M-B05, definiciones |
| `MARKETPLACE_COMMERCIAL_MODEL.md` | B06 | 6 | Actores, flujos, modelo de precios, onboarding |
| `MARKETPLACE_SUPPLIER_CUSTOMER_RELATIONSHIP.md` | B06 | 6 | Ficha cliente, número cliente, comercial, direcciones |
| `MARKETPLACE_PAYMENT_MODEL.md` | B06 | 5 | Pass-through RC1, cuenta corriente, hoja de ruta pagos |
| **`MARKETPLACE_RC1_SYNTHESIS.md`** | Todos | 4 | Este documento |

**Más los 10 documentos de análisis previo (Sessions A y B):**

| Documento |
|---|
| `MARKETPLACE_ROADMAP_RC1.md` |
| `MARKETPLACE_DATA_MODEL.md` |
| `MARKETPLACE_USER_FLOWS.md` |
| `MARKETPLACE_UX_TARGET.md` |
| `MARKETPLACE_COMPONENT_TREE.md` |
| `MARKETPLACE_STATE_MACHINE.md` |
| `MARKETPLACE_EVENT_CATALOG.md` |
| `MARKETPLACE_FINAL_AUDIT.md` |
| `MARKETPLACE_SUPPLIERS_CATALOG.md` (previo) |
| `MARKETPLACE_PHASE_2.md` (previo) |

---

## 7. Criterios de inicio de RC1

RC1 puede iniciar cuando todos estos criterios estén marcados como completos:

- [x] B04: StepMateriales.tsx eliminado ✅ commit 6a187e7
- [x] B04: StepComparar.tsx eliminado ✅ commit 6a187e7
- [x] B04: Build TypeScript sin errores tras la eliminación ✅
- [x] B05: Migración M-B05 ejecutada en producción (chk_cart_source + chk_cart_estado) ✅
- [ ] B01: bulkShipSupplierOrders actualizado (Fix 2) ⏳ PASO 3
- [x] B01: overload 3-param deprecado (Fix 1) ✅ ejecutado en PASO 1
- [x] B03: STN con 12 offerings importadas (pending_review) ✅ import d82b640d
- [ ] B02+B03: Al menos 5 offerings STN emparejadas a UPs (matching admin pendiente) ⏳
- [ ] B02: Al menos 20 UPs con offerings comprables en el marketplace ⏳
- [ ] B02: Al menos 6 de esas UPs con imagen ⏳

**Si todos los criterios están marcados:** → **APROBADO PARA INICIAR RC1**

---

## 8. Lo que NO cambia antes de RC1

- La arquitectura de `MarketplaceComprarView` (wizard de checkout)
- La tabla `trade_marketplace_orders` y sus funciones SQL
- El portal del proveedor (funciona hoy)
- `ScreenSeguimientoMaterial` (funciona hoy)
- El flujo de presupuesto → marketplace (funciona hoy)
- La integración con el outbox y las push notifications

RC1 añade sobre lo que ya existe. No reemplaza nada que funcione.

---

## 9. Decisiones tomadas (antes pendientes)

| Pregunta | Decisión |
|---|---|
| Nombre segundo proveedor | **"Suministros Técnicos Norte S.L."** — ficticio, sin referencia a Saltoki |
| Fuente de datos STN | 12 productos de fontanería del catálogo legacy Saltoki (normalizados) |
| Método de import | Supplier API v1 (no INSERT manual) |
| Portal STN | Invitación a `proveedor@inmostay.com` (rol: owner) |

---

## 10. Estado PRE-RC1 (2026-08-04)

| Paso | Descripción | Estado |
|---|---|---|
| PASO 0 | Limpieza código muerto | ✅ COMPLETO |
| PASO 1 | Migraciones SQL | ✅ COMPLETO |
| PASO 2 | Segundo proveedor STN | ✅ COMPLETO (matching pendiente: admin) |
| PASO 3 | Fixes TypeScript | ✅ COMPLETO |

**RC1 puede iniciar.** Expansión catálogo demo multioficio en paralelo (no bloquea RC1-A ni RC1-B).

---

## 11. Estado Expansión Catálogo Demo Multioficio — PRE_RC1_MULTITRADE_001 (2026-08-04)

| Etapa | Descripción | Estado |
|---|---|---|
| Análisis (D1-D10) | 6 documentos de análisis | ✅ COMPLETO |
| L0 | Snapshot pre-ejecución | ✅ COMPLETO |
| L1 | 4 catálogos + 4 actores demo | ✅ COMPLETO |
| L2 | Categoría Revestimientos | ✅ COMPLETO |
| L3 | 14 UPs draft + 7 variantes | ✅ COMPLETO |
| Revisión humana | Matriz PRE_RC1_DEMO_UP_REVIEW_MATRIX.md | ⏳ PENDIENTE |
| L4+ | 23 offerings multiproveedor | ⏳ BLOQUEADO |

**Resultados L0–L3:**
- 36 UPs totales (22 validated + 14 draft)
- 27 categorías (+1)
- 7 actores activos (+4 demo)
- 22 variantes (+7)
- 0 offerings creadas (correcto — STOP activo)

**Documentos de resultados:**
- `docs/marketplace/PRE_RC1_DEMO_L0_SNAPSHOT.md`
- `docs/marketplace/PRE_RC1_DEMO_L1_IDENTITY_RESULTS.md`
- `docs/marketplace/PRE_RC1_DEMO_L2_CATEGORIES_RESULTS.md`
- `docs/marketplace/PRE_RC1_DEMO_L3_UP_RESULTS.md`
- `docs/marketplace/PRE_RC1_DEMO_UP_REVIEW_MATRIX.md`
