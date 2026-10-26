/**
 * TX-AGENDA-LAYOUT-2B — Tests para protección multiempresa, permisos económicos
 * y navegación Agenda → Servicios/Rutas.
 */
import { describe, it, expect } from 'vitest';
import { ROL_PERMISOS } from '../../context/SessionContext';
import type { Rol } from '../../context/SessionContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function can(rol: Rol, permiso: string): boolean {
  return ROL_PERMISOS[rol].includes(permiso);
}

/** Simula la lógica de loadedOrgId para protección de render. */
function showLoading(loading: boolean, loadedOrgId: string | null, orgId: string): boolean {
  return loading || loadedOrgId !== orgId;
}

/** Simula el guard loadIdRef: devuelve true si la respuesta debe descartarse. */
function isStale(currentId: number, myId: number): boolean {
  return currentId !== myId;
}

// ── Protección multiempresa (loadedOrgId) ─────────────────────────────────────

describe('loadedOrgId — render-based org guard', () => {
  it('muestra loading cuando loadedOrgId es null (aún no ha cargado)', () => {
    expect(showLoading(false, null, 'org-A')).toBe(true);
  });

  it('muestra loading cuando loadedOrgId es de otra org', () => {
    expect(showLoading(false, 'org-B', 'org-A')).toBe(true);
  });

  it('muestra loading durante la carga de la misma org', () => {
    expect(showLoading(true, 'org-A', 'org-A')).toBe(true);
  });

  it('no muestra loading cuando carga completó para la org correcta', () => {
    expect(showLoading(false, 'org-A', 'org-A')).toBe(false);
  });

  it('cambio rápido de org muestra loading aunque loading=false', () => {
    // loadedOrgId quedó de org-A, pero orgId ya es org-B
    expect(showLoading(false, 'org-A', 'org-B')).toBe(true);
  });
});

// ── Stale async (loadIdRef) ───────────────────────────────────────────────────

describe('loadIdRef — stale async guard', () => {
  it('respuesta stale se descarta (myId < currentId)', () => {
    expect(isStale(3, 1)).toBe(true);
  });

  it('respuesta actual no se descarta (myId === currentId)', () => {
    expect(isStale(2, 2)).toBe(false);
  });

  it('cambio rápido de intervalo genera nuevo id y descarta el anterior', () => {
    let counter = 0;
    const id1 = ++counter; // primer load
    ++counter;             // segundo load interrumpe
    expect(isStale(counter, id1)).toBe(true);
  });
});

// ── Permisos económicos (ingresos.view) ───────────────────────────────────────

describe('ingresos.view — permiso sobre precio_acordado', () => {
  const ROLES_CON_PERMISO: Rol[] = ['owner', 'admin', 'oficina'];
  const ROLES_SIN_PERMISO: Rol[] = ['tecnico', 'visualizador', 'comercial'];

  for (const rol of ROLES_CON_PERMISO) {
    it(`${rol} puede ver precio_acordado`, () => {
      expect(can(rol, 'ingresos.view')).toBe(true);
    });
  }

  for (const rol of ROLES_SIN_PERMISO) {
    it(`${rol} NO puede ver precio_acordado`, () => {
      expect(can(rol, 'ingresos.view')).toBe(false);
    });
  }
});

// ── Navegación Agenda → Servicios (initialServiceId) ─────────────────────────

describe('initialServiceId — selección en ScreenTransporteServicios', () => {
  function resolveHighlight(
    initialServiceId: string | null | undefined,
    services: { id: string }[],
  ): string | null {
    if (!initialServiceId || services.length === 0) return null;
    const found = services.find(s => s.id === initialServiceId);
    return found ? initialServiceId : null;
  }

  it('encuentra el servicio y devuelve su id', () => {
    const result = resolveHighlight('svc-1', [{ id: 'svc-1' }, { id: 'svc-2' }]);
    expect(result).toBe('svc-1');
  });

  it('devuelve null si la lista está vacía', () => {
    expect(resolveHighlight('svc-1', [])).toBeNull();
  });

  it('devuelve null si initialServiceId no está en la lista', () => {
    const result = resolveHighlight('svc-999', [{ id: 'svc-1' }, { id: 'svc-2' }]);
    expect(result).toBeNull();
  });

  it('devuelve null si initialServiceId es null', () => {
    expect(resolveHighlight(null, [{ id: 'svc-1' }])).toBeNull();
  });

  it('no selecciona un servicio de otra organización (no aparece en la lista filtrada)', () => {
    // Los servicios se cargan siempre por orgId, así que un id de otra org no estará
    const orgBServices = [{ id: 'svc-org-B-1' }];
    const result = resolveHighlight('svc-org-A-99', orgBServices);
    expect(result).toBeNull();
  });
});

// ── Navegación Agenda → Rutas (initialServiceId) ─────────────────────────────

describe('initialServiceId — auto-selección en ScreenTransporteRutas', () => {
  function resolveSelected(
    initialServiceId: string | null | undefined,
    services: { id: string }[],
  ): { id: string } | null {
    if (!initialServiceId || services.length === 0) return null;
    return services.find(s => s.id === initialServiceId) ?? null;
  }

  it('selecciona el servicio correcto', () => {
    const svc = resolveSelected('svc-A', [{ id: 'svc-A' }, { id: 'svc-B' }]);
    expect(svc?.id).toBe('svc-A');
  });

  it('devuelve null si no se encuentra', () => {
    expect(resolveSelected('svc-X', [{ id: 'svc-A' }])).toBeNull();
  });

  it('no selecciona si la lista está vacía', () => {
    expect(resolveSelected('svc-A', [])).toBeNull();
  });
});

// ── onConsumeInitialServiceId — selección consumible ─────────────────────────

describe('onConsumeInitialServiceId — consumable selection', () => {
  /** Simula la lógica del effect en Servicios y Rutas. */
  function simulateConsumeEffect(
    initialServiceId: string | null | undefined,
    services: { id: string }[],
    onConsume: () => void,
  ): boolean /* consumed */ {
    if (!initialServiceId || services.length === 0) return false;
    const found = services.find(s => s.id === initialServiceId);
    if (found) { onConsume(); return true; }
    return false;
  }

  it('llama a onConsume cuando encuentra el servicio', () => {
    let consumed = false;
    const result = simulateConsumeEffect('svc-1', [{ id: 'svc-1' }], () => { consumed = true; });
    expect(result).toBe(true);
    expect(consumed).toBe(true);
  });

  it('NO llama a onConsume si la lista está vacía', () => {
    let consumed = false;
    simulateConsumeEffect('svc-1', [], () => { consumed = true; });
    expect(consumed).toBe(false);
  });

  it('NO llama a onConsume si el ID no está en la lista', () => {
    let consumed = false;
    simulateConsumeEffect('svc-X', [{ id: 'svc-1' }], () => { consumed = true; });
    expect(consumed).toBe(false);
  });

  it('NO llama a onConsume si initialServiceId es null', () => {
    let consumed = false;
    simulateConsumeEffect(null, [{ id: 'svc-1' }], () => { consumed = true; });
    expect(consumed).toBe(false);
  });

  it('después de consumir, sidebar abre con null y no selecciona', () => {
    let navServiceId: string | null = 'svc-1';
    simulateConsumeEffect(navServiceId, [{ id: 'svc-1' }], () => { navServiceId = null; });
    // Ahora la barra lateral abre Servicios con navServiceId=null
    const result = simulateConsumeEffect(navServiceId, [{ id: 'svc-1' }], () => {});
    expect(result).toBe(false);
  });

  it('segunda navegación desde Agenda selecciona correctamente tras consumo previo', () => {
    let navServiceId: string | null = 'svc-1';
    // Primera navegación: consume el ID
    simulateConsumeEffect(navServiceId, [{ id: 'svc-1' }], () => { navServiceId = null; });
    expect(navServiceId).toBeNull();
    // Segunda navegación desde Agenda
    navServiceId = 'svc-2';
    let consumed = false;
    simulateConsumeEffect(navServiceId, [{ id: 'svc-1' }, { id: 'svc-2' }], () => { consumed = true; navServiceId = null; });
    expect(consumed).toBe(true);
    expect(navServiceId).toBeNull();
  });
});

// ── Navegación móvil (mobileMap) ──────────────────────────────────────────────

describe('mobileMap — mapeo de tab keys a subtabs de transporte', () => {
  type MobileTab = 'panel' | 'servicios' | 'agenda' | 'vehiculos' | 'conductores' | 'rutas';

  const mobileMap: Record<string, MobileTab> = {
    transporte_panel:      'panel',
    transporte_servicios:  'servicios',
    transporte_rutas:      'rutas',
  };

  it('transporte_servicios → servicios', () => {
    expect(mobileMap['transporte_servicios']).toBe('servicios');
  });

  it('transporte_rutas → rutas', () => {
    expect(mobileMap['transporte_rutas']).toBe('rutas');
  });

  it('tab desconocido no produce un subtab', () => {
    expect(mobileMap['transporte_unknown']).toBeUndefined();
  });
});
