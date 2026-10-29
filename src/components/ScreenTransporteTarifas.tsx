import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Settings, Save, Loader2, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, HelpCircle,
  Fuel, User, Bed, Truck, BarChart2, Tag,
} from 'lucide-react';
import {
  loadTransportRates,
  saveTransportRates,
  DEFAULT_TRANSPORT_RATES,
  TransportRates,
} from '../lib/transportRates';
import { missingRateFields } from '../lib/transportCostEngine';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Error desconocido';
}

function parseNum(v: string): number | null {
  if (v.trim() === '') return null;
  const n = parseFloat(v.replace(',', '.'));
  return isFinite(n) ? n : null;
}

function fmtNum(v: number | null): string {
  if (v === null) return '';
  return String(v);
}

// ── Sub-componente: campo de tarifa ───────────────────────────────────────────
// Definido FUERA del padre para evitar re-montajes (ver feedback no_inner_components)

interface RateFieldProps {
  label: string;
  unit: string;
  hint?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}

function RateField({ label, unit, hint, value, onChange, disabled }: RateFieldProps) {
  const [showHint, setShowHint] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <label className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</label>
        {hint && (
          <button
            type="button"
            onClick={() => setShowHint(h => !h)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Más información"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {showHint && hint && (
        <p className="text-xs text-blue-900 dark:text-blue-100 bg-blue-100 dark:bg-blue-900/40 rounded-md px-2.5 py-1.5 leading-relaxed">
          {hint}
        </p>
      )}
      <div className="relative flex items-center">
        <input
          type="number"
          min="0"
          step="0.01"
          disabled={disabled}
          value={fmtNum(value)}
          onChange={e => onChange(parseNum(e.target.value))}
          placeholder="Sin configurar"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 pr-20 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <span className="absolute right-3 text-xs font-medium text-gray-500 dark:text-gray-400 pointer-events-none">{unit}</span>
      </div>
    </div>
  );
}

// ── Sub-componente: sección colapsable ────────────────────────────────────────

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, icon, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700/80 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {icon}
          {title}
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          : <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        }
      </button>
      {open && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-gray-900">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ScreenTransporteTarifas({ orgId, showToast }: Props) {
  const [rates, setRates] = useState<TransportRates>(DEFAULT_TRANSPORT_RATES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Ref estable para showToast — evita que cambie la referencia en el efecto de carga
  // (si showToast es inline en el padre, se crea nueva función en cada render;
  // meterla en deps dispararía loadTransportRates en cada render del padre y
  // sobrescribiría los valores que el usuario está editando)
  const showToastRef = useRef(showToast);
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);

  // Cargar tarifas solo cuando cambia orgId, nunca por cambio de showToast
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDirty(false);
    loadTransportRates(orgId)
      .then(r => { if (!cancelled) setRates(r); })
      .catch(e => { if (!cancelled) showToastRef.current(errMsg(e), 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orgId]);

  // Advertir si el usuario intenta cerrar la pestaña con cambios sin guardar
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const update = useCallback((field: keyof TransportRates, value: number | null) => {
    setRates(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  }, []);

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      await saveTransportRates(orgId, rates);
      setDirty(false);
      showToastRef.current('Tarifas guardadas correctamente', 'success');
    } catch (e) {
      showToastRef.current(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const missing = missingRateFields(rates);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Cargando tarifas…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">

      {/* Cabecera */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Tarifas y costes
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
            Configura tus costes internos y tarifas de venta para generar presupuestos precisos.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
        >
          {saving
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Save className="w-4 h-4" />
          }
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {/* Cambios pendientes */}
      {dirty && !saving && (
        <div className="flex items-center gap-2 rounded-lg bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-700 px-4 py-2.5 text-sm text-orange-900 dark:text-orange-100">
          <AlertTriangle className="w-4 h-4 shrink-0 text-orange-600 dark:text-orange-400" />
          <span>Hay cambios sin guardar. Pulsa <strong>Guardar</strong> antes de salir.</span>
        </div>
      )}

      {/* Tarifas incompletas */}
      {missing.length > 0 && !dirty && (
        <div className="flex items-start gap-2.5 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-300 dark:border-yellow-700 px-4 py-3 text-sm text-yellow-900 dark:text-yellow-100">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-yellow-700 dark:text-yellow-400" />
          <div>
            <span className="font-semibold">Configuración incompleta.</span>{' '}
            Sin estos datos el motor no puede calcular precios automáticamente:{' '}
            {missing.join(', ')}.
          </div>
        </div>
      )}

      {/* Todo configurado */}
      {missing.length === 0 && !dirty && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-700 px-4 py-2.5 text-sm text-green-900 dark:text-green-100">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600 dark:text-green-400" />
          Configuración completa — el motor puede calcular precios automáticamente.
        </div>
      )}

      {/* ── Costes por kilómetro ──────────────────────────────────────────── */}
      <Section
        title="Costes por kilómetro"
        icon={<Fuel className="w-4 h-4 text-orange-500" />}
      >
        <RateField
          label="Coste por km (con viajeros)"
          unit="€/km"
          hint="Coste total por kilómetro recorrido con el cliente a bordo. Si usas este campo, no configures también el combustible por separado: se contabilizaría dos veces."
          value={rates.coste_km_comercial}
          onChange={v => update('coste_km_comercial', v)}
        />
        <RateField
          label="Coste por km en vacío"
          unit="€/km"
          hint="Coste por kilómetro sin viajeros: salida de cochera, regreso o reposicionamiento. Suele ser menor. Si no lo configuras, se estima al 70% del coste por km comercial."
          value={rates.coste_km_vacio}
          onChange={v => update('coste_km_vacio', v)}
        />
        <RateField
          label="Consumo del vehículo"
          unit="L/100km"
          hint="Alternativa al coste km directo: si introduces litros/100km y precio del combustible, el motor calcula automáticamente el coste por kilómetro."
          value={rates.consumo_l_100km}
          onChange={v => update('consumo_l_100km', v)}
        />
        <RateField
          label="Precio del combustible"
          unit="€/L"
          hint="Precio actual del combustible. Se usa junto al consumo si no tienes configurado un coste por km fijo."
          value={rates.precio_combustible}
          onChange={v => update('precio_combustible', v)}
        />
      </Section>

      {/* ── Conductor ─────────────────────────────────────────────────────── */}
      <Section
        title="Conductor"
        icon={<User className="w-4 h-4 text-blue-500" />}
      >
        <RateField
          label="Coste conductor por hora"
          unit="€/h"
          hint="Coste hora en jornada ordinaria: incluye nómina bruta y cuota empresarial a la Seguridad Social."
          value={rates.coste_conductor_hora}
          onChange={v => update('coste_conductor_hora', v)}
        />
        <RateField
          label="Coste hora extra conductor"
          unit="€/h"
          hint="Coste para horas fuera de jornada ordinaria (más de 8h diarias). Si no se configura, las horas extra no se calculan."
          value={rates.coste_conductor_hora_extra}
          onChange={v => update('coste_conductor_hora_extra', v)}
        />
        <RateField
          label="Dieta diaria por conductor"
          unit="€/día"
          hint="Importe de la dieta por día de desplazamiento. Solo se aplica en viajes con pernoctaciones definidas."
          value={rates.dieta_conductor_dia}
          onChange={v => update('dieta_conductor_dia', v)}
        />
        <RateField
          label="Alojamiento por conductor/noche"
          unit="€/noche"
          hint="Importe máximo de alojamiento por noche a cargo de la empresa. Se usa como referencia cuando no se indica el importe real del hotel."
          value={rates.alojamiento_conductor_noche}
          onChange={v => update('alojamiento_conductor_noche', v)}
        />
      </Section>

      {/* ── Vehículo ──────────────────────────────────────────────────────── */}
      <Section
        title="Vehículo"
        icon={<Truck className="w-4 h-4 text-purple-500" />}
      >
        <RateField
          label="Coste fijo del vehículo por día"
          unit="€/día"
          hint="Coste diario del autobús o minibús: amortización, seguro, revisiones periódicas. Se aplica a todos los días del servicio."
          value={rates.coste_vehiculo_dia}
          onChange={v => update('coste_vehiculo_dia', v)}
        />
        <div />
      </Section>

      {/* ── Gastos generales y margen ──────────────────────────────────────── */}
      <Section
        title="Gastos generales y margen comercial"
        icon={<BarChart2 className="w-4 h-4 text-green-600" />}
      >
        <RateField
          label="Gastos generales (%)"
          unit="%"
          hint="Porcentaje aplicado sobre el coste directo para cubrir gastos indirectos: administración, seguros, RRHH. Ejemplo: 10% añade un 10% a todos los costes directos."
          value={rates.overhead_pct}
          onChange={v => update('overhead_pct', v)}
        />
        <RateField
          label="Margen comercial (%)"
          unit="%"
          hint="Margen objetivo sobre el precio de VENTA (no sobre el coste). Ejemplo: 20% → precio = coste / (1 − 0,20). Distinto de aplicar un incremento sobre el coste."
          value={rates.margin_pct}
          onChange={v => update('margin_pct', v)}
        />
      </Section>

      {/* ── Tarifas de venta al cliente ────────────────────────────────────── */}
      <Section
        title="Tarifas de venta al cliente"
        icon={<Tag className="w-4 h-4 text-gray-600 dark:text-gray-400" />}
        defaultOpen={false}
      >
        <div className="sm:col-span-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2.5 leading-relaxed">
          Tarifas de venta directas configuradas en el asistente inicial. Son opcionales: el motor puede calcular el precio sugerido a partir de los costes internos y el margen.
        </div>
        <RateField
          label="Precio por kilómetro"
          unit="€/km"
          value={rates.precio_km}
          onChange={v => update('precio_km', v)}
        />
        <RateField
          label="Precio por hora"
          unit="€/h"
          value={rates.precio_hora}
          onChange={v => update('precio_hora', v)}
        />
        <RateField
          label="Precio por jornada completa"
          unit="€/jornada"
          value={rates.precio_jornada}
          onChange={v => update('precio_jornada', v)}
        />
        <RateField
          label="Precio por trayecto"
          unit="€/trayecto"
          value={rates.precio_trayecto}
          onChange={v => update('precio_trayecto', v)}
        />
      </Section>

      {/* Botón guardar inferior (visible cuando hay cambios) */}
      {dirty && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Save className="w-4 h-4" />
            }
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      )}

    </div>
  );
}
