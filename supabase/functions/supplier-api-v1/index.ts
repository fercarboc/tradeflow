// MVP-7.3 — Supplier API v1
// Router principal para la API externa de proveedores TrabFlow.
// Autenticación: Bearer tsf_v1_<64hex> → SHA-256 → lookup en trade_supplier_api_credentials
// Todos los actores se resuelven server-side; el body nunca define el actor.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Constantes ────────────────────────────────────────────────────────────────

const MAX_BODY_BYTES = 2 * 1024 * 1024 // 2 MB

// Límites por endpoint (requests/minuto)
const RATE_LIMITS: Record<string, number> = {
  'catalog/upsert':    10,
  'stock/update':      60,
  'prices/update':     60,
  'catalog/products':  60,
  'imports/status':   120,
}

const API_VERSION = '2026-08-01'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type,Idempotency-Key,X-Source-System',
}

// ── Cliente Supabase (service_role) ──────────────────────────────────────────

function getAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )
}

// ── Helpers de respuesta ─────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'API-Version':  API_VERSION,
      ...CORS_HEADERS,
      ...extra,
    },
  })
}

function errorResponse(
  status: number, code: string, message: string,
  extra: Record<string, string> = {}
): Response {
  return jsonResponse({ error: { code, message } }, status, extra)
}

// ── SHA-256 del Bearer token ──────────────────────────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── SHA-256 del body (para idempotencia) ─────────────────────────────────────

async function sha256Body(body: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', body)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Resolución del endpoint desde la URL ─────────────────────────────────────

function resolveEndpoint(req: Request): string | null {
  const url  = new URL(req.url)
  const path = url.pathname

  if (req.method === 'POST' && path.endsWith('/catalog/upsert'))   return 'catalog/upsert'
  if (req.method === 'PUT'  && path.endsWith('/stock/update'))      return 'stock/update'
  if (req.method === 'PUT'  && path.endsWith('/prices/update'))     return 'prices/update'
  if (req.method === 'GET'  && path.includes('/catalog/products'))  return 'catalog/products'
  if (req.method === 'GET'  && path.includes('/imports/'))          return 'imports/status'
  return null
}

// ── Extrae el ID de import de la URL ─────────────────────────────────────────

function extractImportId(req: Request): string | null {
  const match = new URL(req.url).pathname.match(/\/imports\/([^/]+)/)
  return match ? match[1] : null
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const admin = getAdmin()
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = req.headers.get('user-agent') ?? null

  // ── 1. Identificar endpoint ─────────────────────────────────────────────────
  const endpoint = resolveEndpoint(req)
  if (!endpoint) {
    return errorResponse(404, 'NOT_FOUND', 'Endpoint no reconocido.')
  }

  // ── 2. Validar Content-Length (solo para escrituras con body) ───────────────
  if (['catalog/upsert', 'stock/update', 'prices/update'].includes(endpoint)) {
    const contentLength = parseInt(req.headers.get('content-length') ?? '0', 10)
    if (contentLength > MAX_BODY_BYTES) {
      return errorResponse(413, 'PAYLOAD_TOO_LARGE', `Request body supera el límite de ${MAX_BODY_BYTES / 1024 / 1024} MB.`)
    }
  }

  // ── 3. Autenticación Bearer ─────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return errorResponse(401, 'MISSING_TOKEN', 'Se requiere Authorization: Bearer <api_key>')
  }
  const rawToken = authHeader.slice(7).trim()
  if (!rawToken.startsWith('tsf_v1_')) {
    return errorResponse(401, 'INVALID_TOKEN_FORMAT', 'El token no tiene el formato esperado.')
  }

  const keyHash = await sha256Hex(rawToken)

  const { data: cred, error: credErr } = await admin.rpc('resolve_api_credential', {
    p_key_hash: keyHash,
    p_ip:       clientIp,
    p_ua:       userAgent,
  })

  if (credErr || !cred) {
    return errorResponse(401, 'UNAUTHORIZED', 'Credencial inválida, expirada o revocada.')
  }

  const actorId:      string   = cred.actor_id
  const credentialId: string   = cred.credential_id
  const scopes:       string[] = cred.scopes ?? []

  // ── 4. Scope check ──────────────────────────────────────────────────────────
  const scopeMap: Record<string, string> = {
    'catalog/upsert':   'catalog:write',
    'stock/update':     'stock:write',
    'prices/update':    'prices:write',
    'catalog/products': 'catalog:read',
    'imports/status':   'imports:read',
  }
  const required = scopeMap[endpoint]
  if (required && !scopes.includes(required)) {
    return errorResponse(403, 'INSUFFICIENT_SCOPE',
      `Este endpoint requiere el scope "${required}". La credencial tiene: ${scopes.join(', ')}`)
  }

  // ── 5. Rate limiting ────────────────────────────────────────────────────────
  const limit = RATE_LIMITS[endpoint] ?? 30
  const { data: rl } = await admin.rpc('check_and_increment_rate_limit', {
    p_actor_id: actorId,
    p_endpoint: endpoint,
    p_limit:    limit,
  })

  const rlHeaders: Record<string, string> = {
    'X-RateLimit-Limit':     String(rl?.limit  ?? limit),
    'X-RateLimit-Remaining': String(rl?.remaining ?? 0),
    'X-RateLimit-Reset':     rl?.reset_at ?? '',
  }

  if (rl && !rl.allowed) {
    return errorResponse(429, 'RATE_LIMIT_EXCEEDED',
      `Límite de ${limit} req/min para "${endpoint}" alcanzado. Reintenta después de ${rl.reset_at}.`,
      { ...rlHeaders, 'Retry-After': '60' })
  }

  // ── 6. Idempotencia (solo para escrituras) ──────────────────────────────────
  const idempotencyKey = req.headers.get('idempotency-key') ?? null
  let bodyBytes: Uint8Array | null = null
  let bodyJson: unknown = null

  if (['catalog/upsert', 'stock/update', 'prices/update'].includes(endpoint)) {
    try {
      bodyBytes = new Uint8Array(await req.arrayBuffer())
      if (bodyBytes.length > MAX_BODY_BYTES) {
        return errorResponse(413, 'PAYLOAD_TOO_LARGE', 'Request body demasiado grande.', rlHeaders)
      }
      bodyJson = JSON.parse(new TextDecoder().decode(bodyBytes))
    } catch {
      return errorResponse(400, 'INVALID_JSON', 'El body no es JSON válido.', rlHeaders)
    }

    if (idempotencyKey) {
      const bodyHash = await sha256Body(bodyBytes!)
      const { data: idem } = await admin.rpc('get_idempotency_record', {
        p_key:      idempotencyKey,
        p_actor_id: actorId,
        p_endpoint: endpoint,
      })

      if (idem) {
        if (idem.request_hash !== bodyHash) {
          return errorResponse(422, 'IDEMPOTENCY_CONFLICT',
            'La Idempotency-Key ya fue usada con un body diferente. Usa una nueva key para datos distintos.',
            { ...rlHeaders, 'X-Idempotency-Replayed': 'false' })
        }
        // Respuesta cacheada
        return new Response(JSON.stringify(idem.response_body), {
          status: idem.response_status,
          headers: {
            'Content-Type':            'application/json',
            'API-Version':             API_VERSION,
            'X-Idempotency-Replayed':  'true',
            ...CORS_HEADERS,
            ...rlHeaders,
          },
        })
      }
    }
  }

  // ── 7. Iniciar sync_log ─────────────────────────────────────────────────────
  const sourceSystem = req.headers.get('x-source-system') ?? null
  let syncLogId: string | null = null

  const { data: logId } = await admin.rpc('log_api_sync_start', {
    p_credential_id:   credentialId,
    p_actor_id:        actorId,
    p_endpoint:        endpoint,
    p_idempotency_key: idempotencyKey,
    p_source_system:   sourceSystem,
    p_ip:              clientIp,
    p_user_agent:      userAgent,
    p_rows_received:   Array.isArray((bodyJson as Record<string, unknown>)?.items)
                       ? ((bodyJson as Record<string, unknown>).items as unknown[]).length
                       : null,
  })
  syncLogId = logId ?? null

  // ── 8. Ejecutar operación ───────────────────────────────────────────────────
  let responseBody: unknown
  let responseStatus = 200
  let logStatus = 'completed'
  let logError: string | null = null
  let rowsInserted: number | null = null
  let rowsUpdated:  number | null = null
  let rowsRejected: number | null = null

  try {
    if (endpoint === 'catalog/upsert') {
      const payload = bodyJson as { items?: unknown[]; source_system?: string }
      if (!Array.isArray(payload.items)) {
        return errorResponse(400, 'INVALID_BODY', 'Se requiere "items" como array.', rlHeaders)
      }

      const { data, error } = await admin.rpc('api_sync_catalog_offerings', {
        p_actor_id:      actorId,
        p_items:         payload.items,
        p_source_system: sourceSystem ?? (payload.source_system ?? null),
        p_sync_log_id:   syncLogId,
      })

      if (error) throw new Error(error.message)

      rowsInserted = data.rows_inserted
      rowsUpdated  = data.rows_updated
      rowsRejected = data.rows_rejected
      responseBody = {
        success:   true,
        import_id: data.import_id,
        stats: {
          received: payload.items.length,
          inserted: data.rows_inserted,
          updated:  data.rows_updated,
          rejected: data.rows_rejected,
        },
        errors: data.errors,
      }

    } else if (endpoint === 'stock/update') {
      const payload = bodyJson as { items?: unknown[] }
      if (!Array.isArray(payload.items)) {
        return errorResponse(400, 'INVALID_BODY', 'Se requiere "items" como array.', rlHeaders)
      }

      const { data, error } = await admin.rpc('api_sync_stock', {
        p_actor_id: actorId,
        p_items:    payload.items,
      })

      if (error) throw new Error(error.message)

      rowsUpdated  = data.rows_updated
      rowsRejected = (data.not_found as string[]).length
      responseBody = {
        success:   true,
        stats: {
          received:  data.rows_received,
          updated:   data.rows_updated,
          not_found: (data.not_found as string[]).length,
        },
        not_found: data.not_found,
      }

    } else if (endpoint === 'prices/update') {
      const payload = bodyJson as { items?: unknown[] }
      if (!Array.isArray(payload.items)) {
        return errorResponse(400, 'INVALID_BODY', 'Se requiere "items" como array.', rlHeaders)
      }

      const { data, error } = await admin.rpc('api_sync_prices', {
        p_actor_id: actorId,
        p_items:    payload.items,
      })

      if (error) throw new Error(error.message)

      rowsUpdated  = data.rows_updated
      rowsRejected = (data.not_found as string[]).length
      responseBody = {
        success:   true,
        stats: {
          received:  data.rows_received,
          updated:   data.rows_updated,
          not_found: (data.not_found as string[]).length,
        },
        not_found: data.not_found,
      }

    } else if (endpoint === 'catalog/products') {
      const url      = new URL(req.url)
      const page     = parseInt(url.searchParams.get('page') ?? '1', 10)
      const perPage  = Math.min(parseInt(url.searchParams.get('per_page') ?? '50', 10), 200)
      const activa   = url.searchParams.get('activa') === 'false' ? false
                     : url.searchParams.get('activa') === 'true'  ? true : null
      const matchSt  = url.searchParams.get('match_state') ?? null

      const { data, error } = await admin.rpc('get_api_catalog_products', {
        p_actor_id:   actorId,
        p_page:       page,
        p_per_page:   perPage,
        p_activa:     activa,
        p_match_state: matchSt,
      })

      if (error) throw new Error(error.message)
      responseBody = data

    } else if (endpoint === 'imports/status') {
      const importId = extractImportId(req)
      if (!importId) {
        return errorResponse(400, 'INVALID_PATH', 'ID de import no encontrado en la URL.', rlHeaders)
      }

      // Buscar en sync_log para retornar estado de la operación
      const { data: rows } = await admin
        .from('trade_supplier_api_sync_log')
        .select('id,endpoint,status,started_at,finished_at,rows_received,rows_inserted,rows_updated,rows_rejected,error_detail')
        .eq('actor_id', actorId)
        .eq('id', importId)
        .single()

      if (!rows) {
        return errorResponse(404, 'NOT_FOUND', 'Import no encontrado.', rlHeaders)
      }
      responseBody = { sync: rows }
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logStatus = 'failed'
    logError  = msg.slice(0, 500) // truncar; no exponer internals completos
    responseStatus = 500
    responseBody = { error: { code: 'INTERNAL_ERROR', message: 'Error procesando la solicitud.' } }

    // Errores de validación de SQL → 400
    if (msg.includes('BATCH_TOO_LARGE') || msg.includes('INVALID_INPUT')) {
      responseStatus = 400
      responseBody   = { error: { code: msg.split(':')[0], message: msg } }
      logStatus = 'completed'
    }
    if (msg.includes('ACTOR_NO_CATALOG')) {
      responseStatus = 403
      responseBody   = { error: { code: 'ACTOR_NO_CATALOG', message: 'El actor no tiene catálogo activo.' } }
      logStatus = 'completed'
    }
  }

  // ── 9. Cerrar sync_log ──────────────────────────────────────────────────────
  if (syncLogId) {
    await admin.rpc('log_api_sync_end', {
      p_sync_id:       syncLogId,
      p_status:        logStatus,
      p_rows_inserted: rowsInserted,
      p_rows_updated:  rowsUpdated,
      p_rows_rejected: rowsRejected,
      p_error_detail:  logError,
    })
  }

  // ── 10. Guardar idempotencia si es petición nueva con key ───────────────────
  if (idempotencyKey && bodyBytes && logStatus === 'completed' && responseStatus < 500) {
    const bodyHash = await sha256Body(bodyBytes)
    await admin.rpc('set_idempotency_record', {
      p_key:             idempotencyKey,
      p_actor_id:        actorId,
      p_endpoint:        endpoint,
      p_request_hash:    bodyHash,
      p_response_status: responseStatus,
      p_response_body:   responseBody,
    })
  }

  return jsonResponse(responseBody, responseStatus, rlHeaders)
})
