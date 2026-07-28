import { useState, useEffect } from 'react';
import { useCookieConsent, type ConsentCategories } from '../context/CookieConsentContext';

export default function CookieBanner() {
  const { hasDecided, categories, preferencesOpen, acceptAll, rejectAll, saveCategories } =
    useCookieConsent();

  const [view, setView] = useState<'banner' | 'settings'>('banner');
  const [draft, setDraft] = useState<ConsentCategories>(categories);

  const visible = !hasDecided || preferencesOpen;

  useEffect(() => {
    if (preferencesOpen) {
      setView('settings');
      setDraft(categories);
    }
  }, [preferencesOpen, categories]);

  useEffect(() => {
    if (!visible) setView('banner');
  }, [visible]);

  if (!visible) return null;

  const handleShowSettings = () => {
    setDraft(categories);
    setView('settings');
  };

  const handleSave = () => {
    saveCategories(draft);
  };

  const handleRejectAll = () => {
    rejectAll();
  };

  const handleAcceptAll = () => {
    acceptAll();
  };

  const toggleAnalytics = () => setDraft(d => ({ ...d, analytics: !d.analytics }));
  const toggleMarketing = () => setDraft(d => ({ ...d, marketing: !d.marketing }));

  if (view === 'settings') {
    return (
      <div className="fixed bottom-0 inset-x-0 z-50 bg-[#0d1f38]/97 backdrop-blur-md border-t border-white/10 shadow-2xl">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Configurar preferencias de cookies</h2>
            {!preferencesOpen && (
              <button
                onClick={() => setView('banner')}
                className="text-white/40 hover:text-white/70 transition-colors text-xs"
              >
                ← Volver
              </button>
            )}
          </div>

          <div className="space-y-4">
            {/* Esenciales — siempre activas */}
            <div className="flex items-start justify-between gap-4 py-3 border-t border-white/8">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-white">Cookies esenciales</p>
                <p className="text-xs text-white/45 leading-relaxed">
                  Gestión de sesión, seguridad y funcionamiento básico de la plataforma. Siempre activas.
                </p>
              </div>
              <span className="shrink-0 text-xs text-[#00CFE8] font-medium pt-0.5">Siempre activas</span>
            </div>

            {/* Analíticas */}
            <div className="flex items-start justify-between gap-4 py-3 border-t border-white/8">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-white">Cookies analíticas</p>
                <p className="text-xs text-white/45 leading-relaxed">
                  Medición de uso y mejora de la plataforma. Datos agregados y anónimos.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={draft.analytics}
                onClick={toggleAnalytics}
                className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00CFE8]/40 mt-0.5 ${
                  draft.analytics ? 'bg-[#00CFE8]' : 'bg-white/20'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    draft.analytics ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Marketing */}
            <div className="flex items-start justify-between gap-4 py-3 border-t border-white/8">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-white">Cookies de marketing</p>
                <p className="text-xs text-white/45 leading-relaxed">
                  Personalización de contenidos y publicidad relevante.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={draft.marketing}
                onClick={toggleMarketing}
                className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00CFE8]/40 mt-0.5 ${
                  draft.marketing ? 'bg-[#00CFE8]' : 'bg-white/20'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    draft.marketing ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1">
            <button
              onClick={handleRejectAll}
              className="px-4 py-2 text-xs font-medium text-white/60 hover:text-white rounded-xl border border-white/15 hover:border-white/30 transition-colors"
            >
              Rechazar no esenciales
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-xs font-semibold bg-[#00CFE8] hover:bg-[#00b8cf] text-[#020B16] rounded-xl transition-colors"
            >
              Guardar preferencias
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-[#0d1f38]/97 backdrop-blur-md border-t border-white/10 shadow-2xl">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="text-xs text-white/60 leading-relaxed flex-1">
          Usamos cookies propias y de terceros para mejorar tu experiencia, analizar el uso de la
          plataforma y mostrarte contenido relevante. Puedes aceptar todas, rechazar las no
          esenciales o configurar tus preferencias en cualquier momento.{' '}
          <span className="text-white/35">
            Las cookies esenciales son necesarias para el funcionamiento de la plataforma.
          </span>
        </p>
        <div className="flex flex-col xs:flex-row shrink-0 gap-2">
          <button
            onClick={handleRejectAll}
            className="px-4 py-2 text-xs font-medium text-white/60 hover:text-white rounded-xl border border-white/15 hover:border-white/30 transition-colors whitespace-nowrap"
          >
            Rechazar no esenciales
          </button>
          <button
            onClick={handleShowSettings}
            className="px-4 py-2 text-xs font-medium text-white/60 hover:text-white rounded-xl border border-white/15 hover:border-white/30 transition-colors"
          >
            Configurar
          </button>
          <button
            onClick={handleAcceptAll}
            className="px-5 py-2 text-xs font-semibold bg-[#00CFE8] hover:bg-[#00b8cf] text-[#020B16] rounded-xl transition-colors whitespace-nowrap"
          >
            Aceptar todas
          </button>
        </div>
      </div>
    </div>
  );
}
