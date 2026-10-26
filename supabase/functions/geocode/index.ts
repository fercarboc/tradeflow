/**
 * Edge Function: geocode
 * Geocodifica una dirección para una organización autenticada.
 *
 * Seguridad multicapa:
 *   1. JWT → user_id
 *   2. Verificar pertenencia a org_id (owner o admin activo)
 *   3. Rate limit global (1 req/s entre todas las instancias EF)
 *   4. Cuota por organización (daily_limit)
 *   5. Cache lookup → evitar llamada al proveedor si existe
 *   6. Llamada a proveedor (transacción DB ya cerrada)
 *   7. Guardar en caché
 *
 * Input:  { address: string, org_id: string }
 * Output: { candidates, ambiguous, cached, provider, error? }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  GeoapifyGeocodingProvider,
  type GeocodingCandidate,
} from '../_shared/geoProviders.ts';

const CACHE_TTL_DAYS = 180;

interface GeocodeRequest {
  address: string;
  org_id:  string;
}

interface GeocodeResponse {
  candidates:  GeocodingCandidate[];
  ambiguous:   boolean;
  cached:      boolean;
  provider:    string;
  error?:      string;
}

function normalizeAddress(address: string): string {
  return address.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Simple hash determinista (djb2) — no necesita crypto para clave de caché
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type',
    }});
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return Response.json({ error: 'GEO_AUTH: no authorization header' }, { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  // Autenticar usuario
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
  );
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'GEO_AUTH: token inválido' }, { status: 401 });
  }

  const body = await req.json() as GeocodeRequest;
  const { address, org_id } = body;

  if (!address?.trim() || !org_id) {
    return Response.json({ error: 'GEO_PARAMS: address y org_id requeridos' }, { status: 400 });
  }
  if (address.length > 500) {
    return Response.json({ error: 'GEO_PARAMS: dirección demasiado larga (máx 500 caracteres)' }, { status: 400 });
  }

  // Verificar pertenencia a org (owner o admin)
  const { data: orgCheck } = await supabase
    .from('trade_organizations').select('id').eq('id', org_id).eq('owner_id', user.id).single();
  const { data: memberCheck } = await supabase
    .from('trade_org_members').select('id')
    .eq('org_id', org_id).eq('user_id', user.id)
    .in('rol', ['owner', 'admin']).eq('activo', true).single();

  if (!orgCheck && !memberCheck) {
    return Response.json({ error: 'GEO_FORBIDDEN: sin acceso a esta organización' }, { status: 403 });
  }

  const normalized = normalizeAddress(address);
  const hash = `${org_id}:${hashString(normalized)}`;

  // Cache lookup (180 días)
  const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: cached } = await supabase
    .from('trade_geo_cache')
    .select('candidates')
    .eq('org_id', org_id)
    .eq('address_hash', hash)
    .gte('cached_at', cutoff)
    .single();

  if (cached) {
    const candidates = cached.candidates as GeocodingCandidate[];
    return Response.json({
      candidates,
      ambiguous: candidates.length > 1,
      cached: true,
      provider: 'geoapify',
    } satisfies GeocodeResponse);
  }

  // Reserva atómica de 1 crédito: kill switch + rate limit + presupuesto global + cuota org
  const { data: reservation, error: reserveErr } = await supabase
    .rpc('geo_reserve', { p_org_id: org_id, p_estimated: 1, p_waypoint_hash: null });

  if (reserveErr || !reservation?.ok) {
    const err: string = reservation?.error ?? 'GEO_RESERVE_ERROR';
    if (err === 'GEO_DISABLED')
      return Response.json({ error: `${err}: servicio de geolocalización temporalmente desactivado.` }, { status: 503 });
    if (err === 'GEO_RATE_GLOBAL')
      return Response.json({ error: `${err}: límite global alcanzado. Reintenta en 1 segundo.` }, { status: 429 });
    if (err === 'GEO_RATE_GLOBAL_BUDGET')
      return Response.json({ error: `${err}: presupuesto diario de la plataforma agotado.` }, { status: 429 });
    if (err === 'GEO_RATE_ORG')
      return Response.json({ error: `${err}: cuota diaria de la organización agotada.` }, { status: 429 });
    return Response.json({ error: err }, { status: 429 });
  }

  // reservation_id vincula esta reserva a su reconciliación (idempotencia)
  const reservationId: string = reservation.reservation_id;

  // Llamada al proveedor (fuera de cualquier transacción DB)
  const apiKey = Deno.env.get('GEOAPIFY_API_KEY');
  if (!apiKey) {
    await supabase.rpc('geo_reconcile', { p_org_id: org_id, p_reservation_id: reservationId, p_actual: 0, p_waypoint_hash: null });
    return Response.json({ error: 'GEO_CONFIG: GEOAPIFY_API_KEY no configurada' }, { status: 503 });
  }

  const provider = new GeoapifyGeocodingProvider(apiKey);
  let candidates: GeocodingCandidate[];

  try {
    candidates = await provider.geocode(normalized, {
      countrycodes: ['es'],
      limit: 5,
      language: 'es',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'GEO_PROVIDER_ERROR';
    // Geoapify no facturó — liberar el crédito reservado
    await supabase.rpc('geo_reconcile', { p_org_id: org_id, p_reservation_id: reservationId, p_actual: 0, p_waypoint_hash: null });
    if (msg === 'GEO_QUOTA_EXCEEDED') {
      return Response.json({ error: msg }, { status: 402 });
    }
    return Response.json({ error: msg }, { status: 502 });
  }

  // Guardar en caché
  await supabase.from('trade_geo_cache').upsert({
    org_id,
    address_hash:    hash,
    normalized_text: normalized,
    candidates:      candidates,
    provider:        'geoapify',
    cached_at:       new Date().toISOString(),
  }, { onConflict: 'org_id,address_hash' });

  return Response.json({
    candidates,
    ambiguous: candidates.length > 1,
    cached: false,
    provider: 'geoapify',
  } satisfies GeocodeResponse);
});
