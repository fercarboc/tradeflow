/**
 * PH0-TX-HEADER-COMPACT-1 — Verificación estructural de la segunda barra
 *
 * Confirma que el contenedor responsable de la barra global de sección
 * (TrabFlow AI Operating System / TRANSPORTE · ...) no se renderiza para
 * las pantallas de Transporte, tal como requiere la spec.
 *
 * Estrategia: análisis estático del código fuente de AppDashboardView.
 * No se mockea Supabase ni se monta el DOM.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../..');
const dashSrc = readFileSync(
  resolve(ROOT, 'src/components/AppDashboardView.tsx'),
  'utf-8',
);

describe('PH0-TX-HEADER-COMPACT-1 — second header bar suppressed for Transporte', () => {
  it('header section is guarded by !activeTab.startsWith("transporte")', () => {
    // The outer condition must exist and appear before the header div
    expect(dashSrc).toContain('!activeTab.startsWith(\'transporte\')');
  });

  it('TrabFlow AI Operating System label is inside the guarded block', () => {
    const condIdx = dashSrc.indexOf('!activeTab.startsWith(\'transporte\')');
    const aiOsIdx = dashSrc.indexOf('TrabFlow AI Operating System');
    // Guard appears before the label in the file
    expect(condIdx).toBeGreaterThan(0);
    expect(aiOsIdx).toBeGreaterThan(condIdx);
  });

  it('TRANSPORTE · titles are removed from the header h2', () => {
    expect(dashSrc).not.toContain('Transporte · Servicios');
    expect(dashSrc).not.toContain('Transporte · Agenda Semanal');
    expect(dashSrc).not.toContain('Transporte · Flota de Vehículos');
    expect(dashSrc).not.toContain('Transporte · Conductores');
    expect(dashSrc).not.toContain('Transporte · Rutas');
    expect(dashSrc).not.toContain('Transporte · Parte de Servicio');
    expect(dashSrc).not.toContain('Transporte · Histórico de Partes');
    expect(dashSrc).not.toContain('Transporte · Tarifas y Costes');
    expect(dashSrc).not.toContain('Transporte · Presupuestos');
  });

  it('Módulo de Transporte ticker is removed', () => {
    expect(dashSrc).not.toContain('Módulo de Transporte');
  });

  it('Oficios header titles are preserved', () => {
    expect(dashSrc).toContain('Panel de Control');
    expect(dashSrc).toContain('Presupuestos');
    expect(dashSrc).toContain('Clientes CRM');
    expect(dashSrc).toContain('Planificación');
  });
});
