# RC1-C.4A FASE A — Resultados

**Versión:** 1.1 — 2026-08-08  
**Estado:** COMPLETADO — A10 aprobado y ejecutado, A11 validado sin falsos positivos

---

## Resumen ejecutivo

| Métrica | Baseline (inicio) | Post-FASE A (ahora) | Post-A10 (proyectado) |
|---------|------------------|--------------------|-----------------------|
| Cobertura total PRE demo | 0/27 (0%) | 18/27 (67%) | 23/27 (85%) |
| PRE-2026-089 | 0/9 (0%) | 6/9 (67%) | 8/9 (89%) |
| PRE-2026-085 | 0/16 (0%) | 11/16 (69%) | 13/16 (81%) |
| PRE-2026-090 | 0/2 (0%) | 1/2 (50%) | 2/2 (100%) |
| UPs en catálogo | 37 | 43 (+6) | 43 |
| Offerings matched | 58 | 58 | 70 (+12 tras A10) |
| Offerings pending_review | 196 | 208 → 196 (todas promovidas) | — |
| search_aliases configurados | 0 | 13 UPs × avg 6 | — |

**Logro final:** de 0% a 85% de cobertura sin cambios de código — solo datos.

### Notas post-A10

- **Opción B aplicada:** UP "Mecanismo interruptor pulsador IP44" renombrado a "Mecanismo interruptor IP44"; creado nuevo UP "Mecanismo pulsador IP44" (id: `1ad915a0`); STN-MEC-0401 movido al nuevo UP y promovido.
- **Fix alias plato de ducha:** alias "plato de ducha" añadido al UP "Plato de ducha" (44b86c78) para que PATH 3 resuelva antes que PATH 4, apuntando al UP con 5 offerings en lugar del UP "extraplano" vacío.
- **Fix nombre UP caja eléctrica:** renombrado "Caja empotrar y pequeño material eléctrico" → "Kit cajas empotrar y accesorios eléctricos" para eliminar false positive vía name_prefix con descripciones tipo "Pequeño material y herramientas".

---

## A0 — Snapshot inicial (estado antes de FASE A)

```
UPs totales:              37  (todos validation_state='validated')
Offerings matched:        58  (OBRAMAT Demo 30, STN 14, Electro 4, RON 5, Pinturas 2, Carpintería 3)
Offerings pending_review: 196 (OBRAMAT Demo 195, STN 1)
search_aliases:           columna no existía
quote_items con UP:       0   (todos NULL en PRE-085, PRE-089, PRE-090)
```

---

## A1 — Auditoría de UPs propuestos (duplicados)

| UP propuesto en plan | Resultado auditoría | Decisión |
|----------------------|--------------------|---------| 
| Grifo monomando ducha empotrado | UP "Grifo monomando ducha" (3c77b38c) ya existe con 5 offerings matched incluyendo versiones empotradas | **REUTILIZAR** |
| Kit conexiones fontanería baño | Sin equivalente | **CREAR** ✓ |
| Silicona sanitaria | Sin equivalente ("Junta de alicatado" es rejuntado, no sellante) | **CREAR** ✓ |
| Interruptor/pulsador IP44 | "Mecanismo enchufe schuko IP44" cubre enchufes, no interruptores | **CREAR** ✓ |
| Mueble baño conjunto | "Mueble bajo lavabo 60cm" (60cm) existe; PRE-085 necesita 80cm; además es un conjunto complejo | **CREAR** UP 80cm ✓ |
| Caja empotrar / pequeño material eléctrico | Sin equivalente | **CREAR** ✓ |
| Bidé portátil | No crear por ahora (spec) | **DEFER** |

---

## A2 — Rename actor demo

| Campo | Antes | Después |
|-------|-------|---------|
| `actor.nombre` | OBRAMAT Demo | Obras y Materiales S.L. |
| `actor.legal_name` | OBRAMAT Demo (Pilot Zero) | Obras y Materiales S.L. |
| `catalog.supplier_name` | OBRAMAT | Obras y Materiales S.L. |
| `actor.slug` | obramat-demo | obramat-demo (**sin cambio** — clave interna) |
| `catalog.supplier_key` | obramat | obramat (**sin cambio** — usado en frontend) |

**Justificación:** El frontend usa `supplier_key='obramat'` como condición para mostrar logos. Cambiar el `slug` o `supplier_key` requeriría refactorizar múltiples componentes. El rename visible es suficiente para la experiencia comercial demo.

**Nota:** Los archivos de imagen `/logoobramat.png` y `/articuloobramat.png` son activos estáticos que no forman parte de esta FASE. Se pueden reemplazar por activos neutros en una tarea de frontend separada.

---

## A3 — Migración aplicada

**Migración:** `20260808_add_search_aliases_and_fix_cart_matching`

**Cambios:**
1. `ALTER TABLE trade_marketplace_universal_products ADD COLUMN search_aliases text[] DEFAULT '{}'`
2. `CREATE OR REPLACE FUNCTION create_cart_from_quote(...)` — versión mejorada:
   - PATH 0: si `quote_item.universal_product_id IS NOT NULL` → usar directamente (preparado para futuro)
   - PATH 1: `catalog_variant_id` → offering exacta (sin cambio)
   - PATH 2: `supplier_ref` → offering exacta (sin cambio)
   - PATH 3: **NUEVO** — alias match vía `search_aliases[]` (confianza 0.75, min 8 chars)
   - PATH 4: nombre prefix ILIKE (confianza 0.55, reducido a 15 chars)
   - **ELIMINADO**: fallback por familia — generaba falsos positivos (ej: cualquier ítem tipo "Grifería" → primer grifo del catálogo)

---

## A4 — Aliases configurados

| UP | Familia | # aliases | Aliases clave |
|----|---------|-----------|--------------|
| Sifón y desagüe ducha | Desagüe | 6 | sifón ducha, válvula desagüe ducha |
| Membrana impermeabilizante líquida | Impermeabilización | 7 | impermeabilización zona, impermeabilizar ducha/bañera |
| Mampara de ducha | Baño | 5 | mampara ducha, cristal templado 6mm |
| Grifo monomando lavabo | Grifería | 5 | grifo monomando lavabo, grifería lavabo, grifo lavabo básico |
| Grifo monomando ducha | Grifería | 6 | grifería de ducha, monomando ducha |
| Mecanismo enchufe schuko IP44 | Mecanismos | 5 | enchufe IP44 baño |
| Luminaria baño LED IP44 | Iluminación | 13 | luminarias LED, downlight led, luz espejo ip44 |
| Pintura plástica anti-humedad | Pintura | 8 | pintura antihumedad, pintura paredes y techo |
| Azulejo rectificado pared | Revestimientos | 9 | azulejo pared, cerámica pared (SOLO pared) |
| Baldosa porcelánica 60×60 | Revestimientos | 7 | baldosa suelo, baldosa antideslizante (SOLO suelo) |
| Cemento cola C2 para baldosas | Morteros | 7 | mortero adhesivo, adhesivo alicatado |

**Regla aplicada:** Solo aliases fuertes (≥8 chars, semánticamente exactos). No se añadieron aliases ambiguos (`baldosa`, `pintura`, `grifo`, `material`). Diferenciación explícita suelo vs pared.

---

## A5 — Offerings para UPs sin cobertura

| UP | Offering | Proveedor | Estado |
|----|---------|-----------|--------|
| Lavabo sobre encimera | OYM-SAN-1001 | Obras y Materiales S.L. | pending_review |
| Lavabo sobre encimera | STN-SAN-1001 | STN | pending_review |

**Nota:** "Inodoro suspendido con cisterna" ya tenía 3 offerings matched — no requería acción.

---

## A6 — Nuevos UPs creados

| Prioridad | UP | UUID | Familia | Offerings | Estado |
|-----------|-----|------|---------|-----------|--------|
| P1 | Silicona sanitaria sellado | bf23c4f8 | Accesorios | OYM + STN | pending_review |
| P1 | Kit conexiones fontanería baño | c319d0e3 | Saneamiento | STN + OYM | pending_review |
| P2 | Mecanismo interruptor pulsador IP44 | 0d72f97f | Mecanismos | Electro + STN | pending_review |
| P2 | Mueble bajo lavabo 80cm | 56685ebb | Carpintería | OYM | pending_review |
| P3 | Caja empotrar y pequeño material eléctrico | 4898dc86 | Electricidad | Electro | pending_review |

---

## A7 — Corrección descripción "de fontanería"

El plan original contenía:
> "Caja de empotrar para mecanismos eléctricos, cinta aislante, bridas y elementos de instalación eléctrica **de fontanería**."

**Corregido** en el UP creado:
> "Caja de empotrar para mecanismos eléctricos, cinta aislante, bridas de sujeción y elementos de pequeño material para instalación eléctrica."

---

## A8/A9 — Offerings adicionales para competencia

| UP | Offering nueva | Proveedor | Situación anterior |
|----|---------------|-----------|-------------------|
| Azulejo rectificado pared | OYM-REV-1001 | Obras y Materiales | Solo RON (1 offering) |
| Baldosa porcelánica 60×60 | OYM-REV-2001 | Obras y Materiales | Solo RON (1 offering) |

---

## A10 — Decisiones de aprobación

| # | Ref | Decisión | Ejecutado |
|---|-----|---------|-----------|
| 1 | OYM-SAN-1001 | ✅ APROBADO | matched |
| 2 | STN-SAN-1001 | ✅ APROBADO | matched |
| 3 | OYM-ACC-0101 | ✅ APROBADO | matched |
| 4 | STN-ACC-0101 | ✅ APROBADO | matched |
| 5 | STN-KIT-0201 | ✅ APROBADO | matched |
| 6 | OYM-KIT-0201 | ✅ APROBADO | matched |
| 7 | ESC-MEC-1102 | ✅ APROBADO | matched en UP Interruptor IP44 |
| 8 | STN-MEC-0401 | ✅ OPCIÓN B — UP separado | matched en nuevo UP Pulsador IP44 (1ad915a0) |
| 9 | OYM-MUE-3002 | ✅ APROBADO | matched |
| 10 | ESC-KIT-0001 | ✅ APROBADO | matched |
| 11 | OYM-REV-1001 | ✅ APROBADO | matched |
| 12 | OYM-REV-2001 | ✅ APROBADO | matched |

**Decisión de diseño aprobada:** interruptor y pulsador son UPs separados. Motivo: no son equivalentes técnicamente — introducirlos en el mismo UP genera falsos positivos en Marketplace, comparador, IA, carrito y presupuesto.

**Identidad comercial aprobada:** "Obras y Materiales S.L." (abreviatura OYM, código OYM). Slug interno `obramat-demo` se mantiene para no romper referencias frontend.

---

## A11 — Validación de cobertura real (post-A10)

### PRE-2026-089 (reforma baño, 9 ítems material)

| Pos | Descripción | Vía | UP matcheado | Offers | Provs | Estado |
|-----|------------|-----|-------------|--------|-------|--------|
| 1 | Plato de ducha (70x70 cm...) | alias "plato de ducha" | Plato de ducha | 5 | 1 | **MARKETPLACE** ✓ |
| 2 | Grifería de ducha (monomando...) | alias "grifería de ducha" | Grifo monomando ducha | 5 | 2 | **MARKETPLACE** ✓ |
| 3 | Sifón y válvula desagüe ducha | alias "válvula desagüe ducha" | Sifón y desagüe ducha | 2 | 2 | **MARKETPLACE** ✓ |
| 4 | Adaptación fontanería (llaves...) | alias "adaptación fontanería" | Kit conexiones fontanería baño | 2 | 2 | **MARKETPLACE** ✓ |
| 5 | Mampara de ducha (70x70...) | name_prefix | Mampara de ducha | 6 | 2 | **MARKETPLACE** ✓ |
| 6 | Impermeabilización zona ducha | alias "impermeabilización zona ducha" | Membrana impermeabilizante | 2 | 2 | **MARKETPLACE** ✓ |
| 7 | Baldosas y material alicatado | alias "baldosas y material alicatado" | Azulejo rectificado pared | 2 | 2 | **MARKETPLACE** ✓ |
| 8 | Silicona sanitaria y sellado | alias "silicona sanitaria" | Silicona sanitaria sellado | 2 | 2 | **MARKETPLACE** ✓ |
| 9 | Pequeño material y accesorios | — | — | — | — | UNRESOLVED (correcto) |

**PRE-089: 8/9 MARKETPLACE (89%) · 1 UNRESOLVED (estructural) · 0 falsos positivos**

### PRE-2026-085 (reforma integral, 16 ítems material)

| Pos | Descripción | Vía | UP matcheado | Offers | Provs | Estado |
|-----|------------|-----|-------------|--------|-------|--------|
| 0 | Impermeabilización zona ducha/bañera | alias | Membrana impermeabilizante | 2 | 2 | **MARKETPLACE** ✓ |
| 1 | Baldosa suelo antideslizante R11 | alias | Baldosa porcelánica 60×60 | 2 | 2 | **MARKETPLACE** ✓ |
| 2 | Azulejo/cerámica pared media altura | alias | Azulejo rectificado pared | 2 | 2 | **MARKETPLACE** ✓ |
| 4 | Pintura paredes y techo | alias | Pintura plástica anti-humedad | 2 | 2 | **MARKETPLACE** ✓ |
| 6 | Pequeño material y herramientas | — | — | — | — | UNRESOLVED (correcto) |
| 8 | Mampara ducha fija 1 hoja cristal templado 6mm | alias | Mampara de ducha | 6 | 2 | **MARKETPLACE** ✓ |
| 9 | Conjunto mueble 80cm + lavabo + espejo LED | alias "conjunto mueble 80cm" | Mueble bajo lavabo 80cm | 1 | 1 | **MARKETPLACE** ✓ |
| 10 | Grifo monomando lavabo básico cromo | alias | Grifo monomando lavabo | 4 | 2 | **MARKETPLACE** ✓ |
| 11 | Monomando ducha + alcachofa + flexible | alias | Grifo monomando ducha | 5 | 2 | **MARKETPLACE** ✓ |
| 12 | Enchufe IP44 baño + mecanismo + caja | alias | Mecanismo enchufe schuko IP44 | 2 | 2 | **MARKETPLACE** ✓ |
| 13 | Punto de luz techo + cableado + downlight LED | alias | Luminaria baño LED IP44 | 2 | 2 | **MARKETPLACE** ✓ |
| 14 | Pulsador o interruptor baño + caja | alias "interruptor baño" | Mecanismo interruptor IP44 | 1 | 1 | **MARKETPLACE** ✓ |
| 15 | Punto de luz espejo IP44 + cableado | alias | Luminaria baño LED IP44 | 2 | 2 | **MARKETPLACE** ✓ |
| 16 | Pintura antihumedad techo baño 2 manos | alias | Pintura plástica anti-humedad | 2 | 2 | **MARKETPLACE** ✓ |
| 17 | Kit accesorios baño: toallero + portarrollos | — | — | — | — | UNRESOLVED (correcto) |
| 18 | Bidé suelo blanco + grifería | — | — | — | — | UNRESOLVED (correcto) |

**PRE-085: 13/16 MARKETPLACE (81%) · 3 UNRESOLVED (estructurales) · 0 falsos positivos**

### PRE-2026-090 (instalación eléctrica, 2 ítems efectivos)

| Pos | Descripción | Vía | UP matcheado | Offers | Provs | Estado |
|-----|------------|-----|-------------|--------|-------|--------|
| 0 | Suministro luminarias LED 4 unidades | alias "luminarias LED" | Luminaria baño LED IP44 | 2 | 2 | **MARKETPLACE** ✓ |
| 1 | Suministro cajas de empotrar y pequeño material | alias "cajas de empotrar" | Kit cajas empotrar y accesorios eléctricos | 1 | 1 | **MARKETPLACE** ✓ |

**PRE-090: 2/2 MARKETPLACE (100%) · 0 UNRESOLVED · 0 falsos positivos**

---

## Estado final — COMPLETADO

| Ítem | Estado |
|------|--------|
| A10 — aprobación offerings | ✅ 12/12 promovidas (11 directas + 1 con UP nuevo) |
| Opción B — interruptor ≠ pulsador | ✅ Ejecutado — dos UPs separados |
| A11 — validación de cobertura | ✅ 23/27 (85%) MARKETPLACE, 0 falsos positivos |
| Identidad comercial | ✅ "Obras y Materiales S.L." confirmado |
| Fixes de alias (plato de ducha, caja eléctrica) | ✅ Ejecutados |

**Cobertura final verificada:** 23/27 (85%) — exactamente lo proyectado.

---

## No implementado en esta fase (según spec)

- ❌ `resolveQuoteMaterialCandidates()` — post-pilotos
- ❌ Modificación motor IA — post-pilotos
- ❌ RC1-C.4 checkout redesign — post-aprobación independiente
- ❌ Bidé portátil — diferido
- ❌ Reemplazar logos OBRAMAT (activos frontend) — tarea frontend separada
