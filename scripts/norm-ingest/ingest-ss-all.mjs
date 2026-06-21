// Orquestador maestro — Fase Seguridad Social
// Uso: node ingest-ss-all.mjs              → procesa todos los disponibles
//      node ingest-ss-all.mjs SS_LGSS      → solo LGSS
//      node ingest-ss-all.mjs SS_COTIZACION
//
// Prerequisitos:
//   VOYAGE_API_KEY y SUPABASE_SERVICE_ROLE_KEY en .env.local

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { NORMATIVA_BASE } from './config.mjs';
import { extractPdfToText } from './pdf-to-text.mjs';
import { textToChunks, saveChunksToJson } from './text-to-chunks.mjs';
import { uploadChunks } from './upload-chunks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Catálogo de documentos SS ─────────────────────────────────────────────────
const SS_DOCS = [
  {
    category:         'SS_LGSS',
    pdf:              'LSGS_BOE-A-2015-11724-consolidado.pdf',
    plan:             'empresa_plus',
    organismoEmisor:  'Ministerio de Trabajo y Economía Social',
    fechaPublicacion: '2015-10-30',
    tipoDocumento:    'ley',
    naturaleza:       'obligacion_legal',
    boeRef:           'BOE-A-2015-11724',
    prioridad:        1,
  },
  {
    category:         'SS_AFILIACION',
    pdf:              'RD_LSGS_BOE-A-1996-4447-consolidado.pdf',
    plan:             'empresa_plus',
    organismoEmisor:  'Ministerio de Trabajo y Seguridad Social',
    fechaPublicacion: '1996-02-26',
    tipoDocumento:    'reglamento',
    naturaleza:       'obligacion_legal',
    boeRef:           'BOE-A-1996-4447',
    prioridad:        2,
  },
  {
    category:         'SS_COTIZACION',
    pdf:              'RD_LSGS_COTIZACIONES_BOE-A-1996-1579-consolidado.pdf',
    plan:             'empresa_plus',
    organismoEmisor:  'Ministerio de Trabajo y Seguridad Social',
    fechaPublicacion: '1995-12-22',
    tipoDocumento:    'reglamento',
    naturaleza:       'obligacion_legal',
    boeRef:           'BOE-A-1996-1579',
    prioridad:        3,
  },
  // Pendiente de descarga:
  // { category: 'SS_RETA',               pdf: 'Guia_RETA_2025.pdf',                     plan: 'empresa_plus', prioridad: 4 },
  // { category: 'SS_SISTEMA_RED',        pdf: 'Manual_Sistema_RED_2024.pdf',             plan: 'empresa_plus', prioridad: 5 },
  // { category: 'SS_BONIFICACIONES',     pdf: 'Guia_Bonificaciones_Contratacion_2025.pdf', plan: 'empresa_plus', prioridad: 6 },
  // { category: 'SS_AUTONOMO_COLABORADOR', pdf: 'Guia_Autonomo_Colaborador_2025.pdf',   plan: 'empresa_plus', prioridad: 7 },
  // { category: 'SS_BOLETINES_RED',      pdf: 'Boletines_Noticias_RED_2024.pdf',         plan: 'empresa_plus', prioridad: 8 },
];

// ── Palabras clave prioritarias para instaladores en SS ───────────────────────
const PRIORITY_KEYWORDS_SS = /alta[\s\w]*trabajador|baja[\s\w]*trabajador|afiliaci[oó]n|cotizaci[oó]n|cuota|base\s+de\s+cotizaci[oó]n|autónomo\s+colaborador|familiar\s+colaborador|RETA|plazo|comunicaci[oó]n|incapacidad\s+temporal|desempleo|bonificaci[oó]n|prestaci[oó]n|inscripci[oó]n\s+de\s+empresa|sistema\s+RED|sanci[oó]n|fuera\s+de\s+plazo|hijo|cónyuge|famili|contrat/i;

// ── Procesar un documento SS ──────────────────────────────────────────────────
async function processDoc(doc) {
  const catBase = join(NORMATIVA_BASE, doc.category);

  for (const sub of ['PDF', 'TXT', 'CHUNKS', 'METADATA']) {
    const p = join(catBase, sub);
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  }

  const fichaPath = join(catBase, 'ficha_fuente.txt');
  const ficha = existsSync(fichaPath) ? readFileSync(fichaPath, 'utf8') : '';
  const get = (k) => { const m = ficha.match(new RegExp(`^${k}:\\s*(.+)`, 'im')); return m?.[1]?.trim() || ''; };

  const title   = get('Título') || doc.category;
  const version = get('Versión') || doc.fechaPublicacion;

  const docMeta = {
    category:           doc.category,
    title,
    boeRef:             doc.boeRef || '',
    version,
    planRequired:       doc.plan,
    oficioTags:         [],
    organismoEmisor:    doc.organismoEmisor,
    fechaPublicacion:   doc.fechaPublicacion,
    fechaDerogacion:    null,
    ambitoTerritorial:  'estatal',
    territorio:         null,
    tipoDocumento:      doc.tipoDocumento,
    numeroConsulta:     null,
  };

  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  ${doc.category.padEnd(42)} ║`);
  console.log(`║  ${title.slice(0,42).padEnd(42)} ║`);
  console.log(`║  Plan: ${doc.plan.padEnd(38)} ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);

  const pdfPath  = join(catBase, 'PDF', doc.pdf);
  if (!existsSync(pdfPath)) {
    console.warn(`⚠️  PDF no encontrado: ${pdfPath}`);
    console.warn(`   Descárgalo y colócalo en ${join(catBase, 'PDF')}`);
    return { category: doc.category, uploaded: 0, failed: 0, skipped: true };
  }

  const baseFilename = doc.pdf.replace(/\.pdf$/i, '');
  const txtPath      = join(catBase, 'TXT', `${baseFilename}.txt`);
  const chunksPath   = join(catBase, 'CHUNKS', `${baseFilename}_chunks.json`);

  // PASO 1: PDF → TXT
  let text;
  if (existsSync(txtPath)) {
    console.log(`📄 TXT existe, cargando: ${baseFilename}.txt`);
    text = readFileSync(txtPath, 'utf8');
  } else {
    console.log(`📑 Extrayendo texto de ${doc.pdf}...`);
    const result = await extractPdfToText(doc.category, doc.pdf);
    text = result.text;
  }

  // PASO 2: Chunking con patrones SS
  let chunks;
  if (existsSync(chunksPath)) {
    console.log(`💾 Chunks existen, cargando...`);
    chunks = JSON.parse(readFileSync(chunksPath, 'utf8'));
    console.log(`   ${chunks.length} chunks cargados`);
  } else {
    chunks = textToChunks(text, doc.category, title, doc.boeRef || '', version, { naturaleza: doc.naturaleza });

    // Reordenar: chunks relevantes para instaladores primero
    const priority = chunks.filter(c => PRIORITY_KEYWORDS_SS.test(c.chunk_text));
    const rest     = chunks.filter(c => !PRIORITY_KEYWORDS_SS.test(c.chunk_text));
    chunks = [...priority, ...rest].map((c, i) => ({ ...c, chunk_index: i }));
    console.log(`   ✅ ${priority.length} chunks prioritarios · ${rest.length} generales`);

    saveChunksToJson(chunks, doc.category, baseFilename, NORMATIVA_BASE);
  }

  // PASO 3: Upload a Supabase
  const { docId, uploaded, failed } = await uploadChunks(chunksPath, docMeta);
  console.log(`\n   ✅ Subidos: ${uploaded} · Fallidos: ${failed} · Doc ID: ${docId}`);
  return { category: doc.category, uploaded, failed };
}

// ── Main ──────────────────────────────────────────────────────────────────────
const targetCategory = process.argv[2]?.toUpperCase() ?? null;
const docs = targetCategory
  ? SS_DOCS.filter(d => d.category === targetCategory)
  : SS_DOCS.sort((a, b) => a.prioridad - b.prioridad);

if (docs.length === 0) {
  console.error(`Categoría no encontrada: ${targetCategory}`);
  console.error(`Disponibles: ${SS_DOCS.map(d => d.category).join(', ')}`);
  process.exit(1);
}

console.log(`\n🔐 INGESTA FASE SEGURIDAD SOCIAL — ${docs.length} documento(s)\n`);

const results = [];
for (const doc of docs) {
  try {
    const r = await processDoc(doc);
    results.push(r);
  } catch (e) {
    console.error(`❌ Error en ${doc.category}: ${e.message}`);
    results.push({ category: doc.category, uploaded: 0, failed: -1, error: e.message });
  }
}

console.log('\n╔══════════════════════════════════════════════╗');
console.log('║         RESUMEN FINAL SEGURIDAD SOCIAL        ║');
console.log('╠══════════════════════════════════════════════╣');
for (const r of results) {
  const status = r.skipped ? '⏭️ ' : r.failed === -1 ? '❌' : r.failed > 0 ? '⚠️' : '✅';
  console.log(`║ ${status} ${r.category.padEnd(28)} ${String(r.uploaded ?? 0).padStart(5)} chunks ║`);
}
console.log('╚══════════════════════════════════════════════╝');
console.log('\nVerifica con:');
console.log("  SELECT category, COUNT(*) FROM trade_norm_chunks WHERE category LIKE 'SS_%' GROUP BY category ORDER BY category;");
