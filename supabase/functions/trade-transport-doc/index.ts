/**
 * Edge Function: trade-transport-doc
 *
 * Emisión y gestión de documentos de control administrativo en transporte:
 *   · DeCA de mercancías       (Orden FOM/2861/2012)
 *   · Hoja de ruta de viajeros (Orden FOM/1230/2013)
 * conforme a la Resolución DGTCF de 5-jun-2026 (BOE-A-2026-12784).
 *
 * Acciones (POST JSON, JWT obligatorio):
 *   { action: 'emitir',          org_id, tipo, datos, sustituye_a?, motivo_modificacion? }
 *   { action: 'anular',          org_id, id, motivo }
 *   { action: 'reverse_geocode', org_id, lat, lng }
 *   { action: 'enviar_email',    org_id, id, to_email }   → envía enlace + PDF adjunto por Resend
 *
 * Seguridad:
 *   1. JWT → user_id
 *   2. Pertenencia activa a la org (owner o miembro activo) y transport_enabled
 *   3. Datos del transportista SIEMPRE desde la org (no del cliente)
 *   4. Escritura con service_role; la tabla no tiene políticas de escritura
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildControlDocPdf, sha256Hex, type ControlDocData, type Parada } from '../_shared/transportDocPdf.ts';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY         = Deno.env.get('SUPABASE_ANON_KEY')!;
const PUBLIC_BASE      = (Deno.env.get('TRANSPORT_DOC_PUBLIC_BASE') ?? 'https://trabflow.com/d').replace(/\/+$/, '');
const BUCKET           = 'transport-control-docs';
const RESEND_API_KEY   = Deno.env.get('RESEND2_API_KEY') ?? Deno.env.get('RESEND_API_KEY') ?? '';
const EMAIL_FROM       = 'TrabFlow <contacto@trabflow.com>';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ALLOWED_ORIGINS = ['https://trabflow.com', 'https://www.trabflow.com', 'http://localhost:5173', 'http://localhost:4173'];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const ok = ALLOWED_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    'Vary': 'Origin',
  };
}

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

// ── Validaciones ──────────────────────────────────────────────────────

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

/** Valida DNI, NIE y CIF españoles (con dígito de control). */
export function validarNifEs(raw: string): boolean {
  const v = raw.toUpperCase().replace(/[\s.-]/g, '');
  if (/^\d{8}[A-Z]$/.test(v)) return DNI_LETTERS[parseInt(v.slice(0, 8), 10) % 23] === v[8];
  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) {
    const n = 'XYZ'.indexOf(v[0]) + v.slice(1, 8);
    return DNI_LETTERS[parseInt(n, 10) % 23] === v[8];
  }
  if (/^[KLM]\d{7}[A-Z]$/.test(v)) return DNI_LETTERS[parseInt(v.slice(1, 8), 10) % 23] === v[8];
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(v)) {
    const digits = v.slice(1, 8);
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      let d = parseInt(digits[i], 10);
      if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
    }
    const ctrl = (10 - (sum % 10)) % 10;
    const last = v[8];
    if (/[PQRSNW]/.test(v[0])) return last === 'JABCDEFGHI'[ctrl];
    if (/[ABEH]/.test(v[0])) return last === String(ctrl);
    return last === String(ctrl) || last === 'JABCDEFGHI'[ctrl];
  }
  return false;
}

/** NIF extranjero (intracomunitario u otro): se admite con prefijo de país. */
function validarNifCualquiera(raw: string): boolean {
  const v = raw.toUpperCase().replace(/[\s.-]/g, '');
  if (validarNifEs(v)) return true;
  if (v.startsWith('ES')) return validarNifEs(v.slice(2));
  return /^[A-Z]{2}[A-Z0-9]{4,14}$/.test(v);
}

function normMatricula(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, '');
}

function str(v: unknown, max = 300): string | null {
  if (v == null) return null;
  if (typeof v !== 'string' && typeof v !== 'number') throw new HttpError(400, 'BAD_INPUT', 'Dato con formato no válido');
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function req(v: string | null, label: string): string {
  if (!v) throw new HttpError(400, 'MISSING_FIELD', `Falta: ${label}`);
  return v;
}

function madridNowParts(): { date: string; time: string } {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => f.find(p => p.type === t)?.value ?? '';
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` };
}

function randomToken(): string {
  const b = new Uint8Array(24); // 192 bits
  crypto.getRandomValues(b);
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

// ── Auth / pertenencia ────────────────────────────────────────────────

async function authorize(req: Request, orgId: string): Promise<{ userId: string; isAdmin: boolean; org: Record<string, unknown> }> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) throw new HttpError(401, 'UNAUTHORIZED', 'Sesión no válida');
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data: u, error: uErr } = await userClient.auth.getUser();
  if (uErr || !u?.user) throw new HttpError(401, 'UNAUTHORIZED', 'Sesión no válida');
  const userId = u.user.id;

  const { data: org } = await admin.from('trade_organizations')
    .select('id, owner_id, nombre, nif, direccion, cp, ciudad, localidad, provincia, transport_enabled, transport_modalidad')
    .eq('id', orgId).maybeSingle();
  if (!org) throw new HttpError(404, 'ORG_NOT_FOUND', 'Organización no encontrada');

  let isAdmin = org.owner_id === userId;
  if (!isAdmin) {
    const { data: m } = await admin.from('trade_org_members')
      .select('rol, activo').eq('org_id', orgId).eq('user_id', userId).maybeSingle();
    if (!m || m.activo === false) throw new HttpError(403, 'FORBIDDEN', 'No perteneces a esta organización');
    isAdmin = ['owner', 'admin'].includes(m.rol);
  }
  if (!org.transport_enabled) throw new HttpError(403, 'TRANSPORT_DISABLED', 'El módulo de transporte no está activo');
  return { userId, isAdmin, org };
}

// ── Emitir ────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function emitir(body: any, userId: string, isAdmin: boolean, org: any) {
  const tipo = body.tipo;
  if (tipo !== 'deca' && tipo !== 'hoja_ruta') throw new HttpError(400, 'BAD_TIPO', 'Tipo de documento no válido');
  const d = body.datos ?? {};

  // Cada empresa emite solo el documento de su actividad:
  //   viajeros → hoja de ruta · mercancías/reparto → DeCA · combinada (o sin definir) → ambos
  const modalidad = org.transport_modalidad as string | null;
  if (tipo === 'deca' && modalidad === 'viajeros') {
    throw new HttpError(403, 'TIPO_NO_PERMITIDO', 'Su empresa está dada de alta solo para viajeros: emita hojas de ruta');
  }
  if (tipo === 'hoja_ruta' && (modalidad === 'mercancias' || modalidad === 'reparto')) {
    throw new HttpError(403, 'TIPO_NO_PERMITIDO', 'Su empresa está dada de alta solo para mercancías: emita DeCA');
  }

  // Transportista = la org
  const transportistaNif = str(org.nif, 20);
  if (!transportistaNif) {
    throw new HttpError(422, 'ORG_NIF_MISSING', 'Completa el NIF de tu empresa en Ajustes antes de emitir documentos de control');
  }
  if (!validarNifCualquiera(transportistaNif)) {
    throw new HttpError(422, 'ORG_NIF_INVALID', `El NIF de tu empresa (${transportistaNif}) no es válido: revisa la letra o el dígito de control en Ajustes`);
  }
  const lugar = [org.cp, org.localidad ?? org.ciudad, org.provincia ? `(${org.provincia})` : null].filter(Boolean).join(' ');
  const transportistaDomicilio = [org.direccion, lugar].filter(Boolean).join(', ') || null;

  const cargadorNombre = req(str(d.cargador_nombre, 200), tipo === 'deca' ? 'nombre del cargador contractual' : 'nombre del contratante');
  const cargadorNif = str(d.cargador_nif, 20)?.toUpperCase().replace(/[\s.-]/g, '') ?? null;
  const cargadorDomicilio = str(d.cargador_domicilio, 300);
  if (cargadorNif && !validarNifCualquiera(cargadorNif)) throw new HttpError(422, 'BAD_NIF', 'El NIF del cargador/contratante no es válido');

  const origen  = req(str(d.origen, 300), 'lugar de origen');
  const destino = req(str(d.destino, 300), 'lugar de destino');

  const paradasIn = Array.isArray(d.paradas) ? d.paradas.slice(0, 30) : [];
  const paradas: Parada[] = paradasIn
    .map((p: unknown) => typeof p === 'string' ? { nombre: p } : (p as Parada))
    .map((p: Parada) => ({ nombre: str(p?.nombre, 150) ?? '', hora: str(p?.hora, 5) }))
    .filter((p: Parada) => p.nombre)
    .map((p: Parada) => (p.hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.hora) ? { nombre: p.nombre } : p));

  const fechaServicio = req(str(d.fecha_servicio, 10), 'fecha del transporte');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaServicio)) throw new HttpError(400, 'BAD_DATE', 'Fecha no válida');
  const horaSalida = str(d.hora_salida, 5);
  if (horaSalida && !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaSalida)) throw new HttpError(400, 'BAD_TIME', 'Hora no válida');

  // El documento debe existir ANTES del inicio efectivo del servicio
  const now = madridNowParts();
  if (fechaServicio < now.date) {
    throw new HttpError(422, 'SERVICE_IN_PAST', 'No se puede emitir un documento de control para un transporte de un día anterior');
  }

  const matricula = normMatricula(req(str(d.matricula_vehiculo, 15), 'matrícula del vehículo'));
  if (!/^[A-Z0-9]{4,10}$/.test(matricula)) throw new HttpError(422, 'BAD_PLATE', 'Matrícula no válida');
  const remolqueRaw = str(d.matricula_remolque, 15);
  const remolque = remolqueRaw ? normMatricula(remolqueRaw) : null;
  if (remolque && !/^[A-Z0-9]{4,11}$/.test(remolque)) throw new HttpError(422, 'BAD_PLATE', 'Matrícula del remolque no válida');

  let fechaFin: string | null = null;
  let naturalezaMercancia: string | null = null;
  let pesoKg: number | null = null;
  let otraMagnitud: string | null = null;
  let conductorNombre = str(d.conductor_nombre, 150);
  let conductorNif = str(d.conductor_nif, 20)?.toUpperCase().replace(/[\s.-]/g, '') ?? null;
  let naturalezaServicio: string | null = null;
  const servicioReferencia = str(d.servicio_referencia, 200);

  if (tipo === 'deca') {
    req(cargadorNif, 'NIF del cargador contractual');
    req(cargadorDomicilio, 'domicilio del cargador contractual');
    naturalezaMercancia = req(str(d.naturaleza_mercancia, 200), 'naturaleza de la mercancía');
    if (d.peso_kg != null && d.peso_kg !== '') {
      pesoKg = Number(d.peso_kg);
      if (!Number.isFinite(pesoKg) || pesoKg <= 0 || pesoKg > 100000) throw new HttpError(422, 'BAD_WEIGHT', 'Peso no válido');
    }
    otraMagnitud = str(d.otra_magnitud, 120);
    if (pesoKg == null && !otraMagnitud) throw new HttpError(400, 'MISSING_FIELD', 'Falta: peso de la mercancía (u otra magnitud)');
    if (conductorNif && !validarNifCualquiera(conductorNif)) throw new HttpError(422, 'BAD_NIF', 'El NIF del conductor no es válido');
  } else {
    req(cargadorNif, 'NIF del contratante');
    conductorNombre = req(conductorNombre, 'nombre del conductor');
    conductorNif = req(conductorNif, 'NIF del conductor');
    if (!validarNifCualquiera(conductorNif)) throw new HttpError(422, 'BAD_NIF', 'El NIF del conductor no es válido');
    naturalezaServicio = str(d.naturaleza_servicio, 40);
    if (!['discrecional', 'refuerzo_regular', 'colaboracion_regular_especial', 'turistico'].includes(naturalezaServicio ?? '')) {
      throw new HttpError(400, 'MISSING_FIELD', 'Falta: naturaleza del servicio');
    }
    if ((naturalezaServicio === 'refuerzo_regular' || naturalezaServicio === 'colaboracion_regular_especial') && !servicioReferencia) {
      throw new HttpError(400, 'MISSING_FIELD', 'Indica el servicio regular al que se refuerza o con el que se colabora');
    }
    const ff = str(d.fecha_fin, 40);
    if (ff) {
      const t = new Date(ff);
      if (Number.isNaN(t.getTime())) throw new HttpError(400, 'BAD_DATE', 'Fecha de regreso no válida');
      fechaFin = t.toISOString();
    }
  }

  // Vínculos opcionales: solo se aceptan si pertenecen a la org
  async function ownId(table: string, id: unknown): Promise<string | null> {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { data } = await admin.from(table).select('id').eq('id', id).eq('org_id', org.id).maybeSingle();
    return data?.id ?? null;
  }
  const [vehicleId, conductorId, clientId, serviceId, tripId, shipmentId] = await Promise.all([
    ownId('trade_vehicles', d.vehicle_id),
    ownId('trade_workers', d.conductor_id),
    ownId('trade_clients', d.client_id),
    ownId('trade_transport_services', d.service_id),
    ownId('trade_transport_trips', d.trip_id),
    ownId('trade_transport_shipments', d.shipment_id),
  ]);

  // Sustitución (modificación con PDF nuevo)
  let sustituye: { id: string; numero: string; estado: string; tipo: string; created_by: string | null } | null = null;
  const motivo = str(body.motivo_modificacion, 300);
  if (body.sustituye_a) {
    const { data } = await admin.from('trade_transport_control_docs')
      .select('id, numero, estado, tipo, created_by').eq('id', body.sustituye_a).eq('org_id', org.id).maybeSingle();
    if (!data) throw new HttpError(404, 'DOC_NOT_FOUND', 'Documento a sustituir no encontrado');
    if (data.estado !== 'vigente') throw new HttpError(409, 'DOC_NOT_VIGENTE', 'Solo se puede modificar un documento vigente');
    if (data.tipo !== tipo) throw new HttpError(400, 'BAD_TIPO', 'El documento sustituto debe ser del mismo tipo');
    if (!isAdmin && data.created_by !== userId) throw new HttpError(403, 'FORBIDDEN', 'Solo quien lo emitió o un administrador puede modificarlo');
    if (!motivo) throw new HttpError(400, 'MISSING_FIELD', 'Indica el motivo de la modificación');
    sustituye = data;
  }

  // Disponibilidad pública: fin del servicio + 7 días naturales
  const finBase = fechaFin ? new Date(fechaFin) : new Date(`${fechaServicio}T23:59:59+01:00`);
  const publicHasta = new Date(finBase.getTime() + 7 * 86400_000).toISOString();

  const { data: numero, error: nErr } = await admin.rpc('tx_doc_next_number', { p_org_id: org.id, p_tipo: tipo });
  if (nErr || !numero) throw new HttpError(500, 'NUMBERING_FAILED', 'No se pudo numerar el documento');

  const token = randomToken();
  const publicUrl = `${PUBLIC_BASE}/${token}`;
  const creadoEn = new Date();

  const row = {
    org_id: org.id, tipo, numero, estado: 'vigente', public_token: token,
    service_id: serviceId, trip_id: tripId, shipment_id: tipo === 'deca' ? shipmentId : null, vehicle_id: vehicleId, conductor_id: conductorId, client_id: clientId,
    transportista_nombre: org.nombre, transportista_nif: transportistaNif.toUpperCase(), transportista_domicilio: transportistaDomicilio,
    cargador_nombre: cargadorNombre, cargador_nif: cargadorNif, cargador_domicilio: cargadorDomicilio,
    origen, destino, paradas, fecha_servicio: fechaServicio, hora_salida: horaSalida, fecha_fin: fechaFin,
    naturaleza_mercancia: naturalezaMercancia, peso_kg: pesoKg, otra_magnitud: otraMagnitud,
    autorizacion_especial: tipo === 'deca' ? str(d.autorizacion_especial, 200) : null,
    matricula_remolque: tipo === 'deca' ? remolque : null,
    matricula_vehiculo: matricula, conductor_nombre: conductorNombre, conductor_nif: conductorNif,
    naturaleza_servicio: naturalezaServicio, servicio_referencia: tipo === 'hoja_ruta' ? servicioReferencia : null,
    observaciones: str(d.observaciones, 1000),
    sustituye_a: sustituye?.id ?? null, motivo_modificacion: sustituye ? motivo : null,
    public_hasta: publicHasta, created_by: userId, created_at: creadoEn.toISOString(),
  };

  const { data: inserted, error: insErr } = await admin.from('trade_transport_control_docs').insert(row).select('id').single();
  if (insErr || !inserted) {
    console.error('[trade-transport-doc] insert', insErr);
    throw new HttpError(500, 'INSERT_FAILED', 'No se pudo guardar el documento');
  }

  const pdfData: ControlDocData = {
    ...row, tipo, numero, public_url: publicUrl, creado_en: creadoEn, paradas,
    sustituye_numero: sustituye?.numero ?? null,
  };
  const bytes = await buildControlDocPdf(pdfData);
  if (bytes.length > 5 * 1024 * 1024) throw new HttpError(500, 'PDF_TOO_LARGE', 'El PDF supera 5 MB');
  const hash = await sha256Hex(bytes);
  const path = `${org.id}/${inserted.id}.pdf`;

  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: 'application/pdf', upsert: false,
  });
  if (upErr) {
    console.error('[trade-transport-doc] upload', upErr);
    await admin.from('trade_transport_control_docs').update({ estado: 'anulado', anulado_at: new Date().toISOString(), motivo_anulacion: 'Error técnico al generar el PDF' }).eq('id', inserted.id);
    throw new HttpError(500, 'UPLOAD_FAILED', 'No se pudo guardar el PDF');
  }

  await admin.from('trade_transport_control_docs')
    .update({ pdf_path: path, pdf_sha256: hash, pdf_bytes: bytes.length })
    .eq('id', inserted.id);

  if (sustituye) {
    await admin.from('trade_transport_control_docs').update({ estado: 'sustituido' }).eq('id', sustituye.id);
  }

  // Guardar el NIF del conductor en su ficha si no lo tenía (comodidad para la próxima vez)
  if (conductorId && conductorNif) {
    await admin.from('trade_workers').update({ nif: conductorNif }).eq('id', conductorId).eq('org_id', org.id).is('nif', null);
  }

  return { ok: true, id: inserted.id, numero, public_url: publicUrl, public_hasta: publicHasta, pdf_sha256: hash };
}

// ── Anular ────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function anular(body: any, userId: string, isAdmin: boolean, orgId: string) {
  const motivo = str(body.motivo, 300);
  if (!motivo) throw new HttpError(400, 'MISSING_FIELD', 'Indica el motivo de la anulación');
  const { data: doc } = await admin.from('trade_transport_control_docs')
    .select('id, estado, created_by').eq('id', body.id).eq('org_id', orgId).maybeSingle();
  if (!doc) throw new HttpError(404, 'DOC_NOT_FOUND', 'Documento no encontrado');
  if (doc.estado !== 'vigente') throw new HttpError(409, 'DOC_NOT_VIGENTE', 'El documento ya no está vigente');
  if (!isAdmin && doc.created_by !== userId) throw new HttpError(403, 'FORBIDDEN', 'Solo quien lo emitió o un administrador puede anularlo');
  const { error } = await admin.from('trade_transport_control_docs')
    .update({ estado: 'anulado', anulado_at: new Date().toISOString(), motivo_anulacion: motivo })
    .eq('id', doc.id);
  if (error) throw new HttpError(500, 'UPDATE_FAILED', 'No se pudo anular');
  return { ok: true };
}

// ── Geocodificación inversa ("Cargo aquí donde estoy") ────────────────

// deno-lint-ignore no-explicit-any
async function reverseGeocode(body: any) {
  const lat = Number(body.lat), lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new HttpError(400, 'BAD_COORDS', 'Coordenadas no válidas');
  }
  const apiKey = Deno.env.get('GEOAPIFY_API_KEY');
  if (!apiKey) throw new HttpError(503, 'GEO_UNAVAILABLE', 'Geolocalización no disponible');
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), lang: 'es', format: 'json', apiKey });
  const res = await fetch(`https://api.geoapify.com/v1/geocode/reverse?${params}`);
  if (!res.ok) throw new HttpError(502, 'GEO_FAILED', 'No se pudo obtener la dirección');
  const j = await res.json() as { results?: Array<{ street?: string; housenumber?: string; postcode?: string; city?: string; town?: string; village?: string; formatted?: string }> };
  const r = j.results?.[0];
  if (!r) return { ok: true, address: null };
  const calle = [r.street, r.housenumber].filter(Boolean).join(' ');
  const pueblo = r.city ?? r.town ?? r.village;
  const address = [calle, r.postcode, pueblo].filter(Boolean).join(', ') || r.formatted || null;
  return { ok: true, address };
}

// ── Enviar por email (Resend) ─────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtFechaCorta(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

// deno-lint-ignore no-explicit-any
async function enviarEmail(body: any, userId: string, org: any) {
  if (!RESEND_API_KEY) throw new HttpError(503, 'EMAIL_UNAVAILABLE', 'El envío de emails no está configurado');
  const to = str(body.to_email, 254)?.toLowerCase() ?? '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) throw new HttpError(422, 'BAD_EMAIL', 'Email no válido');

  const { data: doc } = await admin.from('trade_transport_control_docs')
    .select('id, tipo, numero, estado, origen, destino, fecha_servicio, hora_salida, matricula_vehiculo, conductor_nombre, public_token, public_hasta, pdf_path')
    .eq('id', body.id).eq('org_id', org.id).maybeSingle();
  if (!doc) throw new HttpError(404, 'DOC_NOT_FOUND', 'Documento no encontrado');
  if (doc.estado !== 'vigente') throw new HttpError(409, 'DOC_NOT_VIGENTE', 'Solo se pueden enviar documentos vigentes');

  // Límite anti-abuso: 30 envíos/hora por usuario (fail-closed)
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`txdoc:${userId}`));
  const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  const { data: okRate, error: rlErr } = await admin.rpc('check_and_increment_email_rate', { p_ip_hash: hash, p_type: 'transport_doc', p_max: 30 });
  if (rlErr) throw new HttpError(503, 'RATE_UNAVAILABLE', 'No se pudo enviar ahora. Inténtalo en unos minutos');
  if (okRate !== true) throw new HttpError(429, 'RATE_LIMIT', 'Has enviado demasiados emails en la última hora');

  const titulo = doc.tipo === 'deca' ? 'Documento de control (DeCA)' : 'Hoja de ruta';
  const url = `${PUBLIC_BASE}/${doc.public_token}`;
  const empresa = String(org.nombre ?? 'TrabFlow');

  const attachments: Array<{ filename: string; content: string }> = [];
  if (doc.pdf_path) {
    const { data: file } = await admin.storage.from(BUCKET).download(doc.pdf_path);
    if (file) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      attachments.push({ filename: `${doc.numero}.pdf`, content: btoa(bin) });
    }
  }

  const fila = (k: string, v: string) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-size:13px">${k}</td><td style="padding:4px 0;color:#0f172a;font-size:13px;font-weight:600">${esc(v)}</td></tr>`;
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px">
  <p style="margin:0 0 4px;color:#64748b;font-size:12px">${esc(empresa)}</p>
  <h2 style="margin:0 0 16px;color:#0f172a;font-size:18px">${titulo} ${esc(doc.numero)}</h2>
  <table style="border-collapse:collapse">
    ${fila('Ruta', `${doc.origen} → ${doc.destino}`)}
    ${fila('Fecha', fmtFechaCorta(doc.fecha_servicio) + (doc.hora_salida ? ` · salida ${doc.hora_salida}` : ''))}
    ${fila('Vehículo', doc.matricula_vehiculo)}
    ${doc.conductor_nombre ? fila('Conductor', doc.conductor_nombre) : ''}
  </table>
  <p style="margin:20px 0"><a href="${url}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Ver documento</a></p>
  <p style="margin:0;color:#64748b;font-size:12px">Se adjunta el PDF. El enlace con código QR está disponible hasta el ${fmtFechaCorta(doc.public_hasta)}.</p>
  <p style="margin:24px 0 0;color:#94a3b8;font-size:11px">Enviado con TrabFlow · trabflow.com</p>
</div></body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject: `${titulo} ${doc.numero} · ${empresa}`, html, attachments }),
  });
  if (!res.ok) {
    console.error('[trade-transport-doc] resend', res.status, await res.text());
    throw new HttpError(502, 'EMAIL_FAILED', 'No se pudo enviar el email');
  }
  return { ok: true, to };
}

// ── Servidor ──────────────────────────────────────────────────────────

Deno.serve(async (request: Request) => {
  const headers = { ...cors(request), 'Content-Type': 'application/json' };
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors(request) });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  try {
    // deno-lint-ignore no-explicit-any
    let body: any;
    try { body = await request.json(); } catch { throw new HttpError(400, 'BAD_JSON', 'JSON no válido'); }
    if (typeof body?.org_id !== 'string') throw new HttpError(400, 'MISSING_ORG', 'Falta la organización');

    const { userId, isAdmin, org } = await authorize(request, body.org_id);

    let result: unknown;
    switch (body.action) {
      case 'emitir':          result = await emitir(body, userId, isAdmin, org); break;
      case 'anular':          result = await anular(body, userId, isAdmin, body.org_id); break;
      case 'reverse_geocode': result = await reverseGeocode(body); break;
      case 'enviar_email':    result = await enviarEmail(body, userId, org); break;
      default: throw new HttpError(400, 'BAD_ACTION', 'Acción no válida');
    }
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (e) {
    if (e instanceof HttpError) {
      return new Response(JSON.stringify({ error: e.message, code: e.code }), { status: e.status, headers });
    }
    console.error('[trade-transport-doc] unexpected', e);
    return new Response(JSON.stringify({ error: 'Error interno', code: 'INTERNAL' }), { status: 500, headers });
  }
});
