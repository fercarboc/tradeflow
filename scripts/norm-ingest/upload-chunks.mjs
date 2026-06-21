// Paso 3: Genera embeddings (Voyage AI) y sube chunks a Supabase
// Uso: node upload-chunks.mjs REBT REBT_Reglamento_ITC_BOE_chunks.json
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  VOYAGE_API_KEY, VOYAGE_MODEL, VOYAGE_BATCH_SIZE, VOYAGE_BATCH_DELAY_MS,
  NORMATIVA_BASE,
} from './config.mjs';

// ---- Voyage AI embeddings con retry automático en 429 ----
async function embedTexts(texts, attempt = 1) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${VOYAGE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: VOYAGE_MODEL, input: texts, input_type: 'document' }),
  });
  if (res.status === 429) {
    const wait = Math.min(22000 * attempt, 120000);
    process.stdout.write(`\r  ⏳ Rate limit (429), esperando ${wait/1000}s (intento ${attempt})...`);
    await new Promise(r => setTimeout(r, wait));
    return embedTexts(texts, attempt + 1);
  }
  if (!res.ok) throw new Error(`Voyage AI error ${res.status}: ${(await res.text()).slice(0,500)}`);
  return (await res.json()).data.map(d => d.embedding);
}

// ---- Supabase upsert ----
async function upsertChunks(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/trade_norm_chunks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey':         SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase upsert error ${res.status}: ${err.slice(0,500)}`);
  }
}

async function upsertDocument(doc) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/trade_norm_documents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey':         SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(doc),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase document upsert error ${res.status}: ${err.slice(0,500)}`);
  }
  const data = await res.json();
  return data[0]?.id;
}

// ---- Proceso principal ----
export async function uploadChunks(chunksPath, documentMeta) {
  const chunks = JSON.parse(readFileSync(chunksPath, 'utf8'));
  console.log(`\n🚀 Iniciando upload: ${chunks.length} chunks`);

  // 1. Registrar o actualizar el documento
  const docId = await upsertDocument({
    category:            documentMeta.category,
    title:               documentMeta.title,
    boe_ref:             documentMeta.boeRef,
    version:             documentMeta.version,
    valid_from:          documentMeta.validFrom || null,
    status:              'processing',
    oficio_tags:         documentMeta.oficioTags || [],
    plan_required:       documentMeta.planRequired || 'basico',
    last_verified_at:    new Date().toISOString().slice(0,10),
    // Campos extendidos (Asistente Integral v2)
    organismo_emisor:    documentMeta.organismoEmisor   || 'BOE',
    fecha_publicacion:   documentMeta.fechaPublicacion  || null,
    fecha_derogacion:    documentMeta.fechaDerogacion   || null,
    ambito_territorial:  documentMeta.ambitoTerritorial || 'estatal',
    territorio:          documentMeta.territorio        || null,
    tipo_documento:      documentMeta.tipoDocumento     || 'reglamento',
    numero_consulta:     documentMeta.numeroConsulta    || null,
  });
  console.log(`📌 Documento registrado: ${docId}`);

  // 2. Procesar chunks en lotes
  const SUPABASE_BATCH = 50;
  let uploaded = 0;
  let failed   = 0;

  for (let i = 0; i < chunks.length; i += VOYAGE_BATCH_SIZE) {
    const batch = chunks.slice(i, i + VOYAGE_BATCH_SIZE);
    const texts = batch.map(c => c.chunk_text);

    // Generar embeddings
    let embeddings;
    try {
      embeddings = await embedTexts(texts);
    } catch (e) {
      console.error(`❌ Error embedding lote ${i}-${i+batch.length}: ${e.message}`);
      failed += batch.length;
      continue;
    }

    // Construir filas para Supabase
    const rows = batch.map((chunk, j) => ({
      document_id:   docId,
      chunk_index:   chunk.chunk_index,
      chunk_id:      chunk.chunk_id,
      article_id:    chunk.article_id    || null,
      article_title: chunk.article_title || null,
      section:       chunk.section       || null,
      section_title: chunk.section_title || null,
      chunk_text:    chunk.chunk_text,
      embedding:     embeddings[j],
      token_count:   chunk.token_count,
      keywords:      chunk.keywords      || [],
      category:      chunk.category,
      oficio:              chunk.oficio              || null,
      naturaleza:          chunk.naturaleza          || 'obligacion_legal',
      comunidad_autonoma:  chunk.comunidad_autonoma  || null,
      activo:              true,
    }));

    // Subir a Supabase en sub-lotes
    for (let k = 0; k < rows.length; k += SUPABASE_BATCH) {
      try {
        await upsertChunks(rows.slice(k, k + SUPABASE_BATCH));
        uploaded += Math.min(SUPABASE_BATCH, rows.length - k);
      } catch (e) {
        console.error(`❌ Error upsert: ${e.message}`);
        failed += Math.min(SUPABASE_BATCH, rows.length - k);
      }
    }

    const pct = Math.round(((i + batch.length) / chunks.length) * 100);
    process.stdout.write(`\r  ⚡ ${pct}% (${i + batch.length}/${chunks.length}) subidos...`);

    // Pausa entre lotes para respetar rate limit de Voyage AI (3 RPM free / 300 RPM pago)
    if (i + VOYAGE_BATCH_SIZE < chunks.length) {
      await new Promise(r => setTimeout(r, VOYAGE_BATCH_DELAY_MS));
    }
  }

  console.log(`\n✅ Upload completado: ${uploaded} OK · ${failed} fallidos`);

  // 3. Actualizar estado del documento
  await fetch(`${SUPABASE_URL}/rest/v1/trade_norm_documents?id=eq.${docId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey':         SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      status:      failed === 0 ? 'indexed' : 'error',
      chunk_count: uploaded,
    }),
  });

  return { docId, uploaded, failed };
}

// CLI directo: node upload-chunks.mjs <CATEGORIA> <chunks.json>
if (process.argv[1].endsWith('upload-chunks.mjs')) {
  const [,, category, chunksFile] = process.argv;
  if (!category || !chunksFile) {
    console.error('Uso: node upload-chunks.mjs <CATEGORIA> <archivo_chunks.json>');
    process.exit(1);
  }
  const chunksPath = join(NORMATIVA_BASE, category, 'CHUNKS', chunksFile);
  const fichaPath  = join(NORMATIVA_BASE, category, 'ficha_fuente.txt');
  const ficha      = readFileSync(fichaPath, 'utf8');

  const get = (key) => {
    const m = ficha.match(new RegExp(`${key}:\\s*(.+)`));
    return m?.[1]?.trim() || '';
  };

  await uploadChunks(chunksPath, {
    category,
    title:        get('Título'),
    boeRef:       get('ID BOE') || get('Código BOE'),
    version:      get('version') || new Date().toISOString().slice(0,10),
    planRequired: 'basico',
  });
}
