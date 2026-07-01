import * as XLSX from 'xlsx';
import type { TestResult, Category } from './types.js';

const CATEGORIES: Category[] = [
  'OK_CATALOGO',
  'OK_MIXTO',
  'SOLO_SUGERIDAS',
  'VACIO',
  'ERROR_TECNICO',
  'PRECIO_INVALIDO',
];

export async function generateExcel(results: TestResult[], outputPath: string): Promise<void> {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Resultados (all 400 rows) ──────────────────────────────────
  const detailRows = results.map(r => ({
    ID: r.id,
    Oficio: r.oficio,
    Texto: r.texto,
    HTTP: r.http_status,
    Latencia_ms: r.latency_ms,
    Categoria: r.classification.category,
    N_Partidas: r.classification.n_partidas,
    N_Catalogo: r.classification.n_catalogo,
    N_Sugeridas: r.classification.n_sugeridas,
    Oficio_Detectado: r.classification.oficio_detectado,
    Coincide_Oficio: r.classification.coincide_oficio,
    Error_Detalle: r.classification.error_detalle ?? '',
  }));

  const wsDetail = XLSX.utils.json_to_sheet(detailRows);

  // Column widths
  wsDetail['!cols'] = [
    { wch: 6 },  // ID
    { wch: 24 }, // Oficio
    { wch: 60 }, // Texto
    { wch: 6 },  // HTTP
    { wch: 12 }, // Latencia
    { wch: 16 }, // Categoria
    { wch: 10 }, // N_Partidas
    { wch: 10 }, // N_Catalogo
    { wch: 10 }, // N_Sugeridas
    { wch: 24 }, // Oficio_Detectado
    { wch: 14 }, // Coincide
    { wch: 40 }, // Error
  ];

  XLSX.utils.book_append_sheet(wb, wsDetail, 'Resultados');

  // ── Sheet 2: Resumen (pivot by oficio) ──────────────────────────────────
  const oficios = [...new Set(results.map(r => r.oficio))].sort();

  const resumenRows = oficios.map(oficio => {
    const group = results.filter(r => r.oficio === oficio);
    const total = group.length;
    const counts: Record<string, number> = {};
    for (const cat of CATEGORIES) counts[cat] = 0;
    for (const r of group) counts[r.classification.category]++;

    const ok = (counts['OK_CATALOGO'] ?? 0) + (counts['OK_MIXTO'] ?? 0);
    const coincide = group.filter(r => r.classification.coincide_oficio === 'SI').length;
    const avgLatency = Math.round(group.reduce((s, r) => s + r.latency_ms, 0) / total);

    return {
      Oficio: oficio,
      Total: total,
      OK_CATALOGO: counts['OK_CATALOGO'],
      OK_MIXTO: counts['OK_MIXTO'],
      SOLO_SUGERIDAS: counts['SOLO_SUGERIDAS'],
      VACIO: counts['VACIO'],
      ERROR_TECNICO: counts['ERROR_TECNICO'],
      PRECIO_INVALIDO: counts['PRECIO_INVALIDO'],
      Tasa_OK_pct: `${Math.round((ok / total) * 100)}%`,
      Coincide_Oficio_pct: `${Math.round((coincide / total) * 100)}%`,
      Latencia_Media_ms: avgLatency,
    };
  });

  // Totals row
  const total = results.length;
  const totalCounts: Record<string, number> = {};
  for (const cat of CATEGORIES) totalCounts[cat] = 0;
  for (const r of results) totalCounts[r.classification.category]++;
  const totalOk = (totalCounts['OK_CATALOGO'] ?? 0) + (totalCounts['OK_MIXTO'] ?? 0);
  const totalCoincide = results.filter(r => r.classification.coincide_oficio === 'SI').length;
  const totalAvgLatency = Math.round(results.reduce((s, r) => s + r.latency_ms, 0) / total);

  resumenRows.push({
    Oficio: 'TOTAL',
    Total: total,
    OK_CATALOGO: totalCounts['OK_CATALOGO'],
    OK_MIXTO: totalCounts['OK_MIXTO'],
    SOLO_SUGERIDAS: totalCounts['SOLO_SUGERIDAS'],
    VACIO: totalCounts['VACIO'],
    ERROR_TECNICO: totalCounts['ERROR_TECNICO'],
    PRECIO_INVALIDO: totalCounts['PRECIO_INVALIDO'],
    Tasa_OK_pct: `${Math.round((totalOk / total) * 100)}%`,
    Coincide_Oficio_pct: `${Math.round((totalCoincide / total) * 100)}%`,
    Latencia_Media_ms: totalAvgLatency,
  });

  const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
  wsResumen['!cols'] = [
    { wch: 24 },
    { wch: 7 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 7 },
    { wch: 13 },
    { wch: 14 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  // ── Sheet 3: Errores (VACIO + ERROR_TECNICO + PRECIO_INVALIDO) ──────────
  const errorRows = results
    .filter(r =>
      r.classification.category === 'VACIO' ||
      r.classification.category === 'ERROR_TECNICO' ||
      r.classification.category === 'PRECIO_INVALIDO',
    )
    .map(r => ({
      ID: r.id,
      Oficio: r.oficio,
      Texto: r.texto,
      HTTP: r.http_status,
      Latencia_ms: r.latency_ms,
      Categoria: r.classification.category,
      Error_Detalle: r.classification.error_detalle ?? '',
      Respuesta_Raw: r.raw_response ? JSON.stringify(r.raw_response).slice(0, 300) : '',
    }));

  const wsErrores = XLSX.utils.json_to_sheet(errorRows.length > 0 ? errorRows : [{ Mensaje: 'Sin errores' }]);
  wsErrores['!cols'] = [
    { wch: 6 }, { wch: 24 }, { wch: 60 }, { wch: 6 }, { wch: 12 }, { wch: 16 }, { wch: 40 }, { wch: 60 },
  ];
  XLSX.utils.book_append_sheet(wb, wsErrores, 'Errores');

  XLSX.writeFile(wb, outputPath);
  console.log(`[excel] Guardado: ${outputPath}`);
}
