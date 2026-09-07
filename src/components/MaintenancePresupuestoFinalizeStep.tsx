import { useState, useEffect } from 'react';
import {
  X, Search, Building2, MapPin, Plus, Loader2, ChevronLeft, AlertTriangle, CheckCircle,
} from 'lucide-react';
import {
  loadClients, addClient, loadClientLocations, saveClientLocation,
  loadClientMaintenanceHistory, buildDireccionSnapshot, saveMaintenancePresupuesto,
} from '../lib/supabase';
import type {
  TradeClient, ClientLocation, ClientMaintenanceHistorialItem,
  MaintenancePresupuesto, MaintenancePresupuestoDraft,
} from '../lib/supabase';

function toastErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Error desconocido';
}

export interface MaintenancePresupuestoFinalizeStepProps {
  draft: MaintenancePresupuestoDraft;
  orgId: string;
  onCancel: () => void;
  onSaved: (presupuesto: MaintenancePresupuesto) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  title?: string;
}

export default function MaintenancePresupuestoFinalizeStep({
  draft, orgId, onCancel, onSaved, showToast, title = 'Asignar cliente y ubicación',
}: MaintenancePresupuestoFinalizeStepProps) {

  // ── Client state ──────────────────────────────────────────────────────────────
  const [clients, setClients]             = useState<TradeClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [searchText, setSearchText]       = useState('');
  const [selectedClient, setSelectedClient] = useState<TradeClient | null>(null);
  const [creatingClient, setCreatingClient] = useState(false);
  const [newClientNombre, setNewClientNombre] = useState('');
  const [newClientNif, setNewClientNif]   = useState('');
  const [newClientTel, setNewClientTel]   = useState('');
  const [savingClient, setSavingClient]   = useState(false);

  // ── Location state ────────────────────────────────────────────────────────────
  const [locations, setLocations]         = useState<ClientLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [creatingLocation, setCreatingLocation] = useState(false);
  const [newLocNombre, setNewLocNombre]   = useState('');
  const [newLocCiudad, setNewLocCiudad]   = useState('');
  const [newLocDireccion, setNewLocDireccion] = useState('');
  const [newLocCp, setNewLocCp]           = useState('');
  const [savingLocation, setSavingLocation] = useState(false);

  // ── First confirmation state ──────────────────────────────────────────────────
  const [firstConfirmItems, setFirstConfirmItems] = useState<ClientMaintenanceHistorialItem[] | null>(null);
  const [firstConfirmChecking, setFirstConfirmChecking] = useState(false);

  // ── Save state ────────────────────────────────────────────────────────────────
  const [saving, setSaving]               = useState(false);

  // ── Load clients on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    loadClients(orgId)
      .then(cs => setClients(cs))
      .catch(() => {})
      .finally(() => setLoadingClients(false));
  }, [orgId]);

  // ── Load locations when client changes ────────────────────────────────────────
  useEffect(() => {
    if (!selectedClient) { setLocations([]); setSelectedLocationId(null); return; }
    setLoadingLocations(true);
    loadClientLocations(orgId, selectedClient.id)
      .then(locs => setLocations(locs.filter(l => l.activa)))
      .catch(() => {})
      .finally(() => setLoadingLocations(false));
  }, [orgId, selectedClient]);

  // ── Filtered clients list ─────────────────────────────────────────────────────
  const filteredClients = searchText.trim()
    ? clients.filter(c =>
        c.nombre.toLowerCase().includes(searchText.toLowerCase()) ||
        (c.nif ?? '').toLowerCase().includes(searchText.toLowerCase()),
      )
    : clients.slice(0, 8);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleSelectClient = (c: TradeClient) => {
    setSelectedClient(c);
    setSearchText('');
    setCreatingClient(false);
    setCreatingLocation(false);
    setSelectedLocationId(null);
    setFirstConfirmItems(null);
  };

  const handleCreateClient = async () => {
    if (!newClientNombre.trim()) { showToast('Nombre del cliente obligatorio', 'error'); return; }
    setSavingClient(true);
    try {
      const c = await addClient(orgId, {
        nombre: newClientNombre.trim(),
        nif: newClientNif.trim() || undefined,
        telefono: newClientTel.trim() || undefined,
      });
      setClients(prev => [c, ...prev]);
      handleSelectClient(c);
      setNewClientNombre(''); setNewClientNif(''); setNewClientTel('');
    } catch (e) { showToast(toastErr(e), 'error'); }
    finally { setSavingClient(false); }
  };

  const handleCreateLocation = async () => {
    if (!selectedClient || !newLocNombre.trim()) return;
    if (!newLocCiudad.trim()) { showToast('Zona / Municipio es obligatorio.', 'error'); return; }
    setSavingLocation(true);
    try {
      const loc = await saveClientLocation({
        org_id: orgId, client_id: selectedClient.id,
        nombre: newLocNombre.trim(),
        direccion: newLocDireccion.trim() || null,
        ciudad: newLocCiudad.trim(),
        cp: newLocCp.trim() || null,
        provincia: null, pais: 'ES', notas: null, activa: true,
      });
      setLocations(prev => [...prev, loc]);
      setSelectedLocationId(loc.id);
      setCreatingLocation(false);
      setNewLocNombre(''); setNewLocCiudad(''); setNewLocDireccion(''); setNewLocCp('');
    } catch (e) { showToast(toastErr(e), 'error'); }
    finally { setSavingLocation(false); }
  };

  const doInsert = async (client: TradeClient, loc: ClientLocation) => {
    setSaving(true);
    try {
      const saved = await saveMaintenancePresupuesto(orgId, {
        oficio:                 draft.oficio,
        sector:                 draft.sector,
        plantilla_id:           draft.plantilla_id,
        nombre_cliente:         draft.nombre_cliente || client.nombre,
        descripcion_servicios:  draft.descripcion_servicios,
        cuota_mensual:          draft.cuota_mensual,
        cuota_anual:            draft.cuota_anual,
        tipo_facturacion:       draft.tipo_facturacion,
        sla_nivel:              draft.sla_nivel,
        incluye_preventivos:    draft.incluye_preventivos,
        num_visitas_preventivo: draft.num_visitas_preventivo,
        incluye_guardia:        draft.incluye_guardia,
        materiales_incluidos:   draft.materiales_incluidos,
        texto_libre:            draft.texto_libre,
        ia_json:                draft.ia_json,
        generado_por_ia:        draft.generado_por_ia,
        notas:                  draft.notas,
        estado:                 draft.estado,
        client_id:              client.id,
        location_id:            loc.id,
        direccion_instalacion:  buildDireccionSnapshot(loc) || null,
      });
      onSaved(saved);
    } catch (e) { showToast(toastErr(e), 'error'); }
    finally { setSaving(false); }
  };

  const handleSave = async () => {
    if (!selectedClient) { showToast('Selecciona un cliente', 'error'); return; }
    if (!selectedLocationId) { showToast('Selecciona una ubicación', 'error'); return; }
    const loc = locations.find(l => l.id === selectedLocationId);
    if (!loc) { showToast('Ubicación no encontrada', 'error'); return; }
    if (!loc.ciudad?.trim()) { showToast('La ubicación no tiene Zona / Municipio', 'error'); return; }

    setFirstConfirmChecking(true);
    let historial: ClientMaintenanceHistorialItem[] = [];
    try {
      historial = await loadClientMaintenanceHistory(orgId, selectedClient.id);
    } catch { /* non-critical */ }
    finally { setFirstConfirmChecking(false); }

    if (historial.length > 0) {
      setFirstConfirmItems(historial);
      return;
    }
    await doInsert(selectedClient, loc);
  };

  const selectedLocation = locations.find(l => l.id === selectedLocationId) ?? null;

  // ── First Confirmation overlay ─────────────────────────────────────────────────
  if (firstConfirmItems !== null) {
    const presups   = firstConfirmItems.filter(h => h.type === 'presupuesto').length;
    const contratos = firstConfirmItems.filter(h => h.type === 'contrato').length;
    return (
      <div className="fixed inset-0 z-[70] bg-white flex flex-col">
        <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-slate-100">
          <button onClick={() => setFirstConfirmItems(null)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-sm font-bold text-slate-900">{title}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <div className="text-center space-y-2">
            <p className="font-bold text-slate-900">Cliente con historial de mantenimiento</p>
            <p className="text-sm text-slate-500">
              {selectedClient?.nombre} ya tiene{' '}
              {presups > 0 && `${presups} presupuesto${presups > 1 ? 's' : ''}`}
              {presups > 0 && contratos > 0 && ' y '}
              {contratos > 0 && `${contratos} contrato${contratos > 1 ? 's' : ''}`}
              {' '}de mantenimiento.
            </p>
            <p className="text-sm text-slate-500">¿Deseas crear un nuevo presupuesto igualmente?</p>
          </div>
          <div className="w-full space-y-2">
            <button
              onClick={() => {
                const loc = locations.find(l => l.id === selectedLocationId);
                if (selectedClient && loc) { setFirstConfirmItems(null); void doInsert(selectedClient, loc); }
              }}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Sí, crear presupuesto
            </button>
            <button
              onClick={() => setFirstConfirmItems(null)}
              className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold cursor-pointer hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main FinalizeStep UI ──────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[70] bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-slate-100 shrink-0">
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
          <ChevronLeft className="w-4 h-4 text-slate-500" />
        </button>
        <span className="text-sm font-bold text-slate-900 flex-1">{title}</span>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 space-y-6 pb-32">

        {/* ── Sección: Cliente ── */}
        <section className="space-y-3">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            1. Cliente *
          </p>

          {selectedClient ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{selectedClient.nombre}</p>
                  {selectedClient.nif && <p className="text-[10px] text-blue-600">{selectedClient.nif}</p>}
                </div>
              </div>
              <button
                onClick={() => { setSelectedClient(null); setSearchText(''); setLocations([]); setSelectedLocationId(null); }}
                className="text-[10px] text-blue-600 font-semibold cursor-pointer hover:underline shrink-0"
              >
                Cambiar
              </button>
            </div>
          ) : creatingClient ? (
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3">
              <p className="text-xs font-bold text-slate-700">Nuevo cliente</p>
              <input
                value={newClientNombre} onChange={e => setNewClientNombre(e.target.value)}
                placeholder="Nombre o razón social *"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={newClientNif} onChange={e => setNewClientNif(e.target.value)}
                  placeholder="NIF / CIF (opcional)"
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
                <input
                  value={newClientTel} onChange={e => setNewClientTel(e.target.value)}
                  placeholder="Teléfono (opcional)"
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCreatingClient(false)}
                  className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold cursor-pointer hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleCreateClient()} disabled={savingClient || !newClientNombre.trim()}
                  className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-bold cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {savingClient ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Crear
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {loadingClients ? (
                <div className="flex items-center gap-2 py-3 text-slate-400 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando clientes…
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <input
                      value={searchText} onChange={e => setSearchText(e.target.value)}
                      placeholder="Buscar cliente por nombre o NIF…"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1 max-h-44 overflow-y-auto">
                    {filteredClients.length === 0 && searchText.trim() && (
                      <p className="text-xs text-slate-400 py-2 text-center">Sin resultados</p>
                    )}
                    {filteredClients.map(c => (
                      <button
                        key={c.id} onClick={() => handleSelectClient(c)}
                        className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-100 hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm text-slate-700 font-medium cursor-pointer"
                      >
                        {c.nombre}
                        {c.nif && <span className="ml-2 text-[10px] text-slate-400">{c.nif}</span>}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCreatingClient(true)}
                    className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold cursor-pointer hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Nuevo cliente
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        {/* ── Sección: Ubicación (solo si cliente seleccionado) ── */}
        {selectedClient && (
          <section className="space-y-3">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              2. Ubicación de la instalación *
            </p>

            {selectedLocationId && selectedLocation ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{selectedLocation.nombre}</p>
                    {selectedLocation.ciudad && (
                      <p className="text-[10px] text-emerald-700">{selectedLocation.ciudad}</p>
                    )}
                    {selectedLocation.direccion && (
                      <p className="text-[10px] text-slate-400 truncate">{selectedLocation.direccion}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLocationId(null)}
                  className="text-[10px] text-emerald-700 font-semibold cursor-pointer hover:underline shrink-0"
                >
                  Cambiar
                </button>
              </div>
            ) : creatingLocation ? (
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3">
                <p className="text-xs font-bold text-slate-700">Nueva ubicación</p>
                <input
                  value={newLocNombre} onChange={e => setNewLocNombre(e.target.value)}
                  placeholder="Nombre / referencia (ej: Sede central) *"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
                <input
                  value={newLocCiudad} onChange={e => setNewLocCiudad(e.target.value)}
                  placeholder="Zona / Municipio *"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
                <input
                  value={newLocDireccion} onChange={e => setNewLocDireccion(e.target.value)}
                  placeholder="Dirección (opcional)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
                <input
                  value={newLocCp} onChange={e => setNewLocCp(e.target.value)}
                  placeholder="Código postal (opcional)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setCreatingLocation(false)}
                    className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold cursor-pointer hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => void handleCreateLocation()}
                    disabled={savingLocation || !newLocNombre.trim() || !newLocCiudad.trim()}
                    className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-bold cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {savingLocation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {loadingLocations ? (
                  <div className="flex items-center gap-2 py-3 text-slate-400 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando ubicaciones…
                  </div>
                ) : (
                  <>
                    {locations.length > 0 ? (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {locations.map(loc => (
                          <button
                            key={loc.id} onClick={() => setSelectedLocationId(loc.id)}
                            className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-100 hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <p className="text-sm text-slate-700 font-medium">{loc.nombre}</p>
                            {loc.ciudad && <p className="text-[10px] text-slate-400">{loc.ciudad}</p>}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-1">Este cliente no tiene ubicaciones todavía.</p>
                    )}
                    <button
                      onClick={() => setCreatingLocation(true)}
                      className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold cursor-pointer hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Nueva ubicación
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-white border-t border-slate-100">
        <button
          onClick={() => void handleSave()}
          disabled={saving || firstConfirmChecking || !selectedClient || !selectedLocationId}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          {(saving || firstConfirmChecking)
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <CheckCircle className="w-4 h-4" />}
          {saving ? 'Guardando…' : firstConfirmChecking ? 'Verificando…' : 'Crear presupuesto'}
        </button>
      </div>
    </div>
  );
}
