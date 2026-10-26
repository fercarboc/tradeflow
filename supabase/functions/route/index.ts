/**
 * Edge Function: route
 * Calcula la geometría de un recorrido por carretera para una serie de waypoints.
 *
 * Seguridad: JWT + pertenencia a org_id.
 * Caché: 30 días por hash de waypoints (agnóstico de org — rutas no son datos privados).
 * Rate limit: compartido con geocode (mismo slot global en trade_geo_rate).
 * Perfil: bus (verifica accesos para autobuses; sin restricciones de altura/peso).
 *
 * Input:  { waypoints: [{lat, lng}], org_id: string }
 * Output: { geometry: GeoJSONLineString, distance_m, duration_s, provider, cached }
 *         | null si < 2 waypoints válidos
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  GeoapifyRoutingProvider,
  type RouteWaypoint,
  type RouteResult,
} from '../_shared/geoProviders.ts';

const CACHE_TTL_DAYS = 30;
const GLOBAL_RATE_MS = 1100;

function routeCacheKey(waypoints: RouteWaypoint[]): string {
  return JSON.stringify(
    waypoints.map(w => [
      Math.round(w.lat * 1e6) / 1e6,
      Math.round(w.lng * 1e6) / 1e6,
    ])
  );
}

function isValidWaypoint(w: unknown): w is RouteWaypoint {
  if (!w || typeof w !== 'object') return false;
  const wp = w as Record<string, unknown>;
  return (
    typeof wp.lat === 'number' && isFinite(wp.lat) && wp.lat >= -90  && wp.lat <= 90 &&
    typeof wp.lng === 'number' && isFinite(wp.lng) && wp.lng >= -180 && wp.lng <= 180
  );
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

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
  );
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'GEO_AUTH: token inválido' }, { status: 401 });
  }

  const body = await req.json() as { waypoints: unknown[]; org_id: string };
  const { waypoints: rawWaypoints, org_id } = body;

  if (!org_id || !Array.isArray(rawWaypoints)) {
    return Response.json({ error: 'GEO_PARAMS: waypoints y org_id requeridos' }, { status: 400 });
  }
  // Límite de waypoints: 25 puntos máximo → 24 segmentos → 24 créditos base
  if (rawWaypoints.length > 25) {
    return Response.json({ error: 'GEO_PARAMS: máximo 25 waypoints por solicitud' }, { status: 400 });
  }

  // Verificar pertenencia a org — cualquier miembro activo puede solicitar rutas (son datos públicos)
  const { data: orgCheck } = await supabase
    .from('trade_organizations').select('id').eq('id', org_id).eq('owner_id', user.id).single();
  const { data: memberCheck } = await supabase
    .from('trade_org_members').select('id')
    .eq('org_id', org_id).eq('user_id', user.id)
    .eq('activo', true).single();

  if (!orgCheck && !memberCheck) {
    return Response.json({ error: 'GEO_FORBIDDEN: sin acceso a esta organización' }, { status: 403 });
  }

  // Validar cada waypoint
  const validWaypoints: RouteWaypoint[] = rawWaypoints.filter(isValidWaypoint);
  if (validWaypoints.length < 2) {
    return Response.json(null); // Sin ruta — respuesta vacía normal
  }

  // Coste mínimo de créditos = segmentos (distancia aún desconocida)
  const segments = validWaypoints.length - 1;

  // Cache lookup PRIMERO — una ruta cacheada no consume cuota ni llama al proveedor
  const cacheKey = routeCacheKey(validWaypoints);
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: cachedRoute } = await supabase
    .from('trade_route_cache')
    .select('geometry, distance_m, duration_s')
    .eq('waypoint_hash', cacheKey)
    .gte('cached_at', cutoff)
    .single();

  if (cachedRoute) {
    return Response.json({
      geometry:   cachedRoute.geometry,
      distance_m: cachedRoute.distance_m,
      duration_s: cachedRoute.duration_s,
      provider:   'geoapify',
      cached:     true,
    } as RouteResult & { cached: boolean });
  }

  // Cuota diaria — verificar reserva mínima de créditos (segmentos)
  await supabase.from('trade_geo_usage').upsert(
    { org_id, date: today, req_count: 0, daily_limit: 100 },
    { onConflict: 'org_id,date', ignoreDuplicates: true }
  );
  const { data: routeUsageRow } = await supabase
    .from('trade_geo_usage')
    .select('req_count, daily_limit')
    .eq('org_id', org_id)
    .eq('date', today)
    .single();

  // Rechazar si no quedan suficientes créditos para el mínimo (segmentos)
  const dailyLimit = routeUsageRow?.daily_limit ?? 100;
  if (routeUsageRow && routeUsageRow.req_count + segments > dailyLimit) {
    return Response.json({ error: 'GEO_RATE_ORG: cuota diaria de la organización agotada.' }, { status: 429 });
  }

  // Rate limit global
  const { count: rateLimitOk } = await supabase
    .from('trade_geo_rate')
    .update({ req_at: new Date().toISOString() })
    .eq('provider', 'geoapify')
    .or(`req_at.is.null,req_at.lt.${new Date(Date.now() - GLOBAL_RATE_MS).toISOString()}`)
    .select('*', { count: 'exact', head: true });

  if ((rateLimitOk ?? 0) === 0) {
    return Response.json({ error: 'GEO_RATE_GLOBAL: límite global alcanzado. Reintenta en 1 segundo.' }, { status: 429 });
  }

  // Llamada al proveedor
  const apiKey = Deno.env.get('GEOAPIFY_API_KEY');
  if (!apiKey) {
    return Response.json({ error: 'GEO_CONFIG: GEOAPIFY_API_KEY no configurada' }, { status: 503 });
  }

  const provider = new GeoapifyRoutingProvider(apiKey);
  let result: RouteResult | null;

  try {
    result = await provider.route(validWaypoints, 'bus');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'GEO_PROVIDER_ERROR';
    return Response.json({ error: msg }, { status: 502 });
  }

  if (!result) return Response.json(null);

  // Calcular créditos reales ahora que conocemos la distancia
  // Fórmula Geoapify: segmentos + floor(km/500) de distancia
  const distSurcharge = Math.floor(result.distance_m / 500_000);
  const actualCredits = segments + distSurcharge;

  // Incrementar cuota por créditos reales con WHERE guard atómico:
  // req_count + actualCredits <= daily_limit
  await supabase
    .from('trade_geo_usage')
    .update({ req_count: (routeUsageRow?.req_count ?? 0) + actualCredits })
    .eq('org_id', org_id)
    .eq('date', today)
    .lte('req_count', dailyLimit - actualCredits);

  // Guardar en caché
  await supabase.from('trade_route_cache').upsert({
    waypoint_hash: cacheKey,
    geometry:      result.geometry,
    distance_m:    result.distance_m,
    duration_s:    result.duration_s,
    provider:      'geoapify',
    cached_at:     new Date().toISOString(),
  }, { onConflict: 'waypoint_hash' });

  return Response.json({ ...result, cached: false });
});
