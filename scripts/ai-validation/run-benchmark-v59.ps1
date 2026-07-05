# Benchmark v59 — 400 casos — Sprint 4 P1 validation
# run_id: 8b6c0679-64be-4de1-8410-2f32007ff85b
# benchmark_id: a0000000-0000-0000-0000-000000000001

$RUN_ID       = "8b6c0679-64be-4de1-8410-2f32007ff85b"
$BENCHMARK_ID = "a0000000-0000-0000-0000-000000000001"
$BATCH_SIZE   = 10
$FN_URL       = "https://dqqjaujnulutinskmqsu.supabase.co/functions/v1/trade-benchmark-runner"
$TEST_KEY     = $env:TRADE_TEST_KEY
$LOG_FILE     = "$PSScriptRoot\benchmark-v59-progress.log"

if (-not $TEST_KEY) {
    Write-Error "TRADE_TEST_KEY no definida en el entorno. Abortando."
    exit 1
}

function Log($msg) {
    $ts = Get-Date -Format "HH:mm:ss"
    $line = "[$ts] $msg"
    Write-Host $line
    Add-Content -Path $LOG_FILE -Value $line
}

Log "=== Benchmark v59 iniciado ==="
Log "run_id=$RUN_ID  benchmark_id=$BENCHMARK_ID  batch_size=$BATCH_SIZE"

$batchStart  = 1
$totalOk     = 0
$totalVacio  = 0
$totalTrunc  = 0
$totalPrecio = 0
$totalErrors = 0
$batchNum    = 0

do {
    $batchNum++
    $payload = @{
        run_id       = $RUN_ID
        benchmark_id = $BENCHMARK_ID
        batch_start  = $batchStart
        batch_size   = $BATCH_SIZE
    } | ConvertTo-Json -Compress

    $t0 = Get-Date
    try {
        $resp = Invoke-RestMethod -Uri $FN_URL `
            -Method POST `
            -Headers @{ Authorization = "Bearer $TEST_KEY"; "Content-Type" = "application/json" } `
            -Body $payload `
            -TimeoutSec 120

        $elapsed = [int]((Get-Date) - $t0).TotalSeconds

        $categories = $resp.batch_results | Group-Object categoria
        foreach ($g in $categories) {
            switch ($g.Name) {
                "OK_CATALOGO"    { $totalOk     += $g.Count }
                "OK_MIXTO"       { $totalOk     += $g.Count }
                "SOLO_SUGERIDAS" { $totalOk     += $g.Count }
                "VACIO"          { $totalVacio  += $g.Count }
                "TRUNCADO"       { $totalTrunc  += $g.Count }
                "PRECIO_INVALIDO"{ $totalPrecio += $g.Count }
                "ERROR_TECNICO"  { $totalErrors += $g.Count }
            }
        }

        $executed = $resp.executed
        $isComplete = $resp.is_complete

        Log ("Batch $batchNum | pos=$batchStart-$($batchStart+$executed-1) | {0}s | VACIO=$totalVacio TRUNC=$totalTrunc P.INV=$totalPrecio ERR=$totalErrors" -f $elapsed)

        if ($resp.errors_in_batch -gt 0) {
            Log "  ADVERTENCIA: $($resp.errors_in_batch) errores de inserción en este batch"
        }

        $batchStart = $resp.next_batch_start

        if (-not $isComplete) {
            Start-Sleep -Milliseconds 300
        }

    } catch {
        $elapsed = [int]((Get-Date) - $t0).TotalSeconds
        Log "ERROR en batch $batchNum (pos=$batchStart, ${elapsed}s): $_"
        $totalErrors += $BATCH_SIZE
        $batchStart  += $BATCH_SIZE
        Start-Sleep -Seconds 2
    }

} while ($batchStart -le 400)

$totalProcessed = $totalOk + $totalVacio + $totalTrunc + $totalPrecio + $totalErrors
$okPct = if ($totalProcessed -gt 0) { [math]::Round($totalOk * 100.0 / $totalProcessed, 1) } else { 0 }

Log ""
Log "=== RESULTADO FINAL ==="
Log "Total procesados : $totalProcessed"
Log "OK (all)         : $totalOk  ($okPct%)"
Log "VACÍO            : $totalVacio"
Log "TRUNCADO         : $totalTrunc"
Log "PRECIO_INVALIDO  : $totalPrecio"
Log "ERROR_TECNICO    : $totalErrors"
Log ""

if ($totalVacio -eq 0 -and $totalTrunc -eq 0 -and $totalPrecio -eq 0 -and $okPct -ge 92.8) {
    Log "✓ CRITERIOS DE PROMOCIÓN CUMPLIDOS — v59 puede promoverse a producción"
} else {
    $fails = @()
    if ($totalVacio -gt 0)       { $fails += "VACÍO=$totalVacio (esperado 0)" }
    if ($totalTrunc -gt 0)       { $fails += "TRUNCADO=$totalTrunc (esperado 0)" }
    if ($totalPrecio -gt 0)      { $fails += "PRECIO_INVALIDO=$totalPrecio (esperado 0)" }
    if ($okPct -lt 92.8)         { $fails += "OK=$okPct% (mínimo 92.8%)" }
    Log "✗ CRITERIOS NO CUMPLIDOS: $($fails -join ' | ')"
}

Log "Log completo en: $LOG_FILE"
