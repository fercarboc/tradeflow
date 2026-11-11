import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScreenMiPagina from '../../components/quick/ScreenMiPagina';

describe('ScreenMiPagina (modo demo)', () => {
  it('propone dirección y preguntas del oficio y permite guardar', () => {
    const toast = vi.fn();
    render(<ScreenMiPagina orgId={null} isLiveMode={false} defaults={{ nombre: 'Pinturas López', oficio: 'Pintor', whatsapp: '600000000' }} showToast={toast} onBack={() => {}} />);
    expect(screen.getByLabelText('Dirección de tu página')).toHaveValue('pinturas-lopez');
    expect(screen.getByDisplayValue('Tipo de pintura')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Añadir servicio/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(toast).toHaveBeenCalledWith('Guardado (modo demo)', 'success');
  });

  it('no deja guardar una dirección no válida', () => {
    const toast = vi.fn();
    render(<ScreenMiPagina orgId={null} isLiveMode={false} defaults={{ nombre: 'AB', oficio: '', whatsapp: '' }} showToast={toast} onBack={() => {}} />);
    fireEvent.change(screen.getByLabelText('Dirección de tu página'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('dirección'), 'error');
  });
});
