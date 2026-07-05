import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')            ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const TRADE_TEST_KEY       = Deno.env.get('TRADE_TEST_KEY')           ?? '';
const ADMIN_EMAIL          = Deno.env.get('ADMIN_EMAIL')              ?? 'fercarboc@gmail.com';

const ALLOWED_ORIGINS = ['https://trabflow.com', 'https://www.trabflow.com', 'http://localhost:5173', 'http://localhost:4173'];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
}

// ── Categorías ────────────────────────────────────────────────────────────────
type Categoria =
  | 'OK_CATALOGO'
  | 'OK_MIXTO'
  | 'SOLO_SUGERIDAS'
  | 'VACIO'
  | 'TRUNCADO'
  | 'PRECIO_INVALIDO'
  | 'ERROR_TECNICO';

interface Partida {
  precio_unitario?: number;
  origen?: string;
  oficio?: string;
}

// La respuesta de trade-voice-to-quote es: { transcript, quote: { partidas, oficios_detectados, calculos, ... }, kb_score, actuacion_ids_matched, _meta }
// Las partidas y oficios_detectados están anidados bajo .quote, no en el top level.
interface QuoteInner {
  partidas?: Partida[];
  oficios_detectados?: Array<{ oficio: string }>;
  calculos?: { subtotal?: number; iva?: number; total?: number };
}

interface QuoteResponse {
  quote?: QuoteInner;
  kb_score?: number;
  actuacion_ids_matched?: string[];
  transcript?: string;
  _meta?: {
    stop_reason?: string;
    tokens_in?: number;
    tokens_out?: number;
    prompt_version?: string;
  };
  error?: string;
}

function classify(resp: QuoteResponse | null, httpStatus: number): {
  categoria: Categoria;
  n_partidas: number;
  n_catalogo: number;
  n_sugeridas: number;
  oficio_detectado: string | null;
  stop_reason: string | null;
  tokens_out: number | null;
  tokens_in: number | null;
} {
  if (!resp || httpStatus !== 200) {
    return { categoria: 'ERROR_TECNICO', n_partidas: 0, n_catalogo: 0, n_sugeridas: 0, oficio_detectado: null, stop_reason: null, tokens_out: null, tokens_in: null };
  }

  const inner   = resp.quote ?? {};
  const partidas  = inner.partidas ?? [];
  const meta      = resp._meta ?? {};
  const stopReason = meta.stop_reason ?? null;
  const tokensOut  = meta.tokens_out  ?? null;
  const tokensIn   = meta.tokens_in   ?? null;
  const oficioDetectado = inner.oficios_detectados?.[0]?.oficio ?? null;

  const n_partidas = partidas.length;

  if (n_partidas === 0) {
    // 0 partidas → VACIO (sin importar stop_reason; max_tokens con 0 partidas es VACIO)
    return { categoria: 'VACIO', n_partidas: 0, n_catalogo: 0, n_sugeridas: 0, oficio_detectado: oficioDetectado, stop_reason: stopReason, tokens_out: tokensOut, tokens_in: tokensIn };
  }

  if (stopReason === 'max_tokens') {
    // Tiene partidas pero fue truncado
    return { categoria: 'TRUNCADO', n_partidas, n_catalogo: 0, n_sugeridas: 0, oficio_detectado: oficioDetectado, stop_reason: stopReason, tokens_out: tokensOut, tokens_in: tokensIn };
  }

  const n_catalogo  = partidas.filter(p => p.origen === 'catalogo').length;
  const n_sugeridas = partidas.filter(p => p.origen === 'sugerida_ia').length;

  // PRECIO_INVALIDO: alguna partida catálogo con precio <= 0
  const hasPrecioInv = partidas.some(p => p.origen === 'catalogo' && (p.precio_unitario ?? 0) <= 0);
  if (hasPrecioInv) {
    return { categoria: 'PRECIO_INVALIDO', n_partidas, n_catalogo, n_sugeridas, oficio_detectado: oficioDetectado, stop_reason: stopReason, tokens_out: tokensOut, tokens_in: tokensIn };
  }

  if (n_catalogo === 0) {
    return { categoria: 'SOLO_SUGERIDAS', n_partidas, n_catalogo, n_sugeridas, oficio_detectado: oficioDetectado, stop_reason: stopReason, tokens_out: tokensOut, tokens_in: tokensIn };
  }
  if (n_sugeridas === 0) {
    return { categoria: 'OK_CATALOGO', n_partidas, n_catalogo, n_sugeridas, oficio_detectado: oficioDetectado, stop_reason: stopReason, tokens_out: tokensOut, tokens_in: tokensIn };
  }
  return { categoria: 'OK_MIXTO', n_partidas, n_catalogo, n_sugeridas, oficio_detectado: oficioDetectado, stop_reason: stopReason, tokens_out: tokensOut, tokens_in: tokensIn };
}

// ── Ejecutar una query contra trade-voice-to-quote ────────────────────────────
const VTQ_URL = `${SUPABASE_URL}/functions/v1/trade-voice-to-quote`;

async function runQuery(texto: string): Promise<{
  httpStatus: number;
  quote: QuoteResponse | null;
  latency_ms: number;
  error_msg: string | null;
}> {
  const t0 = Date.now();
  try {
    const res = await fetch(VTQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TRADE_TEST_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: texto }),
    });
    const latency_ms = Date.now() - t0;
    let quote: QuoteResponse | null = null;
    try { quote = await res.json() as QuoteResponse; } catch { /* JSON parse error */ }
    return {
      httpStatus: res.status,
      quote,
      latency_ms,
      error_msg: res.status !== 200 ? `HTTP ${res.status}` : null,
    };
  } catch (e) {
    return {
      httpStatus: 0,
      quote: null,
      latency_ms: Date.now() - t0,
      error_msg: (e as Error).message ?? 'Error desconocido',
    };
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST')    return json(req, { error: 'Método no permitido' }, 405);

  // ── Auth: JWT de admin o service role key (server-side scripts) ───────────
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json(req, { error: 'Sin autorización' }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // TRADE_TEST_KEY → bypass de admin para scripts server-side (mismo patrón que trade-voice-to-quote)
  const isTestKey = TRADE_TEST_KEY && token === TRADE_TEST_KEY;
  if (!isTestKey) {
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json(req, { error: 'Token inválido' }, 401);
    if (user.email !== ADMIN_EMAIL) return json(req, { error: 'Acceso restringido a administradores' }, 403);
  }

  // ── Body ───────────────────────────────────────────────────────────────────
  let body: { run_id?: string; benchmark_id?: string; batch_start?: number; batch_size?: number };
  try { body = await req.json(); } catch { return json(req, { error: 'JSON inválido' }, 400); }

  const { run_id, benchmark_id, batch_start = 1, batch_size = 5 } = body;
  if (!run_id || !benchmark_id) return json(req, { error: 'Faltan run_id o benchmark_id' }, 400);

  const effectiveBatchSize = Math.min(Math.max(1, batch_size), 20);

  // ── Cargar queries del batch ───────────────────────────────────────────────
  const { data: queries, error: qErr } = await supabase
    .from('trade_benchmark_queries')
    .select('id, posicion, oficio_display, oficio_esperado, texto')
    .eq('benchmark_id', benchmark_id)
    .eq('activo', true)
    .gte('posicion', batch_start)
    .order('posicion', { ascending: true })
    .limit(effectiveBatchSize);

  if (qErr) return json(req, { error: `Error cargando queries: ${qErr.message}` }, 500);
  if (!queries || queries.length === 0) {
    // Sin más queries → run completado
    await supabase
      .from('trade_benchmark_runs')
      .update({ estado: 'completed', completado_at: new Date().toISOString() })
      .eq('id', run_id);
    return json(req, { is_complete: true, executed: 0, next_batch_start: batch_start });
  }

  // ── Marcar run como running si es el primer batch ─────────────────────────
  if (batch_start === 1) {
    await supabase
      .from('trade_benchmark_runs')
      .update({ estado: 'running', iniciado_at: new Date().toISOString() })
      .eq('id', run_id);
  }

  // ── Ejecutar queries en paralelo (Promise.allSettled) ────────────────────
  type QRow = { id: string; posicion: number; oficio_display: string; oficio_esperado: string; texto: string };
  const results = await Promise.allSettled(
    (queries as QRow[]).map(async (q) => {
      const { httpStatus, quote, latency_ms, error_msg } = await runQuery(q.texto);
      const cls = classify(quote, httpStatus);
      const coincide = cls.oficio_detectado !== null && q.oficio_esperado !== null
        ? cls.oficio_detectado === q.oficio_esperado
        : false;

      const row = {
        run_id,
        query_id:        q.id,
        posicion:        q.posicion,
        oficio_esperado: q.oficio_esperado,
        oficio_detectado: cls.oficio_detectado,
        coincide_oficio: coincide,
        categoria:       cls.categoria,
        n_partidas:      cls.n_partidas,
        n_catalogo:      cls.n_catalogo,
        n_sugeridas:     cls.n_sugeridas,
        latency_ms,
        tokens_out:      cls.tokens_out,
        stop_reason:     cls.stop_reason,
        prompt_version:  quote?._meta?.prompt_version ?? null,
        raw_response: quote ? {
          quote_total:     quote.quote?.calculos?.total ?? null,
          kb_score:        quote.kb_score ?? null,
          tokens_in:       cls.tokens_in,
          actuacion_count: (quote.actuacion_ids_matched ?? []).length,
        } : null,
        error_msg: error_msg !== null ? error_msg : (cls.categoria === 'ERROR_TECNICO' ? 'ERROR' : null),
      };

      // Guardar inmediatamente en BD
      const { error: insertErr } = await supabase
        .from('trade_benchmark_results')
        .upsert(row, { onConflict: 'run_id,posicion', ignoreDuplicates: false });

      if (insertErr) {
        console.error(`[benchmark] Error guardando posicion=${q.posicion}: ${insertErr.message}`);
      }

      return { posicion: q.posicion, categoria: cls.categoria, latency_ms, ok: insertErr === null };
    })
  );

  // ── Recomputar stats del run tras el batch ────────────────────────────────
  await supabase.rpc('recompute_run_stats', { p_run_id: run_id });

  // ── Calcular next_batch_start ─────────────────────────────────────────────
  const lastQuery  = (queries as QRow[])[queries.length - 1];
  const next_batch_start = lastQuery.posicion + 1;

  // ── Obtener total de queries del benchmark para saber si hay más ──────────
  const { data: totalRow } = await supabase
    .from('trade_benchmarks')
    .select('total_queries')
    .eq('id', benchmark_id)
    .single();
  const totalQueries = totalRow?.total_queries ?? 400;
  const is_complete = next_batch_start > totalQueries;

  if (is_complete) {
    await supabase
      .from('trade_benchmark_runs')
      .update({ estado: 'completed', completado_at: new Date().toISOString() })
      .eq('id', run_id);
  }

  // ── Resumen del batch ──────────────────────────────────────────────────────
  const batchSummary = results.map(r =>
    r.status === 'fulfilled' ? r.value : { posicion: -1, categoria: 'ERROR_TECNICO', latency_ms: 0, ok: false }
  );
  const errorsInBatch = batchSummary.filter(r => !r.ok).length;

  return json(req, {
    is_complete,
    executed:         queries.length,
    next_batch_start,
    batch_results:    batchSummary,
    errors_in_batch:  errorsInBatch,
  });
});
