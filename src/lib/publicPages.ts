// Mi página online — acceso a datos (Supabase). La lógica pura vive en publicPageUtils.ts.
import { supabase } from './supabase';
import type { PublicPage, PageRequest, EstadoSolicitud } from './publicPageUtils';

export * from './publicPageUtils';

const PAGE_COLUMNS = 'id, org_id, slug, activa, nombre, oficio, whatsapp, acerca, acerca_on, servicios, servicios_on, cifras, cifras_on, preguntas, portfolio, portfolio_on, portada_url';

export async function loadOwnPublicPage(orgId: string): Promise<PublicPage | null> {
  const { data, error } = await supabase.from('trade_public_pages').select(PAGE_COLUMNS).eq('org_id', orgId).maybeSingle();
  if (error) throw error;
  return (data as PublicPage | null) ?? null;
}

/** Guarda (crea o actualiza) la página de la organización. Devuelve el error de slug duplicado como mensaje claro. */
export async function saveOwnPublicPage(orgId: string, page: PublicPage): Promise<PublicPage> {
  const payload = {
    org_id: orgId,
    slug: page.slug,
    activa: page.activa,
    nombre: page.nombre.trim().slice(0, 120),
    oficio: page.oficio.trim().slice(0, 80),
    whatsapp: page.whatsapp.trim().slice(0, 30),
    acerca: page.acerca.trim().slice(0, 2000),
    acerca_on: page.acerca_on,
    servicios: page.servicios.map(s => s.trim()).filter(Boolean).slice(0, 30),
    servicios_on: page.servicios_on,
    cifras: page.cifras.filter(c => c.valor.trim() && c.etiqueta.trim()).slice(0, 6),
    cifras_on: page.cifras_on,
    preguntas: page.preguntas.filter(p => p.etiqueta.trim()).slice(0, 12),
    portfolio: page.portfolio.slice(0, 12),
    portfolio_on: page.portfolio_on,
    portada_url: page.portada_url,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('trade_public_pages')
    .upsert(payload, { onConflict: 'org_id' })
    .select(PAGE_COLUMNS)
    .single();
  if (error) {
    if ((error as { code?: string }).code === '23505') throw new Error('Esa dirección ya la usa otro profesional. Prueba otra.');
    throw error;
  }
  return data as PublicPage;
}

/** Página pública activa por slug (lectura anónima permitida por RLS solo si está activa). */
export async function loadPublicPageBySlug(slug: string): Promise<PublicPage | null> {
  const { data, error } = await supabase.from('trade_public_pages').select(PAGE_COLUMNS).eq('slug', slug).eq('activa', true).maybeSingle();
  if (error) throw error;
  return (data as PublicPage | null) ?? null;
}

export async function uploadPageImage(orgId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${orgId}/pagina/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('org-logos').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from('org-logos').getPublicUrl(path).data.publicUrl;
}

export async function loadPageRequests(orgId: string): Promise<PageRequest[]> {
  const { data, error } = await supabase
    .from('trade_page_requests')
    .select('id, nombre, telefono, respuestas, mensaje, estado, quote_numero, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as PageRequest[];
}

export async function updatePageRequestState(id: string, estado: EstadoSolicitud, quoteNumero?: string | null): Promise<void> {
  const { error } = await supabase
    .from('trade_page_requests')
    .update({ estado, updated_at: new Date().toISOString(), ...(quoteNumero !== undefined ? { quote_numero: quoteNumero } : {}) })
    .eq('id', id);
  if (error) throw error;
}

export async function submitPageRequest(input: {
  slug: string;
  nombre: string;
  telefono: string;
  respuestas: Record<string, string>;
  mensaje: string;
  consentimiento: boolean;
  website: string;
}): Promise<{ ok: boolean; whatsapp?: string; error?: string }> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trade-page-request`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({})) as { ok?: boolean; whatsapp?: string; error?: string };
  if (!res.ok) return { ok: false, error: json.error ?? 'No se pudo enviar la solicitud' };
  return { ok: true, whatsapp: json.whatsapp };
}
