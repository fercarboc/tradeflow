# RC1-C.4B — Normalización de identidades demo: actores afectados y plan de cambios

**Versión:** 1.0  
**Fecha:** 2026-08-08  
**Estado:** STOP PARCIAL — pendiente aprobación antes de ejecutar SQL  
**Commit base:** e9278ce

---

## 1. Principios de diseño (reglas aprobadas)

| Regla | Descripción |
|-------|------------|
| Sin marcas reales | No usar OBRAMAT, SALTOKI, SONEPAR, ARISTON, DAIKIN, WÜRTH, NOVELEC, etc. |
| Demo explícita | Todos los precios, stock, plazos y métricas son ficticios y coherentes internamente |
| IDs y slugs técnicos conservados | No se cambian los UUID ni los `supplier_key` que romperían relaciones FK |
| Solo la identidad visible cambia | `nombre`, `supplier_name`, materiales de marketing — nunca IDs ni FKs |
| Ecosistema completo | Ningún proveedor demo sin catálogo, ningún catálogo sin offerings |

---

## 2. Estado actual de actores Marketplace

| Actor | Slug | Offerings | Matched | Pending | Valoración |
|-------|------|-----------|---------|---------|-----------|
| Obras y Materiales S.L. | obramat-demo | 231 | 36 | 195 | ✅ Nombre correcto; 195 pending sin UP |
| Suministros Técnicos Norte S.L. | suministros-tecnicos-norte | 19 | 18 | 1 | ⚠️ Nombre provisional — ver §5 |
| ElectroSuministros Cantábrico S.L. | electrosuministros-cantabrico | 6 | 6 | 0 | ⚠️ Nombre provisional — ver §5 |
| Revestimientos y Obra Norte S.L. | revestimientos-obra-norte | 5 | 5 | 0 | ✅ Nombre correcto; catálogo escaso |
| Carpintería y Cerramientos Norte S.L. | carpinteria-cerramientos-norte | 3 | 3 | 0 | ✅ Nombre correcto; catálogo escaso |
| Pinturas Profesionales del Norte S.L. | pinturas-profesionales-norte | 2 | 2 | 0 | ✅ Nombre correcto; catálogo escaso |
| TrabFlow | trabflow-platform | 0 | 0 | 0 | ℹ️ Actor de plataforma; no proveedor |

**Total offerings matched:** 70 (en 6 proveedores comerciales)

---

## 3. Catálogos legacy con marcas reales — acción requerida

Estos `supplier_name` aparecen en BD y deben ser actualizados a identidades demo:

| Catalog ID | supplier_key | Nombre actual (MARCA REAL) | Nombre demo propuesto | Prods | Familias principales |
|-----------|-------------|--------------------------|----------------------|-------|---------------------|
| `47fb567e` | saltoki | **Saltoki** | Fontanería Saltos Quiroga S.L. | 170 | Fontanería 32, ACS 20, Electricidad 18, Grifería 15, Calefacción 15, Tuberías 15, Sanitarios 15 |
| `b567e38f` | wurth | **Würth** | Suministros de Obra Norte S.L.* | 85 | Tornillería 13, Química 13, Herramienta 13, Abrasivos 10, EPIs 10, Fijaciones 10 |
| `ff706aad` | sonepar | **Sonepar** | ElectroDistribución Cantábrica S.L. | 76 | Mecanismos 15, Cables 15, Protecciones 15, Canalizaciones 13, Luminaria 12 |
| `52d022a9` | novelec | **Novelec** | Electromat Norte S.L.* | 71 | Protecciones 15, Cables 15, Mecanismos 15, Luminaria 12, Canalizaciones 10 |
| `b0be1e72` | bricomart | **Bricomart Pro** | Materiales y Obras del Norte S.L.* | 65 | Construcción 14, Estructura 8, Pintura 5, Cubierta 5, Electricidad 5 |
| `7886cb1f` | rexel | **Rexel** | Instalaciones Eléctricas Norte S.L.* | 60 | Cables 14, Mecanismos 12, Protecciones 12, Luminaria 10 |
| `e3b713b6` | saunier_duval | **Saunier Duval** | → fusionar en Sistemas Térmicos | 48 | Radiadores 10, Calderas 10, ACS 5, Bomba de calor 3 |
| `d4b75832` | daikin | **Daikin** | → fusionar en Sistemas Térmicos | 46 | Split inverter 10, Aerotermia 7, Multi-split 7, VRV 4 |
| `ab423976` | baxi | **Baxi** | → fusionar en Sistemas Térmicos | 24 | Calderas 8, ACS 6, Accesorios 5 |
| `b91fbef0` | ariston | **Ariston** | → fusionar en Sistemas Térmicos | 23 | ACS 7, Calderas 5, Bomba de calor 4 |
| `a61e468f` | junkers | **Junkers / Bosch** | → fusionar en Sistemas Térmicos | 23 | ACS 7, Calderas 6, Accesorios 5 |
| `e2806c86` | vaillant | **Vaillant** | → fusionar en Sistemas Térmicos | 22 | Calderas 7, Bomba de calor 4, ACS 3 |

> *Nombres con asterisco requieren aprobación — no están en la lista del spec. Propuestos como neutrales y coherentes con la región Cantabria.

**Volumen total con marca real en BD:** 713 referencias en 12 catálogos

---

## 4. Mapeo oficial aprobado (del spec)

| Marca real | Identidad demo aprobada | Especialidad |
|-----------|------------------------|-------------|
| OBRAMAT | Obras y Materiales S.L. | Construcción y reforma |
| SALTOKI | Fontanería Saltos Quiroga S.L. | Fontanería y climatización |
| SONEPAR | ElectroDistribución Cantábrica S.L. | Electricidad e iluminación |
| ARISTON | Sistemas Térmicos del Norte S.L. | ACS, aerotermia, climatización |

**Marcas sin mapeo explícito en el spec** (pendientes de decisión):
- WÜRTH, NOVELEC, BRICOMART PRO, REXEL, DAIKIN, BAXI, JUNKERS, VAILLANT, SAUNIER DUVAL

---

## 5. Decisiones de arquitectura pendientes (bloquean ejecución)

### Decisión 1: Suministros Técnicos Norte vs Fontanería Saltos Quiroga

**Situación:** Existe "Suministros Técnicos Norte S.L." (STN) con catálogo propio y 18 offerings matched para fontanería. El spec dice que el catálogo Saltoki (170 prods de fontanería) pasa a llamarse "Fontanería Saltos Quiroga S.L."

| Opción | Descripción | Pros | Contras |
|--------|------------|------|---------|
| **A** | Renombrar STN → "Fontanería Saltos Quiroga S.L." + crear actor nuevo para catálogo Saltoki | Dos actores de fontanería (competencia real) | Nombres similares confusos |
| **B** | Renombrar STN → "Fontanería Saltos Quiroga S.L." + vincular también catálogo Saltoki | Actor único con catálogo rico | Un actor no puede tener dos catálogos legacy sin refactor |
| **C** | Mantener STN como está + crear actor nuevo "Fontanería Saltos Quiroga" vinculado a Saltoki | Claridad de identidades separadas | Dos actores de fontanería, STN queda con nombre provisional |

**Recomendación:** Opción C — STN como actor especializado en grifería premium, Fontanería Saltos Quiroga como distribuidor general de fontanería.

### Decisión 2: ElectroSuministros vs ElectroDistribución Cantábrica

**Situación:** El actor existente se llama "ElectroSuministros Cantábrico S.L." El spec asigna "ElectroDistribución Cantábrica S.L." a Sonepar (catálogo sin actor).

| Opción | Descripción |
|--------|------------|
| **A** | Renombrar actor existente + vincular catálogo Sonepar | Nombre en el spec; un actor; implica cambio de slug |
| **B** | Mantener "ElectroSuministros" para el actor existente + crear "ElectroDistribución Cantábrica" para Sonepar | Dos actores eléctricos con nombres diferenciados |

**Recomendación:** Opción B — dos actores eléctricos diferenciados muestran competencia real en el demo.

### Decisión 3: HVAC brands (Daikin, Ariston, Saunier Duval, etc.) → Sistemas Térmicos del Norte

**Situación:** 6 catálogos de marcas HVAC (186 referencias) sin actor. El spec propone "Sistemas Térmicos del Norte S.L." para ACS, aerotermia y climatización.

| Opción | Descripción |
|--------|------------|
| **A** | Crear UN actor "Sistemas Térmicos" con UN catálogo nuevo → traspasar productos seleccionados de los 6 HVAC | Ecosistema limpio, un proveedor demo claro |
| **B** | Dejar los 6 catálogos HVAC como legacy sin actor + crear "Sistemas Térmicos" vacío con catálogo propio | No reutiliza datos legacy; hay que crear productos desde cero |

**Recomendación:** Opción A — crear actor + catálogo nuevo, migrar los productos HVAC más representativos (no los 186, sino ~30-40 representativos por familia).

---

## 6. Cambios propuestos en BD (pendientes aprobación — NO ejecutados)

### 6.1 UPDATE supplier_name en trade_supplier_catalogs (marcas → demo)

```sql
-- REQUIERE APROBACIÓN ANTES DE EJECUTAR
UPDATE public.trade_supplier_catalogs SET supplier_name = 'Fontanería Saltos Quiroga S.L.'
  WHERE supplier_key = 'saltoki';

UPDATE public.trade_supplier_catalogs SET supplier_name = 'ElectroDistribución Cantábrica S.L.'
  WHERE supplier_key = 'sonepar';

-- Nombres provisionales para el resto (pendientes de aprobación):
UPDATE public.trade_supplier_catalogs SET supplier_name = 'Sistemas Térmicos del Norte S.L.'
  WHERE supplier_key IN ('ariston', 'saunier_duval', 'daikin', 'baxi', 'junkers', 'vaillant');
```

### 6.2 INSERT nuevos actores Marketplace

```sql
-- Actor: Fontanería Saltos Quiroga S.L. (vinculado a catálogo Saltoki)
-- REQUIERE APROBACIÓN
INSERT INTO public.trade_marketplace_actors (nombre, slug, estado, supplier_catalog_id)
VALUES (
  'Fontanería Saltos Quiroga S.L.',
  'fontaneria-saltos-quiroga',
  'active',
  '47fb567e-8ce9-4ee1-b5ec-a7aae3a05162'  -- catálogo Saltoki
);

-- Actor: ElectroDistribución Cantábrica S.L. (vinculado a catálogo Sonepar)
-- REQUIERE APROBACIÓN
INSERT INTO public.trade_marketplace_actors (nombre, slug, estado, supplier_catalog_id)
VALUES (
  'ElectroDistribución Cantábrica S.L.',
  'electrodistribucion-cantabrica',
  'active',
  'ff706aad-1e20-437f-83dd-1382468c980e'  -- catálogo Sonepar
);

-- Actor: Sistemas Térmicos del Norte S.L. (catálogo nuevo — crear primero)
-- REQUIERE APROBACIÓN + creación previa del catálogo
INSERT INTO public.trade_marketplace_actors (nombre, slug, estado, supplier_catalog_id)
VALUES (
  'Sistemas Térmicos del Norte S.L.',
  'sistemas-termicos-norte',
  'active',
  '<nuevo-catalog-id>'  -- a crear en la migración
);
```

---

## 7. Proveedores objetivo y estado tras los cambios

| # | Proveedor demo | Catálogo fuente | Prods legacy | Offerings matched | Estado |
|---|---------------|----------------|-------------|------------------|--------|
| 1 | Obras y Materiales S.L. | obramat (`280c05e5`) | 178 | 36 | ✅ Activo |
| 2 | Fontanería Saltos Quiroga S.L. | saltoki (`47fb567e`) | 170 | 0 → ⏳ | ❌ Actor inexistente |
| 3 | ElectroDistribución Cantábrica S.L. | sonepar (`ff706aad`) | 76 | 0 → ⏳ | ❌ Actor inexistente |
| 4 | Revestimientos y Obra Norte S.L. | demo propio (`6ea37e62`) | 0 | 5 | ✅ Activo (escaso) |
| 5 | Pinturas Profesionales del Norte S.L. | demo propio (`5c72b86b`) | 0 | 2 | ✅ Activo (escaso) |
| 6 | Carpintería y Cerramientos Norte S.L. | demo propio (`9907af28`) | 0 | 3 | ✅ Activo (escaso) |
| 7 | Sistemas Térmicos del Norte S.L. | nuevo catálogo | 186 (HVAC fusión) | 0 → ⏳ | ❌ Actor inexistente |

**Actores demo existentes no en la lista objetivo de 7:**
- Suministros Técnicos Norte S.L. → mantener (fontanería premium, complementa a Fontanería Saltos)
- ElectroSuministros Cantábrico S.L. → mantener (electricidad doméstica, complementa a ElectroDistribución)
- TrabFlow → mantener como actor plataforma (sin catálogo de venta)

---

## 8. Riesgos identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| Nombre "Fontanería Saltos Quiroga" suena a empresa real | Media | Confusión legal | Añadir "(Demo)" o "— Demo" en descripciones internas; no en nombre visible |
| Sonepar/Novelec/Rexel tienen catálogos de electricidad solapados | Alta | Duplicidad de UPs | Limpiar duplicados antes de crear offerings; usar un solo actor por UP |
| HVAC brands tienen 186 prods con marca real visible en UI | Cierta (si aparecen en búsquedas) | Exposición de marca | Actualizar supplier_name inmediatamente (bajo riesgo técnico) |
| Crear actor para Saltoki sin offerings matched → proveedor vacío | Cierta | Demo incompleta | Crear mínimo 10 offerings matched antes de mostrar el actor en demo |
| STN y Fontanería Saltos: nombres similares, confusión de roles | Media | UX confusa en demo | Definir taglines distintos que diferencien claramente los roles |
| Würth, Novelec, Bricomart, Rexel sin identidad aprobada | Alta | Marcas reales en BD | Aprobar nombres demo o dejar sin actor hasta decisión |

---

## 9. Resumen de acciones (para aprobación)

| Acción | Tipo | Volumen | Estado |
|--------|------|---------|--------|
| UPDATE supplier_name en catálogos Saltoki, Sonepar, HVAC×6 | SQL UPDATE | 8 registros | ⏳ Pendiente aprobación |
| Aprobar nombres demo para Würth, Novelec, Bricomart, Rexel | Decisión | 4 nombres | ⏳ Pendiente aprobación |
| INSERT actor "Fontanería Saltos Quiroga S.L." | SQL INSERT | 1 actor | ⏳ Pendiente aprobación |
| INSERT actor "ElectroDistribución Cantábrica S.L." | SQL INSERT | 1 actor | ⏳ Pendiente aprobación |
| INSERT actor + catálogo "Sistemas Térmicos del Norte S.L." | SQL INSERT×2 | 1 actor + 1 catálogo | ⏳ Pendiente aprobación |
| Resolver Decisión 1 (STN vs Fontanería Saltos) | Arquitectura | — | ⏳ Pendiente aprobación |
| Resolver Decisión 2 (ElectroSuministros vs ElectroDistribución) | Arquitectura | — | ⏳ Pendiente aprobación |
| Resolver Decisión 3 (HVAC fusion approach) | Arquitectura | — | ⏳ Pendiente aprobación |
