# PZ-001 — Bug Log

**Piloto Zero · TrabFlow Marketplace**
**Formato:** ID · Fecha · Paso · Usuario · Descripción · Severidad · Estado · Solución · Commit

---

## Severidades

- **BLOQUEANTE** — Impide continuar el flujo. Debe corregirse antes de seguir.
- **ALTA** — Afecta significativamente la UX o el flujo pero hay workaround.
- **MEDIA** — Problema visible pero el flujo puede completarse.
- **BAJA** — Cosmético o menor.

## Estados

- `ABIERTO` — Detectado, sin solución.
- `EN CURSO` — En desarrollo.
- `RESUELTO` — Corregido y desplegado.
- `DESCARTADO` — No es un bug (comportamiento esperado).

---

## Bugs Activos

### BUG-001

**Fecha:** 2026-07-26
**Paso:** Paso 11 (Cerrar sesión Portal Proveedor)
**Usuario:** contacto@inmostay.com
**Descripción:** El botón "Salir del portal" navegaba a AppDashboard en lugar de cerrar sesión. Para usuarios supplier-only (sin org instaladora), AppDashboard redirigía de vuelta al Portal creando un bucle infinito.
**Reproducción:**
1. Login contacto@inmostay.com → Portal Proveedor
2. Clic "Salir del portal"
3. Flash de AppDashboard
4. Vuelta automática al Portal
5. Bucle infinito, imposible salir

**Captura:** (ver screenshot en conversación PZ-001)
**Severidad:** ALTA
**Estado:** RESUELTO
**Solución:** Reemplazar "Salir del portal" por "Cerrar sesión" (signOut) para supplier-only y "Cambiar de espacio" + "Cerrar sesión" para usuarios duales. SIGNED_OUT navega a /login.
**Commit:** aeee83c

---

### BUG-002

**Fecha:** 2026-07-26
**Paso:** Paso 9 (Login proveedor)
**Usuario:** contacto@inmostay.com
**Descripción:** Org fantasma "contacto" creada automáticamente al acceder desde navegador con caché del service worker del código antiguo. El código ejecutaba `getOrCreateOrg()` antes de comprobar si el usuario tenía membresía marketplace.
**Reproducción:** Solo reproducible con caché de service worker de versión anterior a e8a9d58.
**Captura:** (ver conversación — org id b751e0f8)
**Severidad:** ALTA
**Estado:** RESUELTO
**Solución:** (1) Defensa en AppDashboardView: comprobar membresía marketplace antes de llamar getOrCreateOrg(). (2) Mover creación de org al Paso 1 del wizard. (3) Org fantasma eliminada de DB.
**Commit:** 65ba6b3

---

### BUG-003

**Fecha:** 2026-07-26
**Paso:** Paso 9 (Login proveedor)
**Usuario:** contacto@inmostay.com
**Descripción:** Routing fallaba porque workspaceResolver usaba un segundo cliente Supabase (lib/client.ts) que no compartía sesión con el cliente principal (lib/supabase.ts). La RPC get_my_marketplace_memberships devolvía vacío aunque el usuario estaba autenticado.
**Severidad:** BLOQUEANTE
**Estado:** RESUELTO
**Solución:** workspaceResolver.ts migrado a usar lib/supabase.ts directamente.
**Commit:** e8a9d58

---

## Bugs Encontrados Durante PZ-001

*Registrar aquí los bugs encontrados durante la ejecución del piloto.*

### BUG-004

**Fecha:**
**Paso:**
**Usuario:**
**Descripción:**
**Reproducción:**
1.
2.
3.

**Captura:**
**Severidad:**
**Estado:** ABIERTO
**Solución:**
**Commit:**

---
