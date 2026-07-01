/**
 * Test runner — Motor IA Voz-a-Presupuesto
 * Usage: npm run test:motor-ia [-- --from=1 --to=400 --batch=8 --resume]
 *
 * Auth: uses VITE_SUPABASE_ANON_KEY as Bearer token → edge function runs in
 * "anon mode" (skips user lookup and org-specific catalog enrichment) which is
 * correct for testing the raw AI/KB behaviour across all 400 queries.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';
import { classify } from './classify.js';
import { generateExcel } from './report-excel.js';
import { generateWord } from './report-word.js';
import type { Query, TestResult, ApiResponse } from './types.js';

// ── Setup ────────────────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));

// Load .env from project root (parent of scripts/)
dotenvConfig({ path: join(__dir, '../../.env') });
dotenvConfig({ path: join(__dir, '../../.env.local'), override: false });

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
// TRADE_TEST_KEY → secret known to the edge function, bypasses user auth / org limits
const TEST_KEY = process.env.TRADE_TEST_KEY ?? '';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/trade-voice-to-quote`;

if (!SUPABASE_URL || !TEST_KEY) {
  console.error('❌ Faltan VITE_SUPABASE_URL o TRADE_TEST_KEY en .env');
  process.exit(1);
}

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const argVal = (key: string, def: number) =>
  Number(args.find(a => a.startsWith(`--${key}=`))?.split('=')[1] ?? def);
const argFlag = (key: string) => args.includes(`--${key}`);

const FROM = argVal('from', 1);
const TO = argVal('to', 400);
const BATCH_SIZE = argVal('batch', 6);
const MAX_RETRIES = 2;
const TIMEOUT_MS = 90_000;
const RESUME = argFlag('resume'); // skip queries with existing raw files

// ── Paths ─────────────────────────────────────────────────────────────────────

const OUT_DIR = join(__dir, 'output');
const RAW_DIR = join(OUT_DIR, 'raw');
const XLSX_PATH = join(OUT_DIR, 'test_results.xlsx');
const DOCX_PATH = join(OUT_DIR, 'test_summary.docx');

for (const d of [OUT_DIR, RAW_DIR]) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function callFunction(text: string): Promise<{ status: number; body: ApiResponse | null; latency: number }> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_KEY}`,
      },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    const latency = Date.now() - start;
    let body: ApiResponse | null = null;
    try {
      body = await res.json() as ApiResponse;
    } catch {
      // Non-JSON body (e.g. edge function crash)
    }

    return { status: res.status, body, latency };
  } catch (err: unknown) {
    const latency = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: 0,
      body: { error: msg.includes('abort') ? 'Timeout (90s)' : msg },
      latency,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runQueryWithRetry(query: Query): Promise<TestResult> {
  let attempt = 0;
  let last: { status: number; body: ApiResponse | null; latency: number } = {
    status: 0,
    body: null,
    latency: 0,
  };

  while (attempt <= MAX_RETRIES) {
    if (attempt > 0) {
      await sleep(5_000 * attempt);
      console.log(`  ↩ retry ${attempt}/${MAX_RETRIES} para #${query.id}`);
    }
    last = await callFunction(query.texto);

    const isOk = last.status === 200 && last.body && !last.body.error;
    const isRetriable = last.status === 0 || last.status >= 500 || last.status === 429;
    if (isOk || !isRetriable) break;
    attempt++;
  }

  const errorMsg =
    last.status !== 200
      ? (last.body?.error ?? `HTTP ${last.status}`)
      : last.body?.error ?? undefined;

  // The API wraps the quote in { quote: {...}, transcript, ... } — extract inner quote for classification
  const innerQuote = last.body?.quote ?? null;
  const classification = classify(innerQuote, query.oficio, last.status, errorMsg);

  return {
    id: query.id,
    oficio: query.oficio,
    texto: query.texto,
    http_status: last.status,
    latency_ms: last.latency,
    raw_response: last.body,
    classification,
    error_msg: errorMsg,
  };
}

// ── Batch runner ──────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function rawPath(id: number, oficio: string): string {
  const safe = oficio.replace(/[/\\?%*:|"<>]/g, '_');
  return join(RAW_DIR, `${safe}_${String(id).padStart(3, '0')}.json`);
}

async function runBatch(queries: Query[]): Promise<TestResult[]> {
  return Promise.all(queries.map(q => runQueryWithRetry(q)));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const allQueries: Query[] = JSON.parse(readFileSync(join(__dir, 'queries.json'), 'utf8'));
  const queries = allQueries.filter(q => q.id >= FROM && q.id <= TO);

  console.log(`\n🚀 test-motor-ia — ${queries.length} consultas (ids ${FROM}–${TO}), batch=${BATCH_SIZE}, resume=${RESUME}`);
  console.log(`   Endpoint: ${FUNCTION_URL}\n`);

  const results: TestResult[] = [];

  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);

    // Resume: load from raw if already done
    const todo: Query[] = [];
    for (const q of batch) {
      const rp = rawPath(q.id, q.oficio);
      if (RESUME && existsSync(rp)) {
        try {
          const saved = JSON.parse(readFileSync(rp, 'utf8')) as TestResult;
          results.push(saved);
          process.stdout.write(`[resume] #${q.id} `);
          continue;
        } catch { /* re-run if corrupt */ }
      }
      todo.push(q);
    }

    if (todo.length > 0) {
      const batchResults = await runBatch(todo);
      for (const r of batchResults) {
        results.push(r);
        writeFileSync(rawPath(r.id, r.oficio), JSON.stringify(r, null, 2));
        const icon =
          r.classification.category === 'OK_CATALOGO' ? '✅' :
          r.classification.category === 'OK_MIXTO' ? '🟡' :
          r.classification.category === 'SOLO_SUGERIDAS' ? '🔵' :
          r.classification.category === 'VACIO' ? '⚪' : '❌';
        console.log(
          `${icon} [${r.id}] ${r.oficio.padEnd(22)} ${r.classification.category.padEnd(16)} ` +
          `${r.classification.n_partidas}p ${r.latency_ms}ms`,
        );
      }
    }

    // Small delay between batches to avoid hammering the function
    if (i + BATCH_SIZE < queries.length) {
      await sleep(800);
    }
  }

  // Sort by id to ensure consistent output regardless of async ordering
  results.sort((a, b) => a.id - b.id);

  // ── Reports ────────────────────────────────────────────────────────────────
  console.log('\n📊 Generando reportes...');

  await generateExcel(results, XLSX_PATH);
  await generateWord(results, DOCX_PATH);

  // ── Summary to console ─────────────────────────────────────────────────────
  const total = results.length;
  const catCounts: Record<string, number> = {};
  for (const r of results) {
    catCounts[r.classification.category] = (catCounts[r.classification.category] ?? 0) + 1;
  }
  const ok = (catCounts['OK_CATALOGO'] ?? 0) + (catCounts['OK_MIXTO'] ?? 0);
  const avgLat = Math.round(results.reduce((s, r) => s + r.latency_ms, 0) / total);

  console.log('\n──────────────────────────────────────────────');
  console.log(`📈 RESULTADOS FINALES (${total} consultas)`);
  console.log('──────────────────────────────────────────────');
  for (const [cat, n] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(18)} ${String(n).padStart(4)}  (${Math.round((n / total) * 100)}%)`);
  }
  console.log(`  ${'─'.repeat(36)}`);
  console.log(`  Tasa OK             ${String(ok).padStart(4)}  (${Math.round((ok / total) * 100)}%)`);
  console.log(`  Latencia media      ${avgLat}ms`);
  console.log('──────────────────────────────────────────────');
  console.log(`\n✅ Reportes en: ${OUT_DIR}`);
  console.log(`   • ${XLSX_PATH}`);
  console.log(`   • ${DOCX_PATH}\n`);
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
