# P2.7 — Normalización y Búsqueda: Encoding Fix + Fuzzy Search

**Fecha:** 2026-08-04  
**Estado:** Completado — todas las fases aplicadas y postvalidadas

---

## Resumen ejecutivo

Se identificó y corrigió la raíz de dos problemas distintos en el Motor IA del Portal Proveedor:

1. **Causa raíz del encoding:** `file.text()` del browser API decodifica CSV en UTF-8 por defecto, corrompiendo archivos Windows-1252 con U+FFFD (▒). Afectaba a 4 de 12 offerings STN.
2. **Causa raíz de las 0 coincidencias:** La función RPC `get_offering_match_candidates` tenía un error SQL de ámbito que hacía que todo score fuera 0, filtrando todos los resultados.

Ambos se solucionaron. Se añadió adicionalmente búsqueda fuzzy con `pg_trgm` + normalización de tildes con `unaccent`.

---

## Fase A0 — Corrección del importador CSV

### Problema

`src/components/portal/PortalImportacion.tsx` línea 158:

```typescript
const text = await file.text();  // UTF-8 por defecto
```

Los archivos CSV exportados desde software español/europeo (Excel, ERPs) usan Windows-1252. Los bytes como `0xF1` (ñ), `0xE1` (á), `0xFC` (ü) son secuencias UTF-8 inválidas → sustituidos por U+FFFD (▒) sin advertencia.

### Solución

Nueva función `decodeCSVFile`:

1. Intenta `TextDecoder('utf-8', { fatal: true })` — UTF-8 estricto.
2. Si lanza excepción: el archivo no es UTF-8 → fallback a `TextDecoder('windows-1252')`.
3. Cuenta U+FFFD residuales en ambos casos.
4. Si `needsConfirmation = true`: bloquea el import y muestra panel de confirmación.

Panel de confirmación (WizardStep1):
- Muestra codificación detectada (`Windows-1252 (Latin-1)` o `UTF-8 con U+FFFD`)
- Muestra número de caracteres no convertibles (si los hay)
- Botones: **Cancelar** | **Continuar con conversión →**

Validación por fila en `validateAllRows`:
- Marca como error cualquier fila donde `supplier_ref` o `descripcion_comercial` contienen U+FFFD.

**Archivos modificados:**
- `src/components/portal/PortalImportacion.tsx`

**Verificación supplier-api-v1:** La Edge Function solo acepta JSON (no CSV binario) → sin vulnerabilidad de encoding.

---

## Fase A1 — Reparación de datos STN

### Auditoría completa de las 12 offerings STN

| supplier_ref | Descripción actual | U+FFFD | Confirmado | Acción |
|---|---|---|---|---|
| STN-FON-001 | Grifo monomando lavabo ca▒o alto cromado | Sí | No | Sin cambio |
| STN-FON-002 | Grifo monomando lavabo ca▒o bajo cromado | Sí | No | Sin cambio |
| STN-FON-004 | Grifo monomando ducha empotrado cromado | No | — | — |
| STN-FON-006 | **Válvula de esfera palanca 1/2" PN25 latón** | Reparado | Sí | ✓ |
| STN-FON-011 | Plato de ducha resina antideslizante 80x80 blanco | No | — | — |
| STN-FON-012 | Plato de ducha resina antideslizante 90x90 blanco | No | — | — |
| STN-FON-013 | Plato de ducha resina extraplano 120x80 blanco | No | — | — |
| STN-FON-014 | Mampara de ducha angular 80x80 cristal 6mm | No | — | — |
| STN-FON-015 | Mampara de ducha frontal 120cm abatible cristal 6mm | No | — | — |
| STN-FON-016 | Inodoro compacto suspendido porcelana blanca | No | — | — |
| STN-FON-018 | Lavabo sobre encimera oval porcelana blanca | No | — | gap_type=missing_universal_product |
| STN-FON-030 | **Kit desagüe plato ducha click-clack 90mm inox** | Reparado | Sí | ✓ |

### STN-FON-018 — Gap documentado

No existe ningún UP en el catálogo para "Lavabo sobre encimera oval". Acción: permanece `pending_review`. **No se crea UP automáticamente.** Gap a resolver en fase de expansión de catálogo.

### Migración aplicada

`20260804_01_a1_repair_stn_encoding.sql`

- Guard idempotente: solo actualiza si `descripcion_comercial LIKE '%' || chr(65533) || '%'`
- No toca precio, stock, match_state, match_method, match_confidence, metadata
- Registra evento `offering.description_normalized` en `trade_marketplace_audit_log`

---

## Fase B — Extensión unaccent

**Migración:** `20260804_02_b_install_unaccent.sql`

```sql
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;
```

Accesible como `extensions.unaccent()`. Permite comparar "valvula" con "Válvula", "desague" con "desagüe", "plato" con "Plato", etc.

---

## Fase C — Fuzzy Search con pg_trgm

### Benchmark de thresholds (2026-08-04)

| Threshold | True positives / 12 | Falsos positivos notables |
|---|---|---|
| 0.35 | 9/12 | Mínimos |
| 0.30 | 10/12 | Mínimos |
| 0.25 | **11/12** | Válvula de seguridad en query "valvula" (score bajo) |
| 0.20 | 11/12 | Aumentan |

**Threshold elegido: 0.25**  
Captura "Sifón y desagüe ducha" (sim=0.289) para STN-FON-030; con 0.30 solo aparecería "Plato de ducha" que es categoría incorrecta.

STN-FON-018 no aparece en ningún threshold → gap confirmado (sin UP correspondiente).

### Scoring implementado

```
+30  nombre_canonico ILIKE query (normalizado con unaccent)
+20  coincidencia bidireccional desc↔nombre_canonico (LEFT 15/20 chars)
+15  familia ILIKE query
+ 6  primera palabra de desc en nombre_canonico
+ 6  segunda palabra de desc en nombre_canonico
+0–12 trigram proporcional: similarity() * 12
-15  contradicción dimensional XxY (e.g. "80x80" vs "90x90")
-15  contradicción de fracción (e.g. "1/2" vs "3/4")
```

Max score = 100 (LEAST). Threshold de inclusión: score > 0.

### Migración aplicada

`20260804_03_c_get_offering_match_v3.sql`

Función `get_offering_match_candidates` v3:
- Pre-computa `v_desc_u` y `v_query_u` con `lower(extensions.unaccent(...))`
- Aplica unaccent en todos los `ILIKE` y `similarity()`
- WHERE incluye `OR similarity(...) >= 0.25` para captura fuzzy
- `GROUP BY 1` (posicional) — evita ambigüedad OUT param `id`
- `SECURITY DEFINER SET search_path TO 'public'` — invariante de seguridad

---

## Postvalidaciones

| Check | Resultado |
|---|---|
| 0 offerings STN con U+FFFD reparados incorrectamente | ✓ Solo FON-006 y FON-030 corregidos |
| STN-FON-001 y 002 intactos (no confirmados) | ✓ Siguen con U+FFFD (pendiente confirmación) |
| 12 IDs/refs/precios/stocks inalterados | ✓ Verificado |
| Matchings existentes (method=supplier) inalterados | ✓ FON-004/011/012/013/014/015 mantienen matched |
| "valvula" → Válvula esférica latón aparece | ✓ score=34, trgm=0.348 |
| "desague" → Sifón y desagüe ducha aparece | ✓ score=35, trgm=0.381 |
| "plato de ducha" → 3 UPs validated | ✓ Plato de ducha / extraplano / resina |
| STN-FON-018 → pending_review | ✓ No modificado |
| 0 match_state cambiados automáticamente | ✓ Ningún cambio automático |
| Supplier API sin vulnerabilidad encoding | ✓ Solo acepta JSON |

---

## Deuda técnica pendiente

- **STN-FON-001 y STN-FON-002**: confirmar corrección (`ca▒o` → `caño`). Requiere confirmación de Fernando antes de aplicar migración A1 para estos dos offerings.
- **STN-FON-018**: crear UP "Lavabo sobre encimera oval" en catálogo universal cuando se amplíe la oferta de sanitarios.
- **Synonyms**: deferred post-pilotos comerciales (fase 4 de P2.7, no incluida aquí).
