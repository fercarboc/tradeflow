# Marketplace Finance — Implementation Status

> **Documento vivo.** Actualizar tras cada fase.  
> **Regla:** Una fase no se marca COMPLETED hasta que compile, pase tests y esté verificada en entorno de desarrollo.  
> **Última actualización:** 2026-08-22 (MP-FIN-1B.2 VALIDATED)

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
| **MP-FIN-1B.1** | Master Order + Snapshots (sin ledger, sin pago sim) | ✅ VALIDATED | 2026-08-21 | 2026-08-21 |
| **MP-FIN-1B.1D** | PDF Resumen de compra Marketplace | ✅ VALIDATED | 2026-08-21 | 2026-08-21 |
| **MP-FIN-1B.2** | Sim events + ledger (requiere aprobación tras 1B.1) | ✅ VALIDATED | 2026-08-22 | 2026-08-22 |
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

## MP-FIN-1B.1 — Master Order + Snapshots ✅ VALIDATED

> **Cerrada: 2026-08-21. Validación cloud: 2026-08-21.**  
> Checkout atómico PL/pgSQL crea 1 master_order + N supplier_orders con snapshots financieros inmutables.  
> Limitación respetada: SIN simulation events, SIN ledger, SIN Stripe.  
> **Al continuar a MP-FIN-1B.2 se requiere aprobación explícita.**

### Validación Cloud (Supabase dqqjaujnulutinskmqsu — eu-central-1)

**Migración aplicada:**

| # | Migración | Estado | Notas |
|---|---|---|---|
| 9 | `20260821_09_mkt_fin_checkout_v2_finance` | ✅ | `checkout_cart_v2` refactorizado como función PL/pgSQL única |

**Estado final BD tras tests:**

| Métrica | Valor | Interpretación |
|---|---|---|
| `total_orders` | 29 | 22 legacy + 7 nuevos de tests |
| `linked_to_master` | 7 | todos los nuevos órdenes vinculados al master |
| `with_snapshot` | 7 | 100% de los nuevos con `financial_snapshot_at IS NOT NULL` |
| `master_count` | 5 | C-01:1, C-02:1, C-16:1, C-17:1, C-18:1 |
| `legacy_orders` | 22 | backward compat confirmado |

**Tests C-01 a C-18 — resultados:**

| Test | Descripción | Resultado |
|---|---|---|
| C-01 | 1 proveedor: crea 1 supplier_order + 1 master_order | ✅ PASSED |
| C-02 | 3 proveedores: crea 3 supplier_orders + 1 master_order | ✅ PASSED |
| C-03 | Mismo checkout_key → no duplica master_order (INV-017) | ✅ PASSED |
| C-04 | Mismo checkout_key → devuelve los mismos order_ids (INV-017) | ✅ PASSED |
| C-05 | `master.checkout_gross = SUM(supplier.goods_gross + supplier.shipping_gross)` | ✅ PASSED |
| C-06 | `item_net + item_tax = item_gross` en todos los order_items (tolerancia 0.01 EUR) | ✅ PASSED |
| C-07 | `financial_snapshot_at IS NOT NULL` tras checkout (INV-007) | ✅ PASSED |
| C-08 | UPDATE de campo snapshot lanza excepción con 'INV-007' (inmutabilidad) | ✅ PASSED |
| C-09 | `commission_net_snapshot = 0` en todos (INV-005: comisión real = 0) | ✅ PASSED |
| C-10 | master_order recuperable por checkout_key vía `trade_marketplace_master_orders` | ✅ PASSED |
| C-11 | Todos los supplier_orders tienen `master_order_id = master_order.id` | ✅ PASSED |
| C-12 | Carrito vacío lanza excepción `NO_ITEMS` | ✅ PASSED |
| C-13 | Actor con `estado='suspended'` lanza `ACTOR_INACTIVE` | ✅ PASSED |
| C-14 | `cart.estado = 'ordered'` tras checkout exitoso | ✅ PASSED |
| C-15 | 22 pedidos legacy (master_order_id IS NULL) siguen existentes | ✅ PASSED |
| C-16 | `checkout_key=''` → genera UUID válido (DT-1A-2) | ✅ PASSED |
| C-17 | `checkout_key=NULL` → genera UUID válido (DT-1A-2) | ✅ PASSED |
| C-18 | `payment_method='cuenta_proveedor'` (pago offline) → checkout completo + snapshot | ✅ PASSED |

### Flujo implementado (TO-BE 1B.1 — pasos 1-6 en función atómica)

```sql
-- checkout_cart_v2() — 1 transacción PL/pgSQL SECURITY DEFINER
STEP 0: v_checkout_key := COALESCE(NULLIF(p_checkout_key, ''), gen_random_uuid()::text)
STEP 1: idempotencia — buscar master_order por checkout_key
STEP 2: validaciones carrito (NOT_FOUND, CART_NOT_READY, NO_ITEMS, ACTOR_INACTIVE, OFFERING_INACTIVE)
STEP 3: por cada actor → supplier_order + order_items con snapshots financieros
STEP 3.5: insertar snapshots en trade_marketplace_order_items
STEP 4: mkt_fin_create_master_order() con totales acumulados
STEP 5: UPDATE trade_marketplace_orders SET master_order_id = ... (trigger lo permite)
STEP 6: cart.estado = 'ordered', actualizar quote items
```

### Constraints descubiertas durante testing

| Restricción | Valor correcto | Error incorrecto |
|---|---|---|
| `source_type` (cart_items) | `'manual'`, `'quote'`, `'job'`, etc. | `'test'` → CHECK violation |
| `delivery_method` | `'entrega_obra'`, `'entrega_almacen'`, `'recogida_proveedor'`, `'por_coordinar'`, NULL | `'delivery'` → CHECK violation |
| `total_linea` (order_items) | columna GENERATED (`cantidad * precio_unitario_final`) | no puede insertarse directamente |

### Archivos creados

| Archivo | Propósito |
|---|---|
| `supabase/migrations/20260821_09_mkt_fin_checkout_v2_finance.sql` | Refactor `checkout_cart_v2` a PL/pgSQL con master_order + snapshots |
| `src/lib/marketplace/finance/checkout-finance.service.ts` | Servicio TS post-checkout: `getCheckoutFinancialSummary`, `verifyCheckoutTotalsIntegrity`, `assertValidCheckoutKey` |
| `supabase/tests/test_checkout_finance_flow.sql` | Suite 18 tests C-01 a C-18 ejecutados y validados contra cloud |

### Deuda técnica resuelta

| ID | Descripción | Estado |
|---|---|---|
| ~~DT-1A-1~~ | ~~`checkoutCartV2` no integrado con master_order~~ | ✅ RESUELTO — función SQL atómica integrada 2026-08-21 |
| ~~DT-1A-2~~ | ~~`checkout_key` puede ser `undefined`/vacío~~ | ✅ RESUELTO — `COALESCE(NULLIF(p_checkout_key,''), gen_random_uuid()::text)` en STEP 0 |

### Invariantes garantizadas por esta fase

| Inv | Garantía |
|---|---|
| INV-005 | `commission_net_snapshot = 0` — verificado en C-09 |
| INV-007 | Snapshots inmutables — trigger bloqueó UPDATE en C-08 |
| INV-017 | Idempotencia por checkout_key — verificado en C-03 y C-04 |
| INV-003 | `master.checkout_gross = SUM(goods_gross + shipping_gross)` — verificado en C-05 |

---

## MP-FIN-1B.1D — PDF Resumen de compra Marketplace ✅ VALIDATED

> **Cerrada: 2026-08-21. Validación cloud: 2026-08-21.**  
> Genera un PDF descargable "Resumen de compra" a partir de snapshots inmutables.  
> **NO es factura fiscal** (LEGAL_GATE/TAX_GATE). Precios siempre del snapshot de checkout (INV-007).  
> INV-005: comisión TrabFlow no expuesta al comprador.

### Componentes

| Archivo | Propósito |
|---|---|
| `supabase/migrations/20260821_10_mkt_fin_purchase_summary_fn.sql` | Función `mkt_fin_get_purchase_summary_data` — Route A (checkout_key) + Route B (order_id) + legacy fallback |
| `src/lib/marketplace/finance/marketplace-purchase-summary.service.ts` | Servicio TS: mapeo JSONB → tipos, `getPurchaseSummaryByCheckoutKey`, `getPurchaseSummaryByOrderId` |
| `src/lib/printMarketplacePurchase.ts` | HTML template + `printMarketplacePurchaseSummary`, `downloadMarketplacePurchaseSummary` |
| `src/components/marketplace/MarketplaceComprarView.tsx` | Botón "Descargar resumen" en pantalla de éxito post-checkout |
| `src/components/marketplace/ScreenMisPedidos.tsx` | Sección "Documentos" con "Resumen de compra (PDF)" en panel detalle |
| `supabase/tests/test_purchase_summary.sql` | 10 tests P-01..P-10 validados contra cloud |

### Función SQL: mkt_fin_get_purchase_summary_data

```sql
-- SECURITY DEFINER, SET search_path = public
-- Parámetros: p_checkout_key (Route A) ó p_order_id (Route B)
-- Auth: verifica auth.uid() + trade_org_members (comprador o platform_admin)
-- INV-007: lee solo de snapshots, NUNCA recalcula desde catálogo actual
-- INV-005: commission_net_snapshot NOT incluido en respuesta
```

**Route A** — por `checkout_key`: busca master_order → supplier_orders + items anidados.  
**Route B** — por `order_id`: JOIN master+supplier → si NOT FOUND → legacy fallback (is_legacy=true, master_order=null).

### Estructura del PDF

- Cabecera: TrabFlow brand + número documento + fecha
- Banner simulación (si `external_provider='simulation'`): amber con "⚠ OPERACIÓN DE PRUEBA / SIMULACIÓN — NO SE HA REALIZADO NINGÚN CARGO REAL"
- Banner legacy (si `is_legacy=true`): informativo
- Grid comprador + detalles del pedido
- Por proveedor: tabla 5 columnas (Descripción, Cantidad, P. unit. neto, IVA%, Total) + portes + subtotales
- Placeholder factura proveedor (status='pending') dentro de cada bloque
- Totales globales alineados a la derecha
- Disclaimer LEGAL_GATE/TAX_GATE (provisional)
- XSS: `escHtml()` en todos los campos de usuario

### Tests SQL P-01..P-10

| Test | Invariante verificada | Resultado |
|---|---|---|
| P-01 | 1 proveedor: is_legacy=false, master_order presente, 1 supplier_order | ✅ PASSED |
| P-02 | 3 proveedores: jsonb_array_length(supplier_orders)=3, actor_nombre no vacío | ✅ PASSED |
| P-03 | Total global = master_order.checkout_gross_total = SUM(proveedor goods+shipping) | ✅ PASSED (15.31€) |
| P-04 | goods_gross_snapshot fn = goods_gross_snapshot BD (INV-007) | ✅ PASSED (1.75€) |
| P-05 | Portes separados por proveedor (≥1 proveedor con shipping>0 de 3) | ✅ PASSED (1/3) |
| P-06 | has_snapshot=true en todos los items (datos de snapshot, no catálogo) | ✅ PASSED (1/1 items) |
| P-07 | commission_net_snapshot y sim_commission_net NO en respuesta (INV-005) | ✅ PASSED |
| P-08 | external_provider='simulation' → campo presente para mostrar banner PDF | ✅ PASSED |
| P-09 | Pedido legacy (master_order_id IS NULL): is_legacy=true, master_order=null | ✅ PASSED (MKT-000001) |
| P-10 | Número MKP-*, invoice_placeholder.status='pending', sin numeración FAC/F- | ✅ PASSED (MKP-2026-0003) |

**BD final:** 6 master_orders, 7 supplier_orders linked, 7 con snapshot completo.

### Acceso por rol

| Rol | Acceso |
|---|---|
| Comprador (org member) | Ver + descargar PDF completo (todos los proveedores) |
| Admin | Ver + descargar (acceso platform_admin en función SECURITY DEFINER) |
| Proveedor | Solo su supplier_order vía portal proveedor (no este PDF multi-proveedor) |

### Invariantes garantizadas

| Inv | Garantía |
|---|---|
| INV-007 | PDF siempre usa precios del snapshot de checkout, nunca catálogo actual |
| INV-005 | commission_net_snapshot no incluido en JSON al comprador |
| LEGAL_GATE | Documento titulado "Resumen de compra", nunca "Factura" |
| TAX_GATE | Tipos IVA del snapshot marcados como provisionales en código |

---

## MP-FIN-1B.2 — Simulation Events + Ledger ✅ VALIDATED

> **Cerrada: 2026-08-22. Validación cloud: 2026-08-22.**  
> Ledger simulado inicial generado automáticamente en el checkout (STEP 7, no-blocking).  
> Modelo B (Gross): GOODS_ENTITLEMENT + SHIPPING_ENTITLEMENT por supplier_order.  
> IVA incluido en amount, no como entrada separada [TAX_GATE].  
> **20 tests L-01..L-20 — TODOS PASSED.**  
> **IMPORTANTE:** `simulation_rate=0.02` completamente separado de `commission_rate=0`.  
> Admin Finance mostrará dos KPIs distintos: "Revenue real Marketplace = 0 €" y "Revenue potencial simulado = X €".

### Validación Cloud (Supabase dqqjaujnulutinskmqsu — eu-central-1)

**Migración aplicada:**

| # | Migración | Estado | Notas |
|---|---|---|---|
| 11 | `20260822_11_mkt_fin_checkout_ledger.sql` | ✅ | `mkt_fin_post_checkout_ledger` + `checkout_cart_v2` (STEP 7) |

**Reconciliación final PDF ↔ Ledger ↔ Master Snapshot:**

| Master | PDF Total | SUM Snapshots | Ledger Total | Reconciled | Commission entries |
|---|---|---|---|---|---|
| MKP-2026-0002 | 10.25 € | 10.25 € | 10.25 € | ✅ true | 0 |
| MKP-2026-0003 | 15.31 € | 15.31 € | 15.31 € | ✅ true | 0 |

### Modelo de Ledger Elegido: B (Gross)

| Tipo de entrada | Fórmula | Fase 0 |
|---|---|---|
| `GOODS_ENTITLEMENT` | `goods_gross_snapshot` (mercancía + IVA) | ✅ escrito |
| `SHIPPING_ENTITLEMENT` | `shipping_gross_snapshot` (solo si > 0) | ✅ escrito si >0 |
| `COMMISSION_ACCRUAL` | `commission_net_snapshot` | **NO escrito** (INV-L03/L04, commission=0) |
| `TAX_ENTITLEMENT` | IVA separado | **NO** (incluido en gross) |

**Fórmula de reconciliación:**

```
INV-L01: GOODS_ENTITLEMENT(SO) + SHIPPING_ENTITLEMENT(SO) = provider_payable_snapshot(SO)
INV-L02: SUM(supplier economic totals) = master_order.checkout_gross_total
INV-L03: SUM(COMMISSION_ACCRUAL) = 0  (no escrito en Phase 0)
INV-L04: TrabFlow real marketplace revenue = 0  (mismo)
```

**Comisión simulada 2%:** NO escrita en ledger. Calculada via `simulation_rate` en reporting únicamente para análisis. Evita ambigüedad entre revenue real (0) e hipótesis analítica.

### Idempotencia

| Campo | Valor |
|---|---|
| `source_event_id` | `mkt-chk-{checkout_key}-{supplier_order_id}-GOODS` / `-SHIP` |
| `correlation_id` | `mkt-chk-{checkout_key}` (agrupa todas las entradas del mismo checkout) |

La función `mkt_fin_ledger_append` verifica `(source_event_id, entry_type, supplier_order_id)` — reintentar es seguro.

### Gates activos

| Gate | Estado |
|---|---|
| `STRIPE_GATE` | `payment.real_payments_enabled=false` — bloqueado, ledger simulado funciona ✅ |
| `TAX_GATE` | IVA en snapshots, no como entrada separada — pendiente dictamen fiscal ✅ |
| `INV-L03` | `COMMISSION_ACCRUAL` no escrita — commission=0 Phase 0 ✅ |
| `INV-L04` | TrabFlow real revenue=0 — confirmado ✅ |

### Componentes

| Archivo | Propósito |
|---|---|
| `supabase/migrations/20260822_11_mkt_fin_checkout_ledger.sql` | `mkt_fin_post_checkout_ledger` SECURITY DEFINER + `checkout_cart_v2` con STEP 7 no-blocking |
| `src/lib/marketplace/finance/checkout-ledger.service.ts` | Servicio TS: `postCheckoutLedger`, `getCheckoutLedgerEntries`, `verifyLedgerReconciliation` |
| `supabase/tests/test_checkout_initial_ledger.sql` | 20 tests L-01..L-20 validados contra cloud |

### Función SQL: mkt_fin_post_checkout_ledger

```sql
-- SECURITY DEFINER, SET search_path = public
-- Parámetros: p_master_order_id uuid
-- Retorno: {status, entry_count, correlation_id, suppliers_processed, master_order_num, model}
-- 1. STRIPE_GATE check
-- 2. Load master_order  → MASTER_ORDER_NOT_FOUND si inválido
-- 3. Auth: org_member OR platform_admin
-- 4. Correlation: 'mkt-chk-' || checkout_key
-- 5. Idempotencia: si ya hay entries con correlation_id → status='replayed'
-- 6. Audit: checkout_ledger_posting_started
-- 7. Loop SO con financial_snapshot_at: GOODS_ENTITLEMENT + SHIPPING_ENTITLEMENT (si >0)
-- 8. Validar suppliers_count > 0  → NO_SNAPSHOTTED_ORDERS si 0
-- 9. Outbox: 'marketplace.simulation.checkout_posted'
-- 10. Audit: checkout_ledger_posted
```

### STEP 7 en checkout_cart_v2 (no-blocking)

```sql
-- Si falla el ledger, el checkout ya está confirmado. El ledger es re-intentable.
BEGIN
  PERFORM public.mkt_fin_post_checkout_ledger(v_master_order.id);
EXCEPTION WHEN OTHERS THEN
  PERFORM public.mkt_fin_audit('checkout_ledger_failed', ...);
END;
```

### Tests L-01..L-20

| Test | Descripción | Resultado |
|---|---|---|
| L-01 | 1 proveedor → al menos 1 GOODS_ENTITLEMENT | ✅ PASSED |
| L-02 | 3 proveedores → 3 GOODS_ENTITLEMENT, 3 actores distintos | ✅ PASSED |
| L-03 | Idempotencia: segunda llamada → status=replayed, sin duplicados | ✅ PASSED |
| L-04 | Correlation: todos con `mkt-chk-{checkout_key}` | ✅ PASSED |
| L-05 | Provider attribution: actor_id = SO.actor_id en cada entrada | ✅ PASSED |
| L-06 | Master attribution: todos con master_order_id correcto | ✅ PASSED |
| L-07 | Supplier attribution: supplier_order_id válido en todas las entradas | ✅ PASSED |
| L-08 | INV-L01 (1 proveedor): GOODS+SHIP = provider_payable_snapshot | ✅ PASSED |
| L-09 | INV-L01 (3 proveedores): todos los proveedores reconcilados | ✅ PASSED |
| L-10 | INV-L02: SUM(supplier totals) = master.checkout_gross_total | ✅ PASSED |
| L-11 | SHIPPING_ENTITLEMENT.amount = shipping_gross_snapshot | ✅ PASSED |
| L-12 | Modelo B: GOODS_ENTITLEMENT = goods_gross (IVA incluido, no duplicado) | ✅ PASSED |
| L-13 | INV-L03: 0 COMMISSION_ACCRUAL entries | ✅ PASSED |
| L-14 | INV-L04: SUM(COMMISSION_ACCRUAL) global = 0 | ✅ PASSED |
| L-15 | Comisión simulada no en ledger, payable = snapshot | ✅ PASSED |
| L-16 | Snapshot immutability: amount = goods_gross_snapshot (no precio actual) | ✅ PASSED |
| L-17 | Todos los entries status=confirmed (policy change no afecta histórico) | ✅ PASSED |
| L-18 | Pedidos legacy sin ledger; financializar ID inválido → excepción | ✅ PASSED |
| L-19 | Rollback: master_order inválido → excepción, 0 entradas parciales | ✅ PASSED |
| L-20 | RLS: relrowsecurity=true, 3 actores distintos, policy ledger_select_own_actor existe | ✅ PASSED |

### Invariantes garantizadas

| Inv | Garantía | Mecanismo |
|---|---|---|
| INV-L01 | `GOODS_ENTITLEMENT + SHIPPING_ENTITLEMENT = provider_payable_snapshot` | Modelo B: amount = gross_snapshot |
| INV-L02 | `SUM(supplier ledger) = master.checkout_gross_total` | Loop atómico en función SECURITY DEFINER |
| INV-L03 | `SUM(COMMISSION_ACCRUAL) = 0` (Phase 0) | No-op: 7c comentado, nunca se llama |
| INV-L04 | TrabFlow real revenue = 0 | Mismo mecanismo que INV-L03 |
| INV-009 | Ledger append-only | Triggers inmutabilidad (heredados de Migración 06) |
| INV-007 | Amounts = snapshot de checkout (nunca catálogo actual) | Lee `goods_gross_snapshot`, no `precio_venta` |

### Archivos TypeScript (checkout-ledger.service.ts)

```typescript
export interface CheckoutLedgerResult   // {status, entryCount, correlationId, suppliersProcessed, masterOrderNum, model}
export interface CheckoutLedgerEntry    // {id, entryType, amount, currency, masterOrderId, supplierOrderId, actorId, ...}
export interface SupplierLedgerBreakdown // {supplierOrderId, actorId, providerPayableSnapshot, ledgerGoodsEntitlement, ...}
export interface LedgerReconciliation   // {masterOrderId, checkoutGrossTotal, ledgerEconomicTotal, reconciles, supplierBreakdown, ...}

export async function postCheckoutLedger(masterOrderId)        // RPC mkt_fin_post_checkout_ledger
export async function getCheckoutLedgerEntries(masterOrderId)  // SELECT ledger_entries WHERE master_order_id
export async function verifyLedgerReconciliation(masterOrderId) // INV-L01..L04 check completo
export { getLedgerEntriesForMasterOrder, getLedgerBalance }    // re-export de ledger.service
```

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
