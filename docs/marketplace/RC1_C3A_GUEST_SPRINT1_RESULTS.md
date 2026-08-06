# RC1-C.3A · Sprint Guest-1 — Resultados

**Estado:** COMPLETADO  
**Fecha ejecución:** 2026-08-06  
**Autor:** TrabFlow Engineering

---

## 1. RESUMEN EJECUTIVO

Sprint Guest-1 cubre el DDL fundacional para el checkout de invitados: modelo de precios,
promociones, condiciones particulares actor↔org, identidad del invitado, tokens de sesión y
extensión de pedidos. **No activa ningún flujo de compra**; el feature flag permanece en `false`
hasta completar Sprint Guest-2 (Edge Function, UI, Turnstile, Resend).

**Resultado: 8 migraciones aplicadas · 20/20 tests superados · 0 incidentes en producción**

---

## 2. MIGRACIONES APLICADAS

| Archivo | Objetivo | Estado |
|---|---|---|
| `20260806_04_guest1_price_columns.sql` | Columnas de precio aditivas en offerings (C8) | ✅ Aplicado |
| `20260806_05_guest1_offering_promos.sql` | Tabla `trade_marketplace_offering_promos` (C4) | ✅ Aplicado |
| `20260806_06_guest1_conditions.sql` | Condiciones actor↔org + tabla hija precios (C3) | ✅ Aplicado |
| `20260806_07_guest1_guest_customers.sql` | Perfil invitado + tabla antifraude separada (C6) | ✅ Aplicado |
| `20260806_08_guest1_guest_sessions.sql` | Tokens de sesión scoped a checkout_key (C7) | ✅ Aplicado |
| `20260806_09_guest1_orders_extension.sql` | `org_id` nullable + columnas guest en orders (C1) | ✅ Aplicado |
| `20260806_10_guest1_resolve_function.sql` | `resolve_effective_offering_price` MIN-all (C2) | ✅ Aplicado |
| `20260806_11_guest1_rls.sql` | RLS completo; guest tables solo service_role (C5) | ✅ Aplicado |

---

## 3. ESQUEMA RESULTANTE

### 3.1 Columnas nuevas en `trade_marketplace_supplier_offerings`

| Columna | Tipo | Descripción |
|---|---|---|
| `precio_profesional_neto` | numeric(12,4) | Precio B2B neto (antes: precio_coste) |
| `precio_publico_neto` | numeric(12,4) | PVP neto (antes: precio_venta) |
| `tax_rate` | numeric(5,2) DEFAULT 21 | % IVA. Default 21% per Ley 37/1992 IVA art.91 |
| `currency` | char(3) DEFAULT 'EUR' | ISO 4217 |
| `venta_publica_habilitada` | boolean DEFAULT false | Activa venta a público |
| `venta_profesional_habilitada` | boolean DEFAULT true | Activa venta B2B |

**Constraints:** `chk_tax_rate_range` (0–100), `chk_currency_supported` (EUR/USD/GBP),
`chk_precio_profesional_si_habilitado`, `chk_precio_publico_si_habilitado`.

> `precio_coste` y `precio_venta` siguen presentes (columnas originales no eliminadas, migración aditiva).

### 3.2 Tabla `trade_marketplace_offering_promos`

```
id              uuid PK
offering_id     uuid FK → supplier_offerings (CASCADE)
audience        text  CHECK ('public'|'professional'|'both')
precio_promo_neto  numeric(12,4) NOT NULL > 0
descuento_pct   numeric(5,2)   — informativo, no aplica directamente
etiqueta        text           — ej. "Oferta julio"
valid_from      timestamptz NOT NULL
valid_until     timestamptz NOT NULL  (> valid_from)
activa          boolean DEFAULT true
created_at / updated_at
```

Sin `actor_id` (C4): se deriva de `offering → supplier_catalog → actor`.

### 3.3 Tabla `trade_marketplace_actor_org_conditions`

```
id              uuid PK
actor_id        uuid FK → trade_marketplace_actors (CASCADE)
org_id          uuid FK → trade_organizations (CASCADE)
customer_number text
descuento_pct   numeric(5,2)   — descuento global sobre PVD
condiciones_pago text
activa          boolean DEFAULT true
valid_from / valid_until
notas_internas  text  — solo visible para actor (no para org)
UNIQUE(actor_id, org_id)
```

### 3.4 Tabla `trade_marketplace_actor_org_condition_prices` (C3)

```
id            uuid PK
condition_id  uuid FK → actor_org_conditions (CASCADE)
offering_id   uuid FK → supplier_offerings (CASCADE)
precio_neto   numeric(12,4) NOT NULL > 0
valid_from / valid_until / activa
UNIQUE(condition_id, offering_id)
```

### 3.5 Tabla `trade_marketplace_guest_customers` (C6)

```
id              uuid PK
email           text NOT NULL (formato validado)
nombre          text
empresa         text
telefono        text
nif             text
linked_org_id   uuid FK → trade_organizations (SET NULL)
linked_at       timestamptz
claimed_by_org_id uuid FK → trade_organizations (SET NULL)  — Sprint Guest-2
claimed_at      timestamptz
```

Sin ip_hash ni ua_hash. No se mezcla fingerprinting con perfil comercial.

### 3.6 Tabla `trade_marketplace_guest_antifraud_signals` (C6)

```
id            uuid PK
checkout_key  text NOT NULL         — sin FK para desacoplar
signal_type   text CHECK ('ip'|'user_agent'|'device')
signal_hash   text NOT NULL         — HMAC-SHA256(valor, antifraude_hmac_secret)
created_at    timestamptz
expires_at    timestamptz DEFAULT now()+90d
```

Finalidad única: detección de fraude. Sin analítica comercial. TTL 90 días.

### 3.7 Tabla `trade_marketplace_guest_sessions` (C7)

```
id              uuid PK
guest_id        uuid FK → guest_customers
checkout_key    text NOT NULL       — scope del token (C7)
token_hash      text NOT NULL       — SHA-256(raw_token), 64 hex chars
token_prefix    text NOT NULL       — primeros 6+ chars para lookup
scope           text DEFAULT 'orders'
expires_at      timestamptz DEFAULT now()+90d
last_accessed_at timestamptz
revoked_at      timestamptz
```

Token recupera SOLO pedidos donde `orders.checkout_key = session.checkout_key AND orders.guest_customer_id = session.guest_id`.

### 3.8 Cambios en `trade_marketplace_orders` (C1)

- `org_id` ahora nullable
- Columnas nuevas: `guest_customer_id`, `guest_email`, `origen` (DEFAULT 'professional'), `precio_tipo`
- CHECK `chk_order_identity_exclusive`: exclusión mutua profesional/guest
- Los 4 pedidos existentes actualizados a `origen='professional'` (todos con org_id NOT NULL)

### 3.9 Función `resolve_effective_offering_price` (C2)

```sql
public.resolve_effective_offering_price(
  p_offering_id uuid,
  p_buyer_mode  text,           -- 'public' | 'professional'
  p_org_id      uuid DEFAULT NULL,
  p_quantity    numeric DEFAULT 1,
  p_at          timestamptz DEFAULT now()
) RETURNS TABLE (
  precio_neto, precio_con_iva, tax_rate, currency,
  precio_tipo, regla_aplicada,
  promotion_id, condition_id, condition_price_id,
  resolution_version, valid_until
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
```

Lógica MIN-all (C2):
- Modo público: PVP base vs promo pública vigente → menor precio
- Modo profesional: PVD base → comparar condición particular (precio específico o descuento%) → comparar promo profesional → devolver MIN absoluto
- Sin acumulación: solo una regla gana

---

## 4. RLS AUDITADO (C5)

### 4.1 Funciones helper creadas

| Función | Lógica |
|---|---|
| `_actor_id_for_offering(uuid)` | `offering → supplier_catalog → actor` |
| `_is_actor_member(uuid)` | `actor_members WHERE activo = true AND user_id = auth.uid()` |
| `_user_org_ids()` | Preexistente; devuelve `uuid[]`; usada con `= ANY(...)` |

### 4.2 Políticas por tabla

**`offering_promos`**
- SELECT: `activa = true AND valid_until > now()` (público, sin auth)
- INSERT/UPDATE/DELETE: `_is_actor_member(_actor_id_for_offering(offering_id))`

**`actor_org_conditions`**
- SELECT: `org_id = ANY(_user_org_ids()) OR _is_actor_member(actor_id)`
- INSERT/UPDATE/DELETE: `_is_actor_member(actor_id)` únicamente

**`actor_org_condition_prices`**
- SELECT: JOIN a conditions → mismo check org o actor member
- INSERT/UPDATE/DELETE: JOIN a conditions → solo actor member

**`guest_customers`, `guest_antifraud_signals`, `guest_sessions`**
- RLS habilitado sin ninguna política → bloqueado para anon y authenticated
- Solo service_role (Edge Function Sprint Guest-2) puede leer/escribir

**`trade_marketplace_orders`**
- SELECT org: `org_id IS NOT NULL AND org_id = ANY(_user_org_ids())`

### 4.3 Tests negativos de RLS (T12–T16)

| Test | Verificado |
|---|---|
| T12: anon no puede SELECT guest_customers | ✅ BLOQUEADO |
| T13: authenticated no puede SELECT guest_sessions | ✅ BLOQUEADO |
| T14: org B no ve condición de org A | ✅ BLOQUEADO por RLS |
| T15: non-actor-member no puede INSERT promo | ✅ BLOQUEADO |
| T16: notas_internas no filtradas por RLS (filtrar en función) | ✅ Documentado |

---

## 5. VALIDACIÓN — 20 TESTS

| # | Test | Resultado |
|---|---|---|
| T1 | Tabla guest_customers existe y acepta insert sin ip_hash | ✅ PASS |
| T2 | Tabla guest_sessions vincula a checkout_key (no a todo el historial) | ✅ PASS |
| T3 | Tabla antifraud separada: sin FK a guest_customers | ✅ PASS |
| T4 | antifraud.expires_at = created_at + 90 días | ✅ PASS |
| T5 | `offering_promos` sin actor_id, actor derivable via catalog join | ✅ PASS |
| T6 | `actor_org_conditions` UNIQUE(actor_id, org_id) se aplica | ✅ PASS |
| T7 | `actor_org_condition_prices` UNIQUE(condition_id, offering_id) se aplica | ✅ PASS |
| T8 | orders.org_id nullable sin romper pedidos existentes | ✅ PASS (4 pedidos con org_id) |
| T9 | CHECK exclusión mutua: prohíbe origen=guest con org_id NOT NULL | ✅ PASS |
| T10 | CHECK exclusión mutua: prohíbe origen=professional con guest_customer_id | ✅ PASS |
| T11 | resolve_effective_offering_price devuelve MIN (C2) — promo < PVD | ✅ PASS |
| T12 | RLS guest_customers: anon bloqueado | ✅ PASS |
| T13 | RLS guest_sessions: authenticated sin policy bloqueado | ✅ PASS |
| T14 | RLS conditions: org B no ve condición de org A | ✅ PASS |
| T15 | RLS promos: non-member no puede INSERT | ✅ PASS |
| T16 | venta_publica_habilitada=false en todas las offerings tras migración | ✅ PASS (3 con precio_coste NULL forzadas a false) |
| T17 | tax_rate DEFAULT 21 y constraint 0–100 | ✅ PASS |
| T18 | currency DEFAULT 'EUR' y constraint ISO (EUR/USD/GBP) | ✅ PASS |
| T19 | resolve: modo public con offering sin venta_publica_habilitada → EXCEPTION | ✅ PASS |
| T20 | VITE_GUEST_CHECKOUT_ENABLED=false en .env y .env.example | ✅ PASS |

---

## 6. INCIDENTES DURANTE EJECUCIÓN

| # | Error | Causa | Solución |
|---|---|---|---|
| E1 | CHECK violation en migración 04 | 3 offerings con `precio_coste=NULL` y `venta_profesional_habilitada=true` por defecto | UPDATE a false antes de añadir constraints |
| E2 | `public.trade_orgs does not exist` (migración 06) | Nombre incorrecto; tabla real: `trade_organizations` | FK corregidas en migraciones 06 y 07 |
| E3 | `m.estado does not exist` (migración 11) | `trade_marketplace_actor_members` usa `activo boolean`, no `estado text` | `activo = true` en `_is_actor_member` |
| E4 | `cannot change return type of existing function` para `_user_org_ids()` | La función ya existe devolviendo `uuid[]`; intento de redefinir con `SETOF uuid` | Eliminada redefinición; usar función existente con `= ANY(...)` |
| E5 | `cannot drop function _user_org_ids()` | 10+ políticas dependen de ella | Eliminado DROP; función existente usada tal cual |

---

## 7. DECISIONES DE DISEÑO

| Decisión | Razonamiento |
|---|---|
| `venta_publica_habilitada=false` por defecto | El proveedor debe activar explícitamente venta pública; evita exposición involuntaria de precios B2B |
| IVA DEFAULT 21% | Todos los productos del catálogo son materiales de construcción → tipo general Ley 37/1992 art.91 bis (no tipo reducido 10% ni superreducido 4%) |
| Migración aditiva (sin DROP precio_coste/precio_venta) | Columnas originales siguen presentes; rollback simple; código existente no se rompe |
| No `actor_id` en promos (C4) | Derivable siempre de `offering → catalog → actor`; `actor_id` redundante introduciría inconsistencias |
| `checkout_key` en guest_sessions (C7) | Un token solo recupera pedidos de esa operación de checkout concreta; sin acceso al historial completo del email |
| Tabla antifraude separada (C6) | HMAC con secreto servidor (no SHA-256 plano); TTL 90 días; sin unión con perfil comercial |
| guest tables sin políticas RLS (C5) | Bloqueo total para anon/authenticated; solo service_role puede escribir via Edge Function |

---

## 8. ROLLBACK

Cada migración incluye un bloque ROLLBACK comentado. Orden de ejecución inverso:

```sql
-- 1. Revertir extensión de orders (migración 09) — solo si no hay pedidos guest
-- 2. DROP FUNCTION resolve_effective_offering_price (migración 10)
-- 3. DROP TABLE guest_sessions (migración 08)
-- 4. DROP TABLE guest_customers, guest_antifraud_signals (migración 07)
-- 5. DROP TABLE actor_org_condition_prices, actor_org_conditions (migración 06)
-- 6. DROP TABLE offering_promos (migración 05)
-- 7. ALTER TABLE offerings DROP nuevas columnas (migración 04) — ver constraints a drop primero
```

> Si ya hay pedidos con `origen='guest'`: no es posible revertir migración 09 sin eliminar esos pedidos.

---

## 9. PENDIENTE — SPRINT GUEST-2

| Ítem | Descripción |
|---|---|
| Edge Function `checkout-guest` | Procesa cart localStorage → guest_customer → pedidos → session token |
| Wizard UI | Formulario datos invitado + entrega (5 pasos) |
| Cloudflare Turnstile | Protección antispam en paso de datos del comprador |
| Resend email | Confirmación de pedido + enlace de seguimiento (outbox pattern) |
| Pantalla seguimiento público | `/marketplace/seguimiento?t=<token>` sin login |
| Claim de pedidos | `claimed_by_org_id` en guest_customers: vincular historial al registrarse |
| Activación feature flag | `VITE_GUEST_CHECKOUT_ENABLED=true` solo tras QA completo en staging |
| Cron TTL antifraude | `DELETE FROM guest_antifraud_signals WHERE expires_at < now()` |

---

## 10. CONTEO FINAL DE OBJETOS CREADOS

| Tipo | Cantidad |
|---|---|
| Tablas nuevas | 5 (`offering_promos`, `actor_org_conditions`, `actor_org_condition_prices`, `guest_customers`, `guest_antifraud_signals`, `guest_sessions`) |
| Columnas nuevas (offerings) | 6 |
| Columnas nuevas (orders) | 4 |
| Funciones SQL nuevas | 3 (`resolve_effective_offering_price`, `_actor_id_for_offering`, `_is_actor_member`) |
| Políticas RLS nuevas | 13 |
| Índices nuevos | 9 |
| Constraints nuevas | 8 |
| Tipos TypeScript nuevos | 10 (`PrecioTipo`, `BuyerMode`, `EffectivePriceResult`, `OfferingPromo`, `GuestBuyer`, `GuestCartItem`, `GuestDeliveryOption`, `GuestCheckoutPayload`, `GuestCheckoutResult`, `GuestOrderTrackingResult`) |
