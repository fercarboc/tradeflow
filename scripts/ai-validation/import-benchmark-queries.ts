/**
 * Importa las 400 queries del Benchmark Oficial a trade_benchmark_queries.
 * Normaliza oficio_display → oficio_esperado (slug canónico verificado contra BD).
 *
 * Uso:
 *   npx tsx scripts/ai-validation/import-benchmark-queries.ts [--dry-run]
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

dotenvConfig({ path: join(ROOT, '.env') });

const SUPABASE_URL     = (process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const DRY_RUN          = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

// ── Mapa canónico — verificado contra oficio_detectado real en trade_benchmark_results ──
const OFICIO_SLUG: Record<string, string> = {
  'Albañilería':          'albanileria',
  'Carpintería':          'carpinteria',
  'Cerrajería':           'cerrajeria',
  'Climatización':        'climatizacion',
  'Contra Incendios':     'contra_incendios',
  'Cristalería':          'cristaleria',
  'Electricidad':         'electricidad',
  'Energía Solar':        'energia_solar',
  'Fachadas':             'fachadas',
  'Fontanería':           'fontaneria',
  'Impermeabilización':   'impermeabilizacion',
  'Jardinería':           'jardineria',
  'Mantenimiento General':'mantenimiento_general',
  'Persianas':            'persianas',
  'Pintura':              'pintura',
  'Pladur':               'pladur_escayola',
  'Reformas Integrales':  'reforma_integral',
  'Suelos y Alicatados':  'suelos_alicatados',
  'Tejados/Cubiertas':    'tejados_cubiertas',
  'Telecomunicaciones':   'telecomunicaciones',
};

const HEADERS = {
  'apikey':        SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=minimal,resolution=ignore-duplicates',
};

async function pgGet(path: string): Promise<unknown[]> {
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
  if (!res.ok) throw new Error(`POST ${table} → ${res.status} ${await res.text()}`);
}

async function pgDelete(table: string, filter: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`DELETE ${table} → ${res.status} ${await res.text()}`);
}

async function main() {
  console.log('\n📋 Import Benchmark Queries');
  console.log(`   Dry-run: ${DRY_RUN}\n`);

  // Leer queries.json
  const queriesPath = join(ROOT, 'scripts/test-motor-ia/queries.json');
  if (!existsSync(queriesPath)) {
    console.error(`❌ No encontrado: ${queriesPath}`);
    process.exit(1);
  }
  const queries = JSON.parse(readFileSync(queriesPath, 'utf-8')) as Array<{ id: number; oficio: string; texto: string }>;
  console.log(`   Queries en archivo: ${queries.length}`);

  // Verificar que todos los oficios tienen slug canónico
  const oficiosUnicos = [...new Set(queries.map(q => q.oficio))].sort();
  const sinSlug = oficiosUnicos.filter(o => !OFICIO_SLUG[o]);
  if (sinSlug.length) {
    console.error(`❌ Oficios sin slug canónico: ${sinSlug.join(', ')}`);
    process.exit(1);
  }
  console.log(`   Oficios únicos: ${oficiosUnicos.length} (todos con slug canónico ✓)\n`);

  if (DRY_RUN) {
    console.log('DRY RUN — primeras 3 filas:');
    queries.slice(0, 3).forEach(q => {
      console.log(`  posicion=${q.id} oficio_display="${q.oficio}" oficio_esperado="${OFICIO_SLUG[q.oficio]}" texto="${q.texto.slice(0, 60)}…"`);
    });
    return;
  }

  // Obtener benchmark_id del Benchmark Oficial
  const benchmarks = await pgGet('trade_benchmarks?tipo=eq.oficial&es_baseline=eq.true&select=id,nombre') as { id: string; nombre: string }[];
  if (!benchmarks.length) {
    console.error('❌ No encontrado benchmark oficial baseline');
    process.exit(1);
  }
  const benchmarkId = benchmarks[0].id;
  console.log(`   Benchmark: ${benchmarks[0].nombre} (${benchmarkId})`);

  // Eliminar queries previas para este benchmark (idempotente)
  await pgDelete('trade_benchmark_queries', `benchmark_id=eq.${benchmarkId}`);
  console.log('   Queries previas eliminadas');

  // Construir filas
  const rows = queries.map(q => ({
    benchmark_id:    benchmarkId,
    posicion:        q.id,
    oficio_display:  q.oficio,
    oficio_esperado: OFICIO_SLUG[q.oficio],
    texto:           q.texto,
    activo:          true,
  }));

  // Insertar en lotes de 100
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    await pgInsert('trade_benchmark_queries', rows.slice(i, i + BATCH));
    inserted += Math.min(BATCH, rows.length - i);
    process.stdout.write(`  ✓ ${inserted}/${rows.length}\r`);
  }

  console.log(`\n\n✅ Queries importadas: ${inserted}`);

  // Actualizar total_queries en benchmark
  const res = await fetch(`${SUPABASE_URL}/rest/v1/trade_benchmarks?id=eq.${benchmarkId}`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify({ total_queries: inserted }),
  });
  if (!res.ok) console.warn('  ⚠ No se pudo actualizar total_queries en benchmark');

  // Verificar
  const count = await pgGet(`trade_benchmark_queries?benchmark_id=eq.${benchmarkId}&select=posicion,oficio_display,oficio_esperado&limit=3`);
  console.log('\nPrimeras 3 filas en BD:');
  (count as {posicion:number;oficio_display:string;oficio_esperado:string}[]).forEach(r =>
    console.log(`  posicion=${r.posicion} display="${r.oficio_display}" slug="${r.oficio_esperado}"`)
  );
}

main().catch(e => { console.error(e); process.exit(1); });
