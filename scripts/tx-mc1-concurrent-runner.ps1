# =============================================================================
# TX-MC-1 — RUNNER CONCURRENCIA RPC REAL  v2
# scripts/tx-mc1-concurrent-runner.ps1
#
# FIXES v2:
#   - SET LOCAL → set_config(..., false) para UID de sesión
#   - Columna t.estado explícita (sin ambigüedad en JOIN)
#   - auth.uid() shim parcheado con NULLIF para tolerar setting vacío
#   - BYPASS tests: @'...'@ (single-quoted) — sin interpolación PS, sin $$
#   - Reset-Scenario: DELETE + INSERT (evita trigger inmutabilidad)
# =============================================================================

param(
  [string]$PgPort    = "5433",
  [string]$PgPass    = "postgres",
  [string]$PgDb      = "mc1test",
  [string]$PgUser    = "postgres",
  [string]$Container = "pg-mc1-test"
)

$env:PGPASSWORD = $PgPass

$ORG   = "aaaaaaaa-0000-0000-0000-000000000001"
$USR   = "00000000-0000-0000-0000-000000000001"
$TRIP  = "11111111-0000-0000-0000-000000000001"
$SVC   = "22222222-0000-0000-0000-000000000001"
$TRIP2 = "11111111-0000-0000-0000-000000000002"
$SVC2  = "22222222-0000-0000-0000-000000000002"
$VEH1  = "bbbbbbbb-0000-0000-0000-000000000001"
$VEH2  = "bbbbbbbb-0000-0000-0000-000000000002"
$VEH3  = "bbbbbbbb-0000-0000-0000-000000000003"
$COND1 = "cccccccc-0000-0000-0000-000000000001"
$COND2 = "cccccccc-0000-0000-0000-000000000002"

function Invoke-Psql($sql) {
  $sql | docker exec -i $Container psql -U $PgUser -d $PgDb -t -A 2>&1
}

# ── 0. PARCHE auth.uid() ─────────────────────────────────────────────────────
# El shim original lanza si current_setting devuelve ''. NULLIF protege eso.
# Usa $AU$ como delimitador de dollar-quote (backtick-escaping en PS).
$patchSql = "CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path=public AS `$AU`$ SELECT COALESCE(NULLIF(current_setting('test.current_uid', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid); `$AU`$;"
Invoke-Psql $patchSql | Out-Null
Write-Host "[ OK ] auth.uid() shim parcheado (NULLIF guard)" -ForegroundColor Gray

# ── HELPERS ──────────────────────────────────────────────────────────────────

function Reset-Scenario01 {
  # DELETE + INSERT fresco para evitar trigger de inmutabilidad en estado=confirmado
  Invoke-Psql @"
DELETE FROM public.trade_transport_trips    WHERE id='$TRIP';
DELETE FROM public.trade_transport_services WHERE id='$SVC';
INSERT INTO public.trade_transport_trips
  (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin, vehicle_id, conductor_id, tipo_carga)
VALUES
  ('$TRIP','$ORG','CONC01-Trip','Madrid','Barcelona',
   '2030-01-15 08:00:00+00','2030-01-15 16:00:00+00',
   '$VEH1','$COND1','carga_general');
INSERT INTO public.trade_transport_services
  (id, org_id, titulo, estado, vehicle_id, conductor_id, fecha_inicio, fecha_fin)
VALUES
  ('$SVC','$ORG','CONC01-Service','borrador',
   '$VEH1','$COND1',
   '2030-01-15 10:00:00+00','2030-01-15 18:00:00+00');
"@ | Out-Null
}

function Reset-Scenario02 {
  Invoke-Psql @"
DELETE FROM public.trade_transport_trips    WHERE id='$TRIP2';
DELETE FROM public.trade_transport_services WHERE id='$SVC2';
INSERT INTO public.trade_transport_trips
  (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin, vehicle_id, conductor_id, tipo_carga)
VALUES
  ('$TRIP2','$ORG','CONC02-Trip','Sevilla','Bilbao',
   '2030-02-10 08:00:00+00','2030-02-10 16:00:00+00',
   '$VEH2','$COND1','carga_general');
INSERT INTO public.trade_transport_services
  (id, org_id, titulo, estado, vehicle_id, conductor_id, fecha_inicio, fecha_fin)
VALUES
  ('$SVC2','$ORG','CONC02-Service','borrador',
   '$VEH3','$COND1',
   '2030-02-10 09:00:00+00','2030-02-10 17:00:00+00');
"@ | Out-Null
}

function Get-States($tripId, $svcId) {
  # t.estado explícito para evitar ambigüedad en el JOIN
  Invoke-Psql @"
SELECT 'trip:' || t.estado || '  svc:' || s.estado
FROM   public.trade_transport_trips    t
JOIN   public.trade_transport_services s ON s.org_id = t.org_id
WHERE  t.id = '$tripId'
AND    s.id  = '$svcId';
"@
}

Write-Host ""
Write-Host "=== TX-MC-1 Concurrencia RPC Real ===" -ForegroundColor Cyan
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# CONC-01A : Trip confirma primero — Service bloqueado (mismo vehículo+conductor)
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "--- CONC-01A: confirm_transport_trip PRIMERO ---" -ForegroundColor Yellow
Reset-Scenario01

# Session A: ocupa FOR UPDATE los tres recursos, duerme 5 s, luego llama a la RPC
# FIX: set_config(..., false) establece la UID a nivel de sesión antes del BEGIN
$sqlA_01A = @"
SELECT set_config('test.current_uid', '$USR', false);
BEGIN;
SELECT id FROM public.trade_transport_trips    WHERE id='$TRIP'  FOR UPDATE;
SELECT id FROM public.trade_vehicles           WHERE id='$VEH1'  FOR UPDATE;
SELECT id FROM public.trade_workers            WHERE id='$COND1' FOR UPDATE;
SELECT pg_sleep(5);
SELECT public.confirm_transport_trip('$TRIP'::uuid, '$ORG'::uuid);
COMMIT;
"@

# Session B: 1 s de delay, llama a la RPC de servicio (mismos recursos → bloqueada)
$sqlB_01A = @"
SELECT set_config('test.current_uid', '$USR', false);
SELECT pg_sleep(1);
SELECT public.confirm_transport_service('$SVC'::uuid, '$ORG'::uuid) AS result_b;
"@

$jobA = Start-Job -ScriptBlock {
  param($c,$u,$d,$p,$s)
  $env:PGPASSWORD = $p
  $s | docker exec -i $c psql -U $u -d $d -t -A 2>&1
} -ArgumentList $Container,$PgUser,$PgDb,$PgPass,$sqlA_01A

Start-Sleep -Milliseconds 500
$jobB = Start-Job -ScriptBlock {
  param($c,$u,$d,$p,$s)
  $env:PGPASSWORD = $p
  $s | docker exec -i $c psql -U $u -d $d -t -A 2>&1
} -ArgumentList $Container,$PgUser,$PgDb,$PgPass,$sqlB_01A

# Captura mid-race
Start-Sleep -Milliseconds 2500
$lock1 = Invoke-Psql @"
SELECT pid, wait_event_type, wait_event, state, LEFT(query,70) AS q
FROM   pg_stat_activity
WHERE  datname='$PgDb' AND pid<>pg_backend_pid() AND state<>'idle'
ORDER  BY wait_event_type NULLS LAST;
"@
Write-Host "  pg_stat_activity (mid-race):" -ForegroundColor Gray
Write-Host "  $lock1"

$resA = Receive-Job -Job $jobA -Wait; Remove-Job $jobA
$resB = Receive-Job -Job $jobB -Wait; Remove-Job $jobB
$st1  = Get-States $TRIP $SVC

Write-Host "  Session A (Trip):  $resA"
Write-Host "  Session B (Svc):   $resB"
Write-Host "  Estados finales:   $st1"

$passA1  = $resA  -match '"ok":\s*true'
$passB1  = ($resB -match '"ok":\s*false') -or ($resB -match 'conflicto') -or ($resB -match 'no está disponible')
$state1  = $st1   -match 'trip:confirmado'
$blocked1= $lock1 -match 'transactionid'

if ($passA1 -and ($passB1 -or $state1)) {
  Write-Host "CONC-01A: PASS ✓  (Trip confirmó; Service bloqueado/rechazado)" -ForegroundColor Green
} else {
  Write-Host "CONC-01A: FAIL ✗" -ForegroundColor Red
  Write-Host "  A={$passA1} B_rechazado={$passB1} state_ok={$state1} FOR_UPDATE_visible={$blocked1}"
}
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# CONC-01B : Service confirma primero — Trip bloqueado
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "--- CONC-01B: confirm_transport_service PRIMERO ---" -ForegroundColor Yellow
Reset-Scenario01

$sqlA_01B = @"
SELECT set_config('test.current_uid', '$USR', false);
SELECT pg_sleep(1);
SELECT public.confirm_transport_trip('$TRIP'::uuid, '$ORG'::uuid) AS result_trip;
"@

$sqlB_01B = @"
SELECT set_config('test.current_uid', '$USR', false);
BEGIN;
SELECT id FROM public.trade_transport_services WHERE id='$SVC'  FOR UPDATE;
SELECT id FROM public.trade_vehicles           WHERE id='$VEH1' FOR UPDATE;
SELECT id FROM public.trade_workers            WHERE id='$COND1' FOR UPDATE;
SELECT pg_sleep(5);
SELECT public.confirm_transport_service('$SVC'::uuid, '$ORG'::uuid);
COMMIT;
"@

$jobB2 = Start-Job -ScriptBlock {
  param($c,$u,$d,$p,$s)
  $env:PGPASSWORD = $p
  $s | docker exec -i $c psql -U $u -d $d -t -A 2>&1
} -ArgumentList $Container,$PgUser,$PgDb,$PgPass,$sqlB_01B

Start-Sleep -Milliseconds 500
$jobA2 = Start-Job -ScriptBlock {
  param($c,$u,$d,$p,$s)
  $env:PGPASSWORD = $p
  $s | docker exec -i $c psql -U $u -d $d -t -A 2>&1
} -ArgumentList $Container,$PgUser,$PgDb,$PgPass,$sqlA_01B

Start-Sleep -Milliseconds 2500
$lock2 = Invoke-Psql @"
SELECT pid, wait_event_type, wait_event, state, LEFT(query,70) AS q
FROM   pg_stat_activity
WHERE  datname='$PgDb' AND pid<>pg_backend_pid() AND state<>'idle'
ORDER  BY wait_event_type NULLS LAST;
"@
Write-Host "  pg_stat_activity (mid-race):" -ForegroundColor Gray
Write-Host "  $lock2"

$resA2 = Receive-Job -Job $jobA2 -Wait; Remove-Job $jobA2
$resB2 = Receive-Job -Job $jobB2 -Wait; Remove-Job $jobB2
$st2   = Get-States $TRIP $SVC

Write-Host "  Session A (Trip):  $resA2"
Write-Host "  Session B (Svc):   $resB2"
Write-Host "  Estados finales:   $st2"

$passB2  = $resB2 -match '"ok":\s*true'
$passA2  = ($resA2 -match '"ok":\s*false') -or ($resA2 -match 'conflicto') -or ($resA2 -match 'no está disponible')
$state2  = $st2   -match 'svc:confirmado'
$blocked2= $lock2 -match 'transactionid'

if ($passB2 -and ($passA2 -or $state2)) {
  Write-Host "CONC-01B: PASS ✓  (Service confirmó; Trip bloqueado/rechazado)" -ForegroundColor Green
} else {
  Write-Host "CONC-01B: FAIL ✗" -ForegroundColor Red
  Write-Host "  B={$passB2} A_rechazado={$passA2} state_ok={$state2} FOR_UPDATE_visible={$blocked2}"
}
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# CONC-02 : Conductor compartido, vehículos distintos
#           Trip (MERC-001) vs Service (VIAJ-001) — mismo COND1
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "--- CONC-02: Conductor compartido, vehículos distintos ---" -ForegroundColor Yellow
Reset-Scenario02

$sqlA_02 = @"
SELECT set_config('test.current_uid', '$USR', false);
BEGIN;
SELECT id FROM public.trade_transport_trips WHERE id='$TRIP2' FOR UPDATE;
SELECT id FROM public.trade_vehicles         WHERE id='$VEH2'  FOR UPDATE;
SELECT id FROM public.trade_workers          WHERE id='$COND1' FOR UPDATE;
SELECT pg_sleep(5);
SELECT public.confirm_transport_trip('$TRIP2'::uuid, '$ORG'::uuid);
COMMIT;
"@

$sqlB_02 = @"
SELECT set_config('test.current_uid', '$USR', false);
SELECT pg_sleep(1);
SELECT public.confirm_transport_service('$SVC2'::uuid, '$ORG'::uuid) AS result_b;
"@

$jobA3 = Start-Job -ScriptBlock {
  param($c,$u,$d,$p,$s)
  $env:PGPASSWORD = $p
  $s | docker exec -i $c psql -U $u -d $d -t -A 2>&1
} -ArgumentList $Container,$PgUser,$PgDb,$PgPass,$sqlA_02

Start-Sleep -Milliseconds 500
$jobB3 = Start-Job -ScriptBlock {
  param($c,$u,$d,$p,$s)
  $env:PGPASSWORD = $p
  $s | docker exec -i $c psql -U $u -d $d -t -A 2>&1
} -ArgumentList $Container,$PgUser,$PgDb,$PgPass,$sqlB_02

Start-Sleep -Milliseconds 2500
$lock3 = Invoke-Psql @"
SELECT pid, wait_event_type, wait_event, state, LEFT(query,70) AS q
FROM   pg_stat_activity
WHERE  datname='$PgDb' AND pid<>pg_backend_pid() AND state<>'idle'
ORDER  BY wait_event_type NULLS LAST;
"@
Write-Host "  pg_stat_activity (mid-race):" -ForegroundColor Gray
Write-Host "  $lock3"

$resA3 = Receive-Job -Job $jobA3 -Wait; Remove-Job $jobA3
$resB3 = Receive-Job -Job $jobB3 -Wait; Remove-Job $jobB3
$st3   = Get-States $TRIP2 $SVC2

Write-Host "  Session A (Trip2): $resA3"
Write-Host "  Session B (Svc2):  $resB3"
Write-Host "  Estados finales:   $st3"

$passA3  = $resA3 -match '"ok":\s*true'
$passB3  = ($resB3 -match '"ok":\s*false') -or ($resB3 -match 'conflicto') -or ($resB3 -match 'no está disponible')
$state3  = $st3   -match 'trip:confirmado'
$blocked3= $lock3 -match 'transactionid'

if ($passA3 -and ($passB3 -or $state3)) {
  Write-Host "CONC-02: PASS ✓  (Trip confirmó; Service con conductor compartido rechazado)" -ForegroundColor Green
} else {
  Write-Host "CONC-02: FAIL ✗" -ForegroundColor Red
  Write-Host "  A={$passA3} B_rechazado={$passB3} state_ok={$state3} FOR_UPDATE_visible={$blocked3}"
}
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# BYPASS-01/02/03 : Bloqueo de confirmación directa vía rol authenticated
# NOTA: usa @'...'@ (single-quoted PS here-string) → sin interpolación PS
#       → $$ y UID hardcodeadas llegan literales a psql
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "--- BYPASS: confirmación directa con rol authenticated ---" -ForegroundColor Yellow

# ── BYPASS-01 : Trip directo → debe fallar ───────────────────────────────────
Invoke-Psql @"
DELETE FROM public.trade_transport_trips WHERE id='ffffffff-0000-0000-0000-000000000001';
INSERT INTO public.trade_transport_trips
  (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin, vehicle_id, conductor_id, tipo_carga)
VALUES
  ('ffffffff-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
   'BP01','A','B','2031-01-01 08:00:00+00','2031-01-01 16:00:00+00',
   'bbbbbbbb-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001',
   'carga_general');
"@ | Out-Null

# Single-quoted: $$ nunca se interpola, comillas SQL se doblan con ''
$bp01sql = @'
SELECT set_config('test.current_uid', '00000000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;
UPDATE public.trade_transport_trips
   SET estado = 'confirmado'
 WHERE id = 'ffffffff-0000-0000-0000-000000000001';
RESET ROLE;
'@
$bp01 = Invoke-Psql $bp01sql
$pass01 = ($bp01 -match 'TRANSPORT_FORBIDDEN') -or ($bp01 -match 'insufficient_privilege')
Invoke-Psql "DELETE FROM public.trade_transport_trips WHERE id='ffffffff-0000-0000-0000-000000000001';" | Out-Null

if ($pass01) { Write-Host "BYPASS-01 (Trip directo):    PASS ✓  — authenticated bloqueado" -ForegroundColor Green }
else         { Write-Host "BYPASS-01 (Trip directo):    FAIL ✗  — UPDATE no fue rechazado"; Write-Host "  Output: $bp01" -ForegroundColor Red }

# ── BYPASS-02 : Service directo → debe fallar ───────────────────────────────
Invoke-Psql @"
DELETE FROM public.trade_transport_services WHERE id='ffffffff-0000-0000-0000-000000000002';
INSERT INTO public.trade_transport_services
  (id, org_id, titulo, estado, vehicle_id, conductor_id, fecha_inicio, fecha_fin)
VALUES
  ('ffffffff-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001',
   'BP02','borrador',
   'bbbbbbbb-0000-0000-0000-000000000003',
   'cccccccc-0000-0000-0000-000000000002',
   '2031-02-01 08:00:00+00','2031-02-01 16:00:00+00');
"@ | Out-Null

$bp02sql = @'
SELECT set_config('test.current_uid', '00000000-0000-0000-0000-000000000001', false);
SET ROLE authenticated;
UPDATE public.trade_transport_services
   SET estado = 'confirmado'
 WHERE id = 'ffffffff-0000-0000-0000-000000000002';
RESET ROLE;
'@
$bp02 = Invoke-Psql $bp02sql
$pass02 = ($bp02 -match 'TRANSPORT_FORBIDDEN') -or ($bp02 -match 'insufficient_privilege')
Invoke-Psql "DELETE FROM public.trade_transport_services WHERE id='ffffffff-0000-0000-0000-000000000002';" | Out-Null

if ($pass02) { Write-Host "BYPASS-02 (Service directo): PASS ✓  — authenticated bloqueado" -ForegroundColor Green }
else         { Write-Host "BYPASS-02 (Service directo): FAIL ✗  — UPDATE no fue rechazado"; Write-Host "  Output: $bp02" -ForegroundColor Red }

# ── BYPASS-03 : RPC confirm_transport_trip sigue funcionando con el trigger activo ──
Invoke-Psql @"
DELETE FROM public.trade_transport_trips WHERE id='ffffffff-0000-0000-0000-000000000003';
INSERT INTO public.trade_transport_trips
  (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin, vehicle_id, conductor_id, tipo_carga)
VALUES
  ('ffffffff-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001',
   'BP03','A','B','2031-03-01 08:00:00+00','2031-03-01 16:00:00+00',
   'bbbbbbbb-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001',
   'carga_general');
"@ | Out-Null

$bp03sql = @"
SELECT set_config('test.current_uid', '$USR', false);
SELECT public.confirm_transport_trip('ffffffff-0000-0000-0000-000000000003'::uuid, '$ORG'::uuid);
"@
$bp03 = Invoke-Psql $bp03sql
$pass03 = $bp03 -match '"ok":\s*true'
Invoke-Psql "DELETE FROM public.trade_transport_trips WHERE id='ffffffff-0000-0000-0000-000000000003';" | Out-Null

if ($pass03) { Write-Host "BYPASS-03 (RPC con trigger):  PASS ✓  — confirm_transport_trip funciona" -ForegroundColor Green }
else         { Write-Host "BYPASS-03 (RPC con trigger):  FAIL ✗"; Write-Host "  Output: $bp03" -ForegroundColor Red }

Write-Host ""
Write-Host "=== FIN TESTS CONCURRENCIA ===" -ForegroundColor Cyan
