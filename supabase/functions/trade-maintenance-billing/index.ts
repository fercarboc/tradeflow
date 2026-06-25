import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY      = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM                = 'TRABFLOW <contacto@trabflow.com>';

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

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });

  try {
    const sb      = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const today   = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Active contratos whose next billing date is today or past
    const { data: contratos, error: cErr } = await sb
      .from('trade_maintenance_contratos')
      .select('*, trade_organizations!inner(nombre, email, plan)')
      .eq('estado', 'activo')
      .lte('proxima_factura', todayStr)
      .not('proxima_factura', 'is', null);

    if (cErr) throw cErr;

    const results: { processed: number; skipped: number; errors: string[] } = {
      processed: 0, skipped: 0, errors: [],
    };

    for (const contrato of (contratos ?? [])) {
      try {
        const org = contrato.trade_organizations as { nombre: string; email: string; plan: string };

        if (org?.plan !== 'empresa_plus') { results.skipped++; continue; }

        const periodoInicio = contrato.proxima_factura as string;
        const multiplier    = contrato.tipo_facturacion === 'trimestral' ? 3
          : contrato.tipo_facturacion === 'anual' ? 12 : 1;

        const nextDate = new Date(periodoInicio);
        nextDate.setMonth(nextDate.getMonth() + multiplier);

        const periodoFin = new Date(nextDate);
        periodoFin.setDate(periodoFin.getDate() - 1);

        const cuotaBase   = Number(contrato.cuota_mensual) * multiplier;
        const ivaPct      = contrato.iva_pct ?? 21;
        const totalConIva = cuotaBase * (1 + ivaPct / 100);

        const { count } = await sb
          .from('trade_maintenance_facturas')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', contrato.org_id);

        const numero      = `MANT-${today.getFullYear()}-${String((count ?? 0) + 1).padStart(4, '0')}`;
        const fechaVto    = new Date(todayStr);
        fechaVto.setDate(fechaVto.getDate() + 30);
        const periodoFinStr = periodoFin.toISOString().split('T')[0];

        await sb.from('trade_maintenance_facturas').insert({
          org_id:            contrato.org_id,
          contrato_id:       contrato.id,
          client_id:         contrato.client_id,
          numero,
          estado:            'pendiente',
          periodo_inicio:    periodoInicio,
          periodo_fin:       periodoFinStr,
          cuota_base:        cuotaBase,
          extras:            0,
          total_neto:        cuotaBase,
          iva_pct:           ivaPct,
          total_con_iva:     totalConIva,
          fecha_emision:     todayStr,
          fecha_vencimiento: fechaVto.toISOString().split('T')[0],
        });

        await sb.from('trade_maintenance_contratos').update({
          proxima_factura: nextDate.toISOString().split('T')[0],
          ultima_factura:  todayStr,
          updated_at:      new Date().toISOString(),
        }).eq('id', contrato.id);

        // Email notification to installer
        if (RESEND_API_KEY && org?.email) {
          const cliente = (contrato.nombre_cliente as string) ?? '—';
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: FROM,
              to: [org.email],
              subject: `Nueva factura generada: ${numero} — ${cliente}`,
              html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
  <div style="background:#0f172a;color:white;padding:24px 32px">
    <h1 style="margin:0;font-size:18px">Nueva factura de mantenimiento</h1>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:13px">${org.nombre}</p>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 16px;color:#475569">Se ha generado una nueva factura automáticamente:</p>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Nº Factura</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700">${numero}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Cliente</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right">${cliente}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Período</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right">${fmtDate(periodoInicio)} – ${fmtDate(periodoFinStr)}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Base imponible</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right">${fmtEur(cuotaBase)}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">IVA (${ivaPct}%)</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right">${fmtEur(cuotaBase * ivaPct / 100)}</td></tr>
      <tr><td style="padding:12px 0 0;font-weight:700">Total con IVA</td><td style="padding:12px 0 0;text-align:right;font-weight:700;font-size:20px;color:#2563eb">${fmtEur(totalConIva)}</td></tr>
    </table>
    <p style="margin:24px 0 0;font-size:13px;color:#64748b">Accede a <a href="https://app.trabflow.com" style="color:#2563eb">TradeFlow</a> para gestionar esta factura y marcarla como pagada.</p>
  </div>
  <div style="background:#f8fafc;padding:16px 32px;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0">
    Generado automáticamente · TradeFlow · trabflow.com
  </div>
</body></html>`,
            }),
          }).catch(() => {/* fire-and-forget */});
        }

        results.processed++;
      } catch (e) {
        results.errors.push(String(e));
      }
    }

    return new Response(JSON.stringify({ ok: true, date: todayStr, ...results }), {
      headers: { ...cors(req), 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors(req) });
  }
});


