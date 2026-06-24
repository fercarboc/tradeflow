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
  referral_code?: string;
  referred_by_code?: string;
  iban?: string;
  banco?: string;
  titular_cuenta?: string;
  base_latitud?: number | null;
  base_longitud?: number | null;
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
  supplier_key?: string | null;
  supplier_name?: string | null;
  supplier_ref?: string | null;
  precio_material?: number | null;
  catalog_variant_id?: string | null;
  material_order_placed?: boolean;
  created_at: string;
}

export interface TradeInvoice {
  id: string;
  org_id: string;
  quote_id?: string | null;
  client_id?: string | null;
  job_id?: string | null;
  contract_id?: string | null;
  numero: string;
  fecha: string;
  fecha_vencimiento?: string;
  estado: 'Borrador' | 'Emitida' | 'Enviada' | 'Pendiente' | 'Pagada' | 'Vencida' | 'Devuelta' | 'Cancelada';
  subtotal: number;
  iva_pct: number;
  iva_importe: number;
  total: number;
  concepto?: string | null;
  es_suplementaria?: boolean;
  paid_at?: string;
  devuelta_at?: string | null;
  devuelta_motivo?: string | null;
  // Nuevos campos (análisis facturación)
  tipo_factura?: 'contrato_cuota' | 'contrato_extra' | 'trabajo_puntual' | 'rectificativa';
  serie?: 'F' | 'M' | 'R' | null;
  mes_facturacion?: string | null;
  metodo_pago?: 'transferencia' | 'efectivo' | 'bizum' | 'tarjeta' | 'domiciliacion' | null;
  fecha_emision?: string | null;
  razon_social_cliente?: string | null;
  nif_cliente?: string | null;
  direccion_cliente?: string | null;
  notas_internas?: string | null;
  rectifica_factura_id?: string | null;
  motivo_rectificacion?: string | null;
  factura_original_id?: string | null;
  // VeriFactu (RD 1007/2023)
  verifactu_hash?: string | null;
  verifactu_hash_anterior?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TradeInvoiceLine {
  id: string;
  factura_id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento_pct: number;
  subtotal: number;
  orden: number;
  tipo: 'material' | 'mano_de_obra' | 'desplazamiento' | 'otro';
  created_at: string;
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
  plan: 'basico' | 'profesional' | 'empresa' | 'empresa_plus';
  billing_cycle: 'monthly' | 'yearly';
  status: 'trial' | 'active' | 'cancelled' | 'expired';
  trial_start: string;
  trial_end: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  current_period_start?: string;
  current_period_end?: string;
  cancelled_at?: string;
  scheduled_plan?: string | null;
  scheduled_at?: string | null;
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

  // Before creating a new org, check if this user was invited to an existing org.
  // Activate any pending invitation first (activo: false → true), then look it up.
  await supabase
    .from('trade_org_members')
    .update({ activo: true })
    .eq('user_id', user.id)
    .eq('activo', false);

  const { data: membership } = await supabase
    .from('trade_org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('activo', true)
    .maybeSingle();

  if (membership?.org_id) {
    const { data: memberOrg } = await supabase
      .from('trade_organizations')
      .select('*')
      .eq('id', membership.org_id)
      .maybeSingle();
    if (memberOrg) return memberOrg;
  }

  // Create from user metadata written during self-registration wizard
  const meta = user.user_metadata ?? {};
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 15);

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

  if (error || !created) {
    // Race condition: another concurrent call already inserted — fetch existing
    if (error?.code === '23505') {
      const { data: retry } = await supabase
        .from('trade_organizations')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();
      return retry ?? null;
    }
    return null;
  }

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
  plan: 'basico' | 'profesional' | 'empresa' | 'empresa_plus';
  billingCycle: 'monthly' | 'yearly';
}): Promise<{ error: string | null; needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      emailRedirectTo: 'https://www.trabflow.com/auth/callback',
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

  if (error) return { error: error.message, needsConfirmation: false };

  // If session is available (email confirmation disabled), create org immediately
  if (data.session && data.user) {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 15);

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

  return { error: null, needsConfirmation: !data.session };
}

export type EmailCheckResult =
  | { exists: false }
  | { exists: true; type: 'owner' | 'tecnico' | 'orphan'; org_nombre?: string };

export async function checkEmailForRegistration(email: string): Promise<EmailCheckResult> {
  const { data, error } = await supabase.rpc('check_email_for_registration', { p_email: email.trim().toLowerCase() });
  if (error || !data) return { exists: false };
  return data as EmailCheckResult;
}

export async function createOrgForExistingUser(params: {
  userId: string;
  email: string;
  fullName: string;
  companyName?: string;
  phone?: string;
  tradeTypes: string[];
  plan: 'basico' | 'profesional' | 'empresa' | 'empresa_plus';
  billingCycle: 'monthly' | 'yearly';
}): Promise<{ error: string | null }> {
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 15);

  const { data: org, error: orgErr } = await supabase
    .from('trade_organizations')
    .insert({
      owner_id: params.userId,
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

  if (orgErr) return { error: orgErr.message };

  await supabase.from('trade_subscriptions').insert({
    org_id: org.id,
    plan: params.plan,
    billing_cycle: params.billingCycle,
    status: 'trial',
    trial_start: new Date().toISOString(),
    trial_end: trialEnd.toISOString(),
  });
  await supabase.rpc('seed_org_catalog', { new_org_id: org.id });

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
  plan: 'basico' | 'profesional' | 'empresa' | 'empresa_plus';
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
  plan: 'basico' | 'profesional' | 'empresa' | 'empresa_plus',
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
  items: Pick<TradeQuoteItem, 'descripcion' | 'tipo' | 'cantidad' | 'precio_unitario' | 'precio_material' | 'supplier_key' | 'supplier_name' | 'supplier_ref' | 'catalog_variant_id'>[],
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
  const year = new Date().getFullYear();

  // Contar solo facturas serie F (trabajo puntual) para numeración correlativa
  const { count } = await supabase
    .from('trade_invoices')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('serie', 'F')
    .neq('estado', 'Borrador');

  const numero = `F-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`;
  const due = new Date();
  due.setDate(due.getDate() + 30);
  const today = new Date().toISOString().split('T')[0];

  const ivaPct = quote.iva_pct ?? 21;
  const subtotal = quote.total_neto ?? 0;
  const ivaImporte = Math.round(subtotal * ivaPct) / 100;
  const total = subtotal + ivaImporte;

  const { data: inv, error } = await supabase
    .from('trade_invoices')
    .insert({
      org_id: orgId,
      quote_id: quote.id,
      client_id: quote.client_id ?? null,
      numero,
      serie: 'F',
      tipo_factura: 'trabajo_puntual',
      estado: 'Emitida',
      subtotal,
      iva_pct: ivaPct,
      fecha: today,
      fecha_emision: today,
      fecha_vencimiento: due.toISOString().split('T')[0],
      concepto: quote.descripcion ?? null,
      razon_social_cliente: (quote as unknown as Record<string,unknown>).nombre_cliente as string ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  await supabase.from('trade_quotes').update({ estado: 'Facturado' }).eq('id', quote.id);
  return inv as TradeInvoice;
}

export async function createInvoiceFromJob(
  orgId: string,
  jobId: string,
  clientId: string | null | undefined,
  materiales: { descripcion: string; cantidad: number; precioBase: number; tipo?: string }[],
  opts: {
    ivaPct?: number;
    concepto?: string;
    esSuplementaria?: boolean;
    contractId?: string | null;
    metodoPago?: TradeInvoice['metodo_pago'];
    razonSocial?: string;
    nifCliente?: string;
    direccionCliente?: string;
  } = {},
): Promise<TradeInvoice> {
  const { ivaPct = 21, concepto, esSuplementaria = false, contractId, metodoPago, razonSocial, nifCliente, direccionCliente } = opts;

  const serie: 'F' | 'M' = contractId ? 'M' : 'F';
  const tipo_factura = contractId ? (esSuplementaria ? 'contrato_extra' : 'contrato_cuota') : 'trabajo_puntual';
  const today = new Date().toISOString().split('T')[0];
  const subtotal = materiales.reduce((s, m) => s + m.precioBase * m.cantidad, 0);
  const ivaImporte = Math.round(subtotal * ivaPct) / 100;
  const total = subtotal + ivaImporte;

  // Borrador: sin número definitivo todavía (se asigna al emitir)
  const tempNumero = `BORRADOR-${Date.now()}`;

  const { data: inv, error } = await supabase
    .from('trade_invoices')
    .insert({
      org_id: orgId,
      client_id: clientId ?? null,
      job_id: jobId || null,
      contract_id: contractId ?? null,
      numero: tempNumero,
      fecha: today,
      estado: 'Borrador',
      subtotal,
      iva_pct: ivaPct,
      concepto: concepto ?? null,
      es_suplementaria: esSuplementaria,
      serie,
      tipo_factura,
      metodo_pago: metodoPago ?? null,
      razon_social_cliente: razonSocial ?? null,
      nif_cliente: nifCliente ?? null,
      direccion_cliente: direccionCliente ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  // Crear líneas de detalle
  if (materiales.length) {
    await createInvoiceLines(inv.id, materiales.map((m, i) => ({
      descripcion: m.descripcion,
      cantidad: m.cantidad,
      precio_unitario: m.precioBase,
      tipo: m.tipo ?? 'material',
      orden: i,
    })));
  }

  return inv as TradeInvoice;
}

export async function loadInvoicesByJobId(jobId: string): Promise<TradeInvoice[]> {
  const { data, error } = await supabase
    .from('trade_invoices')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TradeInvoice[];
}

export async function checkClientMaintenanceContract(
  orgId: string,
  clientId: string | null | undefined,
): Promise<{ activo: boolean; materialesIncluidos: boolean; nombre: string | null } | null> {
  if (!clientId) return null;
  const { data } = await supabase
    .from('trade_maintenance_contratos')
    .select('id, materiales_incluidos, nombre_cliente, estado')
    .eq('org_id', orgId)
    .eq('client_id', clientId)
    .eq('estado', 'activo')
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { activo: true, materialesIncluidos: data.materiales_incluidos as boolean, nombre: data.nombre_cliente as string | null };
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
  // Campos módulo rutas
  especialidades?: string[];
  home_lat?: number | null;
  home_lng?: number | null;
  max_trabajos_dia?: number;
  buffer_desplazamiento_min?: number;
  tiene_vehiculo?: boolean;
  zona_operacion?: string[];
  avatar_url?: string | null;
  estado_actual?: 'disponible' | 'ocupado' | 'libre' | 'inactivo';
  horario_inicio?: string;
  horario_fin?: string;
  created_at: string;
  updated_at: string;
}

export interface TradeWorkerSchedule {
  id: string;
  worker_id: string;
  org_id: string;
  dia_semana: number;
  activo: boolean;
  hora_inicio: string;
  hora_fin: string;
  descanso_inicio?: string | null;
  descanso_fin?: string | null;
}

export interface TradeRoute {
  id: string;
  org_id: string;
  worker_id: string;
  fecha: string;
  estado: 'borrador' | 'confirmada' | 'en_curso' | 'completada' | 'cancelada';
  punto_inicio_lat?: number | null;
  punto_inicio_lng?: number | null;
  distancia_total_km?: number | null;
  duracion_total_min?: number | null;
  hora_inicio_estimada?: string | null;
  hora_fin_estimada?: string | null;
  optimization_score?: number | null;
  notas?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  trade_workers?: { nombre: string } | null;
}

export interface TradeRouteStop {
  id: string;
  route_id: string;
  job_id: string;
  orden: number;
  hora_llegada_estimada?: string | null;
  hora_salida_estimada?: string | null;
  hora_llegada_real?: string | null;
  hora_salida_real?: string | null;
  tiempo_viaje_siguiente_min?: number | null;
  distancia_siguiente_km?: number | null;
  estado: 'pendiente' | 'en_camino' | 'llegado' | 'en_curso' | 'completado' | 'saltado';
  created_at: string;
  trade_jobs?: Pick<TradeJob, 'id' | 'titulo' | 'direccion' | 'localidad' | 'estado'> | null;
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
  client: Pick<TradeClient, 'nombre'> & Partial<Pick<TradeClient, 'telefono' | 'email' | 'direccion' | 'nif' | 'ciudad'>>,
): Promise<TradeClient> {
  const { data, error } = await supabase
    .from('trade_clients')
    .insert({ org_id: orgId, ...client })
    .select()
    .single();
  if (error) throw error;
  return data as TradeClient;
}

export async function loadClients(orgId: string): Promise<TradeClient[]> {
  const { data, error } = await supabase
    .from('trade_clients')
    .select('*')
    .eq('org_id', orgId)
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as TradeClient[];
}

export async function updateClient(
  id: string,
  data: Partial<Pick<TradeClient, 'nombre' | 'telefono' | 'email' | 'direccion' | 'ciudad' | 'nif' | 'notas'>>,
): Promise<void> {
  const { error } = await supabase.from('trade_clients').update(data).eq('id', id);
  if (error) throw error;
}

// ── Facturas ──────────────────────────────────────────────────────────────

export async function markInvoicePaid(id: string, paidAt?: string): Promise<void> {
  const { error } = await supabase
    .from('trade_invoices')
    .update({ estado: 'Pagada', paid_at: paidAt ?? new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function markInvoiceDevuelta(id: string, motivo?: string): Promise<void> {
  const { error } = await supabase
    .from('trade_invoices')
    .update({ estado: 'Devuelta', devuelta_at: new Date().toISOString(), devuelta_motivo: motivo ?? null })
    .eq('id', id);
  if (error) throw error;
}

// ── Líneas de factura ─────────────────────────────────────────────────────

export async function loadInvoiceLines(facturaId: string): Promise<TradeInvoiceLine[]> {
  const { data, error } = await supabase
    .from('trade_invoice_lines')
    .select('*')
    .eq('factura_id', facturaId)
    .order('orden');
  if (error) throw error;
  return (data ?? []) as TradeInvoiceLine[];
}

export async function createInvoiceLines(
  facturaId: string,
  lines: Array<{ descripcion: string; cantidad: number; precio_unitario: number; tipo?: string; orden?: number }>,
): Promise<void> {
  if (!lines.length) return;
  const rows = lines.map((l, i) => ({
    factura_id: facturaId,
    descripcion: l.descripcion,
    cantidad: l.cantidad,
    precio_unitario: l.precio_unitario,
    subtotal: Math.round(l.precio_unitario * l.cantidad * 100) / 100,
    tipo: l.tipo ?? 'material',
    orden: l.orden ?? i,
  }));
  const { error } = await supabase.from('trade_invoice_lines').insert(rows);
  if (error) throw error;
}

// ── VeriFactu — Huella digital (RD 1007/2023) ─────────────────────────────
// Input: CIF;NumFactura;FechaDD-MM-YYYY;TipoFactura;CuotaIVA;Total;HashAnterior
// Output: SHA-256 en hexadecimal mayúsculas

export async function computeVeriFactuHash(
  cif: string,
  numero: string,
  fechaDDMMYYYY: string,
  tipoFactura: string,
  cuotaIVA: number,
  total: number,
  hashAnterior: string,
): Promise<string> {
  const input = [cif, numero, fechaDDMMYYYY, tipoFactura,
    cuotaIVA.toFixed(2), total.toFixed(2), hashAnterior].join(';');
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export async function emitirFactura(id: string, orgId: string): Promise<TradeInvoice> {
  const year = new Date().getFullYear();
  const { data: inv } = await supabase.from('trade_invoices')
    .select('serie, tipo_factura, subtotal, iva_importe, total, iva_pct')
    .eq('id', id).single();
  const serie = inv?.serie ?? 'F';

  const { count } = await supabase
    .from('trade_invoices')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('serie', serie)
    .neq('estado', 'Borrador');

  const numero = `${serie}-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`;
  const now = new Date().toISOString();
  const fechaEmision = now.split('T')[0];
  const due = new Date(); due.setDate(due.getDate() + 30);

  // Obtener hash de la factura anterior (encadenamiento VeriFactu)
  const { data: prevInv } = await supabase
    .from('trade_invoices')
    .select('verifactu_hash')
    .eq('org_id', orgId)
    .eq('serie', serie)
    .not('verifactu_hash', 'is', null)
    .neq('estado', 'Borrador')
    .order('fecha_emision', { ascending: false })
    .limit(1)
    .maybeSingle();

  const hashAnterior = prevInv?.verifactu_hash ?? '0';

  // Calcular huella VeriFactu
  const [dd, mm] = fechaEmision.split('-').reverse(); // AAAA-MM-DD → DD, MM
  const fechaVF = `${dd}-${mm}-${year}`;
  const tipoVF = serie === 'M' ? 'F2' : 'F1'; // F1=normal, F2=mantenimiento
  const ivaImporte = inv?.iva_importe ?? (inv?.subtotal ?? 0) * ((inv?.iva_pct ?? 21) / 100);
  const totalInv = inv?.total ?? 0;

  // Necesitamos el CIF del emisor — lo obtenemos de la org
  const { data: orgData } = await supabase
    .from('trade_organizations')
    .select('nif')
    .eq('id', orgId)
    .single();
  const cif = orgData?.nif ?? 'UNKNOWN';

  const verifactuHash = await computeVeriFactuHash(cif, numero, fechaVF, tipoVF, ivaImporte, totalInv, hashAnterior);

  const { data, error } = await supabase
    .from('trade_invoices')
    .update({
      estado: 'Emitida',
      numero,
      fecha: fechaEmision,
      fecha_emision: now,
      fecha_vencimiento: due.toISOString().split('T')[0],
      verifactu_hash: verifactuHash,
      verifactu_hash_anterior: hashAnterior === '0' ? null : hashAnterior,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as TradeInvoice;
}

export async function loadAllInvoices(orgId: string): Promise<TradeInvoice[]> {
  const { data, error } = await supabase
    .from('trade_invoices')
    .select('*, trade_clients(nombre, telefono)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TradeInvoice[];
}

export async function loadInvoicesByClientId(clientId: string, orgId: string): Promise<TradeInvoice[]> {
  const { data, error } = await supabase
    .from('trade_invoices')
    .select('*, trade_clients(nombre)')
    .eq('org_id', orgId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TradeInvoice[];
}

export async function anularPago(id: string): Promise<void> {
  const { error } = await supabase
    .from('trade_invoices')
    .update({ estado: 'Emitida', paid_at: null, metodo_pago: null })
    .eq('id', id);
  if (error) throw error;
}

export async function markInvoicePendiente(id: string): Promise<void> {
  const { error } = await supabase
    .from('trade_invoices')
    .update({ estado: 'Pendiente' })
    .eq('id', id);
  if (error) throw error;
}

export async function crearFacturaRectificadora(
  originalId: string,
  orgId: string,
): Promise<TradeInvoice> {
  const { data: orig, error: origErr } = await supabase
    .from('trade_invoices')
    .select('*')
    .eq('id', originalId)
    .single();
  if (origErr || !orig) throw origErr ?? new Error('Factura original no encontrada');

  const { data: lines } = await supabase
    .from('trade_invoice_lines')
    .select('*')
    .eq('factura_id', originalId)
    .order('orden');

  const now = new Date().toISOString();
  const { data: newInv, error: invErr } = await supabase
    .from('trade_invoices')
    .insert({
      org_id: orgId,
      client_id: orig.client_id,
      tipo_factura: 'rectificativa',
      serie: orig.serie,
      estado: 'Borrador',
      numero: `BORRADOR-rect-${Date.now()}`,
      concepto: `Rectificativa de ${orig.numero ?? orig.id}`,
      subtotal: -(orig.subtotal ?? 0),
      iva_pct: orig.iva_pct ?? 21,
      razon_social_cliente: orig.razon_social_cliente,
      nif_cliente: orig.nif_cliente,
      direccion_cliente: orig.direccion_cliente,
      factura_original_id: originalId,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (invErr) throw invErr;

  if (lines?.length) {
    await supabase.from('trade_invoice_lines').insert(
      lines.map((l: TradeInvoiceLine) => ({
        factura_id: newInv.id,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precio_unitario: -(l.precio_unitario ?? 0),
        subtotal: -(l.subtotal ?? 0),
        tipo: l.tipo,
        orden: l.orden,
      })),
    );
  }

  return newInv as TradeInvoice;
}

// ── Rutas y paradas ───────────────────────────────────────────────────────

export async function loadRoutes(orgId: string, fecha?: string): Promise<TradeRoute[]> {
  let q = supabase
    .from('trade_routes')
    .select('*, trade_workers(nombre)')
    .eq('org_id', orgId)
    .order('fecha', { ascending: false });
  if (fecha) q = q.eq('fecha', fecha);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TradeRoute[];
}

export async function loadRouteStops(routeId: string): Promise<TradeRouteStop[]> {
  const { data, error } = await supabase
    .from('trade_route_stops')
    .select('*, trade_jobs(id, titulo, direccion, localidad, estado)')
    .eq('route_id', routeId)
    .order('orden');
  if (error) throw error;
  return (data ?? []) as TradeRouteStop[];
}

export async function createRoute(
  orgId: string,
  workerId: string,
  fecha: string,
  jobIds: string[],
): Promise<TradeRoute> {
  const { data: existing } = await supabase
    .from('trade_routes')
    .select('id')
    .eq('worker_id', workerId)
    .eq('fecha', fecha)
    .maybeSingle();

  let routeId: string;
  if (existing) {
    routeId = existing.id;
    await supabase.from('trade_route_stops').delete().eq('route_id', routeId);
  } else {
    const { data: route, error } = await supabase
      .from('trade_routes')
      .insert({ org_id: orgId, worker_id: workerId, fecha, estado: 'borrador' })
      .select()
      .single();
    if (error) throw error;
    routeId = route.id;
  }

  if (jobIds.length) {
    const stops = jobIds.map((jobId, i) => ({ route_id: routeId, job_id: jobId, orden: i + 1 }));
    await supabase.from('trade_route_stops').insert(stops);
  }

  const { data } = await supabase.from('trade_routes').select('*, trade_workers(nombre)').eq('id', routeId).single();
  return data as TradeRoute;
}

export async function updateRouteStop(stopId: string, updates: Partial<TradeRouteStop>): Promise<void> {
  const { error } = await supabase.from('trade_route_stops').update(updates).eq('id', stopId);
  if (error) throw error;
}

// ── Horarios de trabajadores ──────────────────────────────────────────────

export async function loadWorkerSchedules(workerId: string): Promise<TradeWorkerSchedule[]> {
  const { data } = await supabase
    .from('trade_worker_schedules')
    .select('*')
    .eq('worker_id', workerId)
    .order('dia_semana');
  return (data ?? []) as TradeWorkerSchedule[];
}

export async function saveWorkerSchedules(
  workerId: string,
  orgId: string,
  schedules: Omit<TradeWorkerSchedule, 'id' | 'worker_id' | 'org_id'>[],
): Promise<void> {
  await supabase.from('trade_worker_schedules').delete().eq('worker_id', workerId);
  if (!schedules.length) return;
  const rows = schedules.map(s => ({ ...s, worker_id: workerId, org_id: orgId }));
  const { error } = await supabase.from('trade_worker_schedules').insert(rows);
  if (error) throw error;
}

export async function updateWorker(id: string, updates: Partial<Omit<TradeWorker, 'id' | 'org_id' | 'created_at' | 'updated_at'>>): Promise<void> {
  const { error } = await supabase.from('trade_workers').update(updates).eq('id', id);
  if (error) throw error;
}

export async function createMaintenanceInvoices(
  orgId: string,
  contractId: string,
  opts: {
    clientId?: string | null;
    cuotaMensual: number;
    ivaPct: number;
    periodoFacturacion: 'mensual' | 'trimestral' | 'anual';
    duracionMeses: number;
    diaVencimiento: number;
    nombreCliente: string;
    referencia: string;
  },
): Promise<TradeInvoice[]> {
  const { cuotaMensual, ivaPct, periodoFacturacion, duracionMeses, diaVencimiento, nombreCliente, referencia } = opts;

  // Determinar cuántas facturas y cuántos meses por factura
  const mesesPorFactura = periodoFacturacion === 'anual' ? 12 : periodoFacturacion === 'trimestral' ? 3 : 1;
  const numFacturas = Math.ceil(duracionMeses / mesesPorFactura);
  const subtotalFactura = cuotaMensual * mesesPorFactura;
  const ivaImporte = Math.round(subtotalFactura * ivaPct * 100) / 10000;
  const totalFactura = subtotalFactura + ivaImporte;

  // Contar facturas existentes para numeración
  const { count } = await supabase.from('trade_invoices').select('*', { count: 'exact', head: true }).eq('org_id', orgId);
  let contador = (count ?? 0) + 1;

  const hoy = new Date();
  const invoices: TradeInvoice[] = [];

  for (let i = 0; i < numFacturas; i++) {
    const mesFacturacion = new Date(hoy);
    mesFacturacion.setMonth(mesFacturacion.getMonth() + i * mesesPorFactura);
    mesFacturacion.setDate(1);

    const periodo = periodoFacturacion === 'mensual'
      ? mesFacturacion.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
      : periodoFacturacion === 'trimestral'
        ? `T${Math.ceil((mesFacturacion.getMonth() + 1) / 3)} ${mesFacturacion.getFullYear()}`
        : `Año ${mesFacturacion.getFullYear()}`;

    // Facturas de contrato se crean como BORRADOR — solo se emiten cuando llega su mes
    const tempNumero = `BORRADOR-M-${Date.now()}-${i}`;

    const { data, error } = await supabase.from('trade_invoices').insert({
      org_id: orgId,
      client_id: opts.clientId ?? null,
      contract_id: contractId,
      numero: tempNumero,
      fecha: mesFacturacion.toISOString().split('T')[0],
      estado: 'Borrador',
      subtotal: subtotalFactura,
      iva_pct: ivaPct,
      concepto: `Mantenimiento ${referencia} — ${nombreCliente} — ${periodo}`,
      serie: 'M',
      tipo_factura: 'contrato_cuota',
      mes_facturacion: mesFacturacion.toISOString().split('T')[0],
    }).select().single();
    if (error) throw error;
    invoices.push(data as TradeInvoice);
  }
  return invoices;
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

export async function updateQuote(
  quoteId: string,
  clientId: string,
  descripcion: string,
  items: Pick<TradeQuoteItem, 'descripcion' | 'tipo' | 'cantidad' | 'precio_unitario' | 'precio_material' | 'supplier_key' | 'supplier_name' | 'supplier_ref' | 'catalog_variant_id'>[],
): Promise<TradeQuote> {
  const totalNeto = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const { data: quote, error: qErr } = await supabase
    .from('trade_quotes')
    .update({ client_id: clientId, descripcion, total_neto: totalNeto })
    .eq('id', quoteId)
    .select()
    .single();
  if (qErr) throw qErr;
  await supabase.from('trade_quote_items').delete().eq('quote_id', quoteId);
  const { error: iErr } = await supabase.from('trade_quote_items').insert(
    items.map((item, idx) => ({ quote_id: quoteId, ...item, posicion: idx })),
  );
  if (iErr) throw iErr;
  return quote as TradeQuote;
}

// ── Datos fiscales ────────────────────────────────────────────────────────

export async function saveFiscalData(
  orgId: string,
  data: {
    nombre: string; nif?: string; email?: string;
    telefono_fijo?: string; telefono_movil?: string;
    direccion?: string; localidad?: string; cp?: string;
    provincia?: string; pais?: string; iva_default?: number;
    iban?: string; banco?: string; titular_cuenta?: string;
  },
): Promise<void> {
  const { error } = await supabase
    .from('trade_organizations')
    .update(data)
    .eq('id', orgId);
  if (error) throw error;
}

export async function updateOrgGeocoords(
  orgId: string,
  lat: number,
  lng: number,
): Promise<void> {
  const { error } = await supabase
    .from('trade_organizations')
    .update({ base_latitud: lat, base_longitud: lng })
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
  type: 'waitlist_admin' | 'waitlist_confirm' | 'welcome' | 'contact_admin' | 'support_admin' | 'auth_confirm';
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

export async function sendClientEmail(to: string, subject: string, text: string): Promise<void> {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trade-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'send_to_client', to, subject, text }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error al enviar email: ${err}`);
  }
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
  tipo?: 'trabajo' | 'visita';
  estado: 'planificado' | 'en_curso' | 'completado' | 'cancelado' | 'pendiente_material' | 'no_realizado' | 'pausado_continua' | 'bloqueado_espera_material';
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
  orden_ruta?: number | null;
  direccion_normalizada?: string | null;
  ventana_inicio?: string | null;
  ventana_fin?: string | null;
  duracion_estimada_min?: number | null;
  notas_trabajador?: string | null;
  started_at?: string | null;
  pause_reason?: 'falta_tiempo' | 'falta_material' | null;
  material_pendiente?: string | null;
  fecha_estimada_material?: string | null;
  rescheduled_from?: string | null;
  priority_insert?: boolean | null;
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
  // Eliminar campos de relación JOIN antes de enviar a Supabase — no son columnas reales
  const { trade_clients: _tc, trade_job_workers: _tjw, ...clean } = updates as Record<string, unknown>;
  const { error } = await supabase.from('trade_jobs').update(clean).eq('id', id);
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
  jobTitulo?: string,
): Promise<void> {
  const { error } = await supabase
    .from('trade_job_workers')
    .upsert({ job_id: jobId, worker_id: workerId, rol }, { onConflict: 'job_id,worker_id' });
  if (error) throw error;

  if (jobTitulo) {
    supabase.functions.invoke('trade-push-notify', {
      body: {
        worker_ids: [workerId],
        title: 'Nuevo trabajo asignado',
        body_text: jobTitulo,
        url: '/',
      },
    }).catch(() => {});
  }
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

  if (estado === 'completado') {
    const { data: job } = await supabase
      .from('trade_jobs')
      .select('org_id, titulo')
      .eq('id', jobId)
      .single();
    if (job) {
      supabase.functions.invoke('trade-push-notify', {
        body: {
          org_id: job.org_id,
          title: '✅ Trabajo completado',
          body_text: job.titulo ?? 'Un trabajo ha sido completado',
          url: '/',
        },
      }).catch(() => {});
    }
  }
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

async function compressImage(file: File, maxPx = 1280, quality = 0.80): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width >= height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else { width = Math.round(width * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('compress failed')), 'image/jpeg', quality);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function uploadJobPhoto(
  jobId: string,
  file: File,
  _workerIdUnused: string,
  orgId: string,
): Promise<TradeJobPhoto> {
  const { data: { user } } = await supabase.auth.getUser();
  const authUid = user?.id ?? '';
  const compressed = await compressImage(file);
  const path = `${orgId}/${jobId}/${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from('trade-job-photos')
    .upload(path, compressed, { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw upErr;
  const { data: { publicUrl } } = supabase.storage.from('trade-job-photos').getPublicUrl(path);
  const { data, error } = await supabase
    .from('trade_job_photos')
    .insert({ job_id: jobId, org_id: orgId, uploaded_by_worker_id: authUid, photo_url: publicUrl })
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
  await assignWorkerToJob(job.id, workerId, 'responsable', job.titulo);
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

export async function applyReferralCode(code: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('apply_referral_code', { p_code: code.trim().toUpperCase() });
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; error?: string };
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
  // Aplica cambios de plan programados que ya hayan vencido (downgrade al fin de período)
  try { await supabase.rpc('apply_scheduled_plan_if_due', { p_org_id: orgId }); } catch { /* no-op */ }

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
  rol: 'owner' | 'admin' | 'oficina' | 'comercial' | 'tecnico' | 'visualizador';
  activo: boolean;
  invited_at: string | null;
  worker_profile_id?: string | null;
  created_at: string;
}

export interface TradeFieldAction {
  id: string;
  org_id: string;
  job_id?: string | null;
  worker_id?: string | null;
  tipo: 'presupuesto_requerido' | 'material_necesario' | 'incidencia' | 'consulta' | 'otro';
  descripcion: string;
  estado: 'pendiente' | 'en_proceso' | 'resuelto' | 'descartado';
  resuelto_por?: string | null;
  resuelto_at?: string | null;
  created_at: string;
  updated_at: string;
  trade_jobs?: { titulo: string } | null;
  trade_workers?: { nombre: string } | null;
}

export async function loadMyWorkerProfile(userId: string, orgId: string): Promise<TradeWorker | null> {
  const { data: member } = await supabase
    .from('trade_org_members')
    .select('worker_profile_id')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!member?.worker_profile_id) return null;
  const { data } = await supabase
    .from('trade_workers')
    .select('*')
    .eq('id', member.worker_profile_id)
    .maybeSingle();
  return data as TradeWorker | null;
}

export async function createFieldAction(
  orgId: string,
  action: Pick<TradeFieldAction, 'tipo' | 'descripcion'> & { job_id?: string; worker_id?: string },
): Promise<TradeFieldAction> {
  const { data, error } = await supabase
    .from('trade_field_actions')
    .insert({ org_id: orgId, ...action })
    .select()
    .single();
  if (error) throw error;
  return data as TradeFieldAction;
}

export async function loadFieldActions(orgId: string, estado?: string): Promise<TradeFieldAction[]> {
  let q = supabase
    .from('trade_field_actions')
    .select('*, trade_jobs(titulo), trade_workers(nombre)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (estado) q = q.eq('estado', estado);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TradeFieldAction[];
}

export async function resolveFieldAction(id: string, resuelto_por: string): Promise<void> {
  const { error } = await supabase
    .from('trade_field_actions')
    .update({ estado: 'resuelto', resuelto_por, resuelto_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function linkWorkerProfile(memberId: string, workerProfileId: string): Promise<void> {
  const { error } = await supabase
    .from('trade_org_members')
    .update({ worker_profile_id: workerProfileId })
    .eq('id', memberId);
  if (error) throw error;
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
  // Guardar en BD — si falla (ej. tabla no existe aún), el navegador sigue suscrito igualmente
  await supabase.from('trade_push_subscriptions').upsert({
    worker_id: workerId,
    org_id: orgId,
    endpoint: json.endpoint,
    subscription: json,
  }, { onConflict: 'worker_id,endpoint' }).match({}).then(null, console.error);

  return true;
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

export async function initiateStripeUpgrade(
  orgId: string,
  plan: string,
  billingCycle: string,
): Promise<{ url?: string; upgraded?: boolean; scheduled?: boolean; plan?: string; billing_cycle?: string; scheduled_plan?: string; scheduled_at?: string }> {
  const res = await supabase.functions.invoke('trade-stripe-checkout', {
    body: {
      org_id:        orgId,
      plan,
      billing_cycle: billingCycle,
      success_url:   `${window.location.origin}/?checkout=success`,
      cancel_url:    `${window.location.origin}/`,
    },
  });
  if (res.error) throw new Error(res.error.message ?? 'Error checkout Stripe');
  const data = res.data as { url?: string; upgraded?: boolean; scheduled?: boolean; plan?: string; billing_cycle?: string; scheduled_plan?: string; scheduled_at?: string; error?: string };
  if (data.error) throw new Error(data.error);
  return data;
}

export async function getStripeCheckoutUrl(orgId: string, plan?: string, billingCycle?: string): Promise<string> {
  const result = await initiateStripeUpgrade(orgId, plan ?? 'profesional', billingCycle ?? 'monthly');
  if (result.url) return result.url;
  throw new Error('La suscripción fue actualizada directamente — recarga la página');
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

// ── Aprendizaje de actuaciones IA ─────────────────────────────────────────────

export async function saveAIFeedback(
  orgId: string,
  transcript: string,
  actuacionIds: string[],
  aiPartidas: unknown[],
  finalPartidas: unknown[],
  nuevasPartidas: unknown[],
  kbScore: number,
): Promise<void> {
  if (!orgId) return;
  await supabase.from('trade_ai_feedback').insert({
    org_id: orgId,
    transcript,
    actuacion_ids: actuacionIds,
    ai_partidas: aiPartidas,
    final_partidas: finalPartidas,
    nuevas_partidas: nuevasPartidas,
    kb_score: kbScore,
    applied: false,
  });
}

export async function applyActuacionLearning(
  actuacionId: string,
  newPartidas: string[],
  newKeywords: string[],
): Promise<{ ok: boolean; partidas_añadidas?: number }> {
  if (!actuacionId || newPartidas.length === 0) return { ok: false };
  const { data, error } = await supabase.rpc('update_actuacion_learned', {
    p_actuacion_id: actuacionId,
    p_new_partidas: newPartidas,
    p_new_keywords: newKeywords,
  });
  if (error) { console.warn('[learn]', error.message); return { ok: false }; }
  return data as { ok: boolean; partidas_añadidas?: number };
}

export async function createActuacionFromLearning(
  oficio: string,
  actuacionId: string,
  keywords: string[],
  partidas: string[],
  transcript: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('insert_actuacion_learned', {
    p_oficio: oficio,
    p_actuacion_id: actuacionId,
    p_keywords: keywords,
    p_partidas: partidas,
    p_transcript: transcript,
  });
  if (error) { console.warn('[learn-create]', error.message); return false; }
  return (data as { ok: boolean })?.ok ?? false;
}

// ── Módulo Contratos de Mantenimiento ─────────────────────────────────────────

export interface MaintenanceOficio {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  activo: boolean;
}

export interface MaintenanceSLA {
  id: string;
  nivel: string;
  nombre: string;
  tiempo_respuesta_min: number;
  tiempo_resolucion_min: number;
  descripcion: string | null;
  color: string | null;
}

export interface MaintenanceSector {
  id: string;
  codigo: string;
  nombre: string;
}

export interface MaintenanceRecargo {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  porcentaje: number;
  descripcion: string | null;
}

export interface MaintenancePlantilla {
  id: string;
  codigo: string;
  nombre: string;
  oficio_id: string;
  sector_id: string;
  sla_nivel: string;
  descripcion: string | null;
  precio_min: number | null;
  precio_max: number | null;
  cuota_mensual_base: number | null;
  incluye_preventivos: boolean;
  incluye_guardia: boolean;
  num_visitas_preventivo: number;
  frecuencia_preventivo: string;
  materiales_incluidos: boolean;
  penalizacion_sla_pct: number;
  variables: string[];
  clausulas_adicionales: string | null;
}

export interface MaintenancePresupuesto {
  id: string;
  org_id: string;
  client_id: string | null;
  plantilla_id: string | null;
  numero: string | null;
  estado: 'borrador' | 'enviado' | 'aceptado' | 'rechazado' | 'convertido';
  oficio: string;
  sector: string | null;
  nombre_cliente: string | null;
  direccion_instalacion: string | null;
  descripcion_servicios: string | null;
  cuota_mensual: number | null;
  cuota_anual: number | null;
  cuota_trimestral: number | null;
  tipo_facturacion: 'mensual' | 'trimestral' | 'anual';
  iva_pct: number;
  sla_nivel: string | null;
  tiempo_respuesta_h: number | null;
  incluye_preventivos: boolean;
  num_visitas_preventivo: number;
  incluye_guardia: boolean;
  materiales_incluidos: boolean;
  texto_libre: string | null;
  ia_json: Record<string, unknown> | null;
  notas: string | null;
  fecha: string;
  fecha_enviado: string | null;
  fecha_aceptado: string | null;
  fecha_vencimiento: string | null;
  generado_por_ia: boolean;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceContrato {
  id: string;
  org_id: string;
  client_id: string | null;
  presupuesto_id: string | null;
  plantilla_id: string | null;
  numero: string | null;
  estado: 'activo' | 'pausado' | 'cancelado' | 'vencido' | 'renovando';
  oficio: string;
  sector: string | null;
  nombre_cliente: string | null;
  direccion_instalacion: string | null;
  descripcion_servicios: string | null;
  cuota_mensual: number;
  tipo_facturacion: 'mensual' | 'trimestral' | 'anual';
  iva_pct: number;
  sla_nivel: string | null;
  tiempo_respuesta_h: number | null;
  incluye_preventivos: boolean;
  num_visitas_preventivo: number;
  frecuencia_preventivo: string;
  incluye_guardia: boolean;
  materiales_incluidos: boolean;
  fecha_inicio: string;
  fecha_fin: string | null;
  duracion_meses: number;
  renovacion_automatica: boolean;
  preaviso_cancelacion_dias: number;
  dia_facturacion: number;
  proxima_factura: string | null;
  ultima_factura: string | null;
  notas: string | null;
  contract_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceIncidencia {
  id: string;
  org_id: string;
  contrato_id: string | null;
  client_id: string | null;
  titulo: string;
  descripcion: string | null;
  estado: 'abierta' | 'en_curso' | 'resuelta' | 'cerrada';
  prioridad: 'critica' | 'urgente' | 'normal' | 'baja';
  fecha_reporte: string;
  fecha_asignacion: string | null;
  fecha_inicio_intervencion: string | null;
  fecha_resolucion: string | null;
  tiempo_respuesta_min: number | null;
  tiempo_resolucion_min: number | null;
  sla_cumplido: boolean | null;
  es_extra_contrato: boolean;
  importe_extra: number | null;
  notas_resolucion: string | null;
  tecnico_user_id: string | null;
  tecnico_email: string | null;
  created_at: string;
  updated_at: string;
  trade_maintenance_contratos?: { nombre_cliente: string | null; oficio: string; sector: string | null } | null;
}

export interface MaintenanceDetectResult {
  oficio: string;
  sector: string;
  plantilla_codigo: string | null;
  sla_nivel: string;
  nombre_cliente: string | null;
  direccion_instalacion: string | null;
  descripcion_servicios: string;
  cuota_mensual_sugerida: number | null;
  cuota_min: number | null;
  cuota_max: number | null;
  tipo_facturacion: 'mensual' | 'trimestral' | 'anual';
  incluye_preventivos: boolean;
  num_visitas_preventivo: number;
  frecuencia_preventivo: string;
  incluye_guardia: boolean;
  materiales_incluidos: boolean;
  duracion_meses: number | null;
  recargos_aplicables: string[];
  variables_detectadas: Record<string, string>;
  confianza: number;
  resumen: string;
}

// ── Catálogos ──────────────────────────────────────────────────────────────────

export async function loadMaintenanceCatalogs(): Promise<{
  oficios: MaintenanceOficio[];
  sla: MaintenanceSLA[];
  sectores: MaintenanceSector[];
  recargos: MaintenanceRecargo[];
  plantillas: MaintenancePlantilla[];
}> {
  const [oficiosRes, slaRes, sectoresRes, recargosRes, plantillasRes] = await Promise.all([
    supabase.from('trade_maintenance_oficios').select('*').eq('activo', true).order('nombre'),
    supabase.from('trade_maintenance_sla').select('*').eq('activo', true),
    supabase.from('trade_maintenance_sectores').select('*').eq('activo', true).order('nombre'),
    supabase.from('trade_maintenance_recargos').select('*').eq('activo', true),
    supabase.from('trade_maintenance_plantillas').select('*').eq('activo', true).order('nombre'),
  ]);
  return {
    oficios:    (oficiosRes.data    ?? []) as MaintenanceOficio[],
    sla:        (slaRes.data        ?? []) as MaintenanceSLA[],
    sectores:   (sectoresRes.data   ?? []) as MaintenanceSector[],
    recargos:   (recargosRes.data   ?? []) as MaintenanceRecargo[],
    plantillas: (plantillasRes.data ?? []) as MaintenancePlantilla[],
  };
}

// ── Presupuestos ───────────────────────────────────────────────────────────────

export async function loadMaintenancePresupuestos(orgId: string): Promise<MaintenancePresupuesto[]> {
  const { data, error } = await supabase
    .from('trade_maintenance_presupuestos')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MaintenancePresupuesto[];
}

export async function saveMaintenancePresupuesto(
  orgId: string,
  draft: Partial<Omit<MaintenancePresupuesto, 'id' | 'created_at' | 'updated_at'>> & { oficio: string },
): Promise<MaintenancePresupuesto> {
  const { data, error } = await supabase
    .from('trade_maintenance_presupuestos')
    .insert({ ...draft, org_id: orgId, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as MaintenancePresupuesto;
}

export async function updateMaintenancePresupuesto(
  id: string,
  updates: Partial<MaintenancePresupuesto>,
): Promise<void> {
  const { error } = await supabase
    .from('trade_maintenance_presupuestos')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteMaintenancePresupuesto(id: string): Promise<void> {
  const { error } = await supabase.from('trade_maintenance_presupuestos').delete().eq('id', id);
  if (error) throw error;
}

// ── Contratos ──────────────────────────────────────────────────────────────────

export async function loadMaintenanceContratos(orgId: string): Promise<MaintenanceContrato[]> {
  const { data, error } = await supabase
    .from('trade_maintenance_contratos')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MaintenanceContrato[];
}

export async function saveMaintenanceContrato(
  orgId: string,
  draft: Omit<MaintenanceContrato, 'id' | 'created_at' | 'updated_at'>,
): Promise<MaintenanceContrato> {
  const { data, error } = await supabase
    .from('trade_maintenance_contratos')
    .insert({ ...draft, org_id: orgId, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as MaintenanceContrato;
}

export async function updateMaintenanceContrato(id: string, updates: Partial<MaintenanceContrato>): Promise<void> {
  const { error } = await supabase
    .from('trade_maintenance_contratos')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ── Facturas de mantenimiento ──────────────────────────────────────────────────

export interface MaintenanceFactura {
  id: string;
  org_id: string;
  contrato_id: string;
  client_id: string | null;
  numero: string | null;
  estado: 'pendiente' | 'pagada' | 'cancelada';
  periodo_inicio: string;
  periodo_fin: string;
  cuota_base: number;
  extras: number;
  total_neto: number;
  iva_pct: number;
  total_con_iva: number;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  fecha_pago: string | null;
  notas: string | null;
  created_at: string;
  trade_maintenance_contratos?: { nombre_cliente: string | null; oficio: string; sector: string | null } | null;
}

export async function loadMaintenanceFacturas(orgId: string): Promise<MaintenanceFactura[]> {
  const { data, error } = await supabase
    .from('trade_maintenance_facturas')
    .select('*, trade_maintenance_contratos(nombre_cliente, oficio, sector)')
    .eq('org_id', orgId)
    .order('fecha_emision', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MaintenanceFactura[];
}

export async function markFacturaPagada(id: string): Promise<void> {
  const { error } = await supabase
    .from('trade_maintenance_facturas')
    .update({ estado: 'pagada', fecha_pago: new Date().toISOString().split('T')[0] })
    .eq('id', id);
  if (error) throw error;
}

// Loads trade_invoices linked to any maintenance contrato for this org
export async function loadMaintenanceInvoicesByOrg(orgId: string): Promise<TradeInvoice[]> {
  const { data: contratos, error: err1 } = await supabase
    .from('trade_maintenance_contratos')
    .select('contract_id')
    .eq('org_id', orgId)
    .not('contract_id', 'is', null);
  if (err1) throw err1;

  const contractIds = (contratos ?? []).map((c: { contract_id: string | null }) => c.contract_id).filter(Boolean) as string[];
  if (contractIds.length === 0) return [];

  const { data, error } = await supabase
    .from('trade_invoices')
    .select('*')
    .eq('org_id', orgId)
    .in('contract_id', contractIds)
    .order('fecha_vencimiento', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TradeInvoice[];
}

type MaintenanceEmailType =
  | 'presupuesto_enviado'
  | 'contrato_activado'
  | 'factura_pendiente'
  | 'recordatorio_pago'
  | 'aviso_renovacion'
  | 'aviso_vencimiento'
  | 'bienvenida_empresa';

export async function sendMaintenanceNotification(
  type: MaintenanceEmailType,
  id?: string,
  toEmail?: string,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const body: Record<string, string> = { type };
  if (id) {
    if (type === 'presupuesto_enviado') body.presupuesto_id = id;
    else if (type === 'contrato_activado' || type === 'aviso_renovacion' || type === 'aviso_vencimiento') body.contrato_id = id;
    else if (type === 'factura_pendiente' || type === 'recordatorio_pago') body.factura_id = id;
  }
  if (toEmail) body.to_email = toEmail;
  await supabase.functions
    .invoke('trade-maintenance-email', {
      body,
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    .catch(() => {/* fire-and-forget */});
}

// ── Modelos reutilizables ──────────────────────────────────────────────────────

export interface MaintenanceModelo {
  id: string;
  org_id: string;
  nombre: string;
  descripcion: string | null;
  basado_en_plantilla_id: string | null;
  datos_json: Record<string, unknown> | null;
  veces_usado: number;
  activo: boolean;
  created_at: string;
}

export async function loadMaintenanceModelos(orgId: string): Promise<MaintenanceModelo[]> {
  const { data, error } = await supabase
    .from('trade_maintenance_modelos')
    .select('*')
    .eq('org_id', orgId)
    .eq('activo', true)
    .order('veces_usado', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MaintenanceModelo[];
}

export async function saveMaintenanceModelo(
  orgId: string,
  data: {
    nombre: string;
    descripcion?: string | null;
    basado_en_plantilla_id?: string | null;
    datos_json: Record<string, unknown>;
  },
): Promise<MaintenanceModelo> {
  const { data: result, error } = await supabase
    .from('trade_maintenance_modelos')
    .insert({ ...data, org_id: orgId })
    .select()
    .single();
  if (error) throw error;
  return result as MaintenanceModelo;
}

export async function deleteMaintenanceModelo(id: string): Promise<void> {
  const { error } = await supabase
    .from('trade_maintenance_modelos')
    .update({ activo: false })
    .eq('id', id);
  if (error) throw error;
}

export async function useMaintenanceModelo(
  modelo: MaintenanceModelo,
  orgId: string,
): Promise<MaintenancePresupuesto> {
  const d = modelo.datos_json ?? {};
  const { data, error } = await supabase
    .from('trade_maintenance_presupuestos')
    .insert({
      org_id:                 orgId,
      oficio:                 (d.oficio as string) ?? 'fontaneria',
      sector:                 (d.sector as string) ?? null,
      sla_nivel:              (d.sla_nivel as string) ?? null,
      cuota_mensual:          (d.cuota_mensual as number) ?? null,
      tipo_facturacion:       (d.tipo_facturacion as string) ?? 'mensual',
      incluye_preventivos:    (d.incluye_preventivos as boolean) ?? false,
      num_visitas_preventivo: (d.num_visitas_preventivo as number) ?? 0,
      incluye_guardia:        (d.incluye_guardia as boolean) ?? false,
      descripcion_servicios:  (d.descripcion_servicios as string) ?? null,
      plantilla_id:           (d.plantilla_id as string) ?? null,
      notas:                  (d.notas as string) ?? null,
      estado:                 'borrador',
      generado_por_ia:        false,
      updated_at:             new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;

  void supabase
    .from('trade_maintenance_modelos')
    .update({ veces_usado: (modelo.veces_usado ?? 0) + 1 })
    .eq('id', modelo.id);

  return data as MaintenancePresupuesto;
}

// ── Incidencias ────────────────────────────────────────────────────────────────

export async function loadMaintenanceIncidencias(orgId: string): Promise<MaintenanceIncidencia[]> {
  const { data, error } = await supabase
    .from('trade_maintenance_incidencias')
    .select('*, trade_maintenance_contratos(nombre_cliente, oficio, sector)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MaintenanceIncidencia[];
}

export async function loadWorkerIncidencias(userId: string): Promise<MaintenanceIncidencia[]> {
  const { data, error } = await supabase
    .from('trade_maintenance_incidencias')
    .select('*, trade_maintenance_contratos(nombre_cliente, oficio, sector)')
    .eq('tecnico_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MaintenanceIncidencia[];
}

export async function saveMaintenanceIncidencia(
  orgId: string,
  payload: Omit<MaintenanceIncidencia, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'trade_maintenance_contratos'>,
): Promise<MaintenanceIncidencia> {
  const { data, error } = await supabase
    .from('trade_maintenance_incidencias')
    .insert({ ...payload, org_id: orgId })
    .select()
    .single();
  if (error) throw error;

  supabase.functions.invoke('trade-push-notify', {
    body: {
      org_id: orgId,
      title: '🔧 Nueva incidencia registrada',
      body_text: payload.titulo ?? 'Se ha registrado una nueva incidencia de mantenimiento',
      url: '/',
    },
  }).catch(() => {});

  return data as MaintenanceIncidencia;
}

export async function updateMaintenanceIncidencia(
  id: string,
  updates: Partial<Omit<MaintenanceIncidencia, 'id' | 'org_id' | 'created_at' | 'trade_maintenance_contratos'>>,
): Promise<void> {
  const { error } = await supabase
    .from('trade_maintenance_incidencias')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;

  if (updates.tecnico_email) {
    const { data: worker } = await supabase
      .from('trade_workers')
      .select('id')
      .eq('email', updates.tecnico_email)
      .eq('activo', true)
      .maybeSingle();
    if (worker) {
      supabase.functions.invoke('trade-push-notify', {
        body: {
          worker_ids: [worker.id],
          title: '🔧 Incidencia asignada',
          body_text: updates.titulo ?? 'Se te ha asignado una incidencia de mantenimiento',
          url: '/',
        },
      }).catch(() => {});
    }
  }
}

export async function sendParteTrabajo(incidenciaId: string): Promise<void> {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error('No autenticado');
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/trade-maintenance-parte`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ incidencia_id: incidenciaId }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Error enviando parte');
  }
}

// ── IA: detectar contrato desde texto ─────────────────────────────────────────

export async function detectMaintenanceContract(texto: string): Promise<MaintenanceDetectResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No autenticado');

  const res = await supabase.functions.invoke('trade-maintenance-detect', {
    body: { texto },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (res.error) throw new Error(res.error.message);
  if (!res.data?.ok) throw new Error(res.data?.error ?? 'Error en la detección IA');
  return res.data.data as MaintenanceDetectResult;
}

export interface MaintenanceDocumento {
  titulo: string;
  partes: { prestador: string; cliente: string; direccion_servicio: string };
  objeto: string;
  servicios_incluidos: string[];
  servicios_excluidos: string[];
  sla: { nivel: string; tiempo_respuesta: string; tiempo_resolucion: string; horario_cobertura: string; penalizacion: string };
  preventivos: { incluidos: boolean; frecuencia: string; num_visitas_anio: number; descripcion: string };
  precio: { cuota_mensual_neto: number; iva_pct: number; cuota_mensual_total: number; cuota_anual_total: number; tipo_facturacion: string; forma_pago: string };
  duracion: { vigencia_meses: number; renovacion_automatica: boolean; preaviso_cancelacion_dias: number; clausula_duracion: string };
  materiales: { incluidos: boolean; clausula: string };
  clausulas_adicionales: string[];
  confidencialidad: string;
  jurisdiccion: string;
  num_clausulas: number;
}

function buildDocumentoFromPresupuesto(
  presupuesto: Record<string, unknown>,
  clausulas: Array<Record<string, unknown>>,
): MaintenanceDocumento {
  const sla = (presupuesto.sla_nivel as string) ?? 'normal';
  const slaMap: Record<string, { respuesta: string; resolucion: string; horario: string }> = {
    critico:    { respuesta: '15 minutos', resolucion: '4 horas',  horario: '24/7/365' },
    urgente:    { respuesta: '2 horas',    resolucion: '8 horas',  horario: '24/7' },
    normal:     { respuesta: '4 horas',    resolucion: '24 horas', horario: '8/5' },
    preventivo: { respuesta: '48 horas',   resolucion: '72 horas', horario: '8/5' },
  };
  const slaInfo = slaMap[sla] ?? slaMap.normal;
  const cuotaMensual = Number(presupuesto.cuota_mensual ?? 0);
  const ivaPct = Number(presupuesto.iva_pct ?? 21);
  const numVisitas = Number(presupuesto.num_visitas_preventivo ?? 2);
  const iaJson = presupuesto.ia_json as Record<string, unknown> | null;
  const sectorLabel = (iaJson?.sector as string) ?? (presupuesto.sector as string) ?? (presupuesto.oficio as string) ?? 'mantenimiento';

  const serviciosIncluidos = clausulas.length > 0
    ? clausulas.map(c => c.descripcion as string).filter(Boolean)
    : [(presupuesto.descripcion_servicios as string) ?? 'Mantenimiento según condiciones pactadas'];

  return {
    titulo: `CONTRATO DE MANTENIMIENTO — ${sectorLabel.toUpperCase()} — ${((presupuesto.nombre_cliente as string) ?? 'CLIENTE').toUpperCase()}`,
    partes: {
      prestador: 'A completar por la empresa instaladora',
      cliente: (presupuesto.nombre_cliente as string) ?? 'El CLIENTE',
      direccion_servicio: (presupuesto.direccion_instalacion as string) ?? 'A determinar',
    },
    objeto: `Prestación de servicios de mantenimiento preventivo y correctivo de las instalaciones de ${sectorLabel}, conforme a las condiciones técnicas y económicas del presente contrato.`,
    servicios_incluidos: serviciosIncluidos,
    servicios_excluidos: [
      'Materiales, repuestos y piezas de sustitución (se presupuestan separadamente)',
      'Reformas, modificaciones o ampliaciones de las instalaciones',
      'Daños derivados de uso incorrecto, actos vandálicos o causas de fuerza mayor',
    ],
    sla: {
      nivel: sla,
      tiempo_respuesta: slaInfo.respuesta,
      tiempo_resolucion: slaInfo.resolucion,
      horario_cobertura: slaInfo.horario,
      penalizacion: sla === 'critico' || sla === 'urgente'
        ? 'Penalización del 5% de la cuota mensual por cada hora de incumplimiento del SLA'
        : '',
    },
    preventivos: {
      incluidos: Boolean(presupuesto.incluye_preventivos ?? true),
      frecuencia: (presupuesto.frecuencia_preventivo as string) ?? 'semestral',
      num_visitas_anio: numVisitas,
      descripcion: `${numVisitas} visita${numVisitas !== 1 ? 's' : ''} de mantenimiento preventivo al año`,
    },
    precio: {
      cuota_mensual_neto: cuotaMensual,
      iva_pct: ivaPct,
      cuota_mensual_total: cuotaMensual * (1 + ivaPct / 100),
      cuota_anual_total: cuotaMensual * 12 * (1 + ivaPct / 100),
      tipo_facturacion: (presupuesto.tipo_facturacion as string) ?? 'mensual',
      forma_pago: 'Domiciliación bancaria el día 1 de cada mes',
    },
    duracion: {
      vigencia_meses: 12,
      renovacion_automatica: true,
      preaviso_cancelacion_dias: 30,
      clausula_duracion: 'El presente contrato tendrá una vigencia inicial de doce (12) meses, renovándose automáticamente por períodos anuales salvo comunicación en contrario con 30 días de antelación.',
    },
    materiales: {
      incluidos: Boolean(presupuesto.materiales_incluidos ?? false),
      clausula: 'Los materiales, repuestos y piezas de sustitución no están incluidos en la cuota de mantenimiento y se presupuestarán por separado previo acuerdo con el cliente.',
    },
    clausulas_adicionales: [
      'Las partes designarán un responsable de cuenta que actuará como interlocutor principal.',
      'Las intervenciones de urgencia fuera del horario de cobertura acordado conllevan un recargo sobre las tarifas ordinarias.',
      'Cualquier modificación de las condiciones del presente contrato requerirá acuerdo escrito de ambas partes.',
    ],
    confidencialidad: 'Las partes se comprometen a mantener la confidencialidad de toda información intercambiada en el marco del presente contrato.',
    jurisdiccion: 'Para la resolución de cualquier controversia, las partes se someten a los Juzgados y Tribunales del domicilio del PRESTADOR, con renuncia expresa a cualquier otro fuero.',
    num_clausulas: 14,
  };
}

export async function generateMaintenanceDocument(presupuestoId: string, forceRegenerate = false): Promise<MaintenanceDocumento> {
  // Fetch full presupuesto row (needed for both cache check and local build)
  const { data: presup } = await supabase
    .from('trade_maintenance_presupuestos')
    .select('*')
    .eq('id', presupuestoId)
    .single();

  const iaJson = presup?.ia_json as Record<string, unknown> | null;

  // 1. Return cached AI document if available
  if (!forceRegenerate && iaJson?.documento) {
    return iaJson.documento as MaintenanceDocumento;
  }

  // 2. Build locally from wizard clausulas (no AI call needed)
  const clausulas = iaJson?.clausulas;
  if (clausulas && Array.isArray(clausulas) && clausulas.length > 0) {
    return buildDocumentoFromPresupuesto(
      presup as Record<string, unknown>,
      clausulas as Array<Record<string, unknown>>,
    );
  }

  // 3. Build locally from descripcion_servicios (no AI call)
  if (presup?.descripcion_servicios) {
    return buildDocumentoFromPresupuesto(presup as Record<string, unknown>, []);
  }

  // 4. Fall back to AI edge function (only if no local data available)
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No autenticado');

  const res = await supabase.functions.invoke('trade-maintenance-generate', {
    body: { presupuesto_id: presupuestoId },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (res.error) throw new Error(res.error.message);
  if (!res.data?.ok) throw new Error(res.data?.error ?? 'Error generando documento');

  const documento = res.data.documento as MaintenanceDocumento;

  // Cache for next time
  await supabase
    .from('trade_maintenance_presupuestos')
    .update({ ia_json: { ...(iaJson ?? {}), documento }, updated_at: new Date().toISOString() })
    .eq('id', presupuestoId);

  return documento;
}

export async function convertPresupuestoToContrato(
  presupuesto: MaintenancePresupuesto,
): Promise<MaintenanceContrato> {
  const fechaInicio = new Date();
  const fechaFin = new Date(fechaInicio);
  fechaFin.setMonth(fechaFin.getMonth() + 12);
  const proxima = new Date(fechaInicio);
  proxima.setMonth(proxima.getMonth() + 1);
  proxima.setDate(1);
  const cuotaMensual = presupuesto.cuota_mensual ?? 0;
  const ivaPct = presupuesto.iva_pct ?? 21;

  // Load org data + client data in parallel
  const [{ data: orgRow }, { data: clientRow }] = await Promise.all([
    supabase.from('trade_organizations')
      .select('nombre, nif, direccion, ciudad, email, telefono, logo_url, iban')
      .eq('id', presupuesto.org_id).single(),
    presupuesto.client_id
      ? supabase.from('trade_clients').select('nif, email, telefono, nombre').eq('id', presupuesto.client_id).single()
      : Promise.resolve({ data: null }),
  ]);

  // Generate next TF-MANT reference
  const { data: existingContracts } = await supabase
    .from('trade_contracts')
    .select('referencia')
    .eq('org_id', presupuesto.org_id);
  const year = new Date().getFullYear();
  const nums = (existingContracts ?? [])
    .map((c: { referencia: string }) => parseInt(c.referencia.split('-').at(-1) ?? '0', 10))
    .filter((n: number) => !isNaN(n));
  const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  const referencia = `TF-MANT-${year}-${String(nextNum).padStart(4, '0')}`;

  // Build ContractVars from presupuesto + org data
  const iaJson = presupuesto.ia_json as Record<string, unknown> | null;
  const clausulas = iaJson?.clausulas as Array<Record<string, unknown>> | null;
  const descripcionInstalaciones = (clausulas && clausulas.length > 0)
    ? clausulas.map(c => String(c.descripcion ?? c.nombre ?? '')).filter(Boolean).join('\n')
    : (presupuesto.descripcion_servicios ?? '');
  const slaTimeMap: Record<string, string> = { critico: '15 minutos', urgente: '1 hora', normal: '4 horas', preventivo: '24 horas' };
  const tiempoRespuesta = presupuesto.sla_nivel && slaTimeMap[presupuesto.sla_nivel]
    ? `Máximo ${slaTimeMap[presupuesto.sla_nivel]}`
    : presupuesto.tiempo_respuesta_h ? `Máximo ${presupuesto.tiempo_respuesta_h} horas`
    : 'Máximo 4 horas en días laborables, 8 horas en festivos';

  const vars: Record<string, string> = {
    empresa: orgRow?.nombre ?? '',
    cif_empresa: (orgRow as Record<string, unknown> | null)?.nif as string ?? '',
    direccion_empresa: orgRow?.direccion ?? '',
    telefono_empresa: orgRow?.telefono ?? '',
    email_empresa: orgRow?.email ?? '',
    logo_url: (orgRow as Record<string, unknown> | null)?.logo_url as string ?? '',
    nombre_cliente: presupuesto.nombre_cliente ?? (clientRow as Record<string, unknown> | null)?.nombre as string ?? '',
    cif_cliente: (clientRow as Record<string, unknown> | null)?.nif as string ?? '',
    direccion_cliente: presupuesto.direccion_instalacion ?? '',
    telefono_cliente: (clientRow as Record<string, unknown> | null)?.telefono as string ?? '',
    email_cliente: (clientRow as Record<string, unknown> | null)?.email as string ?? '',
    representante_cliente: (iaJson?.representante_cliente as string | null) ?? '',
    cargo_representante: (iaJson?.cargo_representante as string | null) ?? '',
    referencia,
    ciudad_firma: orgRow?.ciudad ?? '',
    fecha_inicio: fechaInicio.toLocaleDateString('es-ES'),
    fecha_fin: fechaFin.toLocaleDateString('es-ES'),
    duracion_meses: '12',
    cuota_mensual: cuotaMensual > 0 ? cuotaMensual.toFixed(2).replace('.', ',') : '',
    iva_pct: String(ivaPct),
    cuota_mensual_con_iva: cuotaMensual > 0 ? (cuotaMensual * (1 + ivaPct / 100)).toFixed(2).replace('.', ',') : '',
    cuota_anual: cuotaMensual > 0 ? (cuotaMensual * 12).toFixed(2).replace('.', ',') : '',
    periodo_facturacion: presupuesto.tipo_facturacion ?? 'mensual',
    forma_pago: 'Domiciliación bancaria (SEPA)',
    iban: (orgRow as Record<string, unknown> | null)?.iban as string ?? '',
    dia_vencimiento: '5',
    horario_guardia: presupuesto.incluye_guardia ? '24 horas / 7 días' : 'Lunes a viernes de 08:00 a 18:00 h',
    servicio_urgencias: presupuesto.incluye_guardia ? '24 horas / 7 días' : 'No incluido',
    tiempo_respuesta: tiempoRespuesta,
    tiempo_resolucion: '24 horas para averías críticas, 72 horas para incidencias menores',
    disponibilidad: '99% mensual en horario de guardia',
    penalizacion_sla: '5% del importe mensual por cada día de retraso sobre el SLA',
    descripcion_instalaciones: descripcionInstalaciones,
    ciudad_jurisdiccion: orgRow?.ciudad ?? '',
    cobertura_rc: '600.000',
    limite_correctivo: '500',
  };

  // Create trade_contracts record (professional format, appears in CONTRATOS sidebar)
  const { data: tradeContract, error: contractError } = await supabase
    .from('trade_contracts')
    .insert({
      org_id: presupuesto.org_id,
      referencia,
      oficio: presupuesto.oficio,
      estado: 'firmado',
      firmado_at: new Date().toISOString(),
      variables: vars,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (contractError) throw contractError;

  // Create trade_maintenance_contratos record
  const { data, error } = await supabase
    .from('trade_maintenance_contratos')
    .insert({
      org_id:                 presupuesto.org_id,
      client_id:              presupuesto.client_id,
      presupuesto_id:         presupuesto.id,
      plantilla_id:           presupuesto.plantilla_id,
      numero:                 referencia,
      oficio:                 presupuesto.oficio,
      sector:                 presupuesto.sector,
      nombre_cliente:         presupuesto.nombre_cliente,
      direccion_instalacion:  presupuesto.direccion_instalacion,
      descripcion_servicios:  presupuesto.descripcion_servicios,
      cuota_mensual:          cuotaMensual,
      tipo_facturacion:       presupuesto.tipo_facturacion,
      iva_pct:                ivaPct,
      sla_nivel:              presupuesto.sla_nivel,
      tiempo_respuesta_h:     presupuesto.tiempo_respuesta_h,
      incluye_preventivos:    presupuesto.incluye_preventivos,
      num_visitas_preventivo: presupuesto.num_visitas_preventivo,
      frecuencia_preventivo:  'mensual',
      incluye_guardia:        presupuesto.incluye_guardia,
      materiales_incluidos:   false,
      fecha_inicio:           fechaInicio.toISOString().split('T')[0],
      fecha_fin:              fechaFin.toISOString().split('T')[0],
      duracion_meses:         12,
      renovacion_automatica:  true,
      preaviso_cancelacion_dias: 30,
      dia_facturacion:        1,
      proxima_factura:        proxima.toISOString().split('T')[0],
      estado:                 'activo',
      contract_id:            tradeContract.id,
      updated_at:             new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;

  // Update trade_contracts with mantenimiento_id back-reference
  await supabase
    .from('trade_contracts')
    .update({ mantenimiento_id: data.id })
    .eq('id', tradeContract.id);

  // Create invoices (12 months)
  if (cuotaMensual > 0) {
    await createMaintenanceInvoices(presupuesto.org_id, tradeContract.id, {
      clientId: presupuesto.client_id,
      cuotaMensual,
      ivaPct,
      periodoFacturacion: presupuesto.tipo_facturacion,
      duracionMeses: 12,
      diaVencimiento: 5,
      nombreCliente: presupuesto.nombre_cliente ?? 'Cliente',
      referencia,
    });
  }

  // Mark presupuesto as converted
  await supabase
    .from('trade_maintenance_presupuestos')
    .update({ estado: 'convertido', updated_at: new Date().toISOString() })
    .eq('id', presupuesto.id);

  return data as MaintenanceContrato;
}

// ── Quote acceptance tokens ───────────────────────────────────────────────────

export interface QuoteToken {
  id: string;
  org_id: string;
  quote_numero: string;
  token: string;
  status: 'pending' | 'accepted' | 'rejected';
  client_name: string | null;
  quote_data: Record<string, unknown>;
  accepted_at: string | null;
  created_at: string;
}

export async function createQuoteToken(
  orgId: string,
  quoteNumero: string,
  clientName: string | null,
  quoteData: Record<string, unknown>,
): Promise<QuoteToken> {
  const { data, error } = await supabase
    .from('trade_quote_tokens')
    .insert({ org_id: orgId, quote_numero: quoteNumero, client_name: clientName, quote_data: quoteData })
    .select()
    .single();
  if (error) throw error;
  return data as QuoteToken;
}

export async function getQuoteByToken(token: string): Promise<QuoteToken | null> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/trade-quote-public`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ token, action: 'get' }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return (json.data ?? null) as QuoteToken | null;
}

export async function respondQuoteToken(token: string, action: 'accepted' | 'rejected'): Promise<void> {
  const edgeAction = action === 'accepted' ? 'accept' : 'reject';
  const res = await fetch(`${SUPABASE_URL}/functions/v1/trade-quote-public`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ token, action: edgeAction }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ── Org templates ─────────────────────────────────────────────────────────────

export type TemplateType =
  | 'whatsapp_presupuesto'
  | 'email_presupuesto'
  | 'email_factura'
  | 'recordatorio_pago'
  | 'aviso_visita'
  | 'pie_presupuesto'
  | 'pie_factura'
  | 'contrato_mantenimiento';

export interface OrgTemplate {
  id: string;
  org_id: string;
  tipo: TemplateType;
  nombre: string;
  contenido: string;
  updated_at: string;
}

export async function loadOrgTemplates(orgId: string): Promise<OrgTemplate[]> {
  const { data, error } = await supabase
    .from('trade_org_templates')
    .select('*')
    .eq('org_id', orgId);
  if (error) throw error;
  return (data ?? []) as OrgTemplate[];
}

export async function saveOrgTemplate(
  orgId: string,
  tipo: TemplateType,
  contenido: string,
  nombre: string,
): Promise<void> {
  const { error } = await supabase
    .from('trade_org_templates')
    .upsert({ org_id: orgId, tipo, contenido, nombre, updated_at: new Date().toISOString() },
      { onConflict: 'org_id,tipo' });
  if (error) throw error;
}

// ── Logo upload ───────────────────────────────────────────────────────────────

export async function uploadOrgLogo(orgId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'png';
  const path = `${orgId}/logo.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('org-logos')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from('org-logos').getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;

  const { error: dbErr } = await supabase
    .from('trade_organizations')
    .update({ logo_url: url })
    .eq('id', orgId);
  if (dbErr) throw dbErr;

  return url;
}

// ── Contracts ─────────────────────────────────────────────────────────────────

export interface TradeContract {
  id: string;
  org_id: string;
  client_id?: string;
  mantenimiento_id?: string;
  referencia: string;
  oficio: string;
  estado: 'borrador' | 'firmado';
  variables: Record<string, string>;
  contenido_html?: string;
  pdf_url?: string;
  firmado_at?: string;
  created_at: string;
  updated_at: string;
}

export async function loadTradeContractById(id: string): Promise<TradeContract | null> {
  const { data } = await supabase.from('trade_contracts').select('*').eq('id', id).maybeSingle();
  return data as TradeContract | null;
}

export async function loadContracts(orgId: string): Promise<TradeContract[]> {
  const { data, error } = await supabase
    .from('trade_contracts')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TradeContract[];
}

export async function createContract(
  orgId: string,
  payload: {
    referencia: string;
    oficio: string;
    client_id?: string;
    mantenimiento_id?: string;
    variables: Record<string, string>;
    contenido_html?: string;
  },
): Promise<TradeContract> {
  const { data, error } = await supabase
    .from('trade_contracts')
    .insert({ org_id: orgId, ...payload, estado: 'borrador', updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as TradeContract;
}

export async function updateContract(
  id: string,
  payload: Partial<Pick<TradeContract, 'variables' | 'contenido_html' | 'estado' | 'firmado_at'>>,
): Promise<void> {
  const { error } = await supabase
    .from('trade_contracts')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function signContract(id: string, contenido_html: string): Promise<void> {
  const { error } = await supabase
    .from('trade_contracts')
    .update({
      estado: 'firmado',
      contenido_html,
      firmado_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteContract(id: string): Promise<void> {
  const { error } = await supabase.from('trade_contracts').delete().eq('id', id);
  if (error) throw error;
}

// ── Chatbot ───────────────────────────────────────────────────────────────────

export interface InstallerNeed {
  id: string;
  org_id?: string;
  oficio?: string;
  question: string;
  context: Record<string, string>;
  tipo: 'unanswered' | 'unknown_oficio' | 'feature_request';
  reviewed: boolean;
  created_at: string;
}

export interface ChatbotMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatbotContext {
  oficio?: string;
  plan?: string;
  currentScreen?: string;
  orgId?: string;
}

export interface ChatbotResponse {
  answer: string;
  chips: string[];
  action: { label: string; page: string } | null;
  canAnswer: boolean;
  unknownOficio: boolean;
}

export async function callChatbot(
  message: string,
  history: ChatbotMessage[],
  context: ChatbotContext,
): Promise<ChatbotResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trade-chatbot`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, history, context }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chatbot error: ${err}`);
  }
  return res.json();
}

export async function loadInstallerNeeds(): Promise<InstallerNeed[]> {
  const { data, error } = await supabase
    .from('trade_installer_needs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InstallerNeed[];
}

export async function markNeedReviewed(id: string): Promise<void> {
  const { error } = await supabase
    .from('trade_installer_needs')
    .update({ reviewed: true })
    .eq('id', id);
  if (error) throw error;
}

// ── Admin: AI Feedback ────────────────────────────────────────────────────────

export interface AIFeedbackRow {
  id: string;
  org_id: string;
  transcript: string;
  actuacion_ids: string[];
  ai_partidas: unknown[];
  final_partidas: unknown[];
  nuevas_partidas: unknown[];
  kb_score: number;
  applied: boolean;
  created_at: string;
}

export async function adminLoadAIFeedback(): Promise<AIFeedbackRow[]> {
  const { data, error } = await supabase
    .from('trade_ai_feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as AIFeedbackRow[];
}

export async function adminMarkFeedbackApplied(id: string): Promise<void> {
  const { error } = await supabase
    .from('trade_ai_feedback')
    .update({ applied: true })
    .eq('id', id);
  if (error) throw error;
}

// ── Subcontratas ──────────────────────────────────────────────────────────────

export interface TradeSubcontractor {
  id: string;
  org_id: string;
  nombre: string;
  nif?: string | null;
  email?: string | null;
  telefono?: string | null;
  especialidad?: string | null;
  notas?: string | null;
  activo: boolean;
  created_at: string;
  // Campos ampliados
  direccion_fiscal?: string | null;
  direccion_trabajo?: string | null;
  persona_contacto?: string | null;
  horarios?: string | null;
  cobertura?: string | null;
  valoracion?: number | null;
  estado_proveedor?: 'activo' | 'pendiente' | 'bloqueado' | null;
}

export interface TradeSubcontrata {
  id: string;
  org_id: string;
  numero?: string | null;          // SUB-YYYY-NNN (generado por trigger)
  subcontractor_id: string;
  job_id?: string | null;
  contract_id?: string | null;
  quote_id?: string | null;        // presupuesto directamente vinculado
  descripcion: string;
  coste: number;
  precio_cliente: number;
  estado: 'pendiente' | 'solicitado' | 'presupuesto_recibido' | 'añadido_presupuesto' | 'pendiente_cliente' | 'en_curso' | 'completado' | 'factura_recibida' | 'pagado' | 'cancelado';
  fecha_inicio?: string | null;
  fecha_fin_prevista?: string | null;
  // Facturación de la subcontrata hacia nosotros
  importe_factura_recibida?: number | null;
  fecha_factura_recibida?: string | null;
  referencia_factura_subcontrata?: string | null;
  pagado?: boolean;
  pagado_at?: string | null;
  created_at: string;
  updated_at: string;
  // joined
  trade_subcontractors?: TradeSubcontractor;
  trade_jobs?: { titulo: string } | null;
  trade_contracts?: { referencia: string } | null;
  trade_quotes?: { numero: string } | null;
}

export interface TradeSubcontrataNota {
  id: string;
  subcontrata_id: string;
  org_id: string;
  texto: string;
  created_at: string;
}

// Proveedores (subcontractors)
export async function loadSubcontractors(orgId: string): Promise<TradeSubcontractor[]> {
  const { data, error } = await supabase
    .from('trade_subcontractors')
    .select('*')
    .eq('org_id', orgId)
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as TradeSubcontractor[];
}

export async function saveSubcontractor(
  orgId: string,
  payload: Omit<TradeSubcontractor, 'id' | 'org_id' | 'created_at'>,
  id?: string,
): Promise<TradeSubcontractor> {
  if (id) {
    const { data, error } = await supabase
      .from('trade_subcontractors')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as TradeSubcontractor;
  }
  const { data, error } = await supabase
    .from('trade_subcontractors')
    .insert({ ...payload, org_id: orgId })
    .select()
    .single();
  if (error) throw error;
  return data as TradeSubcontractor;
}

export async function deleteSubcontractor(id: string): Promise<void> {
  const { error } = await supabase.from('trade_subcontractors').update({ activo: false }).eq('id', id);
  if (error) throw error;
}

// Subcontratas
export async function loadSubcontratas(orgId: string): Promise<TradeSubcontrata[]> {
  const { data, error } = await supabase
    .from('trade_subcontratas')
    .select('*, trade_subcontractors(id,nombre,especialidad,telefono,email), trade_jobs(titulo), trade_contracts(referencia), trade_quotes(numero)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TradeSubcontrata[];
}

export async function saveSubcontrata(
  orgId: string,
  payload: Omit<TradeSubcontrata, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'trade_subcontractors' | 'trade_jobs' | 'trade_contracts'>,
  id?: string,
): Promise<TradeSubcontrata> {
  if (id) {
    const { data, error } = await supabase
      .from('trade_subcontratas')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, trade_subcontractors(id,nombre,especialidad,telefono,email), trade_jobs(titulo), trade_contracts(referencia), trade_quotes(numero)')
      .single();
    if (error) throw error;
    return data as TradeSubcontrata;
  }
  const { data, error } = await supabase
    .from('trade_subcontratas')
    .insert({ ...payload, org_id: orgId })
    .select('*, trade_subcontractors(id,nombre,especialidad,telefono,email), trade_jobs(titulo), trade_contracts(referencia), trade_quotes(numero)')
    .single();
  if (error) throw error;
  return data as TradeSubcontrata;
}

export async function deleteSubcontrata(id: string): Promise<void> {
  const { error } = await supabase.from('trade_subcontratas').delete().eq('id', id);
  if (error) throw error;
}

export async function updateSubcontrataEstado(
  id: string,
  estado: TradeSubcontrata['estado'],
): Promise<void> {
  const { error } = await supabase
    .from('trade_subcontratas')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// Notas
export async function loadSubcontrataNotes(subcontrataId: string): Promise<TradeSubcontrataNota[]> {
  const { data, error } = await supabase
    .from('trade_subcontrata_notas')
    .select('*')
    .eq('subcontrata_id', subcontrataId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TradeSubcontrataNota[];
}

export async function addSubcontrataNota(
  subcontrataId: string,
  orgId: string,
  texto: string,
): Promise<TradeSubcontrataNota> {
  const { data, error } = await supabase
    .from('trade_subcontrata_notas')
    .insert({ subcontrata_id: subcontrataId, org_id: orgId, texto })
    .select()
    .single();
  if (error) throw error;
  return data as TradeSubcontrataNota;
}

export async function deleteSubcontrataNota(id: string): Promise<void> {
  const { error } = await supabase.from('trade_subcontrata_notas').delete().eq('id', id);
  if (error) throw error;
}

// Vincula subcontrata al presupuesto del trabajo: añade una partida con precio_cliente
// Devuelve el número del presupuesto afectado, o null si el trabajo no tiene presupuesto
export async function addSubcontrataToJobQuote(
  jobId: string,
  subcontrataId: string,
  descripcion: string,
  precioCliente: number,
): Promise<{ quoteId: string; quoteNumero: string } | null> {
  const { data: job } = await supabase
    .from('trade_jobs')
    .select('quote_id')
    .eq('id', jobId)
    .maybeSingle();
  if (!job?.quote_id) return null;

  const quoteId = job.quote_id as string;

  // Posición: al final de las partidas actuales
  const { count } = await supabase
    .from('trade_quote_items')
    .select('*', { count: 'exact', head: true })
    .eq('quote_id', quoteId);

  const ref = subcontrataId.replace(/-/g, '').substring(0, 8).toUpperCase();
  await supabase.from('trade_quote_items').insert({
    quote_id: quoteId,
    descripcion: `Trabajos subcontratados — ${descripcion} [SUB-${ref}]`,
    tipo: 'mano_de_obra',
    cantidad: 1,
    precio_unitario: precioCliente,
    total: precioCliente,
    posicion: (count ?? 0),
  });

  // Recalcular total del presupuesto
  const { data: items } = await supabase
    .from('trade_quote_items')
    .select('precio_unitario, cantidad')
    .eq('quote_id', quoteId);
  const nuevoTotal = (items ?? []).reduce((s: number, i: { precio_unitario: number; cantidad: number }) => s + i.precio_unitario * i.cantidad, 0);
  await supabase.from('trade_quotes').update({ total_neto: nuevoTotal }).eq('id', quoteId);

  const { data: quote } = await supabase
    .from('trade_quotes')
    .select('numero')
    .eq('id', quoteId)
    .maybeSingle();

  return { quoteId, quoteNumero: quote?.numero ?? quoteId };
}

// Crea subcontrata vinculada directamente a un presupuesto y añade la partida
export async function createSubcontrataFromQuote(
  orgId: string,
  quoteId: string,
  quoteNumero: string,
  payload: Omit<TradeSubcontrata, 'id' | 'org_id' | 'numero' | 'created_at' | 'updated_at' | 'trade_subcontractors' | 'trade_jobs' | 'trade_contracts' | 'trade_quotes'>,
): Promise<TradeSubcontrata> {
  const sub = await saveSubcontrata(orgId, { ...payload, quote_id: quoteId });

  // Añadir partida al presupuesto
  const { count } = await supabase
    .from('trade_quote_items')
    .select('*', { count: 'exact', head: true })
    .eq('quote_id', quoteId);

  const ref = sub.numero ?? sub.id.replace(/-/g, '').substring(0, 8).toUpperCase();
  await supabase.from('trade_quote_items').insert({
    quote_id: quoteId,
    descripcion: `Trabajos subcontratados — ${payload.descripcion} [${ref}]`,
    tipo: 'mano_de_obra',
    cantidad: 1,
    precio_unitario: payload.precio_cliente,
    total: payload.precio_cliente,
    posicion: (count ?? 0),
  });

  // Recalcular total del presupuesto
  const { data: items } = await supabase
    .from('trade_quote_items')
    .select('precio_unitario, cantidad')
    .eq('quote_id', quoteId);
  const nuevoTotal = (items ?? []).reduce((s: number, i: { precio_unitario: number; cantidad: number }) => s + i.precio_unitario * i.cantidad, 0);
  await supabase.from('trade_quotes').update({ total_neto: nuevoTotal }).eq('id', quoteId);

  return sub;
}

// Registrar factura recibida de la subcontrata
export async function registrarFacturaSubcontrata(
  subcontrataId: string,
  importe: number,
  fecha: string,
  referencia: string,
): Promise<void> {
  const { error } = await supabase
    .from('trade_subcontratas')
    .update({
      importe_factura_recibida: importe,
      fecha_factura_recibida: fecha || null,
      referencia_factura_subcontrata: referencia || null,
      estado: 'factura_recibida',
      updated_at: new Date().toISOString(),
    })
    .eq('id', subcontrataId);
  if (error) throw error;
}

// Marcar subcontrata como pagada
export async function marcarSubcontrataPagada(subcontrataId: string, pagado: boolean): Promise<void> {
  const { error } = await supabase
    .from('trade_subcontratas')
    .update({
      pagado,
      pagado_at: pagado ? new Date().toISOString() : null,
      estado: pagado ? 'pagado' : 'factura_recibida',
      updated_at: new Date().toISOString(),
    })
    .eq('id', subcontrataId);
  if (error) throw error;
}

// Carga subcontratas vinculadas a un presupuesto concreto
export async function loadSubcontratasByQuote(quoteId: string): Promise<TradeSubcontrata[]> {
  const { data, error } = await supabase
    .from('trade_subcontratas')
    .select('*, trade_subcontractors(id,nombre,especialidad,telefono,email), trade_jobs(titulo), trade_contracts(referencia), trade_quotes(numero)')
    .eq('quote_id', quoteId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as TradeSubcontrata[];
}

// ── Mayoristas / Distribuidores de material ────────────────────────────────

export interface TradeMayorista {
  id: string;
  org_id: string;
  nombre: string;
  razon_social?: string | null;
  nif?: string | null;
  direccion_fiscal?: string | null;
  cp?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  telefono?: string | null;
  email?: string | null;
  persona_contacto?: string | null;
  web?: string | null;
  notas?: string | null;
  activo: boolean;
  created_at: string;
}

export interface TradeCompra {
  id: string;
  org_id: string;
  mayorista_id?: string | null;
  subcontrata_id?: string | null;
  referencia_factura?: string | null;
  concepto: string;
  importe: number;
  iva_pct: number;
  fecha?: string | null;
  fecha_vencimiento?: string | null;
  pagado: boolean;
  pagado_at?: string | null;
  job_id?: string | null;
  notas?: string | null;
  created_at: string;
  updated_at: string;
  // joined
  trade_mayoristas?: { nombre: string } | null;
  trade_subcontractors?: { nombre: string } | null;
  trade_jobs?: { titulo: string } | null;
}

export async function loadMayoristas(orgId: string): Promise<TradeMayorista[]> {
  const { data, error } = await supabase
    .from('trade_mayoristas')
    .select('*')
    .eq('org_id', orgId)
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as TradeMayorista[];
}

export async function saveMayorista(
  orgId: string,
  payload: Omit<TradeMayorista, 'id' | 'org_id' | 'created_at'>,
  id?: string,
): Promise<TradeMayorista> {
  if (id) {
    const { data, error } = await supabase
      .from('trade_mayoristas')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as TradeMayorista;
  }
  const { data, error } = await supabase
    .from('trade_mayoristas')
    .insert({ ...payload, org_id: orgId })
    .select()
    .single();
  if (error) throw error;
  return data as TradeMayorista;
}

export async function deleteMayorista(id: string): Promise<void> {
  const { error } = await supabase.from('trade_mayoristas').update({ activo: false }).eq('id', id);
  if (error) throw error;
}

export async function loadCompras(orgId: string): Promise<TradeCompra[]> {
  const { data, error } = await supabase
    .from('trade_compras')
    .select('*, trade_mayoristas(nombre), trade_subcontractors(nombre), trade_jobs(titulo)')
    .eq('org_id', orgId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TradeCompra[];
}

export async function saveCompra(
  orgId: string,
  payload: Omit<TradeCompra, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'trade_mayoristas' | 'trade_subcontractors' | 'trade_jobs'>,
  id?: string,
): Promise<TradeCompra> {
  if (id) {
    const { data, error } = await supabase
      .from('trade_compras')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, trade_mayoristas(nombre), trade_subcontractors(nombre), trade_jobs(titulo)')
      .single();
    if (error) throw error;
    return data as TradeCompra;
  }
  const { data, error } = await supabase
    .from('trade_compras')
    .insert({ ...payload, org_id: orgId })
    .select('*, trade_mayoristas(nombre), trade_subcontractors(nombre), trade_jobs(titulo)')
    .single();
  if (error) throw error;
  return data as TradeCompra;
}

export async function deleteCompra(id: string): Promise<void> {
  const { error } = await supabase.from('trade_compras').delete().eq('id', id);
  if (error) throw error;
}

export async function marcarCompraPagada(id: string, pagado: boolean): Promise<void> {
  const { error } = await supabase
    .from('trade_compras')
    .update({ pagado, pagado_at: pagado ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ── Pedidos de material a proveedores ─────────────────────────────────────────

export interface SupplierOrderLine {
  id: string;
  order_id: string;
  descripcion: string;
  referencia?: string | null;
  cantidad: number;
  unidad: string;
  precio_unitario?: number | null;
  created_at: string;
}

export interface SupplierOrder {
  id: string;
  org_id: string;
  catalog_id: string;
  quote_id?: string | null;
  job_id?: string | null;
  estado: 'borrador' | 'enviado' | 'confirmado' | 'recibido' | 'cancelado';
  notas?: string | null;
  total?: number | null;
  created_at: string;
  updated_at: string;
  trade_supplier_catalogs?: { supplier_name: string; supplier_key: string; contact_email?: string | null } | null;
  trade_supplier_order_lines?: SupplierOrderLine[];
  trade_quotes?: { numero: string; descripcion?: string | null; trade_clients?: { nombre: string; telefono?: string | null } | null } | null;
}

export async function loadSupplierOrders(orgId: string): Promise<SupplierOrder[]> {
  const { data, error } = await supabase
    .from('trade_supplier_orders')
    .select('*, trade_supplier_catalogs(supplier_name, supplier_key, contact_email), trade_supplier_order_lines(*), trade_quotes(numero, descripcion, trade_clients(nombre, telefono))')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupplierOrder[];
}

export async function createSupplierOrder(
  orgId: string,
  catalogId: string,
  lines: Omit<SupplierOrderLine, 'id' | 'order_id' | 'created_at'>[],
  opts?: { quoteId?: string; jobId?: string; notas?: string },
): Promise<SupplierOrder> {
  const total = lines.reduce((sum, l) => sum + l.cantidad * (l.precio_unitario ?? 0), 0);
  const { data: order, error: oErr } = await supabase
    .from('trade_supplier_orders')
    .insert({ org_id: orgId, catalog_id: catalogId, quote_id: opts?.quoteId ?? null, job_id: opts?.jobId ?? null, notas: opts?.notas ?? null, total })
    .select()
    .single();
  if (oErr) throw oErr;

  if (lines.length > 0) {
    const { error: lErr } = await supabase
      .from('trade_supplier_order_lines')
      .insert(lines.map(l => ({ ...l, order_id: order.id })));
    if (lErr) throw lErr;
  }
  return order as SupplierOrder;
}

export async function updateSupplierOrderEstado(
  id: string,
  estado: SupplierOrder['estado'],
): Promise<void> {
  const { error } = await supabase
    .from('trade_supplier_orders')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSupplierOrder(id: string): Promise<void> {
  const { error } = await supabase.from('trade_supplier_orders').delete().eq('id', id);
  if (error) throw error;
}

export async function loadSupplierCatalogs(orgId: string): Promise<{
  id: string; supplier_key: string; supplier_name: string; contact_email?: string | null; margen_pct_default: number;
}[]> {
  const { data, error } = await supabase
    .from('trade_supplier_catalogs')
    .select('id, supplier_key, supplier_name, contact_email, margen_pct_default')
    .eq('is_active', true)
    .order('prioridad');
  if (error) throw error;
  // Filter to only catalogs the org has enabled
  const { data: orgSettings } = await supabase
    .from('trade_org_suppliers')
    .select('catalog_id')
    .eq('org_id', orgId)
    .eq('enabled', true);
  const enabledIds = new Set((orgSettings ?? []).map((s: { catalog_id: string }) => s.catalog_id));
  return ((data ?? []) as { id: string; supplier_key: string; supplier_name: string; contact_email?: string | null; margen_pct_default: number }[])
    .filter(c => enabledIds.has(c.id));
}

export interface ActiveSupplierProduct {
  id: string;
  ref_proveedor: string | null;
  descripcion: string;
  marca: string | null;
  familia: string | null;
  precio_coste: number;
  unidad: string;
}

export interface ActiveSupplierCatalog {
  catalog_id: string;
  supplier_name: string;
  supplier_key: string;
  margen_pct: number;
  products: ActiveSupplierProduct[];
}

export async function loadActiveSupplierCatalogs(orgId: string): Promise<ActiveSupplierCatalog[]> {
  const { data: orgSup, error: e1 } = await supabase
    .from('trade_org_suppliers')
    .select('catalog_id, margen_override')
    .eq('org_id', orgId)
    .eq('enabled', true);
  if (e1 || !orgSup?.length) return [];

  const catalogIds = (orgSup as { catalog_id: string; margen_override: number | null }[]).map(s => s.catalog_id);

  const [catRes, prodRes] = await Promise.all([
    supabase
      .from('trade_supplier_catalogs')
      .select('id, supplier_name, supplier_key, margen_pct_default')
      .in('id', catalogIds),
    supabase
      .from('trade_supplier_products')
      .select('id, catalog_id, ref_proveedor, descripcion, marca, familia, precio_coste, unidad')
      .in('catalog_id', catalogIds)
      .eq('activo', true)
      .order('familia')
      .order('descripcion'),
  ]);

  if (catRes.error || prodRes.error) return [];

  const catalogMap = new Map(
    ((catRes.data ?? []) as { id: string; supplier_name: string; supplier_key: string; margen_pct_default: number }[])
      .map(c => [c.id, c])
  );

  return (orgSup as { catalog_id: string; margen_override: number | null }[]).map(s => {
    const cat = catalogMap.get(s.catalog_id);
    return {
      catalog_id: s.catalog_id,
      supplier_name: cat?.supplier_name ?? '',
      supplier_key: cat?.supplier_key ?? '',
      margen_pct: s.margen_override ?? cat?.margen_pct_default ?? 0,
      products: ((prodRes.data ?? []) as (ActiveSupplierProduct & { catalog_id: string })[])
        .filter(p => p.catalog_id === s.catalog_id),
    };
  });
}

export interface QuoteWithPendingMaterial {
  id: string;
  numero: string;
  descripcion: string | null;
  cliente_nombre: string | null;
  fecha: string;
  pendingItems: {
    id: string;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    supplier_key: string | null;
    supplier_name: string | null;
    catalog_variant_id: string | null;
  }[];
}

export async function loadAcceptedQuotesWithPendingMaterial(orgId: string): Promise<QuoteWithPendingMaterial[]> {
  const { data, error } = await supabase
    .from('trade_quotes')
    .select(`
      id, numero, descripcion, fecha,
      trade_clients(nombre),
      trade_quote_items(id, descripcion, tipo, cantidad, precio_unitario, supplier_key, supplier_name, catalog_variant_id, material_order_placed)
    `)
    .eq('org_id', orgId)
    .eq('estado', 'Aceptado')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as {
    id: string; numero: string; descripcion: string | null; fecha: string;
    trade_clients: { nombre: string } | null;
    trade_quote_items: TradeQuoteItem[];
  }[])
    .map(q => ({
      id: q.id,
      numero: q.numero,
      descripcion: q.descripcion,
      cliente_nombre: q.trade_clients?.nombre ?? null,
      fecha: q.fecha,
      pendingItems: (q.trade_quote_items ?? [])
        .filter(i => i.tipo === 'material' && !i.material_order_placed)
        .map(i => ({
          id: i.id,
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          supplier_key: i.supplier_key ?? null,
          supplier_name: i.supplier_name ?? null,
          catalog_variant_id: i.catalog_variant_id ?? null,
        })),
    }))
    .filter(q => q.pendingItems.length > 0);
}

export async function markQuoteItemsOrdered(itemIds: string[]): Promise<void> {
  if (!itemIds.length) return;
  const { error } = await supabase
    .from('trade_quote_items')
    .update({ material_order_placed: true })
    .in('id', itemIds);
  if (error) throw error;
}
