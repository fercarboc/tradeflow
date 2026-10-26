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
// Coste máximo de suplemento de distancia por ruta (4 000 km = floor(4000/500) = 8).
// Cubre cualquier ruta real de transporte terrestre en España.
// Se usa como techo conservador para la reserva previa a la llamada a Geoapify.
const MAX_DISTANCE_SURCHARGE_CAP = 8;

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

  // Cache lookup PRIMERO — ruta cacheada no consume cuota ni llama al proveedor.
  // geometry IS NOT NULL filtra entradas pendientes (geometry=NULL mientras están en curso).
  const cacheKey = routeCacheKey(validWaypoints);
  const cutoff   = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: cachedRoute } = await supabase
    .from('trade_route_cache')
    .select('geometry, distance_m, duration_s')
    .eq('waypoint_hash', cacheKey)
    .not('geometry', 'is', null)
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

  // Reserva conservadora: segmentos + techo de suplemento de distancia.
  // El coste real (segmentos + floor(distance_m/500_000)) solo se conoce
  // después de llamar a Geoapify; geo_reconcile libera la diferencia.
  const estimatedCredits = segments + MAX_DISTANCE_SURCHARGE_CAP;

  // Reserva atómica: kill switch + rate limit + presupuesto global + cuota org + dedup
  const { data: reservation, error: reserveErr } = await supabase
    .rpc('geo_reserve', { p_org_id: org_id, p_estimated: estimatedCredits, p_waypoint_hash: cacheKey });

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
    if (err === 'GEO_PENDING')
      return Response.json({ error: `${err}: petición idéntica en curso. Reintenta en unos segundos.` }, { status: 409 });
    return Response.json({ error: err }, { status: 429 });
  }

  // Llamada al proveedor (la reserva ya está contabilizada)
  const apiKey = Deno.env.get('GEOAPIFY_API_KEY');
  if (!apiKey) {
    await supabase.rpc('geo_reconcile', { p_org_id: org_id, p_reserved: estimatedCredits, p_actual: 0, p_waypoint_hash: cacheKey });
    return Response.json({ error: 'GEO_CONFIG: GEOAPIFY_API_KEY no configurada' }, { status: 503 });
  }

  const provider = new GeoapifyRoutingProvider(apiKey);
  let result: RouteResult | null;

  try {
    result = await provider.route(validWaypoints, 'bus');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'GEO_PROVIDER_ERROR';
    // Error de proveedor — Geoapify no facturó: liberar reserva completa
    await supabase.rpc('geo_reconcile', { p_org_id: org_id, p_reserved: estimatedCredits, p_actual: 0, p_waypoint_hash: cacheKey });
    return Response.json({ error: msg }, { status: 502 });
  }

  if (!result) {
    // Sin ruta posible — liberar reserva completa
    await supabase.rpc('geo_reconcile', { p_org_id: org_id, p_reserved: estimatedCredits, p_actual: 0, p_waypoint_hash: cacheKey });
    return Response.json(null);
  }

  // Coste real = segmentos + suplemento de distancia (conocido ahora)
  const distSurcharge = Math.floor(result.distance_m / 500_000);
  const actualCredits = segments + distSurcharge;

  // Liberar sobre-reserva (reserva - real) de global y org
  await supabase.rpc('geo_reconcile', {
    p_org_id:        org_id,
    p_reserved:      estimatedCredits,
    p_actual:        actualCredits,
    p_waypoint_hash: cacheKey,
  });

  // Guardar en caché; pending_at=null elimina la marca de dedup
  await supabase.from('trade_route_cache').upsert({
    waypoint_hash: cacheKey,
    geometry:      result.geometry,
    distance_m:    result.distance_m,
    duration_s:    result.duration_s,
    provider:      'geoapify',
    cached_at:     new Date().toISOString(),
    pending_at:    null,
  }, { onConflict: 'waypoint_hash' });

  return Response.json({ ...result, cached: false });
});
