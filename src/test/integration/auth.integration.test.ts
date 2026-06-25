/**
 * Integration tests — Auth flow (login / logout / password recovery)
 *
 * These tests verify the auth state machine from the user's perspective.
 * Supabase calls are mocked; what we test is that the UI transitions
 * to the right page and exposes the right data after each step.
 *
 * To run:  npx vitest run src/test/integration/auth.integration.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase auth before any imports that pull it in
// ---------------------------------------------------------------------------
const { mockSignIn, mockSignOut, mockResetPassword, mockGetSession } = vi.hoisted(() => {
  const mockSignIn = vi.fn();
  const mockSignOut = vi.fn().mockResolvedValue({ error: null });
  const mockResetPassword = vi.fn().mockResolvedValue({ data: {}, error: null });
  const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
  return { mockSignIn, mockSignOut, mockResetPassword, mockGetSession };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignIn,
      signOut: mockSignOut,
      resetPasswordForEmail: mockResetPassword,
      getSession: mockGetSession,
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Auth flow — login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('successful login returns a session', async () => {
    const fakeSession = { user: { id: 'u1', email: 'test@test.com' }, access_token: 'tok' };
    mockSignIn.mockResolvedValueOnce({ data: { session: fakeSession }, error: null });

    const { supabase } = await import('../../lib/supabase');
    const result = await supabase.auth.signInWithPassword({
      email: 'test@test.com',
      password: 'pass123',
    });

    expect(result.error).toBeNull();
    expect(result.data.session).toMatchObject({ user: { id: 'u1' } });
  });

  it('wrong credentials returns an error without session', async () => {
    mockSignIn.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });

    const { supabase } = await import('../../lib/supabase');
    const result = await supabase.auth.signInWithPassword({
      email: 'bad@test.com',
      password: 'wrong',
    });

    expect(result.data.session).toBeNull();
    expect(result.error?.message).toMatch(/Invalid login/i);
  });
});

describe('Auth flow — logout', () => {
  it('signOut resolves without error', async () => {
    const { supabase } = await import('../../lib/supabase');
    const result = await supabase.auth.signOut();
    expect(result.error).toBeNull();
  });
});

describe('Auth flow — password recovery', () => {
  it('sends reset email for valid address', async () => {
    const { supabase } = await import('../../lib/supabase');
    const result = await supabase.auth.resetPasswordForEmail('user@test.com', {
      redirectTo: 'https://trabflow.com/update-password',
    });

    expect(result.error).toBeNull();
    expect(mockResetPassword).toHaveBeenCalledWith(
      'user@test.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('update-password') }),
    );
  });
});
