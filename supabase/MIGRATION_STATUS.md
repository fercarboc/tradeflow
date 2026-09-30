# Migration Status — TrabFlow

> Última actualización: 2026-08-31
> Auditorías: DB-MIG-RECON-1 → DB-MIG-RECON-4C | DB-MIG-BOOTSTRAP-3 → 3B
> SHA baseline original: `de38cbd59470f257f66a3053218355aea3557eae`
> SHA pre-reconciliación: `c1b596077bd559757d8ccedc31af4269eece4915`
> Producción: `dqqjaujnulutinskmqsu` (Supabase, eu-central-1)

---

## ESTADO ACTUAL — DB-MIG-BOOTSTRAP-3B COMPLETADO | PRÓXIMA FASE: DB-DEBACU-RETIREMENT

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

## 13. DB-MIG-RECON-4C — CERRADO ✅

```
DB-MIG-RECON-4C — POST-CUTOVER PUSH VALIDATION
Estado: CERRADO / PASS (2026-08-30)

Resultado dry-run:
  npx supabase db push --linked --dry-run
  {"upToDate":true,"dryRun":true,"migrations":[],"seeds":[],"roles":[],"message":"Remote database is up to date."}

Interpretación:
  - 0 migrations pending ✅
  - upToDate:true ✅
  - db push habilitado para futuras migrations ✅

Flujo de trabajo activo (db push canónico):
  1. npx supabase migration new descripcion_kebab_case
  2. Editar SQL
  3. npx supabase db push --linked
```

---

## 14. DB-MIG-BOOTSTRAP-3 / 3B — CERRADO ✅

```
DB-MIG-BOOTSTRAP-3:  Baseline SQL pura — introspección SELECT-only pg_catalog
DB-MIG-BOOTSTRAP-3B: Baseline Execution Readiness Gate — todos los gates PASS
Estado: CERRADO / READY_FOR_CLEAN_DB_EXECUTION (2026-08-31)
```

### Artefactos generados (scratchpad — fuera del repo)

```
trabflow_baseline_v1.sql   — 989.2 KB / 22,632 líneas
trabflow_baseline_manifest.md — manifiesto completo
```

### Gate Final (A–R) — resumen

| Gate | Resultado |
|------|-----------|
| A. Cross-domain en SQL | 0 |
| B. Debacu deps en objetos incluidos | 0 |
| C. Email personal en SQL | 0 hits |
| D. UUIDs producción en SQL | 0 hits |
| E. Refs fiscales test en SQL | 0 hits |
| F. Roles en producción | 29 |
| G. Roles en baseline | 29 |
| H. Políticas con email en SQL | 0 |
| I. Funciones TrabFlow incluidas | 315 |
| J. Triggers incluidos | 47 |
| K. Triggers VeriFactu | 4/4 |
| L. Protecciones Marketplace Finance | presentes |
| M. Extensiones requeridas doc | 8 REQUIRED + 1 OPTIONAL |
| N. Seed dependency graph | validado |
| O. Validación estática | ALL PASS |
| P. Cambios producción | 0 |
| Q. Cambios schema_migrations | 0 |
| R. Cambios repo tracked | 1 (MIGRATION_STATUS.md, no committed) |

### Decisión Arquitectónica No Negociable (2026-08-31)

```
TrabFlow PERMANECE en el proyecto Supabase actual.
NO hay migración de TrabFlow a otro proyecto.
NO hay cutover de producción.

La baseline tiene dos únicos objetivos:
  1. Demostrar que TrabFlow es reproducible sin Debacu.
  2. Referencia canónica para dev/CI/backup.

Un entorno clean-DB para validar la baseline es EXCLUSIVAMENTE laboratorio.
NO es candidato a producción.
```

---

## 15. DB-DEBACU-RETIREMENT — PRÓXIMA FASE (pendiente activación)

```
Objetivo: retirar Debacu/GestionDebacuPro del proyecto Supabase actual
          de forma controlada, sin modificar objetos TrabFlow.

Principio de ejecución:
  1. Demostrar dependencias (qué usa Debacu, qué hay en common)
  2. Apagar infraestructura Debacu (kill switches, accesos)
  3. Backup / retención de datos Debacu
  4. DROP plan (objetos a eliminar, orden seguro)
  5. Validación (TrabFlow 100% operativo tras cada DROP)
  6. Retirada controlada (DROP)

Restricción clave: ningún paso modifica objetos TrabFlow.

Estado: PENDIENTE — no activar sin instrucción expresa.
```

---

## 16. DB-DEBACU-RETIREMENT-1 — AUDIT COMPLETADO ✅

```
DB-DEBACU-RETIREMENT-1: READ-ONLY RETIREMENT AUDIT & PLAN
Estado: COMPLETADO / READY_FOR_RETIREMENT_PREPARATION (2026-08-31)
Audit: 100% READ-ONLY — 0 cambios en producción
```

### Hallazgos críticos

| Punto | Resultado |
|-------|-----------|
| FK TrabFlow → Debacu | 0 ✅ |
| FK Debacu → TrabFlow | 0 ✅ |
| Runtime code refs Debacu (src/) | 0 (solo supabase.gen.ts generado) ✅ |
| Auth impact | 0 (auth.users intacto) ✅ |
| Vault secrets Debacu | 0 (Debacu usa hardcoded) ✅ |
| Realtime tablas Debacu | 0 ✅ |
| Shared functions | 2: set_updated_at, update_updated_at_column |
| Cross-domain functions a refactorizar | 21 |

### Inventario Debacu

| Tipo | Cantidad |
|------|----------|
| Tablas | ~94 |
| Vistas | 29 |
| Funciones propias | ~69 |
| Edge Functions | ~129 |
| Cron Jobs | 4 (jobids 1–4) |
| Storage buckets | 5 + 1 review |
| Secuencias | 2 |
| Enums | ~21 |
| Vault secrets | 0 |

### Dato más relevante

`debacu_identity_links`: **1.1 GB** (267 filas, hashes de identidad de huéspedes).
Requiere confirmación legal antes de cualquier DROP.

### Precondiciones para Phase 2

1. Confirmación legal retención: debacu_identity_links, debacu_legal_acceptances, debacu_eval_audit_log
2. Confirmación comercial: 13 clientes en tabla customers (todos is_active=true)
3. Backup completo verificado (diseño en informe sección R)
4. Refactorizar 21 funciones cross-domain
5. Instrucción expresa de activación

### Artefacto generado

```
informe_final_A_X.md — scratchpad (fuera del repo)
Puntos A–X completos + VEREDICTO: READY_FOR_RETIREMENT_PREPARATION
```

```
STOP TOTAL.
NO DROP. NO DELETE. NO ALTER. NO DESACTIVAR INFRA.
NO COMMIT. NO PUSH.
Fase siguiente: aprobación explícita de precondiciones → DB-DEBACU-RETIREMENT-2.
```

---

## Section 17 — DB-DEBACU-RETIREMENT-2 (2026-08-31)

**Fase:** BACKUP & FREEZE PREPARATION — COMPLETADA (análisis). 0 cambios en producción.

### Hallazgos críticos

| Hallazgo | Detalle |
|----------|---------|
| customers: 13 filas, TODOS activos | is_active=true en los 13. 9 con auth_user_id. 4 meses sin actividad (last: 2026-04-25) |
| **SECURITY_GATE** | service_password en plaintext (1 row). service_username (7 rows). Rotación obligatoria. |
| debacu_identity_links: 978 MB índice bloat | 267 filas reales = 48 kB. Índice PK masivamente inflado. DROP recupera ~1 GB. |
| debacu_eval_audit_log CONGELADO | 300 filas, range 2026-01-19 → 2026-03-14 (5+ meses sin actividad). 62 AUDIT_EXPORTs a externos. |
| debacu_legal_acceptances: 94 PDFs | 1.6 MB. Rango 2026-01-24 → 2026-04-25. Consentimientos RGPD firmados. |
| Crons TODOS ACTIVOS HOY | 4 cron jobs ejecutándose. jobid 3 cada 5 min (3,064 runs). jobid 1 ejecutó hoy 03:15 UTC. |
| Cross-domain 21: clasificación completa | 19 DROP_WITH_DEBACU, 2 REFACTOR_BEFORE_DROP (admin_get_trade_users, admin_get_waitlist_leads) |

### Gates Status

| Gate | Estado |
|------|--------|
| TRABFLOW_PROTECTION_GATE | ✅ READY |
| BACKUP_GATE | ⚠️ OPEN — diseñado, no ejecutado |
| LEGAL_GATE | 🔴 OPEN — decisión legal pendiente |
| COMMERCIAL_GATE | 🔴 OPEN — 13 clientes sin cierre formal |
| SECURITY_GATE | 🔴 OPEN — service_password en plaintext |
| CROSS_DOMAIN_GATE | ⚠️ OPEN — 2 funciones sin refactorizar |
| FREEZE_GATE | ⚠️ OPEN — freeze no ejecutado |
| OBSERVATION_GATE | ⚠️ OPEN — observation window pendiente |

### VEREDICTO

```
BACKUP_REQUIRED / GATES_OPEN

3 GATES ROJOS (LEGAL, COMMERCIAL, SECURITY) deben cerrarse antes de backup.
Roadmap secuencial:
  1. Decisión legal retención (LEGAL_GATE)
  2. Cierre formal con 13 clientes Debacu (COMMERCIAL_GATE)
  3. Rotación credenciales PMS (SECURITY_GATE)
  4. Ejecutar backup + verificación (BACKUP_GATE)
  5. Refactor 2 funciones (CROSS_DOMAIN_GATE)
  6. Freeze procedure (FREEZE_GATE)
  7. Observation window 7 días (OBSERVATION_GATE)
  8. → Activar DB-DEBACU-RETIREMENT-3 (DROP plan)
```

### Artefacto generado

```
informe_retirement2_A_S.md — scratchpad (fuera del repo)
Puntos A–S completos (A=baseline, B=protected sets, C=retention matrix,
D=identity_links, E=legal_acceptances, F=audit_log, G=customers commercial,
H=DB backup plan, I=backup verification, J=storage backup,
K=EF 129 clasificación, L=cron clasificación, M=inline secrets,
N=cross-domain 21, O=freeze procedure, P=observation plan,
Q=rollback strategy, R=future migration strategy, S=gates status)
VEREDICTO: BACKUP_REQUIRED / GATES_OPEN
```

```
STOP TOTAL.
NO DROP. NO DELETE. NO DESACTIVAR DEBACU. NO CRON.
NO COMMIT. NO PUSH.
Fase siguiente: DB-DEBACU-RETIREMENT-2C (nueva info del fundador).

---

## Section 18 — DB-DEBACU-RETIREMENT-2C (2026-08-31)

**Fase:** TEST DATA RETIREMENT PREPARATION. 0 cambios en producción.

### Nueva información del fundador

Debacu NUNCA llegó a producción. Todos los datos son TEST DATA.
- COMMERCIAL_GATE → CLOSED BY OWNER DECISION
- LEGAL_GATE → CLOSED BY OWNER DECISION (datos de prueba, sin retención obligatoria)

### Hallazgos clave

| Hallazgo | Detalle |
|----------|---------|
| Auth users Debacu | 4 usuarios únicos (union customers + debacu_eval_admins). Todos DEBACU_ONLY_TEST_USER. 0 relación TrabFlow. |
| Credenciales clasificadas | service_password (1): UNKNOWN / service_username (6): UNKNOWN / 1: FAKE_TEST. Stripe mode: UNKNOWN. |
| debacu_global_pepper | DEBACU_INTERNAL_CRYPTO_SECRET — no requiere rotación externa. DROP con app_settings. |
| debacu_super_secret_largo_2026 | DEBACU_INTERNAL_TOKEN en cron.job.command. No requiere rotación externa. |
| Storage Debacu total | 449 objetos, ~3.39 MB (trivialmente pequeño). Todos TEST_DATA. |
| assets bucket | 1 PNG (`1000144124.png`, 1.14 MB) — probable DEBACU_ASSET. Confirmar propietario. |
| 0 colisiones TrabFlow | 0 funciones trade_* referencian Debacu. TRABFLOW_PROTECTION_GATE = PASS. |
| Observation window | Reducida de 7 días a 48h (Debacu nunca en producción, solo tráfico técnico). |

### Gate Matrix actualizado

| Gate | Estado |
|------|--------|
| TRABFLOW_PROTECTION_GATE | ✅ CLOSED/PASS |
| COMMERCIAL_GATE | ✅ CLOSED BY OWNER DECISION |
| LEGAL_GATE | ✅ CLOSED BY OWNER DECISION |
| SECURITY_GATE | 🔴 OPEN — confirmar: ¿service_username/password = sandbox o PMS real? ¿Stripe = test o live? ¿assets bucket = Debacu only? |
| BACKUP_GATE | ⚠️ OPEN — técnico, ~3.5 MB, ejecutable en paralelo con security |
| CROSS_DOMAIN_GATE | ⚠️ OPEN — 2 funciones (#18, #19) refactor migration |
| FREEZE_GATE | ⚠️ OPEN |
| OBSERVATION_GATE | ⚠️ OPEN (48h post-freeze propuesto) |

### VEREDICTO

```
READY_FOR_BACKUP_AND_SECURITY_REMEDIATION

Un único gate bloqueante: SECURITY_GATE (3 preguntas al propietario).
Tras confirmación → BACKUP → CROSS_DOMAIN_REFACTOR → FREEZE → OBSERVE 48h → RETIREMENT-3.
```

### Artefacto generado

```
informe_retirement2C_A_O.md — scratchpad (fuera del repo)
Puntos A–O: gate matrix, backup scope, credential classification,
cron classification, EF classification, storage classification,
cross-domain 21 final, auth users, freeze procedure,
observation duration (48h), DROP plan status, protected collisions,
production changes=0, schema_migrations changes=0, repo changes.
```

```
STOP.
NO FREEZE. NO DROP. NO DELETE. NO COMMIT. NO PUSH.
Próxima acción: respuesta propietario a SECURITY_GATE (3 preguntas).
```

---

## Section 19 — DB-DEBACU-RETIREMENT-2D (2026-08-31)

**Fase:** BACKUP & REFACTOR READINESS. 0 cambios en producción.

### Nueva información del propietario (acumulada desde 2C)

- STRIPE_GATE → NOT_APPLICABLE / CLOSED (0 pagos Debacu, sin secrets Stripe en vault)
- Blanket owner: no real Stripe subscriptions en Debacu
- SECURITY_GATE_EXTERNAL → CONDITIONAL_OPEN (ver abajo)

### Hallazgos nuevos de esta fase

| Hallazgo | Detalle |
|----------|---------|
| pms_connections.webhook_secret | **VOID_NO_DATA** — columna existe, 0 filas con dato (NULL en todas las 10 filas). Sin nada que rotar. |
| pms_connections.environment | Default = `'sandbox'::text`. Todas en status PENDING. Refuerza clasificación sandbox. |
| debacu_eval_sessions.token | 203 tokens, ALL EXPIRED (max_expires_at 2026-02-21 — hace 6+ meses). DEBACU_INTERNAL_EXPIRED_SESSIONS. |
| PMS service_password final | sector_id='ADMIN', pms_type_selected=NULL. UNVERIFIABLE_TEST_CREDENTIAL. ZERO_FINANCIAL_RISK. |
| Edge Functions (conteo real) | **168 total** (no 129 del audit Phase 1). 140 DEBACU_ONLY, 28 TRABFLOW_ONLY, 0 SHARED. |
| marketplace-outbox-consumer | Reclasificado TRABFLOW_ONLY (estaba en UNKNOWN). |
| 19 DROP functions safety | 0 funciones TrabFlow las referencian. Safe to DROP_WITH_DEBACU. ✅ |
| Baseline git | HEAD `465f01e` (VF-2-FIX). 1 local-only migration (20260831071953, VF2, no aplicado a remote). |

### Gate Matrix final 2D

| Gate | Estado |
|------|--------|
| COMMERCIAL_GATE | ✅ CLOSED |
| LEGAL_GATE | ✅ CLOSED |
| STRIPE_GATE | ✅ NOT_APPLICABLE / CLOSED |
| SECURITY_GATE_DATABASE | ✅ CLOSED — ambos secrets internos, sin dep. externa |
| SECURITY_GATE_EXTERNAL | ⚠️ CONDITIONAL_OPEN — pms credential UNVERIFIABLE, no bloquea backup |
| TRABFLOW_PROTECTION_GATE | ✅ PASS — fiscal protected intacto, VeriFactu intacto |

### Clasificaciones definitivas 2D

| Objeto | Clasificación |
|--------|--------------|
| app_settings.debacu_global_pepper | DEBACU_INTERNAL_CRYPTO_SECRET → DROP_WITH_TABLE |
| debacu_eval_sessions.token (203) | DEBACU_INTERNAL_EXPIRED_SESSIONS → DROP_WITH_TABLE |
| pms_connections.webhook_secret | VOID_NO_DATA → DROP_WITH_TABLE (trivial) |
| pms_credentials.service_password | UNVERIFIABLE_TEST_CREDENTIAL → DROP_WITH_TABLE |
| Edge Functions 140 | DEBACU_ONLY → DISABLE Phase 3, DELETE Phase 4 |
| Edge Functions 28 | TRABFLOW_ONLY → conservar |
| 2 funciones cross-domain | REFACTOR_TO_TRABFLOW_PURE (migración M lista) |
| 19 funciones cross-domain | DROP_WITH_DEBACU (0 refs TrabFlow verificado) |
| 4 cron jobs | LEFTOVER_TEST_INFRASTRUCTURE → DELETE Phase 3 |
| 4 auth.users | DEBACU_ONLY_TEST_USER → DELETE Phase 4 (post-backup) |
| bucket assets / 1 PNG | DEBACU_ONLY → download backup → DELETE Phase 4 |
| set_updated_at | SHARED (admin_users + 15 Debacu tables) → DROP solo tras Phase 4 |
| update_updated_at_column | SHARED (5 trade_* + email_templates) → conservar hasta audit email_templates |

### Pendientes antes de Phase 3

1. `supabase db push` — aplicar VF2 migration local-only (proceso TrabFlow normal)
2. Confirmar con propietario: "credencial PMS ADMIN es de desarrollador" → cierra SECURITY_GATE_EXTERNAL formalmente
3. Auditar email_templates: `SELECT DISTINCT category FROM email_templates` → determinar si hay rows TrabFlow antes de DROP

### VEREDICTO

```
DB-DEBACU-RETIREMENT-2D: READY_FOR_TECHNICAL_BACKUP

GATE SUMMARY:
  COMMERCIAL_GATE ........ CLOSED
  LEGAL_GATE ............. CLOSED
  STRIPE_GATE ............ NOT_APPLICABLE/CLOSED
  SECURITY_GATE_DATABASE . CLOSED
  SECURITY_GATE_EXTERNAL . CONDITIONAL_OPEN (no bloquea backup)

Secciones A–X completas. Sin sorpresas críticas.
Próxima fase: spec DB-DEBACU-RETIREMENT-3 (FREEZE + BACKUP EXECUTION).
```

### Artefacto generado

```
informe_final_2D_A_X.md — scratchpad (fuera del repo)
Secciones A–X: baseline, gate matrix, TrabFlow protection, shared helpers,
Stripe=CLOSED, PMS=UNVERIFIABLE_TEST_CREDENTIAL, SECURITY_GATE_DATABASE,
SECURITY_GATE_EXTERNAL, secrets internos, backup scope exacto,
backup verification procedure, cross-domain 21, refactor plan 2 funciones,
auth users, storage, cron, Edge Functions (168 total), future migration structure,
freeze procedure, observation window 48h, protected-object collisions,
production changes, schema_migrations changes, repo changes.
VEREDICTO: READY_FOR_TECHNICAL_BACKUP
```

```
STOP.
NO BACKUP EXECUTION todavía. NO REFACTOR todavía.
NO FREEZE. NO DROP. NO DELETE. NO COMMIT. NO PUSH (excepto este archivo).
Próxima acción: spec DB-DEBACU-RETIREMENT-3.
```

---

## Section 21 — DB-DEBACU-RETIREMENT — PAUSED (2026-08-31)

**Estado: PAUSED. Prioridad inmediata = piloto instaladores + VeriFactu/facturación.**

### Cambios de producción conocidos (Debacu)

| Objeto | Acción | Estado |
|--------|--------|--------|
| `debacu-eval-login` (EF) | DELETED_EARLY_FROM_PRODUCTION | Aceptado — era DEBACU_ONLY, no restaurar |

### Migration refactor (NO aplicada)

```
20260831212401_refactor_admin_functions_remove_email_hardcode.sql
Estado: REFACTOR_READY_NOT_APPLIED
Ubicación: scratchpad/debacu-retirement/ (fuera de supabase/migrations/)
NO está en supabase/migrations/ — no puede aplicarse accidentalmente.
apply_migration = NOT_EXECUTED (rechazado antes de llegar al servidor)
```

### Gates al pausar

| Gate | Estado |
|------|--------|
| TRABFLOW_PROTECTION_GATE | ✅ PASS |
| EMAIL_TEMPLATES_GATE | ✅ CLOSED — TRABFLOW_ONLY |
| BACKUP_GATE | ✅ WAIVED_BY_OWNER |
| SECURITY_GATE_EXTERNAL | ✅ ACCEPTED_TEST_RETIREMENT_RISK |
| CROSS_DOMAIN_GATE | ⏳ REFACTOR_READY_NOT_APPLIED |
| FREEZE_GATE | ⏳ PAUSED |

```
DB-DEBACU-RETIREMENT = PAUSED
Motivo: prioridad inmediata = validación piloto instaladores + VeriFactu/facturación.
No continuar hasta nueva orden expresa.
BACKUP_GATE = WAIVED_BY_OWNER
IDENTITY_PROTECTION_SET = activo — auth.users/admin_users/trade_org_members KEEP
```

---

## Section 20 — DB-DEBACU-RETIREMENT-3A (2026-08-31)

**Fase:** PRE-FREEZE FINAL GATE + TECHNICAL BACKUP EXECUTION. 0 cambios en producción.

### Hallazgos críticos de esta fase

| Hallazgo | Detalle |
|----------|---------|
| **email_templates = TRABFLOW_ONLY** | Creada por `20260713083240_crm_email_module.sql` (TrabFlow CRM). Usada por `EmailModal.tsx`. 0 referencias Debacu. **EMAIL_TEMPLATES_GATE: CLOSED**. |
| update_updated_at_column permanente | Sirve email_templates (TrabFlow) + 5 tablas trade_*. **Nunca DROP**. |
| VF3 migration nueva | `20260831204100_vf2_fix3_emission_guard_timezone.sql` encontrada como UNTRACKED. VeriFactu carril — NO aplicar desde retirement. |
| src/lib/supabase.ts modificada | TrabFlow work (fuera de scope). |
| EF logs confirman 0 calls Debacu hoy | 7 EFs activas (todas TrabFlow), 0 Debacu EFs con actividad. |
| DB connectivity timeout | execute_sql MCP y CLI db dump fallan con `Connection terminated`. Proyecto ACTIVE_HEALTHY, Postgres sin errores, supavisor activo. Blocker PERMANENTE en esta sesión. |
| Diagnóstico definitivo | `--linked` y `--project-ref` ambos cuelgan en `Initialising login role...` (EXIT:124 timeout). Sin DB password en .env ni .env.e2e. pooler-url sin password. Management Connection bloqueada en este contexto. |

### Gate matrix final 3A

| Gate | Estado |
|------|--------|
| TRABFLOW_PROTECTION_GATE | ✅ PASS |
| EMAIL_TEMPLATES_GATE | ✅ **CLOSED** (nueva) — TRABFLOW_ONLY |
| SECURITY_GATE_EXTERNAL | ✅ ACCEPTED_TEST_RETIREMENT_RISK |
| CROSS_DOMAIN_GATE | ✅ READY_FOR_REFACTOR |
| BACKUP_GATE | ⏳ OPEN — DB_CONNECTIVITY_TIMEOUT (transiente) |
| FREEZE_GATE | ⏳ OPEN (espera backup) |
| OBSERVATION_GATE | ⏳ OPEN (48h post-freeze) |

### VEREDICTO

```
DB-DEBACU-RETIREMENT-3A: BACKUP_CONNECTIVITY_BLOCKED

BACKUP_GATE = OPEN

Razón: Management Connection bloqueada en este contexto de ejecución.
  - execute_sql MCP: Connection terminated (persistente >1h)
  - CLI --linked: hangs en Initialising login role (EXIT:124)
  - CLI --project-ref: mismo resultado (EXIT:124)
  - Sin DB password en archivos locales (.env, .env.e2e)
  - pooler-url en .temp/ = URL sin password

Proyecto: ACTIVE_HEALTHY. Postgres: sin errores. EFs TrabFlow: activas.
Supavisor: activo (recibe conexiones). Issue = login role provisioning API.

Logros:
  ✅ EMAIL_TEMPLATES_GATE cerrado → TRABFLOW_ONLY
  ✅ Todos gates non-backup: CLOSED o ACCEPTED
  ✅ VF2/VF3 clasificadas como EXTERNAL_PARALLEL_DEPENDENCY
  ✅ 0 EF Debacu activas hoy (logs confirman)
  ✅ .gitignore analizado → backup debe ir fuera del repo

Pendiente (requiere que el PROPIETARIO ejecute manualmente o en nueva sesión):
  → Script de backup listado abajo
  → Si backup OK: READY_FOR_FREEZE → activar Phase 3B
```

### Script de backup para el propietario (ejecutar desde terminal)

```bash
# 1. Crear directorio backup fuera del repo (o en scratchpad)
mkdir -p ~/debacu-backup-20260831

# 2. Schema dump (incluye TrabFlow — GLOBAL_SENSITIVE_BACKUP)
npx supabase db dump --linked -f ~/debacu-backup-20260831/backup_schema.sql

# 3. Data dump (incluye TrabFlow — NO RESTAURAR sobre producción)
npx supabase db dump --linked --data-only -f ~/debacu-backup-20260831/backup_data.sql

# 4. Verificar size > 0
ls -lh ~/debacu-backup-20260831/

# 5. Generar checksums
sha256sum ~/debacu-backup-20260831/backup_schema.sql
sha256sum ~/debacu-backup-20260831/backup_data.sql

# 6. Verificar tablas Debacu en schema dump
grep -c "debacu_" ~/debacu-backup-20260831/backup_schema.sql

# 7. Storage backup
npx supabase storage cp assets/1000144124.png ~/debacu-backup-20260831/assets_1000144124.png --experimental --linked

# 8. Guardar manifest
echo "{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"git_head\":\"465f01e\",\"scope\":\"GLOBAL_SENSITIVE_BACKUP_INCLUDES_TRABFLOW\"}" > ~/debacu-backup-20260831/MANIFEST.json
```

### Artefacto generado

```
informe_3A_A_T.md — scratchpad (fuera del repo)
Secciones A–T: baseline, VF2 status, protected set, email_templates gate,
security external, EF manifest (168: 140 DEBACU + 28 TRABFLOW),
cron manifest, storage manifest, cross-domain, auth users,
DB backup (NOT_EXECUTED - connectivity), storage backup (NOT_EXECUTED),
checksums (PENDING), backup verification (PENDING), restore test (PENDING),
infrastructure manifest, freeze sequence, observation 48h,
production changes=0, repo changes=0.
VEREDICTO: BACKUP_INCOMPLETE / DB_CONNECTIVITY_TIMEOUT
```

```
STOP.
NO FREEZE. NO DROP. NO DELETE. NO COMMIT. NO PUSH.
Próxima acción: reintentar backup cuando conectividad DB se recupere.
```
