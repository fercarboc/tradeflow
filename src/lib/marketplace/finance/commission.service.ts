// Commission Service — MP-FIN-1A
// INV-005: commission_rate real = 0% en Fase 0. El 2% es solo simulation_rate.
// INV-006: applies_to_shipping = false en Fase 0.
// TAX_GATE: tipo impositivo de la comisión pendiente de dictamen fiscal.

import { supabase } from '../../supabase'
import type { CommissionPolicy, CommissionResult } from './types/commission.types'

// ── Obtener política activa (para un actor concreto o la global) ───────────────

export async function getActiveCommissionPolicy(
  actorId?: string
): Promise<CommissionPolicy | null> {
  const { data, error } = await supabase.rpc('mkt_fin_get_active_commission_policy', {
    p_actor_id: actorId ?? null,
  })

  if (error) throw new Error(`getActiveCommissionPolicy failed: ${error.message}`)
  if (!data) return null

  return mapCommissionPolicy(data)
}

// ── Calcular comisión (sin escribir en BD) ─────────────────────────────────────
// INV-005: en Fase 0, commission_net/tax/gross = 0. El sim_* es solo observación.

export async function calculateCommission(params: {
  goodsNet: number
  actorId?: string
  simulationMode?: boolean
  currency?: string
}): Promise<CommissionResult> {
  const { data, error } = await supabase.rpc('mkt_fin_calculate_commission', {
    p_goods_net:       params.goodsNet,
    p_actor_id:        params.actorId ?? null,
    p_simulation_mode: params.simulationMode ?? true,
    p_currency:        params.currency ?? 'EUR',
  })

  if (error) throw new Error(`calculateCommission failed: ${error.message}`)

  return {
    commissionNet:   Number(data.commission_net   ?? 0),
    commissionTax:   Number(data.commission_tax   ?? 0),
    commissionGross: Number(data.commission_gross ?? 0),
    commissionRate:  Number(data.commission_rate  ?? 0),
    commissionBase:  data.commission_base ?? 'goods_net',
    taxRate:         Number(data.tax_rate ?? 21),
    isSimulation:    Boolean(data.is_simulation),
    isReal:          Boolean(data.is_real),   // siempre false en Fase 0
    policyId:        data.policy_id ?? null,
  }
}

// ── Listar todas las políticas (admin) ────────────────────────────────────────

export async function listCommissionPolicies(): Promise<CommissionPolicy[]> {
  const { data, error } = await supabase
    .from('trade_marketplace_commission_policies')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`listCommissionPolicies failed: ${error.message}`)

  return (data ?? []).map(mapCommissionPolicy)
}

// ── Mapeo BD → TS ─────────────────────────────────────────────────────────────

function mapCommissionPolicy(row: Record<string, unknown>): CommissionPolicy {
  return {
    id:                   row.id as string,
    nombre:               row.nombre as string,
    commissionEnabled:    Boolean(row.commission_enabled),
    simulationOnly:       Boolean(row.simulation_only),
    commissionRate:       Number(row.commission_rate ?? 0),
    commissionType:       (row.commission_type as CommissionPolicy['commissionType']) ?? 'percentage',
    commissionBase:       (row.commission_base as CommissionPolicy['commissionBase']) ?? 'goods_net',
    commissionTaxRate:    Number(row.commission_tax_rate ?? 21),
    appliesToShipping:    Boolean(row.applies_to_shipping),
    effectiveFrom:        (row.effective_from as string) ?? null,
    effectiveTo:          (row.effective_to as string) ?? null,
    providerActorId:      (row.provider_actor_id as string) ?? null,
    isActive:             Boolean(row.is_active),
    notas:                (row.notas as string) ?? null,
    createdAt:            row.created_at as string,
    updatedAt:            row.updated_at as string,
  }
}
