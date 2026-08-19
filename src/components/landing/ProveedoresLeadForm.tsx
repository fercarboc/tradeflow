import React, { useState } from 'react';
import { X, Send, CheckCircle2, Building2, Globe, MapPin, ChevronDown } from 'lucide-react';
import { submitProviderLead, sendTrabflowEmail } from '../../lib/supabase';

// ── Tipos e interfaces ────────────────────────────────────────────────────────

export type ProveedoresLeadFormVariant = 'provider' | 'advertising';

interface ProveedoresLeadFormProps {
  variant: ProveedoresLeadFormVariant;
  onClose: () => void;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const COMPANY_TYPES = [
  'Distribuidor',
  'Mayorista',
  'Fabricante',
  'Importador',
  'Representante',
  'Otro',
];

const INTEREST_OPTIONS = [
  { key: 'catalog',           label: 'Catálogo de productos' },
  { key: 'orders',            label: 'Gestión de pedidos' },
  { key: 'marketplace',       label: 'Presencia en Marketplace' },
  { key: 'promotions',        label: 'Promociones' },
  { key: 'advertising',       label: 'Publicidad Marketplace' },
  { key: 'founding_program',  label: 'Programa Proveedor Fundador' },
  { key: 'api',               label: 'API / Integración técnica' },
];

const CAMPAIGN_TYPES = [
  'Imagen de marca',
  'Lanzamiento de producto',
  'Liquidación / Oferta',
  'Temporada / Estacionalidad',
  'Otro',
];

const AD_SPACES = [
  'Banner principal Home',
  'Banner sección catálogo',
  'Carrusel destacados',
  'Espacio producto patrocinado',
  'Otro',
];

const PERIODS = ['1 mes', '3 meses', '6 meses', '12 meses'];

const inputCls = 'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-[#1A5A96]/60 focus:bg-white/8 focus:outline-none transition-all';
const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5';
const checkboxLabelCls = 'flex items-center gap-2.5 cursor-pointer group';

// ── Componente principal ──────────────────────────────────────────────────────

export default function ProveedoresLeadForm({ variant, onClose }: ProveedoresLeadFormProps) {
  const isAdvertising = variant === 'advertising';

  const [form, setForm] = useState({
    nombre: '',
    apellidos: '',
    empresa: '',
    email: '',
    telefono: '',
    company_type: '',
    website: '',
    province: '',
    interests: [] as string[],
    advertising_interest: isAdvertising,
    founding_provider_interest: false,
    campaign_type: '',
    product_category: '',
    desired_period: '',
    desired_ad_space: '',
    estimated_budget: '',
    notas: '',
  });

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privacyOk, setPrivacyOk] = useState(false);

  const set = (key: string, value: unknown) => setForm(prev => ({ ...prev, [key]: value }));

  const toggleInterest = (key: string) => {
    setForm(prev => {
      const next = prev.interests.includes(key)
        ? prev.interests.filter(k => k !== key)
        : [...prev.interests, key];

      const advertisingInterest = next.includes('advertising') || isAdvertising;
      const foundingInterest = next.includes('founding_program') || prev.founding_provider_interest;
      return { ...prev, interests: next, advertising_interest: advertisingInterest, founding_provider_interest: foundingInterest };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privacyOk) { setError('Debes aceptar la política de privacidad.'); return; }
    setSending(true);
    setError(null);
    try {
      // 1. Persistir el lead (obligatorio — bloquea si falla)
      await submitProviderLead({
        nombre: form.nombre,
        apellidos: form.apellidos,
        empresa: form.empresa,
        email: form.email,
        telefono: form.telefono,
        company_type: form.company_type,
        website: form.website,
        province: form.province,
        interests: form.interests,
        advertising_interest: form.advertising_interest,
        founding_provider_interest: form.founding_provider_interest,
        campaign_type: form.campaign_type,
        product_category: form.product_category,
        desired_period: form.desired_period,
        desired_ad_space: form.desired_ad_space,
        estimated_budget: form.estimated_budget,
        notas: form.notas,
        fuente: isAdvertising ? 'provider_advertising' : 'provider_page',
      });

      // 2. Notificar al admin (fire-and-forget — no bloquea ni muestra error al lead)
      sendTrabflowEmail({
        type: 'provider_admin',
        nombre: `${form.nombre} ${form.apellidos}`.trim(),
        email: form.email,
        telefono: form.telefono,
        empresa: form.empresa,
        company_type: form.company_type,
        website: form.website,
        province: form.province,
        interests: form.interests,
        advertising_interest: form.advertising_interest,
        founding_provider_interest: form.founding_provider_interest,
      }).catch(err => console.warn('[ProveedoresLeadForm] admin email failed:', err));

      // 3. Confirmación al proveedor (fire-and-forget — no bloquea el registro si falla)
      sendTrabflowEmail({
        type: 'provider_confirm',
        nombre: form.nombre,
        email: form.email,
        empresa: form.empresa,
        advertising_interest: form.advertising_interest,
        founding_provider_interest: form.founding_provider_interest,
      }).catch(err => console.warn('[ProveedoresLeadForm] confirm email failed:', err));

      setSent(true);
    } catch {
      setError('Error al enviar. Inténtalo de nuevo o escríbenos a contacto@trabflow.com.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0d1f38] border border-[#1A5A96]/30 rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#0d1f38] border-b border-white/10">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#5B9BD5] mb-0.5">
              {isAdvertising ? 'Publicidad Marketplace' : 'Programa Proveedor'}
            </div>
            <h2 className="text-lg font-black text-white">
              {isAdvertising ? 'Solicitar información de publicidad' : 'Quiero ser proveedor'}
            </h2>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">

          {/* Success state */}
          {sent ? (
            <div className="text-center py-10 space-y-4">
              <div className="flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
              </div>
              <h3 className="text-xl font-black text-white">¡Mensaje recibido!</h3>
              <p className="text-white/50 text-sm leading-relaxed max-w-sm mx-auto">
                Hemos recibido tu solicitud. Te contactaremos en menos de 24h para continuar la conversación.
              </p>
              <button onClick={onClose} className="mt-4 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1A5A96] hover:bg-[#1A5A96]/80 text-white font-bold text-sm transition-colors cursor-pointer">
                Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Datos personales */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-4 pb-2 border-b border-white/8">Datos de contacto</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Nombre *</label>
                    <input type="text" required value={form.nombre} onChange={e => set('nombre', e.target.value)}
                      placeholder="Tu nombre" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Apellidos</label>
                    <input type="text" value={form.apellidos} onChange={e => set('apellidos', e.target.value)}
                      placeholder="Tus apellidos" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Email *</label>
                    <input type="email" required value={form.email} onChange={e => set('email', e.target.value)}
                      placeholder="tu@empresa.com" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Teléfono</label>
                    <input type="tel" value={form.telefono} onChange={e => set('telefono', e.target.value)}
                      placeholder="+34 600 000 000" className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Datos empresa */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-4 pb-2 border-b border-white/8">Datos de la empresa</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Empresa *</label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
                      <input type="text" required value={form.empresa} onChange={e => set('empresa', e.target.value)}
                        placeholder="Nombre de tu empresa" className={`${inputCls} pl-10`} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Tipo de empresa</label>
                    <div className="relative">
                      <select value={form.company_type} onChange={e => set('company_type', e.target.value)}
                        className={`${inputCls} appearance-none pr-8`}>
                        <option value="">Selecciona tipo…</option>
                        {COMPANY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Provincia</label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
                      <input type="text" value={form.province} onChange={e => set('province', e.target.value)}
                        placeholder="Madrid, Barcelona…" className={`${inputCls} pl-10`} />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Página web</label>
                    <div className="relative">
                      <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
                      <input type="url" value={form.website} onChange={e => set('website', e.target.value)}
                        placeholder="https://tuempresa.com" className={`${inputCls} pl-10`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Intereses */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-4 pb-2 border-b border-white/8">Intereses</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {INTEREST_OPTIONS.map(({ key, label }) => (
                    <label key={key} className={checkboxLabelCls}>
                      <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        form.interests.includes(key) || (key === 'advertising' && form.advertising_interest) || (key === 'founding_program' && form.founding_provider_interest)
                          ? 'bg-[#1A5A96] border-[#1A5A96]'
                          : 'border-white/20 bg-white/5'
                      }`}
                        onClick={() => toggleInterest(key)}>
                        {(form.interests.includes(key) || (key === 'advertising' && form.advertising_interest) || (key === 'founding_program' && form.founding_provider_interest)) && (
                          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm text-white/70 group-hover:text-white transition-colors" onClick={() => toggleInterest(key)}>{label}</span>
                    </label>
                  ))}
                </div>
                {(form.founding_provider_interest || form.interests.includes('founding_program')) && (
                  <div className="mt-3 rounded-lg bg-[#C8922A]/10 border border-[#C8922A]/25 px-4 py-3 text-xs text-[#C8922A]/80 leading-relaxed">
                    <strong className="text-[#C8922A]">Programa Proveedor Fundador</strong> — 30% de descuento permanente en publicidad Marketplace para proveedores fundadores seleccionados.* Sujeto a condiciones del programa.
                  </div>
                )}
              </div>

              {/* Sección publicidad (visible siempre si isAdvertising, o si seleccionan publicidad) */}
              {(isAdvertising || form.interests.includes('advertising') || form.advertising_interest) && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-4 pb-2 border-b border-white/8">Información de campaña</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Tipo de campaña</label>
                      <div className="relative">
                        <select value={form.campaign_type} onChange={e => set('campaign_type', e.target.value)}
                          className={`${inputCls} appearance-none pr-8`}>
                          <option value="">Selecciona…</option>
                          {CAMPAIGN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Producto / Categoría</label>
                      <input type="text" value={form.product_category} onChange={e => set('product_category', e.target.value)}
                        placeholder="Ej. Fontanería, Climatización…" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Periodo aproximado</label>
                      <div className="relative">
                        <select value={form.desired_period} onChange={e => set('desired_period', e.target.value)}
                          className={`${inputCls} appearance-none pr-8`}>
                          <option value="">Selecciona…</option>
                          {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Espacio de interés</label>
                      <div className="relative">
                        <select value={form.desired_ad_space} onChange={e => set('desired_ad_space', e.target.value)}
                          className={`${inputCls} appearance-none pr-8`}>
                          <option value="">Selecciona…</option>
                          {AD_SPACES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Presupuesto orientativo</label>
                      <input type="text" value={form.estimated_budget} onChange={e => set('estimated_budget', e.target.value)}
                        placeholder="Ej. 500-1000€/mes" className={inputCls} />
                      <p className="text-[10px] text-white/25 mt-1.5">Tarifas previstas desde 175€/mes. Actualmente sin coste durante la fase de validación.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Comentarios */}
              <div>
                <label className={labelCls}>Comentarios adicionales</label>
                <textarea rows={3} value={form.notas} onChange={e => set('notas', e.target.value)}
                  placeholder="Cuéntanos más sobre tu empresa, lo que buscas o cualquier pregunta…"
                  className={`${inputCls} resize-none`} />
              </div>

              {/* Privacidad */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  privacyOk ? 'bg-[#1A5A96] border-[#1A5A96]' : 'border-white/20 bg-white/5'
                }`} onClick={() => setPrivacyOk(v => !v)}>
                  {privacyOk && (
                    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-white/35 leading-relaxed group-hover:text-white/50 transition-colors" onClick={() => setPrivacyOk(v => !v)}>
                  He leído y acepto la <span className="text-[#5B9BD5]">política de privacidad</span>. Mis datos serán tratados para gestionar esta solicitud.
                </span>
              </label>

              {/* Error */}
              {error && (
                <div className="rounded-lg bg-red-900/20 border border-red-700/40 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={sending}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#1A5A96] hover:bg-[#1A5A96]/80 disabled:opacity-60 text-white font-black uppercase tracking-wider text-sm transition-colors cursor-pointer">
                {sending ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {sending ? 'Enviando…' : isAdvertising ? 'Solicitar información de publicidad' : 'Enviar solicitud'}
              </button>

            </form>
          )}
        </div>
      </div>
    </div>
  );
}
