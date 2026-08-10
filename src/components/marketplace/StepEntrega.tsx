import { useEffect, useRef, useState, useCallback } from 'react';
import {
  CartProviderSummary,
  SupplierCheckoutConfig, SupplierLocation, SupplierLocationTipo,
  SUPPLIER_LOCATION_TIPO_LABELS,
  DeliveryMethod, PaymentMethod,
  DeliveryAddress, DeliveryOptionPerProvider, BuyerSnapshot,
  DELIVERY_METHOD_LABELS, PAYMENT_METHOD_LABELS,
  getSupplierCheckoutConfigs,
} from '../../lib/api/marketplace-checkout';
import { useSession } from '../../context/SessionContext';

interface Props {
  summary:         CartProviderSummary[];
  initialBuyer:    BuyerSnapshot;
  initialDelivery: Record<string, DeliveryOptionPerProvider>; // restaurado de sesión (RC1-C.6.3 P3/P5)
  onNext:          (delivery: Record<string, DeliveryOptionPerProvider>, buyer: BuyerSnapshot) => void;
  onBack:          () => void;
}

// ─── Dirección vacía ──────────────────────────────────────────────────────────

function emptyAddress(): DeliveryAddress {
  return { calle: '', cp: '', ciudad: '', nombre_contacto: '', telefono_contacto: '' };
}

// ─── Etiqueta del método de entrega ──────────────────────────────────────────

function methodLabel(m: DeliveryMethod, cfg: SupplierCheckoutConfig): string {
  if (m === 'entrega_obra')       return `Entrega en obra · ${cfg.plazo_entrega_dias} días est.`;
  if (m === 'entrega_almacen')    return 'Entrega en almacén/oficina';
  if (m === 'recogida_proveedor') return 'Recogida en tienda del proveedor';
  return 'Pendiente de coordinar con el proveedor';
}

// ─── Formulario de dirección ──────────────────────────────────────────────────

interface AddressFormProps {
  addr:     DeliveryAddress;
  onChange: (a: DeliveryAddress) => void;
}

function AddressForm({ addr, onChange }: AddressFormProps) {
  const set = (k: keyof DeliveryAddress, v: string) => onChange({ ...addr, [k]: v });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Calle y número <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={addr.calle}
            onChange={e => set('calle', e.target.value)}
            placeholder="Calle Mayor, 1"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            CP <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={addr.cp}
            onChange={e => set('cp', e.target.value)}
            placeholder="28001"
            maxLength={10}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Ciudad <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={addr.ciudad}
            onChange={e => set('ciudad', e.target.value)}
            placeholder="Madrid"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Provincia</label>
          <input
            type="text"
            value={addr.provincia ?? ''}
            onChange={e => set('provincia', e.target.value)}
            placeholder="Madrid"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Persona de contacto <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={addr.nombre_contacto}
            onChange={e => set('nombre_contacto', e.target.value)}
            placeholder="Juan García"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Teléfono de entrega <span className="text-red-400">*</span>
          </label>
          <input
            type="tel"
            value={addr.telefono_contacto}
            onChange={e => set('telefono_contacto', e.target.value)}
            placeholder="600 000 000"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Franja horaria</label>
          <input
            type="text"
            value={addr.franja_horaria ?? ''}
            onChange={e => set('franja_horaria', e.target.value)}
            placeholder="08:00 - 14:00"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Instrucciones de acceso</label>
          <input
            type="text"
            value={addr.instrucciones ?? ''}
            onChange={e => set('instrucciones', e.target.value)}
            placeholder="Portal B, código 1234"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sección de un proveedor ──────────────────────────────────────────────────

interface ProviderSectionProps {
  summary:    CartProviderSummary;
  config:     SupplierCheckoutConfig | null;
  option:     DeliveryOptionPerProvider;
  onChange:   (o: DeliveryOptionPerProvider) => void;
  applyToAll: () => void;
  isFirst:    boolean;
}

function ProviderSection({ summary, config, option, onChange, applyToAll, isFirst }: ProviderSectionProps) {
  const availableMethods: DeliveryMethod[] = [];
  if (config?.permite_entrega !== false) {
    availableMethods.push('entrega_obra', 'entrega_almacen');
  }
  const pickupLocations = (config?.supplier_locations ?? []).filter(l => l.permite_recogida);
  if (config?.permite_recogida && pickupLocations.length > 0) {
    availableMethods.push('recogida_proveedor');
  }
  if (config?.permite_coordinar !== false) {
    availableMethods.push('por_coordinar');
  }
  if (availableMethods.length === 0) availableMethods.push('entrega_obra');

  const payMethods = (config?.payment_methods_allowed ?? ['cuenta_proveedor', 'transferencia']) as PaymentMethod[];

  const needsAddress = option.delivery_method === 'entrega_obra' || option.delivery_method === 'entrega_almacen';
  const needsPickup  = option.delivery_method === 'recogida_proveedor';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header proveedor */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{summary.actor_nombre}</span>
            {summary.actor_verificado && (
              <svg className="h-4 w-4 text-teal-500 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-label="Verificado">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {summary.items_count} artículo{summary.items_count !== 1 ? 's' : ''} · {summary.total_estimado.toFixed(2)} €
          </p>
        </div>
        {!isFirst && (
          <button
            onClick={applyToAll}
            className="shrink-0 text-xs text-teal-600 hover:text-teal-500 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded px-2 py-1 hover:bg-teal-50 dark:hover:bg-teal-950/30 transition-colors"
          >
            Usar misma dirección que el primero
          </button>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Método de entrega */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Método de entrega</p>
          <div className="space-y-2">
            {availableMethods.map(m => (
              <label key={m} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                option.delivery_method === m
                  ? 'border-teal-400 bg-teal-50 dark:bg-teal-950/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}>
                <input
                  type="radio"
                  name={`method-${summary.actor_id}`}
                  value={m}
                  checked={option.delivery_method === m}
                  onChange={() => onChange({
                    ...option,
                    delivery_method: m,
                    pickup_point_id:          m === 'recogida_proveedor' ? (option.pickup_point_id ?? null) : null,
                    pickup_location_id:       m === 'recogida_proveedor' ? (option.pickup_location_id ?? null) : null,
                    pickup_location_snapshot: m === 'recogida_proveedor' ? (option.pickup_location_snapshot ?? null) : null,
                    delivery_address: (m === 'entrega_obra' || m === 'entrega_almacen')
                      ? (option.delivery_address ?? emptyAddress())
                      : undefined,
                  })}
                  className="mt-0.5 accent-teal-600"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {methodLabel(m, config ?? {
                    actor_id: summary.actor_id,
                    actor_nombre: summary.actor_nombre,
                    actor_verificado: summary.actor_verificado,
                    permite_entrega: true,
                    permite_recogida: false,
                    permite_coordinar: true,
                    payment_methods_allowed: payMethods,
                    portes_gratis_desde: summary.portes === 0 ? 0 : null,
                    coste_portes: summary.portes,
                    plazo_entrega_dias: summary.delivery_days,
                    plazo_confirmacion_h: 24,
                    mensaje_instaladores: null,
                    pickup_points:      [],
                    supplier_locations: [],
                  })}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Formulario dirección (si entrega) */}
        {needsAddress && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Dirección de entrega</p>
            <AddressForm
              addr={option.delivery_address ?? emptyAddress()}
              onChange={addr => onChange({ ...option, delivery_address: addr })}
            />
          </div>
        )}

        {/* Selector de location de recogida (RC1-C.5A.2) */}
        {needsPickup && pickupLocations.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Selecciona dónde recoger</p>
            <div className="space-y-2">
              {pickupLocations.map(loc => (
                <label key={loc.id} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  option.pickup_location_id === loc.id
                    ? 'border-teal-400 bg-teal-50 dark:bg-teal-950/30'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name={`pickup-${summary.actor_id}`}
                    value={loc.id}
                    checked={option.pickup_location_id === loc.id}
                    onChange={() => onChange({
                      ...option,
                      pickup_location_id:       loc.id,
                      pickup_location_snapshot: loc,
                      pickup_point_id:          null, // FK a trade_marketplace_supplier_pickup_points — tabla vacía
                    })}
                    className="mt-1 accent-teal-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{loc.nombre}</p>
                      <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        {SUPPLIER_LOCATION_TIPO_LABELS[loc.tipo as SupplierLocationTipo] ?? loc.tipo}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {[loc.direccion_linea1, loc.localidad, loc.provincia].filter(Boolean).join(', ')}
                      {loc.telefono ? ` · ${loc.telefono}` : ''}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Método de pago */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Forma de pago</p>
          <div className="flex flex-wrap gap-2">
            {payMethods.map(pm => (
              <button
                key={pm}
                onClick={() => onChange({ ...option, payment_method: pm })}
                aria-pressed={option.payment_method === pm}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                  option.payment_method === pm
                    ? 'border-teal-400 bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                {PAYMENT_METHOD_LABELS[pm]}
              </button>
            ))}
          </div>
        </div>

        {/* Notas al proveedor */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Notas al proveedor (opcional)</label>
          <textarea
            value={option.notas ?? ''}
            onChange={e => onChange({ ...option, notas: e.target.value })}
            rows={2}
            placeholder="Instrucciones especiales, número de cliente, referencia de obra..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sección datos del comprador ──────────────────────────────────────────────

interface BuyerSectionProps {
  buyer:    BuyerSnapshot;
  onChange: (b: BuyerSnapshot) => void;
}

function BuyerSection({ buyer, onChange }: BuyerSectionProps) {
  const set = (k: keyof BuyerSnapshot, v: string) => onChange({ ...buyer, [k]: v });

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Datos del comprador</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nombre / Empresa</label>
          <input type="text" value={buyer.empresa} onChange={e => set('empresa', e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">NIF / CIF</label>
          <input type="text" value={buyer.nif} onChange={e => set('nif', e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Email</label>
          <input type="email" value={buyer.email} onChange={e => set('email', e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Teléfono</label>
          <input type="tel" value={buyer.telefono} onChange={e => set('telefono', e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mt-3">
        Estos datos se enviarán a cada proveedor junto con el pedido. Solo verán los datos necesarios para procesarlo.
      </p>
    </div>
  );
}

// ─── Validación ───────────────────────────────────────────────────────────────

function validateOption(opt: DeliveryOptionPerProvider): string | null {
  const needsAddr = opt.delivery_method === 'entrega_obra' || opt.delivery_method === 'entrega_almacen';
  if (needsAddr) {
    const a = opt.delivery_address;
    if (!a?.calle?.trim())             return 'Falta la calle de entrega';
    if (!a?.cp?.trim())                return 'Falta el código postal';
    if (!a?.ciudad?.trim())            return 'Falta la ciudad';
    if (!a?.nombre_contacto?.trim())   return 'Falta la persona de contacto';
    if (!a?.telefono_contacto?.trim()) return 'Falta el teléfono de entrega';
  }
  if (opt.delivery_method === 'recogida_proveedor' && !opt.pickup_location_id && !opt.pickup_point_id) {
    return 'Selecciona un punto de recogida';
  }
  if (!opt.payment_method) return 'Selecciona una forma de pago';
  return null;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function StepEntrega({ summary, initialBuyer, initialDelivery, onNext, onBack }: Props) {
  const { org } = useSession();

  // Captura initialDelivery sólo en el primer montaje — no debe reaccionar a cambios posteriores
  const seedRef = useRef(initialDelivery);

  const [configs,    setConfigs]    = useState<SupplierCheckoutConfig[]>([]);
  const [loadingCfg, setLoadingCfg] = useState(true);
  const [buyer,      setBuyer]      = useState<BuyerSnapshot>(initialBuyer);
  const [options,    setOptions]    = useState<Record<string, DeliveryOptionPerProvider>>({});
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [proceeding, setProceeding] = useState(false);

  // Inicializar opciones por proveedor — prioridad: elección del usuario > sesión restaurada > default
  useEffect(() => {
    setOptions(prev => {
      const next: Record<string, DeliveryOptionPerProvider> = {};
      summary.forEach(s => {
        next[s.actor_id] =
          prev[s.actor_id]                 // elección ya hecha por el usuario (máxima prioridad)
          ?? seedRef.current[s.actor_id]   // restaurado desde sesión persistida
          ?? {                             // valor por defecto
            delivery_method: 'entrega_obra',
            delivery_address: {
              calle:             '',
              cp:                '',
              ciudad:            '',
              nombre_contacto:   org?.nombre ?? '',
              telefono_contacto: org?.telefono ?? '',
            },
            payment_method: 'cuenta_proveedor',
          };
      });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, org]);

  // Cargar configs de los proveedores
  useEffect(() => {
    const actorIds = summary.map(s => s.actor_id);
    if (actorIds.length === 0) return;
    setLoadingCfg(true);
    getSupplierCheckoutConfigs(actorIds)
      .then(setConfigs)
      .catch(() => setConfigs([]))
      .finally(() => setLoadingCfg(false));
  }, [summary]);

  const configMap = Object.fromEntries(configs.map(c => [c.actor_id, c]));

  const updateOption = useCallback((actorId: string, opt: DeliveryOptionPerProvider) => {
    setOptions(prev => ({ ...prev, [actorId]: opt }));
    setErrors(prev => { const next = { ...prev }; delete next[actorId]; return next; });
  }, []);

  // "Usar misma dirección que el primero"
  const applyFirstToAll = useCallback((targetActorId: string) => {
    const firstActorId = summary[0]?.actor_id;
    if (!firstActorId || firstActorId === targetActorId) return;
    const first = options[firstActorId];
    if (!first) return;
    setOptions(prev => ({
      ...prev,
      [targetActorId]: {
        ...prev[targetActorId],
        delivery_method:  first.delivery_method,
        delivery_address: first.delivery_address ? { ...first.delivery_address } : undefined,
      },
    }));
  }, [summary, options]);

  const handleNext = () => {
    const newErrors: Record<string, string> = {};
    summary.forEach(s => {
      const opt = options[s.actor_id];
      if (!opt) { newErrors[s.actor_id] = 'Selecciona un método de entrega'; return; }
      const err = validateOption(opt);
      if (err) newErrors[s.actor_id] = err;
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    if (proceeding) return;
    setProceeding(true);
    onNext(options, buyer);
  };

  if (loadingCfg) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl p-4 pb-6 space-y-6">

          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Entrega y pago</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Se crearán {summary.length} pedido{summary.length !== 1 ? 's' : ''}, uno por proveedor. Configura la entrega de cada uno.
            </p>
          </div>

          {/* Sección por proveedor */}
          {summary.map((s, idx) => (
            <div key={s.actor_id}>
              <ProviderSection
                summary={s}
                config={configMap[s.actor_id] ?? null}
                option={options[s.actor_id] ?? {
                  delivery_method: 'entrega_obra',
                  delivery_address: emptyAddress(),
                  payment_method:  'cuenta_proveedor',
                }}
                onChange={opt => updateOption(s.actor_id, opt)}
                applyToAll={() => applyFirstToAll(s.actor_id)}
                isFirst={idx === 0}
              />
              {errors[s.actor_id] && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1" role="alert">
                  <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                  {errors[s.actor_id]}
                </p>
              )}
            </div>
          ))}

          {/* Datos del comprador */}
          <BuyerSection buyer={buyer} onChange={setBuyer} />

        </div>
      </div>

      {/* CTA sticky */}
      <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-4 py-3 safe-area-bottom">
        <div className="mx-auto max-w-2xl flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            ← Revisar carrito
          </button>
          <button
            onClick={handleNext}
            disabled={proceeding}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {proceeding ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
            ) : null}
            {proceeding ? 'Cargando...' : 'Revisar pedido →'}
          </button>
        </div>
      </div>
    </div>
  );
}
