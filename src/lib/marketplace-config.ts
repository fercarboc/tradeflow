export interface MarketplaceOficio {
  id:    string;
  label: string;
  color: string;
  bg:    string;
}

export const MARKETPLACE_OFICIOS: MarketplaceOficio[] = [
  { id: 'fontaneria',    label: 'Fontanería',    color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'electricidad',  label: 'Electricidad',  color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'albanileria',   label: 'Albañilería',   color: '#8B5CF6', bg: '#F5F3FF' },
  { id: 'carpinteria',   label: 'Carpintería',   color: '#92400E', bg: '#FEF3C7' },
  { id: 'pintura',       label: 'Pintura',       color: '#EC4899', bg: '#FDF2F8' },
  { id: 'climatizacion', label: 'Climatización', color: '#06B6D4', bg: '#ECFEFF' },
  { id: 'soldadura',     label: 'Soldadura',     color: '#EF4444', bg: '#FEF2F2' },
];
