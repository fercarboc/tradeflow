// Paso 2: Convierte texto plano en chunks JSON con metadata
// Uso: node text-to-chunks.mjs REBT REBT_Reglamento_ITC_BOE.txt
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { NORMATIVA_BASE, TARGET_CHUNK_CHARS, MAX_CHUNK_CHARS, MIN_CHUNK_CHARS } from './config.mjs';

// Patrones de cabecera de sección por tipo de documento
const SECTION_PATTERNS = {
  REBT: [
    /(?:ITC[-\s]?BT[-\s]?\d{2})/gi,
    /INSTRUCCIÓN TÉCNICA COMPLEMENTARIA\s+BT[-\s]?\d{2}/gi,
  ],
  RITE: [
    /\bIT\s+\d+(?:\.\d+){0,2}\b/g,
    /INSTRUCCIÓN TÉCNICA\s+IT\s+\d+/gi,
  ],
  CTE: [
    /^(?:Sección\s+[A-Z]+|[A-Z]{2}[-\s]\w+)\s*\n/gm,
    /^\d+(?:\.\d+)*\s+[A-ZÁÉÍÓÚÜÑ][^\n]{5,}/gm,
  ],
  GAS: [
    /ITC[-\s]?ICG[-\s]?\d{2}/gi,
  ],
  ACS: [
    /^\d+(?:\.\d+)*\s+[A-ZÁÉÍÓÚÜÑ][^\n]{5,}/gm,
  ],
  GUIAS: [
    /^\d+(?:\.\d+)*\s+[A-ZÁÉÍÓÚÜÑ][^\n]{5,}/gm,
  ],
};

// Extrae el identificador de sección de un texto de cabecera
function extractSectionId(text, category) {
  if (category === 'REBT') {
    const m = text.match(/ITC[-\s]?BT[-\s]?(\d{2})/i);
    return m ? `ITC-BT-${m[1].padStart(2,'0')}` : null;
  }
  if (category === 'RITE') {
    const m = text.match(/IT\s+(\d+(?:\.\d+)*)/i);
    return m ? `IT-${m[1]}` : null;
  }
  if (category === 'GAS') {
    const m = text.match(/ITC[-\s]?ICG[-\s]?(\d{2})/i);
    return m ? `ITC-ICG-${m[1].padStart(2,'0')}` : null;
  }
  return null;
}

// Divide un texto largo en sub-chunks por párrafos
function splitByParagraphs(text, maxChars) {
  const paragraphs = text.split(/\n{2,}/);
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    const candidate = current ? current + '\n\n' + para : para;
    if (candidate.length > maxChars && current.length >= MIN_CHUNK_CHARS) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = candidate;
    }
  }
  if (current.trim().length >= MIN_CHUNK_CHARS) chunks.push(current.trim());
  return chunks;
}

export function textToChunks(text, category, documentTitle, boeRef, version) {
  const patterns = SECTION_PATTERNS[category] || SECTION_PATTERNS.GUIAS;
  const chunks   = [];

  // Buscar posiciones de todas las cabeceras de sección
  const sectionBreaks = [{ pos: 0, header: '', sectionId: null }];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let m;
    while ((m = regex.exec(text)) !== null) {
      // Solo si está cerca del inicio de una línea (±50 chars)
      const lineStart = text.lastIndexOf('\n', m.index);
      if (m.index - lineStart < 60) {
        sectionBreaks.push({
          pos:       m.index,
          header:    m[0].trim(),
          sectionId: extractSectionId(m[0], category),
        });
      }
    }
  }

  // Ordenar por posición
  sectionBreaks.sort((a, b) => a.pos - b.pos);
  // Deduplicar posiciones muy cercanas (<50 chars)
  const deduped = sectionBreaks.filter((b, i) =>
    i === 0 || b.pos - sectionBreaks[i-1].pos > 50
  );

  let chunkIndex = 0;

  for (let i = 0; i < deduped.length; i++) {
    const start = deduped[i].pos;
    const end   = i + 1 < deduped.length ? deduped[i+1].pos : text.length;
    const sectionText = text.slice(start, end).trim();

    if (sectionText.length < MIN_CHUNK_CHARS) continue;

    // Si el fragmento cabe en un solo chunk, usarlo directamente
    if (sectionText.length <= MAX_CHUNK_CHARS) {
      chunks.push({
        chunk_index:   chunkIndex++,
        chunk_id:      `${category}-${deduped[i].sectionId || 'SEC-' + String(i).padStart(3,'0')}`,
        article_id:    deduped[i].sectionId || null,
        article_title: deduped[i].header || null,
        section:       null,
        section_title: null,
        chunk_text:    sectionText,
        token_count:   Math.round(sectionText.length / 4),
        keywords:      [],
        category,
        document_title: documentTitle,
        boe_ref:        boeRef,
        version,
      });
    } else {
      // Dividir por párrafos
      const subChunks = splitByParagraphs(sectionText, TARGET_CHUNK_CHARS);
      for (let j = 0; j < subChunks.length; j++) {
        const sc = subChunks[j];
        chunks.push({
          chunk_index:   chunkIndex++,
          chunk_id:      `${category}-${deduped[i].sectionId || 'SEC-' + String(i).padStart(3,'0')}-${j+1}`,
          article_id:    deduped[i].sectionId || null,
          article_title: deduped[i].header || null,
          section:       `${j+1}`,
          section_title: null,
          chunk_text:    sc,
          token_count:   Math.round(sc.length / 4),
          keywords:      [],
          category,
          document_title: documentTitle,
          boe_ref:        boeRef,
          version,
        });
      }
    }
  }

  console.log(`✂️  Generados ${chunks.length} chunks para ${category}`);
  return chunks;
}

export function saveChunksToJson(chunks, category, baseFilename, normativaBase) {
  // Un JSON por chunk para inspección
  const metaPath = join(normativaBase, category, 'METADATA', `${baseFilename}_index.json`);
  const meta = chunks.map(c => ({
    chunk_id: c.chunk_id,
    article_id: c.article_id,
    article_title: c.article_title,
    token_count: c.token_count,
  }));
  writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  console.log(`📋 Índice guardado: ${metaPath}`);

  // Un JSON con todos los chunks
  const chunksPath = join(normativaBase, category, 'CHUNKS', `${baseFilename}_chunks.json`);
  writeFileSync(chunksPath, JSON.stringify(chunks, null, 2), 'utf8');
  console.log(`💾 Chunks guardados: ${chunksPath} (${chunks.length} chunks)`);
  return chunksPath;
}

// CLI directo: node text-to-chunks.mjs <CATEGORIA> <archivo.txt>
if (process.argv[1].endsWith('text-to-chunks.mjs')) {
  const [,, category, txtFile] = process.argv;
  if (!category || !txtFile) {
    console.error('Uso: node text-to-chunks.mjs <CATEGORIA> <archivo.txt>');
    process.exit(1);
  }
  const fichaPath = join(NORMATIVA_BASE, category, 'ficha_fuente.txt');
  const fichaText = existsSync(fichaPath) ? readFileSync(fichaPath, 'utf8') : '';
  const titleMatch = fichaText.match(/Título:\s*(.+)/);
  const boeMatch   = fichaText.match(/(?:ID BOE|Código BOE):\s*(.+)/);
  const verMatch   = fichaText.match(/version:\s*(.+)/i);

  const txtPath = join(NORMATIVA_BASE, category, 'TXT', txtFile);
  const text    = readFileSync(txtPath, 'utf8');
  const chunks  = textToChunks(
    text,
    category,
    titleMatch?.[1]?.trim() || category,
    boeMatch?.[1]?.trim() || '',
    verMatch?.[1]?.trim() || new Date().toISOString().slice(0,10)
  );
  const base = txtFile.replace(/\.txt$/, '');
  saveChunksToJson(chunks, category, base, NORMATIVA_BASE);
}
