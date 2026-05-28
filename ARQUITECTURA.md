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
- Pagos: Stripe (pendiente)

---

## PLANES DE SUSCRIPCIÓN

| Característica              | Básico (gratis/trial) | Pro (€/mes)     | Empresa (€/mes)   |
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

### Tablas existentes (ya en producción)
- `trade_orgs` — organizaciones
- `trade_quotes` — presupuestos
- `trade_clients` — clientes
- `trade_invoices` — facturas
- `trade_catalog_products` / `trade_catalog_variants` — catálogo
- `trade_jobs` — trabajos planificados
- `trade_workers` — trabajadores
- `trade_tarifas` — tarifas hora
- `trade_subscriptions` — suscripción activa

### Tablas a crear

```sql
-- Miembros de la organización (multi-usuario Empresa)
CREATE TABLE trade_org_members (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id      uuid REFERENCES trade_orgs(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rol         text NOT NULL DEFAULT 'tecnico'
                CHECK (rol IN ('owner','admin','comercial','tecnico','visualizador')),
  activo      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- Permisos granulares opcionales (override de rol base)
CREATE TABLE trade_org_permissions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id   uuid REFERENCES trade_org_members(id) ON DELETE CASCADE NOT NULL,
  permiso     text NOT NULL,
  granted     boolean DEFAULT true,
  UNIQUE (member_id, permiso)
);

-- RLS
ALTER TABLE trade_org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_org_permissions ENABLE ROW LEVEL SECURITY;

-- Solo miembros de la org pueden ver sus miembros
CREATE POLICY "members_select" ON trade_org_members
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM trade_org_members WHERE user_id = auth.uid())
  );

-- Solo owner/admin pueden gestionar miembros
CREATE POLICY "members_manage" ON trade_org_members
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM trade_org_members
      WHERE user_id = auth.uid() AND rol IN ('owner','admin')
    )
  );
```

### Campos a añadir a tablas existentes

```sql
-- Limitar presupuestos por plan (contar por mes)
-- No requiere campo nuevo; se cuenta con COUNT + fecha

-- Asociar presupuesto/factura a miembro concreto (trazabilidad)
ALTER TABLE trade_quotes ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE trade_invoices ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Stripe en trade_subscriptions
ALTER TABLE trade_subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE trade_subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE trade_subscriptions ADD COLUMN IF NOT EXISTS stripe_price_id text;
ALTER TABLE trade_subscriptions ADD COLUMN IF NOT EXISTS current_period_end timestamptz;
```

---

## ARQUITECTURA REACT

### Contexto de sesión (`SessionContext`)

```
src/
  context/
    SessionContext.tsx     ← auth user, org, plan, rol, permisos
  hooks/
    usePermissions.ts      ← can('quotes.create') → boolean
  components/
    AppDashboardView.tsx   ← componente principal existente
    ScreenPlanificacion    ← ya existe
    ScreenIngresos         ← NUEVO (Empresa only)
    ScreenEquipo           ← NUEVO (Empresa only)
```

### `SessionContext` — estructura

```typescript
interface SessionContextValue {
  user: User | null;
  org: TradeOrg | null;
  plan: 'basico' | 'pro' | 'empresa';
  rol: 'owner' | 'admin' | 'comercial' | 'tecnico' | 'visualizador';
  permisos: string[];          // lista de permisos efectivos
  isLoading: boolean;
}
```

### `usePermissions` hook

```typescript
function usePermissions() {
  const { permisos } = useContext(SessionContext);
  return {
    can: (permiso: string) => permisos.includes(permiso),
  };
}
```

### Uso en componentes

```tsx
const { can } = usePermissions();

{can('quotes.create') && <button>Nuevo presupuesto</button>}
{can('invoices.manage') && <ScreenFacturas />}
{can('team.manage') && <ScreenEquipo />}
```

---

## MÓDULOS NUEVOS A CREAR

### Módulo Ingresos (Empresa)
Muestra rentabilidad del negocio:
- Total facturado por período
- Cobrado vs pendiente
- Coste estimado (tarifas hora × horas trabajos)
- Margen bruto por trabajo/cliente
- Gráfico mensual de ingresos

### Módulo Equipo y Permisos (Empresa)
- Lista de miembros con rol y estado
- Invitar miembro por email (Edge Function `send-invite`)
- Cambiar rol
- Revocar acceso
- Vista de actividad por miembro

---

## STRIPE — INTEGRACIÓN

### Edge Functions necesarias
- `stripe-create-checkout` — crea sesión de pago para upgrade
- `stripe-create-portal` — portal de gestión de suscripción
- `stripe-webhook` — escucha eventos (`invoice.paid`, `customer.subscription.deleted`, etc.)

### Flujo de upgrade
1. Usuario pulsa "Mejorar plan"
2. App llama `stripe-create-checkout` → devuelve URL
3. Usuario completa pago en Stripe
4. Webhook actualiza `trade_subscriptions.plan` + `stripe_*` campos
5. App detecta cambio y desbloquea funcionalidades

### Productos Stripe a crear
- `price_basico_mensual` / `price_basico_anual`
- `price_pro_mensual` / `price_pro_anual`
- `price_empresa_mensual` / `price_empresa_anual`

---

## ROADMAP POR FASES

### FASE 1 — Base multiusuario ✅ EMPEZAMOS AQUÍ
**Objetivo:** Infraestructura de roles sin romper lo que funciona.

- [x] 1.1 Migración SQL: `trade_org_members` + `trade_org_permissions`
- [x] 1.2 Migración SQL: campos `created_by`, `stripe_*` en tablas existentes
- [x] 1.3 Crear `SessionContext` con carga de org, plan y rol del usuario
- [x] 1.4 Crear hook `usePermissions` con `can()`
- [x] 1.5 Integrar `SessionContext` en `main.tsx` / `App.tsx`
- [x] 1.6 Ocultar/mostrar elementos UI según `can()` (presupuestos, facturas, equipo)

### FASE 2 — Módulo Equipo y Permisos
**Objetivo:** El owner puede invitar y gestionar su equipo.

- [x] 2.1 Edge Function `send-invite` (email de invitación con magic link)
- [x] 2.2 Pantalla `ScreenEquipo` — lista miembros, roles, invitar, revocar
- [x] 2.3 Flujo de aceptación de invitación (nuevo usuario se une a la org)
- [ ] 2.4 Limitaciones por plan aplicadas en UI y en RLS

### FASE 3 — Módulo Ingresos
**Objetivo:** Dashboard de rentabilidad para plan Empresa.

- [x] 3.1 Queries de ingresos (facturado, cobrado, pendiente por período)
- [ ] 3.2 Cálculo de costes por tarifa × horas de trabajos (pendiente datos de horas reales)
- [x] 3.3 Pantalla `ScreenIngresos` con gráfico de barras CSS
- [x] 3.4 KPIs por período + top clientes por facturación

### FASE 4 — Stripe
**Objetivo:** Cobrar por el SaaS.

- [ ] 4.1 Crear productos y precios en Stripe Dashboard
- [ ] 4.2 Edge Function `stripe-create-checkout`
- [ ] 4.3 Edge Function `stripe-create-portal`
- [ ] 4.4 Edge Function `stripe-webhook` (actualiza `trade_subscriptions`)
- [ ] 4.5 UI de upgrade desde ajustes / banner de límite alcanzado
- [ ] 4.6 Bloqueos hard cuando plan no cubre la acción

### FASE 5 — Pulido y lanzamiento
- [ ] 5.1 Onboarding wizard (primera vez que entra un usuario nuevo)
- [ ] 5.2 Notificaciones push (trabajo asignado, presupuesto aceptado)
- [ ] 5.3 PDF mejorado de presupuesto/factura con logo empresa
- [ ] 5.4 App Store / Google Play (PWA + capacitor)
- [ ] 5.5 Landing page pública con pricing

---

## CHECKLIST PRE-STRIPE (completar antes de cobrar)

- [ ] RLS correcto en todas las tablas (ningún dato cross-org visible)
- [ ] Límites de plan enforced en backend (Edge Functions), no solo en UI
- [ ] Email de bienvenida funcional
- [ ] Email de factura funcional
- [ ] Política de privacidad + Términos de uso publicados
- [ ] LOPD/GDPR: aviso de cookies, gestión de consentimiento
- [ ] Backup automático Supabase activado
- [ ] Monitorización de errores (Sentry o similar)
- [ ] Tests manuales del flujo completo: registro → trial → upgrade → uso → portal

---

## CONVENCIONES DE CÓDIGO

- Sin comentarios obvios; solo WHY no obvio
- Sin sub-componentes definidos dentro del padre (causan re-mount)
- RLS siempre activo; nunca `service_role` en cliente
- Variables de entorno: `VITE_*` solo en frontend; secretos solo en Edge Functions
- Commits en español, mensajes cortos tipo `feat:`, `fix:`, `chore:`

---

## ESTADO ACTUAL DEL SISTEMA

| Módulo                     | Estado        |
|----------------------------|---------------|
| Auth (registro/login)      | ✅ Producción  |
| Presupuestos (voz/foto)    | ✅ Producción  |
| Clientes CRM               | ✅ Producción  |
| Facturas                   | ✅ Producción  |
| Catálogo                   | ✅ Producción  |
| Planificación (Trabajos)   | ✅ Producción  |
| Admin panel                | ✅ Producción  |
| Multi-usuario / Roles      | 🔴 Pendiente   |
| Módulo Ingresos            | 🔴 Pendiente   |
| Módulo Equipo              | 🔴 Pendiente   |
| Stripe / Pagos             | 🔴 Pendiente   |
