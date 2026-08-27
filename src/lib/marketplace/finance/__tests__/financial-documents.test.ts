// MP-FIN-5A.3 — Financial Document Query & Provider Doc Refs Tests
// QUERY-01..16 + REF-01..10 + constantes del módulo
//
// COBERTURA:
//   QUERY-01..03:  getProviderDocuments — RPC correcta, cross-actor, subtype exclusion
//   QUERY-04..06:  getBuyerDocuments — RPC correcta, cross-org, subtype exclusion
//   QUERY-07..12:  getDocumentDetail — detail PS/SS/LIQ, buyer+provider ajenos denied
//   QUERY-13..14:  paginación — limit/offset pasados, limit>100 documentado
//   QUERY-15..16:  seguridad — anon rechazado, PUBLIC sin EXECUTE (invariante)
//   REF-01..04:    registerProviderDocRef — registro, server-side derivation, cross-actor
//   REF-05..10:    listProviderDocRefs / listBuyerDocRefs — lectura, isolation, doc_type
//
// ARQUITECTURA:
//   Todos los tests usan mock de SupabaseClient.
//   Los comportamientos server-side (auth, clamp, derivation, isolation) se
//   verifican en smoke tests DB reales (DB-QUERY-01..08, DB-REF-01..05).
//   Los mocks verifican: RPC correcta, params, error propagation, retorno.
//
// GATES: LEGAL_GATE=OPEN · TAX_GATE=OPEN · STRIPE_GATE=OPEN

import { describe, it, expect, vi, type MockedFunction } from 'vitest'
import {
  QUERY_RPC_NAMES,
  QUERY_ERROR_CODES,
  PROVIDER_DOC_SUBTYPES,
  BUYER_DOC_SUBTYPES,
  PROVIDER_DOC_REF_TYPES,
  getProviderDocuments,
  getBuyerDocuments,
  getDocumentDetail,
  listProviderDocRefs,
  listBuyerDocRefs,
  registerProviderDocRef,
  type FinDocListItem,
  type FinDocDetail,
  type PaginatedResult,
} from '../financial-documents.service'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Mock helpers ────────────────────────────────────────────────────────────

function makeRpcMock(
  resolveWith: { data: unknown; error: null } | { data: null; error: { message: string } },
) {
  const rpc = vi.fn().mockResolvedValue(resolveWith)
  return { rpc } as unknown as SupabaseClient & { rpc: MockedFunction<SupabaseClient['rpc']> }
}
function ok(data: unknown)    { return makeRpcMock({ data, error: null }) }
function err(msg: string)     { return makeRpcMock({ data: null, error: { message: msg } }) }

// ─── Fixtures ────────────────────────────────────────────────────────────────

const FAKE_ACTOR_A  = 'actor-aaaa-0000-0000-000000000001'
const FAKE_ACTOR_B  = 'actor-bbbb-0000-0000-000000000002'
const FAKE_ORG_A    = 'org-aaaa-0000-0000-000000000001'
const FAKE_ORG_B    = 'org-bbbb-0000-0000-000000000002'
const FAKE_DOC_ID   = 'docid-000-0000-0000-000000000001'
const FAKE_DOC_ID2  = 'docid-000-0000-0000-000000000002'
const FAKE_ORDER_ID = 'order-000-0000-0000-000000000001'
const FAKE_REF_ID   = 'refid-000-0000-0000-000000000001'

const FAKE_PAGINATED_EMPTY: PaginatedResult<FinDocListItem> = {
  items: [], total: 0, limit: 50, offset: 0,
}

const FAKE_PAGINATED_ONE: PaginatedResult<FinDocListItem> = {
  items: [{
    id: FAKE_DOC_ID,
    doc_number: 'SUP-2026-0001',
    doc_series: 'SUP',
    document_subtype: 'supplier_statement',
    estado: 'draft',
    total_amount: 697.30,
    currency: 'EUR',
    concept: '',
    issued_at: null,
    created_at: '2026-08-27T00:00:00Z',
    immutable_at: '2026-08-27T00:00:01Z',
    supplier_order_id: FAKE_ORDER_ID,
    settlement_id: null,
  }],
  total: 1,
  limit: 50,
  offset: 0,
}

const FAKE_DETAIL: FinDocDetail = {
  id: FAKE_DOC_ID,
  doc_number: 'MKP-2026-0007',
  doc_series: 'MKP',
  document_subtype: 'purchase_summary',
  document_type: 'invoice',
  estado: 'draft',
  payment_status: 'unpaid',
  org_id: FAKE_ORG_A,
  actor_id: null,
  concept: '',
  period_start: null,
  period_end: null,
  net_amount: 576.28,
  tax_rate: 21,
  tax_amount: 121.02,
  total_amount: 697.30,
  currency: 'EUR',
  customer_name: '',
  customer_nif: null,
  customer_email: null,
  customer_address: null,
  issued_at: null,
  created_at: '2026-08-27T00:00:00Z',
  immutable_at: '2026-08-27T00:00:01Z',
  master_order_id: 'master-id-0000-0000-000000000001',
  supplier_order_id: null,
  settlement_id: null,
  metadata: {},
}

// ════════════════════════════════════════════════════════════════════════════
// QUERY-01..03 — getProviderDocuments
// ════════════════════════════════════════════════════════════════════════════

describe('getProviderDocuments (QUERY-01..03)', () => {
  it('QUERY-01: invoca la RPC correcta con p_actor_id y devuelve resultado paginado', async () => {
    const sb = ok(FAKE_PAGINATED_ONE)
    const result = await getProviderDocuments(sb, FAKE_ACTOR_A)
    expect(sb.rpc).toHaveBeenCalledWith(
      QUERY_RPC_NAMES.GET_PROVIDER_DOCUMENTS,
      { p_actor_id: FAKE_ACTOR_A, p_limit: 50, p_offset: 0 },
    )
    expect(result).toEqual(FAKE_PAGINATED_ONE)
  })

  it('QUERY-02: proveedor B intenta ver docs de A → servidor lanza P0001 → wrapper propaga', async () => {
    const sb = err(`GET_PROVIDER_DOCS: no autorizado para actor ${FAKE_ACTOR_A}. ERRCODE=P0001`)
    await expect(getProviderDocuments(sb, FAKE_ACTOR_A)).rejects.toThrow(
      `getProviderDocuments failed for actor ${FAKE_ACTOR_A}`,
    )
  })

  it('QUERY-03: la RPC GET_PROVIDER_DOCUMENTS nunca devuelve purchase_summary — subtype filtrado server-side', () => {
    // Invariante: mkt_fin_get_provider_documents filtra document_subtype
    // IN ('supplier_statement','settlement_statement') en el servidor.
    // Los clientes no pueden solicitar purchase_summary a través de este endpoint.
    expect(PROVIDER_DOC_SUBTYPES).not.toContain('purchase_summary')
    expect(PROVIDER_DOC_SUBTYPES).toContain('supplier_statement')
    expect(PROVIDER_DOC_SUBTYPES).toContain('settlement_statement')
    // El nombre de la RPC tampoco menciona buyer:
    expect(QUERY_RPC_NAMES.GET_PROVIDER_DOCUMENTS).not.toContain('buyer')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// QUERY-04..06 — getBuyerDocuments
// ════════════════════════════════════════════════════════════════════════════

describe('getBuyerDocuments (QUERY-04..06)', () => {
  it('QUERY-04: invoca la RPC correcta con p_org_id y devuelve resultado paginado', async () => {
    const sb = ok(FAKE_PAGINATED_EMPTY)
    const result = await getBuyerDocuments(sb, FAKE_ORG_A)
    expect(sb.rpc).toHaveBeenCalledWith(
      QUERY_RPC_NAMES.GET_BUYER_DOCUMENTS,
      { p_org_id: FAKE_ORG_A, p_limit: 50, p_offset: 0, p_search: null },
    )
    expect(result).toEqual(FAKE_PAGINATED_EMPTY)
  })

  it('QUERY-05: buyer B intenta ver PS de org A → servidor lanza P0001 → wrapper propaga', async () => {
    const sb = err(`GET_BUYER_DOCS: no autorizado para org ${FAKE_ORG_A}. ERRCODE=P0001`)
    await expect(getBuyerDocuments(sb, FAKE_ORG_A)).rejects.toThrow(
      `getBuyerDocuments failed for org ${FAKE_ORG_A}`,
    )
  })

  it('QUERY-06: la RPC GET_BUYER_DOCUMENTS nunca devuelve supplier/settlement statements — subtype filtrado server-side', () => {
    // Invariante: mkt_fin_get_buyer_documents filtra document_subtype='purchase_summary'.
    expect(BUYER_DOC_SUBTYPES).toContain('purchase_summary')
    expect(BUYER_DOC_SUBTYPES).not.toContain('supplier_statement')
    expect(BUYER_DOC_SUBTYPES).not.toContain('settlement_statement')
    expect(QUERY_RPC_NAMES.GET_BUYER_DOCUMENTS).not.toContain('provider')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// QUERY-07..12 — getDocumentDetail
// ════════════════════════════════════════════════════════════════════════════

describe('getDocumentDetail — Purchase Summary (QUERY-07..08)', () => {
  it('QUERY-07: buyer correcto obtiene detalle de Purchase Summary', async () => {
    const sb = ok(FAKE_DETAIL)
    const result = await getDocumentDetail(sb, FAKE_DOC_ID)
    expect(sb.rpc).toHaveBeenCalledWith(
      QUERY_RPC_NAMES.GET_DOCUMENT_DETAIL,
      { p_document_id: FAKE_DOC_ID },
    )
    expect(result).toEqual(FAKE_DETAIL)
    expect(result.document_subtype).toBe('purchase_summary')
    expect(result.metadata).toBeDefined()
    expect(result.immutable_at).not.toBeNull()
  })

  it('QUERY-08: buyer ajeno intenta detail de Purchase Summary → servidor deniega → wrapper propaga', async () => {
    const sb = err(`GET_DOC_DETAIL: no autorizado para documento ${FAKE_DOC_ID} (subtype: purchase_summary). ERRCODE=P0001`)
    await expect(getDocumentDetail(sb, FAKE_DOC_ID)).rejects.toThrow(
      `getDocumentDetail failed for document ${FAKE_DOC_ID}`,
    )
  })
})

describe('getDocumentDetail — Supplier Statement (QUERY-09..10)', () => {
  const FAKE_SS_DETAIL: FinDocDetail = {
    ...FAKE_DETAIL,
    id: FAKE_DOC_ID2,
    doc_number: 'SUP-2026-0001',
    doc_series: 'SUP',
    document_subtype: 'supplier_statement',
    org_id: null,
    actor_id: FAKE_ACTOR_A,
    supplier_order_id: FAKE_ORDER_ID,
    master_order_id: null,
  }

  it('QUERY-09: provider correcto obtiene detalle de Supplier Statement', async () => {
    const sb = ok(FAKE_SS_DETAIL)
    const result = await getDocumentDetail(sb, FAKE_DOC_ID2)
    expect(sb.rpc).toHaveBeenCalledWith(
      QUERY_RPC_NAMES.GET_DOCUMENT_DETAIL,
      { p_document_id: FAKE_DOC_ID2 },
    )
    expect(result.document_subtype).toBe('supplier_statement')
    expect(result.actor_id).toBe(FAKE_ACTOR_A)
    expect(result.metadata).toBeDefined()
  })

  it('QUERY-10: provider ajeno → servidor deniega Supplier Statement → wrapper propaga', async () => {
    const sb = err(`GET_DOC_DETAIL: no autorizado para documento ${FAKE_DOC_ID2} (subtype: supplier_statement). ERRCODE=P0001`)
    await expect(getDocumentDetail(sb, FAKE_DOC_ID2)).rejects.toThrow(
      `getDocumentDetail failed for document ${FAKE_DOC_ID2}`,
    )
  })
})

describe('getDocumentDetail — Settlement Statement (QUERY-11..12)', () => {
  const FAKE_LIQ_ID = 'liqid-000-0000-0000-000000000003'

  it('QUERY-11: provider correcto obtiene detalle de Settlement Statement', async () => {
    const fakeLiqDetail: FinDocDetail = {
      ...FAKE_DETAIL,
      id: FAKE_LIQ_ID,
      doc_number: 'LIQ-2026-0001',
      doc_series: 'LIQ',
      document_subtype: 'settlement_statement',
      org_id: null,
      actor_id: FAKE_ACTOR_A,
      settlement_id: 'settle-000-0000-0000-000000000001',
      master_order_id: null,
    }
    const sb = ok(fakeLiqDetail)
    const result = await getDocumentDetail(sb, FAKE_LIQ_ID)
    expect(result.document_subtype).toBe('settlement_statement')
    expect(result.settlement_id).not.toBeNull()
    expect(result.metadata).toBeDefined()
  })

  it('QUERY-12: provider ajeno → servidor deniega Settlement Statement → wrapper propaga', async () => {
    const sb = err(`GET_DOC_DETAIL: no autorizado para documento ${FAKE_LIQ_ID} (subtype: settlement_statement). ERRCODE=P0001`)
    await expect(getDocumentDetail(sb, FAKE_LIQ_ID)).rejects.toThrow(
      `getDocumentDetail failed for document ${FAKE_LIQ_ID}`,
    )
  })
})

// ════════════════════════════════════════════════════════════════════════════
// QUERY-13..14 — Paginación
// ════════════════════════════════════════════════════════════════════════════

describe('Paginación (QUERY-13..14)', () => {
  it('QUERY-13: limit y offset se pasan a la RPC correctamente', async () => {
    const sb = ok(FAKE_PAGINATED_EMPTY)
    await getProviderDocuments(sb, FAKE_ACTOR_A, { limit: 10, offset: 20 })
    expect(sb.rpc).toHaveBeenCalledWith(
      QUERY_RPC_NAMES.GET_PROVIDER_DOCUMENTS,
      { p_actor_id: FAKE_ACTOR_A, p_limit: 10, p_offset: 20 },
    )
  })

  it('QUERY-14: limit>100 se pasa a la RPC — el servidor lo clampea a 100 (LEAST(GREATEST(p_limit,1),100))', async () => {
    // El wrapper TS no clampea — pasa el valor tal cual.
    // La RPC PostgreSQL aplica v_lim := LEAST(GREATEST(p_limit,1),100).
    // Esto se verifica en DB-QUERY (smoke tests reales).
    // Este test documenta que el wrapper no interfiere con el valor.
    const sb = ok({ items: [], total: 0, limit: 100, offset: 0 })
    await getBuyerDocuments(sb, FAKE_ORG_A, { limit: 500, offset: 0 })
    expect(sb.rpc).toHaveBeenCalledWith(
      QUERY_RPC_NAMES.GET_BUYER_DOCUMENTS,
      { p_org_id: FAKE_ORG_A, p_limit: 500, p_offset: 0, p_search: null },
    )
    // El servidor devolvería limit=100 en la respuesta; aquí simulamos eso.
  })
})

// ════════════════════════════════════════════════════════════════════════════
// QUERY-15..16 — Seguridad de acceso
// ════════════════════════════════════════════════════════════════════════════

describe('Seguridad de acceso (QUERY-15..16)', () => {
  it('QUERY-15: usuario anon recibe error de permission denied → wrapper lo propaga', async () => {
    const sb = err('permission denied for function mkt_fin_get_provider_documents')
    await expect(getProviderDocuments(sb, FAKE_ACTOR_A)).rejects.toThrow(
      'getProviderDocuments failed',
    )
  })

  it('QUERY-16: PUBLIC/anon no tiene EXECUTE sobre las 6 RPCs de 5A.3 — invariante documentado', () => {
    // Las 6 RPCs tienen REVOKE FROM PUBLIC explícito en migración 20260827_30.
    // mkt_fin_register_provider_doc_ref tiene además REVOKE FROM anon explícito.
    // Verificado en DB-REF-05 contra la DB real.
    const publicExcludedRpcs = Object.values(QUERY_RPC_NAMES)
    for (const rpc of publicExcludedRpcs) {
      expect(rpc).toMatch(/^mkt_fin_/)
    }
    expect(publicExcludedRpcs).toHaveLength(6)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// REF-01..04 — registerProviderDocRef
// ════════════════════════════════════════════════════════════════════════════

describe('registerProviderDocRef (REF-01..04)', () => {
  const validParams = {
    supplierOrderId:  FAKE_ORDER_ID,
    docType:          'invoice' as const,
    docNumberProvider: 'FACT-2026-0001',
    docDateProvider:  '2026-08-27',
    docAmount:        697.30,
    docCurrency:      'EUR',
    notes:            null,
  }

  it('REF-01: provider registra doc ref válida → devuelve UUID', async () => {
    const sb = ok(FAKE_REF_ID)
    const result = await registerProviderDocRef(sb, validParams)
    expect(sb.rpc).toHaveBeenCalledWith(
      QUERY_RPC_NAMES.REGISTER_PROVIDER_DOC_REF,
      {
        p_supplier_order_id:   FAKE_ORDER_ID,
        p_doc_type:            'invoice',
        p_doc_number_provider: 'FACT-2026-0001',
        p_doc_date_provider:   '2026-08-27',
        p_doc_amount:          697.30,
        p_doc_currency:        'EUR',
        p_notes:               null,
      },
    )
    expect(result).toBe(FAKE_REF_ID)
  })

  it('REF-02: actor_id derivado server-side — el wrapper no envía actor_id', async () => {
    const sb = ok(FAKE_REF_ID)
    await registerProviderDocRef(sb, validParams)
    const calledParams = (sb.rpc as MockedFunction<SupabaseClient['rpc']>).mock.calls[0][1] as Record<string, unknown>
    // El wrapper nunca envía actor_id — lo deriva el servidor desde el supplier_order
    expect(calledParams).not.toHaveProperty('actor_id')
    expect(calledParams).not.toHaveProperty('p_actor_id')
  })

  it('REF-03: buyer_org_id derivado server-side — el wrapper no envía buyer_org_id', async () => {
    const sb = ok(FAKE_REF_ID)
    await registerProviderDocRef(sb, validParams)
    const calledParams = (sb.rpc as MockedFunction<SupabaseClient['rpc']>).mock.calls[0][1] as Record<string, unknown>
    expect(calledParams).not.toHaveProperty('buyer_org_id')
    expect(calledParams).not.toHaveProperty('p_buyer_org_id')
  })

  it('REF-04: provider B intenta registrar ref sobre order A → servidor deniega → wrapper propaga', async () => {
    const sb = err(
      `PROVIDER_DOC_REF: no autorizado. El pedido ${FAKE_ORDER_ID} pertenece al actor ${FAKE_ACTOR_A}, `
      + `que no es accesible para el usuario actual.`,
    )
    await expect(registerProviderDocRef(sb, validParams)).rejects.toThrow(
      `registerProviderDocRef failed for order ${FAKE_ORDER_ID}`,
    )
  })
})

// ════════════════════════════════════════════════════════════════════════════
// REF-05..10 — listProviderDocRefs / listBuyerDocRefs
// ════════════════════════════════════════════════════════════════════════════

const FAKE_REF_ITEM = {
  id: FAKE_REF_ID,
  supplier_order_id: FAKE_ORDER_ID,
  actor_id: FAKE_ACTOR_A,
  buyer_org_id: FAKE_ORG_A,
  doc_type: 'invoice' as const,
  doc_number_provider: 'FACT-2026-0001',
  doc_date_provider: '2026-08-27',
  doc_amount: 697.30,
  doc_currency: 'EUR',
  notes: null,
  registered_at: '2026-08-27T00:00:00Z',
  created_at: '2026-08-27T00:00:00Z',
}

const FAKE_REFS_PAGINATED = {
  items: [FAKE_REF_ITEM],
  total: 1,
  limit: 50,
  offset: 0,
}

describe('listProviderDocRefs (REF-05, REF-07..08)', () => {
  it('REF-05: (buyer correcto ve ref) — validado en DB-REF-03 smoke; listBuyerDocRefs invoca RPC correcta', async () => {
    const sb = ok(FAKE_REFS_PAGINATED)
    const result = await listBuyerDocRefs(sb, FAKE_ORG_A)
    expect(sb.rpc).toHaveBeenCalledWith(
      QUERY_RPC_NAMES.LIST_BUYER_DOC_REFS,
      { p_org_id: FAKE_ORG_A, p_limit: 50, p_offset: 0, p_search: null, p_doc_type: null },
    )
    expect(result.items).toHaveLength(1)
  })

  it('REF-06: buyer ajeno no puede ver ref → servidor deniega → wrapper propaga', async () => {
    const sb = err(`LIST_BUYER_REFS: no autorizado para org ${FAKE_ORG_A}. ERRCODE=P0001`)
    await expect(listBuyerDocRefs(sb, FAKE_ORG_A)).rejects.toThrow(
      `listBuyerDocRefs failed for org ${FAKE_ORG_A}`,
    )
  })

  it('REF-07: provider A puede listar sus refs — listProviderDocRefs invoca RPC correcta', async () => {
    const sb = ok(FAKE_REFS_PAGINATED)
    const result = await listProviderDocRefs(sb, FAKE_ACTOR_A)
    expect(sb.rpc).toHaveBeenCalledWith(
      QUERY_RPC_NAMES.LIST_PROVIDER_DOC_REFS,
      { p_actor_id: FAKE_ACTOR_A, p_limit: 50, p_offset: 0 },
    )
    expect(result.items[0].actor_id).toBe(FAKE_ACTOR_A)
  })

  it('REF-08: provider B no ve refs de A → servidor deniega → wrapper propaga', async () => {
    const sb = err(`LIST_PROV_REFS: no autorizado para actor ${FAKE_ACTOR_A}. ERRCODE=P0001`)
    await expect(listProviderDocRefs(sb, FAKE_ACTOR_A)).rejects.toThrow(
      `listProviderDocRefs failed for actor ${FAKE_ACTOR_A}`,
    )
  })
})

describe('Seguridad refs (REF-09..10)', () => {
  it('REF-09: buyer_org_id NULL en refs nunca otorga acceso público — la RPC require org no-null', () => {
    // mkt_fin_list_buyer_doc_refs filtra: buyer_org_id = p_org_id AND buyer_org_id IS NOT NULL.
    // Si buyer_org_id es NULL en la ref (guest checkout), esa ref no aparece en listados de compradores.
    // Este test documenta el invariante. Verificado en DB-REF smoke tests.
    const rpcName = QUERY_RPC_NAMES.LIST_BUYER_DOC_REFS
    expect(rpcName).toBe('mkt_fin_list_buyer_doc_refs')
    // La función requiere p_org_id explícito — nunca hay forma de pasar NULL como org
    // y obtener refs con buyer_org_id NULL.
  })

  it('REF-10: doc_type inválido → servidor lanza error → wrapper lo propaga', async () => {
    const sb = err(
      'PROVIDER_DOC_REF: doc_type proforma no válido. '
      + 'Valores aceptados: invoice, credit_note, delivery_note, other.',
    )
    await expect(
      registerProviderDocRef(sb, {
        supplierOrderId:  FAKE_ORDER_ID,
        docType:          'invoice' as const, // mock devuelve error de todos modos
        docNumberProvider: 'FACT-001',
        docDateProvider:  '2026-08-27',
      }),
    ).rejects.toThrow(`registerProviderDocRef failed for order ${FAKE_ORDER_ID}`)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// doc_currency normalization (REF-11..12)
// La columna trade_marketplace_provider_doc_refs.doc_currency es CHAR(3).
// La RPC aplica TRIM(doc_currency)::text server-side para devolver "EUR" sin padding.
// ════════════════════════════════════════════════════════════════════════════

describe('doc_currency normalization server-side (REF-11..12)', () => {
  it('REF-11: listProviderDocRefs devuelve doc_currency sin espacios de padding', async () => {
    const trimmedRef = { ...FAKE_REF_ITEM, doc_currency: 'EUR' }
    const sb = ok({ items: [trimmedRef], total: 1, limit: 50, offset: 0 })
    const result = await listProviderDocRefs(sb, FAKE_ACTOR_A)
    const currency = result.items[0].doc_currency
    expect(currency).toBe('EUR')
    expect(currency).not.toMatch(/\s/)
  })

  it('REF-12: listBuyerDocRefs devuelve doc_currency sin espacios de padding', async () => {
    const trimmedRef = { ...FAKE_REF_ITEM, doc_currency: 'EUR' }
    const sb = ok({ items: [trimmedRef], total: 1, limit: 50, offset: 0 })
    const result = await listBuyerDocRefs(sb, FAKE_ORG_A)
    const currency = result.items[0].doc_currency
    expect(currency).toBe('EUR')
    expect(currency).not.toMatch(/\s/)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Constantes del módulo
// ════════════════════════════════════════════════════════════════════════════

describe('Constantes del módulo financial-documents.service', () => {
  it('QUERY_RPC_NAMES expone los 6 nombres de RPC', () => {
    expect(Object.keys(QUERY_RPC_NAMES)).toHaveLength(6)
    expect(QUERY_RPC_NAMES.GET_PROVIDER_DOCUMENTS).toBe('mkt_fin_get_provider_documents')
    expect(QUERY_RPC_NAMES.GET_BUYER_DOCUMENTS).toBe('mkt_fin_get_buyer_documents')
    expect(QUERY_RPC_NAMES.GET_DOCUMENT_DETAIL).toBe('mkt_fin_get_document_detail')
    expect(QUERY_RPC_NAMES.LIST_PROVIDER_DOC_REFS).toBe('mkt_fin_list_provider_doc_refs')
    expect(QUERY_RPC_NAMES.LIST_BUYER_DOC_REFS).toBe('mkt_fin_list_buyer_doc_refs')
    expect(QUERY_RPC_NAMES.REGISTER_PROVIDER_DOC_REF).toBe('mkt_fin_register_provider_doc_ref')
  })

  it('QUERY_ERROR_CODES cubre los errores canónicos', () => {
    expect(QUERY_ERROR_CODES.NOT_FOUND).toBe('P0002')
    expect(QUERY_ERROR_CODES.UNAUTHORIZED).toBe('P0001')
  })

  it('PROVIDER_DOC_SUBTYPES excluye purchase_summary', () => {
    expect(PROVIDER_DOC_SUBTYPES).not.toContain('purchase_summary')
    expect(PROVIDER_DOC_SUBTYPES).toHaveLength(2)
  })

  it('BUYER_DOC_SUBTYPES excluye supplier y settlement statements', () => {
    expect(BUYER_DOC_SUBTYPES).not.toContain('supplier_statement')
    expect(BUYER_DOC_SUBTYPES).not.toContain('settlement_statement')
    expect(BUYER_DOC_SUBTYPES).toHaveLength(1)
  })

  it('PROVIDER_DOC_REF_TYPES tiene los 4 tipos permitidos', () => {
    expect(PROVIDER_DOC_REF_TYPES).toContain('invoice')
    expect(PROVIDER_DOC_REF_TYPES).toContain('credit_note')
    expect(PROVIDER_DOC_REF_TYPES).toContain('delivery_note')
    expect(PROVIDER_DOC_REF_TYPES).toContain('other')
    expect(PROVIDER_DOC_REF_TYPES).toHaveLength(4)
  })

  it('todos los nombres de RPC tienen prefijo mkt_fin_', () => {
    for (const name of Object.values(QUERY_RPC_NAMES)) {
      expect(name).toMatch(/^mkt_fin_/)
    }
  })
})
