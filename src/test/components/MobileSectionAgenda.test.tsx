import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileSectionAgenda from '../../components/MobileSectionAgenda';
import type { TradeJob } from '../../lib/supabase';

vi.mock('../../components/MonthCalendar', () => ({
  default: ({ selectedDate, onDateSelect }: { selectedDate: string; onDateSelect: (d: string) => void }) => (
    <div data-testid="month-calendar" data-selected={selectedDate}>
      <button onClick={() => onDateSelect('2026-11-10')}>SelectDay</button>
    </div>
  ),
}));

function makeJob(overrides: Partial<TradeJob> = {}): TradeJob {
  return {
    id: 'job-1',
    titulo: 'Instalar caldera',
    estado: 'planificado',
    fecha_inicio: '2026-11-08',
    org_id: 'org-1',
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    trade_clients: { nombre: 'Cliente Test', telefono: '' },
    ...overrides,
  } as TradeJob;
}

function renderAgenda(overrides: Partial<Parameters<typeof MobileSectionAgenda>[0]> = {}) {
  const defaults = {
    jobs: [makeJob()],
    selectedDate: '2026-11-08',
    onDateSelect: vi.fn(),
    jobDates: new Set(['2026-11-08']),
    onBack: vi.fn(),
    onJobClick: vi.fn(),
  };
  return render(<MobileSectionAgenda {...defaults} {...overrides} />);
}

describe('MobileSectionAgenda', () => {
  it('renders heading "Agenda mensual"', () => {
    renderAgenda();
    expect(screen.getByText('Agenda mensual')).toBeInTheDocument();
  });

  it('renders MonthCalendar with correct selectedDate', () => {
    renderAgenda({ selectedDate: '2026-11-15' });
    const cal = screen.getByTestId('month-calendar');
    expect(cal.getAttribute('data-selected')).toBe('2026-11-15');
  });

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn();
    renderAgenda({ onBack });
    fireEvent.click(screen.getByText('Volver'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows jobs for selected date', () => {
    renderAgenda();
    expect(screen.getByText('Instalar caldera')).toBeInTheDocument();
  });

  it('calls onJobClick when a job is clicked', () => {
    const onJobClick = vi.fn();
    renderAgenda({ onJobClick });
    fireEvent.click(screen.getByText('Instalar caldera'));
    expect(onJobClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-1' }));
  });

  it('shows empty state when no jobs on selected date', () => {
    renderAgenda({ jobs: [], selectedDate: '2026-11-08' });
    expect(screen.getByText('Sin trabajos este día')).toBeInTheDocument();
  });

  it('calls onDateSelect when calendar emits date change', () => {
    const onDateSelect = vi.fn();
    renderAgenda({ onDateSelect });
    fireEvent.click(screen.getByText('SelectDay'));
    expect(onDateSelect).toHaveBeenCalledWith('2026-11-10');
  });
});
