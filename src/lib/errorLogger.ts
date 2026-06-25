import { supabase } from './supabase';

interface LogErrorOptions {
  userId?: string;
  orgId?: string;
  page?: string;
  context?: Record<string, unknown>;
}

type PendingEntry = [error: unknown, options: LogErrorOptions];

let _queue: PendingEntry[] = [];
let _flushing = false;

export async function logError(
  error: unknown,
  options: LogErrorOptions = {},
): Promise<void> {
  _queue.push([error, options]);
  if (_flushing) return;
  _flushing = true;

  // Micro-task: batch multiple errors queued in the same tick
  await Promise.resolve();

  const batch = _queue.splice(0);
  _flushing = false;

  try {
    await supabase.from('trade_client_errors').insert(
      batch.map(([err, opts]) => ({
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? (err.stack ?? null) : null,
        user_id: opts.userId ?? null,
        org_id: opts.orgId ?? null,
        page: opts.page ?? window.location.pathname,
        url: window.location.href,
        user_agent: navigator.userAgent,
        context: opts.context ?? {},
      })),
    );
  } catch {
    // Never let the logger itself throw
  }
}

export function setupGlobalErrorHandlers(
  getUserContext: () => LogErrorOptions,
): () => void {
  function onError(e: ErrorEvent) {
    logError(e.error ?? new Error(e.message), getUserContext()).catch(() => {});
  }

  function onRejection(e: PromiseRejectionEvent) {
    const err = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
    logError(err, getUserContext()).catch(() => {});
  }

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
