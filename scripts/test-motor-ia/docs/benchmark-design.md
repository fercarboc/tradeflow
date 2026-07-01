# Diseño del Benchmark Permanente — TradeFlow AI Motor

**Versión de referencia:** v56 (benchmark_v56_full = ground truth oficial)  
**Fecha de diseño:** 2026-07-01

---

## Principios

1. **Benchmark ≠ test runner** — el benchmark es el conjunto de queries + metadatos esperados. El runner ejecuta y guarda los resultados. Son ficheros separados.
2. **Inmutable entre fases** — las queries no cambian entre versiones. Si se añaden queries, se versiona el benchmark.
3. **ID único y estable** — cada query tiene un ID numérico que no cambia nunca.
4. **Oficio como ID canónico** — el campo `oficio` del benchmark usa el ID interno (`reforma_integral`), no el display name (`Reformas Integrales`). Elimina la clase de bugs de alias.
5. **Ground truth explícito** — el benchmark incluye qué partidas mínimas se esperan, para poder evaluar calidad técnica futura.

---

## Estructura de directorios

```
scripts/test-motor-ia/
├── benchmark/
│   ├── benchmark_v1.json          ← conjunto oficial de queries (400+)
│   ├── benchmark_meta.json        ← metadata: versión, fecha, totales por oficio
│   └── CHANGELOG.md               ← cambios entre versiones del benchmark
├── output/
│   ├── raw/                       ← resultados de la corrida actual (temporal)
│   ├── baseline_v56/              ← referencia permanente (renombrar desde benchmark_v56_full)
│   └── runs/
│       └── v57_2026-07-15/        ← cada run archivado: {version}_{fecha}/
├── docs/
│   ├── v56-release-notes.md
│   ├── benchmark-design.md
│   └── comparison-system-design.md
├── runner.ts                      ← ejecuta queries, guarda resultados
├── classify.ts                    ← clasifica resultados en categorías
├── compare.py                     ← compara dos versiones
└── report.py                      ← genera informe HTML/Markdown
```

---

## Estructura de cada query en el benchmark (`benchmark_v1.json`)

```json
{
  "schema_version": 1,
  "generated": "2026-07-01",
  "queries": [
    {
      "id": 1,
      "text": "Necesito cambiar el grifo del baño que gotea",
      "oficio": "fontaneria",
      "difficulty": "easy",
      "tags": ["urgente", "pequeña-reparacion"],
      "expected": {
        "category": "OK_MIXTO",
        "min_partidas": 1,
        "max_partidas": 3,
        "partidas_key": ["grifo", "sifon"],
        "coincide_oficio": true
      }
    }
  ]
}
```

### Campos de cada query

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `number` | ID único, nunca reutilizar, solo crece |
| `text` | `string` | Texto de la query tal como la escribe el usuario |
| `oficio` | `string` | ID canónico del oficio (`reforma_integral`, `fontaneria`…) |
| `difficulty` | `"easy" \| "medium" \| "hard"` | Complejidad estimada de la query |
| `tags` | `string[]` | Etiquetas libres: `urgente`, `multi-oficio`, `tecnico`, etc. |
| `expected.category` | `string` | Categoría esperada: `OK_MIXTO`, `OK_CATALOGO`, etc. |
| `expected.min_partidas` | `number` | Mínimo de partidas que debe generar |
| `expected.max_partidas` | `number` | Máximo de partidas (opcional, `null` si sin límite) |
| `expected.partidas_key` | `string[]` | Palabras clave que deben aparecer en los nombres de partidas |
| `expected.coincide_oficio` | `boolean` | ¿El modelo debe detectar este oficio? |

---

## Estructura de cada resultado guardado

(Compatibilidad con el formato actual de `runner.ts`)

```json
{
  "id": 1,
  "oficio": "fontaneria",
  "text": "Necesito cambiar el grifo del baño que gotea",
  "latency_ms": 3421,
  "raw_response": {
    "transcript": "...",
    "quote": { "oficios_detectados": [...], "partidas": [...] },
    "_meta": {
      "prompt_version": "v56",
      "stop_reason": "end_turn",
      "tokens_in": 1842,
      "tokens_out": 512
    }
  },
  "classification": {
    "category": "OK_MIXTO",
    "n_partidas": 2,
    "n_catalogo": 1,
    "n_sugeridas": 1,
    "oficio_detectado": "fontaneria",
    "coincide_oficio": "SI"
  }
}
```

---

## Distribución recomendada del benchmark permanente

### Distribución actual (400 queries, 20 por oficio)

| Oficio | Queries actuales | Dificultad actual |
|--------|-----------------|-------------------|
| Reformas Integrales | 20 | Variada (CASO 1 + CASO 2) |
| Fontanería | 20 | Easy/Medium |
| Electricidad | 20 | Easy/Medium |
| … (18 oficios más) | 20 c/u | Variada |

### Ampliación recomendada (sin ejecutar aún)

Para FASE 6 (benchmark generator), la expansión debe seguir estas reglas:

1. **Pesos por dificultad:** 50% easy, 35% medium, 15% hard
2. **Cobertura de casos borde:** oficios con frontera difusa necesitan más casos
   - Mantenimiento General ↔ múltiples oficios específicos → +10 queries con tareas mixtas explícitas
   - Tejados ↔ Impermeabilización → +10 queries diferenciando materiales
   - Albañilería ↔ Suelos → +10 queries con materiales claros
3. **Queries multi-oficio:** agregar etiqueta `multi-oficio` para no penalizar oficio principal
4. **No duplicar conceptos** — cada query debe representar un escenario único

---

## Campos de metadata (`benchmark_meta.json`)

```json
{
  "version": 1,
  "created": "2026-07-01",
  "total_queries": 400,
  "oficios": {
    "fontaneria": { "count": 20, "difficulty_dist": {"easy": 10, "medium": 8, "hard": 2} },
    "reforma_integral": { "count": 20, "difficulty_dist": {"easy": 4, "medium": 10, "hard": 6} }
  },
  "changelog": [
    { "version": 1, "date": "2026-07-01", "changes": "Initial benchmark, migrated from runner queries" }
  ]
}
```

---

## Plan de migración (a ejecutar en FASE 6)

1. Leer el benchmark actual del runner (`queries` array en `runner.ts`)
2. Exportar a `benchmark/benchmark_v1.json` con la estructura anterior
3. Migrar `oficio` de display name → ID canónico en todas las queries
4. Añadir campos `difficulty`, `tags`, `expected` con valores por defecto
5. Renombrar `output/benchmark_v56_full/` → `output/baseline_v56/`
6. Actualizar `runner.ts` para leer queries desde el JSON externo
7. Validar que los 400 resultados siguen siendo idénticos

---

## Reglas de versionado del benchmark

- **No modificar queries existentes** — solo añadir
- Si una query tiene un error en el texto original, añadir una nueva con la corrección y marcar la antigua como `deprecated: true`
- Cambios de versión: `benchmark_v2.json` cuando se añaden >50 queries nuevas
- El baseline de referencia siempre apunta a la versión más reciente del benchmark
