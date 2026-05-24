# TradeFlow AI — Plan de Implementación por Fases
**Versión:** 2.0 — Mayo 2026  
**Proyecto Supabase:** `dqqjaujnulutinskmqsu` (GestionDebacuPro)  
**Repositorio:** https://github.com/fercarboc/tradeflow.git  
**Producción:** https://tradeflow-woad.vercel.app

---

## Estado Actual — Lo que está live hoy

### Web (Vercel)
| Pantalla | Estado |
|---------|--------|
| Landing (Home, ComoFunciona, Precios, Contacto) | ✅ Live |
| AppDashboard demo (modo PC y móvil) | ✅ Live |
| Wizard de registro (3 pasos + success) | ✅ Live |
| Panel admin (fercarboc@gmail.com) | ✅ Live |
| Ajustes: Datos Fiscales, Trabajadores, Tarifas/Catálogo (UI) | ✅ Live (UI sola, sin persistencia en trabajadores/tarifas) |
| Login modal con Supabase Auth | ✅ Live |

### Base de datos (Supabase)
| Tabla | Estado |
|-------|--------|
| `trade_organizations` | ✅ Con campos fiscales extendidos |
| `trade_subscriptions` | ✅ trial/active/cancelled/expired |
| `trade_clients` | ✅ CRM básico |
| `trade_quotes` + `trade_quote_items` | ✅ |
| `trade_invoices` | ✅ (installer → cliente) |
| `trade_waitlist` | ✅ |
| `trade_workers` | ❌ Por crear |
| `trade_catalog` | ❌ Por crear |
| `trade_jobs` (órdenes de trabajo) | ❌ Por crear |
| `trade_job_workers` | ❌ Por crear |

---

## Arquitectura de Dos Paneles — Concepto Clave

TradeFlow tiene **dos flujos de facturación completamente distintos** que nunca deben mezclarse:

```
┌─────────────────────────────────────────────────────────────┐
│  PANEL ADMIN (fercarboc@gmail.com)                          │
│  TradeFlow cobra a sus clientes (instaladores/empresas)     │
│                                                             │
│  Facturación: por SUSCRIPCIÓN                               │
│  - Básico €29/mes, Pro €49/mes, Empresa €89/mes             │
│  - Gestionado via trade_subscriptions + Stripe              │
│  - Métricas: MRR, churm, trials, conversión                 │
└─────────────────────────────────────────────────────────────┘
                          ≠
┌─────────────────────────────────────────────────────────────┐
│  PANEL INSTALADOR / EMPRESA                                 │
│  El instalador cobra a sus clientes finales                 │
│                                                             │
│  Facturación: por PRESUPUESTOS y TRABAJOS realizados        │
│  - trade_quotes → trade_invoices                            │
│  - PDF de factura, estado de cobro, historial por cliente   │
│  + Gestión de trabajadores propios (quién hace qué)         │
│  + Planificación de trabajos del día/semana con ruta        │
└─────────────────────────────────────────────────────────────┘
```

---

## Schema de BD — Tablas nuevas a crear

### trade_workers — Empleados de cada organización
```sql
CREATE TABLE public.trade_workers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  telefono    text,
  email       text,                           -- login futuro en app móvil
  rol         text NOT NULL DEFAULT 'tecnico',
  -- valores: 'tecnico' | 'instalador' | 'comercial' | 'administrativo'
  activo      boolean NOT NULL DEFAULT true,
  notas       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trade_workers_org_id ON public.trade_workers(org_id);
ALTER TABLE public.trade_workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso a trabajadores propios"
  ON public.trade_workers FOR ALL
  USING (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));

-- Admin puede ver todos
CREATE POLICY "Admin ve todos los trabajadores"
  ON public.trade_workers FOR SELECT
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'fercarboc@gmail.com');
```

### trade_catalog — Tarifas/Catálogo de la organización
```sql
CREATE TABLE public.trade_catalog (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  codigo      text,
  familia     text NOT NULL DEFAULT 'General',
  descripcion text NOT NULL,
  precio_base numeric(10,2) NOT NULL DEFAULT 0,
  unidad      text NOT NULL DEFAULT 'ud',
  -- valores comunes: 'ud' | 'ml' | 'm2' | 'm3' | 'h' | 'kg' | 'jornada'
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trade_catalog_org_id  ON public.trade_catalog(org_id);
CREATE INDEX idx_trade_catalog_familia ON public.trade_catalog(org_id, familia);
ALTER TABLE public.trade_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso al catálogo propio"
  ON public.trade_catalog FOR ALL
  USING (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));
```

### trade_jobs — Órdenes de trabajo / planificación
```sql
CREATE TABLE public.trade_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  quote_id        uuid REFERENCES public.trade_quotes(id) ON DELETE SET NULL,
  client_id       uuid REFERENCES public.trade_clients(id) ON DELETE SET NULL,
  titulo          text NOT NULL,
  descripcion     text,
  estado          text NOT NULL DEFAULT 'planificado',
  -- valores: 'planificado' | 'en_curso' | 'completado' | 'cancelado' | 'pendiente_material'
  prioridad       text NOT NULL DEFAULT 'normal',
  -- valores: 'urgente' | 'alta' | 'normal' | 'baja'
  fecha_inicio    date,
  hora_inicio     time,
  fecha_fin       date,
  hora_fin        time,
  duracion_horas  numeric(4,1),
  -- Dirección del trabajo (puede diferir del domicilio del cliente)
  direccion       text,
  localidad       text,
  cp              text,
  latitud         numeric(9,6),
  longitud        numeric(9,6),
  -- Seguimiento
  completado_por  uuid REFERENCES public.trade_workers(id) ON DELETE SET NULL,
  completado_at   timestamptz,
  notas_cierre    text,
  fotos_cierre    text[],           -- array de storage paths
  firma_cliente   text,             -- storage path de la firma
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trade_jobs_org_id     ON public.trade_jobs(org_id);
CREATE INDEX idx_trade_jobs_fecha      ON public.trade_jobs(org_id, fecha_inicio);
CREATE INDEX idx_trade_jobs_estado     ON public.trade_jobs(org_id, estado);
CREATE INDEX idx_trade_jobs_client_id  ON public.trade_jobs(client_id);
ALTER TABLE public.trade_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso a trabajos propios"
  ON public.trade_jobs FOR ALL
  USING (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));
```

### trade_job_workers — Asignación de trabajadores a cada trabajo
```sql
CREATE TABLE public.trade_job_workers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES public.trade_jobs(id) ON DELETE CASCADE,
  worker_id   uuid NOT NULL REFERENCES public.trade_workers(id) ON DELETE CASCADE,
  rol         text NOT NULL DEFAULT 'asignado',
  -- valores: 'responsable' | 'asignado' | 'apoyo'
  notificado  boolean NOT NULL DEFAULT false,
  aceptado    boolean,            -- null = pendiente, true = acepta, false = rechaza
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id, worker_id)
);

CREATE INDEX idx_trade_job_workers_job    ON public.trade_job_workers(job_id);
CREATE INDEX idx_trade_job_workers_worker ON public.trade_job_workers(worker_id);
ALTER TABLE public.trade_job_workers ENABLE ROW LEVEL SECURITY;

-- Hereda acceso via job → org
CREATE POLICY "Acceso a asignaciones propias"
  ON public.trade_job_workers FOR ALL
  USING (job_id IN (
    SELECT j.id FROM public.trade_jobs j
    JOIN public.trade_organizations o ON j.org_id = o.id
    WHERE o.owner_id = auth.uid()
  ))
  WITH CHECK (job_id IN (
    SELECT j.id FROM public.trade_jobs j
    JOIN public.trade_organizations o ON j.org_id = o.id
    WHERE o.owner_id = auth.uid()
  ));
```

### Triggers updated_at para nuevas tablas
```sql
CREATE OR REPLACE TRIGGER trg_trade_workers_updated
  BEFORE UPDATE ON public.trade_workers
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();

CREATE OR REPLACE TRIGGER trg_trade_catalog_updated
  BEFORE UPDATE ON public.trade_catalog
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();

CREATE OR REPLACE TRIGGER trg_trade_jobs_updated
  BEFORE UPDATE ON public.trade_jobs
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();
```

---

## Diagrama de entidades completo (actualizado)

```
auth.users
    │
    └── trade_organizations (1 por cuenta)
            │
            ├── trade_subscriptions      (suscripción a TradeFlow — admin ve esto)
            │
            ├── trade_workers            (empleados de la empresa)
            │       └── trade_job_workers ◄─────────┐
            │                                        │
            ├── trade_catalog            (catálogo/tarifas propias)
            │                                        │
            ├── trade_clients            (CRM: clientes del instalador)
            │                                        │
            ├── trade_quotes             (presupuestos)          │
            │       └── trade_quote_items  (partidas — del catálogo o libres)
            │                                        │
            ├── trade_jobs               (órdenes de trabajo) ───┘
            │       └── trade_job_workers (asignación trabajadores ↔ jobs)
            │
            ├── trade_invoices           (facturas instalador → cliente)
            ├── trade_voice_recordings
            └── trade_photo_scans

trade_waitlist  (lista espera pública)
```

---

## Fases de Implementación

---

### FASE 1 — Cimientos: Registro completo + Persistencia de Ajustes
**Prioridad: MÁXIMA — empezar mañana**  
**Duración estimada: 2-3 días**

#### Objetivo
El wizard de registro crea la cuenta y la organización correctamente. El instalador puede completar sus datos fiscales, trabajadores y catálogo desde Ajustes, y todo persiste en Supabase.

#### 1.1 Migrations DB (ejecutar en Supabase SQL Editor)
- Crear `trade_workers` con RLS
- Crear `trade_catalog` con RLS
- Verificar que `trade_organizations` tiene todos los campos fiscales: `telefono_fijo`, `telefono_movil`, `localidad`, `cp`, `provincia`, `pais`, `tipo_negocio`

#### 1.2 Wizard de registro — verificar flujo completo
- [ ] Paso 1: sector + tipo negocio → guarda `oficio[]` y `tipo_negocio` en metadata
- [ ] Paso 2: plan + ciclo → guarda en metadata
- [ ] Paso 3: `registerUser()` → `auth.signUp` → `trade_organizations` → `trade_subscriptions`
- [ ] Paso 4: success → botón "Ir a mi panel" navega a AppDashboard con sesión activa
- [ ] Email de confirmación (configurar en Supabase Auth templates con branding TradeFlow)
- [ ] `getOrCreateOrg()` en AppDashboard crea la org si el email no fue confirmado aún

#### 1.3 Ajustes — Datos Fiscales con persistencia real
- [ ] `saveFiscalData()` en `src/lib/supabase.ts` → UPDATE `trade_organizations` con todos los campos
- [ ] `loadLiveData()` ya captura `orgId` — verificar que mapea los nuevos campos fiscales
- [ ] Feedback visual: toast "Datos guardados" / error en pantalla

#### 1.4 Ajustes — Trabajadores CRUD en Supabase
- [ ] `loadWorkers(orgId)` → SELECT de `trade_workers`
- [ ] `addWorker(orgId, worker)` → INSERT
- [ ] `updateWorker(id, data)` → UPDATE
- [ ] `deleteWorker(id)` → DELETE (soft: `activo = false`)
- [ ] UI ya existe en `ScreenSettings` — solo conectar las funciones

#### 1.5 Ajustes — Catálogo CRUD en Supabase
- [ ] `loadCatalog(orgId)` → SELECT de `trade_catalog` ordenado por familia, codigo
- [ ] `addCatalogItem(orgId, item)` → INSERT
- [ ] `updateCatalogItem(id, data)` → UPDATE  
- [ ] `deleteCatalogItem(id)` → UPDATE `activo = false`
- [ ] Importación masiva por CSV (bonus: parsear CSV en cliente y hacer upsert)

#### 1.6 Helpers Supabase a añadir en `src/lib/supabase.ts`
```typescript
// Tipos
export interface TradeWorker { id, org_id, nombre, telefono, email, rol, activo, created_at }
export interface TradeCatalogItem { id, org_id, codigo, familia, descripcion, precio_base, unidad, activo }

// Funciones
export async function loadWorkers(orgId: string): Promise<TradeWorker[]>
export async function upsertWorker(orgId: string, worker: Partial<TradeWorker>): Promise<TradeWorker>
export async function deactivateWorker(id: string): Promise<void>
export async function loadCatalog(orgId: string): Promise<TradeCatalogItem[]>
export async function upsertCatalogItem(orgId: string, item: Partial<TradeCatalogItem>): Promise<TradeCatalogItem>
export async function deactivateCatalogItem(id: string): Promise<void>
export async function saveFiscalData(orgId: string, data: Partial<TradeOrganization>): Promise<void>
```

---

### FASE 2 — Core App: Presupuestos y Clientes reales
**Prioridad: ALTA**  
**Duración estimada: 3-4 días**

#### Objetivo
El instalador puede crear presupuestos reales (con IA por voz o manual), gestionar clientes y ver su dashboard con datos de su cuenta.

#### 2.1 Dashboard con datos reales
- [ ] `loadDashboard(orgId)` ya existe — conectar al estado del componente
- [ ] Métricas reales: presupuestos del mes, facturado, pendiente de cobro
- [ ] Lista de presupuestos recientes cargada desde `trade_quotes`
- [ ] Lista de facturas pendientes desde `trade_invoices`

#### 2.2 CRM — Clientes
- [ ] Pantalla `ScreenClientes` (nueva) con lista real desde `trade_clients`
- [ ] CRUD completo: crear, editar, ver historial de presupuestos por cliente
- [ ] Búsqueda por nombre/teléfono
- [ ] Resumen: importe total facturado al cliente, obras activas

#### 2.3 Presupuestos — Creación manual
- [ ] Pantalla `ScreenNuevoPresupuesto` con:
  - Selección de cliente (o crear nuevo inline)
  - Añadir partidas: desde catálogo propio o libre
  - IVA configurable
  - Vista previa antes de guardar
- [ ] `saveQuote()` ya existe en lib — conectar al formulario
- [ ] Numeración automática: `PRE-YYYY-NNN`
- [ ] Estado: Borrador → Enviado → Aceptado → Facturado

#### 2.4 Presupuestos — Creación por voz (IA)
- [ ] Grabar audio en navegador (`MediaRecorder API`)
- [ ] Upload a Supabase Storage `trade-voices/`
- [ ] Llamada a Edge Function `trade-voice-to-quote` (Whisper + extracción de partidas)
- [ ] Resultado: lista de partidas editable antes de confirmar

#### 2.5 Facturas
- [ ] Convertir presupuesto aceptado en factura (`convertToInvoice()` ya existe)
- [ ] Numeración: `FAC-YYYY-NNN`
- [ ] PDF de factura (librería `@react-pdf/renderer` o `jspdf`)
- [ ] Estado: Pendiente → Pagada / Vencida
- [ ] Envío por WhatsApp (link de descarga del PDF)

---

### FASE 3 — Trabajadores y Planificación de Trabajos
**Prioridad: MEDIA-ALTA**  
**Duración estimada: 4-5 días**

#### Objetivo
El instalador/empresa puede planificar trabajos, asignarlos a trabajadores y ver la agenda del día con ruta optimizada.

#### 3.1 Migrations DB
- Crear `trade_jobs` con todos los campos
- Crear `trade_job_workers`
- Crear triggers `updated_at`

#### 3.2 Pantalla de Planificación — `ScreenPlanificacion`
Layout:
```
[Vista semana/día] [Hoy] [Mañana] [Semana]

┌─────────────────────────────────────────┐
│  Lunes 26 Mayo                          │
│  ─────────────────────────────────────  │
│  🔵 09:00  Juan García — Arreglo caldera│
│            C/ Mayor 12, Alcalá           │
│            👤 Pedro Ramos (técnico)      │
│                                         │
│  🟡 11:30  María López — Instalación    │
│            C/ Real 45, Alcalá            │
│            👤 Sin asignar               │
│                                         │
│  🟢 15:00  Carlos Ruiz — Revisión       │
│            C/ Olmo 3, Alcalá             │
│            👤 Juan Pérez (técnico)       │
└─────────────────────────────────────────┘

[+ Nuevo trabajo]  [Ver ruta del día]
```

#### 3.3 Formulario de nuevo trabajo
- Vinculado a cliente (CRM) y/o presupuesto
- Fecha + hora de inicio + duración estimada
- Dirección del trabajo (autocompletado con Google Places o manual)
- Asignación de trabajadores (múltiple, con rol: responsable / apoyo)
- Prioridad: urgente / alta / normal / baja
- Descripción / instrucciones para el técnico

#### 3.4 Vista de Ruta del día
- Lista ordenada de trabajos del día por hora
- Dirección de cada trabajo con link a Google Maps / Waze
- Resumen: N trabajos, X horas estimadas, Y km aprox (si geocoding disponible)
- Para cada trabajo: cliente, teléfono, dirección, instrucciones
- Estado rápido: marcar como "en camino" / "completado"

#### 3.5 Asignación y seguimiento
- Al crear/editar trabajo → selector de trabajadores de `trade_workers`
- Un trabajo puede tener 1+ trabajadores (tabla `trade_job_workers`)
- Historial: quién completó el trabajo (`completado_por`) + timestamp
- Notas de cierre: texto + fotos (opcional en v1)
- Filtros en lista de trabajos: por trabajador, por estado, por fecha

#### 3.6 Notificaciones (futuro próximo)
- WhatsApp al trabajador al asignarle un trabajo
- Recordatorio día anterior
- Alerta si trabajo sin asignar para mañana

---

### FASE 4 — Panel Admin TradeFlow (Facturación por Suscripción)
**Prioridad: MEDIA**  
**Duración estimada: 3-4 días**

#### Objetivo
El admin (fercarboc@gmail.com) tiene visibilidad completa del negocio SaaS: clientes, suscripciones, MRR, facturas emitidas a los instaladores.

#### Diferencia clave con el panel de instaladores
| Panel Admin | Panel Instalador |
|-------------|-----------------|
| Clientes = instaladores/empresas | Clientes = usuarios finales del instalador |
| Facturas = suscripciones mensuales/anuales | Facturas = trabajos realizados para el cliente |
| Métricas = MRR, churn, trials, conversión | Métricas = presupuestos, cobros, obras activas |
| Control = plan, descuentos, acceso | Control = catálogo, trabajadores, agenda |

#### 4.1 Mejoras al AdminView existente
- [ ] Sección "Suscripciones" — tabla con todas las suscripciones activas/trial/expiradas
- [ ] Sección "Facturación Admin" — facturas que TradeFlow emite a cada instalador
  - Tabla: numero, cliente, periodo, importe, estado (pagada/pendiente)
  - Generadas por Stripe (webhook → tabla `trade_platform_invoices`)
- [ ] Sección "Análisis":
  - MRR por plan
  - Evolución de nuevos registros (gráfico simple)
  - Tasa de conversión trial → pago
  - Churn mensual

#### 4.2 Nueva tabla `trade_platform_invoices`
```sql
CREATE TABLE public.trade_platform_invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.trade_organizations(id),
  subscription_id uuid REFERENCES public.trade_subscriptions(id),
  stripe_invoice_id text UNIQUE,
  numero          text NOT NULL,            -- TF-2026-0001
  periodo_inicio  date NOT NULL,
  periodo_fin     date NOT NULL,
  importe         numeric(10,2) NOT NULL,
  iva_pct         smallint NOT NULL DEFAULT 21,
  estado          text NOT NULL DEFAULT 'pendiente',
  -- valores: 'pendiente' | 'pagada' | 'vencida' | 'anulada'
  stripe_pdf_url  text,
  paid_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
-- Solo admin puede ver esta tabla
ALTER TABLE public.trade_platform_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Solo admin ve facturas de plataforma"
  ON public.trade_platform_invoices FOR ALL
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'fercarboc@gmail.com');
```

#### 4.3 Stripe Integration
- Webhook Supabase Edge Function `trade-stripe-webhook`:
  - `invoice.paid` → actualiza `trade_subscriptions.status = 'active'`, crea `trade_platform_invoices`
  - `invoice.payment_failed` → alerta, email al instalador
  - `customer.subscription.deleted` → `status = 'cancelled'`
- Customer portal: link a Stripe Customer Portal para que el instalador gestione su suscripción
- Checkout: al terminar trial, botón "Activar plan" → Stripe Checkout

---

### FASE 5 — App Móvil para Trabajadores
**Prioridad: MEDIA**  
**Duración estimada: 5-7 días**

#### Objetivo
Los trabajadores de campo tienen una app sencilla que les muestra sus trabajos del día, pueden marcarlos como completados y enviar fotos de cierre.

#### 5.1 Login de trabajador
- Email del trabajador (campo en `trade_workers`) → `auth.signUp` con contraseña temporal
- Al entrar por primera vez: cambiar contraseña (flag `force_password_change`)
- Vista simplificada: solo su agenda + trabajos asignados

#### 5.2 Pantalla principal del trabajador
```
Hoy, 26 Mayo
─────────────────────────────
09:00 Arreglo caldera
      Juan García
      C/ Mayor 12 ↗ (abre Maps)
      [Estoy en camino] [Iniciar] [Completar]

11:30 Instalación radiadores
      María López
      C/ Real 45 ↗
      [Estoy en camino]

─────────────────────────────
Mañana, 27 Mayo
──────────────────
15:00 Revisión anual
      ...
```

#### 5.3 Cierre de trabajo
- Fotos desde cámara / galería
- Notas de cierre (texto)
- Firma del cliente (campo de firma digital)
- Marca como completado → actualiza `trade_jobs.estado = 'completado'`, `completado_por`, timestamp

#### 5.4 Ruta del día
- Lista de direcciones del día ordenada por hora
- Link directo a Google Maps con toda la ruta secuencial
- Resumen: N trabajos, horas estimadas

---

### FASE 6 — IA: Sistema de Estimación por Voz y Foto
**Prioridad: ALTA (diferenciador principal del producto)**  
**Duración estimada: 4-5 días**

#### Objetivo del sistema
El instalador habla naturalmente desde la obra. En segundos tiene un presupuesto profesional listo para enviar por WhatsApp. La IA reduce el trabajo administrativo a casi cero.

> **Regla de negocio CRÍTICA: La IA NUNCA inventa precios.**
> Los precios siempre vienen de: catálogo de la empresa, tarifas del instalador, reglas de mano de obra, reglas de margen, reglas fiscales (IVA).
> La IA solo entiende la intención, estructura la información y detecta tareas/materiales.
> El sistema (TradeFlow) aplica la lógica de precios, cálculos, impuestos y márgenes.

#### Flujo completo del usuario
```
📱 Usuario abre app → toca "Crear presupuesto"
   │
   ├─ Habla: "Instalar termo eléctrico 80L, cambiar llave de paso y revisar fuga del baño"
   │
   ▼
🎙️ PASO 1: Transcripción (OpenAI GPT-4o mini transcribe)
   │  → texto crudo en español
   ▼
🧠 PASO 2: Parsing y estructuración (GPT-4o mini / Claude Sonnet)
   │  → JSON estructurado con tareas, materiales, horas, urgencia
   ▼
💰 PASO 3: Matching con catálogo + aplicar precios (lógica TradeFlow, sin IA)
   │  → partidas con precios del catálogo de la empresa
   ▼
📄 PASO 4: Presupuesto profesional generado
   │  → líneas de presupuesto, subtotal, IVA, total
   ▼
📲 PASO 5: Envío directo por WhatsApp (un tap)
```

#### Arquitectura de IA — Dos modelos, cada uno para lo que mejor hace

```
                     GRABACIÓN DE VOZ
                           │
                           ▼
              ┌────────────────────────┐
              │  OpenAI GPT-4o         │
              │  Transcribe / mini     │  ← STT (Speech-to-Text)
              │                        │
              │  Por qué OpenAI aquí:  │
              │  ✓ Líder actual en STT │
              │  ✓ Español obra/campo  │
              │  ✓ Tolera ruido fondo  │
              │  ✓ Lenguaje natural    │
              │  ✓ Coste bajo          │
              └────────────┬───────────┘
                           │  texto transcrito
                           ▼
              ┌────────────────────────┐
              │  Claude (Anthropic)    │  ← Extracción estructurada
              │  claude-sonnet-4-6     │
              │  o claude-haiku-4-5    │
              │  (según coste/calidad) │
              │                        │
              │  Por qué Claude aquí:  │
              │  ✓ Superior en parsing │
              │    de texto no-struct. │
              │  ✓ Mejor en JSON output│
              │  ✓ Razonamiento precio │
              │  ✓ Contexto del catál. │
              └────────────┬───────────┘
                           │  JSON partidas
                           ▼
              ┌────────────────────────┐
              │  Cliente (React)       │
              │  Revisión + edición    │
              │  antes de confirmar    │
              └────────────────────────┘
```

#### 6.1 Step 1 — Transcripción de voz (OpenAI GPT-4o mini transcribe)

**Por qué este modelo:**
- Optimizado para español de campo (lenguaje técnico, slang de obra)
- Tolera ruido de fondo (taladros, obra, calle)
- Latencia muy baja → experiencia "instant"
- Coste: ~$0.003/min (el más económico de alta calidad)

```typescript
// Edge Function: trade-voice-to-quote/index.ts
const formData = new FormData();
formData.append('file', audioBlob, 'audio.webm');
formData.append('model', 'gpt-4o-mini-transcribe');
formData.append('language', 'es');
formData.append('prompt', 'Transcripción de un instalador describiendo trabajos de fontanería, electricidad u otros oficios.');

const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
  body: formData,
});
const { text: transcript } = await res.json();
// → "Instalar termo eléctrico 80 litros, cambiar llave de paso y revisar fuga del baño"
```

#### 6.2 Step 2 — Parsing y estructuración (GPT-4o mini o Claude Sonnet)

**Output esperado del parsing — JSON estructurado:**
```json
{
  "client": "",
  "job_type": "fontanería",
  "tasks": [
    { "descripcion": "Instalación termo eléctrico 80L", "categoria": "instalacion" },
    { "descripcion": "Cambio llave de paso", "categoria": "material" },
    { "descripcion": "Revisión y reparación fuga baño", "categoria": "reparacion" }
  ],
  "materials": [
    { "descripcion": "Termo eléctrico 80 litros", "cantidad": 1, "unidad": "ud" },
    { "descripcion": "Llave de paso 1/2\"", "cantidad": 1, "unidad": "ud" }
  ],
  "estimated_hours": [{ "tipo": "mano_de_obra", "horas": 3 }],
  "urgency": "normal",
  "notes": "Revisar origen fuga antes de presupuestar reparación"
}
```

**Opción A — GPT-4o mini (misma API que STT, arquitectura simple):**
```typescript
const res = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: PARSING_SYSTEM_PROMPT },
      { role: 'user', content: transcript },
    ],
  }),
});
```

**Opción B — Claude Sonnet/Haiku (mejor razonamiento en JSON):**
```typescript
const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'),
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: `${PARSING_SYSTEM_PROMPT}\n\nTexto: "${transcript}"` }],
  }),
});
```

**Prompt del sistema (mismo para ambos modelos):**
```
Eres un asistente de TradeFlow para instaladores españoles.
Tu trabajo es analizar la transcripción de voz de un instalador y extraer información estructurada.

REGLA CRÍTICA: NO incluyas precios. Solo estructura las tareas y materiales.
Los precios los aplica el sistema según el catálogo de la empresa.

Devuelve JSON con esta estructura exacta: { client, job_type, tasks[], materials[], estimated_hours[], urgency, notes }
- urgency: "urgente" | "alta" | "normal" | "baja"
- unidades válidas: "ud" | "ml" | "m2" | "m3" | "h" | "kg" | "jornada"
```

**Decisión de modelo — configurable por variable de entorno:**
```typescript
const EXTRACTION_MODEL = Deno.env.get('EXTRACTION_MODEL') ?? 'gpt-4o-mini';
// Opciones: 'gpt-4o-mini' | 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-6'
```

#### 6.3 Step 3 — Matching con catálogo + precios (lógica TradeFlow, sin IA)

Esta es la parte donde el sistema aplica las reglas de negocio. **Sin IA aquí.**

```typescript
// Matching semántico simple: buscar por palabras clave en descripcion/familia
async function matchCatalogItems(parsed: ParsedJob, orgId: string) {
  const catalog = await loadCatalog(orgId);
  
  return parsed.materials.map(material => {
    // Buscar coincidencia en catálogo por keywords
    const match = catalog.find(item =>
      material.descripcion.toLowerCase().split(' ').some(word =>
        item.descripcion.toLowerCase().includes(word) && word.length > 3
      )
    );
    
    return {
      descripcion: material.descripcion,
      cantidad: material.cantidad,
      unidad: match?.unidad ?? material.unidad,
      precio_unitario: match?.precio_base ?? 0,   // 0 si no hay match
      catalog_id: match?.id ?? null,
      del_catalogo: !!match,
      requiere_precio: !match,                     // flag: el instalador debe completar el precio
    };
  });
}
```

El usuario ve las partidas en la UI y puede:
- Ajustar precios que quedaron en 0 (sin match en catálogo)
- Modificar cantidades
- Añadir/eliminar líneas
- Confirmar → genera el presupuesto

#### 6.4 Step 4 — Generación del presupuesto profesional
- Numeración automática: `PRE-YYYY-NNN`
- Líneas del presupuesto con descripción, cantidad, precio, subtotal
- IVA según configuración de la org (default 21%)
- Total neto + IVA + total con IVA
- Formato de nombre profesional para cada partida (Claude puede mejorar la redacción si se quiere)

#### 6.5 Step 5 — WhatsApp (un tap)
Edge Function `trade-whatsapp-send`:
1. Genera PDF del presupuesto (Deno + librería de PDF)
2. Sube a Storage → URL temporal firmada (24h)
3. Envía via WhatsApp Cloud API (Meta): mensaje + enlace PDF
4. Registra `trade_quotes.whatsapp_sent_at`

**Modelos de STT disponibles:**
| Modelo | Calidad | Coste | Uso |
|--------|---------|-------|-----|
| `gpt-4o-mini-transcribe` | ★★★★☆ | ~$0.003/min | **Recomendado** — uso diario |
| `gpt-4o-transcribe` | ★★★★★ | ~$0.006/min | Máxima calidad, textos complejos |

**Modelos de extracción disponibles:**
| Modelo | JSON | Coste | Uso |
|--------|------|-------|-----|
| `gpt-4o-mini` | ★★★★☆ | muy bajo | Simplifica arquitectura (1 API) |
| `claude-haiku-4-5-20251001` | ★★★★★ | muy bajo | **Recomendado** — mejor JSON |
| `claude-sonnet-4-6` | ★★★★★ | medio | Textos muy largos o ambiguos |

#### 6.2 Foto → Materiales (GPT-4o Vision)
Edge Function `trade-photo-to-quote`:
1. Foto de instalación/avería subida a `trade-photos/`
2. GPT-4o Vision analiza: detecta materiales, estima cantidades
3. Claude busca coincidencias en `trade_catalog` de la org por descripción/familia
4. Propone partidas con precios del catálogo → usuario revisa

#### 6.3 WhatsApp Business
Edge Function `trade-whatsapp-send`:
1. Genera PDF del presupuesto/factura (server-side con Deno)
2. Sube a Storage → URL temporal firmada (1h de validez)
3. Envía via WhatsApp Cloud API (Meta) o Twilio WhatsApp
4. Registra envío en `trade_quotes.whatsapp_sent_at`

#### 6.4 Secretos necesarios en Supabase Edge Functions
```bash
# Configurar en Supabase Dashboard → Settings → Edge Functions → Secrets
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
WHATSAPP_TOKEN=...          # Meta Cloud API token
WHATSAPP_PHONE_NUMBER_ID=...
```

#### 6.5 Costes estimados IA (por presupuesto generado por voz)
| Componente | Coste estimado |
|-----------|---------------|
| Transcripción 1 min (gpt-4o-mini-transcribe) | ~€0.003 |
| Extracción Claude Haiku (~500 tokens) | ~€0.001 |
| **Total por presupuesto** | **~€0.004** |
| 100 presupuestos/mes (plan Básico) | ~€0.40/mes |

Coste marginal de IA despreciable frente a la cuota de suscripción.

---

## Checklist de Inicio para Mañana (Fase 1)

### Paso 1 — Migrations DB (10 min)
```
Supabase Dashboard → SQL Editor
Ejecutar: SQL de trade_workers + trade_catalog + trade_job_workers + triggers
```

### Paso 2 — Verificar wizard de registro (30 min)
```
1. Registrar cuenta nueva de prueba
2. Confirmar que crea trade_organization + trade_subscription
3. Login → verifica que llega al dashboard con datos de la org
```

### Paso 3 — Conectar Ajustes a Supabase (2-3 horas)
```
src/lib/supabase.ts → añadir funciones para workers y catalog
src/components/AppDashboardView.tsx → ScreenSettings usa las funciones reales
```

### Paso 4 — Test end-to-end (30 min)
```
1. Login como contacto@staynexapp.com
2. Ajustes → completar datos fiscales → guardar
3. Ajustes → añadir 2 trabajadores → guardar
4. Ajustes → añadir 5 artículos al catálogo → guardar
5. Verificar en Supabase que los datos están en las tablas
```

---

## Archivos clave del proyecto

| Archivo | Rol |
|---------|-----|
| `src/App.tsx` | Router principal, gestión de sesión |
| `src/types.ts` | ActivePage enum, TradeType |
| `src/lib/supabase.ts` | Cliente Supabase + todos los helpers |
| `src/components/AppDashboardView.tsx` | Panel principal (>1500 líneas) |
| `src/components/RegistroView.tsx` | Wizard de registro |
| `src/components/AdminView.tsx` | Panel admin (fercarboc@gmail.com) |
| `src/components/Header.tsx` | Navegación + botones Acceder/Registro |
| `docs/TradeFlow_Supabase_Guide.md` | Schema BD original + RLS |
| `docs/TradeFlow_Plan_Implementacion.md` | Este documento |

---

## Convenciones del proyecto

- **Prefijo tablas:** `trade_` (todas las tablas Supabase)
- **Prefijo funciones:** camelCase, verbo + entidad (`loadWorkers`, `saveQuote`, `adminUpdateOrgPlan`)
- **IDs:** uuid (gen_random_uuid())
- **Timestamps:** `timestamptz` con `DEFAULT now()`
- **Soft delete:** campo `activo boolean DEFAULT true` (no borrado físico en catálogo/trabajadores)
- **Roles trabajador:** `tecnico | instalador | comercial | administrativo`
- **Estados trabajo:** `planificado | en_curso | completado | cancelado | pendiente_material`
- **IVA default:** 21% (configurable por org)
- **Numeración:** `PRE-YYYY-NNN` presupuestos, `FAC-YYYY-NNN` facturas, `TF-YYYY-NNNN` facturas plataforma

---

*Actualizado: Mayo 2026 — TradeFlow AI*
