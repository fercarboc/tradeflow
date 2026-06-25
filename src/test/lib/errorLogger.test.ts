import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logError, setupGlobalErrorHandlers } from '../../lib/errorLogger';

// vi.hoisted ensures these are defined before vi.mock hoisting
const { mockInsert, mockFrom } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
  return { mockInsert, mockFrom };
});

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

describe('logError', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockInsert.mockClear();
    mockInsert.mockResolvedValue({ data: null, error: null });
  });

  it('logs an Error object to trade_client_errors', async () => {
    const error = new Error('test error');
    await logError(error);

    expect(mockFrom).toHaveBeenCalledWith('trade_client_errors');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'test error',
          stack: expect.stringContaining('test error'),
        }),
      ]),
    );
  });

  it('logs a string error', async () => {
    await logError('something broke');

    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ message: 'something broke', stack: null }),
      ]),
    );
  });

  it('includes userId and orgId when provided', async () => {
    await logError(new Error('auth error'), {
      userId: 'user-123',
      orgId: 'org-456',
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: 'user-123',
          org_id: 'org-456',
        }),
      ]),
    );
  });

  it('batches errors queued in the same tick', async () => {
    const p1 = logError(new Error('err1'));
    const p2 = logError(new Error('err2'));
    const p3 = logError(new Error('err3'));

    await Promise.all([p1, p2, p3]);

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const rows = mockInsert.mock.calls[0][0] as unknown[];
    expect(rows).toHaveLength(3);
  });

  it('never throws even if Supabase insert fails', async () => {
    mockInsert.mockRejectedValueOnce(new Error('DB error'));
    await expect(logError(new Error('test'))).resolves.toBeUndefined();
  });
});

describe('setupGlobalErrorHandlers', () => {
  it('returns a cleanup function that removes listeners', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const cleanup = setupGlobalErrorHandlers(() => ({}));
    expect(addSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

    cleanup();
    expect(removeSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
