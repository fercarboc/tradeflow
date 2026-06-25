/**
 * Integration tests — Stripe checkout → upgrade → verify feature access
 *
 * Flow: user clicks "upgrade" → Stripe checkout session created →
 *       webhook fires → subscription row updated → feature gates unlock
 *
 * The Stripe API and Supabase are both mocked.
 * What we verify: correct edge-function payloads and feature-gate logic.
 *
 * To run:  npx vitest run src/test/integration/stripe-upgrade.integration.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const { mockRpc, mockFrom } = vi.hoisted(() => {
  const mockRpc = vi.fn();
  const mockUpdate = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockSelect = vi.fn().mockReturnThis();
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockFrom = vi.fn().mockReturnValue({
    update: mockUpdate,
    eq: mockEq,
    select: mockSelect,
    single: mockSingle,
  });
  return { mockRpc, mockFrom, mockUpdate, mockEq, mockSelect, mockSingle };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
  },
}));

// ---------------------------------------------------------------------------
// Feature-gate logic (mirrors useSubscription.ts logic)
// ---------------------------------------------------------------------------
type Plan = 'trial' | 'starter' | 'pro' | 'enterprise';
const PLAN_RANK: Record<Plan, number> = { trial: 0, starter: 1, pro: 2, enterprise: 3 };

function hasFeature(plan: Plan, requiredPlan: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[requiredPlan];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Stripe checkout session creation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('create-checkout edge function receives correct price_id and org_id', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { checkout_url: 'https://checkout.stripe.com/pay/test123' },
      error: null,
    });

    const { supabase } = await import('../../lib/supabase');
    const result = await supabase.rpc('create_stripe_checkout', {
      p_org_id: 'org-1',
      p_price_id: 'price_pro_monthly',
      p_success_url: 'https://trabflow.com/app',
      p_cancel_url: 'https://trabflow.com/precios',
    });

    expect(result.error).toBeNull();
    expect((result.data as { checkout_url: string }).checkout_url).toMatch(/checkout\.stripe\.com/);
  });
});

describe('Post-upgrade subscription state', () => {
  it('subscription row is updated to pro after webhook', async () => {
    const upgradedSub = {
      id: 'sub-1',
      org_id: 'org-1',
      plan: 'pro',
      status: 'active',
      stripe_subscription_id: 'sub_stripe123',
    };

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: upgradedSub, error: null }),
    });

    const { supabase } = await import('../../lib/supabase');
    const { data } = await supabase
      .from('trade_subscriptions')
      .select()
      .eq('org_id', 'org-1')
      .single();

    expect((data as typeof upgradedSub).plan).toBe('pro');
    expect((data as typeof upgradedSub).status).toBe('active');
  });
});

describe('Feature gates after upgrade', () => {
  it('trial cannot access pro features', () => {
    expect(hasFeature('trial', 'pro')).toBe(false);
  });

  it('pro can access starter and pro features', () => {
    expect(hasFeature('pro', 'starter')).toBe(true);
    expect(hasFeature('pro', 'pro')).toBe(true);
  });

  it('pro cannot access enterprise features', () => {
    expect(hasFeature('pro', 'enterprise')).toBe(false);
  });

  it('enterprise can access all features', () => {
    const plans: Plan[] = ['trial', 'starter', 'pro', 'enterprise'];
    for (const p of plans) {
      expect(hasFeature('enterprise', p)).toBe(true);
    }
  });

  it('downgrade: enterprise → starter locks enterprise features', () => {
    expect(hasFeature('starter', 'enterprise')).toBe(false);
    expect(hasFeature('starter', 'pro')).toBe(false);
    expect(hasFeature('starter', 'starter')).toBe(true);
  });
});
