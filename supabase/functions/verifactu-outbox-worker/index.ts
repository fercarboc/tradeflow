/**
 * VF-1 — VERI*FACTU Outbox Worker (stub)
 *
 * Procesa entradas pendientes de trade_verifactu_outbox.
 *
 * En VF-1 el kill switch transmission_enabled está siempre en false.
 * El worker arranca, verifica el kill switch, y termina sin transmitir.
 * Esto permite que la infraestructura esté activa y lista para VF-2+,
 * sin enviar ningún registro a la AEAT.
 *
 * Requisitos para activar transmisión real (VF-2+):
 *   1. NIF definitivo TrabFlow Technologies, S.L.
 *   2. Acuerdo Colaboración Social Tipo 17 (AEAT) firmado
 *   3. Sello Electrónico Cualificado (FNMT) configurado
 *   4. NumeroInstalacion confirmado por AEAT
 *   5. transmission_enabled = true en trade_verifactu_system_config
 *   6. environment = 'production' en trade_verifactu_system_config
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')              ?? '';
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BATCH_SIZE    = 20;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Auth gate: verify_jwt=true (infra) garantiza firma válida.
  // Adicionalmente: solo service_role puede invocar el worker.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const [, b64] = token.split('.');
    const payload = JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload?.role !== 'service_role') {
      return new Response('Forbidden', { status: 403 });
    }
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // ── 1. Kill switch — leer config global ───────────────────
  const { data: sysConfig, error: cfgErr } = await supabase
    .from('trade_verifactu_system_config')
    .select('enabled, transmission_enabled, environment, producer_nif, installation_number, certificate_status, collaboration_agreement_status')
    .eq('id', 1)
    .single();

  if (cfgErr || !sysConfig) {
    console.error('[verifactu-worker] No se pudo leer system_config:', cfgErr?.message);
    return new Response(JSON.stringify({ ok: false, reason: 'config_unavailable' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verificación fail-closed: TODAS las condiciones deben cumplirse.
  // NULL en producer_nif / installation_number también bloquea.
  // environment debe ser exactamente 'production'.
  const killSwitchActive =
    !sysConfig.enabled ||
    !sysConfig.transmission_enabled ||
    sysConfig.environment !== 'production' ||
    !sysConfig.producer_nif ||
    !sysConfig.installation_number ||
    sysConfig.certificate_status !== 'active' ||
    sysConfig.collaboration_agreement_status !== 'active';

  if (killSwitchActive) {
    const reasons: string[] = [];
    if (!sysConfig.enabled)                                      reasons.push('enabled=false');
    if (!sysConfig.transmission_enabled)                         reasons.push('transmission_enabled=false');
    if (sysConfig.environment !== 'production')                  reasons.push(`environment=${sysConfig.environment ?? 'null'}`);
    if (!sysConfig.producer_nif)                                 reasons.push('producer_nif=null_or_empty');
    if (!sysConfig.installation_number)                          reasons.push('installation_number=null_or_empty');
    if (sysConfig.certificate_status !== 'active')               reasons.push(`certificate_status=${sysConfig.certificate_status}`);
    if (sysConfig.collaboration_agreement_status !== 'active')   reasons.push(`agreement_status=${sysConfig.collaboration_agreement_status}`);

    console.log('[verifactu-worker] Kill switch activo:', reasons.join(', '));
    return new Response(JSON.stringify({
      ok: true,
      transmitted: 0,
      reason: 'TRANSMISSION_DISABLED',
      details: reasons,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── 2. Si kill switch inactivo (VF-2+): procesar outbox ──
  // En VF-1 nunca se llega aquí. Stub para la futura implementación.
  const { data: entries, error: fetchErr } = await supabase
    .from('trade_verifactu_outbox')
    .select('id, fiscal_record_id, org_id, attempt_count')
    .in('status', ['pending', 'retry_pending'])
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchErr) {
    console.error('[verifactu-worker] Error leyendo outbox:', fetchErr.message);
    return new Response(JSON.stringify({ ok: false, reason: 'outbox_read_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log(`[verifactu-worker] ${entries?.length ?? 0} entradas pendientes (transmisión real pendiente VF-2)`);

  // VF-2+: aquí irá la lógica de firma SOAP + envío AEAT + actualización estado
  return new Response(JSON.stringify({
    ok: true,
    transmitted: 0,
    pending: entries?.length ?? 0,
    reason: 'VF2_NOT_IMPLEMENTED',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
