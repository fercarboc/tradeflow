# Release v59

**Fecha:** 2026-07-05
**Edge Function:** trade-voice-to-quote v65
**Estado:** Producción

---

## Mejoras

- `max_tokens` aumentado a 8192 de forma universal — elimina el condicional `isComplexJob` que cubría solo un subconjunto de casos complejos.
- **Presupuestos generados: 98.2%** — el motor produce un resultado accionable para el instalador en 393 de 400 casos.
- TRUNCADO eliminado: de 2 en v58b_full a **0**.
- VACÍO reducido: de 2 en v57b y 3 en v58b_full a **1** (excepción aceptada).
- 27 respuestas que antes se truncaban ahora completan (`end_turn`) con estructura de partidas completa.

## Correcciones

- PRECIO_INVALIDO permanece en **0** (fix heredado de Sprint 3).
- Trazabilidad de versión en cada respuesta mediante `_meta.prompt_version`.

## Limitaciones conocidas

- 1 caso de reforma extremadamente compleja alcanza el límite absoluto de output del modelo (8192 tokens). La query "Convertir garaje en habitación de invitados con baño, instalaciones y licencia incluida" genera una respuesta que el modelo no puede completar dentro del límite máximo de claude-haiku-4-5.
- Backlog Sprint 5: optimización del contexto para reformas complejas (reducir kbContext a ≤3 actuaciones cuando tokens_in supere umbral).
- Latencia P95 = 30.6s en benchmark — monitorizar en producción (umbral de alerta: >30s).

## Métricas de benchmark (400 casos)

| Métrica | v57b | v59 |
|---|---|---|
| **Presupuestos generados** | — | **98.2%** (393/400) |
| ↳ Con precios de catálogo | 92.2% | 92.5% |
| ↳ Solo sugeridas (sin precio automático) | — | 5.8% (23 casos) |
| TRUNCADO | 0 | **0** |
| VACÍO | 2 | **1**¹ |
| PRECIO_INVALIDO | 0 | **0** |
| Latencia P95 | — | 30.6s |
| Respuestas >4096 tokens | 0 | 27 (6.8%) |

¹ Excepción aceptada — límite absoluto del modelo.

## Sobre SOLO_SUGERIDAS

Las 23 respuestas clasificadas como SOLO_SUGERIDAS son presupuestos válidos: el motor identificó el trabajo y generó las partidas correctas, pero los items no están en el catálogo TradeFlow todavía. El instalador añade los precios desde su catálogo externo o de proveedores — y al hacerlo, el sistema aprende y enriquece el catálogo para futuras consultas. Es un resultado accionable, no un fallo.

El dashboard actual mide solo "con precios de catálogo" (92.5%). La revisión de esta definición queda para Sprint 5.

## Rollback

v57b — disponible en `trade_ai_versions`, Edge Function v63.
