// MP-FIN-5A.2 — Document Generation RPCs
//
// Wrappers TypeScript para las tres RPCs de generación de documentos
// financieros de marketplace (SECURITY DEFINER, owner=postgres).
//
// GATES: LEGAL_GATE=OPEN · TAX_GATE=OPEN · STRIPE_GATE=OPEN
// NO PDF · NO frontend · NO Stripe · NO payouts
// COMMISSION real = 0% — source of truth: Settlement Engine (MP-FIN-2F)
//
// Compatibilidad c0a875f:
//   next_financial_doc_number() tiene EXECUTE revocada de authenticated.
//   Las RPCs SECURITY DEFINER llaman a la función como postgres (server-side).
//   El cliente nunca obtiene acceso directo a la secuencia.

import type { SupabaseClient } from '@supabase/supabase-js'

export const GENERATION_RPC_NAMES = {
  PURCHASE_SUMMARY:     'mkt_fin_generate_purchase_summary',
  SUPPLIER_STATEMENT:   'mkt_fin_generate_supplier_statement',
  SETTLEMENT_STATEMENT: 'mkt_fin_generate_settlement_statement',
} as const

export const GENERATION_ERROR_CODES = {
  NOT_FOUND:        'P0002', // entidad origen no encontrada
  UNAUTHORIZED:     'P0001', // sin pertenencia a org/actor
  PRECONDITION:     'P0003', // snapshot no tomado / estado draft
  DOC_NUMBER_CLASH: 'P0004', // colisión doc_number con otro tipo
} as const

// ─── generatePurchaseSummary ─────────────────────────────────────────────────
// Genera el purchase_summary para un master_order.
// Autorización: miembro de la org compradora (trade_org_members.activo = true) o admin.
// doc_number = master_order.numero (MKP-YYYY-NNNN); no consume nueva secuencia MKP.
// Devuelve el UUID del documento (idempotente — mismo ID si ya existía).

export async function generatePurchaseSummary(
  supabase: SupabaseClient,
  masterOrderId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc(
    GENERATION_RPC_NAMES.PURCHASE_SUMMARY,
    { p_master_order_id: masterOrderId },
  )

  if (error) {
    throw new Error(
      `generatePurchaseSummary failed for master_order ${masterOrderId}: ${error.message}`,
    )
  }

  return data as string
}

// ─── generateSupplierStatement ───────────────────────────────────────────────
// Genera el supplier_statement para un supplier_order.
// Precondición: financial_snapshot_at IS NOT NULL.
// Autorización: miembro del actor proveedor (_mkt_supplier_member_check) o admin.
// doc_number = next_financial_doc_number('SUP') — generado server-side como postgres.
// Devuelve el UUID del documento (idempotente).

export async function generateSupplierStatement(
  supabase: SupabaseClient,
  supplierOrderId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc(
    GENERATION_RPC_NAMES.SUPPLIER_STATEMENT,
    { p_supplier_order_id: supplierOrderId },
  )

  if (error) {
    throw new Error(
      `generateSupplierStatement failed for supplier_order ${supplierOrderId}: ${error.message}`,
    )
  }

  return data as string
}

// ─── generateSettlementStatement ─────────────────────────────────────────────
// Genera el settlement_statement para una liquidación.
// Precondición: status != 'draft'.
// NO recalcula — usa importes del Settlement Engine (MP-FIN-2F).
// Autorización: miembro del actor proveedor o admin.
// doc_number = next_financial_doc_number('LIQ') — generado server-side como postgres.
// org_id = NULL (trade_marketplace_actors no expone org_id).
// Devuelve el UUID del documento (idempotente).

export async function generateSettlementStatement(
  supabase: SupabaseClient,
  settlementId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc(
    GENERATION_RPC_NAMES.SETTLEMENT_STATEMENT,
    { p_settlement_id: settlementId },
  )

  if (error) {
    throw new Error(
      `generateSettlementStatement failed for settlement ${settlementId}: ${error.message}`,
    )
  }

  return data as string
}
