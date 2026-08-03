# PRE-RC1 — Onboarding de Proveedores al Portal Marketplace

**Fecha:** 2026-08-03  
**Estado:** IMPLEMENTADO — O-1 a O-8 completados  
**Commit:** pendiente (este documento forma parte del commit O-8)

---

## Resumen del flujo implementado

```
Admin genera invitación (desde PortalEquipo o AdminSuppliersSection)
    ↓
create_marketplace_invitation RPC → rawToken (mostrado una sola vez)
    ↓
Admin copia enlace: /aceptar-invitacion?token={rawToken}
    ↓
Proveedor abre enlace → preview_marketplace_invitation (sin auth)
    ↓
Si nuevo usuario: signUp (email bloqueado) → signUp → accept_marketplace_invitation
Si usuario existente: signInWithPassword → accept_marketplace_invitation
    ↓
Membresía creada atómicamente en trade_marketplace_actor_members
    ↓
Redirige a /proveedor
```

---

## Endpoints implicados

| Función | Auth | Descripción |
|---|---|---|
| `create_marketplace_invitation` | Requerida (miembro con `members:invite` o platform admin) | Genera token SHA-256, devuelve rawToken una sola vez |
| `preview_marketplace_invitation` | No requerida | Devuelve datos públicos de la invitación (estado, actor, rol, email) |
| `accept_marketplace_invitation` | Requerida | Valida token SHA-256, comprueba email coincide con auth.uid, crea membresía |
| `resend_supplier_invitation` | Requerida (`members:invite`) | Rota el token (nuevo SHA-256), extiende expiración 7 días |
| `revoke_supplier_invitation` | Requerida (`members:invite`) | Marca estado='revoked', irreversible |

---

## Seguridad implementada (O-6)

- **rawToken nunca en BD**: solo se almacena `sha256(rawToken)` como `token_hash`
- **Token de un solo uso**: `accept_marketplace_invitation` actualiza `estado='accepted'`
- **Expiración obligatoria**: `expires_at = now() + interval '7 days'`
- **Email bloqueado**: signup/login en `MarketplaceInvitationAcceptView` usa el email de la invitación (readonly, no editable)
- **Email debe coincidir con auth.uid**: la RPC `accept_marketplace_invitation` compara `auth.uid()` con el email de la invitación
- **actor_id/role_id resueltos por RPC**: el cliente no envía actor_id ni role_id al aceptar — se resuelven desde el token
- **Membresía atómica**: INSERT en una única transacción; protegido contra doble-click por constraint UNIQUE
- **Tokens revocados/aceptados no reutilizables**: comprobaciones en orden estricto antes de crear membresía

---

## Estados de la vista /aceptar-invitacion

| Estado | Descripción |
|---|---|
| `validating` | Llamando a `preview_marketplace_invitation` |
| `unauthenticated` | Invitación válida, sin sesión — muestra formulario signup/login |
| `authenticated` | Sesión con email correcto — muestra CTA "Aceptar invitación" |
| `accepting` | Llamando a `accept_marketplace_invitation` |
| `accepted` | Éxito — redirige a /proveedor tras 2.5s |
| `email_pending` | `signUp` sin sesión (email confirmation requerido) — avisa de ir a confirmar |
| `expired` | `expires_at < now()` |
| `revoked` | `estado='revoked'` |
| `already_accepted` | `estado='accepted'` |
| `invalid_token` | Token no encontrado en BD |
| `error` | Error inesperado o email de sesión no coincide |

---

## Acceso admin para invitar

### Desde PortalEquipo (miembros con permiso members:invite)
- Menú "Equipo" → "Invitar" → email + rol → enlace copyable una sola vez
- Si caducó: "Reenviar" rota el token y muestra nuevo enlace
- Texto del botón: "Copiar enlace de invitación"

### Desde AdminSuppliersSection (platform admin — Fernando)
- Admin → Proveedores → seleccionar proveedor con actor de marketplace → tab "🏪 Portal"
- Selector de email + rol → botón "Generar enlace de invitación"
- Muestra enlace copyable en panel verde

---

## Historial de bugs corregidos

| Bug | Causa | Fix |
|---|---|---|
| `create_marketplace_invitation` fallaba | `gen_random_bytes` no existe en schema `public` | `extensions.gen_random_bytes(32)` |
| `resend_supplier_invitation` fallaba | Mismo bug | Mismo fix |
| Ruta `/aceptar-invitacion` no existía | No estaba en `detectAuthRoute()` ni en `PAGE_PATHS` | Añadida en O-3b |
| Invitación STN irrecuperable | Creada con INSERT directo sin obtener rawToken | Revocada (O-2), flujo correcto desde O-8 |

---

## STN — Suministros Técnicos Norte S.L.

| Recurso | ID |
|---|---|
| Catálogo | `1aec572f-d22c-4556-9fbf-315ec7b3ba02` |
| Actor | `aeca7bac-f559-4e01-8ba4-7fd1b7aae9b9` |
| Invitación anterior (revocada) | `28945f54-0668-4d61-b11d-d773640f6f11` |

**Para crear la nueva invitación STN:**
1. Admin → Proveedores → seleccionar "Suministros Técnicos Norte S.L." → tab "🏪 Portal"
2. Email: `proveedor@inmostay.com`
3. Rol: seleccionar el rol owner/administrador del catálogo
4. Copiar enlace y entregar al proveedor

---

## STOP — restricciones vigentes

- **No** hacer matching de las 12 offerings STN todavía
- **No** crear punto de recogida
- **No** iniciar ScreenMarketplace
- **No** iniciar CarritoProvider  
- **No** comenzar RC1
