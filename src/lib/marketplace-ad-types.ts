// Tipos del sistema de publicidad del Marketplace.
// Datos demo: marketplace-campaigns-demo.ts
// Datos reales (futuro): Admin > Marketplace > Publicidad / Campañas (RPC)
//
// Arquitectura:
//   AdSlot  = ubicación publicitaria disponible (id canónico)
//   AdCampaign = contenido contratado/configurado que ocupa un slot
//
// INVARIANTE: la publicidad solo afecta a slots explícitamente publicitarios.
// Nunca modifica ranking, precio, score ni recomendación de proveedor.

export type AdSlotId =
  | 'MARKET_HOME_LEFT_TOP'
  | 'MARKET_HOME_LEFT_BOTTOM'
  | 'MARKET_HOME_RIGHT_TOP'
  | 'MARKET_HOME_RIGHT_BOTTOM'
  | 'MARKET_HOME_HERO'
  | 'MARKET_HOME_MOBILE_PROMO_1'
  | 'MARKET_HOME_MOBILE_PROMO_2'
  | 'MARKET_CATALOG_HERO';

export type AdDestinationType = 'catalog' | 'category' | 'supplier' | 'search';

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
  action:         'catalog' | 'category' | 'search' | 'supplier';
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
