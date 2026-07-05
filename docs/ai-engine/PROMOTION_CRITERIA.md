# Criterios de Promoción y Rollback — Motor IA TradeFlow

**Documento oficial. Válido desde:** 2026-07-05
**Revisión:** Sprint 3 Cierre

---

## Propósito

Definir de forma explícita y medible las condiciones que debe cumplir una versión del motor IA para avanzar entre estados. Elimina la subjetividad en las decisiones de release.

---

## Estados y transiciones

```
pending → release-candidate → producción
                ↓
            rollback
```

---

## 1. Criterios de promoción: pending → Release Candidate

Una versión puede registrarse como Release Candidate si cumple todos los criterios siguientes:

| Criterio | Umbral | Obligatorio |
|---|---|---|
| OK rate ≥ producción actual | ≥ 92.2% (v57b) | Sí |
| PRECIO_INVALIDO | = 0 | Sí, bloqueante |
| VACÍO | ≤ producción actual (≤ 2) | Sí |
| TRUNCADO | ≤ producción actual (≤ 0) | Sí |
| Benchmark completo ejecutado | 400 casos | Sí, bloqueante |
| Sin causa de anomalía desconocida | — | Sí |

> Si se modifica el prompt o la lógica de kbContext, el benchmark completo de 400 casos es obligatorio antes de evaluar estos criterios. Sin excepción.

---

## 2. Criterios de promoción: Release Candidate → Producción

Una versión puede sustituir a producción si cumple **todos** los criterios siguientes:

### Criterios cuantitativos

| Criterio | Umbral | Obligatorio |
|---|---|---|
| OK rate | ≥ producción actual (92.2%) | Sí, bloqueante |
| PRECIO_INVALIDO | = 0 | Sí, bloqueante |
| VACÍO | ≤ producción actual (≤ 2) | Sí, bloqueante |
| TRUNCADO | ≤ producción actual (≤ 0) | Sí, bloqueante |
| Latencia P95 | < 30s | Sí |
| Coincide oficio | ≥ producción actual (≥ 73.8%) | Sí |

### Proceso obligatorio

| Paso | Descripción | Obligatorio |
|---|---|---|
| Benchmark 400 casos | Ejecutado en el AI Validation Center | Sí, bloqueante |
| Regression Diff | Comparación caso a caso vs producción actual | Sí, bloqueante (disponible desde Sprint 4 P2) |
| Smoke Test E2E | Request real con orgId real y catálogo real | Sí, bloqueante |
| Verificación de versión | version_tag + commit hash + fecha de despliegue coinciden con el benchmark | Sí, bloqueante |
| Aprobación Tech Lead | Revisión de resultados y firma | Sí |

### Criterios cualitativos

- No existe ninguna anomalía abierta sin causa identificada.
- El Regression Diff no muestra casos empeorados en categorías críticas (PRECIO_INVALIDO, VACÍO, TRUNCADO).
- El balance neto del Regression Diff es positivo (más casos mejorados que empeorados).

---

## 3. Criterios de rollback: Producción → Versión anterior

Se ejecuta rollback inmediato si se cumple cualquiera de las siguientes condiciones en producción:

| Condición | Acción |
|---|---|
| PRECIO_INVALIDO > 0 detectado en producción real | Rollback inmediato a versión anterior |
| Tasa de error HTTP 5xx > 5% en 15 minutos | Rollback inmediato |
| VACÍO > 10% de requests en ventana de 1 hora | Rollback inmediato |
| Latencia P95 > 45s sostenida 10 minutos | Rollback y análisis |
| Respuesta malformada (JSON parse error) > 2% | Rollback inmediato |

### Procedimiento de rollback

1. Redesplegar la versión anterior de `trade-voice-to-quote` desde Supabase Dashboard.
2. Verificar en benchmark runner que la versión activa es la correcta.
3. Ejecutar smoke test E2E para confirmar que el problema desaparece.
4. Registrar el incidente en CHANGELOG.md con causa y fecha.
5. Marcar la versión retirada como `rollback` en `trade_ai_versions`.

### Versión de fallback garantizada

| Situación | Versión de fallback |
|---|---|
| Producción actual | v57b |
| Si v57b falla | v56-stable |

---

## 4. Actualización de umbrales

Los umbrales de estos criterios se actualizan automáticamente cuando una nueva versión entra en producción. La referencia es siempre la versión en producción en el momento de la evaluación, no los valores históricos de este documento.

Este documento debe actualizarse en cada cambio de producción.

**Producción actual al momento de este documento:** v57b (2026-07-02)

---

## 5. Dónde viven estos criterios

Este documento es la fuente de verdad. Debe estar referenciado desde:

- La pestaña **Versiones** del AI Validation Center (enlace o resumen visible).
- El `CHANGELOG.md` del motor IA.
- El plan de cada sprint que incluya trabajo en el motor IA.
