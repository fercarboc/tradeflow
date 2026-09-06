# MASTER READINESS RECONCILIATION REPORT
## TrabFlow — Phase 0 Readiness · Snapshot 2026-09-05

**Snapshot date:** 2026-09-05
**HEAD audited:** `1d7a9285ae8c9c04831fe1187ec49c292c8f12cb`
**Branch:** `main`
**Last commit:** `fix(maintenance): complete contract postal addresses`
**Reconciliation pass:** 2026-09-05 — contradicciones resueltas con evidencia directa de Supabase y código fuente
**Final correction pass:** 2026-09-06 — AEAT/VF-PROD-2 reconciliado, OBS-1/2/3 con prioridades individuales, NOW reconstruido, gaps QR y working tree documentados
**Finalization pass:** 2026-09-06 — HASH_NIF_POLICY EXACT STRING MATCH verificado en código, VF-QR-OFFICIAL CLOSED (código ya correcto en `965f692`), worktree clasificado como EXPECTED PREEXISTING WORK, documento aprobado como SOURCE OF TRUTH operativa
**AEAT SaaS Multi-OT pass:** 2026-09-06 — Respuesta AEAT explícita: NumeroInstalacion (concepto CLOSED, valor GATED), IndicadorMultiplesOT = "S" (CLOSED), VF-CHAIN-NIF explícitamente confirmado. Corrección: IndicadorMultiplesOT es campo de Cabecera/SistemaInformatico (no por-factura).

> Este documento es la referencia operativa de Phase 0 tras el segundo pase de auditoría y reconciliación.
> No reemplaza los documentos históricos — los supercede como snapshot verificado.
> Sustituye como referencia activa a: `RC1_COMMERCIAL_READINESS.md`, `RC1_CHECKLIST.md`, `EXECUTION_BOARD.md`, primera versión de `PHASE0_MASTER_READINESS_2026-09.md`.

---

## 1. EXECUTIVE SUMMARY

| Campo | Valor |
|-------|-------|
| HEAD | `1d7a9285ae8c9c04831fe1187ec49c292c8f12cb` |
| Branch | `main` |
| Vercel production | READY — alias `www.trabflow.com`, `trabflow.com`, `trabflow.es` |
| Migration status | 302/302 applied remotely |
| TSC | 0 errores |
| Edge Functions | 29 desplegadas |
| Product status | **FUNCTIONAL — Phase 0 viable** |

### Current Installer Testing

| Estado | Detalle |
|--------|---------|
| Instaladores activos | 2 (PZ-001A completado, ciclos en curso) |
| Ciclos E2E completados | 2 (PZ-001A cerrado 2026-07-27) |
| Bloqueantes actuales | 0 bloqueantes duros — 2 items P1 operativos |
| Próximo hito | PZ-001B→E según feedback real recibido |

### Severidad del backlog

| Nivel | Cantidad |
|-------|----------|
| P0 — Crítico bloqueante | **0** |
| P1 — Dificulta pruebas actuales | **2** |
| P2 — Importante, no bloqueante | **11** |
| P3 — Mejora / polish / operacional | **~27** |
| GATED — Dependencia externa | **8 bloques principales** |

### Top 5 prioridades

| # | ID | Descripción | Nivel |
|---|----|-------------|-------|
| 1 | PH0-QUOTE-WORD-EXPORT | Confirmar físicamente si DOCX presupuesto llega al disco del instalador real | P1 |
| 2 | OBS-1 ALERTING | `trade_client_errors` registra errores pero nadie recibe aviso cuando ocurren — alerting mínimo suficiente para Phase 0 | P1 |
| 3 | REAL-008 | Quote→Job automático — REAL USER REQUEST × 2 instaladores | P2 |
| 4 | REAL-009 | Notas/instrucciones del presupuesto en la ejecución — REAL USER REQUEST, prefill sin confirmar | P2 |
| 5 | PUSH-REAL-DEVICE | Push notifications infraestructura lista, sin validar en dispositivo real | P2 |

### Mayor riesgo actual

Los errores de producción se registran en `trade_client_errors` pero nadie recibe alerta. Un fallo en Edge Function, RPC o autenticación que afecte a los dos instaladores en pruebas podría pasar días sin detectarse.

### Mayor dependencia externa

Constitución de **TrabFlow Technologies S.L.** — desbloquea NIF definitivo, activación VeriFactu real, facturación Stripe correcta, contratos legales marketplace, Aviso Legal definitivo.

---

## 2. SOURCE OF TRUTH POLICY

Las siguientes fuentes se ordenan por autoridad descendente. En caso de conflicto, prevalece la fuente de mayor autoridad.

| Prioridad | Fuente | Qué determina |
|-----------|--------|---------------|
| 1 | `supabase_migrations.schema_migrations` (producción) | Qué migrations están realmente aplicadas |
| 2 | Código desplegado en Vercel (HEAD verificado) | Comportamiento real del producto |
| 3 | `trade_client_errors` (producción) | Errores reales de frontend en campo |
| 4 | Feedback directo de instaladores | Prioridades reales de producto |
| 5 | Respuestas AEAT documentadas | Estado fiscal/normativo |
| 6 | Memory files + docs/*.md auditados | Contexto histórico — verificar antes de actuar |
| 7 | Documentos históricos (RC1, EXECUTION_BOARD) | Referencia, no autoridad |

**Regla:** Si un documento dice X y el código/DB/producción dice Y → confiar en Y, actualizar el documento.

**Aplicación de esta regla en este ciclo:**

- Documento decía "⚠️ VERIFICAR migración `20260901084437`" → verificado directamente: APLICADA. Corrección aplicada.
- Documento decía "Error monitoring: ❌ MISSING" → verificado en código: `trade_client_errors` + `errorLogger.ts` EXISTEN. Corrección aplicada.
- REAL-008 clasificado como "by design" → reclasificado como REAL USER REQUEST × 2 instaladores.
- RIGHT_TOP listado en Top 5 como prioridad técnica → reclasificado P3/operacional (demo fallback activo).

---

## 3. CURRENT BASELINE

```
HEAD:            1d7a9285ae8c9c04831fe1187ec49c292c8f12cb
BRANCH:          main
LAST COMMIT:     fix(maintenance): complete contract postal addresses
VERCEL:          READY
ALIASES:         www.trabflow.com · trabflow.com · trabflow.es
SUPABASE:        dqqjaujnulutinskmqsu (eu-central-1)
MIGRATIONS:      302 applied remotely / 309 local (7 local-only, no afectan producción)
TSC:             0 errores
EDGE FUNCTIONS:  29 desplegadas
WORKTREE:        4 archivos modificados sin commit (docs/, supabase/.temp — no son código de producción)
```

### Commits clave recientes

| SHA | Descripción | Estado |
|-----|-------------|--------|
| `1d7a928` | Direcciones postales completas en contratos DOCX/HTML | PRODUCCIÓN |
| `c78a04f` | min-w-0 hero grid Marketplace — columna derecha ads visible | PRODUCCIÓN ✅ VALIDADO DPI 125% |
| `c6aa180` | Breakpoints catálogo `lg` (revert `xl`) — sidebar Marketplace | PRODUCCIÓN ✅ VALIDADO |
| `965f692` | Chain NIF + QR fiscal + installation_number immutability | PRODUCCIÓN |
| `8aca378` | Counter table numeración fiscal + fn_emitir v11 | PRODUCCIÓN |
| `9839b94` | Self-healing invoice_line en facturación recurrente | PRODUCCIÓN |
| `9e491f2` | Facturación recurrente mantenimiento + Jardinería sector | PRODUCCIÓN |
| `d0f5b29` | Tests WhatsApp acceptance URL — 38 PASS | PRODUCCIÓN |
| `2d1e50e` | Fix interpolación plantilla legacy WhatsApp | PRODUCCIÓN |
| `15d7c8d` | Paginación print presupuesto + factura hardened | PRODUCCIÓN |

---

## 4. APPLICATION MODULE MAP

### ERP Core

| Módulo | Estado | Notas |
|--------|--------|-------|
| Auth / Organizations | ✅ COMPLETE | Login, registro, reset, workspace selector, multi-tenant |
| Onboarding (7 pasos) | ✅ COMPLETE | Plantilla WhatsApp correcta desde `2d1e50e` |
| Dashboard / KPIs | ✅ COMPLETE | Stats, navegación completa |
| Clientes (CRM) | ✅ COMPLETE | tipo_cliente, apellidos, datos fiscales, isFiscalComplete |
| Presupuestos | ✅ COMPLETE | Voz IA, foto IA, manual. PDF, Word, WhatsApp |
| Aceptación presupuesto | ✅ COMPLETE | Token público, vista `/quote-accept`, ensureAcceptanceUrl |
| WhatsApp | ✅ COMPLETE | Fix plantilla legacy + 38 tests PASS |
| PDF / impresión | ✅ COMPLETE | Paginación hardened `15d7c8d` |
| Word / DOCX export | ⚠️ NEEDS FIELD VALIDATION | Funciona en código; pendiente confirmar llegada al disco |
| Trabajos / Jobs | ✅ COMPLETE | Creación manual desde planificación con prefill de presupuesto |
| Planificación / Calendario | ✅ COMPLETE | Asignación técnicos, slots, `triggerNew` / `newJobTrigger` |
| Ruta del día | ✅ COMPLETE | Optimización de ruta, mapa |
| Trabajadores / Técnicos | ✅ COMPLETE | trade_workers, invitaciones, permisos |
| Partes de trabajo | ✅ COMPLETE | Firma digital, fotos, tokens públicos |
| Valoraciones post-trabajo | ✅ COMPLETE | `/valorar/:token`, trade_job_reviews |
| Subcontratas | ✅ COMPLETE | Trabajos externalizados |
| Ingresos / Gastos | ✅ COMPLETE | Seguimiento financiero básico |
| Facturación | ✅ COMPLETE | Ciclo completo, IVA configurable, conversión desde presupuesto |
| VeriFactu | ✅ INFRASTRUCTURE / 🔒 GATED | Kill switch activo. Activación bloqueada por gates externos |
| Contratos mantenimiento | ✅ COMPLETE | Firmables, DOCX, 14 cláusulas |
| Mantenimiento recurrente | ✅ COMPLETE | Cron billing, self-healing, Jardinería sector |
| Asistente técnico (normativa) | ⚠️ PARTIAL | Infraestructura RAG lista; corpus normativo incompleto |
| Asistente IA presupuesto | ✅ COMPLETE | Motor v59, 98.2% OK rate, 400 casos validados |

### Marketplace

| Módulo | Estado | Notas |
|--------|--------|-------|
| Home comercial | ✅ COMPLETE | Hero carrusel, 8 ad slots, ads laterales corregidos `c78a04f` |
| Catálogo / Búsqueda | ✅ COMPLETE | Filtros, oficio, texto libre, grid responsive |
| Comparador de proveedores | ✅ COMPLETE | Balance/Precio/Velocidad/Consolidar |
| Carrito | ✅ COMPLETE | Multi-proveedor, fuente quote/job/manual |
| Checkout | ✅ COMPLETE | 2 pasos: revisar + entrega + confirmar |
| Opciones entrega / pickup | ✅ COMPLETE | Locations, stock local, precio local |
| Seguimiento pedido | ✅ COMPLETE | Realtime, timeline, estados |
| Mis pedidos (instalador) | ✅ COMPLETE | Historial, estados, tracking |
| Portal Proveedor | ⚠️ ~50-55% | Ver §4.1 |
| Finanzas Marketplace | ✅ INFRASTRUCTURE / 🔒 GATED | simulation_only=true; todos los gates cerrados |
| Documentos financieros | ✅ COMPLETE | Pantallas buyer + provider + admin |
| Publicidad / Campañas | ✅ COMPLETE | 8 slots, RPC, demo fallback activo. RIGHT_TOP expirada = P3 operacional |
| Catálogo libre (Fase 3) | 🚫 NOT STARTED | Post-pilotos comerciales — DO NOT BUILD |

### 4.1 Portal Proveedor — detalle

| Módulo | % Completado | Notas |
|--------|-------------|-------|
| Navegación y acceso | 90% | Login, workspace, tabs |
| Dashboard / Centro de Acción | 65% | KPIs básicos, alertas, acciones rápidas |
| Catálogo propio | 65% | Gestión offerings, precio, stock |
| Importación masiva CSV/Excel | 40% | UI existe, flujo parcialmente validado |
| Sincronización ERP (Supplier API v1) | UI: 5% | API backend completa (MVP-7 Bearer auth); UI portal mínima |
| Pedidos entrantes | 65% | Lifecycle completo, confirmación, envío |
| Equipo / miembros | 25% | CRUD básico, sin roles granulares |
| Configuración actor | 60% | Datos, método pago manual |
| Reporting / KPIs | 25% | Pantalla existe, datos básicos |
| Locations / Tiendas | ✅ COMPLETE | CRUD, mapa, horarios |
| Marketing / Promociones | ✅ COMPLETE | Scope local/regional/nacional |
| Onboarding guiado nuevo proveedor | 0% | Sin checklist ni guía en primer acceso |

### Admin Panel

| Módulo | Estado |
|--------|--------|
| Dashboard KPIs plataforma | ✅ COMPLETE |
| Gestión organizaciones / clientes | ✅ COMPLETE |
| Suscripciones y billing | ✅ COMPLETE |
| Centro Financiero | ✅ COMPLETE |
| Advertising panel | ✅ COMPLETE |
| AI Feedback / Normativa | ✅ COMPLETE |
| Proveedores marketplace | ✅ COMPLETE |
| Vista `trade_client_errors` | ❌ MISSING — no existe UI para ver errores frontend |
| Grupos 8+ (docs, CRM admin) | 🔄 PENDING SPEC |

---

## 5. CORE FLOW READINESS

### FLOW A — Instalador: presupuesto → factura

```
Signup ✅ → Onboarding ✅ → Empresa ✅ → Cliente ✅ →
Presupuesto ✅ → WhatsApp ✅ → Aceptación ✅ →
Trabajo (manual ⚠️ REAL USER REQUEST) → Planificación ✅ →
Ejecución ✅ → Parte + Firma ✅ → Factura ✅ →
VeriFactu 🔒 GATED
```

**Estado:** FUNCTIONAL. Ciclo completo sin VeriFactu operativo.

**REAL USER REQUEST — Quote→Job (REAL-008):** La creación del trabajo desde presupuesto aceptado es manual. El instalador debe ir a Planificación, donde el presupuesto aparece en sidebar. El código `prefillJobFromQuote` existe (AppDashboardView línea 1130: `titulo: prefillJobFromQuote.descripcion.slice(0, 80)`) pero no hay llamada automática desde `QuoteAcceptView.tsx`. Dos instaladores han pedido automatización. Clasificado P2.

**REAL USER REQUEST — Notas ejecución (REAL-009):** Se desconoce si las instrucciones del presupuesto para el técnico se propagan completamente al parte. Pendiente confirmar con instalador real. Clasificado P2.

**VeriFactu:** Kill switch activo. Compatible con el flujo: el cron de mantenimiento crea borradores en `trade_invoices` sin llamar a `fn_emitir_factura` — no hay automatismo incompatible.

### FLOW B — Mantenimiento: contrato → factura recurrente

```
Cliente ✅ → Contrato mantenimiento ✅ → Activación ✅ →
Cron billing mensual/trimestral ✅ → Borrador factura ✅ →
Incidencia / trabajo ✅ → Ejecución ✅ → Parte ✅ →
Factura final ✅ → VeriFactu 🔒 GATED
```

**Estado:** FUNCTIONAL tras `9e491f2` + `9839b94` + `1d7a928`.
**Jardinería:** Sector añadido en `9e491f2` — funcional.
**Direcciones postales:** Completas desde `1d7a928`.

### FLOW C — Marketplace: material → pedido → entrega

```
Presupuesto aceptado ✅ → Marketplace ✅ → Búsqueda ✅ →
Comparador proveedores ✅ → Carrito ✅ → Checkout 2 pasos ✅ →
Master order ✅ → Supplier orders ✅ → Confirmación proveedor ✅ →
Preparación ✅ → Envío ✅ → Seguimiento Realtime ✅ →
Recepción ✅ → Ledger simulado ✅ → Documentos financieros ✅
```

**Estado:** FUNCTIONAL. Validado en PZ-001A (2 ciclos E2E).
**Finanzas:** simulation_only=true. Negative Balances + Reserves + Settlement Engine implementados pero sin dinero real. Todos los gates cerrados.
**Push en pedidos:** Infraestructura lista, sin validar en dispositivo real.

### FLOW D — IA: voz/texto → presupuesto → acción

```
Voz / texto → trade-voice-to-quote (Anthropic) →
Motor IA v59 (98.2% OK, 400 casos) →
Artículos + precios → Persistencia ✅ →
Feedback learning ✅ → Mejora continua ✅
```

**Estado:** FUNCTIONAL. El instalador revisa el carrito antes de confirmar (2 pasos de revisión mitigan riesgo de datos incorrectos). Asistente técnico normativo: RAG lista, corpus incompleto.

---

## 6. REAL INSTALLER VALIDATION

### Registro completo de incidencias

| ID | Descripción | Clasificación | Estado | SHA |
|----|-------------|--------------|--------|-----|
| REAL-001 | Plantilla WhatsApp `{variable}` en lugar de `{{variable}}` → URL de aceptación perdida | CONFIRMED BUG P1 | ✅ FIXED | `2d1e50e` |
| REAL-002 | Marketplace columna derecha ads desplazada fuera de viewport (DPI 125%, resolución real) | CONFIRMED BUG P1 | ✅ FIXED + VALIDATED | `c78a04f` |
| REAL-003 | Breakpoints catálogo `xl` (Marketplace no tiene sidebar — `lg` correcto) | CONFIRMED BUG P1 | ✅ FIXED + VALIDATED | `c6aa180` |
| REAL-004 | Word/DOCX presupuesto — ¿llega físicamente al disco del instalador? | OBSERVATION | ⚠️ PENDING — preguntar al instalador | — |
| REAL-005 | Workflow mantenimiento completo: incidencias, partes, cron billing | REAL USER REQUEST | ✅ IMPLEMENTED | `9e491f2` + `9839b94` + `1d7a928` |
| REAL-006 | Jardinería como sector de mantenimiento | REAL USER REQUEST | ✅ IMPLEMENTED | `9e491f2` |
| REAL-007 | Direcciones postales incompletas en contratos DOCX | CONFIRMED BUG | ✅ FIXED | `1d7a928` |
| REAL-008 | Creación automática de trabajo desde presupuesto aceptado | **REAL USER REQUEST × 2** | P2 — pendiente implementar | — |
| REAL-009 | Notas/instrucciones del presupuesto accesibles en la ejecución del parte | **REAL USER REQUEST** | P2 — pendiente confirmar prefill completo | — |

### Pendientes de validación en campo

| ID | Descripción | Estado |
|----|-------------|--------|
| QUOTE-TOKEN-DUPLICATES | Múltiples tokens por presupuesto en retry — ruido en BD | P2 — sin impacto visible para instalador |
| PUSH-REAL-DEVICE | Push notifications VAPID — infraestructura lista, sin probar en Android/iOS real | P2 |
| PZ-001E | Flujo marketplace completo desde móvil | P2 — no ejecutado |

---

## 7. VERIFACTU RECONCILIATION

### Estado en producción — verificado contra `supabase_migrations.schema_migrations`

> **RECONCILIACIÓN:** La versión anterior de este documento marcaba `20260901084437` como "⚠️ VERIFICAR estado en prod". Verificado directamente el 2026-09-05 contra producción — APLICADA. No existe contradicción. 302/302 es correcto e incluye todas las migrations VeriFactu.

| Componente | Estado | SHA / Migration |
|-----------|--------|-----------------|
| `fn_emitir_factura` v11 | ✅ VERIFIED PRODUCTION | `8aca378` |
| `trade_invoice_counters` (numeración atómica) | ✅ VERIFIED PRODUCTION | `8aca378` |
| `uq_fiscal_record_org_nif_numero` UNIQUE | ✅ VERIFIED PRODUCTION | `8aca378` |
| `trg_protect_invoice_counter` | ✅ VERIFIED PRODUCTION | `8aca378` |
| `fn_protect_verifactu_installation_number` | ✅ VERIFIED PRODUCTION | `965f692` |
| FiscalSnapshot / QR AEAT | ✅ VERIFIED PRODUCTION | `965f692` |
| `fn_crear_factura_rectificativa` | ✅ IMPLEMENTED | — |
| VeriFactu XML builder + outbox worker | ✅ IMPLEMENTED (kill switch activo) | — |
| Chain particionada por NIF emisor | ✅ VERIFIED PRODUCTION | `965f692` |
| `uq_org_nif_normalized` (org NIF uniqueness) | ✅ VERIFIED PRODUCTION | `20260901084437` ← CONFIRMED APPLIED |
| `trg_protect_org_nif_immutability` | ✅ VERIFIED PRODUCTION | `20260901084437` ← CONFIRMED APPLIED |
| verifactu chain NIF partition v2 | ✅ VERIFIED PRODUCTION | `20260903152628` |
| installation_number immutability trigger | ✅ VERIFIED PRODUCTION | `20260903152632` |
| invoice number counters tabla v2 | ✅ VERIFIED PRODUCTION | `20260904083809` |

### Kill switch — INAMOVIBLE hasta empresa + NIF + AEAT

| Campo | Valor producción |
|-------|-----------------|
| `installation_number` | NULL |
| `transmission_enabled` | false |
| `enabled` | false |
| `environment` | 'disabled' |
| Outbox rows | 0 |

### Registros fiscales reales — INMUTABLES

| Número | Estado |
|--------|--------|
| F-2026-0001 | REAL — INMUTABLE — NO rehash, NO renumber, NO delete |
| F-2026-0002 | REAL — INMUTABLE — NO rehash, NO renumber, NO delete |

Próxima factura: **F-2026-0003** (counter = 3).

### AEAT — Tabla de reconciliación completa

| Pregunta | Estado anterior | Evidencia AEAT | Respuesta recibida | Implementado | Verificado prod | Estado final |
|----------|----------------|----------------|-------------------|-------------|----------------|-------------|
| HASH_NIF_POLICY — literal NIF en hash | OPEN (VF-NIF-NORMALIZATION-GAP) | Memory + resolución 2026-09-02 | SÍ — USE EXACT FISCAL LITERAL, no upper()/lower() | SÍ — `fn_emitir_factura` usa `trim(v_org.nif)` | SÍ — F-2026-0001, F-2026-0002 | **CLOSED** |
| VF-CHAIN-NIF — unicidad + inmutabilidad NIF emisor | OPEN | Migration `20260901084437` verificada en prod 2026-09-05 | Requisito estructural confirmado | SÍ — UNIQUE INDEX + trigger | SÍ — aplicada en prod | **CLOSED** |
| TipoUsoPosibleMultiOT = S (capacidad SIF multi-OT) | Pendiente | `VF_AEAT_ARCHITECTURE.md` §4 | SÍ — "confirmado por AEAT" | SÍ — campo en system config | Config, no DB push | **CLOSED** |
| IndicadorMultiplesOT (campo Cabecera/SistemaInformatico — no por-factura) | OPEN — FROZEN | Respuesta directa AEAT 2026-09-06 | **SÍ — valor "S" confirmado por AEAT para SaaS multi-OT** | Pendiente: set `multiple_ot_indicator = 'S'` en DB (write, no autorizado aún — kill switch activo) | N/A — kill switch activo | **CLOSED — AEAT CONFIRMED** |
| NumeroInstalacion para SaaS cloud | PENDING | Respuesta directa AEAT 2026-09-06 | **SÍ — AEAT confirma: instalación SaaS usa un único NumeroInstalacion** | Pendiente: obtener valor real (company formation → registro AEAT → número asignado) | N/A — kill switch activo | **CLOSED (concepto) — GATED (valor real)** |
| VF-QR-OFFICIAL — formato QR correcto | GAP DETECTADO (SUPERSEDED) | `printTradeInvoice.ts` + `965f692` | Formato oficial: URL `ValidarQR?nif=...` (sin hash) | **SÍ — FIXED en `965f692`** | SÍ — `printTradeInvoice.ts` líneas 80-88 | **CLOSED** |
| Cadena hash canonical string (SHA-256) | — | `VF_AEAT_ARCHITECTURE.md` §7 confirma implementación | Spec normativa confirmada | SÍ | SÍ | **ALIGNED** |
| Acuerdo Tipo 17 (representación ante AEAT) | PENDING | `VF_AEAT_ARCHITECTURE.md` §5 | Requisito claro, sin firma aún | NO | NO | **GATED — Company Formation** |
| VF-FISCAL-TEST-RECORDS-AUDIT | PENDING | — | N/A — auditoría interna | NO — READ-ONLY cuando se autorice | NO | **PENDING — autorización previa** |
| VF-TEST-DATA-CLEANUP | NOT AUTHORIZED | — | N/A | NO | NO | **NOT AUTHORIZED** |

#### Notas de reconciliación AEAT

**HASH_NIF_POLICY — EXACT STRING MATCH verificado:**
- AEAT dijo: USE EXACT FISCAL LITERAL — no upper()/lower() entre el registro fiscal y el cálculo de la huella.
- Implementación en `fn_emitir_factura` (función atómica SECURITY DEFINER, mismo `v_org` en toda la ejecución):
  - `trade_fiscal_records.nif_emisor` almacena → `trim(v_org.nif)`
  - Hash input construye → `'IDEmisorFactura=' || trim(v_org.nif) || ...`
  - Ambas operaciones usan **la misma expresión** evaluada sobre **el mismo registro** en **la misma ejecución atómica**.
- Resultado: el literal fiscal persistido y el NIF usado para construir el hash son **byte-for-byte idénticos**. No es interpretación: es consecuencia directa de usar la misma expresión en la misma función.
- Clasificación: **ALIGNED — EXACT STRING MATCH verified**
- Los registros F-2026-0001 y F-2026-0002 usan NIF `13789524N` sin espacios. Los hashes son INMUTABLES — ningún rehash necesario ni autorizado.

**VF-PROD-2 — TODOS LOS CAMPOS CONFIRMADOS — Respuesta AEAT 2026-09-06:**

> AEAT (literal): *"Le confirmamos que su planteamiento es correcto. Dentro de una misma instalación SaaS (un único NumeroInstalacion e IndicadorMultiplesOT = 'S'), el encadenamiento de registros debe mantenerse de forma completamente INDEPENDIENTE para cada obligado tributario (NIF emisor). Bajo ninguna circunstancia se deben encadenar registros pertenecientes a obligados tributarios distintos."*

Ubicación real de los tres campos en el XML — bloque `<sum1:SistemaInformatico>` (Cabecera, estático por mensaje, NO por-factura):

| Campo XML | Valor | Código | Estado |
|-----------|-------|--------|--------|
| `TipoUsoPosibleMultiOT` | `S` | `buildVerifactuXml.ts:150` (hardcoded) | **CLOSED** — confirmado AEAT (previo) |
| `IndicadorMultiplesOT` | `S` | `buildVerifactuXml.ts:151` (desde `config.multipleOtIndicator`) | **CLOSED** — confirmado AEAT 2026-09-06 |
| `NumeroInstalacion` | pendiente valor | `buildVerifactuXml.ts:148` (desde `config.installationNumber`) | **CLOSED** concepto / **GATED** valor real |

⚠️ **Corrección documentación anterior:** `IndicadorMultiplesOT` NO es un campo por-factura. Está en `<sum1:SistemaInformatico>` (Cabecera), exactamente al mismo nivel que `NumeroInstalacion` y `TipoUsoPosibleMultiOT`. La descripción anterior "campo por-factura que indica si ESE OT concreto usa SIMULTÁNEAMENTE otro SIF" era confusión interna — no existe ningún campo AEAT por-factura con esa semántica en el XML SuministroLR.

`multiple_ot_indicator` en DB = NULL. Acción: set `'S'` cuando se autorice escritura en DB (no ahora — kill switch activo).

**VF-QR-OFFICIAL — CLOSED — verificado en código HEAD `1d7a928`:**
- `VF_AEAT_ARCHITECTURE.md §9` describía un formato propietario `VERIFACTU:{numero};{hash};{cif}` como implementación actual. Ese documento es **STALE / HISTORICAL** — describe el estado anterior a `965f692`. No modificar ese archivo en esta tarea; la referencia correcta es el código.
- Código actual (`printTradeInvoice.ts` líneas 80-88):
  ```
  https://www2.agenciatributaria.es/wlpl/TIKE-CONT/ValidarQR
    ?nif=fiscalSnapshot.nif_emisor
    &numserie=fiscalSnapshot.numero_factura
    &fecha=fiscalSnapshot.fecha_expedicion_vf
    &importe=fiscalSnapshot.importe_total.toFixed(2)
  ```
- **MATCH OFFICIAL FORMAT = YES.** Fuente: `trade_fiscal_records` snapshot inmutable. Fail-closed: si `fiscal_record_id` ausente o snapshot no coincide → QR omitido.
- **QR NO depende de `NumeroInstalacion`** — el URL no incluye ese campo. La afirmación anterior "Deferred — requiere NumeroInstalacion confirmado" era incorrecta.
- El QR se genera con la librería `qrcode` local — no hay llamada a `chart.googleapis.com` en el código actual.

**VF-CHAIN-NIF — CONFIRMACIÓN EXPLÍCITA AEAT 2026-09-06:**
La respuesta AEAT confirma explícitamente el diseño de cadena por NIF: *"el encadenamiento de registros debe mantenerse de forma completamente INDEPENDIENTE para cada obligado tributario (NIF emisor). El primer registro generado para el Obligado Tributario B (NIF B) NUNCA debe referenciar la huella del último registro generado para el Obligado Tributario A (NIF A)"*. Esto es exactamente lo que implementa VF-CHAIN-NIF (migration `20260901084437`) — cadena particionada por `org_id`/NIF en `trade_fiscal_records`. **CLOSED y EXPLÍCITAMENTE CONFIRMADO.**

**Documento no leído:** `docs/verifactu/informe final verifactu aeat.docx` — puede contener respuestas AEAT adicionales. No se puede leer en este ciclo (formato DOCX). Consultar manualmente antes de cualquier trabajo VeriFactu futuro.

### Constraints permanentes (DO NOT TOUCH)

- `transmission_enabled` / `installation_number` — NO MODIFICAR sin autorización explícita + empresa constituida + AEAT
- F-2026-0001 / F-2026-0002 — NO rehash, NO renumber, NO delete
- Outbox — NO PURGE sin VF-FISCAL-TEST-RECORDS-AUDIT completada y autorizada

---

## 8. MARKETPLACE READINESS

### Infraestructura

| Área | Estado | Observación |
|------|--------|-------------|
| Catálogo (9 actores demo, 178+ offerings) | ✅ COMPLETE | Cobertura demo adecuada |
| Productos Universales | ✅ FUNCTIONAL | Cobertura baja para presupuestos reales de campo |
| Checkout + órdenes multiproveedor | ✅ COMPLETE | Validado E2E en PZ-001A |
| Realtime tracking pedido | ✅ COMPLETE | Websocket + estados timeline |
| Ledger financiero (simulación) | ✅ COMPLETE | Negative Balances + Reserves + Settlement Engine |
| Sistema publicitario | ✅ COMPLETE | 8 slots, RPC, admin panel |
| Supplier API v1 | ✅ COMPLETE | Bearer auth SHA-256, sync catalog/stock/prices |
| Portal Proveedor | ⚠️ ~50-55% | Ver §4.1 |

### Publicidad — RIGHT_TOP

**Estado P3 / OPERACIONAL.** Campaña RIGHT_TOP "Lamparas Led" (electro) expiró `end_at=2026-08-31`. El demo fallback está activo (`rpcRowToAdCampaign` hardcodea `active: true`; el guard `!campaign.active` es arquitectónicamente inalcanzable). No hay pérdida de inventario. Renovar dato en DB cuando sea conveniente — es tarea operacional, no técnica prioritaria. **NO incluir entre las prioridades técnicas de desarrollo.**

### Marketplace Finance Gates (NO implementar sin autorización)

| Gate | Qué bloquea |
|------|-------------|
| LEGAL_GATE (dictamen L1-L11) | Rol jurídico TrabFlow, Stripe Connect, T&C proveedor |
| TAX_GATE (dictamen T1-T14) | Cadena facturación materiales, IVA comisión |
| STRIPE_GATE | Pagos reales, transfers, payouts |
| COMMISSION_GATE | Comisión >0% — NO TOCAR |
| MP-FIN-3 | DO NOT START sin autorización explícita |

### Data Gap conocido

UP "Plato de ducha" (`44b86c78`) no unificado con UPs Saltoki (`54777b80`/`b5402538`). Recomendaciones IA sub-óptimas en ese producto. Baja urgencia — no bloquea Phase 0.

---

## 9. SECURITY / DATA / OBSERVABILITY

### Seguridad y aislamiento de datos

| Área | Estado | Detalle |
|------|--------|---------|
| RLS en tablas sensibles | ✅ COMPLETE | Implementado en todas las tablas con datos de org |
| Org isolation (partición por org_id) | ✅ COMPLETE | Sin contaminación entre workspaces |
| Autenticación Supabase | ✅ COMPLETE | Refresh tokens, workspace resolver en cliente principal |
| service_role key | ✅ NOT IN REPO | Regla activa |
| VeriFactu worker (service_role only) | ✅ COMPLETE | `de38cbd` — anonymous → 401, anon JWT → 403 |
| Fiscal records immutability triggers | ✅ COMPLETE | Triggers en todas las tablas fiscales |
| Edge Functions auth | ✅ COMPLETE | `verify_jwt=true` donde aplica |
| 2FA / MFA | ❌ NOT IMPLEMENTED | Pendiente spec |
| Política contraseñas | ❌ NOT DOCUMENTED | Mínimo no definido |
| Auditoría de accesos (admin_activity_log) | ❌ PARTIAL | Tabla existe, UI de consulta incompleta |

### Observabilidad — auditoría directa 2026-09-05

**LOGGING — ✅ EXISTS**

| Componente | Estado |
|-----------|--------|
| `trade_client_errors` table | ✅ PRODUCCIÓN — migration `20260625174310` aplicada |
| `src/lib/errorLogger.ts` — `logError()` | ✅ ACTIVO — batch inserts a Supabase |
| `setupGlobalErrorHandlers()` | ✅ ACTIVO — captura `window.error` + `window.unhandledrejection` |
| React `ErrorBoundary` (App.tsx) | ✅ ACTIVO — wraps renders en líneas 773 + 780 |
| Inicialización | ✅ App.tsx línea 341 — `setupGlobalErrorHandlers` llamado en mount |

**QUÉ SE HA REGISTRADO (últimos 30 días — auditado directamente):**

| Tipo | Cantidad | Diagnóstico |
|------|----------|-------------|
| "Failed to fetch dynamically imported module" | 20 | Stale chunk hash post-deploy. Pestaña abierta con JS antiguo después de deploy en Vercel. NO son errores de lógica. |
| Errores de lógica / SQL / Edge Function | 0 | Sin errores de aplicación en el período auditado |

Páginas afectadas por stale chunks: `/app`, `/app/marketplace`, `/admin`, `/proveedor`. Causa técnica: Vite code-splitting con hash de contenido en nombre de archivo + CDN Vercel invalida chunks tras nuevo deploy. Comportamiento normal. No requiere corrección de código.

**OBS-1 — ALERTING — ❌ MISSING — P1**

Nadie recibe notificación cuando se insertan filas en `trade_client_errors`. Sin webhook, sin email, sin Slack. **Minimum viable solution para Phase 0:** webhook Supabase (Database → HTTP webhook) que envíe email/Slack cuando se crea una fila nueva. Sin nueva infraestructura. Sin Sentry. Sin BetterStack. Esto es suficiente para detectar en minutos un fallo real que afecte a los 2 instaladores en pruebas.

**OBS-2 — ADMIN VISIBILITY — ❌ MISSING — P2**

Ningún componente en `/admin` lee `trade_client_errors`. Los errores son invisibles sin acceso directo a Supabase. Útil, pero no urgente en Phase 0 si OBS-1 (alerting) está operativo — con alerting activo, los errores llegan por email/Slack. La pantalla admin es comodidad, no necesidad inmediata para 2 instaladores.

**OBS-3 — UPTIME MONITORING — ❌ MISSING — P3**

Sin `status.trabflow.com` ni ping externo. No hay alerta si la plataforma cae. Importante antes del lanzamiento comercial con más usuarios — no urgente durante Phase 0 con 2 instaladores que reportarían directamente si la app no carga.

> **Corrección respecto a versión anterior:** El documento decía "Error monitoring: ❌ MISSING". Incorrecto — el LOGGING existe y está activo (ver componentes arriba). Lo que falta se descompone ahora en OBS-1/2/3 con prioridades independientes.

---

## 10. EXTERNAL GATES / COMPANY FORMATION

| Gate | Qué bloquea | Urgencia |
|------|-------------|---------|
| **Constitución TrabFlow Technologies S.L.** | Todo lo siguiente | BEFORE COMMERCIAL LAUNCH |
| **NIF definitivo sociedad** | Aviso Legal definitivo, VeriFactu activación, Stripe verificado | BEFORE VERIFACTU |
| **Alta censal / Hacienda** | VeriFactu, facturación oficial, IVA correcto | BEFORE VERIFACTU |
| **Certificado electrónico AEAT** | Firma digital real, transmisión AEAT | BEFORE VERIFACTU |
| **Activación VeriFactu (AEAT)** | Transmisión real de facturas fiscales | AFTER COMPANY + CERT |
| **Stripe empresarial verificado** | Facturación Stripe con IVA correcto + modo live definitivo | BEFORE COMMERCIAL LAUNCH |
| **Dictamen jurídico marketplace (L1-L11)** | Stripe Connect, rol jurídico TrabFlow, T&C proveedor | BEFORE REAL PAYMENTS |
| **Dictamen fiscal marketplace (T1-T14)** | Cadena facturación materiales, IVA comisiones | BEFORE REAL PAYMENTS |
| **Contrato tipo Proveedor Marketplace** | Pilotos reales con distribuidores formales | BEFORE MORE SUPPLIERS |

**Estado constitución:** Estatutos redactados. NIF provisional B11792515 activo en Aviso Legal. Proceso en marcha pero no completado.

Estos gates son tareas administrativas y legales, **no bugs del producto**. No tratarlos como defectos técnicos en el backlog de desarrollo.

---

## 11. PRIORITIZED BACKLOG

**Criterio de ordenación:** REAL INSTALLER FEEDBACK > CORE FLOW DEFECTS > VALIDATION INFRASTRUCTURE > CATALOG COMPLETENESS > SPECULATIVE FEATURES

### P0 — Crítico / Bloqueante

*Ninguno.*

### P1 — Dificulta pruebas actuales

| ID | Módulo | Descripción | Evidencia | Estado | Siguiente acción |
|----|--------|-------------|-----------|--------|-----------------|
| P1-001 | Word / DOCX export | PH0-QUOTE-WORD-EXPORT — desconocemos si el DOCX llega al disco del instalador. Si no llega: diagnosticar `exportWord.ts` (null guards, XML sanitización) | REAL-004 observado en campo | PENDING FIELD CONFIRMATION | Preguntar directamente al instalador |
| P1-002 | OBS-1 Alerting | `trade_client_errors` registra errores en producción pero sin notificación — fallo real invisible hasta que instalador reporta. Solución mínima: webhook Supabase → email/Slack | Auditado directo 2026-09-05 | ALERTING MISSING | Configurar webhook DB en Supabase (sin código nuevo) |

### P2 — Importante, no bloquea validación actual

| ID | Módulo | Descripción | Evidencia | Prioridad | Estado | Dependencia |
|----|--------|-------------|-----------|-----------|--------|-------------|
| P2-001 | Planificación / Jobs | **REAL-008:** Quote→Job automático — 2 instaladores lo han pedido; actualmente manual desde ScreenPlanificacion (prefill existe en línea 1130) | × 2 instaladores | Alta si confirmado | PENDING | Requiere cambio en QuoteAcceptView |
| P2-002 | Partes / Ejecución | **REAL-009:** Notas/instrucciones del presupuesto en el parte técnico — prefill parcial confirmado (descripción → título), campo notas completo pendiente verificar | × 2 instaladores | Alta si confirmado | PENDING FIELD CONFIRMATION | Confirmar con instalador |
| P2-003b | OBS-2 Admin UI | Pantalla read-only en admin para ver `trade_client_errors` — tabla con filtros fecha/página/mensaje. No urgente si OBS-1 (alerting) está operativo | Auditado 2026-09-05 | MISSING | Añadir componente en AdminView |
| P2-003 | Legal | Tabla cookies específicas en Política de Cookies (nombre, duración, finalidad por cookie) | RC1_CHECKLIST | Media | PENDING | Externo: redacción legal |
| P2-004 | Legal | Períodos de retención + transferencias internacionales en Política de Privacidad | RC1_CHECKLIST | Media | PENDING | Externo: redacción legal |
| P2-005 | Stripe | Verificar IVA 21% correcto en facturas Stripe + modo live definitivo | No verificado | Media | PENDING | Company Formation Gate |
| P2-006 | Push | Probar notificaciones push en dispositivo real Android/iOS (VAPID + trade_push_subscriptions) | PZ-001A pendiente | Media | NOT TESTED | Dispositivo físico |
| P2-007 | Marketplace móvil | PZ-001E — flujo completo marketplace desde móvil no ejecutado | PZ-001A pendiente | Media | NOT EXECUTED | — |
| P2-008 | Catálogo UP | Vincular más Productos Universales — cobertura actual baja para presupuestos reales de campo | Observado en pilotos | Baja-Media | PENDING | Solo si instalador confirma que es bloqueante |
| P2-009 | Portal Proveedor | Onboarding guiado — sin checklist de primer acceso para proveedor nuevo | §4.1 | Baja-Media | NOT STARTED | Solo si proveedor real en pruebas |
| P2-010 | Presupuestos | QUOTE-TOKEN-DUPLICATES — múltiples tokens en retry, sin impacto visual pero ruido en BD | Identificado técnico | Baja | PENDING | — |
| P2-011 | Analytics | Funnel de conversión y eventos clave sin trackear | — | Baja | NOT STARTED | — |

### P3 — Mejora / polish / operacional

| ID | Módulo | Descripción |
|----|--------|-------------|
| P3-001 | Publicidad | RIGHT_TOP "Lamparas Led" expirada 2026-08-31 — renovar dato en DB, sin cambio de código (demo fallback activo) |
| P3-002 | Email | Templates HTML con logo y marca (texto plano funcional actualmente) |
| P3-003 | Onboarding | Tutorial in-app primer uso |
| P3-004 | Marketing | FAQ pública (15+ preguntas) |
| P3-005 | Marketing | Vídeo demo 60-90 segundos |
| P3-006 | Marketing | Email secuencias activación (día 3, día 30, fin trial) |
| P3-007 | Marketing | Guión de demo estandarizado + datos coherentes |
| P3-008 | Marketing | Argumento ROI en landing page |
| P3-009 | Infraestructura | SPF/DKIM/DMARC para dominio email |
| P3-010 | Infraestructura | status.trabflow.com / uptime monitoring |
| P3-011 | Landing | Open Graph tags |
| P3-012 | IA | Corpus normativo completo: REBT, RITE, CTE (asistente técnico) |
| P3-013 | Admin | Dashboard AI feedback |
| P3-014 | Admin | Dashboard valoraciones por org |
| P3-015 | Móvil | Paridad móvil restante (filtros estado, asignar trabajadores) |
| P3-016 | UX | Modelos de presupuesto guardados |
| P3-017 | Mantenimiento | Recordatorios automáticos revisión periódica (Bloque K) |
| P3-018 | Operacional | Canal soporte instaladores (WhatsApp/email, SLA < 24h) — no es item técnico |

### GATED — Bloqueado por dependencia externa

| ID | Descripción | Gate |
|----|-------------|------|
| G-001 | VeriFactu transmisión real | Company Formation + NIF + AEAT + Cert |
| G-002 | Stripe live definitivo / IVA correcto | Company Formation |
| G-003 | NIF definitivo en Aviso Legal | Company Formation |
| G-004 | Marketplace pagos reales (Stripe Connect) | LEGAL_GATE + TAX_GATE + STRIPE_GATE |
| G-005 | Comisión marketplace >0% | COMMISSION_GATE — DO NOT CHANGE |
| G-006 | MP-FIN-3 | DO NOT START — autorización explícita |
| G-007 | T&C proveedor firmable | LEGAL_GATE + Company Formation |
| G-008 | DAC7 reporting | Company Formation + transacciones reales |

---

## 12. ROADMAP BY TIMING

### NOW — Con los 2 instaladores actuales

1. **Confirmar PH0-QUOTE-WORD-EXPORT** — preguntar directamente al instalador: ¿el DOCX de presupuesto llega al disco cuando lo exporta? (P1-001)
2. **Confirmar REAL-009** — preguntar al instalador: ¿pueden ver las instrucciones/notas del presupuesto cuando ejecutan el parte técnico? (P2-002)
3. **Seguir recogiendo feedback real** — documentar qué bloquea o frena a los 2 instaladores en su flujo diario. No asumir prioridades sin datos.
4. **Minimum viable observability (OBS-1)** — configurar webhook Supabase → email/Slack para `trade_client_errors`. Sin nueva infraestructura, sin instalar librerías. (P1-002)
5. **Decidir REAL-008 quote→job** según prioridad confirmada por los pilotos — no implementar hasta saber si es lo que más les frena. (P2-001)

### BEFORE ADDING MORE INSTALLERS

> Estas prioridades son provisionales — confirmar con feedback real de los 2 instaladores actuales antes de comprometer desarrollo.

- OBS-1 alerting operativo (si no ya activo)
- OBS-2 admin UI para `trade_client_errors` — solo si OBS-1 resulta insuficiente (P2)
- PZ-001E: ejecutar flujo marketplace completo desde móvil
- Push notifications en dispositivo real (P2-006)
- Legal cookies + privacidad (P2-003/P2-004) si hay nuevos instaladores externos
- Implementar REAL-008 (quote→job) y/o REAL-009 (notas) si feedback los confirma como prioritarios

### PARALLEL / NON-BLOCKING

- Recopilar feedback instaladores con documento estructurado
- Preparar guión demo estandarizado + datos coherentes para reuniones con distribuidores
- Contactar asesor jurídico para dictámenes marketplace (L1-L11) y fiscal (T1-T14)
- Redactar contrato tipo Proveedor Marketplace
- Vídeo demo 60-90 segundos

### AFTER COMPANY FORMATION

1. Actualizar NIF definitivo en Aviso Legal
2. Alta censal + Hacienda
3. Obtener certificado electrónico AEAT
4. Verificar facturación Stripe con IVA correcto en modo live definitivo
5. VeriFactu: connection test con AEAT (sin transmisión real — validar endpoint)

### BEFORE REAL VERIFACTU ACTIVATION

1. Todos los gates de empresa completados
2. VF-FISCAL-TEST-RECORDS-AUDIT (read-only — requiere autorización previa)
3. ✓ IndicadorMultiplesOT = 'S' — **CONFIRMADO por AEAT 2026-09-06** (acción pendiente: set en DB al activar)
4. Obtener `NumeroInstalacion` real de AEAT (post-empresa) → set en `installation_number` + activar `transmission_enabled`
5. Prueba con factura real en entorno homologación AEAT

### BEFORE REAL MARKETPLACE PAYMENTS

1. LEGAL_GATE: dictamen jurídico L1-L11 completado
2. TAX_GATE: dictamen fiscal T1-T14 completado
3. Rol jurídico TrabFlow determinado
4. Stripe Connect configurado con empresa constituida
5. T&C proveedor redactado y firmable en plataforma
6. Activar comisión >0% (actualmente COMMISSION_GATE cerrado)

### BEFORE COMMERCIAL LAUNCH

1. Error alerting operativo (P1-002)
2. Tutorial in-app funcional
3. FAQ pública
4. Emails transaccionales con HTML de marca
5. Analytics funnel y eventos clave trackeados
6. SPF/DKIM configurados

### POST-PHASE-0 / LATER

- Marketplace Fase 3 (catálogo libre, carrito sin presupuesto obligatorio)
- DB-DEBACU-RETIREMENT (sobre proyecto Supabase actual)
- DAC7 reporting
- 2FA/MFA
- Paridad móvil avanzada
- Admin grupos 8+ (docs, CRM admin)
- Asistente técnico corpus normativo completo

---

## 13. DO NOT BUILD YET

| Item | Razón para esperar |
|------|-------------------|
| Stripe Connect / pagos reales | LEGAL_GATE + TAX_GATE no resueltos, empresa no constituida |
| Marketplace Fase 3 (catálogo libre) | Aprobado post-pilotos; sin feedback real que lo justifique hoy |
| Portal Proveedor al 100% | Completar basado en feedback de proveedor real en pruebas |
| +30 Productos Universales | Solo si instalador confirma que es bloqueante |
| DAC7 reporting | Empresa no constituida, sin transacciones reales |
| MP-FIN-3 | DO NOT START — requiere autorización explícita |
| VeriFactu transmisión real | Kill switch activo — todos los gates externos abiertos |
| VeriFactu test data cleanup | NOT AUTHORIZED |
| Redesign visual / rebrand | Sin feedback negativo crítico de percepción |
| Multilenguaje (i18n) | Sin demanda comprobada |
| App Store / Play Store nativa | Solo si hay demanda comprobada |
| Módulo subvenciones/ayudas | Feature especulativa sin validación |
| Cualquier feature nueva no demandada por instaladores | Prioridad: validar flujos actuales primero |

---

## 14. RECOMMENDED NEXT ACTIONS

Las siguientes acciones están ordenadas por impacto real para los dos instaladores actuales.

### Bloque A — Inmediato (preguntas, sin código)

1. **Preguntar al instalador real** sobre PH0-QUOTE-WORD-EXPORT: ¿el archivo DOCX llega al disco cuando exporta el presupuesto? (P1-001)
2. **Preguntar al instalador real** sobre REAL-009: ¿pueden ver las instrucciones del presupuesto cuando ejecutan el parte técnico? (P2-002)
3. **Recoger feedback estructurado** — ¿qué frena o molesta más en el día a día? Priorizar REAL-008 y otras peticiones según respuesta.

### Bloque B — Esta semana (mínima implementación)

4. **OBS-1 Alerting (P1-002):** Configurar webhook Supabase Database → email/Slack cuando se insertan filas en `trade_client_errors`. Sin código nuevo — configuración en Supabase Dashboard.

### Bloque C — Determinado por respuesta de instaladores

5. Si DOCX no llega → diagnosticar `exportWord.ts` (null guards, XML sanitización)
6. Si notas no se propagan → revisar y completar prefill en planificación/parte técnico (REAL-009)
7. Si quote→job es prioritario → implementar llamada automática en `QuoteAcceptView.tsx` (REAL-008)

### Bloque D — Antes de ampliar pilotos

8. **OBS-2 Admin UI (P2):** Añadir tabla read-only en admin para ver `trade_client_errors` — solo si OBS-1 resulta insuficiente para el seguimiento.
9. **PZ-001E:** Ejecutar flujo marketplace completo desde móvil.
10. **Push en dispositivo real:** Validar push notifications Android/iOS.

> No asumir que Portal Proveedor al 80%, +30 Productos Universales u otras features son automáticamente la siguiente prioridad sin feedback real que lo justifique.

---

## DOCUMENT STATUS

```
DOCUMENT STATUS:  APPROVED — OPERATIONAL SOURCE OF TRUTH FOR PHASE 0

APPROVAL DATE:    2026-09-06
SNAPSHOT DATE:    2026-09-05
FINAL PASS DATE:  2026-09-06
HEAD AUDITED:     1d7a9285ae8c9c04831fe1187ec49c292c8f12cb

SOURCE OF TRUTH   Referencia operativa de priorización y readiness de Phase 0
SCOPE:            sobre el HEAD auditado. No sustituye la evidencia futura de
                  código, producción, DB, feedback real de instaladores, ni nuevas
                  respuestas AEAT. Si HEAD cambia materialmente o aparecen nuevos
                  resultados de pilotos, este documento debe revalidarse.
LAST COMMIT:      fix(maintenance): complete contract postal addresses
BRANCH:           main

WORKING TREE:     4 source files modified but NOT staged / NOT committed
                  Classification: EXPECTED PREEXISTING WORK — continuation of 1d7a928

                  AppDashboardView.tsx   adds cp/ciudad/provincia to ScreenContratos
                                         props (×2 identical instances)
                  ScreenContratos.tsx    types props with cp?/ciudad?/provincia?;
                                         removes (cliente as any) casts → type-safe
                  contractTemplates.ts   clause 14 jurisdiction: replaces '[ CIUDAD ]'
                                         fallback with 'Juzgados y Tribunales competentes'
                  exportWord.ts          same clause 14 fix in downloadContractAsDocx()

                  exportWord.ts changes ARE NOT RELATED TO REAL-004 / PH0-QUOTE-WORD-EXPORT
                  REAL-004 affects downloadAsWordDocx() (presupuesto DOCX)
                  Worktree change is in downloadContractAsDocx() (contrato DOCX)
                  These are different functions on different code paths.

                  HEAD unchanged. Audit is against committed HEAD only.

CODE MODIFIED:    NO
DB MODIFIED:      NO
MIGRATIONS:       NO
COMMIT:           NO
PUSH:             NO
DEPLOY:           NO
SUPABASE PUSH:    NO
```

---

## SOURCE OF TRUTH REMINDER

Este documento es un snapshot auditado sobre el HEAD indicado.

**Debe revalidarse contra código/DB antes de ejecutar cualquier pendiente en fechas futuras.**

El código desplegado, la BD en producción y el feedback directo de instaladores prevalecen siempre sobre este documento si existe discrepancia.

*Histórico preservado — no borrar RC1_COMMERCIAL_READINESS.md, RC1_CHECKLIST.md, EXECUTION_BOARD.md ni PHASE0_MASTER_READINESS_2026-09.md*
