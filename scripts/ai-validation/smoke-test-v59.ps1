#!/usr/bin/env pwsh
# Smoke Test v59 — verifica que Edge Function v65 está activa y no hay truncado
# Uso: .\smoke-test-v59.ps1
# No afecta a datos de producción (isAnonRequest=true, orgId=null, no se crea presupuesto)

param(
  [string]$TestKey = $env:TRADE_TEST_KEY
)

if (-not $TestKey) {
  Write-Error "TRADE_TEST_KEY no definido. Exporta la variable de entorno o pasa -TestKey."
  exit 1
}

$EdgeUrl = "https://dqqjaujnulutinskmqsu.supabase.co/functions/v1/trade-voice-to-quote"

$cases = @(
  @{ label = "Fontanería simple";   text = "Instalar grifo monomando en cocina, incluye mano de obra y material" },
  @{ label = "Electricidad";        text = "Cambiar cuadro eléctrico en piso de 80m2, ICP y diferenciales" },
  @{ label = "Reforma compleja";    text = "Renovación completa de baño: alicatado, sanitarios, fontanería, electricidad y pintura" }
)

$results = @()

foreach ($c in $cases) {
  $body = @{ text = $c.text } | ConvertTo-Json -Compress

  try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $resp = Invoke-RestMethod `
      -Uri $EdgeUrl `
      -Method POST `
      -Headers @{
        "Authorization" = "Bearer $TestKey"
        "Content-Type"  = "application/json"
        "Origin"        = "http://localhost:5173"
      } `
      -Body $body `
      -TimeoutSec 60
    $sw.Stop()

    $meta        = $resp._meta
    $version     = $meta.prompt_version ?? "—"
    $stop        = $meta.stop_reason    ?? "—"
    $tokIn       = $meta.tokens_in      ?? 0
    $tokOut      = $meta.tokens_out     ?? 0
    $partidas    = ($resp.partidas | Measure-Object).Count

    $ok = ($version -eq "v59") -and ($stop -eq "end_turn")

    $results += [PSCustomObject]@{
      Label     = $c.label
      Version   = $version
      StopRazón = $stop
      TokIn     = $tokIn
      TokOut    = $tokOut
      Partidas  = $partidas
      LatenMs   = $sw.ElapsedMilliseconds
      OK        = if ($ok) { "✓" } else { "✗" }
    }

    if (-not $ok) {
      Write-Warning "FALLO en '$($c.label)': version=$version stop=$stop"
    }

  } catch {
    $results += [PSCustomObject]@{
      Label     = $c.label
      Version   = "ERROR"
      StopRazón = $_.Exception.Message.Substring(0, [Math]::Min(60, $_.Exception.Message.Length))
      TokIn     = 0; TokOut = 0; Partidas = 0; LatenMs = 0; OK = "✗"
    }
  }
}

Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  SMOKE TEST v59 — $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
$results | Format-Table Label, Version, StopRazón, TokIn, TokOut, Partidas, LatenMs, OK -AutoSize

$passed = ($results | Where-Object { $_.OK -eq "✓" }).Count
$total  = $results.Count

Write-Host ""
if ($passed -eq $total) {
  Write-Host "  SMOKE TEST PASSED — $passed/$total ✓  v59 activo, sin truncado" -ForegroundColor Green
} else {
  Write-Host "  SMOKE TEST FAILED — $passed/$total ✓" -ForegroundColor Red
  Write-Host "  Revisar logs Edge Function: supabase functions logs trade-voice-to-quote" -ForegroundColor Yellow
  exit 1
}
