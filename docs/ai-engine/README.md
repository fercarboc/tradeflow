# Motor IA TradeFlow — Documentación Técnica

Documentación oficial del motor de generación de presupuestos por voz.
Edge Function: `trade-voice-to-quote` | Benchmark: `trade-benchmark-runner`

---

## Índice

| Documento | Descripción |
|---|---|
| [CHANGELOG.md](CHANGELOG.md) | Historial de versiones con métricas de benchmark |
| [PROMOTION_CRITERIA.md](PROMOTION_CRITERIA.md) | Criterios de promoción RC → Producción y criterios de rollback |
| [SPRINT3_CLOSURE.md](SPRINT3_CLOSURE.md) | Cierre oficial de Sprint 3 — entregables y decisiones |
| [SPRINT4_PLAN.md](SPRINT4_PLAN.md) | Plan operativo de Sprint 4 con checklist pre-sprint |

---

## Estado actual (2026-07-05)

| Rol | Versión | OK% | VACÍO | TRUNC | P.INV | Edge Fn |
|---|---|---|---|---|---|---|
| Baseline histórica | v56-stable | 93.2% | 0 | 4 | 1 | v63 |
| Producción | v57b | 92.2% | 2 | 0 | 0 | v63 |
| Release Candidate | v59 | pendiente | — | — | — | v65 |

> v59 = P1 Sprint 4 (`max_tokens: 8192` siempre). Benchmark de 400 casos pendiente de ejecución.

---

## Regla fundamental

> Si cualquier cambio toca el prompt o la lógica de kbContext, un benchmark completo de 400 casos es obligatorio antes del despliegue. Sin excepción.
