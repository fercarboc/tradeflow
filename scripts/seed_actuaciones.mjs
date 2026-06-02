// Script to parse actuaciones docs and generate SQL inserts
import { readFileSync } from 'fs';

function parseActuaciones(text, oficio) {
  const blocks = text.split(/\nACTUACION: /).slice(1);
  const result = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    const actuacion_id = lines[0].trim();

    const get = (key) => {
      const line = lines.find(l => l.startsWith(key + ':'));
      return line ? line.slice(key.length + 1).trim() : '';
    };

    const toArr = (val) => val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];

    const palabras_clave = toArr(get('PALABRAS_CLAVE'));
    const partidas_obligatorias = toArr(get('PARTIDAS_OBLIGATORIAS'));
    const partidas_auxiliares = toArr(get('PARTIDAS_AUXILIARES'));
    const reglas_calculo = get('REGLAS_CALCULO').replace(/'/g, "''");
    const unidad = get('UNIDAD').replace(/'/g, "''");
    const observaciones = get('OBSERVACIONES').replace(/'/g, "''");

    const escape = (s) => s.replace(/'/g, "''");
    const arrSql = (arr) => 'ARRAY[' + arr.map(s => `'${escape(s)}'`).join(',') + ']';

    result.push(
      `('${oficio}','${escape(actuacion_id)}',${arrSql(palabras_clave)},${arrSql(partidas_obligatorias)},${arrSql(partidas_auxiliares)},'${reglas_calculo}','${unidad}','${observaciones}')`
    );
  }
  return result;
}

const oficios = [
  { file: 'fontaneria.txt',   oficio: 'fontaneria' },
  { file: 'electricidad.txt', oficio: 'electricidad' },
  { file: 'pintura.txt',      oficio: 'pintura' },
  { file: 'pladur.txt',        oficio: 'pladur_escayola' },
  { file: 'climatizacion.txt',      oficio: 'climatizacion' },
  { file: 'albañileria.txt',        oficio: 'albanileria' },
  { file: 'persianas.txt',          oficio: 'persianas' },
  { file: 'suelos_alicatados.txt',  oficio: 'suelos_alicatados' },
  { file: 'cerrajeria.txt',         oficio: 'cerrajeria' },
  { file: 'cristaleria.txt',        oficio: 'cristaleria' },
  { file: 'fachadas.txt',           oficio: 'fachadas' },
  { file: 'cubiertas.txt',          oficio: 'cubiertas' },
  { file: 'carpinteria.txt',        oficio: 'carpinteria' },
  { file: 'reformas_integrales.txt',oficio: 'reformas_integrales' },
  { file: 'impermeabilizacion.txt', oficio: 'impermeabilizacion' },
  { file: 'jardineria.txt',         oficio: 'jardineria' },
  { file: 'mantenimiento_general.txt', oficio: 'mantenimiento_general' },
  { file: 'energia_solar.txt',         oficio: 'energia_solar' },
  { file: 'telecomunicaciones.txt',    oficio: 'telecomunicaciones' },
  { file: 'contra_incendios.txt',      oficio: 'contra_incendios' },
];

const targetOficio = process.argv[2]; // optional filter: e.g. "pintura"

const rows = [];
for (const { file, oficio } of oficios) {
  if (targetOficio && oficio !== targetOficio) continue;
  try {
    const text = readFileSync(`c:/tradeflow/docs/oficios/${file}`, 'utf8');
    const parsed = parseActuaciones(text, oficio);
    console.log(`${oficio}: ${parsed.length} actuaciones`);
    rows.push(...parsed);
  } catch (e) {
    console.warn(`Skipping ${file}: ${e.message}`);
  }
}

console.log(`Total actuaciones: ${rows.length}`);

// Output in batches of 50
const batchSize = 50;
for (let i = 0; i < rows.length; i += batchSize) {
  const batch = rows.slice(i, i + batchSize);
  const sql = `INSERT INTO trade_actuaciones (oficio, actuacion_id, palabras_clave, partidas_obligatorias, partidas_auxiliares, reglas_calculo, unidad, observaciones) VALUES\n${batch.join(',\n')}\nON CONFLICT (actuacion_id) DO NOTHING;`;
  console.log(`\n--- BATCH ${Math.floor(i/batchSize)+1} ---`);
  console.log(sql);
}
