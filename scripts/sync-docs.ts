/**
 * TrabFlow — Sincronización Documental Corporativa
 * Elimina de trade_documents (y Storage) los registros cuyo archivo
 * ya no existe en docs/. Seguro: pide confirmación antes de borrar.
 *
 * Uso:
 *   npm run sync-docs          ← muestra plan y pide confirmación
 *   npm run sync-docs -- --dry-run  ← solo muestra, no borra nada
 *   npm run sync-docs -- --yes      ← ejecuta sin confirmación
 */

// Polyfill WebSocket for Node 20
if (!globalThis.WebSocket) {
  // @ts-ignore
  globalThis.WebSocket = class WebSocket { constructor() {} close() {} send() {} };
}

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

// ── Env ────────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const envPath = path.join(ROOT, '.env');
const envVars: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) envVars[k.trim()] = v.join('=').trim();
  });
}

const SUPABASE_URL     = envVars['VITE_SUPABASE_URL']        || process.env['VITE_SUPABASE_URL'] || '';
const SERVICE_ROLE_KEY = envVars['SUPABASE_SERVICE_ROLE_KEY'] || process.env['SUPABASE_SERVICE_ROLE_KEY'] || '';
const DOCS_ROOT        = path.join(ROOT, 'docs');
const BUCKET           = 'corporate-documents';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch },
});

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const AUTO_YES = args.includes('--yes');

// ── Helpers ────────────────────────────────────────────────────────────────

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

function formatSize(bytes?: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   TrabFlow — Sincronización Documental Corporativa   ║');
  if (DRY_RUN) console.log('║              [MODO DRY-RUN — sin cambios]            ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // 1. Cargar todos los registros con origen_path de la BD
  console.log('📋 Cargando registros de trade_documents...');
  const { data: allDocs, error } = await supabase
    .from('trade_documents')
    .select('id, nombre, categoria, origen_path, storage_path, bucket, size')
    .not('origen_path', 'is', null)
    .order('categoria')
    .order('nombre');

  if (error) { console.error('❌ Error cargando docs:', error.message); process.exit(1); }

  const docs = allDocs ?? [];
  console.log(`   ${docs.length} registros con origen_path en BD\n`);

  // 2. Identificar cuáles ya no existen localmente
  const toDelete: typeof docs = [];
  const toKeep: typeof docs = [];

  for (const doc of docs) {
    const localPath = path.join(ROOT, doc.origen_path!.replace(/\\/g, '/'));
    if (!fs.existsSync(localPath)) {
      toDelete.push(doc);
    } else {
      toKeep.push(doc);
    }
  }

  console.log(`✅ Archivos locales encontrados:  ${toKeep.length}`);
  console.log(`🗑  Archivos eliminados de docs/:  ${toDelete.length}`);

  if (toDelete.length === 0) {
    console.log('\n✨ El repositorio ya está sincronizado. Nada que borrar.\n');
    return;
  }

  // 3. Mostrar plan agrupado por categoría
  const byCategoria: Record<string, typeof toDelete> = {};
  toDelete.forEach(d => {
    const c = d.categoria ?? 'sin_cat';
    if (!byCategoria[c]) byCategoria[c] = [];
    byCategoria[c].push(d);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  REGISTROS A ELIMINAR (archivo ya no existe en docs/)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let totalSize = 0;
  for (const [cat, catDocs] of Object.entries(byCategoria).sort()) {
    console.log(`  📁 Categoría ${cat} (${catDocs.length} docs)`);
    catDocs.forEach(d => {
      const size = formatSize(d.size);
      const name = d.nombre.length > 55 ? d.nombre.slice(0, 55) + '…' : d.nombre;
      console.log(`     · ${name.padEnd(58)} ${size}`);
      totalSize += d.size ?? 0;
    });
    console.log();
  }

  const totalMB = (totalSize / 1048576).toFixed(1);
  console.log(`  Total: ${toDelete.length} registros · ${totalMB} MB liberados de Storage\n`);

  if (DRY_RUN) {
    console.log('🔍 Dry-run completado. Usa npm run sync-docs para ejecutar los borrados.\n');
    return;
  }

  // 4. Confirmación
  let confirmed = AUTO_YES;
  if (!confirmed) {
    const ans = await ask(`¿Eliminar estos ${toDelete.length} registros de BD y Storage? (s/N): `);
    confirmed = ans.toLowerCase() === 's' || ans.toLowerCase() === 'si' || ans.toLowerCase() === 'sí';
  }

  if (!confirmed) { console.log('\n❌ Cancelado.\n'); return; }

  // 5. Borrar
  console.log('\n🗑  Eliminando...\n');
  let deleted = 0;
  let errors = 0;
  const t0 = Date.now();

  for (const doc of toDelete) {
    // Eliminar de Storage si tiene storage_path (y no es URL directa)
    if (doc.storage_path && !doc.storage_path.startsWith('http')) {
      await supabase.storage.from(doc.bucket ?? BUCKET).remove([doc.storage_path]);
    }
    // Eliminar de BD (cascade borra trade_document_entities)
    const { error: delErr } = await supabase.from('trade_documents').delete().eq('id', doc.id);
    if (delErr) { errors++; console.error(`  ✗ Error: ${doc.nombre} — ${delErr.message}`); }
    else { deleted++; process.stdout.write(`  ✔ ${deleted}/${toDelete.length}\r`); }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('\n\n╔══════════════════════════════════════════════════════╗');
  console.log('║                 RESULTADO SYNC                      ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  ✔  Eliminados:    ${String(deleted).padEnd(34)}║`);
  console.log(`║  ✗  Errores:       ${String(errors).padEnd(34)}║`);
  console.log(`║  📋 Conservados:   ${String(toKeep.length).padEnd(34)}║`);
  console.log(`║  ⏱  Tiempo:        ${(elapsed + 's').padEnd(34)}║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');
}

main().catch(e => { console.error('❌ Error fatal:', e); process.exit(1); });
