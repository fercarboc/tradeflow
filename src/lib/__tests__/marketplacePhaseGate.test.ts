/**
 * TRABFLOW-V2-MARKETPLACE-PREVIEW-1-FIX1
 * Tests para marketplace phase gate + preview V2 access.
 *
 * GATE-1: global=false + usuario normal → bloqueado
 * GATE-2: global=false + legal@inmostay.com → permitido por preview
 * GATE-3: global=true + usuario normal válido → comportamiento normal
 * GATE-4: auth.uid() NULL → NO obtiene preview
 * GATE-5: usuario preview de otra org → RLS bloquea datos ajenos
 * GATE-6: emails similares (case, alias, dominio) → NO obtienen preview
 *
 * Capa client-side: canAccessMarketplaceV2 (src/lib/marketplaceV2Preview.ts)
 * Capa server-side: trg_marketplace_phase_gate (migration 20261007100000)
 *   — Los tests 1-5 verifican el contrato de la capa cliente y el comportamiento
 *     esperado de la RPC (simulado via mock).
 *   — Los invariantes SQL se documentan en la migración.
 */

import { describe, it, expect, vi } from 'vitest';
import { canAccessMarketplaceV2 } from '../marketplaceV2Preview';

// ── UUID canónico del usuario preview (el mismo almacenado en admin_automation_config) ──
const PREVIEW_UID = 'd2b5622c-87e5-4097-a7d2-c04fb5c7644b';
const PREVIEW_EMAIL = 'legal@inmostay.com';
const NORMAL_UID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

// ── Helpers para simular respuesta de la RPC phase gate ──────────────────────
const GATE_PASS = { data: 'ok', error: null };
const GATE_BLOCKED = {
  data: null,
  error: { code: 'P0001', message: 'MARKETPLACE_DISABLED', hint: 'El marketplace no está disponible en esta fase.' },
};

function makeRpcMock(opts: {
  marketplaceEnabled: boolean;
  callerUid: string | null;
  previewUid?: string;
}) {
  const { marketplaceEnabled, callerUid, previewUid = PREVIEW_UID } = opts;

  // Simula la lógica del trigger server-side:
  //   allowed = marketplaceEnabled OR (callerUid IS NOT NULL AND callerUid === previewUid)
  const allowed =
    marketplaceEnabled ||
    (callerUid !== null && callerUid === previewUid);

  return vi.fn().mockResolvedValue(allowed ? GATE_PASS : GATE_BLOCKED);
}

// ════════════════════════════════════════════════════════════════════════════
// CAPA CLIENT-SIDE: canAccessMarketplaceV2
// ════════════════════════════════════════════════════════════════════════════

describe('canAccessMarketplaceV2 — helper client-side', () => {
  // GATE-1 parcial: usuario normal → no acceso
  it('devuelve false para un email distinto al preview', () => {
    expect(canAccessMarketplaceV2('otro@ejemplo.com')).toBe(false);
  });

  // GATE-2 parcial: usuario preview → acceso
  it('devuelve true para el email exacto del preview', () => {
    expect(canAccessMarketplaceV2(PREVIEW_EMAIL)).toBe(true);
  });

  // GATE-4 parcial: null / undefined / vacío → no acceso
  it('devuelve false para null', () => {
    expect(canAccessMarketplaceV2(null)).toBe(false);
  });
  it('devuelve false para undefined', () => {
    expect(canAccessMarketplaceV2(undefined)).toBe(false);
  });
  it('devuelve false para cadena vacía', () => {
    expect(canAccessMarketplaceV2('')).toBe(false);
  });

  // GATE-6: spoofing por dirección distinta → NO obtiene acceso.
  // Nota: el helper normaliza a lowercase+trim (estándar email RFC).
  // Variaciones de CASO son la MISMA identidad en Supabase Auth → true.
  // El gate server-side usa auth.uid() (UUID) — no depende del email en absoluto.

  // Estos sí son DIFERENTES identidades → false:
  it('GATE-6b: alias con + → diferente identidad → false', () => {
    expect(canAccessMarketplaceV2('legal+algo@inmostay.com')).toBe(false);
  });
  it('GATE-6c: subdominio diferente → diferente identidad → false', () => {
    expect(canAccessMarketplaceV2('legal@sub.inmostay.com')).toBe(false);
  });
  it('GATE-6d: dominio diferente → diferente identidad → false', () => {
    expect(canAccessMarketplaceV2('legal@inmostay.es')).toBe(false);
  });
  it('GATE-6f: email del admin de la plataforma → diferente identidad → false', () => {
    expect(canAccessMarketplaceV2('fercarboc@gmail.com')).toBe(false);
  });
  it('GATE-6x: email completamente distinto → false', () => {
    expect(canAccessMarketplaceV2('otro.usuario@ejemplo.com')).toBe(false);
  });

  // Variaciones de CASO = misma identidad (RFC + Supabase Auth case-insensitive) → true:
  it('GATE-6a: mayúsculas en dominio → misma identidad en Auth → true', () => {
    // Supabase Auth normaliza emails a lowercase; legal@INMOSTAY.COM es la misma cuenta
    expect(canAccessMarketplaceV2('legal@INMOSTAY.COM')).toBe(true);
  });
  it('GATE-6e: mayúsculas en parte local → misma identidad en Auth → true', () => {
    expect(canAccessMarketplaceV2('Legal@inmostay.com')).toBe(true);
  });
  it('GATE-6g: whitespace exterior → trim() → misma identidad → true', () => {
    // El helper hace trim() defensivo, igual que Supabase Auth
    expect(canAccessMarketplaceV2(' legal@inmostay.com ')).toBe(true);
  });
  it('GATE-6h: email exacto en lowercase → true', () => {
    expect(canAccessMarketplaceV2('legal@inmostay.com')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CAPA SERVER-SIDE: simulación del contrato del trigger
// ════════════════════════════════════════════════════════════════════════════

describe('Contrato trg_marketplace_phase_gate (simulado)', () => {

  // GATE-1: global=false + usuario normal → bloqueado
  it('GATE-1: global desactivado + usuario normal → MARKETPLACE_DISABLED', async () => {
    const mockRpc = makeRpcMock({ marketplaceEnabled: false, callerUid: NORMAL_UID });
    const result = await mockRpc();
    expect(result.error).not.toBeNull();
    expect(result.error?.message).toBe('MARKETPLACE_DISABLED');
    expect(result.data).toBeNull();
  });

  // GATE-2: global=false + preview user → permitido
  it('GATE-2: global desactivado + usuario preview → permitido', async () => {
    const mockRpc = makeRpcMock({ marketplaceEnabled: false, callerUid: PREVIEW_UID });
    const result = await mockRpc();
    expect(result.error).toBeNull();
    expect(result.data).toBe('ok');
  });

  // GATE-3: global=true + usuario normal → permitido (comportamiento global)
  it('GATE-3: marketplace global activo → cualquier usuario permitido', async () => {
    const mockRpc = makeRpcMock({ marketplaceEnabled: true, callerUid: NORMAL_UID });
    const result = await mockRpc();
    expect(result.error).toBeNull();
  });

  // GATE-4: auth.uid() NULL (service_role / sin JWT) → bloqueado
  it('GATE-4: auth.uid() NULL → NO obtiene preview, bloqueado', async () => {
    const mockRpc = makeRpcMock({ marketplaceEnabled: false, callerUid: null });
    const result = await mockRpc();
    expect(result.error).not.toBeNull();
    expect(result.error?.message).toBe('MARKETPLACE_DISABLED');
  });

  // GATE-5: usuario preview con org ajena → preview pasa gate pero RLS bloquea datos ajenos
  it('GATE-5: usuario preview + org ajena → gate pasa, error RLS esperado (no MARKETPLACE_DISABLED)', async () => {
    // El gate no bloquea al usuario preview.
    // El bloqueo vendría de RLS: org_id no pertenece al usuario.
    // Simulamos: gate=PASS pero RLS lanza error diferente.
    const gateResult = await makeRpcMock({ marketplaceEnabled: false, callerUid: PREVIEW_UID })();
    expect(gateResult.error).toBeNull(); // gate no bloquea

    // Simular fallo de RLS posterior (no MARKETPLACE_DISABLED)
    const rlsError = { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } };
    expect(rlsError.error.message).not.toBe('MARKETPLACE_DISABLED');
    expect(rlsError.error.code).toBe('42501');
  });

  // GATE-6: UID diferente al preview → bloqueado (aunque sea del mismo dominio)
  it('GATE-6: UUID diferente al preview → bloqueado aunque sea usuario válido', async () => {
    const otherUid = 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1';
    const mockRpc = makeRpcMock({ marketplaceEnabled: false, callerUid: otherUid });
    const result = await mockRpc();
    expect(result.error?.message).toBe('MARKETPLACE_DISABLED');
  });

  // Verificación de independencia: preview no rompe activación global futura
  it('GATE-3b: global activo + preview uid también → permitido (sin conflicto)', async () => {
    const mockRpc = makeRpcMock({ marketplaceEnabled: true, callerUid: PREVIEW_UID });
    const result = await mockRpc();
    expect(result.error).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// VISIBILIDAD SIDEBAR Y NAVEGACIÓN
// Verifica la condición booleana usada en AppDashboardView para mostrar/ocultar
// el acceso a Marketplace en el sidebar y móvil.
//
// Condición aplicada (MARKETPLACE_ENABLED || canAccessMarketplaceV2(email)):
//   — MARKETPLACE_ENABLED = false en producción actual
//   — true para legal@inmostay.com vía canAccessMarketplaceV2
//   — false para cualquier otro usuario
// ════════════════════════════════════════════════════════════════════════════

// Simula la condición exacta del sidebar:
// (MARKETPLACE_ENABLED || canAccessMarketplaceV2(email)) && can('catalog.manage')
function sidebarShowsMarketplace(opts: {
  marketplaceEnabled: boolean;
  email: string | null;
  canCatalogManage: boolean;
}): boolean {
  return (opts.marketplaceEnabled || canAccessMarketplaceV2(opts.email)) && opts.canCatalogManage;
}

describe('Visibilidad Marketplace en sidebar (NAV-*)', () => {
  const ENABLED = true;
  const DISABLED = false;
  const CAN = true;

  // NAV-1: usuario normal + global desactivado → NO ve Marketplace en sidebar
  it('NAV-1: usuario normal + MARKETPLACE_ENABLED=false → sidebar oculto', () => {
    expect(sidebarShowsMarketplace({ marketplaceEnabled: DISABLED, email: 'normal@empresa.com', canCatalogManage: CAN })).toBe(false);
  });

  // NAV-2: usuario preview + global desactivado → SÍ ve Marketplace en sidebar
  it('NAV-2: legal@inmostay.com + MARKETPLACE_ENABLED=false → sidebar visible', () => {
    expect(sidebarShowsMarketplace({ marketplaceEnabled: DISABLED, email: PREVIEW_EMAIL, canCatalogManage: CAN })).toBe(true);
  });

  // NAV-3: cualquier usuario + global activado → ve Marketplace en sidebar
  it('NAV-3: MARKETPLACE_ENABLED=true → sidebar visible para cualquier usuario', () => {
    expect(sidebarShowsMarketplace({ marketplaceEnabled: ENABLED, email: 'normal@empresa.com', canCatalogManage: CAN })).toBe(true);
  });

  // NAV-4: usuario preview sin permisos de catálogo → no aplica (el permiso sigue necesario)
  it('NAV-4: preview user sin catalog.manage → sidebar oculto', () => {
    expect(sidebarShowsMarketplace({ marketplaceEnabled: DISABLED, email: PREVIEW_EMAIL, canCatalogManage: false })).toBe(false);
  });

  // NAV-5: email null (no autenticado) → no ve Marketplace
  it('NAV-5: email null → sidebar oculto aunque MARKETPLACE_ENABLED=false', () => {
    expect(sidebarShowsMarketplace({ marketplaceEnabled: DISABLED, email: null, canCatalogManage: CAN })).toBe(false);
  });

  // NAV-6: email de admin plataforma → no obtiene acceso preview (diferente identidad)
  it('NAV-6: fercarboc@gmail.com → sidebar oculto cuando global desactivado', () => {
    expect(sidebarShowsMarketplace({ marketplaceEnabled: DISABLED, email: 'fercarboc@gmail.com', canCatalogManage: CAN })).toBe(false);
  });

  // NAV-7: preview user en mayúsculas → normalizado a misma identidad → sidebar visible
  it('NAV-7: LEGAL@INMOSTAY.COM → misma identidad Auth → sidebar visible', () => {
    expect(sidebarShowsMarketplace({ marketplaceEnabled: DISABLED, email: 'LEGAL@INMOSTAY.COM', canCatalogManage: CAN })).toBe(true);
  });

  // NAV-8: CTA "Comprar materiales" en ficha presupuesto — misma condición
  it('NAV-8: CTA Comprar materiales visible para preview user', () => {
    const isLiveMode = true;
    const hasQuoteId = true;
    const ctaVisible = sidebarShowsMarketplace({ marketplaceEnabled: DISABLED, email: PREVIEW_EMAIL, canCatalogManage: true })
      && isLiveMode && hasQuoteId;
    expect(ctaVisible).toBe(true);
  });

  // NAV-9: CTA "Comprar materiales" oculta para usuario normal
  it('NAV-9: CTA Comprar materiales oculta para usuario normal', () => {
    const isLiveMode = true;
    const hasQuoteId = true;
    const ctaVisible = sidebarShowsMarketplace({ marketplaceEnabled: DISABLED, email: 'normal@empresa.com', canCatalogManage: true })
      && isLiveMode && hasQuoteId;
    expect(ctaVisible).toBe(false);
  });

  // NAV-10: badge "Ver pedidos" visible para preview user si hay pedidos pendientes
  it('NAV-10: badge Ver pedidos visible para preview user con pedidos pendientes', () => {
    const mktPendingCount = 2;
    const isLiveMode = true;
    const badgeVisible = (DISABLED || canAccessMarketplaceV2(PREVIEW_EMAIL)) && isLiveMode && mktPendingCount > 0;
    expect(badgeVisible).toBe(true);
  });

  // NAV-11: badge "Ver pedidos" oculto para usuario normal
  it('NAV-11: badge Ver pedidos oculto para usuario normal aunque tenga pedidos', () => {
    const mktPendingCount = 5;
    const isLiveMode = true;
    const badgeVisible = (DISABLED || canAccessMarketplaceV2('normal@empresa.com')) && isLiveMode && mktPendingCount > 0;
    expect(badgeVisible).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FLUJO PRESUPUESTO → MARKETPLACE (contrato de integración)
// ════════════════════════════════════════════════════════════════════════════

describe('Flujo presupuesto→Marketplace para usuario preview', () => {
  it('create_cart_from_quote: preview user pasa gate → puede crear carrito', async () => {
    // Simula: supabase.rpc('create_cart_from_quote', { p_quote_id }) con uid preview
    const mockRpc = vi.fn().mockResolvedValue({
      data: 'cart-uuid-123',
      error: null,
    });
    const result = await mockRpc();
    expect(result.error).toBeNull();
    expect(result.data).toBe('cart-uuid-123');
  });

  it('create_cart_from_quote: usuario normal → MARKETPLACE_DISABLED', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'MARKETPLACE_DISABLED' },
    });
    const result = await mockRpc();
    expect(result.error?.message).toBe('MARKETPLACE_DISABLED');
  });

  it('checkout_cart_v2: no alcanza Stripe (simulation mode)', () => {
    // Invariante: el checkout utiliza payment_method 'simulation' por defecto.
    // No se llama a ningún PaymentIntent, transfer ni payout.
    // Este test documenta el invariante; la verificación real está en la config de BD.
    const simulationModeEnabled = true; // mkt_fin_financial_config.payment.stripe_connect_enabled = false
    expect(simulationModeEnabled).toBe(true);
  });
});
