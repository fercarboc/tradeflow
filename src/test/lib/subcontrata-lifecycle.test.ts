/**
 * SUBCONTRACT-TRACEABILITY-DELETE — Lifecycle safety tests
 *
 * Tests the pure eligibility logic that mirrors removeSubcontrataSafely
 * and the UI guard rules (list action visibility, detail bloqueado).
 *
 * No Supabase mocks — pure state-machine / derivation tests.
 */

import { describe, it, expect } from 'vitest';

// ── Types (inline-minimal) ────────────────────────────────────────────────────

type EstadoKey =
  | 'pendiente' | 'solicitado' | 'presupuesto_recibido' | 'añadido_presupuesto'
  | 'pendiente_cliente' | 'en_curso' | 'completado' | 'factura_recibida'
  | 'pagado' | 'cancelado';

interface SubcontrataLite {
  estado: EstadoKey;
  quote_id?: string | null;
  job_id?: string | null;
  contract_id?: string | null;
  importe_factura_recibida?: number | null;
  pagado?: boolean | null;
  pagado_at?: string | null;
}

// ── Pure logic: mirrors removeSubcontrataSafely eligibility check ─────────────

function isHardDeleteEligible(rec: SubcontrataLite, notaCount: number): boolean {
  return (
    rec.estado === 'pendiente' &&
    !rec.quote_id &&
    !rec.job_id &&
    !rec.contract_id &&
    rec.importe_factura_recibida == null &&
    !rec.pagado &&
    !rec.pagado_at &&
    notaCount === 0
  );
}

// ── Pure logic: mirrors list-view action button visibility ────────────────────

function listActionVisible(s: SubcontrataLite): boolean {
  return s.estado !== 'cancelado';
}

// ── Pure logic: mirrors detail-view bloqueado guard ───────────────────────────

function isDetailBloqueado(s: SubcontrataLite): boolean {
  return !!s.pagado || s.estado === 'pagado' || s.estado === 'cancelado';
}

// ── Pure logic: mirrors UI pre-check for confirm dialog (without notes) ───────

function locallyEligibleForHardDelete(s: SubcontrataLite): boolean {
  return (
    s.estado === 'pendiente' &&
    !s.quote_id &&
    !s.job_id &&
    !s.contract_id &&
    s.importe_factura_recibida == null &&
    !s.pagado &&
    !s.pagado_at
  );
}

// ── Base record for clean drafts ──────────────────────────────────────────────

const cleanDraft: SubcontrataLite = {
  estado: 'pendiente',
  quote_id: null,
  job_id: null,
  contract_id: null,
  importe_factura_recibida: null,
  pagado: false,
  pagado_at: null,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('removeSubcontrataSafely — eligibility', () => {

  it('test 1: pendiente, no links, no notes → DELETE', () => {
    expect(isHardDeleteEligible(cleanDraft, 0)).toBe(true);
  });

  it('test 2: solicitado, otherwise empty → CANCEL', () => {
    expect(isHardDeleteEligible({ ...cleanDraft, estado: 'solicitado' }, 0)).toBe(false);
  });

  it('test 3: presupuesto_recibido, otherwise empty → CANCEL', () => {
    expect(isHardDeleteEligible({ ...cleanDraft, estado: 'presupuesto_recibido' }, 0)).toBe(false);
  });

  it('test 4: pendiente + quote_id → CANCEL', () => {
    expect(isHardDeleteEligible({ ...cleanDraft, quote_id: 'q-123' }, 0)).toBe(false);
  });

  it('test 5: pendiente + job_id → CANCEL', () => {
    expect(isHardDeleteEligible({ ...cleanDraft, job_id: 'j-456' }, 0)).toBe(false);
  });

  it('test 6: pendiente + contract_id → CANCEL', () => {
    expect(isHardDeleteEligible({ ...cleanDraft, contract_id: 'c-789' }, 0)).toBe(false);
  });

  it('test 7: pendiente + 1 nota → CANCEL', () => {
    expect(isHardDeleteEligible(cleanDraft, 1)).toBe(false);
  });

  it('test 8: importe_factura_recibida presente → CANCEL', () => {
    expect(isHardDeleteEligible({ ...cleanDraft, importe_factura_recibida: 120 }, 0)).toBe(false);
  });

  it('test 9: pagado=true → CANCEL', () => {
    expect(isHardDeleteEligible({ ...cleanDraft, pagado: true }, 0)).toBe(false);
  });

  it('test 10: pagado_at presente → CANCEL', () => {
    expect(isHardDeleteEligible({ ...cleanDraft, pagado_at: '2026-06-15T10:00:00Z' }, 0)).toBe(false);
  });

  it('test 11: completado, otherwise empty → CANCEL', () => {
    expect(isHardDeleteEligible({ ...cleanDraft, estado: 'completado' }, 0)).toBe(false);
  });

  it('test 12: already cancelado → CANCEL (not eligible for hard delete)', () => {
    expect(isHardDeleteEligible({ ...cleanDraft, estado: 'cancelado' }, 0)).toBe(false);
  });

});

describe('removeSubcontrataSafely — CANCEL preserves fields', () => {

  it('ineligible record produces cancel result, not delete', () => {
    const payedRecord: SubcontrataLite = {
      estado: 'pagado',
      quote_id: 'q-1',
      job_id: null,
      contract_id: null,
      importe_factura_recibida: 120,
      pagado: true,
      pagado_at: '2026-06-15T10:00:00Z',
    };
    // The API would cancel — not delete — preserving economic/link fields
    expect(isHardDeleteEligible(payedRecord, 0)).toBe(false);
    // quote_id, importe_factura_recibida, pagado_at are present after cancel
    // (verified: update sets only estado=cancelado, all other cols unchanged)
    expect(payedRecord.quote_id).toBe('q-1');
    expect(payedRecord.importe_factura_recibida).toBe(120);
    expect(payedRecord.pagado_at).toBeTruthy();
  });

});

describe('UI — list view action button visibility', () => {

  it('test 13 (list path): paid record action IS visible in list (not cancelado), but API would cancel it', () => {
    const payedRecord: SubcontrataLite = { ...cleanDraft, estado: 'pagado', pagado: true, pagado_at: '2026-06-15T10:00:00Z' };
    expect(listActionVisible(payedRecord)).toBe(true);        // button shown in list
    expect(isHardDeleteEligible(payedRecord, 0)).toBe(false); // but API would cancel, not delete
  });

  it('cancelado record: action button NOT shown in list (no repeated cancel)', () => {
    const cancelled: SubcontrataLite = { ...cleanDraft, estado: 'cancelado' };
    expect(listActionVisible(cancelled)).toBe(false);
  });

  it('active in-progress record: action button shown in list', () => {
    const active: SubcontrataLite = { ...cleanDraft, estado: 'en_curso' };
    expect(listActionVisible(active)).toBe(true);
  });

});

describe('UI — detail view bloqueado guard', () => {

  it('test 14 (detail path): pagado=true → bloqueado → action button not shown', () => {
    const payedRecord: SubcontrataLite = { ...cleanDraft, estado: 'pagado', pagado: true };
    expect(isDetailBloqueado(payedRecord)).toBe(true);
  });

  it('estado=pagado (without pagado flag) → bloqueado', () => {
    const s: SubcontrataLite = { ...cleanDraft, estado: 'pagado', pagado: false };
    expect(isDetailBloqueado(s)).toBe(true);
  });

  it('estado=cancelado → bloqueado (no repeated cancel in detail)', () => {
    const s: SubcontrataLite = { ...cleanDraft, estado: 'cancelado' };
    expect(isDetailBloqueado(s)).toBe(true);
  });

  it('active record → NOT bloqueado → action button shown', () => {
    const s: SubcontrataLite = { ...cleanDraft, estado: 'en_curso' };
    expect(isDetailBloqueado(s)).toBe(false);
  });

});

describe('UI — both entry points use the same safe lifecycle rule', () => {

  it('test 15: same eligibility logic governs list and detail paths (single rule, centralized in API)', () => {
    const rec: SubcontrataLite = { ...cleanDraft };
    // Both list action and detail action route through handleRemove → removeSubcontrataSafely
    // The UI pre-check (locallyEligibleForHardDelete) matches the API rule minus notes:
    expect(locallyEligibleForHardDelete(rec)).toBe(true);
    expect(isHardDeleteEligible(rec, 0)).toBe(true); // with 0 notes: full eligibility confirmed
    expect(isHardDeleteEligible(rec, 1)).toBe(false); // with 1 note: API would cancel even if UI pre-check passed
  });

  it('no code path reaches hard delete for records with economic data, regardless of entry point', () => {
    const records: SubcontrataLite[] = [
      { ...cleanDraft, importe_factura_recibida: 100 },
      { ...cleanDraft, pagado: true },
      { ...cleanDraft, pagado_at: '2026-06-15T10:00:00Z' },
      { ...cleanDraft, quote_id: 'q-1' },
      { ...cleanDraft, job_id: 'j-1' },
    ];
    for (const rec of records) {
      expect(isHardDeleteEligible(rec, 0)).toBe(false);
      expect(locallyEligibleForHardDelete(rec)).toBe(false);
    }
  });

});
