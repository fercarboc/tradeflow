import { describe, it, expect } from 'vitest';
import { ActivePage } from '../../types';

// We test the pure mapping functions extracted from App.tsx logic
// These match the PAGE_PATHS mapping in App.tsx

const PAGE_PATHS: Partial<Record<ActivePage, string>> = {
  [ActivePage.Home]:              '/',
  [ActivePage.ComoFunciona]:      '/como-funciona',
  [ActivePage.Precios]:           '/precios',
  [ActivePage.Contacto]:          '/contacto',
  [ActivePage.AvisoLegal]:        '/aviso-legal',
  [ActivePage.Privacidad]:        '/privacidad',
  [ActivePage.Cookies]:           '/cookies',
  [ActivePage.Terminos]:          '/terminos',
  [ActivePage.Beta]:              '/beta',
  [ActivePage.IADisclaimer]:      '/ia-disclaimer',
  [ActivePage.AppDashboard]:      '/app',
  [ActivePage.Registro]:          '/registro',
  [ActivePage.Demo]:              '/demo',
  [ActivePage.AsisTecnico]:       '/asistente-tecnico',
  [ActivePage.Admin]:             '/admin',
  [ActivePage.Worker]:            '/worker',
  [ActivePage.Login]:             '/login',
  [ActivePage.AuthActivate]:      '/auth/activate',
  [ActivePage.AuthCallback]:      '/auth/callback',
  [ActivePage.AuthResetPassword]: '/auth/reset-password',
  [ActivePage.UpdatePassword]:    '/update-password',
  [ActivePage.PartnerDemo]:       '/demo-socios',
};

function pageToPath(page: ActivePage): string {
  return PAGE_PATHS[page] ?? '/';
}

function pathToPage(path: string): ActivePage | null {
  for (const [page, p] of Object.entries(PAGE_PATHS) as [ActivePage, string][]) {
    if (p === path) return page;
  }
  return null;
}

describe('URL sync mapping', () => {
  describe('pageToPath', () => {
    it('maps AppDashboard to /app', () => {
      expect(pageToPath(ActivePage.AppDashboard)).toBe('/app');
    });

    it('maps Home to /', () => {
      expect(pageToPath(ActivePage.Home)).toBe('/');
    });

    it('maps Admin to /admin', () => {
      expect(pageToPath(ActivePage.Admin)).toBe('/admin');
    });

    it('maps auth flow pages to their paths', () => {
      expect(pageToPath(ActivePage.Login)).toBe('/login');
      expect(pageToPath(ActivePage.AuthCallback)).toBe('/auth/callback');
      expect(pageToPath(ActivePage.UpdatePassword)).toBe('/update-password');
    });

    it('returns / for unmapped pages', () => {
      expect(pageToPath(ActivePage.QuoteAccept)).toBe('/');
      expect(pageToPath(ActivePage.InvoiceView)).toBe('/');
    });
  });

  describe('pathToPage (reverse mapping)', () => {
    it('maps /app back to AppDashboard', () => {
      expect(pathToPage('/app')).toBe(ActivePage.AppDashboard);
    });

    it('maps / back to Home', () => {
      expect(pathToPage('/')).toBe(ActivePage.Home);
    });

    it('maps /login back to Login', () => {
      expect(pathToPage('/login')).toBe(ActivePage.Login);
    });

    it('returns null for unknown paths', () => {
      expect(pathToPage('/unknown')).toBeNull();
      expect(pathToPage('/p/sometoken')).toBeNull();
    });
  });

  describe('round-trip', () => {
    it('pageToPath → pathToPage is identity for all mapped pages', () => {
      for (const [page] of Object.entries(PAGE_PATHS) as [ActivePage, string][]) {
        const path = pageToPath(page);
        const back = pathToPage(path);
        expect(back).toBe(page);
      }
    });
  });
});
