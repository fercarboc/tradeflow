import { useState } from 'react';
import { ArrowRight, Store, Package, BarChart3, Megaphone, Users, Truck, ShoppingCart, PackageCheck, Zap, Target, TrendingUp, Image, Eye, CheckCircle2 } from 'lucide-react';
import { ActivePage } from '../../types';
import ProveedoresLeadForm, { ProveedoresLeadFormVariant } from './ProveedoresLeadForm';

interface Props {
  setCurrentPage: (page: ActivePage) => void;
}

// ── Sub-componentes internos declarados FUERA del padre ──────────────────────

function ValidationBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/35 border border-white/10 rounded-full px-3 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-[#5B9BD5]/50" />
      Marketplace en fase de validación
    </span>
  );
}

function FlowSteps({ steps }: { steps: { label: string; emoji: string }[] }) {
  return (
    <div className="rounded-2xl bg-[#0d1f38] border border-white/10 p-6">
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-0">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-2 sm:gap-0">
            <div className="flex flex-col items-center gap-1 px-3">
              <span className="text-xl">{step.emoji}</span>
              <span className="text-[10px] font-bold text-white/55 text-center leading-tight max-w-[90px]">
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className="text-white/20 text-lg hidden sm:block">→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function ProveedoresView({ setCurrentPage }: Props) {

  const [leadFormVariant, setLeadFormVariant] = useState<ProveedoresLeadFormVariant | null>(null);

  const openProviderForm = () => setLeadFormVariant('provider');
  const openAdvertisingForm = () => setLeadFormVariant('advertising');
  const closeLeadForm = () => setLeadFormVariant(null);

  void setCurrentPage; // prop retenida por si se necesita en futuras navegaciones

  return (
    <div className="bg-[#020B16] min-h-screen font-sans">

      {/* ── SEO meta via document.title ──────────────── */}

      {/* ── 1. HERO ──────────────────────────────────── */}
      <div className="border-b border-white/10 py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Texto */}
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#5B9BD5]/30 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#5B9BD5] mb-6">
                <Store className="h-3.5 w-3.5" />
                Portal para proveedores
              </span>

              <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-5">
                Conecta tu catálogo con{' '}
                <span className="text-[#5B9BD5]">el instalador profesional</span>
              </h1>

              <p className="text-white/55 text-lg leading-relaxed mb-8">
                Gestiona productos, pedidos, promociones y visibilidad en el Marketplace de TrabFlow desde un único portal.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <button
                  onClick={openProviderForm}
                  className="inline-flex items-center justify-center gap-2 bg-[#1A5A96] hover:bg-[#1A5A96]/80 text-white font-bold text-sm px-6 py-3.5 rounded-xl transition-colors cursor-pointer group"
                >
                  Quiero ser proveedor
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
                <a
                  href="#como-funciona"
                  className="inline-flex items-center justify-center gap-2 border border-white/15 text-white/75 font-semibold text-sm px-6 py-3.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Descubre cómo funciona
                </a>
              </div>

              <ValidationBadge />
            </div>

            {/* Imagen del portal — placeholder sustituible por captura real */}
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <div className="bg-[#0d1f38] px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                </div>
                <span className="text-[10px] font-mono text-white/30 ml-2 uppercase tracking-wider">TrabFlow · Portal de Proveedor</span>
              </div>
              {/* Captura real del Portal — sustituir por captura real cuando esté disponible */}
              <img
                src="/marketplace/carousel/carrusel2.png"
                alt="Portal de Proveedor TrabFlow"
                className="w-full object-cover"
                style={{ maxHeight: '380px', objectPosition: 'top' }}
              />
            </div>

          </div>
        </div>
      </div>

      {/* ── 2. PROPUESTA DE VALOR ────────────────────── */}
      <div id="como-funciona" className="py-20 px-4 sm:px-6 lg:px-8 border-b border-white/5">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-4">
              Un canal de venta conectado al trabajo real
            </h2>
            <p className="text-white/40 max-w-2xl mx-auto leading-relaxed">
              TrabFlow no busca generar visitas sin contexto. Busca conectar proveedores con
              profesionales que necesitan materiales para trabajos reales.
            </p>
          </div>

          <FlowSteps steps={[
            { label: 'Instalador',              emoji: '👷' },
            { label: 'Gestiona un trabajo',     emoji: '📋' },
            { label: 'Necesita materiales',     emoji: '🔩' },
            { label: 'Marketplace TrabFlow',    emoji: '🛍️' },
            { label: 'Tu catálogo',             emoji: '📦' },
            { label: 'Pedido recibido',         emoji: '✅' },
          ]} />

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: Target, color: '#1A5A96',  title: 'Contexto',    text: 'El profesional está gestionando un trabajo real, no navegando sin propósito.' },
              { icon: Zap,    color: '#5B9BD5',  title: 'Intención',   text: 'La necesidad de material nace del presupuesto o del trabajo en curso.' },
              { icon: TrendingUp, color: '#4A6741', title: 'Conversión', text: 'El proveedor puede estar presente desde la búsqueda hasta el pedido.' },
            ].map(({ icon: Icon, color, title, text }) => (
              <div key={title} className="rounded-2xl bg-[#0d1f38] border border-white/10 p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="text-sm font-black uppercase tracking-wide text-white">{title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3. TU PORTAL DE PROVEEDOR ────────────────── */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 border-b border-white/5">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-4">
              Tu negocio dentro de TrabFlow
            </h2>
            <p className="text-white/40 max-w-xl mx-auto leading-relaxed">
              Todo tu canal TrabFlow desde un único panel. Sin depender de terceros.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Package,    color: '#1A5A96', title: 'Catálogo',    desc: 'Sube y gestiona productos, referencias, precios y disponibilidad. Actualiza en tiempo real.' },
              { icon: PackageCheck, color: '#4A6741', title: 'Pedidos',   desc: 'Recibe y gestiona los pedidos generados desde el Marketplace. Seguimiento completo del estado.' },
              { icon: Store,      color: '#C8922A', title: 'Tiendas',     desc: 'Gestiona puntos de venta, horarios y opciones de recogida o entrega para tus clientes.' },
              { icon: Users,      color: '#7C3AED', title: 'Equipo',      desc: 'Gestiona los usuarios de tu organización y su acceso al portal.' },
              { icon: BarChart3,  color: '#1A5A96', title: 'Informes',    desc: 'Consulta la actividad generada dentro del ecosistema TrabFlow.' },
              { icon: Megaphone,  color: '#B84E35', title: 'Promociones', desc: 'Crea ofertas, liquidaciones, novedades, envío gratuito y otras promociones sobre tu catálogo.' },
              { icon: Truck,      color: '#4A6741', title: 'Logística',   desc: 'Gestiona la preparación, envío y seguimiento de los pedidos del Marketplace.' },
              { icon: Image,      color: '#C8922A', title: 'Publicidad',  desc: 'Solicita espacios publicitarios y gestiona campañas y creatividades dentro del Marketplace.' },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl bg-[#0d1f38] border border-white/10 p-6 space-y-3 hover:border-white/20 transition-colors group"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${color}18` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="text-sm font-black text-white">{title}</h3>
                <p className="text-xs text-white/45 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 4. MARKETPLACE — TU CATÁLOGO DONDE COMPRAN ─ */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 border-b border-white/5">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#5B9BD5]/30 bg-[#5B9BD5]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#5B9BD5] mb-5">
                Catálogo visible
              </span>
              <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-5">
                Tu catálogo donde el profesional compra
              </h2>
              <p className="text-white/40 leading-relaxed mb-6">
                El Marketplace no es una tienda independiente. Forma parte del flujo de trabajo del instalador.
              </p>
              <ul className="space-y-3">
                {[
                  'El instalador busca materiales por categoría o referencia',
                  'Filtra y compara productos de diferentes proveedores',
                  'Consulta precios y disponibilidad en tiempo real',
                  'Añade productos al carrito de varios proveedores',
                  'Genera el pedido con un toque, con referencia y precio acordado',
                  'Selecciona entrega o recogida y hace seguimiento del pedido',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/60">
                    <CheckCircle2 className="w-4 h-4 text-[#5B9BD5] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Captura del catálogo */}
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-xl">
              <div className="bg-[#0d1f38] px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">TrabFlow · Marketplace Catálogo</span>
                <span className="text-[9px] font-mono text-[#5B9BD5] bg-[#5B9BD5]/10 px-2 py-0.5 rounded border border-[#5B9BD5]/20">Fase validación</span>
              </div>
              <img
                src="/marketplace/carousel/carrusel3.png"
                alt="Catálogo del Marketplace TrabFlow con filtros y productos"
                className="w-full object-cover"
                style={{ maxHeight: '380px', objectPosition: 'top' }}
              />
            </div>

          </div>
        </div>
      </div>

      {/* ── 5. DEL PRESUPUESTO AL PEDIDO ─────────────── */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 bg-[#070F1C] border-b border-white/5">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-4">
              Del presupuesto al pedido
            </h2>
            <p className="text-white/40 max-w-2xl mx-auto leading-relaxed">
              Los materiales necesarios para ejecutar un presupuesto pueden convertirse en una
              compra sin que el profesional tenga que reconstruir manualmente su pedido.
            </p>
          </div>

          <FlowSteps steps={[
            { label: 'Presupuesto',   emoji: '📋' },
            { label: 'Materiales',    emoji: '🔩' },
            { label: 'Comparar',      emoji: '⚖️' },
            { label: 'Carrito',       emoji: '🛒' },
            { label: 'Pedido',        emoji: '📦' },
            { label: 'Proveedor',     emoji: '🏭' },
          ]} />

          <p className="text-center text-white/30 text-sm mt-6 leading-relaxed">
            Flujo validado técnicamente. La conexión automática presupuesto→materiales se integra en la evolución del producto.
          </p>
        </div>
      </div>

      {/* ── 6. GESTIÓN DE PEDIDOS ────────────────────── */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 border-b border-white/5">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-4">
              Gestiona el pedido de principio a fin
            </h2>
            <p className="text-white/40 max-w-xl mx-auto leading-relaxed">
              El portal de proveedor incluye las herramientas necesarias para gestionar cada pedido desde que se recibe hasta la entrega.
            </p>
          </div>

          <FlowSteps steps={[
            { label: 'Pedido recibido',   emoji: '📥' },
            { label: 'Preparación',       emoji: '📦' },
            { label: 'Envío / Recogida',  emoji: '🚚' },
            { label: 'Seguimiento',       emoji: '📍' },
            { label: 'Entrega',           emoji: '✅' },
          ]} />

          <p className="text-center text-[#5B9BD5]/50 text-xs mt-5">
            Flujo operativo actualmente en validación con proveedores y datos de prueba.
          </p>
        </div>
      </div>

      {/* ── 7. PROMOCIONES ───────────────────────────── */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 bg-[#070F1C] border-b border-white/5">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8922A]/30 bg-[#C8922A]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#C8922A] mb-5">
                Herramientas comerciales
              </span>
              <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-5">
                Activa promociones sin alterar el ranking
              </h2>
              <p className="text-white/40 leading-relaxed mb-6">
                Un proveedor puede crear promociones asociadas a su catálogo para comunicar
                oportunidades comerciales al comprador. Las promociones aportan información al comprador,
                pero no modifican el ranking objetivo del Marketplace.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {['Oferta', 'Liquidación', 'Novedad', 'Envío gratuito', 'Vuelta a stock', 'Promoción local', 'Promoción nacional', 'Producto destacado'].map((tipo) => (
                  <div key={tipo} className="flex items-center gap-2 bg-[#0d1f38] border border-white/8 rounded-xl px-3 py-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C8922A]" />
                    <span className="text-xs font-medium text-white/65">{tipo}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Captura de Promociones — placeholder */}
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-xl">
              <div className="bg-[#0d1f38] px-4 py-3 border-b border-white/10">
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">Portal Proveedor · Promociones</span>
              </div>
              {/* Sustituir por captura real de la pantalla Promociones del portal */}
              <div className="bg-[#0d1f38] p-8 flex flex-col items-center justify-center min-h-[280px] text-center gap-4">
                <Megaphone className="w-12 h-12 text-[#C8922A]/40" />
                <div>
                  <p className="text-white/30 text-sm font-bold uppercase tracking-widest mb-1">Pantalla Promociones</p>
                  <p className="text-white/20 text-xs">Sustituir por captura real del portal</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 8. PUBLICIDAD MARKETPLACE ────────────────── */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 border-b border-white/5">
        <div className="mx-auto max-w-7xl space-y-12">
          <div className="text-center">
            <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-4">
              Más visibilidad cuando quieras destacar
            </h2>
            <p className="text-white/40 max-w-2xl mx-auto leading-relaxed">
              TrabFlow dispone de un inventario publicitario propio dentro del Marketplace.
              Los proveedores pueden solicitar espacios, gestionar campañas y actualizar sus creatividades desde el portal.
            </p>
          </div>

          {/* Flujo publicidad */}
          <FlowSteps steps={[
            { label: 'Espacio disponible', emoji: '🗺️' },
            { label: 'Solicitud',          emoji: '📝' },
            { label: 'Aprobación',         emoji: '✅' },
            { label: 'Reserva',            emoji: '📅' },
            { label: 'Creatividad',        emoji: '🖼️' },
            { label: 'Aprobación',         emoji: '✅' },
            { label: 'Publicación',        emoji: '📡' },
          ]} />

          {/* Explicación del modelo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="rounded-2xl bg-[#0d1f38] border border-white/10 p-7 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-[#1A5A96]/18 flex items-center justify-center">
                <Eye className="w-5 h-5 text-[#5B9BD5]" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-wide text-white">Cómo funciona la reserva</h3>
              <p className="text-sm text-white/50 leading-relaxed">
                El proveedor no compra un banner concreto. Reserva el derecho de uso de un espacio
                publicitario durante un periodo determinado.
              </p>
              <p className="text-sm text-white/50 leading-relaxed">
                Durante ese periodo puede cambiar imagen, creatividad, producto, oferta o titular
                — sin necesidad de volver a contratar el espacio.
              </p>
              <p className="text-sm text-white/40 leading-relaxed border-t border-white/8 pt-3">
                Cada nueva creatividad debe pasar por aprobación de TrabFlow antes de publicarse.
              </p>
            </div>

            {/* Capturas de publicidad — placeholders */}
            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden border border-white/10">
                <div className="bg-[#0d1f38] px-4 py-3 border-b border-white/10">
                  <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">Portal Proveedor · Espacios disponibles</span>
                </div>
                <div className="bg-[#0d1f38] p-6 flex flex-col items-center justify-center min-h-[140px] text-center gap-3">
                  <Store className="w-8 h-8 text-[#1A5A96]/40" />
                  <p className="text-white/20 text-xs">Sustituir por captura real del mapa de espacios</p>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden border border-white/10">
                <div className="bg-[#0d1f38] px-4 py-3 border-b border-white/10">
                  <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">Portal Proveedor · Campañas</span>
                </div>
                <div className="bg-[#0d1f38] p-6 flex flex-col items-center justify-center min-h-[140px] text-center gap-3">
                  <Image className="w-8 h-8 text-[#C8922A]/40" />
                  <p className="text-white/20 text-xs">Sustituir por captura real de campañas</p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA publicidad */}
          <div className="text-center pt-4">
            <button
              onClick={openAdvertisingForm}
              className="inline-flex items-center gap-2 border border-[#C8922A]/30 text-[#C8922A]/80 hover:text-[#C8922A] hover:border-[#C8922A]/50 font-semibold text-sm px-6 py-3 rounded-xl hover:bg-[#C8922A]/5 transition-colors cursor-pointer"
            >
              Solicitar información de publicidad
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[10px] text-white/20 mt-2">Actualmente sin coste durante la fase de validación.</p>
          </div>

        </div>
      </div>

      {/* ── 9. PROMOCIONES VS PUBLICIDAD ─────────────── */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 bg-[#070F1C] border-b border-white/5">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-4">
              Promociones vs Publicidad
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              Dos herramientas distintas para distintos objetivos comerciales.
            </p>
          </div>

          {/* Desktop: 2 columnas. Mobile: 2 cards apiladas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Promociones */}
            <div className="rounded-2xl border border-[#C8922A]/25 bg-[#C8922A]/5 p-7 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#C8922A]/15 flex items-center justify-center">
                  <Megaphone className="w-5 h-5 text-[#C8922A]" />
                </div>
                <h3 className="text-base font-black text-white uppercase tracking-wide">Promociones</h3>
              </div>
              <ul className="space-y-2.5">
                {[
                  'Asociadas al catálogo del proveedor',
                  'Ofertas y condiciones comerciales',
                  'Liquidaciones, novedades, envío gratuito',
                  'Visibles en catálogo y perfil del proveedor',
                  'No alteran el ranking del Marketplace',
                  'Sin aprobación previa de TrabFlow',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-white/60">
                    <span className="text-[#C8922A] mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Publicidad */}
            <div className="rounded-2xl border border-[#1A5A96]/30 bg-[#1A5A96]/5 p-7 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1A5A96]/18 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-[#5B9BD5]" />
                </div>
                <h3 className="text-base font-black text-white uppercase tracking-wide">Publicidad</h3>
              </div>
              <ul className="space-y-2.5">
                {[
                  'Espacios destacados del Marketplace',
                  'Inventario limitado de posiciones',
                  'Contratación por periodo definido',
                  'Creatividades intercambiables durante la reserva',
                  'Aprobación de TrabFlow antes de publicar',
                  'Mayor visibilidad e impacto visual',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-white/60">
                    <span className="text-[#5B9BD5] mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ── 10. POR QUÉ TRABFLOW ─────────────────────── */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 border-b border-white/5">
        <div className="mx-auto max-w-5xl text-center space-y-8">
          <h2 className="text-3xl font-black uppercase tracking-tight text-white">
            Más cerca del momento de compra
          </h2>
          <p className="text-white/55 text-lg leading-relaxed max-w-2xl mx-auto">
            TrabFlow quiere conectar el momento en que un profesional sabe qué necesita
            con el proveedor capaz de suministrárselo.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {[
              { icon: Target,     color: '#1A5A96', title: 'Contexto',    text: 'El profesional está gestionando un trabajo real. No es un comprador sin propósito.' },
              { icon: Zap,        color: '#5B9BD5', title: 'Intención',   text: 'Ya sabe qué materiales necesita. La intención de compra está definida.' },
              { icon: TrendingUp, color: '#4A6741', title: 'Conversión',  text: 'Puede pasar de esa necesidad al pedido sin abandonar TrabFlow.' },
            ].map(({ icon: Icon, color, title, text }) => (
              <div key={title} className="rounded-2xl bg-[#0d1f38] border border-white/10 p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="text-sm font-black uppercase tracking-wide text-white">{title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 11. FASE ACTUAL ───────────────────────────── */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 bg-[#070F1C] border-b border-white/5">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-[#5B9BD5]/20 bg-[#5B9BD5]/5 p-10 text-center space-y-6">
            <div className="inline-flex items-center gap-2 border border-[#5B9BD5]/30 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#5B9BD5]">
              <span className="w-2 h-2 rounded-full bg-[#5B9BD5] animate-pulse" />
              Fase de validación
            </div>

            <h2 className="text-2xl font-black text-white">
              Estamos construyendo el Marketplace junto al sector
            </h2>

            <p className="text-white/50 leading-relaxed max-w-xl mx-auto">
              El Marketplace y el Portal de Proveedor están operativos con datos y proveedores de prueba.
              La siguiente fase consiste en validar el modelo con profesionales y proveedores reales
              antes de escalar.
            </p>

            <button
              onClick={openProviderForm}
              className="inline-flex items-center gap-2 bg-[#1A5A96] hover:bg-[#1A5A96]/80 text-white font-bold text-sm px-6 py-3.5 rounded-xl transition-colors cursor-pointer group"
            >
              Quiero participar como proveedor
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 12. CTA FINAL ────────────────────────────── */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0F1A2E]">
        <div className="mx-auto max-w-3xl text-center space-y-6">
          <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight">
            ¿Quieres conectar tu catálogo con los profesionales de TrabFlow?
          </h2>
          <p className="text-white/50 leading-relaxed">
            Estamos seleccionando proveedores para las primeras fases de validación del Marketplace.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={openProviderForm}
              className="inline-flex items-center justify-center gap-2 bg-[#1A5A96] hover:bg-[#1A5A96]/80 text-white font-bold text-base px-7 py-4 rounded-xl transition-colors cursor-pointer group shadow-lg shadow-[#1A5A96]/20"
            >
              Quiero ser proveedor
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={openAdvertisingForm}
              className="inline-flex items-center justify-center gap-2 border border-[#C8922A]/30 text-[#C8922A]/80 hover:text-[#C8922A] hover:border-[#C8922A]/50 font-semibold text-base px-7 py-4 rounded-xl hover:bg-[#C8922A]/5 transition-colors cursor-pointer"
            >
              Solicitar información de publicidad
            </button>
          </div>
          <ValidationBadge />
        </div>
      </div>

      {/* ── MODAL FORMULARIO DE LEAD ─────────────────── */}
      {leadFormVariant && (
        <ProveedoresLeadForm variant={leadFormVariant} onClose={closeLeadForm} />
      )}

    </div>
  );
}
