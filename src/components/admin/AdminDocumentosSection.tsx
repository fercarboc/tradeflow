import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Plus, Edit2, Trash2, ExternalLink, Search, X,
  Building2, Mail, Phone, ChevronRight, Globe,
  FolderOpen, Link2, Calendar, AlertCircle, CheckCircle,
  Clock, Archive, Tag, Briefcase, TrendingUp, Landmark,
  Handshake, UserCheck, Target, RefreshCw, ArrowLeft,
  MessageSquare, MapPin, Hash, Upload, Eye, Paperclip,
  FileCheck, Coffee, Video, Send, StickyNote, Zap,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import EmailModal from './EmailModal';

// ── Types ──────────────────────────────────────────────────────────────────

interface CorpDocument {
  id: string; categoria: string; nombre: string;
  descripcion?: string; version: string;
  // trade_documents usa storage_path; file_url es para compatibilidad (URLs directas)
  storage_path?: string; bucket?: string; mime_type?: string; size?: number;
  file_url?: string;
  estado: 'vigente' | 'borrador' | 'obsoleto';
  tags: string[]; created_at: string; updated_at: string;
}

interface CorpEntity {
  id: string;
  tipo: 'inversor' | 'financiador_publico' | 'partner' | 'asociacion' | 'cliente_target' | 'otro';
  nombre: string; nombre_legal?: string; cif?: string;
  estado: 'activo' | 'potencial' | 'negociacion' | 'inactivo' | 'descartado';
  prioridad: 'muy_alta' | 'alta' | 'media' | 'baja';
  web?: string; email_general?: string; telefono_general?: string;
  direccion?: string; cp?: string; localidad?: string; provincia?: string; pais?: string;
  contacto_nombre?: string; cargo_contacto?: string; contacto_email?: string; contacto_tel?: string;
  importe_potencial?: number;
  encaje_tradeflow?: string; notas?: string;
  proxima_accion?: string; proxima_accion_fecha?: string;
  external_key?: string; verificacion?: string;
  fuente_principal?: string; fuente_secundaria?: string; fecha_verificacion?: string;
  created_at: string; updated_at: string;
}

interface CorpInteraction {
  id: string; entity_id: string;
  tipo: 'email' | 'llamada' | 'reunion' | 'whatsapp' | 'documento_enviado' | 'nota' | 'otro';
  fecha: string; asunto: string; cuerpo?: string; resultado?: string;
  created_at: string;
}

interface EntityEmail {
  id: string; entity_id: string; template_nombre?: string;
  to_email: string; cc?: string; subject: string;
  sent_at: string; status: string; attachment_paths?: string[];
}

// ── Constantes ─────────────────────────────────────────────────────────────

const CATEGORIAS = [
  { id: '00', label: 'Documentación Maestra', short: 'Maestra',   color: 'text-amber-400 bg-amber-900/30 border-amber-700',     icon: '📋' },
  { id: '01', label: 'Empresa e Identidad',   short: 'Empresa',   color: 'text-blue-400 bg-blue-900/30 border-blue-700',        icon: '🏢' },
  { id: '02', label: 'Inversores',             short: 'Inversores',color: 'text-emerald-400 bg-emerald-900/30 border-emerald-700',icon: '💰' },
  { id: '03', label: 'Subvenciones',           short: 'Subvenc.',  color: 'text-purple-400 bg-purple-900/30 border-purple-700',  icon: '🏛️' },
  { id: '04', label: 'Partners & Mayoristas',  short: 'Partners',  color: 'text-cyan-400 bg-cyan-900/30 border-cyan-700',        icon: '🤝' },
  { id: '05', label: 'Clientes Target',        short: 'Clientes',  color: 'text-orange-400 bg-orange-900/30 border-orange-700',  icon: '👷' },
  { id: '06', label: 'Asociaciones',           short: 'Asoc.',     color: 'text-indigo-400 bg-indigo-900/30 border-indigo-700',  icon: '🔗' },
  { id: '07', label: 'Producto',               short: 'Producto',  color: 'text-pink-400 bg-pink-900/30 border-pink-700',        icon: '📦' },
  { id: '08', label: 'Técnica & Arquitectura', short: 'Técnica',   color: 'text-red-400 bg-red-900/30 border-red-700',           icon: '⚙️' },
  { id: '09', label: 'Operaciones',            short: 'Operac.',   color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700',  icon: '🗓️' },
  { id: '10', label: 'Marketing & Marca',      short: 'Marketing', color: 'text-rose-400 bg-rose-900/30 border-rose-700',        icon: '📣' },
  { id: '11', label: 'Legal',                  short: 'Legal',     color: 'text-slate-300 bg-slate-700/50 border-slate-600',     icon: '⚖️' },
  { id: '12', label: 'Admin & Fiscal',         short: 'Admin',     color: 'text-teal-400 bg-teal-900/30 border-teal-700',        icon: '🗂️' },
];

const TIPO_CFG: Record<CorpEntity['tipo'], { label: string; color: string; Icon: React.FC<{ className?: string }> }> = {
  inversor:           { label: 'Inversor',       color: 'text-emerald-400 bg-emerald-900/30 border-emerald-700', Icon: TrendingUp },
  financiador_publico:{ label: 'Financiador',    color: 'text-purple-400 bg-purple-900/30 border-purple-700',   Icon: Landmark },
  partner:            { label: 'Partner',         color: 'text-cyan-400 bg-cyan-900/30 border-cyan-700',         Icon: Handshake },
  asociacion:         { label: 'Asociación',      color: 'text-indigo-400 bg-indigo-900/30 border-indigo-700',   Icon: Building2 },
  cliente_target:     { label: 'Cliente target',  color: 'text-orange-400 bg-orange-900/30 border-orange-700',   Icon: Target },
  otro:               { label: 'Otro',            color: 'text-slate-400 bg-slate-700 border-slate-600',         Icon: Briefcase },
};

const PRIORIDAD_CFG: Record<CorpEntity['prioridad'], { label: string; color: string }> = {
  muy_alta: { label: 'Muy alta', color: 'text-red-400 bg-red-900/30 border-red-700' },
  alta:     { label: 'Alta',     color: 'text-orange-400 bg-orange-900/30 border-orange-700' },
  media:    { label: 'Media',    color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700' },
  baja:     { label: 'Baja',     color: 'text-slate-400 bg-slate-700 border-slate-600' },
};

const ESTADO_ENTITY_CFG: Record<CorpEntity['estado'], { label: string; color: string }> = {
  activo:      { label: 'Activo',      color: 'text-emerald-400 bg-emerald-900/30 border-emerald-700' },
  potencial:   { label: 'Potencial',   color: 'text-blue-400 bg-blue-900/30 border-blue-700' },
  negociacion: { label: 'En nego.',    color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700' },
  inactivo:    { label: 'Inactivo',    color: 'text-slate-400 bg-slate-700 border-slate-600' },
  descartado:  { label: 'Descartado', color: 'text-red-400 bg-red-900/30 border-red-700' },
};

const ESTADO_DOC_CFG: Record<CorpDocument['estado'], { label: string; color: string; Icon: React.FC<{ className?: string }> }> = {
  vigente:  { label: 'Vigente',  color: 'text-emerald-400 bg-emerald-900/30 border-emerald-700', Icon: CheckCircle },
  borrador: { label: 'Borrador', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700',   Icon: Clock },
  obsoleto: { label: 'Obsoleto', color: 'text-slate-400 bg-slate-700 border-slate-600',         Icon: Archive },
};

const INTERACCION_CFG: Record<CorpInteraction['tipo'], { label: string; color: string; Icon: React.FC<{ className?: string }> }> = {
  email:              { label: 'Email',          color: 'text-blue-400 bg-blue-900/30 border-blue-700',         Icon: Mail },
  llamada:            { label: 'Llamada',         color: 'text-green-400 bg-green-900/30 border-green-700',      Icon: Phone },
  reunion:            { label: 'Reunión',         color: 'text-purple-400 bg-purple-900/30 border-purple-700',   Icon: Coffee },
  whatsapp:           { label: 'WhatsApp',        color: 'text-emerald-400 bg-emerald-900/30 border-emerald-700',Icon: MessageSquare },
  documento_enviado:  { label: 'Doc. enviado',    color: 'text-cyan-400 bg-cyan-900/30 border-cyan-700',         Icon: Send },
  nota:               { label: 'Nota interna',    color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700',   Icon: StickyNote },
  otro:               { label: 'Otro',            color: 'text-slate-400 bg-slate-700 border-slate-600',         Icon: Zap },
};

// ── CSV Parser ─────────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals: string[] = [];
    let cur = ''; let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { vals.push(cur); cur = ''; }
      else { cur += ch; }
    }
    vals.push(cur);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim().replace(/^"|"$/g, ''); });
    return row;
  }).filter(r => r['external_key'] || r['nombre']);
}

function normalizeTipo(v: string): CorpEntity['tipo'] {
  const m: Record<string, CorpEntity['tipo']> = {
    'asociación': 'asociacion', 'asociacion': 'asociacion',
    'partner': 'partner', 'inversor': 'inversor',
    'financiador': 'financiador_publico', 'financiador_publico': 'financiador_publico',
    'cliente_target': 'cliente_target', 'cliente target': 'cliente_target',
    'otro': 'otro',
  };
  return m[v.toLowerCase()] ?? 'otro';
}

function normalizeEstado(v: string): CorpEntity['estado'] {
  const m: Record<string, CorpEntity['estado']> = {
    'potencial': 'potencial', 'activo': 'activo',
    'negociacion': 'negociacion', 'negociación': 'negociacion',
    'inactivo': 'inactivo', 'descartado': 'descartado',
  };
  return m[v.toLowerCase()] ?? 'potencial';
}

function normalizePrioridad(v: string): CorpEntity['prioridad'] {
  const m: Record<string, CorpEntity['prioridad']> = {
    'muy alta': 'muy_alta', 'muy_alta': 'muy_alta',
    'alta': 'alta', 'media': 'media', 'baja': 'baja',
  };
  return m[v.toLowerCase()] ?? 'media';
}

// ── Doc Modal ──────────────────────────────────────────────────────────────

// ── Open Doc Button (signed URL or direct URL) ─────────────────────────────

function OpenDocButton({ doc, className }: { doc: CorpDocument; className?: string }) {
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    // Direct URL (no bucket involved)
    if (doc.file_url && !doc.storage_path) { window.open(doc.file_url, '_blank'); return; }
    if (!doc.storage_path) return;
    // Direct URL stored in storage_path field (starts with http)
    if (doc.storage_path.startsWith('http')) { window.open(doc.storage_path, '_blank'); return; }
    // Generate signed URL from Supabase Storage
    setLoading(true);
    const bucket = doc.bucket ?? 'corporate-documents';
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(doc.storage_path, 3600);
    setLoading(false);
    if (error || !data?.signedUrl) return;
    window.open(data.signedUrl, '_blank');
  };

  return (
    <button onClick={handleOpen} disabled={loading}
      className={`p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 ${className ?? ''}`}
      title="Abrir documento">
      {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
    </button>
  );
}

function DocModal({ doc, entities, onSave, onClose }: {
  doc: Partial<CorpDocument> | null;
  entities: CorpEntity[];
  onSave: () => void;
  onClose: () => void;
}) {
  const isNew = !doc?.id;
  const [form, setForm] = useState({
    categoria: '01', nombre: '', descripcion: '', version: 'v1.0',
    file_url: '', estado: 'vigente' as CorpDocument['estado'], tags: [] as string[],
    ...doc,
  });
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (doc?.id) {
      supabase.from('trade_document_entities').select('entity_id').eq('document_id', doc.id)
        .then(({ data }) => setLinkedIds((data ?? []).map(r => r.entity_id)));
    }
  }, [doc?.id]);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t] }));
    setTagInput('');
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    const rawUrl = (form.file_url ?? form.storage_path ?? '').trim();
    const payload = {
      categoria: form.categoria, nombre: form.nombre.trim(),
      descripcion: form.descripcion?.trim() || null,
      version: form.version || 'v1.0',
      storage_path: rawUrl || null,
      estado: form.estado, tags: form.tags,
    };
    let docId = doc?.id;
    if (isNew) {
      const { data } = await supabase.from('trade_documents').insert(payload).select('id').single();
      docId = data?.id;
    } else {
      await supabase.from('trade_documents').update(payload).eq('id', docId!);
    }
    if (docId) {
      await supabase.from('trade_document_entities').delete().eq('document_id', docId);
      if (linkedIds.length > 0)
        await supabase.from('trade_document_entities').insert(linkedIds.map(eid => ({ document_id: docId, entity_id: eid })));
    }
    setSaving(false); onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="font-bold text-white text-base">{isNew ? 'Nuevo documento' : 'Editar documento'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Categoría</label>
            <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
              {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.id} — {c.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Nombre *</label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="TF_INVERSORES_Pitch_Deck_v2.0"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Versión</label>
              <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                placeholder="v1.0"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Descripción</label>
            <textarea value={form.descripcion ?? ''} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              rows={2} placeholder="Breve descripción"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">URL / Enlace</label>
              <input value={form.file_url ?? ''} onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))}
                placeholder="https://drive.google.com/..."
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Estado</label>
              <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value as CorpDocument['estado'] }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                <option value="vigente">Vigente</option>
                <option value="borrador">Borrador</option>
                <option value="obsoleto">Obsoleto</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Tags</label>
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {form.tags.map(t => (
                <span key={t} className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600">
                  {t}
                  <button onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))}><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Añadir tag..."
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              <button onClick={addTag} className="text-xs font-bold text-blue-400 hover:text-blue-300 px-2">+</button>
            </div>
          </div>
          {entities.length > 0 && (
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Entidades vinculadas</label>
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 max-h-36 overflow-y-auto space-y-1">
                {entities.map(e => {
                  const cfg = TIPO_CFG[e.tipo];
                  return (
                    <label key={e.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-slate-700/50 rounded-lg px-2 py-1">
                      <input type="checkbox" checked={linkedIds.includes(e.id)} onChange={() =>
                        setLinkedIds(prev => prev.includes(e.id) ? prev.filter(x => x !== e.id) : [...prev, e.id])
                      } className="accent-blue-500" />
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs text-white">{e.nombre}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.nombre.trim()}
            className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl">
            {saving ? 'Guardando...' : isNew ? 'Crear' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Entity Modal ───────────────────────────────────────────────────────────

function EntityModal({ entity, onSave, onClose }: {
  entity: Partial<CorpEntity> | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const isNew = !entity?.id;
  const [form, setForm] = useState<Partial<CorpEntity>>({
    tipo: 'inversor', nombre: '', estado: 'potencial', prioridad: 'media',
    web: '', email_general: '', telefono_general: '',
    contacto_nombre: '', cargo_contacto: '', contacto_email: '', contacto_tel: '',
    encaje_tradeflow: '', notas: '', proxima_accion: '', proxima_accion_fecha: '',
    nombre_legal: '', cif: '', direccion: '', cp: '', localidad: '', provincia: '', pais: 'España',
    ...entity,
  });
  const [saving, setSaving] = useState(false);

  const f = (key: keyof CorpEntity, val: string | number | undefined) => setForm(p => ({ ...p, [key]: val }));

  const handleSave = async () => {
    if (!form.nombre?.trim()) return;
    setSaving(true);
    const payload = {
      tipo: form.tipo, nombre: form.nombre?.trim(), estado: form.estado, prioridad: form.prioridad ?? 'media',
      nombre_legal: form.nombre_legal?.trim() || null, cif: form.cif?.trim() || null,
      web: form.web?.trim() || null, email_general: form.email_general?.trim() || null,
      telefono_general: form.telefono_general?.trim() || null,
      direccion: form.direccion?.trim() || null, cp: form.cp?.trim() || null,
      localidad: form.localidad?.trim() || null, provincia: form.provincia?.trim() || null,
      pais: form.pais?.trim() || 'España',
      contacto_nombre: form.contacto_nombre?.trim() || null,
      cargo_contacto: form.cargo_contacto?.trim() || null,
      contacto_email: form.contacto_email?.trim() || null,
      contacto_tel: form.contacto_tel?.trim() || null,
      importe_potencial: form.importe_potencial || null,
      encaje_tradeflow: form.encaje_tradeflow?.trim() || null,
      notas: form.notas?.trim() || null,
      proxima_accion: form.proxima_accion?.trim() || null,
      proxima_accion_fecha: form.proxima_accion_fecha || null,
    };
    if (isNew) await supabase.from('admin_corp_entities').insert(payload);
    else await supabase.from('admin_corp_entities').update(payload).eq('id', entity!.id!);
    setSaving(false); onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="font-bold text-white text-base">{isNew ? 'Nueva entidad' : 'Editar entidad'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Tipo *</label>
              <select value={form.tipo} onChange={e => f('tipo', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                {Object.entries(TIPO_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Estado</label>
              <select value={form.estado} onChange={e => f('estado', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                {Object.entries(ESTADO_ENTITY_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Prioridad</label>
              <select value={form.prioridad} onChange={e => f('prioridad', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                {Object.entries(PRIORIDAD_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Nombre *</label>
              <input value={form.nombre ?? ''} onChange={e => f('nombre', e.target.value)} placeholder="CONAIF, Saltoki..."
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Nombre legal</label>
              <input value={form.nombre_legal ?? ''} onChange={e => f('nombre_legal', e.target.value)} placeholder="Razón social completa"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">CIF</label>
              <input value={form.cif ?? ''} onChange={e => f('cif', e.target.value)} placeholder="B12345678"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Web</label>
              <input value={form.web ?? ''} onChange={e => f('web', e.target.value)} placeholder="https://..."
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Email general</label>
              <input type="email" value={form.email_general ?? ''} onChange={e => f('email_general', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Teléfono general</label>
              <input value={form.telefono_general ?? ''} onChange={e => f('telefono_general', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Dirección</label>
              <input value={form.direccion ?? ''} onChange={e => f('direccion', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">CP</label>
              <input value={form.cp ?? ''} onChange={e => f('cp', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Localidad</label>
              <input value={form.localidad ?? ''} onChange={e => f('localidad', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="border-t border-slate-700/50 pt-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Persona de contacto</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Nombre</label>
                <input value={form.contacto_nombre ?? ''} onChange={e => f('contacto_nombre', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Cargo</label>
                <input value={form.cargo_contacto ?? ''} onChange={e => f('cargo_contacto', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Email</label>
                <input type="email" value={form.contacto_email ?? ''} onChange={e => f('contacto_email', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Teléfono</label>
                <input value={form.contacto_tel ?? ''} onChange={e => f('contacto_tel', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>
          {(form.tipo === 'inversor' || form.tipo === 'financiador_publico') && (
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Importe potencial (€)</label>
              <input type="number" value={form.importe_potencial ?? ''} onChange={e => f('importe_potencial', e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Próxima acción</label>
              <input value={form.proxima_accion ?? ''} onChange={e => f('proxima_accion', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Fecha</label>
              <input type="date" value={form.proxima_accion_fecha ?? ''} onChange={e => f('proxima_accion_fecha', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Encaje TradeFlow</label>
            <input value={form.encaje_tradeflow ?? ''} onChange={e => f('encaje_tradeflow', e.target.value)}
              placeholder="Por qué es estratégico para TradeFlow"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Notas internas</label>
            <textarea value={form.notas ?? ''} onChange={e => f('notas', e.target.value)} rows={3}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.nombre?.trim()}
            className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl">
            {saving ? 'Guardando...' : isNew ? 'Crear' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Entity Detail Panel ────────────────────────────────────────────────────

function EntityDetailPanel({ entity, docs, onEdit, onEmail, onClose, toast }: {
  entity: CorpEntity;
  docs: CorpDocument[];
  onEdit: () => void;
  onEmail: () => void;
  onClose: () => void;
  toast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [tab, setTab] = useState<'datos' | 'interacciones' | 'documentos' | 'emails'>('interacciones');
  const [interactions, setInteractions] = useState<CorpInteraction[]>([]);
  const [linkedDocs, setLinkedDocs] = useState<string[]>([]);
  const [loadingInter, setLoadingInter] = useState(true);
  const [emailHistory, setEmailHistory] = useState<EntityEmail[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  // Add interaction form
  const [addOpen, setAddOpen] = useState(false);
  const [newInter, setNewInter] = useState<Partial<CorpInteraction>>({
    tipo: 'nota', fecha: new Date().toISOString().split('T')[0], asunto: '', cuerpo: '', resultado: '',
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const hasPendingAction = entity.proxima_accion_fecha && entity.proxima_accion_fecha <= today
    && entity.estado !== 'inactivo' && entity.estado !== 'descartado';

  const loadInteractions = useCallback(async () => {
    setLoadingInter(true);
    const { data } = await supabase.from('admin_corp_interactions')
      .select('*').eq('entity_id', entity.id).order('fecha', { ascending: false });
    setInteractions(data ?? []);
    setLoadingInter(false);
  }, [entity.id]);

  const loadLinkedDocs = useCallback(async () => {
    const { data } = await supabase.from('trade_document_entities').select('document_id').eq('entity_id', entity.id);
    setLinkedDocs((data ?? []).map(r => r.document_id));
  }, [entity.id]);

  const loadEmails = useCallback(async () => {
    setLoadingEmails(true);
    const { data } = await supabase.from('entity_email_history')
      .select('*').eq('entity_id', entity.id).order('sent_at', { ascending: false });
    setEmailHistory(data ?? []);
    setLoadingEmails(false);
  }, [entity.id]);

  useEffect(() => { loadInteractions(); loadLinkedDocs(); }, [loadInteractions, loadLinkedDocs]);
  useEffect(() => { if (tab === 'emails') loadEmails(); }, [tab, loadEmails]);

  const handleAddInteraction = async () => {
    if (!newInter.asunto?.trim()) return;
    setSaving(true);
    await supabase.from('admin_corp_interactions').insert({
      entity_id: entity.id, tipo: newInter.tipo, fecha: newInter.fecha,
      asunto: newInter.asunto?.trim(), cuerpo: newInter.cuerpo?.trim() || null,
      resultado: newInter.resultado?.trim() || null,
    });
    toast('Interacción registrada', 'success');
    setNewInter({ tipo: 'nota', fecha: new Date().toISOString().split('T')[0], asunto: '', cuerpo: '', resultado: '' });
    setAddOpen(false); setSaving(false);
    loadInteractions();
  };

  const handleDeleteInteraction = async (id: string) => {
    setDeletingId(id);
    await supabase.from('admin_corp_interactions').delete().eq('id', id);
    setInteractions(prev => prev.filter(i => i.id !== id));
    setDeletingId(null);
  };

  const tipoCfg = TIPO_CFG[entity.tipo];
  const estadoCfg = ESTADO_ENTITY_CFG[entity.estado];
  const prioridadCfg = PRIORIDAD_CFG[entity.prioridad ?? 'media'];
  const entityLinkedDocs = docs.filter(d => linkedDocs.includes(d.id));

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" onClick={onClose} />
      {/* Panel */}
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-700 flex flex-col h-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-slate-700">
          <button onClick={onClose} className="text-slate-400 hover:text-white mt-0.5 shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-1.5 mb-1">
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${tipoCfg.color}`}>{tipoCfg.label}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${estadoCfg.color}`}>{estadoCfg.label}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${prioridadCfg.color}`}>🎯 {prioridadCfg.label}</span>
              {entity.verificacion && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${entity.verificacion === 'Verificado' ? 'text-emerald-400 bg-emerald-900/30 border-emerald-700' : 'text-yellow-400 bg-yellow-900/30 border-yellow-700'}`}>
                  {entity.verificacion === 'Verificado' ? '✓' : '◑'} {entity.verificacion}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-white">{entity.nombre}</h2>
            {entity.nombre_legal && entity.nombre_legal !== entity.nombre && (
              <p className="text-xs text-slate-500">{entity.nombre_legal}</p>
            )}
          </div>
          <button onClick={onEdit} className="text-slate-400 hover:text-white shrink-0">
            <Edit2 className="w-4 h-4" />
          </button>
        </div>

        {/* Contacto rápido */}
        <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-slate-700/50 bg-slate-800/30">
          {entity.web && (
            <a href={entity.web} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium">
              <Globe className="w-3 h-3" /> Web
            </a>
          )}
          {(entity.email_general || entity.contacto_email) && (
            <a href={`mailto:${entity.contacto_email || entity.email_general}`}
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white font-medium">
              <Mail className="w-3 h-3" /> {entity.contacto_email || entity.email_general}
            </a>
          )}
          {(entity.telefono_general || entity.contacto_tel) && (
            <a href={`tel:${entity.contacto_tel || entity.telefono_general}`}
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white font-medium">
              <Phone className="w-3 h-3" /> {entity.contacto_tel || entity.telefono_general}
            </a>
          )}
          <button onClick={onEmail}
            className="ml-auto flex items-center gap-1.5 text-xs font-bold text-blue-300 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-700 px-3 py-1 rounded-lg transition-colors">
            <Send className="w-3 h-3" /> Enviar email
          </button>
        </div>

        {/* Alerta acción pendiente */}
        {hasPendingAction && (
          <div className="mx-5 mt-4 bg-yellow-900/20 border border-yellow-700/40 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-yellow-300">{entity.proxima_accion}</p>
              <p className="text-[10px] text-yellow-500">Fecha: {entity.proxima_accion_fecha} — VENCIDA</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-700 px-5 mt-3 overflow-x-auto">
          {(['interacciones', 'datos', 'documentos', 'emails'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${tab === t ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
              {t === 'interacciones' ? `Historial (${interactions.length})` : t === 'documentos' ? `Docs (${entityLinkedDocs.length})` : t === 'emails' ? `Emails (${emailHistory.length})` : 'Datos'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ─ TAB INTERACCIONES ─ */}
          {tab === 'interacciones' && (
            <div className="p-5 space-y-4">
              {/* Add form */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
                <button onClick={() => setAddOpen(!addOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-slate-300 hover:text-white">
                  <span className="flex items-center gap-2"><Plus className="w-3.5 h-3.5 text-blue-400" /> Registrar interacción</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${addOpen ? 'rotate-180' : ''}`} />
                </button>
                {addOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-700">
                    <div className="grid grid-cols-2 gap-3 pt-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tipo</label>
                        <select value={newInter.tipo} onChange={e => setNewInter(p => ({ ...p, tipo: e.target.value as CorpInteraction['tipo'] }))}
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500">
                          {Object.entries(INTERACCION_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fecha</label>
                        <input type="date" value={newInter.fecha} onChange={e => setNewInter(p => ({ ...p, fecha: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Asunto *</label>
                      <input value={newInter.asunto ?? ''} onChange={e => setNewInter(p => ({ ...p, asunto: e.target.value }))}
                        placeholder="Llamada inicial, envío de pitch, reunión..."
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Detalle</label>
                      <textarea value={newInter.cuerpo ?? ''} onChange={e => setNewInter(p => ({ ...p, cuerpo: e.target.value }))}
                        rows={2} placeholder="Contenido de la conversación, documentos enviados..."
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Resultado / Siguiente paso</label>
                      <input value={newInter.resultado ?? ''} onChange={e => setNewInter(p => ({ ...p, resultado: e.target.value }))}
                        placeholder="Pendiente respuesta, enviaron propuesta, reunión agendada..."
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setAddOpen(false)} className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg">Cancelar</button>
                      <button onClick={handleAddInteraction} disabled={saving || !newInter.asunto?.trim()}
                        className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-1.5 rounded-lg">
                        {saving ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Historial */}
              {loadingInter ? (
                <div className="text-center py-6 text-slate-500 text-xs">Cargando historial...</div>
              ) : interactions.length === 0 ? (
                <div className="text-center py-10 text-slate-600">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Sin interacciones registradas</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {interactions.map(inter => {
                    const cfg = INTERACCION_CFG[inter.tipo];
                    return (
                      <div key={inter.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                        <div className="flex items-start gap-2.5">
                          <span className={`flex items-center justify-center w-7 h-7 rounded-lg border shrink-0 ${cfg.color}`}>
                            <cfg.Icon className="w-3.5 h-3.5" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${cfg.color}`}>{cfg.label}</span>
                              <span className="text-[10px] text-slate-500">{inter.fecha}</span>
                            </div>
                            <p className="text-xs font-semibold text-white">{inter.asunto}</p>
                            {inter.cuerpo && <p className="text-xs text-slate-400 mt-0.5">{inter.cuerpo}</p>}
                            {inter.resultado && (
                              <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                                <ChevronRight className="w-3 h-3 shrink-0" /> {inter.resultado}
                              </p>
                            )}
                          </div>
                          <button onClick={() => handleDeleteInteraction(inter.id)} disabled={deletingId === inter.id}
                            className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─ TAB DATOS ─ */}
          {tab === 'datos' && (
            <div className="p-5 space-y-4">
              {entity.encaje_tradeflow && (
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Encaje TradeFlow</p>
                  <p className="text-xs text-blue-200">{entity.encaje_tradeflow}</p>
                </div>
              )}
              {entity.notas && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Notas internas</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{entity.notas}</p>
                </div>
              )}
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-2.5">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Datos de contacto</p>
                {entity.nombre_legal && (
                  <div className="flex gap-2"><Briefcase className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" /><span className="text-xs text-slate-300">{entity.nombre_legal}</span></div>
                )}
                {entity.cif && (
                  <div className="flex gap-2"><Hash className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" /><span className="text-xs text-slate-300">CIF: {entity.cif}</span></div>
                )}
                {entity.web && (
                  <div className="flex gap-2"><Globe className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <a href={entity.web} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 break-all">{entity.web}</a>
                  </div>
                )}
                {entity.email_general && (
                  <div className="flex gap-2"><Mail className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <a href={`mailto:${entity.email_general}`} className="text-xs text-slate-300 hover:text-white break-all">{entity.email_general}</a>
                  </div>
                )}
                {entity.telefono_general && (
                  <div className="flex gap-2"><Phone className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <a href={`tel:${entity.telefono_general}`} className="text-xs text-slate-300 hover:text-white">{entity.telefono_general}</a>
                  </div>
                )}
                {(entity.direccion || entity.localidad) && (
                  <div className="flex gap-2"><MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-300">{[entity.direccion, entity.cp, entity.localidad, entity.provincia].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </div>
              {(entity.contacto_nombre || entity.contacto_email) && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-2.5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Persona de contacto</p>
                  {entity.contacto_nombre && (
                    <div className="flex gap-2"><UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span className="text-xs text-slate-300">{entity.contacto_nombre}{entity.cargo_contacto ? ` — ${entity.cargo_contacto}` : ''}</span>
                    </div>
                  )}
                  {entity.contacto_email && (
                    <div className="flex gap-2"><Mail className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <a href={`mailto:${entity.contacto_email}`} className="text-xs text-blue-400 hover:text-blue-300">{entity.contacto_email}</a>
                    </div>
                  )}
                  {entity.contacto_tel && (
                    <div className="flex gap-2"><Phone className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <a href={`tel:${entity.contacto_tel}`} className="text-xs text-slate-300 hover:text-white">{entity.contacto_tel}</a>
                    </div>
                  )}
                </div>
              )}
              {entity.proxima_accion && (
                <div className={`border rounded-xl p-3 ${hasPendingAction ? 'bg-yellow-900/20 border-yellow-700/40' : 'bg-slate-800/60 border-slate-700'}`}>
                  <p className="text-[10px] font-bold uppercase mb-1 text-slate-500">Próxima acción</p>
                  <p className={`text-xs font-medium ${hasPendingAction ? 'text-yellow-300' : 'text-slate-200'}`}>{entity.proxima_accion}</p>
                  {entity.proxima_accion_fecha && <p className="text-[10px] text-slate-500 mt-0.5">{entity.proxima_accion_fecha}</p>}
                </div>
              )}
              {(entity.fuente_principal || entity.verificacion) && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Trazabilidad</p>
                  {entity.verificacion && <p className="text-xs text-slate-400">Estado: <span className="text-slate-200">{entity.verificacion}</span></p>}
                  {entity.fecha_verificacion && <p className="text-xs text-slate-400">Verificado: {entity.fecha_verificacion}</p>}
                  {entity.fuente_principal && (
                    <a href={entity.fuente_principal} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 break-all">
                      <ExternalLink className="w-3 h-3 shrink-0" /> Fuente principal
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─ TAB DOCUMENTOS ─ */}
          {tab === 'documentos' && (
            <div className="p-5 space-y-3">
              {entityLinkedDocs.length === 0 ? (
                <div className="text-center py-10 text-slate-600">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Sin documentos vinculados</p>
                  <p className="text-[10px] text-slate-600 mt-1">Vincúlalos desde el modal de edición del documento</p>
                </div>
              ) : entityLinkedDocs.map(doc => {
                const cat = CATEGORIAS.find(c => c.id === doc.categoria);
                const estadoCfg = ESTADO_DOC_CFG[doc.estado];
                return (
                  <div key={doc.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 flex items-center gap-3">
                    <span className="text-base shrink-0">{cat?.icon ?? '📄'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-1.5 mb-0.5">
                        {cat && <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${cat.color}`}>{cat.short}</span>}
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${estadoCfg.color}`}>{estadoCfg.label}</span>
                      </div>
                      <p className="text-xs font-medium text-white truncate">{doc.nombre}</p>
                    </div>
                    {(doc.storage_path || doc.file_url) && (
                      <OpenDocButton doc={doc} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ─ TAB EMAILS ─ */}
          {tab === 'emails' && (
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500">Emails enviados a esta entidad</p>
                <button onClick={onEmail}
                  className="flex items-center gap-1.5 text-xs font-bold text-blue-300 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-700 px-3 py-1 rounded-lg transition-colors">
                  <Send className="w-3 h-3" /> Nuevo email
                </button>
              </div>
              {loadingEmails ? (
                <div className="text-center py-8 text-slate-600 text-xs">Cargando...</div>
              ) : emailHistory.length === 0 ? (
                <div className="text-center py-10 text-slate-600">
                  <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Sin emails enviados</p>
                  <button onClick={onEmail}
                    className="mt-3 text-blue-400 text-xs font-bold hover:text-blue-300">
                    Enviar el primero
                  </button>
                </div>
              ) : emailHistory.map(email => (
                <div key={email.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{email.subject}</p>
                      <p className="text-[10px] text-slate-400 truncate">Para: {email.to_email}{email.cc ? ` · CC: ${email.cc}` : ''}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${email.status === 'sent' ? 'text-emerald-400 bg-emerald-900/30 border-emerald-700' : 'text-red-400 bg-red-900/30 border-red-700'}`}>
                      {email.status === 'sent' ? '✓ Enviado' : '✗ Error'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    {email.template_nombre && <span className="flex items-center gap-1"><Hash className="w-2.5 h-2.5" />{email.template_nombre}</span>}
                    {email.attachment_paths && email.attachment_paths.length > 0 && (
                      <span className="flex items-center gap-1"><Paperclip className="w-2.5 h-2.5" />{email.attachment_paths.length} adjunto{email.attachment_paths.length > 1 ? 's' : ''}</span>
                    )}
                    <span className="ml-auto">{new Date(email.sent_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CSV Import Modal ───────────────────────────────────────────────────────

function CSVImportModal({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setRows(parseCSV(text));
      setResult(null);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    let imported = 0; let skipped = 0;

    for (const row of rows) {
      if (!row['nombre'] && !row['external_key']) { skipped++; continue; }
      const payload: Record<string, string | number | null | undefined> = {
        external_key:      row['external_key'] || null,
        tipo:              normalizeTipo(row['tipo'] || ''),
        estado:            normalizeEstado(row['estado'] || ''),
        nombre:            row['nombre'] || row['external_key'],
        nombre_legal:      row['nombre_legal'] || null,
        cif:               row['cif'] || null,
        web:               row['web'] || null,
        email_general:     row['email_general'] || null,
        telefono_general:  row['telefono_general'] || null,
        direccion:         row['direccion'] || null,
        cp:                row['cp'] || null,
        localidad:         row['localidad'] || null,
        provincia:         row['provincia'] || null,
        pais:              row['pais'] || 'España',
        contacto_nombre:   row['persona_contacto'] || row['contacto_nombre'] || null,
        cargo_contacto:    row['cargo_contacto'] || null,
        contacto_email:    row['email_contacto'] || row['contacto_email'] || null,
        contacto_tel:      row['telefono_contacto'] || row['contacto_tel'] || null,
        importe_potencial: row['importe_potencial'] ? parseFloat(row['importe_potencial']) : null,
        proxima_accion:    row['proxima_accion'] || null,
        proxima_accion_fecha: row['fecha_proxima_accion'] || row['proxima_accion_fecha'] || null,
        prioridad:         normalizePrioridad(row['prioridad'] || 'media'),
        encaje_tradeflow:  row['encaje_tradeflow'] || null,
        notas:             row['notas_internas'] || row['notas'] || null,
        fuente_principal:  row['fuente_principal'] || null,
        fuente_secundaria: row['fuente_secundaria'] || null,
        fecha_verificacion:row['fecha_verificacion'] || null,
        verificacion:      row['verificacion'] || 'Sin verificar',
      };

      const { error } = await supabase.from('admin_corp_entities')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(payload as any, { onConflict: 'external_key', ignoreDuplicates: false });

      if (error) skipped++; else imported++;
    }

    setResult({ imported, skipped });
    setImporting(false);
    if (imported > 0) onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-400" /> Importar entidades desde CSV
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-xs text-slate-400 leading-relaxed">
            <p className="font-bold text-slate-300 mb-1">Columnas esperadas (coinciden con el CSV de importación):</p>
            <p className="font-mono text-[10px] text-slate-500">
              external_key, tipo, estado, nombre, nombre_legal, cif, web, email_general, telefono_general, direccion, cp, localidad, provincia, pais, persona_contacto, cargo_contacto, email_contacto, telefono_contacto, importe_potencial, proxima_accion, fecha_proxima_accion, prioridad, encaje_tradeflow, notas_internas, fuente_principal, fuente_secundaria, fecha_verificacion, verificacion
            </p>
            <p className="mt-2 text-emerald-400 font-medium">Si la entidad ya existe (<code>external_key</code> coincide), se actualizan sus datos.</p>
          </div>

          <div>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
            <button onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-xl py-8 text-slate-400 hover:text-white transition-colors">
              <Upload className="w-8 h-8" />
              <span className="text-sm font-semibold">{fileName || 'Seleccionar archivo CSV'}</span>
              {rows.length > 0 && (
                <span className="text-xs text-emerald-400 font-bold">{rows.length} entidades detectadas</span>
              )}
            </button>
          </div>

          {/* Preview */}
          {rows.length > 0 && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-700 text-[10px] font-bold text-slate-400 uppercase">Vista previa (primeras 5)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead><tr className="border-b border-slate-700">
                    {['external_key', 'nombre', 'tipo', 'estado', 'prioridad'].map(h => (
                      <th key={h} className="text-left px-3 py-1.5 text-slate-500 font-bold">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-b border-slate-700/50">
                        <td className="px-3 py-1.5 text-slate-400 font-mono">{r.external_key}</td>
                        <td className="px-3 py-1.5 text-white font-medium">{r.nombre}</td>
                        <td className="px-3 py-1.5 text-slate-400">{r.tipo}</td>
                        <td className="px-3 py-1.5 text-slate-400">{r.estado}</td>
                        <td className="px-3 py-1.5 text-slate-400">{r.prioridad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className={`rounded-xl p-3 flex items-center gap-3 ${result.skipped > 0 ? 'bg-yellow-900/20 border border-yellow-700/40' : 'bg-emerald-900/20 border border-emerald-700/40'}`}>
              <CheckCircle className={`w-4 h-4 shrink-0 ${result.skipped > 0 ? 'text-yellow-400' : 'text-emerald-400'}`} />
              <p className="text-xs text-slate-300">
                <span className="font-bold text-white">{result.imported} importadas</span>
                {result.skipped > 0 && <span className="text-yellow-400"> · {result.skipped} con error</span>}
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl">Cerrar</button>
          <button onClick={handleImport} disabled={rows.length === 0 || importing}
            className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl flex items-center gap-2">
            <Upload className="w-3.5 h-3.5" /> {importing ? 'Importando...' : `Importar ${rows.length} entidades`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Section ───────────────────────────────────────────────────────────

export default function AdminDocumentosSection({ toast }: { toast: (msg: string, type?: 'success' | 'error') => void }) {
  const [view, setView]         = useState<'documentos' | 'entidades'>('entidades');
  const [docs, setDocs]         = useState<CorpDocument[]>([]);
  const [entities, setEntities] = useState<CorpEntity[]>([]);
  const [loading, setLoading]   = useState(true);

  // Documentos
  const [catFilter, setCatFilter]       = useState<string | 'all'>('all');
  const [docSearch, setDocSearch]       = useState('');
  const [estadoFilter, setEstadoFilter] = useState<CorpDocument['estado'] | 'all'>('all');
  const [editDoc, setEditDoc]           = useState<Partial<CorpDocument> | null | false>(false);
  const [deleteDocId, setDeleteDocId]   = useState<string | null>(null);

  // Entidades
  const [tipoFilter, setTipoFilter]       = useState<CorpEntity['tipo'] | 'all'>('all');
  const [entitySearch, setEntitySearch]   = useState('');
  const [editEntity, setEditEntity]       = useState<Partial<CorpEntity> | null | false>(false);
  const [detailEntity, setDetailEntity]   = useState<CorpEntity | null>(null);
  const [deleteEntityId, setDeleteEntityId] = useState<string | null>(null);
  const [showImport, setShowImport]       = useState(false);
  const [emailEntity, setEmailEntity]     = useState<CorpEntity | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [docsRes, entitiesRes] = await Promise.all([
      supabase.from('trade_documents').select('*').order('categoria').order('nombre'),
      supabase.from('admin_corp_entities').select('*').order('prioridad').order('nombre'),
    ]);
    setDocs(docsRes.data ?? []);
    setEntities(entitiesRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const today = new Date().toISOString().split('T')[0];

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
      return e.nombre.toLowerCase().includes(q) || e.contacto_nombre?.toLowerCase().includes(q) || e.notas?.toLowerCase().includes(q) || e.encaje_tradeflow?.toLowerCase().includes(q);
    }
    return true;
  });

  const urgentes = entities.filter(e =>
    e.proxima_accion_fecha && e.proxima_accion_fecha <= today &&
    e.estado !== 'inactivo' && e.estado !== 'descartado'
  );

  const handleDeleteDoc = async (id: string) => {
    await supabase.from('trade_documents').delete().eq('id', id);
    toast('Documento eliminado', 'success');
    setDeleteDocId(null); loadAll();
  };

  const handleDeleteEntity = async (id: string) => {
    await supabase.from('admin_corp_entities').delete().eq('id', id);
    toast('Entidad eliminada', 'success');
    setDeleteEntityId(null); loadAll();
  };

  const PRIORIDAD_ORDER: Record<string, number> = { muy_alta: 0, alta: 1, media: 2, baja: 3 };
  const sortedEntities = [...filteredEntities].sort((a, b) => (PRIORIDAD_ORDER[a.prioridad ?? 'media'] ?? 2) - (PRIORIDAD_ORDER[b.prioridad ?? 'media'] ?? 2));

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Sistema Documental Corporativo</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {docs.length} documentos · {entities.length} entidades
              {urgentes.length > 0 && <span className="ml-2 text-yellow-400 font-bold">· {urgentes.length} acción{urgentes.length > 1 ? 'es' : ''} pendiente{urgentes.length > 1 ? 's' : ''}</span>}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <button onClick={() => setView('entidades')}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${view === 'entidades' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              <Building2 className="w-3.5 h-3.5" /> CRM
              {urgentes.length > 0 && view !== 'entidades' && <span className="bg-yellow-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full">{urgentes.length}</span>}
            </button>
            <button onClick={() => setView('documentos')}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${view === 'documentos' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              <FileText className="w-3.5 h-3.5" /> Documentos
            </button>
            <div className="w-px h-5 bg-slate-700 mx-0.5" />
            <button onClick={() => { setView('entidades'); setShowImport(true); }}
              className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-700 px-3 py-1.5 rounded-lg transition-colors">
              <Upload className="w-3.5 h-3.5" /> Importar CSV empresas
            </button>
            <button onClick={loadAll} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors" title="Recargar">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {loading && <div className="text-center py-12 text-slate-500 text-sm">Cargando...</div>}

        {/* ── ENTIDADES ── */}
        {!loading && view === 'entidades' && (
          <div className="space-y-4">
            {urgentes.length > 0 && (
              <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4">
                <p className="text-xs font-bold text-yellow-400 mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Acciones pendientes vencidas
                </p>
                <div className="space-y-1.5">
                  {urgentes.map(e => (
                    <div key={e.id} className="flex items-center gap-2 text-xs">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${TIPO_CFG[e.tipo].color}`}>{TIPO_CFG[e.tipo].label}</span>
                      <button onClick={() => setDetailEntity(e)} className="font-semibold text-white hover:text-blue-400">{e.nombre}</button>
                      <ChevronRight className="w-3 h-3 text-slate-600" />
                      <span className="text-yellow-300">{e.proxima_accion}</span>
                      <span className="text-slate-500 ml-auto">{e.proxima_accion_fecha}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filtros tipo */}
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'inversor', 'financiador_publico', 'partner', 'asociacion', 'cliente_target', 'otro'] as const).map(k => {
                const count = k === 'all' ? entities.length : entities.filter(e => e.tipo === k).length;
                if (k !== 'all' && count === 0 && tipoFilter !== k) return null;
                const cfg = k === 'all' ? null : TIPO_CFG[k];
                return (
                  <button key={k} onClick={() => setTipoFilter(k as CorpEntity['tipo'] | 'all')}
                    className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${tipoFilter === k ? (cfg ? cfg.color : 'bg-blue-600 text-white border-blue-500') : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-slate-500'}`}>
                    {cfg && <cfg.Icon className="w-3 h-3" />}
                    {k === 'all' ? 'Todos' : cfg?.label} <span className="font-black">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Barra acciones */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-40">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input value={entitySearch} onChange={e => setEntitySearch(e.target.value)}
                  placeholder="Buscar por nombre, notas, encaje..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
              <button onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-lg transition-colors">
                <Upload className="w-3.5 h-3.5" /> Importar CSV
              </button>
              <button onClick={() => setEditEntity({ tipo: tipoFilter !== 'all' ? tipoFilter as CorpEntity['tipo'] : 'asociacion' })}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg transition-colors">
                <Plus className="w-3.5 h-3.5" /> Nueva entidad
              </button>
            </div>

            {/* Lista */}
            {sortedEntities.length === 0 ? (
              <div className="text-center py-16 text-slate-600">
                <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No hay entidades</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedEntities.map(entity => {
                  const tipoCfg = TIPO_CFG[entity.tipo];
                  const estadoCfg = ESTADO_ENTITY_CFG[entity.estado];
                  const prioridadCfg = PRIORIDAD_CFG[entity.prioridad ?? 'media'];
                  const hasPending = entity.proxima_accion_fecha && entity.proxima_accion_fecha <= today && entity.estado !== 'inactivo' && entity.estado !== 'descartado';
                  return (
                    <div key={entity.id}
                      className={`bg-slate-800/60 border rounded-xl p-4 hover:border-slate-500 transition-colors cursor-pointer ${hasPending ? 'border-yellow-700/50' : 'border-slate-700'}`}
                      onClick={() => setDetailEntity(entity)}>
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg border ${tipoCfg.color} shrink-0`}>
                          <tipoCfg.Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${tipoCfg.color}`}>{tipoCfg.label}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${estadoCfg.color}`}>{estadoCfg.label}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${prioridadCfg.color}`}>{prioridadCfg.label}</span>
                            {entity.verificacion && entity.verificacion !== 'Sin verificar' && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${entity.verificacion === 'Verificado' ? 'text-emerald-400 bg-emerald-900/30 border-emerald-700' : 'text-yellow-400 bg-yellow-900/30 border-yellow-700'}`}>
                                {entity.verificacion === 'Verificado' ? '✓' : '◑'} {entity.verificacion}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-white">{entity.nombre}</p>
                          {entity.encaje_tradeflow && (
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{entity.encaje_tradeflow}</p>
                          )}
                          <div className="flex flex-wrap gap-3 mt-1.5">
                            {(entity.contacto_email || entity.email_general) && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                <Mail className="w-3 h-3" /> {entity.contacto_email || entity.email_general}
                              </span>
                            )}
                            {(entity.contacto_tel || entity.telefono_general) && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                <Phone className="w-3 h-3" /> {entity.contacto_tel || entity.telefono_general}
                              </span>
                            )}
                            {entity.proxima_accion && (
                              <span className={`flex items-center gap-1 text-[10px] ${hasPending ? 'text-yellow-400 font-bold' : 'text-slate-500'}`}>
                                <Calendar className="w-3 h-3" /> {entity.proxima_accion}
                                {entity.proxima_accion_fecha && ` · ${entity.proxima_accion_fecha}`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setEmailEntity(entity)} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition-colors" title="Enviar email">
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditEntity(entity)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteEntityId(entity.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors">
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

        {/* ── DOCUMENTOS ── */}
        {!loading && view === 'documentos' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1">
              {[{ id: 'all', label: 'Todos', short: 'Todos', color: '', icon: '📁', count: docs.length }, ...CATEGORIAS.map(c => ({ ...c, count: docs.filter(d => d.categoria === c.id).length }))].filter(c => c.count > 0 || c.id === 'all' || catFilter === c.id).map(c => (
                <button key={c.id} onClick={() => setCatFilter(catFilter === c.id && c.id !== 'all' ? 'all' : c.id)}
                  className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${catFilter === c.id ? (c.id === 'all' ? 'bg-blue-600 text-white border-blue-500' : `${c.color} border-current`) : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-slate-500'}`}>
                  {c.icon} {c.short} <span className="font-black">{c.count}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-40">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder="Buscar documentos..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
              <select value={estadoFilter} onChange={e => setEstadoFilter(e.target.value as CorpDocument['estado'] | 'all')}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500">
                <option value="all">Todos los estados</option>
                <option value="vigente">Vigente</option>
                <option value="borrador">Borrador</option>
                <option value="obsoleto">Obsoleto</option>
              </select>
              <button onClick={() => setEditDoc({ categoria: catFilter !== 'all' ? catFilter : '01' })}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg transition-colors">
                <Plus className="w-3.5 h-3.5" /> Nuevo doc
              </button>
            </div>
            {filteredDocs.length === 0 ? (
              <div className="text-center py-16 text-slate-600">
                <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No hay documentos</p>
                <button onClick={() => setEditDoc({ categoria: catFilter !== 'all' ? catFilter : '01' })} className="mt-3 text-blue-400 text-xs font-bold hover:text-blue-300">+ Añadir el primero</button>
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
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            {cat && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${cat.color}`}>{cat.id} {cat.short}</span>}
                            <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${estadoCfg.color}`}>
                              <estadoCfg.Icon className="w-2.5 h-2.5" /> {estadoCfg.label}
                            </span>
                            <span className="text-[9px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded font-mono">{doc.version}</span>
                          </div>
                          <p className="text-sm font-semibold text-white truncate">{doc.nombre}</p>
                          {doc.descripcion && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{doc.descripcion}</p>}
                          {doc.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {doc.tags.map(t => <span key={t} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 border border-slate-600">{t}</span>)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {(doc.storage_path || doc.file_url) && <OpenDocButton doc={doc} />}
                          <button onClick={() => setEditDoc(doc)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteDocId(doc.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors">
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
      </div>

      {/* ── Modals & Panels ── */}
      {detailEntity && (
        <EntityDetailPanel
          entity={detailEntity}
          docs={docs}
          onEdit={() => { setEditEntity(detailEntity); setDetailEntity(null); }}
          onEmail={() => { setDetailEntity(null); setEmailEntity(detailEntity); }}
          onClose={() => setDetailEntity(null)}
          toast={toast}
        />
      )}
      {editDoc !== false && (
        <DocModal doc={editDoc} entities={entities}
          onSave={() => { setEditDoc(false); loadAll(); toast('Documento guardado', 'success'); }}
          onClose={() => setEditDoc(false)} />
      )}
      {editEntity !== false && (
        <EntityModal entity={editEntity}
          onSave={() => { setEditEntity(false); loadAll(); toast('Entidad guardada', 'success'); }}
          onClose={() => setEditEntity(false)} />
      )}
      {showImport && (
        <CSVImportModal
          onDone={() => { loadAll(); toast('Importación completada', 'success'); }}
          onClose={() => setShowImport(false)} />
      )}
      {deleteDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-white mb-2">Eliminar documento</h3>
            <p className="text-sm text-slate-400 mb-5">¿Seguro? Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteDocId(null)} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl">Cancelar</button>
              <button onClick={() => handleDeleteDoc(deleteDocId)} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl">Eliminar</button>
            </div>
          </div>
        </div>
      )}
      {deleteEntityId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-white mb-2">Eliminar entidad</h3>
            <p className="text-sm text-slate-400 mb-5">¿Seguro? Se eliminará el historial de interacciones.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteEntityId(null)} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl">Cancelar</button>
              <button onClick={() => handleDeleteEntity(deleteEntityId)} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl">Eliminar</button>
            </div>
          </div>
        </div>
      )}
      {emailEntity && (
        <EmailModal
          entity={emailEntity}
          onClose={() => setEmailEntity(null)}
          onSent={() => { setEmailEntity(null); loadAll(); }}
          toast={toast}
        />
      )}
    </>
  );
}
