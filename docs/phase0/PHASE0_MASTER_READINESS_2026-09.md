---
> **⚠️ STATUS: HISTORICAL / SUPERSEDED**
>
> Este documento fue la primera versión de Phase 0 Master Readiness (2026-09-05).
>
> **SUPERSEDED BY:**
> `docs/phase0/MASTER_READINESS_RECONCILIATION_REPORT_2026-09.md`
>
> **DATE:** 2026-09-06
>
> El documento reconciliado es la única fuente de verdad operativa para Phase 0.
> Este archivo se mantiene como referencia histórica.
> Para cualquier decisión de desarrollo, usar el documento reconciliado.
---

# TrabFlow — Phase 0 Master Application Review — HISTÓRICO
**Fecha:** 2026-09-05
**HEAD:** `1d7a9285ae8c9c04831fe1187ec49c292c8f12cb`
**Último commit:** `fix(maintenance): complete contract postal addresses`
**Branch:** `main`
**TSC:** 0 errores
**Vercel production:** READY
**Supabase:** 302/302 migrations applied remotely
**RECONCILIATION PASS:** 2026-09-05 — contradicciones resueltas con evidencia directa

> Este documento sustituye como referencia operativa a RC1_COMMERCIAL_READINESS.md, RC1_CHECKLIST.md y auditorías anteriores. No los borra — los complementa con el estado real a fecha de hoy.

---

## SOURCE OF TRUTH POLICY

**El código en producción y la BD en producción mandan sobre cualquier documento.**

| Fuente | Autoridad |
|--------|-----------|
| `supabase_migrations.schema_migrations` | Qué migrations están aplicadas en prod |
| `trade_client_errors` | Errores reales de frontend en producción |
| `QuoteAcceptView.tsx` / `AppDashboardView.tsx` | Comportamiento real del flujo quote→job |
| Memory files + docs/*.md | Contexto histórico — verificar antes de actuar |
| Este documento | Snapshot auditado 2026-09-05 — puede quedar desactualizado |

Si un documento dice X y el código/DB dice Y → confiar en Y, actualizar el documento.

---

## 1. EXECUTIVE SUMMARY

| Pregunta | Respuesta |
|---|---|
| ¿Es TrabFlow usable para pruebas Fase 0? | **SÍ** |
| ¿Pueden continuar los dos instaladores actuales? | **SÍ** |
| P0 (crítico) | **0** |
| P1 (bloquea flujo principal) | **2** |
| P2 (importante, no bloqueante) | **11** |
| P3 (mejora / polish / operacional) | ~27 (ver backlog) |
| GATED (dependencia externa) | **8** bloques principales |

**Top 5 prioridades inmediatas:**
1. Confirmar si el Word/DOCX del presupuesto llega al disco del instalador real (PH0-QUOTE-WORD-EXPORT)
2. Alertas en `trade_client_errors` — logging EXISTS pero nadie recibe aviso cuando hay errores
3. Quote→Job automático — REAL USER REQUEST × 2 instaladores (P2 confirmado)
4. Notas/instrucciones presupuesto en la ejecución — REAL USER REQUEST, verificar prefill completo (P2)
5. Push notifications en dispositivo real — infraestructura lista, sin validar en campo (P2)

**Mayor riesgo actual:** Los errores en producción se registran en `trade_client_errors` pero nadie recibe alerta — un fallo en Edge Function o RPC que afecte a los instaladores en pruebas pasaría sin notificación hasta que el instalador reporte.

**Mayor dependencia externa:** Constitución de TrabFlow Technologies S.L. — desbloquea NIF definitivo, activación VeriFactu, facturación correcta de planes Stripe, contratos legales marketplace.

**Próximo bloque de desarrollo:** Determinado por feedback real de los instaladores actuales. No preasignar catálogos de proveedores ni Portal Proveedor hasta confirmar qué bloquea realmente el flujo.

---

## 2. BASELINE ACTUAL

```
HEAD:            1d7a9285ae8c9c04831fe1187ec49c292c8f12cb
BRANCH:          main
LAST COMMIT:     fix(maintenance): complete contract postal addresses
VERCEL:          READY — alias www.trabflow.com, trabflow.com, trabflow.es
SUPABASE:        dqqjaujnulutinskmqsu (eu-central-1)
MIGRATIONS:      302/302 applied remotely (309 locales — 7 locales sin aplicar aún: ver §9)
TSC:             0 errores
EDGE FUNCTIONS:  29 desplegadas
WORKTREE:        4 archivos modificados sin commit (docs, supabase/.temp — no son código)
```

### Commits clave recientes (HEAD → -30)
| SHA | Fix | Estado |
|-----|-----|--------|
| `1d7a928` | Direcciones postales completas en contratos DOCX/HTML | PRODUCCIÓN |
| `c78a04f` | min-w-0 hero grid — columna derecha ads visible | PRODUCCIÓN ✅ VALIDADO |
| `c6aa180` | Breakpoints catálogo lg (revert xl) | PRODUCCIÓN ✅ VALIDADO |
| `8aca378` | Counter table para numeración fiscal (fn_emitir v11) | PRODUCCIÓN |
| `965f692` | Chain NIF + QR fiscal + installation_number immutability | PRODUCCIÓN |
| `9839b94` | Self-healing path: invoice_line en facturación recurrente | PRODUCCIÓN |
| `9e491f2` | Facturación recurrente mantenimiento unificada (cron) + Jardinería | PRODUCCIÓN |
| `d0f5b29` | Tests WhatsApp acceptance URL (38 PASS) | PRODUCCIÓN |
| `2d1e50e` | Fix interpolación plantilla legacy WhatsApp | PRODUCCIÓN |
| `15d7c8d` | Paginación print presupuesto+factura | PRODUCCIÓN |

---

## 3. MAPA DE MÓDULOS FUNCIONALES

### ERP Core

| Módulo | Estado | Notas |
|--------|--------|-------|
| Auth / Organizations | ✅ COMPLETE | Login, registro, reset, workspace selector, multi-tenant |
| Onboarding (7 pasos) | ✅ COMPLETE | Plantilla WhatsApp correcta desde `2d1e50e` |
| Dashboard | ✅ COMPLETE | KPIs, navegación, stats |
| Clientes (CRM) | ✅ COMPLETE | tipo_cliente, apellidos, datos fiscales, isFiscalComplete |
| Presupuestos | ✅ COMPLETE | Voz IA, foto IA, manual. PDF, Word, WhatsApp |
| Aceptación de presupuesto | ✅ COMPLETE | Token público, vista /quote-accept |
| WhatsApp | ✅ COMPLETE | Fix plantilla legacy + ensureAcceptanceUrl + 38 tests |
| PDF / impresión | ✅ COMPLETE | Paginación hardened (`15d7c8d`) |
| Word / DOCX export | ⚠️ NEEDS VALIDATION | Funciona en código; pendiente confirmar instalador real |
| Trabajos / Jobs | ✅ COMPLETE | Creación manual desde presupuesto aceptado |
| Planificación / Calendario | ✅ COMPLETE | Asignación de técnicos, slots de tiempo |
| Ruta del día | ✅ COMPLETE | Optimización de ruta, mapa |
| Trabajadores / Técnicos | ✅ COMPLETE | trade_workers, invitaciones, permisos |
| Partes de trabajo | ✅ COMPLETE | Firma digital, fotos, tokens públicos |
| Valoraciones post-trabajo | ✅ COMPLETE | /valorar/:token, trade_job_reviews |
| Subcontratas | ✅ COMPLETE | Trabajos externalizados |
| Ingresos / Gastos | ✅ COMPLETE | Seguimiento financiero básico |
| Facturación | ✅ COMPLETE | Ciclo completo, IVA configurable, conversión desde presupuesto |
| VeriFactu | ✅ INFRASTRUCTURE / 🔒 GATED | Kill switch activo. Activación bloqueada por gates externos |
| Contratos mantenimiento | ✅ COMPLETE | Firmables, DOCX, 14 cláusulas |
| Mantenimiento recurrente | ✅ COMPLETE | Cron billing, self-healing, Jardinería sector |
| Asistente técnico (normativa) | ⚠️ PARTIAL | Infraestructura RAG lista; corpus normativo parcial |
| Asistente IA presupuesto | ✅ COMPLETE | Motor v59, 98.2% OK rate, 400 casos validados |

### Marketplace

| Módulo | Estado | Notas |
|--------|--------|-------|
| Home comercial | ✅ COMPLETE | Hero carrusel, 8 ad slots, ads laterales corregidos |
| Catálogo / Búsqueda | ✅ COMPLETE | Filtros, oficio, texto libre, grid responsive |
| Comparador de proveedores | ✅ COMPLETE | Balance/Precio/Velocidad/Consolidar |
| Carrito | ✅ COMPLETE | Multi-proveedor, fuente quote/job/manual |
| Checkout | ✅ COMPLETE | 2 pasos: revisar + entrega + confirmar |
| Opciones entrega / pickup | ✅ COMPLETE | Locations, stock local, precio local |
| Seguimiento de pedido | ✅ COMPLETE | Realtime, timeline, estados |
| Mis pedidos (instalador) | ✅ COMPLETE | Historial, estados, tracking |
| Portal Proveedor | ⚠️ PARTIAL | Ver §3.1 |
| Finanzas Marketplace | ✅ INFRASTRUCTURE / 🔒 GATED | simulation_only=true; STRIPE_GATE/TAX_GATE/LEGAL_GATE cerrados |
| Documentos financieros | ✅ COMPLETE | Pantallas buyer+provider, admin |
| Publicidad / Campañas | ✅ COMPLETE | 8 slots, RPC, demo fallback. RIGHT_TOP expirada 2026-08-31 (P3: solo actualizar dato en DB) |
| Catálogo libre (Fase 3) | 🚫 NOT STARTED | Post-pilotos comerciales, no tocar |

### 3.1 Portal Proveedor — Estado por módulo

| Módulo | % Est. | Notas |
|--------|--------|-------|
| Navegación y acceso | 90% | Login, workspace, tabs |
| Dashboard / Centro de Acción | 65% | KPIs básicos, alertas, acciones |
| Catálogo propio | 65% | Gestión offerings, precio, stock |
| Importación masiva (CSV/Excel) | 40% | UI existe, flujo validado parcialmente |
| Sincronización ERP | 0% | API v1 existe (MVP-7), UI portal mínima |
| Pedidos entrantes | 65% | Lifecycle completo, confirmación, envío |
| Equipo / miembros actor | 25% | CRUD básico, sin roles granulares |
| Configuración | 60% | Datos actor, método pago manual |
| Reporting / KPIs | 25% | Pantalla existe, datos básicos |
| Locations / Tiendas | ✅ COMPLETE | CRUD completo, mapa, horarios |
| Marketing / Promociones | ✅ COMPLETE | Gestión promociones, scope local/regional/nacional |
| Onboarding guiado nuevo proveedor | 0% | Sin checklist ni guía en primer acceso |

### Admin Panel

| Módulo | Estado |
|--------|--------|
| Dashboard KPIs plataforma | ✅ COMPLETE |
| Gestión organizaciones/clientes | ✅ COMPLETE |
| Suscripciones y billing | ✅ COMPLETE |
| Centro Financiero | ✅ COMPLETE |
| Advertising panel | ✅ COMPLETE |
| AI Feedback / Normativa | ✅ COMPLETE |
| Proveedores marketplace | ✅ COMPLETE |
| Vista `trade_client_errors` | ❌ MISSING — no existe UI en admin para ver errores frontend |
| Grupos 8+ (docs, CRM) | 🔄 PENDING SPEC |

---

## 4. READINESS POR FLUJO CORE

### FLOW A — Instalador (presupuesto → factura)

```
Signup ✅ → Onboarding ✅ → Empresa ✅ → Cliente ✅ → Presupuesto ✅ →
WhatsApp ✅ → Aceptación ✅ → Trabajo (manual) ✅ → Planificación ✅ →
Ejecución ✅ → Parte+Firma ✅ → Factura ✅ → VeriFactu 🔒 GATED
```

**Estado:** FUNCTIONAL. El instalador puede completar el ciclo completo sin VeriFactu (factura regular).

**REAL USER REQUEST — Quote→Job:** La creación del trabajo desde presupuesto aceptado es manual: el instalador debe ir a Planificación, donde el presupuesto aceptado aparece en sidebar y se puede crear trabajo con datos prefilled (`prefillJobFromQuote.descripcion` → título en AppDashboardView línea 1130). Dos instaladores han pedido que esto sea automático. Clasificado P2, no "by design".

**REAL USER REQUEST — Notas en ejecución:** Se desconoce si las instrucciones adicionales del presupuesto (campo `descripcion` / notas al técnico) se propagan correctamente al parte de trabajo. Pendiente confirmar con instalador.

### FLOW B — Mantenimiento (contrato → factura recurrente)

```
Cliente ✅ → Contrato mantenimiento ✅ → Activación ✅ →
Cron billing (mensual/trimestral) ✅ → Borrador factura ✅ →
Incidencia/trabajo ✅ → Ejecución ✅ → Parte ✅ → Factura final ✅ → VeriFactu 🔒 GATED
```

**Estado:** FUNCTIONAL tras fixes `9e491f2` + `9839b94` + `1d7a928`.

**IMPORTANTE — VeriFactu compatible:** El cron de mantenimiento crea facturas en `trade_invoices` como Borrador. No llama a `fn_emitir_factura` ni crea registros fiscales. El instalador convierte manualmente a factura final. No hay automatismo incompatible.

**Jardinería:** Añadida como sector en `9e491f2`. Funcional.

### FLOW C — Marketplace (material → pedido → entrega)

```
Presupuesto aceptado ✅ → Marketplace ✅ → Búsqueda/catálogo ✅ →
Proveedor/comparador ✅ → Carrito ✅ → Checkout 2 pasos ✅ →
Master order ✅ → Supplier orders ✅ → Confirmación proveedor ✅ →
Preparación ✅ → Envío ✅ → Seguimiento realtime ✅ → Recepción ✅ →
Ledger simulado ✅ → Documentos financieros ✅
```

**Estado:** FUNCTIONAL. Validado en PZ-001A (2 ciclos E2E). Notificaciones push no probadas en dispositivo real.

**Finanzas Marketplace:** simulation_only=true. Todos los gates cerrados. Infraestructura preparada (Negative Balances + Reserves + Settlement Engine) pero sin dinero real.

### FLOW D — IA (voz → presupuesto → acción)

```
Voz/texto → trade-voice-to-quote (Anthropic) → presupuesto ✅ →
Motor IA v59 (98.2% OK) → artículos+precios → persistencia ✅ →
Feedback learning ✅ → Mejora continua ✅
```

**Estado:** FUNCTIONAL. El riesgo de datos incorrectos existe (el instalador revisa el carrito antes de confirmar — 2 pasos mitigan esto). Asistente técnico normativo: infraestructura RAG lista, corpus incompleto.

---

## 5. VALIDACIÓN CON INSTALADORES REALES

### Incidencias confirmadas y estado

| ID | Descripción | Clasificación | Estado |
|----|-------------|--------------|--------|
| REAL-001 | Plantilla WhatsApp con {variable} en lugar de {{variable}} → URL aceptación perdida | CONFIRMED BUG P1 | ✅ FIXED `2d1e50e` |
| REAL-002 | Marketplace columna derecha ads desplazada fuera de viewport (DPI 125%) | CONFIRMED BUG P1 | ✅ FIXED `c78a04f` VALIDATED |
| REAL-003 | Breakpoints catálogo xl en lugar de lg (sin sidebar en Marketplace) | CONFIRMED BUG P1 | ✅ FIXED `c6aa180` VALIDATED |
| REAL-004 | Word/DOCX presupuesto — ¿llega al disco? | OBSERVATION | ⚠️ PENDING confirmación real |
| REAL-005 | Workflow mantenimiento (incidencias, partes, cron billing) | REAL USER REQUEST | ✅ FIXED `9e491f2` + `9839b94` + `1d7a928` |
| REAL-006 | Jardinería como sector de mantenimiento | REAL USER REQUEST | ✅ IMPLEMENTED `9e491f2` |
| REAL-007 | Direcciones postales incompletas en contratos | CONFIRMED BUG | ✅ FIXED `1d7a928` |
| REAL-008 | Creación automática de trabajo desde presupuesto aceptado | **REAL USER REQUEST × 2** | P2 — manual actualmente, 2 instaladores lo han pedido |
| REAL-009 | Notas/instrucciones del presupuesto en la ejecución (parte técnico) | **REAL USER REQUEST** | P2 — pendiente confirmar si prefill está completo |

### Deferred / pendiente validación
- **QUOTE-TOKEN-DUPLICATES** (P2): múltiples tokens por presupuesto en retry. No causa confusión visible para el instalador pero puede crear duplicados en BD.
- **Push notifications en dispositivo real**: no probadas. Infraestructura existe (VAPID + trade_push_subscriptions).
- **Flujo marketplace desde móvil** (PZ-001E): no ejecutado. Pendiente.

---

## 6. VERIFACTU — ESTADO COMPLETO

### Estado producción (2026-09-05) — VERIFIED AGAINST `supabase_migrations.schema_migrations`

| Componente | Estado | SHA / Migration |
|-----------|--------|-----------------|
| fn_emitir_factura v11 | ✅ PRODUCCIÓN | `8aca378` |
| trade_invoice_counters (numeración atómica) | ✅ PRODUCCIÓN | `8aca378` |
| uq_fiscal_record_org_nif_numero (UNIQUE) | ✅ PRODUCCIÓN | `8aca378` |
| trg_protect_invoice_counter | ✅ PRODUCCIÓN | `8aca378` |
| fn_protect_verifactu_installation_number | ✅ PRODUCCIÓN | `965f692` |
| FiscalSnapshot / QR AEAT | ✅ PRODUCCIÓN | `965f692` |
| fn_crear_factura_rectificativa | ✅ PRODUCCIÓN | |
| VeriFactu XML builder + outbox worker | ✅ PRODUCCIÓN (kill switch) | |
| Chain particionada por NIF | ✅ PRODUCCIÓN | `965f692` |
| uq_org_nif_normalized (org NIF uniqueness) | ✅ PRODUCCIÓN CONFIRMADA | `20260901084437` — verificado en prod |
| trg_protect_org_nif_immutability | ✅ PRODUCCIÓN CONFIRMADA | `20260901084437` — verificado en prod |
| verifactu chain NIF partition | ✅ PRODUCCIÓN | `20260903152628` |
| installation_number immutability | ✅ PRODUCCIÓN | `20260903152632` |
| invoice number counters v2 | ✅ PRODUCCIÓN | `20260904083809` |

> **Nota reconciliación:** La versión anterior de este documento marcaba `20260901084437` como "⚠️ VERIFICAR estado en prod". Verificado directamente contra `supabase_migrations.schema_migrations` el 2026-09-05 — migration APLICADA. No hay contradicción. 302/302 es correcto e incluye todas las migrations VeriFactu listadas.

### Kill switch (INAMOVIBLE hasta empresa+NIF+AEAT)

| Campo | Valor verificado |
|-------|-----------------|
| installation_number | NULL |
| transmission_enabled | false |
| enabled | false |
| environment | 'disabled' |
| Outbox | 0 filas |

### Cadena fiscal real (INMUTABLE)

| Número | Cliente | Importe | Estado |
|--------|---------|---------|--------|
| F-2026-0001 | Real | 3.278,00 € | INMUTABLE |
| F-2026-0002 | Real | 1.482,82 € | INMUTABLE |

**Próxima factura:** F-2026-0003 (counter = 3).

### AEAT — Tabla de reconciliación

| Ref | Descripción | Estado | Fecha resolución |
|-----|-------------|--------|-----------------|
| HASH_NIF_POLICY | Normalización del NIF en construcción del hash | **CLOSED** | 2026-09-02 — USE EXACT FISCAL LITERAL; fn_emitir_factura usa trim() only — correcto |
| VF-CHAIN-NIF | Unicidad e inmutabilidad del NIF emisor en la cadena | **CLOSED** | Migration `20260901084437` aplicada en prod; 13/13 PASS |
| VF-PROD-2 | IndicadorMultiplesOT = "S" (Cabecera/SistemaInformatico, no por-factura) | **CLOSED — AEAT CONFIRMED** | Respuesta AEAT 2026-09-06 — valor "S" para SaaS multi-OT confirmado. DB: pendiente set `multiple_ot_indicator='S'` al activar. |
| VF-FISCAL-TEST-RECORDS-AUDIT | Auditoría registros de prueba | **PENDING** | Read-only cuando se autorice |
| VF-TEST-DATA-CLEANUP | Limpieza datos de prueba | **NOT AUTHORIZED** | — |

### Pendientes VeriFactu

| Ref | Estado |
|-----|--------|
| VF-FISCAL-TEST-RECORDS-AUDIT | PENDIENTE — read-only, sin autorización aún |
| VF-TEST-DATA-CLEANUP | NOT AUTHORIZED |
| VF-PROD-2 / IndicadorMultiplesOT | **CLOSED** — AEAT confirmó valor "S" (2026-09-06) — ya no es pregunta técnica abierta |
| T8B rollback tras counter | Diseñado, requiere Docker local |
| T9 concurrencia advisory lock | Diseñado, requiere 2 sesiones |
| Activación real transmisión | GATED — ver §10 |

---

## 7. MARKETPLACE — ESTADO COMPLETO

### Infraestructura lista

| Área | Estado |
|------|--------|
| Catálogo (9 actores demo, 178+ offerings) | ✅ Completo |
| Productos Universales | ✅ Funcional (cobertura baja para presupuestos reales) |
| Checkout + órdenes | ✅ Completo |
| Realtime tracking | ✅ Completo |
| Ledger financiero (simulación) | ✅ Completo |
| Sistema publicitario | ✅ Completo (RIGHT_TOP expirada 2026-08-31 — P3: solo renovar dato en DB) |
| Portal Proveedor | ⚠️ ~50-55% |
| Supplier API v1 | ✅ Completo (Bearer auth, sync catalog) |

### Gates Marketplace (NO implementar sin autorización)

| Gate | Bloquea |
|------|---------|
| LEGAL_GATE (dictamen jurídico L1-L11) | Rol jurídico TrabFlow, Stripe Connect, T&C proveedor |
| TAX_GATE (dictamen fiscal T1-T14) | Cadena de facturación materiales, IVA comisión |
| STRIPE_GATE | Pagos reales, transfers, payouts |
| COMPANY_GATE | Todo lo anterior |
| COMMISSION_GATE | Comisión >0% — DO NOT CHANGE |
| MP-FIN-3 | DO NOT START sin autorización explícita |

### Data Gap conocido

UP "Plato de ducha" (44b86c78) no unificado con UPs Saltoki (54777b80/b5402538). Impacto: recomendaciones IA sub-óptimas en ese producto específico. Baja urgencia.

---

## 8. SEGURIDAD Y DATOS

| Área | Estado | Observaciones |
|------|--------|---------------|
| RLS en tablas | ✅ COMPLETE | Implementado en todas las tablas sensibles |
| Autenticación Supabase | ✅ COMPLETE | Refresh tokens, workspace resolver usando cliente principal |
| service_role key | ✅ NOT IN REPO | Regla activa |
| VeriFactu worker (service_role only) | ✅ COMPLETE | `de38cbd` — anonymous → 401, anon JWT → 403 |
| Fiscal records immutability | ✅ COMPLETE | Triggers de protección en todas las tablas fiscales |
| Org isolation (RLS) | ✅ COMPLETE | Todo particionado por org_id |
| Edge Functions auth | ✅ COMPLETE | verify_jwt=true donde aplica |
| Frontend error logging | ✅ EXISTS — `trade_client_errors` | logError() + setupGlobalErrorHandlers() + React ErrorBoundary activos |
| Error alerting | ❌ MISSING | Nadie recibe notificación cuando se escribe en `trade_client_errors` |
| Admin UI para `trade_client_errors` | ❌ MISSING | No hay pantalla en panel admin para ver errores frontend |
| Uptime monitoring | ❌ MISSING | Sin alerta si cae la plataforma |
| 2FA/MFA | ❌ NOT IMPLEMENTED | Pendiente spec |
| Política contraseñas | ❌ NOT DOCUMENTED | Mínimo no definido |
| Auditoría de accesos UI | ❌ PARTIAL | Tabla admin_activity_log existe, UI de consulta incompleta |

### Observabilidad — estado real (auditado 2026-09-05)

**QUÉ EXISTE:**
- `trade_client_errors` table en Supabase (migration `20260625174310`)
- `logError()` en `src/lib/errorLogger.ts` — batch inserts a Supabase
- `setupGlobalErrorHandlers()` — captura `window.error` + `window.unhandledrejection`
- React `ErrorBoundary` en App.tsx (lines 773, 780)
- `setupGlobalErrorHandlers` llamado en App.tsx línea 341

**QUÉ SE HA REGISTRADO (últimos 30 días):**
- 20 errores totales — TODOS "Failed to fetch dynamically imported module"
- Chunks afectados: AppDashboardView, ScreenMarketplace, AdminView, PortalProveedorView, PortalMarketing
- Causa: pestaña abierta con chunk hash antiguo después de un nuevo deploy en Vercel → el chunk ya no existe en el CDN
- Diagnóstico: comportamiento normal post-deploy con Vite code-splitting, NO son errores de lógica de aplicación
- Sin errores de lógica, SQL, Edge Function ni autenticación en ese período

**QUÉ FALTA:**
1. Alerting — nadie recibe email/Slack cuando se insertan errores en `trade_client_errors`
2. Admin UI — ningún componente en `/admin` lee `trade_client_errors`
3. Uptime monitoring — sin status.trabflow.com ni ping externo

### DB / Supabase

| Área | Estado |
|------|--------|
| 302 migrations applied | ✅ — incluye todas las VeriFactu/maintenance |
| CLI tracking reconciliado | ✅ |
| db reset (fresh bootstrap) | ❌ Falla por referencias debacu_eval_* — no afecta producción |
| DB-DEBACU-RETIREMENT | 📋 PLANIFICADO — sobre proyecto actual, IDENTITY_PROTECTION_SET activo |

---

## 9. GATES EXTERNOS / CONSTITUCIÓN DE EMPRESA

| Gate | Bloquea | Urgencia |
|------|---------|---------|
| **Constitución TrabFlow Technologies S.L.** | Todo lo siguiente | BEFORE COMMERCIAL LAUNCH |
| **NIF definitivo sociedad** | Aviso Legal definitivo, VeriFactu, Stripe | BEFORE VERIFACTU ACTIVATION |
| **Alta censal / Hacienda** | VeriFactu, facturación oficial | BEFORE VERIFACTU ACTIVATION |
| **Certificado electrónico** | Firma digital real AEAT | BEFORE VERIFACTU ACTIVATION |
| **Activación VeriFactu AEAT** | Transmisión real | AFTER COMPANY + CERT |
| **Stripe empresarial verificado** | IVA correcto, facturación Stripe correcta | BEFORE COMMERCIAL LAUNCH |
| **Dictamen jurídico marketplace (L1-L11)** | Stripe Connect, rol jurídico, T&C | BEFORE REAL PAYMENTS |
| **Dictamen fiscal marketplace (T1-T14)** | Cadena facturación materiales, comisiones | BEFORE REAL PAYMENTS |
| **Contrato tipo Proveedor Marketplace** | Pilotos reales con distribuidores formales | BEFORE MORE SUPPLIERS |

**Estado constitución:** Estatutos redactados. NIF provisional B11792515 en Aviso Legal. Proceso en marcha pero no completado.

---

## 10. BACKLOG PRIORIZADO

Criterio de ordenación: **REAL INSTALLER FEEDBACK > CORE FLOW DEFECTS > VALIDATION INFRASTRUCTURE > CATALOG COMPLETENESS > SPECULATIVE FEATURES**

### P1 — Bloquea/dificulta seriamente pruebas actuales

| ID | Módulo | Descripción | Acción recomendada |
|----|--------|-------------|-------------------|
| P1-001 | Word export | PH0-QUOTE-WORD-EXPORT — confirmar si DOCX presupuesto llega al disco del instalador real. Si no llega: null guards + XML sanitización en exportWord.ts | Preguntar directamente al instalador |
| P1-002 | Observabilidad | `trade_client_errors` existe pero sin alertas — un fallo en prod puede pasar días sin notificarse | Añadir alerting (webhook Supabase → email/Slack) + admin UI |

### P2 — Importante, no bloquea validación actual

| ID | Módulo | Descripción |
|----|--------|-------------|
| P2-001 | Planificación | **REAL-008:** Quote→Job automático — 2 instaladores lo han pedido; actualmente manual desde ScreenPlanificacion |
| P2-002 | Partes / Ejecución | **REAL-009:** Notas/instrucciones del presupuesto en el parte técnico — pendiente confirmar prefill completo |
| P2-003 | Legal | Tabla de cookies específicas en Política de Cookies (nombre, duración, finalidad) |
| P2-004 | Legal | Períodos retención + transferencias internacionales en Privacidad |
| P2-005 | Stripe | Verificar IVA 21% correcto en facturas Stripe + modo live vs test |
| P2-006 | Push | Probar notificaciones push en dispositivo real Android/iOS |
| P2-007 | Marketplace mobile | Ejecutar PZ-001E (flujo completo marketplace desde móvil) |
| P2-008 | Catálogo | Vincular más Productos Universales para presupuestos reales (>6 actuales) — pendiente validación que sea bloqueante |
| P2-009 | Portal Proveedor | Onboarding guiado para primer acceso (checklist visible) — solo si proveedor real en pruebas lo necesita |
| P2-010 | QUOTE-TOKEN-DUPLICATES | Múltiples tokens por presupuesto en retry — baja visibilidad pero genera ruido en BD |
| P2-011 | Analytics | Funnel de conversión y eventos clave sin trackear |

### P3 — Mejora / polish / operacional

- RIGHT_TOP "Lamparas Led" expirada 2026-08-31 — renovar dato en DB, sin cambio de código (demo fallback activo)
- Emails transaccionales con HTML de marca (actualmente texto plano funcional)
- Tutorial in-app primer uso
- FAQ pública (15+ preguntas)
- Vídeo demo 60-90 segundos
- Email secuencias de activación (día 3, día 30, fin trial)
- Guión de demo estandarizado
- Argumento ROI en landing
- SPF/DKIM/DMARC para dominio email
- status.trabflow.com
- Open Graph tags landing
- Asistente técnico: corpus normativo completo (REBT, RITE, CTE)
- Dashboard AI feedback para admin
- Dashboard valoraciones por org
- Paridad móvil restante (filtros estado, asignar trabajadores)
- Modelos de presupuesto guardados (mejora UX)
- Recordatorios automáticos mantenimiento
- Canal soporte instaladores (WhatsApp/email con SLA < 24h) — operacional, no técnico

---

## 11. ROADMAP POR MOMENTO

### NOW — Mientras probamos con los 2 instaladores actuales

1. Preguntar al instalador real sobre PH0-QUOTE-WORD-EXPORT (¿llega el DOCX al disco?)
2. Preguntar al instalador real sobre REAL-009 (¿ven las notas del presupuesto al ejecutar el parte?)
3. Añadir alerting básico para `trade_client_errors` (webhook Supabase → email/Slack)
4. Añadir admin UI básica para ver `trade_client_errors` (read-only, filtro por fecha)
5. Renovar dato RIGHT_TOP campaign en DB (P3, operacional)

### BASED ON INSTALLER FEEDBACK — Siguiente sprint determinado por respuesta real

> Estas prioridades son provisionales y deben confirmarse con el feedback de los instaladores antes de comprometer desarrollo.

- Si REAL-008 (quote→job) es prioritario: implementar creación automática en QuoteAcceptView
- Si REAL-009 (notas ejecución) es prioritario: revisar y completar prefill en parte técnico
- Si REAL-004 (DOCX) falla en disco: diagnosticar y corregir exportWord.ts

### BEFORE MORE INSTALLERS — Antes de ampliar más allá de 2 instaladores

1. P1-002 operativo: alerting + admin UI para errores frontend
2. PZ-001E: ejecutar piloto marketplace desde móvil
3. Probar push notifications en dispositivo real
4. Cookies + privacidad (P2-003/P2-004) si hay nuevos instaladores externos

### BEFORE COMPANY FORMATION / PARALLEL

1. Recopilar feedback instaladores con documento estructurado
2. Completar dictámenes legal y fiscal marketplace
3. Preparar demo guión + datos coherentes para reuniones con distribuidores
4. Vídeo demo 60-90 segundos
5. Contrato tipo Proveedor redactado (asesor jurídico)

### AFTER COMPANY FORMATION

1. Actualizar NIF definitivo en Aviso Legal
2. Alta censal + Hacienda
3. Certificado electrónico
4. Verificar facturación Stripe con IVA correcto en modo live definitivo
5. VeriFactu: connection test con AEAT (sin transmisión real aún)

### BEFORE VERIFACTU REAL ACTIVATION

1. Todos los gates de empresa completados
2. VF-FISCAL-TEST-RECORDS-AUDIT (read-only, requiere autorización)
3. Activar installation_number + transmission_enabled en config
4. Prueba con factura real en AEAT homologación

### BEFORE MARKETPLACE REAL PAYMENTS

1. LEGAL_GATE: dictamen jurídico L1-L11 completado
2. TAX_GATE: dictamen fiscal T1-T14 completado
3. Rol jurídico TrabFlow determinado
4. Stripe Connect configurado con empresa constituida
5. T&C proveedor redactado y firmable
6. Activar comisión >0% (actualmente COMMISSION_GATE cerrado)

### BEFORE COMMERCIAL LAUNCH

1. Error monitoring + alerting operativo (P1-002)
2. Tutorial in-app funcional
3. FAQ pública
4. Emails transaccionales con HTML de marca
5. Analytics funnel y eventos clave
6. SPF/DKIM configurados

### LATER / POST-PHASE-0

- Marketplace Fase 3 (catálogo libre, carrito sin presupuesto)
- DB-DEBACU-RETIREMENT
- DAC7 reporting
- 2FA/MFA
- Paridad móvil avanzada
- Admin grupos 8+

---

## 12. DO NOT BUILD YET

| Item | Por qué esperar |
|------|----------------|
| Stripe Connect / pagos reales | Gates legal+tax no resueltos, empresa no constituida |
| Marketplace Fase 3 (catálogo libre) | Aprobado post-pilotos; no hay feedback real que lo demande hoy |
| Portal Proveedor al 100% | Completar basado en feedback real; no asumir que ~80% es el objetivo correcto |
| DAC7 reporting | Empresa no constituida, no hay transacciones reales |
| Real money movement / settlements (MP-FIN-3) | STRIPE_GATE cerrado + NO START sin autorización explícita |
| VeriFactu transmisión real | Kill switch activo; todos los gates externos abiertos |
| VeriFactu test data cleanup | NOT AUTHORIZED |
| Redesign visual / rebrand | Producto funciona; no hay feedback de percepción negativa crítica |
| Multilenguaje (i18n) | Sin demanda comprobada ahora |
| App Store / Play Store nativa | Solo si hay demanda comprobada |
| Módulo subvenciones/ayudas | Feature especulativa sin validación |
| +30 Productos Universales | Priorizar solo si instalador confirma que es el bloqueante |

---

## 13. PRÓXIMAS ACCIONES RECOMENDADAS

### Bloque A (inmediato, <1 semana)
1. **Preguntar al instalador real** sobre el Word/DOCX (¿llega el archivo al disco?)
2. **Preguntar al instalador real** sobre las notas del presupuesto en la ejecución (REAL-009)
3. **Añadir alerting** para `trade_client_errors` — webhook Supabase o cron que envíe email/Slack si hay nuevas filas
4. **Añadir admin UI** básica (tabla read-only) para ver `trade_client_errors` en el panel admin

### Bloque B (próximo sprint, determinado por respuesta instaladores)
1. Si DOCX no llega al disco → diagnosticar `exportWord.ts` + null guards
2. Si notas no se propagan → revisar prefill en planificación/parte técnico
3. Si quote→job es prioritario → implementar en QuoteAcceptView
4. **PZ-001E**: ejecutar piloto marketplace desde móvil

### Bloque C (post-feedback instaladores)
1. **Portal Proveedor**: completar módulos según feedback de proveedor real
2. **Demo guión estandarizado** + datos coherentes
3. **Legal/fiscal marketplace**: enviar consultas a asesores

---

## 14. CÓDIGO Y DATOS NO MODIFICADOS

```
CODE MODIFIED:  NO
DB MODIFIED:    NO
COMMIT:         NO
PUSH:           NO
DEPLOY:         NO
SUPABASE PUSH:  NO
```

---

*Documento generado: 2026-09-05 · Auditoría READ-ONLY sobre HEAD `1d7a928`*
*Reconciliation pass: 2026-09-05 — evidencia directa de Supabase y código fuente*
*Sustituye como referencia operativa a: RC1_COMMERCIAL_READINESS.md, RC1_CHECKLIST.md, EXECUTION_BOARD.md*
*Histórico preservado — no borrar documentos anteriores*
