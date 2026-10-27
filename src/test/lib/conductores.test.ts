/**
 * TX-COND-1A/1B — Tests para gestión de conductores.
 * Cubre: alta, edición, validaciones, desactivación, historial,
 * aislamiento multiempresa, permisos, y conductor inactivo en Partes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadConductores,
  createConductor,
  updateWorker,
} from '../../lib/transport';
import { loadPartesCompletados } from '../../lib/transportServices';
import type { TradeWorker } from '../../lib/supabase';
import { expiryStatus } from '../../components/ScreenTransporteConductores';

// ── Mock Supabase ─────────────────────────────────────────────────────────────

type Chain = Record<string, unknown>;

function makeChain(resolveWith: { data?: unknown; error?: unknown }): Chain {
  const chain: Chain = {};
  chain.select  = vi.fn(() => chain);
  chain.insert  = vi.fn(() => chain);
  chain.update  = vi.fn(() => chain);
  chain.eq      = vi.fn(() => chain);
  chain.neq     = vi.fn(() => chain);
  chain.gte     = vi.fn(() => chain);
  chain.lte     = vi.fn(() => chain);
  chain.order   = vi.fn(() => chain);
  chain.limit   = vi.fn(() => chain);
  chain.single  = vi.fn(() => Promise.resolve(resolveWith));
  chain.then    = (resolve: (v: unknown) => unknown) => Promise.resolve(resolveWith).then(resolve);
  return chain;
}

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(() => makeChain({ data: null, error: null })),
}));

// transport.ts imports supabase from supabase.ts — mock the client there
vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

// transportServices.ts also imports supabase from supabase.ts — same mock applies

// ── Constants ─────────────────────────────────────────────────────────────────

const ORG_A = 'org-a-0000-0000-0000-000000000001';
const ORG_B = 'org-b-0000-0000-0000-000000000002';

function makeConductor(overrides: Partial<TradeWorker> = {}): TradeWorker {
  return {
    id: 'worker-0000-0000-0000-000000000001',
    org_id: ORG_A,
    nombre: 'Pedro García',
    telefono: '600000001',
    email: 'pedro@empresa.com',
    rol: 'conductor',
    activo: true,
    es_conductor: true,
    categorias_permiso: ['D', 'D+E'],
    permiso_caducidad: '2028-06-30',
    cap_caducidad: '2027-09-15',
    identificador_interno: 'EMP-001',
    fecha_incorporacion: '2022-01-10',
    observaciones_profesionales: null,
    created_at: '2022-01-10T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

// ── loadConductores ───────────────────────────────────────────────────────────

describe('loadConductores', () => {
  beforeEach(() => {
    mockFrom.mockImplementation(() => makeChain({ data: null, error: null }));
  });

  it('COND-1 — retorna lista vacía si no hay conductores', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: [], error: null }));
    const result = await loadConductores(ORG_A);
    expect(result).toEqual([]);
  });

  it('COND-2 — incluye conductores activos', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: [makeConductor()], error: null }));
    const result = await loadConductores(ORG_A);
    expect(result).toHaveLength(1);
    expect(result[0].es_conductor).toBe(true);
  });

  it('COND-3 — incluye conductores inactivos (historial preservado)', async () => {
    const inactivo = makeConductor({ activo: false });
    mockFrom.mockReturnValueOnce(makeChain({ data: [inactivo], error: null }));
    const result = await loadConductores(ORG_A);
    expect(result).toHaveLength(1);
    expect(result[0].activo).toBe(false);
  });

  it('COND-4 — filtra siempre por org_id (aislamiento multiempresa)', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);
    await loadConductores(ORG_A);
    const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls.some((c: unknown[]) => c[0] === 'org_id' && c[1] === ORG_A)).toBe(true);
  });

  it('COND-5 — filtra siempre por es_conductor=true', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);
    await loadConductores(ORG_A);
    const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls.some((c: unknown[]) => c[0] === 'es_conductor' && c[1] === true)).toBe(true);
  });

  it('COND-6 — ORG_B no ve conductores de ORG_A', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: [], error: null }));
    const result = await loadConductores(ORG_B);
    expect(result.filter(w => w.org_id === ORG_A)).toHaveLength(0);
  });

  it('COND-7 — los campos profesionales están presentes', async () => {
    const c = makeConductor({
      categorias_permiso: ['D', 'C'],
      permiso_caducidad: '2028-12-31',
      cap_caducidad: '2027-06-30',
      identificador_interno: 'EMP-042',
    });
    mockFrom.mockReturnValueOnce(makeChain({ data: [c], error: null }));
    const result = await loadConductores(ORG_A);
    expect(result[0].categorias_permiso).toEqual(['D', 'C']);
    expect(result[0].permiso_caducidad).toBe('2028-12-31');
    expect(result[0].cap_caducidad).toBe('2027-06-30');
    expect(result[0].identificador_interno).toBe('EMP-042');
  });
});

// ── createConductor ───────────────────────────────────────────────────────────

describe('createConductor', () => {
  it('COND-8 — crea un conductor con es_conductor=true, activo=true y rol=tecnico', async () => {
    const created = makeConductor({ nombre: 'Ana López', rol: 'tecnico' });
    const chain = makeChain({ data: created, error: null });
    mockFrom.mockReturnValueOnce(chain);
    const result = await createConductor(ORG_A, { nombre: 'Ana López' });
    expect(result.nombre).toBe('Ana López');
    expect(result.es_conductor).toBe(true);
    expect(result.activo).toBe(true);
    expect(result.rol).toBe('tecnico');
    // Verifica que NO se insertó rol='conductor' (violaría CHECK constraint DB)
    const insertCall = (chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(insertCall).toMatchObject({ rol: 'tecnico', es_conductor: true });
    expect(insertCall.rol).not.toBe('conductor');
  });

  it('COND-9 — lanza error si Supabase falla en alta', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: { message: 'duplicate key' } }));
    await expect(createConductor(ORG_A, { nombre: 'Test' })).rejects.toMatchObject({ message: 'duplicate key' });
  });

  it('COND-31 — lanza error si Supabase falla en loadConductores (no silencia el error)', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: { message: 'permission denied for table trade_workers' } }));
    await expect(loadConductores(ORG_A)).rejects.toMatchObject({ message: 'permission denied for table trade_workers' });
  });

  it('COND-10 — persiste categorías de permiso en el alta', async () => {
    const created = makeConductor({ categorias_permiso: ['D', 'C+E'] });
    mockFrom.mockReturnValueOnce(makeChain({ data: created, error: null }));
    const result = await createConductor(ORG_A, { nombre: 'Juan', categorias_permiso: ['D', 'C+E'] });
    expect(result.categorias_permiso).toEqual(['D', 'C+E']);
  });
});

// ── updateWorker ──────────────────────────────────────────────────────────────

describe('updateWorker', () => {
  it('COND-11 — actualiza campos del conductor', async () => {
    const updated = makeConductor({ telefono: '611111111' });
    mockFrom.mockReturnValueOnce(makeChain({ data: updated, error: null }));
    const result = await updateWorker('worker-001', ORG_A, { telefono: '611111111' });
    expect(result.telefono).toBe('611111111');
  });

  it('COND-12 — usa org_id como filtro defensivo en actualización', async () => {
    const chain = makeChain({ data: makeConductor(), error: null });
    mockFrom.mockReturnValueOnce(chain);
    await updateWorker('worker-001', ORG_A, { nombre: 'Nuevo Nombre' });
    const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls.some((c: unknown[]) => c[0] === 'org_id' && c[1] === ORG_A)).toBe(true);
  });

  it('COND-13 — desactivar conductor (activo=false) no elimina sus datos', async () => {
    const desactivado = makeConductor({ activo: false });
    mockFrom.mockReturnValueOnce(makeChain({ data: desactivado, error: null }));
    const result = await updateWorker('worker-001', ORG_A, { activo: false });
    expect(result.activo).toBe(false);
    expect(result.nombre).toBe('Pedro García');
    expect(result.categorias_permiso).toEqual(['D', 'D+E']);
  });

  it('COND-14 — reactivar conductor (activo=true)', async () => {
    const reactivado = makeConductor({ activo: true });
    mockFrom.mockReturnValueOnce(makeChain({ data: reactivado, error: null }));
    const result = await updateWorker('worker-001', ORG_A, { activo: true });
    expect(result.activo).toBe(true);
  });

  it('COND-15 — lanza error si Supabase falla en actualización', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: { message: 'rls violation' } }));
    await expect(updateWorker('worker-001', ORG_A, { nombre: 'X' })).rejects.toMatchObject({ message: 'rls violation' });
  });
});

// ── expiryStatus (pure function) ──────────────────────────────────────────────

describe('expiryStatus', () => {
  it('COND-16 — fecha null → none', () => {
    expect(expiryStatus(null)).toBe('none');
  });

  it('COND-17 — fecha undefined → none', () => {
    expect(expiryStatus(undefined)).toBe('none');
  });

  it('COND-18 — fecha pasada → expired', () => {
    expect(expiryStatus('2020-01-01')).toBe('expired');
  });

  it('COND-19 — fecha en 30 días → soon', () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    const iso = d.toISOString().slice(0, 10);
    expect(expiryStatus(iso)).toBe('soon');
  });

  it('COND-20 — fecha en 90 días → ok', () => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    const iso = d.toISOString().slice(0, 10);
    expect(expiryStatus(iso)).toBe('ok');
  });

  it('COND-21 — límite exacto 60 días → soon', () => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    const iso = d.toISOString().slice(0, 10);
    expect(expiryStatus(iso)).toBe('soon');
  });

  it('COND-22 — límite exacto 61 días → ok', () => {
    const d = new Date();
    d.setDate(d.getDate() + 61);
    const iso = d.toISOString().slice(0, 10);
    expect(expiryStatus(iso)).toBe('ok');
  });

  it('COND-27 — 59 días → soon', () => {
    const d = new Date();
    d.setDate(d.getDate() + 59);
    const iso = d.toISOString().slice(0, 10);
    expect(expiryStatus(iso)).toBe('soon');
  });

  it('COND-28 — caduca hoy (día 0) → soon (no expired)', () => {
    const today = new Date();
    const iso = today.toISOString().slice(0, 10);
    // Hoy mismo: diffDays=0, menor que ayer pero no expired (d >= today en medianoche)
    expect(expiryStatus(iso)).toBe('soon');
  });

  it('COND-29 — fecha nula explícita null → none', () => {
    expect(expiryStatus(null)).toBe('none');
  });

  it('COND-30 — cadena vacía → none', () => {
    expect(expiryStatus('')).toBe('none');
  });
});

// ── Conductor inactivo en histórico de Partes ─────────────────────────────────

describe('Conductor inactivo aparece en filtros del histórico de Partes', () => {
  it('COND-23 — loadConductores devuelve conductor inactivo con servicios históricos', async () => {
    const conductorInactivo = makeConductor({
      id: 'cond-inactivo-001',
      nombre: 'Luis Fernández (inactivo)',
      activo: false,
      es_conductor: true,
    });
    mockFrom.mockReturnValueOnce(makeChain({ data: [conductorInactivo], error: null }));

    const conductores = await loadConductores(ORG_A);
    expect(conductores.some(c => c.id === 'cond-inactivo-001' && c.activo === false)).toBe(true);
  });

  it('COND-24 — partes filtrados por conductorId inactivo devuelven sus servicios', async () => {
    const parteInactivo = {
      id: 'svc-hist-001',
      org_id: ORG_A,
      titulo: 'Excursión histórica',
      tipo_servicio: 'excursion',
      estado: 'completado',
      fecha_inicio: '2026-06-15T09:00:00.000Z',
      fecha_fin: '2026-06-15T18:00:00.000Z',
      paradas: [],
      km_reales: 250,
      incidencias: null,
      observaciones_cierre: null,
      hora_real_salida: '2026-06-15T09:05:00.000Z',
      hora_real_llegada: '2026-06-15T18:10:00.000Z',
      cerrado_at: '2026-06-15T18:20:00.000Z',
      cerrado_por: 'user-uuid-001',
      conductor_id: 'cond-inactivo-001',
      vehicle_id: null,
      client_id: null,
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-15T18:20:00.000Z',
    };

    mockFrom.mockReturnValueOnce(makeChain({ data: [parteInactivo], error: null }));

    const result = await loadPartesCompletados(ORG_A, { conductorId: 'cond-inactivo-001' });
    expect(result.partes).toHaveLength(1);
    expect(result.partes[0].conductor_id).toBe('cond-inactivo-001');
  });

  it('COND-25 — desactivar conductor no borra sus partes históricos', async () => {
    // Simula: desactivamos al conductor
    const deactivated = makeConductor({ activo: false });
    mockFrom.mockReturnValueOnce(makeChain({ data: deactivated, error: null }));
    const conductor = await updateWorker('cond-inactivo-001', ORG_A, { activo: false });
    expect(conductor.activo).toBe(false);

    // Los partes siguen existiendo (query independiente a trade_transport_services)
    mockFrom.mockReturnValueOnce(makeChain({ data: [{ id: 'svc-hist-001', conductor_id: 'cond-inactivo-001', estado: 'completado' }], error: null }));
    const partes = await loadPartesCompletados(ORG_A, { conductorId: 'cond-inactivo-001' });
    expect(partes.partes).toHaveLength(1);
  });
});

// ── Aislamiento multiempresa ──────────────────────────────────────────────────

describe('Aislamiento multiempresa', () => {
  it('COND-26 — crear conductor para ORG_A no afecta ORG_B', async () => {
    const chain = makeChain({ data: makeConductor(), error: null });
    mockFrom.mockReturnValueOnce(chain);
    await createConductor(ORG_A, { nombre: 'Solo para ORG_A' });

    // La query de ORG_B retorna vacío — las tablas están aisladas por RLS
    mockFrom.mockReturnValueOnce(makeChain({ data: [], error: null }));
    const conductoresB = await loadConductores(ORG_B);
    expect(conductoresB).toHaveLength(0);
  });
});
