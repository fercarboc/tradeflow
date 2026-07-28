# TrabFlow — Arquitectura de Analítica

**Versión:** 1.0  
**Fecha:** Julio 2026  
**Estado:** Activo — Capa 1 implementada (Vercel Analytics)

> **Principio rector:** La analítica de TrabFlow tiene dos propósitos distintos y complementarios: medir el comportamiento de usuario en la interfaz (UX analytics) y medir el impacto real del producto en el negocio del instalador (business intelligence). Los distribuidores y los inversores solo se convencen con el segundo.

---

## 1. Objetivo

La analítica de TrabFlow debe responder a tres preguntas:

**1. ¿Cómo usan el producto los usuarios?** → UX analytics (Vercel, GA4, Clarity)

**2. ¿Está TrabFlow generando valor medible?** → Business intelligence (Supabase + Admin Panel)

**3. ¿Están convirtiendo los esfuerzos de marketing?** → Attribution (GA4, Meta Pixel)

Las métricas que importan para cerrar un acuerdo con OBRAMAT, SALTOKI o SONEPAR **no son visitas ni sesiones**. Son:

- Tiempo desde crear un presupuesto hasta realizar un pedido
- Tiempo medio de confirmación del proveedor
- Tiempo medio entre pedido y recepción
- Tasa de conversión de presupuestos a pedidos
- Porcentaje de líneas sugeridas por IA aceptadas sin modificar
- Ahorro de tiempo demostrable (referencia: 45 min manual → <5 min con TrabFlow)

Estas métricas viven en **Supabase**, no en herramientas de analytics web. El diseño de esta arquitectura las tiene en cuenta desde el principio.

---

## 2. Capas de la arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 4 — Business Intelligence (Supabase → SQL → Admin Panel)  │
│  Fuente: tablas trade_quotes, trade_orders, trade_ai_feedback   │
│  Acceso: solo interno, sin consent de usuario, sin PII          │
│  Disponibilidad: siempre (server-side)                          │
├─────────────────────────────────────────────────────────────────┤
│  CAPA 3 — Behavioral (GA4 + Microsoft Clarity)                  │
│  Fuente: client-side events + session recordings               │
│  Acceso: requiere consent.analytics = true                      │
│  Estado: PENDIENTE (RC1-Beta o posterior)                       │
├─────────────────────────────────────────────────────────────────┤
│  CAPA 2 — Marketing Attribution (Meta Pixel)                    │
│  Fuente: client-side, páginas públicas                          │
│  Acceso: requiere consent.marketing = true                      │
│  Estado: PENDIENTE (cuando haya campañas de pago)               │
├─────────────────────────────────────────────────────────────────┤
│  CAPA 1 — Infraestructura (Vercel Analytics)                    │
│  Fuente: pageviews, Web Vitals                                  │
│  Acceso: requiere consent.analytics = true                      │
│  Estado: ACTIVO desde RC1-C04-A                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Herramientas — Responsabilidad y alcance

### Capa 1 — Vercel Analytics (activo)

| Campo | Valor |
|-------|-------|
| Propósito | Pageviews, rutas, Web Vitals, rendimiento de la landing |
| Cookies | No (sessionStorage de sesión, sin persistencia) |
| PII | No almacena ninguno |
| Consent | `categories.analytics = true` |
| Coste | Incluido en plan Vercel Pro |
| Cuándo activar | En cuanto se da consent de analytics |

**Qué mide:** visitas por URL, tiempo de carga (LCP, FID, CLS), dispositivo, país.  
**Qué NO mide:** identidad del usuario, contenido de formularios, datos de negocio.

---

### Capa 3 — Google Analytics 4 (pendiente)

| Campo | Valor |
|-------|-------|
| Propósito | Funnels de conversión, retención, journeys, custom events de negocio |
| Cookies | Sí (`_ga`, `_ga_*`) |
| PII | User ID pseudoanonimizado (hash del Supabase user ID) |
| Consent | `analytics_storage: granted` vía Consent Mode v2 |
| Cuándo activar | RC1-Beta o cuando haya ≥ 10 usuarios activos para datos significativos |

**Qué mide:** funnels landing→registro→onboarding, uso por módulo, retención 7/30 días, eventos de negocio, conversiones de trial.  
**Qué NO mide:** contenido de presupuestos, emails, NIFs, importes, datos personales.

---

### Capa 3 — Microsoft Clarity (pendiente)

| Campo | Valor |
|-------|-------|
| Propósito | Heatmaps, session recordings, UX diagnosis |
| Cookies | Sí |
| PII | Enmascarar automáticamente inputs y datos sensibles |
| Consent | `categories.analytics = true` |
| Cuándo activar | En fase de optimización UX (post RC1-Beta) |

**Qué mide:** clics, scroll depth, elementos problemáticos, dead clicks, rage clicks.  
**Importante:** configurar máscara de PII en todos los formularios antes de activar.

---

### Capa 2 — Meta Pixel (pendiente)

| Campo | Valor |
|-------|-------|
| Propósito | Attribution de campañas de pago en Meta (Facebook, Instagram) |
| Cookies | Sí |
| PII | Posible (eventos de registro) — usar Advanced Matching con hash |
| Consent | `categories.marketing = true` |
| Cuándo activar | Solo cuando haya campañas de pago activas |

**Qué mide:** conversiones de anuncio → registro, coste por lead.  
**Qué NO mide:** comportamiento dentro de la app.

---

### Capa 4 — Business Intelligence / Supabase (siempre activo)

No requiere integración con herramientas de analytics. Los datos están en la base de datos.

| KPI | Fuente en Supabase | Cómo medir |
|-----|-------------------|-----------|
| Tiempo presupuesto→pedido | `trade_quotes.created_at` + `trade_orders.created_at` | SQL JOIN |
| Tiempo pedido→confirmación proveedor | `trade_orders.created_at` + `trade_orders.confirmed_at` | SQL diff |
| Tiempo pedido→recepción | `trade_orders.created_at` + `trade_orders.received_at` | SQL diff |
| Tasa conversión presupuesto→pedido | `COUNT(orders) / COUNT(quotes)` por org | SQL ratio |
| % líneas IA aceptadas sin modificar | `trade_ai_feedback.accepted` | SQL avg |
| Uso real del Motor IA | `COUNT(quotes WHERE source='voice') / COUNT(quotes)` | SQL ratio |
| Ahorro estimado | (tiempo_manual_baseline - tiempo_con_trabflow) × presupuestos | Fórmula |

Estos KPIs se exponen en el **Admin Panel** (sección existente) y en los **informes de piloto** (PZ-001X, RC1-Reports).

---

## 4. Privacidad y RGPD

### Qué jamás se mide

- Contraseñas, tokens de sesión, claves de API
- Nombre completo, email, teléfono, NIF, dirección de usuario
- Contenido de presupuestos (ítems, precios, clientes)
- Contenido de facturas
- Cualquier dato de menores

### Pseudoanonimización en GA4

El User ID que se enviará a GA4 es el **hash SHA-256 del Supabase user ID**, nunca el email ni el UUID directamente. Esto permite análisis de cohortes sin vincular identidad real.

```ts
// Ejemplo (cuando se implemente GA4)
const pseudoId = await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(supabaseUserId)
);
```

### Consent Mode v2

El sistema de consentimiento (implementado en RC1-C03) controla:

```
categories.analytics = false  →  analytics_storage: 'denied'   (GA4 sin cookies)
categories.analytics = true   →  analytics_storage: 'granted'  (GA4 con cookies)
categories.marketing = false  →  ad_storage: 'denied'          (Meta Pixel bloqueado)
categories.marketing = true   →  ad_storage: 'granted'         (Meta Pixel activo)
```

GA4 con `analytics_storage: denied` **puede seguir recibiendo eventos** pero en modo cookieless (datos agregados, sin usuarios identificados). Esto es útil para mantener métricas de conversión aproximadas incluso sin consent.

### Vercel Analytics y consent

Vercel Analytics no usa cookies. Sin embargo, por coherencia con nuestra política y para ser conservadores ante el regulador, lo condicionamos también a `categories.analytics = true`. Los Web Vitals (LCP, FID, CLS) sí se capturan sin consent porque son métricas de rendimiento técnico sin identificación de usuario.

---

## 5. Convención de nombres de eventos

### Formato

```
[módulo]_[objeto]_[acción]
```

- **Módulo:** snake_case, sustantivo corto (`landing`, `auth`, `erp`, `marketplace`, `motor_ia`, `portal_proveedor`, `stripe`, `push`, `onboarding`)
- **Objeto:** qué entidad se ve afectada (`presupuesto`, `pedido`, `usuario`, `plan`, `sesion`)
- **Acción:** qué ocurrió (`created`, `sent`, `accepted`, `rejected`, `completed`, `viewed`, `clicked`, `started`, `failed`)

### Propiedades comunes (siempre presentes cuando aplica)

```ts
interface BaseEventProps {
  oficio?: string;          // 'Fontanería', 'Electricidad', etc. (nunca PII)
  plan?: string;            // 'starter', 'pro', 'enterprise'
  source?: string;          // 'voice', 'manual', 'photo', 'marketplace'
  is_mobile?: boolean;
}
```

### Lo que nunca va en propiedades

- Emails, nombres, NIFs, importes exactos, contenido de formularios

---

## 6. Versionado

- Versión actual del schema de eventos: **v1** (julio 2026)
- Cuando una propiedad cambia de nombre o tipo: crear `[evento]_v2`, deprecar el anterior
- Cambios de versión se documentan en este archivo bajo el apartado § 9
- Una propiedad nunca se elimina sin al menos 30 días de período de deprecación

---

## 7. Catálogo inicial de eventos (FASE 3 — no implementados)

> Estos eventos están definidos aquí como diseño. **No están implementados.** Se implementan en fases posteriores según el roadmap de analytics.

### 7.1 Landing

```ts
landing_page_viewed          // primera visita a trabflow.com
landing_cta_clicked          // props: { position: 'hero'|'pricing'|'footer', variant }
landing_pricing_viewed       // scroll hasta sección de precios
landing_demo_requested       // clic en "Ver demo"
landing_contact_submitted    // formulario de contacto enviado
```

### 7.2 Autenticación y Registro

```ts
auth_registration_started    // inicio del wizard de registro
auth_registration_completed  // props: { oficio, plan }
auth_onboarding_step         // props: { step: 1..7, step_name }
auth_onboarding_completed    // props: { oficio, time_minutes }
auth_onboarding_abandoned    // props: { at_step }
auth_login_completed         // props: { method: 'email'|'magic_link' }
auth_trial_started           // props: { plan }
auth_password_reset          // flujo de recuperación iniciado
```

### 7.3 ERP — Presupuestos

```ts
erp_presupuesto_created      // props: { method: 'voice'|'manual'|'photo', oficio, lineas_count }
erp_presupuesto_sent         // enviado al cliente
erp_presupuesto_accepted     // cliente aceptó
erp_presupuesto_rejected     // cliente rechazó
erp_presupuesto_converted    // se convirtió en trabajo activo
erp_factura_generated        // a partir de presupuesto o trabajo
erp_trabajo_created
erp_trabajo_completed
erp_cliente_created
erp_contrato_mantenimiento_created
```

### 7.4 Motor IA

```ts
motor_ia_session_started     // props: { method: 'voice'|'text', oficio }
motor_ia_response_received   // props: { duration_ms, lineas_count, ok: boolean }
motor_ia_suggestion_accepted // props: { type: 'product'|'price'|'provider' }
motor_ia_suggestion_rejected // props: { type }
motor_ia_manual_correction   // usuario modificó salida de la IA
motor_ia_provider_linked     // proveedor sugerido y vinculado automáticamente
```

### 7.5 Marketplace

```ts
marketplace_catalog_viewed           // props: { supplier_id, category }
marketplace_checkout_started         // props: { items_count }
marketplace_checkout_completed       // props: { items_count, supplier_id }
marketplace_pedido_created           // props: { supplier_id, items_count }
marketplace_pedido_confirmed         // props: { time_to_confirm_minutes }
marketplace_pedido_shipped           // props: { has_tracking: boolean }
marketplace_pedido_received          // props: { time_to_receive_hours }
marketplace_pedido_cancelled         // props: { cancelled_by: 'instalador'|'proveedor' }
```

### 7.6 Portal Proveedor

```ts
portal_proveedor_accessed            // sesión iniciada en el portal
portal_proveedor_pedido_accepted     // proveedor aceptó pedido
portal_proveedor_pedido_rejected     // proveedor rechazó pedido
portal_proveedor_catalog_updated     // catálogo modificado
portal_proveedor_pricing_updated     // precios actualizados
```

### 7.7 Stripe y Facturación

```ts
stripe_trial_started         // props: { plan }
stripe_trial_ending_soon     // 3 días antes del fin (evento interno)
stripe_trial_converted       // trial → plan de pago
stripe_plan_upgraded         // props: { from_plan, to_plan }
stripe_plan_downgraded       // props: { from_plan, to_plan }
stripe_payment_failed
stripe_subscription_cancelled  // props: { reason }
```

### 7.8 Notificaciones Push

```ts
push_subscription_created    // usuario suscrito a push
push_notification_clicked    // props: { type, action }
push_subscription_removed
```

### 7.9 Onboarding y retención

```ts
onboarding_wizard_started
onboarding_step_completed    // props: { step }
onboarding_completed         // props: { total_time_minutes }
onboarding_abandoned         // props: { at_step }
feature_first_use            // props: { feature: 'marketplace'|'motor_ia'|'contratos'|... }
```

---

## 8. Implementación por fases

| Fase | Herramienta | Eventos | Cuándo |
|------|-------------|---------|--------|
| RC1-Alpha | Vercel Analytics | Pageviews + Web Vitals | ✅ Implementado |
| RC1-Beta | GA4 (Capa 3) | Auth, Landing, Stripe | Post-PZ-001B |
| RC1-Gamma | Clarity + GA4 custom | ERP, Motor IA, Marketplace | Post-PZ-001C |
| RC1-Delta | Meta Pixel | Attribution campañas | Cuando haya ads |
| Sprint 2+ | BI Dashboard | KPIs de negocio en Admin Panel | Con datos reales |

---

## 9. Historial de versiones del schema

| Versión | Fecha | Cambios |
|---------|-------|---------|
| v1 | 2026-07-28 | Schema inicial. Catálogo completo de eventos. |

---

## 10. Instrucción para implementar un nuevo evento

Cuando se implemente un evento de esta lista:

1. Crear el tracker en `src/lib/analytics.ts` (aún no existe — crear en RC1-Beta)
2. Llamar desde el componente o función correspondiente
3. Actualizar este documento: marcar el evento como `[implementado]` con la versión
4. Verificar que las propiedades NO contienen PII antes de hacer merge
5. Documentar en el CHANGELOG del sprint correspondiente

```ts
// Ejemplo futuro — src/lib/analytics.ts
import { track } from '@vercel/analytics';

export function trackPresupuestoCreado(props: {
  method: 'voice' | 'manual' | 'photo';
  oficio: string;
  lineas_count: number;
}) {
  track('erp_presupuesto_created', props);
}
```

---

*Este documento es la referencia única para la arquitectura de analítica de TrabFlow. Se actualiza al implementar cada nueva capa o evento.*
