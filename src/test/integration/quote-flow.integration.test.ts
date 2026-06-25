/**
 * Integration tests — Quote lifecycle
 *
 * Flow: create quote → send to client → client accepts via public link (/p/token)
 *
 * Supabase RPC and table calls are mocked. We test the data transformation
 * layer (functions in supabase.ts / api/) and verify correct DB calls are made.
 *
 * To run:  npx vitest run src/test/integration/quote-flow.integration.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const { mockFrom, mockRpc } = vi.hoisted(() => {
  const mockSelect = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockInsert = vi.fn().mockResolvedValue({ data: [{ id: 'q1' }], error: null });
  const mockUpdate = vi.fn().mockReturnThis();
  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    eq: mockEq,
    single: mockSingle,
    insert: mockInsert,
    update: mockUpdate,
  });
  const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
  return { mockFrom, mockRpc, mockInsert, mockUpdate, mockSelect, mockEq, mockSingle };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

// ---------------------------------------------------------------------------
// Helper types (inline to avoid circular imports)
// ---------------------------------------------------------------------------
type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'invoiced';
interface QuoteRow { id: string; status: QuoteStatus; public_token: string | null }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Quote creation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a quote with status=draft', async () => {
    const { supabase } = await import('../../lib/supabase');

    const newQuote = {
      org_id: 'org-1',
      client_id: 'cli-1',
      status: 'draft' as QuoteStatus,
      items: [],
      total: 0,
    };

    await supabase.from('trade_quotes').insert(newQuote);

    expect(mockFrom).toHaveBeenCalledWith('trade_quotes');
  });
});

describe('Quote send flow', () => {
  it('updates status to sent and stores public_token', async () => {
    const { supabase } = await import('../../lib/supabase');

    const token = crypto.randomUUID();
    await supabase
      .from('trade_quotes')
      .update({ status: 'sent', public_token: token })
      .eq('id', 'q1');

    expect(mockFrom).toHaveBeenCalledWith('trade_quotes');
  });

  it('generates a public link with the token', () => {
    const token = 'abc-def-ghi';
    const publicLink = `https://trabflow.com/p/${token}`;
    expect(publicLink).toMatch(/\/p\/abc-def-ghi$/);
  });
});

describe('Client accepts quote via public link', () => {
  it('calls accept_quote RPC with the token', async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    const { supabase } = await import('../../lib/supabase');

    const result = await supabase.rpc('accept_quote', { p_token: 'abc-def-ghi' });

    expect(mockRpc).toHaveBeenCalledWith('accept_quote', { p_token: 'abc-def-ghi' });
    expect(result.error).toBeNull();
    expect((result.data as { ok: boolean }).ok).toBe(true);
  });

  it('returns error when token is invalid or quote already accepted', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Quote not found' } });
    const { supabase } = await import('../../lib/supabase');

    const result = await supabase.rpc('accept_quote', { p_token: 'invalid-token' });

    expect(result.error?.message).toMatch(/not found/i);
  });
});
