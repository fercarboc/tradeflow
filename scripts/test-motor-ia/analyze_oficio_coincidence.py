"""
Análisis de coincidencia de oficio: qué detecta el modelo vs qué espera el benchmark.
Distingue entre:
  A) Error de clasificación real (el modelo eligió el oficio EQUIVOCADO)
  B) Error de etiqueta (el modelo eligió bien pero con nombre diferente)
"""
import json, os, glob
from collections import Counter, defaultdict

DIR = r'c:/tradeflow/scripts/test-motor-ia/output/benchmark_v56_full'

# Cargar todos los resultados
results = []
for fp in sorted(glob.glob(os.path.join(DIR, '*.json'))):
    with open(fp, encoding='utf-8') as f:
        d = json.load(f)
    results.append(d)

# Mapeo benchmark-label → oficio_id canónico del modelo
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

# Para cada oficio del benchmark: ¿qué detecta el modelo?
oficio_detections = defaultdict(Counter)  # expected → Counter(detected)
mismatch_cases = []

for d in results:
    expected_label = d['oficio']
    expected_id = ALIAS_MAP.get(expected_label, expected_label.lower())
    cl = d['classification']
    detected = cl.get('oficio_detectado', '') or ''
    coincide = cl.get('coincide_oficio', 'NO')

    oficio_detections[expected_label][detected] += 1

    if coincide == 'NO':
        # Determinar tipo de error
        is_alias_mismatch = (detected == expected_id or
                             (detected and expected_id and (
                                 detected in expected_id or expected_id in detected)))
        mismatch_cases.append({
            'id': d['id'],
            'expected_label': expected_label,
            'expected_id': expected_id,
            'detected': detected,
            'cat': cl['category'],
            'alias_mismatch': is_alias_mismatch,
        })

print("=" * 70)
print("ANÁLISIS COINCIDENCIA DE OFICIO — v56 (400 tests)")
print("=" * 70)

total = len(results)
n_coincide = sum(1 for d in results if d['classification']['coincide_oficio'] == 'SI')
n_alias = sum(1 for m in mismatch_cases if m['alias_mismatch'])
n_real_error = sum(1 for m in mismatch_cases if not m['alias_mismatch'])

print(f"\nTotal: {total}")
print(f"Coincide (SI):         {n_coincide:>4} ({round(n_coincide*100/total)}%)")
print(f"No coincide (NO):      {len(mismatch_cases):>4} ({round(len(mismatch_cases)*100/total)}%)")
print(f"  → Error de alias:    {n_alias:>4} ({round(n_alias*100/total)}%) — modelo elige bien, nombre diferente")
print(f"  → Error real:        {n_real_error:>4} ({round(n_real_error*100/total)}%) — modelo elige oficio INCORRECTO")
print(f"\nCoincidencia real:     {n_coincide+n_alias:>4} ({round((n_coincide+n_alias)*100/total)}%) [corregida por alias]")

print("\n" + "=" * 70)
print("ERRORES DE ALIAS (modelo elige id correcto, formato diferente)")
print("=" * 70)
alias_cases = [m for m in mismatch_cases if m['alias_mismatch']]
alias_by_oficio = Counter(m['expected_label'] for m in alias_cases)
if alias_cases:
    for oficio, count in alias_by_oficio.most_common():
        # Show what was detected
        samples = [m for m in alias_cases if m['expected_label'] == oficio]
        detected_counts = Counter(m['detected'] for m in samples)
        print(f"  {oficio:<24}: {count} casos → detectado: {dict(detected_counts)}")
else:
    print("  (ninguno)")

print("\n" + "=" * 70)
print("ERRORES REALES POR OFICIO (modelo elige oficio INCORRECTO)")
print("=" * 70)
real_errors = [m for m in mismatch_cases if not m['alias_mismatch']]
real_by_oficio = defaultdict(list)
for m in real_errors:
    real_by_oficio[m['expected_label']].append(m)

for label in sorted(real_by_oficio):
    cases = real_by_oficio[label]
    detected_counts = Counter(m['detected'] for m in cases)
    expected_id = ALIAS_MAP.get(label, label)
    print(f"\n  {label} (esperado: {expected_id})")
    print(f"  {len(cases)} errores → modelo detecta: {dict(detected_counts)}")
    # Show first 3 sample IDs
    sample_ids = [m['id'] for m in cases[:5]]
    print(f"  IDs ejemplo: {sample_ids}")

print("\n" + "=" * 70)
print("DETALLE COMPLETO POR OFICIO (expected → detected distribution)")
print("=" * 70)
for label in sorted(oficio_detections):
    total_oficio = sum(oficio_detections[label].values())
    expected_id = ALIAS_MAP.get(label, label)
    correct = oficio_detections[label].get(expected_id, 0)
    print(f"\n  {label} → esperado '{expected_id}'  [{correct}/{total_oficio} correctos]")
    for detected, count in oficio_detections[label].most_common(5):
        marker = "✓" if detected == expected_id else "✗"
        print(f"    {marker} '{detected}': {count}")
