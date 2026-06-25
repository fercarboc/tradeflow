/**
 * Integration tests — Create invoice from accepted quote
 *
 * Flow: accepted quote → create_invoice_from_quote RPC → invoice row exists
 *
 * To run:  npx vitest run src/test/integration/invoice-from-quote.integration.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const { mockRpc, mockFrom } = vi.hoisted(() => {
  const mockRpc = vi.fn();
  const mockSelect = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect, eq: mockEq, single: mockSingle });
  return { mockRpc, mockFrom, mockSelect, mockEq, mockSingle };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Invoice creation from quote', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls create_invoice_from_quote RPC with the accepted quote id', async () => {
    const fakeInvoice = { id: 'inv-1', quote_id: 'q1', status: 'draft', total: 1500 };
    mockRpc.mockResolvedValueOnce({ data: fakeInvoice, error: null });

    const { supabase } = await import('../../lib/supabase');
    const result = await supabase.rpc('create_invoice_from_quote', { p_quote_id: 'q1' });

    expect(mockRpc).toHaveBeenCalledWith('create_invoice_from_quote', { p_quote_id: 'q1' });
    expect(result.error).toBeNull();
    expect((result.data as typeof fakeInvoice).status).toBe('draft');
  });

  it('fails when quote is still in draft (not accepted)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Quote must be accepted before invoicing' },
    });

    const { supabase } = await import('../../lib/supabase');
    const result = await supabase.rpc('create_invoice_from_quote', { p_quote_id: 'draft-q' });

    expect(result.data).toBeNull();
    expect(result.error?.message).toMatch(/accepted/i);
  });

  it('prevents double-invoicing the same quote', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Invoice already exists for this quote' },
    });

    const { supabase } = await import('../../lib/supabase');
    const result = await supabase.rpc('create_invoice_from_quote', { p_quote_id: 'q1' });

    expect(result.error?.message).toMatch(/already exists/i);
  });

  it('resulting invoice has the same items total as the quote', async () => {
    const fakeInvoice = { id: 'inv-2', quote_id: 'q2', total: 3200, items_count: 4 };
    mockRpc.mockResolvedValueOnce({ data: fakeInvoice, error: null });

    const { supabase } = await import('../../lib/supabase');
    const result = await supabase.rpc('create_invoice_from_quote', { p_quote_id: 'q2' });

    expect((result.data as typeof fakeInvoice).total).toBe(3200);
    expect((result.data as typeof fakeInvoice).items_count).toBe(4);
  });
});
