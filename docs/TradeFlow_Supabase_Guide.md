# TradeFlow AI — Guía de Implementación Supabase

**Proyecto Supabase:** GestionDebacuPro  
**URL:** `https://dqqjaujnulutinskmqsu.supabase.co`  
**Prefijo de tablas:** `trade_`  
**Fecha:** Mayo 2026

---

## 1. Arquitectura de Base de Datos

Todas las tablas llevan el prefijo `trade_` para convivir con las tablas de otras apps dentro del mismo proyecto Supabase sin conflictos.

### Diagrama de entidades

```
auth.users
    │
    └── trade_organizations (1 por cuenta, owner_id → auth.uid())
            │
            ├── trade_clients              (CRM: clientes del instalador)
            ├── trade_quotes               (presupuestos)
            │       └── trade_quote_items  (partidas de cada presupuesto)
            ├── trade_invoices             (facturas generadas al cliente final)
            ├── trade_subscriptions        (plan SaaS: trial/active/cancelled/expired)
            ├── trade_platform_invoices    (facturas que TradeFlow emite al instalador)
            ├── trade_voice_recordings     (archivos de voz para IA)
            └── trade_photo_scans          (fotos escaneadas por IA)

trade_waitlist  (tabla pública, sin auth requerido)

Admin: fercarboc@gmail.com → AdminView (sección F4)
     ├── RPC admin_get_trade_users()           (SECURITY DEFINER, lee auth.users)
     ├── RPC admin_get_platform_invoices()     (SECURITY DEFINER)
     └── RPC admin_set_subscription_active()   (SECURITY DEFINER)
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
Site URL:       https://tradeflow.ai   (o localhost:3000 en dev)
Redirect URLs:  http://localhost:3000/**
                https://tradeflow.ai/**
```

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

*Actualizado por Claude Code — TradeFlow AI — Mayo 2026 (F4: Admin Panel + Stripe)*
