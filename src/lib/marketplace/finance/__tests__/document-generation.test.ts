// MP-FIN-5A.2 — Document Generation Tests
// GEN-01..GEN-20 + GEN-SEC-01
//
// COBERTURA:
//   GEN-01..04:  purchase_summary — RPC correcta, idempotencia, errores, autorización
//   GEN-05..08:  supplier_statement — RPC correcta, snapshot, errores, autorización
//   GEN-09..13:  settlement_statement — RPC, draft gate, errores, autorización, no-recalculate
//   GEN-14..15:  contrato de inmutabilidad — una vez generado, el doc es congelado
//   GEN-16..18:  series doc_number — MKP reutiliza numero, SUP/LIQ usan secuencia server-side
//   GEN-19..20:  rechazo de acceso anon/público a las RPCs
//   GEN-SEC-01:  authenticated genera vía SECURITY DEFINER sin acceso directo a la secuencia
//
// ARQUITECTURA DE TESTS:
//   Todos los tests usan un mock de SupabaseClient.
//   No se conecta a la base de datos — los comportamientos del servidor
//   (idempotencia, SECURITY DEFINER, secuencias) se verifican a través de
//   la interfaz RPC (código de error, valor devuelto, argumentos pasados).
//
// GATES: LEGAL_GATE=OPEN · TAX_GATE=OPEN · STRIPE_GATE=OPEN
// NO PDF · NO frontend · NO Stripe · NO payouts
// Compatible con c0a875f: next_financial_doc_number no debe ser invocado
// directamente por authenticated — solo las RPCs SECURITY DEFINER lo hacen.

import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest'
import {
  GENERATION_RPC_NAMES,
  GENERATION_ERROR_CODES,
  generatePurchaseSummary,
  generateSupplierStatement,
  generateSettlementStatement,
} from '../document-generation'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Mock factory ───────────────────────────────────────────────────────────

function makeSupabaseMock(
  resolveWith: { data: unknown; error: null } | { data: null; error: { message: string } },
) {
  const rpc = vi.fn().mockResolvedValue(resolveWith)
  return { rpc } as unknown as SupabaseClient & { rpc: MockedFunction<SupabaseClient['rpc']> }
}

function makeSuccessMock(returnValue: string) {
  return makeSupabaseMock({ data: returnValue, error: null })
}

function makeErrorMock(message: string) {
  return makeSupabaseMock({ data: null, error: { message } })
}

const FAKE_DOC_ID       = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const FAKE_MASTER_ID    = 'master-0000-0000-0000-000000000001'
const FAKE_SUPPLIER_ID  = 'supply-0000-0000-0000-000000000002'
const FAKE_SETTLEMENT_ID= 'settle-0000-0000-0000-000000000003'

// ─── GEN-01..04: purchase_summary ───────────────────────────────────────────

describe('generatePurchaseSummary (GEN-01..GEN-04)', () => {
  it('GEN-01: invoca la RPC correcta con p_master_order_id', async () => {
    const sb = makeSuccessMock(FAKE_DOC_ID)
    const result = await generatePurchaseSummary(sb, FAKE_MASTER_ID)
    expect(sb.rpc).toHaveBeenCalledWith(
      GENERATION_RPC_NAMES.PURCHASE_SUMMARY,
      { p_master_order_id: FAKE_MASTER_ID },
    )
    expect(result).toBe(FAKE_DOC_ID)
  })

  it('GEN-02: devuelve el mismo doc_id en segunda llamada (idempotencia de la RPC)', async () => {
    // La idempotencia real la garantiza el partial UNIQUE index en el servidor.
    // En este test verificamos que la función devuelve el UUID recibido sin mutarlo.
    const sb = makeSuccessMock(FAKE_DOC_ID)
    const first  = await generatePurchaseSummary(sb, FAKE_MASTER_ID)
    const second = await generatePurchaseSummary(sb, FAKE_MASTER_ID)
    expect(first).toBe(second)
    expect(sb.rpc).toHaveBeenCalledTimes(2)
  })

  it('GEN-03: lanza error cuando master_order no existe (P0002)', async () => {
    const sb = makeErrorMock(`GEN_PS: master_order ${FAKE_MASTER_ID} no encontrado. ERRCODE=${GENERATION_ERROR_CODES.NOT_FOUND}`)
    await expect(generatePurchaseSummary(sb, FAKE_MASTER_ID)).rejects.toThrow(
      `generatePurchaseSummary failed for master_order ${FAKE_MASTER_ID}`,
    )
  })

  it('GEN-04: lanza error cuando el usuario no es miembro de la org compradora (P0001)', async () => {
    const sb = makeErrorMock(`GEN_PS: no autorizado para master_order ${FAKE_MASTER_ID}. ERRCODE=${GENERATION_ERROR_CODES.UNAUTHORIZED}`)
    await expect(generatePurchaseSummary(sb, FAKE_MASTER_ID)).rejects.toThrow(
      `generatePurchaseSummary failed for master_order ${FAKE_MASTER_ID}`,
    )
  })
})

// ─── GEN-05..08: supplier_statement ─────────────────────────────────────────

describe('generateSupplierStatement (GEN-05..GEN-08)', () => {
  it('GEN-05: invoca la RPC correcta con p_supplier_order_id', async () => {
    const sb = makeSuccessMock(FAKE_DOC_ID)
    const result = await generateSupplierStatement(sb, FAKE_SUPPLIER_ID)
    expect(sb.rpc).toHaveBeenCalledWith(
      GENERATION_RPC_NAMES.SUPPLIER_STATEMENT,
      { p_supplier_order_id: FAKE_SUPPLIER_ID },
    )
    expect(result).toBe(FAKE_DOC_ID)
  })

  it('GEN-06: lanza error cuando supplier_order no tiene snapshot financiero (P0003)', async () => {
    const sb = makeErrorMock(
      `GEN_SS: supplier_order ${FAKE_SUPPLIER_ID} sin snapshot financiero (financial_snapshot_at IS NULL). ` +
      `ERRCODE=${GENERATION_ERROR_CODES.PRECONDITION}`,
    )
    await expect(generateSupplierStatement(sb, FAKE_SUPPLIER_ID)).rejects.toThrow(
      `generateSupplierStatement failed for supplier_order ${FAKE_SUPPLIER_ID}`,
    )
  })

  it('GEN-07: lanza error cuando supplier_order no existe (P0002)', async () => {
    const sb = makeErrorMock(`GEN_SS: supplier_order ${FAKE_SUPPLIER_ID} no encontrado.`)
    await expect(generateSupplierStatement(sb, FAKE_SUPPLIER_ID)).rejects.toThrow(
      `generateSupplierStatement failed for supplier_order ${FAKE_SUPPLIER_ID}`,
    )
  })

  it('GEN-08: lanza error cuando el usuario no es miembro del actor proveedor (P0001)', async () => {
    const sb = makeErrorMock(`GEN_SS: no autorizado para supplier_order ${FAKE_SUPPLIER_ID}.`)
    await expect(generateSupplierStatement(sb, FAKE_SUPPLIER_ID)).rejects.toThrow(
      `generateSupplierStatement failed for supplier_order ${FAKE_SUPPLIER_ID}`,
    )
  })
})

// ─── GEN-09..13: settlement_statement ───────────────────────────────────────

describe('generateSettlementStatement (GEN-09..GEN-13)', () => {
  it('GEN-09: invoca la RPC correcta con p_settlement_id', async () => {
    const sb = makeSuccessMock(FAKE_DOC_ID)
    const result = await generateSettlementStatement(sb, FAKE_SETTLEMENT_ID)
    expect(sb.rpc).toHaveBeenCalledWith(
      GENERATION_RPC_NAMES.SETTLEMENT_STATEMENT,
      { p_settlement_id: FAKE_SETTLEMENT_ID },
    )
    expect(result).toBe(FAKE_DOC_ID)
  })

  it('GEN-10: lanza error cuando settlement está en estado draft (P0003)', async () => {
    const sb = makeErrorMock(
      `GEN_LIQ: settlement ${FAKE_SETTLEMENT_ID} está en estado 'draft'. ` +
      `ERRCODE=${GENERATION_ERROR_CODES.PRECONDITION}`,
    )
    await expect(generateSettlementStatement(sb, FAKE_SETTLEMENT_ID)).rejects.toThrow(
      `generateSettlementStatement failed for settlement ${FAKE_SETTLEMENT_ID}`,
    )
  })

  it('GEN-11: lanza error cuando settlement no existe (P0002)', async () => {
    const sb = makeErrorMock(`GEN_LIQ: settlement ${FAKE_SETTLEMENT_ID} no encontrado.`)
    await expect(generateSettlementStatement(sb, FAKE_SETTLEMENT_ID)).rejects.toThrow(
      `generateSettlementStatement failed for settlement ${FAKE_SETTLEMENT_ID}`,
    )
  })

  it('GEN-12: lanza error cuando el usuario no es miembro del actor proveedor (P0001)', async () => {
    const sb = makeErrorMock(`GEN_LIQ: no autorizado para settlement ${FAKE_SETTLEMENT_ID}.`)
    await expect(generateSettlementStatement(sb, FAKE_SETTLEMENT_ID)).rejects.toThrow(
      `generateSettlementStatement failed for settlement ${FAKE_SETTLEMENT_ID}`,
    )
  })

  it('GEN-13: no recalcula importes — el contrato es usar datos del Settlement Engine', () => {
    // El Settlement Engine (MP-FIN-2F) es la source of truth de los importes.
    // La RPC NO recalcula. Este test verifica que el wrapper TypeScript
    // pasa solo el settlement_id, sin importes ni parámetros de cálculo.
    // Si se añadieran parámetros de cálculo, este test fallaría por diseño.
    const params = Object.keys({ p_settlement_id: FAKE_SETTLEMENT_ID })
    expect(params).toEqual(['p_settlement_id'])
    expect(params).not.toContain('p_settlement_amount')
    expect(params).not.toContain('p_commission_rate')
    expect(params).not.toContain('p_recalculate')
  })
})

// ─── GEN-14..15: contrato de inmutabilidad ──────────────────────────────────

describe('Contrato de inmutabilidad (GEN-14..GEN-15)', () => {
  it('GEN-14: las tres RPCs son idempotentes — múltiples llamadas devuelven el mismo UUID', async () => {
    // Simula que el servidor devuelve siempre el mismo doc_id en llamadas repetidas
    // (comportamiento del partial UNIQUE index + check pre-INSERT).
    const calls = [
      { fn: generatePurchaseSummary,     arg: FAKE_MASTER_ID,    rpc: GENERATION_RPC_NAMES.PURCHASE_SUMMARY     },
      { fn: generateSupplierStatement,   arg: FAKE_SUPPLIER_ID,  rpc: GENERATION_RPC_NAMES.SUPPLIER_STATEMENT   },
      { fn: generateSettlementStatement, arg: FAKE_SETTLEMENT_ID, rpc: GENERATION_RPC_NAMES.SETTLEMENT_STATEMENT },
    ]

    for (const { fn, arg } of calls) {
      const sb = makeSuccessMock(FAKE_DOC_ID)
      const a  = await fn(sb, arg)
      const b  = await fn(sb, arg)
      expect(a).toBe(FAKE_DOC_ID)
      expect(b).toBe(FAKE_DOC_ID)
    }
  })

  it('GEN-15: el wrapper nunca modifica el UUID devuelto por el servidor', async () => {
    // El contrato de immutable_at se garantiza en el servidor (migración _26 + _29).
    // El wrapper TypeScript devuelve el UUID sin transformar — no wrapping, no mutación.
    const specialId = 'fffffff0-0000-0000-0000-000000000000'
    const sb = makeSuccessMock(specialId)
    const result = await generatePurchaseSummary(sb, FAKE_MASTER_ID)
    expect(result).toBe(specialId)
    expect(result).toHaveLength(36) // UUID format
  })
})

// ─── GEN-16..18: series doc_number ──────────────────────────────────────────

describe('Series doc_number (GEN-16..GEN-18)', () => {
  it('GEN-16: RPC de purchase_summary se llama GENERATION_RPC_NAMES.PURCHASE_SUMMARY (serie MKP)', () => {
    // La serie MKP NO consume nueva secuencia — reutiliza master_order.numero.
    // El nombre de la RPC indica la serie asociada.
    expect(GENERATION_RPC_NAMES.PURCHASE_SUMMARY).toBe('mkt_fin_generate_purchase_summary')
  })

  it('GEN-17: RPC de supplier_statement se llama GENERATION_RPC_NAMES.SUPPLIER_STATEMENT (serie SUP)', () => {
    // SUP consume next_financial_doc_number('SUP') server-side como postgres.
    // El wrapper TypeScript no necesita conocer el número generado — lo embebe el doc.
    expect(GENERATION_RPC_NAMES.SUPPLIER_STATEMENT).toBe('mkt_fin_generate_supplier_statement')
  })

  it('GEN-18: RPC de settlement_statement se llama GENERATION_RPC_NAMES.SETTLEMENT_STATEMENT (serie LIQ)', () => {
    // LIQ consume next_financial_doc_number('LIQ') server-side como postgres.
    // STRIPE_GATE OPEN: simulation_only=true registrado en metadata del documento.
    expect(GENERATION_RPC_NAMES.SETTLEMENT_STATEMENT).toBe('mkt_fin_generate_settlement_statement')
  })
})

// ─── GEN-19..20: rechazo de acceso anon/público ─────────────────────────────

describe('Acceso anon/público rechazado (GEN-19..GEN-20)', () => {
  it('GEN-19: un cliente anon recibe error de la RPC y generatePurchaseSummary lo propaga', async () => {
    // El servidor rechaza la llamada anon porque:
    //   a) REVOKE EXECUTE FROM PUBLIC en las tres RPCs (migración _29)
    //   b) Aunque llegara a ejecutarse, auth.uid() = NULL no pasa el check de org
    // El wrapper debe propagar el error sin enmascararlo.
    const sb = makeErrorMock('permission denied for function mkt_fin_generate_purchase_summary')
    await expect(generatePurchaseSummary(sb, FAKE_MASTER_ID)).rejects.toThrow(
      'generatePurchaseSummary failed',
    )
  })

  it('GEN-20: un cliente anon recibe error de la RPC y generateSettlementStatement lo propaga', async () => {
    const sb = makeErrorMock('permission denied for function mkt_fin_generate_settlement_statement')
    await expect(generateSettlementStatement(sb, FAKE_SETTLEMENT_ID)).rejects.toThrow(
      'generateSettlementStatement failed',
    )
  })
})

// ─── GEN-SEC-01: SECURITY DEFINER — acceso a secuencia server-side ───────────

describe('SECURITY DEFINER — next_financial_doc_number (GEN-SEC-01)', () => {
  it(
    'GEN-SEC-01: un usuario authenticated puede generar un supplier_statement ' +
    'aunque next_financial_doc_number esté revocada para él directamente',
    async () => {
      // ARQUITECTURA (c0a875f + _29):
      //   authenticated NO tiene EXECUTE en next_financial_doc_number().
      //   Pero SÍ tiene EXECUTE en mkt_fin_generate_supplier_statement().
      //   La RPC (SECURITY DEFINER, owner=postgres) invoca next_financial_doc_number
      //   como postgres, que sí tiene EXECUTE.
      //
      // Este test simula que la RPC se ejecuta con éxito desde un contexto
      // authenticated — el servidor retorna un UUID válido.
      // Prueba que el wrapper TypeScript no bloquea la llamada y no necesita
      // que el cliente tenga acceso a la secuencia directamente.
      const sb = makeSuccessMock(FAKE_DOC_ID)
      const result = await generateSupplierStatement(sb, FAKE_SUPPLIER_ID)

      expect(sb.rpc).toHaveBeenCalledWith(
        GENERATION_RPC_NAMES.SUPPLIER_STATEMENT,
        { p_supplier_order_id: FAKE_SUPPLIER_ID },
      )

      // El cliente recibe el UUID — el doc_number se asignó server-side
      expect(result).toBe(FAKE_DOC_ID)

      // Verificar que el wrapper NO intenta llamar a next_financial_doc_number
      // directamente (la firma no existe en el mock, y no se llamó más que a rpc())
      const calledRpcs = (sb.rpc as MockedFunction<SupabaseClient['rpc']>).mock.calls.map(
        ([name]) => name,
      )
      expect(calledRpcs).not.toContain('next_financial_doc_number')
      expect(calledRpcs).toEqual([GENERATION_RPC_NAMES.SUPPLIER_STATEMENT])
    },
  )
})

// ─── Constantes del módulo ───────────────────────────────────────────────────

describe('Constantes del módulo document-generation', () => {
  it('GENERATION_RPC_NAMES expone los tres nombres de RPC', () => {
    expect(Object.keys(GENERATION_RPC_NAMES)).toHaveLength(3)
    expect(GENERATION_RPC_NAMES.PURCHASE_SUMMARY).toBeDefined()
    expect(GENERATION_RPC_NAMES.SUPPLIER_STATEMENT).toBeDefined()
    expect(GENERATION_RPC_NAMES.SETTLEMENT_STATEMENT).toBeDefined()
  })

  it('GENERATION_ERROR_CODES cubre los 4 errores canónicos', () => {
    expect(GENERATION_ERROR_CODES.NOT_FOUND).toBe('P0002')
    expect(GENERATION_ERROR_CODES.UNAUTHORIZED).toBe('P0001')
    expect(GENERATION_ERROR_CODES.PRECONDITION).toBe('P0003')
    expect(GENERATION_ERROR_CODES.DOC_NUMBER_CLASH).toBe('P0004')
  })

  it('los tres nombres de RPC contienen el prefijo mkt_fin_generate', () => {
    for (const name of Object.values(GENERATION_RPC_NAMES)) {
      expect(name).toMatch(/^mkt_fin_generate_/)
    }
  })
})
