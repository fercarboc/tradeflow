// Paso 1: Extrae texto de un PDF y lo guarda en la carpeta TXT
// Uso: node pdf-to-text.mjs REBT REBT_Reglamento_ITC_BOE.pdf
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';
import { NORMATIVA_BASE } from './config.mjs';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export async function extractPdfToText(category, pdfFilename) {
  const pdfPath = join(NORMATIVA_BASE, category, 'PDF', pdfFilename);
  const txtFilename = pdfFilename.replace(/\.pdf$/i, '.txt');
  const txtPath = join(NORMATIVA_BASE, category, 'TXT', txtFilename);

  if (!existsSync(pdfPath)) throw new Error(`PDF no encontrado: ${pdfPath}`);

  console.log(`📄 Extrayendo texto de ${pdfFilename}...`);
  const buffer = readFileSync(pdfPath);
  const data   = await pdfParse(buffer);

  const text = data.text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')          // normalizar espacios
    .replace(/\n{4,}/g, '\n\n\n')     // máx 3 saltos consecutivos
    .trim();

  writeFileSync(txtPath, text, 'utf8');
  console.log(`✅ Guardado: ${txtPath}`);
  console.log(`   ${data.numpages} páginas · ${text.length.toLocaleString()} caracteres`);
  return { text, pages: data.numpages, txtPath };
}

// CLI directo: node pdf-to-text.mjs <CATEGORIA> <archivo.pdf>
if (process.argv[1].endsWith('pdf-to-text.mjs')) {
  const [,, category, pdfFile] = process.argv;
  if (!category || !pdfFile) {
    console.error('Uso: node pdf-to-text.mjs <CATEGORIA> <archivo.pdf>');
    console.error('Ej:  node pdf-to-text.mjs REBT REBT_Reglamento_ITC_BOE.pdf');
    process.exit(1);
  }
  await extractPdfToText(category, pdfFile);
}
