import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions } from '../../hooks/usePermissions';
import { useSession } from '../../context/SessionContext';
import { ROL_PERMISOS } from '../../context/SessionContext';

vi.mock('../../context/SessionContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../context/SessionContext')>();
  return {
    ...actual,
    useSession: vi.fn(),
  };
});

const mockUseSession = vi.mocked(useSession);

function makeSession(rol: string, permisos: string[], plan = 'basico') {
  return {
    user: null, org: null, subscription: null,
    plan: plan as never,
    rol: rol as never,
    permisos,
    workerProfile: null,
    isLoading: false,
    refreshSubscription: vi.fn(),
  };
}

describe('usePermissions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('owner — can do everything', () => {
    const permisos = ROL_PERMISOS.owner;
    mockUseSession.mockReturnValue(makeSession('owner', permisos));
    const { result } = renderHook(() => usePermissions());

    expect(result.current.can('quotes.create')).toBe(true);
    expect(result.current.can('settings.manage')).toBe(true);
    expect(result.current.can('subscription.manage')).toBe(true);
    expect(result.current.can('team.manage')).toBe(true);
  });

  it('tecnico — only jobs and field_notes', () => {
    const permisos = ROL_PERMISOS.tecnico;
    mockUseSession.mockReturnValue(makeSession('tecnico', permisos));
    const { result } = renderHook(() => usePermissions());

    expect(result.current.can('jobs.view')).toBe(true);
    expect(result.current.can('jobs.manage')).toBe(true);
    expect(result.current.can('field_notes.create')).toBe(true);
    expect(result.current.can('quotes.create')).toBe(false);
    expect(result.current.can('invoices.create')).toBe(false);
    expect(result.current.can('settings.manage')).toBe(false);
  });

  it('visualizador — only jobs.view', () => {
    const permisos = ROL_PERMISOS.visualizador;
    mockUseSession.mockReturnValue(makeSession('visualizador', permisos));
    const { result } = renderHook(() => usePermissions());

    expect(result.current.can('jobs.view')).toBe(true);
    expect(result.current.can('jobs.manage')).toBe(false);
    expect(result.current.can('quotes.create')).toBe(false);
  });

  it('comercial — quotes + clients only', () => {
    const permisos = ROL_PERMISOS.comercial;
    mockUseSession.mockReturnValue(makeSession('comercial', permisos));
    const { result } = renderHook(() => usePermissions());

    expect(result.current.can('quotes.create')).toBe(true);
    expect(result.current.can('clients.manage')).toBe(true);
    expect(result.current.can('invoices.create')).toBe(false);
    expect(result.current.can('team.manage')).toBe(false);
  });

  it('returns rol and plan from session', () => {
    mockUseSession.mockReturnValue(makeSession('admin', ROL_PERMISOS.admin, 'empresa_plus'));
    const { result } = renderHook(() => usePermissions());
    expect(result.current.rol).toBe('admin');
    expect(result.current.plan).toBe('empresa_plus');
  });

  it('unknown permission — returns false', () => {
    mockUseSession.mockReturnValue(makeSession('owner', ROL_PERMISOS.owner));
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can('nonexistent.permission')).toBe(false);
  });
});
