/**
 * Test rápido v58 — 4 casos C (origen/precio_origen inconsistente) + 6 guardias.
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

const TARGETS: { id: number; texto: string; oficio: string; label: string }[] = [
  // ── 4 casos C: deben pasar a OK_MIXTO ────────────────────────────────────────
  { id:  79, texto: 'Reparación de grietas en pared de salón con vendas y masilla, posterior pintado', oficio: 'pintura', label: 'C-fix' },
  { id: 176, texto: 'Instalar suelo de cemento pulido en loft industrial, 80 metros cuadrados con sellado protector', oficio: 'suelos_alicatados', label: 'C-fix' },
  { id: 196, texto: 'Corte de llaves urgente de cerradura especial, necesito 4 copias para los trabajadores', oficio: 'cerrajeria', label: 'C-fix' },
  { id: 302, texto: 'Suministro e instalación de extintores homologados en naves industriales, revisión anual incluida', oficio: 'contra_incendios', label: 'C-fix' },
  // ── 6 guardias de regresión: deben mantener OK_MIXTO o mejor ─────────────────
  { id:   7, texto: 'Instalación completa de baño nuevo con lavabo empotrado, inodoro suspendido, ducha y griferías cromadas', oficio: 'fontaneria', label: 'guard' },
  { id:  24, texto: 'Instalación de punto de carga para vehículo eléctrico modo 3 con wallbox de 7kW en garaje', oficio: 'electricidad', label: 'guard' },
  { id: 128, texto: 'Instalar velux o lucernario en tejado inclinado para dar luz a buhardilla, 78x118cm', oficio: 'tejados_cubiertas', label: 'guard' },
  { id: 246, texto: 'Configurar y poner en marcha sistema CCTV existente que no graba bien, ajuste de cámaras', oficio: 'telecomunicaciones', label: 'guard' },
  { id: 310, texto: 'Instalar puerta cortafuego RF90 en escalera comunitaria del edificio, con ferretería homologada', oficio: 'contra_incendios', label: 'guard' },
  { id: 320, texto: 'Instalar detección temprana de incendios en archivo de documentación, sistema de aspiración VESDA', oficio: 'contra_incendios', label: 'guard' },
];

// v57b results for comparison
const V57B: Record<number, { cat: string; oficio: string }> = {
   79: { cat: 'SOLO_SUGERIDAS', oficio: 'albanileria' },
  176: { cat: 'SOLO_SUGERIDAS', oficio: 'suelos_alicatados' },
  196: { cat: 'SOLO_SUGERIDAS', oficio: 'cerrajeria' },
  302: { cat: 'SOLO_SUGERIDAS', oficio: 'contra_incendios' },
    7: { cat: 'OK_MIXTO',       oficio: 'reforma_integral' },
   24: { cat: 'OK_MIXTO',       oficio: 'electricidad' },
  128: { cat: 'OK_MIXTO',       oficio: 'tejados_cubiertas' },
  246: { cat: 'OK_MIXTO',       oficio: 'telecomunicaciones' },
  310: { cat: 'OK_MIXTO',       oficio: 'contra_incendios' },
  320: { cat: 'OK_MIXTO',       oficio: 'contra_incendios' },
};

const OUT_DIR = join(__dir, 'output/raw_v58_quick');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

async function runOne(t: typeof TARGETS[0]) {
  const t0 = Date.now();
  try {
    const resp = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_KEY}` },
      body: JSON.stringify({ text: t.texto }),
    });
    if (!resp.ok) return { id: t.id, cat: `HTTP_${resp.status}`, oficio: '', pv: '', lat: Date.now()-t0, n_cat: 0, n_tot: 0 };

    const data = await resp.json() as Record<string, unknown>;
    const quote = (data?.quote ?? {}) as Record<string, unknown>;
    const partidas = (quote?.partidas ?? []) as Array<Record<string, unknown>>;
    const oficio = ((quote?.oficios_detectados ?? []) as Array<{oficio?:string}>)[0]?.oficio ?? '';
    const pv = ((data?._meta ?? {}) as Record<string,unknown>)?.prompt_version as string ?? '';
    const n_tot = partidas.length;
    const n_cat = partidas.filter(p => p.origen === 'catalogo' || p.origen === 'proveedor').length;
    const cat = n_tot === 0 ? 'VACIO' : n_cat === n_tot ? 'OK_CATALOGO' : n_cat > 0 ? 'OK_MIXTO' : 'SOLO_SUGERIDAS';

    writeFileSync(join(OUT_DIR, `${t.oficio}_${t.id}.json`), JSON.stringify({
      id: t.id, oficio: t.oficio, texto: t.texto, latency_ms: Date.now()-t0,
      raw_response: data,
      classification: { category: cat, oficio_detectado: oficio },
    }, null, 2));

    return { id: t.id, cat, oficio, pv, lat: Date.now()-t0, n_cat, n_tot };
  } catch (e) {
    return { id: t.id, cat: 'ERROR', oficio: '', pv: '', lat: Date.now()-t0, n_cat: 0, n_tot: 0 };
  }
}

async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('TEST RÁPIDO v58 — 4 casos C + 6 guardias');
  console.log(`URL: ${FUNCTION_URL}`);
  console.log(`${'='.repeat(80)}\n`);

  const OK_CATS = new Set(['OK_CATALOGO', 'OK_MIXTO']);
  let cfixPassed = 0, cfixFailed = 0, guardRegressed = 0, newVacio = 0;

  for (const t of TARGETS) {
    const r = await runOne(t);
    const prev = V57B[t.id];
    const wasBad = !OK_CATS.has(prev.cat);
    const isOk = OK_CATS.has(r.cat);
    const regressed = OK_CATS.has(prev.cat) && !isOk;

    if (t.label === 'C-fix') {
      if (isOk) cfixPassed++; else cfixFailed++;
    } else {
      if (regressed) guardRegressed++;
    }
    if (r.cat === 'VACIO') newVacio++;

    const tag = t.label === 'C-fix'
      ? (isOk ? 'CORREGIDO ✓' : `SIGUE MAL ✗ (${r.cat})`)
      : (regressed ? `REGRESION ✗ (${prev.cat}→${r.cat})` : `OK (${r.cat})`);

    console.log(
      `ID ${String(t.id).padStart(3)} [${t.label.padEnd(5)}] [${r.pv}] | ${r.oficio.padEnd(22)} | ` +
      `cat:${r.cat.padEnd(16)} n_cat:${r.n_cat}/${r.n_tot} | ${tag}`
    );
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('RESUMEN');
  console.log(`${'='.repeat(80)}`);
  console.log(`Casos C corregidos: ${cfixPassed}/4`);
  console.log(`Casos C sin corregir: ${cfixFailed}/4`);
  console.log(`Guardias regresionados: ${guardRegressed}/6`);
  console.log(`VACIO nuevos: ${newVacio}`);

  if (cfixFailed > 0) { console.log('\n⚠ Fix incompleto — revisar casos no corregidos'); process.exit(1); }
  if (guardRegressed > 0) { console.log('\n⚠ REGRESION en guardias — ROLLBACK'); process.exit(2); }
  if (newVacio > 0) { console.log('\n⚠ VACIO nuevo — ROLLBACK'); process.exit(3); }
  console.log('\n✓ Corrección validada. Listo para 400 tests completos.');
}

main().catch(e => { console.error(e); process.exit(1); });
