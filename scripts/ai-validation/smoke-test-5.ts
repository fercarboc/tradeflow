/**
 * Smoke test Sprint 3: 5 queries con batch_size=1.
 * Crea el run, ejecuta 5 batches, verifica BD.
 *
 * Uso: npx tsx scripts/ai-validation/smoke-test-5.ts
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..', '..');
dotenvConfig({ path: join(ROOT, '.env') });

const SUPABASE_URL      = (process.env.VITE_SUPABASE_URL     ?? '').replace(/\/$/, '');
const SERVICE_ROLE_KEY  =  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const TRADE_TEST_KEY    =  process.env.TRADE_TEST_KEY ?? '';
const EDGE_URL          = `${SUPABASE_URL}/functions/v1/trade-benchmark-runner`;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !TRADE_TEST_KEY) {
  console.error('❌ Faltan VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o TRADE_TEST_KEY en .env');
  process.exit(1);
}

const HEADERS = {
  'apikey':        SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type':  'application/json',
};

async function pgGet<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return res.json() as Promise<T[]>;
}

async function pgPost<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status} ${await res.text()}`);
  const rows = await res.json() as T[];
  return rows[0];
}

interface RunRow {
  id: string;
  benchmark_id: string;
  version_tag: string;
  estado: string;
  total_queries: number;
  queries_ok: number;
  queries_vacio: number;
  queries_truncado: number;
  queries_precio_inv: number;
  queries_error: number;
  ok_rate: number | null;
  lat_mean_ms: number | null;
}

interface ResultRow {
  id: string;
  posicion: number;
  oficio_esperado: string;
  oficio_detectado: string | null;
  categoria: string;
  n_partidas: number;
  latency_ms: number | null;
  tokens_out: number | null;
  stop_reason: string | null;
  raw_response: Record<string, unknown> | null;
}

async function main() {
  console.log('\n🧪 Sprint 3 — Smoke Test (5 queries, batch_size=1)\n');

  // ── 1. Obtener benchmark oficial ────────────────────────────────────────────
  const benchmarks = await pgGet<{ id: string; nombre: string; total_queries: number }>(
    'trade_benchmarks?es_baseline=eq.true&select=id,nombre,total_queries'
  );
  if (!benchmarks.length) throw new Error('No hay benchmark baseline');
  const bm = benchmarks[0];
  console.log(`   Benchmark: ${bm.nombre} (${bm.id.slice(0, 8)}…)`);

  // ── 2. Crear run de prueba ──────────────────────────────────────────────────
  const run = await pgPost<RunRow>('trade_benchmark_runs', {
    benchmark_id: bm.id,
    version_tag:  'sprint3_smoke_test',
    descripcion:  'Smoke test automático — 5 queries batch_size=1',
    estado:       'pending',
    total_queries: bm.total_queries,
  });
  console.log(`   Run creado: ${run.id} (${run.version_tag})\n`);

  // ── 3. Ejecutar 5 batches de 1 query ──────────────────────────────────────
  let batchStart = 1;
  const MAX_BATCHES = 5;

  for (let i = 1; i <= MAX_BATCHES; i++) {
    process.stdout.write(`   Batch ${i}/5 (posicion=${batchStart})… `);
    const t0 = Date.now();

    const edgeRes = await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TRADE_TEST_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_id: run.id, benchmark_id: bm.id, batch_start: batchStart, batch_size: 1 }),
    });

    const elapsed = Date.now() - t0;
    const edgeText = await edgeRes.text();

    if (!edgeRes.ok) {
      console.log(`\n❌ HTTP ${edgeRes.status}: ${edgeText.slice(0, 200)}`);
      process.exit(1);
    }

    const data = JSON.parse(edgeText) as {
      is_complete: boolean;
      executed: number;
      next_batch_start: number;
      batch_results: Array<{ posicion: number; categoria: string; latency_ms: number; ok: boolean }>;
      errors_in_batch: number;
    };

    const r = data.batch_results[0];
    console.log(`✓ ${r?.categoria ?? '?'} pos=${r?.posicion} lat=${r?.latency_ms}ms edge_time=${elapsed}ms`);

    if (data.is_complete) { console.log('   ✅ Run completado antes de los 5 batches'); break; }
    batchStart = data.next_batch_start;
  }

  // ── 4. Verificar BD — run ──────────────────────────────────────────────────
  console.log('\n📊 Verificación en BD:');

  const [runRow] = await pgGet<RunRow>(
    `trade_benchmark_runs?id=eq.${run.id}&select=*`
  );
  console.log(`   Estado:     ${runRow.estado}`);
  console.log(`   OK:         ${runRow.queries_ok}`);
  console.log(`   VACÍO:      ${runRow.queries_vacio}`);
  console.log(`   TRUNCADO:   ${runRow.queries_truncado}`);
  console.log(`   PRECIO_INV: ${runRow.queries_precio_inv}`);
  console.log(`   ERROR:      ${runRow.queries_error}`);
  console.log(`   ok_rate:    ${runRow.ok_rate ?? '—'}%`);
  console.log(`   lat_mean:   ${runRow.lat_mean_ms ?? '—'}ms`);

  // ── 5. Verificar BD — resultados ───────────────────────────────────────────
  const results = await pgGet<ResultRow>(
    `trade_benchmark_results?run_id=eq.${run.id}&select=*&order=posicion`
  );
  console.log(`\n   Resultados en BD: ${results.length}`);

  const checks = {
    filas_ok:       results.length === 5,
    tiene_categoria: results.every(r => !!r.categoria),
    tiene_oficio_esp: results.every(r => !!r.oficio_esperado),
    tiene_latencia:  results.every(r => r.latency_ms !== null && r.latency_ms > 0),
    tiene_tokens:    results.filter(r => r.tokens_out !== null).length,
    tiene_raw:       results.every(r => r.raw_response !== null),
    tiene_stop:      results.filter(r => r.stop_reason !== null).length,
  };

  console.log('\n   Checks:');
  console.log(`   ✅ 5 filas en BD:           ${checks.filas_ok ? '✓' : '✗ FALLO'}`);
  console.log(`   ✅ categoria presente:       ${checks.tiene_categoria ? '✓' : '✗ FALLO'}`);
  console.log(`   ✅ oficio_esperado presente: ${checks.tiene_oficio_esp ? '✓' : '✗ FALLO'}`);
  console.log(`   ✅ latency_ms > 0:           ${checks.tiene_latencia ? '✓' : '✗ FALLO'}`);
  console.log(`   ℹ  tokens_out no null:       ${checks.tiene_tokens}/5`);
  console.log(`   ✅ raw_response no null:     ${checks.tiene_raw ? '✓' : '✗ FALLO'}`);
  console.log(`   ℹ  stop_reason no null:      ${checks.tiene_stop}/5`);

  // Detalle por fila
  console.log('\n   Detalle por query:');
  results.forEach(r => {
    const raw = r.raw_response as { quote_total?: number; kb_score?: number; tokens_in?: number; actuacion_count?: number } | null;
    console.log(`   pos=${r.posicion} cat=${r.categoria} oficio=${r.oficio_esperado} detect=${r.oficio_detectado ?? '—'} lat=${r.latency_ms}ms tok=${r.tokens_out ?? '—'} stop=${r.stop_reason ?? '—'} kb=${raw?.kb_score ?? '—'} act=${raw?.actuacion_count ?? '—'}`);
  });

  // ── 6. Resultado final ──────────────────────────────────────────────────────
  const allOk = checks.filas_ok && checks.tiene_categoria && checks.tiene_oficio_esp && checks.tiene_latencia && checks.tiene_raw;
  if (allOk) {
    console.log('\n🎉 SMOKE TEST PASADO — Sprint 3 validado. Listo para los 400.\n');
  } else {
    console.log('\n❌ SMOKE TEST FALLIDO — Revisar errores arriba.\n');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
