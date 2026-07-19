export interface SugOption {
  id: string;
  label: string;
  descripcion: string;
  precio: number;
  precioCoste: number;
  unidad: string;
  familia: string;
  tipo: 'material' | 'mano_de_obra';
  cantidad?: number; // default quantity (for multi-select)
}

export interface SugCategory {
  id: string;
  label: string;
  icon: string;
  keywords: string[]; // if ANY keyword found in quote text → category is covered
  options: SugOption[];
  multi?: boolean; // allow multiple options with independent quantities
  optional?: boolean;
}

export interface SugTemplate {
  id: string;
  label: string;
  icon: string;
  keywords: string[]; // to detect room type from partidas text
  categories: SugCategory[];
}

// ─── BAÑO ──────────────────────────────────────────────────────────────────
const SUG_BANO: SugTemplate = {
  id: 'bano',
  label: 'Baño',
  icon: '🚿',
  keywords: ['baño', 'bano', 'ducha', 'sanitari', 'wc', 'inodoro', 'lavabo', 'mampara', 'bañera', 'banera', 'plato de ducha'],
  categories: [
    {
      id: 'inodoro',
      label: 'Inodoro / WC',
      icon: '🚽',
      keywords: ['inodoro', 'wc', 'retrete'],
      options: [
        { id: 'inodoro_suelo', label: 'Suelo básico', descripcion: 'Inodoro suelo básico blanco + instalación', precio: 180, precioCoste: 90, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
        { id: 'inodoro_susp_std', label: 'Suspendido estándar', descripcion: 'Inodoro suspendido + cisterna empotrada + instalación', precio: 420, precioCoste: 240, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
        { id: 'inodoro_susp_premium', label: 'Suspendido premium (Roca/Grohe)', descripcion: 'Inodoro suspendido rimless + cisterna Geberit + instalación', precio: 750, precioCoste: 470, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
      ],
    },
    {
      id: 'ducha_banera',
      label: 'Plato de ducha / Bañera',
      icon: '🛁',
      keywords: ['plato', 'ducha', 'bañera', 'banera'],
      options: [
        { id: 'plato_80', label: 'Plato ducha 80×80', descripcion: 'Plato ducha acrílico 80×80 + instalación', precio: 185, precioCoste: 95, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
        { id: 'plato_90', label: 'Plato ducha extraplano 90×90', descripcion: 'Plato ducha extraplano 90×90 + desagüe + instalación', precio: 230, precioCoste: 125, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
        { id: 'plato_120x70', label: 'Plato ducha 120×70', descripcion: 'Plato ducha extraplano 120×70 + desagüe + instalación', precio: 285, precioCoste: 158, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
        { id: 'banera_150', label: 'Bañera acrílica 150cm', descripcion: 'Bañera acrílica 150cm + instalación', precio: 320, precioCoste: 178, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
        { id: 'banera_170', label: 'Bañera acrílica 170cm', descripcion: 'Bañera acrílica 170cm + instalación', precio: 390, precioCoste: 225, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
      ],
    },
    {
      id: 'mampara',
      label: 'Mampara / Cortina',
      icon: '🪟',
      keywords: ['mampara', 'cortina ducha', 'pantalla ducha'],
      options: [
        { id: 'cortina', label: 'Cortina de ducha', descripcion: 'Cortina ducha + barra + instalación', precio: 38, precioCoste: 18, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
        { id: 'mampara_fija', label: 'Mampara fija 1 hoja', descripcion: 'Mampara ducha fija 1 hoja cristal templado 6mm + instalación', precio: 290, precioCoste: 162, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
        { id: 'mampara_abatible', label: 'Mampara abatible', descripcion: 'Mampara abatible cristal 6mm + perfilería aluminio + instalación', precio: 430, precioCoste: 255, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
        { id: 'mampara_corredera', label: 'Mampara corredera 2 hojas', descripcion: 'Mampara corredera 2 hojas cristal + aluminio + instalación', precio: 390, precioCoste: 228, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
      ],
    },
    {
      id: 'lavabo_mueble',
      label: 'Lavabo / Mueble de baño',
      icon: '🪥',
      keywords: ['lavabo', 'mueble baño', 'encimera baño', 'lavamanos'],
      options: [
        { id: 'lavabo_simple', label: 'Lavabo empotrar 60cm', descripcion: 'Lavabo empotrar porcelana 60cm + instalación', precio: 125, precioCoste: 62, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
        { id: 'mueble_60', label: 'Mueble + lavabo 60cm', descripcion: 'Mueble suspendido 60cm + lavabo integrado + instalación', precio: 460, precioCoste: 272, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
        { id: 'mueble_80', label: 'Mueble + lavabo 80cm', descripcion: 'Mueble suspendido 80cm + lavabo integrado + instalación', precio: 590, precioCoste: 348, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
        { id: 'mueble_espejo_80', label: 'Mueble + lavabo + espejo LED 80cm', descripcion: 'Conjunto mueble 80cm + lavabo + espejo LED retroiluminado + instalación', precio: 870, precioCoste: 535, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
      ],
    },
    {
      id: 'espejo',
      label: 'Espejo (si no incluido)',
      icon: '🪞',
      keywords: ['espejo', 'luz espejo', 'espejo led'],
      optional: true,
      options: [
        { id: 'espejo_basico', label: 'Espejo básico 60×80', descripcion: 'Espejo baño 60×80cm + instalación', precio: 48, precioCoste: 22, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
        { id: 'espejo_led', label: 'Espejo LED retroiluminado', descripcion: 'Espejo LED retroiluminado 80×60cm + instalación eléctrica', precio: 185, precioCoste: 108, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
        { id: 'armario_espejo', label: 'Armario espejo con iluminación', descripcion: 'Botiquín espejo con iluminación LED integrada + instalación', precio: 265, precioCoste: 158, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
      ],
    },
    {
      id: 'grifo_lavabo',
      label: 'Grifo lavabo',
      icon: '🚰',
      keywords: ['grifo lavabo', 'grifería lavabo', 'monomando lavabo'],
      options: [
        { id: 'grifo_lavabo_basico', label: 'Monomando básico', descripcion: 'Grifo monomando lavabo básico cromo + instalación', precio: 68, precioCoste: 32, unidad: 'ud', familia: 'Fontanería', tipo: 'material' },
        { id: 'grifo_lavabo_std', label: 'Monomando alto estándar', descripcion: 'Grifo lavabo alto monomando cromado + instalación', precio: 125, precioCoste: 68, unidad: 'ud', familia: 'Fontanería', tipo: 'material' },
        { id: 'grifo_lavabo_premium', label: 'Premium (Grohe / Roca)', descripcion: 'Grifo lavabo Grohe/Roca monomando + instalación', precio: 225, precioCoste: 142, unidad: 'ud', familia: 'Fontanería', tipo: 'material' },
      ],
    },
    {
      id: 'grifo_ducha',
      label: 'Grifería ducha / bañera',
      icon: '🚿',
      keywords: ['grifo ducha', 'grifería ducha', 'termostato ducha', 'monomando ducha', 'grifo bañera'],
      options: [
        { id: 'grifo_ducha_basico', label: 'Monomando + kit ducha', descripcion: 'Monomando ducha + alcachofa + flexible + barra + instalación', precio: 88, precioCoste: 44, unidad: 'ud', familia: 'Fontanería', tipo: 'material' },
        { id: 'columna_ducha', label: 'Columna ducha regulable', descripcion: 'Columna ducha regulable + monomando + instalación', precio: 168, precioCoste: 92, unidad: 'ud', familia: 'Fontanería', tipo: 'material' },
        { id: 'termostato', label: 'Termostato + lluvia', descripcion: 'Termostato ducha + cabezal lluvia + handshower + instalación', precio: 360, precioCoste: 215, unidad: 'ud', familia: 'Fontanería', tipo: 'material' },
      ],
    },
    {
      id: 'electricidad',
      label: 'Electricidad (enchufes, luces)',
      icon: '⚡',
      keywords: ['enchufe', 'punto de luz', 'pulsador', 'interruptor', 'electricidad baño'],
      multi: true,
      options: [
        { id: 'enchufe', label: 'Enchufe IP44', descripcion: 'Enchufe IP44 baño + mecanismo + caja + cableado', precio: 40, precioCoste: 18, unidad: 'ud', familia: 'Electricidad', tipo: 'material', cantidad: 2 },
        { id: 'punto_luz_techo', label: 'Punto de luz techo', descripcion: 'Punto de luz techo + cableado + downlight LED', precio: 50, precioCoste: 24, unidad: 'ud', familia: 'Electricidad', tipo: 'material', cantidad: 1 },
        { id: 'pulsador', label: 'Pulsador / interruptor', descripcion: 'Pulsador o interruptor baño + caja + cableado', precio: 34, precioCoste: 15, unidad: 'ud', familia: 'Electricidad', tipo: 'material', cantidad: 1 },
        { id: 'punto_luz_espejo', label: 'Punto de luz espejo', descripcion: 'Punto de luz espejo IP44 + cableado', precio: 48, precioCoste: 22, unidad: 'ud', familia: 'Electricidad', tipo: 'material', cantidad: 1 },
      ],
    },
    {
      id: 'pintura_techo',
      label: 'Pintura techo / Falso techo',
      icon: '🎨',
      keywords: ['pintura techo', 'falso techo', 'techo baño', 'antihumedad'],
      options: [
        { id: 'pintura_antihumedad', label: 'Pintura antihumedad (m²)', descripcion: 'Pintura antihumedad techo baño 2 manos', precio: 9, precioCoste: 4, unidad: 'm²', familia: 'Pinturas', tipo: 'material' },
        { id: 'falso_techo', label: 'Falso techo pladur hidrófugo (m²)', descripcion: 'Falso techo continuo pladur hidrófugo + perfilería', precio: 44, precioCoste: 23, unidad: 'm²', familia: 'Pinturas', tipo: 'material' },
      ],
    },
    {
      id: 'accesorios',
      label: 'Accesorios baño',
      icon: '🪣',
      keywords: ['toallero', 'portarrollos', 'jabonera', 'accesorio baño'],
      optional: true,
      options: [
        { id: 'acces_basico', label: 'Kit básico (toallero + portarrollos)', descripcion: 'Kit accesorios baño: toallero + portarrollos + jabonera + instalación', precio: 58, precioCoste: 28, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
        { id: 'acces_std', label: 'Kit acero inox (4 piezas)', descripcion: 'Kit accesorios acero inox: toallero + portarrollos + jabonera + percha + instalación', precio: 98, precioCoste: 55, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
        { id: 'acces_premium', label: 'Kit premium (5 piezas)', descripcion: 'Kit accesorios diseño: toallero doble + portarrollos + jabonera dispensador + percha + toallero suelo + instalación', precio: 188, precioCoste: 115, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
      ],
    },
    {
      id: 'bide',
      label: 'Bidé (opcional)',
      icon: '💧',
      keywords: ['bidé', 'bide'],
      optional: true,
      options: [
        { id: 'bide_suelo', label: 'Bidé suelo + grifería', descripcion: 'Bidé suelo blanco + grifería + instalación', precio: 185, precioCoste: 98, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
        { id: 'asiento_bide', label: 'Asiento WC electrónico con bidé', descripcion: 'Asiento WC con función bidé electrónico + instalación', precio: 285, precioCoste: 168, unidad: 'ud', familia: 'Sanitarios', tipo: 'material' },
      ],
    },
  ],
};

// ─── COCINA ────────────────────────────────────────────────────────────────
const SUG_COCINA: SugTemplate = {
  id: 'cocina',
  label: 'Cocina',
  icon: '🍳',
  keywords: ['cocina', 'encimera', 'fregader', 'campana', 'hornillo', 'frente cocina', 'mueble cocina'],
  categories: [
    {
      id: 'encimera',
      label: 'Encimera',
      icon: '🪨',
      keywords: ['encimera'],
      options: [
        { id: 'encimera_laminada', label: 'Laminada post-formada', descripcion: 'Encimera laminada post-formada + instalación', precio: 185, precioCoste: 95, unidad: 'ml', familia: 'Cocina', tipo: 'material' },
        { id: 'encimera_granito', label: 'Granito natural', descripcion: 'Encimera granito natural 3cm + instalación', precio: 360, precioCoste: 210, unidad: 'ml', familia: 'Cocina', tipo: 'material' },
        { id: 'encimera_silestone', label: 'Silestone / Compacto', descripcion: 'Encimera Silestone o compacto cuarzo + instalación', precio: 560, precioCoste: 340, unidad: 'ml', familia: 'Cocina', tipo: 'material' },
        { id: 'encimera_porcelanico', label: 'Porcelánico de gran formato', descripcion: 'Encimera porcelánico gran formato 12mm + instalación', precio: 430, precioCoste: 258, unidad: 'ml', familia: 'Cocina', tipo: 'material' },
      ],
    },
    {
      id: 'fregadero',
      label: 'Fregadero + grifo',
      icon: '🚰',
      keywords: ['fregadero', 'grifo cocina', 'pila'],
      options: [
        { id: 'fregadero_1seno', label: 'Fregadero 1 seno inox + monomando', descripcion: 'Fregadero acero inox 1 seno + grifo monomando + instalación', precio: 185, precioCoste: 98, unidad: 'ud', familia: 'Fontanería', tipo: 'material' },
        { id: 'fregadero_2senos', label: 'Fregadero 2 senos inox + monomando', descripcion: 'Fregadero acero inox 2 senos + grifo monomando + instalación', precio: 245, precioCoste: 135, unidad: 'ud', familia: 'Fontanería', tipo: 'material' },
        { id: 'fregadero_granito', label: 'Fregadero granito compuesto + grifo extractor', descripcion: 'Fregadero granito compuesto + grifo extractor + instalación', precio: 420, precioCoste: 248, unidad: 'ud', familia: 'Fontanería', tipo: 'material' },
      ],
    },
    {
      id: 'campana',
      label: 'Campana extractora',
      icon: '💨',
      keywords: ['campana', 'extractor', 'extracción'],
      options: [
        { id: 'campana_std', label: 'Campana estándar decorativa', descripcion: 'Campana extractora decorativa 60cm + instalación', precio: 185, precioCoste: 98, unidad: 'ud', familia: 'Cocina', tipo: 'material' },
        { id: 'campana_inclinada', label: 'Campana inclinada 60cm', descripcion: 'Campana inclinada 60cm + instalación', precio: 245, precioCoste: 138, unidad: 'ud', familia: 'Cocina', tipo: 'material' },
        { id: 'campana_integrada', label: 'Extractor integrado en mueble', descripcion: 'Extractor integrado bajo mueble 60cm + instalación', precio: 165, precioCoste: 88, unidad: 'ud', familia: 'Cocina', tipo: 'material' },
      ],
    },
    {
      id: 'electricidad_cocina',
      label: 'Electricidad cocina',
      icon: '⚡',
      keywords: ['enchufe cocina', 'punto de luz cocina', 'electricidad cocina'],
      multi: true,
      options: [
        { id: 'enchufe_cocina', label: 'Enchufe schuko', descripcion: 'Enchufe schuko + cableado + caja + mecanismo', precio: 38, precioCoste: 16, unidad: 'ud', familia: 'Electricidad', tipo: 'material', cantidad: 4 },
        { id: 'punto_luz_cocina', label: 'Punto de luz cocina', descripcion: 'Punto de luz encastrado + cableado + downlight LED', precio: 50, precioCoste: 24, unidad: 'ud', familia: 'Electricidad', tipo: 'material', cantidad: 2 },
        { id: 'regleta_led', label: 'Regleta LED bajo mueble', descripcion: 'Tira LED bajo mueble superior + transformador + instalación', precio: 62, precioCoste: 32, unidad: 'ud', familia: 'Electricidad', tipo: 'material', cantidad: 1 },
      ],
    },
    {
      id: 'pintura_cocina',
      label: 'Pintura / Techo',
      icon: '🎨',
      keywords: ['pintura cocina', 'techo cocina', 'frente pintado'],
      options: [
        { id: 'pintura_cocina_std', label: 'Pintura plástica lavable (m²)', descripcion: 'Pintura plástica lavable cocina 2 manos', precio: 9, precioCoste: 4, unidad: 'm²', familia: 'Pinturas', tipo: 'material' },
      ],
    },
  ],
};

// ─── HABITACIÓN ────────────────────────────────────────────────────────────
const SUG_HABITACION: SugTemplate = {
  id: 'habitacion',
  label: 'Habitación',
  icon: '🛏️',
  keywords: ['habitación', 'habitacion', 'dormitorio', 'cuarto'],
  categories: [
    {
      id: 'suelo_hab',
      label: 'Suelo / Pavimento',
      icon: '🪵',
      keywords: ['suelo', 'parquet', 'tarima', 'laminado', 'pavimento', 'solado'],
      options: [
        { id: 'laminado', label: 'Laminado AC4 (m²)', descripcion: 'Suelo laminado AC4 8mm + lámina amortiguación + instalación', precio: 28, precioCoste: 14, unidad: 'm²', familia: 'Suelos', tipo: 'material' },
        { id: 'parquet', label: 'Parquet flotante (m²)', descripcion: 'Parquet flotante multicapa + instalación', precio: 45, precioCoste: 24, unidad: 'm²', familia: 'Suelos', tipo: 'material' },
        { id: 'vinilo', label: 'Vinilo SPC (m²)', descripcion: 'Suelo vinilo SPC resistente + instalación', precio: 32, precioCoste: 17, unidad: 'm²', familia: 'Suelos', tipo: 'material' },
        { id: 'porcelanico_hab', label: 'Porcelánico (m²)', descripcion: 'Suelo porcelánico 60×60 + instalación', precio: 38, precioCoste: 20, unidad: 'm²', familia: 'Suelos', tipo: 'material' },
      ],
    },
    {
      id: 'rodapie',
      label: 'Rodapié',
      icon: '📏',
      keywords: ['rodapié', 'rodapie', 'zócalo'],
      options: [
        { id: 'rodapie_dm', label: 'Rodapié DM lacado (ml)', descripcion: 'Rodapié DM lacado blanco 70mm + instalación', precio: 8, precioCoste: 3.5, unidad: 'ml', familia: 'Suelos', tipo: 'material' },
        { id: 'rodapie_madera', label: 'Rodapié madera (ml)', descripcion: 'Rodapié madera natural 70mm + instalación', precio: 12, precioCoste: 6, unidad: 'ml', familia: 'Suelos', tipo: 'material' },
      ],
    },
    {
      id: 'pintura_hab',
      label: 'Pintura paredes y techo',
      icon: '🎨',
      keywords: ['pintura', 'techo habitación', 'pared habitación'],
      options: [
        { id: 'pintura_std_hab', label: 'Pintura plástica mate (m²)', descripcion: 'Pintura plástica mate paredes + techo 2 manos', precio: 7, precioCoste: 3, unidad: 'm²', familia: 'Pinturas', tipo: 'material' },
        { id: 'pintura_premium_hab', label: 'Pintura premium lavable (m²)', descripcion: 'Pintura plástica premium lavable 2 manos', precio: 10, precioCoste: 5, unidad: 'm²', familia: 'Pinturas', tipo: 'material' },
      ],
    },
    {
      id: 'electricidad_hab',
      label: 'Electricidad',
      icon: '⚡',
      keywords: ['enchufe', 'punto de luz habitación', 'interruptor'],
      multi: true,
      options: [
        { id: 'enchufe_hab', label: 'Enchufe doble', descripcion: 'Enchufe doble + cableado + caja + mecanismo', precio: 36, precioCoste: 16, unidad: 'ud', familia: 'Electricidad', tipo: 'material', cantidad: 4 },
        { id: 'punto_luz_hab', label: 'Punto de luz techo', descripcion: 'Punto de luz techo + cableado + downlight LED', precio: 48, precioCoste: 22, unidad: 'ud', familia: 'Electricidad', tipo: 'material', cantidad: 1 },
        { id: 'interruptor_hab', label: 'Interruptor', descripcion: 'Mecanismo interruptor + caja + cableado', precio: 30, precioCoste: 13, unidad: 'ud', familia: 'Electricidad', tipo: 'material', cantidad: 1 },
      ],
    },
  ],
};

// ─── SALÓN ─────────────────────────────────────────────────────────────────
const SUG_SALON: SugTemplate = {
  id: 'salon',
  label: 'Salón / Comedor',
  icon: '🛋️',
  keywords: ['salón', 'salon', 'comedor', 'living'],
  categories: [
    {
      id: 'suelo_salon',
      label: 'Suelo / Pavimento',
      icon: '🪵',
      keywords: ['suelo', 'parquet', 'tarima', 'laminado', 'pavimento'],
      options: [
        { id: 'laminado_salon', label: 'Laminado AC5 (m²)', descripcion: 'Suelo laminado AC5 + lámina + instalación', precio: 32, precioCoste: 17, unidad: 'm²', familia: 'Suelos', tipo: 'material' },
        { id: 'parquet_salon', label: 'Parquet flotante (m²)', descripcion: 'Parquet flotante multicapa + instalación', precio: 48, precioCoste: 26, unidad: 'm²', familia: 'Suelos', tipo: 'material' },
        { id: 'porcelanico_salon', label: 'Porcelánico grande formato (m²)', descripcion: 'Porcelánico 80×80 + instalación', precio: 52, precioCoste: 28, unidad: 'm²', familia: 'Suelos', tipo: 'material' },
      ],
    },
    {
      id: 'pintura_salon',
      label: 'Pintura paredes y techo',
      icon: '🎨',
      keywords: ['pintura', 'techo salón', 'pared salón'],
      options: [
        { id: 'pintura_salon_std', label: 'Pintura plástica mate (m²)', descripcion: 'Pintura plástica mate paredes + techo 2 manos', precio: 7, precioCoste: 3, unidad: 'm²', familia: 'Pinturas', tipo: 'material' },
        { id: 'pintura_salon_premium', label: 'Pintura premium lavable (m²)', descripcion: 'Pintura plástica premium lavable + imprimación', precio: 10, precioCoste: 5, unidad: 'm²', familia: 'Pinturas', tipo: 'material' },
      ],
    },
    {
      id: 'electricidad_salon',
      label: 'Electricidad',
      icon: '⚡',
      keywords: ['enchufe', 'punto de luz salón', 'foco salón'],
      multi: true,
      options: [
        { id: 'enchufe_salon', label: 'Enchufe doble', descripcion: 'Enchufe doble + cableado + caja + mecanismo', precio: 36, precioCoste: 16, unidad: 'ud', familia: 'Electricidad', tipo: 'material', cantidad: 4 },
        { id: 'punto_luz_salon', label: 'Punto de luz techo', descripcion: 'Punto de luz + cableado + downlight LED', precio: 48, precioCoste: 22, unidad: 'ud', familia: 'Electricidad', tipo: 'material', cantidad: 3 },
      ],
    },
    {
      id: 'rodapie_salon',
      label: 'Rodapié',
      icon: '📏',
      keywords: ['rodapié', 'rodapie', 'zócalo'],
      options: [
        { id: 'rodapie_salon_dm', label: 'Rodapié DM lacado (ml)', descripcion: 'Rodapié DM lacado blanco 70mm + instalación', precio: 8, precioCoste: 3.5, unidad: 'ml', familia: 'Suelos', tipo: 'material' },
        { id: 'rodapie_salon_madera', label: 'Rodapié madera (ml)', descripcion: 'Rodapié madera natural 70mm + instalación', precio: 12, precioCoste: 6, unidad: 'ml', familia: 'Suelos', tipo: 'material' },
      ],
    },
  ],
};

// ─── Catálogo de templates ────────────────────────────────────────────────
export const SUG_TEMPLATES: SugTemplate[] = [SUG_BANO, SUG_COCINA, SUG_HABITACION, SUG_SALON];

// ─── Función de detección ────────────────────────────────────────────────
export function detectSugerencias(
  partidas: Array<{ descripcion: string; familia?: string }>,
  titulo: string
): { template: SugTemplate; missing: SugCategory[] } | null {
  const text = [titulo, ...partidas.map(p => [p.descripcion, p.familia ?? ''].join(' '))]
    .join(' ')
    .toLowerCase();

  const matched = SUG_TEMPLATES.find(t =>
    t.keywords.some(kw => text.includes(kw.toLowerCase()))
  );
  if (!matched) return null;

  const missing = matched.categories.filter(cat =>
    !cat.keywords.some(kw => text.includes(kw.toLowerCase()))
  );
  if (missing.length === 0) return null;

  return { template: matched, missing };
}
