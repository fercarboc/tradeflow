/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ActivePage, TradeType, Testimonial } from '../types';
import { Mic, Image as ImageIcon, FileText, Send, Smartphone, TrendingUp, AlertTriangle, CheckCircle, Clock, Users, ArrowRight, Star, ShieldCheck, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface HomeViewProps {
  setCurrentPage: (page: ActivePage) => void;
  setPreselectedTrade: (trade: TradeType) => void;
  setInitialMobile?: (isMobile: boolean) => void;
}

export default function HomeView({ setCurrentPage, setPreselectedTrade, setInitialMobile }: HomeViewProps) {
  const [selectedTradeTab, setSelectedTradeTab] = useState<TradeType>('Fontanería');

  const handleGoToApp = (isMobile: boolean) => {
    if (setInitialMobile) {
      setInitialMobile(isMobile);
    }
    setCurrentPage(ActivePage.AppDashboard);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const testimonials: Testimonial[] = [
    {
      id: '1',
      nombre: 'Manolo Rodríguez',
      oficio: 'Fontanero Autónomo',
      ciudad: 'Sevilla',
      texto: 'Antes llegaba a casa a las 19:30 y me tocaba ponerme con la libreta a escribir presupuestos en un Excel hasta las 22:00. Ahora con TrabFlow, dicto el audio mientras voy en la furgoneta de vuelta. Para cuando llego, mi cliente ya lo ha aceptado por WhatsApp.',
      rating: 5,
    },
    {
      id: '2',
      nombre: 'Alejandro Sanz',
      oficio: 'Electricista Instalador',
      ciudad: 'Madrid',
      texto: 'La función de hacer una foto del cuadro eléctrico del cliente y que la IA extraiga los interruptores automáticos necesarios me ahorra comprar materiales de más. Mis clientes se quedan alucinados con la velocidad del PDF.',
      rating: 5,
    },
    {
      id: '3',
      nombre: 'Lucía Benítez',
      oficio: 'Técnico de Climatización / HVAC',
      ciudad: 'Sabadell',
      texto: 'Llevar presupuestos en papel era un horror de cara a la facturación de fin de mes. TrabFlow me permite guardar la ficha del aire acondicionado del cliente y pasarlo a factura en un botón. Un software sencillo que se agradece.',
      rating: 5,
    },
  ];

  const targetAudiences = [
    {
      oficio: 'Fontanería' as TradeType,
      desc: 'Para desatascos, reformas de baños, griferías, instalaciones de ósmosis y calderas.',
      example: '"Pon cambio de bajante general y latiguillos, material cien euros, mano de obra dos horas a treinta euros."',
      emoji: '🚰',
    },
    {
      oficio: 'Electricidad' as TradeType,
      desc: 'Boletines de luz, reubicación de focos, cableado, termos eléctricos y cuadros de automáticos.',
      example: '"Colocar seis tomas de corriente en el salón Simón 27 y tres focos LED ledvance, mano de obra ochenta euros."',
      emoji: '⚡',
    },
    {
      oficio: 'Climatización / HVAC' as TradeType,
      desc: 'Montaje de splits, desinfección de conductos, recargas de gas y contratos de calefacción.',
      example: '"Limpieza y saneamiento de filtros de split de dormitorio, cincuenta euros todo incluido."',
      emoji: '❄️',
    },
    {
      oficio: 'Cerrajería' as TradeType,
      desc: 'Aperturas de puertas de emergencia, cambios de bombín urgente, cerrojos secundarios y persianas.',
      example: '"Apertura de puerta blindada urgente en Calle Mayor, cien euros de tarifa plana."',
      emoji: '🔑',
    },
  ];

  const handleGoToWaitlist = (trade?: TradeType) => {
    if (trade) {
      setPreselectedTrade(trade);
    }
    setCurrentPage(ActivePage.Contacto);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoToHowItWorks = () => {
    setCurrentPage(ActivePage.ComoFunciona);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="font-sans space-y-20 pb-16" id="home-view-container">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-white border border-slate-200 rounded-lg p-6 sm:p-12 lg:p-16 shadow-xs" id="home-hero-section">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35" />

        <div className="relative z-10 mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Hero left text content */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-1.5 rounded bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600 border border-slate-200 uppercase tracking-widest">
              🚀 BETA PÚBLICA DE LANZAMIENTO
            </div>
            
            <h1 className="text-3.5xl sm:text-5xl font-display font-bold tracking-tight text-slate-950 leading-tight">
              Habla. TrabFlow crea el presupuesto, lo manda por WhatsApp{' '}
              <span className="text-blue-600">
                y factura cuando el cliente acepta.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-500 max-w-xl mx-auto lg:mx-0 leading-relaxed font-sans">
              La primera app inteligente e intuitiva para fontaneros, electricistas y técnicos HVAC de España. Diseña PDFs profesionales de obra al vuelo y deshazte del papeleo nocturno.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
              <button
                onClick={() => handleGoToApp(true)}
                className="group flex w-full sm:w-auto items-center justify-center gap-2 rounded bg-blue-600 px-6 py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-white hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                id="hero-cta-button-mobile-app"
              >
                <span>Probar en Móvil 📱</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              
              <button
                onClick={() => handleGoToApp(false)}
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded bg-slate-900 border border-slate-800 px-6 py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-white hover:bg-slate-850 transition-colors cursor-pointer shadow-sm"
                id="hero-cta-button-desktop-app"
              >
                <span>Probar en PC 💻</span>
              </button>
            </div>

            {/* Micro proof badges */}
            <div className="pt-6 border-t border-slate-200 flex flex-wrap items-center justify-center lg:justify-start gap-y-2 gap-x-6 text-[10px] font-mono uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Beta 100% Gratuita</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-emerald-600" />
                <span>Ahorra 2-3 horas diarias</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-emerald-600" />
                <span>+120 autónomos inscritos</span>
              </span>
            </div>
          </div>

          {/* Hero right visual asset */}
          <div className="lg:col-span-5 relative mt-6 lg:mt-0 flex justify-center">
            {/* Visual device canvas */}
            <div className="relative w-full max-w-[305px] bg-slate-50 rounded border border-slate-200 p-4 shadow-sm aspect-[9/16] overflow-hidden">
              {/* Simulated active App body */}
              <div className="bg-white h-full w-full rounded border border-slate-200 p-4 flex flex-col justify-between text-xs font-sans text-slate-600">
                <div className="space-y-4">
                  {/* Active call banner */}
                  <div className="flex justify-between items-center text-[10px] bg-blue-50/50 p-2.5 rounded border border-blue-100">
                    <span className="text-blue-700 font-bold uppercase animate-pulse">● Estado: Dictando</span>
                    <span className="font-mono text-blue-600 font-semibold">0:12</span>
                  </div>

                  {/* Speech bubble */}
                  <div className="bg-slate-50 p-3 rounded border border-slate-200 text-slate-700">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase mb-1">Tu voz en tiempo real:</span>
                    <p className="italic text-[10px] leading-tight">
                      "Apunta cambio de grifería de cobre para el fregadero de Juan Lorenzo en Calle Madrid..."
                    </p>
                  </div>

                  {/* AI Extractor block */}
                  <div className="bg-emerald-50/40 p-3 rounded border border-emerald-150 space-y-1.5">
                    <span className="text-[9px] font-mono font-bold text-emerald-700 block uppercase">Estructura Generada:</span>
                    <div className="grid grid-cols-2 text-[10px] gap-2">
                      <div className="bg-white p-1.5 rounded border border-emerald-100">
                        <strong className="text-slate-700 block text-[9px] uppercase text-slate-400 font-mono">Repuesto:</strong> 
                        <span className="text-slate-800 font-medium">Grifería cobre</span>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-emerald-100">
                        <strong className="text-slate-700 block text-[9px] uppercase text-slate-400 font-mono">Precio:</strong> 
                        <span className="text-emerald-700 font-bold">65,00€</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* WhatsApp preview bubble at phone bottom */}
                <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-blue-600 block text-[9px] uppercase font-mono">✓ PDF LISTO</span>
                    <span className="font-bold text-slate-800 font-mono text-xs">187,00€ Subtotal</span>
                  </div>
                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded text-[10px] uppercase tracking-wider text-center block cursor-pointer">
                    Mandar por WhatsApp
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. THE PROBLEM */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" id="problem-section">
        <div className="bg-red-50/10 rounded-lg border border-red-200/60 p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <span className="inline-flex items-center gap-1 rounded bg-red-100 text-red-800 border border-red-200 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
              El verdadero problema del instalador
            </span>
            <h2 className="text-2.5xl sm:text-4xl font-display font-bold text-slate-950 tracking-tight leading-tight">
              ¿Por qué los instaladores autónomos pierden hasta 3 horas al día?
            </h2>
            
            <p className="text-slate-500 text-sm leading-relaxed">
              Trabajas duro todo el día en el tajo, reparando tuberías o cableando locales. Pero el trabajo no acaba al volver a casa. Te toca lidiar con el lío de facturas, cuadernos arrugados en la furgoneta y presupuestos pendientes que tus clientes de WhatsApp te reclaman insistentes.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-white p-4 rounded border border-slate-200/80 space-y-1">
                <span className="text-sm font-bold text-slate-900 block">Facturas olvidadas</span>
                <p className="text-xs text-slate-500 leading-normal">Un tique que dejas en el salpicadero es dinero que pierdes al deducir IVA a fin de mes.</p>
              </div>
              <div className="bg-white p-4 rounded border border-slate-200/80 space-y-1">
                <span className="text-sm font-bold text-slate-900 block">Clientes que se enfrían</span>
                <p className="text-xs text-slate-500 leading-normal">Si tardas más de 24 horas en enviar el presupuesto del grifo, llaman a otro fontanero.</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white p-6 rounded border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 text-center lg:text-left">
            <div className="flex justify-center lg:justify-start">
              <div className="h-10 w-10 rounded bg-red-50 text-red-700 flex items-center justify-center border border-red-100">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            
            <span className="text-4xl font-display font-bold text-slate-950">
              -15% <span className="text-[10px] text-red-700 font-mono font-bold block uppercase tracking-wider mt-1">pérdida de facturación anual</span>
            </span>

            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              Estudios sectoriales indican que los instaladores que no presupuestan digitalmente incurren en pérdidas por redondeo de material y demoras de aceptación.
            </p>
          </div>
        </div>
      </section>

      {/* 3. STEP INSTRUCTION */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center" id="steps-section">
        <div className="max-w-2xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1 text-[10px] font-bold uppercase tracking-wider mb-2">
            La revolución del dictado
          </span>
          <h2 className="text-2.5xl sm:text-4xl font-display font-bold text-slate-950 tracking-tight leading-tight">
            La solución de TrabFlow en 3 sencillos pasos
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">Diseñada para técnicos que no quieren complicaciones tecnológicas ni ordenadores de oficina.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-xs space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded bg-blue-50 text-blue-600 border border-blue-100 shadow-xs">
              <Mic className="h-5 w-5" />
            </div>
            <h3 className="text-md font-display font-bold text-slate-950 uppercase tracking-wide">1. Dicta el trabajo</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              Solo cuéntale a TrabFlow lo que hiciste y el material usado. Nuestra inteligencia artificial entiende la jerga de instalaciones y extrae precios.
            </p>
          </div>

          <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-xs space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-xs">
              <CheckCircle className="h-5 w-5" />
            </div>
            <h3 className="text-md font-display font-bold text-slate-950 uppercase tracking-wide">2. Revisa el presupuesto</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              TrabFlow crea un borrador PDF oficial y elegante con IVA regulado, mano de obra y materiales perfectamente categorizados automáticamente.
            </p>
          </div>

          <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-xs space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded bg-amber-50 text-amber-600 border border-amber-100 shadow-xs">
              <Send className="h-5 w-5" />
            </div>
            <h3 className="text-md font-display font-bold text-slate-950 uppercase tracking-wide">3. Envíalo por WhatsApp</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              Compártelo instantáneamente con tu cliente en WhatsApp. Tu cliente lo puede firmar y aceptar directamente online desde su propio teléfono.
            </p>
          </div>
        </div>

        <div className="pt-8">
          <button
            onClick={handleGoToHowItWorks}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
          >
            <span>Ver cómo funciona con ejemplos de instalación</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* 4. KEY FEATURES (Funcionalidades) */}
      <section className="bg-slate-50 border border-slate-200 py-16 rounded-lg px-4 sm:px-6 lg:px-8" id="features-section">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2.5xl sm:text-4xl font-display font-bold text-slate-950 leading-tight tracking-tight">
              Funcionalidades pensadas en el autónomo real
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-3">Todas las herramientas que necesitas para olvidarte del papeleo de una vez por todas.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* V1 */}
            <div className="bg-white p-6 rounded border border-slate-200 shadow-xs space-y-4">
              <div className="h-10 w-10 rounded bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-105">
                <Mic className="h-5 w-5" />
              </div>
              <h3 className="text-md font-display font-bold text-slate-950 uppercase tracking-wide">Presupuestos por voz</h3>
              <p className="text-xs text-slate-505 leading-relaxed">
                Habla de forma natural. Sin rellenar formularios en pantallas pequeñas. La IA capta conceptos e IVA en segundos.
              </p>
            </div>

            {/* V2 */}
            <div className="bg-white p-6 rounded border border-slate-200 shadow-xs space-y-4">
              <div className="h-10 w-10 rounded bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-105">
                <ImageIcon className="h-5 w-5" />
              </div>
              <h3 className="text-md font-display font-bold text-slate-950 uppercase tracking-wide">Foto del trabajo</h3>
              <p className="text-xs text-slate-550 leading-relaxed">
                Toma fotos de equipos, piezas viejas o notas manuscritas e incorpóralas a la ficha del presupuesto para dar confianza.
              </p>
            </div>

            {/* V3 */}
            <div className="bg-white p-6 rounded border border-slate-200 shadow-xs space-y-4">
              <div className="h-10 w-10 rounded bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-105">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="text-md font-display font-bold text-slate-950 uppercase tracking-wide">PDF profesional</h3>
              <p className="text-xs text-slate-550 leading-relaxed">
                Estilo limpio y moderno. Cumple estrictamente el formato normativo español para que des una imagen impecable de cara al cliente.
              </p>
            </div>

            {/* V4 */}
            <div className="bg-white p-6 rounded border border-slate-200 shadow-xs space-y-4">
              <div className="h-10 w-10 rounded bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-105">
                <Smartphone className="h-5 w-5" />
              </div>
              <h3 className="text-md font-display font-bold text-slate-950 uppercase tracking-wide">Envío por WhatsApp</h3>
              <p className="text-xs text-slate-550 leading-relaxed">
                Notificación directa por chat. Tu cliente puede ver el PDF interactivo y aceptar online con su dedo desde el móvil.
              </p>
            </div>

            {/* V5 */}
            <div className="bg-white p-6 rounded border border-slate-200 shadow-xs space-y-4">
              <div className="h-10 w-10 rounded bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-105">
                <CheckCircle className="h-5 w-5" />
              </div>
              <h3 className="text-md font-display font-bold text-slate-950 uppercase tracking-wide">Conversión a factura</h3>
              <p className="text-xs text-slate-550 leading-relaxed">
                Cuando el cliente te dé el ok, convierte el presupuesto en factura numerada en un toque, lista para cobro bancario.
              </p>
            </div>

            {/* V6 */}
            <div className="bg-white p-6 rounded border border-slate-200 shadow-xs space-y-4">
              <div className="h-10 w-10 rounded bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-105">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h3 className="text-md font-display font-bold text-slate-950 uppercase tracking-wide">Exportación para asesor</h3>
              <p className="text-xs text-slate-550 leading-relaxed">
                Descarga de forma ordenada los ficheros de ingresos para tu trimestre fiscal de autónomo, ahorrándole horas a tu gestor.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. AUDIENCE / PUBLICO OBJETIV        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1 text-[10px] font-bold uppercase tracking-wider mb-2">
            Sectores Admitidos
          </span>
          <h2 className="text-2.5xl sm:text-4xl font-display font-bold text-slate-950 tracking-tight leading-tight">
            Hecho a medida para instaladores profesionales
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-3">Diseñamos bases de datos de materiales ajustados a las necesidades reales de cada profesión técnica:</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {targetAudiences.map((item, index) => {
            return (
              <div
                key={index}
                className="bg-white p-6 rounded border border-slate-200 shadow-xs hover:border-blue-300 transition-colors flex flex-col justify-between space-y-4"
                id={`target-audience-${index}`}
              >
                <div className="space-y-2">
                  <div className="text-3xl">{item.emoji}</div>
                  <h3 className="text-sm font-display font-semibold text-slate-950 uppercase tracking-wide">{item.oficio}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
                </div>

                <div className="bg-slate-50 p-3 rounded border border-slate-150 text-[10px] text-slate-600 space-y-1">
                  <span className="font-bold text-slate-400 block uppercase font-mono text-[9px]">Ejemplo Dictado:</span>
                  <p className="italic leading-relaxed">"{item.example}"</p>
                </div>

                <button
                  onClick={() => handleGoToWaitlist(item.oficio)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] uppercase tracking-wider font-bold py-2.5 rounded transition-colors cursor-pointer text-center block"
                >
                  Unirse Beta {item.oficio}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. TESTIMONIOS (Placeholders marked) */}
      <section className="bg-slate-50 py-16 rounded-lg px-4 sm:px-6 lg:px-8 border border-slate-200" id="testimonials-section">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block mb-1">PROBADORES DE CONFIANZA</span>
            <h2 className="text-2.5xl sm:text-4xl font-display font-bold text-slate-950 leading-tight tracking-tight">
              ¿Qué dicen otros autónomos que ya lo han probado?
            </h2>
            <p className="text-slate-400 text-xs mt-2 italic">* Testimonios ficticios de demostración de viabilidad para el pilotaje TrabFlow.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((test) => {
              return (
                <div
                  key={test.id}
                  className="bg-white p-6 rounded border border-slate-200 shadow-xs relative flex flex-col justify-between"
                  id={`testimonial-card-${test.id}`}
                >
                  <div className="space-y-3.5">
                    {/* Stars group */}
                    <div className="flex gap-0.5">
                      {[...Array(test.rating)].map((_, sIdx) => (
                        <Star key={sIdx} className="h-4.5 w-4.5 fill-amber-400 text-amber-400" />
                      ))}
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed font-sans italic">
                      "{test.texto}"
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 pt-5 mt-5 border-t border-slate-250">
                    <div className="h-9 w-9 bg-slate-100 border border-slate-200 rounded-sm flex items-center justify-center font-bold text-xs text-slate-700 uppercase">
                      {test.nombre.substring(0, 2)}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-950 text-xs block">{test.nombre}</span>
                      <span className="text-[10px] text-slate-400 block">{test.oficio} • {test.ciudad}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. PREVIEW MINI PRICING SECTION */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center" id="quick-pricing-ad-section">
        <div className="bg-slate-950 text-white rounded-lg p-8 sm:p-12 border border-slate-800 space-y-6">
          <h2 className="text-2xl sm:text-3.5xl font-display font-bold uppercase tracking-tight">Acceso Preferencial temporalmente GRATIS</h2>
          <p className="text-slate-300 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
            Planes desde 29€/mes diseñados para adaptarse a autónomos en solitario y cuadrillas de técnicos. Únete hoy a la beta para usar la aplicación de forma gratuita durante 3 meses enteros.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-y-2 gap-x-8 text-[11px] text-slate-450 font-mono uppercase tracking-wider">
            <span>Básico 29€/mes</span>
            <span className="text-slate-700">•</span>
            <span>Profesional (Pro) 49€/mes</span>
            <span className="text-slate-700">•</span>
            <span>Empresa 89€/mes</span>
          </div>

          <div className="pt-3">
            <button
              onClick={() => handleGoToWaitlist()}
              className="group inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-widest px-6 py-3 rounded cursor-pointer transition-colors shadow-sm"
            >
              <span>Acceder a la lista de espera</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
