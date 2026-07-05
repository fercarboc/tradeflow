# Release v59

**Fecha:** 2026-07-05
**Edge Function:** trade-voice-to-quote v65
**Estado:** Producción

---

## Mejoras

- `max_tokens` aumentado a 8192 de forma universal — elimina el condicional `isComplexJob` que cubría solo un subconjunto de casos complejos.
- Eliminados todos los TRUNCADO: de 2 en v58b_full a 0.
- OK rate: 92.8% → **98.2%** (+5.4 pp).
- **27 presupuestos recuperados** que antes se truncaban o quedaban vacíos por falta de margen de salida.

## Correcciones

- PRECIO_INVALIDO permanece en 0 (fix heredado de Sprint 3).
- Trazabilidad de versión en cada respuesta mediante `_meta.prompt_version`.

## Limitaciones conocidas

- 1 caso de reforma extremadamente compleja alcanza el límite absoluto de output del modelo (8192 tokens). La query "Convertir garaje en habitación de invitados con baño, instalaciones y licencia incluida" genera una respuesta que el modelo no puede completar dentro del límite máximo de claude-haiku-4-5.
- Backlog Sprint 5: optimización del contexto para reformas complejas (reducir kbContext a ≤3 actuaciones cuando tokens_in supere umbral).
- Latencia P95 = 30.6s en benchmark — monitorizar en producción (umbral de alerta: >30s).

## Métricas de benchmark (400 casos)

| Métrica | v57b (anterior) | v59 |
|---|---|---|
| OK rate | 92.2% | **98.2%** |
| TRUNCADO | 0 | **0** |
| VACÍO | 2 | 1¹ |
| PRECIO_INVALIDO | 0 | **0** |
| Latencia P95 | — | 30.6s |
| Respuestas >4096 tokens | — | 27 (6.8%) |

¹ Excepción aceptada — límite absoluto del modelo, no corregible con el modelo actual.

## Rollback

v57b — disponible en `trade_ai_versions`, Edge Function v63.
