import { useState, useCallback } from 'react';

export interface MarketplaceLocation {
  localidad:           string;
  comunidad_autonoma?: string | null;
  lat?:                number | null;
  lon?:                number | null;
}

export const PRESET_LOCATIONS: MarketplaceLocation[] = [
  { localidad: 'Santander',   comunidad_autonoma: 'Cantabria',  lat: 43.4623, lon: -3.8099 },
  { localidad: 'Torrelavega', comunidad_autonoma: 'Cantabria',  lat: 43.3538, lon: -4.0498 },
  { localidad: 'Laredo',      comunidad_autonoma: 'Cantabria',  lat: 43.3933, lon: -3.4187 },
  { localidad: 'Bilbao',      comunidad_autonoma: 'País Vasco', lat: 43.2627, lon: -2.9253 },
  { localidad: 'Gijón',       comunidad_autonoma: 'Asturias',   lat: 43.5322, lon: -5.6611 },
  { localidad: 'Madrid',      comunidad_autonoma: 'Madrid',     lat: 40.4168, lon: -3.7038 },
];

const SS_KEY = 'mkt_location_ctx';

function loadFromStorage(): MarketplaceLocation | null {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    return raw ? (JSON.parse(raw) as MarketplaceLocation) : null;
  } catch { return null; }
}

export function useMarketplaceLocation() {
  const [location, setLocationState] = useState<MarketplaceLocation | null>(loadFromStorage);

  const setLocation = useCallback((loc: MarketplaceLocation | null) => {
    setLocationState(loc);
    try {
      if (loc) sessionStorage.setItem(SS_KEY, JSON.stringify(loc));
      else sessionStorage.removeItem(SS_KEY);
    } catch {}
  }, []);

  const clearLocation = useCallback(() => setLocation(null), [setLocation]);

  return { location, setLocation, clearLocation };
}
