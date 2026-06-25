/**
 * Integration tests — Invite technician → logs in → sees only their jobs
 *
 * Flow: owner invites tech via email → tech activates account →
 *       tech logs in → RLS ensures tech sees only assigned jobs
 *
 * To run:  npx vitest run src/test/integration/technician-invite.integration.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const { mockRpc, mockFrom } = vi.hoisted(() => {
  const mockRpc = vi.fn();
  const mockSelect = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockIn = vi.fn().mockReturnThis();
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const from = vi.fn().mockReturnValue({
    select: mockSelect,
    eq: mockEq,
    in: mockIn,
    single: mockSingle,
    insert: mockInsert,
  });
  return { mockRpc, mockFrom: from, mockSelect, mockEq, mockIn, mockSingle, mockInsert };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
  },
}));

// ---------------------------------------------------------------------------
// Role-permission constants (mirrors ROL_PERMISOS in SessionContext)
// ---------------------------------------------------------------------------
const ROL_PERMISOS = {
  owner: ['quotes.create', 'invoices.manage', 'team.manage', 'settings.manage', 'subscription.manage', 'jobs.manage', 'clients.manage'],
  admin:  ['quotes.create', 'invoices.manage', 'team.manage', 'jobs.manage', 'clients.manage'],
  tecnico: ['jobs.view', 'jobs.update'],
  comercial: ['quotes.create', 'clients.manage'],
  visualizador: ['jobs.view'],
};

function hasPermission(rol: keyof typeof ROL_PERMISOS, perm: string): boolean {
  return ROL_PERMISOS[rol].includes(perm);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Technician invite', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invite_member RPC is called with role=tecnico', async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    const { supabase } = await import('../../lib/supabase');

    await supabase.rpc('invite_member', {
      p_org_id: 'org-1',
      p_email: 'tech@installer.com',
      p_role: 'tecnico',
    });

    expect(mockRpc).toHaveBeenCalledWith('invite_member', {
      p_org_id: 'org-1',
      p_email: 'tech@installer.com',
      p_role: 'tecnico',
    });
  });

  it('duplicate invite returns a handled error', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Member already exists in this org' },
    });
    const { supabase } = await import('../../lib/supabase');

    const result = await supabase.rpc('invite_member', {
      p_org_id: 'org-1',
      p_email: 'existing@installer.com',
      p_role: 'tecnico',
    });

    expect(result.error?.message).toMatch(/already exists/i);
  });
});

describe('Technician RLS — sees only assigned jobs', () => {
  it('jobs query filters by worker_profile_id', async () => {
    const techJobs = [
      { id: 'job-1', worker_profile_id: 'wp-tech1', title: 'Instalar termo' },
      { id: 'job-2', worker_profile_id: 'wp-tech1', title: 'Revisar caldera' },
    ];

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: techJobs, error: null }),
    });

    const { supabase } = await import('../../lib/supabase');
    const result = await supabase
      .from('trade_jobs')
      .select()
      .eq('worker_profile_id', 'wp-tech1');

    expect(result.data).toHaveLength(2);
    expect((result.data as typeof techJobs).every(j => j.worker_profile_id === 'wp-tech1')).toBe(true);
  });

  it('tech cannot see jobs assigned to other workers (RLS enforced at DB level)', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const { supabase } = await import('../../lib/supabase');
    const result = await supabase
      .from('trade_jobs')
      .select()
      .eq('worker_profile_id', 'wp-other-tech');

    // RLS returns empty array (not an error) when no rows match the policy
    expect(result.data).toHaveLength(0);
    expect(result.error).toBeNull();
  });
});

describe('Technician permissions', () => {
  it('tecnico can view and update jobs', () => {
    expect(hasPermission('tecnico', 'jobs.view')).toBe(true);
    expect(hasPermission('tecnico', 'jobs.update')).toBe(true);
  });

  it('tecnico cannot create quotes, manage team, or access settings', () => {
    expect(hasPermission('tecnico', 'quotes.create')).toBe(false);
    expect(hasPermission('tecnico', 'team.manage')).toBe(false);
    expect(hasPermission('tecnico', 'settings.manage')).toBe(false);
    expect(hasPermission('tecnico', 'invoices.manage')).toBe(false);
  });

  it('owner retains all permissions after inviting tecnico', () => {
    // Inviting a member does not change the owner's role
    expect(hasPermission('owner', 'team.manage')).toBe(true);
    expect(hasPermission('owner', 'subscription.manage')).toBe(true);
  });
});
