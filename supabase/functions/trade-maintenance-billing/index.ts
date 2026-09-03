import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY       = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM                 = 'TRABFLOW <contacto@trabflow.com>';

const ALLOWED_ORIGINS = [
  'https://trabflow.com',
  'https://www.trabflow.com',
  'http://localhost:5173',
  'http://localhost:4173',
];
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });

  try {
    const sb       = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const today    = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Contratos activos con fecha de facturación vencida
    const { data: contratos, error: cErr } = await sb
      .from('trade_maintenance_contratos')
      .select('*, trade_organizations!inner(nombre, email, plan)')
      .eq('estado', 'activo')
      .lte('proxima_factura', todayStr)
      .not('proxima_factura', 'is', null);

    if (cErr) throw cErr;

    const results: {
      processed: number;
      skipped: number;
      healed: number;
      errors: string[];
      skippedNoClient: { maintenance_contract_id: string; org_id: string; numero: string | null; motivo: string }[];
    } = { processed: 0, skipped: 0, healed: 0, errors: [], skippedNoClient: [] };

    for (const contrato of (contratos ?? [])) {
      try {
        const org = contrato.trade_organizations as { nombre: string; email: string; plan: string };

        // Plan guard
        if (org?.plan !== 'empresa_plus') { results.skipped++; continue; }

        // Client guard: cannot create a valid invoice without client
        if (!contrato.client_id) {
          results.skippedNoClient.push({
            maintenance_contract_id: contrato.id,
            org_id:  contrato.org_id,
            numero:  contrato.numero ?? null,
            motivo:  'missing_client_id',
          });
          results.skipped++;
          continue;
        }

        const periodoInicio = contrato.proxima_factura as string;
        const multiplier    = contrato.tipo_facturacion === 'trimestral' ? 3
          : contrato.tipo_facturacion === 'anual' ? 12 : 1;

        const nextDate = new Date(periodoInicio);
        nextDate.setMonth(nextDate.getMonth() + multiplier);
        const nextDateStr = nextDate.toISOString().split('T')[0];

        const periodoFin = new Date(nextDate);
        periodoFin.setDate(periodoFin.getDate() - 1);
        const periodoFinStr = periodoFin.toISOString().split('T')[0];

        // ── Economic data — hoisted so both create and heal paths share it ────
        const cuotaBase  = Number(contrato.cuota_mensual) * multiplier;
        const ivaPct     = contrato.iva_pct ?? 21;
        // iva_importe and total are GENERATED columns in trade_invoices —
        // DB computes them from subtotal + iva_pct. Only used here for email display.
        const ivaImporte = Math.round(cuotaBase * ivaPct) / 100;
        const total      = cuotaBase + ivaImporte;

        const periodoDate = new Date(periodoInicio);
        const periodo = multiplier === 12
          ? `Año ${periodoDate.getFullYear()}`
          : multiplier === 3
            ? `T${Math.ceil((periodoDate.getMonth() + 1) / 3)} ${periodoDate.getFullYear()}`
            : periodoDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

        // Single source of truth for the invoice_line payload — used in both
        // the normal create path and the self-healing repair path.
        const linePayload = {
          descripcion:     `Cuota de mantenimiento — ${contrato.numero} — ${periodo}`,
          cantidad:        1,
          precio_unitario: cuotaBase,
          subtotal:        cuotaBase,
          tipo:            'mano_de_obra',
          orden:           0,
        };

        // ── Idempotency check + self-healing ──────────────────────────────────
        // Idempotency key: (org_id, mantenimiento_id, mes_facturacion).
        // Requires migration 20260901200000 (mantenimiento_id column +
        // uq_invoices_mant_period unique index).
        //
        // Self-healing covers two failure modes:
        //   1. Invoice created but invoice_line insert silently failed.
        //      Detected when invoice exists with 0 lines.
        //      Resolution: insert the missing line, then advance proxima_factura.
        //   2. Invoice + line exist but proxima_factura update was lost (crash).
        //      Detected when invoice exists with 1 line and proxima_factura still
        //      points to periodoInicio.
        //      Resolution: advance proxima_factura.
        //
        // Concurrency note: trade_invoice_lines has no UNIQUE constraint on
        // (factura_id). Two concurrent cron runs (extremely unlikely — pg_cron
        // is sequential) could both detect 0 lines and both insert one. The
        // nLines > 1 guard on the next run surfaces this as an error without
        // touching proxima_factura. A future UNIQUE(factura_id, orden) migration
        // would fully prevent this race.
        const { data: existing } = await sb
          .from('trade_invoices')
          .select('id')
          .eq('org_id', contrato.org_id)
          .eq('mantenimiento_id', contrato.id)
          .eq('mes_facturacion', periodoInicio)
          .maybeSingle();

        if (existing) {
          // Invoice exists — verify line count before healing proxima_factura.
          const { data: existingLines } = await sb
            .from('trade_invoice_lines')
            .select('id')
            .eq('factura_id', existing.id);

          const nLines = existingLines?.length ?? 0;

          if (nLines > 1) {
            // Unexpected: multiple lines. Do not modify automatically.
            results.errors.push(
              `invoice ${existing.id}: unexpected ${nLines} lines (mantenimiento_id=${contrato.id})`
            );
            continue;
          }

          if (nLines === 0) {
            // Line is missing — repair before advancing the date.
            const { error: lineErr } = await sb
              .from('trade_invoice_lines')
              .insert({ factura_id: existing.id, ...linePayload });

            if (lineErr) {
              // Cannot confirm line is present — do NOT advance proxima_factura.
              results.errors.push(
                `invoice ${existing.id}: line repair failed — ${String(lineErr)}`
              );
              continue;
            }
          }

          // Line confirmed present (was already there, or just repaired).
          // Advance proxima_factura only if still blocked at this period.
          const { data: healed } = await sb
            .from('trade_maintenance_contratos')
            .update({
              proxima_factura: nextDateStr,
              ultima_factura:  periodoInicio,
              updated_at:      new Date().toISOString(),
            })
            .eq('id', contrato.id)
            .eq('proxima_factura', periodoInicio) // guard: only heal if still blocked
            .select('id')
            .maybeSingle();

          if (healed) results.healed++;
          else         results.skipped++; // proxima_factura already advanced by another run
          continue;
        }

        // ── Client fiscal snapshot ─────────────────────────────────────────────
        let snap: Record<string, string | null> = {
          razon_social_cliente: null,
          nif_cliente:          null,
          direccion_cliente:    null,
          localidad_cliente:    null,
          cp_cliente:           null,
          provincia_cliente:    null,
          pais_cliente:         null,
        };
        const { data: cli } = await sb
          .from('trade_clients')
          .select('nombre, apellidos, tipo_cliente, nif, direccion, ciudad, cp, provincia, pais')
          .eq('id', contrato.client_id)
          .eq('org_id', contrato.org_id)
          .maybeSingle();
        if (cli) {
          const displayName = (cli.tipo_cliente === 'empresa' || cli.tipo_cliente === 'autonomo')
            ? cli.nombre
            : [cli.nombre, cli.apellidos].filter(Boolean).join(' ');
          snap = {
            razon_social_cliente: displayName || null,
            nif_cliente:          cli.nif     || null,
            direccion_cliente:    cli.direccion || null,
            localidad_cliente:    cli.ciudad    || null,
            cp_cliente:           cli.cp        || null,
            provincia_cliente:    cli.provincia || null,
            pais_cliente:         cli.pais      || null,
          };
        }

        const cliente    = (contrato.nombre_cliente as string) ?? snap.razon_social_cliente ?? '—';
        const tempNumero = `BORRADOR-M-${(contrato.contract_id ?? contrato.id).slice(0, 8)}-${periodoInicio}`;

        // ── INSERT invoice header ─────────────────────────────────────────────
        const { data: newInvoice, error: insertError } = await sb
          .from('trade_invoices')
          .insert({
            org_id:           contrato.org_id,
            client_id:        contrato.client_id,
            contract_id:      contrato.contract_id ?? null,
            mantenimiento_id: contrato.id,
            numero:           tempNumero,
            fecha:            periodoInicio,
            estado:           'Borrador',
            subtotal:         cuotaBase,
            iva_pct:          ivaPct,
            concepto:         `Mantenimiento ${contrato.numero} — ${cliente} — ${periodo}`,
            serie:            'M',
            tipo_factura:     'contrato_cuota',
            mes_facturacion:  periodoInicio,
            ...snap,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        // ── INSERT 1 invoice line for UI display ──────────────────────────────
        // fn_emitir_factura uses the header subtotal for the VeriFactu hash,
        // not lines. Lines are for user display only. Best-effort: a failure
        // here does not roll back the invoice — the self-healing path detects
        // and repairs a missing line on the next cron run.
        if (newInvoice?.id) {
          try {
            await sb.from('trade_invoice_lines').insert({
              factura_id: newInvoice.id,
              ...linePayload,
            });
          } catch (_e) { /* detected and repaired by self-healing on next run */ }
        }

        // ── Advance proxima_factura — only after successful INSERT ─────────────
        // If this UPDATE fails, the next cron run will detect the existing
        // invoice via the idempotency check and self-heal (see above).
        await sb
          .from('trade_maintenance_contratos')
          .update({
            proxima_factura: nextDateStr,
            ultima_factura:  todayStr,
            updated_at:      new Date().toISOString(),
          })
          .eq('id', contrato.id);

        // ── Email notification ────────────────────────────────────────────────
        if (RESEND_API_KEY && org?.email) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: FROM,
              to:   [org.email],
              subject: `Borrador generado: ${contrato.numero} — ${cliente}`,
              html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
  <div style="background:#0f172a;color:white;padding:24px 32px">
    <h1 style="margin:0;font-size:18px">Borrador de factura de mantenimiento</h1>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:13px">${org.nombre}</p>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 16px;color:#475569">Se ha generado automáticamente un borrador de factura. <strong>Revísalo y emítelo desde TradeFlow.</strong></p>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Contrato</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700">${contrato.numero}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Cliente</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right">${cliente}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Período</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right">${fmtDate(periodoInicio)} – ${fmtDate(periodoFinStr)}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Base imponible</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right">${fmtEur(cuotaBase)}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">IVA (${ivaPct}%)</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right">${fmtEur(ivaImporte)}</td></tr>
      <tr><td style="padding:12px 0 0;font-weight:700">Total con IVA</td><td style="padding:12px 0 0;text-align:right;font-weight:700;font-size:20px;color:#2563eb">${fmtEur(total)}</td></tr>
    </table>
    <p style="margin:24px 0 0;font-size:13px;color:#64748b">Accede a <a href="https://app.trabflow.com" style="color:#2563eb">TradeFlow</a> para revisar el borrador, completar los datos si es necesario y emitir la factura.</p>
  </div>
  <div style="background:#f8fafc;padding:16px 32px;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0">
    Generado automáticamente · TradeFlow · trabflow.com
  </div>
</body></html>`,
            }),
          }).catch(() => { /* fire-and-forget */ });
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
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: cors(req),
    });
  }
});
