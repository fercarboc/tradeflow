"""
Comparativa triple: v51 vs v54 vs v56
Lee output/raw_v51/, output/benchmark_v54_baseline/, output/benchmark_v56_full/
"""
import json, os, statistics, glob
from collections import Counter, defaultdict

BASE = r'c:/tradeflow/scripts/test-motor-ia/output'
DIRS = {
    'v51': os.path.join(BASE, 'raw_v51'),
    'v54': os.path.join(BASE, 'benchmark_v54_baseline'),
    'v56': os.path.join(BASE, 'benchmark_v56_full'),
}

CATS = ['OK_CATALOGO','OK_MIXTO','SOLO_SUGERIDAS','VACIO','TRUNCADO','ERROR_TECNICO','PRECIO_INVALIDO']
OK_CATS = {'OK_CATALOGO','OK_MIXTO'}

def load_dir(path):
    results = {}
    for fp in glob.glob(os.path.join(path, '*.json')):
        with open(fp, encoding='utf-8') as f:
            d = json.load(f)
        results[d['id']] = d
    return results

def compute_stats(results):
    cats = Counter()
    latencies = []
    tokens_out = []
    oficio_total = defaultdict(int)
    oficio_ok = defaultdict(int)
    oficio_correct = defaultdict(int)  # coincide_oficio == 'SI'

    for d in results.values():
        cl = d['classification']
        cat = cl['category']
        # Detectar TRUNCADO via stop_reason en _meta
        meta = d.get('raw_response', {}).get('_meta', {})
        if meta.get('stop_reason') == 'max_tokens' and cat in ('VACIO',):
            cat = 'TRUNCADO'
        cats[cat] += 1
        latencies.append(d['latency_ms'])
        tok = meta.get('tokens_out', 0)
        tokens_out.append(tok)

        oficio = d.get('oficio', 'Desconocido')
        oficio_total[oficio] += 1
        if cat in OK_CATS:
            oficio_ok[oficio] += 1
        if cl.get('coincide_oficio') == 'SI':
            oficio_correct[oficio] += 1

    n = len(results)
    latencies_sorted = sorted(latencies)
    p95_idx = max(0, int(n * 0.95) - 1)
    return {
        'n': n,
        'cats': cats,
        'ok': sum(cats[c] for c in OK_CATS),
        'lat_mean': int(statistics.mean(latencies)) if latencies else 0,
        'lat_p95': latencies_sorted[p95_idx] if latencies else 0,
        'tok_mean': int(statistics.mean(tokens_out)) if tokens_out else 0,
        'tok_max': max(tokens_out) if tokens_out else 0,
        'oficio_total': oficio_total,
        'oficio_ok': oficio_ok,
        'oficio_correct': oficio_correct,
        'n_coincide': sum(1 for d in results.values() if d['classification'].get('coincide_oficio') == 'SI'),
    }

print("Cargando datos...")
data = {}
for v, path in DIRS.items():
    if not os.path.exists(path):
        print(f"  [SKIP] {v}: directorio no encontrado ({path})")
        continue
    data[v] = load_dir(path)
    print(f"  {v}: {len(data[v])} archivos cargados")

stats = {v: compute_stats(r) for v, r in data.items()}
versions = [v for v in ['v51','v54','v56'] if v in stats]

print()
print("=" * 65)
print("COMPARATIVA GLOBAL: v51 vs v54 vs v56")
print("=" * 65)

# Header
hdr = f"{'Métrica':<22}"
for v in versions:
    hdr += f"  {v:>10}"
print(hdr)
print("-" * 65)

def row(label, vals):
    s = f"{label:<22}"
    for v in vals:
        s += f"  {v:>10}"
    print(s)

for v in versions:
    s = stats[v]
    n = s['n']

for cat in CATS:
    vals = []
    for v in versions:
        s = stats[v]
        n_cat = s['cats'].get(cat, 0)
        pct = round(n_cat*100/s['n']) if s['n'] else 0
        vals.append(f"{n_cat} ({pct}%)")
    row(cat, vals)

print("-" * 65)
ok_vals = []
for v in versions:
    s = stats[v]
    pct = round(s['ok']*100/s['n']) if s['n'] else 0
    ok_vals.append(f"{s['ok']} ({pct}%)")
row("Tasa OK", ok_vals)

coin_vals = []
for v in versions:
    s = stats[v]
    pct = round(s['n_coincide']*100/s['n']) if s['n'] else 0
    coin_vals.append(f"{s['n_coincide']} ({pct}%)")
row("Coincidencia oficio", coin_vals)

print("-" * 65)
row("Latencia media", [f"{stats[v]['lat_mean']}ms" for v in versions])
row("Latencia P95", [f"{stats[v]['lat_p95']}ms" for v in versions])
row("tokens_out medio", [str(stats[v]['tok_mean']) for v in versions])
row("tokens_out máx", [str(stats[v]['tok_max']) for v in versions])

print()
print("=" * 65)
print("RESULTADOS POR OFICIO — Tasa OK")
print("=" * 65)

all_oficios = sorted(set(
    o for v in versions for o in stats[v]['oficio_total']
))
hdr2 = f"{'Oficio':<26}"
for v in versions:
    hdr2 += f"  {v:>10}"
print(hdr2)
print("-" * 65)

for oficio in all_oficios:
    vals2 = []
    for v in versions:
        s = stats[v]
        total = s['oficio_total'].get(oficio, 0)
        ok_n = s['oficio_ok'].get(oficio, 0)
        if total == 0:
            vals2.append("  n/a")
        else:
            pct = round(ok_n*100/total)
            vals2.append(f"{ok_n}/{total} ({pct}%)")
    row(oficio[:25], vals2)

print()
print("=" * 65)
print("COINCIDENCIA DE OFICIO POR CATEGORÍA")
print("=" * 65)
hdr3 = f"{'Oficio':<26}"
for v in versions:
    hdr3 += f"  {v:>10}"
print(hdr3)
print("-" * 65)

for oficio in all_oficios:
    vals3 = []
    for v in versions:
        s = stats[v]
        total = s['oficio_total'].get(oficio, 0)
        correct = s['oficio_correct'].get(oficio, 0)
        if total == 0:
            vals3.append("  n/a")
        else:
            pct = round(correct*100/total)
            vals3.append(f"{correct}/{total} ({pct}%)")
    row(oficio[:25], vals3)
