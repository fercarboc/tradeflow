# Migration Status — TrabFlow

> Baseline establecido: 2026-08-30  
> Auditoría: DB-MIG-RECON-1 + DB-MIG-RECON-2 + DB-MIG-RECON-3  
> SHA baseline: `de38cbd59470f257f66a3053218355aea3557eae`  
> Producción: `dqqjaujnulutinskmqsu` (Supabase, eu-central-1)

---

## 1. Estado histórico — por qué el CLI nunca muestra "Applied"

### Inventario

| Tipo | Conteo |
|------|--------|
| Archivos locales en `supabase/migrations/` | **140** |
| Migraciones remotas en `schema_migrations` | **302** |
| Coincidencias que el CLI detecta automáticamente | **0** |

### Causa raíz

El CLI Supabase extrae la versión de una migración leyendo los dígitos iniciales del nombre de archivo hasta el primer carácter no numérico:

```
20260806_04_guest1_price_columns.sql  →  versión "20260806"  (8 dígitos)
```

Todas las versiones en `schema_migrations` son marcas de tiempo de 14 dígitos generadas en el momento de aplicación:

```
version: "20260806164440"   name: "20260806_04_guest1_price_columns"
```

`"20260806"` ≠ `"20260806164440"` → el CLI nunca encontrará coincidencias para los 140 archivos legacy.

### Rango de fechas de los archivos legacy

`20260623_supplier_orders_rls.sql` → `20260829_02_verifactu_infrastructure.sql`

### Formatos presentes (ambos no canónicos)

- `YYYYMMDD_descripcion.sql`
- `YYYYMMDD_NN_descripcion.sql`

---

## 2. REGLA: LEGACY MIGRATIONS ARE FROZEN

```
LOS 140 ARCHIVOS LEGACY ESTÁN CONGELADOS.

NO renombrar.
NO borrar.
NO editar.
NO ejecutar masivamente (db push, db reset, loops automatizados).
NO reordenar.
```

Ninguna de estas acciones puede realizarse sin una **reconciliación específica posterior documentada y aprobada explícitamente**, en el contexto de DB-MIG-RECON-4 o proceso equivalente.

Los 140 archivos legacy son la fuente de verdad histórica del código que llegó a producción. Su modificación sin reconciliación destruiría la trazabilidad de auditoría y podría dejar el tracking local/remoto en un estado peor al actual.

---

## 3. Referencia operativa de producción

El schema de producción (`dqqjaujnulutinskmqsu`) es la referencia operativa del historial legacy mientras el tracking CLI permanezca desacoplado. Ante cualquier duda sobre qué está en producción, consultar directamente el schema de producción, **no** inferirlo de los archivos locales.

---

## 4. `supabase db push` — PROHIBIDO contra producción

```
⛔ SUPABASE DB PUSH CONTRA PRODUCCIÓN ESTÁ PROHIBIDO
   MIENTRAS EL HISTORIAL LEGACY NO HAYA SIDO RECONCILIADO.
```

Motivos técnicos:
- El CLI interpretaría los 140 archivos legacy como "pending".
- Intentaría ejecutar 140 migraciones en producción en orden.
- Muchas fallarían (objetos ya existentes sin IF NOT EXISTS, seeds duplicados, etc.).
- Incluso las idempotentes alterarían el historial de `schema_migrations` y podrían introducir estado inconsistente.
- Las migraciones GHOST_NOT_APPLIED (especialmente Ghost 2) se aplicarían sin control.

**Un `--dry-run` NO constituye autorización para ejecutar el push.**  
El dry-run no evalúa idempotencia real, no detecta efectos secundarios en datos existentes y no identifica las migraciones ghost. La única salida segura es resolver el legacy tracking en DB-MIG-RECON-4 antes de habilitar `db push`.

---

## 5. Repositorio NO es fuente reproducible de producción

```
⚠️  EL REPOSITORIO ACTUAL NO CONSTITUYE UNA CADENA COMPLETA
    Y REPRODUCIBLE PARA RECONSTRUIR PRODUCCIÓN DESDE CERO.
```

Los archivos locales **no** permiten reconstruir una base de datos completa:

- ~137 migraciones históricas (pre-junio 2026 y julio 2026) existen **solo en producción**, sin archivo local.
- Estas definen las tablas fundamentales: `trade_organizations`, RLS policies iniciales, schema de autenticación, subscripciones, contratos, etc.
- 21 migraciones post-julio-24 fueron aplicadas directamente sin archivo local (EXTRA_R).
- Un reset desde local produciría un schema incompleto e inutilizable.

**No usar `db reset` como prueba de reconstrucción de producción** hasta crear una estrategia de baseline completo (dump + replay). Para bootstrap válido: requiere `pg_dump` de producción como punto de partida.

---

## 6. Migraciones remotas sin archivo local (EXTRA_R)

Aplicadas directamente vía MCP `execute_sql` o `apply_migration` sin crear el archivo SQL correspondiente en el repositorio. **No hay archivo local para estos cambios.**

### Pre-junio 2023 (era histórica — ~98 entradas)

Todas las migraciones desde `20260321` hasta `20260622` inclusive.  
Definen el schema fundacional del proyecto. Sin archivos locales.

### Julio 2026 — sin archivo local (~39 entradas adicionales)

Incluye migraciones de catálogos de proveedores (Jul 11–17), firma de partes, CRM, distancias, etc.

### Post-julio 24 — aplicadas directamente sin archivo local (21 entradas confirmadas)

| Versión remota | Nombre | Fecha |
|----------------|--------|-------|
| `20260726200808` | `fix_universal_products_unique_constraints` | 26 jul |
| `20260726201244` | `fix_create_cart_semantic_match_v2` | 26 jul |
| `20260727090957` | `fix_get_supplier_orders_unified_ambiguous_id` | 27 jul |
| `20260727091854` | `fix_catalog_and_confirm_ambiguous_id` | 27 jul |
| `20260727095607` | `fix_supplier_orders_map_delivered_to_completed` | 27 jul |
| `20260727101728` | `fix_active_orders_exclude_delivered_and_delete_test_orders` | 27 jul |
| `20260727105716` | `fix_action_center_ux_texts` | 27 jul |
| `20260801145148` | `mkt_fase1_pilot_001_ddl` | 1 ago |
| `20260801174702` | `mkt_fase1_pilot_002_quote_items_structured_ids` | 1 ago |
| `20260803185327` | `b05_expand_cart_constraints` | 3 ago |
| `20260803185330` | `b01_deprecate_ship_supplier_order_3param` | 3 ago |
| `20260806143845` | `marketplace_mis_pedidos_rc1c1a_drop` | 6 ago |
| `20260809075740` | `rc1_c5a2_update_checkout_config_rpc_drop_create` | 9 ago |
| `20260810063407` | `rc1_c6_fix_create_cart_from_quote_direct_ref` | 10 ago |
| `20260810063804` | `rc1_c6_fix_checkout_cart_v2_columns` | 10 ago |
| `20260810070615` | `rc1_c6_fix_create_cart_resume_existing` | 10 ago |
| `20260810205442` | `create_free_cart_functions` | 10 ago |
| `20260810210120` | `portal_delivery_pickup_fields` | 10 ago |
| `20260811061326` | `order_detail_buyer_and_source` | 11 ago |
| `20260812222727` | `fix_supplier_orders_ambiguous_id` | 12 ago |
| `20260827221736` | `20260828_01_fix_protect_invoice_generated_columns` | 27 ago |

---

## 7. Archivos locales sin entrada remota trazable (GHOST_L)

Clasificación obtenida en DB-MIG-RECON-3 (2026-08-30).

### Ghost 1 — `20260730_06_fix_activity_feed_ambiguous_id.sql`

**Clasificación: GHOST_SCHEMA_PRESENT**

Efecto del archivo: `CREATE OR REPLACE FUNCTION public.get_supplier_activity_feed(p_actor_id uuid, p_limit integer DEFAULT 20)` con `SECURITY DEFINER SET search_path = public`.

Estado en producción (verificado 2026-08-30): la función existe con la **firma exacta** del archivo local, incluyendo todos los tipos de retorno, SECURITY DEFINER y search_path.

No existe entrada en `schema_migrations` que referencie este contenido explícitamente. La función fue probablemente aplicada directamente via MCP `execute_sql` sin crear una entrada de migración.

**Riesgo si se aplicara hoy**: NINGUNO — `CREATE OR REPLACE FUNCTION` con la misma firma es idempotente. Resultado: 0 cambios netos en producción.

### Ghost 2 — `20260806_01_marketplace_comparator_rc1c2.sql`

**Clasificación: GHOST_NOT_APPLIED**

```
⛔ NO APLICAR ESTE ARCHIVO SIN DECISIÓN FUNCIONAL/TÉCNICA EXPLÍCITA.
   NO debe aplicarse accidentalmente ni como parte de ningún
   proceso masivo (db push, loop automatizado, script de reconciliación).
```

Efectos del archivo:
1. `get_marketplace_catalog_paged`: añade columna `top_offerings JSONB` al RETURNS TABLE, y CTEs `ranked_offerings` + `top3_per_up`.
2. `get_offerings_for_up`: añade columna `ranking_reason TEXT` al RETURNS TABLE y lógica de cálculo.

Estado en producción (verificado 2026-08-30):
- `get_marketplace_catalog_paged`: existe pero **sin `top_offerings`** en el RETURNS TABLE.
- `get_offerings_for_up`: existe pero **sin `ranking_reason`** en el RETURNS TABLE.

**El ghost NO fue aplicado.** Las adiciones del comparador RC1-C.2 no están en producción.

Su aplicación activaría funcionalidad RC1-C.2 (Comparador transparente de proveedores) que no ha sido validada ni habilitada deliberadamente. Cambiaría las firmas de las dos RPCs principales del catálogo e implicaría una decisión de producto sobre si exponer la columna `ranking_reason` y el bloque `top_offerings` a los consumidores de la API.

**Acción requerida**: Decisión explícita de producto y técnica separada. No aplicar silenciosamente bajo ningún proceso automatizado.

### Ghost 3 — `20260816_03_e4a_fix_twfbpc1_dates.sql`

**Clasificación: GHOST_SCHEMA_PRESENT**

Efecto del archivo: `UPDATE trade_marketplace_ad_campaigns SET start_at = NULL, end_at = NULL WHERE nombre = 'TW-FB-PC1' AND campaign_source = 'trabflow' AND (start_at IS NOT NULL OR end_at IS NOT NULL)`.

Estado en producción (verificado 2026-08-30): TW-FB-PC1 tiene `start_at = NULL`, `end_at = NULL`, `updated_at = 2026-08-16 08:19:32+00`. El efecto del UPDATE está presente.

La fecha `updated_at = 08:19` del 16 de agosto es posterior a las migraciones `_01` (07:23) y `_02` (07:50), lo que indica que el UPDATE fue probablemente ejecutado directamente via MCP `execute_sql` sin crear entrada en `schema_migrations`.

**Riesgo si se aplicara hoy**: NINGUNO — la cláusula WHERE filtra por `(start_at IS NOT NULL OR end_at IS NOT NULL)`. Como TW-FB-PC1 ya tiene `NULL`, la condición es falsa. 0 filas actualizadas.

---

## 8. VeriFactu — estado de migraciones

### `20260829_02_verifactu_infrastructure.sql` (local)

```
Versión local extraída por CLI:  20260829
Versión en schema_migrations:   20260830134544
Nombre en schema_migrations:    20260829_02_verifactu_infrastructure
```

**Estado**: CONFIRMADA APLICADA EN PRODUCCIÓN. Clasificación: MATCH_FUNCTIONAL.  
La migración fue aplicada el 2026-08-30 via MCP `apply_migration`. El gap de versión (20260829 vs 20260830134544) es únicamente de tracking legacy — el schema de VeriFactu está en producción.

### `20260829_01_client_fiscal_profile.sql` (local)

```
Versión local extraída por CLI:  20260829

Remota 1:  20260829073751  →  add_tipo_cliente_apellidos_to_trade_clients
Remota 2:  20260829084406  →  add_client_tipo_constraint
```

**Estado**: CONFIRMADA APLICADA EN PRODUCCIÓN. Clasificación: SPLIT_REMOTE.  
El contenido del archivo local se aplicó en dos pasos separados. El schema (`tipo_cliente`, `apellidos`, constraint `trade_clients_tipo_cliente_check`) está en producción. Gap es únicamente de tracking.

---

## 9. Nuevo estándar obligatorio — a partir del baseline

### Formato de archivo

```
YYYYMMDDHHMMSS_descripcion_kebab_case.sql
```

**14 dígitos**. Generado exclusivamente mediante:

```bash
npx supabase migration new <descripcion>
```

No volver a utilizar:
```
YYYYMMDD_01_...   ← OBSOLETO
YYYYMMDD_02_...   ← OBSOLETO
YYYYMMDD_desc...  ← OBSOLETO
```

---

## 10. CRITICAL — Comportamiento real de MCP `apply_migration` respecto a versiones

### Hallazgo

El MCP `apply_migration` **siempre genera su propio timestamp como versión**, independientemente del nombre del archivo. El campo `name` en `schema_migrations` refleja lo que se pasa como parámetro `name`, pero el campo `version` es la marca de tiempo UTC en el momento de la llamada.

Evidencia directa:

| Archivo local | Nombre del archivo | Versión remota registrada | Discrepancia |
|---|---|---|---|
| `20260829_02_verifactu_infrastructure.sql` | …`20260829`… | `20260830134544` | Aplicado al día siguiente |
| `20260828_09_tipo_rectificativa.sql` | …`20260828`… | `20260829060825` | Aplicado al día siguiente |
| `20260828_01_fix_protect_invoice_generated_columns` | (sin local) | `20260827221736` | Aplicado el día anterior |

**Conclusión**:

```
filename local 14 dígitos  ≠  schema_migrations.version  (generada por MCP)
```

Aunque se adopte el formato canónico de 14 dígitos (`YYYYMMDDHHmmss_desc.sql`), si la migración se aplica via MCP `apply_migration`, la versión registrada en producción será diferente al timestamp del filename. El CLI seguirá viendo la migración como "local only" + "remote only".

Usar el formato canónico evita seguir creando nombres no estándar y simplifica la lectura del historial, pero **no resuelve por sí solo la sincronización CLI mientras el deployment se haga mediante MCP**.

### Implicación para el nuevo estándar

Usar filenames de 14 dígitos **no resuelve por sí solo** el problema de tracking CLI cuando se aplica via MCP.

### Procedimiento de aplicación recomendado para nuevas migraciones

**Opción A — via `supabase db push --linked` (preferida a largo plazo)**

```bash
# 1. Crear el archivo
npx supabase migration new descripcion
# → genera: 20260830193000_descripcion.sql

# 2. Editar el archivo con el SQL

# 3. Aplicar (usa la versión del filename)
npx supabase db push --linked
# → registra versión "20260830193000" en schema_migrations
# → CLI verá "Applied" para este archivo
```

**Requisito**: Resolver primero el problema de los 140 archivos legacy pendientes antes de usar `db push` con seguridad. Esto forma parte de DB-MIG-RECON-4. Hasta entonces, `db push --linked` también está bloqueado (ver sección 4).

**Opción B — via MCP (período de transición activo)**

```bash
# 1. Crear el archivo
npx supabase migration new descripcion
# → genera: 20260830193000_descripcion.sql

# 2. Editar el archivo con el SQL

# 3. Aplicar via MCP apply_migration
#    (la versión registrada será el timestamp de aplicación, no el del filename)
#    → el CLI seguirá mostrando este archivo como "local only"
```

Esta opción es la única segura durante el período de transición. Las nuevas migraciones seguirán requiriendo deployment controlado (MCP individual, revisado) y **no debe asumirse compatibilidad automática con `db push`** hasta completar DB-MIG-RECON-4.

**No existe actualmente un procedimiento MCP que garantice que la versión registrada coincida con el timestamp del filename.** Este es el gap técnico fundamental que debe resolverse en DB-MIG-RECON-4 mediante `supabase migration repair` o equivalente.

---

## 11. Guard para nuevas migraciones — propuesta (no implementada)

Script a ejecutar en pre-commit o CI para validar que los archivos **nuevos** (no legacy) sigan el estándar:

```bash
#!/bin/bash
# validate-new-migrations.sh
# Solo valida archivos creados después del baseline (2026-08-30).
# No falla por los 140 archivos legacy congelados.

BASELINE_VERSION="20260830000000"
PATTERN="^[0-9]{14}_[a-z0-9_]+\.sql$"
FAILED=0

for f in supabase/migrations/*.sql; do
  basename=$(basename "$f")
  # Extraer version (primeros 14 dígitos si el formato es canónico)
  version=$(echo "$basename" | grep -oP '^\d+')
  
  # Ignorar archivos legacy (versiones de 8 dígitos o < baseline)
  if [ ${#version} -lt 14 ] || [ "$version" -lt "$BASELINE_VERSION" ]; then
    continue  # archivo legacy — congelado, ignorar
  fi
  
  # Validar formato canónico para archivos nuevos
  if ! echo "$basename" | grep -qP "$PATTERN"; then
    echo "ERROR: Migration nueva con formato no canónico: $basename"
    FAILED=1
  fi
done

exit $FAILED
```

**Estado**: propuesta documentada. NO implementada todavía. Activar cuando se decida integrar en CI.

---

## Apéndice — Mapeo MATCH_FUNCTIONAL (post-julio 24, selección)

| Archivo local | Versión remota | Nombre remoto |
|---|---|---|
| `20260724_marketplace_universal_products.sql` | `20260724173019` | `20260724_marketplace_universal_products` |
| `20260724_marketplace_actor_system.sql` | `20260724174033` | `20260724_marketplace_actor_system` |
| `20260729_catalog_import.sql` | `20260729145035` | `20260729_catalog_import` |
| `20260821_01_mkt_fin_financial_config.sql` | `20260821143858` | `20260821_01_mkt_fin_financial_config` |
| `20260824_25_mkt_fin_settlements.sql` | `20260824173224` | `20260824_25_mkt_fin_settlements` |
| `20260827_01_verifactu_generated_at_and_immutability.sql` | `20260827220313` | `20260827_01_verifactu_generated_at_and_immutability` |
| `20260828_02_client_fiscal_and_snapshot.sql` | `20260828082639` | `20260828_02_client_fiscal_and_snapshot` |
| `20260829_02_verifactu_infrastructure.sql` | `20260830134544` | `20260829_02_verifactu_infrastructure` |
| `20260829_01_client_fiscal_profile.sql` | `20260829073751` + `20260829084406` | SPLIT_REMOTE |
