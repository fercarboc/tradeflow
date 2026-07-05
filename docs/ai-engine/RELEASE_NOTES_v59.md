# Release v59

**Fecha:** 2026-07-05
**Edge Function:** trade-voice-to-quote v65
**Estado:** Producción

---

## Mejoras

- `max_tokens` aumentado a 8192 de forma universal — elimina el condicional `isComplexJob` que cubría solo un subconjunto de casos complejos.
- TRUNCADO eliminado: de 2 en v58b_full a **0**.
- VACÍO reducido: de 2 en v57b y 3 en v58b_full a **1** (excepción aceptada).
- 27 respuestas que antes se truncaban ahora completan (`end_turn`) — se convierten en SOLO_SUGERIDAS (presupuesto generado, precios pendientes de revisión del instalador).

## Correcciones

- PRECIO_INVALIDO permanece en **0** (fix heredado de Sprint 3).
- Trazabilidad de versión en cada respuesta mediante `_meta.prompt_version`.

## Limitaciones conocidas

- 1 caso de reforma extremadamente compleja alcanza el límite absoluto de output del modelo (8192 tokens). La query "Convertir garaje en habitación de invitados con baño, instalaciones y licencia incluida" genera una respuesta que el modelo no puede completar dentro del límite máximo de claude-haiku-4-5.
- Backlog Sprint 5: optimización del contexto para reformas complejas (reducir kbContext a ≤3 actuaciones cuando tokens_in supere umbral).
- Latencia P95 = 30.6s en benchmark — monitorizar en producción (umbral de alerta: >30s).

## Métricas de benchmark (400 casos)

| Métrica | v57b (anterior) | v59 |
|---|---|---|
| OK rate (OK_CATALOGO + OK_MIXTO) | 92.2% | **92.5%** |
| SOLO_SUGERIDAS | — | 23 (5.8%) |
| TRUNCADO | 0 | **0** |
| VACÍO | 2 | **1**¹ |
| PRECIO_INVALIDO | 0 | **0** |
| Latencia P95 | — | 30.6s |
| Respuestas >4096 tokens | — | 27 (6.8%) |

¹ Excepción aceptada — límite absoluto del modelo, no corregible con el modelo actual.

## Nota sobre SOLO_SUGERIDAS

Las 27 respuestas que antes se truncaban ahora completan correctamente. Al ser queries complejas de reforma sin match exacto en catálogo, Claude genera partidas con `origen=sugerida_ia` (requieren que el instalador revise precios). Esto es preferible a un presupuesto truncado o vacío: el instalador recibe la estructura de trabajo y solo tiene que completar precios.

## Rollback

v57b — disponible en `trade_ai_versions`, Edge Function v63.
