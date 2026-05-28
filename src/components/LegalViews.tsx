 
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActivePage } from '../types';
import {
  ShieldCheck,
  Lock,
  FileText,
  AlertTriangle,
  Scale,
  Bot,
} from 'lucide-react';

interface LegalViewProps {
  page:
    | ActivePage.AvisoLegal
    | ActivePage.Privacidad
    | ActivePage.Cookies
    | ActivePage.Terminos
    | ActivePage.Beta
    | ActivePage.IADisclaimer;
  setCurrentPage: (page: ActivePage) => void;
}

export default function LegalViews({
  page,
  setCurrentPage,
}: LegalViewProps) {
  const handleGoContact = () => {
    setCurrentPage(ActivePage.Contacto);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#020B16] font-sans" id={`legal-view-${page}`}>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3 border-b border-white/10 pb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#00CFE8] shrink-0">
            {page === ActivePage.AvisoLegal && <FileText className="h-5 w-5" />}
            {page === ActivePage.Privacidad && <ShieldCheck className="h-5 w-5" />}
            {page === ActivePage.Cookies && <Lock className="h-5 w-5" />}
            {page === ActivePage.Terminos && <Scale className="h-5 w-5" />}
            {page === ActivePage.Beta && <AlertTriangle className="h-5 w-5" />}
            {page === ActivePage.IADisclaimer && <Bot className="h-5 w-5" />}
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
              {page === ActivePage.AvisoLegal && 'Aviso Legal'}
              {page === ActivePage.Privacidad && 'Política de Privacidad'}
              {page === ActivePage.Cookies && 'Política de Cookies'}
              {page === ActivePage.Terminos && 'Términos y Condiciones'}
              {page === ActivePage.Beta && 'Acuerdo Beta Privada'}
              {page === ActivePage.IADisclaimer && 'Disclaimer IA'}
            </h1>

            <p className="mt-1 font-mono text-[10px] uppercase text-white/30">
              Última actualización: Mayo de 2026
            </p>
          </div>
        </div>

        {page === ActivePage.AvisoLegal && (
          <div className="space-y-6 text-sm leading-relaxed text-white/55">
            <section className="space-y-3">
              <h2 className="text-md font-bold uppercase tracking-wider text-white">
                1. Datos Identificativos
              </h2>

              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <strong>Titular:</strong> TrabFlow Technologies S.L.
                </li>
                <li>
                  <strong>NIF:</strong> [PENDIENTE]
                </li>
                <li>
                  <strong>Domicilio:</strong> Paseo de la Castellana 124,
                  Madrid, España
                </li>
                <li>
                  <strong>Email:</strong> soporte@trabflow.com
                </li>
                <li>
                  <strong>Actividad:</strong> Software SaaS para instaladores
                  profesionales.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-md font-bold uppercase tracking-wider text-white">
                2. Uso del Sitio Web
              </h2>

              <p>
                El acceso y uso de esta plataforma atribuye la condición de
                usuario, aceptando plenamente las presentes condiciones.
              </p>

              <p>
                El usuario se compromete a utilizar TrabFlow de forma lícita,
                profesional y conforme a la legislación vigente.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-md font-bold uppercase tracking-wider text-white">
                3. Limitación de Responsabilidad
              </h2>

              <p>
                TrabFlow AI utiliza sistemas de inteligencia artificial que
                pueden generar errores, estimaciones incorrectas o resultados
                inexactos.
              </p>

              <p>
                El usuario es el único responsable de revisar y validar
                presupuestos, facturas, impuestos y documentación antes de su
                uso profesional.
              </p>

              <p>
                TrabFlow no será responsable de daños indirectos, pérdida de
                beneficios, pérdida de clientes, lucro cesante o pérdidas
                económicas derivadas del uso de la plataforma.
              </p>
            </section>
          </div>
        )}

        {page === ActivePage.Privacidad && (
          <div className="space-y-6 text-sm leading-relaxed text-white/55">
            <section className="space-y-3">
              <h2 className="text-md font-bold uppercase tracking-wider text-white">
                1. Responsable del Tratamiento
              </h2>

              <p>
                TrabFlow Technologies S.L. es responsable del tratamiento de los
                datos personales recogidos a través de la plataforma.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-md font-bold uppercase tracking-wider text-white">
                2. Finalidad de los Datos
              </h2>

              <ul className="list-disc space-y-1.5 pl-5">
                <li>Gestionar cuentas y acceso a la beta.</li>
                <li>Gestionar presupuestos y clientes.</li>
                <li>Enviar comunicaciones relacionadas con el servicio.</li>
                <li>Mejorar funcionalidades y experiencia de usuario.</li>
                <li>Analizar métricas de uso anonimizadas.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-md font-bold uppercase tracking-wider text-white">
                3. Servicios de Terceros
              </h2>

              <p>
                TrabFlow utiliza proveedores externos como Stripe, Supabase,
                OpenAI, Claude AI y WhatsApp API para prestar determinadas
                funcionalidades.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-md font-bold uppercase tracking-wider text-white">
                4. Derechos del Usuario
              </h2>

              <p>
                El usuario podrá ejercer sus derechos de acceso, rectificación,
                supresión, oposición y portabilidad escribiendo a:
                soporte@trabflow.com.
              </p>
            </section>
          </div>
        )}

        {page === ActivePage.Cookies && (
          <div className="space-y-6 text-sm leading-relaxed text-white/55">
            <section className="space-y-3">
              <h2 className="text-md font-bold uppercase tracking-wider text-white">
                1. Uso de Cookies
              </h2>

              <p>
                TrabFlow utiliza cookies técnicas, analíticas y funcionales para
                mejorar la experiencia del usuario y analizar el rendimiento de
                la plataforma.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-md font-bold uppercase tracking-wider text-white">
                2. Tipos de Cookies
              </h2>

              <ul className="list-disc space-y-1.5 pl-5">
                <li>Cookies técnicas esenciales.</li>
                <li>Cookies analíticas.</li>
                <li>Cookies de preferencias.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-md font-bold uppercase tracking-wider text-white">
                3. Gestión de Cookies
              </h2>

              <p>
                El usuario puede configurar o eliminar las cookies desde su
                navegador en cualquier momento.
              </p>
            </section>
          </div>
        )}

        {page === ActivePage.Terminos && (
          <div className="space-y-6 text-sm leading-relaxed text-white/55">
            <section className="space-y-3">
              <h2 className="text-md font-bold uppercase tracking-wider text-white">
                1. Naturaleza del Servicio
              </h2>

              <p>
                TrabFlow AI es un software SaaS profesional destinado a
                instaladores y autónomos técnicos.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-md font-bold uppercase tracking-wider text-white">
                2. Uso Bajo Responsabilidad del Usuario
              </h2>

              <p>
                El usuario reconoce que toda la información generada mediante IA
                debe ser supervisada y validada antes de su uso profesional.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-md font-bold uppercase tracking-wider text-white">
                3. Exclusión de Garantías
              </h2>

              <p>
                El servicio se proporciona “AS IS” y según disponibilidad.
                TrabFlow no garantiza disponibilidad ininterrumpida ni ausencia
                de errores.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-md font-bold uppercase tracking-wider text-white">
                4. Limitación Económica
              </h2>

              <p>
                La responsabilidad total acumulada de TrabFlow no excederá las
                cantidades abonadas por el usuario durante los últimos 3 meses.
              </p>
            </section>
          </div>
        )}

        {page === ActivePage.Beta && (
          <div className="space-y-6 text-sm leading-relaxed text-white/55">
            <section className="space-y-3">
              <h2 className="text-md font-bold uppercase tracking-wider text-white">
                Beta Privada
              </h2>

              <p>
                TrabFlow AI se encuentra actualmente en fase beta privada.
              </p>

              <p>
                Las funcionalidades pueden modificarse, interrumpirse o
                eliminarse sin previo aviso.
              </p>

              <p>
                El usuario acepta utilizar la plataforma bajo su propia
                responsabilidad durante esta fase.
              </p>
            </section>
          </div>
        )}

        {page === ActivePage.IADisclaimer && (
          <div className="space-y-6 text-sm leading-relaxed text-white/55">
            <section className="space-y-3">
              <h2 className="text-md font-bold uppercase tracking-wider text-white">
                Inteligencia Artificial
              </h2>

              <p>
                TrabFlow AI utiliza sistemas automatizados de inteligencia
                artificial para asistir en la generación de presupuestos,
                partidas y documentación.
              </p>

              <p>
                La IA puede producir errores, estimaciones incorrectas o
                contenido incompleto.
              </p>

              <p>
                El usuario es el único responsable de revisar y aprobar toda la
                información antes de enviarla a terceros.
              </p>
            </section>
          </div>
        )}

        <div className="mt-12 rounded-2xl border border-[#00CFE8]/15 bg-[#00CFE8]/5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-white">
                ¿Necesitas ayuda o ejercer tus derechos?
              </h3>

              <p className="mt-1 text-sm text-white/50">
                Contacta con el equipo legal y soporte de TrabFlow.
              </p>
            </div>

            <button
              onClick={handleGoContact}
              className="rounded-xl bg-[#FFC400] px-5 py-3 text-sm font-black uppercase tracking-widest text-[#020B16] transition-all hover:brightness-110"
            >
              Contactar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
