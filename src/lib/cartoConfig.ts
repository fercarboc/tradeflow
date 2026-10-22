// CARTO Basemaps configuration — shared across all map components.
// Key obtained free at https://carto.com/basemaps/apikey/ — no card required.
// Commercial free tier: 1 M tile requests/month. Restrict by domain in CARTO dashboard.
// VITE_- prefix so Vite embeds it in the client bundle; restrict by domain, not by secrecy.

export const CARTO_KEY: string | undefined =
  import.meta.env.VITE_CARTO_BASEMAP_API_KEY as string | undefined;

export const CARTO_URL = CARTO_KEY
  ? `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_KEY}`
  : '';

export const CARTO_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
