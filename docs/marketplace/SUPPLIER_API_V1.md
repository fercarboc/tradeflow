# TrabFlow Supplier API v1

**Versión:** `2026-08-01`  
**Base URL:** `https://dqqjaujnulutinskmqsu.supabase.co/functions/v1/supplier-api-v1/api/v1/supplier`

---

## Índice

1. [Autenticación](#autenticación)
2. [Gestión de credenciales](#gestión-de-credenciales)
3. [Endpoints](#endpoints)
4. [Formatos de datos](#formatos-de-datos)
5. [Errores](#errores)
6. [Rate limiting](#rate-limiting)
7. [Idempotencia](#idempotencia)
8. [Rotación de credenciales](#rotación-de-credenciales)
9. [Límites](#límites)
10. [Seguridad](#seguridad)

---

## Autenticación

Todas las peticiones deben incluir la API key en la cabecera `Authorization`:

```
Authorization: Bearer tsf_v1_<64_hex_chars>
```

El actor (empresa proveedora) se resuelve automáticamente a partir de la credencial. Nunca debes incluir un `actor_id` en el cuerpo de la petición — se ignora por seguridad.

### Scopes requeridos por endpoint

| Endpoint | Scope requerido |
|---|---|
| `POST /catalog/upsert` | `catalog:write` |
| `GET /catalog/products` | `catalog:read` |
| `POST /stock/update` | `stock:write` |
| `POST /prices/update` | `prices:write` |
| `GET /imports/status/:id` | `imports:read` |

---

## Gestión de credenciales

Las credenciales se gestionan desde el **Portal del Proveedor → Integraciones API** en la aplicación TrabFlow. Desde ahí puedes:

- Crear nuevas credenciales (con nombre, scopes y fecha de caducidad)
- Revocar credenciales activas
- Rotar credenciales (genera una nueva con gracia de 24h en la antigua)
- Ver el historial de sincronizaciones

> **Importante:** La API key completa (`tsf_v1_...`) se muestra **una sola vez** al crear o rotar. Guárdala en un lugar seguro (gestor de secretos, variables de entorno). TrabFlow almacena únicamente el hash SHA-256.

### Formato de la clave

```
tsf_v1_<64 caracteres hexadecimales>
```

Los primeros 8 caracteres hex se usan como prefijo de identificación visible en el portal (p.ej. `tsf_v1_a3b9f100...`).

### Caducidad obligatoria

Todas las credenciales tienen fecha de caducidad (máximo recomendado: 1 año). Rota las credenciales antes de que expiren para evitar interrupciones.

---

## Endpoints

### POST /catalog/upsert

Sincroniza productos del catálogo. Operación de upsert: crea o actualiza basándose en `supplier_ref`.

**Scope:** `catalog:write`  
**Rate limit:** 10 req/min  
**Tamaño máximo:** 2 MB  

**Request:**
```json
{
  "items": [
    {
      "supplier_ref": "REF-001",
      "descripcion_comercial": "Tornillo hexagonal M8x30 acero inox",
      "precio_coste": 0.45,
      "precio_venta": 0.89,
      "unidad": "ud",
      "stock_disponible": true,
      "stock_cantidad": 5000,
      "plazo_entrega_dias": 2,
      "image_url": "https://example.com/img/tornillo-m8.jpg",
      "activa": true,
      "metadata": { "ean": "8412345678901", "familia": "Fijación" }
    }
  ],
  "source_system": "ERP-Holded"
}
```

**Response 200:**
```json
{
  "import_id": "550e8400-e29b-41d4-a716-446655440000",
  "rows_received": 1,
  "rows_inserted": 0,
  "rows_updated": 1,
  "rows_rejected": 0,
  "errors": []
}
```

**Notas:**
- `supplier_ref` es el identificador único del producto en tu sistema. No puede ser nulo ni vacío.
- Si la petición incluye `Idempotency-Key`, la respuesta se cachea 24h y se devuelve idéntica ante reenvíos.
- Si un producto tiene error de validación, se rechaza solo ese item; el resto se procesa (SAVEPOINT por fila).
- `match_state` (estado de emparejamiento con productos universales TrabFlow) nunca se sobrescribe en updates.

---

### GET /catalog/products

Lista los productos del catálogo del proveedor con paginación.

**Scope:** `catalog:read`  
**Rate limit:** 60 req/min  

**Query params:**

| Param | Tipo | Descripción | Default |
|---|---|---|---|
| `page` | int | Página (base 1) | 1 |
| `per_page` | int | Items por página (max 200) | 50 |
| `activa` | bool | Filtrar por estado activo | (todos) |
| `match_state` | string | Filtrar por estado de emparejamiento | (todos) |

**Response 200:**
```json
{
  "data": [
    {
      "id": "...",
      "supplier_ref": "REF-001",
      "descripcion_comercial": "Tornillo hexagonal M8x30",
      "precio_coste": 0.45,
      "precio_venta": 0.89,
      "unidad": "ud",
      "stock_disponible": true,
      "stock_cantidad": 5000,
      "plazo_entrega_dias": 2,
      "activa": true,
      "match_state": "matched",
      "match_confidence": 0.97,
      "image_url": null,
      "metadata": {},
      "created_at": "2026-08-01T10:00:00Z",
      "updated_at": "2026-08-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 1,
    "total_pages": 1
  }
}
```

**Valores de `match_state`:**

| Valor | Descripción |
|---|---|
| `pending` | Sin revisar por el motor IA |
| `matched` | Emparejado con producto universal |
| `unmatched` | Sin coincidencia encontrada |
| `manual` | Emparejado manualmente |

---

### POST /stock/update

Actualiza el stock de hasta 1000 productos en una sola llamada.

**Scope:** `stock:write`  
**Rate limit:** 60 req/min  
**Tamaño máximo:** 2 MB  

**Request:**
```json
{
  "items": [
    {
      "supplier_ref": "REF-001",
      "stock_disponible": true,
      "stock_cantidad": 4800
    },
    {
      "supplier_ref": "REF-002",
      "stock_disponible": false,
      "stock_cantidad": 0
    }
  ],
  "source_system": "WMS-interno"
}
```

**Response 200:**
```json
{
  "rows_received": 2,
  "rows_updated": 2,
  "not_found": []
}
```

**Notas:**
- Los `supplier_ref` no encontrados se devuelven en `not_found` (no son un error).
- `stock_disponible` y `stock_cantidad` son opcionales por item; solo se actualizan los campos presentes.

---

### POST /prices/update

Actualiza precios de hasta 1000 productos.

**Scope:** `prices:write`  
**Rate limit:** 60 req/min  
**Tamaño máximo:** 2 MB  

**Request:**
```json
{
  "items": [
    {
      "supplier_ref": "REF-001",
      "precio_coste": 0.48,
      "precio_venta": 0.95
    }
  ],
  "source_system": "ERP-Holded"
}
```

**Response 200:**
```json
{
  "rows_received": 1,
  "rows_updated": 1,
  "not_found": []
}
```

---

### GET /imports/status/:import_id

Consulta el estado de una sincronización anterior.

**Scope:** `imports:read`  
**Rate limit:** 120 req/min  

**Response 200:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "endpoint": "catalog/upsert",
  "status": "completed",
  "source_system": "ERP-Holded",
  "started_at": "2026-08-01T10:00:00Z",
  "finished_at": "2026-08-01T10:00:03Z",
  "rows_received": 500,
  "rows_inserted": 120,
  "rows_updated": 380,
  "rows_rejected": 0,
  "error_detail": null
}
```

**Valores de `status`:**

| Valor | Descripción |
|---|---|
| `processing` | En curso |
| `completed` | Finalizado con éxito |
| `failed` | Error irrecuperable |
| `duplicate` | Petición idempotente repetida |

---

## Formatos de datos

### Tipos y valores aceptados

| Campo | Tipo | Notas |
|---|---|---|
| `supplier_ref` | string (max 255) | Requerido; tu ID interno del producto |
| `descripcion_comercial` | string | Descripción legible del producto |
| `precio_coste` | decimal ≥ 0 | Precio de coste en EUR |
| `precio_venta` | decimal ≥ 0 | Precio de venta al público en EUR |
| `unidad` | string | "ud", "m", "m2", "kg", "l", etc. |
| `stock_disponible` | boolean | `true` = en stock |
| `stock_cantidad` | integer ≥ 0 | Unidades disponibles |
| `plazo_entrega_dias` | integer ≥ 0 | Días hábiles de entrega |
| `image_url` | string (URL) | URL pública de imagen del producto |
| `activa` | boolean | `false` oculta el producto en el marketplace |
| `metadata` | object | Datos extra libres (EAN, familia, etc.) |

Todos los campos excepto `supplier_ref` son opcionales en updates.

---

## Errores

La API devuelve errores en formato JSON:

```json
{
  "error": "INVALID_INPUT",
  "message": "supplier_ref is required for all items"
}
```

### Códigos de error

| HTTP | Código | Descripción |
|---|---|---|
| 400 | `INVALID_INPUT` | Payload inválido o campos requeridos ausentes |
| 400 | `BATCH_TOO_LARGE` | Más de 1000 items en una petición de stock/prices |
| 401 | `MISSING_AUTH` | Cabecera `Authorization` ausente |
| 401 | `INVALID_KEY` | API key no reconocida, revocada o expirada |
| 403 | `INSUFFICIENT_SCOPE` | La credencial no tiene el scope necesario |
| 403 | `ACTOR_NO_CATALOG` | El actor no tiene catálogo configurado |
| 404 | `NOT_FOUND` | Recurso (import_id) no encontrado o de otro actor |
| 413 | `PAYLOAD_TOO_LARGE` | Body supera el límite de 2 MB |
| 429 | `RATE_LIMIT_EXCEEDED` | Demasiadas peticiones; respeta `Retry-After` |
| 500 | `INTERNAL_ERROR` | Error interno; reportar con el `import_id` si existe |

---

## Rate limiting

El rate limit es por credencial y por endpoint, con ventana deslizante de 1 minuto:

| Endpoint | Límite |
|---|---|
| `catalog/upsert` | 10 req/min |
| `stock/update` | 60 req/min |
| `prices/update` | 60 req/min |
| `catalog/products` | 60 req/min |
| `imports/status` | 120 req/min |

Las respuestas incluyen cabeceras informativas:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1754041260
```

Cuando se supera el límite (HTTP 429):

```
Retry-After: 43
```

---

## Idempotencia

Para operaciones de escritura puedes incluir una `Idempotency-Key` única en la cabecera:

```
Idempotency-Key: sync-20260801-batch-001
```

Si reenví­as la misma petición con la misma clave en las siguientes **24 horas**, recibirás exactamente la misma respuesta sin re-ejecutar la operación. Esto protege ante reintentos duplicados por timeout o error de red.

**Recomendaciones:**
- Usa un identificador derivado de tu sistema (p.ej. `erpjob-12345-attempt-1`)
- Cambia la clave en cada nueva ejecución real del job
- No reutilices claves de intentos fallidos si quieres que la operación se repita

---

## Rotación de credenciales

Cuando rotas una credencial desde el Portal:

1. Se genera una nueva API key
2. La clave antigua permanece válida durante **24 horas** (grace period)
3. Pasadas las 24h, la clave antigua queda revocada automáticamente

Este mecanismo permite actualizar la variable de entorno en tus sistemas sin interrupciones.

**Flujo recomendado:**
1. Rotar desde el Portal → copiar la nueva API key
2. Actualizar la variable de entorno en tu ERP/sistema
3. Verificar que las sincronizaciones funcionan con la nueva clave
4. La antigua expira sola en 24h

---

## Límites

| Recurso | Límite |
|---|---|
| Tamaño máximo de body | 2 MB |
| Items por lote (stock/prices) | 1.000 |
| Items por lote (catalog/upsert) | Sin límite (sujeto a 2 MB) |
| Resultados por página (catalog/products) | 200 |
| TTL de caché de idempotencia | 24 horas |
| Credenciales activas por actor | Sin límite definido |
| Grace period en rotación | 24 horas |

---

## Seguridad

- **Las claves nunca se almacenan en claro.** TrabFlow guarda únicamente el hash SHA-256. Es imposible recuperar una clave perdida; solo se puede revocar y crear una nueva.
- **El actor se resuelve server-side.** Aunque incluyas un `actor_id` en el body, se ignora. Solo la credencial determina qué actor eres.
- **Todas las funciones de infraestructura son SECURITY DEFINER** y están revocadas para roles públicos. Solo son accesibles vía la Edge Function con `service_role`.
- **Las credenciales tienen caducidad obligatoria.** No existe la opción de crear credenciales sin fecha de expiración.
- **Registro de auditoría completo.** Cada llamada queda registrada con IP, user-agent, credencial usada, timestamp, filas procesadas y estado.
- **Comunicación exclusivamente por HTTPS.** La Edge Function rechaza cualquier conexión no segura.

---

## Ejemplo completo de integración (Python)

```python
import os, requests, uuid
from datetime import datetime

API_BASE = "https://dqqjaujnulutinskmqsu.supabase.co/functions/v1/supplier-api-v1/api/v1/supplier"
API_KEY  = os.environ["TRABFLOW_API_KEY"]

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "X-Source-System": "mi-erp",
    "Idempotency-Key": f"sync-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}",
}

payload = {
    "items": [
        {
            "supplier_ref": "ART-0001",
            "descripcion_comercial": "Cable manguera 3x1.5 mm2",
            "precio_coste": 1.20,
            "precio_venta": 2.40,
            "unidad": "m",
            "stock_disponible": True,
            "stock_cantidad": 10000,
            "plazo_entrega_dias": 1,
            "activa": True,
        }
    ],
    "source_system": "mi-erp",
}

resp = requests.post(f"{API_BASE}/catalog/upsert", json=payload, headers=headers)
resp.raise_for_status()
print(resp.json())
# → {"import_id": "...", "rows_inserted": 1, "rows_updated": 0, "rows_rejected": 0, "errors": []}
```

---

*Documentación generada para TrabFlow Supplier API v1 — 2026-08-01*
