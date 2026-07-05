# Sprint 4 — Plan Operativo Oficial

**Apertura:** 2026-07-05
**Estado de partida:**
- Producción: v57b
- Baseline histórica: v56-stable
- Release Candidate: v58b_full (5 anomalías abiertas)

---

## Checklist pre-Sprint 4

Estas tareas deben completarse antes de iniciar cualquier tarea de desarrollo.

- [x] Verificar versión desplegada — se detectó v64 (v58b_full) en lugar de v57b; evaluado y aceptado (no-op para orgId real)
- [x] Registrar v58b_full en `trade_ai_versions` con `es_release_candidate=true` (migración `20260705_ai_versions_release_candidate.sql`)
- [x] Añadir distinción visual en la pestaña Versiones: badges baseline/producción/RC + leyenda + enlace criterios
- [x] Analizar los 5 casos anómalos: causa raíz identificada (`max_tokens=4096` insuficiente con kbContext de 5 actuaciones)
- [x] Aplicar fix P1 (`max_tokens: 8192` siempre) — desplegado como v65/v59
- [x] Ejecutar benchmark completo de 400 casos con v59 — resultado: VACÍO=1 (excepción aceptada), TRUNCADO=0, OK=98.2%
- [x] Registrar v59 en `trade_ai_versions` como producción (semaforo=verde)
- [x] Promover v59 — decisión del producto: excepción aceptada en VACÍO=1 por límite absoluto del modelo
- [ ] Smoke test E2E: request real con orgId real, verificar presupuesto correcto sin PRECIO_INVALIDO (pendiente)
- [ ] Monitorizar latencia P95 en producción (umbral alerta 30s — benchmark marcó 30.6s)
- [ ] **Backlog Sprint 5:** "Optimización de contexto para reformas complejas" — reducir kbContext a ≤3 actuaciones cuando tokens_in supere umbral → resolver VACÍO residual pos.374

---

## Prioridades

---

### P1 — Resolver los 5 casos anómalos

**Objetivo:** Identificar causa raíz y aplicar fix quirúrgico. Sin tocar el resto del motor.

**Scope:** Exclusivamente los 3 VACÍO y 2 TRUNCADO de v58b_full.

#### Análisis previo (no es desarrollo)

Para cada uno de los 5 casos, extraer de BD y revisar:

| Campo | Fuente |
|---|---|
| query (texto original) | `trade_benchmark_queries.texto` |
| oficio_esperado / oficio_detectado | `trade_benchmark_results` |
| tokens_in / tokens_out | `trade_benchmark_results.raw_response` |
| finish_reason / stop_reason | `trade_benchmark_results.stop_reason` |
| raw_response completo | `trade_benchmark_results.raw_response` |
| kbContext generado | reconstruir con el transcript real |
| prompt completo enviado a Claude | reconstruir con kbContext + transcript |
| presupuesto final (quote) | extraer de raw_response |

Para los 2 TRUNCADO: si `tokens_out == max_tokens`, el modelo fue cortado. Si no, la clasificación TRUNCADO es incorrecta. Verificar esto primero.

Para los 3 VACÍO: verificar si `partidas: []` o si el JSON parse falló (EMPTY_QUOTE). Son causas distintas con soluciones distintas.

#### Regla de oro

> Si el fix requiere modificar el prompt o la lógica de kbContext, es obligatorio ejecutar un benchmark completo de 400 casos antes de cualquier despliegue. El fix deja de ser quirúrgico en ese momento.

#### Criterio de éxito

- VACÍO = 0 en el nuevo benchmark de validación.
- TRUNCADO = 0 en el nuevo benchmark de validación.
- OK rate ≥ 92.8% (no regresionar respecto a v58b_full).
- PRECIO_INVALIDO = 0.

---

### P2 — Regression Diff MVP en AI Validation Center

**Objetivo:** Poder comparar dos ejecuciones caso a caso para validar que un cambio mejora sin empeorar.

**Scope MVP (no ampliar):**

- Selección de versión A (referencia) y versión B (candidato).
- Tabla con una fila por query: query, clasificación A, clasificación B, resultado (mejorado / empeorado / sin cambio).
- Filtro por resultado: ver solo los mejorados, solo los empeorados, o todos.
- Contador resumen: N mejorados, N empeorados, balance neto.
- Sin gráficos, sin exportación, sin filtros adicionales en esta iteración.

**Por qué en P2:** El Regression Diff es el prerequisito para ejecutar P3 y P4 de forma segura. Sin él, cualquier cambio en el motor es una apuesta.

**Criterio de éxito:** Es posible comparar v57b vs v58b_full caso a caso desde la UI sin errores.

---

### P3 — Dashboard de observabilidad del motor IA

**Objetivo:** Visibilidad en tiempo real del comportamiento del motor en producción.

**Scope MVP:**

| Métrica | Fuente de datos |
|---|---|
| Tokens (in / out) | `trade_ai_usage.metadata` |
| Latencia (media, P50, P95) | `trade_ai_usage.metadata` o logs |
| Errores (tasa HTTP 5xx) | Supabase Edge Function logs |
| finish_reason / stop_reason | `trade_ai_usage.metadata` |
| Versión IA activa | `trade_ai_usage.metadata.prompt_version` |
| Modelo utilizado | `trade_ai_usage.metadata.model` |
| % VACÍO | calculado sobre requests totales |
| % TRUNCADO | calculado sobre requests totales |
| PRECIO_INVALIDO | solo disponible en benchmark, no en producción |

**Coste (cálculo €/request):** Fuera del MVP de Sprint 4. Requiere instrumentación adicional (tokens × precio por modelo). Se deja como deuda técnica para Sprint 4.1 o Sprint 5.

**Relación con P5 (SLA):**

- P3 construye la infraestructura de visualización: muestra los datos brutos de latencia (media, P50, P95).
- P5 añade los umbrales, colores de alerta y notificaciones sobre lo que P3 ya muestra.
- P3 no implementa alertas. P5 no reimplementa visualización.

**Criterio de éxito:** El dashboard muestra los últimos 7 días de actividad del motor IA con los campos del MVP sin errores.

---

### P4 — Mejorar detección de oficio con evidencia real

**Objetivo:** Reducir el 21.5% de fallos en detección de oficio usando únicamente patrones observados en los casos fallidos del benchmark.

**Proceso:**

1. Extraer de BD todos los casos donde `coincide_oficio = false` en v58b_full (85 casos).
2. Agrupar por par (`oficio_esperado`, `oficio_detectado`): ¿hay pares dominantes?
3. Si un par aparece ≥ 10 veces → candidato a regla determinista en `OFICIO_KEYWORD_RULES`.
4. Si los 85 casos son dispersos → no añadir reglas. Documentar y cerrar.

**Restricciones:**

- No añadir reglas por intuición. Solo por evidencia estadística.
- Cualquier regla añadida debe validarse con el Regression Diff (P2) antes de desplegarse.
- Si los patrones solo se corrigen con cambio de prompt → benchmark completo obligatorio.

**Criterio de éxito:** Coincide oficio ≥ 80% en el benchmark de validación, sin regresión en OK rate.

---

### P5 — SLA de latencia y alertas

**Objetivo:** Definir umbrales operativos y activar alertas cuando se incumplan.

**Definición de SLA (propuesta para aprobación):**

| Percentil | Umbral objetivo | Umbral de alerta |
|---|---|---|
| P50 | < 15s | > 20s |
| P95 | < 25s | > 30s |
| Timeout máximo | 45s (cliente) | — |

**Implementación:**

- Los datos de latencia los provee P3 (dashboard de observabilidad).
- P5 añade sobre ese dashboard: colores de estado (verde/amarillo/rojo), definición de umbrales en configuración, y alertas cuando P95 supere el umbral de alerta.
- Timeout máximo: debe implementarse en dos sitios: servidor (ya existe `max_tokens` como proxy) y cliente (no existe actualmente — el frontend no tiene timeout explícito en el request al motor IA).

**Criterio de éxito:** El dashboard muestra el estado del SLA en tiempo real. Si P95 supera 30s, el panel lo indica visualmente.

---

### P6 — Correlacionar benchmark con producción real

**Objetivo:** Verificar que los 400 casos del benchmark representan el tráfico real de instaladores.

**Proceso:**

1. Extraer de `trade_ai_usage` los oficios y patrones de los últimos 30 días de producción.
2. Extraer de `trade_ai_feedback` los casos confirmados o corregidos por instaladores.
3. Comparar distribución de oficios en producción vs distribución en el benchmark.
4. Identificar oficios o patrones de lenguaje ausentes en el benchmark.

**Output esperado:** Informe (no código). Si el benchmark no es representativo, el rediseño parcial de los 400 casos es trabajo para Sprint 5, no Sprint 4.

**Criterio de éxito:** Informe redactado con porcentaje de cobertura del benchmark sobre el tráfico real.

---

## Reglas operativas del Sprint

1. Ninguna tarea de P3 a P6 se inicia sin el Regression Diff (P2) disponible para validar cambios.
2. Cualquier modificación al prompt o al kbContext activa automáticamente la obligación de benchmark completo de 400 antes del despliegue.
3. Al finalizar Sprint 4, si v58b_full cumple todos los criterios de `PROMOTION_CRITERIA.md`, se promueve a producción. Si no los cumple, permanece como RC.
4. El estado de v57b en producción no cambia hasta que exista un candidato que cumpla todos los criterios sin excepción.

---

## Artefactos a producir en Sprint 4

| Artefacto | Tipo | Ubicación |
|---|---|---|
| Informe de análisis de 5 anomalías | Documento | `docs/ai-engine/anomaly-analysis-sprint4.md` |
| Regression Diff en AI Validation Center | Feature UI | `src/components/admin/AdminAIValidationSection.tsx` |
| Dashboard de observabilidad IA | Feature UI | `src/components/admin/AdminAIValidationSection.tsx` |
| Informe de correlación benchmark ↔ producción | Documento | `docs/ai-engine/benchmark-coverage-sprint4.md` |
| Benchmark completo post-fix P1 | Ejecución | AI Validation Center → Ejecuciones |
| CHANGELOG actualizado | Documento | `docs/ai-engine/CHANGELOG.md` |
