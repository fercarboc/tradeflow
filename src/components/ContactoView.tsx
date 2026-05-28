/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Send, CheckCircle2, Phone, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { submitContactMessage, sendTrabflowEmail } from '../lib/supabase';

const MOTIVOS = [
  'Información general',
  'Quiero ver una demo',
  'Tengo una empresa con varios técnicos',
  'Necesito información sobre precios',
  'Integración con mi software actual',
  'Otro motivo',
];

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white placeholder:text-white/25 focus:border-[#00CFE8]/50 focus:bg-white/8 focus:outline-none transition-all font-sans';
const labelClass = 'block text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5';

export default function ContactoView() {
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', motivo: MOTIVOS[0], mensaje: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await submitContactMessage({
        nombre: form.nombre,
        telefono: form.telefono,
        email: form.email,
        motivo: form.motivo,
        mensaje: form.mensaje,
      });
      sendTrabflowEmail({
        type: 'contact_admin',
        nombre: form.nombre,
        email: form.email,
        telefono: form.telefono,
        oficio: form.motivo,
        ciudad: form.mensaje,
      });
      setSent(true);
    } catch {
      setError('Error al enviar. Inténtalo de nuevo o llámanos.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-[#020B16] min-h-screen font-sans">

      {/* Hero */}
      <div className="bg-[#020B16] border-b border-white/10 py-16 px-4 sm:px-6 lg:px-8 text-center">
        <div className="mx-auto max-w-2xl space-y-4">
          <span className="inline-block rounded-full border border-white/15 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/45">
            Contacto
          </span>
          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tight text-white leading-tight">
            ¿Hablamos sobre <span className="text-[#FFC400]">TRABFLOW</span>?
          </h1>
          <p className="text-white/45 text-base leading-relaxed max-w-xl mx-auto">
            Cuéntanos qué necesitas y te respondemos en menos de 24 h por teléfono o WhatsApp.
          </p>
        </div>
      </div>

      {/* Main */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left: contact info */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-2xl bg-[#0d1f38] border border-white/10 p-6 space-y-5">
              <h2 className="text-xs font-black uppercase tracking-widest text-white">Datos de contacto</h2>
              <div className="space-y-4">
                <a href="tel:+34672336572" className="flex items-center gap-3 text-white/50 hover:text-[#FFC400] transition-colors group">
                  <div className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-[#FFC400]/15 transition-colors">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-0.5">Teléfono / WhatsApp</div>
                    <span className="text-sm font-bold text-white">672 336 572</span>
                  </div>
                </a>
                <a href="mailto:contacto@trabflow.com" className="flex items-center gap-3 text-white/50 hover:text-[#00CFE8] transition-colors group">
                  <div className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-[#00CFE8]/15 transition-colors">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-0.5">Email</div>
                    <span className="text-sm font-bold text-white">info@trabflow.com</span>
                  </div>
                </a>
              </div>
              <div className="pt-3 border-t border-white/8 text-xs text-white/30 leading-relaxed">
                Horario de atención: Lunes a Viernes, 9:00 – 19:00
              </div>
            </div>

            <div className="rounded-2xl bg-[#0d1f38] border border-white/10 p-6 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-white">Prueba gratis</h3>
              <p className="text-xs text-white/40 leading-relaxed">
                Accede a TRABFLOW con 15 días de prueba gratuita. Sin tarjeta de crédito.
              </p>
              <div className="flex flex-col gap-2 pt-1">
                {['Presupuestos por voz e imagen', 'Envío directo por WhatsApp', 'Facturas en un clic', 'Catálogo de precios'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-xs text-white/50">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#00CFE8] shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: form */}
          <div className="lg:col-span-8 rounded-2xl bg-[#0d1f38] border border-white/10 p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {!sent ? (
                <motion.form
                  key="contact-form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleSubmit}
                  className="space-y-5"
                >
                  <div className="mb-2">
                    <h2 className="text-sm font-black uppercase tracking-widest text-white">Envíanos un mensaje</h2>
                    <p className="text-xs text-white/35 mt-1">Rellena el formulario y te contactamos enseguida.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Nombre y apellidos *</label>
                      <input required type="text" name="nombre" placeholder="Carlos Martínez" value={form.nombre} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Teléfono *</label>
                      <input required type="tel" name="telefono" placeholder="+34 600 000 000" value={form.telefono} onChange={handleChange} className={inputClass} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Email</label>
                      <input type="email" name="email" placeholder="carlos@empresa.com" value={form.email} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Motivo de contacto *</label>
                      <select required name="motivo" value={form.motivo} onChange={handleChange} className={inputClass + ' cursor-pointer'}>
                        {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Mensaje</label>
                    <textarea
                      name="mensaje"
                      rows={4}
                      placeholder="Cuéntanos qué necesitas o qué dudas tienes..."
                      value={form.mensaje}
                      onChange={handleChange}
                      className={inputClass + ' resize-none'}
                    />
                  </div>

                  <div className="pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input required type="checkbox" className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-[#00CFE8] cursor-pointer accent-[#00CFE8]" />
                      <span className="text-xs text-white/35 leading-normal">
                        Acepto el tratamiento de mis datos para gestionar esta consulta, conforme a la política de privacidad.
                      </span>
                    </label>
                  </div>

                  {error && <p className="text-xs text-red-400 font-semibold">{error}</p>}

                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#FFC400] hover:brightness-110 py-3.5 font-black uppercase tracking-widest text-[#020B16] disabled:opacity-50 cursor-pointer text-xs transition-all shadow-lg shadow-[#FFC400]/20"
                  >
                    {sending ? (
                      <><div className="h-4 w-4 animate-spin rounded-full border-2 border-[#020B16] border-t-transparent" /><span>Enviando...</span></>
                    ) : (
                      <><span>Enviar mensaje</span><Send className="h-4 w-4" /></>
                    )}
                  </button>
                </motion.form>
              ) : (
                <motion.div
                  key="contact-sent"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12 space-y-6"
                >
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-[#00CFE8]/30 bg-[#00CFE8]/10 text-[#00CFE8]">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black uppercase tracking-wider text-white">¡Mensaje recibido!</h3>
                    <p className="text-xs text-white/45 max-w-md mx-auto leading-relaxed">
                      Gracias, {form.nombre}. Te contactaremos en menos de 24 h al número <strong className="text-white">{form.telefono}</strong>.
                    </p>
                  </div>
                  <button
                    onClick={() => { setSent(false); setForm({ nombre: '', telefono: '', email: '', motivo: MOTIVOS[0], mensaje: '' }); }}
                    className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white/60 hover:border-white/40 hover:text-white transition-colors cursor-pointer"
                  >
                    Enviar otro mensaje
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
