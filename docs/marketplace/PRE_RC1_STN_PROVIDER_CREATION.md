# PRE-RC1 — Creación del Segundo Proveedor Demo: Suministros Técnicos Norte S.L.

**Versión:** 1.0  
**Fecha:** 2026-08-03  
**Estado:** COMPLETADO — validado en P2.6  
**Responsable:** Admin (asistido por Claude Code)

---

## 1. Contexto y motivación

### 1.1 Problema que resolvía

La auditoría B02 (`MARKETPLACE_DEMO_CATALOG_AUDIT.md`) detectó que el marketplace tenía un solo proveedor activo (OBRAMAT Demo), lo que hacía imposible demostrar la comparación de precios entre proveedores — funcionalidad central de RC1.

### 1.2 Decisión de diseño

Se aprobó la creación de un segundo proveedor ficticio de nombre **"Suministros Técnicos Norte S.L."** (STN) usando como fuente los 32 productos de fontanería del catálogo legacy de Saltoki en `trade_supplier_products`.

**Restricciones activas (permanentes):**
- No utilizar el nombre Saltoki en ninguna pantalla del Marketplace.
- No utilizar logo, razón social real, datos de contacto reales, ni direcciones reales de Saltoki.
- No crear offerings directamente con `match_state='matched'`.
- No insertar usuarios directamente en `auth.users`.
- No usar INSERT manual en offerings — usar Supplier API v1.

### 1.3 Fuente de datos

De los 32 productos legacy de la familia Fontanería de Saltoki se seleccionaron 12 con referencias normalizadas:

| Ref. legacy (SAL) | Ref. STN |
|---|---|
| SAL-FON-001 | STN-FON-001 |
| SAL-FON-002 | STN-FON-002 |
| SAL-FON-004 | STN-FON-004 |
| SAL-FON-006 | STN-FON-006 |
| SAL-FON-011 | STN-FON-011 |
| SAL-FON-012 | STN-FON-012 |
| SAL-FON-013 | STN-FON-013 |
| SAL-FON-014 | STN-FON-014 |
| SAL-FON-015 | STN-FON-015 |
| SAL-FON-016 | STN-FON-016 |
| SAL-FON-018 | STN-FON-018 |
| SAL-FON-030 | STN-FON-030 |

---

## 2. Recursos creados

### 2.1 Tabla de IDs

| Recurso | ID |
|---|---|
| Catálogo STN (`trade_supplier_catalogs`) | `1aec572f-d22c-4556-9fbf-315ec7b3ba02` |
| Actor STN (`trade_marketplace_actors`) | `aeca7bac-f559-4e01-8ba4-7fd1b7aae9b9` |
| Invitación portal (`trade_marketplace_invitations`) | `28945f54-0668-4d61-b11d-d773640f6f11` |
| Credencial API (`trade_supplier_api_credentials`) | `98b40e78-4334-476b-9ae9-bdcaf081212b` |
| Import registro (`trade_catalog_imports`) | `d82b640d-b3e2-4946-9901-6b4fd28f4948` |

### 2.2 Catálogo (`trade_supplier_catalogs`)

```
nombre:           Suministros Técnicos Norte S.L.
tipo:             demo
activo:           true
moneda:           EUR
pais:             ES
id:               1aec572f-d22c-4556-9fbf-315ec7b3ba02
```

### 2.3 Actor Marketplace (`trade_marketplace_actors`)

```
nombre:           Suministros Técnicos Norte S.L.
actor_type:       supplier
estado:           active
supplier_catalog_id: 1aec572f-d22c-4556-9fbf-315ec7b3ba02
id:               aeca7bac-f559-4e01-8ba4-7fd1b7aae9b9
```

### 2.4 Invitación de portal

```
email:            proveedor@inmostay.com
rol:              owner (35a666b9-75a6-43ad-9816-8adba785adda)
estado:           pending
expires_at:       2026-09-02 19:31:25+00
token (raw):      29e8e6731a87cc600f0b91998075e80fb11650b932d9ed37afab4b088f33e55a
```

El token se generó manualmente y se insertó directamente en `trade_marketplace_invitations` debido a un bug preexistente en `create_marketplace_invitation()` (función `gen_random_bytes` fuera del `search_path`). El flujo de aceptación de invitación funciona normalmente.

### 2.5 Credencial API

```
key_prefix:       42ff7dc5
expires_at:       2026-11-01
credential_id:    98b40e78-4334-476b-9ae9-bdcaf081212b
token (raw):      tsf_v1_42ff7dc592cfe40f4be56faefcfc9efa61adff1060c93ce339e74dbb01af9c31
```

La credencial fue creada directamente en `trade_supplier_api_credentials` con el hash SHA-256 del token. No se ha compartido externamente — se usó exclusivamente para el import inicial.

---

## 3. Proceso de importación

### 3.1 Método

Supplier API v1 (`/functions/v1/supplier-api-v1/catalog/upsert`), con:
- Header `Authorization: Bearer tsf_v1_42ff7dc5...`
- Header `X-Source-System: PRE_RC1_STN_001_DEMO`
- Header `Idempotency-Key: PRE-RC1-STN-import-001`

### 3.2 Resultado del API call

```json
{
  "success": true,
  "import_id": "d82b640d-b3e2-4946-9901-6b4fd28f4948",
  "stats": {
    "received": 12,
    "inserted": 12,
    "updated": 0,
    "rejected": 0
  },
  "errors": []
}
```

### 3.3 Normalización aplicada a los productos

- Referencias: `SAL-FON-XXX` → `STN-FON-XXX`
- Marcas eliminadas de las descripciones (ej. "Hansgrohe", "Geberit", "Grohe" → genérico)
- Atributos técnicos conservados (materiales, dimensiones, caudal)
- Precios ajustados ligeramente sobre la tarifa Saltoki (±5–10%) para simular diferenciación competitiva

---

## 4. Metadatos post-import

Tras la importación, se ejecutó un UPDATE para añadir marcadores demo a la metadata JSONB de cada offering:

```sql
UPDATE trade_marketplace_supplier_offerings
SET metadata = metadata || jsonb_build_object(
  '_demo',      true,
  '_dataset',   'PRE_RC1_STN_001',
  '_source',    'legacy_test_catalog',
  '_source_ref', 'SAL-FON-' || substring(supplier_ref FROM 'STN-FON-(.+)')
)
WHERE supplier_catalog_id = '1aec572f-d22c-4556-9fbf-315ec7b3ba02';
```

Todos los registros actualizados confirmados.

---

## 5. Plan de rollback

Si fuera necesario eliminar completamente el segundo proveedor demo:

```sql
-- 1. Eliminar offerings
DELETE FROM public.trade_marketplace_supplier_offerings
WHERE supplier_catalog_id = '1aec572f-d22c-4556-9fbf-315ec7b3ba02';

-- 2. Eliminar import log
DELETE FROM public.trade_catalog_imports
WHERE id = 'd82b640d-b3e2-4946-9901-6b4fd28f4948';

-- 3. Eliminar credencial API
DELETE FROM public.trade_supplier_api_credentials
WHERE id = '98b40e78-4334-476b-9ae9-bdcaf081212b';

-- 4. Eliminar invitación
DELETE FROM public.trade_marketplace_invitations
WHERE id = '28945f54-0668-4d61-b11d-d773640f6f11';

-- 5. Eliminar membresía (si la invitación se aceptó)
DELETE FROM public.trade_marketplace_actor_members
WHERE actor_id = 'aeca7bac-f559-4e01-8ba4-7fd1b7aae9b9';

-- 6. Eliminar actor
DELETE FROM public.trade_marketplace_actors
WHERE id = 'aeca7bac-f559-4e01-8ba4-7fd1b7aae9b9';

-- 7. Eliminar catálogo
DELETE FROM public.trade_supplier_catalogs
WHERE id = '1aec572f-d22c-4556-9fbf-315ec7b3ba02';
```

**Orden obligatorio**: de hijo a padre (offerings → imports → credentials → invitations → members → actor → catalog).

---

## 6. Pendientes de acción humana

| Acción | Quién | Estado |
|---|---|---|
| Aceptar invitación de portal (`proveedor@inmostay.com`) | Proveedor demo / admin | PENDIENTE |
| Verificar aislamiento de datos en el portal (no ve offerings OBRAMAT) | Admin | PENDIENTE |
| Matching admin: asignar las 12 offerings a UPs en el panel | Admin | PENDIENTE (ver matriz) |
| Crear punto de recogida en Torrelavega | Admin | PENDIENTE (ver propuesta en matching matrix) |
| Asignar imágenes a las UPs emparejadas | Admin | PENDIENTE |

---

## 7. Notas técnicas

- El campo `supplier_catalog_id` en `trade_marketplace_supplier_offerings` NO es `catalog_id` — usa el nombre completo.
- El campo `actor_type` en `trade_marketplace_actors` es el nombre real de la columna (no `tipo`).
- El estado en `trade_marketplace_actors` es `'active'` (inglés), no `'activo'`.
- El join actor→offering requiere: `offerings.supplier_catalog_id → trade_supplier_catalogs.id ← trade_marketplace_actors.supplier_catalog_id`.
