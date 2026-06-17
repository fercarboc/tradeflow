// Ingesta completa de los 20 oficios .txt → embeddings → Supabase
// Reutiliza el parser de seed_actuaciones.mjs
// Uso: node ingest-oficios.mjs [oficio]   (sin argumento = todos)
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  VOYAGE_API_KEY, VOYAGE_MODEL, VOYAGE_BATCH_SIZE, VOYAGE_BATCH_DELAY_MS,
  OFICIOS_BASE,
} from './config.mjs';

// ---- Parser de bloques ACTUACION (mismo formato que seed_actuaciones.mjs) ----
function parseActuaciones(text, oficio) {
  const blocks = text.split(/\nACTUACION: /).slice(1);
  return blocks.map((block, idx) => {
    const lines        = block.split('\n');
    const actuacion_id = lines[0].trim();
    const get  = (k) => { const l = lines.find(x => x.startsWith(k + ':')); return l ? l.slice(k.length+1).trim() : ''; };
    const toArr = (v) => v ? v.split(',').map(s => s.trim()).filter(Boolean) : [];

    const palabras_clave         = toArr(get('PALABRAS_CLAVE'));
    const partidas_obligatorias  = toArr(get('PARTIDAS_OBLIGATORIAS'));
    const partidas_auxiliares    = toArr(get('PARTIDAS_AUXILIARES'));
    const reglas_calculo         = get('REGLAS_CALCULO');
    const unidad                 = get('UNIDAD');
    const observaciones          = get('OBSERVACIONES');

    // Texto del chunk: resumen estructurado del ACTUACION
    const chunk_text = [
      `ACTUACION: ${actuacion_id}`,
      palabras_clave.length ? `Palabras clave: ${palabras_clave.join(', ')}` : '',
      partidas_obligatorias.length ? `Partidas obligatorias: ${partidas_obligatorias.join(', ')}` : '',
      partidas_auxiliares.length ? `Partidas auxiliares: ${partidas_auxiliares.join(', ')}` : '',
      reglas_calculo ? `Reglas de cálculo: ${reglas_calculo}` : '',
      unidad ? `Unidad: ${unidad}` : '',
      observaciones ? `Observaciones: ${observaciones}` : '',
    ].filter(Boolean).join('\n');

    return {
      chunk_index:   idx,
      chunk_id:      `OFICIOS-${oficio.toUpperCase()}-${actuacion_id.replace(/\s+/g,'-').replace(/[^A-Z0-9-]/gi,'')}`,
      article_id:    actuacion_id,
      article_title: `${oficio.toUpperCase()} — ${actuacion_id}`,
      section:       null,
      section_title: null,
      chunk_text,
      token_count:   Math.round(chunk_text.length / 4),
      keywords:      palabras_clave,
      category:      'OFICIOS',
      oficio,
    };
  });
}

// ---- Voyage AI con retry automático en 429 ----
async function embedTexts(texts, attempt = 1) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${VOYAGE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: VOYAGE_MODEL, input: texts, input_type: 'document' }),
  });
  if (res.status === 429) {
    const wait = Math.min(22000 * attempt, 120000); // 22s, 44s, 88s... máx 2 min
    process.stdout.write(`\r  ⏳ Rate limit (429), esperando ${wait/1000}s (intento ${attempt})...`);
    await new Promise(r => setTimeout(r, wait));
    return embedTexts(texts, attempt + 1);
  }
  if (!res.ok) throw new Error(`Voyage AI ${res.status}: ${(await res.text()).slice(0,300)}`);
  return (await res.json()).data.map(d => d.embedding);
}

// ---- Supabase ----
async function upsertDocument(title, oficio) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/trade_norm_documents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      category:         'OFICIOS',
      title,
      oficio_tags:      [oficio],
      plan_required:    'basico',
      status:           'processing',
      last_verified_at: new Date().toISOString().slice(0,10),
    }),
  });
  if (!res.ok) throw new Error(`Doc upsert ${res.status}: ${(await res.text()).slice(0,300)}`);
  return (await res.json())[0]?.id;
}

async function upsertChunks(docId, rows) {
  const withDoc = rows.map(r => ({ ...r, document_id: docId }));
  const res = await fetch(`${SUPABASE_URL}/rest/v1/trade_norm_chunks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(withDoc),
  });
  if (!res.ok) throw new Error(`Chunks upsert ${res.status}: ${(await res.text()).slice(0,300)}`);
}

// ---- Procesar un oficio ----
async function processOficio(filename, oficio) {
  const filePath = join(OFICIOS_BASE, filename);
  const text     = readFileSync(filePath, 'utf8');
  const chunks   = parseActuaciones(text, oficio);

  if (chunks.length === 0) {
    console.warn(`⚠️  ${oficio}: 0 actuaciones encontradas, saltando`);
    return;
  }

  const docId = await upsertDocument(`Actuaciones de ${oficio}`, oficio);
  let uploaded = 0;

  for (let i = 0; i < chunks.length; i += VOYAGE_BATCH_SIZE) {
    const batch = chunks.slice(i, i + VOYAGE_BATCH_SIZE);
    const embeddings = await embedTexts(batch.map(c => c.chunk_text));
    const rows = batch.map((c, j) => ({ ...c, embedding: embeddings[j], activo: true }));
    await upsertChunks(docId, rows);
    uploaded += batch.length;
    if (i + VOYAGE_BATCH_SIZE < chunks.length) await new Promise(r => setTimeout(r, VOYAGE_BATCH_DELAY_MS));
  }

  // Marcar como indexed
  await fetch(`${SUPABASE_URL}/rest/v1/trade_norm_documents?id=eq.${docId}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'indexed', chunk_count: uploaded }),
  });

  console.log(`✅ ${oficio}: ${uploaded} chunks subidos`);
}

// ---- Lista de oficios ----
const OFICIOS = [
  { file: 'albañileria.txt',         oficio: 'albanileria' },
  { file: 'carpinteria.txt',         oficio: 'carpinteria' },
  { file: 'cerrajeria.txt',          oficio: 'cerrajeria' },
  { file: 'climatizacion.txt',       oficio: 'climatizacion' },
  { file: 'contra_incendios.txt',    oficio: 'contra_incendios' },
  { file: 'cristaleria.txt',         oficio: 'cristaleria' },
  { file: 'cubiertas.txt',           oficio: 'cubiertas' },
  { file: 'electricidad.txt',        oficio: 'electricidad' },
  { file: 'energia_solar.txt',       oficio: 'energia_solar' },
  { file: 'fachadas.txt',            oficio: 'fachadas' },
  { file: 'fontaneria.txt',          oficio: 'fontaneria' },
  { file: 'impermeabilizacion.txt',  oficio: 'impermeabilizacion' },
  { file: 'jardineria.txt',          oficio: 'jardineria' },
  { file: 'mantenimiento_general.txt', oficio: 'mantenimiento_general' },
  { file: 'persianas.txt',           oficio: 'persianas' },
  { file: 'pintura.txt',             oficio: 'pintura' },
  { file: 'pladur.txt',              oficio: 'pladur' },
  { file: 'reformas_integrales.txt', oficio: 'reformas_integrales' },
  { file: 'suelos_alicatados.txt',   oficio: 'suelos_alicatados' },
  { file: 'telecomunicaciones.txt',  oficio: 'telecomunicaciones' },
];

// ---- CLI ----
const filtroOficio = process.argv[2];
const toProcess = filtroOficio
  ? OFICIOS.filter(o => o.oficio === filtroOficio)
  : OFICIOS;

if (toProcess.length === 0) {
  console.error(`Oficio no encontrado: ${filtroOficio}`);
  console.error(`Disponibles: ${OFICIOS.map(o=>o.oficio).join(', ')}`);
  process.exit(1);
}

console.log(`\n🔧 Iniciando ingesta de oficios (${toProcess.length} archivos)...\n`);
for (const { file, oficio } of toProcess) {
  await processOficio(file, oficio);
}
console.log('\n🎉 Ingesta de oficios completada');
