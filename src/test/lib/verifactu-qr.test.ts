/**
 * Tests — VF-QR: AEAT QR source-of-truth, fail-closed, and fiscal snapshot behavior
 * (printTradeInvoice.ts changes from VF-AEAT-HARDENING-IMPL-1 + gap fixes)
 *
 * Run: npx vitest run src/test/lib/verifactu-qr.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock qrcode: capture the URL passed to toString so we can assert the AEAT format
vi.mock('qrcode', () => ({
  default: {
    toString: vi.fn(async (url: string) => `<svg data-testurl="${url}"></svg>`),
  },
}));

import { buildInvoiceHtml, printTradeInvoice } from '../../lib/printTradeInvoice';
import type { FiscalSnapshot } from '../../lib/supabase';
import QRCode from 'qrcode';

// ── Fixtures ──────────────────────────────────────────────────────────────

// ORG has a DIFFERENT cif/nif than FISCAL_SNAPSHOT.nif_emisor
// so tests can verify the QR uses the snapshot, not org data
const ORG = {
  nombre: 'Fontanería Test SL',
  cif: 'B87654321',
  nif: 'B87654321',
  direccion: 'Calle Test 1',
  ciudad: 'Madrid',
};

const FISCAL_SNAPSHOT: FiscalSnapshot = {
  nif_emisor: '13789524N',        // uppercase — must be preserved as-is
  numero_factura: 'F-2026-0099',
  fecha_expedicion_vf: '29-08-2026', // DD-MM-YYYY as stored in trade_fiscal_records
  importe_total: 121,             // differs from INV_BASE.total (999) to prove source
};

const INV_BASE = {
  id: 'test-inv-id',
  org_id: 'test-org-id',
  tipo_factura: 'ordinaria' as const,
  serie: 'F',
  numero: 'F-2026-0099',
  estado: 'Emitida',
  subtotal: 100,
  iva_pct: 21,
  iva_importe: 21,
  total: 999,                     // intentionally different from snapshot.importe_total
  fecha: '2026-08-29',
  fecha_emision: '2026-08-29T10:00:00+02:00',
  verifactu_hash: 'ABCDEF1234',
  verifactu_hash_anterior: null,
  fiscal_record_id: null as string | null,
};

const LINES: never[] = [];

// Helper to get URL from last QRCode.toString call
function getLastQrUrl(): string {
  const calls = vi.mocked(QRCode.toString).mock.calls;
  return calls[calls.length - 1][0] as string;
}

// ── VF-QR-1: NIF from fiscal_record.nif_emisor ───────────────────────────

describe('VF-QR-1: NIF comes from fiscal_record.nif_emisor, not org.cif/nif', () => {
  beforeEach(() => vi.mocked(QRCode.toString).mockClear());

  it('QR nif equals fiscal_record.nif_emisor', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid' };
    await buildInvoiceHtml(inv as never, LINES, ORG, undefined, FISCAL_SNAPSHOT);
    const url = getLastQrUrl();
    expect(url).toContain(`nif=${encodeURIComponent(FISCAL_SNAPSHOT.nif_emisor)}`);
  });

  it('QR nif does NOT contain org.cif when snapshot has a different NIF', async () => {
    // ORG.cif = 'B87654321', FISCAL_SNAPSHOT.nif_emisor = '13789524N'
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid' };
    await buildInvoiceHtml(inv as never, LINES, ORG, undefined, FISCAL_SNAPSHOT);
    const url = getLastQrUrl();
    expect(url).not.toContain(encodeURIComponent(ORG.cif!));
  });
});

// ── VF-QR-2: lowercase NIF preserved ─────────────────────────────────────

describe('VF-QR-2: lowercase nif_emisor is preserved unchanged in QR URL', () => {
  beforeEach(() => vi.mocked(QRCode.toString).mockClear());

  it('lowercase NIF stays lowercase — no toUpperCase applied', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid' };
    const snapshot: FiscalSnapshot = { ...FISCAL_SNAPSHOT, nif_emisor: 'b87654321' };
    await buildInvoiceHtml(inv as never, LINES, ORG, undefined, snapshot);
    const url = getLastQrUrl();
    expect(url).toContain('nif=b87654321');
    expect(url).not.toContain('nif=B87654321');
  });
});

// ── VF-QR-3: uppercase NIF preserved ─────────────────────────────────────

describe('VF-QR-3: uppercase nif_emisor is preserved unchanged in QR URL', () => {
  beforeEach(() => vi.mocked(QRCode.toString).mockClear());

  it('uppercase NIF stays uppercase — no toLowerCase applied', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid' };
    const snapshot: FiscalSnapshot = { ...FISCAL_SNAPSHOT, nif_emisor: '13789524N' };
    await buildInvoiceHtml(inv as never, LINES, ORG, undefined, snapshot);
    const url = getLastQrUrl();
    expect(url).toContain('nif=13789524N');
  });
});

// ── VF-QR-4: org.nif NOT used when snapshot present ─────────────────────

describe('VF-QR-4: org.nif is NOT used when fiscal snapshot is provided', () => {
  beforeEach(() => vi.mocked(QRCode.toString).mockClear());

  it('QR URL does not contain org.cif value', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid' };
    await buildInvoiceHtml(inv as never, LINES, ORG, undefined, FISCAL_SNAPSHOT);
    const url = getLastQrUrl();
    expect(url).not.toContain(ORG.cif!);
    expect(url).not.toContain('B87654321');
  });
});

// ── VF-QR-5: numserie from fiscal_record.numero_factura ──────────────────

describe('VF-QR-5: numserie comes from fiscal_record.numero_factura', () => {
  beforeEach(() => vi.mocked(QRCode.toString).mockClear());

  it('QR numserie equals fiscal_record.numero_factura', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid' };
    await buildInvoiceHtml(inv as never, LINES, ORG, undefined, FISCAL_SNAPSHOT);
    const url = getLastQrUrl();
    expect(url).toContain(`numserie=${encodeURIComponent(FISCAL_SNAPSHOT.numero_factura)}`);
  });
});

// ── VF-QR-6: mismatch → fail closed ──────────────────────────────────────

describe('VF-QR-6: mismatch invoice.numero vs fiscal.numero_factura → fail closed', () => {
  beforeEach(() => {
    vi.mocked(QRCode.toString).mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('does NOT call QRCode.toString when numero_factura !== invoice.numero', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid', numero: 'F-MISMATCH-999' };
    await buildInvoiceHtml(inv as never, LINES, ORG, undefined, FISCAL_SNAPSHOT);
    expect(vi.mocked(QRCode.toString)).not.toHaveBeenCalled();
  });

  it('HTML contains no <svg when mismatch', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid', numero: 'F-MISMATCH-999' };
    const html = await buildInvoiceHtml(inv as never, LINES, ORG, undefined, FISCAL_SNAPSHOT);
    expect(html).not.toContain('<svg');
  });

  it('VeriFactu block is still shown (fiscal_record_id confirms fiscal registration)', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid', numero: 'F-MISMATCH-999' };
    const html = await buildInvoiceHtml(inv as never, LINES, ORG, undefined, FISCAL_SNAPSHOT);
    expect(html).toContain('Registro VeriFactu');
  });
});

// ── VF-QR-7: fecha from fiscal_record.fecha_expedicion_vf ────────────────

describe('VF-QR-7: fecha comes from fiscal_record.fecha_expedicion_vf (DD-MM-YYYY)', () => {
  beforeEach(() => vi.mocked(QRCode.toString).mockClear());

  it('QR fecha equals fiscal_record.fecha_expedicion_vf verbatim', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid' };
    await buildInvoiceHtml(inv as never, LINES, ORG, undefined, FISCAL_SNAPSHOT);
    const url = getLastQrUrl();
    expect(url).toContain(`fecha=${encodeURIComponent('29-08-2026')}`);
  });

  it('fecha is in DD-MM-YYYY format (not YYYY-MM-DD)', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid' };
    await buildInvoiceHtml(inv as never, LINES, ORG, undefined, FISCAL_SNAPSHOT);
    const url = getLastQrUrl();
    expect(url).toContain('fecha=29-08-2026');
    expect(url).not.toContain('fecha=2026-08-29');
  });
});

// ── VF-QR-8: timezone boundary ───────────────────────────────────────────

describe('VF-QR-8: timezone boundary — fiscal fecha_expedicion_vf wins over UTC split', () => {
  beforeEach(() => vi.mocked(QRCode.toString).mockClear());

  it('uses DD-MM-YYYY from fiscal record when UTC date differs from local CET date', async () => {
    // Emitted at 23:30 UTC = 01:30 CET next day
    // fecha_emision.split('T')[0] = '2026-08-29' (UTC date — old, wrong behavior)
    // fiscal fecha_expedicion_vf = '30-08-2026' (local CET date — correct)
    const inv = {
      ...INV_BASE,
      fiscal_record_id: 'test-frid',
      fecha_emision: '2026-08-29T23:30:00Z',
      fecha: '2026-08-30',
    };
    const snapshotMidnight: FiscalSnapshot = {
      ...FISCAL_SNAPSHOT,
      fecha_expedicion_vf: '30-08-2026',
    };
    await buildInvoiceHtml(inv as never, LINES, ORG, undefined, snapshotMidnight);
    const url = getLastQrUrl();
    expect(url).toContain('fecha=30-08-2026');
    expect(url).not.toContain('fecha=29-08-2026');
  });
});

// ── VF-QR-9: importe from fiscal_record.importe_total ────────────────────

describe('VF-QR-9: importe comes from fiscal_record.importe_total', () => {
  beforeEach(() => vi.mocked(QRCode.toString).mockClear());

  it('QR importe equals fiscal_record.importe_total.toFixed(2), not inv.total', async () => {
    // INV_BASE.total = 999, FISCAL_SNAPSHOT.importe_total = 121
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid', total: 999 };
    await buildInvoiceHtml(inv as never, LINES, ORG, undefined, FISCAL_SNAPSHOT);
    const url = getLastQrUrl();
    expect(url).toContain(`importe=${encodeURIComponent('121.00')}`);
    expect(url).not.toContain('999');
  });

  it('importe has exactly 2 decimal places for integer fiscal total', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid' };
    const snapshot: FiscalSnapshot = { ...FISCAL_SNAPSHOT, importe_total: 3278 };
    await buildInvoiceHtml(inv as never, LINES, ORG, undefined, snapshot);
    const url = getLastQrUrl();
    expect(url).toContain(`importe=${encodeURIComponent('3278.00')}`);
  });
});

// ── VF-QR-10: hash NOT in QR payload ─────────────────────────────────────

describe('VF-QR-10: verifactu hash does NOT appear in QR URL', () => {
  beforeEach(() => vi.mocked(QRCode.toString).mockClear());

  it('AEAT URL does not include SHA-256 hash or hash-related params', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid', verifactu_hash: 'ABCDEF1234567890DEADBEEF' };
    await buildInvoiceHtml(inv as never, LINES, ORG, undefined, FISCAL_SNAPSHOT);
    const url = getLastQrUrl();
    expect(url).not.toContain('ABCDEF1234567890DEADBEEF');
    expect(url).not.toContain('hash');
    expect(url).not.toContain('Huella');
  });
});

// ── VF-QR-11: legacy hash without fiscal_record → no VeriFactu block ─────

describe('VF-QR-11: legacy verifactu_hash without fiscal_record_id → no VeriFactu block', () => {
  it('does NOT render VeriFactu block when only verifactu_hash is set', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: null, verifactu_hash: 'ABCDEF1234567890' };
    const html = await buildInvoiceHtml(inv as never, LINES, ORG);
    expect(html).not.toContain('Registro VeriFactu');
    expect(html).not.toContain('<svg');
  });
});

// ── VF-QR-12: fiscal_record_id present but snapshot missing → fail closed ─

describe('VF-QR-12: fiscal_record_id present but snapshot missing → fail closed', () => {
  beforeEach(() => {
    vi.mocked(QRCode.toString).mockClear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('shows VeriFactu block but no QR when snapshot is null', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid' };
    const html = await buildInvoiceHtml(inv as never, LINES, ORG, undefined, null);
    expect(html).toContain('Registro VeriFactu');
    expect(html).not.toContain('<svg');
    expect(vi.mocked(QRCode.toString)).not.toHaveBeenCalled();
  });

  it('shows VeriFactu block but no QR when snapshot is undefined (not provided)', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid' };
    const html = await buildInvoiceHtml(inv as never, LINES, ORG);
    expect(html).toContain('Registro VeriFactu');
    expect(html).not.toContain('<svg');
    expect(vi.mocked(QRCode.toString)).not.toHaveBeenCalled();
  });

  it('does NOT use org.nif as fallback NIF in QR when snapshot is missing', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid' };
    // No snapshot provided → no QR → org.nif never used for QR
    const html = await buildInvoiceHtml(inv as never, LINES, ORG, undefined, null);
    // Verify QRCode.toString was never called (so no QR with org.nif was generated)
    expect(vi.mocked(QRCode.toString)).not.toHaveBeenCalled();
    // No AEAT URL in output
    expect(html).not.toContain('ValidarQR');
  });
});

// ── VF-QR-13: no Google Charts ───────────────────────────────────────────

describe('VF-QR-13: no Google Charts dependency in output', () => {
  it('output contains no reference to chart.googleapis.com', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid' };
    const html = await buildInvoiceHtml(inv as never, LINES, ORG, undefined, FISCAL_SNAPSHOT);
    expect(html).not.toContain('chart.googleapis.com');
  });

  it('output contains no legacy VERIFACTU: QR payload format', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid' };
    const html = await buildInvoiceHtml(inv as never, LINES, ORG, undefined, FISCAL_SNAPSHOT);
    expect(html).not.toContain('VERIFACTU:');
  });
});

// ── VF-QR-14: QR generated locally ───────────────────────────────────────

describe('VF-QR-14: QR generated locally without external network call', () => {
  beforeEach(() => vi.mocked(QRCode.toString).mockClear());

  it('calls QRCode.toString (local library) exactly once', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid' };
    await buildInvoiceHtml(inv as never, LINES, ORG, undefined, FISCAL_SNAPSHOT);
    expect(vi.mocked(QRCode.toString)).toHaveBeenCalledOnce();
  });

  it('uses type:svg (no canvas required)', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid' };
    await buildInvoiceHtml(inv as never, LINES, ORG, undefined, FISCAL_SNAPSHOT);
    const opts = vi.mocked(QRCode.toString).mock.calls[0][1] as { type: string };
    expect(opts.type).toBe('svg');
  });

  it('SVG is embedded inline (no external src)', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid' };
    const html = await buildInvoiceHtml(inv as never, LINES, ORG, undefined, FISCAL_SNAPSHOT);
    expect(html).toContain('<svg');
    expect(html).not.toContain('src="https://');
  });
});

// ── VF-QR-15: URL encoding correct ───────────────────────────────────────

describe('VF-QR-15: AEAT URL structure and encoding', () => {
  beforeEach(() => vi.mocked(QRCode.toString).mockClear());

  it('uses the correct AEAT ValidarQR base URL', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid' };
    await buildInvoiceHtml(inv as never, LINES, ORG, undefined, FISCAL_SNAPSHOT);
    const url = getLastQrUrl();
    expect(url).toContain('https://www2.agenciatributaria.es/wlpl/TIKE-CONT/ValidarQR');
  });

  it('URL contains all 4 required parameters', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid' };
    await buildInvoiceHtml(inv as never, LINES, ORG, undefined, FISCAL_SNAPSHOT);
    const url = getLastQrUrl();
    expect(url).toContain('nif=');
    expect(url).toContain('numserie=');
    expect(url).toContain('fecha=');
    expect(url).toContain('importe=');
  });

  it('special chars in NIF are percent-encoded', async () => {
    const inv = { ...INV_BASE, fiscal_record_id: 'test-frid', numero: 'F-SPACE-99' };
    const snapshot: FiscalSnapshot = {
      nif_emisor: '13 789',    // space character
      numero_factura: 'F-SPACE-99',
      fecha_expedicion_vf: '01-01-2026',
      importe_total: 100,
    };
    await buildInvoiceHtml(inv as never, LINES, ORG, undefined, snapshot);
    const url = getLastQrUrl();
    expect(url).toContain('nif=13%20789');
  });
});

// ── Async contract ────────────────────────────────────────────────────────

describe('VF-QR-ASYNC: buildInvoiceHtml and printTradeInvoice are async', () => {
  it('buildInvoiceHtml returns a Promise that resolves', async () => {
    const result = buildInvoiceHtml(INV_BASE as never, LINES, ORG);
    expect(result).toBeInstanceOf(Promise);
    await result;
  });

  it('printTradeInvoice returns a Promise', () => {
    const result = printTradeInvoice(INV_BASE as never, LINES, ORG);
    expect(result).toBeInstanceOf(Promise);
    return result.catch(() => {});
  });
});
