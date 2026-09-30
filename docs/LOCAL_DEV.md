# Entorno local de desarrollo — TrabFlow

Supabase en Docker para desarrollo local sin afectar a producción ni a Carnes de Cantabria.

---

## Puertos asignados (TrabFlow)

| Servicio | Puerto |
|---|---|
| API / PostgREST | `54335` |
| Base de datos (PostgreSQL) | `54332` |
| Supabase Studio | `54334` |
| Mailpit (email local) | `54336` |
| Shadow DB (migraciones) | `54333` |

> Carnes de Cantabria usa 54321–54327. Los puertos de TrabFlow nunca entran en ese rango.

---

## Arrancar el entorno local

### Primera vez o reconstrucción completa

```powershell
# Desde la raíz del proyecto c:\tradeflow
.\scripts\local_rebuild.ps1
```

Esto hace los 9 pasos (incluye storage, seed y crons).

### Arranque normal (entorno ya construido)

```bash
supabase start -x storage-api --ignore-health-check
```

Y luego arrancar storage manualmente:

```powershell
docker run -d `
  --name supabase_storage_tradeflow `
  --network supabase_network_tradeflow `
  --restart unless-stopped `
  -v "C:/tradeflow/.supabase/storage:/mnt/object" `
  -e ANON_KEY="<LOCAL_ANON_KEY>" `
  -e SERVICE_KEY="<LOCAL_SERVICE_KEY>" `
  -e PGRST_JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long" `
  -e JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long" `
  -e POSTGREST_URL="http://supabase_rest_tradeflow:3000" `
  -e DATABASE_URL="postgresql://supabase_storage_admin:postgres@supabase_db_tradeflow:5432/postgres" `
  -e FILE_SIZE_LIMIT=52428800 `
  -e STORAGE_BACKEND=file `
  -e FILE_STORAGE_BACKEND_PATH="/mnt/object" `
  -e TENANT_ID=stub -e REGION=local -e GLOBAL_S3_BUCKET=stub `
  -e ENABLE_IMAGE_TRANSFORMATION=false -e IMAGE_TRANSFORMATION_ENABLED=false `
  -e TUS_URL_PATH="/storage/v1/upload/resumable" `
  -e S3_PROTOCOL_PREFIX="/storage/v1" `
  "public.ecr.aws/supabase/storage-api:v1.73.1"
```

**Por qué `-x storage-api`:** el CLI v2.84.2 espera la imagen `v1.58.17` pero el estado
de migraciones de storage en la DB fue generado por una versión más reciente. La imagen
`v1.58.17` falla con `duplicate key` al intentar re-aplicar migraciones ya presentes.
Usando la imagen `v1.73.1` (compatible con el estado real de la DB) y arrancándola
manualmente, Kong ya tiene el routing configurado y el health endpoint responde 200.

**Storage en este entorno:** 9 buckets operativos:
`trade-job-photos`, `trade-quote-photos`, `trade-voices`, `trade-photos`,
`trade-logos`, `org-logos`, `corporate-documents`, `marketplace-offerings`, `marketplace-universal`

Verificación: `curl http://127.0.0.1:54335/storage/v1/health -H "apikey: <LOCAL_ANON_KEY>"` → `200 OK`

> Obtener `<LOCAL_ANON_KEY>` ejecutando `supabase status` con el entorno arrancado.

---

## URLs de acceso

| URL | Descripción |
|---|---|
| `http://127.0.0.1:54335` | API Supabase (REST, Auth, Functions) |
| `http://127.0.0.1:54334` | Supabase Studio (explorar tablas, SQL editor) |
| `http://127.0.0.1:54336` | Mailpit — captura de emails locales |
| `postgresql://postgres:postgres@127.0.0.1:54332/postgres` | Conexión directa PostgreSQL |

---

## Frontend conectado a local

El archivo `.env.local` (ignorado por git) configura el frontend:

```bash
# Copiar la plantilla y rellenar
cp .env.example .env.local
```

Valores para entorno local (ya configurados en `.env.local`):
```
VITE_SUPABASE_URL=http://127.0.0.1:54335
VITE_SUPABASE_ANON_KEY=<LOCAL_ANON_KEY>
VITE_ENV_NAME=local
VITE_ADMIN_EMAIL=fercarboc@gmail.com
VITE_MARKETPLACE_ENABLED=false
```

Arrancar el frontend:
```bash
npm run dev
```

Aparecerá un badge naranja **"LOCAL"** en la esquina superior derecha para distinguir el entorno.

---

## Aplicar migraciones

Las migraciones se aplican automáticamente al hacer `supabase start`.
Para re-aplicar manualmente tras cambios:

```bash
supabase migration up --include-all
```

### Historial de migraciones

El proyecto tiene dos eras de migraciones:

1. **Legacy Debacu** (prefijos 2026032x–2026042x, 15 archivos): marcadas como aplicadas sin ejecutar.
   Están en `supabase/migrations-legacy/` como referencia histórica.

2. **TrabFlow** (2026052x en adelante): se aplican normalmente.

El archivo `supabase/local/bootstrap/00000000000000_local_baseline.sql` crea los stubs mínimos
necesarios para que las migraciones de seguridad de TrabFlow puedan aplicarse en una BD limpia.
Se aplica explícitamente en el paso [3b] del script de reconstrucción y **nunca** entra en
el conjunto de migraciones de producción.

### Migraciones que se saltan en local

Tres migraciones contienen datos específicos de producción y se marcan como aplicadas sin ejecutar:

| Versión | Razón |
|---|---|
| `20260803204204` | Membresía admin del actor marketplace con UUID de producción |
| `20260816072325` | Fix de campaña de anuncios con datos de producción |
| `20260906132857` | Contador de contratos con `org_id` de producción |

---

## Crear usuarios de prueba

Los usuarios se crean una sola vez via la API admin local.

**Credenciales de acceso:**

| Email | Contraseña | Plan | Organización |
|---|---|---|---|
| `profesional@test.local` | `test1234` | Profesional | Instalaciones Martínez SL |
| `empresa@test.local` | `test1234` | Empresa | García Fontanería y Climatización |
| `empresaplus@test.local` | `test1234` | Empresa+ | López Servicios Integrales SL |

Para recrearlos si se destruye el contenedor:

```bash
# Script de creación (PowerShell)
$base = "http://127.0.0.1:54335"
# Obtener $secret ejecutando: (supabase status | Select-String 'service_role key').ToString().Split()[-1]
$secret = "<LOCAL_SERVICE_KEY>"

@(
  @{ email = "profesional@test.local"; password = "test1234"; name = "Carlos Martínez" },
  @{ email = "empresa@test.local"; password = "test1234"; name = "Ana García" },
  @{ email = "empresaplus@test.local"; password = "test1234"; name = "Roberto López" }
) | ForEach-Object {
  $body = @{
    email = $_.email; password = $_.password
    email_confirm = $true
    user_metadata = @{ full_name = $_.name }
  } | ConvertTo-Json
  Invoke-RestMethod -Uri "$base/auth/v1/admin/users" -Method Post `
    -Headers @{ Authorization = "Bearer $secret"; "Content-Type" = "application/json"; apikey = $secret } `
    -Body $body
}
```

Después insertar las organizaciones via SQL (ver `supabase/seed.sql`).

---

## Regenerar datos semilla

```bash
# Conexión directa a PostgreSQL local
psql postgresql://postgres:postgres@127.0.0.1:54332/postgres -f supabase/seed.sql
```

---

## Detener el entorno

```bash
supabase stop
```

Los datos **persisten** entre reinicios (volúmenes Docker).
Para destruir los datos y empezar desde cero:

```powershell
# Destruye volúmenes y reconstruye desde cero (~5-8 min)
.\scripts\local_rebuild.ps1
```

---

## Integraciones desactivadas en local

| Integración | Estado en local |
|---|---|
| Stripe | Sin claves — pagos no funcionan |
| Email externo | Capturado en Mailpit (`http://127.0.0.1:54336`) |
| WhatsApp | Sin secrets — no se envía nada |
| AEAT / VeriFactu | Kill switch activo — no se transmite nada |
| Push notifications | Sin VAPID — no llegan notificaciones |
| Pedidos a proveedores | Marketplace desactivado (`VITE_MARKETPLACE_ENABLED=false`) |
| Cron jobs | Todos desactivados en seed — 2 de ellos llamaban a `dqqjaujnulutinskmqsu.supabase.co` |

---

## Notas de coexistencia con Carnes de Cantabria

- TrabFlow usa el `project_id = "tradeflow"` en `config.toml`.  
  Todos sus contenedores Docker tienen el sufijo `_tradeflow`.
- CdC usa puertos 54321–54327. TrabFlow usa 54332–54337.
- Nunca usar `docker system prune` ni comandos globales de Docker.
- Para ver solo los contenedores de TrabFlow: `docker ps --filter name=tradeflow`
