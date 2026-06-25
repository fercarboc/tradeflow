import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY       = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM                 = 'TRABFLOW <contacto@trabflow.com>';

const ALLOWED_ORIGINS = ['https://trabflow.com', 'https://www.trabflow.com', 'http://localhost:5173', 'http://localhost:4173'];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtMin = (m: number | null) => {
  if (m == null) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60); const min = m % 60;
  return min > 0 ? `${h}h ${min}min` : `${h}h`;
};
const fmtEur = (n: number | null) =>
  n != null ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n) : '—';

async function resolveOrg(sb: ReturnType<typeof createClient>, userId: string) {
  const [own, member] = await Promise.all([
    sb.from('trade_organizations').select('id, nombre, email, nif, direccion').eq('owner_id', userId).maybeSingle(),
    sb.from('trade_org_members').select('org_id').eq('user_id', userId).eq('activo', true).maybeSingle(),
  ]);
  if (own.data) return own.data as Record<string, unknown>;
  if (member.data) {
    const { data } = await sb.from('trade_organizations').select('id, nombre, email, nif, direccion').eq('id', member.data.org_id).maybeSingle();
    return data as Record<string, unknown> | null;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authErr } = await sb.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: cors(req) });

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no_resend_key' }), {
        headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    const { incidencia_id, to_email } = await req.json() as { incidencia_id: string; to_email?: string };
    if (!incidencia_id) return new Response(JSON.stringify({ error: 'incidencia_id requerido' }), { status: 400, headers: cors(req) });

    const [{ data: inc }, org] = await Promise.all([
      sb.from('trade_maintenance_incidencias')
        .select('*, trade_maintenance_contratos(nombre_cliente, oficio, sector, sla_nivel, direccion_instalacion, numero)')
        .eq('id', incidencia_id)
        .single(),
      resolveOrg(sb, user.id),
    ]);

    if (!inc) return new Response(JSON.stringify({ error: 'Incidencia no encontrada' }), { status: 404, headers: cors(req) });

    const contrato = inc.trade_maintenance_contratos as Record<string, unknown> | null;
    const orgNombre = (org?.nombre as string) ?? 'Empresa instaladora';
    const orgEmail  = to_email ?? (org?.email as string);
    if (!orgEmail) return new Response(JSON.stringify({ ok: false, error: 'Sin email de destino' }), { status: 400, headers: cors(req) });

    const PRIORIDAD_COLOR: Record<string, string> = {
      critica: '#dc2626', urgente: '#ea580c', normal: '#2563eb', baja: '#64748b',
    };
    const pColor = PRIORIDAD_COLOR[(inc.prioridad as string)] ?? '#64748b';

    const parteNum = `PARTE-${new Date().getFullYear()}-${inc.id.slice(0, 6).toUpperCase()}`;
    const subject  = `Parte de intervención ${parteNum} — ${(contrato?.nombre_cliente as string) ?? 'Cliente'}`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#1e293b;font-size:14px}
  .header{background:#0f172a;color:white;padding:24px 32px}
  .header h1{margin:0;font-size:20px;letter-spacing:-.02em}
  .header p{margin:6px 0 0;color:#94a3b8;font-size:12px}
  .section{padding:24px 32px;border-bottom:1px solid #e2e8f0}
  .section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin:0 0 12px}
  table.data{width:100%;border-collapse:collapse}
  table.data td{padding:7px 0;border-bottom:1px solid #f1f5f9;vertical-align:top}
  table.data td:first-child{color:#64748b;width:45%}
  table.data td:last-child{font-weight:600;text-align:right}
  .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;border:1px solid}
  .box{background:#f8fafc;border-radius:8px;padding:16px;font-size:13px;color:#475569;line-height:1.6}
  .firma-box{height:80px;border:1px dashed #cbd5e1;border-radius:8px;margin-top:8px}
  .footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0}
</style></head>
<body>
  <div class="header">
    <h1>Parte de Intervención</h1>
    <p>${parteNum} · ${orgNombre}</p>
  </div>

  <div class="section">
    <p class="section-title">Datos del cliente y contrato</p>
    <table class="data">
      <tr><td>Cliente</td><td>${(contrato?.nombre_cliente as string) ?? '—'}</td></tr>
      <tr><td>Dirección</td><td>${(contrato?.direccion_instalacion as string) ?? '—'}</td></tr>
      <tr><td>Contrato nº</td><td>${(contrato?.numero as string) ?? '—'}</td></tr>
      <tr><td>Oficio</td><td style="text-transform:capitalize">${(contrato?.oficio as string) ?? '—'}</td></tr>
      <tr><td>SLA</td><td style="text-transform:capitalize">${(contrato?.sla_nivel as string) ?? '—'}</td></tr>
    </table>
  </div>

  <div class="section">
    <p class="section-title">Descripción de la incidencia</p>
    <table class="data">
      <tr><td>Título</td><td>${inc.titulo as string}</td></tr>
      <tr><td>Prioridad</td><td><span class="badge" style="color:${pColor};border-color:${pColor}20;background:${pColor}10">${(inc.prioridad as string).toUpperCase()}</span></td></tr>
      <tr><td>Fecha reporte</td><td>${fmtDate(inc.fecha_reporte as string)}</td></tr>
    </table>
    ${inc.descripcion ? `<div class="box" style="margin-top:12px"><strong>Descripción:</strong><br>${inc.descripcion as string}</div>` : ''}
  </div>

  <div class="section">
    <p class="section-title">Registro de tiempos</p>
    <table class="data">
      <tr><td>Inicio intervención</td><td>${fmtDate(inc.fecha_inicio_intervencion as string | null)}</td></tr>
      <tr><td>Fin / Resolución</td><td>${fmtDate(inc.fecha_resolucion as string | null)}</td></tr>
      <tr><td>Tiempo de respuesta</td><td>${fmtMin(inc.tiempo_respuesta_min as number | null)}</td></tr>
      <tr><td>Tiempo de resolución</td><td>${fmtMin(inc.tiempo_resolucion_min as number | null)}</td></tr>
      <tr><td>SLA cumplido</td><td>${inc.sla_cumplido === true ? '<span style="color:#059669;font-weight:700">✓ Sí</span>' : inc.sla_cumplido === false ? '<span style="color:#dc2626;font-weight:700">✗ No</span>' : '—'}</td></tr>
    </table>
  </div>

  <div class="section">
    <p class="section-title">Trabajo realizado</p>
    <div class="box">${(inc.notas_resolucion as string) || '<em style="color:#94a3b8">Sin notas de resolución</em>'}</div>
  </div>

  ${inc.es_extra_contrato ? `
  <div class="section" style="background:#fffbeb">
    <p class="section-title" style="color:#b45309">Facturación extra-contrato</p>
    <table class="data">
      <tr><td>Intervención extra-contrato</td><td><span style="color:#b45309;font-weight:700">Sí</span></td></tr>
      <tr><td>Importe a facturar (neto)</td><td style="font-size:18px;color:#b45309">${fmtEur(inc.importe_extra as number | null)}</td></tr>
    </table>
  </div>` : ''}

  <div class="section">
    <p class="section-title">Conformidad del cliente</p>
    <p style="color:#64748b;font-size:13px;margin:0 0 8px">Firma y sello del cliente:</p>
    <div class="firma-box"></div>
    <p style="color:#64748b;font-size:12px;margin:12px 0 0">Nombre y DNI: ___________________________________  Fecha: ___________</p>
  </div>

  <div class="footer">
    Parte generado automáticamente · ${orgNombre} · TradeFlow · trabflow.com
  </div>
</body></html>`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [orgEmail], subject, html }),
    });

    if (!emailRes.ok) {
      const errTxt = await emailRes.text();
      return new Response(JSON.stringify({ error: 'Error Resend', detail: errTxt }), { status: 502, headers: cors(req) });
    }

    return new Response(JSON.stringify({ ok: true, parte_num: parteNum }), {
      headers: { ...cors(req), 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors(req) });
  }
});


