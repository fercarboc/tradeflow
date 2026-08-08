# B0.5 — Auditoría del catálogo legacy: 891 referencias

**Versión:** 1.0  
**Fecha:** 2026-08-08  
**Estado:** STOP PARCIAL — entrega pre-migración  
**Autor:** RC1-C.4B preparación

---

## 1. Resumen ejecutivo

| Métrica | Valor |
|---------|-------|
| Total referencias legacy (`trade_supplier_products`) | **891** |
| Proveedores distintos | **13** |
| Proveedores con actor Marketplace activo | **1** (Obras y Materiales S.L.) |
| Proveedores sin actor Marketplace | **12** |
| Cobertura Catálogo → Marketplace (hoy) | **2.7%** (18/672) |
| Cobertura objetivo (fase B0.5) | definir tras aprobación humana |

El catálogo legacy cubre 13 proveedores. Solo Obras y Materiales S.L. (obramat) tiene actor Marketplace activo. El 97.3% de los productos comerciales no es comprable hoy.

---

## 2. Clasificación de los 891 productos

### 2.1 Categorías

| Categoría | Descripción | Count | % |
|-----------|-------------|-------|---|
| **A_MARKETPLACE_READY** | Offering `matched` + UP vinculado + actor activo | 18 | 2.0% |
| **B_MARKETPLACE_MAPPABLE** | UP ya existe, offering `pending_review` (solo promoción) | 1 | 0.1% |
| **C_UP_REQUIRED** | Producto comercial sin UP (necesita UP + offering) | 653 | 73.3% |
| **D_LEGACY_DUPLICATE** | HVAC de marca sin actor Marketplace (correcto como legacy) | 186 | 20.9% |
| **E_NON_MARKETPLACE** | Herramientas / EPIs — no pertenecen al catálogo B2B | 33 | 3.7% |
| **TOTAL** | | **891** | 100% |

### 2.2 Matriz proveedor × categoría

| Proveedor | Catalog ID | Actor | A | B | C | D | E | Total |
|-----------|-----------|-------|---|---|---|---|---|-------|
| Obras y Materiales S.L. | `280c05e5` | ✅ `85e73234` | 18 | 1 | 159 | — | — | **178** |
| Saltoki | `saltoki-xxx` | ❌ — | — | — | 170 | — | — | **170** |
| Würth | `wurth-xxx` | ❌ — | — | — | 62 | — | 23 | **85** |
| Sonepar | `sonepar-xxx` | ❌ — | — | — | 76 | — | — | **76** |
| Novelec | `novelec-xxx` | ❌ — | — | — | 71 | — | — | **71** |
| Bricomart Pro | `bricomart-xxx` | ❌ — | — | — | 55 | — | 10 | **65** |
| Rexel | `rexel-xxx` | ❌ — | — | — | 60 | — | — | **60** |
| Saunier Duval | — | ❌ — | — | — | — | 48 | — | **48** |
| Daikin | — | ❌ — | — | — | — | 46 | — | **46** |
| Baxi | — | ❌ — | — | — | — | 24 | — | **24** |
| Junkers/Bosch | — | ❌ — | — | — | — | 23 | — | **23** |
| Ariston | — | ❌ — | — | — | — | 23 | — | **23** |
| Vaillant | — | ❌ — | — | — | — | 22 | — | **22** |
| **TOTAL** | | | **18** | **1** | **653** | **186** | **33** | **891** |

> Würth C = 85 − 23 (herramienta) = 62; Bricomart C = 65 − 10 (EPIs) = 55.

---

## 3. Detalle: Obramat 160 pending_review

Los 160 productos obramat con offering `pending_review` se desglosan así:

| Familia | N | Con UP hoy | Reclasificación |
|---------|---|-----------|----------------|
| Electricidad | 18 | 0 | C_UP_REQUIRED |
| Pintura | 15 | 0 | C_UP_REQUIRED |
| Suelos | 15 | 0 | C_UP_REQUIRED |
| Revestimientos | 15 | 0 | C_UP_REQUIRED |
| Ferretería | 15 | 0 | C_UP_REQUIRED |
| Fontanería | 14 | **1** | 1×B + 13×C |
| Madera | 10 | 0 | C_UP_REQUIRED |
| Cubiertas | 10 | 0 | C_UP_REQUIRED |
| ACS | 10 | 0 | C_UP_REQUIRED |
| Climatización | 9 | 0 | C_UP_REQUIRED |
| Cerraduras | 8 | 0 | C_UP_REQUIRED |
| Construcción | 8 | 0 | C_UP_REQUIRED |
| Antenas | 8 | 0 | C_UP_REQUIRED |
| Aislamiento | 5 | 0 | C_UP_REQUIRED |
| **TOTAL** | **160** | **1** | 1×B + 159×C |

**El único B (OBR-FON-010):** "Sifón botella bañera 1 1/2″ PVC" — ya vinculado a UP `8a235fa5` (Sifón y desagüe ducha, `validated`). Solo necesita que su offering sea promovida de `pending_review` a `matched`.

---

## 4. Candidatos a mapeo rápido sin nuevas UPs

El análisis de similitud textual (`pg_trgm similarity > 0.3`) sobre los 159 obramat C sin UP identifica **15 productos** que podrían vincularse a UPs existentes. Todos requieren validación humana antes de enlazarse.

| Ref | Descripción legacy | UP candidato | Sim. | Nota |
|-----|-------------------|-------------|------|------|
| OBR-ACS-008 | Válvula de seguridad 3 bar 3/4" | Válvula de seguridad | **0.72** | Buen match |
| OBR-ELE-011 | Mecanismo enchufe schuko 16A blanco | Mecanismo enchufe schuko IP44 | 0.60 | ⚠️ Legacy NO es IP44 |
| OBR-CON-007 | Imprimación selladora multisoporte 5L | Imprimación selladora | 0.58 | Buen match |
| OBR-FON-018 | Lavabo sobre encimera oval porcelana blanca | Lavabo sobre encimera | 0.51 | Buen match |
| OBR-CUB-104 | Membrana impermeabilizante EPDM 1.5mm | Membrana impermeabilizante líquida | 0.48 | ⚠️ EPDM ≠ líquida (tipo diferente) |
| OBR-FON-022 | Tubo cobre 22mm rollo 25m | Tubo cobre | 0.44 | Buen match (variante) |
| OBR-FON-021 | Tubo cobre 18mm rollo 25m | Tubo cobre | 0.42 | Buen match (variante) |
| OBR-ELE-002 | Cable H07V-K 1,5mm² azul bobina 100m | Cable eléctrico H07V-K 1,5mm² | 0.42 | Buen match (variante) |
| OBR-ELE-003 | Cable H07V-K 2,5mm² negro bobina 100m | Cable eléctrico H07V-K 1,5mm² | 0.38 | Variante distinta sección |
| OBR-PIN-106 | Pintura antihumedad fachadas blanca 15L | Pintura plástica anti-humedad | 0.38 | Buen match |
| OBR-CON-003 | Silicona neutra sanitaria blanca 300ml | Silicona sanitaria sellado | 0.40 | Buen match |
| OBR-FON-019 | Tubería multicapa PEX-AL-PEX 16mm rollo 50m | Tubo multicapa | 0.31 | Buen match (variante) |
| OBR-FON-020 | Tubería multicapa PEX-AL-PEX 20mm rollo 50m | Tubo multicapa | 0.31 | Buen match (variante) |
| OBR-ELE-001 | Cable H07V-K 1,5mm² amarillo-verde bobina 100m | Cable eléctrico H07V-K 1,5mm² | 0.35 | Variante tierra |
| OBR-ELE-004 | Cable H07V-K 4mm² negro bobina 100m | Cable eléctrico H07V-K 1,5mm² | 0.31 | Variante distinta sección |

**Falsos positivos confirmados en la lista:**
- `OBR-ELE-011`: enchufe estándar (16A, sin IP44) ≠ UP "schuko IP44". **No vincular.**
- `OBR-CUB-104`: membrana EPDM de rollo ≠ UP "membrana líquida". **No vincular** sin crear UP separado "Membrana impermeabilizante EPDM".

**Candidatos buenos (pendiente validación humana):** OBR-ACS-008, OBR-CON-007, OBR-FON-018, tubo cobre (2 vars), cables H07V-K (3 vars como variantes del mismo UP), silicona, pintura antihumedad, tubería multicapa (2 vars).

---

## 5. Cobertura Marketplace real

### Métrica de cobertura

```
Denominador = total − E_NON_MARKETPLACE − D_LEGACY_DUPLICATE
            = 891 − 33 − 186 = 672 productos comerciales

Numerador  = A_MARKETPLACE_READY = 18

Cobertura  = 18 / 672 = 2.68% ≈ 2.7%
```

### Proyección si se ejecuta la propuesta de migración

| Acción | Productos activados | Cobertura acumulada |
|--------|-------------------|---------------------|
| Hoy (base) | 18 | **2.7%** |
| + Promover OBR-FON-010 (B→A) | +1 | 2.8% |
| + Mapear 10 candidatos validados a UPs existentes | +10 | 4.3% |
| + Crear UPs para 149 obramat C restantes (estimado 6 meses) | +149 | 26.5% |
| + Crear actores + UPs para Saltoki (170) | +170 | 51.8% |
| + Crear actores + UPs para resto proveedores (334) | +334 | 101% → cap 100% |

**La cobertura ≥50% requiere incorporar Saltoki al Marketplace.** Solo obramat llega al ~26%.

---

## 6. Propuesta de migración por proveedor

### Grupo 1: Acción inmediata (sin bloqueos)

| Proveedor | Acción | Volumen | Esfuerzo |
|-----------|--------|---------|---------|
| Obramat | Promover OBR-FON-010 pending→matched | 1 offering | 5 min admin |
| Obramat | Validar y vincular candidatos de mapeo rápido | ~10 productos | 1h admin |
| Obramat | Crear UPs para 149 productos C restantes | ~60-80 UPs nuevos* | 40-60h admin |

> *Los 149 productos no son 149 UPs distintos — muchos son variantes (cables por sección, tubos por diámetro). Estimación: ~60-80 UPs únicos.

### Grupo 2: Requiere actor Marketplace (pre-Fase 3)

| Proveedor | Acción previa | Productos | Tiempo estimado |
|-----------|--------------|---------|----------------|
| Saltoki | Crear actor Marketplace + catálogo | 170 | 8h setup + 80h UPs/offerings |
| Sonepar | Crear actor Marketplace + catálogo | 76 | 4h setup + 40h |
| Novelec | Crear actor Marketplace + catálogo | 71 | 4h setup + 38h |
| Würth (comercial) | Crear actor Marketplace + catálogo | 62 | 4h setup + 32h |
| Rexel | Crear actor Marketplace + catálogo | 60 | 4h setup + 30h |
| Bricomart Pro (comercial) | Crear actor Marketplace + catálogo | 55 | 4h setup + 28h |

**Total Grupo 2: 494 productos, estimado 120h de trabajo de datos.**  
Recomendación: diferir a Marketplace Fase 3 (catálogo libre sin presupuesto obligatorio).

### Grupo 3: Sin acción (mantener legacy)

| Proveedor | Motivo | Count |
|-----------|--------|-------|
| Saunier Duval, Daikin, Baxi, Junkers, Ariston, Vaillant | HVAC de marca, no reemplazable por genérico Marketplace | 186 |
| Würth (herramienta), Bricomart (EPIs) | No son productos de venta B2B en marketplace | 33 |

---

## 7. Volumen de nuevas UPs y offerings necesarias

### Para activar solo obramat (Grupo 1 completo)

| Categoría | UPs nuevos estimados | Offerings nuevas | Notas |
|-----------|---------------------|-----------------|-------|
| Electricidad (18 prods) | 6-8 UPs | 18 offerings | cables = 1 UP + variantes |
| Fontanería (13 prods C + 1 B) | 5-7 UPs | 14 offerings | tubos = 1 UP + variantes |
| Pintura (15 prods) | 4-5 UPs | 15 offerings | |
| Suelos (15 prods) | 4-5 UPs | 15 offerings | |
| Revestimientos (15 prods) | 4-5 UPs | 15 offerings | |
| Ferretería (15 prods) | 6-8 UPs | 15 offerings | |
| Madera (10 prods) | 4-5 UPs | 10 offerings | |
| Cubiertas (10 prods) | 4-5 UPs | 10 offerings | |
| ACS (10 prods) | 4-5 UPs | 10 offerings | |
| Climatización (9 prods) | 3-4 UPs | 9 offerings | |
| Cerraduras (8 prods) | 4-5 UPs | 8 offerings | |
| Construcción (8 prods) | 3-4 UPs | 8 offerings | |
| Antenas (8 prods) | 3-4 UPs | 8 offerings | |
| Aislamiento (5 prods) | 2-3 UPs | 5 offerings | |
| **TOTAL obramat** | **~56-73 UPs nuevos** | **~160 offerings** | |

### Para activar todos los C (Grupos 1+2)

| Grupo | UPs nuevos | Offerings nuevas | Actores nuevos |
|-------|-----------|-----------------|---------------|
| Obramat (Grupo 1) | ~65 | ~160 | 0 (ya tiene actor) |
| Otros 6 proveedores (Grupo 2) | ~200* | ~494 | 6 |
| **TOTAL** | **~265 UPs** | **~654 offerings** | **6** |

> *Muchos UPs de Saltoki/Sonepar/Würth/Novelec son los mismos productos que obramat (distintos proveedores para el mismo UP). El recuento real podría ser 100-150 UPs únicos nuevos si se hace un proceso de deduplicación.

---

## 8. Riesgos identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| **Falsos positivos en mapeo rápido** (ej. enchufe estándar ≠ IP44) | Alta sin revisión humana | Catálogo incorrecto en Marketplace | Validación humana obligatoria de TODOS los candidatos de similitud antes de vincular |
| **Variantes confundidas como UPs distintos** (cables por sección) | Alta en proceso manual | Duplicidad de UPs, inconsistencia | Crear UPs con variantes explícitas (sección mm², diámetro, etc.) antes de crear offerings |
| **Membrana EPDM ≠ membrana líquida** | Ya detectado | Categoría incorrecta para instaladores | Crear UP separado "Membrana impermeabilizante EPDM" |
| **Volumen excesivo para proceso manual** (265 UPs, 654 offerings) | Cierta | Bloqueo indefinido de la fase | Implementar RC1-C.4B resolver automático antes de escalar |
| **Precios de offerings `pending_review` desactualizados** | Media | Precio Marketplace incorrecto | Verificar `precio_profesional_neto` de las 160 offerings obramat antes de promover |
| **RLS bloqueando acceso a offerings `pending_review`** en portal proveedor | Baja (ya verificado en FASE A) | Admin no puede promover desde UI | Usar Supabase dashboard o función SQL directamente |
| **Falta de imágenes en UPs nuevos** | Alta | Experiencia visual pobre en catálogo | Añadir imagen URL al crear cada UP; priorizar los 18 A ya activos |

---

## 9. Definición de cobertura (fórmula canónica)

```
cobertura_catalogo_marketplace = 
  COUNT(productos en A_MARKETPLACE_READY) 
  / COUNT(productos con categoria IN ('A','B','C'))

= 18 / (18 + 1 + 653)
= 18 / 672
= 2.68%
```

**Exclusiones del denominador:**
- D_LEGACY_DUPLICATE (186): HVAC de marca específica, no es gap de cobertura — es portfolio distinto
- E_NON_MARKETPLACE (33): herramientas y EPIs, nunca pertenecen al catálogo Marketplace

**Exclusiones del numerador:**
- B_MARKETPLACE_MAPPABLE (1): tiene UP pero offering no está `matched` — no comprable hoy
- C_UP_REQUIRED (653): no comprable sin nuevo UP

---

## 10. Plan de acción propuesto (para aprobación)

### Fase inmediata (sin actor nuevo, sin código)

```
1. Promover OBR-FON-010 pending_review → matched  [1 SQL UPDATE, 5 min]
   → Cobertura: 2.7% → 2.8%

2. Validación humana de 15 candidatos de mapeo rápido (ver §4)  [1h admin]
   → Resultado: lista definitiva de cuáles vincular a UPs existentes

3. Vincular candidatos validados a UPs existentes  [~10 SQL UPDATEs]
   → Cobertura estimada: ~4%

4. Crear UPs para familias de obramat por orden de volumen:
   Electricidad (18) → Fontanería (13) → Pintura (15) → Suelos (15) → Revestimientos (15)
   [~65 UPs nuevos, ~30h trabajo datos]
   → Cobertura estimada: ~26%
```

### Fase diferida (post-Fase 3 aprobación)

```
5. Crear actors + catálogos para Saltoki, Sonepar, Novelec, Würth, Rexel, Bricomart
6. Crear offerings por proveedor para los UPs ya existentes
7. Crear UPs adicionales para productos sin equivalente en catálogo obramat
   → Cobertura objetivo: >60%
```

---

## 11. Queries de verificación rápida

```sql
-- Estado actual siempre actualizable
SELECT 
  CASE
    WHEN sp.familia IN ('Herramienta', 'Herramienta eléctrica', 'EPIs') THEN 'E_NON_MARKETPLACE'
    WHEN sc.supplier_key IN ('saunier_duval', 'daikin', 'baxi', 'junkers', 'ariston', 'vaillant') THEN 'D_LEGACY_DUPLICATE'
    WHEN o.match_state = 'matched' AND o.universal_product_id IS NOT NULL THEN 'A_MARKETPLACE_READY'
    WHEN o.match_state = 'pending_review' AND o.universal_product_id IS NOT NULL THEN 'B_MARKETPLACE_MAPPABLE'
    ELSE 'C_UP_REQUIRED'
  END as categoria,
  COUNT(*) as n
FROM public.trade_supplier_products sp
JOIN public.trade_supplier_catalogs sc ON sc.id = sp.catalog_id
LEFT JOIN public.trade_marketplace_supplier_offerings o 
  ON o.supplier_ref = sp.ref_proveedor AND o.supplier_catalog_id = sp.catalog_id
WHERE sp.activo = true
GROUP BY 1 ORDER BY n DESC;

-- Cobertura actual
SELECT 
  COUNT(*) FILTER (WHERE o.match_state = 'matched' AND o.universal_product_id IS NOT NULL) as ready,
  COUNT(*) FILTER (
    WHERE sp.familia NOT IN ('Herramienta', 'Herramienta eléctrica', 'EPIs')
    AND sc.supplier_key NOT IN ('saunier_duval', 'daikin', 'baxi', 'junkers', 'ariston', 'vaillant')
  ) as denominador,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE o.match_state = 'matched' AND o.universal_product_id IS NOT NULL)
    / NULLIF(COUNT(*) FILTER (
        WHERE sp.familia NOT IN ('Herramienta', 'Herramienta eléctrica', 'EPIs')
        AND sc.supplier_key NOT IN ('saunier_duval', 'daikin', 'baxi', 'junkers', 'ariston', 'vaillant')
    ), 0), 2
  ) as cobertura_pct
FROM public.trade_supplier_products sp
JOIN public.trade_supplier_catalogs sc ON sc.id = sp.catalog_id
LEFT JOIN public.trade_marketplace_supplier_offerings o 
  ON o.supplier_ref = sp.ref_proveedor AND o.supplier_catalog_id = sp.catalog_id
WHERE sp.activo = true;
```

---

## 12. Documentos relacionados

| Documento | Relación |
|-----------|---------|
| `RC1_C4A_PHASE_A_RESULTS.md` | Cobertura Presupuesto→Marketplace (85% en 3 PREs) — métrica distinta |
| `MARKETPLACE_DEMO_CATALOG_AUDIT.md` | Auditoría UPs comprables (perspectiva catálogo demo, no legacy) |
| `MARKETPLACE_RC1_SYNTHESIS.md` | Síntesis RC1, contexto de fases |
| `PRE_RC1_STN_MATCHING_MATRIX.md` | Matching de offerings STN a UPs — relacionado con la metodología |
| `CHANGELOG.md` | Registro de cambios de datos RC1-C.4A |
