import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Send, Eye, EyeOff, Paperclip, ChevronDown, ChevronUp,
  CheckCircle, AlertTriangle, RefreshCw, Mail, Hash,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

interface CorpEntity {
  id: string; nombre: string; nombre_legal?: string;
  contacto_nombre?: string; cargo_contacto?: string;
  contacto_email?: string; email_general?: string;
  contacto_tel?: string; telefono_general?: string;
  provincia?: string; tipo: string;
}

interface Template {
  id: string; nombre: string; tipo: string;
  asunto: string; contenido_texto: string; activo: boolean;
}

interface AttachDoc {
  id: string; nombre: string; categoria: string;
  version: string; descripcion?: string;
  storage_path?: string; bucket?: string; mime_type?: string; size?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const VARS = [
  { key: '{{empresa}}',   label: 'Empresa' },
  { key: '{{contacto}}',  label: 'Contacto' },
  { key: '{{cargo}}',     label: 'Cargo' },
  { key: '{{provincia}}', label: 'Provincia' },
  { key: '{{email}}',     label: 'Email' },
  { key: '{{telefono}}',  label: 'Teléfono' },
  { key: '{{fecha}}',     label: 'Fecha' },
];

function substituteVars(text: string, entity: CorpEntity): string {
  const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  return text
    .replace(/\{\{empresa\}\}/gi,   entity.nombre || '')
    .replace(/\{\{contacto\}\}/gi,  entity.contacto_nombre || entity.nombre || '')
    .replace(/\{\{cargo\}\}/gi,     entity.cargo_contacto || '')
    .replace(/\{\{provincia\}\}/gi, entity.provincia || '')
    .replace(/\{\{email\}\}/gi,     entity.contacto_email || entity.email_general || '')
    .replace(/\{\{telefono\}\}/gi,  entity.contacto_tel || entity.telefono_general || '')
    .replace(/\{\{fecha\}\}/gi,     today)
    .replace(/\{\{usuario\}\}/gi,   'Fernando Carbonell');
}

function textToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 16px 0">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

function buildPreviewHtml(bodyText: string, entity: CorpEntity): string {
  const substituted = substituteVars(bodyText, entity);
  const bodyHtml = textToHtml(substituted);
  return `
    <div style="max-width:560px;margin:0 auto;font-family:Arial,sans-serif;font-size:14px">
      <div style="background:#1e3a5f;padding:20px 28px;text-align:center;border-radius:6px 6px 0 0">
        <img src="/LOGO_TRABFLOW.png" alt="TrabFlow" height="44" style="display:block;margin:0 auto"/>
        <p style="color:#93c5fd;font-size:10px;margin:8px 0 0;letter-spacing:2px;text-transform:uppercase">TrabFlow Technologies S.L.</p>
      </div>
      <div style="padding:28px;background:#fff;color:#1e293b;line-height:1.85;border:1px solid #e2e8f0">
        ${bodyHtml}
      </div>
      <div style="background:#f8fafc;padding:20px 28px;border:1px solid #e2e8f0;border-top:2px solid #e2e8f0;border-radius:0 0 6px 6px">
        <p style="margin:0;font-size:13px;color:#1e3a5f;font-weight:700">Fernando Carbonell Cabo</p>
        <p style="margin:2px 0 10px;font-size:11px;color:#64748b">Fundador y CEO · TrabFlow Technologies S.L.</p>
        <p style="margin:1px 0;font-size:11px;color:#475569">📧 contacto@trabflow.com · 🌐 www.trabflow.com · 📞 672 336 572</p>
        <p style="margin:1px 0;font-size:11px;color:#475569">Santander (Cantabria) · España</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0"/>
        <p style="margin:0;font-size:9px;color:#94a3b8">Este correo ha sido enviado por TrabFlow Technologies S.L. Si ha llegado por error rogamos su eliminación.</p>
      </div>
    </div>
  `;
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const CAT_LABELS: Record<string, string> = {
  '00':'Maestra','01':'Empresa','02':'Inversores','03':'Subvenc.',
  '04':'Partners','05':'Clientes','06':'Asoc.','07':'Producto',
  '08':'Técnica','09':'Operac.','10':'Marketing','11':'Legal','12':'Admin',
};

// ── RichTextEditor ─────────────────────────────────────────────────────────

function RichTextEditor({ value, onChange, entity }: {
  value: string;
  onChange: (v: string) => void;
  entity: CorpEntity;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insertVar = (key: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newVal = value.slice(0, start) + key + value.slice(end);
    onChange(newVal);
    setTimeout(() => { el.selectionStart = el.selectionEnd = start + key.length; el.focus(); }, 0);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {VARS.map(v => (
          <button key={v.key} type="button" onClick={() => insertVar(v.key)}
            className="flex items-center gap-1 text-[9px] font-bold text-blue-300 bg-blue-900/30 hover:bg-blue-800/50 border border-blue-700/50 px-1.5 py-1 rounded transition-colors"
            title={`Insertar ${v.key}`}>
            <Hash className="w-2.5 h-2.5" />{v.label}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={10}
        placeholder="Escribe el mensaje aquí. Usa los botones de arriba para insertar variables como {{empresa}} o {{contacto}}."
        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none leading-relaxed font-sans"
      />
      {value.includes('{{') && (
        <p className="text-[10px] text-slate-500">
          Variables detectadas — se sustituirán automáticamente al enviar con los datos de <span className="text-blue-400">{entity.nombre}</span>
        </p>
      )}
    </div>
  );
}

// ── AttachmentPicker ───────────────────────────────────────────────────────

function AttachmentPicker({ selected, onChange, toast }: {
  selected: string[];
  onChange: (ids: string[]) => void;
  toast: (msg: string, type?: 'error') => void;
}) {
  const [docs, setDocs] = useState<AttachDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.from('trade_documents')
      .select('id,nombre,categoria,version,descripcion,storage_path,bucket,mime_type,size')
      .eq('estado', 'vigente').order('categoria').order('nombre')
      .then(({ data, error }) => {
        if (error) { toast('Error cargando documentos', 'error'); return; }
        const docs = data ?? [];
        setDocs(docs);
        // Default: seleccionar dossier gremial v4 si existe
        const defaultDoc = docs.find(d => /dossier_gremial_v4/i.test(d.nombre) || /dossier.*gremial/i.test(d.nombre));
        if (defaultDoc && selected.length === 0) onChange([defaultDoc.id]);
        setLoading(false);
      });
  }, []); // eslint-disable-line

  const filtered = docs.filter(d =>
    !search || d.nombre.toLowerCase().includes(search.toLowerCase()) ||
    d.descripcion?.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  const selectedDocs = docs.filter(d => selected.includes(d.id));

  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 px-3 py-2.5 rounded-xl transition-colors">
        <span className="flex items-center gap-2">
          <Paperclip className="w-3.5 h-3.5 text-slate-400" />
          {selected.length === 0 ? 'Sin adjuntos' : `${selected.length} documento${selected.length > 1 ? 's' : ''} adjunto${selected.length > 1 ? 's' : ''}`}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
      </button>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selectedDocs.map(d => (
            <span key={d.id} className="flex items-center gap-1 text-[10px] font-bold text-blue-300 bg-blue-900/30 border border-blue-700/50 px-2 py-0.5 rounded-full">
              📎 {d.nombre.length > 30 ? d.nombre.slice(0, 30) + '…' : d.nombre}
              <button onClick={() => toggle(d.id)} className="text-blue-400 hover:text-white ml-0.5">×</button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-2 bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-slate-700">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar documentos vigentes..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="max-h-52 overflow-y-auto divide-y divide-slate-700/50">
            {loading ? (
              <p className="text-xs text-slate-500 p-4 text-center">Cargando...</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-slate-600 p-4 text-center">Sin resultados</p>
            ) : filtered.map(d => (
              <label key={d.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-700/40 cursor-pointer">
                <input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggle(d.id)}
                  className="accent-blue-500 w-3.5 h-3.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{d.nombre}</p>
                  <p className="text-[10px] text-slate-500">
                    {CAT_LABELS[d.categoria] ?? d.categoria} · {d.version}
                    {d.size ? ` · ${formatSize(d.size)}` : ''}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── EmailModal (main) ──────────────────────────────────────────────────────

export default function EmailModal({ entity, onClose, onSent, toast }: {
  entity: CorpEntity;
  onClose: () => void;
  onSent: () => void;
  toast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [to, setTo] = useState(entity.contacto_email || entity.email_general || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [allDocs, setAllDocs] = useState<AttachDoc[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load templates
  useEffect(() => {
    supabase.from('email_templates').select('*').eq('activo', true).order('nombre')
      .then(({ data }) => {
        const tpls = data ?? [];
        setTemplates(tpls);
        if (tpls.length > 0) applyTemplate(tpls[0]);
      });
    supabase.from('trade_documents').select('id,nombre,categoria,version,descripcion,storage_path,bucket,mime_type,size')
      .eq('estado', 'vigente').then(({ data }) => setAllDocs(data ?? []));
  }, []); // eslint-disable-line

  const applyTemplate = useCallback((tpl: Template) => {
    setSelectedTemplate(tpl);
    setSubject(tpl.asunto);
    setBody(tpl.contenido_texto);
  }, []);

  const handleSend = async () => {
    if (!to || !subject || !body.trim()) { setError('Destinatario, asunto y mensaje son obligatorios.'); return; }
    setError(null);
    setSending(true);

    // Prepare attachments with full metadata
    const attachmentPaths = allDocs
      .filter(d => attachmentIds.includes(d.id) && d.storage_path)
      .map(d => ({ id: d.id, storage_path: d.storage_path!, bucket: d.bucket ?? 'corporate-documents', nombre: d.nombre, mime_type: d.mime_type }));

    // Substitute variables before sending
    const substitutedBody = substituteVars(body, entity);
    const bodyHtml = textToHtml(substitutedBody);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trade-corp-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          to, cc: cc.trim() || undefined,
          subject: substituteVars(subject, entity),
          body_html: bodyHtml,
          body_text: substitutedBody,
          entity_id: entity.id,
          template_id: selectedTemplate?.id,
          template_nombre: selectedTemplate?.nombre,
          attachment_paths: attachmentPaths,
        }),
      });

      const result = await res.json() as { ok?: boolean; error?: string; message_id?: string };
      if (!res.ok || result.error) throw new Error(result.error ?? 'Error desconocido');

      setSent(true);
      setSending(false);
      toast(`Email enviado a ${to}`, 'success');
      setTimeout(() => { onSent(); onClose(); }, 1800);
    } catch (e) {
      setSending(false);
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast(`Error al enviar: ${msg}`, 'error');
    }
  };

  const previewHtml = buildPreviewHtml(body, entity);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Enviar email</h3>
              <p className="text-[10px] text-slate-500">para {entity.nombre}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${showPreview ? 'bg-slate-700 text-white border-slate-600' : 'text-slate-400 border-slate-700 hover:border-slate-600 hover:text-white'}`}>
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPreview ? 'Ocultar vista previa' : 'Vista previa'}
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className={`flex-1 overflow-hidden flex ${showPreview ? 'divide-x divide-slate-700' : ''}`}>

          {/* Form */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">

            {/* Template selector */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Plantilla</label>
              <div className="flex flex-wrap gap-1.5">
                {templates.map(tpl => (
                  <button key={tpl.id} type="button" onClick={() => applyTemplate(tpl)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${selectedTemplate?.id === tpl.id ? 'bg-blue-600 text-white border-blue-500' : 'text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white'}`}>
                    {tpl.nombre}
                  </button>
                ))}
                <button type="button" onClick={() => { setSelectedTemplate(null); setSubject(''); setBody(''); }}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 text-slate-500 hover:text-white hover:border-slate-500 transition-colors">
                  En blanco
                </button>
              </div>
            </div>

            {/* To / CC */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Destinatario *</label>
                <input value={to} onChange={e => setTo(e.target.value)} type="email"
                  placeholder="email@empresa.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">CC (opcional)</label>
                <input value={cc} onChange={e => setCc(e.target.value)} type="email"
                  placeholder="copia@empresa.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Asunto *</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="Asunto del mensaje"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
            </div>

            {/* Message editor */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Mensaje *</label>
              <RichTextEditor value={body} onChange={setBody} entity={entity} />
            </div>

            {/* Attachments */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Documentos adjuntos</label>
              <AttachmentPicker
                selected={attachmentIds}
                onChange={setAttachmentIds}
                toast={(msg, type) => toast(msg, type)}
              />
            </div>

            {/* Remitente info */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-7 h-7 bg-blue-900/50 border border-blue-700 rounded-full flex items-center justify-center shrink-0">
                <Mail className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">TrabFlow Technologies · contacto@trabflow.com</p>
                <p className="text-[10px] text-slate-500">Siempre se envía desde esta dirección con diseño corporativo</p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3 flex items-center gap-2 text-xs text-red-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
              </div>
            )}

            {/* Sent */}
            {sent && (
              <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-4 py-3 flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" /> Email enviado correctamente
              </div>
            )}
          </div>

          {/* Preview panel */}
          {showPreview && (
            <div className="w-[420px] shrink-0 overflow-y-auto p-6 bg-slate-950">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">Vista previa (con variables sustituidas)</p>
              <div className="rounded-xl overflow-hidden border border-slate-700"
                dangerouslySetInnerHTML={{ __html: previewHtml }} />
              {attachmentIds.length > 0 && (
                <div className="mt-3 bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-400 mb-2">📎 Adjuntos ({attachmentIds.length})</p>
                  {allDocs.filter(d => attachmentIds.includes(d.id)).map(d => (
                    <p key={d.id} className="text-[10px] text-slate-400">· {d.nombre}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-700 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl">
            Cancelar
          </button>

          {!confirm ? (
            <button onClick={() => { setError(null); setConfirm(true); }}
              disabled={!to || !subject || !body.trim() || sending}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl transition-colors">
              <Send className="w-3.5 h-3.5" /> Enviar email
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-400">
                ¿Confirmas el envío a <strong className="text-white">{to}</strong>
                {attachmentIds.length > 0 && ` con ${attachmentIds.length} adjunto${attachmentIds.length > 1 ? 's' : ''}`}?
              </p>
              <button onClick={() => setConfirm(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg">
                Cancelar
              </button>
              <button onClick={handleSend} disabled={sending}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg">
                {sending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                {sending ? 'Enviando...' : 'Sí, enviar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
