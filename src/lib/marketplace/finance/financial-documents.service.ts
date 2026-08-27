// MP-FIN-5A.3 — Financial Document Query & Provider Doc References
//
// Wrappers TypeScript para las RPCs de lectura de documentos financieros
// y registro/listado de referencias documentales de proveedor.
//
// GATES: LEGAL_GATE=OPEN · TAX_GATE=OPEN · STRIPE_GATE=OPEN
// NO PDF · NO frontend · NO Stripe · NO payouts
// NO recalcular importes — solo lee snapshots persistidos
//
// Seguridad:
//   - auth y aislamiento cross-tenant se garantizan en el servidor (SECURITY DEFINER)
//   - el cliente no filtra por seguridad — propaga errores canónicos
//   - actor_id/org_id/document_id son verificados server-side en cada RPC

import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Constantes ─────────────────────────────────────────────────────────────

export const QUERY_RPC_NAMES = {
  GET_PROVIDER_DOCUMENTS:   'mkt_fin_get_provider_documents',
  GET_BUYER_DOCUMENTS:      'mkt_fin_get_buyer_documents',
  GET_DOCUMENT_DETAIL:      'mkt_fin_get_document_detail',
  LIST_PROVIDER_DOC_REFS:   'mkt_fin_list_provider_doc_refs',
  LIST_BUYER_DOC_REFS:      'mkt_fin_list_buyer_doc_refs',
  REGISTER_PROVIDER_DOC_REF: 'mkt_fin_register_provider_doc_ref',
} as const

// Subtypes accesibles por proveedor vs comprador — invariante de negocio.
// El servidor los filtra; las constantes documentan el contrato.
export const PROVIDER_DOC_SUBTYPES = ['supplier_statement', 'settlement_statement'] as const
export const BUYER_DOC_SUBTYPES    = ['purchase_summary'] as const

export const PROVIDER_DOC_REF_TYPES = [
  'invoice', 'credit_note', 'delivery_note', 'other',
] as const

export const QUERY_ERROR_CODES = {
  NOT_FOUND:   'P0002',
  UNAUTHORIZED: 'P0001',
} as const

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface DocQueryParams {
  limit?: number
  offset?: number
  search?: string | null
}

export interface BuyerDocRefQueryParams extends DocQueryParams {
  docType?: ProviderDocRefType | null
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

/** Campos mínimos para vistas de listado (sin metadata). */
export interface FinDocListItem {
  id: string
  doc_number: string
  doc_series: string
  document_subtype: string
  estado: string
  total_amount: number
  currency: string
  concept: string
  issued_at: string | null
  created_at: string
  immutable_at: string | null
  // FKs presentes según subtype
  master_order_id?: string | null
  supplier_order_id?: string | null
  settlement_id?: string | null
}

/**
 * Detalle completo. Allowlist explícita en el servidor.
 * Excluidos: stripe_*, invoice_url/pdf_url, public_token,
 * sent_at/sent_to, ad_booking_id/ad_campaign_id, subscription_id, platform_invoice_id,
 * revenue_type, payer_type, paid_at, payment_method,
 * updated_at, created_by, rate_amount, quantity, subtotal,
 * discount_amount, promotion_amount, commercial_value.
 */
export interface FinDocDetail {
  id: string
  doc_number: string
  doc_series: string
  document_subtype: string
  document_type: string
  estado: string
  payment_status: string
  org_id: string | null
  actor_id: string | null
  concept: string
  period_start: string | null
  period_end: string | null
  net_amount: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  currency: string
  customer_name: string
  customer_nif: string | null
  customer_email: string | null
  customer_address: string | null
  issued_at: string | null
  created_at: string
  immutable_at: string | null
  master_order_id: string | null
  supplier_order_id: string | null
  settlement_id: string | null
  metadata: Record<string, unknown>
}

export type ProviderDocRefType = typeof PROVIDER_DOC_REF_TYPES[number]

export interface ProviderDocRef {
  id: string
  supplier_order_id: string
  actor_id: string
  buyer_org_id: string | null
  doc_type: ProviderDocRefType
  doc_number_provider: string
  doc_date_provider: string
  doc_amount: number | null
  doc_currency: string
  notes: string | null
  registered_at: string
  created_at: string
}

/** BuyerDocRef extiende ProviderDocRef con campos JOIN del servidor (MP-FIN-5C). */
export interface BuyerDocRef extends ProviderDocRef {
  actor_nombre: string
  supplier_order_numero: string
}

export interface RegisterProviderDocRefParams {
  supplierOrderId: string
  docType: ProviderDocRefType
  docNumberProvider: string
  docDateProvider: string
  docAmount?: number | null
  docCurrency?: string
  notes?: string | null
}

// ─── getProviderDocuments ────────────────────────────────────────────────────
// Listado de supplier_statement y settlement_statement del actor autorizado.
// Paginado. No incluye metadata (puede ser grande).

export async function getProviderDocuments(
  supabase: SupabaseClient,
  actorId: string,
  params: DocQueryParams = {},
): Promise<PaginatedResult<FinDocListItem>> {
  const { data, error } = await supabase.rpc(
    QUERY_RPC_NAMES.GET_PROVIDER_DOCUMENTS,
    {
      p_actor_id: actorId,
      p_limit:    params.limit  ?? 50,
      p_offset:   params.offset ?? 0,
    },
  )

  if (error) {
    throw new Error(
      `getProviderDocuments failed for actor ${actorId}: ${error.message}`,
    )
  }

  return data as PaginatedResult<FinDocListItem>
}

// ─── getBuyerDocuments ───────────────────────────────────────────────────────
// Listado de purchase_summary de la org compradora autorizada.

export async function getBuyerDocuments(
  supabase: SupabaseClient,
  orgId: string,
  params: DocQueryParams = {},
): Promise<PaginatedResult<FinDocListItem>> {
  const { data, error } = await supabase.rpc(
    QUERY_RPC_NAMES.GET_BUYER_DOCUMENTS,
    {
      p_org_id: orgId,
      p_limit:  params.limit  ?? 50,
      p_offset: params.offset ?? 0,
      p_search: params.search ?? null,
    },
  )

  if (error) {
    throw new Error(
      `getBuyerDocuments failed for org ${orgId}: ${error.message}`,
    )
  }

  return data as PaginatedResult<FinDocListItem>
}

// ─── getDocumentDetail ───────────────────────────────────────────────────────
// Detalle completo con autorización por subtype resuelta server-side.
// La respuesta ya contiene allowlist explícita del servidor.

export async function getDocumentDetail(
  supabase: SupabaseClient,
  documentId: string,
): Promise<FinDocDetail> {
  const { data, error } = await supabase.rpc(
    QUERY_RPC_NAMES.GET_DOCUMENT_DETAIL,
    { p_document_id: documentId },
  )

  if (error) {
    throw new Error(
      `getDocumentDetail failed for document ${documentId}: ${error.message}`,
    )
  }

  return data as FinDocDetail
}

// ─── listProviderDocRefs ─────────────────────────────────────────────────────
// Refs documentales emitidas por el proveedor (facturas, albaranes, etc.).
// Solo lectura. No permite UPDATE/DELETE.

export async function listProviderDocRefs(
  supabase: SupabaseClient,
  actorId: string,
  params: DocQueryParams = {},
): Promise<PaginatedResult<ProviderDocRef>> {
  const { data, error } = await supabase.rpc(
    QUERY_RPC_NAMES.LIST_PROVIDER_DOC_REFS,
    {
      p_actor_id: actorId,
      p_limit:    params.limit  ?? 50,
      p_offset:   params.offset ?? 0,
    },
  )

  if (error) {
    throw new Error(
      `listProviderDocRefs failed for actor ${actorId}: ${error.message}`,
    )
  }

  return data as PaginatedResult<ProviderDocRef>
}

// ─── listBuyerDocRefs ────────────────────────────────────────────────────────
// Refs documentales visibles al comprador (buyer_org_id = p_org_id).
// Solo lectura. buyer_org_id NULL nunca da acceso público.

export async function listBuyerDocRefs(
  supabase: SupabaseClient,
  orgId: string,
  params: BuyerDocRefQueryParams = {},
): Promise<PaginatedResult<BuyerDocRef>> {
  const { data, error } = await supabase.rpc(
    QUERY_RPC_NAMES.LIST_BUYER_DOC_REFS,
    {
      p_org_id:   orgId,
      p_limit:    params.limit    ?? 50,
      p_offset:   params.offset   ?? 0,
      p_search:   params.search   ?? null,
      p_doc_type: params.docType  ?? null,
    },
  )

  if (error) {
    throw new Error(
      `listBuyerDocRefs failed for org ${orgId}: ${error.message}`,
    )
  }

  return data as PaginatedResult<BuyerDocRef>
}

// ─── registerProviderDocRef ──────────────────────────────────────────────────
// Registra una referencia documental del proveedor sobre un supplier_order.
// actor_id y buyer_org_id son derivados server-side — no enviados por el cliente.
// Devuelve el UUID de la referencia creada.

export async function registerProviderDocRef(
  supabase: SupabaseClient,
  params: RegisterProviderDocRefParams,
): Promise<string> {
  const { data, error } = await supabase.rpc(
    QUERY_RPC_NAMES.REGISTER_PROVIDER_DOC_REF,
    {
      p_supplier_order_id:  params.supplierOrderId,
      p_doc_type:           params.docType,
      p_doc_number_provider: params.docNumberProvider,
      p_doc_date_provider:  params.docDateProvider,
      p_doc_amount:         params.docAmount ?? null,
      p_doc_currency:       params.docCurrency ?? 'EUR',
      p_notes:              params.notes ?? null,
    },
  )

  if (error) {
    throw new Error(
      `registerProviderDocRef failed for order ${params.supplierOrderId}: ${error.message}`,
    )
  }

  return data as string
}
