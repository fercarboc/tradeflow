export interface MarketplaceOficio {
  id:    string;
  label: string;
  color: string;
}

export const MARKETPLACE_OFICIOS: MarketplaceOficio[] = [
  { id: 'fontaneria',    label: 'Fontanería',    color: '#3B82F6' },
  { id: 'electricidad',  label: 'Electricidad',  color: '#F59E0B' },
  { id: 'albanileria',   label: 'Albañilería',   color: '#8B5CF6' },
  { id: 'carpinteria',   label: 'Carpintería',   color: '#92400E' },
  { id: 'pintura',       label: 'Pintura',       color: '#EC4899' },
  { id: 'climatizacion', label: 'Climatización', color: '#06B6D4' },
  { id: 'soldadura',     label: 'Soldadura',     color: '#EF4444' },
];
