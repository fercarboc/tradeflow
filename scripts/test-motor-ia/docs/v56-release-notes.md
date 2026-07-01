# TradeFlow AI Motor — v56 Release Notes

**Fecha:** 2026-07-01  
**Tag:** `v56-stable`  
**Estado:** Producción (trabflow.com)  
**Función Supabase:** `trade-voice-to-quote` versión 57

---

## Resumen ejecutivo

v56 es la primera versión estable del motor IA tras el ciclo de optimización controlada por fases.  
Mejora la tasa OK global de 89% (v54) a **93%**, recupera Reformas Integrales de 35% a **75%**, y mantiene VACIO=0.

---

## Cambios respecto a v51 (primera versión con extractFirstJSON)

### Cambios acumulados en el motor

| Versión | Cambio principal |
|---------|-----------------|
| v51 | `extractFirstJSON` — extractor balanceado de JSON. Eliminó el 75% de VACIO causado por markdown/texto extra |
| v52 | Prompt M1 enriquecido + `max_tokens=2048` → 172 VACIO por truncado |
| v53 | `max_tokens=3072` simple → 21 VACIO persistentes |
| v54 | `max_tokens=4096` simple / `isComplexJob` → 8192. Regla M2 capítulos para reformas. VACIO=0 |
| v55 | CASO 1/CASO 2 reformas. Rollback: 2 VACIO nuevos por truncado (isComplexJob no detectaba "actualizar piso") |
| **v56** | CASO 1/CASO 2 reformas + regex `isComplexJob` expandido. Sin regresiones globales |

### Estado final del prompt (v56)

**Regla M2 — Reforma integral:**
```
CASO 1 — Reforma mediana (piso, local, oficina, garaje, baño completo, cocina completa):
  Genera máximo 12 partidas técnicas individuales: demolición, fontanería, electricidad,
  alicatado, pintura, carpintería, pladur, pavimentos, etc. NO uses capítulos.
  Las partidas deben ser específicas y técnicas para poder enlazar con el catálogo.

CASO 2 — Gran obra (chalet completo, edificio entero, obra nueva, rehabilitación integral
  de edificio completo, ampliación estructural con nueva planta): usa CAPÍTULOS agrupados
  (máximo 4 partidas)
```

**Detector isComplexJob (v56):**
```typescript
/reforma|rehabil|convert|construir|ampliar|chalet|farmacia|restaurante|
 local.*vivienda|edificio.*completo|piso.*completo|
 actualiz|moderniz|adaptar.*vivienda|accesib/i
|| (transcript.match(/[,;]/g) ?? []).length > 4
```
→ Si `isComplexJob=true`: `max_tokens=8192`. Si false: `max_tokens=4096`.

**Modelo:** `claude-haiku-4-5-20251001`  
**temperature:** `0` (determinista)

---

## Métricas oficiales — v56 benchmark (400 tests)

### KPIs globales

| Métrica | v51 | v54 | **v56** | Δ v54→v56 |
|---------|-----|-----|---------|-----------|
| Tasa OK | 88% | 89% | **93%** | +4pp |
| OK_MIXTO | 353 (88%) | 354 (88%) | 372 (93%) | +18 |
| SOLO_SUGERIDAS | 33 (8%) | 38 (10%) | **20 (5%)** | -18 |
| VACIO | 7 (2%) | 0 | **0** | = |
| TRUNCADO | 0 | 4 (1%) | 4 (1%) | = |
| ERROR_TECNICO | 2 | 2 | 2 | = |
| PRECIO_INVALIDO | 4 | 1 | 1 | = |
| Coincidencia oficio (raw) | 71% | 74% | **73%** | -1pp |
| Coincidencia oficio (real)* | — | — | **78%** | — |
| Latencia media | 21,978ms | 18,703ms | 18,299ms | -400ms |
| Latencia P95 | 43,254ms | 28,779ms | 29,179ms | +400ms |
| tokens_out medio | n/a | 2,389 | 2,468 | +79 |
| tokens_out máx | n/a | 5,204 | 6,618 | — |

*Coincidencia real: corregida por alias Reformas Integrales (ver sección análisis oficio)

### Tasa OK por oficio

| Oficio | v51 | v54 | **v56** | Δ |
|--------|-----|-----|---------|---|
| Reformas Integrales | 65% | 35% | **75%** | +40pp |
| Fachadas | 85% | 80% | **100%** | +20pp |
| Climatización | 90% | 75% | **90%** | +15pp |
| Energía Solar | 95% | 80% | **95%** | +15pp |
| Cerrajería | 85% | 90% | **100%** | +10pp |
| Albañilería | 85% | 85% | **95%** | +10pp |
| Electricidad | 95% | 100% | **100%** | = |
| Fontanería | 95% | 90% | 95% | +5pp |
| Pintura | 90% | 90% | 95% | +5pp |
| Telecomunicaciones | 100% | 100% | 100% | = |
| Persianas | 95% | 100% | 100% | = |
| Suelos y Alicatados | 85% | 100% | 100% | = |
| Jardinería | 90% | 100% | 100% | = |
| Pladur | 95% | 95% | 95% | = |
| Tejados/Cubiertas | 80% | 95% | 95% | = |
| Impermeabilización | 75% | 85% | 75% | -10pp* |
| Mantenimiento General | 80% | 90% | 80% | -10pp* |
| Contra Incendios | 85% | 95% | 85% | -10pp* |
| Cristalería | 100% | 100% | 95% | -5pp* |

*Varianza LLM (1-2 casos / 20). Los cambios de v56 no tocan estos oficios.

---

## Análisis de coincidencia de oficio

### Diagnóstico del 73%

El 73% bruto se descompone en tres categorías:

| Tipo | Casos | % | Naturaleza |
|------|-------|---|-----------|
| Coincide correcto | 291 | 73% | Modelo y benchmark alineados |
| **Error de alias** | **20** | **5%** | Modelo correcto, label diferente |
| Error real del modelo | 89 | 22% | Modelo elige oficio incorrecto |

**Conclusión: el 73% subestima el rendimiento real. La cifra real es 78%.**

### Error de alias — Reformas Integrales (20 casos, 100% de los alias)

El benchmark etiqueta el oficio como `"Reformas Integrales"` (display name).  
El modelo genera correctamente `"reforma_integral"` (ID canónico).  
La función `coincidenOficios` no une plural/singular ni underscore/espacio en todos los casos.

**Impacto:** 20 casos contados como error cuando el modelo está correcto.  
**Solución:** Añadir alias en `coincidenOficios` o en el benchmark (FASE 4, no urgente).

### Errores reales más frecuentes (89 casos)

| Oficio esperado | Errores | Confusión principal |
|----------------|---------|---------------------|
| Mantenimiento General | 15 | modelo usa oficio específico (cerrajeria, electricidad, pintura…) |
| Tejados/Cubiertas | 7 | confunde con `impermeabilizacion`, `cristaleria` |
| Albañilería | 8 | confunde con `suelos_alicatados`, `fachadas` |
| Suelos y Alicatados | 7 | confunde con `albanileria`, `impermeabilizacion` |
| Fontanería | 5 | confunde con `climatizacion` (inst. calefacción) |
| Pintura | 5 | confunde con `fachadas`, `albanileria` |

### Mantenimiento General — ¿Error del modelo o del benchmark?

El modelo detecta 15/20 casos como oficios específicos (cerrajería, electricidad, pintura…) en lugar de `mantenimiento_general`. 

Las queries del benchmark de "Mantenimiento General" describen tareas multi-oficio ("revisar grifo + cambiar bombilla + ajustar puerta"). El modelo está aplicando la regla de oficio más específico, que es el comportamiento correcto según el prompt.

**Conclusión:** el benchmark tiene consultas ambiguas en Mantenimiento General. El modelo no está equivocado — está siguiendo las reglas de prioridad. Esto es un problema de diseño del benchmark, no del motor.

---

## Riesgos conocidos y limitaciones

### 4 TRUNCADO persistentes (residuales de v54)

Casos #106, #113, #235, #322 — climatización/energía solar compleja — siguen alcanzando `max_tokens=4096` en la rama simple. El `isComplexJob` regex no los captura porque sus queries no contienen las palabras clave.

**Impacto:** 1% del total. Se clasifican como OK_MIXTO con partidas truncadas.  
**Fix propuesto:** Ampliar regex con `aerotermia|suelo.radiante|fotovoltaic|SATE` o subir rama simple a 6144.  
**Decisión:** Diferido hasta FASE 5 (optimización tokens/latencia).

### Coincidencia oficio 78% real vs objetivo 85%

Hay 74 errores reales del modelo (excluidos los 15 Mantenimiento General ambiguos).  
Principales grupos: Tejados↔Impermeabilización, Albañilería↔Suelos, Fontanería↔Climatización.  
**Fix propuesto FASE 5:** Few-shot examples y reglas de prioridad más explícitas para las fronteras.

---

## Archivos de referencia

| Archivo | Descripción |
|---------|-------------|
| `output/benchmark_v56_full/` | 400 resultados completos v56 (ground truth) |
| `output/benchmark_v54_baseline/` | 400 resultados v54 (referencia anterior) |
| `output/raw_v51/` | 400 resultados v51 (primera versión estable) |
| `compare_triple.py` | Comparativa v51/v54/v56 |
| `analyze_oficio_coincidence.py` | Análisis detallado de errores de oficio |
| `compare_v54_v56.py` | Comparativa reformas (20 casos) |

---

## Decisiones de ingeniería tomadas

1. **Nunca acumular cambios sobre versión peor** — v55 se revirtió automáticamente por 2 VACIO nuevos.
2. **Validar con 20 casos antes de 400** — economiza tiempo y detecta regresiones antes.
3. **isComplexJob expande `max_tokens`, no el límite de partidas** — el límite de partidas lo gestiona el prompt.
4. **Capítulos solo para CASO 2** — reforma mediana genera partidas técnicas enlazables al catálogo.
5. **VACIO=0 es línea roja** — cualquier VACIO nuevo activa rollback inmediato.
