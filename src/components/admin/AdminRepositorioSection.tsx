import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Search, RefreshCw, ExternalLink, Download,
  CheckCircle, Clock, Archive, Filter, X, Upload, Plus,
  Building2, FolderOpen, BarChart2, Eye, Edit2, Trash2,
  Handshake, TrendingUp, Landmark, Target, Briefcase,
  AlertTriangle, ChevronDown, Link2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

interface TradeDocument {
  id: string; nombre: string; descripcion?: string;
  categoria: string; version: string;
  estado: 'vigente' | 'borrador' | 'obsoleto';
  storage_path?: string; bucket?: string; mime_type?: string;
  size?: number; file_hash?: string; tags: string[];
  origen_path?: string; created_at: string; updated_at: string;
  // joined
  _entities?: string[];
}

interface DocStats {
  total: number; byCategoria: Record<string, number>;
  byEstado: Record<string, number>; totalSize: number;
  conEntidad: number; sinEntidad: number;
}

// ── Constantes ─────────────────────────────────────────────────────────────

const CATEGORIAS = [
  { id: '00', folder: '00-maestra',            label: 'Maestra',    full: 'Documentación Maestra',    icon: '📋', color: 'text-amber-400 bg-amber-900/30 border-amber-700' },
  { id: '01', folder: '01-empresa',             label: 'Empresa',    full: 'Empresa e Identidad',      icon: '🏢', color: 'text-blue-400 bg-blue-900/30 border-blue-700' },
  { id: '02', folder: '02-inversores',          label: 'Inversores', full: 'Inversores',               icon: '💰', color: 'text-emerald-400 bg-emerald-900/30 border-emerald-700' },
  { id: '03', folder: '03-subvenciones',        label: 'Subvenc.',   full: 'Subvenciones',             icon: '🏛️', color: 'text-purple-400 bg-purple-900/30 border-purple-700' },
  { id: '04', folder: '04-partners-mayoristas', label: 'Partners',   full: 'Partners & Mayoristas',    icon: '🤝', color: 'text-cyan-400 bg-cyan-900/30 border-cyan-700' },
  { id: '05', folder: '05-clientes-target',     label: 'Clientes',   full: 'Clientes Target',          icon: '👷', color: 'text-orange-400 bg-orange-900/30 border-orange-700' },
  { id: '06', folder: '06-asociaciones',        label: 'Asoc.',      full: 'Asociaciones',             icon: '🔗', color: 'text-indigo-400 bg-indigo-900/30 border-indigo-700' },
  { id: '07', folder: '07-producto',            label: 'Producto',   full: 'Producto',                 icon: '📦', color: 'text-pink-400 bg-pink-900/30 border-pink-700' },
  { id: '08', folder: '08-tecnica',             label: 'Técnica',    full: 'Técnica & Arquitectura',   icon: '⚙️', color: 'text-red-400 bg-red-900/30 border-red-700' },
  { id: '09', folder: '09-operaciones',         label: 'Operac.',    full: 'Operaciones',              icon: '🗓️', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700' },
  { id: '10', folder: '10-marketing',           label: 'Marketing',  full: 'Marketing & Marca',        icon: '📣', color: 'text-rose-400 bg-rose-900/30 border-rose-700' },
  { id: '11', folder: '11-legal',              label: 'Legal',      full: 'Legal',                    icon: '⚖️', color: 'text-slate-300 bg-slate-700/50 border-slate-600' },
  { id: '12', folder: '12-admin-fiscal',        label: 'Admin',      full: 'Admin & Fiscal',           icon: '🗂️', color: 'text-teal-400 bg-teal-900/30 border-teal-700' },
];

const ESTADO_CFG: Record<TradeDocument['estado'], { label: string; color: string; Icon: React.FC<{ className?: string }> }> = {
  vigente:  { label: 'Vigente',  color: 'text-emerald-400 bg-emerald-900/30 border-emerald-700', Icon: CheckCircle },
  borrador: { label: 'Borrador', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700',   Icon: Clock },
  obsoleto: { label: 'Obsoleto', color: 'text-slate-400 bg-slate-700 border-slate-600',         Icon: Archive },
};

const MIME_ICONS: Record<string, string> = {
  'application/pdf': '📄',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '📑',
  'text/plain': '📃', 'text/html': '🌐', 'text/markdown': '📃', 'text/csv': '📊',
  'image/png': '🖼️', 'image/jpeg': '🖼️', 'image/svg+xml': '🖼️',
  'application/zip': '📦',
};

function formatSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ── Upload Modal ───────────────────────────────────────────────────────────

function UploadModal({ entities, onDone, onClose, toast }: {
  entities: { id: string; nombre: string; tipo: string }[];
  onDone: () => void;
  onClose: () => void;
  toast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [categoria, setCategoria] = useState('01');
  const [linkedEntities, setLinkedEntities] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(e.target.files ?? []));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    const catInfo = CATEGORIAS.find(c => c.id === categoria);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(Math.round(((i + 1) / files.length) * 100));

      const slug = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').replace(/[()#&%!?]/g, '');
      const storagePath = `${catInfo?.folder ?? '08-tecnica'}/${slug}`;

      const { error: upErr } = await supabase.storage
        .from('corporate-documents')
        .upload(storagePath, file, { contentType: file.type, upsert: true });

      if (upErr && !upErr.message.includes('already exists')) {
        toast(`Error subiendo ${file.name}`, 'error');
        continue;
      }

      const nombre = file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
      const { data: doc } = await supabase.from('trade_documents').insert({
        nombre, categoria, version: 'v1.0', estado: 'vigente',
        storage_path: storagePath, bucket: 'corporate-documents',
        mime_type: file.type, size: file.size, tags: [catInfo?.label ?? categoria],
      }).select('id').single();

      if (doc && linkedEntities.length > 0) {
        await supabase.from('trade_document_entities').insert(
          linkedEntities.map(eid => ({ document_id: doc.id, entity_id: eid }))
        );
      }
    }

    setUploading(false);
    toast(`${files.length} documento${files.length > 1 ? 's' : ''} subido${files.length > 1 ? 's' : ''}`, 'success');
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-400" /> Subir documentos
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Categoría</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
              {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.id} — {c.full}</option>)}
            </select>
          </div>
          <div>
            <input ref={fileRef} type="file" multiple onChange={handleFiles}
              accept=".pdf,.docx,.xlsx,.xls,.pptx,.ppt,.txt,.png,.jpg,.jpeg,.svg,.zip,.html,.md,.csv"
              className="hidden" />
            <button onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-xl py-8 text-slate-400 hover:text-white transition-colors">
              <Upload className="w-8 h-8" />
              <span className="text-sm font-semibold">
                {files.length > 0 ? `${files.length} archivo${files.length > 1 ? 's' : ''} seleccionado${files.length > 1 ? 's' : ''}` : 'Seleccionar archivos'}
              </span>
              {files.length > 0 && (
                <span className="text-xs text-slate-500">{files.map(f => f.name).join(', ').slice(0, 80)}</span>
              )}
            </button>
          </div>
          {entities.length > 0 && (
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Vincular a entidades</label>
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 max-h-32 overflow-y-auto space-y-1">
                {entities.map(e => (
                  <label key={e.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-700/50 rounded px-2 py-0.5">
                    <input type="checkbox" checked={linkedEntities.includes(e.id)}
                      onChange={() => setLinkedEntities(prev => prev.includes(e.id) ? prev.filter(x => x !== e.id) : [...prev, e.id])}
                      className="accent-blue-500" />
                    <span className="text-xs text-white">{e.nombre}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {uploading && (
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Subiendo...</span><span>{progress}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl">Cancelar</button>
          <button onClick={handleUpload} disabled={files.length === 0 || uploading}
            className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl flex items-center gap-2">
            <Upload className="w-3.5 h-3.5" /> {uploading ? 'Subiendo...' : `Subir ${files.length || ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AdminRepositorioSection({ toast }: { toast: (msg: string, type?: 'success' | 'error') => void }) {
  const [docs, setDocs]             = useState<TradeDocument[]>([]);
  const [entities, setEntities]     = useState<{ id: string; nombre: string; tipo: string }[]>([]);
  const [entityLinks, setEntityLinks] = useState<Map<string, string[]>>(new Map()); // docId → entityNames[]
  const [loading, setLoading]       = useState(true);
  const [stats, setStats]           = useState<DocStats | null>(null);

  // Filters
  const [catFilter, setCatFilter]   = useState<string | 'all'>('all');
  const [estadoFilter, setEstadoFilter] = useState<TradeDocument['estado'] | 'all'>('all');
  const [search, setSearch]         = useState('');
  const [view, setView]             = useState<'grid' | 'list'>('list');

  // Modals
  const [showUpload, setShowUpload] = useState(false);
  const [signedUrl, setSignedUrl]   = useState<{ path: string; url: string } | null>(null);
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [docsRes, entitiesRes, linksRes] = await Promise.all([
      supabase.from('trade_documents').select('*').order('categoria').order('nombre'),
      supabase.from('admin_corp_entities').select('id, nombre, tipo'),
      supabase.from('trade_document_entities').select('document_id, entity_id'),
    ]);

    const allDocs: TradeDocument[] = docsRes.data ?? [];
    const allEntities = entitiesRes.data ?? [];
    const allLinks = linksRes.data ?? [];

    // Build entity name lookup
    const entityById = new Map(allEntities.map(e => [e.id, e.nombre]));
    const linkMap = new Map<string, string[]>();
    allLinks.forEach(l => {
      const names = linkMap.get(l.document_id) ?? [];
      const name = entityById.get(l.entity_id);
      if (name) names.push(name);
      linkMap.set(l.document_id, names);
    });

    setDocs(allDocs);
    setEntities(allEntities);
    setEntityLinks(linkMap);

    // Compute stats
    const byCategoria: Record<string, number> = {};
    const byEstado: Record<string, number> = {};
    let totalSize = 0; let conEntidad = 0;
    allDocs.forEach(d => {
      byCategoria[d.categoria] = (byCategoria[d.categoria] ?? 0) + 1;
      byEstado[d.estado] = (byEstado[d.estado] ?? 0) + 1;
      totalSize += d.size ?? 0;
      if (linkMap.has(d.id)) conEntidad++;
    });
    setStats({ total: allDocs.length, byCategoria, byEstado, totalSize, conEntidad, sinEntidad: allDocs.length - conEntidad });

    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filteredDocs = docs.filter(d => {
    if (catFilter !== 'all' && d.categoria !== catFilter) return false;
    if (estadoFilter !== 'all' && d.estado !== estadoFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return d.nombre.toLowerCase().includes(q)
        || d.descripcion?.toLowerCase().includes(q)
        || d.tags.some(t => t.toLowerCase().includes(q))
        || d.origen_path?.toLowerCase().includes(q);
    }
    return true;
  });

  const handleOpenDoc = async (doc: TradeDocument) => {
    if (!doc.storage_path) return;
    if (signedUrl?.path === doc.storage_path) { window.open(signedUrl.url, '_blank'); return; }
    setLoadingUrl(doc.id);
    const { data, error } = await supabase.storage
      .from(doc.bucket ?? 'corporate-documents')
      .createSignedUrl(doc.storage_path, 3600);
    setLoadingUrl(null);
    if (error || !data?.signedUrl) { toast('Error generando URL de descarga', 'error'); return; }
    setSignedUrl({ path: doc.storage_path, url: data.signedUrl });
    window.open(data.signedUrl, '_blank');
  };

  const totalMB = ((stats?.totalSize ?? 0) / 1048576).toFixed(1);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">Repositorio Documental Corporativo</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Bucket: <code className="text-slate-300">corporate-documents</code>
            {stats && ` · ${stats.total} docs · ${totalMB} MB`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg">
            <Upload className="w-3.5 h-3.5" /> Subir
          </button>
          <button onClick={loadAll} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total docs', value: stats.total, color: 'text-white' },
            { label: 'Vigentes', value: stats.byEstado['vigente'] ?? 0, color: 'text-emerald-400' },
            { label: 'Con entidad', value: stats.conEntidad, color: 'text-blue-400' },
            { label: 'Almacenamiento', value: `${totalMB} MB`, color: 'text-purple-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={`text-xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Categorías pills */}
      {stats && (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setCatFilter('all')}
            className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${catFilter === 'all' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-slate-500'}`}>
            Todos <span className="font-black">{stats.total}</span>
          </button>
          {CATEGORIAS.map(c => {
            const count = stats.byCategoria[c.id] ?? 0;
            if (count === 0 && catFilter !== c.id) return null;
            return (
              <button key={c.id} onClick={() => setCatFilter(catFilter === c.id ? 'all' : c.id)}
                className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${catFilter === c.id ? `${c.color} border-current` : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-slate-500'}`}>
                {c.icon} {c.label} <span className="font-black">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, tag, ruta..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X className="w-3 h-3" /></button>}
        </div>
        <select value={estadoFilter} onChange={e => setEstadoFilter(e.target.value as TradeDocument['estado'] | 'all')}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500">
          <option value="all">Todos los estados</option>
          <option value="vigente">Vigente</option>
          <option value="borrador">Borrador</option>
          <option value="obsoleto">Obsoleto</option>
        </select>
        <span className="text-xs text-slate-500">{filteredDocs.length} resultado{filteredDocs.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Cargando repositorio...</div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-16 text-slate-600">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Sin documentos</p>
          {docs.length === 0 && (
            <div className="mt-4 max-w-md mx-auto bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-left">
              <p className="text-xs font-bold text-slate-300 mb-2">📋 Para importar documentos desde el sistema de archivos:</p>
              <code className="text-[10px] text-emerald-400 block bg-slate-900 rounded-lg px-3 py-2 font-mono">
                npm run import-docs
              </code>
              <p className="text-[10px] text-slate-500 mt-2">
                Escanea <code>docs/</code> recursivamente, sube al bucket <code>corporate-documents</code>,
                crea registros y vincula entidades CRM automáticamente.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredDocs.map(doc => {
            const cat = CATEGORIAS.find(c => c.id === doc.categoria);
            const estadoCfg = ESTADO_CFG[doc.estado];
            const docEntities = entityLinks.get(doc.id) ?? [];
            const mimeIcon = MIME_ICONS[doc.mime_type ?? ''] ?? '📄';
            const isLoadingThis = loadingUrl === doc.id;

            return (
              <div key={doc.id} className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 hover:border-slate-600 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-lg shrink-0">{mimeIcon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      {cat && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${cat.color}`}>
                          {cat.id} {cat.label}
                        </span>
                      )}
                      <span className={`flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border ${estadoCfg.color}`}>
                        <estadoCfg.Icon className="w-2.5 h-2.5" /> {estadoCfg.label}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono bg-slate-700/50 px-1.5 py-0.5 rounded">{doc.version}</span>
                      <span className="text-[9px] text-slate-600">{formatSize(doc.size)}</span>
                    </div>
                    <p className="text-xs font-semibold text-white truncate">{doc.nombre}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {doc.tags.slice(0, 4).map(t => (
                        <span key={t} className="text-[9px] text-slate-500 bg-slate-700/50 px-1 py-0.5 rounded">{t}</span>
                      ))}
                      {docEntities.length > 0 && (
                        <span className="flex items-center gap-1 text-[9px] text-blue-400 font-bold">
                          <Link2 className="w-2.5 h-2.5" /> {docEntities.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {doc.storage_path && (
                      <button onClick={() => handleOpenDoc(doc)} disabled={isLoadingThis}
                        title="Abrir documento"
                        className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50">
                        {isLoadingThis ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Import instructions box — always visible when docs are loaded */}
      {!loading && docs.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-400 mb-1.5">📥 Importar o actualizar documentos</p>
          <p className="text-xs text-slate-500 mb-2">
            Para importar todos los archivos de <code className="text-slate-400">docs/</code> al repositorio (idempotente, sin duplicados):
          </p>
          <code className="text-[10px] text-emerald-400 block bg-slate-900 rounded-lg px-3 py-2 font-mono">
            npm run import-docs
          </code>
          <p className="text-[10px] text-slate-600 mt-1.5">
            Categorización automática · Vinculación CRM · Dedup por hash · Informe detallado
          </p>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          entities={entities}
          onDone={() => { setShowUpload(false); loadAll(); }}
          onClose={() => setShowUpload(false)}
          toast={toast}
        />
      )}
    </div>
  );
}
