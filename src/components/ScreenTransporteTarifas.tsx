import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings, Save, Loader2, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, HelpCircle, Euro,
  Fuel, User, Bed, Truck, BarChart2, Tag,
} from 'lucide-react';
import {
  loadTransportRates,
  saveTransportRates,
  DEFAULT_TRANSPORT_RATES,
  TransportRates,
} from '../lib/transportRates';
import {
  missingRateFields,
} from '../lib/transportCostEngine';

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

// ── Sub-componente: un campo de tarifa ────────────────────────────────────────
// IMPORTANTE: definido fuera del componente padre para evitar re-montajes

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
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        {hint && (
          <button
            type="button"
            onClick={() => setShowHint(h => !h)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Más info"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {showHint && hint && (
        <p className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1">{hint}</p>
      )}
      <div className="relative flex items-center">
        <input
          type="number"
          min="0"
          step="0.01"
          disabled={disabled}
          value={fmtNum(value)}
          onChange={e => onChange(parseNum(e.target.value))}
          placeholder="—"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 pr-12 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <span className="absolute right-3 text-xs text-gray-400 dark:text-gray-500 pointer-events-none">{unit}</span>
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
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
          {icon}
          {title}
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-gray-400" />
          : <ChevronRight className="w-4 h-4 text-gray-400" />
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadTransportRates(orgId)
      .then(r => { if (!cancelled) { setRates(r); setDirty(false); } })
      .catch(e => { if (!cancelled) showToast(errMsg(e), 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orgId, showToast]);

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
      showToast('Tarifas guardadas', 'success');
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const missing = missingRateFields(rates);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Cargando tarifas…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">

      {/* Cabecera */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Tarifas y costes
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Configura tus costes internos y tarifas de venta para generar presupuestos precisos.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
        >
          {saving
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Save className="w-4 h-4" />
          }
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {/* Aviso de campos faltantes */}
      {missing.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-medium">Tarifas incompletas.</span>{' '}
            Faltan: {missing.join(', ')}. Sin ellas no se puede calcular precio automático.
          </div>
        </div>
      )}

      {missing.length === 0 && !dirty && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 px-4 py-2 text-sm text-green-700 dark:text-green-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Tarifas completas — el motor puede calcular precios automáticamente.
        </div>
      )}

      {/* Sección: Costes por kilómetro */}
      <Section
        title="Costes por kilómetro"
        icon={<Fuel className="w-4 h-4 text-orange-500" />}
      >
        <RateField
          label="Coste km comercial"
          unit="€/km"
          hint="Coste por km cuando el cliente viaja en el vehículo. Si lo configuras aquí, NO añadas también combustible por separado (evita doble contabilización)."
          value={rates.coste_km_comercial}
          onChange={v => update('coste_km_comercial', v)}
        />
        <RateField
          label="Coste km en vacío"
          unit="€/km"
          hint="Coste por km de desplazamiento sin viajeros (salida de cochera, retorno). Suele ser menor. Si no lo configuras, se estima al 70% del comercial."
          value={rates.coste_km_vacio}
          onChange={v => update('coste_km_vacio', v)}
        />
        <RateField
          label="Consumo medio"
          unit="L/100km"
          hint="Alternativa a coste km directo: si configuras litros/100km + precio combustible, el motor calcula el coste por km automáticamente."
          value={rates.consumo_l_100km}
          onChange={v => update('consumo_l_100km', v)}
        />
        <RateField
          label="Precio combustible"
          unit="€/L"
          hint="Precio actual del combustible. Úsalo junto con el consumo si no quieres un coste km fijo."
          value={rates.precio_combustible}
          onChange={v => update('precio_combustible', v)}
        />
      </Section>

      {/* Sección: Conductor */}
      <Section
        title="Conductor"
        icon={<User className="w-4 h-4 text-blue-500" />}
      >
        <RateField
          label="Coste hora normal"
          unit="€/h"
          hint="Coste horario del conductor en jornada ordinaria (coste empresa: nómina + SS)."
          value={rates.coste_conductor_hora}
          onChange={v => update('coste_conductor_hora', v)}
        />
        <RateField
          label="Coste hora extra"
          unit="€/h"
          hint="Coste horario para horas fuera de jornada ordinaria (>8h/día). Si no se configura, no se calculan horas extra."
          value={rates.coste_conductor_hora_extra}
          onChange={v => update('coste_conductor_hora_extra', v)}
        />
        <RateField
          label="Dieta diaria"
          unit="€/día"
          hint="Dieta del conductor por día fuera de su base. Solo aplica cuando hay pernoctaciones definidas en el viaje."
          value={rates.dieta_conductor_dia}
          onChange={v => update('dieta_conductor_dia', v)}
        />
        <RateField
          label="Alojamiento por noche"
          unit="€/noche"
          hint="Límite de alojamiento por noche a cargo de la empresa. Se usa como fallback si no se indica el importe real al crear el viaje."
          value={rates.alojamiento_conductor_noche}
          onChange={v => update('alojamiento_conductor_noche', v)}
        />
      </Section>

      {/* Sección: Vehículo */}
      <Section
        title="Vehículo"
        icon={<Truck className="w-4 h-4 text-purple-500" />}
      >
        <RateField
          label="Coste fijo por día"
          unit="€/día"
          hint="Coste diario del vehículo: amortización, seguro, revisiones periódicas. Se aplica por cada día del servicio."
          value={rates.coste_vehiculo_dia}
          onChange={v => update('coste_vehiculo_dia', v)}
        />
        <div />
      </Section>

      {/* Sección: Gastos generales y margen */}
      <Section
        title="Gastos generales y margen"
        icon={<BarChart2 className="w-4 h-4 text-green-500" />}
      >
        <RateField
          label="Overhead (%)"
          unit="%"
          hint="Gastos generales como porcentaje sobre el coste directo: administración, seguros, RRHH. Ej: 10% añade un 10% a todos los costes directos."
          value={rates.overhead_pct}
          onChange={v => update('overhead_pct', v)}
        />
        <RateField
          label="Margen comercial (%)"
          unit="%"
          hint="Margen objetivo sobre precio de VENTA (no sobre coste). Ej: 20% → precio = coste / (1 - 0.20). Distinto de markup sobre coste."
          value={rates.margin_pct}
          onChange={v => update('margin_pct', v)}
        />
      </Section>

      {/* Sección: Tarifas de venta (heredadas del wizard) */}
      <Section
        title="Tarifas de venta al cliente"
        icon={<Tag className="w-4 h-4 text-gray-500" />}
        defaultOpen={false}
      >
        <div className="sm:col-span-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
          Tarifas de venta directas (configuradas en el asistente inicial). Opcionales: el motor puede calcular el precio sugerido a partir de los costes internos y el margen.
        </div>
        <RateField
          label="Precio por km"
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
          label="Precio por jornada"
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

      {/* Botón guardar inferior */}
      {dirty && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
