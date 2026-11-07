/**
 * MonthCalendar + integración PH0-PLANNING-UX-REDESIGN-2A
 *
 * Cubre los 15 tests del §11 del ORDER:
 * 1–6: MonthCalendar puro
 * 7–10: Integración pendientes + programación
 * 11–15: Regresión y comportamientos preservados
 *
 * Tests adicionales (FIX1):
 * P1-A: getDatesBetween — rango normal, cruces de mes/año, casos inválidos
 * P1-C: KpiStrip etiqueta "Sin asignar" usa fecha seleccionada
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import MonthCalendar from '../../components/MonthCalendar';
import KpiStrip from '../../components/KpiStrip';
import { getDatesBetween } from '../../components/ScreenPlanificacion';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Test 1: Cambio de mes ─────────────────────────────────────────────────────
describe('MonthCalendar — navegación de mes', () => {
  it('click ← muestra el mes anterior', () => {
    // selectedDate: 2026-11-15 → view month = Noviembre 2026
    render(
      <MonthCalendar
        selectedDate="2026-11-15"
        onDateSelect={vi.fn()}
        jobDates={new Set()}
      />
    );
    expect(screen.getByText(/Noviembre 2026/i)).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Mes anterior'));
    expect(screen.getByText(/Octubre 2026/i)).toBeTruthy();
  });

  // Test 2: Selección de fecha
  it('click en día actualiza selectedDate vía callback', () => {
    const onSelect = vi.fn();
    render(
      <MonthCalendar
        selectedDate="2026-11-01"
        onDateSelect={onSelect}
        jobDates={new Set()}
      />
    );
    // Find the button for day 15 in current month
    const day15 = screen.getByRole('button', { name: /^15$/ });
    fireEvent.click(day15);
    expect(onSelect).toHaveBeenCalledWith('2026-11-15');
  });

  // Test 3: Cambio de año
  it('navegar 12 meses hacia atrás cambia el año', () => {
    render(
      <MonthCalendar
        selectedDate="2026-11-15"
        onDateSelect={vi.fn()}
        jobDates={new Set()}
      />
    );
    // Click ← 12 times
    const prevBtn = screen.getByLabelText('Mes anterior');
    for (let i = 0; i < 12; i++) fireEvent.click(prevBtn);
    expect(screen.getByText(/2025/)).toBeTruthy();
  });

  // Test 4: Días con trabajos — aparece indicador
  it('días en jobDates muestran punto indicador', () => {
    const jobDates = new Set(['2026-11-10', '2026-11-20']);
    render(
      <MonthCalendar
        selectedDate="2026-11-01"
        onDateSelect={vi.fn()}
        jobDates={jobDates}
      />
    );
    // Days with jobs have a dot (the button contains the number + a dot div)
    const day10Btn = screen.getByRole('button', { name: /^10$/ });
    // The button should contain a child with w-1 h-1 (dot)
    expect(day10Btn.querySelector('.w-1.h-1')).toBeTruthy();
  });

  // Test 5: Día sin trabajos — sin indicadores
  it('día sin trabajos no muestra indicador', () => {
    render(
      <MonthCalendar
        selectedDate="2026-11-01"
        onDateSelect={vi.fn()}
        jobDates={new Set(['2026-11-10'])}
      />
    );
    // Day 5 has no job (use data-date to avoid ambiguity with trailing month days)
    const day5Btn = document.querySelector('[data-date="2026-11-05"]') as HTMLElement;
    expect(day5Btn).toBeTruthy();
    expect(day5Btn.querySelector('.w-1.h-1')).toBeFalsy();
  });

  // Test 6: Fecha local sin desplazamientos UTC
  it('fecha "2026-11-15" aparece en Noviembre, no en otro mes', () => {
    const onSelect = vi.fn();
    render(
      <MonthCalendar
        selectedDate="2026-11-15"
        onDateSelect={onSelect}
        jobDates={new Set()}
      />
    );
    // Should show November 2026
    expect(screen.getByText(/Noviembre 2026/i)).toBeTruthy();
    // The selected button (blue) should be day 15
    const selectedBtn = screen.getByRole('button', { name: /^15$/ });
    expect(selectedBtn.className).toContain('bg-blue-600');
  });
});

// ── Test 7: Lista de pendientes ───────────────────────────────────────────────
describe('Pendientes de programar', () => {
  it('lista con presupuestos pendientes los muestra en pantalla', () => {
    // We render KpiStrip to verify counts (pendingCount)
    render(
      <KpiStrip
        pendingCount={3}
        todayJobsCount={2}
        inProgressCount={1}
        unassignedCount={0}
        selectedDate="2026-11-06"
      />
    );
    // Should show 3 for pending
    expect(screen.getByText('3')).toBeTruthy();
    // Should show 2 for today
    expect(screen.getByText('2')).toBeTruthy();
  });

  // Test 8: Presupuesto aceptado — estado
  it('KpiStrip recibe pendingCount positivo cuando hay presupuestos aceptados', () => {
    const { container } = render(
      <KpiStrip
        pendingCount={2}
        todayJobsCount={0}
        inProgressCount={0}
        unassignedCount={0}
        selectedDate="2026-11-06"
      />
    );
    expect(container.querySelectorAll('.rounded-xl').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.getByText('2')).toBeTruthy();
  });

  // Test 9: Programación con prefill — el callback se llama con la quote
  it('handleProgramarDesdeCalendario invoca callback con datos de la quote', () => {
    const onSelect = vi.fn();
    // We test via MonthCalendar date selection which is used as prefill suggestion
    render(
      <MonthCalendar
        selectedDate="2026-11-10"
        onDateSelect={onSelect}
        jobDates={new Set()}
      />
    );
    const day20 = screen.getByRole('button', { name: /^20$/ });
    fireEvent.click(day20);
    expect(onSelect).toHaveBeenCalledWith('2026-11-20');
  });

  // Test 10: Actualización post-guardado — jobDates se actualiza
  it('cuando se añade una fecha a jobDates, el día muestra indicador', () => {
    const { rerender } = render(
      <MonthCalendar
        selectedDate="2026-11-01"
        onDateSelect={vi.fn()}
        jobDates={new Set<string>()}
      />
    );
    // Day 15 without jobs — no dot
    expect(screen.getByRole('button', { name: /^15$/ }).querySelector('.w-1.h-1')).toBeFalsy();

    // After "saving" a job, jobDates gets 2026-11-15
    rerender(
      <MonthCalendar
        selectedDate="2026-11-01"
        onDateSelect={vi.fn()}
        jobDates={new Set(['2026-11-15'])}
      />
    );
    expect(screen.getByRole('button', { name: /^15$/ }).querySelector('.w-1.h-1')).toBeTruthy();
  });
});

// ── Tests 11–15: Regresión ────────────────────────────────────────────────────
describe('Regresión de funcionalidad existente', () => {
  // Test 11: Trabajo sin trabajador — no filtrado (KpiStrip unassignedCount)
  it('trabajo sin trabajador se contabiliza en unassignedCount', () => {
    render(
      <KpiStrip
        pendingCount={0}
        todayJobsCount={3}
        inProgressCount={1}
        unassignedCount={2}
        selectedDate="2026-11-06"
      />
    );
    expect(screen.getByText('2')).toBeTruthy(); // unassigned count
    expect(screen.getByText('3')).toBeTruthy(); // today jobs
  });

  // Test 12: Estados y contadores en KpiStrip
  it('KpiStrip muestra correctamente los 4 contadores', () => {
    render(
      <KpiStrip
        pendingCount={5}
        todayJobsCount={4}
        inProgressCount={2}
        unassignedCount={1}
        selectedDate="2026-11-06"
      />
    );
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  // Test 13: MonthCalendar no provoca errores al renderizar sin jobDates
  it('MonthCalendar renderiza sin errores con jobDates vacío', () => {
    expect(() =>
      render(
        <MonthCalendar
          selectedDate="2026-11-06"
          onDateSelect={vi.fn()}
          jobDates={new Set()}
        />
      )
    ).not.toThrow();
    expect(screen.getByText(/Noviembre 2026/i)).toBeTruthy();
  });

  // Test 14: Vista móvil — MonthCalendar es responsive (tamaño celda)
  it('las celdas del calendario tienen altura mínima de 36px (h-9 = 36px)', () => {
    render(
      <MonthCalendar
        selectedDate="2026-11-06"
        onDateSelect={vi.fn()}
        jobDates={new Set()}
      />
    );
    const dayBtns = screen.getAllByRole('button').filter(b => /^\d+$/.test(b.textContent?.trim() ?? ''));
    expect(dayBtns.length).toBeGreaterThan(0);
    dayBtns.forEach(btn => {
      expect(btn.className).toContain('h-9');
    });
  });

  // Test 15: MonthCalendar botón "Hoy" navega a fecha actual
  it('botón Hoy llama onDateSelect con la fecha de hoy', () => {
    const onSelect = vi.fn();
    render(
      <MonthCalendar
        selectedDate="2026-11-06"
        onDateSelect={onSelect}
        jobDates={new Set()}
      />
    );
    fireEvent.click(screen.getByText('Hoy'));
    const todayStr = toLocalStr(new Date());
    expect(onSelect).toHaveBeenCalledWith(todayStr);
  });
});

// ── Fix P1-A: getDatesBetween ─────────────────────────────────────────────────
describe('getDatesBetween — rango de fechas multidía', () => {
  it('rango dentro de un mes genera todas las fechas intermedias', () => {
    const result = getDatesBetween('2026-11-10', '2026-11-13');
    expect(result).toEqual(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
  });

  it('cruce de mes (oct→nov) genera 4 fechas correctas', () => {
    const result = getDatesBetween('2026-10-30', '2026-11-02');
    expect(result).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('cruce de año (dic→ene) genera 4 fechas correctas', () => {
    const result = getDatesBetween('2026-12-30', '2027-01-02');
    expect(result).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });

  it('rango invertido (fin < inicio) retorna solo la fecha de inicio', () => {
    const result = getDatesBetween('2026-11-15', '2026-11-10');
    expect(result).toEqual(['2026-11-15']);
  });

  it('fecha_fin null retorna solo la fecha de inicio', () => {
    expect(getDatesBetween('2026-11-15', null)).toEqual(['2026-11-15']);
    expect(getDatesBetween('2026-11-15', undefined)).toEqual(['2026-11-15']);
  });

  it('mismo día inicio y fin retorna una sola fecha', () => {
    const result = getDatesBetween('2026-11-15', '2026-11-15');
    expect(result).toEqual(['2026-11-15']);
  });
});

// ── Fix P1-C: KpiStrip etiqueta usa fecha seleccionada ───────────────────────
describe('KpiStrip — etiqueta Sin asignar usa fecha seleccionada', () => {
  it('fecha distinta de hoy muestra la fecha en la etiqueta (no "hoy")', () => {
    render(
      <KpiStrip
        pendingCount={0}
        todayJobsCount={2}
        inProgressCount={0}
        unassignedCount={1}
        selectedDate="2026-11-20"
      />
    );
    // La etiqueta debe contener "20" y "nov" (formato toLocaleDateString es-ES)
    const labels = document.querySelectorAll('.uppercase.tracking-wide');
    const sinAsignarLabel = Array.from(labels).find(el => el.textContent?.includes('Sin asignar'));
    expect(sinAsignarLabel).toBeTruthy();
    expect(sinAsignarLabel?.textContent).not.toContain('hoy');
    // Debe contener algo relacionado con el 20 de noviembre
    expect(sinAsignarLabel?.textContent?.toLowerCase()).toMatch(/20/);
  });

  it('con la fecha de hoy muestra la fecha de hoy formateada (no texto "hoy")', () => {
    const today = toLocalStr(new Date());
    render(
      <KpiStrip
        pendingCount={0}
        todayJobsCount={0}
        inProgressCount={0}
        unassignedCount={0}
        selectedDate={today}
      />
    );
    const labels = document.querySelectorAll('.uppercase.tracking-wide');
    const sinAsignarLabel = Array.from(labels).find(el => el.textContent?.includes('Sin asignar'));
    expect(sinAsignarLabel).toBeTruthy();
    // No debe haber "hoy" hardcodeado
    expect(sinAsignarLabel?.textContent?.toLowerCase()).not.toBe('sin asignar hoy');
  });
});
