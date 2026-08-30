# Migration Status — TrabFlow

> Última actualización: 2026-08-30
> Auditorías: DB-MIG-RECON-1 → DB-MIG-RECON-4B
> SHA baseline original: `de38cbd59470f257f66a3053218355aea3557eae`
> SHA pre-reconciliación: `c1b596077bd559757d8ccedc31af4269eece4915`
> Producción: `dqqjaujnulutinskmqsu` (Supabase, eu-central-1)

---

## ESTADO ACTUAL — DB-MIG-RECON-4B COMPLETADO

### Tracking CLI

```
✅ RECONCILED

migration list --linked:

  LOCAL             REMOTE
  302 Applied       302 Applied
  0 local-only
  0 remote-only
```

### Fresh Bootstrap (db reset)

```
❌ NOT RECONCILED — ver deuda DB-MIG-BOOTSTRAP
```

Las 302 migrations fetched contienen migraciones históricas que referencian
tablas de un proyecto anterior (debacu_eval_*) que no están en ninguna migration.
`db reset` falla en la 2ª migration. No afecta al tracking ni al uso en producción.
Ver sección 12 para detalles.

---

## 1. Inventario actual

| Ubicación | Archivos | Descripción |
|---|---|---|
| `supabase/migrations/` | **302** | Migrations canónicas fetched — versiones 14 dígitos — todas Applied |
| `supabase/migrations-legacy/` | **140** | Archivos legacy archivados — solo referencia histórica |
| `schema_migrations` (remoto) | **302** | Entradas remotas — **intacto, 0 cambios** |

### Cómo se llegó aquí

**Antes (estado legacy):**
- 140 archivos locales con versiones de 8 dígitos (`20260806`)
- 302 entradas remotas con versiones de 14 dígitos (`20260806164440`)
- CLI: 0 coincidencias — tracking completamente desacoplado

**Causa raíz del desacoplamiento:**
El CLI extrae la versión del filename hasta el primer carácter no numérico:
```
20260806_04_guest1_price_columns.sql  →  versión "20260806"
schema_migrations version:            →  "20260806164440"
"20260806" ≠ "20260806164440" → 0 matches
```

**Reconciliación ejecutada (DB-MIG-RECON-4B, 2026-08-30):**
1. `git mv supabase/migrations/*.sql supabase/migrations-legacy/` (140 archivos)
2. `npx supabase migration fetch --linked` → 302 archivos con versiones 14-digit exactas
3. `migration list --linked` → 302 Applied, 0 local-only, 0 remote-only ✅
4. `schema_migrations` remoto: 0 cambios ✅

---

## 2. Archivos legacy archivados

Los 140 archivos legacy están en `supabase/migrations-legacy/`.

```
REGLAS PARA migrations-legacy/:

- Solo lectura. NO editar.
- NO ejecutar. NO mover de vuelta a migrations/.
- Preservado por git mv → historial completo accesible vía git log/blame.
- NO constituyen una cadena de migrations ejecutable.
- Ghost 2 reside aquí y SOLO aquí.
```

**Rango legacy archivado:**
`20260623_supplier_orders_rls.sql` → `20260829_02_verifactu_infrastructure.sql`

---

## 3. Migrations canónicas activas

Los 302 archivos en `supabase/migrations/` son el resultado de `migration fetch --linked`.

**Propiedades:**
- Versiones 14 dígitos exactas — coinciden con `schema_migrations` remoto
- Contenido SQL tomado de `schema_migrations.statements` — lo que se aplicó realmente
- Primera: `20260321074154_add_onboarding_status_to_customers.sql`
- Última: `20260830134544_20260829_02_verifactu_infrastructure.sql`

**Estas migrations son de solo lectura documental.** No deben editarse.
Representan el historial real de producción tal como fue registrado.

---

## 4. `supabase db push` — estado tras reconciliación

```
⚠️ NO ejecutar db push todavía contra producción.

El tracking CLI está reconciliado.
La capacidad técnica de db push existe.
Pero se requiere una validación específica de primer dry-run
antes del primer push real.

Ver: DB-MIG-RECON-4C — POST-CUTOVER PUSH VALIDATION (pendiente)
```

**Cuando DB-MIG-RECON-4C esté completada**, el procedimiento para futuras migrations será:

```bash
# 1. Crear el archivo canónico
npx supabase migration new descripcion_kebab_case
# → genera: YYYYMMDDHHmmss_descripcion_kebab_case.sql

# 2. Editar el SQL

# 3. Aplicar (preserva versión del filename en schema_migrations)
npx supabase db push --linked
# → registra versión YYYYMMDDHHmmss en schema_migrations
# → CLI muestra "Applied" ✅
```

**MCP `apply_migration` deja de ser el procedimiento normal para nuevas migrations.**
Si excepcionalmente se usa MCP, la versión registrada será el timestamp de aplicación
(no el del filename) → la migration quedará como "local-only" en el CLI.

---

## 5. CRITICAL — Ghost 2

```
⛔ Ghost 2 está en migrations-legacy/ ÚNICAMENTE.
   NO está en migrations/ activo.
   NO puede aplicarse por db push accidentalmente.
   NO aplicar sin decisión explícita de producto + técnica.
```

**Ubicación**: `supabase/migrations-legacy/20260806_01_marketplace_comparator_rc1c2.sql`

**Efecto**: activaría RC1-C.2 (comparador de proveedores) añadiendo `top_offerings JSONB`
a `get_marketplace_catalog_paged` y `ranking_reason TEXT` a `get_offerings_for_up`.

**Estado en producción**: las funciones existen pero SIN estas columnas.
El ghost nunca fue aplicado a producción.

**Verificado post-reconciliación**: búsqueda exhaustiva en los 302 archivos activos
confirma 0 hits para `top_offerings`, `ranking_reason`, `ranked_offerings`, `top3_per_up`.

---

## 6. VeriFactu — estado post-reconciliación

Ambas migrations VeriFactu están en `supabase/migrations/` activo con versiones canónicas:

| Versión canónica | Archivo | Estado |
|---|---|---|
| `20260827220313` | `..._20260827_01_verifactu_generated_at_and_immutability.sql` | Applied ✅ |
| `20260830134544` | `..._20260829_02_verifactu_infrastructure.sql` | Applied ✅ |

**Triggers de protección en migrations activas:**
- `trg_protect_emitted_invoice` — en `20260827220313` ✅
- `trg_protect_emitted_invoice_delete` — en `20260827220313` ✅
- `trg_protect_emitted_invoice_lines` — en `20260827220313` ✅
- `trg_protect_fiscal_record` — en `20260828133602` ✅

**Estado en producción (verificado 2026-08-30):**
- Todos los triggers: `tgenabled='O'` (activos)
- `trade_verifactu_system_config`: enabled=false, transmission_enabled=false, environment='disabled'
- producer_nif=NULL, installation_number=NULL, mot_indicator=NULL
- certificate_status='not_configured', agreement_status='pending'

```
F-2026-0001: PROTECCIÓN ABSOLUTA mantenida.
Solo SELECT. No modificar.
```

---

## 7. Nuevo estándar de migrations (obligatorio a partir de ahora)

```bash
# CREAR
npx supabase migration new descripcion_kebab_case
# → YYYYMMDDHHmmss_descripcion_kebab_case.sql

# APLICAR (post DB-MIG-RECON-4C)
npx supabase db push --linked
```

**Formatos legacy obsoletos** (no volver a usar):
```
YYYYMMDD_01_...   ← OBSOLETO
YYYYMMDD_02_...   ← OBSOLETO
YYYYMMDD_desc...  ← OBSOLETO
```

---

## 8. Comportamiento de MCP `apply_migration` (referencia histórica)

MCP `apply_migration` genera su propio timestamp UTC como `version`,
independientemente del filename. Por eso el tracking legacy nunca coincidió.

| Filename | Version en schema_migrations | Gap |
|---|---|---|
| `20260829_02_verifactu_infrastructure.sql` | `20260830134544` | 1 día |
| `20260828_09_tipo_rectificativa.sql` | `20260829060825` | 1 día |

**Conclusión**: Para que local == remote, usar `db push --linked`, no MCP.

---

## 9. Ghost 1 y Ghost 3 (referencia histórica)

Documentados en DB-MIG-RECON-3. Ambos están en `migrations-legacy/`.

**Ghost 1** — `20260730_06_fix_activity_feed_ambiguous_id.sql`
- `get_supplier_activity_feed` SECURITY DEFINER
- Clasificación: GHOST_SCHEMA_PRESENT. Idempotente. Riesgo: ninguno.

**Ghost 3** — `20260816_03_e4a_fix_twfbpc1_dates.sql`
- UPDATE campaign TW-FB-PC1 → ya en NULL
- Clasificación: GHOST_SCHEMA_PRESENT. 0 filas si se ejecuta. Riesgo: ninguno.

Ambos residían en el legacy. No están en migrations activo.

---

## 10. Split remote VeriFactu (referencia histórica)

`20260829_01_client_fiscal_profile.sql` → SPLIT_REMOTE:
- Remota 1: `20260829073751` → `add_tipo_cliente_apellidos_to_trade_clients`
- Remota 2: `20260829084406` → `add_client_tipo_constraint`

Ambas canónicas presentes en migrations activo. Tracking: Applied ✅.

---

## 11. Guard para nuevas migrations — propuesta (no implementada)

```bash
#!/bin/bash
# validate-new-migrations.sh
BASELINE_VERSION="20260830000000"
PATTERN="^[0-9]{14}_[a-z0-9_]+\.sql$"
FAILED=0

for f in supabase/migrations/*.sql; do
  basename=$(basename "$f")
  version=$(echo "$basename" | grep -oP '^\d+')
  if [ ${#version} -lt 14 ] || [ "$version" -lt "$BASELINE_VERSION" ]; then
    continue
  fi
  if ! echo "$basename" | grep -qP "$PATTERN"; then
    echo "ERROR: Migration nueva con formato no canónico: $basename"
    FAILED=1
  fi
done
exit $FAILED
```

Estado: propuesta documentada. No implementada.

---

## 12. Deuda técnica — DB-MIG-BOOTSTRAP

```
❌ FRESH BOOTSTRAP (db reset) NO FUNCIONA DESDE LAS 302 MIGRATIONS.
```

### P1 — Schema debacu_* preexistente no migrationizado

Las primeras 15 migrations del set (era marzo-abril 2026) modifican tablas de un
proyecto anterior (GestionDebacuPro):
```
ALTER TABLE public.debacu_eval_organizations ...
ALTER TABLE public.debacu_eval_properties ...
ALTER TABLE public.debacu_eval_guest_index ENABLE ROW LEVEL SECURITY;
... (18 migrations afectadas en total)
```

Estas tablas pre-existen desde antes del primer registro en `schema_migrations`.
Nunca fueron migrationizadas. En DB vacía: `ERROR: relation "debacu_eval_organizations" does not exist`.

**Primera migration que fallaría en db reset:**
`20260321074208_add_setup_status_to_organizations.sql` (migration #2).

**Impacto:** `supabase db reset` y CI/CD con DB limpia están bloqueados.
**Solución futura:** seed script con schema debacu previo al punto de corte,
o refactorizar las 18 migrations para protegerlas con IF EXISTS.

### P1 — Migration 20260803204204 depende de UUIDs operativos

```sql
INSERT INTO trade_marketplace_actor_members (actor_id, user_id, ...)
VALUES (
  '283d106e-30e3-4e1d-8e3d-069e4a6e4f61',  -- actor de producción
  'cf1000d3-80bc-4bdd-a9df-b8a0f0462c77'   -- user auth.users de producción
  ...
)
```

`user_id` tiene FK a `auth.users`. En DB limpia: FK violation.
El `actor_id` es el UUID de producción del actor TrabFlow Platform, que en DB
limpia tendría un UUID diferente (generado por gen_random_uuid()).

**Impacto:** Falla en db reset aunque se resuelva el problema debacu.
**Solución futura:** Usar lookup por slug en lugar de UUID hardcoded,
o mover a un seed script condicional separado de las migrations.

### P2 — RLS policies con email admin hardcodeado

`fercarboc@gmail.com` aparece en condiciones USING de ~20 migrations legacy
(ahora en migrations-legacy/). Las migrations canónicas fetched lo heredan.

```sql
USING (auth.email() = 'fercarboc@gmail.com')
```

**Impacto:** En DB de desarrollo, el admin debe usar ese email para acceder
a funciones de admin. No es PII de terceros. Funciona en producción.
**Solución futura:** Migrar a role-based admin lookup via `admin_users` table.

---

## 13. Próximo gate — DB-MIG-RECON-4C

```
DB-MIG-RECON-4C — POST-CUTOVER PUSH VALIDATION

Objetivo: validar que db push --linked funciona correctamente
          con una migration de prueba en entorno aislado.

Bloqueante para: habilitar db push en flujo normal de trabajo.

Prereqs:
  - migrations/ = 302 canónicas (completado ✅)
  - migration list = 0 local-only, 0 remote-only (completado ✅)
  - Primera migration nueva: via npx supabase migration new
  - Dry-run primero: npx supabase db push --linked --dry-run
  - Verificar: 0 migrations pending (esperado)
  - Si dry-run OK: habilitar db push para futuras migrations

NO ejecutar db push hasta completar este gate.
```
