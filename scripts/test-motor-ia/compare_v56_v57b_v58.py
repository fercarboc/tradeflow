"""
Análisis comparativo v56 (baseline) vs v57b vs v58.
Clasifica empeoramientos por causa:
  A - Regresión por cambio implementado
  B - Variación no determinista del LLM
  C - Diferencia de matching de catálogo
  D - TRUNCADO preexistente (baseline)
  E - Error técnico
  F - Diferencia por cobertura del catálogo

Uso: python compare_v56_v57b_v58.py
"""
import json, os, glob, statistics, sys
from collections import Counter, defaultdict

BASE   = r'c:/tradeflow/scripts/test-motor-ia/output'
V56    = os.path.join(BASE, 'benchmark_v56_full')
V57B   = os.path.join(BASE, 'runs/v57b_candidate')
V58    = os.path.join(BASE, 'runs/v58_candidate')

CATS    = ['OK_CATALOGO','OK_MIXTO','SOLO_SUGERIDAS','VACIO','TRUNCADO','ERROR_TECNICO','PRECIO_INVALIDO']
OK_CATS = {'OK_CATALOGO','OK_MIXTO'}

# ── Casos C conocidos (inconsistencia origen/precio_origen en v57b) ────────────
CASOS_C = {79, 176, 196, 302}

# ── TRUNCADO crónicos (baseline v56) ──────────────────────────────────────────
TRUNCADO_CRONICO = {7, 106, 235, 320}

# ── Casos recuperados por applyOficioRules en v57b ────────────────────────────
CASOS_OFICIO_RULES = {24, 128, 139, 246, 248, 310}

# ─────────────────────────────────────────────────────────────────────────────

def load_dir(path):
    results = {}
    for fp in glob.glob(os.path.join(path, '*.json')):
        try:
            with open(fp, encoding='utf-8') as f:
                d = json.load(f)
            results[d['id']] = d
        except Exception:
            pass
    return results

def classify_cat(d):
    cl  = d.get('classification', {})
    cat = cl.get('category', 'ERROR_TECNICO')
    meta = d.get('raw_response', {}).get('_meta', {})
    if meta.get('stop_reason') == 'max_tokens' and cat == 'VACIO':
        cat = 'TRUNCADO'
    return cat

def get_oficio_detectado(d):
    q = d.get('raw_response', {}).get('quote', {})
    offs = q.get('oficios_detectados', [])
    return offs[0].get('oficio', '') if offs else ''

def get_n_catalogo(d):
    """Cuenta partidas con origen=catalogo o proveedor."""
    q = d.get('raw_response', {}).get('quote', {})
    ps = q.get('partidas', [])
    return sum(1 for p in ps if p.get('origen') in ('catalogo', 'proveedor'))

def get_n_partidas(d):
    q = d.get('raw_response', {}).get('quote', {})
    return len(q.get('partidas', []))

def get_tokens_out(d):
    return d.get('raw_response', {}).get('_meta', {}).get('tokens_out', 0)

def get_stop_reason(d):
    return d.get('raw_response', {}).get('_meta', {}).get('stop_reason', '')

def compute_stats(results):
    cats = Counter()
    latencies, tokens = [], []
    n_coincide = 0
    oficio_total = defaultdict(int)
    oficio_ok    = defaultdict(int)
    oficio_coin  = defaultdict(int)

    for d in results.values():
        cat = classify_cat(d)
        cats[cat] += 1
        latencies.append(d.get('latency_ms', 0))
        tokens.append(get_tokens_out(d))
        oficio_bm = d.get('oficio', '')
        oficio_total[oficio_bm] += 1
        if cat in OK_CATS:
            oficio_ok[oficio_bm] += 1
        if d.get('classification', {}).get('coincide_oficio') == 'SI':
            n_coincide += 1
            oficio_coin[oficio_bm] += 1

    n = len(results)
    lat_s = sorted(latencies)
    tok_s = sorted(tokens)
    return {
        'n': n,
        'cats': cats,
        'ok': sum(cats[c] for c in OK_CATS),
        'ok_rate': round(sum(cats[c] for c in OK_CATS) * 100 / n, 1) if n else 0,
        'lat_mean': int(statistics.mean(latencies)) if latencies else 0,
        'lat_p95':  lat_s[max(0, int(n * 0.95) - 1)] if lat_s else 0,
        'tok_mean': int(statistics.mean(tokens)) if tokens else 0,
        'tok_max':  max(tokens) if tokens else 0,
        'n_coincide': n_coincide,
        'coin_rate': round(n_coincide * 100 / n, 1) if n else 0,
        'oficio_total': oficio_total,
        'oficio_ok': oficio_ok,
        'oficio_coin': oficio_coin,
    }

# ── Clasificación de causa de empeoramiento ───────────────────────────────────

def classify_cause(id_, d56, d57b, d58):
    """
    Compara el caso de v57b (referencia inmediata) con v58.
    Devuelve (causa_letra, descripcion).
    """
    cat56  = classify_cat(d56)  if d56  else 'MISSING'
    cat57b = classify_cat(d57b) if d57b else 'MISSING'
    cat58  = classify_cat(d58)  if d58  else 'MISSING'

    tok56   = get_tokens_out(d56)  if d56  else 0
    tok57b  = get_tokens_out(d57b) if d57b else 0
    tok58   = get_tokens_out(d58)  if d58  else 0

    sr56   = get_stop_reason(d56)  if d56  else ''
    sr58   = get_stop_reason(d58)  if d58  else ''

    nc56   = get_n_catalogo(d56)  if d56  else 0
    nc57b  = get_n_catalogo(d57b) if d57b else 0
    nc58   = get_n_catalogo(d58)  if d58  else 0

    np56   = get_n_partidas(d56)  if d56  else 0
    np58   = get_n_partidas(d58)  if d58  else 0

    # D: TRUNCADO crónico
    if id_ in TRUNCADO_CRONICO:
        return 'D', f'TRUNCADO crónico desde v56 (sr56={sr56},tok56={tok56})'

    # D: Nuevo TRUNCADO en v58 (max_tokens)
    if cat58 in ('TRUNCADO', 'VACIO') and sr58 == 'max_tokens':
        if cat56 in ('TRUNCADO', 'VACIO') and sr56 == 'max_tokens':
            return 'D', f'TRUNCADO en ambas versiones (tok56={tok56},tok58={tok58})'
        return 'D', f'TRUNCADO en v58 (tok58={tok58},sr58={sr58}) — posible no-determinismo de token budget'

    # E: Error técnico
    if cat58 == 'ERROR_TECNICO':
        return 'E', 'Error HTTP o técnico en v58'

    # A: Regresión directa del cambio — solo si el fix en origen causara un PRECIO_INVALIDO
    # (cambiar origen de sugerida_ia a catalogo con precio=0 → PRECIO_INVALIDO)
    if cat58 == 'PRECIO_INVALIDO' and cat57b in OK_CATS:
        return 'A', 'Posible regresión: origen=catalogo con precio=0 → PRECIO_INVALIDO'

    # C: Diferencia de matching de catálogo
    # (mismas partidas pero cambia n_catalogo — descripciones distintas no matchearon)
    if np58 == np56 and nc58 != nc56:
        return 'C', f'Mismas partidas ({np58}) pero n_catalogo cambió {nc56}→{nc58}'

    # F: Diferencia de cobertura del catálogo
    if cat58 == 'SOLO_SUGERIDAS' and cat57b == 'SOLO_SUGERIDAS':
        return 'F', f'SOLO_SUGERIDAS en ambas v57b y v58 — cobertura catálogo insuficiente'

    # B: Variación no determinista
    # (tokens distintos, partidas distintas, sin cambio de oficio rules ni truncado)
    if tok58 != tok57b or np58 != get_n_partidas(d57b):
        return 'B', (f'No-determinismo: tok57b={tok57b}→tok58={tok58}, '
                     f'partidas57b={get_n_partidas(d57b)}→partidas58={np58}')

    return 'B', 'Variación no determinista (causa no identificada)'

# ─────────────────────────────────────────────────────────────────────────────

print("Cargando datos...")
v56_data  = load_dir(V56)
v57b_data = load_dir(V57B)
v58_data  = load_dir(V58)
print(f"  v56={len(v56_data)} | v57b={len(v57b_data)} | v58={len(v58_data)}")

if len(v58_data) < 390:
    print(f"\n⚠ Solo {len(v58_data)} archivos v58 — ¿test incompleto?")
    sys.exit(1)

s56   = compute_stats(v56_data)
s57b  = compute_stats(v57b_data)
s58   = compute_stats(v58_data)

SEP = '=' * 72

print()
print(SEP)
print('KPIs — COMPARATIVA v56 / v57b / v58')
print(SEP)
print(f"{'Métrica':<26} {'v56':>10} {'v57b':>10} {'v58':>10} {'Δv58-v57b':>10}")
print('-' * 72)

def krow(label, fn, unit=''):
    v56v  = fn(s56)
    v57bv = fn(s57b)
    v58v  = fn(s58)
    diff  = v58v - v57bv
    sign  = '+' if diff >= 0 else ''
    print(f"{label:<26} {str(v56v)+unit:>10} {str(v57bv)+unit:>10} {str(v58v)+unit:>10} {sign+str(round(diff,1))+unit:>10}")

for cat in CATS:
    v56n  = s56['cats'].get(cat,0)
    v57bn = s57b['cats'].get(cat,0)
    v58n  = s58['cats'].get(cat,0)
    p56   = round(v56n*100/s56['n'])
    p57b  = round(v57bn*100/s57b['n'])
    p58   = round(v58n*100/s58['n'])
    d     = v58n - v57bn
    sign  = '+' if d >= 0 else ''
    print(f"{cat:<26} {v56n:>5}({p56:2}%)  {v57bn:>5}({p57b:2}%)  {v58n:>5}({p58:2}%)  {sign+str(d):>8}")

print('-' * 72)
krow('Tasa OK (%)', lambda s: s['ok_rate'], '%')
krow('Coincidencia oficio (%)', lambda s: s['coin_rate'], '%')
print('-' * 72)
krow('Latencia media (ms)', lambda s: s['lat_mean'], 'ms')
krow('Latencia P95 (ms)', lambda s: s['lat_p95'], 'ms')
krow('tokens_out medio', lambda s: s['tok_mean'])
krow('tokens_out max', lambda s: s['tok_max'])

# ── Movimientos de categoría ──────────────────────────────────────────────────

print()
print(SEP)
print('MOVIMIENTOS v57b → v58')
print(SEP)

recovered_from_v57b = []  # v57b ∉ OK → v58 ∈ OK
worsened_from_v57b  = []  # v57b ∈ OK → v58 ∉ OK

for id_, d58 in v58_data.items():
    d57b = v57b_data.get(id_)
    d56  = v56_data.get(id_)
    if not d57b: continue
    c57b = classify_cat(d57b)
    c58  = classify_cat(d58)
    if c57b not in OK_CATS and c58 in OK_CATS:
        recovered_from_v57b.append((id_, d56, d57b, d58))
    elif c57b in OK_CATS and c58 not in OK_CATS:
        worsened_from_v57b.append((id_, d56, d57b, d58))

print(f"\nCASOS RECUPERADOS respecto a v57b ({len(recovered_from_v57b)}):")
for id_, d56, d57b, d58 in sorted(recovered_from_v57b, key=lambda x: x[0]):
    c56  = classify_cat(d56)  if d56  else '?'
    c57b = classify_cat(d57b)
    c58  = classify_cat(d58)
    of   = d58.get('oficio','')
    print(f"  ID {str(id_):>4} [{of:<22}]: {c56:>16} / {c57b:>16} → {c58}")

print(f"\nCASOS EMPEORADOS respecto a v57b ({len(worsened_from_v57b)}):")
for id_, d56, d57b, d58 in sorted(worsened_from_v57b, key=lambda x: x[0]):
    c56  = classify_cat(d56)  if d56  else '?'
    c57b = classify_cat(d57b)
    c58  = classify_cat(d58)
    of   = d58.get('oficio','')
    cause, detail = classify_cause(id_, d56, d57b, d58)
    print(f"  ID {str(id_):>4} [{of:<22}]: {c57b:>16} → {c58:<16} [Causa {cause}] {detail[:60]}")

# ── Análisis de causa por empeorados ─────────────────────────────────────────

print()
print(SEP)
print('ANÁLISIS DE CAUSA — EMPEORADOS v57b → v58')
print(SEP)

cause_counts = Counter()
cause_details: dict[str, list] = defaultdict(list)

for id_, d56, d57b, d58 in worsened_from_v57b:
    cause, detail = classify_cause(id_, d56, d57b, d58)
    cause_counts[cause] += 1
    cause_details[cause].append((id_, d58.get('oficio',''), detail))

cause_labels = {
    'A': 'Regresión por cambio implementado',
    'B': 'Variación no determinista del LLM',
    'C': 'Diferencia de matching de catálogo',
    'D': 'TRUNCADO preexistente / token budget',
    'E': 'Error técnico',
    'F': 'Cobertura de catálogo insuficiente',
}

total_emp = len(worsened_from_v57b)
for letra in sorted(cause_counts.keys()):
    n = cause_counts[letra]
    pct = round(n*100/total_emp) if total_emp else 0
    print(f"\n[{letra}] {cause_labels.get(letra,'?')} — {n} casos ({pct}%)")
    for id_, of, det in cause_details[letra]:
        print(f"      ID {str(id_):>4} [{of:<22}] {det[:70]}")

# ── Coincidencia oficio por oficio ────────────────────────────────────────────

print()
print(SEP)
print('COINCIDENCIA OFICIO POR OFICIO — v56 / v57b / v58')
print(SEP)
print(f"{'Oficio':<26} {'v56':>6} {'v57b':>6} {'v58':>6} {'Δv58-v56':>9}")
print('-' * 56)
all_oficios = sorted(set(
    list(s56['oficio_total']) + list(s57b['oficio_total']) + list(s58['oficio_total'])
))
for of in all_oficios:
    t56   = s56['oficio_total'].get(of,0)
    t57b  = s57b['oficio_total'].get(of,0)
    t58   = s58['oficio_total'].get(of,0)
    c56   = s56['oficio_coin'].get(of,0)
    c57b  = s57b['oficio_coin'].get(of,0)
    c58   = s58['oficio_coin'].get(of,0)
    p56   = round(c56*100/t56)  if t56  else 0
    p57b  = round(c57b*100/t57b) if t57b else 0
    p58   = round(c58*100/t58)  if t58  else 0
    d58_56 = p58 - p56
    sign  = '+' if d58_56 >= 0 else ''
    print(f"  {of[:24]:<24} {p56:>4}%  {p57b:>4}%  {p58:>4}%  {sign+str(d58_56):>7}pp")

# ── Semáforo ──────────────────────────────────────────────────────────────────

print()
print(SEP)
print('SEMÁFORO DE CALIDAD — DECISIÓN DE PRODUCCIÓN')
print(SEP)

vacio_v56   = s56['cats'].get('VACIO',0)
vacio_v57b  = s57b['cats'].get('VACIO',0)
vacio_v58   = s58['cats'].get('VACIO',0)

trunc_v56   = s56['cats'].get('TRUNCADO',0)
trunc_v57b  = s57b['cats'].get('TRUNCADO',0)
trunc_v58   = s58['cats'].get('TRUNCADO',0)

ok_diff_v56  = s58['ok_rate'] - s56['ok_rate']
ok_diff_v57b = s58['ok_rate'] - s57b['ok_rate']
coin_diff    = s58['coin_rate'] - s56['coin_rate']

n_causa_a = cause_counts.get('A', 0)
n_real_regression = n_causa_a  # solo A son regresiones reales

checks = [
    ('VACIO = 0',                    vacio_v58 == 0,
     f"v56={vacio_v56} v57b={vacio_v57b} v58={vacio_v58}"),
    ('TRUNCADO ≤ v56 baseline',      trunc_v58 <= trunc_v56,
     f"v56={trunc_v56} v57b={trunc_v57b} v58={trunc_v58}"),
    ('Tasa OK ≥ v57b − 0.5pp',       ok_diff_v57b >= -0.5,
     f"v57b={s57b['ok_rate']}% v58={s58['ok_rate']}% Δ={ok_diff_v57b:+.1f}pp"),
    ('Tasa OK ≥ v56 − 1pp',          ok_diff_v56 >= -1.0,
     f"v56={s56['ok_rate']}% v58={s58['ok_rate']}% Δ={ok_diff_v56:+.1f}pp"),
    ('Coincidencia oficio ≥ v56',    s58['coin_rate'] >= s56['coin_rate'] - 0.5,
     f"v56={s56['coin_rate']}% v58={s58['coin_rate']}%"),
    ('0 regresiones causa A',        n_causa_a == 0,
     f"Causa A: {n_causa_a} casos"),
]

all_ok = True
warns  = 0
for label, ok, detail in checks:
    sym = '✓ OK ' if ok else '✗ NOK'
    print(f"  [{sym}] {label:<38} {detail}")
    if not ok:
        all_ok = False
        warns += 1

print()
if all_ok:
    verdict = '🟢 APTO PARA PRODUCCIÓN'
    reason  = 'Todos los KPIs dentro de rango. Sin regresiones causa A.'
elif warns == 1 and n_causa_a == 0:
    verdict = '🟡 REQUIERE REVISIÓN'
    reason  = f'{warns} KPI fuera de rango pero sin regresiones atribuibles al cambio.'
else:
    verdict = '🔴 ROLLBACK'
    reason  = f'{warns} KPIs fuera de rango o {n_causa_a} regresiones causa A.'

print(f"VEREDICTO: {verdict}")
print(f"Motivo: {reason}")

# ── Casos C: verificación específica ─────────────────────────────────────────

print()
print(SEP)
print('VERIFICACIÓN CASOS C (origen/precio_origen fix)')
print(SEP)
for id_ in sorted(CASOS_C):
    d56  = v56_data.get(id_)
    d57b = v57b_data.get(id_)
    d58  = v58_data.get(id_)
    c56  = classify_cat(d56)  if d56  else '?'
    c57b = classify_cat(d57b) if d57b else '?'
    c58  = classify_cat(d58)  if d58  else '?'
    nc58 = get_n_catalogo(d58) if d58 else 0
    np58 = get_n_partidas(d58) if d58 else 0
    fixed = '✓ CORREGIDO' if c58 in OK_CATS and c57b not in OK_CATS else ('~ igual' if c58 == c57b else '→ cambio')
    print(f"  ID {str(id_):>4} [{(d58 or {}).get('oficio',''):22}]: v56={c56:16} v57b={c57b:16} v58={c58:16} n_cat={nc58}/{np58} {fixed}")

print()
print("Fin del análisis.")
