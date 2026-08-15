// API tipada para campañas publicitarias del Marketplace.
// Fuente: RPC get_active_campaigns() en Supabase (SECURITY DEFINER).
//
// INVARIANTE: publicidad ≠ ranking. Esta API solo gestiona slots publicitarios.
// Nunca modifica resultados de búsqueda, precios ni comparador.
//
// Cache: módulo-level, sin localStorage. TTL 90s.
// Fallback: datos demo si RPC falla (ver useAdCampaigns).

import { supabase } from '../supabase';
import type { AdSlotId, AdCampaign, AdDestinationType, HeroSlide, PromoCard } from '../marketplace-ad-types';

// ─── Shape real de la RPC get_active_campaigns() ─────────────────────────────
// Verificado contra BD producción 2026-08-15.

export interface AdCampaignRpcRow {
  slot_id:          string;
  campaign_id:      string;
  campaign_source:  'trabflow' | 'demo' | 'supplier';
  resolution_level: number;
  advertiser_name:  string;
  eyebrow:          string | null;
  title:            string;
  subtitle:         string | null;
  cta_label:        string;
  destination_type: AdDestinationType;
  destination_value: string | null;
  priority:         number;
  accent:           string | null;
  bg:               string | null;
  text_color:       string | null;
  image_url:        string | null;
  mobile_image_url: string | null;
}

// ─── Cache módulo-level (sin localStorage, sin IndexedDB) ────────────────────

const _slotCache = new Map<string, { campaign: AdCampaign; ts: number }>();
const CACHE_TTL_MS = 90_000; // 90 segundos

// ─── Conversión RPC row → AdCampaign ─────────────────────────────────────────

function rpcRowToAdCampaign(row: AdCampaignRpcRow): AdCampaign {
  return {
    id:              row.campaign_id,
    slotId:          row.slot_id as AdSlotId,
    campaignId:      row.campaign_id,
    advertiserName:  row.advertiser_name,
    imageUrl:        row.image_url        ?? undefined,
    mobileImageUrl:  row.mobile_image_url ?? undefined,
    eyebrow:         row.eyebrow          ?? undefined,
    title:           row.title,
    subtitle:        row.subtitle         ?? undefined,
    ctaLabel:        row.cta_label,
    destinationType: row.destination_type,
    destinationValue: row.destination_value ?? undefined,
    priority:        row.priority,
    active:          true, // RPC solo devuelve campañas activas válidas
    accent:          row.accent     ?? undefined,
    bg:              row.bg         ?? undefined,
    textColor:       row.text_color ?? undefined,
    campaignSource:  row.campaign_source,
    resolutionLevel: row.resolution_level,
  };
}

// ─── Validación temporal (defense in depth) ──────────────────────────────────
// Aunque la RPC ya filtra por fechas, validar antes de renderizar para evitar
// que una campaña caducada aparezca si está en caché expirada.

export function isValidForDisplay(campaign: AdCampaign): boolean {
  if (!campaign.active) return false;
  const now = new Date();
  if (campaign.startAt && new Date(campaign.startAt) > now) return false;
  if (campaign.endAt   && new Date(campaign.endAt)   <= now) return false;
  return true;
}

// ─── getActiveCampaigns — 1 llamada bulk, sin N+1 ────────────────────────────

export async function getActiveCampaigns(
  slotIds: readonly AdSlotId[],
): Promise<Map<string, AdCampaign>> {
  if (slotIds.length === 0) return new Map();

  const now = Date.now();

  // Determinar qué slots están caducados en caché
  const staleIds = slotIds.filter(id => {
    const entry = _slotCache.get(id);
    return !entry || (now - entry.ts) > CACHE_TTL_MS;
  });

  if (staleIds.length > 0) {
    if (import.meta.env.DEV) {
      console.debug('[ADS:E3:FETCH]', slotIds.length, 'slots total,', staleIds.length, 'stale → RPC');
    }
    try {
      const { data, error } = await supabase.rpc('get_active_campaigns', {
        p_slot_ids: slotIds as string[],
      });

      if (error) throw error;

      const rows = (data ?? []) as AdCampaignRpcRow[];
      for (const row of rows) {
        const campaign = rpcRowToAdCampaign(row);
        _slotCache.set(row.slot_id, { campaign, ts: now });
        if (import.meta.env.DEV) {
          console.debug(
            '[ADS:E3:RESOLVED]',
            row.slot_id,
            '→ level', row.resolution_level,
            row.campaign_source,
          );
        }
      }
    } catch (err) {
      console.warn('[ADS:E3:FETCH_ERROR] RPC get_active_campaigns failed:', err);
      // Devolver lo que haya en caché aunque esté caducado
    }
  }

  // Construir resultado desde caché
  const result = new Map<string, AdCampaign>();
  for (const id of slotIds) {
    const entry = _slotCache.get(id);
    if (entry) result.set(id, entry.campaign);
  }
  return result;
}

// ─── resolveCampaignDestination — resolver central de navegación ──────────────
// No repartir if/else por componentes. Un único punto de dispatch.
// OFFER y PRODUCT no tienen ruta real todavía: fallback catalog + warning DEV.

type NavigateFn = (oficio?: string | null, search?: string, actor?: string) => void;

export function resolveCampaignDestination(
  destinationType:  AdDestinationType,
  destinationValue: string | undefined,
  onGoToCatalog:    NavigateFn,
): void {
  switch (destinationType) {
    case 'catalog':
      return onGoToCatalog();
    case 'category':
      return onGoToCatalog(destinationValue ?? null);
    case 'supplier':
      return onGoToCatalog(undefined, undefined, destinationValue);
    case 'search':
      return onGoToCatalog(null, destinationValue);
    case 'product':
      // Ficha de producto no implementada todavía. Fallback seguro.
      if (import.meta.env.DEV) console.warn('[ADS:E3:INVALID_DESTINATION] product detail page not yet implemented — falling back to catalog');
      return onGoToCatalog();
    case 'offer':
      // Centro de Ofertas pendiente (C9). No navegar a ruta inexistente.
      if (import.meta.env.DEV) console.warn('[ADS:E3:INVALID_DESTINATION] Centro de Ofertas not yet implemented — falling back to catalog');
      return onGoToCatalog();
    default:
      return onGoToCatalog();
  }
}

// ─── Conversores para componentes ─────────────────────────────────────────────

export function adCampaignToHeroSlide(campaign: AdCampaign): HeroSlide {
  const dt = campaign.destinationType;
  return {
    id:             campaign.campaignId ?? campaign.id,
    imageUrl:       campaign.imageUrl,
    mobileImageUrl: campaign.mobileImageUrl,
    eyebrow:        campaign.eyebrow,
    title:          campaign.title,
    subtitle:       campaign.subtitle,
    price:          campaign.price,
    previousPrice:  campaign.previousPrice,
    discount:       campaign.discount,
    ctaLabel:       campaign.ctaLabel,
    action:         dt === 'category' ? 'category'
                  : dt === 'search'   ? 'search'
                  : dt === 'supplier' ? 'supplier'
                  : dt === 'offer'    ? 'offer'
                  : dt === 'product'  ? 'product'
                  : 'catalog',
    category:     dt === 'category' ? campaign.destinationValue : undefined,
    searchQuery:  dt === 'search'   ? campaign.destinationValue : undefined,
    supplierName: dt === 'supplier' ? campaign.destinationValue : undefined,
    gradient:     campaign.bg ?? undefined,
  };
}

const PROMO_CARD_DEFAULTS: Array<{ badge: string; badgeVariant: PromoCard['badgeVariant'] }> = [
  { badge: 'Oferta del mes',  badgeVariant: 'blue'  },
  { badge: 'Novedades',       badgeVariant: 'green' },
  { badge: 'Liquidación',     badgeVariant: 'red'   },
  { badge: 'Vuelta a stock',  badgeVariant: 'amber' },
];

export function adCampaignToPromoCard(campaign: AdCampaign, idx: number): PromoCard {
  const def = PROMO_CARD_DEFAULTS[idx % 4];
  return {
    id:               campaign.campaignId ?? campaign.id,
    advertiserName:   campaign.advertiserName,
    badge:            campaign.eyebrow ?? def.badge,
    badgeVariant:     def.badgeVariant,
    imageUrl:         campaign.imageUrl,
    title:            campaign.title,
    promoText:        campaign.subtitle,
    ctaLabel:         campaign.ctaLabel,
    destinationType:  campaign.destinationType,
    destinationValue: campaign.destinationValue,
  };
}
