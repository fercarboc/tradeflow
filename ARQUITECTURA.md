# TradeFlow AI — Arquitectura SaaS Completa

> Documento vivo. Actualizar al completar cada fase.  
> Última revisión: 2026-05-28

---

## VISIÓN GENERAL

TradeFlow AI es un SaaS para instaladores, técnicos y empresas de servicios.  
Permite generar presupuestos por voz/foto, gestionar clientes, facturas, catálogo, planificación de trabajos y equipo.

**Stack:**
- Frontend: React + TypeScript + Tailwind + Vite → Vercel
- Backend: Supabase (Postgres + Auth + Edge Functions + Storage)
- AI: Claude Sonnet 4.6 (voz → presupuesto, foto → presupuesto)
- Pagos: Stripe (integrado, validando IVA)

---

## PLANES DE SUSCRIPCIÓN

| Característica              | Básico (gratis/trial) | Pro (29€/mes)   | Empresa (79€/mes) |
|-----------------------------|-----------------------|-----------------|-------------------|
| Presupuestos/mes            | 15                    | Ilimitados      | Ilimitados        |
| Clientes                    | 50                    | Ilimitados      | Ilimitados        |
| Facturas                    | 5/mes                 | Ilimitadas      | Ilimitadas        |
| Catálogo productos          | 50                    | Ilimitado       | Ilimitado         |
| Escáner foto (AI)           | 5/mes                 | Ilimitado       | Ilimitado         |
| Voz → presupuesto           | ✓                     | ✓               | ✓                 |
| Planificación trabajos      | ✗                     | ✓               | ✓                 |
| Múltiples usuarios/equipo   | ✗                     | ✗               | ✓ (hasta 20)      |
| Roles y permisos            | ✗                     | ✗               | ✓                 |
| Módulo Ingresos/rentabilidad| ✗                     | ✗               | ✓                 |
| Soporte prioritario         | ✗                     | ✓               | ✓                 |
| Trial inicial               | 15 días               | —               | —                 |

---

## SISTEMA DE ROLES (Empresa)

### Roles disponibles

| Rol           | Descripción                                         |
|---------------|-----------------------------------------------------|
| `owner`       | Propietario. Acceso total. No se puede eliminar.    |
| `admin`       | Gestión completa excepto facturación/suscripción.   |
| `comercial`   | Crea/edita presupuestos y clientes. Sin facturas.   |
| `tecnico`     | Ve sus trabajos asignados. Sin presupuestos.        |
| `visualizador`| Solo lectura. Sin crear ni editar nada.             |

### Permisos por módulo

| Permiso                  | owner | admin | comercial | tecnico | visualizador |
|--------------------------|-------|-------|-----------|---------|--------------|
| `quotes.create`          | ✓     | ✓     | ✓         | ✗       | ✗            |
| `quotes.edit`            | ✓     | ✓     | ✓         | ✗       | ✗            |
| `quotes.delete`          | ✓     | ✓     | ✗         | ✗       | ✗            |
| `clients.manage`         | ✓     | ✓     | ✓         | ✗       | ✗            |
| `invoices.create`        | ✓     | ✓     | ✗         | ✗       | ✗            |
| `invoices.manage`        | ✓     | ✓     | ✗         | ✗       | ✗            |
| `jobs.view`              | ✓     | ✓     | ✓         | ✓       | ✓            |
| `jobs.manage`            | ✓     | ✓     | ✓         | ✗       | ✗            |
| `catalog.manage`         | ✓     | ✓     | ✗         | ✗       | ✗            |
| `team.manage`            | ✓     | ✓     | ✗         | ✗       | ✗            |
| `ingresos.view`          | ✓     | ✓     | ✗         | ✗       | ✗            |
| `settings.manage`        | ✓     | ✗     | ✗         | ✗       | ✗            |
| `subscription.manage`    | ✓     | ✗     | ✗         | ✗       | ✗            |

---

## ESQUEMA BASE DE DATOS (Supabase)

### Tablas en producción
- `trade_organizations` — organizaciones (nombre, NIF, email, plan, is_onboarded, logo_url…)
- `trade_quotes` + `trade_quote_items` — presupuestos y partidas
- `trade_clients` — clientes CRM
- `trade_invoices` — facturas
- `trade_catalog_products` / `trade_catalog_variants` — catálogo propio
- `trade_catalog_global` — catálogo global TradeFlow (830 productos, 20 oficios)
- `trade_jobs` — trabajos planificados
- `trade_workers` — trabajadores
- `trade_tarifas` — tarifas hora/unidad
- `trade_subscriptions` — suscripción activa (plan, status, stripe_*, period_*)
- `trade_stripe_prices` — price IDs Stripe por plan/ciclo (6 filas)
- `trade_platform_invoices` — facturas de plataforma generadas por Stripe
- `trade_org_members` — miembros de organización (multi-usuario Empresa)
- `trade_org_permissions` — permisos granulares por miembro
- `trade_push_subscriptions` — suscripciones push por dispositivo

### Campos clave de `trade_subscriptions`

```
id, org_id, plan, billing_cycle, status (trial/active/cancelled/expired)
trial_start, trial_end
stripe_customer_id, stripe_subscription_id, stripe_price_id
current_period_start, current_period_end
cancelled_at, created_at, updated_at
```

---

## ARQUITECTURA REACT

```
src/
  context/
    SessionContext.tsx     ← auth user, org, plan, rol, permisos
  hooks/
    usePermissions.ts      ← can('quotes.create') → boolean
  components/
    AppDashboardView.tsx   ← componente principal (sidebar, modales, PDF)
    ScreenPlanificacion    ← trabajos y planificación
    ScreenIngresos         ← rentabilidad (Empresa only)
    ScreenEquipo           ← gestión de equipo (Empresa only)
    PlanUpgradeModal       ← modal de upgrade con Stripe Checkout
    OnboardingWizard       ← wizard de bienvenida (is_onboarded=false)
    AdminView              ← panel interno TradeFlow
```

---

## STRIPE — INTEGRACIÓN

### Edge Functions desplegadas
- `trade-stripe-checkout` (v10 activa) — crea sesión Checkout con Tax + metadata
- `trade-stripe-portal` — portal Stripe de gestión de suscripción
- `trade-stripe-webhook` (v9 activa) — procesa eventos Stripe → Supabase

### Flujo de upgrade (post-fix)

```
1. Usuario pulsa "Activar Pro/Empresa"
2. Frontend → trade-stripe-checkout
   → metadata[plan], metadata[billing_cycle] incluidos
   → automatic_tax[enabled]=true
   → billing_address_collection=required
3. Usuario completa pago + dirección + (opcional) NIF/CIF
4. Stripe calcula IVA automáticamente según país
5. Webhook checkout.session.completed:
   → trade_subscriptions: plan, billing_cycle, status=active, stripe_ids
   → trade_organizations: plan
6. Webhook invoice.paid:
   → trade_subscriptions: period_start, period_end
   → trade_platform_invoices: registro de factura
7. App detecta plan actualizado → desbloquea funcionalidades
```

### Eventos webhook manejados

| Evento | Acción |
|--------|--------|
| `checkout.session.completed` | Actualiza plan, status, stripe_ids en BD |
| `customer.subscription.created` | Actualiza periodos (complementario) |
| `customer.subscription.updated` | Propaga cambio de plan desde portal |
| `invoice.paid` | Confirma status=active, guarda periodos y factura |
| `customer.subscription.deleted` | status=cancelled |
| `invoice.payment_failed` | status=expired |

### Price IDs en producción (tabla `trade_stripe_prices`)

| Plan | Ciclo | Price ID |
|------|-------|----------|
| pro | monthly | price_1TbM7dEBDOoWck8qxIysJ08O |
| pro | yearly | price_1TbM87EBDOoWck8qdX25uwfX |
| empresa | monthly | price_1TbM91EBDOoWck8qWhtbNz9r |
| empresa | yearly | price_1TbM9QEBDOoWck8ql0CSkHfH |

---

## STRIPE TAX — AUDITORÍA Y ESTADO

### Bugs encontrados y corregidos (2026-05-28)

| # | Severidad | Problema | Estado |
|---|-----------|----------|--------|
| 1 | CRÍTICO | `metadata[plan]` nunca se enviaba al checkout → webhook recibía `plan=undefined` → plan nunca se actualizaba tras el pago | ✅ Corregido en checkout v10 |
| 2 | CRÍTICO | `automatic_tax[enabled]` ausente → Stripe Tax nunca se ejecutaba → IVA siempre "Ninguno" | ✅ Corregido en checkout v10 |
| 3 | CRÍTICO | `billing_address_collection` y `customer_update[address]` ausentes → Stripe sin país del cliente → IVA imposible | ✅ Corregido en checkout v10 |
| 4 | ALTO | `customer.subscription.updated` leía `plan` de metadata vacía → cambios de plan desde portal no se propagaban | ✅ Corregido en webhook v9 |
| 5 | ALTO | Evento `customer.subscription.created` no manejado | ✅ Añadido en webhook v9 |
| 6 | MEDIO | `tax_id_collection` ausente → clientes empresa sin opción de dar CIF/NIF | ✅ Corregido en checkout v10 |
| 7 | MEDIO | `allow_promotion_codes` ausente | ✅ Corregido en checkout v10 |
| 8 | ALTO | Stripe Tax no configurado en Dashboard | ⚠️ Pendiente (acción manual) |

### Acciones manuales pendientes en Stripe Dashboard

```
FASE STRIPE-A — Imprescindible para IVA en producción:

[ ] A1. Dashboard → Tax → Activate Stripe Tax
[ ] A2. Dashboard → Tax → Registrations → Add Spain (ES)
        Tipo: Standard VAT · NIF/CIF de la empresa · fecha inicio
[ ] A3. Cada producto → Edit → Tax code: txcd_10103001 (SaaS)
[ ] A4. Precios Pro y Empresa → Edit → Tax behavior: Exclusive
        stripe prices update price_1TbM7d... --tax-behavior=exclusive
        stripe prices update price_1TbM87... --tax-behavior=exclusive
        stripe prices update price_1TbM91... --tax-behavior=exclusive
        stripe prices update price_1TbM9Q... --tax-behavior=exclusive

FASE STRIPE-B — Para producción EU completa:
[ ] B1. Configurar reverse charge para empresas EU con VAT number
[ ] B2. Registros fiscales en países EU donde superes el umbral OSS (10.000€/año)
[ ] B3. Configurar portal Stripe con política de reembolso y cancelación
```

---

## ROADMAP POR FASES

### FASE 1 — Base multiusuario ✅ COMPLETA
- [x] 1.1 Migración SQL: `trade_org_members` + `trade_org_permissions`
- [x] 1.2 Migración SQL: campos `created_by`, `stripe_*` en tablas existentes
- [x] 1.3 Crear `SessionContext` con carga de org, plan y rol del usuario
- [x] 1.4 Crear hook `usePermissions` con `can()`
- [x] 1.5 Integrar `SessionContext` en `main.tsx` / `App.tsx`
- [x] 1.6 Ocultar/mostrar elementos UI según `can()` (presupuestos, facturas, equipo)

### FASE 2 — Módulo Equipo y Permisos ✅ COMPLETA
- [x] 2.1 Edge Function `send-invite` (email de invitación con magic link)
- [x] 2.2 Pantalla `ScreenEquipo` — lista miembros, roles, invitar, revocar
- [x] 2.3 Flujo de aceptación de invitación (nuevo usuario se une a la org)
- [ ] 2.4 Limitaciones por plan enforced en RLS (pendiente Fase 6)

### FASE 3 — Módulo Ingresos ✅ COMPLETA
- [x] 3.1 Queries de ingresos (facturado, cobrado, pendiente por período)
- [x] 3.3 Pantalla `ScreenIngresos` con gráfico de barras CSS
- [x] 3.4 KPIs por período + top clientes por facturación
- [ ] 3.2 Costes por tarifa × horas reales (requiere campo horas en trade_jobs)

### FASE 4 — Stripe ✅ COMPLETA (código)
- [x] 4.1 Productos y precios en Stripe Dashboard (6 price IDs activos)
- [x] 4.2 Edge Function `trade-stripe-checkout` (v10, con Tax y metadata)
- [x] 4.3 Edge Function `trade-stripe-portal`
- [x] 4.4 Edge Function `trade-stripe-webhook` (v9, 6 eventos)
- [x] 4.5 UI de upgrade: `PlanUpgradeModal` + banner sidebar + ajustes
- [ ] 4.6 Bloqueos hard por plan en backend (Fase 6)

### FASE 5 — Pulido y lanzamiento ✅ COMPLETA (excepto 5.4)
- [x] 5.1 Onboarding wizard (aparece si `is_onboarded=false`)
- [x] 5.2 Notificaciones push (toggle en Ajustes)
- [x] 5.3 PDF mejorado: logo empresa, datos cliente, diseño por tipo doc
- [ ] 5.4 App Store / Google Play (PWA + Capacitor) — fuera de scope por ahora
- [x] 5.5 Landing page pricing actualizada (Básico gratis, Pro 29€, Empresa 79€)

### FASE 6 — Stripe Tax + Hardening ← SIGUIENTE
**Objetivo:** IVA funcionando en producción + límites de plan robustos.

- [ ] 6.1 Activar Stripe Tax en Dashboard (ver sección STRIPE-A)
- [ ] 6.2 Registro fiscal España + tax_code en productos + tax_behavior en precios
- [ ] 6.3 Test end-to-end con tarjeta test 4000002760003184 (España) → verificar IVA 21%
- [ ] 6.4 Corrección manual de la suscripción de prueba existente en BD
- [ ] 6.5 Límites de plan enforced en Edge Functions (no solo en UI):
        - trade-voice-to-quote: rechazar si plan=basico y count_mes >= 15
        - trade-photo-scan: rechazar si plan=basico y count_mes >= 5
- [ ] 6.6 RLS: políticas de aislamiento cross-org auditadas
- [ ] 6.7 Webhook: añadir a Stripe Dashboard los eventos `customer.subscription.created`

### FASE 7 — Legalidad y operaciones
- [ ] 7.1 Política de privacidad + Términos de uso publicados (URL pública)
- [ ] 7.2 LOPD/GDPR: banner de cookies + gestión de consentimiento
- [ ] 7.3 Email de bienvenida automático (trigger en registro)
- [ ] 7.4 Email de factura Stripe automático (configurar en Stripe → Customer emails)
- [ ] 7.5 Backup automático Supabase activado (Dashboard → Settings → Backups)
- [ ] 7.6 Monitorización de errores (Sentry o Supabase Logs alertas)
- [ ] 7.7 Tests manuales flujo completo: registro → trial → upgrade → uso → portal → cancelación

---

## CHECKLIST PRE-COBRO REAL

- [ ] Stripe Tax activado con registro ES
- [ ] tax_behavior=exclusive en todos los precios de pago
- [ ] Test con tarjeta 4242424242424242 → pago OK + IVA correcto
- [ ] Test con tarjeta 4000002760003184 (España) → 21% IVA
- [ ] Webhook verificado en Stripe Dashboard → todos los eventos llegan
- [ ] trade_subscriptions.plan = correcto tras pago de prueba
- [ ] Portal Stripe configurado (cancelación, cambio de tarjeta)
- [ ] Política de privacidad y ToS publicados
- [ ] LOPD banner activo
- [ ] Email de bienvenida funcional
- [ ] Dominio trabflow.com / tradeflow.es verificado en Stripe

---

## CONVENCIONES DE CÓDIGO

- Sin comentarios obvios; solo WHY no obvio
- Sin sub-componentes definidos dentro del padre (causan re-mount)
- RLS siempre activo; nunca `service_role` en cliente
- Variables de entorno: `VITE_*` solo en frontend; secretos solo en Edge Functions
- Commits en español, mensajes cortos tipo `feat:`, `fix:`, `chore:`

---

## ESTADO ACTUAL DEL SISTEMA

| Módulo                         | Estado               |
|--------------------------------|----------------------|
| Auth (registro/login)          | ✅ Producción         |
| Presupuestos (voz/foto)        | ✅ Producción         |
| Clientes CRM                   | ✅ Producción         |
| Facturas                       | ✅ Producción         |
| Catálogo propio + global       | ✅ Producción         |
| Planificación (Trabajos)       | ✅ Producción         |
| Admin panel                    | ✅ Producción         |
| Multi-usuario / Roles          | ✅ Producción         |
| Módulo Ingresos                | ✅ Producción         |
| Módulo Equipo                  | ✅ Producción         |
| Onboarding wizard              | ✅ Producción         |
| PDF mejorado con logo          | ✅ Producción         |
| Stripe Checkout + Webhook      | ✅ Código OK          |
| Stripe Tax (IVA)               | ⚠️ Config. pendiente |
| Límites de plan en backend     | 🔴 Pendiente Fase 6  |
| Legalidad LOPD/GDPR            | 🔴 Pendiente Fase 7  |
