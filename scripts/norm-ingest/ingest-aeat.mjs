// Ingesta especializada para documentos AEAT (IVA, IRPF, etc.)
// Uso: node ingest-aeat.mjs <archivo.pdf> [plan]
// Ej:  node ingest-aeat.mjs Manual_IVA_2025.pdf profesional
// Ej:  node ingest-aeat.mjs ManualRenta2025Parte1_es_es.pdf profesional
//
// Los capítulos prioritarios para instaladores según propuesta técnica:
//   1. Tipos impositivos (10%, 21%)   2. Hecho imponible y exenciones
//   3. Sujetos pasivos                4. Deducciones y devoluciones
//   5. Obligaciones de facturación    6. Libros registro IVA
//   7. Regímenes especiales           8. Fiscalidad de PYMES

import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { NORMATIVA_BASE } from './config.mjs';
import { extractPdfToText } from './pdf-to-text.mjs';
import { textToChunks, saveChunksToJson } from './text-to-chunks.mjs';
import { uploadChunks } from './upload-chunks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const [,, pdfFile, planRequired = 'profesional'] = process.argv;

if (!pdfFile) {
  console.error('');
  console.error('Uso: node ingest-aeat.mjs <archivo.pdf> [plan]');
  console.error('');
  console.error('Archivos disponibles en docs/Normativa/AEAT/PDF/:');
  console.error('  Manual_IVA_2025.pdf');
  console.error('  ManualRenta2025Parte1_es_es.pdf');
  console.error('');
  console.error('Planes: profesional (default), empresa, empresa_plus');
  process.exit(1);
}

const CATEGORY = 'AEAT';
const aeatBase = join(NORMATIVA_BASE, CATEGORY);

// Asegurar que existen las carpetas necesarias
for (const sub of ['TXT', 'CHUNKS', 'METADATA']) {
  const p = join(aeatBase, sub);
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

// Leer ficha_fuente.txt
const fichaPath = join(aeatBase, 'ficha_fuente.txt');
if (!existsSync(fichaPath)) {
  console.error(`No existe ficha_fuente.txt en docs/Normativa/${CATEGORY}/`);
  process.exit(1);
}
const ficha = readFileSync(fichaPath, 'utf8');
const get = (key) => { const m = ficha.match(new RegExp(`^${key}:\\s*(.+)`, 'im')); return m?.[1]?.trim() || ''; };

const docMeta = {
  category:           CATEGORY,
  title:              get('Título'),
  boeRef:             '',
  version:            get('Versión') || get('Fecha publicación'),
  planRequired,
  oficioTags:         [],
  // Campos extendidos Asistente Integral
  organismoEmisor:    get('Organismo'),
  fechaPublicacion:   get('Fecha publicación') || null,
  fechaDerogacion:    get('Fecha derogación') || null,
  ambitoTerritorial:  get('Ámbito territorial') || 'estatal',
  territorio:         get('Territorio') || null,
  tipoDocumento:      get('Tipo documento') || 'manual',
  numeroConsulta:     null,
};

console.log(`\n════════════════════════════════════════════`);
console.log(`  INGESTA AEAT: ${pdfFile}`);
console.log(`  Título:       ${docMeta.title}`);
console.log(`  Organismo:    ${docMeta.organismoEmisor}`);
console.log(`  Fecha:        ${docMeta.fechaPublicacion}`);
console.log(`  Plan mínimo:  ${planRequired}`);
console.log(`════════════════════════════════════════════\n`);

// PASO 1: PDF → TXT
const txtFile = pdfFile.replace(/\.pdf$/i, '.txt');
const txtPath = join(aeatBase, 'TXT', txtFile);
const chunksJsonName = txtFile.replace(/\.txt$/, '') + '_chunks.json';
const chunksPath = join(aeatBase, 'CHUNKS', chunksJsonName);

let text;
if (existsSync(txtPath)) {
  console.log(`📄 TXT ya existe, saltando extracción: ${txtFile}`);
  text = readFileSync(txtPath, 'utf8');
} else {
  console.log(`📑 Extrayendo texto de ${pdfFile}...`);
  const result = await extractPdfToText(CATEGORY, pdfFile);
  text = result.text;
}

// PASO 2: TXT → Chunks con filtro de capítulos prioritarios
let chunks;
if (existsSync(chunksPath)) {
  console.log(`💾 Chunks ya existen, saltando chunking: ${chunksJsonName}`);
  chunks = JSON.parse(readFileSync(chunksPath, 'utf8'));
  console.log(`   ${chunks.length} chunks cargados`);
} else {
  console.log(`✂️  Chunkeando por capítulos y artículos...`);
  chunks = textToChunks(
    text,
    CATEGORY,
    docMeta.title,
    docMeta.boeRef,
    docMeta.version,
    { naturaleza: 'obligacion_legal' }
  );

  // Filtro de capítulos prioritarios para instaladores
  const PRIORITY_CAPS = /tipos?\s+impositivo|hecho\s+imponible|exenci[oó]n|sujeto\s+pasivo|inversi[oó]n|deducci[oó]n|devoluci[oó]n|facturaci[oó]n|libros?\s+registro|r[eé]gimen\s+especial|pyme|aut[oó]nomo|reforma|construcci[oó]n|rehabi|vivienda|obra/i;

  const priorityChunks  = chunks.filter(c => PRIORITY_CAPS.test(c.chunk_text));
  const remainingChunks = chunks.filter(c => !PRIORITY_CAPS.test(c.chunk_text));

  // Reordenar: prioritarios primero, con nuevo chunk_index
  const ordered = [...priorityChunks, ...remainingChunks].map((c, i) => ({ ...c, chunk_index: i }));

  console.log(`   ✅ ${priorityChunks.length} chunks prioritarios para instaladores`);
  console.log(`   📄 ${remainingChunks.length} chunks generales`);
  console.log(`   📦 Total: ${ordered.length} chunks`);

  chunks = ordered;
  saveChunksToJson(chunks, CATEGORY, txtFile.replace(/\.txt$/, ''), NORMATIVA_BASE);
}

// PASO 3: Embeddings → Supabase
const { docId, uploaded, failed } = await uploadChunks(chunksPath, docMeta);

console.log(`\n════════════════════════════════════════════`);
console.log(`  ✅ COMPLETADO: ${CATEGORY}`);
console.log(`  Documento ID: ${docId}`);
console.log(`  Chunks subidos: ${uploaded}`);
if (failed > 0) console.log(`  ⚠️  Fallidos: ${failed}`);
console.log(`\n  Para verificar:`);
console.log(`  SELECT COUNT(*), category FROM trade_norm_chunks WHERE category='AEAT' GROUP BY category;`);
console.log(`════════════════════════════════════════════\n`);
