"""
FASE 5 — Análisis profundo de los 74 errores reales del modelo.
Excluye Mantenimiento General (ambiguo) y alias (Reformas Integrales).
Agrupa por frontera semántica y muestra textos reales.
"""
import json, os, glob
from collections import Counter, defaultdict

DIR = r'c:/tradeflow/scripts/test-motor-ia/output/benchmark_v56_full'

ALIAS_MAP = {
    'Albañilería':          'albanileria',
    'Carpintería':          'carpinteria',
    'Cerrajería':           'cerrajeria',
    'Climatización':        'climatizacion',
    'Contra Incendios':     'contra_incendios',
    'Cristalería':          'cristaleria',
    'Electricidad':         'electricidad',
    'Energía Solar':        'energia_solar',
    'Fachadas':             'fachadas',
    'Fontanería':           'fontaneria',
    'Impermeabilización':   'impermeabilizacion',
    'Jardinería':           'jardineria',
    'Mantenimiento General':'mantenimiento_general',
    'Persianas':            'persianas',
    'Pintura':              'pintura',
    'Pladur':               'pladur_escayola',
    'Reformas Integrales':  'reforma_integral',
    'Suelos y Alicatados':  'suelos_alicatados',
    'Tejados/Cubiertas':    'tejados_cubiertas',
    'Telecomunicaciones':   'telecomunicaciones',
}

results = []
for fp in sorted(glob.glob(os.path.join(DIR, '*.json'))):
    with open(fp, encoding='utf-8') as f:
        d = json.load(f)
    results.append(d)

# Seleccionar errores reales (excluir alias y Mantenimiento General)
real_errors = []
for d in results:
    expected_label = d['oficio']
    expected_id = ALIAS_MAP.get(expected_label, expected_label.lower())
    cl = d['classification']
    detected = cl.get('oficio_detectado', '') or ''
    coincide = cl.get('coincide_oficio', 'NO')

    if coincide == 'SI':
        continue

    # Excluir alias errors
    is_alias = (detected == expected_id or
                (detected and expected_id and (detected in expected_id or expected_id in detected)))
    if is_alias:
        continue

    # Excluir Mantenimiento General (benchmark ambiguo)
    if expected_label == 'Mantenimiento General':
        continue

    text = d.get('texto', '') or d.get('raw_response', {}).get('transcript', '') or ''
    partidas = []
    quote = d.get('raw_response', {}).get('quote', {})
    if quote and isinstance(quote, dict):
        partidas = [p.get('nombre', '') for p in quote.get('partidas', [])[:3]]

    real_errors.append({
        'id': d['id'],
        'expected_label': expected_label,
        'expected_id': expected_id,
        'detected': detected,
        'text': text,
        'partidas': partidas,
        'cat': cl['category'],
    })

print("=" * 72)
print(f"ERRORES REALES DEL MODELO (excl. Mantenimiento General y alias)")
print(f"Total: {len(real_errors)} errores reales")
print("=" * 72)

# Agrupar por frontera semántica
FRONTERAS = {
    'Tejados vs Impermeabilización': {
        'expected': {'tejados_cubiertas'},
        'detected': {'impermeabilizacion', 'albanileria', 'cristaleria', 'fachadas'},
    },
    'Albañilería vs Suelos/Otros': {
        'expected': {'albanileria'},
        'detected': {'suelos_alicatados', 'fachadas', 'pladur_escayola', 'impermeabilizacion', 'pintura'},
    },
    'Fontanería vs Climatización': {
        'expected': {'fontaneria'},
        'detected': {'climatizacion', 'energia_solar', 'electricidad'},
    },
    'Pintura vs Fachadas': {
        'expected': {'pintura'},
        'detected': {'fachadas', 'albanileria', 'impermeabilizacion'},
    },
    'Impermeabilización mal clasificada': {
        'expected': {'impermeabilizacion'},
        'detected': {'tejados_cubiertas', 'albanileria', 'fachadas', 'pintura'},
    },
    'Climatización mal clasificada': {
        'expected': {'climatizacion'},
        'detected': {'fontaneria', 'electricidad', 'energia_solar', 'albanileria'},
    },
}

grouped = defaultdict(list)
resto = []

for e in real_errors:
    placed = False
    for frontera, rule in FRONTERAS.items():
        if e['expected_id'] in rule['expected'] and (
            e['detected'] in rule['detected'] or not rule['detected']
        ):
            grouped[frontera].append(e)
            placed = True
            break
    if not placed:
        grouped['Otros'].append(e)

def print_group(name, errors):
    print(f"\n{'='*72}")
    print(f"FRONTERA: {name}  ({len(errors)} errores)")
    print('='*72)
    detected_dist = Counter(e['detected'] for e in errors)
    print(f"Distribución detectado: {dict(detected_dist)}")
    print()
    for e in errors:
        print(f"  ID {e['id']:>4} | esperado: {e['expected_id']:<22} | detectado: {e['detected']}")
        print(f"         TEXTO: {e['text'][:100]}")
        if e['partidas']:
            print(f"         PARTIDAS: {' / '.join(p[:40] for p in e['partidas'])}")
        print()

for frontera in list(FRONTERAS.keys()) + ['Otros']:
    if grouped[frontera]:
        print_group(frontera, grouped[frontera])

print("\n" + "="*72)
print("RESUMEN POR FRONTERA")
print("="*72)
total_covered = 0
for frontera in list(FRONTERAS.keys()) + ['Otros']:
    n = len(grouped[frontera])
    total_covered += n
    if n:
        print(f"  {frontera:<40}: {n:>3} errores")
print(f"  {'TOTAL':<40}: {total_covered:>3}")

print("\n" + "="*72)
print("DETALLE COMPLETO DE CASOS POR OFICIO ESPERADO")
print("="*72)
by_expected = defaultdict(list)
for e in real_errors:
    by_expected[e['expected_label']].append(e)

for label in sorted(by_expected):
    errors = by_expected[label]
    detected_dist = Counter(e['detected'] for e in errors)
    print(f"\n  {label} ({len(errors)} errores)")
    print(f"  Detectado: {dict(detected_dist)}")
    for e in errors:
        print(f"    ID {e['id']:>4}: {e['text'][:90]}")
        print(f"           → detectado: '{e['detected']}'")
        if e['partidas']:
            print(f"           → partidas: {e['partidas'][0][:60]}")
