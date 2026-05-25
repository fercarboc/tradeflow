/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TradeType, WaitlistFormInput } from '../types';
import { Send, CheckCircle2, Server, HelpCircle, Phone, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { submitWaitlist } from '../lib/supabase';

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
  const [showDevGuide, setShowDevGuide] = useState(false);
  const [savedEntries, setSavedEntries] = useState<WaitlistFormInput[]>([]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
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

  const handleClearEntries = () => {
    localStorage.removeItem('tradeflow_waitlist_submits');
    setSavedEntries([]);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 font-sans" id="contacto-view-container">
      {/* Title */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="inline-flex items-center gap-1.5 rounded bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-700 border border-slate-200 uppercase tracking-widest mb-3">
          Lista de Espera Abierta
        </span>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-950 tracking-tight leading-tight">
          Únete a la Beta de <span className="text-blue-600 font-bold">TrabFlow AI</span>
        </h1>
        <p className="mt-3 text-sm sm:text-base text-slate-505 max-w-xl mx-auto leading-relaxed">
          Las plazas son limitadas y se asignan por orden de registro técnico. Completa tus datos de autónomo o empresa instaladora para reservar tu acceso prioritario.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Col: Features list & support info */}
        <div className="lg:col-span-5 space-y-6 font-sans">
          <div className="bg-slate-950 text-white p-6 sm:p-8 rounded border border-slate-800 shadow-xs space-y-6">
            <h2 className="text-md font-display font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              Beneficios de la Beta Cerrada
            </h2>

            <ul className="space-y-4 text-xs text-slate-300">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-900 border border-slate-800 text-emerald-400 font-mono text-xs font-bold">1</span>
                <div>
                  <strong className="text-white block font-bold uppercase tracking-wide text-[10px] mb-0.5">Acceso gratuito ilimitado</strong>
                  <span className="leading-relaxed">Usa todas las funcionalidades de TrabFlow AI gratis durante los 3 meses de período beta cerrado.</span>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-900 border border-slate-800 text-emerald-400 font-mono text-xs font-bold">2</span>
                <div>
                  <strong className="text-white block font-bold uppercase tracking-wide text-[10px] mb-0.5">Asesoramiento directo</strong>
                  <span className="leading-relaxed">Te ayudamos a configurar tus plantillas de presupuesto y tarifas de mano de obra personalizadas por WhatsApp.</span>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-900 border border-slate-800 text-emerald-400 font-mono text-xs font-bold">3</span>
                <div>
                  <strong className="text-white block font-bold uppercase tracking-wide text-[10px] mb-0.5">Descuento vitalicio del 50%</strong>
                  <span className="leading-relaxed">Si decides continuar tras finalizar la beta, mantendrás la mitad de precio en el plan Pro para siempre.</span>
                </div>
              </li>
            </ul>

            <div className="pt-6 border-t border-slate-850 text-[10px] font-mono text-slate-405 uppercase tracking-widest flex items-center justify-between">
              <span>Nivel prioritario técnico activo</span>
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-[pulse_1.5s_infinite]"></span>
            </div>
          </div>

          <div className="p-6 rounded border border-slate-200 bg-white space-y-3.5">
            <h3 className="font-display font-bold text-slate-910 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
              <HelpCircle className="h-4.5 w-4.5 text-blue-500" />
              ¿Tienes preguntas previas?
            </h3>
            <p className="text-xs text-slate-550 leading-relaxed">
              Trabajamos para autónomos. Si tienes dudas sobre cómo capturamos los precios de los materiales o de las normativas de Hacienda, puedes hablarnos directamente por correo electrónico:
            </p>
            <div className="flex flex-col gap-2 pt-1 font-mono text-xs">
              <a href="mailto:soporte@trabflow.com" className="flex items-center gap-2 font-bold text-blue-600 hover:text-blue-700 transition-colors">
                <Send className="h-4 w-4" />
                <span>soporte@trabflow.com</span>
              </a>
              <div className="flex items-center gap-2 text-slate-505">
                <Phone className="h-4 w-4 flex-none" />
                <span className="font-sans">Atención Whatsapp Beta (Solo admitidos)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Interactive Waitlist Form */}
        <div className="lg:col-span-7 bg-white rounded border border-slate-200 p-6 sm:p-8 shadow-xs">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans">
                  {/* Nombre */}
                  <div className="space-y-1.5">
                    <label htmlFor="nombre" className="block text-[10px] font-bold text-slate-705 uppercase tracking-wider">
                      Nombre y Apellidos *
                    </label>
                    <input
                      required
                      type="text"
                      name="nombre"
                      id="nombre"
                      placeholder="Ej. Carlos Martínez"
                      value={formData.nombre}
                      onChange={handleInputChange}
                      className="w-full rounded border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-900 focus:border-blue-550 focus:bg-white focus:outline-none transition-all placeholder:text-slate-400 font-sans"
                    />
                  </div>

                  {/* Teléfono */}
                  <div className="space-y-1.5">
                    <label htmlFor="telefono" className="block text-[10px] font-bold text-slate-705 uppercase tracking-wider">
                      Teléfono Móvil (WhatsApp) *
                    </label>
                    <input
                      required
                      type="tel"
                      name="telefono"
                      id="telefono"
                      placeholder="Ej. +34 600 000 000"
                      value={formData.telefono}
                      onChange={handleInputChange}
                      className="w-full rounded border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-900 focus:border-blue-550 focus:bg-white focus:outline-none transition-all placeholder:text-slate-400 font-sans"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Email */}
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="block text-[10px] font-bold text-slate-705 uppercase tracking-wider">
                      Correo Electrónico *
                    </label>
                    <input
                      required
                      type="email"
                      name="email"
                      id="email"
                      placeholder="Ej. carlos@fontaneriamartinez.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full rounded border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-900 focus:border-blue-550 focus:bg-white focus:outline-none transition-all placeholder:text-slate-400 font-sans"
                    />
                  </div>

                  {/* Oficio */}
                  <div className="space-y-1.5">
                    <label htmlFor="oficio" className="block text-[10px] font-bold text-slate-705 uppercase tracking-wider">
                      Tu Oficio Principal *
                    </label>
                    <select
                      name="oficio"
                      id="oficio"
                      value={formData.oficio}
                      onChange={handleInputChange}
                      className="w-full rounded border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-900 focus:border-blue-550 focus:bg-white focus:outline-none transition-all cursor-pointer font-sans"
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
                  {/* Ciudad */}
                  <div className="space-y-1.5">
                    <label htmlFor="ciudad" className="block text-[10px] font-bold text-slate-705 uppercase tracking-wider">
                      Ciudad / Provincia *
                    </label>
                    <input
                      required
                      type="text"
                      name="ciudad"
                      id="ciudad"
                      placeholder="Ej. Madrid o Barcelona"
                      value={formData.ciudad}
                      onChange={handleInputChange}
                      className="w-full rounded border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-900 focus:border-blue-550 focus:bg-white focus:outline-none transition-all placeholder:text-slate-400 font-sans"
                    />
                  </div>

                  {/* Número de presupuestos */}
                  <div className="space-y-1.5">
                    <label htmlFor="presupuestosAlMes" className="block text-[10px] font-bold text-slate-705 uppercase tracking-wider">
                      Presupuestos al mes (aprox) *
                    </label>
                    <select
                      name="presupuestosAlMes"
                      id="presupuestosAlMes"
                      value={formData.presupuestosAlMes}
                      onChange={handleInputChange}
                      className="w-full rounded border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-900 focus:border-blue-550 focus:bg-white focus:outline-none transition-all cursor-pointer font-sans"
                    >
                      <option value="Menos de 10">Menos de 10</option>
                      <option value="10-25">Entre 10 y 25</option>
                      <option value="25-50">Entre 25 y 50</option>
                      <option value="Más de 50">Más de 50 presupuestos</option>
                    </select>
                  </div>
                </div>

                {/* Consentimiento RGPD */}
                <div className="pt-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      required
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-350 text-blue-650 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs text-slate-500 leading-normal">
                      Acepto registrar mis datos profesionales en la lista de espera de TrabFlow AI y recibir instrucciones de acceso, de conformidad con la <span className="underline hover:text-slate-700">política de privacidad</span>.
                    </span>
                  </label>
                </div>

                {/* Error de envío */}
                {submitError && (
                  <p className="text-xs text-red-600 font-semibold">{submitError}</p>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded bg-blue-600 hover:bg-blue-700 py-3.5 font-bold uppercase tracking-widest text-white disabled:opacity-50 cursor-pointer text-xs transition-colors"
                  id="submit-waitlist-btn"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Verificando especialidad...</span>
                    </div>
                  ) : (
                    <>
                      <span>Solicitar Acceso Gratuito a la Beta</span>
                      <Send className="h-4 w-4" />
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
                className="text-center py-8 space-y-6"
                id="waitlist-success-banner"
              >
                <div className="inline-flex h-16 w-16 items-center justify-center rounded border border-emerald-150 bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-display font-bold uppercase tracking-wider text-slate-950">¡Suscripción completada con éxito!</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Te hemos asignado tu turno prioritario. En las próximas 24-48 horas un especialista de TrabFlow revisará tu oficio y provincia para habilitarte el canal beta en WhatsApp.
                  </p>
                </div>

                <div className="p-4 rounded border border-slate-200 bg-slate-50 max-w-md mx-auto text-xs text-slate-500 text-left space-y-1">
                  <span className="font-bold block text-slate-700 uppercase tracking-widest text-[9px]">¿Qué pasará ahora?</span>
                  <p>1. Recibirás un SMS de comprobación para validar que el teléfono tiene activo WhatsApp.</p>
                  <p>2. Te enviaremos un ejemplo visual personalizado para tu sector (Fontanería, Clima, etc.).</p>
                </div>

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleResetForm}
                    className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Registrar otro autónomo
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Submitted Entries Log (Saves in localStorage mock) */}
      {savedEntries.length > 0 && (
        <div className="mt-16 bg-white p-6 rounded-3xl border border-slate-200/80 space-y-4" id="waitlist-logs-sandbox">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-display font-bold text-slate-900 text-base">Registros Locales (Simulador Beta)</h3>
              <p className="text-xs text-slate-500">Formulario listo para producción. Los registros quedan guardados temporalmente en tu navegador.</p>
            </div>
            <button
              onClick={handleClearEntries}
              className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
            >
              Limpiar registros
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedEntries.map((item, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs" id={`waitlist-log-item-${idx}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 truncate max-w-[150px]">{item.nombre}</span>
                  <span className="bg-blue-100 text-blue-800 font-medium px-2 py-0.5 rounded text-[10px] uppercase font-mono">
                    {item.oficio}
                  </span>
                </div>
                <div className="space-y-0.5 text-slate-500">
                  <p>📞 {item.telefono}</p>
                  <p>✉️ {item.email}</p>
                  <p>📍 {item.ciudad} • {item.presupuestosAlMes} pres./mes</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connection Guide to Supabase (Senior Full-stack Developer Value-add) */}
      <div className="mt-10" id="dev-supabase-connection-guide">
        <button
          onClick={() => setShowDevGuide(!showDevGuide)}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 py-3 text-xs font-bold font-mono tracking-wide text-slate-700 cursor-pointer"
        >
          <Server className="h-4 w-4 text-slate-500" />
          <span>{showDevGuide ? 'OCULTAR' : 'VER'} GUÍA DE CONEXIÓN A SUPABASE PARA DESARROLLADORES</span>
          <Database className="h-4 w-4 text-emerald-500" />
        </button>

        <AnimatePresence>
          {showDevGuide && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden bg-slate-900 text-slate-300 rounded-2xl border border-slate-800 mt-3 p-6 font-mono text-xs space-y-4"
              id="supabase-guide-panel"
            >
              <div>
                <span className="text-emerald-400 font-bold block mb-1">// 1. Ejecuta este script SQL en tu consola de Supabase:</span>
                <pre className="bg-slate-950 p-3 rounded-lg text-slate-400 overflow-x-auto select-all">
{`CREATE TABLE waitlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  nombre text NOT NULL,
  telefono text NOT NULL,
  email text NOT NULL,
  oficio text NOT NULL,
  ciudad text NOT NULL,
  presupuestos_al_mes text NOT NULL
);

-- Habilita políticas de inserción pública para captación de clientes
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir inserciones públicas" ON waitlist FOR INSERT WITH CHECK (true);
CREATE POLICY "Lectura solo para administradores" ON waitlist FOR SELECT USING (auth.role() = 'service_role');`}
                </pre>
              </div>

              <div className="pt-2">
                <span className="text-emerald-400 font-bold block mb-1">// 2. Código JS para conectar el formulario usando @supabase/supabase-js:</span>
                <pre className="bg-slate-950 p-3 rounded-lg text-slate-400 overflow-x-auto select-all">
{`import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
);

async function registrarEnWaitlist(datos) {
  const { data, error } = await supabase
    .from('waitlist')
    .insert([{
      nombre: datos.nombre,
      telefono: datos.telefono,
      email: datos.email,
      oficio: datos.oficio,
      ciudad: datos.ciudad,
      presupuestos_al_mes: datos.presupuestosAlMes
    }]);
    
  if (error) throw error;
  return data;
}`}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
