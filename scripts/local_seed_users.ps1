# ─────────────────────────────────────────────────────────────────────────────
# TrabFlow — Crear usuarios de prueba en Supabase local
#
# Ejecutar DESPUÉS de: supabase start -x storage-api --ignore-health-check
# Ejecutar ANTES de:   psql ... -f supabase/seed.sql
#
# Uso: .\scripts\local_seed_users.ps1
# ─────────────────────────────────────────────────────────────────────────────

$BASE_URL = "http://127.0.0.1:54335"

# Leer la clave de servicio del entorno local activo (no hardcodear en el repositorio).
$statusOutput = supabase status 2>&1 | Out-String
$serviceMatch = [regex]::Match($statusOutput, 'service_role key:\s+(\S+)')
if (-not $serviceMatch.Success) {
    Write-Host "ERROR: no se encontró 'service_role key' en 'supabase status'." -ForegroundColor Red
    Write-Host "Asegúrate de que el entorno local está arrancado: supabase start -x storage-api --ignore-health-check" -ForegroundColor Yellow
    exit 1
}
$SERVICE_KEY = $serviceMatch.Groups[1].Value

$USERS = @(
    @{ email = "profesional@test.local"; password = "test1234"; name = "Carlos Martínez" },
    @{ email = "empresa@test.local";     password = "test1234"; name = "Ana García"      },
    @{ email = "empresaplus@test.local"; password = "test1234"; name = "Roberto López"   }
)

Write-Host "Creando usuarios de prueba en $BASE_URL..."
Write-Host ""

foreach ($u in $USERS) {
    $body = @{
        email         = $u.email
        password      = $u.password
        email_confirm = $true
        user_metadata = @{ full_name = $u.name }
    } | ConvertTo-Json

    try {
        $resp = Invoke-RestMethod `
            -Uri "$BASE_URL/auth/v1/admin/users" `
            -Method Post `
            -Headers @{
                "Authorization" = "Bearer $SERVICE_KEY"
                "Content-Type"  = "application/json"
                "apikey"        = $SERVICE_KEY
            } `
            -Body $body `
            -ErrorAction Stop

        Write-Host "  OK  $($u.email) → $($resp.id)"
    }
    catch {
        $errBody = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($errBody.msg -like "*already exists*" -or $errBody.code -eq "email_exists") {
            Write-Host "  --  $($u.email) ya existe, sin cambios"
        } else {
            Write-Host "  ERR $($u.email): $($_.Exception.Message)"
        }
    }
}

Write-Host ""
Write-Host "Listo. Ahora ejecutar el seed SQL:"
Write-Host "  psql postgresql://postgres:postgres@127.0.0.1:54332/postgres -f supabase/seed.sql"
