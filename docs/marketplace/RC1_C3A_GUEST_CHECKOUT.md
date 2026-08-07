# RC1-C.3A — Checkout Público como Invitado
## Documento de Análisis, Plan y Resultados

**Estado:** SPRINT GUEST-1 COMPLETADO — Sprint Guest-2 BLOQUEADO (pendiente Consolidación UX)  
**Fecha:** 2026-08-07  
**Autor:** TrabFlow Engineering  
**Versión:** 1.1

> **Sprint Guest-1 ejecutado:** 8 correcciones (C1–C8) aplicadas antes del DDL.
> Migraciones 04–11 aplicadas y validadas. 20/20 tests superados.
> Ver resultados completos en `RC1_C3A_GUEST_SPRINT1_RESULTS.md`.
>
> **RC1-C.1.b completado (2026-08-07):** Navegación consolidada. El botón "Ir al checkout"
> del CartSidebar ya funciona en modo profesional (navega a `/marketplace/comprar`).
> Ver `RC1_C1B_NAVIGATION_CONSOLIDATION_RESULTS.md`.
>
> **Sprint Guest-2 pendiente (bloqueado):** Edge Function `checkout-guest`, wizard UI,
> Cloudflare Turnstile, Resend email, seguimiento público, feature flag activado.
> BLOQUEADO hasta cierre de Consolidación UX para pilotos comerciales.

### Correcciones aplicadas (C1–C8)
| # | Corrección | Resumen |
|---|---|---|
| C1 | Identidad en pedidos | `org_id` nullable solo en orders; CHECK exclusión mutua `origen`; sin org ficticia |
| C2 | Resolución de precios | `resolve_effective_offering_price` evalúa MIN de todos los candidatos; sin acumulación |
| C3 | Tabla hija de precios | `trade_marketplace_actor_org_condition_prices` en lugar de jsonb |
| C4 | Consistencia promos | Sin `actor_id` en promos; derivado de `offering → catalog → actor` |
| C5 | RLS completo | USING + WITH CHECK separados; tablas guest sin políticas → solo service_role |
| C6 | Privacidad antifraude | HMAC con secreto de servidor; tabla separada con TTL 90 días; sin analítica |
| C7 | Scope de token | `guest_sessions.checkout_key` limita recuperación a una operación concreta |
| C8 | Datos de precio | Migración aditiva `precio_coste → precio_profesional_neto`; venta pública deshabilitada por defecto; IVA 21% documentado (Ley 37/1992 art. 91) |

---

## ÍNDICE

1. [Fase 0 — Auditoría del checkout actual](#fase-0)
2. [Modelo de datos propuesto](#modelo-datos)
3. [Flujo UX](#flujo-ux)
4. [Seguridad](#seguridad)
5. [Política de vinculación posterior](#vinculacion)
6. [Migraciones propuestas](#migraciones)
7. [Riesgos](#riesgos)
8. [Plan de implementación](#plan)

---

## 1. FASE 0 — AUDITORÍA DEL CHECKOUT ACTUAL {#fase-0}

### 1.1 Legacy eliminado — verificado

| Punto | Estado | Evidencia |
|---|---|---|
| Botón "Pedir material" | ✅ Eliminado | `AppDashboardView` usa "Comprar materiales" → `ActivePage.MarketplaceComprar` |
| `ScreenPedidosMaterial` renderizado | ✅ Inaccesible | Sidebar usa `ScreenSeguimientoMaterial`. El archivo existe con `@deprecated` |
| `pedirMaterialQuote` en estado | ✅ Eliminado | `useState<TradeQuote | null>` eliminado de `AppDashboardView` |
| Overlay móvil legacy | ✅ Eliminado | No existe ningún `{pedirMaterialQuote && ...}` en el JSX |
| Wizard legacy restaurable desde localStorage | ✅ Sin riesgo | El wizard legacy nunca persiste en localStorage; el carrito nuevo usa `tf_mkt_cart_v1_*` |
| Rutas o enlaces que invocan ScreenPedidosMaterial | ✅ Sin rutas | No hay `ActivePage` para ScreenPedidosMaterial; es inaccesible |
| `ScreenSeguimientoMaterial` es solo consulta | ✅ Confirmado | Sin botones de creación de pedidos; solo lista y estado |

**Fecha de eliminación definitiva de archivos deprecated:**  
`ScreenPedidosMaterial.tsx` y `pedidos.ts` — eliminar en sprint posterior a piloto comercial (Q4 2026).

### 1.2 Estado actual del checkout público

**`ScreenMarketplace` (modo public):**
```
handleGuestCheckout = () => {
  sessionStorage.setItem('mk_return', '1');
  setCurrentPage(ActivePage.Login);   // ← manda al login, no existe flujo invitado
}
```

El botón del carrito en modo público muestra "Identificarte para continuar" y redirige al login. **No existe ningún checkout para invitados.**

**`CarritoProvider`:** Ya implementa guest cart completo:
- Clave: `trabflow:marketplace:guest-cart` en localStorage
- Hidratación automática cuando `orgId === null`
- Fusión automática guest→org al hacer login (sin duplicar por `offeringId`)
- **Gap:** No existe puente guest-cart (localStorage) → cart Supabase para el checkout

**`cart-storage.ts`:** La función `saveCartState(orgId, ...)` requiere orgId. Sin sesión, el cart solo vive en `GUEST_CART_KEY`. No hay backend cart para invitados.

**`MarketplaceComprarView`:** Solo funciona para profesionales autenticados (verifica sesión en `useEffect`, redirige a Login si no hay sesión).

**`checkout_cart_v2`:** Requiere `auth.uid()` para verificar membresía org. **No puede llamarse sin sesión.**

### 1.3 Gap de precios — CRÍTICO

`LocalCartItem.precioUnitario` almacena `precio_coste` (precio B2B del instalador).  
Para un checkout público se necesita `precio_venta` (precio público al comprador final).

**Situación actual en la BD:**
- `trade_marketplace_supplier_offerings.precio_coste` → precio que paga el instalador (B2B)
- `trade_marketplace_supplier_offerings.precio_venta` → precio sugerido de venta (existe en BD pero no se usa en el carrito público actual)

**Decisión requerida antes de implementar:** ¿El marketplace público usa `precio_venta` o hay un precio dedicado (`precio_publico`)? Esta decisión afecta el modelo de datos, la factura y el margen del proveedor. **No implementar checkout invitado sin definir esto.**

---

## 2. MODELO DE DATOS PROPUESTO {#modelo-datos}

### 2.1 Identidad del invitado: `trade_marketplace_guest_customers`

Tabla nueva. No crea `auth.users`. No crea organización TrabFlow.

```
trade_marketplace_guest_customers
├── id                uuid PK
├── email             text NOT NULL         — email de contacto y seguimiento
├── nombre            text NOT NULL
├── apellidos         text                  — null para empresas
├── telefono          text
├── tipo_comprador    text                  — 'particular' | 'autonomo' | 'empresa'
├── empresa           text                  — nombre comercial o razón social
├── tax_id            text                  — NIF/CIF
├── consentimiento_rgpd boolean NOT NULL DEFAULT false
├── consentimiento_comercial boolean DEFAULT false
├── created_at        timestamptz NOT NULL DEFAULT now()
├── last_order_at     timestamptz
└── CONSTRAINT tipo_chk CHECK (tipo_comprador IN ('particular','autonomo','empresa'))
```

**Reglas:**
- Un mismo email puede tener múltiples filas (distintas compras con datos diferentes).
- No tiene clave única por email — el email no es login.
- No hay contraseña ni sesión.
- Acceso a datos: solo via token de seguimiento, nunca por email directamente.

### 2.2 Extensión de `trade_marketplace_orders` para invitados

Columnas nuevas a añadir:

```
guest_customer_id  uuid  REFERENCES trade_marketplace_guest_customers(id) ON DELETE SET NULL
guest_email        text                                  — copia plana para búsquedas
guest_token        text  UNIQUE                         — token de seguimiento opaco
guest_token_exp    timestamptz                          — expiración (90 días)
origen             text  DEFAULT 'professional'         — 'professional' | 'public_guest'
precio_tipo        text  DEFAULT 'precio_coste'         — 'precio_coste' | 'precio_venta' | 'precio_publico'
```

**Nota sobre `origen`:** Permite distinguir pedidos de invitados de los profesionales en el portal del proveedor sin romper la consulta existente.

### 2.3 Tokens de seguimiento: diseño

Los tokens de seguimiento NO usan `order_id` en la URL.

```
URL pública: /marketplace/seguimiento?t=<token>
```

El `token` es:
- 32 bytes aleatorios generados en el servidor (`gen_random_bytes(32)` → `encode(..., 'base64url')`)
- Almacenado en `trade_marketplace_orders.guest_token` (UNIQUE)
- Expira a 90 días
- Un token → un pedido (un pedido por actor → N tokens para N proveedores si se accede por proveedor, o un token global por operación de checkout)

**Opción A — Token por operación** (recomendada):  
Un `checkout_key` → N pedidos → mostrar todos los pedidos de esa operación con un token maestro.

```
trade_marketplace_guest_sessions
├── id           uuid PK
├── token        text UNIQUE NOT NULL        — token público opaco
├── checkout_key text NOT NULL               — vincula con los pedidos
├── email        text NOT NULL               — para validación extra opcional
├── created_at   timestamptz NOT NULL
└── expires_at   timestamptz NOT NULL        — NOW() + 90 days
```

**Opción B — Token por pedido:**  
`guest_token` en cada fila de `trade_marketplace_orders`. Más simple pero la pantalla de éxito necesita mostrar todos los pedidos.

Recomendación: **Opción A** — tabla separada permite revocar tokens y manejar expiración sin tocar los pedidos.

### 2.4 Estado del carrito invitado en frontend

Nueva interfaz `GuestCheckoutContext` (sessionStorage):

```typescript
interface GuestCheckoutDraft {
  guestCheckoutId: string;      // UUID local temporal
  cartKey: string;              // clave del GUEST_CART_KEY
  step: GuestCheckoutStep;      // 'tipo' | 'datos' | 'entrega' | 'pago' | 'revision' | 'exito'
  // Datos del comprador — en sessionStorage (no en localStorage)
  tipoComprador: 'particular' | 'autonomo' | 'empresa';
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string;
  empresa: string;
  taxId: string;
  // Dirección
  direccionEntrega: GuestDeliveryAddress;
  mismaDireccionFacturacion: boolean;
  direccionFacturacion?: GuestDeliveryAddress;
  // Entrega por proveedor (como DeliveryOptionPerProvider)
  deliveryOptions: Record<string, DeliveryOptionPerProvider>;
  // Idempotencia
  checkoutKey: string;          // UUID4 generado al entrar al checkout
  createdAt: string;
}
```

**Almacenamiento:**
- Datos del comprador y dirección → solo `sessionStorage` (desaparecen al cerrar)
- El carrito (items) → `localStorage` via `GUEST_CART_KEY` existente
- `step` → sessionStorage (retomable en la misma pestaña si recarga)

### 2.5 Sincronización guest cart → Supabase

Para crear pedidos, el carrito local debe existir en la BD.

Nueva RPC propuesta: `create_guest_cart_from_items(p_items jsonb)`:
- Recibe el array de `LocalCartItem` como JSONB
- Crea registro en `trade_marketplace_carts` (source_type='free', sin org_id)
- Crea `trade_marketplace_cart_items` por cada item
- Devuelve `cart_id` y precio actualizado por cada item (revalidación de precio y stock)

**Requiere cambio en `trade_marketplace_carts`:**  
`org_id` actualmente es `NOT NULL`. Para invitados debe ser nullable.

---

## 3. FLUJO UX {#flujo-ux}

### 3.1 Diagrama de pasos

```
Marketplace público
│
├── [añadir al carrito]
│
▼
CartSidebar / CartSidebarDesktop
│  "Ir al checkout" → handlePublicCheckout()
│
▼
PASO 0: IdentificaciónModal
│
├── [A] Soy profesional de TrabFlow
│       → Iniciar sesión → fusión de carrito → MarketplaceComprarView (flujo actual)
│
└── [B] Continuar como invitado ──────────────────────────────────────────────────┐
                                                                                   │
▼                                                                                  │
PASO 1: TipoCompradorStep                                                          │
│  ● Particular  ● Autónomo/Profesional  ● Empresa                                │
│                                                                                   │
▼                                                                                  │
PASO 2: DatosInvitadoStep                                                          │
│  Nombre / Apellidos / Email / Teléfono / Empresa (si aplica) / NIF/CIF          │
│                                                                                   │
▼                                                                                  │
PASO 3: DireccionStep                                                              │
│  Dirección de entrega completa                                                   │
│  ☐ Usar también para facturación                                                 │
│  [Si no] → dirección de facturación separada                                    │
│                                                                                   │
▼                                                                                  │
PASO 4: EntregaProveedorStep  (≈ StepEntrega actual, adaptado)                    │
│  Por proveedor: método, punto recogida, pago (solo métodos públicos)            │
│                                                                                   │
▼                                                                                  │
PASO 5: PagoStep                                                                   │
│  ● Tarjeta (Stripe futuro, pendiente de aprobar)                                │
│  ● Pago al recoger (solo si proveedor lo permite)                               │
│  [aviso: sin crédito ni condiciones comerciales]                                │
│                                                                                   │
▼                                                                                  │
PASO 6: RevisionStep                                                               │
│  Resumen completo — artículos, proveedores, importes, entrega                   │
│  "Se crearán N pedidos" — aceptación explícita                                  │
│                                                                                   │
▼                                                                                  │
PASO 7: ÉxitoStep                                                                  │
│  Número de operación, estado pedidos, email enviado                             │
│  "Crea tu cuenta para guardar y gestionar tus pedidos" (opcional)               │
│                                                                                   │
▼                                                                                  │
/marketplace/seguimiento?t=<token>  (acceso desde email)                           │
                                                                                    ◄─┘
```

### 3.2 Indicador de progreso (stepper)

```
[Tipo] → [Datos] → [Dirección] → [Entrega] → [Pago] → [Revisión] → [Confirmado]
  1          2          3             4          5          6             ✓
```

En móvil: solo número + etiqueta del paso actual, con flecha atrás.

### 3.3 Modal de identificación (Paso 0)

```
┌─────────────────────────────────────────────────────────┐
│  ¿Cómo quieres continuar?                               │
│                                                          │
│  ┌──────────────────────┐  ┌──────────────────────┐     │
│  │  💼  Soy profesional │  │  🛒  Continuar sin   │     │
│  │       de TrabFlow    │  │       registrarme     │     │
│  │                      │  │                       │     │
│  │  Accede a tu cuenta, │  │  Compra sin cuenta y  │     │
│  │  direcciones y       │  │  recibe el seguimiento│     │
│  │  condiciones.        │  │  por email.           │     │
│  │                      │  │                       │     │
│  │  [Iniciar sesión]    │  │  [Continuar →]        │     │
│  └──────────────────────┘  └──────────────────────┘     │
│                                                          │
│  ← Volver al carrito                                     │
└─────────────────────────────────────────────────────────┘
```

No dark patterns. Las dos opciones tienen el mismo peso visual.

### 3.4 Pantalla de éxito + CTA post-compra

```
✅ Pedido realizado correctamente

Operación #GX-2026-001
Se han creado 2 pedidos:

  📦 ProveedorA — 3 artículos — 156,40 € — Entrega en obra
  📦 ProveedorB — 1 artículo  —  89,00 € — Recogida en tienda

Te enviamos el resumen a tu@email.com.
Localizador para seguimiento: [Ver mis pedidos →]

────────────────────────────────────────
💡 ¿Quieres guardar tus pedidos y datos?

  Crea una cuenta gratuita y vincula esta compra.
  Solo tardarás 1 minuto.

  [Crear cuenta con este email]   [No, gracias]
────────────────────────────────────────
[← Volver al Marketplace]
```

---

## 4. SEGURIDAD {#seguridad}

### 4.1 Sin acceso autenticado

Las RPCs de guest checkout NO usarán `auth.uid()` — los pedidos invitados se crearán via Edge Function o RPC con SECURITY DEFINER que no requiera sesión de Supabase.

**Alternativas evaluadas:**
- **Opción A — Edge Function pública con CORS restringido:** Crea el pedido en el backend sin exponer service_role al cliente. Permite rate limiting, validación, CAPTCHA. **Recomendada.**
- **Opción B — RPC con `anon` role:** Expone más superficie. Requiere RLS muy precisa para no filtrar datos.

**Decisión:** Edge Function dedicada (`checkout-guest`) con JWT anon, validación de inputs, rate limiting por IP y por email.

### 4.2 Rate limiting

- Máximo 5 intentos de checkout por IP en 15 minutos.
- Máximo 3 pedidos por email en 24 horas.
- Implementado en la Edge Function (no en la BD).

### 4.3 Anti-bot / CAPTCHA

- CAPTCHA (hCaptcha o Cloudflare Turnstile) antes de confirmar el pedido.
- No en cada paso — solo en la confirmación final.
- Token de CAPTCHA validado en la Edge Function antes de crear pedidos.

### 4.4 Token de seguimiento

- Generado con `crypto.randomUUID()` en el servidor (32+ bits de entropía).
- No derivado del order_id.
- UNIQUE en BD.
- Expira a 90 días.
- La URL no contiene el email ni el order_id.
- La Edge Function de seguimiento valida token + opcionalmente email (doble factor suave).

### 4.5 Datos no expuestos

| Dato | Visibilidad pública |
|---|---|
| `precio_coste` (B2B) | ❌ Nunca en checkout público |
| márgenes | ❌ Nunca |
| IDs internos de BD | ❌ No en URLs |
| email del proveedor | ❌ No al comprador público |
| datos de otros pedidos | ❌ RLS + token scope |
| order_id en URL | ❌ Solo token opaco |

### 4.6 RLS en tabla guest_customers

- Solo lectura/escritura via SECURITY DEFINER (Edge Function o RPC específica).
- El `anon` role NO tiene acceso directo a `trade_marketplace_guest_customers`.
- Los proveedores ven únicamente el snapshot del comprador en su pedido.

### 4.7 Minimización de datos

- En localStorage: solo ítems del carrito y step actual. Sin datos personales.
- En sessionStorage: datos del comprador durante el checkout. Se limpian al completar o al cerrar.
- En BD: datos necesarios para entregar el pedido. Retención: 2 años, luego anonimización.

### 4.8 Consentimientos RGPD

- Checkbox obligatorio antes de confirmar: "Acepto la política de privacidad".
- Checkbox opcional: "Acepto recibir comunicaciones comerciales".
- Texto de política de privacidad y condiciones enlazado en el paso de revisión.

---

## 5. POLÍTICA DE VINCULACIÓN POSTERIOR {#vinculacion}

### 5.1 Flujo de claim tras crear cuenta

Después de que el invitado crea una cuenta (con el mismo email):

```
1. Usuario se registra en TrabFlow con email X.
2. Sistema busca trade_marketplace_guest_customers con email X.
3. Si encuentra registros: propone vinculación.
4. Usuario confirma por email (magic link de verificación).
5. Sistema migra pedidos:
   - guest_customer_id → eliminado del pedido
   - org_id → organización del nuevo usuario
   - El estado y precios NO cambian.
6. Token de seguimiento sigue funcionando (no se invalida).
7. Se elimina o anonimiza el registro guest_customer.
```

### 5.2 Reglas estrictas de vinculación

- Solo se vinculan pedidos al email **verificado** del nuevo usuario.
- La vinculación no cambia precios, estados, entregas ni líneas.
- Si el pedido ya está `completed`, igual puede vincularse (historial).
- Si el nuevo usuario tiene org, los pedidos pasan a esa org.
- Un pedido invitado nunca se duplica.
- La vinculación es **opcional** — el usuario puede rechazarla.

### 5.3 Carrito residual

Si en el momento de crear cuenta el invitado tiene ítems en el carrito guest (`GUEST_CART_KEY`), se fusionan con el carrito org según la lógica ya implementada en `CarritoProvider` (sin duplicar por `offeringId`).

---

## 6. MIGRACIONES PROPUESTAS {#migraciones}

> ⚠️ **ESTAS MIGRACIONES NO SE EJECUTARÁN HASTA APROBACIÓN EXPLÍCITA**

### M1 — `trade_marketplace_carts`: org_id nullable

```sql
ALTER TABLE public.trade_marketplace_carts
  ALTER COLUMN org_id DROP NOT NULL;

COMMENT ON COLUMN public.trade_marketplace_carts.org_id IS
  'NULL para carritos invitados (source_type=free, sin sesión).';
```

**Impacto:** Toda query que asuma `org_id IS NOT NULL` en carts debe revisarse. Ver lista en §8.

### M2 — `trade_marketplace_guest_customers`

```sql
CREATE TABLE public.trade_marketplace_guest_customers (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                   text        NOT NULL,
  nombre                  text        NOT NULL,
  apellidos               text,
  telefono                text,
  tipo_comprador          text        NOT NULL DEFAULT 'particular'
    CONSTRAINT chk_tipo CHECK (tipo_comprador IN ('particular','autonomo','empresa')),
  empresa                 text,
  tax_id                  text,
  consentimiento_rgpd     boolean     NOT NULL DEFAULT false,
  consentimiento_comercial boolean    DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  last_order_at           timestamptz
);

CREATE INDEX idx_guest_email ON public.trade_marketplace_guest_customers(email);
ALTER TABLE public.trade_marketplace_guest_customers ENABLE ROW LEVEL SECURITY;
-- Solo accesible via SECURITY DEFINER. anon: sin acceso.
```

### M3 — `trade_marketplace_guest_sessions` (tokens de seguimiento)

```sql
CREATE TABLE public.trade_marketplace_guest_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token        text        UNIQUE NOT NULL,
  checkout_key text        NOT NULL,
  email        text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);

CREATE INDEX idx_guest_token ON public.trade_marketplace_guest_sessions(token);
ALTER TABLE public.trade_marketplace_guest_sessions ENABLE ROW LEVEL SECURITY;
-- Solo accesible via SECURITY DEFINER.
```

### M4 — `trade_marketplace_orders`: columnas para invitados

```sql
ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS guest_customer_id uuid
    REFERENCES public.trade_marketplace_guest_customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_email       text,
  ADD COLUMN IF NOT EXISTS origen            text NOT NULL DEFAULT 'professional'
    CONSTRAINT chk_origen CHECK (origen IN ('professional','public_guest')),
  ADD COLUMN IF NOT EXISTS precio_tipo       text NOT NULL DEFAULT 'precio_coste'
    CONSTRAINT chk_precio_tipo CHECK (precio_tipo IN ('precio_coste','precio_venta','precio_publico'));
```

### M5 — RPC `create_guest_cart`

Nueva función que crea un cart en Supabase a partir de ítems locales del invitado. Sin `auth.uid()`. Llamada desde Edge Function con service_role o invocada como SECURITY DEFINER.

```sql
-- Firma conceptual (implementación pendiente de aprobación)
CREATE OR REPLACE FUNCTION public.create_guest_cart(
  p_items      jsonb,     -- [{offering_id, cantidad, unidad, ...}]
  p_source_ref text DEFAULT NULL
) RETURNS jsonb   -- { cart_id, items_validados, precios_actualizados }
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$ ... $$;
```

### M6 — Edge Function `checkout-guest`

Nueva Edge Function que orquesta el checkout invitado:
1. Valida CAPTCHA token.
2. Valida rate limit.
3. Crea o upserta `trade_marketplace_guest_customers`.
4. Llama `create_guest_cart` para sincronizar el carrito local.
5. Ejecuta lógica de `checkout_cart_v2` adaptada (sin `auth.uid()`).
6. Genera token de seguimiento y crea `trade_marketplace_guest_sessions`.
7. Envía email de confirmación.
8. Devuelve `{ order_ids, tracking_token, numero_operacion }`.

### M7 — RPC `get_guest_order_status`

```sql
-- Permite al invitado ver el estado de sus pedidos via token
CREATE OR REPLACE FUNCTION public.get_guest_order_status(p_token text)
RETURNS TABLE (...)
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT mo.*, a.nombre AS actor_nombre
  FROM public.trade_marketplace_guest_sessions gs
  JOIN public.trade_marketplace_orders mo ON mo.checkout_key = gs.checkout_key
  JOIN public.trade_marketplace_actors a ON a.id = mo.actor_id
  WHERE gs.token = p_token AND gs.expires_at > now();
$$;
-- No requiere sesión. Accesible via anon + RLS = SECURITY DEFINER.
```

---

## 7. RIESGOS {#riesgos}

### R1 — CRÍTICO: Precios públicos no definidos

**Riesgo:** El carrito público actual usa `precio_coste` (B2B). Si el checkout invitado usara estos precios, estaríamos vendiendo al precio del instalador, sin margen.

**Mitigación requerida ANTES de implementar:**
- Definir si el checkout público usa `precio_venta`, `precio_publico` o un multiplicador configurable por proveedor.
- Añadir `precio_publico` a `trade_marketplace_supplier_offerings` si se quiere precio dedicado.
- El carrito invitado debe mostrar y facturar el precio correcto desde el primer momento.

**Bloqueante:** Sí. No implementar checkout invitado sin resolver esto.

### R2 — ALTO: Marco legal de la transacción

**Riesgo:** No está documentado quién vende, quién factura, quién cobra y quién gestiona devoluciones. Esto es imprescindible para:
- Emitir facturas válidas.
- Cumplir la Ley del IVA (repercusión).
- Gestionar devoluciones y garantías.
- Operar con Stripe (requiere legal entity verificada).

**Mitigación:** Documentar el modelo comercial antes del lanzamiento. Opciones:
- TrabFlow como intermediario (comisionista).
- TrabFlow como vendedor (más responsabilidad legal).
- Proveedor como vendedor directo (TrabFlow solo facilita).

**Bloqueante:** Para pago real. No bloqueante para implementar el flujo técnico con "pago pendiente de activar".

### R3 — ALTO: `org_id NOT NULL` en carts

**Riesgo:** Hacer `org_id` nullable en `trade_marketplace_carts` puede romper:
- Políticas RLS actuales que asumen `org_id IS NOT NULL`.
- Queries que hacen JOIN sin condicionar `org_id IS NULL`.
- El portal del proveedor que lista pedidos por org.

**Mitigación:** Auditoría completa de todas las RPCs y políticas que referencian `trade_marketplace_carts.org_id`. Lista preliminar: `get_org_active_orders`, `get_org_order_history`, `list_org_carts`, `checkout_cart`, `checkout_cart_v2`, `create_cart_from_quote`.

### R4 — MEDIO: Spam / abuso de pedidos invitados

**Riesgo:** Sin autenticación, un actor malicioso puede crear miles de pedidos falsos, saturando a los proveedores.

**Mitigación:** Rate limiting en Edge Function + CAPTCHA + validación de email (magic link o código OTP antes de confirmar, opcional).

### R5 — MEDIO: Datos personales en localStorage

**Riesgo:** Si un dato personal del comprador termina en localStorage (bug), persiste más allá del checkout.

**Mitigación:** Regla estricta: datos personales únicamente en sessionStorage. Tests de regresión que verifican localStorage después del checkout.

### R6 — BAJO: Token de seguimiento predecible

**Riesgo:** Si el token es generado en el cliente o con entropía baja, puede enumerarse.

**Mitigación:** Token generado en el servidor con `crypto.randomUUID()` o `gen_random_bytes(32)`. Nunca en el cliente.

### R7 — BAJO: Fusión incorrecta al crear cuenta

**Riesgo:** Un usuario crea cuenta con email X y se vinculan pedidos de otro guest con email X (comprado por otra persona en mismo dispositivo).

**Mitigación:** Vinculación requiere click en magic link enviado al email X. La vinculación es opt-in, no automática.

---

## 8. PLAN DE IMPLEMENTACIÓN {#plan}

### Prerrequisitos (antes de empezar)

- [ ] **P1:** Definir precio público para el marketplace (`precio_venta` vs `precio_publico` vs multiplicador). **Bloqueante.**
- [ ] **P2:** Documentar marco legal (quién vende, quién factura). Puede ser posterior al MVP técnico pero debe estar antes de activar cobro real.
- [ ] **P3:** Decidir CAPTCHA provider (hCaptcha, Turnstile, etc.).
- [ ] **P4:** Decidir email provider para confirmación (Resend, SendGrid, Supabase Auth SMTP).

### Sprint Guest-1 — Infraestructura base (sin flujo visual)

1. **M1:** `org_id` nullable en carts (con auditoría RLS completa).
2. **M2:** Tabla `trade_marketplace_guest_customers`.
3. **M3:** Tabla `trade_marketplace_guest_sessions`.
4. **M4:** Columnas guest en `trade_marketplace_orders`.
5. **M5:** RPC `create_guest_cart`.
6. **M7:** RPC `get_guest_order_status`.
7. Tests de regresión: checkout profesional sigue funcionando.

### Sprint Guest-2 — Modal de identificación y estado frontend

1. Componente `GuestIdentificationModal` (dos opciones: login / invitado).
2. Contexto `GuestCheckoutContext` con sessionStorage.
3. Actualizar `CartSidebar`: botón "Ir al checkout" → abre modal en modo público.
4. Actualizar `ScreenMarketplace.handleGuestCheckout` → abre modal (no redirige a login).

### Sprint Guest-3 — Wizard de checkout invitado

1. `StepTipoComprador` — selección particular/autónomo/empresa.
2. `StepDatosInvitado` — formulario adaptado por tipo.
3. `StepDireccionInvitado` — dirección entrega + facturación.
4. `StepEntregaInvitado` — reutilizar `StepEntrega` con adaptaciones (solo métodos públicos).
5. `StepPagoInvitado` — placeholder (sin Stripe real) + pago al recoger condicional.
6. `StepRevisionInvitado` — resumen completo + checkbox aceptación + idempotencia.
7. Componente orquestador `GuestCheckoutView` con stepper.

### Sprint Guest-4 — Edge Function y creación de pedidos

1. Edge Function `checkout-guest`.
2. Validación CAPTCHA.
3. Rate limiting por IP y email.
4. Integración con `create_guest_cart` y lógica de pedidos.
5. Generación de token de seguimiento.
6. Email de confirmación (plantilla).

### Sprint Guest-5 — Pantalla de seguimiento y post-compra

1. Ruta pública `/marketplace/seguimiento?t=<token>` → `ScreenGuestTracking`.
2. RPC `get_guest_order_status` consumida desde `ScreenGuestTracking`.
3. Pantalla de éxito con CTA "Crear cuenta".
4. Flujo de claim: registro con mismo email → magic link → vinculación.

### Sprint Guest-6 — Calidad y seguridad

1. Tests 1-18 del spec.
2. Auditoría RLS.
3. Auditoría de datos en localStorage.
4. Penetration testing básico (enumeración de tokens, rate limit bypass).
5. Revisión legal de consentimientos.

### Rollback

Cada sprint tiene un feature flag `GUEST_CHECKOUT_ENABLED` en `ScreenMarketplace`.
Si `false`, el botón del carrito sigue enviando al login como ahora.
Sin riesgo para el flujo profesional en ningún sprint.

---

## DECISIONES REQUERIDAS PARA APROBACIÓN

Antes de iniciar implementación se necesita respuesta a:

| # | Pregunta | Impacto |
|---|---|---|
| D1 | ¿Qué campo de precio usa el marketplace público? (`precio_venta` / `precio_publico` / nuevo campo) | CRÍTICO — afecta factura y margen |
| D2 | ¿CAPTCHA provider? (hCaptcha / Turnstile / otro) | Alto — prerequisito Edge Function |
| D3 | ¿Email provider para confirmación? (Resend / SendGrid / Supabase SMTP) | Alto — prerequisito Sprint 4 |
| D4 | ¿Token de seguimiento: 90 días de expiración es correcto? | Medio |
| D5 | ¿Vinculación de pedidos invitados tras registro: automática con magic link o manual? | Medio |
| D6 | ¿El proveedor puede ver el email del comprador invitado? | Medio — operativa de entrega |
| D7 | ¿Pago al recoger es el único método real para la fase MVP? | Alto — si sí, no se necesita Stripe aún |
