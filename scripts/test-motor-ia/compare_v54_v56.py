import json, os, statistics
from collections import Counter

raw_dir = r'c:/tradeflow/scripts/test-motor-ia/output/raw'
base_dir = r'c:/tradeflow/scripts/test-motor-ia/output/benchmark_v54_baseline'

ids = list(range(361, 381))
v54_cats = {}; v56_cats = {}; v54_lat = []; v56_lat = []; v54_tok = []; v56_tok = []

for i in ids:
    name = 'Reformas Integrales_{}.json'.format(i)
    with open(os.path.join(base_dir, name), encoding='utf-8') as f:
        d = json.load(f)
    v54_cats[i] = d['classification']['category']
    v54_lat.append(d['latency_ms'])
    v54_tok.append(d['raw_response'].get('_meta', {}).get('tokens_out', 0))
    with open(os.path.join(raw_dir, name), encoding='utf-8') as f:
        d = json.load(f)
    v56_cats[i] = d['classification']['category']
    v56_lat.append(d['latency_ms'])
    v56_tok.append(d['raw_response'].get('_meta', {}).get('tokens_out', 0))

c54 = Counter(v54_cats.values()); c56 = Counter(v56_cats.values())
ok54 = c54.get('OK_CATALOGO',0)+c54.get('OK_MIXTO',0)
ok56 = c56.get('OK_CATALOGO',0)+c56.get('OK_MIXTO',0)
p95_54 = sorted(v54_lat)[int(len(v54_lat)*0.95)-1]
p95_56 = sorted(v56_lat)[int(len(v56_lat)*0.95)-1]

print('=== COMPARATIVA v54 vs v56 (20 Reformas Integrales) ===')
print('Categoria        v54      v56')
print('-' * 40)
for cat in ['OK_MIXTO','SOLO_SUGERIDAS','VACIO','TRUNCADO']:
    n4 = c54.get(cat,0); n6 = c56.get(cat,0)
    if n4 or n6:
        arrow = ' +{}'.format(n6-n4) if n6>n4 else ' {}'.format(n6-n4) if n6<n4 else ''
        print('{:<16} {:>4} ({:>2}%)  {:>4} ({:>2}%){}'.format(cat, n4, n4*5, n6, n6*5, arrow))

print('')
print('Tasa OK          {:>4} ({:>2}%)  {:>4} ({:>2}%)  +{}pp'.format(ok54, ok54*5, ok56, ok56*5, (ok56-ok54)*5))
print('Latencia media   {:>7}ms {:>7}ms'.format(int(statistics.mean(v54_lat)), int(statistics.mean(v56_lat))))
print('Latencia P95     {:>7}ms {:>7}ms'.format(p95_54, p95_56))
print('tokens_out medio {:>7}   {:>7}'.format(int(statistics.mean(v54_tok)), int(statistics.mean(v56_tok))))
print('tokens_out max   {:>7}   {:>7}'.format(max(v54_tok), max(v56_tok)))
print('')
print('=== CASOS RECUPERADOS (SOLO_SUGERIDAS/VACIO -> OK) ===')
found = False
for i in ids:
    if v54_cats[i] in ('SOLO_SUGERIDAS','VACIO') and v56_cats[i] in ('OK_CATALOGO','OK_MIXTO'):
        print('  #{}: {} -> {}'.format(i, v54_cats[i], v56_cats[i]))
        found = True
if not found:
    print('  (ninguno)')
print('')
print('=== CASOS EMPEORADOS (OK -> peor) ===')
found = False
for i in ids:
    if v54_cats[i] in ('OK_CATALOGO','OK_MIXTO') and v56_cats[i] not in ('OK_CATALOGO','OK_MIXTO'):
        print('  #{}: {} -> {}'.format(i, v54_cats[i], v56_cats[i]))
        found = True
if not found:
    print('  (ninguno)')
print('')
print('=== TABLA COMPLETA ===')
for i in ids:
    ok4 = v54_cats[i] in ('OK_CATALOGO','OK_MIXTO')
    ok6 = v56_cats[i] in ('OK_CATALOGO','OK_MIXTO')
    tag = 'RECUPERADO' if not ok4 and ok6 else ('EMPEORADO' if ok4 and not ok6 else '')
    print('  #{:<4}  {:<16} -> {:<16} {}'.format(i, v54_cats[i], v56_cats[i], tag))
