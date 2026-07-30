/**
 * Script one-shot: sube imágenes de docs/imagenes/ a Supabase Storage
 * y actualiza image_url en trade_marketplace_universal_products
 * y en trade_marketplace_supplier_offerings (catálogo OBRAMAT Demo).
 *
 * Uso: node scripts/upload-catalog-images.mjs
 * Requiere SUPABASE_SERVICE_ROLE_KEY en .env (o variable de entorno).
 */

import { readFileSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// ── Cargar .env sin dependencia externa ──────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, '..', '.env');
const envLines = readFileSync(envPath, 'utf-8').split('\n');
const env = {};
for (const line of envLines) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}

const SUPABASE_URL      = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

// ── Configuración ─────────────────────────────────────────────────────────────

const IMAGES_DIR    = join(__dir, '..', 'docs', 'imagenes');
const OBRAMAT_ACTOR = '85e73234-c74e-44e7-865a-1aca8312f9a5';

// Mapeo imagen → {tipo, id}
//   tipo 'up'       → trade_marketplace_universal_products (bucket marketplace-universal)
//   tipo 'offering' → trade_marketplace_supplier_offerings (bucket marketplace-offerings, path ACTOR/OFFERING_ID)
const ASSIGNMENTS = [
  // ── Mamparas ─────────────────────────────────────────────────────────────
  { file: 'mampara1.webp', tipo: 'up',       id: '0bb256f1-4bc0-47e4-b97d-ce22eecc70da' }, // UP: Mampara de ducha
  { file: 'mampara1.webp', tipo: 'offering', id: 'c1d07442-27a1-4d2e-a117-72b0da31be93' }, // OBR-FON-014 angular 80x80
  { file: 'mampara2.webp', tipo: 'offering', id: '36808cc4-238a-48dc-8b3d-69333a8b0e5e' }, // OBR-FON-015 frontal 120
  { file: 'mampara3.webp', tipo: 'offering', id: '64aad051-5fc4-4caf-8191-3e6a5303c49c' }, // OBR-FON-027 frontal 80
  { file: 'mampara2.webp', tipo: 'offering', id: '7b1b094e-a888-4c9c-acb3-c76979e0668c' }, // OBR-FON-028 frontal 90

  // ── Platos de ducha ───────────────────────────────────────────────────────
  { file: 'plato1.webp',   tipo: 'up',       id: '44b86c78-3233-4f20-bb18-ebd323823856' }, // UP: Plato de ducha
  { file: 'plato1.webp',   tipo: 'offering', id: '908fdb05-256e-4482-a086-77d6c7844fe6' }, // OBR-FON-013 120x80 extraplano
  { file: 'plato2.jpg',    tipo: 'offering', id: '638204bc-8949-4eea-8945-9e61cfcb960d' }, // OBR-FON-011 80x80 antidesliz.
  { file: 'plato3.jpg',    tipo: 'offering', id: 'ebf26b2c-735a-4f3a-8b9a-04a2395daf1c' }, // OBR-FON-012 90x90 antidesliz.
  { file: 'plato1.webp',   tipo: 'offering', id: 'd18eb27b-a8ff-4548-b867-35b92dfe2321' }, // OBR-FON-025 170x70
  { file: 'plato2.jpg',    tipo: 'offering', id: '6dead49f-e89d-4508-89a0-07652b626994' }, // OBR-FON-026 80x170

  // ── Desagüe ───────────────────────────────────────────────────────────────
  { file: 'desague1.jpg',  tipo: 'up',       id: '8a235fa5-1583-48e6-824f-74433b8836d6' }, // UP: Sifón y desagüe ducha
  { file: 'desague2.jpg',  tipo: 'up',       id: '8eec8021-78c5-4083-b62c-ac2f7853a4a1' }, // UP: Tubo y sifón desagüe PVC
  { file: 'desague1.jpg',  tipo: 'offering', id: '3689af85-8544-4c52-a3e8-1799a75f1ecd' }, // OBR-FON-030 click-clack 90mm
  { file: 'desague2.jpg',  tipo: 'offering', id: 'f756ed44-fd4f-4fd8-ad88-3ae539bc8f97' }, // OBR-FON-010 sifón bañera
  { file: 'desague3.jpg',  tipo: 'offering', id: 'ac165a55-afac-429e-bd84-9e9df2d64d3d' }, // OBR-FON-009 sifón lavabo

  // ── Kits / Grifería ducha ─────────────────────────────────────────────────
  { file: 'kit1.webp',     tipo: 'up',       id: '3c77b38c-ebeb-429b-8bea-48df7e6c78a3' }, // UP: Grifo monomando ducha
  { file: 'kit1.webp',     tipo: 'offering', id: '81867ea3-94dd-4ad0-bb3b-c39277ecbc3e' }, // OBR-FON-024 columna termostática
  { file: 'kit2.webp',     tipo: 'offering', id: '7a3f5225-b282-4d23-9829-6cb338543247' }, // OBR-FON-029 grifo+rociador
  { file: 'kit3.webp',     tipo: 'offering', id: '702ba6ef-fe11-4348-bb47-3b9e4b5b43c1' }, // OBR-FON-004 ducha empotrado
  { file: 'kit1.webp',     tipo: 'offering', id: '5b7de74f-51e6-4b6d-9c4e-1450f7e94ed1' }, // OBR-FON-005 termostático
  { file: 'kit2.webp',     tipo: 'offering', id: '37f348c1-ef46-4307-af7d-75b36b030605' }, // OBR-FON-032 conjunto 2 vias
  { file: 'kit3.webp',     tipo: 'offering', id: 'b321afe4-ecec-4d8f-8313-f86f436a397d' }, // OBR-FON-023 ducha mano+flexo

  // ── Lavabo / Grifería lavabo ──────────────────────────────────────────────
  { file: 'lavabo1.jpg',   tipo: 'up',       id: '7ba1e338-6fa5-47a2-bcfc-16c138c66974' }, // UP: Grifo monomando lavabo
  { file: 'lavabo1.jpg',   tipo: 'offering', id: '4795cc88-58b0-4bbe-8e4d-67f51e19a450' }, // OBR-FON-018 lavabo sobre encimera
  { file: 'lavabo2.jpg',   tipo: 'offering', id: '2ca30a2a-7736-45de-92f0-89448c4c5bdb' }, // OBR-FON-001 grifo lavabo caño alto
  { file: 'lavabo3.jpg',   tipo: 'offering', id: 'a865cf96-3cd1-40b6-bb69-ca49d87907d7' }, // OBR-FON-002 grifo lavabo caño bajo
  { file: 'lavabo2.jpg',   tipo: 'offering', id: 'bf967dfc-8ec0-4845-aec4-3a406364c19e' }, // OBR-FON-003 grifo fregadero

  // ── Bañera ────────────────────────────────────────────────────────────────
  { file: 'banera1.webp',  tipo: 'offering', id: '8e3b936c-59d7-4739-9d1d-7cb6c072941c' }, // OBR-FON-031 bañera acrilica

  // ── Inodoro ───────────────────────────────────────────────────────────────
  { file: 'inodoro1.webp', tipo: 'offering', id: '4912196d-6e36-42a9-aaee-f627187dde4d' }, // OBR-FON-016 suspendido
  { file: 'inodoro2.webp', tipo: 'offering', id: '6fc04fe8-fcdf-445a-9cff-72568d185d4f' }, // OBR-FON-017 suelo+cisterna

  // ── Sellador / Silicona ───────────────────────────────────────────────────
  { file: 'sellador1.jpg', tipo: 'offering', id: '9613a1bf-5814-45dc-b16e-6f2509fc5bac' }, // OBR-CON-003 silicona sanitaria
  { file: 'sellador2.jpg', tipo: 'offering', id: '19bae528-7e55-41b2-9b0d-8ef2e43e9d15' }, // OBR-CON-004 silicona transparente
  { file: 'sellador3.jpg', tipo: 'offering', id: '6e5620fe-eec7-4404-8c52-83bb34d732f9' }, // OBR-FER-115 silicona neutra blanca
  { file: 'sellador1.jpg', tipo: 'offering', id: '79f8654c-af58-4351-93b9-9c3f3e2da857' }, // OBR-PAR-114 juntas elastoméricas
  { file: 'sellador2.jpg', tipo: 'offering', id: '1ffe3b1e-fd5e-4185-b068-7857e88c8c33' }, // OBR-CON-007 imprimación selladora

  // ── Azulejo ───────────────────────────────────────────────────────────────
  { file: 'azulejo1.webp', tipo: 'offering', id: '71f628d8-9bbd-4eea-b8e2-65dcbca6cd44' }, // OBR-PAR-101 azulejo metro 10x30
  { file: 'azulejo2.webp', tipo: 'offering', id: 'f6c29c5e-b720-408e-8022-5396bb384f99' }, // OBR-PAR-104 azulejo hidrofugado

  // ── Suelos ────────────────────────────────────────────────────────────────
  { file: 'suelos1.webp',  tipo: 'offering', id: '0546d972-4047-4060-82d3-2d583087b93f' }, // OBR-SUE-101 porcelana mate 60x60
  { file: 'suelos2.webp',  tipo: 'offering', id: 'f2f7a557-6a4e-40d4-b445-8b212d32bc81' }, // OBR-SUE-102 porcelana rectificada 60x120
  { file: 'suelos3.webp',  tipo: 'offering', id: 'ab868456-1dc0-4e09-a3df-ca407266fbf5' }, // OBR-SUE-107 antideslizante exterior
  { file: 'suelos1.webp',  tipo: 'offering', id: '93b80901-6568-4239-bf5d-ce740b94c5bf' }, // OBR-SUE-112 hidráulica retro
  { file: 'suelos2.webp',  tipo: 'offering', id: 'acfa1a10-ce74-4804-8f02-542957a9d930' }, // OBR-SUE-115 suelo técnico elevado
  { file: 'suelos3.webp',  tipo: 'offering', id: 'a54c2d66-5be4-43ab-846f-a4cfe91bd713' }, // OBR-SUE-106 vinílico SPC
  { file: 'suelos1.webp',  tipo: 'offering', id: 'd203d5f2-1cc4-4bb5-a31d-7a2d284b71cf' }, // OBR-SUE-111 malla niveladora
  { file: 'suelos2.webp',  tipo: 'offering', id: '518f3261-ba80-447a-8a64-80674f222467' }, // OBR-SUE-109 rodapié porcelana
];

// ── Funciones auxiliares ──────────────────────────────────────────────────────

function mimeType(filename) {
  const ext = extname(filename).toLowerCase();
  return ext === '.webp' ? 'image/webp'
       : ext === '.png'  ? 'image/png'
       : 'image/jpeg';
}

const uploadedUrls = new Map(); // filename → public URL

async function uploadFile(filename) {
  if (uploadedUrls.has(filename)) return uploadedUrls.get(filename);

  const filePath = join(IMAGES_DIR, filename);
  let fileData;
  try { fileData = readFileSync(filePath); }
  catch { console.warn(`  ⚠️  Archivo no encontrado: ${filename}`); return null; }

  // Usar bucket marketplace-universal con path plano por nombre de archivo
  const storagePath = filename;
  const { error } = await db.storage
    .from('marketplace-universal')
    .upload(storagePath, fileData, {
      contentType: mimeType(filename),
      upsert: true,
    });

  if (error) {
    console.error(`  ❌  Error subiendo ${filename}:`, error.message);
    return null;
  }

  const { data } = db.storage.from('marketplace-universal').getPublicUrl(storagePath);
  uploadedUrls.set(filename, data.publicUrl);
  console.log(`  ✅  Subida: ${filename}`);
  return data.publicUrl;
}

async function updateUniversalProduct(id, imageUrl) {
  const { error } = await db
    .from('trade_marketplace_universal_products')
    .update({ image_url: imageUrl })
    .eq('id', id);
  if (error) console.error(`  ❌  UP ${id}:`, error.message);
  else       console.log(`  🔗  UP actualizado: ${id.slice(0, 8)}...`);
}

async function updateOffering(id, imageUrl) {
  const { error } = await db
    .from('trade_marketplace_supplier_offerings')
    .update({ image_url: imageUrl })
    .eq('id', id);
  if (error) console.error(`  ❌  Offering ${id}:`, error.message);
  else       console.log(`  🔗  Offering actualizado: ${id.slice(0, 8)}...`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀  Iniciando subida de imágenes de catálogo...\n');

  // 1. Subir imágenes únicas al bucket
  const uniqueFiles = [...new Set(ASSIGNMENTS.map(a => a.file))];
  console.log(`📁  Subiendo ${uniqueFiles.length} imágenes únicas al bucket marketplace-universal...\n`);
  for (const file of uniqueFiles) {
    await uploadFile(file);
  }

  // 2. Actualizar registros en BD
  console.log(`\n🔄  Actualizando ${ASSIGNMENTS.length} registros en la base de datos...\n`);
  for (const { file, tipo, id } of ASSIGNMENTS) {
    const url = uploadedUrls.get(file);
    if (!url) { console.warn(`  ⚠️  Sin URL para ${file}, saltando ${id.slice(0, 8)}`); continue; }
    if (tipo === 'up')       await updateUniversalProduct(id, url);
    else                     await updateOffering(id, url);
  }

  // 3. Resumen
  const upCount      = ASSIGNMENTS.filter(a => a.tipo === 'up').length;
  const offeringCount = ASSIGNMENTS.filter(a => a.tipo === 'offering').length;
  console.log(`\n✅  Completado:`);
  console.log(`   • ${uploadedUrls.size} imágenes subidas al bucket`);
  console.log(`   • ${upCount} productos universales actualizados`);
  console.log(`   • ${offeringCount} offerings OBRAMAT actualizados`);
  console.log(`   • Imágenes sin producto asignado: espejo (×3), mueble (×3), banera2, banera3`);
}

main().catch(err => { console.error('💥', err.message); process.exit(1); });
