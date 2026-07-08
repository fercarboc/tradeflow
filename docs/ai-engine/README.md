# Motor IA TradeFlow — Documentación Técnica

Documentación oficial del motor de generación de presupuestos por voz.
Edge Function: `trade-voice-to-quote` | Benchmark: `trade-benchmark-runner`

---

## Índice

| Documento | Descripción |
|---|---|
| [RELEASE_NOTES_v59.md](RELEASE_NOTES_v59.md) | Release Notes de producción — v59 (2026-07-05) |
| [CHANGELOG.md](CHANGELOG.md) | Historial técnico de versiones con métricas de benchmark |
| [BENCHMARK_SYSTEM_DESIGN.md](BENCHMARK_SYSTEM_DESIGN.md) | Sistema oficial de validación IA — metodología, taxonomía, métricas (BM-2026-001) |
| [PROMOTION_CRITERIA.md](PROMOTION_CRITERIA.md) | Criterios de promoción RC → Producción y criterios de rollback |
| [SPRINT3_CLOSURE.md](SPRINT3_CLOSURE.md) | Cierre oficial de Sprint 3 — entregables y decisiones |
| [SPRINT4_PLAN.md](SPRINT4_PLAN.md) | Plan operativo de Sprint 4 — P1 completado, Sprint cerrado |

---

## Estado actual (2026-07-05)

| Rol | Versión | OK% | VACÍO | TRUNC | P.INV | P95 lat | Edge Fn |
|---|---|---|---|---|---|---|---|
| Baseline histórica | v56-stable | 93.2% | 0 | 4 | 1 | — | v63 |
| Rollback | v57b | 92.2% | 2 | 0 | 0 | — | v63 |
| **Producción** | **v59** | **98.2%**¹ | **1²** | **0** | **0** | **30.6s ⚠️** | v65 |

¹ Presupuestos generados (OK_CATALOGO + OK_MIXTO + SOLO_SUGERIDAS). Con precios de catálogo: 92.5%.
² VACÍO residual irreducible: tokens_out=8192 (límite absoluto del modelo). Excepción aceptada.

> ⚠️ Latencia P95 en umbral de alerta (30s). Monitorizar en producción.

---

## Regla fundamental

> Si cualquier cambio toca el prompt o la lógica de kbContext, un benchmark completo de 400 casos es obligatorio antes del despliegue. Sin excepción.
