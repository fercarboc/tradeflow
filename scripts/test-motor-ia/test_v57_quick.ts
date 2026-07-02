/**
 * Test rápido v57 — solo los 11 casos objetivo.
 * Uso: npx ts-node test_v57_quick.ts
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';

const __dir = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: join(__dir, '../../.env') });
dotenvConfig({ path: join(__dir, '../../.env.local'), override: false });

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const TEST_KEY     = process.env.TRADE_TEST_KEY ?? '';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/trade-voice-to-quote`;

if (!SUPABASE_URL || !TEST_KEY) {
  console.error('❌ Faltan VITE_SUPABASE_URL o TRADE_TEST_KEY en .env');
  process.exit(1);
}

const TARGETS: { id: number; texto: string; oficio: string; guard?: boolean }[] = [
  // ── FASE 5A: 6 casos objetivo ─────────────────────────────────────────────
  { id: 24,  texto: 'Instalación de punto de carga para vehículo eléctrico modo 3 con wallbox de 7kW en garaje', oficio: 'electricidad' },
  { id: 128, texto: 'Instalar velux o lucernario en tejado inclinado para dar luz a buhardilla, 78x118cm', oficio: 'tejados_cubiertas' },
  { id: 139, texto: 'Instalar claraboya de apertura eléctrica en tejado plano para ventilación de escalera', oficio: 'tejados_cubiertas' },
  { id: 246, texto: 'Configurar y poner en marcha sistema CCTV existente que no graba bien, ajuste de cámaras', oficio: 'telecomunicaciones' },
  { id: 248, texto: 'Poner rosetas de red RJ45 en 3 habitaciones y conectar al router del salón con cable', oficio: 'telecomunicaciones' },
  { id: 310, texto: 'Instalar puerta cortafuego RF90 en escalera comunitaria del edificio, con ferretería homologada', oficio: 'contra_incendios' },
  // ── Guardia de regresión: 4 TRUNCADO conocidos de v56 ─────────────────────
  { id: 7,   texto: 'Instalación completa de baño nuevo con lavabo empotrado, inodoro suspendido, ducha y griferías cromadas', oficio: 'fontaneria', guard: true },
  { id: 106, texto: 'Instalación de suelo radiante con bomba de calor en planta baja de 90 metros cuadrados', oficio: 'climatizacion', guard: true },
  { id: 235, texto: 'Instalar sistema híbrido solar y aerotermia para vivienda eficiente, cálculo de ahorro energético', oficio: 'energia_solar', guard: true },
  { id: 320, texto: 'Instalar detección temprana de incendios en archivo de documentación, sistema de aspiración VESDA', oficio: 'contra_incendios', guard: true },
];

const V56_DETECTED: Record<number, string> = {
  // Casos objetivo FASE 5A
  24: 'energia_solar', 128: 'cristaleria', 139: 'cristaleria',
  246: 'instalador_cctv', 248: 'electricidad', 310: 'cerrajeria',
  // Guardias TRUNCADO v56
  7: '', 106: '', 235: '', 320: '',
};

// Directorio donde guardar los resultados raw de v57
const OUT_DIR = join(__dir, 'output/raw_v57_quick');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[/\-_]/g, ' ').trim();
}
function coinciden(detected: string, expected: string): boolean {
  const d = normalize(detected), e = normalize(expected);
  if (!d || !e) return false;
  if (d.includes(e) || e.includes(d)) return true;
  return e.split(/\s+/).filter((w: string) => w.length > 3).some((w: string) => d.includes(w));
}

interface Result {
  id: number; oficio_esperado: string;
  v56_detectado: string; v57_detectado: string;
  v56_coincide: boolean; v57_coincide: boolean;
  recovered: boolean; worsened: boolean;
  category: string; latency_ms: number;
  prompt_version: string;
}

async function runOne(t: { id: number; texto: string; oficio: string }): Promise<Result> {
  const t0 = Date.now();
  let detected = ''; let category = 'ERROR'; let prompt_version = '';
  try {
    const resp = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_KEY}` },
      body: JSON.stringify({ text: t.texto }),
    });
    if (!resp.ok) { category = `HTTP_${resp.status}`; }
    else {
      const data = await resp.json() as Record<string, unknown>;
      const quote = (data?.quote ?? {}) as Record<string, unknown>;
      const oficios = (quote?.oficios_detectados ?? []) as { oficio?: string }[];
      detected = oficios[0]?.oficio ?? '';
      prompt_version = ((data?._meta ?? {}) as Record<string, unknown>)?.prompt_version as string ?? '';
      const partidas = (quote?.partidas ?? []) as { origen?: string }[];
      const n = partidas.length;
      const nCat = partidas.filter(p => p.origen === 'catalogo').length;
      if (n === 0) category = 'VACIO';
      else if (nCat === 0) category = 'SOLO_SUGERIDAS';
      else category = 'OK_MIXTO';

      // Guardar raw
      const fname = `${t.oficio}_${t.id}.json`;
      writeFileSync(join(OUT_DIR, fname), JSON.stringify({
        id: t.id, oficio: t.oficio, texto: t.texto,
        latency_ms: Date.now() - t0, raw_response: data,
        classification: { category, oficio_detectado: detected, coincide_oficio: coinciden(detected, t.oficio) ? 'SI' : 'NO' },
      }, null, 2));
    }
  } catch (e) { category = 'ERROR_TECNICO'; }

  const latency_ms = Date.now() - t0;
  const v56_det = V56_DETECTED[t.id] ?? '';
  return {
    id: t.id, oficio_esperado: t.oficio,
    v56_detectado: v56_det, v57_detectado: detected,
    v56_coincide: coinciden(v56_det, t.oficio),
    v57_coincide: coinciden(detected, t.oficio),
    recovered: !coinciden(v56_det, t.oficio) && coinciden(detected, t.oficio),
    worsened: coinciden(v56_det, t.oficio) && !coinciden(detected, t.oficio),
    category, latency_ms, prompt_version,
  };
}

async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('TEST RÁPIDO v57 — 11 CASOS OBJETIVO');
  console.log(`URL: ${FUNCTION_URL}`);
  console.log(`${'='.repeat(80)}\n`);

  const results: Result[] = [];
  for (const t of TARGETS) {
    const r = await runOne(t);
    results.push(r);
    const tag = r.recovered ? 'RECUPERADO ✓' : r.worsened ? 'EMPEORADO ✗' : (r.v57_coincide ? 'OK' : 'sigue mal');
    const pv = r.prompt_version ? `[${r.prompt_version}]` : '';
    console.log(
      `ID ${String(r.id).padStart(3)} ${pv.padEnd(6)} | esp: ${r.oficio_esperado.padEnd(20)} | v56: ${r.v56_detectado.padEnd(20)} | v57: ${r.v57_detectado.padEnd(20)} | ${tag}`
    );
  }

  const recovered = results.filter(r => r.recovered).length;
  const worsened  = results.filter(r => r.worsened).length;
  const ok_v57    = results.filter(r => r.v57_coincide).length;
  const ok_v56    = results.filter(r => r.v56_coincide).length;
  const vacio     = results.filter(r => r.category === 'VACIO').length;
  const latencies = results.map(r => r.latency_ms).sort((a, b) => a - b);
  const lat_mean  = Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length);
  const lat_p95   = latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)];

  console.log(`\n${'='.repeat(80)}`);
  console.log('RESUMEN');
  console.log(`${'='.repeat(80)}`);
  console.log(`Coincidencia v56:  ${ok_v56}/11`);
  console.log(`Coincidencia v57:  ${ok_v57}/11`);
  console.log(`Recuperados:       ${recovered}`);
  console.log(`Empeorados:        ${worsened}`);
  console.log(`VACIO:             ${vacio}  <- debe ser 0`);
  console.log(`Latencia media:    ${lat_mean}ms`);
  console.log(`Latencia P95:      ${lat_p95}ms`);

  console.log('\nDETALLE RECUPERADOS:');
  results.filter(r => r.recovered).forEach(r =>
    console.log(`  ID ${r.id}: ${r.v56_detectado} → ${r.v57_detectado}`)
  );
  console.log('\nDETALLE EMPEORADOS:');
  results.filter(r => r.worsened).forEach(r =>
    console.log(`  ID ${r.id}: ${r.v56_detectado} → ${r.v57_detectado}`)
  );

  if (vacio > 0) { console.log('\n⚠ ALERTA: VACIO → ROLLBACK NECESARIO'); process.exit(1); }
  if (worsened > 0) { console.log('\n⚠ ALERTA: casos empeorados → revisar antes de 400 tests'); process.exit(2); }
  // Verificar guardias TRUNCADO: deben seguir siendo VACIO o TRUNCADO
  const guardsFailed = results.filter(r => (r as { guard?: boolean } & Result).guard && r.category === 'OK_MIXTO');
  if (guardsFailed.length > 0) {
    console.log(`\n⚠ INESPERADO: ${guardsFailed.length} caso(s) TRUNCADO de v56 ahora son OK — revisar`);
    guardsFailed.forEach(r => console.log(`  ID ${r.id}: ${r.category}`));
  }
  console.log('\n✓ Sin regresiones. Listo para 400 tests completos.');
}

main().catch(e => { console.error(e); process.exit(1); });
