/**
 * OperationsHub + ScreenPlanificacion — mobile scroll clearance regression tests
 *
 * Verifies that scroll containers expose correct paddingBottom so content
 * can scroll above the ~88px bottom navigation bar on mobile.
 *
 * REGRESSION: https://github.com/fercarboc/tradeflow/commit/7d01d7c
 * Previously: detail panel paddingBottom = 'calc(env(safe-area-inset-bottom) + 16px)'
 * Fixed:      paddingBottom = 'calc(88px + env(safe-area-inset-bottom, 0px) + 8px)'
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../components/ScreenPlanificacion', () => ({
  default: () => <div data-testid="mock-planificacion" />,
}));

vi.mock('../../components/ScreenRutaDia', () => ({
  default: () => <div data-testid="mock-ruta-dia" />,
}));

vi.mock('../../components/ScreenParteTrabajo', () => ({
  default: () => <div data-testid="mock-parte-trabajo" />,
}));

vi.mock('../../components/ScreenSubcontratas', () => ({
  default: () => <div data-testid="mock-subcontratas" />,
}));

vi.mock('../../components/ScreenValoraciones', () => ({
  default: () => <div data-testid="mock-valoraciones" />,
}));

vi.mock('../../lib/supabase', () => ({
  loadInvoicesByJobId: vi.fn().mockResolvedValue([]),
  checkClientMaintenanceContract: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../lib/routeOptimizer', () => ({
  optimizeRoute: vi.fn().mockReturnValue([]),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

// jsdom normalizes calc() at assignment time:
//   calc(88px + env(safe-area-inset-bottom, 0px) + 8px)
//   → calc(96px + env(0px * , * safe-area-inset-bottom))
// The discriminating invariant is that the value must contain 96px (88+8),
// as opposed to the old insufficient value which contained only 16px.
function hasNavBarClearance(el: HTMLElement): boolean {
  const pb = el.style.paddingBottom;
  // Accepts both the source form and jsdom's normalized form
  return pb.includes('96px') || pb.includes('88px');
}

function makeHubProps() {
  return {
    jobs: [],
    workers: [],
    clientes: [],
    orgId: 'org1',
    isLiveMode: false,
    isDarkMode: false,
    pendingPlanningQuotes: [],
    presupuestosPorId: {},
    tarifas: [],
    startLocation: 'Madrid',
    workerProfileId: null,
    onCreateJob: vi.fn().mockResolvedValue({ id: 'j1' }),
    onUpdateJob: vi.fn().mockResolvedValue(undefined),
    onDeleteJob: vi.fn().mockResolvedValue(undefined),
    onAssignWorker: vi.fn().mockResolvedValue(undefined),
    onRemoveWorker: vi.fn().mockResolvedValue(undefined),
    showToast: vi.fn(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

import OperationsHub from '../../components/OperationsHub';

describe('OperationsHub — mobile scroll clearance', () => {
  it('MOBILE-SCROLL-1 pendientes scroll container has nav-bar bottom clearance', () => {
    render(<OperationsHub {...makeHubProps()} initialSubTab="pendientes" pendingPlanningQuotes={[
      { id: 'q1', dbId: 'q1', nombreCliente: 'Test', descripcion: '', total: 0, client_id: null },
    ]} />);
    const container = screen.getByTestId('hub-pendientes-scroll');
    expect(hasNavBarClearance(container)).toBe(true);
  });

  it('MOBILE-SCROLL-2 partes scroll container has nav-bar bottom clearance', () => {
    render(<OperationsHub {...makeHubProps()} initialSubTab="partes" />);
    const container = screen.getByTestId('hub-partes-scroll');
    expect(hasNavBarClearance(container)).toBe(true);
  });

  it('MOBILE-SCROLL-3 switching to pendientes tab renders scroll container', () => {
    render(<OperationsHub {...makeHubProps()} initialSubTab="agenda" />);
    const pendientesBtn = screen.getByRole('button', { name: /pendientes/i });
    fireEvent.click(pendientesBtn);
    const container = screen.getByTestId('hub-pendientes-scroll');
    expect(container).toBeTruthy();
    expect(hasNavBarClearance(container)).toBe(true);
  });
});
