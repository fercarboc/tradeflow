import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileWorkHub, { type MobileSection } from '../../components/MobileWorkHub';

function renderHub(overrides: Partial<Parameters<typeof MobileWorkHub>[0]> = {}) {
  const defaults = {
    inProgressCount: 0,
    scheduledCount: 0,
    pendingCount: 0,
    onNavigate: vi.fn(),
    selectedDate: '2026-11-08',
  };
  return render(<MobileWorkHub {...defaults} {...overrides} />);
}

describe('MobileWorkHub', () => {
  it('renders heading "Trabajos"', () => {
    renderHub();
    expect(screen.getByText('Trabajos')).toBeInTheDocument();
  });

  it('renders all 6 section cards', () => {
    renderHub();
    expect(screen.getByText('En curso')).toBeInTheDocument();
    expect(screen.getByText('Planificados')).toBeInTheDocument();
    expect(screen.getByText('Ruta del día')).toBeInTheDocument();
    expect(screen.getByText('Pendientes')).toBeInTheDocument();
    expect(screen.getByText('Partes')).toBeInTheDocument();
    expect(screen.getByText('Agenda')).toBeInTheDocument();
  });

  it('calls onNavigate with "en-curso" when that card is clicked', () => {
    const onNavigate = vi.fn();
    renderHub({ onNavigate });
    fireEvent.click(screen.getByText('En curso'));
    expect(onNavigate).toHaveBeenCalledWith('en-curso');
  });

  it('calls onNavigate with "planificados" when that card is clicked', () => {
    const onNavigate = vi.fn();
    renderHub({ onNavigate });
    fireEvent.click(screen.getByText('Planificados'));
    expect(onNavigate).toHaveBeenCalledWith('planificados');
  });

  it('calls onNavigate with "ruta" when that card is clicked', () => {
    const onNavigate = vi.fn();
    renderHub({ onNavigate });
    fireEvent.click(screen.getByText('Ruta del día'));
    expect(onNavigate).toHaveBeenCalledWith('ruta');
  });

  it('calls onNavigate with "pendientes" when that card is clicked', () => {
    const onNavigate = vi.fn();
    renderHub({ onNavigate });
    fireEvent.click(screen.getByText('Pendientes'));
    expect(onNavigate).toHaveBeenCalledWith('pendientes');
  });

  it('calls onNavigate with "partes" when that card is clicked', () => {
    const onNavigate = vi.fn();
    renderHub({ onNavigate });
    fireEvent.click(screen.getByText('Partes'));
    expect(onNavigate).toHaveBeenCalledWith('partes');
  });

  it('calls onNavigate with "agenda" when that card is clicked', () => {
    const onNavigate = vi.fn();
    renderHub({ onNavigate });
    fireEvent.click(screen.getByText('Agenda'));
    expect(onNavigate).toHaveBeenCalledWith('agenda');
  });

  it('shows badge when inProgressCount > 0', () => {
    renderHub({ inProgressCount: 3 });
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does not show badge when inProgressCount is 0', () => {
    renderHub({ inProgressCount: 0 });
    // Badge element for "0" should not be present
    const badges = screen.queryAllByText('0');
    expect(badges.length).toBe(0);
  });

  it('shows singular sublabel when inProgressCount is 1', () => {
    renderHub({ inProgressCount: 1 });
    expect(screen.getByText('1 trabajo activo')).toBeInTheDocument();
  });

  it('shows plural sublabel when inProgressCount is 2', () => {
    renderHub({ inProgressCount: 2 });
    expect(screen.getByText('2 trabajos activos')).toBeInTheDocument();
  });

  it('shows singular presupuesto sublabel when pendingCount is 1', () => {
    renderHub({ pendingCount: 1 });
    expect(screen.getByText('1 presupuesto')).toBeInTheDocument();
  });

  it('shows plural presupuestos sublabel when pendingCount is 3', () => {
    renderHub({ pendingCount: 3 });
    expect(screen.getByText('3 presupuestos')).toBeInTheDocument();
  });

  it('renders a grid with 6 buttons', () => {
    const { container } = renderHub();
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(6);
  });

  it('each card button has active:scale-95 transition class', () => {
    const { container } = renderHub();
    const buttons = container.querySelectorAll('button');
    buttons.forEach(btn => {
      expect(btn.className).toContain('active:scale-95');
    });
  });
});
