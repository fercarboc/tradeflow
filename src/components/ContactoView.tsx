/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TradeType, WaitlistFormInput } from '../types';
import { Send, CheckCircle2, Phone, Mail, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { submitWaitlist, sendTrabflowEmail } from '../lib/supabase';

interface ContactoViewProps {
  initialPreselectedTrade?: TradeType;
}

export default function ContactoView({ initialPreselectedTrade }: ContactoViewProps) {
  const [formData, setFormData] = useState<WaitlistFormInput>({
    nombre: '',
    telefono: '',
    email: '',
    oficio: initialPreselectedTrade || 'Fontanería',
    ciudad: '',
    presupuestosAlMes: '10-25',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedEntries, setSavedEntries] = useState<WaitlistFormInput[]>([]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await submitWaitlist({
        nombre: formData.nombre,
        telefono: formData.telefono,
        email: formData.email,
        oficio: formData.oficio,
        ciudad: formData.ciudad,
        presupuestos_al_mes: formData.presupuestosAlMes,
      });

      sendTrabflowEmail({
        type: 'waitlist_admin',
        nombre: formData.nombre,
        email: formData.email,
        telefono: formData.telefono,
        oficio: formData.oficio,
        ciudad: formData.ciudad,
        presupuestos_al_mes: formData.presupuestosAlMes,
      });
      sendTrabflowEmail({
        type: 'waitlist_confirm',
        nombre: formData.nombre,
        email: formData.email,
      });

      setSavedEntries((prev: WaitlistFormInput[]) => [formData, ...prev]);
      setIsSubmitted(true);
      setFormData({
        nombre: '',
        telefono: '',
        email: '',
        oficio: formData.oficio,
        ciudad: '',
        presupuestosAlMes: formData.presupuestosAlMes,
      });
    } catch (err) {
      setSubmitError('Error al enviar el formulario. Inténtalo de nuevo.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setIsSubmitted(false);
  };

  const inputClass =
    'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white placeholder:text-white/25 focus:border-[#00CFE8]/50 focus:bg-white/8 focus:outline-none transition-all font-sans';
  const labelClass = 'block text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5';

  return (
    <div className="bg-[#020B16] min-h-screen font-sans" id="contacto-view-container">

      {/* Hero header */}
      <div className="bg-[#020B16] border-b border-white/10 py-16 px-4 sm:px-6 lg:px-8 text-center">
        <div className="mx-auto max-w-3xl space-y-4">
          <span className="inline-block rounded-full border border-white/15 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/45">
            Lista de espera abierta
          </span>
          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tight text-white leading-tight">
            Únete a la beta de{' '}
            <span className="text-[#FFC400]">TRABFLOW</span>
          </h1>
          <p className="text-white/45 text-base leading-relaxed max-w-xl mx-auto">
            Las plazas son limitadas y se asignan por orden de registro. Reserva tu acceso prioritario ahora.
          </p>
          <div className="inline-flex items-center gap-3 rounded-2xl bg-[#00CFE8]/10 border border-[#00CFE8]/25 px-6 py-3 mt-2">
            <span className="h-2 w-2 rounded-full bg-[#00CFE8] animate-pulse shrink-0" />
            <span className="text-sm font-bold text-white/80">
              <span className="text-[#00CFE8]">3 meses gratis</span> — Sin tarjeta de crédito. Solo para instaladores.
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left col */}
          <div className="lg:col-span-5 space-y-6">

            {/* Benefits card */}
            <div className="rounded-2xl bg-[#0d1f38] border border-white/10 p-6 sm:p-8 space-y-6">
              <h2 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 text-[#00CFE8]" />
                Beneficios de la beta cerrada
              </h2>

              <ul className="space-y-5">
                {[
                  {
                    n: '1',
                    title: 'Acceso gratuito 3 meses',
                    desc: 'Usa todas las funcionalidades de TRABFLOW gratis durante el periodo beta cerrado.',
                  },
                  {
                    n: '2',
                    title: 'Asesoramiento directo',
                    desc: 'Te ayudamos a configurar tus plantillas de presupuesto y tarifas de mano de obra por WhatsApp.',
                  },
                  {
                    n: '3',
                    title: 'Descuento vitalicio 50%',
                    desc: 'Si decides continuar tras la beta, mantendrás la mitad de precio en el plan Pro para siempre.',
                  },
                ].map((item) => (
                  <li key={item.n} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#00CFE8]/10 border border-[#00CFE8]/20 text-[#00CFE8] font-mono text-xs font-black">
                      {item.n}
                    </span>
                    <div>
                      <strong className="text-white block font-black uppercase tracking-wide text-[10px] mb-0.5">
                        {item.title}
                      </strong>
                      <span className="text-xs text-white/45 leading-relaxed">{item.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="pt-4 border-t border-white/8 flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/25">
                  Nivel prioritario activo
                </span>
                <span className="h-2.5 w-2.5 rounded-full bg-[#00CFE8] animate-pulse" />
              </div>
            </div>

            {/* Contact card */}
            <div className="rounded-2xl bg-[#0d1f38] border border-white/10 p-6 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-white/60">
                ¿Tienes preguntas?
              </h3>
              <p className="text-xs text-white/40 leading-relaxed">
                Si tienes dudas sobre cómo funciona TRABFLOW o sobre la normativa de Hacienda, escríbenos:
              </p>
              <div className="flex flex-col gap-3 pt-1">
                <a
                  href="mailto:hola@trabflow.com"
                  className="flex items-center gap-2.5 text-sm text-white/50 hover:text-[#00CFE8] transition-colors group"
                >
                  <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-[#00CFE8]/15 transition-colors">
                    <Mail className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold">hola@trabflow.com</span>
                </a>
                <a
                  href="tel:+34672336572"
                  className="flex items-center gap-2.5 text-sm text-white/50 hover:text-[#FFC400] transition-colors group"
                >
                  <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-[#FFC400]/15 transition-colors">
                    <Phone className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold">672 336 572</span>
                </a>
              </div>
            </div>
          </div>

          {/* Right col: form */}
          <div className="lg:col-span-7 rounded-2xl bg-[#0d1f38] border border-white/10 p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {!isSubmitted ? (
                <motion.form
                  key="waitlist-form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleSubmit}
                  className="space-y-5"
                  id="contact-form-element"
                >
                  <div className="mb-2">
                    <h2 className="text-sm font-black uppercase tracking-widest text-white">Solicitar acceso</h2>
                    <p className="text-xs text-white/35 mt-1">Completa tus datos para reservar tu plaza.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="nombre" className={labelClass}>Nombre y apellidos *</label>
                      <input
                        required
                        type="text"
                        name="nombre"
                        id="nombre"
                        placeholder="Ej. Carlos Martínez"
                        value={formData.nombre}
                        onChange={handleInputChange}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="telefono" className={labelClass}>Teléfono (WhatsApp) *</label>
                      <input
                        required
                        type="tel"
                        name="telefono"
                        id="telefono"
                        placeholder="+34 600 000 000"
                        value={formData.telefono}
                        onChange={handleInputChange}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="email" className={labelClass}>Correo electrónico *</label>
                      <input
                        required
                        type="email"
                        name="email"
                        id="email"
                        placeholder="carlos@fontaneria.com"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="oficio" className={labelClass}>Tu oficio principal *</label>
                      <select
                        name="oficio"
                        id="oficio"
                        value={formData.oficio}
                        onChange={handleInputChange}
                        className={inputClass + ' cursor-pointer'}
                      >
                        <option value="Fontanería">Fontanería</option>
                        <option value="Electricidad">Electricidad</option>
                        <option value="Climatización / HVAC">Climatización / HVAC</option>
                        <option value="Cerrajería">Cerrajería</option>
                        <option value="Otros">Otros (Reformas/Construcción)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="ciudad" className={labelClass}>Ciudad / Provincia *</label>
                      <input
                        required
                        type="text"
                        name="ciudad"
                        id="ciudad"
                        placeholder="Ej. Madrid o Barcelona"
                        value={formData.ciudad}
                        onChange={handleInputChange}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="presupuestosAlMes" className={labelClass}>Presupuestos al mes *</label>
                      <select
                        name="presupuestosAlMes"
                        id="presupuestosAlMes"
                        value={formData.presupuestosAlMes}
                        onChange={handleInputChange}
                        className={inputClass + ' cursor-pointer'}
                      >
                        <option value="Menos de 10">Menos de 10</option>
                        <option value="10-25">Entre 10 y 25</option>
                        <option value="25-50">Entre 25 y 50</option>
                        <option value="Más de 50">Más de 50</option>
                      </select>
                    </div>
                  </div>

                  {/* RGPD */}
                  <div className="pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        required
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-[#00CFE8] focus:ring-[#00CFE8] cursor-pointer accent-[#00CFE8]"
                      />
                      <span className="text-xs text-white/35 leading-normal">
                        Acepto registrar mis datos en la lista de espera de TRABFLOW y recibir comunicaciones de acceso, conforme a la{' '}
                        <span className="underline hover:text-white/60 transition-colors">política de privacidad</span>.
                      </span>
                    </label>
                  </div>

                  {submitError && (
                    <p className="text-xs text-red-400 font-semibold">{submitError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#FFC400] hover:brightness-110 py-3.5 font-black uppercase tracking-widest text-[#020B16] disabled:opacity-50 cursor-pointer text-xs transition-all shadow-lg shadow-[#FFC400]/20"
                    id="submit-waitlist-btn"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#020B16] border-t-transparent" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <span>Solicitar acceso gratuito</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </motion.form>
              ) : (
                <motion.div
                  key="submitted-banner"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="text-center py-10 space-y-6"
                  id="waitlist-success-banner"
                >
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-[#00CFE8]/30 bg-[#00CFE8]/10 text-[#00CFE8]">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black uppercase tracking-wider text-white">
                      ¡Suscripción completada!
                    </h3>
                    <p className="text-xs text-white/45 max-w-md mx-auto leading-relaxed">
                      Te hemos asignado tu turno prioritario. En las próximas 24-48 horas un especialista de TRABFLOW revisará tu oficio y provincia para habilitarte el canal beta en WhatsApp.
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 max-w-md mx-auto p-4 text-xs text-white/40 text-left space-y-1.5">
                    <span className="font-black block text-white/60 uppercase tracking-widest text-[9px] mb-2">¿Qué pasará ahora?</span>
                    <p>1. Recibirás un SMS para confirmar que tu teléfono tiene WhatsApp activo.</p>
                    <p>2. Te enviaremos un ejemplo personalizado para tu sector.</p>
                  </div>

                  <button
                    onClick={handleResetForm}
                    className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white/60 hover:border-white/40 hover:text-white transition-colors cursor-pointer"
                  >
                    Registrar otro autónomo
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Submitted entries log */}
        {savedEntries.length > 0 && (
          <div className="mt-16 rounded-2xl bg-[#0d1f38] border border-white/10 p-6 space-y-4" id="waitlist-logs-sandbox">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <div>
                <h3 className="font-black text-white text-sm uppercase tracking-widest">Registros locales</h3>
                <p className="text-xs text-white/35 mt-1">Guardados temporalmente en el navegador.</p>
              </div>
              <button
                onClick={() => setSavedEntries([])}
                className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
              >
                Limpiar
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedEntries.map((item, idx) => (
                <div key={idx} className="rounded-xl border border-white/8 bg-white/5 p-3.5 space-y-1.5 text-xs" id={`waitlist-log-item-${idx}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white truncate max-w-[150px]">{item.nombre}</span>
                    <span className="bg-[#00CFE8]/15 text-[#00CFE8] font-bold px-2 py-0.5 rounded text-[10px] uppercase font-mono">
                      {item.oficio}
                    </span>
                  </div>
                  <div className="space-y-0.5 text-white/35">
                    <p>{item.telefono}</p>
                    <p>{item.email}</p>
                    <p>{item.ciudad} · {item.presupuestosAlMes} pres./mes</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom CTA strip */}
        <div className="mt-16 rounded-2xl bg-[#0d1f38] border border-[#FFC400]/20 p-8 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-1">
            <div className="text-sm font-black uppercase tracking-widest text-white">
              ¿Prefieres ver la demo primero?
            </div>
            <p className="text-xs text-white/40">
              Prueba TRABFLOW en acción sin registro. Genera presupuestos por voz en segundos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-[#FFC400]" />
            <span className="text-xs font-black uppercase tracking-widest text-[#FFC400]">
              Ver demo interactiva →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
