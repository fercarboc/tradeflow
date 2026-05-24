import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// ── Tipos espejo de la base de datos ──────────────────────────────────────

export interface TradeOrganization {
  id: string;
  owner_id: string;
  nombre: string;
  nif?: string;
  direccion?: string;
  email?: string;
  telefono?: string;
  oficio: string;
  ciudad?: string;
  iva_default: number;
  plan: string;
  logo_url?: string;
  is_onboarded: boolean;
  created_at: string;
  updated_at: string;
}

export interface TradeClient {
  id: string;
  org_id: string;
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  ciudad?: string;
  nif?: string;
  notas?: string;
  obras_activas: number;
  total_facturado: number;
  created_at: string;
  updated_at: string;
}

export interface TradeQuote {
  id: string;
  org_id: string;
  client_id?: string;
  numero: string;
  descripcion?: string;
  fecha: string;
  estado: 'Borrador' | 'Enviado' | 'Aceptado' | 'Facturado';
  total_neto: number;
  iva_pct: number;
  total_con_iva: number;
  voice_note_url?: string;
  whatsapp_sent_at?: string;
  created_at: string;
  updated_at: string;
  trade_quote_items?: TradeQuoteItem[];
}

export interface TradeQuoteItem {
  id: string;
  quote_id: string;
  descripcion: string;
  tipo: 'material' | 'mano_de_obra';
  cantidad: number;
  precio_unitario: number;
  total: number;
  posicion: number;
  created_at: string;
}

export interface TradeInvoice {
  id: string;
  org_id: string;
  quote_id?: string;
  client_id?: string;
  numero: string;
  fecha: string;
  fecha_vencimiento?: string;
  estado: 'Pendiente' | 'Pagada' | 'Vencida';
  subtotal: number;
  iva_pct: number;
  iva_importe: number;
  total: number;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TradeWaitlistEntry {
  nombre: string;
  telefono?: string;
  email: string;
  oficio?: string;
  ciudad?: string;
  presupuestos_al_mes?: string;
}

export interface TradeSubscription {
  id: string;
  org_id: string;
  plan: 'basico' | 'pro' | 'empresa';
  billing_cycle: 'monthly' | 'yearly';
  status: 'trial' | 'active' | 'cancelled' | 'expired';
  trial_start: string;
  trial_end: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  current_period_start?: string;
  current_period_end?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminOrgRow extends TradeOrganization {
  subscription?: TradeSubscription;
  owner_email?: string;
}

// ── Helpers de API ─────────────────────────────────────────────────────────

export async function getOrCreateOrg(): Promise<TradeOrganization | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from('trade_organizations')
    .select('*')
    .eq('owner_id', user.id)
    .single();

  if (existing) return existing;

  // Create from user metadata written during self-registration wizard
  const meta = user.user_metadata ?? {};
  const trialEnd = new Date();
  trialEnd.setMonth(trialEnd.getMonth() + 3);

  const { data: created, error } = await supabase
    .from('trade_organizations')
    .insert({
      owner_id: user.id,
      nombre: meta.company_name || meta.full_name || user.email?.split('@')[0] || 'Mi Empresa',
      oficio: meta.trade_types || 'Otros',
      email: user.email,
      telefono: meta.phone,
      plan: meta.plan || 'pro',
      is_onboarded: false,
      force_password_change: false,
    })
    .select()
    .single();

  if (error || !created) return null;

  await supabase.from('trade_subscriptions').insert({
    org_id: created.id,
    plan: meta.plan || 'pro',
    billing_cycle: meta.billing_cycle || 'monthly',
    status: 'trial',
    trial_start: new Date().toISOString(),
    trial_end: trialEnd.toISOString(),
  });

  return created;
}

export async function registerUser(params: {
  email: string;
  password: string;
  fullName: string;
  companyName?: string;
  phone?: string;
  tradeTypes: string[];
  plan: 'basico' | 'pro' | 'empresa';
  billingCycle: 'monthly' | 'yearly';
}): Promise<{ error: string | null }> {
  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: {
        full_name: params.fullName,
        company_name: params.companyName || params.fullName,
        phone: params.phone,
        trade_types: params.tradeTypes.join(','),
        plan: params.plan,
        billing_cycle: params.billingCycle,
      },
    },
  });

  if (error) return { error: error.message };

  // If session is available (email confirmation disabled), create org immediately
  if (data.session && data.user) {
    const trialEnd = new Date();
    trialEnd.setMonth(trialEnd.getMonth() + 3);

    const { data: org } = await supabase
      .from('trade_organizations')
      .insert({
        owner_id: data.user.id,
        nombre: params.companyName || params.fullName,
        oficio: params.tradeTypes.join(','),
        email: params.email,
        telefono: params.phone,
        plan: params.plan,
        is_onboarded: false,
        force_password_change: false,
      })
      .select()
      .single();

    if (org) {
      await supabase.from('trade_subscriptions').insert({
        org_id: org.id,
        plan: params.plan,
        billing_cycle: params.billingCycle,
        status: 'trial',
        trial_start: new Date().toISOString(),
        trial_end: trialEnd.toISOString(),
      });
    }
  }

  return { error: null };
}

export async function getAdminOrgs(): Promise<AdminOrgRow[]> {
  const { data } = await supabase
    .from('trade_organizations')
    .select('*, trade_subscriptions(*)')
    .order('created_at', { ascending: false });

  return (data ?? []).map((row: TradeOrganization & { trade_subscriptions?: TradeSubscription[] }) => ({
    ...row,
    subscription: row.trade_subscriptions?.[0],
  })) as AdminOrgRow[];
}

export async function adminUpdateOrgPlan(
  orgId: string,
  plan: TradeSubscription['plan'],
  billingCycle: TradeSubscription['billing_cycle'],
): Promise<void> {
  await supabase.from('trade_organizations').update({ plan }).eq('id', orgId);
  await supabase.from('trade_subscriptions').update({ plan, billing_cycle: billingCycle }).eq('org_id', orgId);
}

export async function loadDashboard(orgId: string) {
  const [quotesRes, invoicesRes, clientsRes] = await Promise.all([
    supabase
      .from('trade_quotes')
      .select('*, trade_quote_items(*)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('trade_invoices')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('trade_clients')
      .select('*')
      .eq('org_id', orgId)
      .order('nombre'),
  ]);
  return {
    quotes:   (quotesRes.data   ?? []) as TradeQuote[],
    invoices: (invoicesRes.data ?? []) as TradeInvoice[],
    clients:  (clientsRes.data  ?? []) as TradeClient[],
  };
}

export async function saveQuote(
  orgId: string,
  clientId: string,
  descripcion: string,
  items: Pick<TradeQuoteItem, 'descripcion' | 'tipo' | 'cantidad' | 'precio_unitario'>[],
): Promise<TradeQuote> {
  const { count } = await supabase
    .from('trade_quotes')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId);

  const numero = `PRE-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(3, '0')}`;
  const totalNeto = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);

  const { data: quote, error: qErr } = await supabase
    .from('trade_quotes')
    .insert({ org_id: orgId, client_id: clientId, numero, descripcion, total_neto: totalNeto })
    .select()
    .single();
  if (qErr) throw qErr;

  const { error: iErr } = await supabase.from('trade_quote_items').insert(
    items.map((item, idx) => ({ quote_id: quote.id, ...item, posicion: idx })),
  );
  if (iErr) throw iErr;

  return quote as TradeQuote;
}

export async function convertToInvoice(quote: TradeQuote, orgId: string): Promise<TradeInvoice> {
  const { count } = await supabase
    .from('trade_invoices')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId);

  const numero = `FAC-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(3, '0')}`;
  const due = new Date();
  due.setDate(due.getDate() + 30);

  const { data: inv, error } = await supabase
    .from('trade_invoices')
    .insert({
      org_id: orgId,
      quote_id: quote.id,
      client_id: quote.client_id,
      numero,
      subtotal: quote.total_neto,
      iva_pct: quote.iva_pct,
      fecha_vencimiento: due.toISOString().split('T')[0],
    })
    .select()
    .single();
  if (error) throw error;

  await supabase.from('trade_quotes').update({ estado: 'Facturado' }).eq('id', quote.id);
  return inv as TradeInvoice;
}

export async function submitWaitlist(entry: TradeWaitlistEntry): Promise<void> {
  const { error } = await supabase.from('trade_waitlist').insert(entry);
  if (error) throw error;
}
