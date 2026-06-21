// Orquestador — Fase DGT (Consultas Vinculantes)
// Uso: node ingest-dgt-all.mjs           → procesa todas las consultas
//      node ingest-dgt-all.mjs V0255-23  → solo esa consulta

import { readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { NORMATIVA_BASE } from './config.mjs';
import { extractPdfToText } from './pdf-to-text.mjs';
import { textToChunks, saveChunksToJson } from './text-to-chunks.mjs';
import { uploadChunks } from './upload-chunks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PDF_DIR = join(NORMATIVA_BASE, 'DGT', 'PDF');

// Palabras clave prioritarias en consultas DGT para instaladores
const PRIORITY_KEYWORDS_DGT = /CONTESTACIÓN|HECHOS|aerotermia|bomba\s+de\s+calor|fotovoltai|autoconsumo|rehabilitaci[oó]n\s+energ[eé]tica|eficiencia\s+energ[eé]tica|tipo\s+reducido|iva\s+reducido|10\s*%|deducci[oó]n.*vivienda|mejora\s+eficiencia|certificaci[oó]n\s+energ[eé]tica|calificaci[oó]n\s+energ[eé]tica|instalaci[oó]n|renovaci[oó]n|mano\s+de\s+obra|base\s+imponible/i;

// Leer todos los PDFs del directorio DGT
function getDGTDocs() {
  if (!existsSync(PDF_DIR)) {
    console.error(`❌ No existe el directorio: ${PDF_DIR}`);
    process.exit(1);
  }
  return readdirSync(PDF_DIR)
    .filter(f => f.endsWith('.pdf') || f.endsWith('.PDF'))
    .map(pdf => {
      const ref = basename(pdf, '.pdf').replace(/^V/, 'V-').replace(/-(\d{2})$/, '-20$1').replace('V-', 'V-');
      const refClean = basename(pdf, '.pdf'); // V0255-23
      const year = refClean.slice(-2);
      const num  = refClean.slice(1, -3);
      return {
        pdf,
        refClean,
        ref:    `V-${num}-${year}`,
        title:  `Consulta Vinculante DGT ${refClean}`,
        fecha:  `20${year}-01-01`,
      };
    })
    .sort((a, b) => a.refClean.localeCompare(b.refClean));
}

async function processDoc(doc) {
  const catBase = join(NORMATIVA_BASE, 'DGT');
  for (const sub of ['TXT', 'CHUNKS', 'METADATA']) {
    const p = join(catBase, sub);
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  }

  const pdfPath    = join(catBase, 'PDF', doc.pdf);
  const baseFile   = basename(doc.pdf, '.pdf');
  const txtPath    = join(catBase, 'TXT',    `${baseFile}.txt`);
  const chunksPath = join(catBase, 'CHUNKS', `${baseFile}_chunks.json`);

  const docMeta = {
    category:          'DGT',
    title:             doc.title,
    boeRef:            doc.refClean,
    version:           doc.fecha,
    planRequired:      'empresa_plus',
    oficioTags:        [],
    organismoEmisor:   'Dirección General de Tributos',
    fechaPublicacion:  doc.fecha,
    fechaDerogacion:   null,
    ambitoTerritorial: 'estatal',
    territorio:        null,
    tipoDocumento:     'consulta_vinculante',
    numeroConsulta:    doc.ref,
  };

  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  ${doc.refClean.padEnd(42)} ║`);
  console.log(`║  ${doc.title.slice(0,42).padEnd(42)} ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);

  // PASO 1: PDF → TXT
  let text;
  if (existsSync(txtPath)) {
    console.log(`📄 TXT existe, cargando: ${baseFile}.txt`);
    text = readFileSync(txtPath, 'utf8');
  } else {
    console.log(`📑 Extrayendo texto de ${doc.pdf}...`);
    const result = await extractPdfToText('DGT', doc.pdf);
    text = result.text;
  }

  // PASO 2: Chunking
  let chunks;
  if (existsSync(chunksPath)) {
    console.log(`💾 Chunks existen, cargando...`);
    chunks = JSON.parse(readFileSync(chunksPath, 'utf8'));
    console.log(`   ${chunks.length} chunks cargados`);
  } else {
    chunks = textToChunks(text, 'DGT', doc.title, doc.refClean, doc.fecha, { naturaleza: 'interpretacion' });

    // Reordenar: secciones CONTESTACIÓN y keywords relevantes primero
    const priority = chunks.filter(c => PRIORITY_KEYWORDS_DGT.test(c.chunk_text));
    const rest     = chunks.filter(c => !PRIORITY_KEYWORDS_DGT.test(c.chunk_text));
    chunks = [...priority, ...rest].map((c, i) => ({ ...c, chunk_index: i }));
    console.log(`   ✅ ${priority.length} chunks prioritarios · ${rest.length} generales`);

    saveChunksToJson(chunks, 'DGT', baseFile, NORMATIVA_BASE);
  }

  // PASO 3: Upload
  const { docId, uploaded, failed } = await uploadChunks(chunksPath, docMeta);
  console.log(`\n   ✅ Subidos: ${uploaded} · Fallidos: ${failed} · Doc ID: ${docId}`);
  return { ref: doc.refClean, uploaded, failed };
}

// Main
const targetRef = process.argv[2]?.toUpperCase() ?? null;
let docs = getDGTDocs();
if (targetRef) {
  docs = docs.filter(d => d.refClean.toUpperCase() === targetRef || d.ref.toUpperCase() === targetRef);
  if (docs.length === 0) {
    console.error(`Consulta no encontrada: ${targetRef}`);
    process.exit(1);
  }
}

console.log(`\n📋 INGESTA FASE DGT — ${docs.length} consulta(s) vinculante(s)\n`);

const results = [];
for (const doc of docs) {
  try {
    const r = await processDoc(doc);
    results.push(r);
  } catch (e) {
    console.error(`❌ Error en ${doc.refClean}: ${e.message}`);
    results.push({ ref: doc.refClean, uploaded: 0, failed: -1, error: e.message });
  }
}

console.log('\n╔══════════════════════════════════════════════╗');
console.log('║           RESUMEN FINAL DGT                  ║');
console.log('╠══════════════════════════════════════════════╣');
let totalChunks = 0;
for (const r of results) {
  const status = r.failed === -1 ? '❌' : r.failed > 0 ? '⚠️' : '✅';
  console.log(`║ ${status} ${r.ref.padEnd(28)} ${String(r.uploaded ?? 0).padStart(5)} chunks ║`);
  totalChunks += r.uploaded ?? 0;
}
console.log('╠══════════════════════════════════════════════╣');
console.log(`║  TOTAL                              ${String(totalChunks).padStart(5)} chunks ║`);
console.log('╚══════════════════════════════════════════════╝');
console.log('\nVerifica con:');
console.log("  SELECT COUNT(*) FROM trade_norm_chunks WHERE category = 'DGT';");
