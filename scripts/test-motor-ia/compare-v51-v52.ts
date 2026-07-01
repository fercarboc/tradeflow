/**
 * compare-v51-v52.ts
 * Compara resultados de la batería de 400 tests entre v51 y v52.
 * Lee raw JSON de output/raw_v51/ (baseline) y output/raw/ (v52).
 * Detecta TRUNCADO vía _meta.stop_reason=max_tokens (Opción B — sin tocar run-tests.ts).
 *
 * Usage: npx tsx scripts/test-motor-ia/compare-v51-v52.ts
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestResult, Category } from './types.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const V51_DIR = join(__dir, 'output', 'raw_v51');
const V52_DIR = join(__dir, 'output', 'raw');

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadResults(dir: string): TestResult[] {
  if (!existsSync(dir)) {
    console.error(`❌ Directorio no encontrado: ${dir}`);
    process.exit(1);
  }
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')) as TestResult)
    .sort((a, b) => a.id - b.id);
}

function effectiveCategory(r: TestResult): Category {
  const cat = r.classification.category;
  if (cat === 'VACIO') {
    const stopReason = r.raw_response?._meta?.stop_reason;
    if (stopReason === 'max_tokens') return 'TRUNCADO';
  }
  return cat;
}

function pct(n: number, total: number) {
  return total === 0 ? '0%' : `${Math.round((n / total) * 100)}%`;
}

function p95(lats: number[]) {
  const sorted = [...lats].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)] ?? 0;
}

function pad(s: string | number, w: number) {
  return String(s).padEnd(w);
}
function lpad(s: string | number, w: number) {
  return String(s).padStart(w);
}

// ── Load ─────────────────────────────────────────────────────────────────────

const v51 = loadResults(V51_DIR);
const v52 = loadResults(V52_DIR);

if (v51.length === 0 || v52.length === 0) {
  console.error('❌ Sin resultados en uno o ambos directorios');
  process.exit(1);
}

console.log(`\n📊 COMPARATIVA v51 vs v52 — ${v51.length} / ${v52.length} consultas`);
console.log('═'.repeat(72));

// ── Global KPIs ───────────────────────────────────────────────────────────────

function globalKpis(results: TestResult[]) {
  const cats: Record<string, number> = {};
  let coincide = 0;
  const lats: number[] = [];
  let tokensIn = 0, tokensOut = 0, withMeta = 0;

  for (const r of results) {
    const cat = effectiveCategory(r);
    cats[cat] = (cats[cat] ?? 0) + 1;
    if (r.classification.coincide_oficio === 'SI') coincide++;
    lats.push(r.latency_ms);
    if (r.raw_response?._meta) {
      tokensIn  += r.raw_response._meta.tokens_in  ?? 0;
      tokensOut += r.raw_response._meta.tokens_out ?? 0;
      withMeta++;
    }
  }

  const total = results.length;
  const ok = (cats['OK_CATALOGO'] ?? 0) + (cats['OK_MIXTO'] ?? 0);
  const avgLat = Math.round(lats.reduce((s, v) => s + v, 0) / lats.length);

  return {
    cats, total, ok, coincide,
    avgLat, p95Lat: p95(lats),
    avgTokIn:  withMeta ? Math.round(tokensIn  / withMeta) : null,
    avgTokOut: withMeta ? Math.round(tokensOut / withMeta) : null,
    withMeta,
  };
}

const g51 = globalKpis(v51);
const g52 = globalKpis(v52);

const ALL_CATS: Category[] = ['OK_CATALOGO', 'OK_MIXTO', 'SOLO_SUGERIDAS', 'VACIO', 'TRUNCADO', 'ERROR_TECNICO', 'PRECIO_INVALIDO'];

console.log('\n┌─ KPIs GLOBALES ─────────────────────────────────────────────────────┐');
console.log(`│ ${'Métrica'.padEnd(22)} ${'v51'.padStart(10)} ${'v52'.padStart(10)} ${'Δ'.padStart(10)} │`);
console.log('├──────────────────────────────────────────────────────────────────────┤');

function kpiRow(label: string, v51v: string | number, v52v: string | number, delta?: string) {
  const d = delta ?? '';
  console.log(`│ ${pad(label, 22)} ${lpad(v51v, 10)} ${lpad(v52v, 10)} ${lpad(d, 10)} │`);
}

kpiRow('Tasa OK (%)',
  pct(g51.ok, g51.total), pct(g52.ok, g52.total),
  `${g52.ok >= g51.ok ? '+' : ''}${Math.round((g52.ok - g51.ok) / g51.total * 100)}pp`);

kpiRow('Coincidencia oficio (%)',
  pct(g51.coincide, g51.total), pct(g52.coincide, g52.total),
  `${g52.coincide >= g51.coincide ? '+' : ''}${Math.round((g52.coincide - g51.coincide) / g51.total * 100)}pp`);

for (const cat of ALL_CATS) {
  const n51 = g51.cats[cat] ?? 0;
  const n52 = g52.cats[cat] ?? 0;
  if (n51 === 0 && n52 === 0) continue;
  kpiRow(`  ${cat}`, `${n51} (${pct(n51, g51.total)})`, `${n52} (${pct(n52, g52.total)})`,
    `${n52 - n51 >= 0 ? '+' : ''}${n52 - n51}`);
}

kpiRow('Latencia media (ms)', g51.avgLat, g52.avgLat,
  `${g52.avgLat - g51.avgLat >= 0 ? '+' : ''}${g52.avgLat - g51.avgLat}ms`);
kpiRow('Latencia p95 (ms)', g51.p95Lat, g52.p95Lat,
  `${g52.p95Lat - g51.p95Lat >= 0 ? '+' : ''}${g52.p95Lat - g51.p95Lat}ms`);

if (g52.avgTokIn !== null && g52.avgTokOut !== null) {
  const tokIn51  = g51.avgTokIn  ?? 'n/a';
  const tokOut51 = g51.avgTokOut ?? 'n/a';
  const dIn  = g51.avgTokIn  != null ? `${g52.avgTokIn  - g51.avgTokIn  >= 0 ? '+' : ''}${g52.avgTokIn  - g51.avgTokIn}`  : '';
  const dOut = g51.avgTokOut != null ? `${g52.avgTokOut - g51.avgTokOut >= 0 ? '+' : ''}${g52.avgTokOut - g51.avgTokOut}` : '';
  kpiRow('Tokens IN (media)',  tokIn51,  g52.avgTokIn,  dIn);
  kpiRow('Tokens OUT (media)', tokOut51, g52.avgTokOut, dOut);
}

console.log('└──────────────────────────────────────────────────────────────────────┘');

// ── Por oficio ────────────────────────────────────────────────────────────────

function byOficio(results: TestResult[]) {
  const map: Record<string, { ok: number; coincide: number; lats: number[]; vacio: number; trunc: number }> = {};
  for (const r of results) {
    if (!map[r.oficio]) map[r.oficio] = { ok: 0, coincide: 0, lats: [], vacio: 0, trunc: 0 };
    const cat = effectiveCategory(r);
    if (cat === 'OK_CATALOGO' || cat === 'OK_MIXTO') map[r.oficio].ok++;
    if (r.classification.coincide_oficio === 'SI') map[r.oficio].coincide++;
    if (cat === 'VACIO') map[r.oficio].vacio++;
    if (cat === 'TRUNCADO') map[r.oficio].trunc++;
    map[r.oficio].lats.push(r.latency_ms);
  }
  return map;
}

const byO51 = byOficio(v51);
const byO52 = byOficio(v52);
const oficios = [...new Set(v51.map(r => r.oficio))].sort();

console.log('\n┌─ RESULTADOS POR OFICIO ─────────────────────────────────────────────────────────────────────────┐');
console.log(`│ ${'Oficio'.padEnd(24)} ${'OK% 51'.padStart(7)} ${'OK% 52'.padStart(7)} ${'Coinc51'.padStart(8)} ${'Coinc52'.padStart(8)} ${'Lat51'.padStart(7)} ${'Lat52'.padStart(7)} ${'VACIO'.padStart(6)} ${'TRUNC'.padStart(6)} │`);
console.log('├────────────────────────────────────────────────────────────────────────────────────────────────────┤');

const REGRESSIONS: string[] = [];
const IMPROVEMENTS: string[] = [];

for (const oficio of oficios) {
  const o51 = byO51[oficio] ?? { ok: 0, coincide: 0, lats: [0], vacio: 0, trunc: 0 };
  const o52 = byO52[oficio] ?? { ok: 0, coincide: 0, lats: [0], vacio: 0, trunc: 0 };
  const total = o51.lats.length;

  const ok51 = pct(o51.ok, total);
  const ok52 = pct(o52.ok, total);
  const c51  = pct(o51.coincide, total);
  const c52  = pct(o52.coincide, total);
  const avg51 = Math.round(o51.lats.reduce((s, v) => s + v, 0) / o51.lats.length);
  const avg52 = Math.round(o52.lats.reduce((s, v) => s + v, 0) / o52.lats.length);

  const vacioDelta = o52.vacio - o51.vacio;
  const coincDelta = o52.coincide - o51.coincide;

  if (vacioDelta > 0) REGRESSIONS.push(`NUEVO VACIO en ${oficio}: +${vacioDelta}`);
  if (o52.trunc > 0)  REGRESSIONS.push(`TRUNCADO en ${oficio}: ${o52.trunc} casos`);
  if (coincDelta >= 5) IMPROVEMENTS.push(`Coincidencia en ${oficio}: +${coincDelta} casos`);

  const vacioPart = o52.vacio > 0 ? `   ⚠${o52.vacio}` : `    ${o52.vacio}`;
  const truncPart = o52.trunc > 0 ? `  ⚠${o52.trunc}` : `   ${o52.trunc}`;

  console.log(`│ ${pad(oficio, 24)} ${lpad(ok51, 7)} ${lpad(ok52, 7)} ${lpad(c51, 8)} ${lpad(c52, 8)} ${lpad(avg51 + 'ms', 7)} ${lpad(avg52 + 'ms', 7)} ${vacioPart} ${truncPart} │`);
}

console.log('└────────────────────────────────────────────────────────────────────────────────────────────────────┘');

// ── Stop reason breakdown (v52 only) ─────────────────────────────────────────

const stopReasons: Record<string, number> = {};
for (const r of v52) {
  const sr = r.raw_response?._meta?.stop_reason ?? 'no_meta';
  stopReasons[sr] = (stopReasons[sr] ?? 0) + 1;
}

console.log('\n┌─ STOP REASON v52 ─────────────────────────────────────────────────────┐');
for (const [sr, n] of Object.entries(stopReasons).sort((a, b) => b[1] - a[1])) {
  console.log(`│  ${pad(sr, 20)} ${lpad(n, 4)}  (${pct(n, v52.length)}) │`);
}
console.log('└──────────────────────────────────────────────────────────────────────┘');

// ── Casos con stop_reason=max_tokens ─────────────────────────────────────────

const truncados = v52.filter(r => r.raw_response?._meta?.stop_reason === 'max_tokens');
if (truncados.length > 0) {
  console.log(`\n⚠️  TRUNCADOS (stop_reason=max_tokens): ${truncados.length} casos`);
  for (const r of truncados) {
    const tokOut = r.raw_response?._meta?.tokens_out ?? '?';
    const isComplex = r.raw_response?._meta?.tokens_out !== undefined;
    console.log(`  [${r.id}] ${r.oficio.padEnd(22)} ${r.classification.category.padEnd(14)} tokOut=${tokOut}  "${r.texto.slice(0, 50)}..."`);
  }
}

// ── Regresiones y mejoras ─────────────────────────────────────────────────────

console.log('\n');
if (REGRESSIONS.length > 0) {
  console.log('🔴 REGRESIONES DETECTADAS:');
  REGRESSIONS.forEach(r => console.log(`  • ${r}`));
} else {
  console.log('✅ Sin regresiones detectadas');
}

if (IMPROVEMENTS.length > 0) {
  console.log('\n🟢 MEJORAS SIGNIFICATIVAS:');
  IMPROVEMENTS.forEach(r => console.log(`  • ${r}`));
}

// ── Casos que cambiaron de v51 a v52 ─────────────────────────────────────────

const v51map = new Map(v51.map(r => [r.id, r]));
const changed: Array<{ id: number; oficio: string; from: Category; to: Category; texto: string }> = [];

for (const r52 of v52) {
  const r51 = v51map.get(r52.id);
  if (!r51) continue;
  const from = effectiveCategory(r51);
  const to   = effectiveCategory(r52);
  if (from !== to) changed.push({ id: r52.id, oficio: r52.oficio, from, to, texto: r52.texto });
}

if (changed.length > 0) {
  console.log(`\n📋 CASOS CON CAMBIO DE CATEGORÍA: ${changed.length}`);
  const upgrades   = changed.filter(c => c.to === 'OK_CATALOGO' || c.to === 'OK_MIXTO');
  const downgrades = changed.filter(c => c.from === 'OK_CATALOGO' || c.from === 'OK_MIXTO');
  const vacios     = changed.filter(c => c.to === 'VACIO' || c.to === 'TRUNCADO');

  if (upgrades.length > 0) {
    console.log(`\n  🟢 Mejoras (→ OK): ${upgrades.length}`);
    upgrades.forEach(c => console.log(`     [${c.id}] ${c.oficio.padEnd(22)} ${c.from} → ${c.to}`));
  }
  if (downgrades.length > 0) {
    console.log(`\n  🔴 Regresiones (OK →): ${downgrades.length}`);
    downgrades.forEach(c => console.log(`     [${c.id}] ${c.oficio.padEnd(22)} ${c.from} → ${c.to}  "${c.texto.slice(0, 50)}..."`));
  }
  if (vacios.length > 0) {
    console.log(`\n  ⚪ Nuevos VACIO/TRUNCADO: ${vacios.length}`);
    vacios.forEach(c => console.log(`     [${c.id}] ${c.oficio.padEnd(22)} ${c.from} → ${c.to}  "${c.texto.slice(0, 50)}..."`));
  }
}

console.log('\n');
