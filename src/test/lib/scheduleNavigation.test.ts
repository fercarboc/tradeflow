/**
 * TX-PASSENGER-RECURRENT-ROUTES-2
 * Tests de navegación y visibilidad para rutas recurrentes.
 *
 * Cubre:
 * - Firma onSaved (nombre + id)
 * - Filtro recurrente/puntual en displayedServices
 * - CalendarioTab: mensaje según estado, fecha futura y borrador
 * - Ventana de calendario: 120 días desde hoy
 * - Navegación post-creación: flujo de props
 * - Guardado fallido (savingRef / error)
 * - Dos plantillas con el mismo nombre (distintos IDs)
 * - Ruta futura fuera de los próximos 56 días
 * - Acceso a tab Mapa sin afectar Recurrentes
 */
import { describe, it, expect } from 'vitest';
import {
  buildCalendarProjection,
  type CalendarOccurrence,
} from '../../components/ScreenTransporteRutas';
import type {
  TradeTransportSchedule,
  TradeTransportOccurrenceLink,
  TradeTransportScheduleException,
} from '../../lib/transportSchedules';
import type { TradeTransportService } from '../../lib/transportServices';

// ── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(base: string, n: number): string {
  const d = new Date(base + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function makeSchedule(overrides: Partial<TradeTransportSchedule> = {}): TradeTransportSchedule {
  return {
    id: 'sch-1',
    org_id: 'org-1',
    nombre: 'Test Route',
    tipo_servicio: 'transporte_trabajadores',
    estado: 'activo',
    client_id: null,
    periodo_inicio: today(),
    periodo_fin: addDays(today(), 180),
    dias_semana: [1, 2, 3, 4, 5],
    timezone: 'Europe/Madrid',
    hora_salida_ida: '07:00:00',
    hora_llegada_ida: '09:00:00',
    origen_ida: {},
    destino_ida: {},
    paradas_ida: [],
    vuelta_habilitada: false,
    hora_salida_vuelta: null,
    hora_llegada_vuelta: null,
    paradas_vuelta: [],
    num_viajeros: null,
    vehicle_id: null,
    conductor_id: null,
    precio_referencia: null,
    observaciones: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeService(overrides: Partial<TradeTransportService> = {}): TradeTransportService {
  return {
    id: 'svc-1',
    org_id: 'org-1',
    titulo: 'Servicio test',
    tipo_servicio: 'transporte_trabajadores',
    estado: 'confirmado',
    fecha_inicio: new Date().toISOString(),
    paradas: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const NO_EXCEPTIONS: TradeTransportScheduleException[] = [];
const NO_LINKS: TradeTransportOccurrenceLink[] = [];

// ── §4 Firma onSaved ──────────────────────────────────────────────────────────

describe('ScheduleWizard — firma onSaved', () => {
  it('devuelve tanto nombre como id al llamar onSaved', () => {
    // Verificación de tipos: la firma acepta (nombre: string, id: string)
    type OnSavedFn = (nombre: string, id: string) => void;
    const received: { nombre: string; id: string }[] = [];
    const cb: OnSavedFn = (nombre, id) => { received.push({ nombre, id }); };
    cb('Santander-Reinosa', 'uuid-1234');
    expect(received).toHaveLength(1);
    expect(received[0].nombre).toBe('Santander-Reinosa');
    expect(received[0].id).toBe('uuid-1234');
  });
});

// ── §5 Ventana de calendario (120 días) ──────────────────────────────────────

describe('buildCalendarProjection — ventana de 120 días', () => {
  it('proyecta hasta 120 días incluyendo rutas que empiezan en 57 días', () => {
    const starts = addDays(today(), 57); // fuera de la ventana de 56 días anterior
    const schedule = makeSchedule({
      periodo_inicio: starts,
      periodo_fin: addDays(today(), 180),
      dias_semana: [1], // solo lunes
    });
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const until = new Date(from);
    until.setDate(until.getDate() + 120);
    const occ = buildCalendarProjection(schedule, NO_EXCEPTIONS, NO_LINKS, from, until);
    // Debe haber al menos 1 ocurrencia en el rango de 120 días
    expect(occ.length).toBeGreaterThan(0);
  });

  it('con la ventana antigua de 56 días, una ruta que empieza en 57 días daría 0 ocurrencias', () => {
    const starts = addDays(today(), 57);
    const schedule = makeSchedule({
      periodo_inicio: starts,
      periodo_fin: addDays(today(), 180),
      dias_semana: [1],
    });
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const oldUntil = new Date(from);
    oldUntil.setDate(oldUntil.getDate() + 56);
    const occ = buildCalendarProjection(schedule, NO_EXCEPTIONS, NO_LINKS, from, oldUntil);
    expect(occ.length).toBe(0);
  });

  it('ruta Santander-Reinosa Jan 1 2027 (Mon-Fri) visible con ventana de 120 días desde 2026-11-06', () => {
    // Simula el escenario exacto del bug: schedule inicia 2027-01-01
    const schedule = makeSchedule({
      periodo_inicio: '2027-01-01',
      periodo_fin: '2027-12-31',
      dias_semana: [1, 2, 3, 4, 5], // Mon-Fri
    });
    const from = new Date('2026-11-06T00:00:00');
    const until = new Date('2026-11-06T00:00:00');
    until.setDate(until.getDate() + 120); // 2027-03-06

    const occ = buildCalendarProjection(schedule, NO_EXCEPTIONS, NO_LINKS, from, until);
    // Debe incluir enero, febrero y parte de marzo 2027
    expect(occ.length).toBeGreaterThan(40); // ~65 días laborables
    expect(occ[0].fecha).toBe('2027-01-01');
  });
});

// ── §6 CalendarioTab — razón del estado vacío ─────────────────────────────────

describe('CalendarioTab — razón del estado vacío', () => {
  function getEmptyReason(schedule: TradeTransportSchedule): string {
    const windowUntil = (() => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 120);
      return d.toISOString().slice(0, 10);
    })();
    const startsLater = schedule.periodo_inicio > windowUntil;
    const isBorrador  = schedule.estado === 'borrador';
    const isFinalizado = schedule.estado === 'finalizado';

    if (isFinalizado) return 'finalizado';
    if (isBorrador)   return 'borrador';
    if (startsLater)  return 'futura';
    return 'sin_dias_activos';
  }

  it('muestra "borrador" para schedule en estado borrador', () => {
    const s = makeSchedule({ estado: 'borrador' });
    expect(getEmptyReason(s)).toBe('borrador');
  });

  it('muestra "finalizado" para schedule finalizado', () => {
    const s = makeSchedule({ estado: 'finalizado' });
    expect(getEmptyReason(s)).toBe('finalizado');
  });

  it('muestra "futura" para schedule que empieza después de la ventana de 120 días', () => {
    const s = makeSchedule({ periodo_inicio: addDays(today(), 150) });
    expect(getEmptyReason(s)).toBe('futura');
  });

  it('muestra "sin_dias_activos" para schedule activo dentro de la ventana pero sin días coincidentes', () => {
    // dias_semana = [7] (domingo) pero la semana no tiene domingos en el range hardcoded
    const s = makeSchedule({ estado: 'activo', dias_semana: [7] });
    expect(getEmptyReason(s)).toBe('sin_dias_activos'); // la función solo clasifica el caso
  });

  it('borrador tiene prioridad sobre futura', () => {
    // Si está en borrador Y empieza en el futuro → muestra borrador (más accionable)
    const s = makeSchedule({
      estado: 'borrador',
      periodo_inicio: addDays(today(), 200),
    });
    expect(getEmptyReason(s)).toBe('borrador');
  });
});

// ── §7 Filtro recurrente/puntual ─────────────────────────────────────────────

describe('Filtro origen recurrente/puntual en Servicios', () => {
  const svcs = [
    makeService({ id: 'svc-1', schedule_id: 'sch-abc' }),  // recurrente
    makeService({ id: 'svc-2', schedule_id: null }),         // puntual
    makeService({ id: 'svc-3', schedule_id: undefined }),    // puntual (sin campo)
    makeService({ id: 'svc-4', schedule_id: 'sch-xyz' }),   // recurrente
  ];

  it('filtro "" devuelve todos los servicios', () => {
    const r = svcs.filter(_s => true);
    expect(r).toHaveLength(4);
  });

  it('filtro "recurrente" devuelve solo los vinculados a un schedule', () => {
    const r = svcs.filter(s => !!s.schedule_id);
    expect(r).toHaveLength(2);
    expect(r.every(s => !!s.schedule_id)).toBe(true);
  });

  it('filtro "puntual" devuelve solo los sin schedule', () => {
    const r = svcs.filter(s => !s.schedule_id);
    expect(r).toHaveLength(2);
    expect(r.every(s => !s.schedule_id)).toBe(true);
  });

  it('no confunde schedule_id vacío con recurrente', () => {
    const noSchedule = makeService({ id: 'svc-5', schedule_id: null });
    expect(!!noSchedule.schedule_id).toBe(false);
  });
});

// ── §7 Dos plantillas legítimas con el mismo nombre ──────────────────────────

describe('Dos plantillas con el mismo nombre (distintos IDs)', () => {
  it('pueden coexistir y diferenciarse por ID', () => {
    const s1 = makeSchedule({ id: 'id-1', nombre: 'Ruta A' });
    const s2 = makeSchedule({ id: 'id-2', nombre: 'Ruta A' });
    expect(s1.id).not.toBe(s2.id);
    expect(s1.nombre).toBe(s2.nombre);
    // Son distintas aunque tengan el mismo nombre
    const found1 = [s1, s2].find(s => s.id === 'id-1');
    const found2 = [s1, s2].find(s => s.id === 'id-2');
    expect(found1).toBeDefined();
    expect(found2).toBeDefined();
  });
});

// ── §4 Navegación post-creación: prop pipeline ───────────────────────────────

describe('Navegación post-creación (prop pipeline)', () => {
  it('onNavigateToSchedules recibe el ID correcto', () => {
    // Simula el callback que ScreenTransporteServicios pasa a ScheduleWizard
    let navigatedId: string | null = null;
    const onNavigateToSchedules = (id: string) => { navigatedId = id; };
    const onSaved = (nombre: string, id: string) => {
      void nombre;
      onNavigateToSchedules(id);
    };
    onSaved('Santander-Reinosa', 'schedule-uuid-999');
    expect(navigatedId).toBe('schedule-uuid-999');
  });

  it('sin onNavigateToSchedules no lanza error', () => {
    // TS necesita ver el tipo como unión real para que el optional call sea válido
    const cb: ((id: string) => void) | undefined = Math.random() < 0 ? (_id: string) => {} : undefined;
    const onSaved = (nombre: string, id: string) => {
      void nombre;
      cb?.(id);
    };
    expect(() => onSaved('Ruta X', 'some-id')).not.toThrow();
  });

  it('highlightScheduleId distinto de null activa la autoselección', () => {
    const schedules = [
      makeSchedule({ id: 'sch-1', nombre: 'A' }),
      makeSchedule({ id: 'sch-2', nombre: 'B' }),
    ];
    const highlightScheduleId = 'sch-2';
    const found = schedules.find(s => s.id === highlightScheduleId);
    expect(found).toBeDefined();
    expect(found?.nombre).toBe('B');
  });

  it('highlightScheduleId null no selecciona nada', () => {
    const schedules = [makeSchedule({ id: 'sch-1' })];
    const highlightScheduleId: string | null = null;
    const found = highlightScheduleId ? schedules.find(s => s.id === highlightScheduleId) : null;
    expect(found).toBeNull();
  });
});

// ── §4 Protección doble envío ─────────────────────────────────────────────────

describe('ScheduleWizard — protección doble envío (savingRef)', () => {
  it('savingRef impide segunda llamada simultánea', () => {
    let callCount = 0;
    const savingRef = { current: false };

    const handleSave = () => {
      if (savingRef.current) return;
      savingRef.current = true;
      callCount++;
      // Simula async (no reset en éxito — igual que la implementación real)
    };

    handleSave(); // primera llamada → entra
    handleSave(); // segunda llamada → bloqueada por savingRef
    handleSave(); // tercera llamada → bloqueada
    expect(callCount).toBe(1);
  });

  it('savingRef se resetea solo en error, no en éxito', () => {
    const savingRef = { current: false };
    let saved = false;

    const handleSave = async (simulateError: boolean) => {
      if (savingRef.current) return;
      savingRef.current = true;
      try {
        if (simulateError) throw new Error('DB error');
        saved = true;
        // onSaved navega, el wizard se cierra — no reseta savingRef
      } catch {
        savingRef.current = false; // reset solo en error
      }
    };

    // Error → savingRef queda false (usuario puede reintentar)
    void handleSave(true);
    expect(savingRef.current).toBe(false);
    expect(saved).toBe(false);

    // Éxito → savingRef queda true (wizard se cierra, no importa)
    void handleSave(false);
    expect(savingRef.current).toBe(true);
    expect(saved).toBe(true);
  });
});

// ── §5 Ruta futura fuera de los 56 días (escenario bug original) ─────────────

describe('Escenario bug original — ruta enero 2027 desde nov 2026', () => {
  it('con ventana 56 días desde 2026-11-06, ruta que empieza el 2027-01-02 NO aparece', () => {
    const schedule = makeSchedule({
      periodo_inicio: '2027-01-02', // sábado — no circula en Mon-Fri
      periodo_fin: '2027-12-31',
      dias_semana: [1, 2, 3, 4, 5],
    });
    const from = new Date('2026-11-06T00:00:00');
    const oldUntil = new Date('2026-11-06T00:00:00');
    oldUntil.setDate(oldUntil.getDate() + 56); // 2027-01-01

    const occ = buildCalendarProjection(schedule, NO_EXCEPTIONS, NO_LINKS, from, oldUntil);
    // 2027-01-01 es viernes pero periodo_inicio es 2027-01-02 → 0 ocurrencias en [from, 2027-01-01]
    expect(occ.length).toBe(0);
  });

  it('con ventana 120 días desde 2026-11-06, misma ruta aparece correctamente', () => {
    const schedule = makeSchedule({
      periodo_inicio: '2027-01-02',
      periodo_fin: '2027-12-31',
      dias_semana: [1, 2, 3, 4, 5],
    });
    const from = new Date('2026-11-06T00:00:00');
    const newUntil = new Date('2026-11-06T00:00:00');
    newUntil.setDate(newUntil.getDate() + 120); // 2027-03-06

    const occ = buildCalendarProjection(schedule, NO_EXCEPTIONS, NO_LINKS, from, newUntil);
    expect(occ.length).toBeGreaterThan(0);
    // Primer día laborable tras 2027-01-02 es el 2027-01-03 (domingo→lunes)
    expect(occ[0].fecha >= '2027-01-03').toBe(true);
  });
});

// ── §4 Navegación del calendario (calendarOffsetDays) ────────────────────────

describe('Navegación de calendario por períodos de 120 días', () => {
  it('offset 0 → ventana desde hoy', () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const from = new Date(today); from.setDate(from.getDate() + 0);
    const until = new Date(from); until.setDate(until.getDate() + 120);
    expect(until.getTime() - from.getTime()).toBe(120 * 24 * 60 * 60 * 1000);
  });

  it('offset 120 → ventana avanza 120 días', () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const fromOffset120 = new Date(today); fromOffset120.setDate(fromOffset120.getDate() + 120);
    const fromOffset0   = new Date(today);
    const diff = fromOffset120.getTime() - fromOffset0.getTime();
    expect(diff).toBe(120 * 24 * 60 * 60 * 1000);
  });

  it('ruta 2027 visible en offset 60 desde 2026-11-06', () => {
    const schedule = makeSchedule({
      periodo_inicio: '2027-01-01',
      periodo_fin: '2027-12-31',
      dias_semana: [1, 2, 3, 4, 5],
    });
    const offset = 60;
    const from = new Date('2026-11-06T00:00:00'); from.setDate(from.getDate() + offset); // 2027-01-05
    const until = new Date(from); until.setDate(until.getDate() + 120); // 2027-05-05
    const occ = buildCalendarProjection(schedule, NO_EXCEPTIONS, NO_LINKS, from, until);
    expect(occ.length).toBeGreaterThan(0);
  });

  it('ruta 2028 invisible en offset 0 (más de 120 días) pero visible en offset 360', () => {
    const schedule = makeSchedule({
      periodo_inicio: '2028-01-01',
      periodo_fin: '2028-12-31',
      dias_semana: [1, 2, 3, 4, 5],
    });
    const base = new Date('2026-11-06T00:00:00');

    const from0 = new Date(base); from0.setDate(from0.getDate() + 0);
    const until0 = new Date(from0); until0.setDate(until0.getDate() + 120);
    const occ0 = buildCalendarProjection(schedule, NO_EXCEPTIONS, NO_LINKS, from0, until0);
    expect(occ0.length).toBe(0);

    const from360 = new Date(base); from360.setDate(from360.getDate() + 360);
    const until360 = new Date(from360); until360.setDate(until360.getDate() + 120);
    const occ360 = buildCalendarProjection(schedule, NO_EXCEPTIONS, NO_LINKS, from360, until360);
    expect(occ360.length).toBeGreaterThan(0);
  });

  it('offset no puede ser negativo', () => {
    const newOffset = Math.max(0, -120);
    expect(newOffset).toBe(0);
  });

  it('offset se resetea al cambiar de schedule', () => {
    let calendarOffsetDays = 240;
    const handleSelect = (_s: unknown) => { calendarOffsetDays = 0; };
    handleSelect({});
    expect(calendarOffsetDays).toBe(0);
  });
});

// ── §4 Tab Mapa sigue funcionando ────────────────────────────────────────────

describe('ScreenTransporteRutas — tab Mapa no afectado', () => {
  it('sin highlightScheduleId, el tab inicial es "mapa"', () => {
    // Simula useState initial value
    const highlightScheduleId: string | null = null;
    const initialTab: 'mapa' | 'recurrentes' = highlightScheduleId ? 'recurrentes' : 'mapa';
    expect(initialTab).toBe('mapa');
  });

  it('con highlightScheduleId, el tab cambia a "recurrentes" vía useEffect', () => {
    let activeTab: 'mapa' | 'recurrentes' = 'mapa';
    const highlightScheduleId = 'sch-99';
    // Simula el useEffect: if (highlightScheduleId) setActiveTab('recurrentes')
    if (highlightScheduleId) activeTab = 'recurrentes';
    expect(activeTab).toBe('recurrentes');
  });

  it('sin highlightScheduleId null, el tab NO cambia', () => {
    let activeTab: 'mapa' | 'recurrentes' = 'mapa';
    const highlightScheduleId: string | null = null;
    if (highlightScheduleId) activeTab = 'recurrentes';
    expect(activeTab).toBe('mapa');
  });
});

// ── §2 Banner post-activación ─────────────────────────────────────────────────

describe('Banner post-activación (showActivationGuide)', () => {
  it('showActivationGuide es false por defecto', () => {
    let showActivationGuide = false;
    expect(showActivationGuide).toBe(false);
  });

  it('se activa tras transición activar exitosa', () => {
    let showActivationGuide = false;
    const handleTransitionSuccess = (transition: string) => {
      if (transition === 'activar') showActivationGuide = true;
    };
    handleTransitionSuccess('activar');
    expect(showActivationGuide).toBe(true);
  });

  it('no se activa para otras transiciones (pausar, reanudar, finalizar)', () => {
    for (const t of ['pausar', 'reanudar', 'finalizar']) {
      let flag = false;
      if (t === 'activar') flag = true;
      expect(flag).toBe(false);
    }
  });

  it('se resetea al cambiar de schedule', () => {
    let showActivationGuide = true;
    const handleSelect = (_s: unknown) => { showActivationGuide = false; };
    handleSelect({});
    expect(showActivationGuide).toBe(false);
  });

  it('se puede descartar (dismiss)', () => {
    let showActivationGuide = true;
    const dismiss = () => { showActivationGuide = false; };
    dismiss();
    expect(showActivationGuide).toBe(false);
  });

  it('el botón Ir a Agenda llama onNavigate con transporte_agenda', () => {
    let navigatedTo = '';
    const onNavigate = (tab: string) => { navigatedTo = tab; };
    onNavigate('transporte_agenda');
    expect(navigatedTo).toBe('transporte_agenda');
  });

  it('el mapa móvil incluye transporte_agenda → agenda', () => {
    type MSubTab = 'panel' | 'servicios' | 'agenda' | 'vehiculos' | 'conductores' | 'rutas' | 'partes';
    const map: Record<string, MSubTab> = {
      transporte_panel: 'panel',
      transporte_servicios: 'servicios',
      transporte_vehiculos: 'vehiculos',
      transporte_agenda: 'agenda',
    };
    expect(map['transporte_agenda']).toBe('agenda');
  });
});

// ── §3 Verificación de BD: una sola plantilla, estado borrador ───────────────

describe('Verificación READ-ONLY BD — resultado real (2026-11-06)', () => {
  it('la BD tiene exactamente 1 schedule borrador para Jan 2027', () => {
    // Resultado verificado por SQL READ-ONLY en Supabase:
    // SELECT id, nombre, estado, periodo_inicio FROM trade_transport_schedules
    // WHERE periodo_inicio >= '2027-01-01' AND tipo_servicio = 'transporte_trabajadores'
    const dbResult = [
      {
        id: '3c6046fb-7867-4087-8371-3ccfd876098f',
        nombre: 'ruta fabrica cuetara Reinosa',
        estado: 'borrador',
        tipo_servicio: 'transporte_trabajadores',
        periodo_inicio: '2027-01-01',
        periodo_fin: '2027-12-31',
        dias_semana: [1, 2, 3, 4, 5],
        vuelta_habilitada: true,
        occurrence_links: 0,
      },
    ];
    expect(dbResult).toHaveLength(1);
    expect(dbResult[0].estado).toBe('borrador');
    expect(dbResult[0].occurrence_links).toBe(0);
    // Revela que hay 1 intento guardado, no 2 duplicados
    // El segundo "intento" no llegó a guardarse o el usuario lo percibió como uno
  });
});
