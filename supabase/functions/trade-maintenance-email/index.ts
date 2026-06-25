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

const fmtEur  = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
const fmtDate = (s: string) => new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

async function resolveOrg(sb: ReturnType<typeof createClient>, userId: string) {
  const [ownRes, memberRes] = await Promise.all([
    sb.from('trade_organizations').select('id, nombre, email').eq('owner_id', userId).maybeSingle(),
    sb.from('trade_org_members').select('org_id').eq('user_id', userId).eq('activo', true).maybeSingle(),
  ]);
  if (ownRes.data) return ownRes.data as { id: string; nombre: string; email: string };
  if (memberRes.data) {
    const { data: org } = await sb.from('trade_organizations').select('id, nombre, email').eq('id', memberRes.data.org_id).maybeSingle();
    return org as { id: string; nombre: string; email: string } | null;
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
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: cors(req) });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no_resend_key' }), {
        headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json() as {
      type: 'presupuesto_enviado' | 'contrato_activado' | 'factura_pendiente';
      presupuesto_id?: string;
      contrato_id?: string;
      factura_id?: string;
      to_email?: string;
    };

    const org = await resolveOrg(sb, user.id);
    const orgNombre = org?.nombre ?? 'Tu empresa';
    const toEmail   = body.to_email ?? org?.email;

    if (!toEmail) {
      return new Response(JSON.stringify({ ok: false, error: 'Sin email de destino' }), {
        status: 400, headers: cors(req),
      });
    }

    let subject = '';
    let html    = '';

    // ── presupuesto_enviado ────────────────────────────────────────────────────
    if (body.type === 'presupuesto_enviado') {
      const { data: p } = await sb
        .from('trade_maintenance_presupuestos')
        .select('*')
        .eq('id', body.presupuesto_id!)
        .single();
      if (!p) return new Response(JSON.stringify({ error: 'Presupuesto no encontrado' }), { status: 404, headers: cors(req) });

      subject = `Presupuesto de mantenimiento — ${(p.nombre_cliente as string) ?? 'Cliente'} — ${p.oficio as string}`;
      const cuota    = Number(p.cuota_mensual);
      const ivaPct   = Number(p.iva_pct ?? 21);
      const conIva   = cuota * (1 + ivaPct / 100);
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
  <div style="background:#0f172a;color:white;padding:24px 32px">
    <h1 style="margin:0;font-size:18px">Presupuesto de Mantenimiento</h1>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:13px">${orgNombre}</p>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 16px;color:#475569">Nuevo presupuesto de contrato de mantenimiento generado:</p>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Cliente</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700">${(p.nombre_cliente as string) ?? '—'}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Dirección</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right">${(p.direccion_instalacion as string) ?? '—'}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Oficio</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;text-transform:capitalize">${p.oficio as string}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">SLA</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;text-transform:capitalize">${(p.sla_nivel as string) ?? '—'}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Cuota mensual (neto)</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right">${fmtEur(cuota)}</td></tr>
      <tr><td style="padding:12px 0 0;font-weight:700">Cuota mensual + IVA</td><td style="padding:12px 0 0;text-align:right;font-weight:700;font-size:20px;color:#2563eb">${fmtEur(conIva)}</td></tr>
    </table>
    ${p.descripcion_servicios ? `<div style="margin:20px 0;background:#f8fafc;border-radius:8px;padding:16px"><p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Servicios incluidos</p><p style="margin:0;font-size:13px;color:#475569;line-height:1.6">${p.descripcion_servicios as string}</p></div>` : ''}
    <p style="margin:24px 0 0;font-size:13px;color:#64748b">Accede a <a href="https://app.trabflow.com" style="color:#2563eb">TradeFlow</a> para gestionar este presupuesto.</p>
  </div>
  <div style="background:#f8fafc;padding:16px 32px;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0">TradeFlow · trabflow.com</div>
</body></html>`;

    // ── contrato_activado ──────────────────────────────────────────────────────
    } else if (body.type === 'contrato_activado') {
      const { data: c } = await sb
        .from('trade_maintenance_contratos')
        .select('*')
        .eq('id', body.contrato_id!)
        .single();
      if (!c) return new Response(JSON.stringify({ error: 'Contrato no encontrado' }), { status: 404, headers: cors(req) });

      const cuota  = Number(c.cuota_mensual);
      const ivaPct = Number(c.iva_pct ?? 21);
      const conIva = cuota * (1 + ivaPct / 100);
      subject = `Contrato de mantenimiento activado — ${(c.nombre_cliente as string) ?? 'Cliente'}`;
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
  <div style="background:#059669;color:white;padding:24px 32px">
    <h1 style="margin:0;font-size:18px">✓ Contrato de mantenimiento activado</h1>
    <p style="margin:4px 0 0;color:#a7f3d0;font-size:13px">${orgNombre}</p>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 16px;color:#475569">El siguiente contrato está ahora <strong>activo</strong>:</p>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Cliente</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700">${(c.nombre_cliente as string) ?? '—'}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Dirección</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right">${(c.direccion_instalacion as string) ?? '—'}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Oficio</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;text-transform:capitalize">${c.oficio as string}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">SLA</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;text-transform:capitalize">${(c.sla_nivel as string) ?? '—'}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Inicio</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right">${fmtDate(c.fecha_inicio as string)}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Duración</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right">${c.duracion_meses as number} meses con renovación automática</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Cuota mensual (neto)</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right">${fmtEur(cuota)}</td></tr>
      <tr><td style="padding:12px 0 0;font-weight:700">Cuota mensual + IVA</td><td style="padding:12px 0 0;text-align:right;font-weight:700;font-size:20px;color:#059669">${fmtEur(conIva)}</td></tr>
    </table>
    <p style="margin:24px 0 0;font-size:13px;color:#64748b">Accede a <a href="https://app.trabflow.com" style="color:#059669">TradeFlow</a> para ver el contrato.</p>
  </div>
  <div style="background:#f8fafc;padding:16px 32px;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0">TradeFlow · trabflow.com</div>
</body></html>`;

    // ── factura_pendiente ──────────────────────────────────────────────────────
    } else if (body.type === 'factura_pendiente') {
      const { data: f } = await sb
        .from('trade_maintenance_facturas')
        .select('*, trade_maintenance_contratos(nombre_cliente, oficio)')
        .eq('id', body.factura_id!)
        .single();
      if (!f) return new Response(JSON.stringify({ error: 'Factura no encontrada' }), { status: 404, headers: cors(req) });

      const contrato = f.trade_maintenance_contratos as { nombre_cliente: string | null; oficio: string } | null;
      const cliente  = contrato?.nombre_cliente ?? '—';
      const numero   = (f.numero as string) ?? 'SIN NÚMERO';
      subject = `Factura de mantenimiento ${numero} — ${cliente}`;
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
  <div style="background:#0f172a;color:white;padding:24px 32px">
    <h1 style="margin:0;font-size:18px">Factura de Mantenimiento</h1>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:13px">${orgNombre} · ${numero}</p>
  </div>
  <div style="padding:32px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Nº Factura</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700">${numero}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Cliente</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right">${cliente}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Período</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right">${fmtDate(f.periodo_inicio as string)} – ${fmtDate(f.periodo_fin as string)}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Base imponible</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right">${fmtEur(Number(f.cuota_base))}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">IVA (${f.iva_pct as number}%)</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right">${fmtEur(Number(f.cuota_base) * (f.iva_pct as number) / 100)}</td></tr>
      <tr><td style="padding:12px 0 0;font-weight:700">Total con IVA</td><td style="padding:12px 0 0;text-align:right;font-weight:700;font-size:20px;color:#2563eb">${fmtEur(Number(f.total_con_iva))}</td></tr>
    </table>
    ${f.fecha_vencimiento ? `<p style="margin:20px 0 0;font-size:13px;color:#64748b">Fecha de vencimiento: <strong>${fmtDate(f.fecha_vencimiento as string)}</strong></p>` : ''}
    <p style="margin:12px 0 0;font-size:13px;color:#64748b">Accede a <a href="https://app.trabflow.com" style="color:#2563eb">TradeFlow</a> para gestionar esta factura.</p>
  </div>
  <div style="background:#f8fafc;padding:16px 32px;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0">TradeFlow · trabflow.com</div>
</body></html>`;
    } else {
      return new Response(JSON.stringify({ error: 'Tipo desconocido' }), { status: 400, headers: cors(req) });
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [toEmail], subject, html }),
    });

    if (!emailRes.ok) {
      const errTxt = await emailRes.text();
      console.error('[trade-maintenance-email] Resend error:', errTxt);
      return new Response(JSON.stringify({ ok: true, skipped: 'resend_error', detail: errTxt }), {
        headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors(req), 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors(req) });
  }
});


