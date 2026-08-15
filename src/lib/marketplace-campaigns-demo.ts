// ┌─────────────────────────────────────────────────────────────────────────┐
// │  DEMO — Contenido de campañas publicitarias del Marketplace             │
// │                                                                         │
// │  Fuente actual: datos estáticos, nombres ficticios de entorno demo.     │
// │  Fuente futura: Admin > Marketplace > Publicidad / Campañas (RPC/API)   │
// │                                                                         │
// │  Para sustituir por datos reales: reemplazar estas constantes por       │
// │  llamadas a getMarketplaceCampaigns(slotId) cuando el módulo Admin      │
// │  de campañas esté implementado.                                         │
// │                                                                         │
// │  INVARIANTE: la publicidad NUNCA altera ranking, precio, score ni       │
// │  recomendación orgánica. Solo ocupa los slots explícitamente creados.   │
// └─────────────────────────────────────────────────────────────────────────┘

import type { AdCampaign, HeroSlide, PromoCard } from './marketplace-ad-types';

// ── Hero carousel (MARKET_HOME_HERO) ─────────────────────────────────────────

export const DEMO_HERO_SLIDES: HeroSlide[] = [
  {
    id:        'hero-trabflow-general',
    imageUrl:  '/marketplace/carousel/carrusel1.png',
    title:     'Todo lo que necesitas para cada instalación',
    subtitle:  'Compara proveedores, consulta disponibilidad y haz tus pedidos desde un único lugar.',
    eyebrow:   'Materiales profesionales',
    ctaLabel:  'Explorar catálogo',
    action:    'catalog',
    gradient:  'linear-gradient(135deg, #1A5A96 0%, #2d7dd2 100%)',
    patternColor: 'rgba(255,255,255,0.04)',
  },
  {
    id:        'hero-electrodistribucion-cuadro',
    imageUrl:  '/marketplace/carousel/carrusel2.png',
    title:     'Cuadro eléctrico profesional 18 módulos',
    subtitle:  'Semana del instalador · Electrodistribución Cantábrica',
    eyebrow:   'Oferta mayorista',
    ctaLabel:  'Ver electricidad',
    action:    'category',
    category:  'electricidad',
    gradient:  'linear-gradient(135deg, #78350f 0%, #d97706 100%)',
  },
  {
    id:        'hero-suministros-norte-kit',
    imageUrl:  '/marketplace/carousel/carrusel3.png',
    title:     'Kit instalación de fontanería profesional',
    subtitle:  'Todo lo que necesitas, en un solo kit · Suministros Técnicos Norte',
    eyebrow:   'Novedad mayorista',
    ctaLabel:  'Ver fontanería',
    action:    'category',
    category:  'fontaneria',
    gradient:  'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
  },
  {
    id:        'hero-electrosuministros-cable',
    imageUrl:  '/marketplace/carousel/carrusel4.png',
    title:     'Cable libre de halógenos H07Z1-K 6 mm²',
    subtitle:  'Promoción instalador · Electrosuministros Cantábrico',
    eyebrow:   'Oferta mayorista',
    ctaLabel:  'Ver electricidad',
    action:    'category',
    category:  'electricidad',
    gradient:  'linear-gradient(135deg, #134e4a 0%, #14b8a6 100%)',
  },
];

// ── Slots laterales Desktop (MARKET_HOME_LEFT/RIGHT) ─────────────────────────

export const DEMO_LATERAL_CAMPAIGNS: AdCampaign[] = [
  {
    id:             'demo-left-top',
    slotId:         'MARKET_HOME_LEFT_TOP',
    advertiserName: 'Electro Norte',
    eyebrow:        'Material eléctrico profesional',
    title:          'Electricidad e instalaciones',
    subtitle:       '+8.000 referencias en catálogo',
    ctaLabel:       'Ver electricidad',
    destinationType:  'category',
    destinationValue: 'electricidad',
    priority:  10,
    active:    true,
    accent:    '#F59E0B',
    bg:        'linear-gradient(160deg, #1c1917 0%, #292524 80%, #1c1917 100%)',
    textColor: '#ffffff',
  },
  {
    id:             'demo-left-bottom',
    slotId:         'MARKET_HOME_LEFT_BOTTOM',
    advertiserName: 'Climatizar Soluciones',
    eyebrow:        'Climatización y HVAC',
    title:          'Bomba de calor y aire acondicionado',
    subtitle:       'Asistencia técnica · Mejores marcas',
    ctaLabel:       'Ver climatización',
    destinationType:  'category',
    destinationValue: 'climatizacion',
    priority:  10,
    active:    true,
    accent:    '#14b8a6',
    bg:        'linear-gradient(160deg, #0f3430 0%, #134e4a 80%, #0f3430 100%)',
    textColor: '#ffffff',
  },
  {
    id:             'demo-right-top',
    slotId:         'MARKET_HOME_RIGHT_TOP',
    advertiserName: 'Suministros Técnicos Norte',
    eyebrow:        'Fontanería y saneamiento',
    title:          'Tubería, valvulería y accesorios',
    subtitle:       'Stock inmediato · Precio profesional',
    ctaLabel:       'Ver fontanería',
    destinationType:  'category',
    destinationValue: 'fontaneria',
    priority:  10,
    active:    true,
    accent:    '#60a5fa',
    bg:        'linear-gradient(160deg, #0f2044 0%, #1e3a5f 80%, #0f2044 100%)',
    textColor: '#ffffff',
  },
  {
    id:             'demo-right-bottom',
    slotId:         'MARKET_HOME_RIGHT_BOTTOM',
    advertiserName: 'Pinturas Pro',
    eyebrow:        'Acabados y pintura',
    title:          'Pinturas, imprimaciones y esmaltes',
    subtitle:       'Para profesionales · Desde 1 litro',
    ctaLabel:       'Ver pintura',
    destinationType:  'category',
    destinationValue: 'pintura',
    priority:  10,
    active:    true,
    accent:    '#c084fc',
    bg:        'linear-gradient(160deg, #2e1065 0%, #4c1d95 80%, #2e1065 100%)',
    textColor: '#ffffff',
  },
];

// ── Slots mobile (MARKET_HOME_MOBILE_PROMO_1 / _2) ───────────────────────────

export const DEMO_MOBILE_CAMPAIGNS: AdCampaign[] = [
  {
    id:             'demo-mobile-1',
    slotId:         'MARKET_HOME_MOBILE_PROMO_1',
    advertiserName: 'Electrodistribución Cantábrica',
    eyebrow:        'Oferta del mes',
    title:          'Material eléctrico con −20%',
    ctaLabel:       'Ver electricidad',
    destinationType:  'category',
    destinationValue: 'electricidad',
    priority:  10,
    active:    true,
    accent:    '#F59E0B',
    bg:        'linear-gradient(120deg, #1c1917 0%, #292524 100%)',
    textColor: '#ffffff',
  },
  {
    id:             'demo-mobile-2',
    slotId:         'MARKET_HOME_MOBILE_PROMO_2',
    advertiserName: 'Suministros Técnicos Norte',
    eyebrow:        'Novedad',
    title:          'Kit fontanería profesional completo',
    ctaLabel:       'Ver fontanería',
    destinationType:  'category',
    destinationValue: 'fontaneria',
    priority:  10,
    active:    true,
    accent:    '#60a5fa',
    bg:        'linear-gradient(120deg, #0f2044 0%, #1e3a5f 100%)',
    textColor: '#ffffff',
  },
];

// ── Mayoristas promocionados (Home) ───────────────────────────────────────────

export const DEMO_PROMO_CARDS: PromoCard[] = [
  {
    id:             'promo-electrodistribucion',
    advertiserName: 'Electrodistribución Cantábrica',
    badge:          'Oferta del mes',
    badgeVariant:   'blue',
    title:          'Cuadro eléctrico 18 módulos',
    promoText:      '−20% para profesionales',
    ctaLabel:       'Ver oferta',
    destinationType:  'category',
    destinationValue: 'electricidad',
  },
  {
    id:             'promo-suministros-norte',
    advertiserName: 'Suministros Técnicos Norte',
    badge:          'Novedades',
    badgeVariant:   'green',
    title:          'Kit fontanería profesional completo',
    promoText:      'Nuevo en catálogo · −25%',
    ctaLabel:       'Descubrir',
    destinationType:  'category',
    destinationValue: 'fontaneria',
  },
  {
    id:             'promo-electrosuministros',
    advertiserName: 'Electrosuministros Cantábrico',
    badge:          'Liquidación',
    badgeVariant:   'red',
    title:          'Cable H07Z1-K libre de halógenos',
    promoText:      '−23% · 0,98 €/metro',
    ctaLabel:       'Ver productos',
    destinationType:  'category',
    destinationValue: 'electricidad',
  },
  {
    id:             'promo-climatizar',
    advertiserName: 'Climatizar Soluciones',
    badge:          'Vuelta a stock',
    badgeVariant:   'amber',
    title:          'Termostatos digitales profesionales',
    promoText:      'Disponibilidad inmediata',
    ctaLabel:       'Ver stock',
    destinationType:  'category',
    destinationValue: 'climatizacion',
  },
];

// ── Catalog banner (MARKET_CATALOG_HERO) ─────────────────────────────────────

export const DEMO_CATALOG_BANNER: AdCampaign = {
  id:             'demo-catalog-banner',
  slotId:         'MARKET_CATALOG_HERO',
  advertiserName: 'Suministros Técnicos Norte',
  eyebrow:        'Oferta especial profesionales',
  title:          'Kit instalación fontanería completo — 89,90 €',
  subtitle:       '−25% · Entrega 24/48h · Garantía 3 años',
  ctaLabel:       'Ver oferta',
  destinationType:  'category',
  destinationValue: 'fontaneria',
  priority:  10,
  active:    true,
  accent:    '#60a5fa',
  bg:        'linear-gradient(90deg, #0f2044 0%, #1e3a5f 100%)',
  textColor: '#ffffff',
};
