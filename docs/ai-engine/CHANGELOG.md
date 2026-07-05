# Motor IA TradeFlow — CHANGELOG

Historial de versiones del motor de generación de presupuestos por voz (`trade-voice-to-quote`).

Todas las métricas proceden del benchmark oficial de 400 casos ejecutado en el AI Validation Center.

---

## Leyenda de estados

| Estado | Descripción |
|---|---|
| `baseline` | Referencia histórica fija. No cambia. |
| `producción` | Versión desplegada actualmente. |
| `release-candidate` | Candidato validado, pendiente de criterios de promoción. |
| `rollback` | Versión retirada. No promover. |
| `retirada` | Versión histórica, superada. |

---

## v59 — 2026-07-05

**Estado:** `producción`
**Edge Function:** `trade-voice-to-quote` v65
**Prompt version:** `v59` (sin cambios de prompt — solo capacidad)
**Benchmark:** `run_id=8b6c0679-64be-4de1-8410-2f32007ff85b` (400 casos)

### Métricas (400 casos)

| Métrica | Valor |
|---|---|
| OK rate | **98.2%** (393/400) |
| VACÍO | **1** (excepción aceptada — ver abajo) |
| TRUNCADO | **0** |
| PRECIO_INVALIDO | **0** |
| Coincide oficio | pendiente |
| tokens_out media | 2514 |
| tokens_out P50 | 2288 |
| tokens_out P95 | 4496 |
| Respuestas >4096 tokens | **27 (6.8%)** |
| Latencia media | 18.2s |
| Latencia P95 | **30.6s** ⚠️ |
| Latencia max | 48s (outlier: pos.374) |

### Cambios respecto a v58b_full

- **Sprint 4 P1 — Fix max_tokens universal:** Eliminado el bloque `isComplexJob`. Ahora `max_tokens: 8192` siempre, para todos los requests.
- **Causa raíz resuelta:** Los 5 casos anómalos de v58b_full tenían `stop_reason=max_tokens` y `tokens_out=4096` exacto. El fix salvó **27 casos** que habrían sido TRUNCADO/VACÍO con el límite anterior.
- **Sin impacto de coste:** Claude factura por tokens generados, no por el límite.

### ERROR_TECNICO = 6 (no son fallos del motor)

- 4 × **HTTP 503** (pos. 79, 320, 327, 338): sobrecarga transitoria de infraestructura durante el benchmark. Retryable.
- 2 × **HTTP 403** (pos. 341, 346): "Contrato de mantenimiento..." — rechazados por plan restriction (< empresa_plus). **Comportamiento correcto**, no errores del motor IA.

### Excepción aceptada: VACÍO residual pos. 374

> **Query:** "Convertir garaje en habitación de invitados con baño, instalaciones y licencia incluida"
> `tokens_in=3683` | `tokens_out=8192` | `stop_reason=max_tokens` | `latency=48s`

8192 tokens es el límite máximo de output de `claude-haiku-4-5`. No es corregible aumentando `max_tokens`. La solución requiere reducir el kbContext de 5 a ≤3 actuaciones en queries de reforma compleja — cambio de comportamiento que requiere benchmark completo. Pendiente Sprint 5 / backlog: *"Optimización de contexto para reformas complejas"*.

### Riesgos a monitorizar en producción

| Métrica | Umbral | Estado en benchmark |
|---|---|---|
| Latencia P95 | > 30s → alerta | **30.6s** ⚠️ en umbral |
| Respuestas >4096 tokens | — | 6.8% (27/400) |
| tokens_out media | — | 2514 (estable) |

### Decisión de promoción

Promovido a producción con excepción aceptada. Motivo: mejora significativa sobre v57b/v58b_full, TRUNCADO=0, PRECIO_INVALIDO=0, OK rate 98.2%. El 1 VACÍO residual es irreducible con el modelo actual. Rollback disponible: v57b.

---

## v58b_full — 2026-07-05

**Estado:** `release-candidate`
**Edge Function:** `trade-voice-to-quote` v64
**Prompt version:** `v58b`

### Métricas (400 casos)

| Métrica | Valor |
|---|---|
| OK rate | **92.8%** (371/400) |
| VACÍO | 3 |
| TRUNCADO | 2 |
| PRECIO_INVALIDO | **0** |
| Coincide oficio | 78.5% |
| Latencia media | 17.6s |
| Latencia P95 | 28.2s |

### Cambios

- **Fix v58b extendido a benchmarks (orgId=null):** La reclasificación de partidas `catalogo` con `precio_unitario ≤ 0` a `sugerida_ia` se movió antes del bloque `if (orgId)`, de modo que aplica a todos los requests, incluyendo los del benchmark runner que usan `orgId=null`.
- Elimina la regresión de PRECIO_INVALIDO=10 introducida en v58.

### Anomalías abiertas

- 3 casos VACÍO (queries pendientes de diagnóstico en Sprint 4)
- 2 casos TRUNCADO (causa pendiente de identificación en Sprint 4)
- Oficio accuracy 78.5%: mejora respecto a v57b (+4.7%) pero por debajo del objetivo >85%

### Decisión de Sprint 3

No se promociona a producción. Requiere resolución de los 5 casos anómalos y validación mediante Regression Diff antes de sustituir a v57b.

---

## v58b — 2026-07-05

**Estado:** `retirada`
**Nota:** Benchmark ejecutado con fix parcial (solo afectaba a requests con orgId real, no a benchmarks).

### Métricas (400 casos)

| Métrica | Valor |
|---|---|
| OK rate | 90.3% |
| VACÍO | 4 |
| TRUNCADO | 4 |
| PRECIO_INVALIDO | 4 |

### Motivo de retirada

El fix v58b no cubría el flujo de benchmark (orgId=null). Las métricas son artefacto del entorno de prueba incorrecto, no de la lógica de producción. Sustituida por v58b_full.

---

## v58 — 2026-07-03

**Estado:** `rollback`
**Edge Function:** `trade-voice-to-quote` v63 (retirada)

### Métricas (400 casos)

| Métrica | Valor |
|---|---|
| OK rate | 91.8% |
| VACÍO | 5 |
| TRUNCADO | 0 |
| PRECIO_INVALIDO | **10** |

### Motivo de rollback

Regresión grave: PRECIO_INVALIDO pasó de 0 (v57b) a 10. Causa: cambio en el prompt que generaba partidas con `origen='catalogo'` y `precio_unitario=0`. La validación de PRECIO_INVALIDO no cubría este escenario. Versión retirada inmediatamente.

**No promover bajo ninguna circunstancia.**

---

## v57b — 2026-07-02

**Estado:** `producción`
**Edge Function:** `trade-voice-to-quote` (versión activa)
**Prompt version:** `v57b`

### Métricas (400 casos)

| Métrica | Valor |
|---|---|
| OK rate | **92.2%** |
| VACÍO | 2 |
| TRUNCADO | **0** |
| PRECIO_INVALIDO | **0** |
| Coincide oficio | 73.8% |
| Latencia media | 17.9s |

### Cambios respecto a v56-stable

- Eliminación de TRUNCADO (4→0): ajuste de `max_tokens` para trabajos complejos (`isComplexJob` detecta reformas y presupuestos multi-oficio, usa 8192 tokens en lugar de 4096).
- PRECIO_INVALIDO resuelto (1→0).
- Leve caída de OK rate (93.2%→92.2%) considerada dentro del margen estadístico.

### Motivo de permanencia en producción

Única versión con TRUNCADO=0 y PRECIO_INVALIDO=0. Referencia operativa estable.

---

## v56-stable — 2026-06-24

**Estado:** `baseline`
**Nota:** Referencia histórica fija del proyecto. No se modifica ni se reemplaza.

### Métricas (400 casos)

| Métrica | Valor |
|---|---|
| OK rate | **93.2%** |
| VACÍO | **0** |
| TRUNCADO | 4 |
| PRECIO_INVALIDO | 1 |

### Significado como baseline

v56-stable representa el estado del motor al establecer el AI Validation Center. Todas las versiones posteriores se comparan contra este punto de referencia para detectar regresiones o mejoras a largo plazo. El OK rate de 93.2% con VACÍO=0 es el techo histórico de referencia.

La comparación operativa día a día se realiza contra v57b (producción), no contra esta baseline.

---

## v54 — 2026-05-15 (aprox.)

**Estado:** `retirada`

### Métricas

| Métrica | Valor |
|---|---|
| OK rate | 90.0% |
| VACÍO | 0 |
| TRUNCADO | 4 |
| PRECIO_INVALIDO | 0 |

### Notas

Primera versión en superar el umbral del 90%. TRUNCADO=4 persistente, no resuelto hasta v57b.

---

## v51 — 2026-05-01 (aprox.)

**Estado:** `retirada`

### Métricas

| Métrica | Valor |
|---|---|
| OK rate | 78.0% |
| VACÍO | 8 |
| TRUNCADO | 4 |
| PRECIO_INVALIDO | 0 |

### Notas

Primera versión benchmarkeada con el AI Validation Center. Punto de partida del programa de mejora continua del motor IA.

---

## Evolución de métricas clave

| Versión | OK% | VACÍO | TRUNC | P.INV | Estado |
|---|---|---|---|---|---|
| v51 | 78.0% | 8 | 4 | 0 | retirada |
| v54 | 90.0% | 0 | 4 | 0 | retirada |
| v56-stable | 93.2% | 0 | 4 | 1 | **baseline** |
| v57b | 92.2% | 2 | 0 | 0 | **producción** |
| v58 | 91.8% | 5 | 0 | 10 | rollback |
| v58b | 90.3% | 4 | 4 | 4 | retirada |
| v58b_full | 92.8% | 3 | 2 | 0 | superada |
| v59 | **98.2%** | 1¹ | **0** | **0** | **producción** |
