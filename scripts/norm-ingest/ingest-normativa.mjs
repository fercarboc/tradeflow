// Orquestador principal: PDF → TXT → Chunks → Embeddings → Supabase
// Uso: node ingest-normativa.mjs <CATEGORIA> <archivo.pdf> [plan_required]
// Ej:  node ingest-normativa.mjs REBT REBT_Reglamento_ITC_BOE.pdf basico
// Ej:  node ingest-normativa.mjs RITE BOE-A-2007-15820-consolidado.pdf empresa
// Ej:  node ingest-normativa.mjs CTE DB_HE_Ahorro_Energia.pdf empresa_plus

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { NORMATIVA_BASE } from './config.mjs';
import { extractPdfToText } from './pdf-to-text.mjs';
import { textToChunks, saveChunksToJson } from './text-to-chunks.mjs';
import { uploadChunks } from './upload-chunks.mjs';

const [,, category, pdfFile, planRequired = 'basico'] = process.argv;

if (!category || !pdfFile) {
  console.error('');
  console.error('Uso: node ingest-normativa.mjs <CATEGORIA> <archivo.pdf> [plan]');
  console.error('');
  console.error('Categorías disponibles: REBT, RITE, CTE, GAS, ACS, GUIAS');
  console.error('Planes:                 basico, empresa, empresa_plus');
  console.error('');
  console.error('Ejemplos:');
  console.error('  node ingest-normativa.mjs REBT REBT_Reglamento_ITC_BOE.pdf basico');
  console.error('  node ingest-normativa.mjs RITE BOE-A-2007-15820-consolidado.pdf empresa');
  console.error('  node ingest-normativa.mjs CTE  DB_HE_Ahorro_Energia.pdf empresa_plus');
  process.exit(1);
}

if (!['basico','profesional','empresa','empresa_plus'].includes(planRequired)) {
  console.error(`Plan inválido: ${planRequired}. Usa: basico, profesional, empresa, empresa_plus`);
  process.exit(1);
}

const VALID_CATEGORIES = ['REBT','RITE','CTE','GAS','ACS','GUIAS','OFICIOS','SOCIAL','AEAT','DGT','CONVENIOS','CIRCULARES'];
if (!VALID_CATEGORIES.includes(category)) {
  console.error(`Categoría inválida: ${category}`);
  console.error(`Válidas: ${VALID_CATEGORIES.join(', ')}`);
  process.exit(1);
}

// Leer ficha_fuente.txt para metadata
const fichaPath = join(NORMATIVA_BASE, category, 'ficha_fuente.txt');
if (!existsSync(fichaPath)) {
  console.error(`No existe ficha_fuente.txt en ${category}/`);
  process.exit(1);
}
const ficha = readFileSync(fichaPath, 'utf8');
const get   = (key) => { const m = ficha.match(new RegExp(`${key}:\\s*(.+)`,'i')); return m?.[1]?.trim() || ''; };

const docMeta = {
  category,
  title:              get('Título') || category,
  boeRef:             get('ID BOE') || get('Código BOE') || '',
  version:            get('Norma base') || get('Versión') || new Date().toISOString().slice(0,10),
  planRequired,
  oficioTags:         [],
  // Campos extendidos Asistente Integral
  organismoEmisor:    get('Organismo') || 'BOE',
  fechaPublicacion:   get('Fecha publicación') || null,
  fechaDerogacion:    get('Fecha derogación') || null,
  ambitoTerritorial:  get('Ámbito territorial') || 'estatal',
  territorio:         get('Territorio') || null,
  tipoDocumento:      get('Tipo documento') || 'reglamento',
  numeroConsulta:     get('Número consulta') || null,
};

console.log(`\n════════════════════════════════════════`);
console.log(`  INGESTA: ${category} — ${pdfFile}`);
console.log(`  Título:  ${docMeta.title}`);
console.log(`  Plan:    ${planRequired}`);
console.log(`════════════════════════════════════════\n`);

// PASO 1: PDF → TXT
const txtFile = pdfFile.replace(/\.pdf$/i, '.txt');
const txtPath = join(NORMATIVA_BASE, category, 'TXT', txtFile);

let text;
if (existsSync(txtPath)) {
  console.log(`📄 TXT ya existe, saltando extracción PDF: ${txtFile}`);
  text = readFileSync(txtPath, 'utf8');
} else {
  const result = await extractPdfToText(category, pdfFile);
  text = result.text;
}

// PASO 2: TXT → Chunks JSON
const baseFilename = txtFile.replace(/\.txt$/, '');
const chunksPath = join(NORMATIVA_BASE, category, 'CHUNKS', `${baseFilename}_chunks.json`);

let chunks;
if (existsSync(chunksPath)) {
  console.log(`💾 Chunks ya existen, saltando chunking: ${baseFilename}_chunks.json`);
  chunks = JSON.parse(readFileSync(chunksPath, 'utf8'));
  console.log(`   ${chunks.length} chunks cargados`);
} else {
  chunks = textToChunks(text, category, docMeta.title, docMeta.boeRef, docMeta.version, {});
  saveChunksToJson(chunks, category, baseFilename, NORMATIVA_BASE);
}

// PASO 3: Embeddings → Supabase
const { docId, uploaded, failed } = await uploadChunks(chunksPath, docMeta);

console.log(`\n════════════════════════════════════════`);
console.log(`  ✅ COMPLETADO: ${category}`);
console.log(`  Documento ID: ${docId}`);
console.log(`  Chunks subidos: ${uploaded}`);
if (failed > 0) console.log(`  ⚠️  Fallidos: ${failed}`);
console.log(`════════════════════════════════════════\n`);
