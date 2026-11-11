import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExpressQuoteList } from '../../components/quick/ExpressQuote';
import type { Presupuesto } from '../../types';

const q = (id: string, estado: Presupuesto['estado'], nombre: string): Presupuesto => ({
  id, nombreCliente: nombre, descripcion: 'Trabajo ' + id, partidas: [], total: 100, iva_pct: 21, fecha: '2026-11-01', estado,
});

const quotes = [q('P-1', 'Borrador', 'Ana'), q('P-2', 'Enviado', 'Luis'), q('P-3', 'Enviado', 'Marta'), q('P-4', 'Aceptado', 'Pedro')];
const tracking = { 'P-3': { viewedAt: '2026-11-05T09:00:00Z', status: 'pending' as const } };

function setup(filter: Parameters<typeof ExpressQuoteList>[0]['filter'] = 'todos') {
  const onAction = vi.fn();
  const onFilter = vi.fn();
  render(
    <ExpressQuoteList quotes={quotes} tracking={tracking} filter={filter} onFilter={onFilter}
      search="" onSearch={() => {}} onOpen={() => {}} onAction={onAction} onNew={() => {}} />,
  );
  return { onAction, onFilter };
}

describe('ExpressQuoteList', () => {
  it('muestra la siguiente acción según el estado', () => {
    const { onAction } = setup();
    expect(screen.getAllByTestId('quote-row')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: /Facturar/ }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'P-4' }), 'facturar');
    fireEvent.click(screen.getByRole('button', { name: /^Enviar$/ }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'P-1' }), 'enviar');
  });

  it('filtra «Visto» con los enlaces abiertos por el cliente', () => {
    setup('visto');
    const rows = screen.getAllByTestId('quote-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Marta');
  });

  it('cuenta presupuestos por estado en los filtros', () => {
    const { onFilter } = setup();
    const enviado = screen.getByRole('tab', { name: /Enviado/ });
    expect(enviado).toHaveTextContent('1');
    fireEvent.click(enviado);
    expect(onFilter).toHaveBeenCalledWith('enviado');
  });
});
