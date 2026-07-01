# Diseño del Sistema Automático de Comparación — TradeFlow AI Motor

**Fecha:** 2026-07-01  
**Baseline de referencia:** v56 (output/baseline_v56/)

---

## Objetivo

Cada vez que se sube una nueva versión del motor, el sistema debe:
1. Ejecutar los 400 tests sobre el benchmark oficial
2. Guardar los resultados versionados
3. Generar automáticamente un informe comparativo respecto a v56
4. Decidir si la versión es un candidato estable o requiere rollback

---

## Flujo completo

```
Nueva versión prompt/regex
         │
         ▼
   git tag vXX-candidate
         │
         ▼
   runner.ts --output output/runs/vXX_YYYY-MM-DD/
         │
         ▼
   compare.py --base output/baseline_v56/ --new output/runs/vXX/
         │
         ▼
   report.py → output/runs/vXX/REPORT.md
         │
         ├── VACIO > 0 ──────────────────► ROLLBACK AUTOMÁTICO (línea roja)
         ├── TRUNCADO > baseline ─────────► ROLLBACK AUTOMÁTICO
         ├── Tasa OK < baseline - 1pp ────► ROLLBACK AUTOMÁTICO
         └── Todo OK ─────────────────────► Candidato estable
```

---

## Script principal: `compare.py`

### Invocación

```bash
python compare.py --base output/baseline_v56/ --new output/runs/vXX/ [--report]
```

### Salida esperada (stdout + opcionalmente REPORT.md)

```
=== COMPARATIVA vXX vs v56 (baseline) ===

KPIS GLOBALES
--------------
                    v56 (base)    vXX (new)     Delta
Tasa OK             93%           94%           +1pp
OK_MIXTO            372           374           +2
SOLO_SUGERIDAS      20            18            -2
VACIO               0             0             =
TRUNCADO            4             3             -1
ERROR_TECNICO       2             2             =
PRECIO_INVALIDO     1             1             =
Coincidencia oficio 73%           75%           +2pp
Latencia media      18,299ms      17,850ms      -449ms
Latencia P95        29,179ms      28,900ms      -279ms
tokens_out medio    2,468         2,401         -67

SEMÁFORO DE CALIDAD
--------------------
[OK]   VACIO = 0  (línea roja respetada)
[OK]   TRUNCADO no empeoró
[OK]   Tasa OK +1pp sobre baseline
[WARN] Coincidencia oficio +2pp → mejora esperada en vXX?

CASOS RECUPERADOS (por categoría)
----------------------------------
  ID 365: SOLO_SUGERIDAS → OK_MIXTO  [Reformas]
  ID 367: SOLO_SUGERIDAS → OK_MIXTO  [Reformas]

CASOS EMPEORADOS (por categoría)
---------------------------------
  (ninguno)

RESULTADO FINAL: CANDIDATO ESTABLE ✓
```

### Código de salida

| Exit code | Significado |
|-----------|-------------|
| `0` | Todo OK — candidato estable |
| `1` | ROLLBACK REQUERIDO — línea roja violada |
| `2` | ADVERTENCIA — degradación sin cruzar línea roja |

---

## Implementación: `compare.py`

```python
"""
compare.py — Comparador automático de versiones del motor IA.
Uso: python compare.py --base <dir_base> --new <dir_new> [--report]
"""
import json, os, sys, glob, statistics, argparse
from collections import Counter

CATS = ['OK_CATALOGO','OK_MIXTO','SOLO_SUGERIDAS','VACIO','TRUNCADO','ERROR_TECNICO','PRECIO_INVALIDO']
OK_CATS = {'OK_CATALOGO','OK_MIXTO'}

# Líneas rojas que causan exit(1)
RED_LINES = [
    ('VACIO', '>', 0),
    ('TRUNCADO', '>', None),  # None = no empeorar vs baseline
    ('ok_rate', '<', None),   # no bajar más de 1pp
]

def load_dir(path):
    results = {}
    for fp in glob.glob(os.path.join(path, '*.json')):
        with open(fp, encoding='utf-8') as f:
            d = json.load(f)
        results[d['id']] = d
    return results

def compute_stats(results):
    cats = Counter()
    latencies, tokens = [], []
    n_coincide = 0

    for d in results.values():
        cl = d['classification']
        cat = cl['category']
        meta = d.get('raw_response', {}).get('_meta', {})
        if meta.get('stop_reason') == 'max_tokens' and cat == 'VACIO':
            cat = 'TRUNCADO'
        cats[cat] += 1
        latencies.append(d['latency_ms'])
        tokens.append(meta.get('tokens_out', 0))
        if cl.get('coincide_oficio') == 'SI':
            n_coincide += 1

    n = len(results)
    ok = sum(cats[c] for c in OK_CATS)
    lat_sorted = sorted(latencies)
    return {
        'n': n, 'cats': cats, 'ok': ok,
        'ok_rate': round(ok * 100 / n, 1) if n else 0,
        'lat_mean': int(statistics.mean(latencies)) if latencies else 0,
        'lat_p95': lat_sorted[max(0, int(n * 0.95) - 1)] if lat_sorted else 0,
        'tok_mean': int(statistics.mean(tokens)) if tokens else 0,
        'n_coincide': n_coincide,
        'coin_rate': round(n_coincide * 100 / n, 1) if n else 0,
    }

def check_red_lines(base_stats, new_stats):
    violations = []
    if new_stats['cats'].get('VACIO', 0) > 0:
        violations.append(f"VACIO = {new_stats['cats']['VACIO']} (era 0)")
    if new_stats['cats'].get('TRUNCADO', 0) > base_stats['cats'].get('TRUNCADO', 0):
        violations.append(f"TRUNCADO empeoró: {base_stats['cats'].get('TRUNCADO',0)} → {new_stats['cats']['TRUNCADO']}")
    if new_stats['ok_rate'] < base_stats['ok_rate'] - 1.0:
        violations.append(f"Tasa OK: {base_stats['ok_rate']}% → {new_stats['ok_rate']}% (bajó más de 1pp)")
    return violations

def find_regressions(base_results, new_results):
    recovered, worsened = [], []
    for id_, base_d in base_results.items():
        if id_ not in new_results:
            continue
        new_d = new_results[id_]
        bc = base_d['classification']['category']
        nc = new_d['classification']['category']
        if bc not in OK_CATS and nc in OK_CATS:
            recovered.append({'id': id_, 'from': bc, 'to': nc, 'oficio': base_d.get('oficio', '')})
        elif bc in OK_CATS and nc not in OK_CATS:
            worsened.append({'id': id_, 'from': bc, 'to': nc, 'oficio': base_d.get('oficio', '')})
    return recovered, worsened

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', required=True, help='Directorio con resultados baseline (v56)')
    parser.add_argument('--new', required=True, help='Directorio con resultados nueva versión')
    parser.add_argument('--report', action='store_true', help='Guardar REPORT.md en --new dir')
    args = parser.parse_args()

    base_results = load_dir(args.base)
    new_results = load_dir(args.new)

    if not base_results or not new_results:
        print("ERROR: No se pudieron cargar resultados")
        sys.exit(1)

    base_stats = compute_stats(base_results)
    new_stats = compute_stats(new_results)

    violations = check_red_lines(base_stats, new_stats)
    recovered, worsened = find_regressions(base_results, new_results)

    # Imprimir informe (omitido por brevedad del diseño — ver implementación real)
    exit_code = 1 if violations else 0
    sys.exit(exit_code)
```

---

## Script de informe: `report.py`

Genera un `REPORT.md` en el directorio de resultados con:
- Tabla de KPIs (columnas: baseline v56, nueva versión, delta, tendencia)
- Semáforo de calidad (rojo/amarillo/verde por KPI)
- Lista de casos recuperados y empeorados
- Coincidencia de oficio por categoría
- Veredicto final: CANDIDATO ESTABLE / ROLLBACK / ADVERTENCIA

---

## Integración con el flujo de trabajo

### Antes de cada nueva versión

```bash
# 1. Checkpoint git
git add -A && git commit -m "checkpoint before vXX"
git tag vXX-candidate

# 2. Desplegar nueva versión a Supabase
npx supabase functions deploy trade-voice-to-quote

# 3. Ejecutar benchmark completo (sin --resume)
npx ts-node runner.ts --output output/runs/vXX_$(date +%Y-%m-%d)/ --count 400

# 4. Comparar automáticamente vs baseline v56
python compare.py --base output/baseline_v56/ --new output/runs/vXX_*/ --report

# 5. Revisar salida:
#    Exit 0 → candidato estable, crear tag vXX-stable
#    Exit 1 → ROLLBACK inmediato (git checkout v56-stable -- index.ts + redeploy)
```

---

## Criterios de rollback codificados

| Condición | Acción | Urgencia |
|-----------|--------|----------|
| VACIO > 0 | Rollback automático | Inmediata |
| TRUNCADO > baseline | Rollback automático | Inmediata |
| Tasa OK < baseline − 1pp | Rollback automático | Inmediata |
| Tasa OK < baseline − 0.5pp | Advertencia, revisar manualmente | Moderada |
| Latencia P95 > baseline × 1.2 | Advertencia | Baja |
| Coincidencia oficio < baseline − 2pp | Revisar antes de aprobar | Moderada |

---

## Notas de implementación

- `compare.py` es Python puro (sin dependencias externas) — ejecuta en cualquier entorno
- `report.py` genera Markdown — legible en GitHub, VS Code, y cualquier editor
- El directorio `output/runs/` es gitignoreado (resultados muy grandes)
- Solo `output/baseline_v56/` está en git (snapshot oficial de referencia)
- El script detecta TRUNCADO correctamente via `stop_reason === 'max_tokens'`
