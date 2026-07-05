# Sprint 3 — Cierre Oficial

**Fecha de cierre:** 2026-07-05
**Estado:** CERRADO Y CONGELADO

---

## Objetivo del Sprint

Construir la infraestructura de validación automatizada del motor IA y corregir la regresión de PRECIO_INVALIDO introducida en v58.

---

## Entregables completados

### AI Validation Center (UI)

- Dashboard con KPIs agregados por ejecución (OK rate, VACÍO, TRUNCADO, PRECIO_INVALIDO, coincidencia oficio, latencia media, P95).
- Tab Casos: listado paginado con filtros por categoría, coincidencia de oficio y oficio esperado. Texto visible en todos los selectores (fix CSS `text-gray-900 bg-white`).
- Tab Comparador: comparación de dos ejecuciones con tabla de KPIs y desglose por oficio. Selectores corregidos. Estado vacío para runs sin datos de oficio.
- Tab Ejecuciones: historial de runs con estado y métricas.
- Tab Ejecutar: formulario de creación de run con selección de benchmark y batch size.
- Pause / Resume en sesión sin recargar página (`abortRef` + `activeBmId` + botón Continuar).
- Fix de React key warning en CasosScreen (Fragment con key explícita).

### Infraestructura de benchmark

- Edge Function `trade-benchmark-runner` v4 operativa.
- Clasificación automática: `OK_CATALOGO | OK_MIXTO | SOLO_SUGERIDAS | VACÍO | TRUNCADO | PRECIO_INVALIDO | ERROR_TECNICO`.
- Políticas RLS correctas: `admin_insert_runs` + `admin_update_runs` para el usuario administrador.
- Función SQL `recompute_run_stats` actualiza KPIs tras cada batch.
- 400 queries importadas en `trade_benchmark_queries` con slugs canónicos de oficio.

### Corrección v58b — fix de PRECIO_INVALIDO

- Identificado: partidas con `origen='catalogo'` y `precio_unitario ≤ 0` pasaban la validación sin ser reclasificadas.
- Causa raíz: el fix inicial estaba dentro de `enrichWithCatalogPrices`, que solo se ejecuta cuando `orgId != null`. Los benchmarks usan `orgId=null`, por lo que el fix nunca se aplicaba.
- Solución: bloque de reclasificación movido antes del `if (orgId)`, aplica a todos los requests.
- Resultado: PRECIO_INVALIDO pasó de 10 (v58) a 0 (v58b_full).

---

## Decisiones de versiones

| Versión | Estado | Justificación |
|---|---|---|
| v56-stable | **Baseline histórica** | Referencia histórica fija. No se modifica. |
| v57b | **Producción** | TRUNCADO=0, PRECIO_INVALIDO=0. Más estable que v58b_full. |
| v58b_full | **Release Candidate** | OK rate superior, PRECIO_INVALIDO=0, pero TRUNCADO=2 sin causa identificada. |
| v58 | Rollback permanente | PRECIO_INVALIDO=10. No promover. |

---

## Estado de métricas al cierre

| Versión | OK% | VACÍO | TRUNC | P.INV | Oficio% |
|---|---|---|---|---|---|
| v57b (prod) | 92.2% | 2 | 0 | 0 | 73.8% |
| v58b_full (RC) | 92.8% | 3 | 2 | 0 | 78.5% |
| v56-stable (base) | 93.2% | 0 | 4 | 1 | — |

---

## Anomalías abiertas al cierre

Estas anomalías no bloquean el cierre del Sprint, pero deben resolverse en Sprint 4 Prioridad 1 antes de cualquier promoción de v58b_full a producción.

| # | Tipo | Cantidad | Estado |
|---|---|---|---|
| 1 | VACÍO | 3 casos | Pendiente de análisis |
| 2 | TRUNCADO | 2 casos | Causa desconocida |

---

## Regla de oro establecida en Sprint 3

> Si el análisis de cualquier anomalía obliga a modificar el prompt o la lógica de construcción del kbContext, el cambio deja de ser quirúrgico y afecta a los 400 casos. En ese escenario, un benchmark completo de 400 casos es obligatorio antes de cualquier despliegue, sin excepción.

---

## Congelación

A partir de esta fecha, la rama de Sprint 3 queda congelada. No se introducirán nuevas funcionalidades ni modificaciones al motor IA en este estado. Cualquier cambio inicia Sprint 4.
