import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Plus, Edit2, Trash2, ExternalLink, Search, X,
  Building2, Users, Globe, Mail, Phone, ChevronRight,
  FolderOpen, Link2, Calendar, AlertCircle, CheckCircle,
  Clock, Archive, Tag, Briefcase, TrendingUp, Landmark,
  Handshake, UserCheck, Target, RefreshCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

interface CorpDocument {
  id: string;
  categoria: string;
  nombre: string;
  descripcion?: string;
  version: string;
  file_url?: string;
  estado: 'vigente' | 'borrador' | 'obsoleto';
  tags: string[];
  created_at: string;
  updated_at: string;
  _entities?: CorpEntity[];
}

interface CorpEntity {
  id: string;
  tipo: 'inversor' | 'financiador_publico' | 'partner' | 'asociacion' | 'cliente_target' | 'otro';
  nombre: string;
  estado: 'activo' | 'potencial' | 'negociacion' | 'inactivo' | 'descartado';
  contacto_nombre?: string;
  contacto_email?: string;
  contacto_tel?: string;
  importe_potencial?: number;
  notas?: string;
  proxima_accion?: string;
  proxima_accion_fecha?: string;
  created_at: string;
  updated_at: string;
  _docs?: CorpDocument[];
}

// ── Constantes ─────────────────────────────────────────────────────────────

const CATEGORIAS: { id: string; label: string; short: string; color: string; icon: string }[] = [
  { id: '00', label: 'Documentación Maestra', short: 'Maestra', color: 'text-amber-400 bg-amber-900/30 border-amber-700', icon: '📋' },
  { id: '01', label: 'Empresa e Identidad',    short: 'Empresa',  color: 'text-blue-400 bg-blue-900/30 border-blue-700',    icon: '🏢' },
  { id: '02', label: 'Inversores',              short: 'Inversores', color: 'text-emerald-400 bg-emerald-900/30 border-emerald-700', icon: '💰' },
  { id: '03', label: 'Subvenciones',            short: 'Subvenciones', color: 'text-purple-400 bg-purple-900/30 border-purple-700', icon: '🏛️' },
  { id: '04', label: 'Partners & Mayoristas',   short: 'Partners', color: 'text-cyan-400 bg-cyan-900/30 border-cyan-700',   icon: '🤝' },
  { id: '05', label: 'Clientes Target',         short: 'Clientes', color: 'text-orange-400 bg-orange-900/30 border-orange-700', icon: '👷' },
  { id: '06', label: 'Asociaciones',            short: 'Asoc.',    color: 'text-indigo-400 bg-indigo-900/30 border-indigo-700', icon: '🔗' },
  { id: '07', label: 'Producto',                short: 'Producto', color: 'text-pink-400 bg-pink-900/30 border-pink-700',   icon: '📦' },
  { id: '08', label: 'Técnica & Arquitectura',  short: 'Técnica',  color: 'text-red-400 bg-red-900/30 border-red-700',     icon: '⚙️' },
  { id: '09', label: 'Operaciones',             short: 'Operac.',  color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700', icon: '🗓️' },
  { id: '10', label: 'Marketing & Marca',       short: 'Marketing', color: 'text-rose-400 bg-rose-900/30 border-rose-700', icon: '📣' },
  { id: '11', label: 'Legal',                   short: 'Legal',    color: 'text-slate-300 bg-slate-700/50 border-slate-600', icon: '⚖️' },
  { id: '12', label: 'Admin & Fiscal',          short: 'Admin',    color: 'text-teal-400 bg-teal-900/30 border-teal-700',  icon: '🗂️' },
];

const TIPO_CFG: Record<CorpEntity['tipo'], { label: string; color: string; Icon: React.FC<{ className?: string }> }> = {
  inversor:           { label: 'Inversor',        color: 'text-emerald-400 bg-emerald-900/30 border-emerald-700', Icon: TrendingUp },
  financiador_publico:{ label: 'Financiador',     color: 'text-purple-400 bg-purple-900/30 border-purple-700',   Icon: Landmark },
  partner:            { label: 'Partner',          color: 'text-cyan-400 bg-cyan-900/30 border-cyan-700',         Icon: Handshake },
  asociacion:         { label: 'Asociación',       color: 'text-indigo-400 bg-indigo-900/30 border-indigo-700',   Icon: Users },
  cliente_target:     { label: 'Cliente target',   color: 'text-orange-400 bg-orange-900/30 border-orange-700',  Icon: Target },
  otro:               { label: 'Otro',             color: 'text-slate-400 bg-slate-700 border-slate-600',         Icon: Briefcase },
};

const ESTADO_DOC_CFG: Record<CorpDocument['estado'], { label: string; color: string; Icon: React.FC<{ className?: string }> }> = {
  vigente:  { label: 'Vigente',  color: 'text-emerald-400 bg-emerald-900/30 border-emerald-700', Icon: CheckCircle },
  borrador: { label: 'Borrador', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700',   Icon: Clock },
  obsoleto: { label: 'Obsoleto', color: 'text-slate-400 bg-slate-700 border-slate-600',         Icon: Archive },
};

const ESTADO_ENTITY_CFG: Record<CorpEntity['estado'], { label: string; color: string }> = {
  activo:      { label: 'Activo',      color: 'text-emerald-400 bg-emerald-900/30 border-emerald-700' },
  potencial:   { label: 'Potencial',   color: 'text-blue-400 bg-blue-900/30 border-blue-700' },
  negociacion: { label: 'En nego.',    color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700' },
  inactivo:    { label: 'Inactivo',    color: 'text-slate-400 bg-slate-700 border-slate-600' },
  descartado:  { label: 'Descartado', color: 'text-red-400 bg-red-900/30 border-red-700' },
};

const EMPTY_DOC: Omit<CorpDocument, 'id' | 'created_at' | 'updated_at'> = {
  categoria: '01', nombre: '', descripcion: '', version: 'v1.0',
  file_url: '', estado: 'vigente', tags: [],
};

const EMPTY_ENTITY: Omit<CorpEntity, 'id' | 'created_at' | 'updated_at'> = {
  tipo: 'inversor', nombre: '', estado: 'potencial',
  contacto_nombre: '', contacto_email: '', contacto_tel: '',
  importe_potencial: undefined, notas: '', proxima_accion: '', proxima_accion_fecha: '',
};

// ── Doc Modal ──────────────────────────────────────────────────────────────

function DocModal({
  doc, entities, onSave, onClose,
}: {
  doc: Partial<CorpDocument> | null;
  entities: CorpEntity[];
  onSave: () => void;
  onClose: () => void;
}) {
  const isNew = !doc?.id;
  const [form, setForm] = useState({ ...EMPTY_DOC, ...doc });
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (doc?.id) {
      supabase.from('admin_corp_doc_entities').select('entity_id').eq('doc_id', doc.id)
        .then(({ data }) => setLinkedIds((data ?? []).map(r => r.entity_id)));
    }
  }, [doc?.id]);

  const toggleEntity = (id: string) =>
    setLinkedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) {
      setForm(f => ({ ...f, tags: [...f.tags, t] }));
    }
    setTagInput('');
  };

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.categoria) return;
    setSaving(true);
    const payload = {
      categoria: form.categoria,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion?.trim() || null,
      version: form.version || 'v1.0',
      file_url: form.file_url?.trim() || null,
      estado: form.estado,
      tags: form.tags,
    };

    let docId = doc?.id;
    if (isNew) {
      const { data, error } = await supabase.from('admin_corp_documents').insert(payload).select('id').single();
      if (error || !data) { setSaving(false); return; }
      docId = data.id;
    } else {
      await supabase.from('admin_corp_documents').update(payload).eq('id', docId!);
    }

    // Sync pivot
    await supabase.from('admin_corp_doc_entities').delete().eq('doc_id', docId!);
    if (linkedIds.length > 0) {
      await supabase.from('admin_corp_doc_entities').insert(linkedIds.map(eid => ({ doc_id: docId!, entity_id: eid })));
    }

    setSaving(false);
    onSave();
  };

  const catInfo = CATEGORIAS.find(c => c.id === form.categoria);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="font-bold text-white text-base">{isNew ? 'Nuevo documento' : 'Editar documento'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Categoría */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Categoría</label>
            <select
              value={form.categoria}
              onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {CATEGORIAS.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.id} — {c.label}</option>
              ))}
            </select>
          </div>

          {/* Nombre + Versión */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Nombre *</label>
              <input
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="TF_INVERSORES_Pitch_Deck_v2.0"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Versión</label>
              <input
                value={form.version}
                onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                placeholder="v1.0"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Descripción</label>
            <textarea
              value={form.descripcion ?? ''}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              rows={2}
              placeholder="Breve descripción del contenido y propósito"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* URL + Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">URL / Enlace</label>
              <input
                value={form.file_url ?? ''}
                onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))}
                placeholder="https://drive.google.com/..."
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Estado</label>
              <select
                value={form.estado}
                onChange={e => setForm(f => ({ ...f, estado: e.target.value as CorpDocument['estado'] }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="vigente">Vigente</option>
                <option value="borrador">Borrador</option>
                <option value="obsoleto">Obsoleto</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Tags</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {form.tags.map(t => (
                <span key={t} className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600">
                  {t}
                  <button onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))} className="text-slate-500 hover:text-red-400">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="SODERCAN, ENISA, Q2-2026..."
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button onClick={addTag} className="text-xs font-bold text-blue-400 hover:text-blue-300 px-2">Añadir</button>
            </div>
          </div>

          {/* Entidades vinculadas */}
          {entities.length > 0 && (
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Entidades vinculadas</label>
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1">
                {entities.map(e => {
                  const cfg = TIPO_CFG[e.tipo];
                  const checked = linkedIds.includes(e.id);
                  return (
                    <label key={e.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-slate-700/50 rounded-lg px-2 py-1">
                      <input type="checkbox" checked={checked} onChange={() => toggleEntity(e.id)} className="accent-blue-500" />
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs text-white">{e.nombre}</span>
                      {e.estado !== 'activo' && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${ESTADO_ENTITY_CFG[e.estado].color} ml-auto`}>
                          {ESTADO_ENTITY_CFG[e.estado].label}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.nombre.trim()}
            className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl transition-colors"
          >
            {saving ? 'Guardando...' : isNew ? 'Crear documento' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Entity Modal ───────────────────────────────────────────────────────────

function EntityModal({
  entity, onSave, onClose,
}: {
  entity: Partial<CorpEntity> | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const isNew = !entity?.id;
  const [form, setForm] = useState({ ...EMPTY_ENTITY, ...entity });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    const payload = {
      tipo: form.tipo,
      nombre: form.nombre.trim(),
      estado: form.estado,
      contacto_nombre: form.contacto_nombre?.trim() || null,
      contacto_email: form.contacto_email?.trim() || null,
      contacto_tel: form.contacto_tel?.trim() || null,
      importe_potencial: form.importe_potencial || null,
      notas: form.notas?.trim() || null,
      proxima_accion: form.proxima_accion?.trim() || null,
      proxima_accion_fecha: form.proxima_accion_fecha || null,
    };

    if (isNew) {
      await supabase.from('admin_corp_entities').insert(payload);
    } else {
      await supabase.from('admin_corp_entities').update(payload).eq('id', entity!.id!);
    }
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="font-bold text-white text-base">{isNew ? 'Nueva entidad' : 'Editar entidad'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Tipo + Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Tipo *</label>
              <select
                value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as CorpEntity['tipo'] }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {Object.entries(TIPO_CFG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Estado</label>
              <select
                value={form.estado}
                onChange={e => setForm(f => ({ ...f, estado: e.target.value as CorpEntity['estado'] }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {Object.entries(ESTADO_ENTITY_CFG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Nombre *</label>
            <input
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej. SODERCAN, OBRAMAT, CONAIF..."
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Contacto */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Persona de contacto</label>
            <div className="grid grid-cols-1 gap-2">
              <input
                value={form.contacto_nombre ?? ''}
                onChange={e => setForm(f => ({ ...f, contacto_nombre: e.target.value }))}
                placeholder="Nombre y apellidos"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={form.contacto_email ?? ''}
                  onChange={e => setForm(f => ({ ...f, contacto_email: e.target.value }))}
                  placeholder="email@ejemplo.com"
                  type="email"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <input
                  value={form.contacto_tel ?? ''}
                  onChange={e => setForm(f => ({ ...f, contacto_tel: e.target.value }))}
                  placeholder="+34 600 000 000"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Importe potencial (solo inversores/financiadores) */}
          {(form.tipo === 'inversor' || form.tipo === 'financiador_publico') && (
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                {form.tipo === 'inversor' ? 'Importe potencial (€)' : 'Subvención estimada (€)'}
              </label>
              <input
                type="number"
                value={form.importe_potencial ?? ''}
                onChange={e => setForm(f => ({ ...f, importe_potencial: e.target.value ? parseFloat(e.target.value) : undefined }))}
                placeholder="50000"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Próxima acción */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Próxima acción</label>
              <input
                value={form.proxima_accion ?? ''}
                onChange={e => setForm(f => ({ ...f, proxima_accion: e.target.value }))}
                placeholder="Enviar propuesta, llamar, reunión..."
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Fecha</label>
              <input
                type="date"
                value={form.proxima_accion_fecha ?? ''}
                onChange={e => setForm(f => ({ ...f, proxima_accion_fecha: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Notas internas</label>
            <textarea
              value={form.notas ?? ''}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              rows={3}
              placeholder="Historial de contacto, condiciones, observaciones..."
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.nombre.trim()}
            className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl transition-colors"
          >
            {saving ? 'Guardando...' : isNew ? 'Crear entidad' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Section ───────────────────────────────────────────────────────────

export default function AdminDocumentosSection({ toast }: { toast: (msg: string, type?: 'success' | 'error') => void }) {
  const [view, setView]             = useState<'documentos' | 'entidades'>('documentos');
  const [docs, setDocs]             = useState<CorpDocument[]>([]);
  const [entities, setEntities]     = useState<CorpEntity[]>([]);
  const [loading, setLoading]       = useState(true);

  // Documentos state
  const [catFilter, setCatFilter]   = useState<string | 'all'>('all');
  const [docSearch, setDocSearch]   = useState('');
  const [estadoFilter, setEstadoFilter] = useState<CorpDocument['estado'] | 'all'>('all');
  const [editDoc, setEditDoc]       = useState<Partial<CorpDocument> | null | false>(false);

  // Entidades state
  const [tipoFilter, setTipoFilter] = useState<CorpEntity['tipo'] | 'all'>('all');
  const [entitySearch, setEntitySearch] = useState('');
  const [editEntity, setEditEntity] = useState<Partial<CorpEntity> | null | false>(false);

  // Delete confirm
  const [deleteDocId, setDeleteDocId]       = useState<string | null>(null);
  const [deleteEntityId, setDeleteEntityId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [docsRes, entitiesRes] = await Promise.all([
      supabase.from('admin_corp_documents').select('*').order('categoria').order('nombre'),
      supabase.from('admin_corp_entities').select('*').order('tipo').order('nombre'),
    ]);
    setDocs(docsRes.data ?? []);
    setEntities(entitiesRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Computed ──────────────────────────────────────────────────────────────

  const filteredDocs = docs.filter(d => {
    if (catFilter !== 'all' && d.categoria !== catFilter) return false;
    if (estadoFilter !== 'all' && d.estado !== estadoFilter) return false;
    if (docSearch) {
      const q = docSearch.toLowerCase();
      return d.nombre.toLowerCase().includes(q) || d.descripcion?.toLowerCase().includes(q) || d.tags.some(t => t.toLowerCase().includes(q));
    }
    return true;
  });

  const filteredEntities = entities.filter(e => {
    if (tipoFilter !== 'all' && e.tipo !== tipoFilter) return false;
    if (entitySearch) {
      const q = entitySearch.toLowerCase();
      return e.nombre.toLowerCase().includes(q) || e.contacto_nombre?.toLowerCase().includes(q) || e.notas?.toLowerCase().includes(q);
    }
    return true;
  });

  const docsByCategory = CATEGORIAS.map(c => ({
    ...c,
    count: docs.filter(d => d.categoria === c.id).length,
  }));

  const entitiesByTipo = Object.entries(TIPO_CFG).map(([k, v]) => ({
    key: k as CorpEntity['tipo'],
    ...v,
    count: entities.filter(e => e.tipo === k).length,
  }));

  // ── Urgencias (próximas acciones vencidas o esta semana) ─────────────────

  const today = new Date().toISOString().split('T')[0];
  const urgentes = entities.filter(e => e.proxima_accion_fecha && e.proxima_accion_fecha <= today && e.estado !== 'inactivo' && e.estado !== 'descartado');

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDeleteDoc = async (id: string) => {
    await supabase.from('admin_corp_documents').delete().eq('id', id);
    toast('Documento eliminado', 'success');
    setDeleteDocId(null);
    loadAll();
  };

  const handleDeleteEntity = async (id: string) => {
    await supabase.from('admin_corp_entities').delete().eq('id', id);
    toast('Entidad eliminada', 'success');
    setDeleteEntityId(null);
    loadAll();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white">Sistema Documental Corporativo</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {docs.length} documentos · {entities.length} entidades CRM
            {urgentes.length > 0 && (
              <span className="ml-2 text-yellow-400 font-bold">· {urgentes.length} acción{urgentes.length > 1 ? 'es' : ''} pendiente{urgentes.length > 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('documentos')}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${view === 'documentos' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            <FileText className="w-3.5 h-3.5" /> Documentos
          </button>
          <button
            onClick={() => setView('entidades')}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${view === 'entidades' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            <Building2 className="w-3.5 h-3.5" /> Entidades CRM
            {urgentes.length > 0 && (
              <span className="bg-yellow-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full">{urgentes.length}</span>
            )}
          </button>
          <button onClick={loadAll} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-500 text-sm">Cargando...</div>
      )}

      {/* ── VISTA DOCUMENTOS ─────────────────────────────────────────────── */}
      {!loading && view === 'documentos' && (
        <div className="space-y-4">
          {/* Stats por categoría */}
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
            <button
              onClick={() => setCatFilter('all')}
              className={`text-center px-2 py-2 rounded-lg border text-[10px] font-bold transition-colors ${catFilter === 'all' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-slate-500'}`}
            >
              Todos<br /><span className="text-base font-black">{docs.length}</span>
            </button>
            {docsByCategory.filter(c => c.count > 0 || catFilter === c.id).map(c => (
              <button
                key={c.id}
                onClick={() => setCatFilter(catFilter === c.id ? 'all' : c.id)}
                className={`text-center px-2 py-2 rounded-lg border text-[10px] font-bold transition-colors ${catFilter === c.id ? `${c.color} border-current` : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-slate-500'}`}
              >
                {c.icon}<br />{c.short}<br /><span className="text-sm font-black">{c.count}</span>
              </button>
            ))}
          </div>

          {/* Barra filtros + acción */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                value={docSearch}
                onChange={e => setDocSearch(e.target.value)}
                placeholder="Buscar por nombre, descripción o tag..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={estadoFilter}
              onChange={e => setEstadoFilter(e.target.value as CorpDocument['estado'] | 'all')}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todos los estados</option>
              <option value="vigente">Vigente</option>
              <option value="borrador">Borrador</option>
              <option value="obsoleto">Obsoleto</option>
            </select>
            <button
              onClick={() => setEditDoc({ categoria: catFilter !== 'all' ? catFilter : '01' })}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo doc
            </button>
          </div>

          {/* Lista de documentos */}
          {filteredDocs.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay documentos{catFilter !== 'all' ? ` en la categoría "${CATEGORIAS.find(c => c.id === catFilter)?.label}"` : ''}</p>
              <button onClick={() => setEditDoc({ categoria: catFilter !== 'all' ? catFilter : '01' })} className="mt-3 text-blue-400 text-xs font-bold hover:text-blue-300">
                + Añadir el primero
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDocs.map(doc => {
                const cat = CATEGORIAS.find(c => c.id === doc.categoria);
                const estadoCfg = ESTADO_DOC_CFG[doc.estado];
                return (
                  <div key={doc.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="text-xl mt-0.5 shrink-0">{cat?.icon ?? '📄'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {cat && (
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${cat.color}`}>
                              {cat.id} {cat.short}
                            </span>
                          )}
                          <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${estadoCfg.color}`}>
                            <estadoCfg.Icon className="w-2.5 h-2.5" /> {estadoCfg.label}
                          </span>
                          <span className="text-[9px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded font-mono">{doc.version}</span>
                        </div>
                        <p className="text-sm font-semibold text-white truncate">{doc.nombre}</p>
                        {doc.descripcion && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{doc.descripcion}</p>
                        )}
                        {doc.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {doc.tags.map(t => (
                              <span key={t} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 border border-slate-600">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {doc.file_url && (
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition-colors"
                            title="Abrir enlace"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => setEditDoc(doc)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteDocId(doc.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── VISTA ENTIDADES CRM ───────────────────────────────────────────── */}
      {!loading && view === 'entidades' && (
        <div className="space-y-4">
          {/* Urgencias */}
          {urgentes.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4">
              <p className="text-xs font-bold text-yellow-400 mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Acciones pendientes ({urgentes.length})
              </p>
              <div className="space-y-1.5">
                {urgentes.map(e => (
                  <div key={e.id} className="flex items-center gap-3 text-xs">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${TIPO_CFG[e.tipo].color}`}>{TIPO_CFG[e.tipo].label}</span>
                    <span className="font-semibold text-white">{e.nombre}</span>
                    <ChevronRight className="w-3 h-3 text-slate-600" />
                    <span className="text-yellow-300">{e.proxima_accion}</span>
                    <span className="text-slate-500 ml-auto">{e.proxima_accion_fecha}</span>
                    <button onClick={() => setEditEntity(e)} className="text-slate-400 hover:text-white">
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats por tipo */}
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-1.5">
            <button
              onClick={() => setTipoFilter('all')}
              className={`text-center px-2 py-2 rounded-lg border text-[10px] font-bold transition-colors ${tipoFilter === 'all' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-slate-500'}`}
            >
              Todos<br /><span className="text-base font-black">{entities.length}</span>
            </button>
            {entitiesByTipo.filter(t => t.count > 0 || tipoFilter === t.key).map(t => (
              <button
                key={t.key}
                onClick={() => setTipoFilter(tipoFilter === t.key ? 'all' : t.key)}
                className={`text-center px-2 py-2 rounded-lg border text-[10px] font-bold transition-colors ${tipoFilter === t.key ? `${t.color}` : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-slate-500'}`}
              >
                <t.Icon className="w-3.5 h-3.5 mx-auto mb-0.5" />
                {t.label.split(' ')[0]}<br /><span className="text-sm font-black">{t.count}</span>
              </button>
            ))}
          </div>

          {/* Barra filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                value={entitySearch}
                onChange={e => setEntitySearch(e.target.value)}
                placeholder="Buscar por nombre, contacto o notas..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => setEditEntity({ tipo: tipoFilter !== 'all' ? tipoFilter as CorpEntity['tipo'] : 'inversor' })}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Nueva entidad
            </button>
          </div>

          {/* Lista entidades */}
          {filteredEntities.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay entidades registradas</p>
              <button onClick={() => setEditEntity({})} className="mt-3 text-blue-400 text-xs font-bold hover:text-blue-300">
                + Añadir la primera
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEntities.map(entity => {
                const tipoCfg = TIPO_CFG[entity.tipo];
                const estadoCfg = ESTADO_ENTITY_CFG[entity.estado];
                const hasPendingAction = entity.proxima_accion_fecha && entity.proxima_accion_fecha <= today && entity.estado !== 'inactivo' && entity.estado !== 'descartado';
                return (
                  <div
                    key={entity.id}
                    className={`bg-slate-800/60 border rounded-xl p-4 hover:border-slate-600 transition-colors ${hasPendingAction ? 'border-yellow-700/50' : 'border-slate-700'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg border ${tipoCfg.color} shrink-0`}>
                        <tipoCfg.Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${tipoCfg.color}`}>{tipoCfg.label}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${estadoCfg.color}`}>{estadoCfg.label}</span>
                          {entity.importe_potencial && (
                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-900/20 border border-emerald-800 px-1.5 py-0.5 rounded">
                              {entity.importe_potencial.toLocaleString('es-ES')} €
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-white">{entity.nombre}</p>
                        {entity.contacto_nombre && (
                          <div className="flex flex-wrap gap-3 mt-1">
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <UserCheck className="w-3 h-3" /> {entity.contacto_nombre}
                            </span>
                            {entity.contacto_email && (
                              <a href={`mailto:${entity.contacto_email}`} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                                <Mail className="w-3 h-3" /> {entity.contacto_email}
                              </a>
                            )}
                            {entity.contacto_tel && (
                              <a href={`tel:${entity.contacto_tel}`} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white">
                                <Phone className="w-3 h-3" /> {entity.contacto_tel}
                              </a>
                            )}
                          </div>
                        )}
                        {entity.proxima_accion && (
                          <div className={`flex items-center gap-1.5 mt-1.5 text-xs ${hasPendingAction ? 'text-yellow-400' : 'text-slate-400'}`}>
                            <Calendar className="w-3 h-3" />
                            <span className="font-medium">{entity.proxima_accion}</span>
                            {entity.proxima_accion_fecha && (
                              <span className="text-slate-500">— {entity.proxima_accion_fecha}</span>
                            )}
                            {hasPendingAction && <span className="text-yellow-400 font-bold text-[9px] ml-1">VENCIDO</span>}
                          </div>
                        )}
                        {entity.notas && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2 italic">{entity.notas}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setEditEntity(entity)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteEntityId(entity.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {editDoc !== false && (
        <DocModal
          doc={editDoc}
          entities={entities}
          onSave={() => { setEditDoc(false); loadAll(); toast('Documento guardado', 'success'); }}
          onClose={() => setEditDoc(false)}
        />
      )}

      {editEntity !== false && (
        <EntityModal
          entity={editEntity}
          onSave={() => { setEditEntity(false); loadAll(); toast('Entidad guardada', 'success'); }}
          onClose={() => setEditEntity(false)}
        />
      )}

      {/* Delete doc confirm */}
      {deleteDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-white mb-2">Eliminar documento</h3>
            <p className="text-sm text-slate-400 mb-5">¿Seguro? Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteDocId(null)} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleDeleteDoc(deleteDocId)} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete entity confirm */}
      {deleteEntityId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-white mb-2">Eliminar entidad</h3>
            <p className="text-sm text-slate-400 mb-5">¿Seguro? Se eliminará también la vinculación con documentos.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteEntityId(null)} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleDeleteEntity(deleteEntityId)} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
