# Marketplace Finance — Implementation Status

> **Documento vivo.** Actualizar tras cada fase.  
> **Regla:** Una fase no se marca COMPLETED hasta que compile, pase tests y esté verificada en entorno de desarrollo.  
> **Última actualización:** 2026-08-21

---

## Estado actual de fases

| Fase | Nombre | Estado | Fecha inicio | Fecha cierre |
|---|---|---|---|---|
| **M0-A** | Normalización y análisis documental | ✅ CLOSED | 2026-08-20 | 2026-08-20 |
| **M0-B** | Envío a asesor jurídico | ⏳ PENDIENTE | — | — |
| **M0-C** | Envío a asesor fiscal | ⏳ PENDIENTE | — | — |
| **M0-D** | Architecture Freeze | 🔒 BLOQUEADO | — | — |
| **MP-FIN-0** | Auditoría | ✅ CLOSED | 2026-08-21 | 2026-08-21 |
| **MP-FIN-1A** | Cimentación financiera neutral (DB + Types + Services) | ✅ VALIDATED | 2026-08-21 | 2026-08-21 |
| **MP-FIN-1B.1** | Master Order + Snapshots (sin ledger, sin pago sim) | ⏳ PRÓXIMO | — | — |
| **MP-FIN-1B.2** | Sim events + ledger (requiere aprobación tras 1B.1) | 🔒 BLOQUEADO (1B.1) | — | — |
| **MP-FIN-2** | Simulation Engine | 🔒 BLOQUEADO (MP-FIN-1B) | — | — |
| **MP-FIN-3** | Admin Finance Panel | 🔒 BLOQUEADO (MP-FIN-2) | — | — |
| **MP-FIN-4** | Provider Finance Panel | 🔒 BLOQUEADO (MP-FIN-2) | — | — |
| **MP-FIN-5** | Documents | 🔒 BLOQUEADO (MP-FIN-4) | — | — |
| **MP-FIN-6** | Reconciliation Layer | 🔒 BLOQUEADO (MP-FIN-5) | — | — |
| **MP-FIN-7** | Stripe Sandbox | 🚫 NO INICIAR sin autorización explícita | — | — |

---

## MP-FIN-0 — Auditoría ✅ CLOSED

**Entregables:**
- [x] `IMPLEMENTATION_AUDIT.md` — Audit completo AS-IS vs TO-BE
- [x] `IMPLEMENTATION_STATUS.md` — Este documento

**Hallazgos clave:**
- Carrito + pedidos logísticos operativos en producción (base sólida reutilizable)
- Cero infraestructura financiera de plataforma (ledger, settlements, comisiones, balances)
- `trade_marketplace_orders` es el supplier_order actual; falta `trade_marketplace_master_orders`
- `checkout_key` existente permite identificar pedidos del mismo checkout
- `trade_financial_documents` tiene `revenue_type='marketplace'` pero sin flujo de pagos marketplace
- Stripe solo implementado para SaaS (patrón HMAC reutilizable para marketplace)
- Sin feature flags formales
- Sin tests para lógica de checkout ni ciclo de vida de pedidos

---

## M0-B — Envío a asesor jurídico ⏳ PENDIENTE

**Acción requerida:** Fernando debe enviar `MARKETPLACE_LEGAL_QUESTIONS.md` al asesor jurídico.

**Preguntas pendientes de respuesta (L1-L11):**

| Ref | Pregunta |
|---|---|
| L1 | Rol jurídico de TrabFlow: ¿agente, intermediario, MoR, otro? |
| L2 | ¿Compatible pago único + supplier = seller legal? |
| L3 | ¿PSD2 genera obligaciones? ¿Necesita licencia? |
| L4 | Stripe Connect Separate Charges and Transfers: ¿viable jurídicamente? |
| L5 | Hold period T+7: ¿límites legales sobre retención de fondos? |
| L6 | Segregación de fondos: ¿requisito formal? |
| L7 | Compensación saldos negativos: ¿permitida contractualmente? |
| L8 | MKP sin factura fiscal: ¿disclaimer suficiente? |
| L9 | Chargebacks: responsabilidad contractual del proveedor |
| L10 | T&C, contrato proveedor, política privacidad: mínimos legales |
| L11 | DAC7 (RD 1007/2023): ¿aplica a TrabFlow? |

**Respuestas recibidas hasta la fecha:**
- Respuestas preliminares en `TF_LEGAL_Respuestas_Preliminares_Marketplace_v1.0.docx`
- Estado: no completamente resueltas; insuficiente para Architecture Freeze

---

## M0-C — Envío a asesor fiscal ⏳ PENDIENTE

**Acción requerida:** Fernando debe enviar `MARKETPLACE_TAX_QUESTIONS.md` al asesor fiscal.

**Preguntas pendientes de respuesta (T1-T14):**

| Ref | Pregunta |
|---|---|
| T1 | Cadena de facturación de materiales: ¿quién emite qué? |
| T2 | Tipo IVA mercancía por categoría |
| T3 | Tipo IVA shipping |
| T4 | Base imponible de la comisión TrabFlow |
| T5 | IVA de la comisión TrabFlow: ¿21%, exención, otro? |
| T6 | Opción A vs B deducción comisión |
| T7 | ¿Factura mensual consolidada MKC válida? |
| T8 | Refund cross-period: RC vs ajuste en factura siguiente |
| T9 | Chargebacks: tratamiento fiscal para TrabFlow |
| T10 | MKP: qué no debe incluir para no ser factura |
| T11 | GMV vs Revenue: cómo contabilizar |
| T12 | PSP fees: ¿deducibles? |
| T13 | Facturae electrónica: ¿cuándo aplica? |
| T14 | DAC7: obligaciones de reporting y calendario |

---

## M0-D — Architecture Freeze 🔒 BLOQUEADO

**Desbloqueado cuando:**
- [ ] G-LEGAL-1 — Dictamen jurídico L1-L4 respondidas
- [ ] G-TAX-1 — Dictamen fiscal T4-T7 respondidas
- [ ] Rol jurídico TrabFlow determinado
- [ ] Arquitectura PSP candidata validada jurídicamente (L4)
- [ ] Opción A vs B comisión decidida (T6)
- [ ] Coste PSP efectivo estimado (G-PSP-1 iniciado)
- [ ] Data Model definitivo revisado con respuestas de asesores
- [ ] Contrato tipo proveedor redactado
- [ ] **APROBACIÓN EXPLÍCITA DE FERNANDO**

**Hasta M0-D aprobado: NO comenzar MP-FIN-2 ni ninguna fase que dependa de decisiones jurídico-fiscales.**

---

## MP-FIN-1A — Cimentación financiera neutral ✅ VALIDATED

> Infraestructura de datos y servicios sin dinero real ni compromisos jurídicos/fiscales.  
> Aprobada explícitamente por Fernando para avanzar independientemente de M0-D.  
> Cerrada: 2026-08-21. **Validación cloud: 2026-08-21.**

### Validación Cloud (Supabase dqqjaujnulutinskmqsu — eu-central-1)

**Migraciones aplicadas en cloud:**

| # | Migración | Estado | Verificación |
|---|---|---|---|
| 1 | `20260821_01_mkt_fin_financial_config` | ✅ | 14 config keys correctas |
| 2 | `20260821_02_mkt_fin_commission_policies` | ✅ | rate=0.0000, enabled=false |
| 3 | `20260821_03_mkt_fin_master_orders` | ✅ | Tabla + constraints + trigger numero |
| 4 | `20260821_04_mkt_fin_extend_supplier_orders` | ✅ (bug sim_commission_gross corregido) | 12 columnas verificadas |
| 5 | `20260821_05_mkt_fin_extend_order_items` | ✅ | 5 columnas verificadas |
| 6 | `20260821_06_mkt_fin_ledger_entries` | ✅ | 20 cols, 2 triggers inmutabilidad |
| 7 | `20260821_07_mkt_fin_audit_outbox` | ✅ | 11 triggers financieros verificados |
| 8 | `20260821_08_mkt_fin_rls_indexes` | ✅ | 4 índices + 3 funciones admin/proveedor |

**Config inicial (gates todos cerrados):**

| Key | Valor | Gate |
|---|---|---|
| `payment.mode` | `"simulation"` | ✅ |
| `payment.real_payments_enabled` | `false` | STRIPE_GATE bloqueado ✅ |
| `payment.stripe_connect_enabled` | `false` | STRIPE_GATE bloqueado ✅ |
| `commission.enabled` | `false` | INV-005 ✅ |
| `commission.real_rate` | `0.00` | INV-005 ✅ |
| `commission.simulation_rate` | `0.02` | Solo analítico, separado del real ✅ |

**Tests SQL A–J — resultados:**

| Test | Resultado | Notas |
|---|---|---|
| A — Config financiera inicial | ✅ PASSED | 5/5 assertions |
| B — Política comisión Fase 0 | ✅ PASSED | Bug corregido: `v_policy IS NOT NULL` → `v_policy.id IS NOT NULL` (composite PG semantics) |
| C — Cálculo comisión real=0, sim separada | ✅ PASSED | 6/6 assertions |
| D — Master order + idempotencia INV-017 | ✅ PASSED | 8/8 assertions |
| E — Ledger inmutabilidad INV-009 | ✅ PASSED | UPDATE y DELETE rechazados |
| F — GMV ≠ Revenue TrabFlow INV-001 | ✅ PASSED | Revenue real=0 confirmado |
| G — Aislamiento entre proveedores | ✅ PASSED | Entradas no se cruzan entre actores |
| H — Backward compat pedidos legacy | ✅ PASSED | 22 pedidos legacy accesibles |
| I — Snapshots inmutables INV-007 | ✅ PASSED | Trigger bloqueó UPDATE. Bug cleanup corregido: INV-007 impide limpiar snapshot incluso en tests |
| J — Comisión simulada ≠ Revenue real | ✅ PASSED | 5/5 assertions; is_real=false en simulación |

**Smoke test marketplace:**

| Tabla | Count | Estado |
|---|---|---|
| `trade_marketplace_supplier_offerings` | 336 | ✅ intacto |
| `trade_marketplace_carts` | 59 | ✅ intacto |
| `trade_marketplace_cart_items` | 275 | ✅ intacto |
| `trade_marketplace_orders` (legacy) | 22 | ✅ master_order_id=NULL, backward compat OK |
| `trade_marketplace_order_items` | 38 | ✅ intacto |
| `trade_marketplace_actors` | 10 | ✅ intacto |
| `trade_marketplace_commission_policies` | 1 | ✅ política Fase 0 |
| `trade_marketplace_financial_config` | 14 | ✅ todos los gates cerrados |

**Correcciones de tests SQL durante validación:**

1. **Test B** — `v_policy IS NOT NULL` → `v_policy.id IS NOT NULL`  
   _Causa: PostgreSQL composite `IS NOT NULL` devuelve FALSE si algún campo del row es NULL (effective_from, provider_actor_id son NULL en la política). No era fallo de implementación._

2. **Test I** — Eliminado bloque cleanup final  
   _Causa: el trigger INV-007 bloquea `UPDATE SET financial_snapshot_at = NULL` incluso con service_role. El intento de cleanup demostraba la invariante pero hacía fallar el bloque DO. Snapshot de test no queda en BD (transaction rollback por exception no capturada)._

### Migraciones creadas

| # | Archivo | Tablas / Acción | Backward compatible |
|---|---|---|---|
| 1 | `20260821_01_mkt_fin_financial_config.sql` | `trade_marketplace_financial_config` (nueva) | ✅ |
| 2 | `20260821_02_mkt_fin_commission_policies.sql` | `trade_marketplace_commission_policies` (nueva) | ✅ |
| 3 | `20260821_03_mkt_fin_master_orders.sql` | `trade_marketplace_master_orders` (nueva) | ✅ |
| 4 | `20260821_04_mkt_fin_extend_supplier_orders.sql` | `trade_marketplace_orders` — ADD COLUMN (finance) | ✅ NULL/DEFAULT |
| 5 | `20260821_05_mkt_fin_extend_order_items.sql` | `trade_marketplace_order_items` — ADD COLUMN (snapshots) | ✅ NULL/DEFAULT |
| 6 | `20260821_06_mkt_fin_ledger_entries.sql` | `trade_marketplace_ledger_entries` (nueva) | ✅ |
| 7 | `20260821_07_mkt_fin_audit_outbox.sql` | Reutiliza `trade_marketplace_audit_log` y `trade_marketplace_outbox` | ✅ |
| 8 | `20260821_08_mkt_fin_rls_indexes.sql` | RLS adicionales + índices + funciones admin/proveedor | ✅ |

### Tablas creadas

| Tabla | Descripción |
|---|---|
| `trade_marketplace_financial_config` | Feature flags financieros (simulation_mode, commission_enabled, etc.) |
| `trade_marketplace_commission_policies` | Políticas de comisión (Fase 0: rate=0%, simulation_only=true) |
| `trade_marketplace_master_orders` | Agrupador de supplier_orders del mismo checkout; idempotente por `checkout_key` |
| `trade_marketplace_ledger_entries` | Ledger append-only inmutable (INV-009); 26 tipos de movimiento |

### Tablas modificadas (backward-compatible)

| Tabla | Columnas añadidas |
|---|---|
| `trade_marketplace_orders` | `master_order_id`, `payment_status`, `currency`, `*_snapshot` (goods/shipping/tax), `commission_*_snapshot`, `sim_commission_*`, `provider_payable_snapshot`, `financial_snapshot_at`, `refunded_amount`, `external_provider` |
| `trade_marketplace_order_items` | `precio_*_snapshot`, `descuento_*_snapshot`, `tax_rate_snapshot`, `item_{net,tax,gross}_snapshot`, `commissionable_unit_price_net_snapshot`, `currency` |

### Funciones / RPC creadas

| Función | Propósito |
|---|---|
| `mkt_fin_get_config(p_key)` | Lee valor jsonb de financial_config |
| `mkt_fin_config_bool(p_key, p_default)` | Lee booleano de financial_config |
| `mkt_fin_get_active_commission_policy(p_actor_id)` | Política activa (global o por proveedor) |
| `mkt_fin_calculate_commission(p_goods_net, p_actor_id, p_simulation_mode)` | Calcula comisión según política activa |
| `mkt_fin_create_master_order(...)` | Crea/devuelve master order idempotente por checkout_key (INV-017) |
| `mkt_fin_get_master_order(p_master_order_id, p_checkout_key)` | Detalle con supplier_orders |
| `mkt_fin_write_order_financial_snapshot(...)` | Escribe snapshot idempotente en supplier order |
| `mkt_fin_write_item_snapshot(...)` | Escribe snapshot en order item |
| `mkt_fin_ledger_append(...)` | Añade entrada al ledger (idempotente por source_event_id) |
| `mkt_fin_ledger_balance(p_master_order_id, p_actor_id)` | Balance del ledger con GMV/Revenue desglosado |
| `mkt_fin_check_gmv_revenue_separation(p_master_order_id)` | Verifica INV-001 en tiempo real |
| `mkt_fin_get_provider_financial_summary(p_actor_id)` | Resumen financiero de un proveedor |
| `mkt_fin_admin_overview()` | KPIs globales GMV+Revenue separados (solo platform_admin) |
| `mkt_fin_audit(...)` | Escribe en trade_marketplace_audit_log |
| `mkt_fin_outbox_publish(...)` | Publica evento en trade_marketplace_outbox |

### Triggers creados

| Trigger | Tabla | Propósito |
|---|---|---|
| `trg_ledger_immutable_update` | `trade_marketplace_ledger_entries` | RAISE si UPDATE (INV-009) |
| `trg_ledger_immutable_delete` | `trade_marketplace_ledger_entries` | RAISE si DELETE (INV-009) |
| `trg_mkt_fin_protect_order_snapshots` | `trade_marketplace_orders` | Bloquea UPDATE de campos _snapshot si `financial_snapshot_at IS NOT NULL` (INV-007) |
| `trg_mkt_fin_master_order_numero` | `trade_marketplace_master_orders` | Genera número MKP-YYYY-NNNN vía `next_financial_doc_number('MKP')` |
| `trg_mkt_fin_audit_config` | `trade_marketplace_financial_config` | Audita cambios de config |
| `trg_mkt_fin_audit_commission` | `trade_marketplace_commission_policies` | Audita cambios de política |
| `trg_mkt_fin_audit_master_order` | `trade_marketplace_master_orders` | Audita INSERT y cambios de estado |
| `trg_mkt_fin_audit_snapshot` | `trade_marketplace_orders` | Audita escritura de snapshot financiero |

### RLS

- `trade_marketplace_financial_config` — SELECT para `authenticated`; ALL para `platform_admin`
- `trade_marketplace_commission_policies` — SELECT para `authenticated`; ALL para `platform_admin`
- `trade_marketplace_master_orders` — SELECT/UPDATE para `org_id` del comprador; ALL para `platform_admin`
- `trade_marketplace_ledger_entries` — SELECT para `_mkt_actor_ids_for_user()`; SELECT ALL para `platform_admin`; **sin políticas UPDATE/DELETE** (inmutable por trigger, no por RLS)

### Tests SQL creados

`supabase/tests/test_marketplace_finance_foundations.sql` — 10 tests (A-J):

| Test | Invariante verificada |
|---|---|
| A | Config inicial correcta (simulation, commission_enabled=false) |
| B | Política comisión Fase 0 (INV-005: rate=0, INV-006: applies_to_shipping=false) |
| C | Cálculo comisión: real=0, sim separada, no hardcodeado 2% |
| D | Master order: creación e idempotencia por checkout_key (INV-017) |
| E | Ledger inmutabilidad: UPDATE y DELETE rechazados (INV-009) |
| F | GMV ≠ Revenue TrabFlow (INV-001) |
| G | Aislamiento entre proveedores en ledger |
| H | Backward compatibility: pedidos existentes sin master_order_id = OK |
| I | Snapshots inmutables tras financial_snapshot_at (INV-007) |
| J | Comisión simulada ≠ Revenue real (INV-001 + INV-005) |

### Archivos TypeScript creados

```
src/lib/marketplace/finance/
  types/
    money.types.ts              — Currency, Money, OrderTotals, CommissionSnapshot, ...
    master-order.types.ts       — MasterOrder, CreateMasterOrderParams, MasterOrderDetail
    ledger.types.ts             — LedgerEntryType (26 tipos), LedgerEntry, LedgerBalance
    commission.types.ts         — CommissionPolicy, CommissionResult, FinancialConfig
  payment-provider.ts           — Interface MarketplacePaymentProvider + SimulationMarketplacePaymentProvider
  ledger.service.ts             — ledgerAppend, getLedgerBalance, getLedgerEntriesFor*
  master-order.service.ts       — createMasterOrder, getMasterOrderDetail, checkGmvRevenueSeparation
  commission.service.ts         — getActiveCommissionPolicy, calculateCommission
  financial-config.service.ts   — getFinancialConfig, getFinancialConfigBool, assertSimulationMode
```

### Invariantes garantizadas en esta fase

| Inv | Garantía | Mecanismo |
|---|---|---|
| INV-001 | GMV ≠ Revenue TrabFlow | Ledger types separados; función de verificación |
| INV-005 | commission_rate real = 0% | commission_enabled=false en config; política rate=0.0000 |
| INV-006 | Shipping no commissionable | applies_to_shipping=false en política Fase 0 |
| INV-007 | Snapshots inmutables | Trigger BEFORE UPDATE |
| INV-009 | Ledger append-only | Triggers BEFORE UPDATE/DELETE con RAISE EXCEPTION |
| INV-012 | order_status ≠ payment_status | Ciclos independientes en tablas separadas |
| INV-015 | currency siempre explícita | char(3) NOT NULL DEFAULT 'EUR' en todas las tablas |
| INV-017 | Idempotencia | checkout_key UNIQUE en master_orders; source_event_id en ledger |

### Decisiones tomadas en MP-FIN-1A

| Ref | Decisión | Estado |
|---|---|---|
| D-MP1A-1 | Reutilizar `trade_marketplace_audit_log` y `trade_marketplace_outbox` existentes | DECIDED |
| D-MP1A-2 | `trade_marketplace_orders` = supplier_order (renombrado conceptual, no físico) | DECIDED |
| D-MP1A-3 | Numeración master order: serie 'MKP' en `trade_doc_number_seq` existente | DECIDED |
| D-MP1A-4 | Ledger: perspectiva TrabFlow. (+)=recibe (-)=paga | DECIDED |
| D-MP1A-5 | simulation_rate=0.02 en config, NO hardcodeado en código | DECIDED |
| D-010 | Stripe Connect Separate Charges and Transfers | LEGAL_GATE (sin cambios) |
| D-011 | Rol jurídico TrabFlow | LEGAL_GATE (sin cambios) |
| D-012 | Base imponible comisión | TAX_GATE (sin cambios) |

### Deuda técnica MP-FIN-1A

| ID | Descripción | Cuándo resolver |
|---|---|---|
| DT-1A-1 | `checkoutCartV2` no integrado con master_order todavía | MP-FIN-1B.1 |
| DT-1A-2 | `checkout_key` en `checkoutCartV2` puede ser `undefined` en algunos flujos | MP-FIN-1B.1 pre-requisito |
| ~~DT-1A-3~~ | ~~Migraciones creadas localmente, NO aplicadas en Supabase cloud~~ | ✅ RESUELTO — 8 migraciones aplicadas y validadas 2026-08-21 |
| ~~DT-1A-4~~ | ~~Tests SQL no ejecutados contra BD real~~ | ✅ RESUELTO — Tests A-J ejecutados contra dqqjaujnulutinskmqsu 2026-08-21 |
| DT-1A-5 | `balance.service.ts`, `settlement.service.ts`, `refund.service.ts` pendientes | MP-FIN-2 |

---

## MP-FIN-1B.1 — Master Order + Snapshots ⏳ PRÓXIMO

> **Objetivo:** Conectar `checkoutCartV2` con `trade_marketplace_master_orders` + snapshots financieros.  
> **Limitación explícita:** SIN simulation events, SIN ledger. Solo atomicidad y snapshots.  
> **Prerrequisito:** MP-FIN-1A validada en cloud. ✅ Cumplido.  
> **Al completar 1B.1: DETENER y entregar resumen para aprobación de MP-FIN-1B.2.**

### Flujo actual (AS-IS)

```
checkoutCartV2()
  → crea trade_marketplace_orders (1 por proveedor)
  → asigna checkout_key existente
  → sin master_order_id
  → sin snapshots financieros
  → pago = externo / simulado sin registro en ledger
```

### Flujo objetivo (TO-BE subfase 1B.1 — solo pasos 1-6)

```
checkoutCartV2()
  1. assertSimulationMode()                            ← guard financial-config.service
  2. mkt_fin_create_master_order(checkout_key, totals) ← idempotente (INV-017)
  3. crear trade_marketplace_orders (sin cambio)
  4. vincular orders → master_order_id
  5. mkt_fin_write_order_financial_snapshot(...)        ← snapshot inmutable (INV-007)
  6. mkt_fin_write_item_snapshot(...) por cada línea
  -- pasos 7-11 son MP-FIN-1B.2 (con aprobación)
```

### Flujo objetivo (TO-BE subfase 1B.2 — pasos 7-11, requiere aprobación)

```
  7. getPaymentProvider().createPayment(...)            ← simulation en Fase 0
  8. ledgerAppend(BUYER_PAYMENT, ...)
  9. ledgerAppend(GOODS_ENTITLEMENT, ...) × N proveedores
  10. ledgerAppend(SHIPPING_ENTITLEMENT, ...) × N proveedores
  11. ledgerAppend(COMMISSION_SIM_ACCRUAL, ...) × N (si sim_rate > 0)
```

### Compatibilidad durante transición

- Todos los `ADD COLUMN` son `NULL` o `DEFAULT` → pedidos pre-MP-FIN-1B no se rompen
- `master_order_id IS NULL` en pedidos anteriores = válido (test H lo verifica)
- `checkout_key` ya existe en el flujo; solo hay que garantizar que nunca sea `undefined`

### Archivos a modificar en MP-FIN-1B

| Archivo | Cambio |
|---|---|
| `src/lib/marketplace/checkoutCartV2.ts` | Integrar pasos 1-11 del flujo TO-BE |
| `src/lib/marketplace/checkoutCartV2.ts` | Añadir `checkout_key` garantizado (uuid si falta) |
| `src/lib/marketplace/finance/ledger.service.ts` | Ya listo |
| `src/lib/marketplace/finance/master-order.service.ts` | Ya listo |
| `src/lib/marketplace/finance/financial-config.service.ts` | Ya listo |

### Archivos a crear en MP-FIN-1B

| Archivo | Propósito |
|---|---|
| `src/lib/marketplace/finance/checkout-finance.service.ts` | Orquesta pasos 1-11; sin lógica en componente React |

### Tests a crear en MP-FIN-1B.1

- `supabase/tests/test_checkout_finance_flow.sql` — Tests C-01 a C-12:
  - C-01 a C-04: atomicidad (éxito, fallo, rollback)
  - C-05 a C-07: idempotencia checkout_key
  - C-08 a C-09: snapshots inmutables tras checkout
  - C-10 a C-12: backward compat pedidos legacy

### Decisiones MP-FIN-1B.1 pendientes

| Ref | Decisión |
|---|---|
| DT-1A-2 | ¿Generar checkout_key en cliente o en servidor? → recomendación: servidor (UUID v4) |

---

## MP-FIN-1B.2 — Simulation Events + Ledger 🔒 BLOQUEADO (1B.1)

> **Requiere aprobación explícita tras revisar MP-FIN-1B.1.**  
> Objetivo: pasos 7-11 del flujo TO-BE completo (payment simulation + ledger entries).  
> **IMPORTANTE:** `simulation_rate=0.02` permanece completamente separado de `commission_rate=0`.  
> Admin Finance mostrará dos KPIs distintos: "Revenue real Marketplace = 0 €" y "Revenue potencial simulado = X €".

---

## MP-FIN-2 — Simulation Engine 🔒 BLOQUEADO (MP-FIN-1B)

### Casos de test a implementar

| # | Caso | Verificar |
|---|---|---|
| C-01 | 1 proveedor, venta normal | ledger, balance, GMV |
| C-02 | 3 proveedores, 1 checkout | master_order, 3 supplier_orders, ledger isolado |
| C-03 | Refund parcial proveedor A | commission_reversal, balance A intacto vs B/C |
| C-04 | Refund completo proveedor B | ledger compensatorio, balance B = 0 |
| C-05 | Chargeback solo proveedor C | sin afectar A/B, fees, ledger |
| C-06 | Proveedor A saldo negativo | balance negativo permitido, origen registrado |
| C-07 | Saldo negativo compensado futura venta | future_settlement_offset |
| C-08 | Reserva parcial | reserve_hold en ledger, balance_reserved |
| C-09 | Liberación de reserva | reserve_release en ledger, balance_reserved = 0 |
| C-10 | Settlement mensual completo | ventas + refunds + comisión |
| C-11 | Comisión Fase 0 = 0% | commission_rate=0, net_payable = gross_payable |
| C-12 | Simulación 2% sin revenue real | simulation_only=true, no en financial_documents |
| C-13 | Supplier order cancelado antes de settlement | settlement no incluye ese SO |
| C-14 | Refund después de settlement | nuevo ledger entry en siguiente settlement |
| C-15 | Chargeback posterior a payout | recovery mechanism registrado |

**En todos los casos verificar:** `SUM(ledger_entries)` balance correcto, GMV ≠ Revenue TrabFlow (INV-001).

---

## MP-FIN-3 — Admin Finance Panel 🔒 BLOQUEADO (MP-FIN-2)

### Componentes a crear

```
src/components/admin/marketplace-finance/
  AdminMktFinanceOverview.tsx       — KPIs globales
  AdminMktFinanceOrders.tsx         — Pedidos financieros con drill-down
  AdminMktFinanceProviders.tsx      — Por proveedor
  AdminMktFinanceLedger.tsx         — Ledger global filtrable
  AdminMktFinanceSettlements.tsx    — Settlements
  AdminMktFinanceRefunds.tsx        — Dashboard refunds
  AdminMktFinanceDisputes.tsx       — Dashboard chargebacks
  AdminMktFinanceNegativeBalances.tsx
  AdminMktFinanceSimulation.tsx     — Panel simulación (badge SIMULACIÓN)
  AdminMktFinanceConfig.tsx         — Configuración financiera
```

### Archivos a modificar

- `src/components/admin/AdminFinancialCenter.tsx` — añadir tab "Marketplace"

---

## MP-FIN-4 — Provider Finance Panel 🔒 BLOQUEADO (MP-FIN-2)

### Componentes a crear

```
src/components/portal/finance/
  PortalFinanzasView.tsx            — Shell del panel
  PortalFinanzasResumen.tsx         — KPIs y saldos
  PortalFinanzasMovimientos.tsx     — Tabla de movimientos filtrable
  PortalFinanzasLiquidaciones.tsx   — Lista + detalle settlements
  PortalFinanzasDevoluciones.tsx    — Refunds
  PortalFinanzasDisputas.tsx        — Chargebacks
  PortalFinanzasFacturas.tsx        — Infraestructura facturas (TAX_GATE)
  PortalFinanzasDocumentos.tsx      — Documentos MKP vinculados
```

### Archivos a modificar

- `src/components/portal/PortalProveedorView.tsx` — añadir tab "Finanzas"

---

## MP-FIN-5 — Documents 🔒 BLOQUEADO (MP-FIN-4)

### Documentos

| Doc | Estado | Gate |
|---|---|---|
| MKP — Justificante de compra (commercial_summary) | Pendiente de implementar | Ninguno |
| Settlement Statement — informe de liquidación | Pendiente de implementar | Ninguno |
| MKC — Factura de comisión (invoice) | Infraestructura solo | TAX_GATE |
| RC — Nota de crédito | Infraestructura solo | TAX_GATE |

---

## MP-FIN-6 — Reconciliation Layer 🔒 BLOQUEADO (MP-FIN-5)

### Contenido

- Esquema de reconciliación TrabFlow Ledger ↔ Stripe
- Campos `external_provider`, `external_id`, `external_type` ya presentes desde MP-FIN-1
- Pantalla Admin de reconciliación (placeholder hasta Stripe real)
- Sin dinero real

---

## MP-FIN-7 — Stripe Sandbox 🚫 NO INICIAR

**Esta fase NO comienza hasta instrucción explícita de Fernando.**

No está incluida en el planning actual. Requiere:
- G-LEGAL-1 completado
- G-STRIPE-1 (modelo de cuentas Connect validado)
- Contrato tipo proveedor firmado en al menos 1 piloto
- Autorización formal por escrito de Fernando

---

## Decisiones tomadas (DECIDED)

| Ref | Decisión | Fecha |
|---|---|---|
| INV-001 | GMV ≠ Revenue TrabFlow — inamovible | 2026-08-20 |
| INV-005 | 2% = solo hipótesis de simulación; Fase 0 = 0% real | 2026-08-20 |
| INV-006 | Shipping no commissionable en Fase 0 | 2026-08-20 |
| INV-009 | Ledger = append-only, inmutable | 2026-08-20 |
| INV-012 | order_status ≠ payment_status (campos separados) | 2026-08-20 |
| INV-016 | Net/Tax/Gross siempre diferenciados | 2026-08-20 |
| INV-017 | Idempotencia en toda operación externa | 2026-08-20 |
| D-001 | Pago único → N supplier orders (arquitectura multiproveedor) | 2026-08-20 |
| D-004 | Base comisionable = goods_net (DECIDED para Fase 0) | 2026-08-20 |
| D-006 | commission_rate Fase 0 = 0% real; 2% solo simulación | 2026-08-20 |
| D-013 | Hold period conceptual = T+7 días post-entrega (DECIDED concepto) | 2026-08-20 |
| D-014 | Settlement mensual (DECIDED concepto; mecanismo fiscal = TAX_GATE) | 2026-08-20 |

---

## Decisiones PROPOSED (pendientes de confirmación)

| Ref | Propuesta | Gate |
|---|---|---|
| D-010 | Stripe Connect + Separate Charges and Transfers | LEGAL_GATE |
| D-011 | Rol jurídico TrabFlow en intermediación de pagos | LEGAL_GATE |
| D-012 | Base imponible y tipo de IVA de comisión | TAX_GATE |
| D-024 | GMV definido como goods_net (base imponible) | TAX_GATE |
| D-026 | Opción A (deducir commission_gross) vs Opción B | TAX_GATE |
| D-009 | Factura mensual MKC válida como mecanismo | TAX_GATE |
| G-PSP-1 | Tarifas PSP reales negociadas antes de activar comisión | STRIPE_GATE |

---

## Decisiones bloqueadas — LEGAL_GATE

No implementar ni asumir respuesta hasta dictamen:

- Rol jurídico TrabFlow (agente, MoR, intermediario, otro)
- Seller of record vs merchant of record
- Mandato/agencia de cobro
- PSD2 — obligaciones y licencias
- Estructura contractual definitiva
- Hold period — límites legales
- Segregación de fondos
- Compensación saldos negativos
- Responsabilidad chargebacks
- Stripe Connect — viabilidad jurídica

---

## Decisiones bloqueadas — TAX_GATE

No implementar ni asumir respuesta hasta dictamen:

- Cadena de facturación materiales
- IVA por categoría de producto
- IVA de shipping
- Base imponible y tipo IVA comisión
- Opción A vs B (deducción de comisión)
- Factura mensual consolidada MKC
- Notas rectificativas cross-period
- Momento del devengo fiscal
- DAC7 / Modelo 238 obligaciones y calendario

---

## Decisiones bloqueadas — STRIPE_GATE

No implementar hasta autorización explícita:

- Stripe Connect onboarding
- PaymentIntent para marketplace
- Separate Charges and Transfers
- Webhook marketplace Stripe
- Payout automation
- Descriptor y configuración Stripe marketplace

---

## Archivos modificados en MP-FIN-0

| Archivo | Tipo | Descripción |
|---|---|---|
| `docs/marketplace/payments/IMPLEMENTATION_AUDIT.md` | NUEVO | Auditoría completa AS-IS vs TO-BE |
| `docs/marketplace/payments/IMPLEMENTATION_STATUS.md` | NUEVO | Este documento |

---

## Próximo paso

**Enviar M0-B y M0-C a asesores.** Sin esas respuestas, MP-FIN-1 no puede comenzar.

Una vez que M0-D esté aprobado, el primer bloque de MP-FIN-1 es:
1. `trade_marketplace_financial_config` con valores iniciales
2. `trade_marketplace_commission_policies` con policy Fase 0 (rate=0%, simulation_only=true)
3. `trade_marketplace_master_orders`
4. Extensión de `trade_marketplace_orders` con campos financieros

**Ningún código productivo hasta M0-D aprobado.**
