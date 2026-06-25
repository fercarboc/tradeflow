import { describe, it, expect } from 'vitest';
import { ROL_PERMISOS } from '../../context/SessionContext';

describe('ROL_PERMISOS', () => {
  it('owner has all critical permissions', () => {
    const p = ROL_PERMISOS.owner;
    expect(p).toContain('quotes.create');
    expect(p).toContain('invoices.manage');
    expect(p).toContain('team.manage');
    expect(p).toContain('settings.manage');
    expect(p).toContain('subscription.manage');
  });

  it('admin cannot manage subscriptions', () => {
    expect(ROL_PERMISOS.admin).not.toContain('subscription.manage');
  });

  it('tecnico cannot create quotes or invoices', () => {
    const p = ROL_PERMISOS.tecnico;
    expect(p).not.toContain('quotes.create');
    expect(p).not.toContain('invoices.create');
    expect(p).not.toContain('settings.manage');
  });

  it('comercial cannot access invoices or jobs', () => {
    const p = ROL_PERMISOS.comercial;
    expect(p).not.toContain('invoices.create');
    expect(p).not.toContain('jobs.manage');
    expect(p).not.toContain('team.manage');
  });

  it('visualizador has only jobs.view', () => {
    expect(ROL_PERMISOS.visualizador).toEqual(['jobs.view']);
  });

  it('all roles have at least one permission', () => {
    for (const [rol, permisos] of Object.entries(ROL_PERMISOS)) {
      expect(permisos.length, `${rol} should have permissions`).toBeGreaterThan(0);
    }
  });

  it('tecnico cannot see other teams work (no clients.manage)', () => {
    expect(ROL_PERMISOS.tecnico).not.toContain('clients.manage');
  });
});
