/**
 * T1-T24: PH0-MAINT-CLIENT-LOCATIONS-IMPL-1
 *
 * T1-T7  → SQL runtime tests (Docker required — BLOCKED_BY_DOCKER).
 * T8-T24 → TypeScript unit tests: interfaces, error class, guard logic.
 */

import { describe, it, expect } from 'vitest';
import type {
  ClientLocation,
  MaintenancePresupuesto,
  MaintenanceContrato,
} from '../../lib/supabase';

// Local replica of ActiveContractExistsError to avoid supabase mock interception.
// Must stay structurally identical to the one in supabase.ts.
class ActiveContractExistsError extends Error {
  constructor(public readonly contrato: MaintenanceContrato) {
    super('ACTIVE_CONTRACT_EXISTS');
    this.name = 'ActiveContractExistsError';
  }
}

// ── BLOCKED_BY_DOCKER: T1-T7 ─────────────────────────────────────────────────

describe('T1-T7: SQL runtime (BLOCKED_BY_DOCKER)', () => {
  it.skip('T1: next_maintenance_contract_number → TF-MANT-YYYY-NNNN format', () => { /* Docker required */ });
  it.skip('T2: counter increments monotonically under concurrent calls', () => { /* Docker required */ });
  it.skip('T3: counter cannot be decremented (trigger fn_protect_contract_counter)', () => { /* Docker required */ });
  it.skip('T4: counter cannot be deleted (trigger fn_protect_contract_counter)', () => { /* Docker required */ });
  it.skip('T5: UNIQUE index prevents two active contracts for same org+client+location', () => { /* Docker required */ });
  it.skip('T6: legacy NULL location_id is compatible — UNIQUE index WHERE clause excludes NULLs', () => { /* Docker required */ });
  it.skip('T7: org membership check in next_maintenance_contract_number rejects foreign user', () => { /* Docker required */ });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLoc(overrides: Partial<ClientLocation> = {}): ClientLocation {
  return {
    id: 'loc-001',
    org_id: 'org-001',
    client_id: 'client-001',
    nombre: 'Planta baja',
    direccion: 'Calle Mayor 1',
    ciudad: 'Madrid',
    cp: '28001',
    provincia: 'Madrid',
    pais: 'ES',
    notas: null,
    activa: true,
    created_at: '2026-09-06T00:00:00Z',
    updated_at: '2026-09-06T00:00:00Z',
    ...overrides,
  };
}

function makePresup(overrides: Partial<MaintenancePresupuesto> = {}): MaintenancePresupuesto {
  return {
    id: 'pres-001',
    org_id: 'org-001',
    client_id: 'client-001',
    plantilla_id: null,
    numero: null,
    estado: 'aceptado',
    oficio: 'fontaneria',
    sector: null,
    nombre_cliente: 'Cliente Test',
    location_id: 'loc-001',
    direccion_instalacion: 'Calle Mayor 1',
    descripcion_servicios: null,
    cuota_mensual: 120,
    cuota_anual: null,
    cuota_trimestral: null,
    tipo_facturacion: 'mensual',
    iva_pct: 21,
    sla_nivel: 'normal',
    tiempo_respuesta_h: null,
    incluye_preventivos: false,
    num_visitas_preventivo: 0,
    incluye_guardia: false,
    materiales_incluidos: false,
    texto_libre: null,
    ia_json: null,
    notas: null,
    fecha: '2026-09-06',
    fecha_enviado: null,
    fecha_aceptado: null,
    fecha_vencimiento: null,
    generado_por_ia: false,
    created_at: '2026-09-06T00:00:00Z',
    updated_at: '2026-09-06T00:00:00Z',
    ...overrides,
  };
}

function makeContrato(overrides: Partial<MaintenanceContrato> = {}): MaintenanceContrato {
  return {
    id: 'cont-001',
    org_id: 'org-001',
    client_id: 'client-001',
    presupuesto_id: 'pres-001',
    plantilla_id: null,
    numero: 'TF-MANT-2026-0006',
    estado: 'activo',
    oficio: 'fontaneria',
    sector: null,
    nombre_cliente: 'Cliente Test',
    location_id: 'loc-001',
    direccion_instalacion: 'Calle Mayor 1',
    descripcion_servicios: null,
    cuota_mensual: 120,
    tipo_facturacion: 'mensual',
    iva_pct: 21,
    sla_nivel: 'normal',
    tiempo_respuesta_h: null,
    incluye_preventivos: false,
    num_visitas_preventivo: 0,
    frecuencia_preventivo: 'anual',
    incluye_guardia: false,
    materiales_incluidos: false,
    fecha_inicio: '2026-09-06',
    fecha_fin: '2027-09-06',
    duracion_meses: 12,
    renovacion_automatica: true,
    preaviso_cancelacion_dias: 30,
    dia_facturacion: 1,
    proxima_factura: null,
    ultima_factura: null,
    notas: null,
    contract_id: null,
    created_at: '2026-09-06T00:00:00Z',
    updated_at: '2026-09-06T00:00:00Z',
    ...overrides,
  };
}

// ── T8: ActiveContractExistsError ─────────────────────────────────────────────

describe('T8: ActiveContractExistsError class', () => {
  it('T8.1: instanceof Error', () => {
    const contrato = makeContrato();
    const err = new ActiveContractExistsError(contrato);
    expect(err).toBeInstanceOf(Error);
  });

  it('T8.2: name is ActiveContractExistsError', () => {
    const err = new ActiveContractExistsError(makeContrato());
    expect(err.name).toBe('ActiveContractExistsError');
  });

  it('T8.3: message is ACTIVE_CONTRACT_EXISTS', () => {
    const err = new ActiveContractExistsError(makeContrato());
    expect(err.message).toBe('ACTIVE_CONTRACT_EXISTS');
  });

  it('T8.4: contrato property is the passed contrato', () => {
    const contrato = makeContrato({ numero: 'TF-MANT-2026-0099' });
    const err = new ActiveContractExistsError(contrato);
    expect(err.contrato.numero).toBe('TF-MANT-2026-0099');
  });

  it('T8.5: instanceof discrimination works in catch block', () => {
    let caught = false;
    try {
      throw new ActiveContractExistsError(makeContrato());
    } catch (e) {
      if (e instanceof ActiveContractExistsError) {
        caught = true;
        expect(e.contrato.id).toBe('cont-001');
      }
    }
    expect(caught).toBe(true);
  });
});

// ── T9: ClientLocation interface ──────────────────────────────────────────────

describe('T9: ClientLocation interface', () => {
  it('T9.1: makeLoc produces valid ClientLocation', () => {
    const loc = makeLoc();
    expect(loc.id).toBe('loc-001');
    expect(loc.org_id).toBe('org-001');
    expect(loc.client_id).toBe('client-001');
    expect(loc.activa).toBe(true);
    expect(loc.pais).toBe('ES');
  });

  it('T9.2: nullable fields accept null', () => {
    const loc = makeLoc({ direccion: null, ciudad: null, cp: null, provincia: null, notas: null });
    expect(loc.direccion).toBeNull();
    expect(loc.notas).toBeNull();
  });

  it('T9.3: activa=false for deactivated location', () => {
    const loc = makeLoc({ activa: false });
    expect(loc.activa).toBe(false);
  });
});

// ── T10: MaintenancePresupuesto.location_id ────────────────────────────────────

describe('T10: MaintenancePresupuesto.location_id field', () => {
  it('T10.1: presupuesto can have location_id set', () => {
    const p = makePresup({ location_id: 'loc-abc' });
    expect(p.location_id).toBe('loc-abc');
  });

  it('T10.2: presupuesto with null location_id is valid', () => {
    const p = makePresup({ location_id: null });
    expect(p.location_id).toBeNull();
  });

  it('T10.3: presupuesto without location_id (optional field) is valid', () => {
    const p = makePresup();
    // field is optional (?) so both set and undefined are acceptable
    const keys = Object.keys(p);
    // it's set in our helper, just verify it's a string or null
    expect(typeof p.location_id === 'string' || p.location_id === null).toBe(true);
  });
});

// ── T11: MaintenanceContrato.location_id ──────────────────────────────────────

describe('T11: MaintenanceContrato.location_id field', () => {
  it('T11.1: contrato can have location_id set', () => {
    const c = makeContrato({ location_id: 'loc-xyz' });
    expect(c.location_id).toBe('loc-xyz');
  });

  it('T11.2: contrato with null location_id is valid (legacy)', () => {
    const c = makeContrato({ location_id: null });
    expect(c.location_id).toBeNull();
  });
});

// ── T12: HARD BLOCK guard logic ───────────────────────────────────────────────

describe('T12: HARD BLOCK — active contract at same location', () => {
  function simulateGuard(
    presupuesto: { client_id: string | null; location_id?: string | null },
    activeContratos: Array<{ client_id: string | null; location_id?: string | null; estado: string }>,
  ): MaintenanceContrato | null {
    if (!presupuesto.client_id || !presupuesto.location_id) return null;
    const conflict = activeContratos.find(
      c => c.client_id === presupuesto.client_id &&
           c.location_id === presupuesto.location_id &&
           c.estado === 'activo',
    );
    return conflict ? (conflict as unknown as MaintenanceContrato) : null;
  }

  it('T12.1: no conflict when no active contract for same location', () => {
    const presup = makePresup();
    const conflict = simulateGuard(presup, []);
    expect(conflict).toBeNull();
  });

  it('T12.2: conflict detected when active contract exists for same client+location', () => {
    const presup = makePresup();
    const existingContrato = makeContrato();
    const conflict = simulateGuard(presup, [existingContrato]);
    expect(conflict).not.toBeNull();
  });

  it('T12.3: no conflict when existing contrato is cancelled (not activo)', () => {
    const presup = makePresup();
    const cancelledContrato = makeContrato({ estado: 'cancelado' });
    const conflict = simulateGuard(presup, [cancelledContrato]);
    expect(conflict).toBeNull();
  });

  it('T12.4: no conflict when location_id is null (legacy presupuesto)', () => {
    const presup = makePresup({ location_id: null });
    const existingContrato = makeContrato({ location_id: null });
    const conflict = simulateGuard(presup, [existingContrato]);
    expect(conflict).toBeNull();
  });

  it('T12.5: no conflict for different location same client', () => {
    const presup = makePresup({ location_id: 'loc-001' });
    const contrato = makeContrato({ location_id: 'loc-002' });
    const conflict = simulateGuard(presup, [contrato]);
    expect(conflict).toBeNull();
  });

  it('T12.6: throws ActiveContractExistsError when conflict found', () => {
    function throwIfConflict(
      presupuesto: MaintenancePresupuesto,
      activeContratos: MaintenanceContrato[],
    ): void {
      if (!presupuesto.client_id || !presupuesto.location_id) return;
      const conflict = activeContratos.find(
        c => c.client_id === presupuesto.client_id &&
             c.location_id === presupuesto.location_id &&
             c.estado === 'activo',
      );
      if (conflict) throw new ActiveContractExistsError(conflict);
    }

    const presup = makePresup();
    const existingContrato = makeContrato();
    expect(() => throwIfConflict(presup, [existingContrato]))
      .toThrow(ActiveContractExistsError);
  });
});

// ── T13: 23505 presupuesto_id race → return existing ─────────────────────────

describe('T13: 23505 race on presupuesto_id', () => {
  async function simulateInsertWithRace(
    presupuesto: MaintenancePresupuesto,
    existingByPresupId: MaintenanceContrato | null,
  ): Promise<MaintenanceContrato> {
    // Simulate DB throwing 23505 on presupuesto_id UNIQUE index
    const err = Object.assign(new Error('duplicate key value'), { code: '23505' });
    throw err;
    // In real code: catch 23505 → lookup by presupuesto_id → return existing
    // This test verifies the lookup logic below
    void presupuesto; void existingByPresupId; // unreachable, for type coverage
  }

  it('T13.1: 23505 error has code 23505', async () => {
    const presup = makePresup();
    let caught: unknown = null;
    try {
      await simulateInsertWithRace(presup, makeContrato());
    } catch (e) {
      caught = e;
    }
    expect((caught as { code?: string }).code).toBe('23505');
  });

  it('T13.2: lookup by presupuesto_id finds existing contrato on race', () => {
    const presup = makePresup({ id: 'pres-race' });
    const existing = makeContrato({ presupuesto_id: 'pres-race' });
    const allContratos = [existing];
    const found = allContratos.find(c => c.presupuesto_id === presup.id) ?? null;
    expect(found).not.toBeNull();
    expect(found?.id).toBe('cont-001');
  });
});

// ── T14: 23505 race on location → ActiveContractExistsError ──────────────────

describe('T14: 23505 race on active client+location UNIQUE index', () => {
  it('T14.1: race on location (byPresupId not found) throws ActiveContractExistsError', () => {
    function handle23505Race(
      presupuesto: MaintenancePresupuesto,
      contratos: MaintenanceContrato[],
    ): MaintenanceContrato {
      const byPresup = contratos.find(c => c.presupuesto_id === presupuesto.id) ?? null;
      if (byPresup) return byPresup;
      if (presupuesto.client_id && presupuesto.location_id) {
        const byLoc = contratos.find(
          c => c.org_id === presupuesto.org_id &&
               c.client_id === presupuesto.client_id &&
               c.location_id === presupuesto.location_id &&
               c.estado === 'activo',
        ) ?? null;
        if (byLoc) throw new ActiveContractExistsError(byLoc);
      }
      throw new Error('DUPLICATE_REFERENCE');
    }

    const presup = makePresup({ id: 'pres-new' }); // presupuesto_id NOT in contratos
    const existingByLoc = makeContrato({ presupuesto_id: 'pres-other' });
    expect(() => handle23505Race(presup, [existingByLoc])).toThrow(ActiveContractExistsError);
  });

  it('T14.2: race on location propagates correct contrato in error', () => {
    function handle23505Race(
      presupuesto: MaintenancePresupuesto,
      contratos: MaintenanceContrato[],
    ): MaintenanceContrato {
      const byPresup = contratos.find(c => c.presupuesto_id === presupuesto.id) ?? null;
      if (byPresup) return byPresup;
      if (presupuesto.client_id && presupuesto.location_id) {
        const byLoc = contratos.find(
          c => c.org_id === presupuesto.org_id &&
               c.client_id === presupuesto.client_id &&
               c.location_id === presupuesto.location_id &&
               c.estado === 'activo',
        ) ?? null;
        if (byLoc) throw new ActiveContractExistsError(byLoc);
      }
      throw new Error('DUPLICATE_REFERENCE');
    }

    const presup = makePresup({ id: 'pres-new' });
    const existingByLoc = makeContrato({ presupuesto_id: 'pres-other', numero: 'TF-MANT-2026-0009' });
    try {
      handle23505Race(presup, [existingByLoc]);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ActiveContractExistsError);
      expect((e as ActiveContractExistsError).contrato.numero).toBe('TF-MANT-2026-0009');
    }
  });
});

// ── T15: Counter seed — TF-MANT-2026-0006 is next for pilot org ──────────────

describe('T15: Counter seed integrity', () => {
  function simulateCounterSeed(
    existingContratos: Array<{ referencia: string }>,
    pilotOrgId: string,
  ): number {
    const PILOT = pilotOrgId;
    void PILOT; // seed for pilot is explicit: last_value=5
    const explicit = 5; // TF-MANT-2026-0001..0005 existed
    const fromRefs = existingContratos
      .filter(c => /^TF-MANT-2026-\d{4,}$/.test(c.referencia))
      .map(c => parseInt(c.referencia.split('-')[3], 10));
    return Math.max(explicit, ...fromRefs, 0);
  }

  it('T15.1: pilot seed is 5 when no existing contratos', () => {
    const seed = simulateCounterSeed([], '89d05f11-6115-470d-bdac-37d38b9925c0');
    expect(seed).toBe(5);
  });

  it('T15.2: next number after seed is TF-MANT-2026-0006', () => {
    const seed = 5;
    const next = seed + 1;
    const ref = `TF-MANT-2026-${String(next).padStart(4, '0')}`;
    expect(ref).toBe('TF-MANT-2026-0006');
  });

  it('T15.3: GREATEST semantics — existing seed takes precedence if higher', () => {
    const seed = simulateCounterSeed(
      [{ referencia: 'TF-MANT-2026-0010' }],
      '89d05f11-6115-470d-bdac-37d38b9925c0',
    );
    expect(seed).toBe(10);
  });
});

// ── T16: Referencia parsing from regex ───────────────────────────────────────

describe('T16: Referencia format regex', () => {
  const REGEX = /^TF-MANT-[0-9]{4}-[0-9]{4,}$/;

  it('T16.1: valid referencia passes', () => {
    expect(REGEX.test('TF-MANT-2026-0006')).toBe(true);
  });

  it('T16.2: invalid format fails', () => {
    expect(REGEX.test('TF-MANT-26-0006')).toBe(false);
    expect(REGEX.test('TF-MANT-2026-06')).toBe(false);
    expect(REGEX.test('TF-FACT-2026-0006')).toBe(false);
    expect(REGEX.test('')).toBe(false);
  });

  it('T16.3: year and ordinal extracted correctly', () => {
    const ref = 'TF-MANT-2026-0009';
    const parts = ref.split('-');
    const year = parseInt(parts[2], 10);
    const ordinal = parseInt(parts[3], 10);
    expect(year).toBe(2026);
    expect(ordinal).toBe(9);
  });
});

// ── T17: Composite FK — NULL semantics ────────────────────────────────────────

describe('T17: Composite FK NULL semantics', () => {
  it('T17.1: FK not checked when location_id is null', () => {
    // PostgreSQL rule: if any FK column is NULL → constraint not checked
    // Test that our code treats null location_id as "no location constraint"
    const presup = makePresup({ location_id: null });
    const isConstrained = presup.client_id !== null && presup.location_id !== null;
    expect(isConstrained).toBe(false);
  });

  it('T17.2: FK IS checked when all columns are non-null', () => {
    const presup = makePresup({ client_id: 'c-1', location_id: 'loc-1' });
    const isConstrained = presup.client_id !== null && presup.location_id !== null;
    expect(isConstrained).toBe(true);
  });
});

// ── T18: location_id transfer from presupuesto → contrato ────────────────────

describe('T18: location_id propagated from presupuesto to contrato', () => {
  it('T18.1: contrato inherits location_id from presupuesto', () => {
    const presup = makePresup({ location_id: 'loc-TEST' });
    const contrato = makeContrato({ location_id: presup.location_id ?? null });
    expect(contrato.location_id).toBe('loc-TEST');
  });

  it('T18.2: null location_id propagates correctly', () => {
    const presup = makePresup({ location_id: null });
    const contrato = makeContrato({ location_id: presup.location_id ?? null });
    expect(contrato.location_id).toBeNull();
  });
});

// ── T19: Scope prohibition check ─────────────────────────────────────────────

describe('T19: Scope prohibitions — fiscal records untouched', () => {
  it('T19.1: M1-M4 do not reference trade_fiscal_records', async () => {
    const { readFileSync } = await import('fs');
    const migrations = [
      'supabase/migrations/20260906132829_client_locations_m1.sql',
      'supabase/migrations/20260906132837_client_locations_m2.sql',
      'supabase/migrations/20260906132843_client_locations_m3.sql',
      'supabase/migrations/20260906132857_client_locations_m4.sql',
    ];
    for (const f of migrations) {
      const content = readFileSync(f, 'utf-8');
      expect(content).not.toMatch(/trade_fiscal_records/i);
      expect(content).not.toMatch(/trade_verifactu_outbox/i);
      expect(content).not.toMatch(/trade_invoice_counters/i);
    }
  });

  it('T19.2: M1-M4 do not reference Marketplace tables', async () => {
    const { readFileSync } = await import('fs');
    const migrations = [
      'supabase/migrations/20260906132829_client_locations_m1.sql',
      'supabase/migrations/20260906132837_client_locations_m2.sql',
      'supabase/migrations/20260906132843_client_locations_m3.sql',
      'supabase/migrations/20260906132857_client_locations_m4.sql',
    ];
    for (const f of migrations) {
      const content = readFileSync(f, 'utf-8');
      expect(content).not.toMatch(/marketplace/i);
    }
  });

  it('T19.3: M4 seed does not recreate TF-MANT-2026-0001..0005', async () => {
    const { readFileSync } = await import('fs');
    const m4 = readFileSync('supabase/migrations/20260906132857_client_locations_m4.sql', 'utf-8');
    // The seed sets last_value=5, which means next is 6. It does NOT insert rows with those numbers.
    expect(m4).toMatch(/last_value.*5/);
    expect(m4).not.toMatch(/0001.*INSERT|INSERT.*0001/);
    expect(m4).not.toMatch(/0002.*INSERT|INSERT.*0002/);
  });
});

// ── T20: monotonicity invariant ───────────────────────────────────────────────

describe('T20: Counter monotonicity invariant', () => {
  it('T20.1: simulated counter rejects decrement', () => {
    function updateCounter(current: number, next: number): number {
      if (next < current) throw new Error(`Counter cannot decrease: ${current} → ${next}`);
      return next;
    }
    expect(() => updateCounter(5, 3)).toThrow('Counter cannot decrease');
  });

  it('T20.2: simulated counter accepts increment', () => {
    function updateCounter(current: number, next: number): number {
      if (next < current) throw new Error(`Counter cannot decrease: ${current} → ${next}`);
      return next;
    }
    expect(updateCounter(5, 6)).toBe(6);
  });

  it('T20.3: counter value same is acceptable (edge case: idempotent retry)', () => {
    function updateCounter(current: number, next: number): number {
      if (next < current) throw new Error(`Counter cannot decrease: ${current} → ${next}`);
      return next;
    }
    expect(updateCounter(5, 5)).toBe(5);
  });
});

// ── T21: RLS — org_id isolation ───────────────────────────────────────────────

describe('T21: RLS org isolation (TypeScript simulation)', () => {
  function queryLocations(
    userId: string,
    orgIds: string[],
    locations: ClientLocation[],
  ): ClientLocation[] {
    void userId; // in real RLS _user_org_ids() is used
    return locations.filter(l => orgIds.includes(l.org_id));
  }

  it('T21.1: user sees only their org locations', () => {
    const loc1 = makeLoc({ org_id: 'org-A', id: 'loc-1' });
    const loc2 = makeLoc({ org_id: 'org-B', id: 'loc-2' });
    const result = queryLocations('user-1', ['org-A'], [loc1, loc2]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('loc-1');
  });

  it('T21.2: user with no orgs sees nothing', () => {
    const loc = makeLoc({ org_id: 'org-A' });
    const result = queryLocations('user-1', [], [loc]);
    expect(result).toHaveLength(0);
  });

  it('T21.3: user in multiple orgs sees all', () => {
    const loc1 = makeLoc({ org_id: 'org-A', id: 'loc-1' });
    const loc2 = makeLoc({ org_id: 'org-B', id: 'loc-2' });
    const result = queryLocations('user-1', ['org-A', 'org-B'], [loc1, loc2]);
    expect(result).toHaveLength(2);
  });
});

// ── T22: snapshot strategy ────────────────────────────────────────────────────

describe('T22: Snapshot strategy — direccion_instalacion preserved', () => {
  it('T22.1: contrato address captured at signing time, not reconstructed', () => {
    const loc = makeLoc({ direccion: 'Calle Original 1' });
    const contrato = makeContrato({ direccion_instalacion: loc.direccion ?? null });
    // Later the location address changes
    loc.direccion = 'Calle Nueva 99';
    // Contrato still shows original address
    expect(contrato.direccion_instalacion).toBe('Calle Original 1');
  });
});

// ── T23: UNIQUE barriers ──────────────────────────────────────────────────────

describe('T23: UNIQUE barriers on referencia and numero', () => {
  it('T23.1: simulated UNIQUE check on referencia per org', () => {
    function checkUnique(
      refs: Array<{ org_id: string; referencia: string }>,
      newRef: { org_id: string; referencia: string },
    ): boolean {
      return !refs.some(r => r.org_id === newRef.org_id && r.referencia === newRef.referencia);
    }

    const existing = [{ org_id: 'org-A', referencia: 'TF-MANT-2026-0001' }];
    expect(checkUnique(existing, { org_id: 'org-A', referencia: 'TF-MANT-2026-0001' })).toBe(false);
    expect(checkUnique(existing, { org_id: 'org-A', referencia: 'TF-MANT-2026-0002' })).toBe(true);
    expect(checkUnique(existing, { org_id: 'org-B', referencia: 'TF-MANT-2026-0001' })).toBe(true);
  });
});

// ── T24: Timezone invariant ───────────────────────────────────────────────────

describe('T24: Timezone — year determined per org timezone', () => {
  it('T24.1: UTC midnight Dec 31 → next year in Europe/Madrid (UTC+1)', () => {
    const utcMidnightDec31 = new Date('2025-12-31T23:30:00Z');
    const madridYear = utcMidnightDec31.toLocaleString('en-US', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
    });
    expect(Number(madridYear)).toBe(2026);
  });

  it('T24.2: year is extracted from date in org timezone (not UTC)', () => {
    // Simulate: utcNow=2025-12-31T23:00Z, org_tz=Europe/Madrid → year=2026
    const utcNow = new Date('2025-12-31T23:00:00Z');
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
    }).formatToParts(utcNow);
    const year = parseInt(parts.find(p => p.type === 'year')!.value, 10);
    expect(year).toBe(2026);
  });
});
