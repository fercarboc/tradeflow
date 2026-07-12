/**
 * TrabFlow — Importación Documental Corporativa
 * Escanea docs/, sube a Storage, crea registros en trade_documents,
 * vincula con entidades CRM. Idempotente: dedup por hash de archivo.
 *
 * Uso: npm run import-docs
 *      (o directamente: tsx scripts/import-corp-docs.ts)
 */

// Polyfill WebSocket for Node 20 (Supabase realtime requires it at init time)
if (!globalThis.WebSocket) {
  // @ts-ignore — only needed to satisfy Supabase init; realtime is unused in this script
  globalThis.WebSocket = class WebSocket { constructor() {} close() {} send() {} };
}

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

// ── Env ────────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Leer .env manualmente (sin dotenv, para evitar deps extra)
const envPath = path.join(ROOT, '.env');
const envVars: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) envVars[k.trim()] = v.join('=').trim();
  });
}

const SUPABASE_URL     = envVars['VITE_SUPABASE_URL']       || process.env['VITE_SUPABASE_URL'] || '';
const SERVICE_ROLE_KEY = envVars['SUPABASE_SERVICE_ROLE_KEY']|| process.env['SUPABASE_SERVICE_ROLE_KEY'] || '';
const BUCKET           = 'corporate-documents';
const DOCS_ROOT        = path.join(ROOT, 'docs');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { params: { eventsPerSecond: 0 } },
  global: { fetch },
});

// ── Constantes ─────────────────────────────────────────────────────────────

const CATEGORIAS: Record<string, { folder: string; label: string }> = {
  '00': { folder: '00-maestra',            label: 'Documentación Maestra' },
  '01': { folder: '01-empresa',             label: 'Empresa e Identidad' },
  '02': { folder: '02-inversores',          label: 'Inversores' },
  '03': { folder: '03-subvenciones',        label: 'Subvenciones' },
  '04': { folder: '04-partners-mayoristas', label: 'Partners & Mayoristas' },
  '05': { folder: '05-clientes-target',     label: 'Clientes Target' },
  '06': { folder: '06-asociaciones',        label: 'Asociaciones' },
  '07': { folder: '07-producto',            label: 'Producto' },
  '08': { folder: '08-tecnica',             label: 'Técnica & Arquitectura' },
  '09': { folder: '09-operaciones',         label: 'Operaciones' },
  '10': { folder: '10-marketing',           label: 'Marketing & Marca' },
  '11': { folder: '11-legal',              label: 'Legal' },
  '12': { folder: '12-admin-fiscal',        label: 'Admin & Fiscal' },
};

const ENTITY_KEYWORDS = [
  { keywords: ['conaif'],                         externalKey: 'ASOC-CONAIF' },
  { keywords: ['fenie'],                          externalKey: 'ASOC-FENIE' },
  { keywords: ['cni'],                            externalKey: 'ASOC-CNI' },
  { keywords: ['agremia'],                        externalKey: 'ASOC-AGREMIA' },
  { keywords: ['saltoki'],                        externalKey: 'PART-SALTOKI' },
  { keywords: ['salvador_escoda','salvadorescoda'],externalKey: 'PART-SALVADOR-ESCODA' },
  { keywords: ['sonepar'],                        externalKey: 'PART-SONEPAR-ES' },
  { keywords: ['obramat'],                        externalKey: 'PART-OBRAMAT' },
];

const MIME: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc':  'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls':  'application/vnd.ms-excel',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt':  'application/vnd.ms-powerpoint',
  '.txt':  'text/plain',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.zip':  'application/zip',
  '.html': 'text/html',
  '.md':   'text/markdown',
  '.csv':  'text/csv',
};

// Archivos a omitir siempre
const SKIP: RegExp[] = [
  /^\.~lock\./i,         // LibreOffice lock files
  /^~\$/,               // Word temp files
  /\.~lock\./i,
  /\/CHUNKS\//,          // RAG chunks
  /\/METADATA\//,        // RAG metadata
  /ficha_fuente\.txt$/i, // metadata files
  /castillo/i,           // personal (planos castillo)
  /sigpac/i,             // personal
  /paln de accion/i,     // typo file
  /TradeFlow_CRM_Entidades_Importacion_Inicial/i, // nuestro propio CSV
];

// ── Helpers ────────────────────────────────────────────────────────────────

function determineCategory(relPath: string, fileName: string): string {
  const n = fileName.toLowerCase().replace(/\s+/g, '_');
  const p = relPath.toLowerCase().replace(/\\/g, '/');

  // Folder hints (más fiables)
  if (p.includes('/inversores/'))              return '02';
  if (p.match(/\/sistema[\s_]documental\//))   return '00';
  if (p.includes('/oficios/'))                 return '07';
  if (p.includes('/presupuestos/'))            return '07';
  if (p.includes('/instaladores/'))            return '05';
  if (p.includes('/normativa/aeat'))           return '12';
  if (p.includes('/normativa/'))               return '08';
  if (p.includes('/sociedad/')) {
    if (/c-nc|d6997|fac\./.test(n))            return '12';
    return '01';
  }
  if (p.includes('/memoria/'))                 return '03';
  if (p.match(/\/documentacion[\s_]presentacion/)) {
    if (/01_vision|empresa/.test(n))           return '01';
    if (/02_business|pitch|programa_fundadores|presentacion_ejecutiva|ficha_resumen/.test(n)) return '02';
    if (/03_producto/.test(n))                 return '07';
    if (/04_arquitectura|06_base|07_base_de_datos|05_inteligencia/.test(n)) return '08';
    if (/gremial/.test(n))                     return '06';
    if (/sodercan/.test(n))                    return '03';
    if (/comercial|instalador/.test(n))        return '05';
    return '07';
  }

  // Keyword matching por nombre de archivo
  if (/sistema_documental|crm_entidades/.test(n))                         return '00';
  if (/estatutos|constitucion|nombre_aplicacion|plan_constitucion|trabflow_technologies_sl/.test(n)) return '01';
  if (/inversores|pitch_deck|strategic_partner|business_plan|programa_fundadores|presentacion_ejecutiva|ficha_resumen|one_pager|para_inversores|financial_model/.test(n)) return '02';
  if (/sodercan|enisa|cdti|kit_digital|ayudas|dossier_ejecutivo.*sodercan|plan_negocio_explotacion|plan_validacion_tecnologica|memoria_sodercan/.test(n)) return '03';
  if (/obramat|saltoki|sonepar|salvador_escoda|dossier_tecnico|propuesta_ejecutiva/.test(n)) return '04';
  if (/dossier_comercial|demos/.test(n))       return '05';
  if (/conaif|fenie|cni_instaladores|agremia|gremial/.test(n))            return '06';
  if (/03_producto|modulo_ia|motor_ia|spec_pruebas|plantilla_presupuesto|05_inteligencia|sistema_operativo_impulsado/.test(n)) return '07';
  if (/auditoria|documentacion_tecnica|04_arquitectura|06_base|07_base_de_datos|sistema_validacion|analisis_facturacion|analisis_completo|contratos_mantenimiento|trabflow_arquitectura/.test(n)) return '08';
  if (/plan_operativo|plan_maestro_validacion|test_result|test_summary|pendiente_de_implementar/.test(n)) return '09';
  if (/marketing|marca_/.test(n))              return '10';
  if (/propiedad_intelectual|m4383580|patente|estrategia_pi|contrato_mantenimiento/.test(n)) return '11';
  if (/planes_stripe|stripe|c-nc|d6997|aeat|factur/.test(n))              return '12';

  return '08'; // default: técnica
}

function detectVersion(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '');
  const m = base.match(/(?:[_\s\-])(v\d+(?:[._]\d+)*|rev[A-Z])(?:[_\s.\-]|$)/i);
  if (m) return m[1].toLowerCase().startsWith('v') ? m[1].toLowerCase() : m[1].toLowerCase();
  const m2 = base.match(/_v(\d+)$/i);
  if (m2) return `v${m2[1]}`;
  return 'v1.0';
}

function detectState(fileName: string): 'vigente' | 'borrador' | 'obsoleto' {
  const n = fileName.toLowerCase();
  if (/borrador|draft|_old[_.]|_old$|backup|obsolet/.test(n)) return 'borrador';
  return 'vigente';
}

function generateTags(fileName: string, relPath: string, category: string): string[] {
  const tags = new Set<string>();
  tags.add(CATEGORIAS[category]?.label.split(' ')[0] ?? category);

  const n = fileName.toLowerCase();
  const keywords = [
    'trabflow', 'tradeflow', 'sodercan', 'enisa', 'obramat', 'saltoki',
    'sonepar', 'conaif', 'fenie', 'agremia', 'pitch', 'motor_ia', 'motor',
    'inversores', 'producto', 'legal', 'fiscal', 'arquitectura', 'mvp',
    'validacion', 'plan_operativo', 'gremial', 'auditoria', 'estatutos',
    'normativa', 'presupuesto', 'comercial', 'fundadores', 'memoria',
  ];
  keywords.forEach(kw => {
    if (n.includes(kw.replace(/_/g, ' ')) || n.includes(kw))
      tags.add(kw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
  });

  const folder = path.dirname(relPath).split('/').filter(Boolean).pop()?.toLowerCase() ?? '';
  if (folder && folder !== 'docs' && folder.length > 2 && folder !== 'pdf' && folder !== 'txt')
    tags.add(folder.replace(/[\s_-]+/g, ' ').trim());

  return [...tags].slice(0, 10);
}

function slugify(fileName: string): string {
  return fileName
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[()[\]#&%!?¿¡'",;:]/g, '')
    .replace(/__+/g, '_')
    .replace(/^_|_$/g, '');
}

function hashFile(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').slice(0, 20);
}

function collectFiles(dir: string): Array<{ absPath: string; relPath: string; fileName: string }> {
  const results: Array<{ absPath: string; relPath: string; fileName: string }> = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    const relPath = path.relative(DOCS_ROOT, absPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      results.push(...collectFiles(absPath));
      continue;
    }

    if (SKIP.some(p => p.test(entry.name) || p.test(relPath))) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!MIME[ext]) continue;

    // Skip TXT files que son versiones de texto de PDFs (en subcarpeta /TXT/)
    if (ext === '.txt' && relPath.includes('/TXT/')) continue;

    results.push({ absPath, relPath, fileName: entry.name });
  }
  return results;
}

function bar(n: number, total: number, w = 20): string {
  const filled = Math.round((n / total) * w);
  return '[' + '█'.repeat(filled) + '░'.repeat(w - filled) + ']';
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now();
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   TrabFlow — Repositorio Documental Corporativo      ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // 1. Cargar entidades CRM
  process.stdout.write('🏢 Cargando entidades CRM... ');
  const { data: entities } = await supabase.from('admin_corp_entities').select('id, external_key');
  const entityMap = new Map<string, string>();
  (entities ?? []).forEach(e => { if (e.external_key) entityMap.set(e.external_key, e.id); });
  console.log(`${entities?.length ?? 0} cargadas`);

  // 2. Cargar docs existentes para dedup
  process.stdout.write('📋 Cargando docs existentes... ');
  const { data: existingDocs } = await supabase.from('trade_documents').select('id, origen_path, file_hash');
  const existingByPath = new Map<string, { id: string; hash: string }>();
  (existingDocs ?? []).forEach(d => {
    if (d.origen_path) existingByPath.set(d.origen_path, { id: d.id, hash: d.file_hash });
  });
  console.log(`${existingDocs?.length ?? 0} encontrados\n`);

  // 3. Escanear archivos
  process.stdout.write('🔍 Escaneando docs/... ');
  const files = collectFiles(DOCS_ROOT);
  console.log(`${files.length} archivos encontrados\n`);

  // 4. Estadísticas
  const stats = {
    imported: 0, updated: 0, skipped: 0, errors: 0, linked: 0,
    byCategory: {} as Record<string, number>,
    noCategory: [] as string[],
    noEntity: [] as string[],
    errorList: [] as string[],
    duplicates: [] as string[],
  };

  // 5. Procesar cada archivo
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (let i = 0; i < files.length; i++) {
    const { absPath, relPath, fileName } = files[i];
    const progress = `${bar(i + 1, files.length)} ${i + 1}/${files.length}`;

    const ext = path.extname(fileName).toLowerCase();
    const mimeType = MIME[ext] ?? 'application/octet-stream';
    const fileSize = fs.statSync(absPath).size;
    const fileHash = hashFile(absPath);

    // Dedup por hash y path
    const existing = existingByPath.get(relPath);
    if (existing?.hash === fileHash) {
      process.stdout.write(`\r  ⏭  ${progress}  ${relPath.slice(-45).padEnd(46)}`);
      stats.skipped++;
      continue;
    }

    const category = determineCategory(relPath, fileName);
    const version   = detectVersion(fileName);
    const estado    = detectState(fileName);
    const tags      = generateTags(fileName, relPath, category);
    const nombre    = fileName.replace(/\.[^.]+$/, '').replace(/[_]/g, ' ').trim();
    const catFolder = CATEGORIAS[category]?.folder ?? '08-tecnica';
    const slug      = slugify(fileName);
    const storagePath = `${catFolder}/${slug}`;

    // Track docs sin categoría clara (usaron default)
    if (category === '08') {
      const pathHint = relPath.toLowerCase();
      if (!pathHint.includes('tecnica') && !pathHint.includes('auditoria')
        && !pathHint.includes('arquitectura') && !pathHint.includes('normativa')
        && !pathHint.includes('analisis') && !pathHint.includes('validacion')
        && !pathHint.includes('wizards') && !pathHint.includes('contratos')
        && !pathHint.includes('verifactu')) {
        stats.noCategory.push(relPath);
      }
    }

    // Upload a Storage
    process.stdout.write(`\r  ↑  ${progress}  ${slug.slice(0, 46).padEnd(46)}`);
    const fileBuffer = fs.readFileSync(absPath);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError && !uploadError.message.includes('already exists')) {
      stats.errors++;
      stats.errorList.push(`${relPath}: ${uploadError.message}`);
      continue;
    }

    // Crear/actualizar registro en BD
    const docPayload = {
      nombre, descripcion: null, categoria: category,
      version, estado, storage_path: storagePath,
      bucket: BUCKET, mime_type: mimeType, size: fileSize,
      file_hash: fileHash, tags, origen_path: relPath,
    };

    let docId: string;

    if (existing) {
      await supabase.from('trade_documents').update(docPayload).eq('id', existing.id);
      docId = existing.id;
      stats.updated++;
    } else {
      // Check for hash duplicate (mismo contenido, distinto path)
      const { data: hashMatch } = await supabase
        .from('trade_documents').select('id').eq('file_hash', fileHash).maybeSingle();
      if (hashMatch) {
        stats.duplicates.push(`${relPath} (duplicado de id=${hashMatch.id})`);
        stats.skipped++;
        continue;
      }
      const { data: newDoc, error: insertErr } = await supabase
        .from('trade_documents').insert(docPayload).select('id').single();
      if (insertErr || !newDoc) {
        stats.errors++;
        stats.errorList.push(`${relPath}: ${insertErr?.message}`);
        continue;
      }
      docId = newDoc.id;
      stats.imported++;
    }

    stats.byCategory[category] = (stats.byCategory[category] ?? 0) + 1;

    // Vincular entidades
    const nLower = fileName.toLowerCase();
    const linkedIds: string[] = [];
    for (const { keywords, externalKey } of ENTITY_KEYWORDS) {
      if (keywords.some(kw => nLower.includes(kw))) {
        const eid = entityMap.get(externalKey);
        if (eid) linkedIds.push(eid);
      }
    }
    if (linkedIds.length > 0) {
      await supabase.from('trade_document_entities').delete().eq('document_id', docId);
      await supabase.from('trade_document_entities').insert(
        linkedIds.map(eid => ({ document_id: docId, entity_id: eid }))
      );
      stats.linked += linkedIds.length;
    } else {
      stats.noEntity.push(relPath);
    }
  }

  // 6. Informe final
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n\n╔══════════════════════════════════════════════════════╗');
  console.log('║                  INFORME FINAL                      ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Total archivos:             ${String(files.length).padStart(5)}                      ║`);
  console.log(`║  ✔  Nuevos importados:       ${String(stats.imported).padStart(5)}                      ║`);
  console.log(`║  ✔  Actualizados:            ${String(stats.updated).padStart(5)}                      ║`);
  console.log(`║  ⏭   Ya importados (sin cambio): ${String(stats.skipped).padStart(5)}                  ║`);
  console.log(`║  📋 Duplicados (mismo hash): ${String(stats.duplicates.length).padStart(5)}                      ║`);
  console.log(`║  🔗 Vinculaciones CRM:       ${String(stats.linked).padStart(5)}                      ║`);
  console.log(`║  ✗  Errores:                 ${String(stats.errors).padStart(5)}                      ║`);
  console.log(`║  ⏱  Tiempo:                  ${String(elapsed + 's').padStart(6)}                     ║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  Por categoría:                                      ║');
  Object.entries(stats.byCategory).sort().forEach(([cat, count]) => {
    const label = `  ${CATEGORIAS[cat]?.folder ?? cat}: ${count}`;
    console.log(`║${label.padEnd(54)}║`);
  });
  console.log('╠══════════════════════════════════════════════════════╣');

  if (stats.noCategory.length > 0) {
    console.log(`║  ⚠ Sin categoría clara: ${stats.noCategory.length}                            ║`);
    stats.noCategory.slice(0, 5).forEach(f =>
      console.log(`║    · ${f.slice(-46).padEnd(48)}║`)
    );
  }
  if (stats.duplicates.length > 0) {
    console.log(`║  📋 Duplicados detectados: ${stats.duplicates.length}                         ║`);
    stats.duplicates.slice(0, 3).forEach(d =>
      console.log(`║    · ${d.slice(0, 46).padEnd(48)}║`)
    );
  }
  if (stats.errorList.length > 0) {
    console.log(`║  ✗ Errores:                                          ║`);
    stats.errorList.slice(0, 5).forEach(e =>
      console.log(`║    · ${e.slice(0, 46).padEnd(48)}║`)
    );
  }
  console.log(`║  ℹ Sin entidad vinculada: ${stats.noEntity.length} documentos              ║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');
}

main().catch(err => { console.error('\n❌ Error fatal:', err); process.exit(1); });
