/**
 * Importa resultados individuales de benchmark desde JSON locales
 * a la tabla trade_benchmark_results en Supabase (vía REST API directa).
 *
 * Uso:
 *   npx tsx scripts/ai-validation/import-benchmark-results.ts --version=v57b
 *   npx tsx scripts/ai-validation/import-benchmark-results.ts --version=v58
 *   npx tsx scripts/ai-validation/import-benchmark-results.ts --version=v57b --dry-run
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

dotenvConfig({ path: join(ROOT, '.env') });

const SUPABASE_URL      = (process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

// ── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (key: string, def = '') =>
  args.find(a => a.startsWith(`--${key}=`))?.split('=').slice(1).join('=') ?? def;

const VERSION = getArg('version');
const DRY_RUN = args.includes('--dry-run');

if (!VERSION) {
  console.error('Uso: npx tsx import-benchmark-results.ts --version=v57b [--dir=ruta] [--dry-run]');
  process.exit(1);
}

const DEFAULT_DIR_MAP: Record<string, string> = {
  'v57':  'scripts/test-motor-ia/output/runs/v57_candidate',
  'v57b': 'scripts/test-motor-ia/output/runs/v57b_candidate',
  'v58':  'scripts/test-motor-ia/output/runs/v58_candidate',
};
const RAW_DIR = getArg('dir', DEFAULT_DIR_MAP[VERSION] ?? '');
const RESULTS_DIR = /^([A-Za-z]:|\/)/.test(RAW_DIR) ? RAW_DIR : join(ROOT, RAW_DIR);

if (!existsSync(RESULTS_DIR)) {
  console.error(`❌ Directorio no encontrado: ${RESULTS_DIR}`);
  process.exit(1);
}

// ── REST helpers ──────────────────────────────────────────────────────────────
const HEADERS = {
  'apikey':        SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=minimal,resolution=ignore-duplicates',
};

async function pgGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return res.json() as Promise<unknown[]>;
}

async function pgInsert(table: string, rows: object[]) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST ${table} → ${res.status} ${body}`);
  }
}

// ── Parsear JSON ──────────────────────────────────────────────────────────────
interface RawResult {
  id: number;
  oficio: string;
  http_status: number;
  latency_ms: number;
  raw_response: Record<string, unknown>;
  classification: {
    category: string;
    n_partidas: number;
    n_catalogo: number;
    n_sugeridas: number;
    oficio_detectado: string;
    coincide_oficio: 'SI' | 'NO';
  };
}

function parseFile(filePath: string, runId: string) {
  const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as RawResult;
  const cls  = raw.classification;
  const meta = (raw.raw_response?._meta ?? {}) as Record<string, unknown>;
  const quote = raw.raw_response?.quote as Record<string, unknown> | undefined;

  return {
    run_id:           runId,
    posicion:         raw.id,
    oficio_esperado:  raw.oficio,
    oficio_detectado: cls.oficio_detectado ?? null,
    coincide_oficio:  cls.coincide_oficio === 'SI',
    categoria:        cls.category,
    n_partidas:       cls.n_partidas,
    n_catalogo:       cls.n_catalogo,
    n_sugeridas:      cls.n_sugeridas,
    latency_ms:       raw.latency_ms,
    tokens_out:       (meta.tokens_out as number | undefined) ?? null,
    stop_reason:      (meta.stop_reason as string | undefined) ?? null,
    prompt_version:   (meta.prompt_version as string | undefined) ?? VERSION,
    raw_response: {
      quote_total:     (quote?.calculos as Record<string, unknown> | undefined)?.total ?? null,
      kb_score:        raw.raw_response?.kb_score ?? null,
      tokens_in:       meta.tokens_in ?? null,
      actuacion_count: ((raw.raw_response?.actuacion_ids_matched as unknown[]) ?? []).length,
    },
    error_msg: raw.http_status !== 200 ? `HTTP ${raw.http_status}` : null,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔍 AI Validation — Import de resultados`);
  console.log(`   Versión  : ${VERSION}`);
  console.log(`   Directorio: ${RESULTS_DIR}`);
  console.log(`   Dry-run  : ${DRY_RUN}\n`);

  // Obtener run_id
  const runs = await pgGet(`trade_benchmark_runs?version_tag=eq.${encodeURIComponent(VERSION)}&select=id`) as { id: string }[];
  if (!runs.length) {
    console.error(`❌ No existe run con version_tag="${VERSION}" en trade_benchmark_runs`);
    process.exit(1);
  }
  const runId = runs[0].id;
  console.log(`   Run ID   : ${runId}`);

  const files = readdirSync(RESULTS_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .sort();
  console.log(`   Archivos : ${files.length}\n`);

  const rows = files.map(f => parseFile(join(RESULTS_DIR, f), runId));

  if (DRY_RUN) {
    console.log('DRY RUN — primeras 3 filas:');
    console.log(JSON.stringify(rows.slice(0, 3), null, 2));
    return;
  }

  // Insertar en lotes de 50
  const BATCH = 50;
  let inserted = 0;
  let errors   = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    try {
      await pgInsert('trade_benchmark_results', batch);
      inserted += batch.length;
      process.stdout.write(`  ✓ ${inserted}/${rows.length}\r`);
    } catch (e) {
      console.error(`\n  ✗ Lote ${i}–${i + batch.length}: ${(e as Error).message}`);
      errors += batch.length;
    }
  }

  console.log(`\n\n✅ Insertados : ${inserted}`);
  console.log(`❌ Con error  : ${errors}`);

  // Verificar en BD
  const count = await pgGet(
    `trade_benchmark_results?run_id=eq.${runId}&select=id` +
    `&limit=1&offset=0&prefer=count=exact`
  );
  const hdr = count as unknown as { 'content-range'?: string };
  console.log(`📊 Total en BD: ver tabla trade_benchmark_results para run ${VERSION}`);
}

main().catch(e => { console.error(e); process.exit(1); });
