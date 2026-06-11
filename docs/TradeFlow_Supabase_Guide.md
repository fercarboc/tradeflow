# TrabFlow AI — Guía de Implementación Supabase

**Proyecto Supabase:** GestionDebacuPro  
**URL:** `https://dqqjaujnulutinskmqsu.supabase.co`  
**Prefijo de tablas:** `trade_`  
**Última actualización:** Junio 2026

> **Nota:** Para el análisis funcional completo de la aplicación (módulos, pantallas, flujos, permisos) ver:  
> `docs/TrabFlow_AnalisisCompleto_v3_Junio2026.md` o `public/TrabFlow_AI_AnalisisCompleto_v3_Junio2026.html`

---

## 1. Arquitectura de Base de Datos

Todas las tablas llevan el prefijo `trade_` para convivir con las tablas de otras apps dentro del mismo proyecto Supabase sin conflictos.

### Diagrama de entidades (actualizado Junio 2026)

```
auth.users
    │
    └── trade_organizations (1 por cuenta, owner_id → auth.uid())
            │
            ├── trade_clients              (CRM: clientes del instalador)
            ├── trade_quotes               (presupuestos)
            │       └── trade_quote_items  (partidas de cada presupuesto)
            ├── trade_invoices             (facturas — series F- y M-)
            │       └── trade_invoice_lines (líneas de detalle)
            ├── trade_jobs                 (trabajos planificados)
            │       ├── trade_job_workers  (asignación trabajadores)
            │       └── trade_job_photos   (fotos del trabajo)
            ├── trade_workers              (perfiles de campo — sin cuenta necesariamente)
            │       └── trade_worker_schedules (horarios)
            ├── trade_org_members          (usuarios con acceso a la app)
            │       └── trade_org_permissions (overrides de permisos por miembro)
            ├── trade_field_actions        (notas de campo del técnico)
            ├── trade_contracts            (contratos de mantenimiento)
            ├── trade_tarifas              (catálogo simple para IA y partes)
            ├── trade_catalog_products     (catálogo avanzado con variantes)
            │       └── trade_catalog_variants
            ├── trade_subscriptions        (plan SaaS: trial/active/cancelled)
            ├── trade_org_templates        (plantillas de comunicación — 8 tipos)
            ├── trade_push_subscriptions   (notificaciones push VAPID)
            ├── trade_platform_invoices    (facturas que TrabFlow emite al instalador)
            ├── trade_installer_needs      (necesidades capturadas por chatbot)
            └── trade_ai_feedback          (aprendizaje automático de precios IA)

trade_waitlist  (tabla pública, sin auth requerido)

Admin: fercarboc@gmail.com → AdminView
     ├── RPC admin_get_trade_users()           (SECURITY DEFINER, lee auth.users)
     ├── RPC admin_get_platform_invoices()     (SECURITY DEFINER)
     └── RPC admin_set_subscription_active()   (SECURITY DEFINER)
```

### Campos clave añadidos en Junio 2026

```sql
-- trade_organizations
ALTER TABLE trade_organizations ADD COLUMN IF NOT EXISTS is_onboarded boolean DEFAULT false;
ALTER TABLE trade_organizations ADD COLUMN IF NOT EXISTS iban text;
ALTER TABLE trade_organizations ADD COLUMN IF NOT EXISTS banco text;
ALTER TABLE trade_organizations ADD COLUMN IF NOT EXISTS titular_cuenta text;

-- trade_org_members
ALTER TABLE trade_org_members ADD COLUMN IF NOT EXISTS worker_profile_id uuid REFERENCES trade_workers(id);

-- trade_jobs
ALTER TABLE trade_jobs ADD COLUMN IF NOT EXISTS notas_trabajador text;
ALTER TABLE trade_jobs ADD COLUMN IF NOT EXISTS notas_trabajador_at timestamptz;
ALTER TABLE trade_jobs ADD COLUMN IF NOT EXISTS notas_trabajador_leida boolean DEFAULT false;

-- trade_invoices
ALTER TABLE trade_invoices ADD COLUMN IF NOT EXISTS factura_original_id uuid REFERENCES trade_invoices(id);

-- trade_field_actions (nueva tabla)
CREATE TABLE IF NOT EXISTS trade_field_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES trade_organizations(id),
  job_id uuid REFERENCES trade_jobs(id),
  worker_id uuid REFERENCES trade_workers(id),
  tipo text NOT NULL CHECK (tipo IN ('presupuesto_requerido','material_necesario','incidencia','consulta','otro')),
  descripcion text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_proceso','resuelto','descartado')),
  resuelto_por text,
  resuelto_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

---

## 2. SQL de Migración — Crear todas las tablas

Ejecuta este bloque en **Supabase → SQL Editor** del proyecto `dqqjaujnulutinskmqsu`.

```sql
-- =====================================================================
-- TradeFlow AI — Schema completo con prefijo trade_
-- Proyecto: GestionDebacuPro (dqqjaujnulutinskmqsu)
-- =====================================================================

-- 1. ORGANIZACIONES (empresa del instalador)
CREATE TABLE IF NOT EXISTS public.trade_organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  nif             text,
  direccion       text,
  email           text,
  telefono        text,
  oficio          text NOT NULL DEFAULT 'Fontanería',
  -- valores: 'Fontanería' | 'Electricidad' | 'Climatización / HVAC' | 'Cerrajería' | 'Otros'
  ciudad          text,
  iva_default     smallint NOT NULL DEFAULT 21,
  plan            text NOT NULL DEFAULT 'básico',
  -- valores: 'básico' | 'pro' | 'empresa'
  logo_url        text,
  is_onboarded    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id)
);

-- 2. CLIENTES CRM
CREATE TABLE IF NOT EXISTS public.trade_clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  telefono        text,
  email           text,
  direccion       text,
  ciudad          text,
  nif             text,
  notas           text,
  obras_activas   smallint NOT NULL DEFAULT 0,
  total_facturado numeric(10,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 3. PRESUPUESTOS
CREATE TABLE IF NOT EXISTS public.trade_quotes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES public.trade_clients(id) ON DELETE SET NULL,
  numero          text NOT NULL,        -- PRE-2026-001
  descripcion     text,
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  estado          text NOT NULL DEFAULT 'Borrador',
  -- valores: 'Borrador' | 'Enviado' | 'Aceptado' | 'Facturado'
  total_neto      numeric(10,2) NOT NULL DEFAULT 0,
  iva_pct         smallint NOT NULL DEFAULT 21,
  total_con_iva   numeric(10,2) GENERATED ALWAYS AS (total_neto * (1 + iva_pct::numeric/100)) STORED,
  voice_note_url  text,
  whatsapp_sent_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, numero)
);

-- 4. PARTIDAS DE PRESUPUESTO
CREATE TABLE IF NOT EXISTS public.trade_quote_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id        uuid NOT NULL REFERENCES public.trade_quotes(id) ON DELETE CASCADE,
  descripcion     text NOT NULL,
  tipo            text NOT NULL DEFAULT 'material',
  -- valores: 'material' | 'mano_de_obra'
  cantidad        numeric(8,2) NOT NULL DEFAULT 1,
  precio_unitario numeric(10,2) NOT NULL DEFAULT 0,
  total           numeric(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  posicion        smallint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 5. FACTURAS
CREATE TABLE IF NOT EXISTS public.trade_invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  quote_id        uuid REFERENCES public.trade_quotes(id) ON DELETE SET NULL,
  client_id       uuid REFERENCES public.trade_clients(id) ON DELETE SET NULL,
  numero          text NOT NULL,        -- FAC-2026-001
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento date,
  estado          text NOT NULL DEFAULT 'Pendiente',
  -- valores: 'Pendiente' | 'Pagada' | 'Vencida'
  subtotal        numeric(10,2) NOT NULL DEFAULT 0,
  iva_pct         smallint NOT NULL DEFAULT 21,
  iva_importe     numeric(10,2) GENERATED ALWAYS AS (subtotal * iva_pct::numeric/100) STORED,
  total           numeric(10,2) GENERATED ALWAYS AS (subtotal * (1 + iva_pct::numeric/100)) STORED,
  paid_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, numero)
);

-- 6. LISTA DE ESPERA (sin auth, acceso público de solo inserción)
CREATE TABLE IF NOT EXISTS public.trade_waitlist (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                text NOT NULL,
  telefono              text,
  email                 text NOT NULL,
  oficio                text,
  ciudad                text,
  presupuestos_al_mes   text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- 7. GRABACIONES DE VOZ (para IA Whisper)
CREATE TABLE IF NOT EXISTS public.trade_voice_recordings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  quote_id        uuid REFERENCES public.trade_quotes(id) ON DELETE SET NULL,
  storage_path    text NOT NULL,
  transcript      text,
  partidas_json   jsonb,    -- partidas extraídas por IA
  modelo_ia       text DEFAULT 'whisper-1',
  duration_secs   smallint,
  processed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 8. ESCANEOS FOTOGRÁFICOS (para IA visual)
CREATE TABLE IF NOT EXISTS public.trade_photo_scans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  quote_id        uuid REFERENCES public.trade_quotes(id) ON DELETE SET NULL,
  storage_path    text NOT NULL,
  detections      jsonb,    -- array de materiales detectados con precio
  modelo_ia       text DEFAULT 'gpt-4o',
  processed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- ÍNDICES para búsquedas frecuentes
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_trade_clients_org_id       ON public.trade_clients(org_id);
CREATE INDEX IF NOT EXISTS idx_trade_quotes_org_id        ON public.trade_quotes(org_id);
CREATE INDEX IF NOT EXISTS idx_trade_quotes_client_id     ON public.trade_quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_trade_quotes_estado        ON public.trade_quotes(estado);
CREATE INDEX IF NOT EXISTS idx_trade_quote_items_quote_id ON public.trade_quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_trade_invoices_org_id      ON public.trade_invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_trade_invoices_estado      ON public.trade_invoices(estado);

-- =====================================================================
-- TRIGGER: actualizar updated_at automáticamente
-- =====================================================================
CREATE OR REPLACE FUNCTION public.trade_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_trade_organizations_updated
  BEFORE UPDATE ON public.trade_organizations
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();

CREATE OR REPLACE TRIGGER trg_trade_clients_updated
  BEFORE UPDATE ON public.trade_clients
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();

CREATE OR REPLACE TRIGGER trg_trade_quotes_updated
  BEFORE UPDATE ON public.trade_quotes
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();

CREATE OR REPLACE TRIGGER trg_trade_invoices_updated
  BEFORE UPDATE ON public.trade_invoices
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();
```

---

## 3. Row Level Security (RLS)

Ejecuta este bloque **a continuación** del anterior, en el mismo SQL Editor.

```sql
-- =====================================================================
-- RLS — Row Level Security
-- =====================================================================

ALTER TABLE public.trade_organizations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_quotes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_quote_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_waitlist         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_voice_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_photo_scans      ENABLE ROW LEVEL SECURITY;

-- ---- trade_organizations ----
CREATE POLICY "Owner accede a su organización"
  ON public.trade_organizations FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ---- Helper: obtener org del usuario actual ----
-- Se usa como subquery en las políticas de tablas hijas.

-- ---- trade_clients ----
CREATE POLICY "Acceso a clientes propios"
  ON public.trade_clients FOR ALL
  USING (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));

-- ---- trade_quotes ----
CREATE POLICY "Acceso a presupuestos propios"
  ON public.trade_quotes FOR ALL
  USING (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));

-- ---- trade_quote_items ----
CREATE POLICY "Acceso a partidas propias"
  ON public.trade_quote_items FOR ALL
  USING (quote_id IN (
    SELECT q.id FROM public.trade_quotes q
    JOIN public.trade_organizations o ON q.org_id = o.id
    WHERE o.owner_id = auth.uid()
  ))
  WITH CHECK (quote_id IN (
    SELECT q.id FROM public.trade_quotes q
    JOIN public.trade_organizations o ON q.org_id = o.id
    WHERE o.owner_id = auth.uid()
  ));

-- ---- trade_invoices ----
CREATE POLICY "Acceso a facturas propias"
  ON public.trade_invoices FOR ALL
  USING (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));

-- ---- trade_waitlist: INSERT público (sin auth), SELECT solo service_role ----
CREATE POLICY "Cualquiera puede unirse a la lista de espera"
  ON public.trade_waitlist FOR INSERT
  WITH CHECK (true);

-- ---- trade_voice_recordings ----
CREATE POLICY "Acceso a grabaciones propias"
  ON public.trade_voice_recordings FOR ALL
  USING (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));

-- ---- trade_photo_scans ----
CREATE POLICY "Acceso a escaneos propios"
  ON public.trade_photo_scans FOR ALL
  USING (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));
```

---

## 4. Supabase Storage — Buckets para archivos

```sql
-- Ejecutar en SQL Editor o desde el panel Storage de Supabase
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('trade-voices', 'trade-voices', false),   -- grabaciones de voz (privado)
  ('trade-photos', 'trade-photos', false),   -- fotos de obra (privado)
  ('trade-logos',  'trade-logos',  true)     -- logos de empresa (público)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "Users upload voices to their folder"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'trade-voices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own voices"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'trade-voices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'trade-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'trade-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## 5. Configuración de Auth

En **Supabase → Authentication → Providers**, habilitar:

| Proveedor | Config |
|-----------|--------|
| **Email** | Habilitar, desactivar confirmación en desarrollo |
| **Phone (OTP SMS)** | Para instaladores con móvil (requiere Twilio o similar) |

En **Auth → Email Templates**, personalizar con branding de TradeFlow.

En **Auth → URL Configuration**:
```
Site URL:       https://www.trabflow.com
Redirect URLs:  https://www.trabflow.com/**
                http://localhost:3000/**
```

> **Importante:** Nunca usar `https://www.debacu.com` en ninguna URL de redirect. Todo apunta a `https://www.trabflow.com`.

---

## 6. Integración Web (React + Vite)

### 6.1 Instalar dependencias

```bash
cd c:\tradeflow
npm install @supabase/supabase-js
```

### 6.2 Crear archivo de cliente Supabase

Crea `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Database = {
  public: {
    Tables: {
      trade_organizations: { Row: TradeOrganization; Insert: Omit<TradeOrganization, 'id' | 'created_at' | 'updated_at'>; Update: Partial<TradeOrganization> };
      trade_clients:       { Row: TradeClient;       Insert: Omit<TradeClient, 'id' | 'created_at' | 'updated_at'>; Update: Partial<TradeClient> };
      trade_quotes:        { Row: TradeQuote;        Insert: Omit<TradeQuote, 'id' | 'created_at' | 'updated_at' | 'total_con_iva'>; Update: Partial<TradeQuote> };
      trade_quote_items:   { Row: TradeQuoteItem;    Insert: Omit<TradeQuoteItem, 'id' | 'created_at' | 'total'>; Update: Partial<TradeQuoteItem> };
      trade_invoices:      { Row: TradeInvoice;      Insert: Omit<TradeInvoice, 'id' | 'created_at' | 'updated_at' | 'iva_importe' | 'total'>; Update: Partial<TradeInvoice> };
      trade_waitlist:      { Row: TradeWaitlist;     Insert: Omit<TradeWaitlist, 'id' | 'created_at'>; Update: never };
    };
  };
};

// Tipos espejo de la base de datos
export interface TradeOrganization {
  id: string; owner_id: string; nombre: string; nif?: string;
  direccion?: string; email?: string; telefono?: string;
  oficio: string; ciudad?: string; iva_default: number;
  plan: string; logo_url?: string; is_onboarded: boolean;
  created_at: string; updated_at: string;
}
export interface TradeClient {
  id: string; org_id: string; nombre: string; telefono?: string;
  email?: string; direccion?: string; ciudad?: string; nif?: string;
  notas?: string; obras_activas: number; total_facturado: number;
  created_at: string; updated_at: string;
}
export interface TradeQuote {
  id: string; org_id: string; client_id?: string; numero: string;
  descripcion?: string; fecha: string;
  estado: 'Borrador' | 'Enviado' | 'Aceptado' | 'Facturado';
  total_neto: number; iva_pct: number; total_con_iva: number;
  voice_note_url?: string; whatsapp_sent_at?: string;
  created_at: string; updated_at: string;
}
export interface TradeQuoteItem {
  id: string; quote_id: string; descripcion: string;
  tipo: 'material' | 'mano_de_obra'; cantidad: number;
  precio_unitario: number; total: number; posicion: number;
  created_at: string;
}
export interface TradeInvoice {
  id: string; org_id: string; quote_id?: string; client_id?: string;
  numero: string; fecha: string; fecha_vencimiento?: string;
  estado: 'Pendiente' | 'Pagada' | 'Vencida';
  subtotal: number; iva_pct: number; iva_importe: number; total: number;
  paid_at?: string; created_at: string; updated_at: string;
}
export interface TradeWaitlist {
  id: string; nombre: string; telefono?: string; email: string;
  oficio?: string; ciudad?: string; presupuestos_al_mes?: string;
  created_at: string;
}
```

### 6.3 Archivo `.env` en la raíz del proyecto web

Crea `c:\tradeflow\.env`:

```env
VITE_SUPABASE_URL=https://dqqjaujnulutinskmqsu.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxcWphdWpudWx1dGluc2ttcXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NzA1NTYsImV4cCI6MjA4MDQ0NjU1Nn0.bszEj5MKqZgG4B_TqllE7ijxrcV9JinFXeMIaP1ljOw
```

> **NUNCA** subas `.env` a git. Añade `.env` a `.gitignore`.

### 6.4 Conectar lista de espera (ContactoView)

Sustituir el `localStorage` de `ContactoView.tsx` por Supabase:

```typescript
import { supabase } from '../lib/supabase';

// En el handleSubmit del formulario:
const { error } = await supabase
  .from('trade_waitlist')
  .insert({
    nombre: formData.nombre,
    telefono: formData.telefono,
    email: formData.email,
    oficio: formData.oficio,
    ciudad: formData.ciudad,
    presupuestos_al_mes: formData.presupuestosAlMes,
  });

if (error) throw error;
setSubmitted(true);
```

---

## 7. Integración Móvil (Expo React Native)

### 7.1 Instalar dependencias

```bash
cd c:\tradeflow\mobile
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
```

### 7.2 Actualizar `mobile/lib/supabase.ts`

```typescript
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### 7.3 Archivo `mobile/.env`

```env
EXPO_PUBLIC_SUPABASE_URL=https://dqqjaujnulutinskmqsu.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxcWphdWpudWx1dGluc2ttcXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NzA1NTYsImV4cCI6MjA4MDQ0NjU1Nn0.bszEj5MKqZgG4B_TqllE7ijxrcV9JinFXeMIaP1ljOw
```

---

## 8. Patrones de Uso — Ejemplos Clave

### Crear organización tras el primer login

```typescript
// Llamar en el onboarding tras auth.signUp()
async function createOrganization(data: {
  nombre: string; oficio: string; ciudad: string; telefono: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No auth');

  const { data: org, error } = await supabase
    .from('trade_organizations')
    .insert({ owner_id: user.id, ...data })
    .select()
    .single();

  if (error) throw error;
  return org;
}
```

### Guardar un presupuesto con sus partidas

```typescript
async function saveQuote(orgId: string, quote: {
  clientId: string;
  descripcion: string;
  partidas: Array<{ descripcion: string; tipo: string; cantidad: number; precioUnitario: number }>;
}) {
  // 1. Generar número de presupuesto
  const { count } = await supabase
    .from('trade_quotes')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId);

  const numero = `PRE-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`;
  const totalNeto = quote.partidas.reduce((s, p) => s + p.cantidad * p.precioUnitario, 0);

  // 2. Insertar presupuesto
  const { data: newQuote, error: qErr } = await supabase
    .from('trade_quotes')
    .insert({
      org_id: orgId,
      client_id: quote.clientId,
      numero,
      descripcion: quote.descripcion,
      total_neto: totalNeto,
      estado: 'Borrador',
    })
    .select()
    .single();

  if (qErr) throw qErr;

  // 3. Insertar partidas
  const items = quote.partidas.map((p, i) => ({
    quote_id: newQuote.id,
    descripcion: p.descripcion,
    tipo: p.tipo,
    cantidad: p.cantidad,
    precio_unitario: p.precioUnitario,
    posicion: i,
  }));

  const { error: iErr } = await supabase.from('trade_quote_items').insert(items);
  if (iErr) throw iErr;

  return newQuote;
}
```

### Cargar dashboard con datos reales

```typescript
async function loadDashboardData(orgId: string) {
  const [quotesRes, invoicesRes, clientsRes] = await Promise.all([
    supabase.from('trade_quotes').select('*, trade_quote_items(*)').eq('org_id', orgId).order('created_at', { ascending: false }),
    supabase.from('trade_invoices').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    supabase.from('trade_clients').select('*').eq('org_id', orgId).order('nombre'),
  ]);

  return {
    quotes:   quotesRes.data  ?? [],
    invoices: invoicesRes.data ?? [],
    clients:  clientsRes.data  ?? [],
  };
}
```

### Convertir presupuesto a factura

```typescript
async function convertToInvoice(quote: TradeQuote, orgId: string) {
  const { count } = await supabase
    .from('trade_invoices')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId);

  const numero = `FAC-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  // Crear factura
  const { error: invErr } = await supabase.from('trade_invoices').insert({
    org_id: orgId,
    quote_id: quote.id,
    client_id: quote.client_id,
    numero,
    subtotal: quote.total_neto,
    iva_pct: quote.iva_pct,
    fecha_vencimiento: dueDate.toISOString().split('T')[0],
  });

  if (invErr) throw invErr;

  // Actualizar estado del presupuesto
  await supabase.from('trade_quotes').update({ estado: 'Facturado' }).eq('id', quote.id);
}
```

---

## 9. Edge Functions (IA y WhatsApp)

Estas funciones se desplegarían en Supabase Edge Functions para mantener secretos fuera del cliente.

### Estructura sugerida

```
supabase/functions/
├── trade-voice-to-quote/   # Whisper → partidas de presupuesto
├── trade-photo-to-quote/   # GPT-4o Vision → materiales detectados
└── trade-whatsapp-send/    # WhatsApp Business API → envío de presupuesto
```

### `trade-voice-to-quote/index.ts` (esqueleto)

```typescript
import { serve } from 'https://deno.land/std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { voiceStoragePath, quoteId, orgId } = await req.json();

  // 1. Descargar audio desde Storage
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: audioFile } = await supabase.storage.from('trade-voices').download(voiceStoragePath);

  // 2. Transcribir con OpenAI Whisper
  const formData = new FormData();
  formData.append('file', audioFile!, 'audio.m4a');
  formData.append('model', 'whisper-1');
  formData.append('language', 'es');
  const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
    body: formData,
  });
  const { text: transcript } = await whisperRes.json();

  // 3. Extraer partidas con Claude/GPT
  // ... llamada a LLM con prompt de extracción de presupuesto ...

  // 4. Guardar en base de datos
  await supabase.from('trade_voice_recordings').update({
    transcript,
    processed_at: new Date().toISOString(),
  }).eq('quote_id', quoteId);

  return new Response(JSON.stringify({ transcript, partidas: [] }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

---

## 10. Checklist de Despliegue

### Fase 1 — Infraestructura (ahora)
- [ ] Ejecutar SQL de migración en Supabase SQL Editor
- [ ] Verificar RLS con `SELECT * FROM trade_organizations` como anon (debe devolver 0 filas)
- [ ] Crear buckets `trade-voices`, `trade-photos`, `trade-logos`
- [ ] Configurar Auth providers (Email, posiblemente Phone OTP)
- [ ] Añadir `.env` en `c:\tradeflow\.env` y `c:\tradeflow\mobile\.env`
- [ ] Añadir `.env` a `.gitignore`

### Fase 2 — Web App (conectar datos reales)
- [ ] Instalar `@supabase/supabase-js` en el proyecto web
- [ ] Crear `src/lib/supabase.ts`
- [ ] Conectar `ContactoView` (lista de espera → `trade_waitlist`)
- [ ] Añadir auth básica (login/registro) al `AppDashboardView`
- [ ] Cargar datos reales en lugar de mock data en el dashboard

### Fase 3 — App Móvil
- [ ] Instalar dependencias Supabase en `mobile/`
- [ ] Actualizar `mobile/lib/supabase.ts` con cliente real
- [ ] Implementar flujo login → onboarding → dashboard con datos reales
- [ ] Conectar wizard de presupuestos a `saveQuote()`
- [ ] Subir grabaciones de voz a bucket `trade-voices`

### Fase 4 — IA y WhatsApp
- [ ] Crear Edge Functions (`trade-voice-to-quote`, `trade-photo-to-quote`)
- [ ] Configurar secretos en Supabase: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- [ ] Integrar WhatsApp Business API (Cloud API de Meta)
- [ ] Desplegar y probar con datos reales

---

## 11. Costes Estimados (proyecto compartido)

Al usar el proyecto `GestionDebacuPro` existente se ahorran los ~$25/mes del plan Pro.

| Recurso | Coste extra estimado |
|---------|----------------------|
| Almacenamiento DB (tablas trade_*) | ~0€ (dentro del plan actual) |
| Storage (voces + fotos) | ~$0.021/GB — 10GB ≈ $0.21/mes |
| Edge Functions (IA) | $2/millón de invocaciones |
| Auth (usuarios) | Gratis hasta 50.000 MAU |
| **Total adicional estimado** | **< $5/mes para fase beta** |

---

## 12. Credenciales del Proyecto

| Variable | Valor |
|----------|-------|
| `SUPABASE_URL` | `https://dqqjaujnulutinskmqsu.supabase.co` |
| `ANON_KEY` | Ver `.env` (clave pública, segura en cliente) |
| `Publishable Key` | `sb_publishable_zBV91sZrTnbE51xGRDD_FA_en0fi7op` |
| `Service Role Key` | En Supabase Dashboard → Settings → API (¡NUNCA al cliente!) |

---

---

## 13. Panel de Administración — F4 (AdminView)

Accesible solo para `fercarboc@gmail.com`. Se carga automáticamente al hacer login con ese email.

### 13.1 Tablas nuevas

#### `trade_subscriptions`
```sql
CREATE TABLE trade_subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  plan                  text NOT NULL DEFAULT 'pro',
  -- 'basico' | 'pro' | 'empresa'
  billing_cycle         text NOT NULL DEFAULT 'monthly',
  -- 'monthly' | 'yearly'
  status                text NOT NULL DEFAULT 'trial',
  -- 'trial' | 'active' | 'cancelled' | 'expired'
  trial_start           timestamptz NOT NULL DEFAULT now(),
  trial_end             timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  stripe_customer_id    text,
  stripe_subscription_id text,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  cancelled_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
```

#### `trade_platform_invoices`
Facturas que TradeFlow emite al instalador (generadas por Stripe o manualmente).
```sql
CREATE TABLE trade_platform_invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  period_start      date NOT NULL,
  period_end        date NOT NULL,
  amount_cents      integer NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'draft',
  -- 'draft' | 'sent' | 'paid'
  stripe_invoice_id text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trade_platform_invoices ENABLE ROW LEVEL SECURITY;
-- Acceso solo vía RPC SECURITY DEFINER (no hay política directa para usuarios normales)
```

#### Campos extra en `trade_organizations`
```sql
ALTER TABLE trade_organizations
  ADD COLUMN IF NOT EXISTS force_password_change boolean NOT NULL DEFAULT false;
```

### 13.2 RPCs SECURITY DEFINER (para el admin)

```sql
-- Lee auth.users y cruza con trade_organizations
CREATE OR REPLACE FUNCTION admin_get_trade_users()
RETURNS TABLE (org_id uuid, auth_email text, email_confirmed boolean,
               last_sign_in timestamptz, user_created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT o.id, u.email, u.email_confirmed_at IS NOT NULL,
         u.last_sign_in_at, u.created_at
  FROM auth.users u
  JOIN public.trade_organizations o ON o.owner_id = u.id;
$$;

-- Lee trade_platform_invoices (sin exponer la tabla directamente)
CREATE OR REPLACE FUNCTION admin_get_platform_invoices()
RETURNS SETOF trade_platform_invoices
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM trade_platform_invoices ORDER BY created_at DESC; $$;

-- Activa/cancela una suscripción
CREATE OR REPLACE FUNCTION admin_set_subscription_active(p_org_id uuid, p_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE trade_subscriptions
  SET status = CASE WHEN p_active THEN 'active' ELSE 'cancelled' END,
      updated_at = now()
  WHERE org_id = p_org_id;
END;
$$;

-- Los tres solo accesibles por authenticated (la verificación de email admin se hace en el cliente)
GRANT EXECUTE ON FUNCTION admin_get_trade_users() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_platform_invoices() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_subscription_active(uuid, boolean) TO authenticated;
```

### 13.3 Funciones frontend — `src/lib/supabase.ts`

| Función | Descripción |
|---|---|
| `getAdminOrgs()` | Todas las orgs con suscripción + stats auth (quotes, clients) |
| `adminUpdateOrgPlan(orgId, plan, cycle)` | Cambia plan en org + suscripción |
| `adminExtendTrial(orgId, days)` | Extiende `trial_end` desde la fecha actual |
| `adminCreateInstaller(params)` | Llama edge function `trade-admin-create-installer` |
| `adminSendPasswordReset(email)` | Envía email de reset vía Supabase Auth |
| `adminSetPassword(userIdOrEmail, pwd)` | Llama edge function `trade-admin-set-password` |
| `setSubscriptionActive(orgId, active)` | RPC `admin_set_subscription_active` |
| `loadAdminStats()` | Alias de `getAdminOrgs()` → `{ orgs, subscriptions }` |
| `loadPlatformInvoices()` | RPC `admin_get_platform_invoices` |

### 13.4 Componente `src/components/AdminView.tsx`

- **Acceso:** solo `session.user.email === 'fercarboc@gmail.com'`; cualquier otro ve "Acceso denegado"
- **Enrutamiento:** `App.tsx` detecta el email admin en `onAuthStateChange` y setea `ActivePage.Admin`

**Secciones:**

| Tab | Contenido |
|---|---|
| **Clientes** | Stats (total, en prueba, activos, MRR). Tabla: empresa, email, oficio, uso (presupuestos/clientes), plan editable, estado, último acceso, alta. Acciones: Reset pwd, Pwd, ON/OFF suscripción, Link Stripe Checkout, Portal Stripe, Email |
| **Facturas plataforma** | Tabla `trade_platform_invoices`: organización, periodo, importe, estado (Borrador/Enviada/Pagada), Stripe invoice ID |

**Modales:**
- **Cambiar contraseña**: input directo → edge function `trade-admin-set-password`
- **Extender prueba**: botones +7/+15/+30/+60/+90 días → `adminExtendTrial()`
- **Nuevo instalador**: formulario completo → edge function `trade-admin-create-installer`

---

## 14. Integración Stripe — F4 Resto

### 14.1 Edge Functions desplegadas

| Función | JWT | URL |
|---|---|---|
| `trade-stripe-webhook` | ❌ (firma HMAC propia) | `https://dqqjaujnulutinskmqsu.supabase.co/functions/v1/trade-stripe-webhook` |
| `trade-stripe-portal` | ✓ | `https://dqqjaujnulutinskmqsu.supabase.co/functions/v1/trade-stripe-portal` |
| `trade-stripe-checkout` | ✓ | `https://dqqjaujnulutinskmqsu.supabase.co/functions/v1/trade-stripe-checkout` |

### 14.2 trade-stripe-webhook

Registrar esta URL en **Stripe Dashboard → Developers → Webhooks**.

Eventos manejados:

| Evento Stripe | Acción en DB |
|---|---|
| `invoice.paid` | `trade_subscriptions.status = 'active'`, crea fila en `trade_platform_invoices` con `status='paid'` |
| `customer.subscription.deleted` | `trade_subscriptions.status = 'cancelled'` |
| `invoice.payment_failed` | `trade_subscriptions.status = 'expired'` |

La verificación de firma usa **HMAC-SHA256 con Web Crypto API** (nativo en Deno, sin dependencia del SDK de Stripe). Rechaza webhooks con timestamp > 5 minutos.

Cuerpo del fichero: `supabase/functions/trade-stripe-webhook/index.ts`

### 14.3 trade-stripe-portal

Genera una sesión de Stripe Billing Portal para un `org_id`.

- Requiere que la org tenga `stripe_customer_id` en `trade_subscriptions`
- Devuelve `{ url: string }` — el admin abre esa URL o la reenvía al cliente

### 14.4 trade-stripe-checkout

Genera una Stripe Checkout Session para iniciar o cambiar suscripción.

- Si la org no tiene `stripe_customer_id`, crea el cliente en Stripe automáticamente y lo guarda en `trade_subscriptions`
- Lee los Price IDs desde variables de entorno (`STRIPE_PRICE_*`)
- Devuelve `{ url: string }`

### 14.5 Secrets a configurar en Supabase

**Supabase Dashboard → Edge Functions → Secrets** (o `supabase secrets set`):

| Variable | Valor | Dónde obtenerlo |
|---|---|---|
| `STRIPE_TRABFLOW_SECRET_KEY` | `sk_live_…` o `sk_test_…` | Stripe Dashboard → Developers → API Keys (**ya creado**) |
| `STRIPE_WEBHOOK_TRABFLOW_SECRET` | `whsec_…` | Stripe Dashboard → Webhooks → signing secret |

```bash
supabase secrets set STRIPE_WEBHOOK_TRABFLOW_SECRET=whsec_... --project-ref dqqjaujnulutinskmqsu
```

**URL del webhook a registrar en Stripe Dashboard:**
```
https://dqqjaujnulutinskmqsu.supabase.co/functions/v1/trade-stripe-webhook
```

> Los price IDs **no son secrets** — se almacenan en `trade_stripe_prices` (ver sección 14.5b).

### 14.5b Tabla `trade_stripe_prices` — price IDs en BD

Los price IDs se guardan en la BD para poder actualizarlos sin redesplegar la edge function.

```sql
-- Ver precios actuales
SELECT plan, billing_cycle, stripe_price_id, active FROM trade_stripe_prices ORDER BY plan, billing_cycle;

-- Actualizar un precio (ej: si Stripe cambia el ID)
UPDATE trade_stripe_prices
SET stripe_price_id = 'price_NUEVO', updated_at = now()
WHERE plan = 'pro' AND billing_cycle = 'monthly';

-- Desactivar un precio (la función devuelve error si no hay precio activo)
UPDATE trade_stripe_prices SET active = false WHERE plan = 'basico' AND billing_cycle = 'yearly';
```

**Precios actuales insertados (Mayo 2026):**

| Plan | Ciclo | Stripe Price ID |
|---|---|---|
| basico | monthly | `price_1TbM5hEBDOoWck8qntzTr07R` |
| basico | yearly | `price_1TbM6WEBDOoWck8qQcuCnVXs` |
| pro | monthly | `price_1TbM7dEBDOoWck8qxIysJ08O` |
| pro | yearly | `price_1TbM87EBDOoWck8qdX25uwfX` |
| empresa | monthly | `price_1TbM91EBDOoWck8qWhtbNz9r` |
| empresa | yearly | `price_1TbM9QEBDOoWck8ql0CSkHfH` |

### 14.6 Precios configurados en la app

Definidos en `AdminView.tsx` y usados para calcular el MRR estimado:

| Plan | Mensual | Anual (por mes) |
|---|---|---|
| Básico | 29 €/mes | 23 €/mes |
| Pro | 49 €/mes | 39 €/mes |
| Empresa | 89 €/mes | 71 €/mes |

### 14.7 Funciones frontend para Stripe — `src/lib/supabase.ts`

```typescript
// Genera URL del portal de cliente (admin lo abre o lo copia para el instalador)
getStripePortalUrl(orgId: string): Promise<string>

// Genera URL de Stripe Checkout (admin copia el link y lo manda al instalador)
getStripeCheckoutUrl(orgId: string, plan?: string, billingCycle?: string): Promise<string>
```

### 14.8 Flujo completo de activación de pago

```
Admin (AdminView)
  └─ pulsa "Link" (botón violeta) → getStripeCheckoutUrl(org_id)
       └─ edge function trade-stripe-checkout
            ├─ crea/reutiliza Stripe Customer
            ├─ crea Checkout Session con el Price ID del plan
            └─ devuelve URL de Checkout
  └─ copia URL → envía al instalador por email/WhatsApp

Instalador
  └─ abre URL → rellena tarjeta en Stripe
       └─ Stripe llama a trade-stripe-webhook con evento invoice.paid
            ├─ trade_subscriptions.status → 'active'
            └─ trade_platform_invoices → nueva fila con status='paid'
```

### 14.9 Archivos modificados / creados (Stripe)

| Archivo | Cambio |
|---|---|
| `supabase/functions/trade-stripe-webhook/index.ts` | NUEVO — webhook handler |
| `supabase/functions/trade-stripe-portal/index.ts` | NUEVO — portal session |
| `supabase/functions/trade-stripe-checkout/index.ts` | NUEVO — checkout session |
| `src/lib/supabase.ts` | Añadidas: `getStripePortalUrl`, `getStripeCheckoutUrl` |
| `src/components/AdminView.tsx` | Añadidos: botón "Link" (checkout) y botón "Portal" por fila |

---

## 15. Checklist F4 — Admin + Stripe

### Infraestructura (ya aplicado)
- [x] Tabla `trade_subscriptions` creada con RLS
- [x] Tabla `trade_platform_invoices` creada con RLS
- [x] Campo `force_password_change` en `trade_organizations`
- [x] RPCs `admin_get_trade_users`, `admin_get_platform_invoices`, `admin_set_subscription_active`
- [x] Edge function `trade-stripe-webhook` desplegada (sin JWT, auth por firma)
- [x] Edge function `trade-stripe-portal` desplegada (con JWT)
- [x] Edge function `trade-stripe-checkout` desplegada (con JWT)
- [x] Edge function `trade-admin-set-password` desplegada
- [x] Edge function `trade-admin-create-installer` desplegada

### Configuración completada ✅

- [x] `STRIPE_TRABFLOW_SECRET_KEY` en Supabase Secrets
- [x] `STRIPE_WEBHOOK_TRABFLOW_SECRET` en Supabase Secrets
- [x] 6 price IDs insertados en `trade_stripe_prices`
- [x] Webhook registrado en Stripe Dashboard — URL: `https://dqqjaujnulutinskmqsu.supabase.co/functions/v1/trade-stripe-webhook`
- [x] Eventos Stripe activos: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
- [ ] Probar flujo completo en modo test (Stripe CLI: `stripe listen --forward-to ...`)

### Verificación rápida
```bash
# Probar webhook local con Stripe CLI
stripe listen --forward-to https://dqqjaujnulutinskmqsu.supabase.co/functions/v1/trade-stripe-webhook

# Simular pago de factura
stripe trigger invoice.paid
```

---

## 16. CRM — Solicitudes Beta + Precios

### 16.1 BD: Migración `crm_waitlist_and_lead_id`

**Columnas añadidas a `trade_waitlist`:**

| Columna | Tipo | Default | Valores |
|---|---|---|---|
| `estado` | text | `'nuevo'` | nuevo, contactado, interesado, beta_activa, convertido, descartado |
| `notas` | text | null | texto libre |
| `fuente` | text | `'landing'` | landing, manual, referido… |
| `prioridad` | text | `'media'` | alta, media, baja |
| `contacted_at` | timestamptz | null | — |
| `converted_at` | timestamptz | null | — |

**Columna añadida a `trade_organizations`:** `lead_id uuid REFERENCES trade_waitlist(id) ON DELETE SET NULL` — trazabilidad lead → instalador.

**Políticas RLS `trade_waitlist`:** anon INSERT (ya existía) + authenticated admin SELECT/UPDATE/DELETE con `auth.email() = 'fercarboc@gmail.com'`.

**RPC nueva:** `admin_get_waitlist_leads()` — SECURITY DEFINER, devuelve leads ordenados por prioridad y fecha.

### 16.2 supabase.ts — Helpers CRM

| Función | Descripción |
|---|---|
| `adminLoadWaitlist()` | Llama al RPC, devuelve `TradeWaitlistLead[]` |
| `adminUpdateWaitlistLead(id, updates)` | UPDATE waitlist (RLS bloquea a no-admin) |
| `adminDeleteWaitlistLead(id)` | DELETE por id |
| `adminConvertLeadToInstaller(lead, params)` | Crea instalador via edge function → actualiza lead a `convertido` → vincula `lead_id` en la organización |

Tipos exportados: `TradeWaitlistLead`, `WaitlistEstado`, `WaitlistPrioridad`.

### 16.3 AdminView — Pestaña "Solicitudes beta"

- **3ª pestaña** con badge rojo del número de leads nuevos
- **7 KPIs:** total, nuevos, contactados, beta activa, convertidos, tasa lead→beta, tasa beta→pago
- **Filtros:** texto, estado, oficio, prioridad
- **Acciones por fila:** estado editable, prioridad editable, WhatsApp prellenado, email, nota, convertir, descartar, eliminar
- **Modales top-level** (sin focus-loss en inputs): `SetPwdModal`, `ExtendTrialModal`, `NewInstallerModal`, `LeadNoteModal`, `LeadConvertModal`
- **Error email duplicado:** detecta "already registered" y muestra mensaje UX claro con instrucciones, en lugar de error técnico

### 16.4 PreciosView — Correcciones

| Campo | Antes | Después |
|---|---|---|
| Básico usuarios | "1 usuario" | "1 usuario" (sin cambio) — features: hasta 30 PDF/mes, sin agenda |
| Profesional usuarios | "3-5 usuarios" | "1 usuario" — features: ilimitados + agenda y planificación |
| Empresa usuarios | "6-10 usuarios" | "Hasta 5 usuarios" — features: + estadísticas + contratos mantenimiento |
| Badge anual | "-20%" | "2 MESES GRATIS" |
| Precio anual (big) | precio mensual descontado | total anual = mensual × 10 (ej. 290€/año) |
| Precio anual (small) | — | equivalente mensual (ej. 24€/mes · facturado anualmente) |

### 16.5 Flujo CRM completo

```
Landing → formulario → INSERT trade_waitlist (anon)
    ↓
Admin → Solicitudes beta → filtrar → priorizar
    ↓
WhatsApp / Email → marcar 'contactado' (auto contacted_at)
    ↓ (seguimiento)
'interesado' → 'beta_activa'
    ↓
"Convertir" → LeadConvertModal → adminConvertLeadToInstaller()
    → edge function trade-admin-create-installer
    → trade_organizations.lead_id = lead.id
    → trade_waitlist.estado = 'convertido', converted_at = now()
    ↓
Admin → Clientes → gestionar plan / trial / Stripe
```

### 16.6 Checklist CRM

- [x] Migración `crm_waitlist_and_lead_id` aplicada en prod
- [x] Columnas CRM en `trade_waitlist`
- [x] `lead_id` en `trade_organizations`
- [x] RLS admin para SELECT/UPDATE/DELETE en waitlist
- [x] RPC `admin_get_waitlist_leads()` con SECURITY DEFINER
- [x] Helpers supabase.ts: adminLoadWaitlist, adminUpdateWaitlistLead, adminDeleteWaitlistLead, adminConvertLeadToInstaller
- [x] AdminView: pestaña "Solicitudes beta" con CRM completo
- [x] 7 KPIs de conversión
- [x] Filtros: estado + oficio + prioridad + texto
- [x] WhatsApp con mensaje prellenado
- [x] Detección email duplicado con UX claro
- [x] Modales top-level (sin focus-loss)
- [x] PreciosView: planes corregidos + facturación anual 10 meses
- [ ] Prueba manual: enviar lead desde landing → ver en admin → convertir

---

## 17. Flujo de Autenticación Completo — Invitaciones y Reset Password

> Implementado en Mayo 2026. El proyecto es **Vite + React SPA** (no Next.js). Todo el flujo se gestiona leyendo `window.location` al cargar y navegando con el estado de `ActivePage`.

### 17.1 Archivos creados

| Archivo | Ruta URL que maneja |
|---|---|
| `src/components/auth/LoginView.tsx` | `/login` |
| `src/components/auth/AuthActivateView.tsx` | `/auth/activate?token_hash=X&type=invite` |
| `src/components/auth/AuthCallbackView.tsx` | `/auth/callback?code=X` (PKCE) |
| `src/components/auth/AuthResetPasswordView.tsx` | `/auth/reset-password` |
| `src/components/auth/UpdatePasswordView.tsx` | `/update-password` |
| `vercel.json` | SPA routing: redirige todas las rutas a `index.html` |

### 17.2 Archivos modificados

| Archivo | Qué se añadió |
|---|---|
| `src/types.ts` | Valores `Login`, `AuthActivate`, `AuthCallback`, `AuthResetPassword`, `UpdatePassword` en el enum `ActivePage` |
| `src/App.tsx` | `detectAuthRoute()` — lee `window.location.pathname` al cargar. `AUTH_FLOW_PAGES` Set — evita que `routeSession` sobreescriba una página de auth en curso. Manejo explícito del evento `PASSWORD_RECOVERY` en `onAuthStateChange`. |

### 17.3 Flujo Invite (email de invitación)

```
Admin crea instalador → Supabase envía email con:
https://www.trabflow.com/auth/activate?token_hash=XXX&type=invite&org_id=YYY

Vercel sirve index.html (por vercel.json rewrite)
    ↓
App.tsx detecta pathname === '/auth/activate'
    → setCurrentPage(ActivePage.AuthActivate)
    ↓
AuthActivateView monta → lee token_hash + type de URLSearchParams
    → supabase.auth.verifyOtp({ token_hash, type: 'invite' })
    → sesión creada → onAuthStateChange SIGNED_IN
    → (AUTH_FLOW_PAGES guard impide navegar a AppDashboard)
    → setCurrentPage(ActivePage.UpdatePassword)
    ↓
UpdatePasswordView → formulario nueva contraseña + confirmar
    → supabase.auth.updateUser({ password })
    → setCurrentPage(ActivePage.AppDashboard)
```

### 17.4 Flujo Reset Password

```
Usuario en /auth/reset-password → introduce email
    → supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://www.trabflow.com/update-password'
      })
    → Supabase envía email con enlace

Usuario hace clic → llega a /update-password
    → App.tsx detecta pathname === '/update-password'
    → setCurrentPage(ActivePage.UpdatePassword)

UpdatePasswordView → comprueba sesión existente
  Si no hay sesión: escucha onAuthStateChange hasta PASSWORD_RECOVERY
    (App.tsx también lo intercepta y navega a UpdatePassword)
    → formulario contraseña → supabase.auth.updateUser({ password })
    → AppDashboard
```

### 17.5 Flujo Callback PKCE

```
URL: /auth/callback?code=XXXX
    ↓
AuthCallbackView → supabase.auth.exchangeCodeForSession(code)
    → sesión creada
    → si type=recovery → UpdatePassword
    → si type=invite   → UpdatePassword
    → else             → AppDashboard
```

### 17.6 Guard AUTH_FLOW_PAGES (App.tsx)

Cuando el usuario llega a una URL de auth y Supabase dispara `SIGNED_IN` (tras `verifyOtp` o `exchangeCodeForSession`), el `onAuthStateChange` llamaría a `routeSession` que normalmente navega al dashboard. Para evitar esto:

```typescript
// Páginas que gestionan su propia navegación
const AUTH_FLOW_PAGES = new Set<ActivePage>([
  ActivePage.AuthActivate,
  ActivePage.AuthCallback,
  ActivePage.UpdatePassword,
]);

// En routeSession:
if (AUTH_FLOW_PAGES.has(currentPageRef.current)) {
  setSession(s); // actualiza sesión pero NO navega
  return;
}
```

### 17.7 Evento PASSWORD_RECOVERY

Cuando el enlace de reset contiene el token en el hash (`#access_token=...&type=recovery`), Supabase JS lo procesa automáticamente y dispara `PASSWORD_RECOVERY` en `onAuthStateChange`. App.tsx lo captura directamente:

```typescript
if (event === 'PASSWORD_RECOVERY') {
  setSession(s);
  setCurrentPage(ActivePage.UpdatePassword);
  return;
}
```

### 17.8 vercel.json — SPA Routing

Para que Vercel sirva `index.html` en rutas como `/auth/activate`, `/update-password`, etc.:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Sin esto, Vercel devuelve 404 en esas rutas porque no hay archivos estáticos en esas paths.

### 17.9 Configuración Supabase requerida

**Authentication → URL Configuration:**
```
Site URL:       https://www.trabflow.com
Redirect URLs:  https://www.trabflow.com/**
                http://localhost:3000/**
```

**Email Templates** — verificar que las plantillas usan `{{ .ConfirmationURL }}` y que apuntan a las URLs correctas:

- **Invite**: `https://www.trabflow.com/auth/activate?token_hash={{ .TokenHash }}&type=invite`
- **Reset password**: `https://www.trabflow.com/update-password` (vía `redirectTo` en el código)

### 17.10 Checklist Auth Flow

- [x] `vercel.json` con SPA rewrite creado
- [x] `src/types.ts` — 5 nuevos `ActivePage` para auth
- [x] `src/App.tsx` — `detectAuthRoute()`, guard `AUTH_FLOW_PAGES`, evento `PASSWORD_RECOVERY`
- [x] `LoginView.tsx` — email/password, errores en español, links a registro y reset
- [x] `AuthActivateView.tsx` — `verifyOtp`, loading/success/error, redirect a UpdatePassword
- [x] `AuthCallbackView.tsx` — PKCE `exchangeCodeForSession`, `verifyOtp` por token_hash, timeout fallback
- [x] `AuthResetPasswordView.tsx` — solicitud de reset, estado "enviado", link de retorno
- [x] `UpdatePasswordView.tsx` — barra de fortaleza, show/hide, validación, estados: loading/form/success/no-session
- [ ] Verificar en Supabase Dashboard: Site URL = `https://www.trabflow.com`
- [ ] Verificar en Supabase Dashboard: Redirect URLs incluyen `https://www.trabflow.com/**`
- [ ] Prueba manual: crear usuario → recibir email → clic → activate → set password → dashboard
- [ ] Prueba manual: reset password → email → clic → update password → dashboard

*Actualizado por Claude Code — TradeFlow AI — Mayo 2026 (F4: Admin Panel + Stripe)*

---

## 18. Mobile Worker View — ScreenWorkerView

### 18.1 Descripción general

`src/components/ScreenWorkerView.tsx` es la vista principal para trabajadores en móvil. Diseñada como PWA instalable con todas las funciones que un técnico necesita en campo.

### 18.2 Funcionalidades implementadas

| Feature | Estado | Descripción |
|---------|--------|-------------|
| Ver trabajos propios del día | ✅ | Lista con filtros por estado |
| Iniciar / Completar trabajo | ✅ | Actualización de estado con timestamp |
| Pendiente material | ✅ | Estado especial con nota |
| Link Google Maps por trabajo | ✅ | Abre Maps con la dirección |
| Notas de cierre | ✅ | Texto libre al completar |
| Crear nuevo trabajo | ✅ | FAB "+" → bottom sheet con form |
| Subir/capturar foto de la obra | ✅ | `<input capture="environment">` → Supabase Storage |
| Vista ruta del día | ✅ | TodaySummary + próxima parada |
| Editar trabajo | ✅ | EditJobModal (fecha, hora, descripción) |
| Ver todos los trabajos de la org | ✅ | Tab "Todos" para rol admin |
| Asignar trabajadores | ✅ | WorkerPickerModal |
| Filtrar por estado | ✅ | Filter pills |
| Vista semana | ✅ | WeekStrip toggle en header |
| Eliminar trabajo | ✅ | Inline confirm + handleDeleteJob |
| Notificaciones push | ✅ | Bell icon toggle en header |

### 18.3 Arquitectura de componentes

**Regla crítica:** Todos los sub-componentes se definen a nivel de módulo (fuera del componente padre). Definirlos dentro causa re-mount en cada render y pérdida de foco en inputs.

```typescript
// ✅ Correcto — nivel de módulo
const DAY_ABBR = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function getWeekDays(weekOffset: number): string[] { ... }

function WeekStrip({ weekOffset, selectedDay, onSelectDay, onPrevWeek, onNextWeek, jobs }: WeekStripProps) {
  // 7-day tile navigator con dots de estado
}

// ❌ Incorrecto — dentro del padre
function ScreenWorkerView() {
  const WeekStrip = () => { ... }  // Re-mount en cada render
}
```

### 18.4 Vista semana (WeekStrip)

Componente de navegación semanal en el header de la vista móvil:

- **7 tiles** con día abreviado (Lun–Dom) y número
- **Dots de estado**: amber=`en_curso`, blue=`planificado`, green=`completado`
- **Navegación**: flechas `ChevronLeft/ChevronRight` para semana anterior/siguiente
- **Hoy**: anillo `ring-2 ring-[#00CFE8]`
- **Día seleccionado**: fondo `bg-[#00CFE8]`
- Toggle CalendarDays↔List en el header — azul cuando está activo
- Al cambiar a lista: resetea `weekOffset=0` y `weekDay=hoy`

**Estado:**
```typescript
const [calView, setCalView] = useState<'lista' | 'semana'>('lista');
const [weekOffset, setWeekOffset] = useState(0);
const [weekDay, setWeekDay] = useState<string>(todayStr); // 'YYYY-MM-DD'
```

### 18.5 Fotos por trabajo

**Tabla:** `trade_job_photos`
```sql
CREATE TABLE trade_job_photos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES trade_jobs(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  uploaded_by_worker_id uuid REFERENCES trade_workers(id),
  photo_url text NOT NULL,
  caption text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trade_job_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workers see org photos" ON trade_job_photos
  FOR SELECT USING (org_id = (SELECT org_id FROM trade_workers WHERE id = auth.uid()));
CREATE POLICY "workers insert own org" ON trade_job_photos
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM trade_workers WHERE id = auth.uid()));
```

**Supabase Storage:** Bucket `trade-job-photos` ✅ creado en Supabase Dashboard → Storage.

**Funciones en `supabase.ts`:**
- `uploadJobPhoto(jobId, file, workerId, orgId)` — upload + insert en tabla
- `loadJobPhotos(jobId)` — SELECT con `signed_url` (1h TTL)

**UI en `ScreenWorkerView`:**
- Botón "📷 Adjuntar foto" en cada trabajo expandido
- `<input type="file" accept="image/*" capture="environment">` — abre cámara en móvil, galería en PC
- Miniaturas en el card expandido

### 18.6 Creación de trabajos desde móvil

- **FAB "+"** fijo en bottom-right (`fixed bottom-20 right-4`)
- **Bottom sheet** con form simplificado: título*, fecha*, hora, duración, dirección, cliente (dropdown)
- Llama a `supabase.from('trade_jobs').insert(...)` directamente
- Asigna el propio worker automáticamente como responsable
- `ScreenWorkerView` recibe `clientes?: Cliente[]` como prop (opcional, si no se pasa los carga internamente)

### 18.7 Checklist Mobile Worker View

- [x] WeekStrip — navegación semanal con dots de estado
- [x] Vista semana — filtrado de trabajos por día seleccionado
- [x] Vista semana — estado vacío "Sin trabajos para este día"
- [x] Fotos — botón adjuntar con `capture="environment"`
- [x] Fotos — upload a Supabase Storage bucket `trade-job-photos`
- [x] Fotos — miniaturas en card expandido
- [x] Crear trabajo — FAB "+" + bottom sheet
- [x] Editar trabajo — EditJobModal
- [x] Eliminar trabajo — inline confirm
- [x] Tab Todos (admin) — todos los trabajos de la org
- [x] Push notifications — Bell toggle en header
- [x] Filter pills — filtrado por estado
- [x] Google Maps link — por dirección de trabajo

---

## 19. Push Notifications (Web Push + VAPID)

### 19.1 Arquitectura

```
Browser (PWA)
    └─ sw.js (Service Worker)
           ├─ PushManager.subscribe() → guarda en trade_push_subscriptions
           └─ self.addEventListener('push') → showNotification()

Backend
    └─ trade-push-notify (Edge Function)
           ├─ Lee subscriptions de trade_push_subscriptions
           └─ Envía push con VAPID auth (ECDSA P-256)
```

### 19.2 Tabla trade_push_subscriptions

```sql
CREATE TABLE trade_push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id uuid NOT NULL REFERENCES trade_workers(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  subscription jsonb NOT NULL,  -- { endpoint, keys: { p256dh, auth } }
  created_at timestamptz DEFAULT now(),
  UNIQUE(worker_id)
);

ALTER TABLE trade_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "worker manages own" ON trade_push_subscriptions
  FOR ALL USING (worker_id = auth.uid());
```

### 19.3 VAPID Keys

Generadas con `npx web-push generate-vapid-keys`:

| Variable | Dónde se guarda |
|----------|-----------------|
| `VITE_VAPID_PUBLIC_KEY` | `.env`, Vercel env vars (con prefijo `VITE_`) |
| `VAPID_PRIVATE_KEY` | Supabase edge function secrets únicamente |
| `VAPID_PUBLIC_KEY` | Supabase edge function secrets (para la función) |
| `VAPID_SUBJECT` | `mailto:hola@trabflow.com` en Supabase secrets |

**Importante:** La clave privada NUNCA va en el frontend ni en Vercel.

### 19.4 Funciones en supabase.ts

```typescript
// Suscribir este dispositivo a push
subscribePush(workerId: string, orgId: string): Promise<void>
// - Llama PushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey })
// - Guarda subscription JSON en trade_push_subscriptions
// - applicationServerKey es string (no Uint8Array) — PushManager acepta ambos

// Desuscribir
unsubscribePush(workerId: string): Promise<void>
// - Browser unsubscribe + DELETE from DB

// Comprobar estado
isPushSubscribed(): Promise<boolean>
```

### 19.5 Service Worker (public/sw.js)

Cache name: `tradeflow-v2`. Eventos añadidos:

```javascript
// Recibir push del servidor
self.addEventListener('push', e => {
  const data = e.data?.json() ?? {};
  e.waitUntil(self.registration.showNotification(data.title || 'TrabFlow', {
    body: data.body || '',
    icon: '/tradeflow_192.png',
    badge: '/tradeflow_192.png',
    data: data.url ? { url: data.url } : undefined,
    vibrate: [200, 100, 200],
  }));
});

// Clic en notificación → abrir URL o enfocar pestaña existente
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url ?? '/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const existing = list.find(c => c.url.includes(url));
    if (existing) return existing.focus();
    return clients.openWindow(url);
  }));
});
```

### 19.6 Edge Function trade-push-notify

**Endpoint:** `POST /functions/v1/trade-push-notify`

**Input:**
```json
{
  "worker_ids": ["uuid1", "uuid2"],  // O bien...
  "org_id": "uuid",                  // ...uno de los dos
  "title": "Nuevo trabajo asignado",
  "body_text": "Fontanería en C/ Mayor 5",
  "url": "/worker"
}
```

**Output:**
```json
{ "sent": 2, "failed": 0 }
```

La función firma el JWT VAPID nativamente en Deno usando Web Crypto API (ECDSA P-256). No depende de librerías externas.

**Deploy:**
```bash
supabase functions deploy trade-push-notify
```

**Secrets necesarios:**
```bash
supabase secrets set VAPID_PRIVATE_KEY=<clave-privada>
supabase secrets set VAPID_PUBLIC_KEY=<clave-publica>
supabase secrets set VAPID_SUBJECT=mailto:hola@trabflow.com
```

### 19.7 UI en ScreenWorkerView

- Icono Bell/BellOff en el header (solo si `'Notification' in window`)
- Color amber cuando las notificaciones están activas
- `handleTogglePush`: pide `Notification.requestPermission()` → llama `subscribePush`/`unsubscribePush`
- En mount: `isPushSubscribed().then(setPushEnabled).catch(() => {})`

### 19.8 Checklist Push Notifications

- [x] Tabla `trade_push_subscriptions` + RLS
- [x] Funciones `subscribePush`, `unsubscribePush`, `isPushSubscribed` en supabase.ts
- [x] sw.js v2 — eventos `push` y `notificationclick`
- [x] Edge function `trade-push-notify` con VAPID nativo
- [x] Bell toggle en ScreenWorkerView
- [x] `VITE_VAPID_PUBLIC_KEY` en `.env` y Vercel env vars
- [x] Supabase secrets: `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`
- [ ] Prueba: suscribir → enviar push desde edge function → recibir notificación

---

## 20. Catálogo Global y Auto-seed

### 20.1 Problema resuelto

Antes de esta implementación, cada organización nueva empezaba con catálogo vacío. El usuario debía crear todos los artículos manualmente.

### 20.2 Catálogo global (org_id = NULL)

Se seeda una vez con una migración DO block que copia los artículos de la primera organización que tenga datos, estableciendo `org_id = NULL` para que sean plantillas globales.

**33 productos base + ~99 variantes** cubriendo:
- Fontanería: tuberías, válvulas, bombas, sanitarios
- Electricidad: cables, cuadros, luminarias
- Climatización: splits, calderas, radiadores
- Carpintería: puertas, ventanas, persianas
- Pintura: pinturas, imprimaciones, rodillos

### 20.3 RPC seed_org_catalog

```sql
CREATE OR REPLACE FUNCTION seed_org_catalog(new_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Idempotente: no hace nada si la org ya tiene catálogo
  IF EXISTS (SELECT 1 FROM trade_catalog WHERE org_id = new_org_id LIMIT 1) THEN
    RETURN;
  END IF;

  -- Copiar productos globales
  INSERT INTO trade_catalog (org_id, nombre, descripcion, unidad, activo)
  SELECT new_org_id, nombre, descripcion, unidad, activo
  FROM trade_catalog WHERE org_id IS NULL;

  -- Copiar variantes globales
  INSERT INTO trade_catalog_variants (catalog_id, nombre, precio_coste, margen_pct, activo)
  SELECT tc_new.id, v.nombre, v.precio_coste, v.margen_pct, v.activo
  FROM trade_catalog_variants v
  JOIN trade_catalog tc_global ON tc_global.id = v.catalog_id AND tc_global.org_id IS NULL
  JOIN trade_catalog tc_new ON tc_new.org_id = new_org_id AND tc_new.nombre = tc_global.nombre;
END;
$$;
```

### 20.4 Integración en registro

Se llama automáticamente en dos lugares de `supabase.ts`:

1. **`registerUser()`** — tras crear la suscripción:
   ```typescript
   await supabase.rpc('seed_org_catalog', { new_org_id: org.id });
   ```

2. **`getOrCreateOrg()`** — tras crear la org:
   ```typescript
   await supabase.rpc('seed_org_catalog', { new_org_id: org.id });
   ```

### 20.5 Nota sobre precio_venta

`precio_venta` es una **columna generada** en `trade_catalog_variants` (calculada como `precio_coste * (1 + margen_pct/100)`). No se puede incluir en INSERT — el motor la calcula automáticamente.

### 20.6 Checklist Catálogo Auto-seed

- [x] Migración aplicada — catálogo global (org_id=NULL) con 33 productos y ~99 variantes
- [x] RPC `seed_org_catalog(new_org_id)` creada y desplegada
- [x] `registerUser()` llama al RPC tras crear org
- [x] `getOrCreateOrg()` llama al RPC tras crear org
- [x] RPC es idempotente (safe to call multiple times)

---

## 21. Stripe Customer UI (AppDashboardView)

### 21.1 Sección de suscripción en Ajustes

La pestaña Ajustes de `AppDashboardView` muestra el estado de suscripción en tiempo real cargado desde `trade_subscriptions`.

**Estado cargado:**
```typescript
const [subscription, setSubscription] = useState<TradeSubscription | null>(null);

// En loadLiveData:
loadOrgSubscription(org.id).then(sub => setSubscription(sub)).catch(() => {});
```

### 21.2 Lógica de visualización

| Estado (`status`) | Badge color | Botón principal |
|-------------------|-------------|-----------------|
| `trial` | Azul | "Activar plan" (`bg-[#FFC400]`) → Stripe Checkout |
| `active` | Verde (emerald) | "Gestionar suscripción" (border) → Stripe Portal |
| `cancelled` | Slate | "Activar plan" → Stripe Checkout |
| `expired` | Rojo | "Activar plan" → Stripe Checkout |

**Info adicional mostrada:**
- Plan name: `basico`→"Básico", `pro`→"Profesional", `empresa`→"Empresa"
- Ciclo: mensual / anual
- Trial: días restantes calculados desde `trial_ends_at`
- Active: próxima fecha de facturación desde `current_period_end`

### 21.3 Funciones en supabase.ts

```typescript
loadOrgSubscription(orgId: string): Promise<TradeSubscription | null>
// SELECT * FROM trade_subscriptions WHERE org_id = orgId LIMIT 1

getStripeCheckoutUrl(orgId, planId, billingCycle): Promise<string>
// Llama edge function trade-stripe-checkout → retorna checkout URL

getStripePortalUrl(orgId): Promise<string>
// Llama edge function trade-stripe-portal → retorna portal URL
```

### 21.4 Checklist Stripe Customer UI

- [x] `loadOrgSubscription()` en supabase.ts
- [x] Estado `subscription` en AppDashboardView
- [x] Badge de estado con color dinámico
- [x] Días restantes en trial
- [x] Fecha próxima factura cuando active
- [x] Botón "Activar plan" (amarillo) → Stripe Checkout
- [x] Botón "Gestionar suscripción" (border) → Stripe Portal

---

## 22. Tema Visual TRABFLOW (Dark Theme)

### 22.1 Paleta de colores

| Token | Hex | Uso |
|-------|-----|-----|
| `bg-[#020B16]` | `#020B16` | Fondo principal de toda la app |
| `bg-[#0d1f38]` | `#0d1f38` | Cards, modales, paneles |
| `#00CFE8` | Cyan | Acento principal, focus rings, iconos activos |
| `#FFC400` | Amarillo | CTAs primarios ("Activar plan", botones de conversión) |
| `border-white/10` | blanco 10% | Bordes de cards e inputs |
| `text-white/40` | blanco 40% | Texto secundario, links neutros |

### 22.2 Páginas de auth con dark theme

Todas las páginas de autenticación usan la paleta TRABFLOW:

- **`LoginView.tsx`** — `bg-[#020B16]`, `bg-[#0d1f38]`, inputs `bg-white/5`, submit `bg-[#00CFE8]`
- **`AuthResetPasswordView.tsx`** — mismo tratamiento, icono email en `#00CFE8`
- **`UpdatePasswordView.tsx`** — barra de fortaleza `bg-white/10`, sin LoadingScreen interno
- **`AuthActivateView.tsx`** — spinner `text-[#00CFE8]`, botón `bg-white/10`
- **`AuthCallbackView.tsx`** — mismo tratamiento

### 22.3 App.tsx — fondo unificado

```typescript
// Antes:
<div className={`${isAppView || isAuthView ? 'bg-slate-900' : 'bg-slate-50/30'}`}>

// Ahora:
<div className="bg-[#020B16]">
```

Fondo uniforme `#020B16` para todas las páginas (landing, auth, dashboard).

### 22.4 Footer — texto actualizado

```typescript
// Antes: "Prueba gratis 15 días"
// Ahora: "Prueba gratis 3 meses"
```

---

## 23. Edge Functions — Migración a Claude

### 23.1 Cambio realizado

Las edge functions que usaban OpenAI han sido migradas a Claude (Anthropic):

| Función | Antes | Después |
|---------|-------|---------|
| `trade-voice-to-quote` | `gpt-4o` | `claude-3-5-sonnet-20241022` |
| `trade-photo-scan` | `gpt-4-vision-preview` | `claude-3-5-sonnet-20241022` |

### 23.2 Configuración requerida

```bash
# Supabase secrets
supabase secrets set ANTHROPIC_API_KEY=<tu-clave-anthropic>
```

Las funciones ya no necesitan `OPENAI_API_KEY`.

---

## 24. Variables de Entorno — Resumen completo

### 24.1 Frontend (.env / Vercel)

```env
VITE_SUPABASE_URL=https://dqqjaujnulutinskmqsu.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_VAPID_PUBLIC_KEY=<clave-publica-vapid>
```

### 24.2 Supabase Edge Function Secrets

```bash
# Stripe
supabase secrets set STRIPE_SECRET_KEY=<stripe-secret>
supabase secrets set STRIPE_WEBHOOK_SECRET=<webhook-secret>

# Push notifications (VAPID)
supabase secrets set VAPID_PRIVATE_KEY=<clave-privada>
supabase secrets set VAPID_PUBLIC_KEY=<clave-publica>
supabase secrets set VAPID_SUBJECT=mailto:hola@trabflow.com

# AI
supabase secrets set ANTHROPIC_API_KEY=<clave-anthropic>

# Supabase (auto-disponibles en edge functions)
# SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY están disponibles automáticamente
```

### 24.3 Checklist Variables

- [x] `VITE_SUPABASE_URL` en Vercel
- [x] `VITE_SUPABASE_ANON_KEY` en Vercel
- [x] `VITE_VAPID_PUBLIC_KEY` en Vercel
- [x] `STRIPE_SECRET_KEY` en Supabase secrets
- [x] `STRIPE_WEBHOOK_SECRET` en Supabase secrets
- [x] `VAPID_PRIVATE_KEY` en Supabase secrets
- [x] `VAPID_PUBLIC_KEY` en Supabase secrets
- [x] `VAPID_SUBJECT` en Supabase secrets
- [x] `ANTHROPIC_API_KEY` en Supabase secrets

---

## 25. Motor de IA TradeFlow — Edge Functions v2

### 25.1 Arquitectura

El motor de IA funciona con **dos edge functions** desplegadas en Supabase:

| Función | Versión | Entrada | Salida |
|---|---|---|---|
| `trade-voice-to-quote` | v16 | Audio (webm) | `{ transcript, quote }` |
| `trade-photo-scan` | v9 | Imagen base64 | `{ quote }` |

**Pipeline voz:**
```
Audio → Whisper (OpenAI STT, español) → transcript → Claude Haiku → quote JSON
```

**Pipeline foto:**
```
Imagen base64 → Claude Haiku Vision → quote JSON
```

Ambas requieren JWT válido (`verify_jwt: true`).

---

### 25.2 Principios del motor de IA

#### Universal por oficio
El motor detecta automáticamente el gremio sin configuración previa. Funciona para fontanería, electricidad, climatización, albañilería, reformas, carpintería, cerrajería, ventanas, pintura, suelos, cocinas, baños, jardinería, piscinas, energía solar, CCTV, automatización, mantenimiento industrial, talleres mecánicos, electrodomésticos, informática y cualquier otro oficio técnico.

#### Sin precios de IA
**La IA NO asigna precios nunca.** Todas las partidas salen con:
- `precio_unitario: 0`
- `subtotal: 0`
- `requiere_precio: true`
- `del_catalogo: false`
- `aviso: "Sin precio en catálogo. El profesional debe asignar precio."`

Los precios se asignan en el frontend mediante match contra el catálogo del instalador. Si hay coincidencia, se usa el precio real del catálogo. Si no, la partida queda en 0 esperando que el instalador la complete.

#### Detección de sustituciones
Cuando el usuario dice "cambiar X por Y" / "quitar X y poner Y", el motor genera automáticamente:
1. Partida de **retirada/desmontaje** de X
2. **Gestión de residuos/escombros** si aplica
3. **Suministro e instalación** de Y
4. **Adaptaciones** necesarias (fontanería, electricidad, remates, puesta en marcha)

---

### 25.3 Formato de respuesta (quote JSON)

```json
{
  "oficio": "Fontanería",
  "tipo_trabajo": "Sustitución de bañera por plato de ducha",
  "resumen": "Cambio completo de bañera por plato de ducha con adaptación de fontanería",
  "partidas": [
    {
      "descripcion": "Retirada de bañera existente",
      "cantidad": 1,
      "unidad": "ud",
      "categoria": "Desmontaje",
      "precio_unitario": 0,
      "subtotal": 0,
      "catalog_id": null,
      "del_catalogo": false,
      "requiere_precio": true,
      "aviso": "Sin precio en catálogo. El profesional debe asignar precio."
    },
    {
      "descripcion": "Gestión de residuos y escombros",
      "cantidad": 1,
      "unidad": "ud",
      "categoria": "Gestión residuos",
      "precio_unitario": 0,
      "subtotal": 0,
      "catalog_id": null,
      "del_catalogo": false,
      "requiere_precio": true,
      "aviso": "Sin precio en catálogo. El profesional debe asignar precio."
    }
  ],
  "subtotal": 0,
  "iva": { "tipo": 21, "importe": 0 },
  "total": 0,
  "notas": "Incluye adaptación de desagüe y conexiones",
  "nivel_confianza": "medio"
}
```

**Campos del quote:**

| Campo | Tipo | Descripción |
|---|---|---|
| `oficio` | string | Gremio detectado automáticamente |
| `tipo_trabajo` | string | Categoría general del trabajo |
| `resumen` | string | Descripción breve del presupuesto |
| `partidas` | array | Líneas del presupuesto |
| `subtotal` | number | Suma sin IVA (siempre 0, lo calcula el frontend) |
| `iva.tipo` | number | % IVA (21 por defecto) |
| `total` | number | Total con IVA (siempre 0, lo calcula el frontend) |
| `notas` | string | Observaciones técnicas |
| `nivel_confianza` | "alto"\|"medio"\|"bajo" | Fiabilidad de la detección |

**Campos por partida:**

| Campo | Tipo | Descripción |
|---|---|---|
| `descripcion` | string | Descripción de la partida |
| `cantidad` | number | Cantidad |
| `unidad` | string | ud / m / m2 / m3 / h / kg / jornada / kit |
| `categoria` | string | Material / Mano de obra / Desmontaje / Gestión residuos / Desplazamiento |
| `precio_unitario` | number | Siempre 0 (precio viene del catálogo) |
| `subtotal` | number | Siempre 0 |
| `catalog_id` | string\|null | ID en catálogo si hay match |
| `del_catalogo` | boolean | Si el precio viene del catálogo |
| `requiere_precio` | boolean | Si el instalador debe asignar precio manualmente |
| `aviso` | string | Mensaje de aviso al instalador |

---

### 25.4 Lógica de precios en el frontend (`AppDashboardView.tsx`)

La función `quoteToPartidas(quote: AIQuote): PartidaPresupuesto[]` convierte el quote de la IA en partidas del wizard:

```typescript
// 1. Detecta tipo (material vs mano_de_obra) desde categoria
const LABOR_CATS = ['mano de obra', 'desmontaje', 'gestión residuos', 'desplazamiento', 'instalación', 'retirada'];
const tipo = LABOR_CATS.some(k => cat.includes(k)) ? 'mano_de_obra' : 'material';

// 2. Intenta match en catálogo del instalador
const catalogMatch = matchProductForAI(p.descripcion, catalogProducts);

// 3a. Si hay match → precio real del catálogo
if (catalogMatch) {
  precioUnitario = catalogMatch.variant.precio_venta;
}

// 3b. Si no hay match → precio 0 + aviso
else {
  precioUnitario = 0;
  requiere_precio = true;
  aviso = "Sin precio en catálogo. Asigna precio.";
}
```

---

### 25.5 Tipo `PartidaPresupuesto` (types.ts)

```typescript
export interface PartidaPresupuesto {
  descripcion: string;
  tipo: 'material' | 'mano_de_obra';
  cantidad: number;
  precioUnitario: number;
  total: number;
  requiere_precio?: boolean;  // true si no hay precio en catálogo
  aviso?: string;             // mensaje al instalador
}
```

---

### 25.6 Historial de versiones del motor

| Versión | Fecha | Cambios |
|---|---|---|
| v1 (voice v10, photo v2) | 27/05/2026 | Motor inicial. Precios generados por IA (estimaciones de mercado). Mano de obra y desplazamiento como campos separados del JSON. |
| v2 (voice v16, photo v9) | 27/05/2026 | Motor universal (todos los oficios). IA no genera precios → precios vienen del catálogo. Mano de obra y desplazamiento como partidas normales. Nuevos campos: `oficio`, `categoria`, `requiere_precio`, `aviso`, `del_catalogo`, `catalog_id`. Detección inteligente de sustituciones. Foto migrada de GPT-4o Vision a Claude Haiku Vision. |

---

---

## 26. Auditoría de Seguridad — Mayo 2026

Auditoría completa de seguridad ejecutada el 27/05/2026 sobre el proyecto `dqqjaujnulutinskmqsu`. Se aplicaron 7 migraciones SQL y 2 cambios de configuración Auth.

---

### 26.1 Migraciones SQL aplicadas

#### `security_revoke_admin_functions_from_public`
Revocó EXECUTE de las funciones `admin_*` del rol `PUBLIC`/`anon`. Antes eran invocables por cualquier visitante sin sesión.

```sql
REVOKE EXECUTE ON FUNCTION public.admin_get_trade_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_waitlist_leads() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_invite_trade_user(text, uuid) FROM PUBLIC, anon;
-- etc.
```

#### `security_revoke_dangerous_functions_from_public`
Revocó `get_debacu_pepper` (clave HMAC) y `debacu_eval_*` de roles no autorizados.

```sql
REVOKE EXECUTE ON FUNCTION public.get_debacu_pepper() FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.debacu_eval_is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.debacu_eval_is_org_admin FROM PUBLIC;
```

#### `security_fix_rls_users_company_banks`
Activó RLS y añadió políticas `is_admin()` sobre `users` y `company_banks` (eran accesibles a todo `authenticated`).

```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_admin"  ON public.users FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "users_write_admin" ON public.users FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "company_banks_admin_only" ON public.company_banks FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
```

> **Nota:** `users` es la tabla de usuarios PIN del sistema hotel (debacu_eval). Su columna `id` es TEXT, no UUID — no se puede usar `id = auth.uid()`.

#### `security_fix_rls_catalogues_apps_plans_sectors`
Añadió políticas de solo lectura pública sobre las tablas catálogo y restringió escritura a `is_admin()`.

```sql
CREATE POLICY "apps_public_read"    ON public.apps    FOR SELECT TO public      USING (true);
CREATE POLICY "apps_admin_write"    ON public.apps    FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "plans_public_read"   ON public.plans   FOR SELECT TO public      USING (true);
CREATE POLICY "plans_admin_write"   ON public.plans   FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "sectors_public_read" ON public.sectors FOR SELECT TO public      USING (true);
CREATE POLICY "sectors_admin_write" ON public.sectors FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());
```

#### `security_fix_search_path_trigger_functions`
Fijó `search_path = public` en funciones con SECURITY DEFINER para prevenir inyección de esquema.

```sql
ALTER FUNCTION public.handle_new_trade_user() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
-- etc.
```

#### `security_fix_storage_trade_job_photos`
Restringió el listado del bucket `trade-job-photos` a usuarios autenticados. Anon solo puede acceder a URLs directas (CDN), no listar contenido.

```sql
CREATE POLICY "trade_job_photos_authenticated_list" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'trade-job-photos');
CREATE POLICY "trade_job_photos_block_anon_list" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'trade-job-photos' AND name IS NULL);  -- bloqueo efectivo de listado
```

#### `security_fix_test_findings`
Correcciones detectadas durante la ejecución de tests manuales (FASE 5):

```sql
-- Restaurar GRANTs sobre catálogos públicos (eliminados por migración anterior sin reponerlos)
GRANT SELECT ON public.apps, public.plans, public.sectors TO anon, authenticated;

-- seed_org_catalog no tenía check de is_admin → cualquier authenticated podía copiar el catálogo
REVOKE EXECUTE ON FUNCTION public.seed_org_catalog(uuid) FROM authenticated, PUBLIC;

-- Limpiar filas de test
DELETE FROM public.trade_waitlist WHERE email IN ('test-anon-delete@test.com', 'test-anon-delete2@test.com');
```

#### `security_fix_trade_logos_bucket`
Añadió políticas RLS al bucket `trade-logos` (antes sin ninguna política — cualquiera podía subir archivos).

```sql
CREATE POLICY "trade_logos_public_read"   ON storage.objects FOR SELECT TO public      USING (bucket_id = 'trade-logos');
CREATE POLICY "trade_logos_owner_insert"  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'trade-logos' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "trade_logos_owner_update"  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'trade-logos' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "trade_logos_owner_delete"  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'trade-logos' AND (auth.uid())::text = (storage.foldername(name))[1]);
```

---

### 26.2 Configuración Auth corregida (Management API)

Cambios aplicados vía `PATCH https://api.supabase.com/v1/projects/dqqjaujnulutinskmqsu/config/auth`:

| Campo | Antes | Después |
|---|---|---|
| `site_url` | `https://www.trabflow.com` | ✅ sin cambio (ya correcto) |
| `mailer_autoconfirm` | `false` | ✅ sin cambio (ya correcto) |
| `password_min_length` | `6` | **8** |
| `uri_allow_list` | (sin `/update-password`) | + `https://www.trabflow.com/update-password` |
| Template invite | URL `debacu.com` hardcodeada | **`trabflow.com`** |
| Template recovery | Footer "Debacu Hotels" | **"TrabFlow"** |

**`uri_allow_list` final:**
```
http://localhost:3000/auth/activate
http://localhost:3000/auth/reset
https://www.trabflow.com/auth/reset
https://www.trabflow.com/auth/activate
https://www.trabflow.com/auth/callback
https://www.trabflow.com/update-password
```

---

### 26.3 Tests manuales ejecutados y resultado

| # | Test | Rol | Resultado |
|---|------|-----|-----------|
| 1 | `SELECT * FROM users` | anon | ✅ permission denied |
| 2 | `SELECT * FROM company_banks` | anon | ✅ permission denied |
| 3 | `SELECT admin_get_trade_users()` | anon | ✅ permission denied |
| 4 | `SELECT admin_get_waitlist_leads()` | anon | ✅ permission denied |
| 5 | `INSERT INTO apps` | anon | ✅ permission denied |
| 6 | `SELECT FROM apps` | anon | ✅ devuelve filas (catálogo público) |
| 7 | `INSERT INTO trade_waitlist` (sin RETURNING) | anon | ✅ INSERT OK |
| 8 | `seed_org_catalog(uuid)` | authenticated | ✅ permission denied |
| 9 | `get_debacu_pepper()` | authenticated | ✅ permission denied |
| 10 | Filas de test borradas | — | ✅ 0 rows |

> **Nota sobre trade_waitlist:** `INSERT … RETURNING id` falla para `anon` porque RETURNING requiere SELECT. El frontend no debe usar RETURNING en inserciones anónimas.

---

### 26.4 Riesgos residuales aceptados

| Ítem | Justificación |
|------|---------------|
| `admin_get_trade_users` ejecutable por `authenticated` | Seguro: check interno `auth.email() = 'fercarboc@gmail.com'` |
| `admin_get_waitlist_leads` ejecutable por `authenticated` | Seguro: mismo check interno |
| `pg_net` en schema public | Falso positivo del linter de Supabase — extensión de sistema |
| Bucket `trade-logos` público para lectura | Intencional: logos son assets públicos (no datos sensibles) |

---

*Actualizado por Claude Code — TradeFlow AI — Mayo 2026 (F5: Mobile + Push + Dark Theme + Stripe UI + Auditoría Seguridad)*

---

## 27. Actualizaciones Junio 2026

### 27.1 Política RLS corregida — trade_invoices

La política anterior solo permitía al **owner** crear/leer facturas. Corregida para incluir miembros activos:

```sql
-- Eliminar política antigua (solo owner)
DROP POLICY IF EXISTS "Acceso a facturas propias" ON trade_invoices;

-- Nueva política que incluye miembros activos
CREATE POLICY "invoices_org_access" ON trade_invoices
  FOR ALL USING (
    org_id IN (
      SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true
    )
  );
```

**Por qué:** Roles admin/oficina recibían error "al generar la factura" porque no podían insertar en trade_invoices.

### 27.2 Edge function send-invite — versión 4

Ahora guarda `worker_profile_id` en `trade_org_members` al crear la invitación:

```typescript
// Antes: solo guardaba org_id, user_id, email, rol, activo
// Ahora: también guarda worker_profile_id si se pasa en el body
const memberRow = { org_id, user_id, email, rol, activo: false, invited_at: ... };
if (worker_profile_id) memberRow.worker_profile_id = worker_profile_id;
await supabase.from('trade_org_members').upsert(memberRow, { onConflict: 'org_id,user_id' });
```

### 27.3 Nuevas tablas añadidas

Ver sección 1 (Diagrama de entidades actualizado) para el SQL completo de:
- `trade_field_actions` — notas de campo de técnicos
- Columnas nuevas en `trade_organizations`, `trade_org_members`, `trade_jobs`, `trade_invoices`

### 27.4 Edge function trade-chatbot — versión 2

Actualizado con conocimiento completo de todos los módulos de la app. Captura necesidades en `trade_installer_needs`. Modelo: Claude Haiku 4.5.

### 27.5 Onboarding wizard

Al completar el wizard: `UPDATE trade_organizations SET is_onboarded = true`. Esto evita que el wizard aparezca de nuevo. Solo se muestra a propietarios (`rol === 'owner'`).

### 27.6 Documentación HTML

Archivo `public/TrabFlow_AI_AnalisisCompleto_v3_Junio2026.html` (accesible en producción). Acceso desde AdminView → sección "Documentación".

---

*Actualizado por Claude Code — TrabFlow AI — Junio 2026 (v3: Módulo Técnico, Facturación Unificada, Onboarding Wizard, ScreenEquipo Visual, RLS Fix, Chatbot v2, Documentación HTML)*
