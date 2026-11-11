// Página pública del instalador: trabflow.com/pro/{slug}
// Muestra su presentación y permite pedir presupuesto con un formulario en 2 pasos.
import React, { useEffect, useState } from 'react';
import { MessageSquare, Check, ChevronLeft, X, Phone, Send } from 'lucide-react';
import { loadPublicPageBySlug, submitPageRequest, waNumber } from '../lib/publicPages';
import type { PublicPage } from '../lib/publicPages';

function coverFor(oficio: string): string {
  const o = (oficio ?? '').toLowerCase();
  if (o.includes('pint')) return '/pintor.png';
  if (o.includes('elec')) return '/electricista.png';
  if (o.includes('font') || o.includes('plom')) return '/fontanero.png';
  if (o.includes('reform') || o.includes('carp') || o.includes('albañil') || o.includes('construc')) return '/reformas.png';
  if (o.includes('clima') || o.includes('aire') || o.includes('calef')) return '/climatizacion.png';
  return '/servicios.png';
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || 'TF';

export default function PublicProPage({ slug }: { slug: string }) {
  const [page, setPage] = useState<PublicPage | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    loadPublicPageBySlug(slug)
      .then(p => { if (!alive) return; setPage(p); setState(p ? 'ready' : 'missing'); })
      .catch(() => { if (alive) setState('missing'); });
    return () => { alive = false; };
  }, [slug]);

  useEffect(() => {
    if (page) document.title = `${page.nombre}${page.oficio ? ` · ${page.oficio}` : ''} | TrabFlow`;
  }, [page]);

  if (state === 'loading') {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 border-2 border-gray-200 border-t-teal-700 rounded-full animate-spin" /></div>;
  }
  if (state === 'missing' || !page) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 p-6 text-center">
        <h1 className="text-xl font-bold text-gray-900">Página no disponible</h1>
        <p className="text-gray-500">Esta página no existe o el profesional la ha desactivado.</p>
        <a href="/" className="text-teal-700 font-semibold">Ir a TrabFlow</a>
      </div>
    );
  }

  const wa = page.whatsapp ? `https://wa.me/${waNumber(page.whatsapp)}?text=${encodeURIComponent(`Hola ${page.nombre}, te escribo desde tu página de TrabFlow.`)}` : '';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-xl mx-auto pb-40">
        {/* Portada */}
        <div className="relative h-56 bg-gradient-to-br from-teal-800 to-blue-700 overflow-hidden">
          <img
            src={page.portada_url || coverFor(page.oficio)}
            alt=""
            aria-hidden="true"
            className={page.portada_url ? 'w-full h-full object-cover' : 'absolute right-0 bottom-0 h-full object-contain object-bottom'}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-gray-50 to-transparent" />
        </div>

        {/* Identidad */}
        <div className="-mt-14 relative flex flex-col items-center px-5 text-center">
          <div className="w-24 h-24 rounded-3xl bg-white shadow-md flex items-center justify-center text-3xl font-black text-teal-800">{initials(page.nombre)}</div>
          <h1 className="mt-4 text-3xl font-black">{page.nombre}</h1>
          {page.oficio && <span className="mt-2 px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-sm font-semibold">{page.oficio}</span>}
        </div>

        {/* Cifras */}
        {page.cifras_on && page.cifras.length > 0 && (
          <div className="mx-5 mt-6 grid grid-cols-3 gap-2">
            {page.cifras.slice(0, 6).map((c, i) => (
              <div key={i} className="bg-white rounded-2xl p-3 text-center shadow-sm">
                <span className="block text-2xl font-black text-teal-800">{c.valor}</span>
                <span className="block text-xs text-gray-500 leading-tight mt-1">{c.etiqueta}</span>
              </div>
            ))}
          </div>
        )}

        {/* Acerca de + servicios */}
        {((page.acerca_on && page.acerca.trim()) || (page.servicios_on && page.servicios.length > 0)) && (
          <section className="mx-5 mt-6">
            <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-2">Acerca de</h2>
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              {page.acerca_on && page.acerca.trim() && <p className="text-gray-700 leading-relaxed whitespace-pre-line">{page.acerca}</p>}
              {page.servicios_on && page.servicios.length > 0 && (
                <div className={page.acerca_on && page.acerca.trim() ? 'pt-4 border-t border-gray-100' : ''}>
                  <h3 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-3">Servicios</h3>
                  <ul className="space-y-2.5">
                    {page.servicios.map((s, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center shrink-0"><Check className="w-4 h-4 text-emerald-600" /></span>
                        <span className="text-gray-800">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Portafolio */}
        {page.portfolio_on && page.portfolio.length > 0 && (
          <section className="mx-5 mt-6">
            <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-2">Trabajos realizados</h2>
            <div className="grid grid-cols-2 gap-2">
              {page.portfolio.map((url, i) => (
                <img key={i} src={url} alt={`Trabajo ${i + 1}`} loading="lazy" className="w-full aspect-square object-cover rounded-2xl bg-gray-200" />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Botones fijos */}
      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pt-6">
        <div className="max-w-xl mx-auto px-4 pb-4 space-y-2">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-teal-800 text-white rounded-2xl py-4 text-lg font-bold shadow-md active:bg-teal-900 cursor-pointer"
            >
              <MessageSquare className="w-5 h-5" /> Pedir presupuesto
            </button>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-2xl px-5 text-base font-bold text-gray-900">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#25D366]" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.5-.6-2.7-1.2-4.4-3.9-4.6-4.1-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.1.1.3 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.7 1.2 1.6 1.9 1.1.9 2 1.2 2.3 1.4.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.8.9c.3.1.4.2.5.3.1.1.1.6-.1 1.2Z" /></svg>
                WhatsApp
              </a>
            )}
          </div>
          <p className="text-center text-xs text-gray-400">Hecho con <a href="/" className="font-semibold text-teal-800">TrabFlow</a></p>
        </div>
      </div>

      {formOpen && <RequestForm page={page} wa={wa} onClose={() => setFormOpen(false)} />}
    </div>
  );
}

// ─── Formulario en 2 pasos ───────────────────────────────────────────────────
function RequestForm({ page, wa, onClose }: { page: PublicPage; wa: string; onClose: () => void }) {
  const [step, setStep] = useState<1 | 2 | 'done'>(1);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const next = () => {
    if (nombre.trim().length < 2) { setError('Escribe tu nombre'); return; }
    if (telefono.replace(/\D/g, '').length < 9) { setError('Escribe un teléfono válido'); return; }
    setError(''); setStep(2);
  };

  const send = async () => {
    const falta = page.preguntas.find(p => p.obligatoria && !(respuestas[p.id] ?? '').trim());
    if (falta) { setError(`Responde: ${falta.etiqueta}`); return; }
    if (!consent) { setError('Debes aceptar el tratamiento de tus datos'); return; }
    setError(''); setSending(true);
    try {
      const r = await submitPageRequest({ slug: page.slug, nombre, telefono, respuestas, mensaje: '', consentimiento: consent, website });
      if (!r.ok) { setError(r.error ?? 'No se pudo enviar'); return; }
      setStep('done');
    } catch {
      setError('No se pudo enviar. Revisa tu conexión.');
    } finally {
      setSending(false);
    }
  };

  const input = 'w-full bg-white border border-gray-300 rounded-2xl px-4 py-4 text-lg focus:outline-none focus:border-teal-700';

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Pedir presupuesto">
      <div className="max-w-xl mx-auto min-h-full flex flex-col">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-200">
          {step === 2 && (
            <button type="button" onClick={() => setStep(1)} aria-label="Volver" className="p-2 -ml-2 cursor-pointer"><ChevronLeft className="w-6 h-6" /></button>
          )}
          <h2 className="flex-1 text-xl font-bold">Pedir presupuesto</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-2 -mr-2 cursor-pointer"><X className="w-6 h-6" /></button>
        </div>

        {step !== 'done' && (
          <div className="flex items-center justify-center gap-4 py-4">
            {[1, 2].map(n => (
              <React.Fragment key={n}>
                <span className={`w-9 h-9 rounded-full flex items-center justify-center font-bold ${step === n ? 'bg-teal-800 text-white' : n < (step as number) ? 'bg-emerald-100 text-emerald-700' : 'border border-gray-300 text-gray-400'}`}>
                  {n < (step as number) ? <Check className="w-5 h-5" /> : n}
                </span>
                {n === 1 && <span className="w-16 h-0.5 bg-gray-200" />}
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="flex-1 px-5 pb-32 space-y-5">
          {step === 1 && (
            <>
              <div className="text-center">
                <h3 className="text-2xl font-bold">Tus datos</h3>
                <p className="text-gray-500 mt-1">Para que {page.nombre} pueda responderte.</p>
              </div>
              <label className="block space-y-1.5">
                <span className="font-semibold">Tu nombre</span>
                <input className={input} value={nombre} onChange={e => setNombre(e.target.value)} autoComplete="name" />
              </label>
              <label className="block space-y-1.5">
                <span className="font-semibold">Teléfono</span>
                <input className={input} value={telefono} onChange={e => setTelefono(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" />
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <div className="text-center">
                <h3 className="text-2xl font-bold">Describe lo que necesitas</h3>
                <p className="text-gray-500 mt-1">Cuanto más detalle, mejor el presupuesto.</p>
              </div>
              {page.preguntas.map(p => (
                <label key={p.id} className="block space-y-1.5">
                  <span className="font-semibold">{p.etiqueta}{p.obligatoria && <span className="text-red-500"> *</span>}</span>
                  {p.tipo === 'opciones' ? (
                    <select className={input} value={respuestas[p.id] ?? ''} onChange={e => setRespuestas(r => ({ ...r, [p.id]: e.target.value }))}>
                      <option value="">Selecciona una opción</option>
                      {(p.opciones ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <textarea className={input} rows={3} value={respuestas[p.id] ?? ''} onChange={e => setRespuestas(r => ({ ...r, [p.id]: e.target.value }))} />
                  )}
                </label>
              ))}
              {/* Honeypot: invisible para personas */}
              <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} aria-hidden="true" className="absolute -left-[9999px] w-px h-px opacity-0" name="website" />
              <label className="flex items-start gap-3 bg-white border border-gray-200 rounded-2xl p-4 cursor-pointer">
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="w-6 h-6 mt-0.5 accent-teal-800 shrink-0" />
                <span className="text-sm text-gray-600 leading-snug">
                  Acepto que {page.nombre} trate mis datos para responder a esta solicitud. TrabFlow los gestiona por su cuenta como encargado del tratamiento. <a href="/privacidad" target="_blank" className="text-teal-800 underline">Más información</a>
                </span>
              </label>
            </>
          )}

          {step === 'done' && (
            <div className="text-center pt-10 space-y-5">
              <div className="w-24 h-24 mx-auto rounded-full bg-emerald-50 flex items-center justify-center"><Check className="w-12 h-12 text-emerald-600" /></div>
              <h3 className="text-2xl font-bold">¡Solicitud enviada!</h3>
              <p className="text-gray-500">{page.nombre} se pondrá en contacto contigo pronto.</p>
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#25D366] text-white rounded-full px-6 py-4 text-lg font-bold">
                  <Phone className="w-5 h-5" /> Hablar por WhatsApp
                </a>
              )}
              <div><button type="button" onClick={onClose} className="text-gray-500 underline cursor-pointer">Cerrar</button></div>
            </div>
          )}

          {error && <p role="alert" className="text-red-600 font-semibold text-center">{error}</p>}
        </div>

        {step !== 'done' && (
          <div className="fixed inset-x-0 bottom-0 bg-gray-50 border-t border-gray-200">
            <div className="max-w-xl mx-auto p-4">
              <button
                type="button"
                onClick={step === 1 ? next : send}
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 bg-teal-800 text-white rounded-2xl py-4 text-lg font-bold disabled:opacity-60 cursor-pointer"
              >
                {step === 1 ? 'Siguiente' : (<><Send className="w-5 h-5" /> {sending ? 'Enviando…' : 'Enviar solicitud'}</>)}
              </button>
              <p className="text-center text-xs text-gray-400 mt-2">Hecho con <span className="font-semibold text-teal-800">TrabFlow</span></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
