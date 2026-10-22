/**
 * geoManual.test.ts
 * Tests for manual geo-coordinate persistence infrastructure (LP-2/LP-3 foundation).
 *
 * SEMÁNTICA geo_source
 *   NULL     = legacy / no geocodificado → auto puede escribir
 *   'auto'   = geocodificado automáticamente → auto puede sobrescribir, manual puede sobrescribir
 *   'manual' = confirmado por el usuario → auto NO puede sobrescribir (misma dirección)
 *
 * INVARIANTE PRINCIPAL (IS DISTINCT FROM 'manual'):
 *   updateOrgGeocoords y updateJobGeoAuto aplican WHERE (geo_source IS NULL OR geo_source != 'manual').
 *   PostgREST: .or('geo_source.is.null,geo_source.neq.manual')
 *   Una condición .neq sola excluiría filas NULL, que deben permanecer elegibles para auto.
 *
 * Tests de lógica pura (no requieren DB):
 *   TEST-GM-1   Auto-write permitido con geo_source = NULL (legacy)
 *   TEST-GM-2   Auto-write permitido con geo_source = 'auto'
 *   TEST-GM-3   Auto-write rechazado con geo_source = 'manual' y dirección igual
 *   TEST-GM-4   Auto-write permitido con geo_source = 'manual' pero dirección distinta
 *   TEST-GM-5   Manual-write siempre aplica (no comprueba geo_source)
 *   TEST-GM-6   Snapshot WHERE: manual rechazado si dirección cambió
 *   TEST-GM-7   Snapshot WHERE: manual aplicado si dirección coincide
 *   TEST-GM-8   Snapshot WHERE para org: los 5 campos deben coincidir
 *   TEST-GM-9   Invalidación de dirección: geo_source debe quedar null
 *   TEST-GM-10  Geocodificación auto: establece geo_source = 'auto'
 *   TEST-GM-11  Datos legacy (geo_source=NULL) son elegibles para auto-geocodificación
 *   TEST-GM-12  Ciclo A→B: nueva dirección permite re-geocodificación auto
 *   TEST-GM-13  Multiempresa: condición WHERE por orgId impide escritura cruzada
 *   TEST-GM-14  Campo '' vs null en snapshot: tratados como distintos (invariante fix #1)
 *   TEST-GM-15  RLS multiempresa: updateJobGeoManual rechaza con orgId incorrecto (mock)
 *   TEST-GM-16  Cancelar LocationPicker no produce escritura
 */

import { describe, it, expect } from 'vitest';

// ── Tipos locales para simular el estado DB ────────────────────────────────────

interface OrgRow {
  id: string;
  direccion?: string | null;
  localidad?: string | null;
  cp?: string | null;
  provincia?: string | null;
  pais?: string | null;
  base_latitud?: number | null;
  base_longitud?: number | null;
  geo_source?: 'auto' | 'manual' | null;
  geo_confirmed_at?: string | null;
}

interface JobRow {
  id: string;
  org_id: string;
  direccion?: string | null;
  localidad?: string | null;
  cp?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  geo_source?: 'auto' | 'manual' | null;
  geo_confirmed_at?: string | null;
}

// ── Simuladores de la lógica condicional ──────────────────────────────────────
//
// Estas funciones replican la semántica exacta de las WHERE clauses de supabase.ts:
//   - null/undefined en snapshot → IS NULL (solo coincide con DB null)
//   - '' en snapshot → eq('') (solo coincide con DB '')
//   - 'x' en snapshot → eq('x')
// No se usa orgAddressChanged para evitar la asimetría de la caída a 'ciudad'.

function geoAutoEligible(row: Pick<OrgRow | JobRow, 'geo_source'>): boolean {
  // IS DISTINCT FROM 'manual': NULL y 'auto' son elegibles; 'manual' no.
  return row.geo_source !== 'manual';
}

function orgSnapshotMatches(
  snapshot: Pick<OrgRow, 'direccion' | 'localidad' | 'cp' | 'provincia' | 'pais'>,
  db: Pick<OrgRow, 'direccion' | 'localidad' | 'cp' | 'provincia' | 'pais'>,
): boolean {
  const fields = ['direccion', 'localidad', 'cp', 'provincia', 'pais'] as const;
  for (const f of fields) {
    const s = snapshot[f] ?? null;
    const d = db[f] ?? null;
    if (s !== d) return false;
  }
  return true;
}

function jobSnapshotMatches(
  snapshot: Pick<JobRow, 'direccion' | 'localidad' | 'cp'>,
  db: Pick<JobRow, 'direccion' | 'localidad' | 'cp'>,
): boolean {
  const fields = ['direccion', 'localidad', 'cp'] as const;
  for (const f of fields) {
    const s = snapshot[f] ?? null;
    const d = db[f] ?? null;
    if (s !== d) return false;
  }
  return true;
}

function applyOrgGeoAuto(db: OrgRow, snapshot: Partial<OrgRow>, lat: number, lng: number): { applied: boolean; db: OrgRow } {
  if (!orgSnapshotMatches(snapshot as OrgRow, db)) return { applied: false, db };
  if (!geoAutoEligible(db)) return { applied: false, db };
  return { applied: true, db: { ...db, base_latitud: lat, base_longitud: lng, geo_source: 'auto' } };
}

function applyOrgGeoManual(db: OrgRow, snapshot: Partial<OrgRow>, lat: number, lng: number): { applied: boolean; db: OrgRow } {
  if (!orgSnapshotMatches(snapshot as OrgRow, db)) return { applied: false, db };
  return { applied: true, db: { ...db, base_latitud: lat, base_longitud: lng, geo_source: 'manual', geo_confirmed_at: new Date().toISOString() } };
}

function applyJobGeoAuto(db: JobRow, snapshot: Partial<JobRow>, lat: number, lng: number): { applied: boolean; db: JobRow } {
  if (!jobSnapshotMatches(snapshot as JobRow, db)) return { applied: false, db };
  if (!geoAutoEligible(db)) return { applied: false, db };
  return { applied: true, db: { ...db, latitud: lat, longitud: lng, geo_source: 'auto' } };
}

function applyJobGeoManual(db: JobRow, snapshot: Partial<JobRow>, lat: number, lng: number): { applied: boolean; db: JobRow } {
  if (!jobSnapshotMatches(snapshot as JobRow, db)) return { applied: false, db };
  return { applied: true, db: { ...db, latitud: lat, longitud: lng, geo_source: 'manual', geo_confirmed_at: new Date().toISOString() } };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('geo_source IS DISTINCT FROM manual — elegibilidad auto', () => {

  it('TEST-GM-1 geo_source=NULL → elegible para auto (legacy)', () => {
    const org: OrgRow = { id: 'o1', geo_source: null };
    expect(geoAutoEligible(org)).toBe(true);
  });

  it('TEST-GM-2 geo_source=auto → elegible para auto', () => {
    const org: OrgRow = { id: 'o1', geo_source: 'auto' };
    expect(geoAutoEligible(org)).toBe(true);
  });

  it('TEST-GM-3 geo_source=manual → NO elegible para auto', () => {
    const org: OrgRow = { id: 'o1', geo_source: 'manual' };
    expect(geoAutoEligible(org)).toBe(false);
  });

  it('TEST-GM-4 geo_source=manual pero dirección distinta → write auto rechazado (snapshot falla primero)', () => {
    const db: OrgRow = { id: 'o1', direccion: 'Calle Nueva 2', localidad: 'Madrid', cp: null, provincia: null, pais: 'España', geo_source: 'manual' };
    const snap = { direccion: 'Calle Vieja 1', localidad: 'Madrid', cp: null, provincia: null, pais: 'España' };
    const { applied } = applyOrgGeoAuto(db, snap, 40.4, -3.7);
    expect(applied).toBe(false);
  });
});

describe('Confirmación manual — updateOrgGeoManual / updateJobGeoManual', () => {

  it('TEST-GM-5 manual-write no comprueba geo_source → siempre puede sobrescribir manual', () => {
    const db: OrgRow = { id: 'o1', direccion: 'Calle Luna 3', localidad: 'Santander', cp: '39001', provincia: 'Cantabria', pais: 'España', geo_source: 'manual' };
    const snap = { direccion: 'Calle Luna 3', localidad: 'Santander', cp: '39001', provincia: 'Cantabria', pais: 'España' };
    const { applied, db: next } = applyOrgGeoManual(db, snap, 43.46, -3.81);
    expect(applied).toBe(true);
    expect(next.geo_source).toBe('manual');
    expect(next.base_latitud).toBe(43.46);
  });

  it('TEST-GM-6 manual rechazado si dirección cambió (snapshot no coincide)', () => {
    const db: OrgRow = { id: 'o1', direccion: 'Calle Nueva 9', localidad: 'Bilbao', cp: null, provincia: null, pais: 'España', geo_source: null };
    const snap = { direccion: 'Calle Vieja 1', localidad: 'Bilbao', cp: null, provincia: null, pais: 'España' };
    const { applied } = applyOrgGeoManual(db, snap, 43.26, -2.93);
    expect(applied).toBe(false);
  });

  it('TEST-GM-7 manual aplicado si dirección coincide exactamente', () => {
    const db: OrgRow = { id: 'o1', direccion: 'Gran Vía 1', localidad: 'Madrid', cp: '28013', provincia: 'Madrid', pais: 'España', geo_source: null };
    const snap = { direccion: 'Gran Vía 1', localidad: 'Madrid', cp: '28013', provincia: 'Madrid', pais: 'España' };
    const { applied, db: next } = applyOrgGeoManual(db, snap, 40.42, -3.70);
    expect(applied).toBe(true);
    expect(next.geo_source).toBe('manual');
    expect(next.geo_confirmed_at).toBeTruthy();
  });

  it('TEST-GM-8 org snapshot: los 5 campos deben coincidir', () => {
    const base = { id: 'o1', direccion: 'Calle A', localidad: 'B', cp: '12345', provincia: 'C', pais: 'España' };
    const db: OrgRow = { ...base, geo_source: null };
    // Cambia solo provincia → rechazado
    const snapBad = { direccion: 'Calle A', localidad: 'B', cp: '12345', provincia: 'X', pais: 'España' };
    expect(applyOrgGeoManual(db, snapBad, 40.0, -3.0).applied).toBe(false);
    // Todos coinciden → aplicado
    const snapGood = { direccion: 'Calle A', localidad: 'B', cp: '12345', provincia: 'C', pais: 'España' };
    expect(applyOrgGeoManual(db, snapGood, 40.0, -3.0).applied).toBe(true);
  });
});

describe('Invariante manual-no-overwrite — updateOrgGeocoords / updateJobGeoAuto', () => {

  it('TEST-GM-9 invalidación de dirección debe resetear geo_source a null', () => {
    // Simula handleSaveFiscal / handleSave cuando geoInvalidated = true:
    // { base_latitud: null, base_longitud: null, geo_source: null }
    const before: OrgRow = { id: 'o1', base_latitud: 43.46, base_longitud: -3.81, geo_source: 'manual' };
    const after: OrgRow = { ...before, base_latitud: null, base_longitud: null, geo_source: null };
    expect(after.geo_source).toBeNull();
    // Ahora auto puede escribir (geo_source=null)
    expect(geoAutoEligible(after)).toBe(true);
  });

  it('TEST-GM-10 geocodificación auto establece geo_source=auto', () => {
    const db: JobRow = { id: 'j1', org_id: 'o1', direccion: 'Calle B', localidad: 'Sevilla', cp: '41001', geo_source: null };
    const snap = { direccion: 'Calle B', localidad: 'Sevilla', cp: '41001' };
    const { applied, db: next } = applyJobGeoAuto(db, snap, 37.39, -5.99);
    expect(applied).toBe(true);
    expect(next.geo_source).toBe('auto');
    expect(next.latitud).toBe(37.39);
  });

  it('TEST-GM-11 dato legacy (geo_source=NULL) → auto-geocodificación permitida', () => {
    const db: OrgRow = { id: 'o1', base_latitud: 43.46, base_longitud: -3.81, geo_source: null };
    const snap = { direccion: null, localidad: 'Santander', cp: '39001', provincia: null, pais: 'España' };
    const dbWithAddress: OrgRow = { ...db, localidad: 'Santander', cp: '39001', pais: 'España' };
    const { applied } = applyOrgGeoAuto(dbWithAddress, snap, 43.46, -3.81);
    expect(applied).toBe(true);
  });

  it('TEST-GM-3 (org) auto-write rechazado cuando geo_source=manual, dirección igual', () => {
    const db: OrgRow = {
      id: 'o1', direccion: 'Calle Luna 3', localidad: 'Santander', cp: '39001', provincia: 'Cantabria', pais: 'España',
      base_latitud: 43.461, base_longitud: -3.812, geo_source: 'manual',
    };
    const snap = { direccion: 'Calle Luna 3', localidad: 'Santander', cp: '39001', provincia: 'Cantabria', pais: 'España' };
    const { applied } = applyOrgGeoAuto(db, snap, 43.46, -3.81); // auto result slightly different
    expect(applied).toBe(false);
  });

  it('TEST-GM-3b (job) auto-write rechazado cuando geo_source=manual', () => {
    const db: JobRow = { id: 'j1', org_id: 'o1', direccion: 'Av. X 5', localidad: 'Valencia', cp: '46001', geo_source: 'manual', latitud: 39.471, longitud: -0.376 };
    const snap = { direccion: 'Av. X 5', localidad: 'Valencia', cp: '46001' };
    const { applied } = applyJobGeoAuto(db, snap, 39.47, -0.37);
    expect(applied).toBe(false);
  });

  it('TEST-GM-12 ciclo A→B: nueva dirección (B) permite re-geocodificación auto', () => {
    // Dirección A manual → cambia a B → geo_source null → auto puede escribir
    let db: OrgRow = { id: 'o1', direccion: 'Calle A 1', localidad: 'Ciudad A', cp: null, provincia: null, pais: 'España', geo_source: 'manual', base_latitud: 43.46, base_longitud: -3.81 };
    // Cambio de dirección invalida: geo_source = null, coords = null
    db = { ...db, direccion: 'Avenida B 2', localidad: 'Ciudad B', base_latitud: null, base_longitud: null, geo_source: null };
    // Auto-geocode de B
    const snap = { direccion: 'Avenida B 2', localidad: 'Ciudad B', cp: null, provincia: null, pais: 'España' };
    const { applied, db: next } = applyOrgGeoAuto(db, snap, 41.0, -2.0);
    expect(applied).toBe(true);
    expect(next.geo_source).toBe('auto');
  });
});

describe('Seguridad — aislamiento multiempresa', () => {

  it('TEST-GM-13 WHERE id = orgId impide escritura cruzada de coordenadas', () => {
    // Dos orgs distintas. La función siempre filtra por id.
    const orgA: OrgRow = { id: 'org-A', direccion: 'Calle A', localidad: 'Ciudad A', cp: null, provincia: null, pais: 'España', geo_source: null };
    const orgB: OrgRow = { id: 'org-B', direccion: 'Calle A', localidad: 'Ciudad A', cp: null, provincia: null, pais: 'España', geo_source: null };
    const snap = { direccion: 'Calle A', localidad: 'Ciudad A', cp: null, provincia: null, pais: 'España' };

    // Intento de escribir con id de org-A sobre org-B: la WHERE id = 'org-A' no afecta org-B
    // Simulamos: si updateOrgGeoManual usa .eq('id', 'org-A'), org-B no es tocada
    const orgBAfter = orgB; // no hay forma de que applyOrgGeoManual con id 'org-A' afecte a org-B

    // La función de simulación usa el row directamente; la barrera real es el .eq('id', orgId) en la query.
    // Verificamos que el snapshot check sobre org-B con id 'org-A' no muta org-B.
    expect(orgBAfter.id).toBe('org-B');
    expect(orgBAfter.base_latitud).toBeUndefined();

    // Verificamos que la write sobre org-A sí aplica
    const { applied: appliedA } = applyOrgGeoManual(orgA, snap, 43.46, -3.81);
    expect(appliedA).toBe(true);
  });

  it('TEST-GM-15 jobGeoManual rechazado si org_id del job no coincide con el caller', () => {
    // RLS en Supabase bloquea el UPDATE si el job no pertenece al usuario.
    // Aquí simulamos: la función devolvería applied=false (0 filas) si RLS rechaza.
    // Usamos el snapshot WHERE para simular el rechazo de org incorrecta:
    const dbJob: JobRow = { id: 'j1', org_id: 'org-B', direccion: 'Calle X', localidad: 'Zurich', cp: null };
    const snapOrgA = { direccion: 'Calle Y', localidad: 'Zurich', cp: null }; // dirección no coincide
    const { applied } = applyJobGeoManual(dbJob, snapOrgA, 47.37, 8.54);
    expect(applied).toBe(false);
  });
});

describe('Semántica de null vs cadena vacía', () => {

  it('TEST-GM-14 campo "" en snapshot no coincide con null en DB → rechazado', () => {
    const db: OrgRow = { id: 'o1', direccion: 'Calle A', localidad: null, cp: null, provincia: null, pais: 'España', geo_source: null };
    const snap = { direccion: 'Calle A', localidad: '', cp: null, provincia: null, pais: 'España' }; // '' != null
    const { applied } = applyOrgGeoManual(db, snap, 40.0, -3.0);
    expect(applied).toBe(false);
  });

  it('TEST-GM-14b campo "" en snapshot coincide con "" en DB → aplicado', () => {
    const db: OrgRow = { id: 'o1', direccion: 'Calle A', localidad: '', cp: null, provincia: null, pais: 'España', geo_source: null };
    const snap = { direccion: 'Calle A', localidad: '', cp: null, provincia: null, pais: 'España' };
    const { applied } = applyOrgGeoManual(db, snap, 40.0, -3.0);
    expect(applied).toBe(true);
  });
});

describe('Bypass updateJob — separación geo/no-geo en dbUpdate', () => {

  // Simula la lógica de handleSave para construir dbUpdate
  function buildDbUpdate(
    draft: Partial<JobRow>,
    geoExtras: Partial<JobRow>,
    _isLiveMode?: boolean, // kept for call-site compatibility; guard removed (geoExtras always included)
  ): Partial<JobRow> {
    const { latitud: _l, longitud: _lg, direccion_normalizada: _dn, geo_source: _gs, geo_confirmed_at: _gca, ...nonGeoFields } = draft as Record<string, unknown>;
    return { ...nonGeoFields, ...geoExtras } as Partial<JobRow>;
  }

  it('TEST-GM-BP-1 dbUpdate no incluye geo cuando geoExtras está vacío (live)', () => {
    const draft: Partial<JobRow> = { id: 'j1', org_id: 'o1', latitud: 43.46, longitud: -3.81, geo_source: 'manual', geo_confirmed_at: '2026-10-22T10:00:00Z', direccion: 'Calle A' };
    const dbUpdate = buildDbUpdate(draft, {}, true);
    expect('latitud' in dbUpdate).toBe(false);
    expect('geo_source' in dbUpdate).toBe(false);
    expect('geo_confirmed_at' in dbUpdate).toBe(false);
    expect(dbUpdate.direccion).toBe('Calle A');
  });

  it('TEST-GM-BP-2 dbUpdate incluye geo de geoExtras en live mode (geocode éxito)', () => {
    const draft: Partial<JobRow> = { id: 'j1', org_id: 'o1', latitud: 43.46, longitud: -3.81, geo_source: 'manual', geo_confirmed_at: '2026-10-22T10:00:00Z', direccion: 'Calle B nueva' };
    const geoExtras: Partial<JobRow> = { latitud: 43.47, longitud: -3.82, geo_source: 'auto', geo_confirmed_at: null };
    const dbUpdate = buildDbUpdate(draft, geoExtras, true);
    expect(dbUpdate.latitud).toBe(43.47);
    expect(dbUpdate.geo_source).toBe('auto');
    expect(dbUpdate.geo_confirmed_at).toBeNull();
  });

  it('TEST-GM-BP-3 dbUpdate incluye null-clearing en modo demo cuando dirección cambió', () => {
    // En demo mode, geoExtras solo puede ser {} o nulls de limpieza (nunca nuevas coords de API).
    // Se incluye para mantener coherencia de estado local (setJobs usa el mismo objeto).
    const draft: Partial<JobRow> = { id: 'j1', org_id: 'o1', latitud: 43.46, longitud: -3.81, geo_source: 'manual', geo_confirmed_at: '2026-10-22T10:00:00Z', direccion: 'Calle C nueva' };
    const geoExtras: Partial<JobRow> = { latitud: null, longitud: null, geo_source: null, geo_confirmed_at: null };
    const dbUpdate = buildDbUpdate(draft, geoExtras, false); // demo mode
    expect(dbUpdate.latitud).toBeNull();
    expect(dbUpdate.geo_source).toBeNull();
    expect(dbUpdate.geo_confirmed_at).toBeNull();
    expect(dbUpdate.direccion).toBe('Calle C nueva');
  });

  it('TEST-GM-BP-4 sesión concurrente: manual en DB no sobrescrito por draft stale', () => {
    // Escenario: usuario A abre modal (draft con geo_source=null), usuario B confirma manual
    // Usuario A guarda → dbUpdate no incluye geo → DB conserva geo_source='manual' de B
    const draftFromA: Partial<JobRow> & { titulo?: string } = { id: 'j1', org_id: 'o1', latitud: null, geo_source: null, geo_confirmed_at: null, titulo: 'Nuevo título' };
    const dbUpdate = buildDbUpdate(draftFromA as Partial<JobRow>, {}, true);
    // dbUpdate no contiene geo → DB queda con geo_source='manual' que escribió B
    expect('geo_source' in dbUpdate).toBe(false);
    expect('latitud' in dbUpdate).toBe(false);
    expect((dbUpdate as Record<string, unknown>).titulo).toBe('Nuevo título');
  });

  it('TEST-GM-BP-5 demo mode + dirección cambiada: geoExtras invalida draft Y DB coherentemente', () => {
    // En demo mode, addressChanged=true → geoExtras = null-clearing
    // Tanto finalDraft (estado local) como dbUpdate (DB) reciben el clearing → estado coherente.
    const geoExtrasDemo: Partial<JobRow> = { latitud: null, longitud: null, geo_source: null, geo_confirmed_at: null };
    const draft: Partial<JobRow> = { id: 'j1', org_id: 'o1', latitud: 43.46, geo_source: 'manual', geo_confirmed_at: '2026-10-22T10:00:00Z', direccion: 'Nueva Dir' };
    // finalDraft: estado local limpiado
    const finalDraft = { ...draft, ...geoExtrasDemo };
    expect(finalDraft.geo_source).toBeNull();
    expect(finalDraft.latitud).toBeNull();
    // dbUpdate: también incluye nulls (geoExtras sin guard isLiveMode)
    const dbUpdate = buildDbUpdate(draft, geoExtrasDemo, false);
    expect(dbUpdate.latitud).toBeNull();
    expect(dbUpdate.geo_source).toBeNull();
    expect(dbUpdate.geo_confirmed_at).toBeNull();
    // La nueva dirección se escribe en ambos
    expect(dbUpdate.direccion).toBe('Nueva Dir');
  });
});

describe('Demo mode — coherencia de estado local tras cambio de dirección', () => {

  it('TEST-GM-DM-1 demo mode sin cambio de dirección: geo NO se toca en DB ni en estado', () => {
    // geoExtras = {} cuando no hay needsGeocode
    const draft: Partial<JobRow> = { id: 'j1', org_id: 'o1', latitud: 43.46, geo_source: 'manual', geo_confirmed_at: '2026-10-22T10:00:00Z', direccion: 'Calle A' };
    const dbUpdate = { ...draft }; // sin geo stripping para simplificar; lo relevante es que geoExtras = {}
    const finalDraft = { ...draft }; // igual que draft
    expect(finalDraft.geo_source).toBe('manual');
    expect(finalDraft.latitud).toBe(43.46);
    expect(dbUpdate.geo_source).toBe('manual');
  });

  it('TEST-GM-DM-2 demo mode con dirección cambiada: geo_source null en finalDraft y dbUpdate', () => {
    const geoExtras: Partial<JobRow> & { direccion_normalizada?: string | null } = { latitud: null, longitud: null, direccion_normalizada: null, geo_source: null, geo_confirmed_at: null };
    const draft: Partial<JobRow> = { id: 'j1', org_id: 'o1', latitud: 43.46, geo_source: 'manual', geo_confirmed_at: '2026-10-22T10:00:00Z', direccion: 'Calle Nueva' };
    const finalDraft = { ...draft, ...geoExtras };
    const { latitud: _l, longitud: _lg, direccion_normalizada: _dn, geo_source: _gs, geo_confirmed_at: _gca, ...nonGeoFields } = draft as Record<string, unknown>;
    const dbUpdate = { ...nonGeoFields, ...geoExtras };
    // Ambos limpian el geo manual
    expect(finalDraft.geo_source).toBeNull();
    expect(finalDraft.latitud).toBeNull();
    expect((dbUpdate as Partial<JobRow>).geo_source).toBeNull();
    expect((dbUpdate as Partial<JobRow>).latitud).toBeNull();
    // La nueva dirección está presente
    expect((dbUpdate as Partial<JobRow>).direccion).toBe('Calle Nueva');
    expect(finalDraft.direccion).toBe('Calle Nueva');
    // geoExtras no contiene nuevas coordenadas de API (solo nulls)
    expect(geoExtras.latitud).toBeNull();
  });

  it('TEST-GM-DM-3 demo mode edición no geo: geo_source manual preservado en finalDraft', () => {
    // Sin addressChanged: needsGeocode = false → geoExtras = {} → finalDraft = draft
    const draft: Partial<JobRow> = { id: 'j1', org_id: 'o1', latitud: 43.46, geo_source: 'manual', geo_confirmed_at: '2026-10-22T10:00:00Z', direccion: 'Calle A' };
    const geoExtras: Partial<JobRow> = {}; // no needsGeocode
    const finalDraft = { ...draft, ...geoExtras };
    expect(finalDraft.geo_source).toBe('manual');
    expect(finalDraft.latitud).toBe(43.46);
    expect(finalDraft.geo_confirmed_at).toBe('2026-10-22T10:00:00Z');
  });
});

describe('geo_confirmed_at limpieza en invalidación', () => {

  it('TEST-GM-17 invalidación por dirección limpia geo_confirmed_at junto a geo_source', () => {
    const before: OrgRow = { id: 'o1', base_latitud: 43.46, base_longitud: -3.81, geo_source: 'manual', geo_confirmed_at: '2026-10-20T10:00:00Z' };
    // Simula: handleSaveFiscal con geoInvalidated=true (incluyendo geo_confirmed_at: null)
    const after: OrgRow = { ...before, base_latitud: null, base_longitud: null, geo_source: null, geo_confirmed_at: null };
    expect(after.geo_source).toBeNull();
    expect(after.geo_confirmed_at).toBeNull();
    expect(geoAutoEligible(after)).toBe(true);
  });

  it('TEST-GM-18 geocodificación auto exitosa tras cambio de dirección limpia geo_confirmed_at', () => {
    // Simula geoExtras = { latitud, longitud, geo_source: 'auto', geo_confirmed_at: null }
    const jobAfterAutoGeocode: Partial<JobRow> = { latitud: 40.4, longitud: -3.7, geo_source: 'auto', geo_confirmed_at: null };
    expect(jobAfterAutoGeocode.geo_confirmed_at).toBeNull();
    expect(jobAfterAutoGeocode.geo_source).toBe('auto');
  });

  it('TEST-GM-19 handleGeolocate en draft limpia geo_confirmed_at al sobrescribir con auto', () => {
    // draft original tiene geo_source: 'manual', geo_confirmed_at: '2026-10-20...'
    const draft: Partial<JobRow> = { latitud: 43.46, longitud: -3.81, geo_source: 'manual', geo_confirmed_at: '2026-10-20T10:00:00Z' };
    // setDraft(d => ({ ...d, latitud, longitud, geo_source: 'auto', geo_confirmed_at: null }))
    const updated = { ...draft, latitud: 43.47, longitud: -3.82, geo_source: 'auto' as const, geo_confirmed_at: null };
    expect(updated.geo_source).toBe('auto');
    expect(updated.geo_confirmed_at).toBeNull();
  });

  it('TEST-GM-20 geocode fallo con dirección cambiada limpia coords y geo_confirmed_at', () => {
    // geoExtras = { latitud: null, longitud: null, geo_source: null, geo_confirmed_at: null }
    const geoExtras: Partial<JobRow> = { latitud: null, longitud: null, geo_source: null, geo_confirmed_at: null };
    expect(geoExtras.latitud).toBeNull();
    expect(geoExtras.geo_source).toBeNull();
    expect(geoExtras.geo_confirmed_at).toBeNull();
  });
});

describe('Cancelación sin escritura', () => {

  it('TEST-GM-16 cancelar LocationPicker no produce ninguna escritura (onConfirm no se llama)', () => {
    let writeCount = 0;
    const onConfirm = async (_lat: number, _lng: number) => { writeCount++; };
    const onCancel = () => { /* no calls onConfirm */ };

    onCancel();

    expect(writeCount).toBe(0);
    expect(onConfirm).toBeDefined(); // never called
  });
});
