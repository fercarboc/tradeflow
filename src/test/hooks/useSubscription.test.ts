import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSubscription } from '../../hooks/useSubscription';
import { useSession } from '../../context/SessionContext';

vi.mock('../../context/SessionContext', () => ({
  useSession: vi.fn(),
}));

const mockUseSession = vi.mocked(useSession);

function makeSession(plan: string, trialEnd?: string) {
  return {
    user: null,
    org: null,
    subscription: trialEnd ? { plan, trial_end: trialEnd } as never : null,
    plan: plan as never,
    rol: 'owner' as never,
    permisos: [],
    workerProfile: null,
    isLoading: false,
    refreshSubscription: vi.fn(),
  };
}

describe('useSubscription', () => {
  beforeEach(() => vi.clearAllMocks());

  it('basico plan — isPremium false, isPro false', () => {
    mockUseSession.mockReturnValue(makeSession('basico'));
    const { result } = renderHook(() => useSubscription());
    expect(result.current.isPremium).toBe(false);
    expect(result.current.isPro).toBe(false);
  });

  it('pro plan — isPro true, isPremium false', () => {
    mockUseSession.mockReturnValue(makeSession('pro'));
    const { result } = renderHook(() => useSubscription());
    expect(result.current.isPro).toBe(true);
    expect(result.current.isPremium).toBe(false);
  });

  it('empresa_plus — isPremium true', () => {
    mockUseSession.mockReturnValue(makeSession('empresa_plus'));
    const { result } = renderHook(() => useSubscription());
    expect(result.current.isPremium).toBe(true);
  });

  it('isTrialing true when trial_end is in the future', () => {
    const futureDate = new Date(Date.now() + 86_400_000 * 30).toISOString();
    mockUseSession.mockReturnValue(makeSession('empresa_plus', futureDate));
    const { result } = renderHook(() => useSubscription());
    expect(result.current.isTrialing).toBe(true);
    expect(result.current.trialDaysLeft).toBeGreaterThan(0);
  });

  it('isTrialing false when trial_end is in the past', () => {
    const pastDate = new Date(Date.now() - 86_400_000).toISOString();
    mockUseSession.mockReturnValue(makeSession('empresa_plus', pastDate));
    const { result } = renderHook(() => useSubscription());
    expect(result.current.isTrialing).toBe(false);
    expect(result.current.trialDaysLeft).toBe(0);
  });

  describe('hasFeature', () => {
    it('basico — no AI features', () => {
      mockUseSession.mockReturnValue(makeSession('basico'));
      const { result } = renderHook(() => useSubscription());
      expect(result.current.hasFeature('ai.voice')).toBe(false);
      expect(result.current.hasFeature('ai.photo')).toBe(false);
    });

    it('pro — has AI features', () => {
      mockUseSession.mockReturnValue(makeSession('pro'));
      const { result } = renderHook(() => useSubscription());
      expect(result.current.hasFeature('ai.voice')).toBe(true);
    });

    it('empresa_plus — has subcontratas and mayoristas', () => {
      mockUseSession.mockReturnValue(makeSession('empresa_plus'));
      const { result } = renderHook(() => useSubscription());
      expect(result.current.hasFeature('subcontratas')).toBe(true);
      expect(result.current.hasFeature('mayoristas')).toBe(true);
    });

    it('empresa — no subcontratas (empresa_plus only)', () => {
      mockUseSession.mockReturnValue(makeSession('empresa'));
      const { result } = renderHook(() => useSubscription());
      expect(result.current.hasFeature('subcontratas')).toBe(false);
    });

    it('unknown feature — returns true (no restriction)', () => {
      mockUseSession.mockReturnValue(makeSession('basico'));
      const { result } = renderHook(() => useSubscription());
      expect(result.current.hasFeature('nonexistent.feature')).toBe(true);
    });
  });
});
