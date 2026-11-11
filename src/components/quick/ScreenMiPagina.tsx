// Mi página online — editor del instalador (móvil).
import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ExternalLink, Share2, Plus, Trash2, ChevronUp, ChevronDown, ImagePlus, X, Lock } from 'lucide-react';
import {
  loadOwnPublicPage, saveOwnPublicPage, uploadPageImage, emptyPage, slugify, isValidSlug,
} from '../../lib/publicPages';
import type { PublicPage, PreguntaFormulario } from '../../lib/publicPages';

interface Props {
  orgId: string | null;
  isLiveMode: boolean;
  defaults: { nombre: string; oficio: string; whatsapp: string };
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onBack: () => void;
}

const field = 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-teal-700';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative w-14 h-8 rounded-full transition-colors shrink-0 cursor-pointer ${on ? 'bg-teal-700' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${on ? 'left-7' : 'left-1'}`} />
    </button>
  );
}

function Section({ title, desc, on, onToggle, children }: { title: string; desc: string; on?: boolean; onToggle?: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 leading-snug">{desc}</p>
        </div>
        {onToggle && <Toggle on={!!on} onChange={onToggle} label={title} />}
      </div>
      {children && (on === undefined || on) && <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">{children}</div>}
    </section>
  );
}

export default function ScreenMiPagina({ orgId, isLiveMode, defaults, showToast, onBack }: Props) {
  const [page, setPage] = useState<PublicPage | null>(null);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);
  const portfolioRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    if (!orgId || !isLiveMode) { setPage(emptyPage(defaults.nombre, defaults.oficio, defaults.whatsapp)); return; }
    loadOwnPublicPage(orgId)
      .then(p => { if (alive) setPage(p ?? emptyPage(defaults.nombre, defaults.oficio, defaults.whatsapp)); })
      .catch(() => { if (alive) { setPage(emptyPage(defaults.nombre, defaults.oficio, defaults.whatsapp)); showToast('No se pudo cargar tu página', 'error'); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, isLiveMode]);

  if (!page) return <div className="p-8 text-center text-gray-400">Cargando…</div>;

  const update = (patch: Partial<PublicPage>) => { setPage(p => p ? { ...p, ...patch } : p); setSaved(false); };
  const url = `${window.location.origin}/pro/${page.slug}`;

  const save = async (override?: Partial<PublicPage>) => {
    const next = { ...page, ...override };
    if (!isValidSlug(next.slug)) { showToast('La dirección debe tener entre 3 y 60 letras o números', 'error'); return false; }
    if (next.activa && !next.nombre.trim()) { showToast('Escribe el nombre de tu empresa', 'error'); return false; }
    if (!orgId || !isLiveMode) { setPage(next); setSaved(true); showToast('Guardado (modo demo)', 'success'); return true; }
    setSaving(true);
    try {
      const out = await saveOwnPublicPage(orgId, next);
      setPage(out); setSaved(true);
      showToast('¡Guardado!', 'success');
      return true;
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (v: boolean) => {
    update({ activa: v });
    await save({ activa: v });
  };

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: page.nombre, text: `Pide tu presupuesto a ${page.nombre}`, url });
      else { await navigator.clipboard.writeText(url); showToast('Enlace copiado', 'success'); }
    } catch { /* cancelado */ }
  };

  const upload = async (files: FileList | null, target: 'portada' | 'portfolio') => {
    if (!files?.length) return;
    if (!orgId || !isLiveMode) { showToast('Las fotos solo se suben en modo real', 'info'); return; }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, target === 'portada' ? 1 : 12)) {
        if (f.size > 8 * 1024 * 1024) { showToast(`${f.name}: máximo 8 MB`, 'error'); continue; }
        urls.push(await uploadPageImage(orgId, f));
      }
      if (target === 'portada' && urls[0]) update({ portada_url: urls[0] });
      if (target === 'portfolio' && urls.length) update({ portfolio: [...page.portfolio, ...urls].slice(0, 12), portfolio_on: true });
    } catch {
      showToast('No se pudo subir la foto', 'error');
    } finally {
      setUploading(false);
    }
  };

  const setPregunta = (i: number, patch: Partial<PreguntaFormulario>) =>
    update({ preguntas: page.preguntas.map((p, j) => j === i ? { ...p, ...patch } : p) });
  const movePregunta = (i: number, d: -1 | 1) => {
    const arr = [...page.preguntas]; const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    update({ preguntas: arr });
  };

  return (
    <div className="space-y-4 pb-28" data-testid="screen-mi-pagina">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} aria-label="Volver" className="p-2 -ml-2 cursor-pointer"><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-2xl font-bold">Mi página online</h1>
      </div>

      {/* Activar */}
      <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h2 className="text-lg font-bold">Activar mi página</h2>
            <p className="text-sm text-gray-500 leading-snug">Tu página para que los clientes te pidan presupuesto sin llamar.</p>
          </div>
          <Toggle on={page.activa} onChange={toggleActive} label="Activar mi página" />
        </div>
        {page.activa && saved && (
          <div className="grid grid-cols-2 gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 border border-gray-300 rounded-xl py-3 font-semibold"><ExternalLink className="w-4 h-4" /> Ver página</a>
            <button type="button" onClick={share} className="flex items-center justify-center gap-2 border border-gray-300 rounded-xl py-3 font-semibold cursor-pointer"><Share2 className="w-4 h-4" /> Compartir</button>
          </div>
        )}
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-gray-600">Dirección de tu página</span>
          <div className="flex items-center bg-gray-50 border border-gray-300 rounded-xl overflow-hidden">
            <span className="pl-3 text-sm text-gray-400 whitespace-nowrap">/pro/</span>
            <input
              value={page.slug}
              onChange={e => update({ slug: e.target.value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]+/g, '-').slice(0, 60) })}
              onBlur={() => update({ slug: slugify(page.slug) })}
              className="flex-1 min-w-0 bg-transparent px-1 py-3 text-base focus:outline-none"
              aria-label="Dirección de tu página"
            />
          </div>
        </label>
      </section>

      {/* Datos básicos */}
      <Section title="Datos básicos" desc="Nombre, oficio y WhatsApp que verá el cliente">
        <input className={field} placeholder="Nombre de tu empresa" value={page.nombre} onChange={e => update({ nombre: e.target.value })} />
        <input className={field} placeholder="Oficio (ej.: Fontanero)" value={page.oficio} onChange={e => update({ oficio: e.target.value })} />
        <input className={field} placeholder="WhatsApp (ej.: 600 000 000)" type="tel" inputMode="tel" value={page.whatsapp} onChange={e => update({ whatsapp: e.target.value })} />
      </Section>

      {/* Portada */}
      <Section title="Imagen de portada" desc="Si no subes ninguna, se usa una imagen de tu oficio">
        {page.portada_url ? (
          <div className="relative">
            <img src={page.portada_url} alt="Portada" className="w-full aspect-video object-cover rounded-xl" />
            <button type="button" onClick={() => update({ portada_url: '' })} aria-label="Quitar portada" className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <button type="button" onClick={() => coverRef.current?.click()} disabled={uploading} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-6 text-gray-600 font-semibold cursor-pointer">
            <ImagePlus className="w-5 h-5" /> {uploading ? 'Subiendo…' : 'Subir portada'}
          </button>
        )}
        <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={e => { upload(e.target.files, 'portada'); e.target.value = ''; }} />
      </Section>

      {/* Acerca de */}
      <Section title="Acerca de nosotros" desc="Quién eres, dónde trabajas y en qué eres el mejor" on={page.acerca_on} onToggle={v => update({ acerca_on: v })}>
        <textarea className={field} rows={4} value={page.acerca} onChange={e => update({ acerca: e.target.value })} placeholder="Ej.: Instaladores de calefacción y aire acondicionado en Cantabria desde 2010." />
      </Section>

      {/* Servicios */}
      <Section title="Tipos de servicios" desc="Los servicios que los clientes pueden pedirte" on={page.servicios_on} onToggle={v => update({ servicios_on: v })}>
        {page.servicios.map((s, i) => (
          <div key={i} className="flex gap-2">
            <input className={field} value={s} onChange={e => update({ servicios: page.servicios.map((x, j) => j === i ? e.target.value : x) })} />
            <button type="button" onClick={() => update({ servicios: page.servicios.filter((_, j) => j !== i) })} aria-label="Quitar servicio" className="p-3 text-gray-400 cursor-pointer"><Trash2 className="w-5 h-5" /></button>
          </div>
        ))}
        <button type="button" onClick={() => update({ servicios: [...page.servicios, ''] })} className="flex items-center gap-2 text-teal-800 font-semibold cursor-pointer"><Plus className="w-4 h-4" /> Añadir servicio</button>
      </Section>

      {/* Cifras */}
      <Section title="Números destacados" desc="Años de experiencia, obras realizadas, clientes atendidos" on={page.cifras_on} onToggle={v => update({ cifras_on: v })}>
        {page.cifras.map((c, i) => (
          <div key={i} className="flex gap-2">
            <input className={`${field} w-24 shrink-0`} placeholder="15" value={c.valor} onChange={e => update({ cifras: page.cifras.map((x, j) => j === i ? { ...x, valor: e.target.value } : x) })} />
            <input className={field} placeholder="Años de experiencia" value={c.etiqueta} onChange={e => update({ cifras: page.cifras.map((x, j) => j === i ? { ...x, etiqueta: e.target.value } : x) })} />
            <button type="button" onClick={() => update({ cifras: page.cifras.filter((_, j) => j !== i) })} aria-label="Quitar cifra" className="p-3 text-gray-400 cursor-pointer"><Trash2 className="w-5 h-5" /></button>
          </div>
        ))}
        {page.cifras.length < 6 && (
          <button type="button" onClick={() => update({ cifras: [...page.cifras, { valor: '', etiqueta: '' }] })} className="flex items-center gap-2 text-teal-800 font-semibold cursor-pointer"><Plus className="w-4 h-4" /> Añadir número</button>
        )}
      </Section>

      {/* Preguntas */}
      <Section title="Preguntas del formulario" desc="Lo que preguntas antes de hacer el presupuesto">
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-3 text-sm text-gray-500"><Lock className="w-4 h-4" /> Nombre y teléfono del cliente (siempre incluidos)</div>
        {page.preguntas.map((p, i) => (
          <div key={p.id} className="border border-gray-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-1">
              <input className={field} value={p.etiqueta} onChange={e => setPregunta(i, { etiqueta: e.target.value })} placeholder="Pregunta" />
              <div className="flex flex-col">
                <button type="button" onClick={() => movePregunta(i, -1)} aria-label="Subir" className="p-1 text-gray-400 cursor-pointer"><ChevronUp className="w-4 h-4" /></button>
                <button type="button" onClick={() => movePregunta(i, 1)} aria-label="Bajar" className="p-1 text-gray-400 cursor-pointer"><ChevronDown className="w-4 h-4" /></button>
              </div>
              <button type="button" onClick={() => update({ preguntas: page.preguntas.filter((_, j) => j !== i) })} aria-label="Quitar pregunta" className="p-2 text-gray-400 cursor-pointer"><Trash2 className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center gap-2">
              <select className="flex-1 bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm" value={p.tipo} onChange={e => setPregunta(i, { tipo: e.target.value as PreguntaFormulario['tipo'] })}>
                <option value="texto">Texto libre</option>
                <option value="opciones">Lista de opciones</option>
              </select>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 cursor-pointer">
                <input type="checkbox" checked={!!p.obligatoria} onChange={e => setPregunta(i, { obligatoria: e.target.checked })} className="w-5 h-5 accent-teal-700" /> Obligatoria
              </label>
            </div>
            {p.tipo === 'opciones' && (
              <input
                className={field}
                placeholder="Opciones separadas por comas: Interior, Exterior"
                value={(p.opciones ?? []).join(', ')}
                onChange={e => setPregunta(i, { opciones: e.target.value.split(',').map(o => o.trim()).filter(Boolean) })}
              />
            )}
          </div>
        ))}
        {page.preguntas.length < 12 && (
          <button
            type="button"
            onClick={() => update({ preguntas: [...page.preguntas, { id: `p${Date.now().toString(36)}`, etiqueta: '', tipo: 'texto' }] })}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-3 text-gray-600 font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Añadir pregunta
          </button>
        )}
      </Section>

      {/* Portafolio */}
      <Section title="Portafolio de trabajos" desc="Fotos de tus trabajos para generar confianza" on={page.portfolio_on} onToggle={v => update({ portfolio_on: v })}>
        <div className="grid grid-cols-3 gap-2">
          {page.portfolio.map((u, i) => (
            <div key={u} className="relative">
              <img src={u} alt={`Trabajo ${i + 1}`} className="w-full aspect-square object-cover rounded-xl" />
              <button type="button" onClick={() => update({ portfolio: page.portfolio.filter((_, j) => j !== i) })} aria-label="Quitar foto" className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {page.portfolio.length < 12 && (
            <button type="button" onClick={() => portfolioRef.current?.click()} disabled={uploading} className="aspect-square flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 text-xs font-semibold cursor-pointer">
              <ImagePlus className="w-5 h-5" /> {uploading ? 'Subiendo…' : 'Añadir'}
            </button>
          )}
        </div>
        <input ref={portfolioRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { upload(e.target.files, 'portfolio'); e.target.value = ''; }} />
      </Section>

      {/* Guardar */}
      {!saved && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-4">
          <button type="button" onClick={() => save()} disabled={saving} className="w-full max-w-md mx-auto block bg-teal-800 text-white rounded-2xl py-4 text-base font-bold shadow-lg disabled:opacity-60 cursor-pointer">
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </div>
  );
}
