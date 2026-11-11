import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChangePasswordCard, { passwordProblem } from '../../components/quick/ChangePasswordCard';

describe('passwordProblem', () => {
  it('valida la nueva contraseña', () => {
    expect(passwordProblem('abc', 'abc', 'vieja1234')).toMatch(/8 caracteres/);
    expect(passwordProblem('solamenteletras', 'solamenteletras', 'x')).toMatch(/letras y números/);
    expect(passwordProblem('nueva12345', 'nueva1234', 'x')).toMatch(/no coinciden/);
    expect(passwordProblem('igual12345', 'igual12345', 'igual12345')).toMatch(/distinta/);
    expect(passwordProblem('nueva12345', 'nueva12345', '')).toMatch(/actual/);
    expect(passwordProblem('nueva12345', 'nueva12345', 'vieja12345')).toBeNull();
  });
});

describe('ChangePasswordCard', () => {
  it('muestra el error sin llamar al servidor si no coinciden', () => {
    const toast = vi.fn();
    render(<ChangePasswordCard showToast={toast} isLiveMode={false} />);
    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'vieja12345' } });
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'nueva12345' } });
    fireEvent.change(screen.getByLabelText('Repite la nueva contraseña'), { target: { value: 'otra12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(screen.getByRole('alert')).toHaveTextContent('no coinciden');
    expect(toast).not.toHaveBeenCalled();
  });
});
