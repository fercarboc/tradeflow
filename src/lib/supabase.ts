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
  // Datos de auth (rellenados por admin_get_trade_users RPC)
  auth_email?: string;
  email_confirmed?: boolean;
  last_sign_in?: string;
  user_created_at?: string;
  // Estadísticas de uso
  quotes_count?: number;
  clients_count?: number;
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
  const [orgsRes, authRes, quotesRes, clientsRes] = await Promise.all([
    supabase
      .from('trade_organizations')
      .select('*, trade_subscriptions(*)')
      .order('created_at', { ascending: false }),
    supabase.rpc('admin_get_trade_users'),
    supabase.from('trade_quotes').select('org_id'),
    supabase.from('trade_clients').select('org_id'),
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
  type: 'waitlist_admin' | 'waitlist_confirm' | 'welcome';
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
 * Devuelve el producto + variante preferida más similar, o null si no hay match.
 */
export function matchProductForAI(
  detectedText: string,
  catalog: TradeCatalogProduct[],
): { product: TradeCatalogProduct; variant: TradeCatalogVariant } | null {
  const lower = detectedText.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  let bestProduct: TradeCatalogProduct | null = null;
  let bestScore = 0;

  for (const product of catalog) {
    const nombre = product.nombre_generico.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const familia = product.familia.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    // Tokeniza ambos y calcula solapamiento
    const tokensQuery = lower.split(/\s+/).filter(t => t.length > 2);
    const tokensNombre = nombre.split(/\s+/).filter(t => t.length > 2);
    const tokensAll = [...tokensNombre, ...familia.split(/\s+/).filter(t => t.length > 2)];

    let matches = 0;
    for (const tq of tokensQuery) {
      if (tokensAll.some(tn => tn.includes(tq) || tq.includes(tn))) matches++;
    }

    // También chequeamos coincidencia exacta de subcadena
    const substringBonus = nombre.includes(lower.slice(0, 8)) || lower.includes(nombre.slice(0, 8)) ? 2 : 0;
    const score = matches + substringBonus;

    if (score > bestScore) {
      bestScore = score;
      bestProduct = product;
    }
  }

  if (!bestProduct || bestScore === 0) return null;

  const preferred = bestProduct.trade_catalog_variants?.find(v => v.is_preferred && v.activo)
    ?? bestProduct.trade_catalog_variants?.find(v => v.activo)
    ?? null;

  if (!preferred) return null;

  return { product: bestProduct, variant: preferred };
}
