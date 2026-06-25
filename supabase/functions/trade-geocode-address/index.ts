import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const ALLOWED_ORIGINS = ['https://trabflow.com', 'https://www.trabflow.com', 'http://localhost:5173', 'http://localhost:4173'];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

// API key de Google Geocoding opcional. Si no existe, usa Nominatim (OpenStreetMap, gratuito).
const GOOGLE_KEY = Deno.env.get('GOOGLE_GEOCODING_API_KEY') ?? '';

interface GeocodeRequest {
  direccion?: string;
  localidad?: string;
  cp?: string;
  provincia?: string;
  pais?: string;
}

interface GeocodeResult {
  latitud: number;
  longitud: number;
  formatted_address: string;
  status: 'ok' | 'not_found';
  provider: 'google' | 'nominatim';
}

// ── Google Geocoding API ───────────────────────────────────────────────────────

async function geocodeGoogle(query: string): Promise<GeocodeResult | null> {
  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?address=${encodeURIComponent(query)}&key=${GOOGLE_KEY}&region=es&language=es`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json() as {
    status: string;
    results: Array<{
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    }>;
  };

  if (data.status !== 'OK' || !data.results.length) return null;

  const r = data.results[0];
  return {
    latitud: r.geometry.location.lat,
    longitud: r.geometry.location.lng,
    formatted_address: r.formatted_address,
    status: 'ok',
    provider: 'google',
  };
}

// ── Nominatim / OpenStreetMap ─────────────────────────────────────────────────
// Cumple los términos de Nominatim: User-Agent identificado, máx 1 req/s desde backend.

async function geocodeNominatim(query: string): Promise<GeocodeResult | null> {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=es&addressdetails=0`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'TrabFlow/1.0 (contacto@trabflow.com)',
      'Accept-Language': 'es',
    },
  });

  if (!res.ok) return null;

  const data = await res.json() as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  if (!data.length) return null;

  return {
    latitud: parseFloat(data[0].lat),
    longitud: parseFloat(data[0].lon),
    formatted_address: data[0].display_name,
    status: 'ok',
    provider: 'nominatim',
  };
}

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors(req), 'Content-Type': 'application/json' },
    });

  try {
    const body = await req.json() as GeocodeRequest;

    const parts = [
      body.direccion,
      body.cp,
      body.localidad,
      body.provincia,
      body.pais ?? 'España',
    ].filter((p): p is string => !!p?.trim());

    if (parts.length < 2) {
      return respond({ error: 'Dirección insuficiente (necesita al menos 2 campos)' }, 400);
    }

    const query = parts.join(', ');

    // Intentar Google primero si hay clave, después Nominatim como fallback
    let result: GeocodeResult | null = null;

    if (GOOGLE_KEY) {
      result = await geocodeGoogle(query);
    }

    if (!result) {
      result = await geocodeNominatim(query);
    }

    if (!result) {
      return respond({ status: 'not_found', latitud: null, longitud: null, formatted_address: null });
    }

    return respond(result);
  } catch (err) {
    console.error('trade-geocode-address error:', err);
    return respond({ error: String(err), status: 'error' }, 500);
  }
});


