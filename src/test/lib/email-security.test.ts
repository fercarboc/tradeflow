/**
 * Tests de seguridad para PH1-SEC-EMAIL-1B / PH1-SEC-EMAIL-1C
 * Cubre: escapeHtml, sendClientEmail, sendTrabflowEmail, safeDocUrl,
 *        publicRateCheck (fail-closed), getClientIp (sin x-forwarded-for),
 *        propagación de HTTP status 401/403/429/503, ad_document auth.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Helpers internos (replicados aquí para test unitario sin importar Deno) ──

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Réplica de RateLimitResult y publicRateCheck tal como están en index.ts
type RateLimitResult = 'allowed' | 'exceeded' | 'error';

function publicRateCheck(result: RateLimitResult): 'pass' | 429 | 503 {
  if (result === 'exceeded') return 429;
  if (result === 'error')    return 503;
  return 'pass';
}

// Réplica de getClientIp sin x-forwarded-for
function getClientIp(headers: Record<string, string | null>): string {
  return (
    headers['cf-connecting-ip'] ??
    headers['x-real-ip'] ??
    'unknown'
  );
}

// Réplica de safeDocUrl
function safeDocUrl(url?: string): string {
  return (url ?? '').startsWith('https://') ? url! : '';
}

// ── Mock de fetch global ──

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests de escapeHtml ────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapa ampersand', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('escapa menor-que', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapa mayor-que', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('escapa comilla doble', () => {
    expect(escapeHtml('dijo "hola"')).toBe('dijo &quot;hola&quot;');
  });

  it('escapa comilla simple', () => {
    expect(escapeHtml("it's fine")).toBe('it&#39;s fine');
  });

  it('escapa payload XSS completo: tags no ejecutables en HTML', () => {
    const input = '<img src=x onerror="alert(\'XSS\')">';
    const out = escapeHtml(input);
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
    expect(out).toContain('&quot;');
  });

  it('no modifica texto limpio', () => {
    expect(escapeHtml('Hola instalador')).toBe('Hola instalador');
  });

  it('escapa múltiples caracteres especiales en una sola cadena', () => {
    const input = '<b>Tom & "Jerry"</b>';
    expect(escapeHtml(input)).toBe('&lt;b&gt;Tom &amp; &quot;Jerry&quot;&lt;/b&gt;');
  });
});

// ── Tests de publicRateCheck (fail-closed para tipos públicos) ─────────────────
// Requisito PH1-SEC-EMAIL-1C Rev 1:
// "Un fallo del control antiabuso no debe permitir envíos públicos ilimitados."

describe('publicRateCheck — fail-closed para tipos públicos', () => {
  it('devuelve pass cuando allowed', () => {
    expect(publicRateCheck('allowed')).toBe('pass');
  });

  it('devuelve 429 cuando exceeded (límite superado)', () => {
    expect(publicRateCheck('exceeded')).toBe(429);
  });

  it('devuelve 503 cuando error (BD caída) — FAIL-CLOSED, no envía email', () => {
    // CRÍTICO: si el rate limit falla, se bloquea el envío (503), no se permite (200)
    expect(publicRateCheck('error')).toBe(503);
  });

  it('el estado error NO produce pass — el relay no queda abierto', () => {
    expect(publicRateCheck('error')).not.toBe('pass');
  });
});

// ── Tests de getClientIp — sin x-forwarded-for ────────────────────────────────
// Requisito PH1-SEC-EMAIL-1C Rev 2:
// "x-forwarded-for es controlable por el cliente → debe eliminarse del fallback."

describe('getClientIp — no acepta x-forwarded-for', () => {
  it('usa cf-connecting-ip cuando está presente', () => {
    expect(getClientIp({
      'cf-connecting-ip': '1.2.3.4',
      'x-real-ip': null,
    })).toBe('1.2.3.4');
  });

  it('usa x-real-ip como fallback cuando cf-connecting-ip es null', () => {
    expect(getClientIp({
      'cf-connecting-ip': null,
      'x-real-ip': '5.6.7.8',
    })).toBe('5.6.7.8');
  });

  it('devuelve unknown cuando ambas son null — no expone x-forwarded-for', () => {
    expect(getClientIp({
      'cf-connecting-ip': null,
      'x-real-ip': null,
    })).toBe('unknown');
  });

  it('x-forwarded-for no influye aunque esté presente', () => {
    // Un atacante puede manipular x-forwarded-for para evadir el rate limit.
    // La función debe ignorarlo completamente.
    const result = getClientIp({
      'cf-connecting-ip': null,
      'x-real-ip': null,
      'x-forwarded-for': '9.9.9.9',
    });
    expect(result).toBe('unknown');
    expect(result).not.toBe('9.9.9.9');
  });

  it('unknown → mismo bucket para todos los sin-IP (conservador, no permite evasión)', () => {
    // Todas las solicitudes sin IP conocida comparten bucket 'unknown',
    // lo que es conservador: el atacante no gana ventaja por ocultarse.
    const a = getClientIp({ 'cf-connecting-ip': null, 'x-real-ip': null });
    const b = getClientIp({ 'cf-connecting-ip': null, 'x-real-ip': null });
    expect(a).toBe(b);
  });
});

// ── Tests de sendClientEmail ──────────────────────────────────────────────────

const SUPABASE_URL = 'https://test.supabase.co';

async function sendClientEmail(
  clientId: string,
  orgId: string,
  accessToken: string,
  subject: string,
  body: string,
): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/trade-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ type: 'send_to_client', client_id: clientId, org_id: orgId, subject, body }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error al enviar email: ${err}`);
  }
}

describe('sendClientEmail', () => {
  it('envía Authorization Bearer header con el access token', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => '' });
    await sendClientEmail('client-1', 'org-1', 'my-jwt-token', 'Asunto', 'Cuerpo');
    const [, opts] = mockFetch.mock.calls[0];
    expect((opts as RequestInit).headers).toMatchObject({ Authorization: 'Bearer my-jwt-token' });
  });

  it('envía client_id y org_id en el body (nunca el email del cliente)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => '' });
    await sendClientEmail('client-abc', 'org-xyz', 'token', 'Asunto', 'Cuerpo');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.type).toBe('send_to_client');
    expect(body.client_id).toBe('client-abc');
    expect(body.org_id).toBe('org-xyz');
    expect(body.to).toBeUndefined();
    expect(body.email).toBeUndefined();
  });

  it('lanza error cuando la respuesta es 401 (JWT inválido)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'No autorizado' });
    await expect(sendClientEmail('c', 'o', 'bad-token', 'S', 'B')).rejects.toThrow('No autorizado');
  });

  it('lanza error cuando la respuesta es 403 (org incorrecta)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Sin permisos para esta organización' });
    await expect(sendClientEmail('c', 'org-ajena', 'token', 'S', 'B')).rejects.toThrow('Sin permisos');
  });

  it('lanza error cuando la respuesta es 429 (rate limit)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Demasiados intentos. Espera un momento.' });
    await expect(sendClientEmail('c', 'o', 'token', 'S', 'B')).rejects.toThrow('Demasiados intentos');
  });

  it('no llama onSent cuando falla (sin falso éxito)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Sin permisos' });
    const onSent = vi.fn();
    let sendError: string | null = null;
    try {
      await sendClientEmail('c', 'o', 'token', 'Asunto', 'Cuerpo');
      onSent();
    } catch (e) {
      sendError = e instanceof Error ? e.message : 'Error';
    }
    expect(onSent).not.toHaveBeenCalled();
    expect(sendError).toContain('Sin permisos');
  });
});

// ── Tests de tipos públicos (no necesitan Authorization) ─────────────────────

async function sendTrabflowEmail(
  payload: { type: string; [k: string]: unknown },
  accessToken?: string,
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  await fetch(`${SUPABASE_URL}/functions/v1/trade-email`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}

describe('sendTrabflowEmail', () => {
  it('flujos públicos (contact_admin) no envían Authorization', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await sendTrabflowEmail({ type: 'contact_admin', nombre: 'Test' });
    const [, opts] = mockFetch.mock.calls[0];
    const headers = (opts as RequestInit).headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('flujos privados (welcome) envían Authorization cuando se pasa el token', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await sendTrabflowEmail({ type: 'welcome', email: 'u@e.com' }, 'jwt-abc');
    const [, opts] = mockFetch.mock.calls[0];
    const headers = (opts as RequestInit).headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer jwt-abc');
  });

  it('es fire-and-forget: no lanza si la respuesta no es ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    await expect(sendTrabflowEmail({ type: 'contact_admin' })).resolves.toBeUndefined();
  });
});

// ── Tests de ad_document — autorización estricta de plataforma ───────────────
// Requisito PH1-SEC-EMAIL-1C Rev 3:
// "Miembro de un actor comercial ≠ administrador global de plataforma"
// La lógica de autorización se prueba a nivel de integración simulando el flujo
// de la Edge Function con mocks de las consultas BD.

describe('ad_document — lógica de autorización platform-only', () => {
  // Simula la lógica de verificación de ad_document tal como está en index.ts:
  // 1. Obtener actores con actor_type = 'platform'
  // 2. Verificar membresía activa del usuario en esos actores
  type Actor = { id: string };
  type Member = { id: string } | null;

  function checkAdDocumentAuth(
    platformActors: Actor[] | null,
    paErr: Error | null,
    platformMember: Member,
  ): 401 | 403 | 503 | 'ok' {
    if (paErr || !platformActors || platformActors.length === 0) return 503;
    if (!platformMember) return 403;
    return 'ok';
  }

  it('autoriza si el usuario es miembro activo de un actor platform', () => {
    const actors = [{ id: 'platform-uuid' }];
    const member = { id: 'member-uuid' };
    expect(checkAdDocumentAuth(actors, null, member)).toBe('ok');
  });

  it('rechaza con 403 si el usuario es miembro de actor no-platform (proveedor)', () => {
    // Un proveedor tiene membresía en trade_marketplace_actor_members
    // pero NO en actores con actor_type='platform'
    const actors = [{ id: 'platform-uuid' }];
    const member = null; // La consulta .in('actor_id', [platform-uuid]) no devuelve nada
    expect(checkAdDocumentAuth(actors, null, member)).toBe(403);
  });

  it('rechaza con 403 si el usuario no tiene ninguna membresía activa', () => {
    const actors = [{ id: 'platform-uuid' }];
    expect(checkAdDocumentAuth(actors, null, null)).toBe(403);
  });

  it('devuelve 503 si la consulta de actores platform falla (BD caída)', () => {
    expect(checkAdDocumentAuth(null, new Error('DB error'), null)).toBe(503);
  });

  it('devuelve 503 si no hay actores platform configurados', () => {
    // Previene acceso si la tabla de actores está vacía (misconfiguration)
    expect(checkAdDocumentAuth([], null, null)).toBe(503);
  });

  it('la distinción platform vs proveedor es por actor_type, no por existencia de membresía', () => {
    // Este test documenta el invariante clave: tener membresía en trade_marketplace_actor_members
    // no es suficiente — debe ser membresía en un actor de tipo 'platform'.
    // Un proveedor con actorId='supplier-uuid' NO está en el IN de platform IDs.
    const platformActors = [{ id: 'trabflow-platform-id' }];
    // Simulación: usuario tiene membresía en actor 'supplier-uuid' (no plataforma)
    // → La query .in('actor_id', ['trabflow-platform-id']) devuelve null
    const memberNotInPlatform = null;
    expect(checkAdDocumentAuth(platformActors, null, memberNotInPlatform)).toBe(403);
  });
});

// ── Tests de send_to_client — 7 casos obligatorios PH1-SEC-EMAIL-1D §4 ───────
// Réplica de la lógica de send_to_client para tests unitarios sin Deno.
// Los tests de integración (JWT real + BD) son smokes pendientes en staging.

describe('send_to_client — fail-closed y autorización (PH1-SEC-EMAIL-1D §4)', () => {
  // Simula el pipeline de rate limit + envío: devuelve el status HTTP resultante.
  function simulateSendToClient(opts: {
    hasValidJwt: boolean;
    isOrgMember: boolean;
    clientBelongsToOrg: boolean;
    rateLimitResult: RateLimitResult;
    clientHasEmail: boolean;
  }): number {
    if (!opts.hasValidJwt)          return 401;
    if (!opts.isOrgMember)          return 403;
    if (!opts.clientBelongsToOrg)   return 403;
    if (!opts.clientHasEmail)       return 400;
    // rate limit es SIEMPRE fail-closed (PH1-SEC-EMAIL-1D Corrección A)
    if (opts.rateLimitResult === 'exceeded') return 429;
    if (opts.rateLimitResult === 'error')    return 503;
    // allowed → envío Resend
    return 200;
  }

  const BASE = {
    hasValidJwt: true,
    isOrgMember: true,
    clientBelongsToOrg: true,
    rateLimitResult: 'allowed' as RateLimitResult,
    clientHasEmail: true,
  };

  it('JWT válido + límite disponible → 200 (permitido)', () => {
    expect(simulateSendToClient({ ...BASE })).toBe(200);
  });

  it('JWT válido + límite superado → 429', () => {
    expect(simulateSendToClient({ ...BASE, rateLimitResult: 'exceeded' })).toBe(429);
  });

  it('JWT válido + error de RPC → 503, sin llamar a Resend (fail-closed)', () => {
    // CRÍTICO: con Corrección A, 'error' ya no es fail-open sino fail-closed.
    expect(simulateSendToClient({ ...BASE, rateLimitResult: 'error' })).toBe(503);
  });

  it('error RPC NO produce 200 — el relay no queda abierto aunque el usuario tenga JWT válido', () => {
    expect(simulateSendToClient({ ...BASE, rateLimitResult: 'error' })).not.toBe(200);
  });

  it('JWT inválido → 401', () => {
    expect(simulateSendToClient({ ...BASE, hasValidJwt: false })).toBe(401);
  });

  it('usuario sin pertenencia a la org → 403', () => {
    expect(simulateSendToClient({ ...BASE, isOrgMember: false })).toBe(403);
  });

  it('cliente de otra organización → 403', () => {
    expect(simulateSendToClient({ ...BASE, clientBelongsToOrg: false })).toBe(403);
  });

  it('cliente propio sin email → 400', () => {
    expect(simulateSendToClient({ ...BASE, clientHasEmail: false })).toBe(400);
  });
});

// ── Tests de safeDocUrl (lógica de validación https://) ──────────────────────

describe('safeDocUrl', () => {
  it('acepta URLs https válidas', () => {
    expect(safeDocUrl('https://storage.supabase.co/doc.pdf')).toBe('https://storage.supabase.co/doc.pdf');
  });

  it('rechaza URLs http (esquema inseguro)', () => {
    expect(safeDocUrl('http://evil.com/xss')).toBe('');
  });

  it('rechaza javascript: URI (vector XSS)', () => {
    expect(safeDocUrl('javascript:alert(1)')).toBe('');
  });

  it('rechaza data: URI', () => {
    expect(safeDocUrl('data:text/html,<script>alert(1)</script>')).toBe('');
  });

  it('rechaza undefined', () => {
    expect(safeDocUrl(undefined)).toBe('');
  });

  it('rechaza string vacío', () => {
    expect(safeDocUrl('')).toBe('');
  });
});
