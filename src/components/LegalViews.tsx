/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActivePage } from '../types';
import { ShieldCheck, Lock, FileText } from 'lucide-react';

interface LegalViewProps {
  page: ActivePage.AvisoLegal | ActivePage.Privacidad | ActivePage.Cookies;
  setCurrentPage: (page: ActivePage) => void;
}

export default function LegalViews({ page, setCurrentPage }: LegalViewProps) {
  const handleGoContact = () => {
    setCurrentPage(ActivePage.Contacto);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 font-sans text-slate-700" id={`legal-view-${page}`}>
      <div className="mb-8 flex items-center gap-3 border-b border-slate-200 pb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-100 text-slate-700 border border-slate-200 shadow-xs shrink-0">
          {page === ActivePage.AvisoLegal && <FileText className="h-5 w-5" />}
          {page === ActivePage.Privacidad && <ShieldCheck className="h-5 w-5" />}
          {page === ActivePage.Cookies && <Lock className="h-5 w-5" />}
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-950 uppercase tracking-tight">
            {page === ActivePage.AvisoLegal && 'Aviso Legal'}
            {page === ActivePage.Privacidad && 'Política de Privacidad'}
            {page === ActivePage.Cookies && 'Política de Cookies'}
          </h1>
          <p className="text-[10px] text-slate-400 font-mono uppercase mt-1">Última actualización: Mayo de 2026</p>
        </div>
      </div>

      {page === ActivePage.AvisoLegal && (
        <div className="space-y-6 leading-relaxed text-sm text-slate-600" id="aviso-legal-content">
          <section className="space-y-3">
            <h2 className="text-md font-display font-bold uppercase tracking-wider text-slate-950">1. Datos Identificativos</h2>
            <p>
              En cumplimiento del deber de información recogido en el artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y del Comercio Electrónico (LSSI-CE), se facilitan los siguientes datos:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 font-sans">
              <li><strong>Titular:</strong> TrabFlow Technologies S.L. (Socio fundador en constitución para Beta)</li>
              <li><strong>NIF:</strong> B-00000000 (Provisional)</li>
              <li><strong>Domicilio Social:</strong> Paseo de la Castellana 124, 28046 Madrid, España</li>
              <li><strong>Email de Contacto:</strong> <span className="text-blue-600 font-semibold font-mono">soporte@trabflow.com</span></li>
              <li><strong>Actividad Social:</strong> Desarrollo de soluciones de software de productividad para instaladores.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-md font-display font-bold uppercase tracking-wider text-slate-955">2. Usuarios e Condiciones</h2>
            <p>
              El acceso y/o uso de este portal atribuye la condición de USUARIO, que acepta, desde dicho acceso y/o uso, las Condiciones Generales de Uso aquí reflejadas. Las citadas Condiciones serán de aplicación indeformablemente de las Condiciones Generales de Contratación que en su caso resulten de obligado cumplimiento cuando la beta pase a ser comercial.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-md font-display font-bold uppercase tracking-wider text-slate-955">3. Uso de la Web y Limitaciones de la Beta</h2>
            <p>
              <code className="bg-slate-100 text-slate-900 border border-slate-200 px-1.5 py-0.5 rounded text-xs font-mono">trabflow.com</code> proporciona el acceso a multitud de informaciones, servicios o datos pertenecientes a TrabFlow Technologies S.L. o a sus licenciantes a los que el USUARIO pueda tener acceso.
            </p>
            <p>
              El USUARIO asume la responsabilidad del uso del portal de la beta. Dicha responsabilidad se extiende al registro de la lista de espera que fuese necesario para acceder a la beta limitada del servicio de presupuestación AI. En dicho registro el USUARIO será responsable de aportar información veraz y lícita correspondiente a su actividad profesional como instalador.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-md font-display font-bold uppercase tracking-wider text-slate-955">4. Propiedad Intelectual e Industrial</h2>
            <p>
              TrabFlow Technologies S.L. por sí o como cesionaria, es titular de todos los derechos de propiedad intelectual e industrial de su página web, así como de los elementos contenidos en la misma (a título enunciativo, imágenes, sonido, audio, vídeo, software o textos; marcas o logotipos, combinaciones de colores, estructura y diseño, selección de materiales usados, programas de ordenador necesarios para su funcionamiento, acceso y uso, etc.).
            </p>
            <p>
              Todos los derechos reservados. Quedan expresamente prohibidas la reproducción, la distribución y la comunicación pública, incluida su modalidad de puesta a disposición, de la totalidad o parte de los contenidos de esta página web, con fines comerciales, en cualquier soporte y por cualquier medio técnico, sin la autorización de la empresa.
            </p>
          </section>
        </div>
      )}

      {page === ActivePage.Privacidad && (
        <div className="space-y-6 leading-relaxed text-sm text-slate-600" id="privacidad-content">
          <section className="space-y-3">
            <h2 className="text-md font-display font-bold uppercase tracking-wider text-slate-955">1. Responsable del Tratamiento</h2>
            <p>
              El responsable de los datos es **TrabFlow Technologies S.L.**, titular de la marca y software **TrabFlow AI**. Sus datos recogidos a través del formulario de lista de espera serán tratados de forma ética, segura y transparente de acuerdo al Reglamento General de Protección de Datos (RGPD UE 2016/679) y la Ley Orgánica 3/2018 (LOPDGDD).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-md font-display font-bold uppercase tracking-wider text-slate-955">2. Finalidad del Tratamiento de Datos</h2>
            <p>
              Tratamos la información que nos facilitan las personas interesadas (instaladores profesionales) con las siguientes finalidades:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 font-sans">
              <li>Gestionar su suscripción y orden de prioridad en la **Lista de Espera de la Beta Cerrada** de TrabFlow AI.</li>
              <li>Validar que su perfil encaja en los oficios solicitados (fontaneros, electricistas, HVAC, cerrajeros) para modular el alcance del feedback del producto.</li>
              <li>Enviar comunicaciones informativas sobre el lanzamiento, demostraciones del uso de presupuestos por voz e instrucciones de descarga de la aplicación móvil.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-md font-display font-bold uppercase tracking-wider text-slate-955">3. Datos Solicitados</h2>
            <p>
              Para apuntarse a la beta, solicitamos los siguientes datos de contacto profesionales:
            </p>
            <ul className="list-disc pl-5 space-y-1 font-sans">
              <li>Nombre y apellidos</li>
              <li>Teléfono móvil (crucial para integraciones de prueba de WhatsApp)</li>
              <li>Dirección de Correo electrónico</li>
              <li>Oficio o Especialidad técnica</li>
              <li>Ciudad (para estimar tasas de desplazamiento y bases de precios locales)</li>
              <li>Volumen estimado de presupuestos confeccionados mensualmente</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-md font-display font-bold uppercase tracking-wider text-slate-955">4. Derechos del Usuario</h2>
            <p>
              Cualquier instalador inscrito tiene derecho a obtener confirmación sobre si en TrabFlow estamos tratando sus datos personales. Tiene derecho a acceder a sus datos personales, así como a solicitar la rectificación de los datos inexactos o, en su caso, solicitar su supresión cuando, entre otros motivos, los datos ya no sean necesarios para los fines que fueron recogidos. Puede solicitar la baja instantánea de nuestra lista de espera enviando un correo con el asunto "BAJA BETA" a <span className="text-blue-600 font-semibold font-mono">soporte@trabflow.com</span>.
            </p>
          </section>
        </div>
      )}

      {page === ActivePage.Cookies && (
        <div className="space-y-6 leading-relaxed text-sm text-slate-600" id="cookies-content">
          <p>
            En TrabFlow AI nos tomamos en serio tu privacidad. Esta web utiliza "cookies" propias y de terceros con el único fin de analizar el rendimiento de la landing page, recordar tus preferencias si te registraste para la beta, y optimizar tu velocidad de navegación.
          </p>

          <section className="space-y-3">
            <h2 className="text-md font-display font-bold uppercase tracking-wider text-slate-955">1. ¿Qué es una Cookie?</h2>
            <p>
              Una cookie es un pequeño archivo de texto almacenado en su navegador que nos ayuda a identificar si eres un visitante recurrente, si perteneces a un instalador registrado, o cómo has interaccionado con nuestro formulario de captación para la lista de espera.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-md font-display font-bold uppercase tracking-wider text-slate-955">2. Tipos de Cookies que utilizamos</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
              <div className="p-4 rounded border border-slate-200 bg-white shadow-xs">
                <span className="font-bold text-slate-950 block text-xs uppercase tracking-wide mb-1">Cookies Técnicas (Esenciales)</span>
                <p className="text-xs text-slate-500">Necesarias para la carga correcta del sitio de TrabFlow, el funcionamiento del cambio de pestañas de navegación, y el estado del formulario de suscripción.</p>
              </div>
              <div className="p-4 rounded border border-slate-200 bg-white shadow-xs">
                <span className="font-bold text-slate-955 block text-xs uppercase tracking-wide mb-1">Cookies Analíticas (Opcionales)</span>
                <p className="text-xs text-slate-500">Recopilan información anónima sobre el número de visitantes, el tiempo en la página de precios, y qué oficios son los más demandados en la beta móvil.</p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-md font-display font-bold uppercase tracking-wider text-slate-955">3. Control y Desactivación</h2>
            <p>
              Usted puede en cualquier momento restringir, bloquear o borrar las cookies de este sitio web modificando la configuración de su navegador web (Chrome, Firefox, Safari o Microsoft Edge). 
            </p>
          </section>
        </div>
      )}

      {/* Action panel */}
      <div className="mt-12 p-6 rounded border border-slate-200 bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
        <div>
          <span className="font-display font-bold text-slate-950 text-md block uppercase tracking-wide">¿Tienes dudas sobre los términos?</span>
          <p className="text-xs text-slate-500 mt-1 font-sans">Nuestros términos están pensados para proteger tu negocio. Escríbenos.</p>
        </div>
        <button
          onClick={handleGoContact}
          className="rounded bg-slate-900 border border-slate-950 text-white px-5 py-2.5 font-bold uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all cursor-pointer whitespace-nowrap"
        >
          Contactar con soporte
        </button>
      </div>
    </div>
  );
}
