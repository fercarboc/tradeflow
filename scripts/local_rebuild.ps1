# ─────────────────────────────────────────────────────────────────────────────
# TrabFlow — Reconstrucción completa del entorno local desde cero
#
# Uso: .\scripts\local_rebuild.ps1
#
# PRECONDICIONES:
#   - Docker Desktop corriendo
#   - Supabase CLI instalado (supabase --version)
#   - Carnes de Cantabria puede estar corriendo — este script no la toca
#
# QUÉ HACE:
#   1. Para el entorno TrabFlow si está corriendo
#   2. Arranca el stack (sin storage-api nativo) y storage manual
#   3. Marca las 15 migraciones legacy Debacu como aplicadas (sin ejecutar)
#   3b. Aplica el baseline local (pg_cron, tablas faltantes, stubs Debacu)
#       desde supabase/local/bootstrap/ — NUNCA entra en el conjunto de
#       migraciones de producción
#   4–6b. Aplica las migraciones TrabFlow; tras cada lote desactiva inmediatamente
#       cualquier cron job creado (active=false) para evitar disparos contra
#       producción durante la ventana de reconstrucción
#   6c. Elimina definitivamente los 3 cron jobs de producción (cron.unschedule)
#   7. Crea usuarios de prueba
#   8. Inserta datos semilla
#
# POR QUÉ SE DESACTIVAN LOS CRON JOBS CON UPDATE (NO CON ALTER SYSTEM):
#   cron.database_name tiene contexto 'postmaster' — solo puede cambiarse
#   reiniciando el servidor. pg_reload_conf() NO es suficiente.
#   La solución correcta: UPDATE cron.job SET active = false inmediatamente
#   después de cada lote de migraciones que los puede crear. pg_cron lee
#   la columna active antes de ejecutar cada job, por lo que el bloqueo
#   es efectivo en el siguiente ciclo del planificador (cada 60 s).
#
# TIEMPO ESTIMADO: ~5-8 minutos
# ─────────────────────────────────────────────────────────────────────────────

Set-Location $PSScriptRoot\..

$DB_URL  = "postgresql://postgres:postgres@127.0.0.1:54332/postgres"
$API_URL = "http://127.0.0.1:54335"
# Las claves se leen de supabase status después del arranque (paso [2]).
# No se hardcodean en este script para evitar filtraciones en el repositorio.
$ANON_KEY    = $null
$SERVICE_KEY = $null

function Run-SQL {
    param([string]$sql, [string]$desc = "SQL")
    Write-Host "  >> $desc"
    $result = $sql | docker exec -i supabase_db_tradeflow psql -U postgres 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR en '$desc':" -ForegroundColor Red
        Write-Host $result
        exit 1
    }
}

function Disable-CronJobs {
    # Desactiva todos los cron jobs existentes sin eliminarlos.
    # Se llama después de cada lote de migraciones para evitar disparos
    # durante la ventana de reconstrucción.
    # El paso 6c los eliminará definitivamente antes del seed.
    $sql = @"
DO \$kill_cron\$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    UPDATE cron.job SET active = false WHERE active = true;
    RAISE NOTICE 'cron jobs desactivados: %', (SELECT count(*) FROM cron.job WHERE active = false);
  END IF;
END \$kill_cron\$;
"@
    Run-SQL $sql "Desactivar cron jobs (active=false)"
}

# ──────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host " TrabFlow — Reconstrucción del entorno local" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""

# PASO 1: Parar y arrancar
Write-Host "[1/8] Parando entorno existente..."
supabase stop --no-backup 2>&1 | Out-Null
Write-Host "  OK"

Write-Host "[2/8] Arrancando stack (sin storage-api nativo, sin analytics)..."
# -x storage-api: el healthcheck del CLI falla en Windows para storage-api.
# El contenedor se arranca manualmente en el paso [2b/8] con la imagen ECR correcta.
$startOutput = supabase start -x storage-api --ignore-health-check 2>&1 | Out-String
if ($startOutput -notmatch "running") {
    Write-Host "ERROR arrancando supabase:" -ForegroundColor Red
    Write-Host $startOutput
    exit 1
}
Write-Host "  OK"

# Leer claves del entorno local generado por supabase start.
# Son claves locales derivadas del JWT secret de config.toml — no son credenciales de producción.
$statusOutput = supabase status 2>&1 | Out-String
$anonMatch    = [regex]::Match($statusOutput, 'anon key:\s+(\S+)')
$serviceMatch = [regex]::Match($statusOutput, 'service_role key:\s+(\S+)')
if (-not $anonMatch.Success -or -not $serviceMatch.Success) {
    Write-Host "ERROR: no se pudieron leer las claves de 'supabase status'" -ForegroundColor Red
    Write-Host $statusOutput
    exit 1
}
$ANON_KEY    = $anonMatch.Groups[1].Value
$SERVICE_KEY = $serviceMatch.Groups[1].Value
Write-Host "  Claves leídas de supabase status"

Write-Host "[2b/8] Arrancando storage manualmente (imagen ECR v1.73.1)..." -ForegroundColor Cyan
# El CLI v2.84.2 usa public.ecr.aws/supabase/storage-api.
# Kong ya tiene el routing configurado hacia supabase_storage_tradeflow:5000.
docker stop supabase_storage_tradeflow 2>&1 | Out-Null
docker rm supabase_storage_tradeflow 2>&1 | Out-Null
New-Item -ItemType Directory -Force -Path "C:\tradeflow\.supabase\storage" | Out-Null
docker run -d `
  --name supabase_storage_tradeflow `
  --network supabase_network_tradeflow `
  --restart unless-stopped `
  -v "C:/tradeflow/.supabase/storage:/mnt/object" `
  -e ANON_KEY="$ANON_KEY" `
  -e SERVICE_KEY="$SERVICE_KEY" `
  -e PGRST_JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long" `
  -e JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long" `
  -e POSTGREST_URL="http://supabase_rest_tradeflow:3000" `
  -e DATABASE_URL="postgresql://supabase_storage_admin:postgres@supabase_db_tradeflow:5432/postgres" `
  -e FILE_SIZE_LIMIT=52428800 `
  -e STORAGE_BACKEND=file `
  -e FILE_STORAGE_BACKEND_PATH="/mnt/object" `
  -e TENANT_ID=stub `
  -e REGION=local `
  -e GLOBAL_S3_BUCKET=stub `
  -e ENABLE_IMAGE_TRANSFORMATION=false `
  -e IMAGE_TRANSFORMATION_ENABLED=false `
  -e TUS_URL_PATH="/storage/v1/upload/resumable" `
  -e S3_PROTOCOL_PREFIX="/storage/v1" `
  "public.ecr.aws/supabase/storage-api:v1.73.1" 2>&1 | Out-Null
Start-Sleep -Seconds 6
$storageHealth = Invoke-RestMethod `
  -Uri "http://127.0.0.1:54335/storage/v1/health" `
  -Headers @{ "apikey" = $ANON_KEY } `
  -ErrorAction SilentlyContinue
if ($null -ne $storageHealth) {
  Write-Host "  OK — storage operativo" -ForegroundColor Green
} else {
  Write-Host "  WARN: storage no responde aún. Verificar con: docker logs supabase_storage_tradeflow" -ForegroundColor Yellow
}

# PASO 3: Marcar migraciones legacy como aplicadas (sin ejecutar)
Write-Host ""
Write-Host "[3/8] Marcando 15 migraciones legacy Debacu como aplicadas..." -ForegroundColor Cyan

$legacySql = @"
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version    text PRIMARY KEY,
  statements text[],
  name       text
);
INSERT INTO supabase_migrations.schema_migrations (version) VALUES
('20260321000000'),('20260322000000'),('20260323000000'),('20260324000000'),
('20260325000000'),('20260326000000'),('20260327000000'),('20260328000000'),
('20260329000000'),('20260401000000'),('20260415000000'),('20260416000000'),
('20260417000000'),('20260418000000'),('20260425000000')
ON CONFLICT DO NOTHING;
SELECT 'legacy migrations marked' as result;
"@
Run-SQL $legacySql "Marcar legacy migrations"

# PASO 3b: Aplicar baseline local
# Ubicado en supabase/local/bootstrap/ — NUNCA en supabase/migrations/.
# Crea: extensión pg_cron, 3 tablas faltantes, fix referral_code, stubs Debacu.
# Se aplica directamente vía psql, sin registro en schema_migrations.
Write-Host ""
Write-Host "[3b/8] Aplicando baseline local desde supabase/local/bootstrap/..." -ForegroundColor Cyan
$baselinePath = "supabase\local\bootstrap\00000000000000_local_baseline.sql"
if (-not (Test-Path $baselinePath)) {
    Write-Host "  ERROR: no existe $baselinePath" -ForegroundColor Red
    exit 1
}
$baselineResult = Get-Content $baselinePath -Raw | docker exec -i supabase_db_tradeflow psql -U postgres 2>&1
if ("$baselineResult" -match "ERROR") {
    Write-Host "  ERROR en baseline local:" -ForegroundColor Red
    Write-Host $baselineResult
    exit 1
}
Write-Host "  OK — baseline local aplicado"

# PASO 4: Primera ronda de migraciones (hasta antes de 20260716073811)
Write-Host ""
Write-Host "[4/8] Primera ronda de migraciones (hasta cambio de firma #1)..." -ForegroundColor Cyan

# Aplicar migraciones — van a fallar en 20260716073811, lo cual está previsto
$result1 = supabase migration up --include-all 2>&1 | Out-String
if ($result1 -match "cannot change return type.*search_supplier_products" -or
    $result1 -match "20260716073811.*ERROR") {
    Write-Host "  Pausa prevista en 20260716073811 (cambio de tipo de retorno #1)"

    # DROP de la función para permitir re-creación con nuevo tipo
    $dropSql = "DROP FUNCTION IF EXISTS public.search_supplier_products(text, uuid, integer);"
    Run-SQL $dropSql "DROP search_supplier_products v1->v2"
} elseif ($result1 -match "ERROR") {
    Write-Host "ERROR inesperado en primera ronda:" -ForegroundColor Red
    Write-Host $result1
    exit 1
}
Disable-CronJobs

# PASO 5: Segunda ronda (hasta cambio de firma #2)
Write-Host ""
Write-Host "[5/8] Segunda ronda de migraciones (hasta cambio de firma #2)..." -ForegroundColor Cyan

$result2 = supabase migration up --include-all 2>&1 | Out-String
if ($result2 -match "cannot change return type.*search_supplier_products" -or
    $result2 -match "20260719090225.*ERROR") {
    Write-Host "  Pausa prevista en 20260719090225 (cambio de tipo de retorno #2)"

    $dropSql2 = "DROP FUNCTION IF EXISTS public.search_supplier_products(text, uuid, integer);"
    Run-SQL $dropSql2 "DROP search_supplier_products v2->v3"
} elseif ($result2 -match "ERROR") {
    Write-Host "ERROR inesperado en segunda ronda:" -ForegroundColor Red
    Write-Host $result2
    exit 1
}
Disable-CronJobs

# PASO 6: Marcar migraciones de datos de producción como aplicadas
Write-Host ""
Write-Host "[6/8] Marcando 3 migraciones de datos de producción (no aplicables en local)..." -ForegroundColor Cyan

# 20260803204204 — membresía admin con UUID de producción
# 20260816072325 — fix campaña anuncios (datos ya correctos en local)
# 20260906132857 — contador contratos con org_id de producción

$skipMigrations = @"
-- Migración 20260803204204: membresía platform_super_admin con UUID de producción
INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20260803204204') ON CONFLICT DO NOTHING;

-- Migración 20260816072325: corrige campaign_source (datos en local ya son correctos)
INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20260816072325') ON CONFLICT DO NOTHING;

-- Migración 20260906132857: contador de contratos con org_id solo de producción
INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20260906132857') ON CONFLICT DO NOTHING;

SELECT 'prod-data migrations skipped' as result;
"@
Run-SQL $skipMigrations "Marcar migraciones de datos de prod"

# PASO 6b: Ronda final de migraciones
Write-Host ""
Write-Host "[6b/8] Ronda final de migraciones..." -ForegroundColor Cyan
$result3 = supabase migration up --include-all 2>&1 | Out-String
if ($result3 -match "ERROR") {
    Write-Host "ERROR en ronda final:" -ForegroundColor Red
    Write-Host $result3
    exit 1
}
Write-Host "  OK — todas las migraciones aplicadas"
Disable-CronJobs

# PASO 6c: Eliminar cron jobs de producción definitivamente
# Dos de los 3 jobs llaman a dqqjaujnulutinskmqsu.supabase.co (producción).
# Los pasos [4]/[5]/[6b] ya los desactivaron (active=false); este paso los borra.
Write-Host ""
Write-Host "[6c/8] Eliminando cron jobs de producción (definitivo)..." -ForegroundColor Cyan
$cronSql = @"
DO \$cron_preseed\$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-churn-risk') THEN
    PERFORM cron.unschedule('auto-churn-risk');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trade-maintenance-billing-daily') THEN
    PERFORM cron.unschedule('trade-maintenance-billing-daily');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoice-overdue-daily') THEN
    PERFORM cron.unschedule('invoice-overdue-daily');
  END IF;
END \$cron_preseed\$;
"@
Run-SQL $cronSql "Eliminar cron jobs (cron.unschedule)"
Write-Host "  OK"

# PASO 7: Crear usuarios de prueba
Write-Host ""
Write-Host "[7/8] Creando usuarios de prueba..." -ForegroundColor Cyan
.\scripts\local_seed_users.ps1

# PASO 8: Insertar datos semilla
Write-Host ""
Write-Host "[8/8] Insertando datos semilla..." -ForegroundColor Cyan
$seedResult = Get-Content supabase\seed.sql -Raw | docker exec -i supabase_db_tradeflow psql -U postgres 2>&1
if ($seedResult -match "ERROR") {
    Write-Host "ERROR en seed:" -ForegroundColor Red
    Write-Host $seedResult
    exit 1
}
Write-Host "  OK"

# ──────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " Entorno local listo!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host " Studio:  http://127.0.0.1:54334"
Write-Host " API:     http://127.0.0.1:54335"
Write-Host " Mailpit: http://127.0.0.1:54336"
Write-Host ""
Write-Host " Usuarios de prueba:"
Write-Host "   profesional@test.local / test1234  -> Profesional"
Write-Host "   empresa@test.local / test1234       -> Empresa"
Write-Host "   empresaplus@test.local / test1234   -> Empresa+"
Write-Host ""
Write-Host " Frontend: npm run dev"
Write-Host " Storage:  http://127.0.0.1:54335/storage/v1/health"
Write-Host "           9 buckets: trade-job-photos, trade-quote-photos, trade-voices,"
Write-Host "           trade-photos, trade-logos, org-logos, corporate-documents,"
Write-Host "           marketplace-offerings, marketplace-universal"
Write-Host ""
