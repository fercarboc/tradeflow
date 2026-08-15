// Tipos del sistema de publicidad del Marketplace.
// Datos demo: marketplace-campaigns-demo.ts
// Datos reales (E3+): src/lib/api/marketplace-ads.ts → get_active_campaigns() RPC
//
// Arquitectura:
//   AdSlot  = ubicación publicitaria disponible (id canónico)
//   AdCampaign = contenido contratado/configurado que ocupa un slot
//
// INVARIANTE: la publicidad solo afecta a slots explícitamente publicitarios.
// Nunca modifica ranking, precio, score ni recomendación de proveedor.

export type AdSlotId =
  | 'MARKET_HOME_LEFT_TOP'
  | 'MARKET_HOME_LEFT_MID'
  | 'MARKET_HOME_LEFT_BOTTOM'
  | 'MARKET_HOME_RIGHT_TOP'
  | 'MARKET_HOME_RIGHT_MID'
  | 'MARKET_HOME_RIGHT_BOTTOM'
  | 'MARKET_HOME_HERO'         // legacy alias para demo data compat
  | 'MARKET_HOME_HERO_1'       // E3: slot comercial Hero carousel 1
  | 'MARKET_HOME_HERO_2'       // E3: slot comercial Hero carousel 2
  | 'MARKET_HOME_HERO_3'       // E3: slot comercial Hero carousel 3
  | 'MARKET_HOME_MOBILE_PROMO_1'
  | 'MARKET_HOME_MOBILE_PROMO_2'
  | 'MARKET_HOME_PROMO_CARD_1'
  | 'MARKET_HOME_PROMO_CARD_2'
  | 'MARKET_HOME_PROMO_CARD_3'
  | 'MARKET_HOME_PROMO_CARD_4'
  | 'MARKET_CATALOG_HERO';

// E3: offer y product añadidos (D1 fix). Centro de Ofertas pendiente.
// offer → CTA sin ruta real todavía (fallback catalog silencioso con warning dev).
// product → sin ficha directa todavía (fallback catalog silencioso con warning dev).
export type AdDestinationType =
  | 'catalog'
  | 'category'
  | 'supplier'
  | 'search'
  | 'product'
  | 'offer';

export interface AdCampaign {
  id:             string;
  slotId:         AdSlotId;
  campaignId?:    string;
  advertiserId?:  string;
  advertiserName: string;
  imageUrl?:      string;
  mobileImageUrl?: string;
  eyebrow?:       string;
  title:          string;
  subtitle?:      string;
  price?:         string;
  previousPrice?: string;
  discount?:      string;
  ctaLabel:       string;
  destinationType:  AdDestinationType;
  destinationValue?: string;
  startAt?:  string;
  endAt?:    string;
  priority:  number;
  active:    boolean;
  // Estilos para slots HTML (sin imagen)
  accent?:    string;
  bg?:        string;
  textColor?: string;
  // E3: metadatos de BD (no presentes en demo data)
  campaignSource?: 'trabflow' | 'demo' | 'supplier';
  resolutionLevel?: number;
}

export interface HeroSlide {
  id:             string;
  imageUrl?:      string;
  mobileImageUrl?: string;
  eyebrow?:       string;
  title:          string;
  subtitle?:      string;
  price?:         string;
  previousPrice?: string;
  discount?:      string;
  ctaLabel:       string;
  // E3: supplier añadido. product/offer no generan navegación real todavía.
  action:         'catalog' | 'category' | 'search' | 'supplier' | 'product' | 'offer';
  category?:      string;
  searchQuery?:   string;
  supplierName?:  string;
  // Fallback cuando no hay imagen
  gradient?:     string;
  patternColor?: string;
}

export interface PromoCard {
  id:             string;
  advertiserName: string;
  badge:          string;
  badgeVariant:   'blue' | 'green' | 'red' | 'amber';
  imageUrl?:      string;
  title:          string;
  promoText?:     string;
  ctaLabel:       string;
  destinationType:  AdDestinationType;
  destinationValue?: string;
}
