"""
Comparativa v56 (baseline) vs v57 (candidato).
Uso: python compare_v56_v57.py
"""
import json, os, glob, statistics
from collections import Counter, defaultdict

BASE_DIR = r'c:/tradeflow/scripts/test-motor-ia/output'
V56_DIR  = os.path.join(BASE_DIR, 'benchmark_v56_full')
V57_DIR  = os.path.join(BASE_DIR, 'runs/v57_candidate')

CATS    = ['OK_CATALOGO','OK_MIXTO','SOLO_SUGERIDAS','VACIO','TRUNCADO','ERROR_TECNICO','PRECIO_INVALIDO']
OK_CATS = {'OK_CATALOGO','OK_MIXTO'}

ALIAS_MAP = {
    'Albañilería':'albanileria','Carpintería':'carpinteria','Cerrajería':'cerrajeria',
    'Climatización':'climatizacion','Contra Incendios':'contra_incendios',
    'Cristalería':'cristaleria','Electricidad':'electricidad','Energía Solar':'energia_solar',
    'Fachadas':'fachadas','Fontanería':'fontaneria','Impermeabilización':'impermeabilizacion',
    'Jardinería':'jardineria','Mantenimiento General':'mantenimiento_general',
    'Persianas':'persianas','Pintura':'pintura','Pladur':'pladur_escayola',
    'Reformas Integrales':'reforma_integral','Suelos y Alicatados':'suelos_alicatados',
    'Tejados/Cubiertas':'tejados_cubiertas','Telecomunicaciones':'telecomunicaciones',
}

def load_dir(path):
    results = {}
    for fp in glob.glob(os.path.join(path, '*.json')):
        with open(fp, encoding='utf-8') as f:
            d = json.load(f)
        results[d['id']] = d
    return results

def classify_cat(d):
    cl = d['classification']
    cat = cl['category']
    meta = d.get('raw_response', {}).get('_meta', {})
    if meta.get('stop_reason') == 'max_tokens' and cat == 'VACIO':
        cat = 'TRUNCADO'
    return cat

def compute_stats(results):
    cats = Counter()
    latencies, tokens = [], []
    n_coincide = 0
    oficio_total = defaultdict(int)
    oficio_ok = defaultdict(int)
    oficio_coin = defaultdict(int)

    for d in results.values():
        cat = classify_cat(d)
        cats[cat] += 1
        latencies.append(d['latency_ms'])
        meta = d.get('raw_response', {}).get('_meta', {})
        tokens.append(meta.get('tokens_out', 0))
        oficio = d.get('oficio', '')
        oficio_total[oficio] += 1
        if cat in OK_CATS:
            oficio_ok[oficio] += 1
        if d['classification'].get('coincide_oficio') == 'SI':
            n_coincide += 1
            oficio_coin[oficio] += 1

    n = len(results)
    lat_sorted = sorted(latencies)
    tok_sorted  = sorted(tokens)
    return {
        'n': n, 'cats': cats,
        'ok': sum(cats[c] for c in OK_CATS),
        'ok_rate': round(sum(cats[c] for c in OK_CATS)*100/n, 1) if n else 0,
        'lat_mean': int(statistics.mean(latencies)) if latencies else 0,
        'lat_p95': lat_sorted[max(0, int(n*0.95)-1)] if lat_sorted else 0,
        'tok_mean': int(statistics.mean(tokens)) if tokens else 0,
        'tok_max': max(tokens) if tokens else 0,
        'n_coincide': n_coincide,
        'coin_rate': round(n_coincide*100/n, 1) if n else 0,
        'oficio_total': oficio_total,
        'oficio_ok': oficio_ok,
        'oficio_coin': oficio_coin,
    }

def delta_str(new_val, base_val, unit=''):
    diff = new_val - base_val
    sign = '+' if diff >= 0 else ''
    return f'{sign}{diff}{unit}'

print("Cargando datos...")
v56 = load_dir(V56_DIR)
v57 = load_dir(V57_DIR)
print(f"  v56: {len(v56)} archivos | v57: {len(v57)} archivos")

s56 = compute_stats(v56)
s57 = compute_stats(v57)

print()
print("=" * 68)
print("COMPARATIVA v57 vs v56 (baseline)")
print("=" * 68)
print(f"{'Metrica':<24} {'v56 (base)':>14} {'v57 (new)':>14} {'Delta':>10}")
print("-" * 68)

def row(label, v56v, v57v, unit=''):
    dstr = delta_str(v57v, v56v, unit) if isinstance(v57v, (int,float)) else ''
    print(f"{label:<24} {str(v56v)+unit:>14} {str(v57v)+unit:>14} {dstr:>10}")

for cat in CATS:
    n56 = s56['cats'].get(cat, 0); p56 = round(n56*100/s56['n'])
    n57 = s57['cats'].get(cat, 0); p57 = round(n57*100/s57['n'])
    diff = n57-n56
    sign = '+' if diff >= 0 else ''
    print(f"{cat:<24} {n56:>5} ({p56:>2}%)      {n57:>5} ({p57:>2}%)    {sign}{diff:>5}")

print("-" * 68)
row("Tasa OK (%)", s56['ok_rate'], s57['ok_rate'], "%")
row("Coincidencia oficio (%)", s56['coin_rate'], s57['coin_rate'], "%")
print("-" * 68)
row("Latencia media (ms)", s56['lat_mean'], s57['lat_mean'], "ms")
row("Latencia P95 (ms)", s56['lat_p95'], s57['lat_p95'], "ms")
row("tokens_out medio", s56['tok_mean'], s57['tok_mean'])
row("tokens_out max", s56['tok_max'], s57['tok_max'])

# Casos recuperados / empeorados
print()
print("=" * 68)
print("CASOS RECUPERADOS (peor → OK)")
print("=" * 68)
recovered, worsened = [], []
for id_, d56 in v56.items():
    if id_ not in v57: continue
    d57 = v57[id_]
    c56 = classify_cat(d56); c57 = classify_cat(d57)
    if c56 not in OK_CATS and c57 in OK_CATS:
        recovered.append({'id': id_, 'oficio': d56.get('oficio',''), 'from': c56, 'to': c57})
    elif c56 in OK_CATS and c57 not in OK_CATS:
        worsened.append({'id': id_, 'oficio': d56.get('oficio',''), 'from': c56, 'to': c57})

if recovered:
    for r in sorted(recovered, key=lambda x: x['id']):
        print(f"  ID {r['id']:>4} [{r['oficio']:<22}]: {r['from']} -> {r['to']}")
else:
    print("  (ninguno)")

print()
print("=" * 68)
print("CASOS EMPEORADOS (OK -> peor)")
print("=" * 68)
if worsened:
    for r in sorted(worsened, key=lambda x: x['id']):
        print(f"  ID {r['id']:>4} [{r['oficio']:<22}]: {r['from']} -> {r['to']}")
else:
    print("  (ninguno)")

# Coincidencia oficio por oficio
print()
print("=" * 68)
print("COINCIDENCIA OFICIO POR OFICIO")
print("=" * 68)
print(f"{'Oficio':<26} {'v56':>8} {'v57':>8} {'Delta':>8}")
print("-" * 60)
all_oficios = sorted(set(list(s56['oficio_total'].keys()) + list(s57['oficio_total'].keys())))
for oficio in all_oficios:
    t56 = s56['oficio_total'].get(oficio, 0)
    t57 = s57['oficio_total'].get(oficio, 0)
    c56 = s56['oficio_coin'].get(oficio, 0)
    c57 = s57['oficio_coin'].get(oficio, 0)
    p56 = round(c56*100/t56) if t56 else 0
    p57 = round(c57*100/t57) if t57 else 0
    diff = p57-p56
    sign = '+' if diff >= 0 else ''
    print(f"  {oficio[:24]:<24}   {p56:>3}%     {p57:>3}%   {sign}{diff:>3}pp")

# Semaforo de calidad
print()
print("=" * 68)
print("SEMAFORO")
print("=" * 68)
vacio_new  = s57['cats'].get('VACIO', 0)
trunc_new  = s57['cats'].get('TRUNCADO', 0)
trunc_base = s56['cats'].get('TRUNCADO', 0)
ok_diff    = s57['ok_rate'] - s56['ok_rate']

checks = [
    ("VACIO = 0",           vacio_new == 0,           f"VACIO = {vacio_new}"),
    ("TRUNCADO no empeora", trunc_new <= trunc_base,  f"TRUNCADO {trunc_base} -> {trunc_new}"),
    ("Tasa OK no baja >1pp",ok_diff >= -1.0,          f"OK {s56['ok_rate']}% -> {s57['ok_rate']}% (delta {ok_diff:+.1f}pp)"),
    ("Coincide oficio mejora o igual", s57['coin_rate'] >= s56['coin_rate'] - 0.5,
                                          f"Coin {s56['coin_rate']}% -> {s57['coin_rate']}%"),
]
all_ok = True
for label, ok, detail in checks:
    sym = "OK " if ok else "NOK"
    print(f"  [{sym}] {label:<34} {detail}")
    if not ok: all_ok = False

print()
if all_ok:
    print("RESULTADO: CANDIDATO ESTABLE -- listo para tag v57-stable")
else:
    print("RESULTADO: REVISAR -- al menos un KPI fuera de rango")
