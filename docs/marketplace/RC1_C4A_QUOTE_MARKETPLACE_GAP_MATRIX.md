# RC1-C.4A — Matriz Presupuesto ↔ Marketplace: gaps exactos

**Estado:** ANÁLISIS — sin cambios de datos  
**Versión:** 1.0 — 2026-08-08

---

## Leyenda de estados

| Estado | Significado |
|--------|------------|
| `MATCHED_MKT` | UP existe + offering activa + auto-matched en `create_cart_from_quote` |
| `UP_EXISTS_NOMATCH` | UP existe con offerings, pero `create_cart_from_quote` no lo está conectando (gap de texto) |
| `UP_EXISTS_NOOFFER` | UP existe pero sin offerings activas |
| `UNRESOLVED` | No hay UP adecuado en el catálogo; solo precio estimado por IA |

---

## PRE-2026-089 — Reforma de baño (3/9 matcheados)

| # | Descripción original | Tipo | Qty | Precio unit. IA | UP existente | Offering | Estado | Gap |
|---|---------------------|------|-----|----------------|-------------|---------|--------|-----|
| 1 | Plato de ducha (70x70 cm o 170x70 cm) | material | 1 | 269 € | ✓ Plato de ducha (44b86c78) | OBRAMAT Demo ✅ | `MATCHED_MKT` | — |
| 2 | Grifería de ducha monomando | material | 1 | 45 € | ⚠ Grifo monomando lavabo (7ba1e338) — lavabo ≠ ducha | OBRAMAT Demo ✅ | `MATCHED_MKT` | Match impreciso: UP es de lavabo, no de ducha |
| 3 | Sifón y válvula desagüe ducha | material | 1 | 22 € | ✓ Sifón y desagüe ducha (8a235fa5) | OBRAMAT Demo + STN ✅ | `UP_EXISTS_NOMATCH` | Texto "válvula" en descripción rompe el match |
| 4 | Adaptación fontanería (llaves escuadra, flexibles) | material | 1 | 18 € | ✗ No existe UP "kit fontanería" | — | `UNRESOLVED` | Crear UP o fusionar con saneamiento |
| 5 | Mampara de ducha (fija o abatible) | material | 1 | 285 € | ✓ Mampara de ducha (0bb256f1) | OBRAMAT Demo ✅ | `MATCHED_MKT` | — |
| 6 | Impermeabilización zona ducha | material | 1 | 38 € | ✓ Membrana impermeabilizante líquida (0f1411fd) | OBRAMAT Demo + RON ✅ | `UP_EXISTS_NOMATCH` | Texto "zona ducha" no coincide con "membrana líquida" |
| 7 | Baldosas y material alicatado | material | 1 | 120 € | ✓ Azulejo rectificado pared (exists) + Baldosa porcelánica 60×60 (exists) | RON ✅ | `UP_EXISTS_NOMATCH` | "Baldosas" es genérico; match ambiguo entre dos UPs |
| 8 | Silicona sanitaria y sellado | material | 1 | 7 € | ✗ No existe UP específico | — | `UNRESOLVED` | Crear UP "Silicona sanitaria" |
| 9 | Pequeño material y accesorios | material | 1 | 12 € | ✗ No existe UP "kit accesorio" general | — | `UNRESOLVED` | Crear UP o dejar como UNRESOLVED estructural |

**Cobertura actual:** 3/9 = 33%  
**Cobertura potencial (con corrección de text-match):** 7/9 = 78%  
**Items que requieren nuevo UP:** 2 (#4 kit fontanería, #8 silicona)  
**Items estructuralmente irresolubles:** 1 (#9 genérico — correcto como UNRESOLVED)

---

## PRE-2026-090 — Instalación eléctrica (0/2 matcheados, 1 filtrado)

| # | Descripción original | Tipo | Qty | Precio unit. IA | UP existente | Offering | Estado | Gap |
|---|---------------------|------|-----|----------------|-------------|---------|--------|-----|
| 1 | Suministro cable eléctrico H07V-K | material | 0 | — | ✓ Cable eléctrico H07V-K 1,5mm² (fab5a9af) | OBRAMAT Demo ✅ | `FILTRADO` | qty=0 → filtrado por `create_cart_from_quote` (correcto) |
| 2 | Suministro luminarias LED 4 unidades | material | 4 | 35 € | ✓ Luminaria baño LED IP44 (8373f246) | ElectroSuministros + OBRAMAT ✅ | `UP_EXISTS_NOMATCH` | "luminarias LED" vs "Luminaria baño LED IP44" — gap de texto |
| 3 | Suministro cajas de empotrar y pequeño material | material | 1 | 15 € | ✗ No hay UP "caja empotrar" standalone | — | `UNRESOLVED` | Podría mapearse a mecanismo, pero semánticamente incorrecto |

**Cobertura actual:** 0/2 (efectivos) = 0%  
**Cobertura potencial:** 1/2 = 50%  
**Items que requieren nuevo UP:** 1 (#3 caja empotrar, o agrupar con "pequeño material eléctrico")

---

## PRE-2026-085 — Reforma integral (0/16 matcheados)

| # | Descripción original | Tipo | Qty | Precio unit. IA | UP existente | Offering | Estado | Gap |
|---|---------------------|------|-----|----------------|-------------|---------|--------|-----|
| 1 | Mampara ducha fija 1 hoja cristal templado | material | 1 | 380 € | ✓ Mampara de ducha (0bb256f1) | OBRAMAT Demo ✅ | `UP_EXISTS_NOMATCH` | Texto "cristal templado" aleja del match |
| 2 | Grifo monomando lavabo básico | material | 1 | 55 € | ✓ Grifo monomando lavabo (7ba1e338) | OBRAMAT Demo ✅ | `UP_EXISTS_NOMATCH` | Match posible pero no configurado |
| 3 | Grifo monomando ducha empotrado | material | 1 | 95 € | ✗ No hay UP "grifo ducha empotrado" | — | `UNRESOLVED` | UP de grifo ducha necesario |
| 4 | Lavabo sobre encimera | material | 1 | 180 € | ✓ Lavabo cerámica suspendido (exists) | — | `UP_EXISTS_NOOFFER` | UP existe pero sin offerings activas en demo |
| 5 | Inodoro suspendido completo | material | 1 | 320 € | ✓ Inodoro suspendido compact (exists) | — | `UP_EXISTS_NOOFFER` | UP existe pero sin offerings activas en demo |
| 6 | Mueble baño conjunto | material | 1 | 450 € | ✗ No hay UP "mueble baño" | — | `UNRESOLVED` | Categoría entera sin UP |
| 7 | Baldosa suelo antideslizante R11 | material | 7.5 m² | 28 €/m² | ✓ Baldosa porcelánica 60×60 (exists) | RON ✅ | `UP_EXISTS_NOMATCH` | "R11" especificación técnica no en UP; match parcial posible |
| 8 | Azulejo/cerámica pared | material | 10 m² | 22 €/m² | ✓ Azulejo rectificado pared (exists) | RON ✅ | `UP_EXISTS_NOMATCH` | Match posible pero no configurado |
| 9 | Impermeabilización suelo y paredes | material | 1 | 85 € | ✓ Membrana impermeabilizante líquida (0f1411fd) | OBRAMAT + RON ✅ | `UP_EXISTS_NOMATCH` | Mismo caso que PRE-2026-089 #6 |
| 10 | Mortero adhesivo para alicatado | material | 5 | 18 € | ✓ Mortero adhesivo (exists) | OBRAMAT + RON ✅ | `UP_EXISTS_NOMATCH` | "alicatado" al final — match muy posible |
| 11 | Pintura paredes y techo | material | 1 | 95 € | ✓ Pintura plástica anti-humedad (exists) | OBRAMAT + PPNorte ✅ | `UP_EXISTS_NOMATCH` | Match posible |
| 12 | Pintura antihumedad techo baño | material | 1 | 45 € | ✓ Pintura plástica anti-humedad (exists) | OBRAMAT + PPNorte ✅ | `UP_EXISTS_NOMATCH` | Duplicada con #11 en esta reforma |
| 13 | Enchufe IP44 baño | material | 2 | 12 € | ✓ Mecanismo enchufe schuko IP44 (exists) | STN ✅ | `UP_EXISTS_NOMATCH` | "Enchufe IP44 baño" vs "Mecanismo enchufe schuko IP44" — match posible |
| 14 | Punto de luz techo + downlight LED | material | 3 | 32 € | ✓ Luminaria baño LED IP44 (8373f246) | ElectroSuministros + OBRAMAT ✅ | `UP_EXISTS_NOMATCH` | "downlight" = luminaria empotrada; match semántico |
| 15 | Pulsador o interruptor baño | material | 2 | 8 € | ✗ No hay UP "interruptor/pulsador" | — | `UNRESOLVED` | Nuevo UP necesario (mecanismos eléctricos) |
| 16 | Kit bidé portátil | material | 1 | 35 € | ✗ No hay UP "bidé" | — | `UNRESOLVED` | Categoría sin cobertura |

**Cobertura actual:** 0/16 = 0%  
**Cobertura potencial (con mejora text-match + offerings en UPs sin offer):** 11/16 = 69%  
**Items con UP pero sin offering activa (bloqueo de dato, no de código):** 2 (#4 lavabo, #5 inodoro)  
**Items que requieren nuevo UP:** 4 (#3 grifo ducha, #6 mueble baño, #15 interruptor, #16 bidé)  
**Items estructuralmente irresolubles:** 1 (#16 bidé sin mercado B2B relevante)

---

## Resumen ejecutivo de gaps

### Por tipo de gap

| Tipo | Presupuesto(s) | Items afectados | Solución |
|------|---------------|----------------|---------|
| Text-match falla | PRE-085, 089, 090 | 12 items | Mejorar keywords en `create_cart_from_quote` o añadir alias al UP |
| UP existe sin offering activa | PRE-085 | 2 items | Crear offerings para lavabo + inodoro en actor demo |
| UP no existe | PRE-085, 089, 090 | 8 items | Crear nuevos UPs |
| UNRESOLVED estructural | todos | 3 items | Aceptar — precio estimado es correcto aquí |

### UPs a crear (prioritizados por frecuencia en demo)

| Prioridad | UP a crear | Familia | Aparece en |
|-----------|-----------|---------|-----------|
| 1 | Grifo monomando ducha empotrado | Grifería | PRE-085 |
| 2 | Kit fontanería / conexiones baño | Saneamiento | PRE-089 |
| 3 | Silicona sanitaria | Accesorios | PRE-089 |
| 4 | Interruptor/pulsador baño IP44 | Mecanismos | PRE-085 |
| 5 | Mueble baño conjunto | Baño | PRE-085 |
| 6 | Caja empotrar + pequeño material eléctrico | Electricidad | PRE-090 |
| 7 | Bidé portátil | Sanitarios | PRE-085 (baja prioridad) |

### Alias / keywords a añadir en text-matching

| Item descripción | UP objetivo | Alias a configurar |
|-----------------|-------------|-------------------|
| "Sifón y válvula desagüe ducha" | Sifón y desagüe ducha | sifón, válvula desagüe, desagüe ducha |
| "Impermeabilización zona ducha" | Membrana impermeabilizante líquida | impermeabilización, impermeabilizante, membrana |
| "Baldosas y material alicatado" | Azulejo rectificado pared | baldosa, alicatado, azulejo, cerámica pared |
| "Mampara ducha fija cristal templado" | Mampara de ducha | mampara, cristal templado, ducha fija |
| "Grifo monomando lavabo básico" | Grifo monomando lavabo | grifo monomando, grifería lavabo |
| "Pintura paredes y techo" | Pintura plástica anti-humedad | pintura, antihumedad, paredes baño |
| "Mortero adhesivo para alicatado" | Mortero adhesivo | mortero, adhesivo alicatado, pegamento cerámica |
| "Enchufe IP44 baño" | Mecanismo enchufe schuko IP44 | enchufe IP44, mecanismo baño |
| "Luminarias LED" | Luminaria baño LED IP44 | luminaria, LED, downlight, foco baño |

---

## Cobertura global proyectada

| Presupuesto | Actual | Con text-match fix | Con nuevos UPs | Con offerings demo |
|-------------|--------|-------------------|----------------|-------------------|
| PRE-2026-089 | 3/9 (33%) | 7/9 (78%) | 8/9 (89%) | 8/9 (89%) |
| PRE-2026-090 | 0/2 (0%) | 1/2 (50%) | 1/2 (50%) | 1/2 (50%) |
| PRE-2026-085 | 0/16 (0%) | 10/16 (63%) | 12/16 (75%) | 14/16 (88%) |
| **TOTAL** | **3/27 (11%)** | **18/27 (67%)** | **21/27 (78%)** | **23/27 (85%)** |

La cobertura del 85% no requiere código nuevo: solo datos (offerings + aliases de texto).

---

## Orden de acciones recomendado (post-aprobación)

```
1. Añadir aliases/keywords al mecanismo de matching  [dato, no código]
   → Sube cobertura de 11% → 67%

2. Crear offerings faltantes para UPs sin cobertura activa
   (lavabo sobre encimera, inodoro suspendido)         [dato]
   → Sube cobertura a 72%

3. Crear los 6 UPs nuevos de alta prioridad            [dato]
   → Sube cobertura a 85%

4. Verificar con PRE-2026-089, -090, -085 en staging

5. Implementar resolve_quote_material_candidates()      [código — fase posterior]

6. Almacenar universal_product_id en quote_items al generar presupuesto [código + IA]
```
