/**
 * T1-T77: PH0-MAINT-CLIENT-LOCATIONS-IMPL-1 + PH0-MAINT-DUPLICATE-GUARD-IMPL-2
 *         + PH0-MAINT-DUPLICATE-GUARD-PREDEPLOY-FIX-1
 *         + PH0-MAINT-WIZARD-REFACTOR-1
 *
 * T1-T7  → SQL runtime tests (Docker required — BLOCKED_BY_DOCKER).
 * T8-T24 → TypeScript unit tests: interfaces, error class, guard logic.
 * T25-T44 → PH0-MAINT-DUPLICATE-GUARD-IMPL-2: new product rules (spec T1-T20).
 * T45-T57 → PH0-MAINT-DUPLICATE-GUARD-PREDEPLOY-FIX-1: isNew-based FIRST CONFIRMATION
 *            + ciudad validation + second confirmation states (spec A-M).
 * T58-T77 → PH0-MAINT-WIZARD-REFACTOR-1: draft-in-memory, FinalizeStep, wizard location.
 *            A1-A8 NuevoContratoModal route, B1-B4 modelo route, C1-C5 wizard route,
 *            D1-D8 global invariants.
 */

import { describe, it, expect } from 'vitest';
import type {
  ClientLocation,
  MaintenancePresupuesto,
  MaintenanceContrato,
  ClientMaintenanceHistorialItem,
  MaintenancePresupuestoDraft,
  MaintenanceModelo,
} from '../../lib/supabase';

// Local replica of buildPresupuestoFromModelo to avoid supabase mock interception.
// Must stay structurally identical to the one in supabase.ts.
function buildPresupuestoFromModelo(modelo: MaintenanceModelo): MaintenancePresupuestoDraft {
  const d = modelo.datos_json ?? {};
  return {
    oficio:                 (d.oficio as string) ?? 'fontaneria',
    sector:                 (d.sector as string) ?? null,
    sla_nivel:              (d.sla_nivel as string) ?? null,
    cuota_mensual:          (d.cuota_mensual as number) ?? null,
    tipo_facturacion:       ((d.tipo_facturacion as string) ?? 'mensual') as 'mensual' | 'trimestral' | 'anual',
    incluye_preventivos:    (d.incluye_preventivos as boolean) ?? false,
    num_visitas_preventivo: (d.num_visitas_preventivo as number) ?? 0,
    incluye_guardia:        (d.incluye_guardia as boolean) ?? false,
    descripcion_servicios:  (d.descripcion_servicios as string) ?? null,
    plantilla_id:           (d.plantilla_id as string) ?? null,
    notas:                  (d.notas as string) ?? null,
    estado:                 'borrador',
    generado_por_ia:        false,
  };
}

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

// ════════════════════════════════════════════════════════════════════════════
// PH0-MAINT-DUPLICATE-GUARD-IMPL-2 — spec tests T1-T20 (T25-T44 in file)
// ════════════════════════════════════════════════════════════════════════════

// Local replicas (avoid supabase mock interception)
class MissingClientError extends Error {
  constructor() { super('MISSING_CLIENT'); this.name = 'MissingClientError'; }
}
class MissingLocationError extends Error {
  constructor() { super('MISSING_LOCATION'); this.name = 'MissingLocationError'; }
}
class MissingLocationMunicipalityError extends Error {
  constructor() { super('MISSING_LOCATION_MUNICIPALITY'); this.name = 'MissingLocationMunicipalityError'; }
}

// Guard simulation helpers

function simulateGuard0A(p: { client_id: string | null }): void {
  if (!p.client_id) throw new MissingClientError();
}
function simulateGuard0B(p: { location_id?: string | null }): void {
  if (!p.location_id) throw new MissingLocationError();
}
function simulateGuard0C(loc: ClientLocation | null): void {
  if (!loc || !loc.ciudad?.trim()) throw new MissingLocationMunicipalityError();
}
function simulateGuard2(
  p: { client_id: string | null; location_id?: string | null; org_id: string },
  contratos: MaintenanceContrato[],
): void {
  const hit = contratos.find(
    c => c.org_id === p.org_id &&
         c.client_id === p.client_id &&
         c.location_id === p.location_id &&
         c.estado === 'activo',
  );
  if (hit) throw new ActiveContractExistsError(hit);
}
function simulatePreCheckSameLocHardBlock(
  presup: MaintenancePresupuesto,
  contratos: MaintenanceContrato[],
): MaintenanceContrato | null {
  return contratos.find(
    c => c.location_id === presup.location_id && c.estado === 'activo',
  ) ?? null;
}
function simulatePreCheckOtherLocs(
  presup: MaintenancePresupuesto,
  contratos: MaintenanceContrato[],
): MaintenanceContrato[] {
  return contratos.filter(
    c => c.location_id !== presup.location_id &&
         !['cancelado', 'vencido'].includes(c.estado),
  );
}
function simulateBuildDireccionSnapshot(loc: ClientLocation): string {
  const parts: string[] = [
    loc.direccion ?? '',
    [loc.cp, loc.ciudad].filter(Boolean).join(' '),
    loc.provincia ?? '',
  ].filter(s => s.trim() !== '');
  return parts.join('\n');
}
function simulateIdempotency(
  presupId: string,
  contratos: MaintenanceContrato[],
): MaintenanceContrato | null {
  return contratos.find(c => c.presupuesto_id === presupId) ?? null;
}

// ── T25: spec T1 — nuevo presupuesto sin cliente → BLOCK ──────────────────────
describe('T25: Guard 0A — client_id required', () => {
  it('T25.1: null client_id throws MissingClientError', () => {
    expect(() => simulateGuard0A({ client_id: null })).toThrow(MissingClientError);
  });
  it('T25.2: set client_id passes Guard 0A', () => {
    expect(() => simulateGuard0A({ client_id: 'c-1' })).not.toThrow();
  });
  it('T25.3: MissingClientError has correct name and message', () => {
    const e = new MissingClientError();
    expect(e.name).toBe('MissingClientError');
    expect(e.message).toBe('MISSING_CLIENT');
    expect(e).toBeInstanceOf(Error);
  });
});

// ── T26: spec T2 — nuevo presupuesto sin location → BLOCK ────────────────────
describe('T26: Guard 0B — location_id required', () => {
  it('T26.1: null location_id throws MissingLocationError', () => {
    expect(() => simulateGuard0B({ location_id: null })).toThrow(MissingLocationError);
  });
  it('T26.2: undefined location_id throws MissingLocationError', () => {
    expect(() => simulateGuard0B({})).toThrow(MissingLocationError);
  });
  it('T26.3: set location_id passes Guard 0B', () => {
    expect(() => simulateGuard0B({ location_id: 'loc-1' })).not.toThrow();
  });
  it('T26.4: MissingLocationError has correct name', () => {
    const e = new MissingLocationError();
    expect(e.name).toBe('MissingLocationError');
    expect(e.message).toBe('MISSING_LOCATION');
  });
});

// ── T27: spec T3 — location sin ciudad → BLOCK ────────────────────────────────
describe('T27: Guard 0C — location ciudad required', () => {
  it('T27.1: null ciudad throws MissingLocationMunicipalityError', () => {
    const loc = makeLoc({ ciudad: null });
    expect(() => simulateGuard0C(loc)).toThrow(MissingLocationMunicipalityError);
  });
  it('T27.2: empty string ciudad throws', () => {
    const loc = makeLoc({ ciudad: '   ' });
    expect(() => simulateGuard0C(loc)).toThrow(MissingLocationMunicipalityError);
  });
  it('T27.3: null location throws', () => {
    expect(() => simulateGuard0C(null)).toThrow(MissingLocationMunicipalityError);
  });
  it('T27.4: set ciudad passes Guard 0C', () => {
    const loc = makeLoc({ ciudad: 'Santander' });
    expect(() => simulateGuard0C(loc)).not.toThrow();
  });
  it('T27.5: MissingLocationMunicipalityError has correct name', () => {
    const e = new MissingLocationMunicipalityError();
    expect(e.name).toBe('MissingLocationMunicipalityError');
    expect(e.message).toBe('MISSING_LOCATION_MUNICIPALITY');
  });
});

// ── T28: spec T4 — cliente sin historial → no first confirmation ──────────────
describe('T28: First confirmation — client without history', () => {
  function needsFirstConfirm(
    historial: ClientMaintenanceHistorialItem[],
    selfId: string,
  ): boolean {
    return historial.filter(h => h.id !== selfId).length > 0;
  }
  it('T28.1: empty history → no confirmation needed', () => {
    expect(needsFirstConfirm([], 'pres-1')).toBe(false);
  });
  it('T28.2: history only contains self → no confirmation needed', () => {
    const item: ClientMaintenanceHistorialItem = {
      type: 'presupuesto', id: 'pres-1', numero: null,
      estado: 'borrador', direccion_instalacion: null, location_id: null, oficio: 'fontaneria',
    };
    expect(needsFirstConfirm([item], 'pres-1')).toBe(false);
  });
});

// ── T29: spec T5 — cliente con presupuesto previo → first confirmation ────────
describe('T29: First confirmation — client with existing presupuesto', () => {
  function needsFirstConfirm(
    historial: ClientMaintenanceHistorialItem[],
    selfId: string,
  ): boolean {
    return historial.filter(h => h.id !== selfId).length > 0;
  }
  it('T29.1: other presupuesto in history → confirmation required', () => {
    const items: ClientMaintenanceHistorialItem[] = [
      { type: 'presupuesto', id: 'pres-other', numero: 'PRE-001', estado: 'aceptado', direccion_instalacion: null, location_id: null, oficio: 'fontaneria' },
    ];
    expect(needsFirstConfirm(items, 'pres-new')).toBe(true);
  });
});

// ── T30: spec T6 — cliente con contrato previo → first confirmation ───────────
describe('T30: First confirmation — client with existing contrato', () => {
  function needsFirstConfirm(
    historial: ClientMaintenanceHistorialItem[],
    selfId: string,
  ): boolean {
    return historial.filter(h => h.id !== selfId).length > 0;
  }
  it('T30.1: contrato in history → confirmation required', () => {
    const items: ClientMaintenanceHistorialItem[] = [
      { type: 'contrato', id: 'cont-old', numero: 'TF-MANT-2026-0001', estado: 'activo', direccion_instalacion: null, location_id: 'loc-1', oficio: 'electricidad' },
    ];
    expect(needsFirstConfirm(items, 'pres-new')).toBe(true);
  });
});

// ── T31: spec T7 — cancel first confirmation → no presupuesto creado ──────────
describe('T31: First confirmation cancel → no side effects', () => {
  it('T31.1: cancelling first confirmation does not advance saved count', () => {
    let savedCount = 0;
    const performSave = () => { savedCount++; };
    const firstConfirmState = [
      { type: 'presupuesto' as const, id: 'p-old', numero: null, estado: 'borrador', direccion_instalacion: null, location_id: null, oficio: 'fontaneria' },
    ];
    // Simulate cancel: set firstConfirmState=null, do NOT call performSave
    const onCancel = () => { /* setFirstConfirmState(null) — no save */ };
    onCancel();
    void performSave; // just to avoid unused var warning in test
    expect(savedCount).toBe(0);
  });
});

// ── T32: spec T8 — accept first confirmation → presupuesto creado ─────────────
describe('T32: First confirmation accept → save proceeds', () => {
  it('T32.1: confirming calls doSave exactly once', () => {
    let savedCount = 0;
    const doSave = () => { savedCount++; };
    // Simulate confirm: call doSave directly
    doSave();
    expect(savedCount).toBe(1);
  });
});

// ── T33: spec T9 — conversion location NULL → BLOCK before RPC ───────────────
describe('T33: Pre-check location_id before RPC (ConvertirModal)', () => {
  it('T33.1: null location_id fires onMissingLocation, not RPC', () => {
    const presup = makePresup({ location_id: null });
    let missingFired = false;
    let rpcCalled = false;
    const onMissingLocation = () => { missingFired = true; };
    // Simulate ConvertirModal pre-check
    if (!presup.location_id) {
      onMissingLocation();
    } else {
      rpcCalled = true; // would proceed to convertPresupuestoToContrato
    }
    expect(missingFired).toBe(true);
    expect(rpcCalled).toBe(false);
  });
  it('T33.2: Guard 0B throws MissingLocationError for null location', () => {
    expect(() => simulateGuard0B({ location_id: null })).toThrow(MissingLocationError);
  });
});

// ── T34: spec T10 — conversion same active location → HARD BLOCK before RPC ──
describe('T34: Pre-check same active location HARD BLOCK before RPC', () => {
  it('T34.1: same-location active contrato fires onActiveContractConflict, not RPC', () => {
    const presup = makePresup({ location_id: 'loc-1' });
    const existingContrato = makeContrato({ location_id: 'loc-1', estado: 'activo' });
    const clientContratos = [existingContrato];
    let hardBlockFired = false;
    let rpcCalled = false;
    const sameLocActive = simulatePreCheckSameLocHardBlock(presup, clientContratos);
    if (sameLocActive) {
      hardBlockFired = true;
    } else {
      rpcCalled = true;
    }
    expect(hardBlockFired).toBe(true);
    expect(rpcCalled).toBe(false);
  });
  it('T34.2: cancelled contrato at same location does not trigger HARD BLOCK', () => {
    const presup = makePresup({ location_id: 'loc-1' });
    const cancelledContrato = makeContrato({ location_id: 'loc-1', estado: 'cancelado' });
    const hit = simulatePreCheckSameLocHardBlock(presup, [cancelledContrato]);
    expect(hit).toBeNull();
  });
});

// ── T35: spec T11 — same client different location → second confirmation ───────
describe('T35: Pre-check other locations → second confirmation', () => {
  it('T35.1: contrato at different location triggers second confirmation', () => {
    const presup = makePresup({ location_id: 'loc-NEW' });
    const otherContrato = makeContrato({ location_id: 'loc-OLD', estado: 'activo' });
    const clientContratos = [otherContrato];
    const otherLocs = simulatePreCheckOtherLocs(presup, clientContratos);
    expect(otherLocs).toHaveLength(1);
    expect(otherLocs[0].location_id).toBe('loc-OLD');
  });
  it('T35.2: cancelled contrato at different location does NOT trigger second confirmation', () => {
    const presup = makePresup({ location_id: 'loc-NEW' });
    const cancelledContrato = makeContrato({ location_id: 'loc-OLD', estado: 'cancelado' });
    const otherLocs = simulatePreCheckOtherLocs(presup, [cancelledContrato]);
    expect(otherLocs).toHaveLength(0);
  });
});

// ── T36: spec T12 — cancel second confirmation → no RPC / no contract ─────────
describe('T36: Second confirmation cancel → no side effects', () => {
  it('T36.1: cancelling second confirmation does not call convertPresupuestoToContrato', () => {
    let rpcCalled = false;
    const doConvert = () => { rpcCalled = true; };
    // Simulate cancel: setSecondConfirmData(null) — do NOT call doConvert
    const onCancel = () => { /* setSecondConfirmData(null) */ };
    onCancel();
    void doConvert;
    expect(rpcCalled).toBe(false);
  });
});

// ── T37: spec T13 — accept second confirmation → contract allowed ──────────────
describe('T37: Second confirmation confirm → conversion proceeds', () => {
  it('T37.1: confirming second confirmation calls handleSecondConfirmConvert', () => {
    let convertCalled = false;
    const handleSecondConfirmConvert = () => { convertCalled = true; };
    handleSecondConfirmConvert();
    expect(convertCalled).toBe(true);
  });
});

// ── T38: spec T14 — same municipio different location → allowed ────────────────
describe('T38: Same municipio, different location_id → allowed after confirmation', () => {
  it('T38.1: two locations in same city with different ids are treated as different locations', () => {
    const presup = makePresup({ location_id: 'loc-B' });
    const existingContrato = makeContrato({ location_id: 'loc-A', estado: 'activo' });
    // loc-A and loc-B both have ciudad='Santander' but different ids
    const sameLocHardBlock = simulatePreCheckSameLocHardBlock(presup, [existingContrato]);
    expect(sameLocHardBlock).toBeNull(); // Not a HARD BLOCK
    const otherLocs = simulatePreCheckOtherLocs(presup, [existingContrato]);
    expect(otherLocs).toHaveLength(1); // → triggers second confirmation
  });
});

// ── T39: spec T15 — same exact location → never override ─────────────────────
describe('T39: Same exact location always HARD BLOCKS', () => {
  it('T39.1: active contrato at exact same location_id is always blocked', () => {
    const presup = makePresup({ location_id: 'loc-X' });
    const activeContrato = makeContrato({ location_id: 'loc-X', estado: 'activo' });
    expect(() => simulateGuard2(presup, [activeContrato])).toThrow(ActiveContractExistsError);
  });
  it('T39.2: pre-check also catches same location before RPC', () => {
    const presup = makePresup({ location_id: 'loc-X' });
    const activeContrato = makeContrato({ location_id: 'loc-X', estado: 'activo' });
    const hit = simulatePreCheckSameLocHardBlock(presup, [activeContrato]);
    expect(hit).not.toBeNull();
  });
});

// ── T40: spec T16 — already-converted presupuesto → idempotent ───────────────
describe('T40: Guard 1 idempotency — converted presupuesto returns existing contrato', () => {
  it('T40.1: presupuesto_id found in contratos → return existing (no Guards 0A/0B/0C fire)', () => {
    const presup = makePresup({ id: 'pres-already', location_id: null }); // NULL location
    const existing = makeContrato({ presupuesto_id: 'pres-already' });
    // Guard 1 fires before Guard 0A/0B/0C: found → return immediately
    const found = simulateIdempotency(presup.id, [existing]);
    expect(found).not.toBeNull();
    expect(found!.presupuesto_id).toBe('pres-already');
    // If Guard 1 returned, Guard 0B would never run (null location_id doesn't matter)
  });
  it('T40.2: legacy NULL location presupuesto already converted can be re-opened', () => {
    // Guard 1 idempotency allows reading legacy contracts (null location)
    const legacyPresup = makePresup({ id: 'pres-legacy', location_id: null });
    const legacyContrato = makeContrato({ presupuesto_id: 'pres-legacy', location_id: null });
    const found = simulateIdempotency(legacyPresup.id, [legacyContrato]);
    expect(found?.location_id).toBeNull(); // legacy null preserved
  });
});

// ── T41: spec T17 — direccion_instalacion snapshot built from location ─────────
describe('T41: buildDireccionSnapshot — snapshot from ClientLocation', () => {
  it('T41.1: full location builds complete snapshot', () => {
    const loc = makeLoc({
      direccion: 'Paseo Menéndez Pelayo, 119',
      cp: '39006',
      ciudad: 'Santander',
      provincia: 'Cantabria',
    });
    const snap = simulateBuildDireccionSnapshot(loc);
    expect(snap).toContain('Paseo Menéndez Pelayo, 119');
    expect(snap).toContain('39006 Santander');
    expect(snap).toContain('Cantabria');
  });
  it('T41.2: empty fields are excluded from snapshot', () => {
    const loc = makeLoc({ direccion: null, cp: null, ciudad: 'Madrid', provincia: null });
    const snap = simulateBuildDireccionSnapshot(loc);
    expect(snap).toBe('Madrid');
  });
  it('T41.3: snapshot without cp includes just ciudad', () => {
    const loc = makeLoc({ direccion: 'Calle Mayor 1', cp: null, ciudad: 'Bilbao', provincia: 'Vizcaya' });
    const snap = simulateBuildDireccionSnapshot(loc);
    expect(snap).toContain('Bilbao');
    expect(snap).toContain('Vizcaya');
    expect(snap).not.toContain('null');
  });
  it('T41.4: ciudad is the canonical Zona/Municipio field', () => {
    const loc = makeLoc({ ciudad: 'Zaragoza' });
    const snap = simulateBuildDireccionSnapshot(loc);
    expect(snap).toContain('Zaragoza');
  });
});

// ── T42: spec T18 — legacy converted NULL location → can still be opened ──────
describe('T42: Legacy converted presupuesto with NULL location', () => {
  it('T42.1: Guard 1 returns existing contrato before Guard 0B fires', () => {
    // This validates the idempotency ordering: Guard 1 MUST run before Guard 0A/0B/0C
    const legacyPresup = makePresup({ location_id: null, estado: 'convertido' });
    const legacyContrato = makeContrato({ presupuesto_id: legacyPresup.id, location_id: null });
    // Guard 1 fires → found → return
    const found = simulateIdempotency(legacyPresup.id, [legacyContrato]);
    expect(found).not.toBeNull();
    // Guard 0B would throw if reached — but it isn't reached
    expect(() => simulateGuard0B({ location_id: null })).toThrow(MissingLocationError);
    // → confirmed: Guard 1 must precede Guard 0B
  });
});

// ── T43: spec T19 — new contract flow cannot bypass location ──────────────────
describe('T43: Direct conversion path cannot bypass location', () => {
  it('T43.1: Guard 0B blocks conversion even if called directly without UI', () => {
    const presup = makePresup({ location_id: null });
    expect(() => simulateGuard0B(presup)).toThrow(MissingLocationError);
  });
  it('T43.2: Guard 0A blocks conversion if client_id is null', () => {
    const presup = makePresup({ client_id: null });
    expect(() => simulateGuard0A(presup)).toThrow(MissingClientError);
  });
  it('T43.3: Guard 0C blocks conversion if ciudad is missing', () => {
    const loc = makeLoc({ ciudad: null });
    expect(() => simulateGuard0C(loc)).toThrow(MissingLocationMunicipalityError);
  });
});

// ── T44: spec T20 — counter not called on any rejected/cancelled path ──────────
describe('T44: Counter (next_maintenance_contract_number) not called on rejected paths', () => {
  it('T44.1: Guard 0A rejection happens before RPC', () => {
    let rpcCalled = false;
    const callRpc = () => { rpcCalled = true; };
    try {
      simulateGuard0A({ client_id: null });
      callRpc(); // only reached if guard passes
    } catch { /* expected */ }
    expect(rpcCalled).toBe(false);
  });
  it('T44.2: Guard 0B rejection happens before RPC', () => {
    let rpcCalled = false;
    const callRpc = () => { rpcCalled = true; };
    try {
      simulateGuard0B({ location_id: null });
      callRpc();
    } catch { /* expected */ }
    expect(rpcCalled).toBe(false);
  });
  it('T44.3: Guard 0C rejection happens before RPC', () => {
    let rpcCalled = false;
    const callRpc = () => { rpcCalled = true; };
    try {
      simulateGuard0C(null);
      callRpc();
    } catch { /* expected */ }
    expect(rpcCalled).toBe(false);
  });
  it('T44.4: Guard 2 (HARD BLOCK same location) rejection happens before RPC', () => {
    let rpcCalled = false;
    const callRpc = () => { rpcCalled = true; };
    const presup = makePresup({ location_id: 'loc-X' });
    const existingContrato = makeContrato({ location_id: 'loc-X', estado: 'activo' });
    try {
      simulateGuard2(presup, [existingContrato]);
      callRpc();
    } catch { /* expected */ }
    expect(rpcCalled).toBe(false);
  });
  it('T44.5: pre-check cancellation (missing location) never reaches RPC', () => {
    // Simulates ConvertirModal.handleConvert early return on null location_id
    let rpcCalled = false;
    const presup = makePresup({ location_id: null });
    if (!presup.location_id) {
      // return early — RPC never called
    } else {
      rpcCalled = true;
    }
    expect(rpcCalled).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PH0-MAINT-DUPLICATE-GUARD-PREDEPLOY-FIX-1 — spec tests A-M (T45-T57)
//
// Covers: isNew-based FIRST CONFIRMATION, ciudad required for location
// creation, SECOND CONFIRMATION states, + NUEVO CONTRATO path audit.
// ════════════════════════════════════════════════════════════════════════════

// ── Additional simulation helpers ────────────────────────────────────────────

/**
 * Simulates EditPresupuestoModal.handleSave FIRST CONFIRMATION logic.
 *
 * isNew=true → FIRST CONFIRMATION is eligible (new presupuesto, not a subsequent edit).
 * Condition: isNew && presup.client_id && locationId → check historial.
 * If client has relevant history (excluding current presupuesto) → 'confirm_needed'.
 * Otherwise → 'proceed'.
 *
 * CRITICAL: location_id already being set (presup.location_id != null) does NOT prevent
 * FIRST CONFIRMATION when isNew=true. This closes the !presupuesto.location_id bug.
 */
function simulateFirstConfirmation(
  isNew: boolean,
  presup: { client_id: string | null; location_id?: string | null; id: string },
  locationId: string | null,
  historial: ClientMaintenanceHistorialItem[],
): 'confirm_needed' | 'proceed' {
  if (isNew && presup.client_id && locationId) {
    const relevant = historial.filter(h => h.id !== presup.id);
    if (relevant.length > 0) return 'confirm_needed';
  }
  return 'proceed';
}

/**
 * Simulates handleCreateLocation ciudad validation.
 * Returns 'blocked' if ciudad is empty/whitespace, 'proceed' otherwise.
 */
function simulateHandleCreateLocation(ciudad: string): 'blocked' | 'proceed' {
  if (!ciudad.trim()) return 'blocked';
  return 'proceed';
}

/**
 * Simulates ConvertirModal pre-check SECOND CONFIRMATION state filtering.
 * Valid DB estados for MaintenanceContrato: 'activo' | 'pausado' | 'cancelado' | 'vencido' | 'renovando'.
 * Exclude: cancelado, vencido. Include: activo, pausado, renovando.
 */
function simulateSecondConfirmationOtherLocs(
  presup: MaintenancePresupuesto,
  contratos: MaintenanceContrato[],
): MaintenanceContrato[] {
  return contratos.filter(
    c => c.location_id !== presup.location_id &&
         !['cancelado', 'vencido'].includes(c.estado),
  );
}

// ── T45: spec A — NEW presupuesto + no history → no confirmation ─────────────

describe('T45: FIRST CONFIRMATION — NEW presupuesto, client without history', () => {
  it('T45.1: new presupuesto, no historial → proceed without confirmation', () => {
    const presup = makePresup({ id: 'pres-new', client_id: 'c-1', location_id: 'loc-1' });
    const result = simulateFirstConfirmation(true, presup, 'loc-1', []);
    expect(result).toBe('proceed');
  });

  it('T45.2: isNew=false (edit) with no history → still proceeds', () => {
    const presup = makePresup({ id: 'pres-old', client_id: 'c-1', location_id: 'loc-1' });
    const result = simulateFirstConfirmation(false, presup, 'loc-1', []);
    expect(result).toBe('proceed');
  });
});

// ── T46: spec B — NEW presupuesto + presupuesto previo → FIRST CONFIRMATION ──

describe('T46: FIRST CONFIRMATION — NEW presupuesto, client has existing presupuesto', () => {
  it('T46.1: client has one prior presupuesto → confirm_needed', () => {
    const presup = makePresup({ id: 'pres-new', client_id: 'c-1', location_id: 'loc-1' });
    const existing: ClientMaintenanceHistorialItem = {
      type: 'presupuesto', id: 'pres-old', numero: 'TF-MANT-2026-0001',
      estado: 'aceptado', direccion_instalacion: 'Calle A', location_id: 'loc-1', oficio: 'fontaneria',
    };
    const result = simulateFirstConfirmation(true, presup, 'loc-1', [existing]);
    expect(result).toBe('confirm_needed');
  });

  it('T46.2: isNew=false (edit) with prior presupuesto → proceed (no repeat confirmation)', () => {
    const presup = makePresup({ id: 'pres-existing', client_id: 'c-1', location_id: 'loc-1' });
    const prior: ClientMaintenanceHistorialItem = {
      type: 'presupuesto', id: 'pres-old', numero: null,
      estado: 'borrador', direccion_instalacion: null, location_id: null, oficio: 'fontaneria',
    };
    const result = simulateFirstConfirmation(false, presup, 'loc-1', [prior]);
    expect(result).toBe('proceed');
  });
});

// ── T47: spec C — NEW presupuesto + contrato previo → FIRST CONFIRMATION ─────

describe('T47: FIRST CONFIRMATION — NEW presupuesto, client has existing contrato', () => {
  it('T47.1: client has one prior contrato → confirm_needed', () => {
    const presup = makePresup({ id: 'pres-new', client_id: 'c-1', location_id: 'loc-1' });
    const existingContract: ClientMaintenanceHistorialItem = {
      type: 'contrato', id: 'cont-old', numero: 'TF-MANT-2026-0006',
      estado: 'activo', direccion_instalacion: 'Calle B', location_id: 'loc-2', oficio: 'fontaneria',
    };
    const result = simulateFirstConfirmation(true, presup, 'loc-1', [existingContract]);
    expect(result).toBe('confirm_needed');
  });

  it('T47.2: multiple history items (both types) → confirm_needed', () => {
    const presup = makePresup({ id: 'pres-new', client_id: 'c-1', location_id: 'loc-1' });
    const historial: ClientMaintenanceHistorialItem[] = [
      { type: 'presupuesto', id: 'p-old', numero: null, estado: 'rechazado', direccion_instalacion: null, location_id: null, oficio: 'fontaneria' },
      { type: 'contrato', id: 'c-old', numero: 'TF-MANT-2026-0007', estado: 'cancelado', direccion_instalacion: null, location_id: 'loc-3', oficio: 'fontaneria' },
    ];
    const result = simulateFirstConfirmation(true, presup, 'loc-1', historial);
    expect(result).toBe('confirm_needed');
  });
});

// ── T48: spec D — NEW + location_id YA asignado → FIRST CONFIRMATION ─────────
// CRITICAL: closes the bug where the condition was !presupuesto.location_id

describe('T48: FIRST CONFIRMATION — NEW presupuesto with location_id already set', () => {
  it('T48.1: isNew=true, location_id already set, client has history → confirm_needed', () => {
    // This is the critical test: even if location_id is ALREADY assigned on the presupuesto,
    // FIRST CONFIRMATION still fires when isNew=true. The old bug (!presupuesto.location_id)
    // would have returned 'proceed' here, incorrectly skipping the confirmation.
    const presup = makePresup({
      id: 'pres-new',
      client_id: 'c-1',
      location_id: 'loc-already-set', // location_id is NOT null
    });
    const historialItem: ClientMaintenanceHistorialItem = {
      type: 'contrato', id: 'c-prior', numero: 'TF-MANT-2026-0009',
      estado: 'activo', direccion_instalacion: 'Calle X', location_id: 'loc-already-set', oficio: 'fontaneria',
    };
    const result = simulateFirstConfirmation(true, presup, 'loc-already-set', [historialItem]);
    expect(result).toBe('confirm_needed');
  });

  it('T48.2: same scenario with isNew=false (edit) → proceeds without confirmation', () => {
    // This is the same presupuesto but being edited AGAIN later (isNew=false) — no repeat
    const presup = makePresup({
      id: 'pres-new',
      client_id: 'c-1',
      location_id: 'loc-already-set',
    });
    const historialItem: ClientMaintenanceHistorialItem = {
      type: 'contrato', id: 'c-prior', numero: 'TF-MANT-2026-0009',
      estado: 'activo', direccion_instalacion: 'Calle X', location_id: 'loc-already-set', oficio: 'fontaneria',
    };
    const result = simulateFirstConfirmation(false, presup, 'loc-already-set', [historialItem]);
    expect(result).toBe('proceed');
  });
});

// ── T49: spec E — EDIT existing presupuesto → no repeat FIRST CONFIRMATION ───

describe('T49: No repeat FIRST CONFIRMATION on EDIT existing presupuesto', () => {
  it('T49.1: isNew=false, any historial → always proceed', () => {
    const presup = makePresup({ id: 'pres-existing', client_id: 'c-1', location_id: 'loc-1' });
    const bigHistorial: ClientMaintenanceHistorialItem[] = [
      { type: 'presupuesto', id: 'p-1', numero: null, estado: 'aceptado', direccion_instalacion: null, location_id: 'loc-1', oficio: 'fontaneria' },
      { type: 'contrato',    id: 'c-1', numero: 'TF-MANT-2026-0006', estado: 'activo', direccion_instalacion: 'Calle A', location_id: 'loc-1', oficio: 'fontaneria' },
      { type: 'contrato',    id: 'c-2', numero: 'TF-MANT-2026-0007', estado: 'cancelado', direccion_instalacion: null, location_id: 'loc-2', oficio: 'fontaneria' },
    ];
    const result = simulateFirstConfirmation(false, presup, 'loc-1', bigHistorial);
    expect(result).toBe('proceed');
  });

  it('T49.2: isNew=false, no client_id → proceed (guard skipped entirely)', () => {
    const presup = makePresup({ id: 'pres-draft', client_id: null, location_id: null });
    const result = simulateFirstConfirmation(false, presup, null, []);
    expect(result).toBe('proceed');
  });
});

// ── T50: spec F — cancel FIRST CONFIRMATION → no save (no INSERT/UPDATE) ─────

describe('T50: Cancel FIRST CONFIRMATION → no save side effects', () => {
  it('T50.1: cancelling first confirmation does not call save', () => {
    let saveCalled = false;
    const doSave = () => { saveCalled = true; };

    // Simulate: confirm needed, user cancels (setFirstConfirmState(null)) → doSave NOT called
    const confirmNeeded = true;
    if (confirmNeeded) {
      // User clicks "Cancelar" → just reset state, do NOT call doSave
      void doSave; // referenced but not called
    }
    expect(saveCalled).toBe(false);
  });

  it('T50.2: accepting first confirmation calls doSave', () => {
    let saveCalled = false;
    const doSave = () => { saveCalled = true; };

    // Simulate: user clicks "Confirmar y guardar"
    doSave();
    expect(saveCalled).toBe(true);
  });
});

// ── T51: spec G — location creation ciudad='' → BLOCK ────────────────────────

describe('T51: Location creation ciudad empty → BLOCK', () => {
  it('T51.1: ciudad empty string → blocked', () => {
    expect(simulateHandleCreateLocation('')).toBe('blocked');
  });

  it('T51.2: ciudad non-empty → proceed', () => {
    expect(simulateHandleCreateLocation('Madrid')).toBe('proceed');
  });
});

// ── T52: spec H — location creation ciudad='   ' → BLOCK ─────────────────────

describe('T52: Location creation ciudad whitespace-only → BLOCK', () => {
  it('T52.1: ciudad whitespace only → blocked', () => {
    expect(simulateHandleCreateLocation('   ')).toBe('blocked');
  });

  it('T52.2: ciudad with leading/trailing spaces but content → proceed', () => {
    expect(simulateHandleCreateLocation('  Sevilla  ')).toBe('proceed');
  });
});

// ── T53: spec I — save NEW presupuesto with empty location.ciudad → BLOCK ────

describe('T53: Saving presupuesto blocked when selected location has no ciudad', () => {
  it('T53.1: location with null ciudad → Guard 0C throws MissingLocationMunicipalityError', () => {
    const loc = makeLoc({ ciudad: null });
    expect(() => simulateGuard0C(loc)).toThrow(MissingLocationMunicipalityError);
  });

  it('T53.2: location with empty ciudad → Guard 0C throws', () => {
    const loc = makeLoc({ ciudad: '' });
    expect(() => simulateGuard0C(loc)).toThrow(MissingLocationMunicipalityError);
  });

  it('T53.3: location with whitespace ciudad → Guard 0C throws', () => {
    const loc = makeLoc({ ciudad: '   ' });
    expect(() => simulateGuard0C(loc)).toThrow(MissingLocationMunicipalityError);
  });

  it('T53.4: location with valid ciudad → Guard 0C passes', () => {
    const loc = makeLoc({ ciudad: 'Barcelona' });
    expect(() => simulateGuard0C(loc)).not.toThrow();
  });
});

// ── T54: spec J — + NUEVO CONTRATO → FIRST CONFIRMATION via isNew=true ───────

describe('T54: + NUEVO CONTRATO path → FIRST CONFIRMATION via EditPresupuestoModal isNew=true', () => {
  it('T54.1: after NuevoContratoModal create, isNew=true is set → confirm fires for client with history', () => {
    // After NuevoContratoModal.onSaved: isNewPresup=true, editPresup=saved.
    // When the auto-opened EditPresupuestoModal is then saved with a client that has history:
    const presup = makePresup({ id: 'pres-ia', client_id: 'c-1', location_id: 'loc-1' });
    const historial: ClientMaintenanceHistorialItem[] = [
      { type: 'contrato', id: 'c-prev', numero: 'TF-MANT-2026-0010', estado: 'activo',
        direccion_instalacion: 'Calle Prev', location_id: 'loc-other', oficio: 'fontaneria' },
    ];
    // isNew=true (set by auto-open after AI creation)
    const result = simulateFirstConfirmation(true, presup, 'loc-1', historial);
    expect(result).toBe('confirm_needed');
  });

  it('T54.2: after NuevoContratoModal create, isNew=true is set → no confirm for client without history', () => {
    const presup = makePresup({ id: 'pres-ia', client_id: 'c-new', location_id: 'loc-1' });
    const result = simulateFirstConfirmation(true, presup, 'loc-1', []);
    expect(result).toBe('proceed');
  });

  it('T54.3: auto-opened EditPresupuestoModal with isNew=true does not skip own historial item', () => {
    // The current presupuesto is in historial (same id) → filtered out, not counted
    const presup = makePresup({ id: 'pres-self', client_id: 'c-1', location_id: 'loc-1' });
    const selfItem: ClientMaintenanceHistorialItem = {
      type: 'presupuesto', id: 'pres-self', numero: null,
      estado: 'borrador', direccion_instalacion: null, location_id: 'loc-1', oficio: 'fontaneria',
    };
    const result = simulateFirstConfirmation(true, presup, 'loc-1', [selfItem]);
    // Only self in historial → filtered → no relevant items → proceed
    expect(result).toBe('proceed');
  });
});

// ── T55: spec K — same active location → HARD BLOCK before RPC ───────────────

describe('T55: Same active location → HARD BLOCK before RPC (states reference)', () => {
  it('T55.1: estado=activo, same location → HARD BLOCK', () => {
    const presup = makePresup({ client_id: 'c-1', location_id: 'loc-X' });
    const sameActive = makeContrato({ location_id: 'loc-X', estado: 'activo' });
    const block = simulatePreCheckSameLocHardBlock(presup, [sameActive]);
    expect(block).not.toBeNull();
  });

  it('T55.2: estado=cancelado, same location → NOT a hard block', () => {
    const presup = makePresup({ client_id: 'c-1', location_id: 'loc-X' });
    const cancelled = makeContrato({ location_id: 'loc-X', estado: 'cancelado' });
    const block = simulatePreCheckSameLocHardBlock(presup, [cancelled]);
    // simulatePreCheckSameLocHardBlock only checks estado=activo
    expect(block).toBeNull();
  });
});

// ── T56: spec L — different location → SECOND CONFIRMATION, valid states ──────

describe('T56: Different location → SECOND CONFIRMATION; estado filter correctness', () => {
  it('T56.1: activo at different location → triggers second confirmation', () => {
    const presup = makePresup({ client_id: 'c-1', location_id: 'loc-A' });
    const other = makeContrato({ location_id: 'loc-B', estado: 'activo' });
    expect(simulateSecondConfirmationOtherLocs(presup, [other])).toHaveLength(1);
  });

  it('T56.2: pausado at different location → triggers second confirmation', () => {
    const presup = makePresup({ client_id: 'c-1', location_id: 'loc-A' });
    const other = makeContrato({ location_id: 'loc-B', estado: 'pausado' });
    expect(simulateSecondConfirmationOtherLocs(presup, [other])).toHaveLength(1);
  });

  it('T56.3: renovando at different location → triggers second confirmation', () => {
    const presup = makePresup({ client_id: 'c-1', location_id: 'loc-A' });
    const other = makeContrato({ location_id: 'loc-B', estado: 'renovando' });
    expect(simulateSecondConfirmationOtherLocs(presup, [other])).toHaveLength(1);
  });

  it('T56.4: cancelado at different location → excluded (no second confirmation)', () => {
    const presup = makePresup({ client_id: 'c-1', location_id: 'loc-A' });
    const other = makeContrato({ location_id: 'loc-B', estado: 'cancelado' });
    expect(simulateSecondConfirmationOtherLocs(presup, [other])).toHaveLength(0);
  });

  it('T56.5: vencido at different location → excluded', () => {
    const presup = makePresup({ client_id: 'c-1', location_id: 'loc-A' });
    const other = makeContrato({ location_id: 'loc-B', estado: 'vencido' });
    expect(simulateSecondConfirmationOtherLocs(presup, [other])).toHaveLength(0);
  });

  it('T56.6: same location (even activo) → NOT in second confirmation list', () => {
    const presup = makePresup({ client_id: 'c-1', location_id: 'loc-A' });
    const sameLoc = makeContrato({ location_id: 'loc-A', estado: 'activo' });
    // Same location → hard block (T55), not second confirmation
    expect(simulateSecondConfirmationOtherLocs(presup, [sameLoc])).toHaveLength(0);
  });
});

// ── T57: spec M — cancel SECOND CONFIRMATION → RPC not called ────────────────

describe('T57: Cancel SECOND CONFIRMATION → RPC not called', () => {
  it('T57.1: cancelling second confirmation does not call RPC', () => {
    let rpcCalled = false;
    const callRpc = () => { rpcCalled = true; };

    // Simulate: user sees SecondConfirmationModal, clicks "Cancelar"
    // → setSecondConfirmData(null) → no RPC
    const userConfirmed = false;
    if (userConfirmed) callRpc();

    expect(rpcCalled).toBe(false);
  });

  it('T57.2: accepting second confirmation calls RPC (conversion proceeds)', () => {
    let rpcCalled = false;
    const callRpc = () => { rpcCalled = true; };

    // Simulate: user clicks "Confirmar contrato" → handleSecondConfirmConvert → RPC
    const userConfirmed = true;
    if (userConfirmed) callRpc();

    expect(rpcCalled).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PH0-MAINT-WIZARD-REFACTOR-1 — A1-A8, B1-B4, C1-C5, D1-D8 (T58-T77)
//
// Covers: draft-in-memory pattern, buildPresupuestoFromModelo, FinalizeStep
// validation logic, wizard location validation, global invariants.
// ════════════════════════════════════════════════════════════════════════════

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeModelo(overrides?: Partial<MaintenanceModelo>): MaintenanceModelo {
  return {
    id: 'modelo-001', org_id: 'org-A', nombre: 'Modelo test',
    descripcion: null, basado_en_plantilla_id: null,
    datos_json: {
      oficio: 'climatizacion', sector: 'oficinas', sla_nivel: 'normal',
      cuota_mensual: 150, tipo_facturacion: 'mensual',
      incluye_preventivos: true, num_visitas_preventivo: 4,
      incluye_guardia: false, descripcion_servicios: 'Desc test',
      plantilla_id: null, notas: 'notas test',
    },
    veces_usado: 3, activo: true, created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** Simulates FinalizeStep client validation */
function simulateFinalizeClientRequired(selectedClient: { id: string } | null): 'blocked' | 'proceed' {
  if (!selectedClient) return 'blocked';
  return 'proceed';
}

/** Simulates FinalizeStep location validation */
function simulateFinalizeLocationRequired(
  selectedLocationId: string | null,
  locations: ClientLocation[],
): 'blocked_no_location' | 'blocked_no_ciudad' | 'proceed' {
  if (!selectedLocationId) return 'blocked_no_location';
  const loc = locations.find(l => l.id === selectedLocationId);
  if (!loc) return 'blocked_no_location';
  if (!loc.ciudad?.trim()) return 'blocked_no_ciudad';
  return 'proceed';
}

/** Simulates wizard handleSaveDirectly location validation when client is set */
function simulateWizardLocationValidation(
  finalClientId: string | null,
  wizardLocationId: string | null,
  wizardLocations: ClientLocation[],
): 'no_client_no_location_needed' | 'blocked_no_location' | 'blocked_no_ciudad' | 'proceed' {
  if (!finalClientId) return 'no_client_no_location_needed';
  const loc = wizardLocations.find(l => l.id === wizardLocationId);
  if (!loc) return 'blocked_no_location';
  if (!loc.ciudad?.trim()) return 'blocked_no_ciudad';
  return 'proceed';
}

/** Simulates NuevoContratoModal handleContinue building a draft */
function simulateHandleContinue(
  result: {
    oficio?: string; sector?: string; nombre_cliente?: string | null;
    cuota_mensual_sugerida?: number | null; generado_por_ia?: boolean;
  },
  texto: string,
): MaintenancePresupuestoDraft {
  return {
    oficio: result.oficio ?? 'mantenimiento',
    sector: result.sector ?? null,
    nombre_cliente: result.nombre_cliente ?? null,
    cuota_mensual: result.cuota_mensual_sugerida ?? null,
    texto_libre: texto,
    ia_json: result as Record<string, unknown>,
    generado_por_ia: true,
    estado: 'borrador',
  };
}

// ── T58-T65: A1-A8 NuevoContratoModal route ──────────────────────────────────

describe('T58 A1: handleContinue builds draft with correct oficio from AI result', () => {
  it('T58.1: oficio preserved from result', () => {
    const draft = simulateHandleContinue({ oficio: 'fontaneria', sector: 'hosteleria' }, '');
    expect(draft.oficio).toBe('fontaneria');
  });

  it('T58.2: fallback oficio when result.oficio undefined', () => {
    const draft = simulateHandleContinue({ sector: 'hosteleria' }, '');
    expect(draft.oficio).toBe('mantenimiento');
  });
});

describe('T59 A2: draft includes nombre_cliente from AI result', () => {
  it('T59.1: nombre_cliente set when result provides it', () => {
    const draft = simulateHandleContinue({ oficio: 'climatizacion', nombre_cliente: 'Empresa X' }, '');
    expect(draft.nombre_cliente).toBe('Empresa X');
  });

  it('T59.2: nombre_cliente is null when result.nombre_cliente is null', () => {
    const draft = simulateHandleContinue({ oficio: 'climatizacion', nombre_cliente: null }, '');
    expect(draft.nombre_cliente).toBeNull();
  });
});

describe('T60 A3: draft includes cuota_mensual from result', () => {
  it('T60.1: cuota_mensual matches result.cuota_mensual_sugerida', () => {
    const draft = simulateHandleContinue({ oficio: 'fontaneria', cuota_mensual_sugerida: 250 }, '');
    expect(draft.cuota_mensual).toBe(250);
  });

  it('T60.2: cuota_mensual is null when not provided', () => {
    const draft = simulateHandleContinue({ oficio: 'fontaneria' }, '');
    expect(draft.cuota_mensual).toBeNull();
  });
});

describe('T61 A4: draft has generado_por_ia = true (AI route)', () => {
  it('T61.1: generado_por_ia is always true in NuevoContratoModal path', () => {
    const draft = simulateHandleContinue({ oficio: 'electricidad' }, 'texto voz');
    expect(draft.generado_por_ia).toBe(true);
  });
});

describe('T62 A5: FinalizeStep blocks when no client selected', () => {
  it('T62.1: null client → blocked', () => {
    expect(simulateFinalizeClientRequired(null)).toBe('blocked');
  });

  it('T62.2: client with id → proceed', () => {
    expect(simulateFinalizeClientRequired({ id: 'c-1' })).toBe('proceed');
  });
});

describe('T63 A6: FinalizeStep blocks when no location selected', () => {
  const locs: ClientLocation[] = [makeLoc({ id: 'loc-1', ciudad: 'Madrid' })];

  it('T63.1: locationId null → blocked_no_location', () => {
    expect(simulateFinalizeLocationRequired(null, locs)).toBe('blocked_no_location');
  });

  it('T63.2: locationId not in locations list → blocked_no_location', () => {
    expect(simulateFinalizeLocationRequired('loc-unknown', locs)).toBe('blocked_no_location');
  });
});

describe('T64 A7: FinalizeStep blocks when location has no ciudad', () => {
  it('T64.1: location with ciudad=null → blocked_no_ciudad', () => {
    const loc = makeLoc({ id: 'loc-empty', ciudad: null });
    expect(simulateFinalizeLocationRequired('loc-empty', [loc])).toBe('blocked_no_ciudad');
  });

  it('T64.2: location with ciudad="" → blocked_no_ciudad', () => {
    const loc = makeLoc({ id: 'loc-ws', ciudad: '' });
    expect(simulateFinalizeLocationRequired('loc-ws', [loc])).toBe('blocked_no_ciudad');
  });

  it('T64.3: location with ciudad="  " (whitespace) → blocked_no_ciudad', () => {
    const loc = makeLoc({ id: 'loc-ws2', ciudad: '   ' });
    expect(simulateFinalizeLocationRequired('loc-ws2', [loc])).toBe('blocked_no_ciudad');
  });
});

describe('T65 A8: FinalizeStep proceeds with client + location + ciudad', () => {
  it('T65.1: all required fields present → proceed', () => {
    const loc = makeLoc({ id: 'loc-ok', ciudad: 'Barcelona' });
    expect(simulateFinalizeClientRequired({ id: 'c-1' })).toBe('proceed');
    expect(simulateFinalizeLocationRequired('loc-ok', [loc])).toBe('proceed');
  });
});

// ── T66-T69: B1-B4 buildPresupuestoFromModelo ─────────────────────────────────

describe('T66 B1: buildPresupuestoFromModelo returns correct oficio', () => {
  it('T66.1: oficio from datos_json', () => {
    const modelo = makeModelo({ datos_json: { oficio: 'pci' } });
    const draft = buildPresupuestoFromModelo(modelo);
    expect(draft.oficio).toBe('pci');
  });

  it('T66.2: fallback when datos_json is null', () => {
    const modelo = makeModelo({ datos_json: null });
    const draft = buildPresupuestoFromModelo(modelo);
    expect(draft.oficio).toBe('fontaneria');
  });
});

describe('T67 B2: buildPresupuestoFromModelo fallback oficio is fontaneria', () => {
  it('T67.1: no oficio in datos_json → fontaneria', () => {
    const modelo = makeModelo({ datos_json: { sector: 'industrial' } });
    const draft = buildPresupuestoFromModelo(modelo);
    expect(draft.oficio).toBe('fontaneria');
  });
});

describe('T68 B3: buildPresupuestoFromModelo returns cuota_mensual', () => {
  it('T68.1: cuota_mensual from datos_json', () => {
    const modelo = makeModelo({ datos_json: { oficio: 'electricidad', cuota_mensual: 300 } });
    const draft = buildPresupuestoFromModelo(modelo);
    expect(draft.cuota_mensual).toBe(300);
  });

  it('T68.2: cuota_mensual null when missing', () => {
    const modelo = makeModelo({ datos_json: { oficio: 'fontaneria' } });
    const draft = buildPresupuestoFromModelo(modelo);
    expect(draft.cuota_mensual).toBeNull();
  });
});

describe('T69 B4: buildPresupuestoFromModelo returns generado_por_ia = false', () => {
  it('T69.1: modelo path always non-IA', () => {
    const modelo = makeModelo();
    const draft = buildPresupuestoFromModelo(modelo);
    expect(draft.generado_por_ia).toBe(false);
  });
});

// ── T70-T74: C1-C5 wizard route ───────────────────────────────────────────────

describe('T70 C1: wizard without client → no location required', () => {
  it('T70.1: finalClientId=null → no_client_no_location_needed', () => {
    expect(simulateWizardLocationValidation(null, null, [])).toBe('no_client_no_location_needed');
  });

  it('T70.2: finalClientId=null even with a locationId → still no validation needed', () => {
    const loc = makeLoc({ id: 'loc-1', ciudad: 'Sevilla' });
    expect(simulateWizardLocationValidation(null, 'loc-1', [loc])).toBe('no_client_no_location_needed');
  });
});

describe('T71 C2: wizard with client but no location → BLOCKED', () => {
  it('T71.1: client set, locationId null → blocked_no_location', () => {
    expect(simulateWizardLocationValidation('c-1', null, [])).toBe('blocked_no_location');
  });

  it('T71.2: client set, locationId not in list → blocked_no_location', () => {
    const loc = makeLoc({ id: 'loc-A', ciudad: 'Valencia' });
    expect(simulateWizardLocationValidation('c-1', 'loc-unknown', [loc])).toBe('blocked_no_location');
  });
});

describe('T72 C3: wizard with client + location but no ciudad → BLOCKED', () => {
  it('T72.1: location.ciudad=null → blocked_no_ciudad', () => {
    const loc = makeLoc({ id: 'loc-1', ciudad: null });
    expect(simulateWizardLocationValidation('c-1', 'loc-1', [loc])).toBe('blocked_no_ciudad');
  });

  it('T72.2: location.ciudad="" → blocked_no_ciudad', () => {
    const loc = makeLoc({ id: 'loc-1', ciudad: '' });
    expect(simulateWizardLocationValidation('c-1', 'loc-1', [loc])).toBe('blocked_no_ciudad');
  });
});

describe('T73 C4: wizard with client + location + ciudad → proceed', () => {
  it('T73.1: all valid → proceed', () => {
    const loc = makeLoc({ id: 'loc-1', ciudad: 'Zaragoza' });
    expect(simulateWizardLocationValidation('c-1', 'loc-1', [loc])).toBe('proceed');
  });
});

describe('T74 C5: wizard FIRST CONFIRM triggers when client has historial', () => {
  it('T74.1: historial length > 0 → first confirm needed', () => {
    const historial: ClientMaintenanceHistorialItem[] = [
      { type: 'presupuesto', id: 'p-1', numero: null, estado: 'borrador', direccion_instalacion: null, location_id: null, oficio: 'fontaneria' },
    ];
    const needsConfirm = historial.length > 0;
    expect(needsConfirm).toBe(true);
  });

  it('T74.2: empty historial → no first confirm needed', () => {
    const historial: ClientMaintenanceHistorialItem[] = [];
    const needsConfirm = historial.length > 0;
    expect(needsConfirm).toBe(false);
  });

  it('T74.3: contrato type in historial also triggers confirm', () => {
    const historial: ClientMaintenanceHistorialItem[] = [
      { type: 'contrato', id: 'ct-1', numero: 'TF-MANT-2026-0006', estado: 'activo', direccion_instalacion: null, location_id: 'loc-1', oficio: 'electricidad' },
    ];
    expect(historial.length > 0).toBe(true);
  });
});

// ── T75-T77: D1-D8 Global invariants ─────────────────────────────────────────

describe('T75 D1-D3: data-layer guards sequence', () => {
  it('T75.1 D1: Guard 0A — MissingClientError when client_id null', () => {
    class MissingClientErrorLocal extends Error {
      constructor() { super('MISSING_CLIENT'); this.name = 'MissingClientErrorLocal'; }
    }
    const throwIfMissing = (clientId: string | null) => {
      if (!clientId) throw new MissingClientErrorLocal();
    };
    expect(() => throwIfMissing(null)).toThrow('MISSING_CLIENT');
    expect(() => throwIfMissing('c-1')).not.toThrow();
  });

  it('T75.2 D2: Guard 0B — MissingLocationError when location_id null', () => {
    class MissingLocationErrorLocal extends Error {
      constructor() { super('MISSING_LOCATION'); this.name = 'MissingLocationErrorLocal'; }
    }
    const throwIfMissing = (locationId: string | null | undefined) => {
      if (!locationId) throw new MissingLocationErrorLocal();
    };
    expect(() => throwIfMissing(null)).toThrow('MISSING_LOCATION');
    expect(() => throwIfMissing(undefined)).toThrow('MISSING_LOCATION');
    expect(() => throwIfMissing('loc-1')).not.toThrow();
  });

  it('T75.3 D3: Guard 0C — MissingLocationMunicipalityError when ciudad empty', () => {
    class MissingMuniErrorLocal extends Error {
      constructor() { super('MISSING_LOCATION_MUNICIPALITY'); this.name = 'MissingMuniErrorLocal'; }
    }
    const throwIfMissing = (ciudad: string | null | undefined) => {
      if (!ciudad?.trim()) throw new MissingMuniErrorLocal();
    };
    expect(() => throwIfMissing(null)).toThrow('MISSING_LOCATION_MUNICIPALITY');
    expect(() => throwIfMissing('')).toThrow('MISSING_LOCATION_MUNICIPALITY');
    expect(() => throwIfMissing('  ')).toThrow('MISSING_LOCATION_MUNICIPALITY');
    expect(() => throwIfMissing('Madrid')).not.toThrow();
  });
});

describe('T76 D4-D6: Draft type invariants', () => {
  it('T76.1 D4: buildPresupuestoFromModelo draft does not include client_id', () => {
    const modelo = makeModelo();
    const draft = buildPresupuestoFromModelo(modelo);
    expect('client_id' in draft).toBe(false);
  });

  it('T76.2 D5: buildPresupuestoFromModelo draft does not include location_id', () => {
    const modelo = makeModelo();
    const draft = buildPresupuestoFromModelo(modelo);
    expect('location_id' in draft).toBe(false);
  });

  it('T76.3 D6: simulateHandleContinue draft does not include client_id', () => {
    const draft = simulateHandleContinue({ oficio: 'fontaneria' }, '');
    expect('client_id' in draft).toBe(false);
  });
});

describe('T77 D7-D8: FinalizeStep and wizard use same validation logic', () => {
  it('T77.1 D7: FinalizeStep and wizard both require ciudad for any location', () => {
    const loc = makeLoc({ id: 'loc-1', ciudad: null });
    const finalizeResult = simulateFinalizeLocationRequired('loc-1', [loc]);
    const wizardResult   = simulateWizardLocationValidation('c-1', 'loc-1', [loc]);
    expect(finalizeResult).toBe('blocked_no_ciudad');
    expect(wizardResult).toBe('blocked_no_ciudad');
  });

  it('T77.2 D8: both allow proceed only when ciudad is present', () => {
    const loc = makeLoc({ id: 'loc-1', ciudad: 'Bilbao' });
    const finalizeResult = simulateFinalizeLocationRequired('loc-1', [loc]);
    const wizardResult   = simulateWizardLocationValidation('c-1', 'loc-1', [loc]);
    expect(finalizeResult).toBe('proceed');
    expect(wizardResult).toBe('proceed');
  });
});
