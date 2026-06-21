// Orquestador maestro para toda la Fase AEAT
// Uso: node ingest-aeat-all.mjs [categoria]
// Ej:  node ingest-aeat-all.mjs              → procesa todo
// Ej:  node ingest-aeat-all.mjs AEAT_IVA     → solo IVA
// Ej:  node ingest-aeat-all.mjs AEAT_VERIFACTU
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

// ── Catálogo de documentos AEAT ───────────────────────────────────────────────
const AEAT_DOCS = [
  {
    category:         'AEAT_IVA',
    pdf:              'Manual_IVA_2025.pdf',
    plan:             'profesional',
    organismoEmisor:  'Agencia Tributaria',
    fechaPublicacion: '2025-10-02',
    tipoDocumento:    'manual',
    naturaleza:       'obligacion_legal',
    prioridad:        1,
  },
  {
    category:         'AEAT_RENTA',
    pdf:              'ManualRenta2025Parte1_es_es.pdf',
    plan:             'profesional',
    organismoEmisor:  'Agencia Tributaria',
    fechaPublicacion: '2025-04-01',
    tipoDocumento:    'manual',
    naturaleza:       'obligacion_legal',
    prioridad:        2,
  },
  {
    category:         'AEAT_RENTA_CCAA',
    pdf:              'ManualRenta2025Parte2_es_es.pdf',
    plan:             'empresa',
    organismoEmisor:  'Agencia Tributaria',
    fechaPublicacion: '2025-04-01',
    tipoDocumento:    'manual',
    naturaleza:       'obligacion_legal',
    ambitoTerritorial:'autonomico',
    prioridad:        3,
    esCCAA:           true,   // Tratamiento especial: extraer comunidades
  },
  {
    category:         'AEAT_FACTURACION',
    pdf:              'manual_facturacion_2011_es_es.pdf',
    plan:             'basico',
    organismoEmisor:  'Agencia Tributaria',
    fechaPublicacion: '2012-11-30',
    tipoDocumento:    'reglamento',
    naturaleza:       'obligacion_legal',
    prioridad:        4,
  },
  {
    category:         'AEAT_VERIFACTU',
    pdf:              'Manual_Usuario_Verifactu_Accesible.pdf',
    plan:             'basico',
    organismoEmisor:  'Agencia Tributaria',
    fechaPublicacion: '2024-12-05',
    tipoDocumento:    'reglamento',
    naturaleza:       'obligacion_legal',
    prioridad:        5,
  },
  {
    category:         'AEAT_PATRIMONIO',
    pdf:              'ManualPatrimonio2025_es_es.pdf',
    plan:             'empresa_plus',
    organismoEmisor:  'Agencia Tributaria',
    fechaPublicacion: '2025-04-01',
    tipoDocumento:    'manual',
    naturaleza:       'obligacion_legal',
    prioridad:        6,
  },
  {
    category:         'AEAT_SOCIEDADES',
    pdf:              'Manual_Sociedades_2025.pdf',
    plan:             'empresa',
    organismoEmisor:  'Agencia Tributaria',
    fechaPublicacion: '2025-04-01',
    tipoDocumento:    'manual',
    naturaleza:       'obligacion_legal',
    prioridad:        7,
  },
];

// ── Mapeo de nombres de CCAA en el PDF → valor canónico ──────────────────────
const CCAA_HEADERS = [
  { pattern: /COMUNIDAD\s+AUT[OÓ]NOMA\s+DE\s+ANDALUC[IÍ]A/i,           name: 'Andalucía' },
  { pattern: /COMUNIDAD\s+AUT[OÓ]NOMA\s+DE\s+ARAG[OÓ]N/i,             name: 'Aragón' },
  { pattern: /PRINCIPADO\s+DE\s+ASTURIAS/i,                             name: 'Asturias' },
  { pattern: /(?:ILLES?\s+BALEARS?|ISLAS?\s+BALEARES?)/i,              name: 'Baleares' },
  { pattern: /(?:ISLAS?\s+CANARIAS?|CANARIAS?)/i,                       name: 'Canarias' },
  { pattern: /COMUNIDAD\s+AUT[OÓ]NOMA\s+DE\s+CANTABRIA/i,             name: 'Cantabria' },
  { pattern: /CASTILLA[\s-]LA\s+MANCHA/i,                               name: 'Castilla-La Mancha' },
  { pattern: /CASTILLA\s+Y\s+LE[OÓ]N/i,                                name: 'Castilla y León' },
  { pattern: /CATALU[NÑ]A|CATALUNYA/i,                                  name: 'Cataluña' },
  { pattern: /EXTREMADURA/i,                                             name: 'Extremadura' },
  { pattern: /GALICIA/i,                                                 name: 'Galicia' },
  { pattern: /COMUNIDAD\s+DE\s+MADRID/i,                                name: 'Madrid' },
  { pattern: /REGI[OÓ]N\s+DE\s+MURCIA/i,                              name: 'Murcia' },
  { pattern: /LA\s+RIOJA/i,                                             name: 'La Rioja' },
  { pattern: /COMUNITAT\s+VALENCIANA|COMUNIDAD\s+VALENCIANA/i,          name: 'Comunitat Valenciana' },
  { pattern: /PA[IÍ]S\s+VASCO|EUSKADI/i,                              name: 'País Vasco' },
  { pattern: /COMUNIDAD\s+FORAL\s+DE\s+NAVARRA|NAVARRA/i,             name: 'Navarra' },
  { pattern: /CIUDAD\s+AUT[OÓ]NOMA\s+DE\s+CEUTA/i,                   name: 'Ceuta' },
  { pattern: /CIUDAD\s+AUT[OÓ]NOMA\s+DE\s+MELILLA/i,                 name: 'Melilla' },
];

// ── Extrae CCAA de un texto de cabecera ──────────────────────────────────────
function detectCCAA(text) {
  for (const { pattern, name } of CCAA_HEADERS) {
    if (pattern.test(text)) return name;
  }
  return null;
}

// ── Chunker especializado RENTA CCAA ─────────────────────────────────────────
function chunkCCAADocument(text, meta) {
  const chunks = [];
  let chunkIndex = 0;
  let currentCCAA = null;

  // Dividir el texto en secciones por CCAA
  // Las CCAA aparecen como cabeceras en mayúsculas al inicio de sección
  const lines = text.split('\n');
  let currentSection = [];
  let sectionStart = 0;

  const flush = (nextCCAA, nextPos) => {
    if (currentSection.length === 0) return;
    const sectionText = currentSection.join('\n').trim();
    if (sectionText.length < 200 || !currentCCAA) { currentSection = []; return; }

    // Sub-chunking por párrafos si la sección es muy larga
    const maxChunkChars = 2800;
    const paragraphs = sectionText.split(/\n{2,}/);
    let buffer = '';
    let subIdx = 0;

    const pushChunk = (txt, sub) => {
      if (txt.trim().length < 100) return;
      const chunkId = `AEAT_RENTA_CCAA-${currentCCAA.replace(/\s+/g,'-')}-${String(chunkIndex).padStart(3,'0')}${sub > 0 ? `-${sub}` : ''}`;
      chunks.push({
        chunk_index:      chunkIndex++,
        chunk_id:         chunkId,
        article_id:       `CCAA-${currentCCAA.replace(/\s+/g,'-')}`,
        article_title:    `Deducciones autonómicas — ${currentCCAA}`,
        section:          sub > 0 ? String(sub) : null,
        section_title:    null,
        chunk_text:       txt.trim(),
        token_count:      Math.round(txt.length / 4),
        keywords:         [currentCCAA],
        comunidad_autonoma: currentCCAA,
        naturaleza:       'obligacion_legal',
        category:         meta.category,
        document_title:   meta.title,
        boe_ref:          meta.boeRef || '',
        version:          meta.version,
      });
    };

    for (const para of paragraphs) {
      const candidate = buffer ? buffer + '\n\n' + para : para;
      if (candidate.length > maxChunkChars && buffer.length > 200) {
        pushChunk(buffer, subIdx++);
        buffer = para;
      } else {
        buffer = candidate;
      }
    }
    if (buffer.trim().length > 100) pushChunk(buffer, subIdx);
    currentSection = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ccaa = detectCCAA(line);
    if (ccaa) {
      flush(ccaa, i);
      currentCCAA = ccaa;
    }
    currentSection.push(line);
  }
  flush(null, lines.length);

  console.log(`✂️  CCAA detectadas: ${[...new Set(chunks.map(c => c.comunidad_autonoma))].join(', ')}`);
  console.log(`✂️  Generados ${chunks.length} chunks para AEAT_RENTA_CCAA`);
  return chunks;
}

// ── Palabras clave prioritarias para instaladores en IVA/Renta ───────────────
const PRIORITY_KEYWORDS = /tipos?\s+impositivo|10\s*%|iva\s+reducido|hecho\s+imponible|exenci[oó]n|sujeto\s+pasivo|inversi[oó]n|deduci|devoluci[oó]n|facturaci[oó]n|verifactu|rectificativa|vivienda|rehabilitaci[oó]n|renovaci[oó]n|obra\s+nueva|instalaci[oó]n|aerotermia|fotovoltaic|eficiencia\s+energ[eé]tica|gasto\s+deducible|amortizaci[oó]n|autónomo|reta|actividad\s+econ[oó]mica|estimaci[oó]n\s+directa|pyme|sociedad\s+limitada/i;

// ── Procesar un documento ─────────────────────────────────────────────────────
async function processDoc(doc) {
  const catBase = join(NORMATIVA_BASE, doc.category);

  // Asegurar carpetas
  for (const sub of ['PDF', 'TXT', 'CHUNKS', 'METADATA']) {
    const p = join(catBase, sub);
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  }

  // Leer ficha
  const fichaPath = join(catBase, 'ficha_fuente.txt');
  const ficha = existsSync(fichaPath) ? readFileSync(fichaPath, 'utf8') : '';
  const get = (k) => { const m = ficha.match(new RegExp(`^${k}:\\s*(.+)`, 'im')); return m?.[1]?.trim() || ''; };

  const title   = get('Título') || doc.category;
  const version = get('Versión') || doc.fechaPublicacion;

  const docMeta = {
    category:           doc.category,
    title,
    boeRef:             '',
    version,
    planRequired:       doc.plan,
    oficioTags:         [],
    organismoEmisor:    doc.organismoEmisor,
    fechaPublicacion:   doc.fechaPublicacion,
    fechaDerogacion:    null,
    ambitoTerritorial:  doc.ambitoTerritorial || 'estatal',
    territorio:         null,
    tipoDocumento:      doc.tipoDocumento,
    numeroConsulta:     null,
  };

  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  ${doc.category.padEnd(42)} ║`);
  console.log(`║  ${title.slice(0,42).padEnd(42)} ║`);
  console.log(`║  Plan: ${doc.plan.padEnd(38)} ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);

  // PASO 1: PDF → TXT
  const baseFilename = doc.pdf.replace(/\.pdf$/i, '');
  const txtPath      = join(catBase, 'TXT', `${baseFilename}.txt`);
  const chunksPath   = join(catBase, 'CHUNKS', `${baseFilename}_chunks.json`);

  let text;
  if (existsSync(txtPath)) {
    console.log(`📄 TXT existe, cargando: ${baseFilename}.txt`);
    text = readFileSync(txtPath, 'utf8');
  } else {
    console.log(`📑 Extrayendo texto de ${doc.pdf}...`);
    const result = await extractPdfToText(doc.category, doc.pdf);
    text = result.text;
  }

  // PASO 2: Chunking
  let chunks;
  if (existsSync(chunksPath)) {
    console.log(`💾 Chunks existen, cargando...`);
    chunks = JSON.parse(readFileSync(chunksPath, 'utf8'));
    console.log(`   ${chunks.length} chunks cargados`);
  } else {
    if (doc.esCCAA) {
      // Chunking especializado por CCAA
      chunks = chunkCCAADocument(text, { category: doc.category, title, boeRef: '', version });
    } else {
      // Chunking estándar
      chunks = textToChunks(text, doc.category, title, '', version, { naturaleza: doc.naturaleza });

      // Reordenar: chunks prioritarios para instaladores primero
      const priority = chunks.filter(c => PRIORITY_KEYWORDS.test(c.chunk_text));
      const rest     = chunks.filter(c => !PRIORITY_KEYWORDS.test(c.chunk_text));
      chunks = [...priority, ...rest].map((c, i) => ({ ...c, chunk_index: i }));
      console.log(`   ✅ ${priority.length} chunks prioritarios · ${rest.length} generales`);
    }

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
  ? AEAT_DOCS.filter(d => d.category === targetCategory)
  : AEAT_DOCS.sort((a, b) => a.prioridad - b.prioridad);

if (docs.length === 0) {
  console.error(`Categoría no encontrada: ${targetCategory}`);
  console.error(`Disponibles: ${AEAT_DOCS.map(d => d.category).join(', ')}`);
  process.exit(1);
}

console.log(`\n🚀 INGESTA FASE AEAT — ${docs.length} documento(s)\n`);

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
console.log('║              RESUMEN FINAL AEAT              ║');
console.log('╠══════════════════════════════════════════════╣');
for (const r of results) {
  const status = r.failed === -1 ? '❌' : r.failed > 0 ? '⚠️' : '✅';
  console.log(`║ ${status} ${r.category.padEnd(22)} ${String(r.uploaded).padStart(5)} chunks ║`);
}
console.log('╚══════════════════════════════════════════════╝');
console.log('\nVerifica con:');
console.log("  SELECT category, COUNT(*) FROM trade_norm_chunks WHERE category LIKE 'AEAT%' GROUP BY category ORDER BY category;");
