// Configuración compartida para los scripts de ingesta de normativa
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Intentar .env.local primero, luego .env
const envPath = existsSync(join(__dirname, '../../.env.local'))
  ? join(__dirname, '../../.env.local')
  : join(__dirname, '../../.env');
config({ path: envPath });

// Supabase
export const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Voyage AI (https://www.voyageai.com — registro gratuito, 50M tokens gratis/mes)
export const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
export const VOYAGE_MODEL = 'voyage-3-lite';   // 1024 dim, multilingual, $0.02/1M tokens
export const VOYAGE_DIM = 512;   // voyage-3-lite: 512 dims (voyage-3 sería 1024)
// Nivel 1 Voyage AI: 2,000 RPM · 16M TPM — ingesta completa en ~2 minutos
export const VOYAGE_BATCH_SIZE = 32;
export const VOYAGE_BATCH_DELAY_MS = 300;       // 300ms entre peticiones (muy por debajo de 2000 RPM)

// Chunking
export const TARGET_CHUNK_CHARS = 2400;         // ~600 tokens
export const MAX_CHUNK_CHARS = 3200;            // ~800 tokens
export const MIN_CHUNK_CHARS = 300;             // ~75 tokens mínimo

// Rutas base
export const NORMATIVA_BASE = join(__dirname, '../../docs/Normativa');
export const OFICIOS_BASE   = join(__dirname, '../../docs/oficios');

// Validación al importar
const required = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VOYAGE_API_KEY };
for (const [k, v] of Object.entries(required)) {
  if (!v) {
    console.error(`❌ Falta variable de entorno: ${k}`);
    console.error('   Añádela en .env.local');
    process.exit(1);
  }
}
