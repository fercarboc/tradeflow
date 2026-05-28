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

export type WaitlistEstado = 'nuevo' | 'contactado' | 'interesado' | 'beta_activa' | 'convertido' | 'descartado';
export type WaitlistPrioridad = 'alta' | 'media' | 'baja';

export interface TradeWaitlistLead {
  id: string;
  nombre: string;
  telefono?: string;
  email: string;
  oficio?: string;
  ciudad?: string;
  presupuestos_al_mes?: string;
  estado: WaitlistEstado;
  notas?: string;
  fuente: string;
  prioridad: WaitlistPrioridad;
  contacted_at?: string;
  converted_at?: string;
  created_at: string;
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
  auth_email?: string;
  email_confirmed?: boolean;
  last_sign_in?: string;
  user_created_at?: string;
  quotes_count?: number;
  clients_count?: number;
  last_quote_at?: string | null;
  churn_risk?: boolean;
  vip?: boolean;
  internal_notes?: string | null;
}

export interface AdminSupportNote {
  id: string;
  org_id: string;
  admin_email: string;
  body: string;
  created_at: string;
}

export interface AdminActivityLog {
  id: string;
  admin_email: string;
  action: string;
  target_org_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ── Helpers de API ─────────────────────────────────────────────────────────

export async function getOwnOrg(): Promise<TradeOrganization | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('trade_organizations').select('*').eq('owner_id', user.id).maybeSingle();
  return data ?? null;
}

export async function getOrCreateOrg(): Promise<TradeOrganization | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from('trade_organizations')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle();

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

  await supabase.rpc('seed_org_catalog', { new_org_id: created.id });

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
      await supabase.rpc('seed_org_catalog', { new_org_id: org.id });
    }
  }

  return { error: null };
}

export async function getAdminOrgs(): Promise<AdminOrgRow[]> {
  const [orgsRes, authRes, quotesRes, clientsRes, lastQuoteRes] = await Promise.all([
    supabase
      .from('trade_organizations')
      .select('*, trade_subscriptions(*)')
      .order('created_at', { ascending: false }),
    supabase.rpc('admin_get_trade_users'),
    supabase.from('trade_quotes').select('org_id'),
    supabase.from('trade_clients').select('org_id'),
    supabase.from('trade_quotes').select('org_id, created_at').order('created_at', { ascending: false }),
  ]);

  const authMap = new Map<string, { auth_email: string; email_confirmed: boolean; last_sign_in: string | null; user_created_at: string }>();
  for (const row of (authRes.data ?? []) as Array<{ org_id: string; auth_email: string; email_confirmed: boolean; last_sign_in: string | null; user_created_at: string }>) {
    authMap.set(row.org_id, row);
  }

  const quotesCount = new Map<string, number>();
  for (const row of (quotesRes.data ?? []) as Array<{ org_id: string }>) {
    quotesCount.set(row.org_id, (quotesCount.get(row.org_id) ?? 0) + 1);
  }
  const clientsCount = new Map<string, number>();
  for (const row of (clientsRes.data ?? []) as Array<{ org_id: string }>) {
    clientsCount.set(row.org_id, (clientsCount.get(row.org_id) ?? 0) + 1);
  }
  // Primer resultado por org_id ya es el más reciente (orden DESC)
  const lastQuoteMap = new Map<string, string>();
  for (const row of (lastQuoteRes.data ?? []) as Array<{ org_id: string; created_at: string }>) {
    if (!lastQuoteMap.has(row.org_id)) lastQuoteMap.set(row.org_id, row.created_at);
  }

  return (orgsRes.data ?? []).map((row: TradeOrganization & { trade_subscriptions?: TradeSubscription[] }) => {
    const auth = authMap.get(row.id);
    return {
      ...row,
      subscription: row.trade_subscriptions?.[0],
      auth_email: auth?.auth_email,
      email_confirmed: auth?.email_confirmed,
      last_sign_in: auth?.last_sign_in ?? undefined,
      user_created_at: auth?.user_created_at,
      quotes_count: quotesCount.get(row.id) ?? 0,
      clients_count: clientsCount.get(row.id) ?? 0,
      last_quote_at: lastQuoteMap.get(row.id) ?? null,
    };
  }) as AdminOrgRow[];
}

export async function adminExtendTrial(orgId: string, days = 30): Promise<void> {
  const { data: sub } = await supabase
    .from('trade_subscriptions')
    .select('trial_end')
    .eq('org_id', orgId)
    .single();
  if (!sub) throw new Error('Suscripción no encontrada');
  const base = new Date(sub.trial_end) > new Date() ? new Date(sub.trial_end) : new Date();
  base.setDate(base.getDate() + days);
  const { error } = await supabase
    .from('trade_subscriptions')
    .update({ trial_end: base.toISOString(), status: 'trial' })
    .eq('org_id', orgId);
  if (error) throw error;
}

export async function adminCreateInstaller(params: {
  email: string;
  password: string;
  nombre: string;
  company_name?: string;
  oficio: string;
  plan: 'basico' | 'pro' | 'empresa';
  billing_cycle: 'monthly' | 'yearly';
  telefono?: string;
  trial_days?: number;
}): Promise<{ user_id: string; org_id: string }> {
  const { data, error } = await supabase.functions.invoke('trade-admin-create-installer', { body: params });
  if (error) throw new Error((error as { message?: string }).message ?? String(error));
  if (!data?.ok) throw new Error(data?.error ?? 'Error desconocido al crear instalador');
  return { user_id: data.user_id, org_id: data.org_id };
}

export async function adminSendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://trabflow.com/?reset=true',
  });
  if (error) throw error;
}

export async function adminSetPassword(userIdOrEmail: string, newPassword: string): Promise<void> {
  const body: Record<string, string> = { new_password: newPassword };
  if (userIdOrEmail.includes('@')) {
    body.email = userIdOrEmail;
  } else {
    body.user_id = userIdOrEmail;
  }
  const { error } = await supabase.functions.invoke('trade-admin-set-password', { body });
  if (error) throw new Error((error as { message?: string }).message ?? String(error));
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

export async function submitContactMessage(data: {
  nombre: string;
  telefono: string;
  email?: string;
  motivo: string;
  mensaje?: string;
}): Promise<void> {
  const { error } = await supabase.from('trade_waitlist').insert({
    nombre: data.nombre,
    telefono: data.telefono,
    email: data.email ?? '',
    oficio: data.motivo,
    ciudad: '',
    presupuestos_al_mes: 'Menos de 10',
    notas: data.mensaje ?? '',
    prioridad: 'normal',
    estado: 'nuevo',
  });
  if (error) throw error;
}

// ── Trabajadores ──────────────────────────────────────────────────────────

export interface TradeWorker {
  id: string;
  org_id: string;
  nombre: string;
  telefono?: string;
  email?: string;
  rol: string;
  activo: boolean;
  notas?: string;
  created_at: string;
  updated_at: string;
}

export async function loadWorkers(orgId: string): Promise<TradeWorker[]> {
  const { data } = await supabase
    .from('trade_workers')
    .select('*')
    .eq('org_id', orgId)
    .eq('activo', true)
    .order('nombre');
  return (data ?? []) as TradeWorker[];
}

export async function addWorker(
  orgId: string,
  worker: Pick<TradeWorker, 'nombre' | 'telefono' | 'email' | 'rol'>,
): Promise<TradeWorker> {
  const { data, error } = await supabase
    .from('trade_workers')
    .insert({ org_id: orgId, ...worker })
    .select()
    .single();
  if (error) throw error;
  return data as TradeWorker;
}

export async function deleteWorker(id: string): Promise<void> {
  await supabase.from('trade_workers').update({ activo: false }).eq('id', id);
}

// ── Tarifas ───────────────────────────────────────────────────────────────

export interface TradeTarifa {
  id: string;
  org_id: string;
  codigo?: string;
  familia: string;
  descripcion: string;
  precio_base: number;
  unidad: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export async function loadTarifas(orgId: string): Promise<TradeTarifa[]> {
  const { data } = await supabase
    .from('trade_tarifas')
    .select('*')
    .eq('org_id', orgId)
    .eq('activo', true)
    .order('familia')
    .order('descripcion');
  return (data ?? []) as TradeTarifa[];
}

export async function addTarifa(
  orgId: string,
  tarifa: Pick<TradeTarifa, 'codigo' | 'familia' | 'descripcion' | 'precio_base' | 'unidad'>,
): Promise<TradeTarifa> {
  const { data, error } = await supabase
    .from('trade_tarifas')
    .insert({ org_id: orgId, ...tarifa })
    .select()
    .single();
  if (error) throw error;
  return data as TradeTarifa;
}

export async function deleteTarifa(id: string): Promise<void> {
  await supabase.from('trade_tarifas').update({ activo: false }).eq('id', id);
}

export async function updateTarifaPrice(id: string, precio_base: number): Promise<void> {
  await supabase.from('trade_tarifas').update({ precio_base }).eq('id', id);
}

// ── Catálogo global TradeFlow ─────────────────────────────────────────────

export interface TradeGlobalCatalogItem {
  id: string;
  oficio: string;
  familia: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  precio_referencia: number;
  marca_sugerida?: string;
}

export async function loadGlobalCatalog(oficios?: string[]): Promise<TradeGlobalCatalogItem[]> {
  let q = supabase
    .from('trade_global_catalog')
    .select('id, oficio, familia, codigo, descripcion, unidad, precio_referencia')
    .eq('activo', true)
    .order('oficio')
    .order('familia')
    .order('descripcion');
  if (oficios?.length) q = q.in('oficio', oficios);
  const { data } = await q;
  return (data ?? []) as TradeGlobalCatalogItem[];
}

export async function importFromGlobalCatalog(orgId: string, oficios?: string[], familias?: string[]): Promise<number> {
  const { data, error } = await supabase.rpc('import_from_global_catalog', {
    p_org_id: orgId,
    p_oficios: oficios?.length ? oficios : null,
    p_familias: familias?.length ? familias : null,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

// ── Sugerencias catálogo ──────────────────────────────────────────────────

export async function submitCatalogSuggestion(orgId: string, params: {
  descripcion: string;
  oficio?: string;
  familia?: string;
  unidad?: string;
  precio_indicado?: number;
  origen: 'voz' | 'foto' | 'manual';
}): Promise<void> {
  await supabase.from('trade_catalog_suggestions').insert({ org_id: orgId, ...params });
}

// ── Clientes ──────────────────────────────────────────────────────────────

export async function addClient(
  orgId: string,
  client: Pick<TradeClient, 'nombre' | 'telefono' | 'email' | 'direccion'>,
): Promise<TradeClient> {
  const { data, error } = await supabase
    .from('trade_clients')
    .insert({ org_id: orgId, ...client })
    .select()
    .single();
  if (error) throw error;
  return data as TradeClient;
}

export async function updateClient(
  id: string,
  data: Partial<Pick<TradeClient, 'nombre' | 'telefono' | 'email' | 'direccion' | 'ciudad' | 'nif' | 'notas'>>,
): Promise<void> {
  const { error } = await supabase.from('trade_clients').update(data).eq('id', id);
  if (error) throw error;
}

// ── Facturas ──────────────────────────────────────────────────────────────

export async function markInvoicePaid(id: string): Promise<void> {
  const { error } = await supabase
    .from('trade_invoices')
    .update({ estado: 'Pagada', paid_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ── Presupuestos ──────────────────────────────────────────────────────────

export async function updateQuoteStatus(
  id: string,
  estado: TradeQuote['estado'],
): Promise<void> {
  const { error } = await supabase
    .from('trade_quotes')
    .update({ estado })
    .eq('id', id);
  if (error) throw error;
}

// ── Datos fiscales ────────────────────────────────────────────────────────

export async function saveFiscalData(
  orgId: string,
  data: {
    nombre: string; nif?: string; email?: string;
    telefono_fijo?: string; telefono_movil?: string;
    direccion?: string; localidad?: string; cp?: string;
    provincia?: string; pais?: string; iva_default?: number;
  },
): Promise<void> {
  const { error } = await supabase
    .from('trade_organizations')
    .update(data)
    .eq('id', orgId);
  if (error) throw error;
}

// ── Catálogo de productos con variantes ───────────────────────────────────────

export interface TradeCatalogProduct {
  id: string;
  org_id: string;
  oficio: string;
  familia: string;
  subfamilia?: string;
  nombre_generico: string;
  descripcion?: string;
  unidad: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
  trade_catalog_variants?: TradeCatalogVariant[];
}

export interface TradeCatalogVariant {
  id: string;
  product_id: string;
  org_id: string;
  marca: string;
  modelo?: string;
  medidas?: string;
  proveedor?: string;
  precio_material: number;
  precio_mano_obra: number;
  margen_pct: number;
  precio_venta: number;
  calidad: 'economico' | 'medio' | 'premium';
  is_preferred: boolean;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export async function loadCatalogProducts(orgId: string): Promise<TradeCatalogProduct[]> {
  const { data } = await supabase
    .from('trade_catalog_products')
    .select('*, trade_catalog_variants(*)')
    .eq('org_id', orgId)
    .eq('activo', true)
    .order('oficio')
    .order('familia')
    .order('nombre_generico');
  return (data ?? []) as TradeCatalogProduct[];
}

export async function getPreferredVariant(
  productId: string,
  orgId: string,
): Promise<TradeCatalogVariant | null> {
  const { data } = await supabase
    .from('trade_catalog_variants')
    .select('*')
    .eq('product_id', productId)
    .eq('org_id', orgId)
    .eq('is_preferred', true)
    .eq('activo', true)
    .single();
  return data ?? null;
}

export async function setPreferredVariant(
  variantId: string,
  productId: string,
  orgId: string,
): Promise<void> {
  await supabase
    .from('trade_catalog_variants')
    .update({ is_preferred: false })
    .eq('product_id', productId)
    .eq('org_id', orgId);
  const { error } = await supabase
    .from('trade_catalog_variants')
    .update({ is_preferred: true })
    .eq('id', variantId);
  if (error) throw error;
}

export async function updateCatalogVariant(
  id: string,
  data: Partial<Pick<TradeCatalogVariant, 'precio_material' | 'precio_mano_obra' | 'margen_pct' | 'proveedor' | 'is_preferred'>>,
): Promise<void> {
  const { error } = await supabase
    .from('trade_catalog_variants')
    .update(data)
    .eq('id', id);
  if (error) throw error;
}

// ── Email via Resend (Edge Function trade-email) ──────────────────────────────

export async function sendTrabflowEmail(payload: {
  type: 'waitlist_admin' | 'waitlist_confirm' | 'welcome' | 'contact_admin' | 'support_admin';
  nombre?: string;
  email?: string;
  telefono?: string;
  oficio?: string;
  ciudad?: string;
  presupuestos_al_mes?: string;
}): Promise<void> {
  await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trade-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  // Fire-and-forget: no lanzamos error si el email falla, para no bloquear el flujo UX
}

/**
 * Fuzzy match del texto detectado por IA contra el catálogo cargado.
 * Usa solapamiento Jaccard sobre tokens relevantes — mínimo 40% de overlap.
 * Evita falsos positivos cuando solo coincide una palabra genérica (ej. "radiador").
 */
export function matchProductForAI(
  detectedText: string,
  catalog: TradeCatalogProduct[],
): { product: TradeCatalogProduct; variant: TradeCatalogVariant } | null {
  const STOPWORDS = new Set([
    'de', 'la', 'el', 'los', 'las', 'un', 'una', 'del', 'al', 'y', 'o',
    'con', 'por', 'para', 'en', 'a', 'su', 'se', 'que', 'del', 'nuevo',
    'existente', 'incluyendo', 'necesario', 'completo', 'kit', 'tipo',
  ]);
  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const tokenize = (s: string) =>
    normalize(s).split(/[\s,:;()/]+/).filter(t => t.length > 2 && !STOPWORDS.has(t));

  const queryTokens = tokenize(detectedText);
  if (queryTokens.length === 0) return null;

  let bestProduct: TradeCatalogProduct | null = null;
  let bestScore = 0;

  for (const product of catalog) {
    const productTokens = [
      ...tokenize(product.nombre_generico),
      ...tokenize(product.familia),
    ];

    let matches = 0;
    for (const tq of queryTokens) {
      if (productTokens.some(tp => tp === tq || (tp.length > 4 && (tp.includes(tq) || tq.includes(tp))))) {
        matches++;
      }
    }

    // Jaccard: matches / tokens únicos en la unión
    const unionSize = new Set([...queryTokens, ...productTokens]).size;
    const score = unionSize > 0 ? matches / unionSize : 0;

    if (score > bestScore) {
      bestScore = score;
      bestProduct = product;
    }
  }

  // Mínimo 40% de solapamiento para considerar match válido
  if (!bestProduct || bestScore < 0.40) return null;

  const preferred = bestProduct.trade_catalog_variants?.find(v => v.is_preferred && v.activo)
    ?? bestProduct.trade_catalog_variants?.find(v => v.activo)
    ?? null;

  if (!preferred) return null;

  return { product: bestProduct, variant: preferred };
}

// ── Catálogo simple (trade_tarifas) — helpers import/export ──────────────────
// La tabla trade_tarifas tiene los campos: id, org_id, codigo, familia,
// descripcion, precio_base, unidad, activo — lo que el usuario llama "trade_catalog".

export async function exportCatalog(orgId: string): Promise<TradeTarifa[]> {
  const { data } = await supabase
    .from('trade_tarifas')
    .select('*')
    .eq('org_id', orgId)
    .eq('activo', true)
    .order('familia')
    .order('descripcion');
  return (data ?? []) as TradeTarifa[];
}

export async function deactivateCatalogItem(id: string): Promise<void> {
  await supabase.from('trade_tarifas').update({ activo: false }).eq('id', id);
}

export async function deactivateAllCatalogItems(orgId: string): Promise<void> {
  const { error } = await supabase
    .from('trade_tarifas')
    .update({ activo: false })
    .eq('org_id', orgId);
  if (error) throw error;
}

export interface CatalogImportItem {
  codigo: string;
  familia: string;
  descripcion: string;
  precio_base: number;
  unidad: string;
}

export async function importCatalogItems(
  orgId: string,
  items: CatalogImportItem[],
  mode: 'add' | 'update' | 'replace',
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];

  if (mode === 'replace') {
    await deactivateAllCatalogItems(orgId);
  }

  // Fetch existing items (include inactive for replace mode to avoid ghost duplicates)
  const { data: existing } = await supabase
    .from('trade_tarifas')
    .select('id, codigo, descripcion, activo')
    .eq('org_id', orgId);

  const byCodigo = new Map<string, string>();  // lowercase codigo → id
  const byDesc   = new Map<string, string>();  // lowercase descripcion → id
  for (const e of (existing ?? []) as Array<{ id: string; codigo?: string; descripcion: string; activo: boolean }>) {
    if (e.codigo) byCodigo.set(e.codigo.toLowerCase(), e.id);
    byDesc.set(e.descripcion.toLowerCase().trim(), e.id);
  }

  for (const item of items) {
    try {
      let existingId: string | undefined;
      if (item.codigo) existingId = byCodigo.get(item.codigo.toLowerCase());
      if (!existingId)  existingId = byDesc.get(item.descripcion.toLowerCase().trim());

      if (mode === 'add' && existingId) continue; // skip existing

      if (existingId && mode !== 'add') {
        const { error } = await supabase
          .from('trade_tarifas')
          .update({
            codigo:      item.codigo || null,
            familia:     item.familia,
            descripcion: item.descripcion,
            precio_base: item.precio_base,
            unidad:      item.unidad,
            activo:      true,
          })
          .eq('id', existingId);
        if (error) throw error;
        updated++;
      } else {
        const { error } = await supabase
          .from('trade_tarifas')
          .insert({
            org_id:      orgId,
            codigo:      item.codigo || null,
            familia:     item.familia,
            descripcion: item.descripcion,
            precio_base: item.precio_base,
            unidad:      item.unidad,
            activo:      true,
          });
        if (error) throw error;
        inserted++;
      }
    } catch (e: unknown) {
      errors.push(`"${item.descripcion}": ${(e as Error).message}`);
    }
  }

  return { inserted, updated, errors };
}

// ── Trabajos / Agenda (trade_jobs) ────────────────────────────────────────────

export interface TradeJob {
  id: string;
  org_id: string;
  quote_id?: string | null;
  client_id?: string | null;
  titulo: string;
  descripcion?: string | null;
  estado: 'planificado' | 'en_curso' | 'completado' | 'cancelado' | 'pendiente_material';
  prioridad: 'urgente' | 'alta' | 'normal' | 'baja';
  fecha_inicio?: string | null;
  hora_inicio?: string | null;
  fecha_fin?: string | null;
  hora_fin?: string | null;
  duracion_horas?: number | null;
  direccion?: string | null;
  localidad?: string | null;
  cp?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  completado_por?: string | null;
  completado_at?: string | null;
  notas_cierre?: string | null;
  created_at: string;
  updated_at: string;
  trade_clients?: { nombre: string; telefono?: string | null } | null;
  trade_job_workers?: TradeJobWorker[];
}

export interface TradeJobWorker {
  id: string;
  job_id: string;
  worker_id: string;
  rol: 'responsable' | 'asignado' | 'apoyo';
  notificado: boolean;
  aceptado?: boolean | null;
  created_at: string;
  trade_workers?: { nombre: string; rol: string } | null;
}

export async function loadJobs(orgId: string, fecha?: string): Promise<TradeJob[]> {
  let q = supabase
    .from('trade_jobs')
    .select('*, trade_clients(nombre, telefono), trade_job_workers(*, trade_workers(nombre, rol))')
    .eq('org_id', orgId)
    .order('fecha_inicio', { ascending: true })
    .order('hora_inicio', { ascending: true });
  if (fecha) q = q.eq('fecha_inicio', fecha);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TradeJob[];
}

export async function createJob(
  orgId: string,
  job: Omit<TradeJob, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'trade_clients' | 'trade_job_workers'>,
): Promise<TradeJob> {
  const { data, error } = await supabase
    .from('trade_jobs')
    .insert({ ...job, org_id: orgId })
    .select()
    .single();
  if (error) throw error;
  return data as TradeJob;
}

export async function updateJob(id: string, updates: Partial<Omit<TradeJob, 'trade_clients' | 'trade_job_workers'>>): Promise<void> {
  const { error } = await supabase.from('trade_jobs').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteJob(id: string): Promise<void> {
  const { error } = await supabase.from('trade_jobs').delete().eq('id', id);
  if (error) throw error;
}

export async function assignWorkerToJob(
  jobId: string,
  workerId: string,
  rol: TradeJobWorker['rol'] = 'asignado',
): Promise<void> {
  const { error } = await supabase
    .from('trade_job_workers')
    .upsert({ job_id: jobId, worker_id: workerId, rol }, { onConflict: 'job_id,worker_id' });
  if (error) throw error;
}

export async function removeWorkerFromJob(jobId: string, workerId: string): Promise<void> {
  const { error } = await supabase
    .from('trade_job_workers')
    .delete()
    .eq('job_id', jobId)
    .eq('worker_id', workerId);
  if (error) throw error;
}

// ── F5: Worker (empleado de campo) ───────────────────────────────────────────

export interface WorkerProfile {
  id: string;
  org_id: string;
  nombre: string;
  rol: string;
  email?: string | null;
  telefono?: string | null;
}

export async function loadWorkerByEmail(email: string): Promise<WorkerProfile | null> {
  const { data, error } = await supabase
    .from('trade_workers')
    .select('id, org_id, nombre, rol, email, telefono')
    .eq('email', email)
    .eq('activo', true)
    .maybeSingle();
  if (error) throw error;
  return data as WorkerProfile | null;
}

export async function loadWorkerJobs(workerId: string, orgId: string): Promise<TradeJob[]> {
  const { data, error } = await supabase
    .from('trade_jobs')
    .select('*, trade_clients(nombre, telefono), trade_job_workers!inner(id, worker_id, rol)')
    .eq('org_id', orgId)
    .eq('trade_job_workers.worker_id', workerId)
    .neq('estado', 'cancelado')
    .order('fecha_inicio', { ascending: true })
    .order('hora_inicio', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TradeJob[];
}

export async function workerSetJobStatus(
  jobId: string,
  workerId: string,
  estado: TradeJob['estado'],
  notas?: string,
): Promise<void> {
  const updates: Partial<TradeJob> = { estado };
  if (estado === 'completado') {
    updates.completado_por = workerId;
    updates.completado_at = new Date().toISOString();
    if (notas) updates.notas_cierre = notas;
  }
  const { error } = await supabase.from('trade_jobs').update(updates).eq('id', jobId);
  if (error) throw error;
}

// ── Job Photos (trade_job_photos) ─────────────────────────────────────────────

export interface TradeJobPhoto {
  id: string;
  job_id: string;
  org_id: string;
  uploaded_by_worker_id?: string | null;
  photo_url: string;
  caption?: string | null;
  created_at: string;
}

export async function loadOrgClients(orgId: string): Promise<TradeClient[]> {
  const { data, error } = await supabase
    .from('trade_clients')
    .select('id, org_id, nombre, telefono')
    .eq('org_id', orgId)
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as TradeClient[];
}

export async function loadOrgWorkers(orgId: string): Promise<WorkerProfile[]> {
  const { data, error } = await supabase
    .from('trade_workers')
    .select('id, org_id, nombre, rol, email, telefono')
    .eq('org_id', orgId)
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as WorkerProfile[];
}

export async function loadJobPhotos(jobId: string): Promise<TradeJobPhoto[]> {
  const { data, error } = await supabase
    .from('trade_job_photos')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TradeJobPhoto[];
}

export async function uploadJobPhoto(
  jobId: string,
  file: File,
  workerId: string,
  orgId: string,
): Promise<TradeJobPhoto> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${orgId}/${jobId}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('trade-job-photos')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;
  const { data: { publicUrl } } = supabase.storage.from('trade-job-photos').getPublicUrl(path);
  const { data, error } = await supabase
    .from('trade_job_photos')
    .insert({ job_id: jobId, org_id: orgId, uploaded_by_worker_id: workerId, photo_url: publicUrl })
    .select()
    .single();
  if (error) throw error;
  return data as TradeJobPhoto;
}

export async function workerCreateJob(
  orgId: string,
  workerId: string,
  draft: Omit<TradeJob, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'trade_clients' | 'trade_job_workers'>,
): Promise<TradeJob> {
  const job = await createJob(orgId, draft);
  await assignWorkerToJob(job.id, workerId, 'responsable');
  return job;
}

// ── Admin: Platform Invoices ──────────────────────────────────────────────────

export interface TradePlatformInvoice {
  id: string;
  org_id: string;
  period_start: string;
  period_end: string;
  amount_cents: number;
  status: 'draft' | 'sent' | 'paid';
  stripe_invoice_id?: string;
  notes?: string;
  paid_at?: string;
  created_at: string;
}

export async function loadAdminStats(): Promise<{ orgs: AdminOrgRow[]; subscriptions: TradeSubscription[] }> {
  const orgs = await getAdminOrgs();
  const subscriptions = orgs.map(o => o.subscription).filter(Boolean) as TradeSubscription[];
  return { orgs, subscriptions };
}

export async function loadPlatformInvoices(): Promise<TradePlatformInvoice[]> {
  const { data, error } = await supabase.rpc('admin_get_platform_invoices');
  if (error) throw error;
  return (data ?? []) as TradePlatformInvoice[];
}

export async function adminMarkInvoicePaid(invoiceId: string): Promise<void> {
  const { error } = await supabase
    .from('trade_platform_invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', invoiceId);
  if (error) throw error;
}

export async function setSubscriptionActive(orgId: string, active: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_subscription_active', {
    p_org_id: orgId,
    p_active: active,
  });
  if (error) throw error;
}

export async function loadOrgById(orgId: string): Promise<TradeOrganization | null> {
  const { data } = await supabase.from('trade_organizations').select('*').eq('id', orgId).maybeSingle();
  return data ?? null;
}

export async function loadOrgSubscription(orgId: string): Promise<TradeSubscription | null> {
  const { data } = await supabase
    .from('trade_subscriptions')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();
  return data ?? null;
}

// ── Equipo (miembros de la org) ───────────────────────────────────────────────

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  email: string;
  rol: 'owner' | 'admin' | 'comercial' | 'tecnico' | 'visualizador';
  activo: boolean;
  invited_at: string | null;
  created_at: string;
}

export async function loadOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from('trade_org_members')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as OrgMember[];
}

export async function updateMemberRol(memberId: string, rol: string): Promise<void> {
  const { error } = await supabase
    .from('trade_org_members')
    .update({ rol })
    .eq('id', memberId);
  if (error) throw error;
}

export async function revokeMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('trade_org_members')
    .delete()
    .eq('id', memberId);
  if (error) throw error;
}

// ── Push notifications ────────────────────────────────────────────────────────


function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export async function subscribePush(workerId: string, orgId: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidKey) return false;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) await existing.unsubscribe();

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
  });

  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.from('trade_push_subscriptions').upsert({
    worker_id: workerId,
    org_id: orgId,
    endpoint: json.endpoint,
    subscription: json,
  }, { onConflict: 'worker_id,endpoint' });

  return !error;
}

export async function unsubscribePush(workerId: string): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await sub.unsubscribe();
    await supabase.from('trade_push_subscriptions').delete().eq('worker_id', workerId);
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

export async function getStripePortalUrl(orgId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('No autenticado');

  const res = await supabase.functions.invoke('trade-stripe-portal', {
    body: { org_id: orgId, return_url: window.location.origin },
  });
  if (res.error) throw new Error(res.error.message ?? 'Error portal Stripe');
  const data = res.data as { url?: string; error?: string };
  if (data.error) throw new Error(data.error);
  return data.url!;
}

export async function getStripeCheckoutUrl(orgId: string, plan?: string, billingCycle?: string): Promise<string> {
  const res = await supabase.functions.invoke('trade-stripe-checkout', {
    body: {
      org_id:        orgId,
      plan:          plan,
      billing_cycle: billingCycle,
      success_url:   `${window.location.origin}/?checkout=success`,
      cancel_url:    `${window.location.origin}/`,
    },
  });
  if (res.error) throw new Error(res.error.message ?? 'Error checkout Stripe');
  const data = res.data as { url?: string; error?: string };
  if (data.error) throw new Error(data.error);
  return data.url!;
}

// ── CRM Waitlist ───────────────────────────────────────────────────────────

// ── Admin: notas internas ──────────────────────────────────────────────────

export async function adminLoadNotes(orgId: string): Promise<AdminSupportNote[]> {
  const { data } = await supabase
    .from('admin_support_notes')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  return (data ?? []) as AdminSupportNote[];
}

export async function adminAddNote(orgId: string, body: string, adminEmail: string): Promise<void> {
  const { error } = await supabase
    .from('admin_support_notes')
    .insert({ org_id: orgId, body, admin_email: adminEmail });
  if (error) throw error;
}

export async function adminDeleteNote(noteId: string): Promise<void> {
  const { error } = await supabase.from('admin_support_notes').delete().eq('id', noteId);
  if (error) throw error;
}

// ── Admin: log de acciones ─────────────────────────────────────────────────

export async function adminLogAction(
  action: string,
  targetOrgId: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('admin_activity_log').insert({
    admin_email: user.email ?? 'admin',
    action,
    target_org_id: targetOrgId,
    metadata: metadata ?? null,
  });
}

export async function adminLoadActivityLog(orgId: string): Promise<AdminActivityLog[]> {
  const { data } = await supabase
    .from('admin_activity_log')
    .select('*')
    .eq('target_org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(30);
  return (data ?? []) as AdminActivityLog[];
}

// ── Admin: flags de org ────────────────────────────────────────────────────

export async function adminSetOrgFlag(
  orgId: string,
  flag: 'churn_risk' | 'vip',
  value: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('trade_organizations')
    .update({ [flag]: value, updated_at: new Date().toISOString() })
    .eq('id', orgId);
  if (error) throw error;
}

// ── Admin: automatizaciones ────────────────────────────────────────────────

export interface AdminAutoConfig {
  ntfy_topic: string;
  churn_auto_enabled: string;
  trial_reminder_days: string;
  last_churn_run: string;
  last_trial_check: string;
}

export interface TrialExpiringSoon {
  org_id: string;
  org_nombre: string;
  owner_email: string;
  days_left: number;
}

export async function adminLoadAutoConfig(): Promise<AdminAutoConfig> {
  const { data } = await supabase.from('admin_automation_config').select('key, value');
  const cfg: Record<string, string> = {};
  for (const row of (data ?? []) as { key: string; value: string }[]) cfg[row.key] = row.value;
  return {
    ntfy_topic:          cfg.ntfy_topic          ?? '',
    churn_auto_enabled:  cfg.churn_auto_enabled  ?? 'true',
    trial_reminder_days: cfg.trial_reminder_days ?? '3',
    last_churn_run:      cfg.last_churn_run      ?? '',
    last_trial_check:    cfg.last_trial_check    ?? '',
  };
}

export async function adminSaveAutoConfig(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('admin_automation_config')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function adminGetTrialsExpiringSoon(daysAhead = 3): Promise<TrialExpiringSoon[]> {
  const { data, error } = await supabase.rpc('get_trials_expiring_soon', { days_ahead: daysAhead });
  if (error) throw error;
  return (data ?? []) as TrialExpiringSoon[];
}

export async function adminRunChurnRiskNow(): Promise<void> {
  const { error } = await supabase.rpc('auto_update_churn_risk');
  if (error) throw error;
}

export async function adminLoadWeeklyQuotes(weeks = 8): Promise<Array<{ week: string; count: number }>> {
  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);
  const { data } = await supabase
    .from('trade_quotes')
    .select('created_at')
    .gte('created_at', since.toISOString());

  const weekMap = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ created_at: string }>) {
    const d = new Date(row.created_at);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    const key = monday.toISOString().slice(0, 10);
    weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
  }

  const result: Array<{ week: string; count: number }> = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    const key = monday.toISOString().slice(0, 10);
    result.push({ week: key, count: weekMap.get(key) ?? 0 });
  }
  return result;
}

export async function adminLoadWaitlist(): Promise<TradeWaitlistLead[]> {
  const { data, error } = await supabase.rpc('admin_get_waitlist_leads');
  if (error) throw error;
  return (data ?? []) as TradeWaitlistLead[];
}

export async function adminUpdateWaitlistLead(
  id: string,
  updates: Partial<Pick<TradeWaitlistLead, 'estado' | 'notas' | 'prioridad' | 'contacted_at' | 'converted_at'>>,
): Promise<void> {
  const { error } = await supabase.from('trade_waitlist').update(updates).eq('id', id);
  if (error) throw error;
}

export async function adminDeleteWaitlistLead(id: string): Promise<void> {
  const { error } = await supabase.from('trade_waitlist').delete().eq('id', id);
  if (error) throw error;
}

export async function adminConvertLeadToInstaller(
  lead: TradeWaitlistLead,
  params: {
    email: string;
    password: string;
    plan: TradeSubscription['plan'];
    billing_cycle: TradeSubscription['billing_cycle'];
    trial_days: number;
  },
): Promise<{ user_id: string; org_id: string }> {
  const result = await adminCreateInstaller({
    email: params.email,
    password: params.password,
    nombre: lead.nombre,
    company_name: lead.nombre,
    oficio: lead.oficio || 'Otros',
    plan: params.plan,
    billing_cycle: params.billing_cycle,
    telefono: lead.telefono,
    trial_days: params.trial_days,
  });

  await Promise.all([
    supabase.from('trade_waitlist').update({
      estado: 'convertido',
      converted_at: new Date().toISOString(),
    }).eq('id', lead.id),
    supabase.from('trade_organizations').update({ lead_id: lead.id }).eq('id', result.org_id),
  ]);

  return result;
}

// ── Admin: sugerencias catálogo global ────────────────────────────────────────

export interface TradeCatalogSuggestion {
  id: string;
  org_id: string;
  descripcion: string;
  oficio?: string;
  familia?: string;
  unidad: string;
  precio_indicado?: number;
  origen: 'voz' | 'foto' | 'manual';
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'fusionado';
  notas_admin?: string;
  global_catalog_id?: string;
  created_at: string;
  // joined
  org_nombre?: string;
}

export async function adminLoadCatalogSuggestions(estado?: string): Promise<TradeCatalogSuggestion[]> {
  let q = supabase
    .from('trade_catalog_suggestions')
    .select('*, trade_organizations(nombre_empresa)')
    .order('created_at', { ascending: false });
  if (estado && estado !== 'todos') q = q.eq('estado', estado);
  const { data } = await q;
  return ((data ?? []) as unknown[]).map((r: unknown) => {
    const row = r as Record<string, unknown>;
    const org = row['trade_organizations'] as Record<string, unknown> | null;
    return { ...row, org_nombre: org?.nombre_empresa ?? '—' } as TradeCatalogSuggestion;
  });
}

export async function adminUpdateCatalogSuggestion(
  id: string,
  updates: { estado: TradeCatalogSuggestion['estado']; notas_admin?: string },
): Promise<void> {
  await supabase.from('trade_catalog_suggestions').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
}

export async function adminApproveSuggestionToGlobal(suggestion: TradeCatalogSuggestion): Promise<void> {
  // Inserta en trade_global_catalog si no existe ya
  const oficio = suggestion.oficio ?? 'General';
  const familia = suggestion.familia ?? 'General';
  const codigo = `SUG-${Date.now()}`;
  const { data: inserted } = await supabase
    .from('trade_global_catalog')
    .insert({
      oficio, familia, codigo,
      descripcion: suggestion.descripcion,
      unidad: suggestion.unidad ?? 'ud',
      precio_referencia: suggestion.precio_indicado ?? 0,
    })
    .select('id')
    .maybeSingle();

  await supabase.from('trade_catalog_suggestions').update({
    estado: 'aprobado',
    global_catalog_id: inserted?.id ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', suggestion.id);
}

// ── Catálogo: aprender precio de una partida IA ───────────────────────────────

export async function learnPriceToCatalog(
  orgId: string,
  descripcion: string,
  precioVenta: number,
  tipo: 'material' | 'mano_de_obra',
  origen: 'voz' | 'foto' | 'manual' = 'manual',
): Promise<void> {
  if (!precioVenta || precioVenta <= 0) return;

  const nombre = descripcion.trim().slice(0, 120);
  if (!nombre) return;

  // Buscar producto existente con nombre similar (exact ilike)
  const { data: existing } = await supabase
    .from('trade_catalog_products')
    .select('id')
    .eq('org_id', orgId)
    .ilike('nombre_generico', nombre)
    .limit(1)
    .maybeSingle();

  let productId: string;

  if (existing?.id) {
    productId = existing.id;
  } else {
    const { data: created, error } = await supabase
      .from('trade_catalog_products')
      .insert({
        org_id: orgId,
        oficio: 'General',
        familia: tipo === 'mano_de_obra' ? 'Mano de obra' : 'Material',
        nombre_generico: nombre,
        unidad: tipo === 'mano_de_obra' ? 'h' : 'ud',
        activo: true,
      })
      .select('id')
      .single();
    if (error || !created) return;
    productId = created.id;
  }

  // Añadir variante con precio. margen_pct=0 → precio_venta = precio_material
  await supabase.from('trade_catalog_variants').insert({
    product_id: productId,
    org_id: orgId,
    marca: 'Manual',
    precio_material: precioVenta,
    precio_mano_obra: tipo === 'mano_de_obra' ? precioVenta : 0,
    margen_pct: 0,
    calidad: 'medio' as const,
    is_preferred: true,
    activo: true,
  });

  // Sugerir al catálogo global para revisión del admin
  await supabase.from('trade_catalog_suggestions').insert({
    org_id: orgId,
    descripcion: nombre,
    familia: tipo === 'mano_de_obra' ? 'Mano de obra' : 'Material',
    unidad: tipo === 'mano_de_obra' ? 'h' : 'ud',
    precio_indicado: precioVenta,
    origen,
    estado: 'pendiente',
  }).then(() => {/* fire-and-forget */});
}
