# TrabFlow — Product Roadmap por Dominios

**Versión:** 1.0 — Julio 2026  
**Estado:** Normativo. Basado en estado real del repositorio.  
**Propósito:** Vista funcional del estado de cada dominio del producto, con dependencias, prioridades y próxima fase.

---

## Leyenda de estados

| Icono | Estado |
|---|---|
| ✅ | Producción — funciona y está en uso |
| ⚠️ | Parcial — existe pero con limitaciones conocidas |
| 🔧 | En desarrollo activo |
| 📋 | Planificado — diseñado pero no implementado |
| ❌ | No existe |

---

## 1. ERP — Núcleo de gestión

### Estado general: ✅ Producción

| Funcionalidad | Estado | Notas |
|---|---|---|
| Presupuesto por voz (IA) | ✅ | v59, 98.2% OK rate benchmark 400 casos |
| Presupuesto por foto (IA) | ✅ | `trade-presupuesto-foto`, análisis visual |
| Presupuesto manual (wizard incremental) | ✅ | `ScreenPresupuestoIncremental` |
| PDF automático al guardar | ✅ | Generado en cliente, descarga inmediata |
| Export a Word (.docx) | ✅ | Libería docx v9.7.1 |
| Envío por WhatsApp (link + PDF) | ✅ | Modal con enlace del presupuesto |
| Aceptación del cliente por link | ✅ | Token UUID, vista pública `QuoteAcceptView` |
| Historial de presupuestos | ✅ | Filtros por estado, cliente, fecha |
| Facturas (desde presupuesto o manual) | ✅ | RPC `create_invoice_from_quote` |
| Vista pública de factura (token) | ✅ | `InvoicePublicView`, Edge Function |
| Clientes (CRUD, historial) | ✅ | Búsqueda, ficha completa |
| Trabajos (planificación, estados) | ✅ | `ScreenPlanificacion` |
| Partes de trabajo firmados | ✅ | Firma digital, vista pública |
| Valoraciones post-trabajo | ✅ | Link al cliente, `trade_job_reviews` |
| Ruta del día optimizada | ✅ | Nearest-neighbor + Haversine, Google Maps |
| Galería de fotos por trabajo | ✅ | `trade_job_photos`, Storage |
| Equipo (roles y permisos) | ✅ | 6 roles, `usePermissions` |
| Vista de técnico de campo | ✅ | `ScreenWorkerView` — acceso limitado |
| Subcontratas | ⚠️ | Solo plan empresa_plus |
| Ingresos y análisis financiero | ✅ | `ScreenIngresos` con gráficos |
| Export a CSV | ✅ | Datos de clientes, presupuestos, facturas |

**Dependencias:** Stripe (billing), Motor IA (voz a presupuesto), Catálogos (precios de material)  
**Prioridad actual:** Mantenimiento. Sin nuevas funcionalidades en el roadmap inmediato.  
**Próxima fase:** Deuda técnica — refactoring de `AppDashboardView.tsx` (post-PMF).

---

## 2. Marketplace (TrabFlow Connect)

### Estado general: ✅ Producción — en consolidación UX

| Funcionalidad | Estado | Notas |
|---|---|---|
| Catálogos de proveedor (CSV, búsqueda) | ✅ | `trade_supplier_catalogs` + `trade_supplier_products` |
| Búsqueda semántica de materiales | ✅ | PostgreSQL full-text, RPC `search_supplier_products` |
| Aprendizaje implícito de proveedor preferido | ✅ | 3 elecciones → auto-prioriza proveedor |
| Panel de comparación de proveedores | ✅ | Precio, plazo, disponibilidad |
| Checkout integrado (2 pasos) | ✅ | Revisar → Confirmar, auto-selección |
| Estrategias de selección (precio / plazo / preferido) | ✅ | Cambiable en StepRevisar |
| Seguimiento de pedido en tiempo real | ✅ | Supabase Realtime, canal `org-orders-{orgId}` |
| Timeline de estado del pedido | ✅ | `OrderTimeline` — diferente para instalador/proveedor |
| Historial de pedidos paginado | ✅ | HIST_PAGE_SIZE=20 |
| Confirmar recepción (instalador) | ✅ | Modal de confirmación |
| Portal proveedor — Dashboard | ✅ | Stats, insights IA, action center |
| Portal proveedor — Pedidos | ✅ | Confirmar, preparar, marcar enviado, buscar |
| Portal proveedor — Catálogo | ✅ | Offerings, vinculación con UP, IA matching |
| Portal proveedor — Equipo | ✅ | Roles por actor |
| Portal proveedor — Configuración | ✅ | Datos de la empresa proveedora |
| Notificaciones push al instalador | ✅ | Web Push / VAPID, outbox consumer |
| Realtime en portal proveedor | ❌ | Diferido — ADR-001 |
| Notificación email al proveedor (nuevo pedido) | ❌ | Planificado Sprint 2 |
| Registro auto-gestionado de proveedores | ❌ | Planificado Sprint 2 |
| Modelo de comisión (Stripe Connect) | ❌ | 2027 |
| Valoraciones de proveedores | ❌ | 2027 |
| Catálogo público de descubrimiento | ❌ | 2027 |
| Webhooks para ERP de proveedor | ❌ | 2027 |
| Cancelación de líneas individuales de pedido | ❌ | Backlog |

**Dependencias:** ERP (presupuesto como origen del carrito), Stripe (comisiones — 2027), Actores Marketplace  
**Prioridad actual:** Alta — consolidación UX para piloto comercial  
**Próxima fase:** Fase 2 (Consolidación UX) → Fase 4 (Sprint 2 Marketplace)

---

## 3. Motor IA

### Estado general: ✅ Producción — en desarrollo de observabilidad

| Funcionalidad | Estado | Notas |
|---|---|---|
| Voz a presupuesto | ✅ | v59, 98.2% OK, max_tokens=8192 |
| Transcripción de audio (OpenAI Whisper) | ✅ | `trade-voice-to-quote` |
| Extracción de partidas (Claude Haiku 4.5) | ✅ | Prompt v59, kbContext de 5 actuaciones |
| Base de conocimiento por oficio (`trade_actuaciones`) | ✅ | 20+ oficios, seeds SQL |
| Presupuesto por foto | ✅ | `trade-presupuesto-foto`, análisis visual Claude |
| Análisis de parte de trabajo | ✅ | `trade-parse-parte` |
| OCR / escaneo de foto | ✅ | `trade-photo-scan` |
| Benchmark oficial (400 casos) | ✅ | AI Validation Center |
| Centro de validación (Admin Panel) | ✅ | Versiones, benchmarks, runs, RC |
| Regression Diff entre versiones | ❌ | Sprint 4 P2 — pendiente |
| Dashboard de observabilidad en producción | ❌ | Sprint 4 P3 — pendiente |
| SLA de latencia con alertas | ❌ | Sprint 4 P5 — pendiente |
| Mejora de detección de oficio | 📋 | Sprint 4 P4 — condicionado a análisis |
| Optimización de contexto para reformas complejas | 📋 | Sprint 5 — VACÍO residual pos.374 |
| Motor IA en app móvil | ⚠️ | Disponible en web, no integrado en Expo |

**Dependencias:** `trade_actuaciones` (KB), `trade_ai_versions` (registro de versiones), `trade_benchmarks` (validación)  
**Prioridad actual:** Media — P2 Regression Diff como prerequisito para P3-P6  
**Próxima fase:** Fase 3 (Sprint 4 Motor IA)

---

## 4. Asistente Técnico (Normativa)

### Estado general: ✅ Producción

| Funcionalidad | Estado | Notas |
|---|---|---|
| Consulta REBT (Reglamento Electrotécnico) | ✅ | Plan basico+ |
| Consulta RITE (Instalaciones Térmicas) | ✅ | Plan pro+ |
| Consulta AEAT (fiscal, IVA, autónomos) | ✅ | Plan empresa+ |
| Consulta SS (Seguridad Social) | ✅ | Plan empresa+ |
| Consulta DGT (flotas, vehículos) | ✅ | Plan empresa+ |
| Consulta CTE (Código Técnico Edificación) | ⚠️ | Plan empresa_plus — parcial (falta CTE DB-SE, DB-SUA, DB-HR) |
| Consulta IDAE (climatización, ACS) | ⚠️ | Plan empresa_plus — pendiente PDFs |
| Consulta normativa de oficio (fontanería, electricidad, etc.) | ✅ | Plan basico+ |
| Versión pública (sin login) | ✅ | `AsistenteTecnicoPublicView` |
| Límites diarios por plan | ✅ | Configurado en Edge Function |
| Respuestas con referencia al artículo | ✅ | Voyage AI embeddings + Claude |

**Dependencias:** Chunks vectorizados en Supabase (pgvector), plan del usuario  
**Prioridad actual:** Baja — funciona correctamente, pendiente completar PDFs de CTE e IDAE  
**Próxima fase:** Añadir PDFs pendientes (CTE DB-SE, DB-SUA, DB-HR, IDAE) cuando estén disponibles.

---

## 5. Contratos de Mantenimiento (SAT)

### Estado general: ✅ Producción

| Funcionalidad | Estado | Notas |
|---|---|---|
| Creación de contratos de mantenimiento | ✅ | Wizard `ScreenMantenimientoWizard` |
| Tipos de contrato configurables | ✅ | SLA, sectores, oficios, plantillas |
| Incidencias y notificaciones | ✅ | `trade-maintenance-detect` (IA) |
| Facturación automática periódica | ✅ | `trade-maintenance-billing` + `trade-cron-daily` |
| Planes de mantenimiento generados por IA | ✅ | `trade-maintenance-generate` (Claude) |
| Partes de mantenimiento | ✅ | `trade-maintenance-parte` |
| Emails de mantenimiento | ✅ | `trade-maintenance-email` |
| Exportación de contrato a Word (DOCX) | ✅ | 14 cláusulas, `downloadContractAsDocx` |
| Modelos de contrato reutilizables | ✅ | `trade_maintenance_modelos` |
| Presupuestos de mantenimiento | ✅ | `trade_maintenance_presupuestos` |

**Dependencias:** Clientes, Edge Functions (`trade-cron-daily` vía pg_cron)  
**Prioridad actual:** Mantenimiento. Sin nuevas funcionalidades planificadas.  
**Próxima fase:** No hay.

---

## 6. Portal Cliente

### Estado general: ⚠️ Parcial

| Funcionalidad | Estado | Notas |
|---|---|---|
| Vista pública de presupuesto (token) | ✅ | `QuoteAcceptView`, cliente puede aceptar |
| Vista pública de factura (token) | ✅ | `InvoicePublicView` |
| Vista pública de parte de trabajo (token) | ✅ | `ParteView` |
| Valoración post-trabajo (token) | ✅ | `ReviewView` |
| Portal cliente autenticado | ❌ | No existe — el cliente no tiene cuenta |
| Historial de trabajos para el cliente | ❌ | No existe |
| Chat cliente ↔ instalador | ❌ | No existe |

**Dependencias:** ERP, tokens públicos  
**Prioridad actual:** No planificado para 2026.  
**Próxima fase:** Post-PMF — el portal cliente autenticado es una funcionalidad de expansión, no de MVP.

---

## 7. Portal Proveedor

### Estado general: ✅ Producción (ver también sección Marketplace)

| Funcionalidad | Estado | Notas |
|---|---|---|
| Dashboard con stats y health score | ✅ | `PortalDashboard` |
| Gestión de pedidos recibidos | ✅ | `PortalPedidos` — confirmar, preparar, enviar |
| Gestión de catálogo de offerings | ✅ | `PortalCatalogo` — vinculación con UP, IA matching |
| Configuración de la cuenta | ✅ | `PortalConfiguracion` |
| Gestión de equipo | ✅ | `PortalEquipo` |
| Insights IA accionables | ✅ | `get_supplier_ai_insights` RPC |
| Health score del proveedor | ✅ | `get_supplier_health_score` RPC |
| Notificaciones del proveedor | ✅ | `get_supplier_notifications` + `mark_notifications_read` |
| Realtime (nuevos pedidos sin recargar) | ❌ | ADR-001 — diferido |
| Registro auto-gestionado | ❌ | Sprint 2 |
| Email de alerta por pedido nuevo | ❌ | Sprint 2 |
| Informe de ventas / liquidaciones | ❌ | 2027 |

**Dependencias:** Sistema de actores Marketplace, Catálogo universal  
**Prioridad actual:** Consolidación UX  
**Próxima fase:** Sprint 2 — Realtime, registro auto-gestionado, notificación email

---

## 8. Fabricantes

### Estado general: ❌ No existe

El módulo de fabricantes (visibilidad de marca en el catálogo, tipo "Amazon Ads para instaladores") está identificado como canal 4 en la estrategia comercial pero no tiene implementación.

**Prioridad actual:** Post-PMF — solo cuando existan ingresos recurrentes de instaladores y proveedores.

---

## 9. Stripe y Billing

### Estado general: ✅ Producción

| Funcionalidad | Estado | Notas |
|---|---|---|
| Trial gratuito de 3 meses | ✅ | `trade_subscriptions.trial_end` |
| Checkout de suscripción | ✅ | `trade-stripe-checkout` |
| Portal de cliente (gestión de suscripción) | ✅ | `trade-stripe-portal` |
| Webhooks de Stripe | ✅ | `trade-stripe-webhook` |
| Planes: basico, pro, profesional, empresa, empresa_plus | ✅ | Desbloqueando módulos progresivamente |
| Admin: activar/suspender suscripciones | ✅ | RPC `admin_set_subscription_active` |
| Código de referido | ✅ | RPC `apply_referral_code` |
| Stripe Connect (comisiones por pedido) | ❌ | 2027 |
| Facturación B2B para proveedores | ❌ | 2027 |

**Dependencias:** `trade_subscriptions`, `trade_organizations`  
**Prioridad actual:** Mantenimiento.  
**Próxima fase:** Stripe Connect (2027) para el modelo de comisión.

---

## 10. App Móvil (Expo / React Native)

### Estado general: ⚠️ Parcial — cobertura mínima

| Funcionalidad | Estado | Notas |
|---|---|---|
| Login / autenticación | ✅ | Supabase Auth |
| Dashboard básico | ✅ | KPIs principales |
| Vista de clientes | ✅ | Lista + ficha básica |
| Crear presupuesto (básico) | ✅ | Sin IA por voz |
| Preview de presupuesto | ✅ | |
| Configuración / settings | ✅ | |
| Onboarding | ✅ | |
| Presupuesto por voz (IA) | ❌ | Disponible en web, no en móvil |
| Partes de trabajo con firma | ❌ | Solo web |
| Seguimiento de material | ❌ | Solo web |
| Planificación y ruta del día | ❌ | Solo web |
| Marketplace / Portal | ❌ | Solo web |
| Notificaciones push nativas | ❌ | Solo web push |
| Mantenimiento SAT | ❌ | Solo web |

**Dependencias:** Web (misma API de Supabase)  
**Prioridad actual:** Baja en 2026. Alta en 2027.  
**Próxima fase:** 2027 — añadir flujos críticos de campo: voz, partes, seguimiento material, ruta del día.

---

## 11. Analytics y Observabilidad

### Estado general: ⚠️ Parcial

| Funcionalidad | Estado | Notas |
|---|---|---|
| Dashboard de KPIs (Admin) | ✅ | Orgs, usuarios, billing, churn |
| AI Validation Center | ✅ | Benchmarks, versiones, runs |
| Logger de errores de cliente | ✅ | `trade_client_errors`, batch |
| Dashboard de observabilidad del motor IA | ❌ | Sprint 4 P3 |
| SLA del motor IA con alertas | ❌ | Sprint 4 P5 |
| Analytics de uso de Marketplace (GMV, pedidos/día) | ❌ | 2027 |
| Funnel de conversión de instaladores | ❌ | 2027 |
| Reporting para proveedores | ❌ | 2027 |

**Dependencias:** Admin Panel, Motor IA  
**Prioridad actual:** Sprint 4 — observabilidad del motor IA  
**Próxima fase:** Fase 3 (Sprint 4 Motor IA)

---

## 12. Admin Panel

### Estado general: ✅ Producción

| Funcionalidad | Estado | Notas |
|---|---|---|
| KPIs de la plataforma | ✅ | Orgs activas, usuarios, MRR estimado, churn |
| Gestión de organizaciones | ✅ | Activar/suspender, cambiar plan |
| Gestión de suscripciones | ✅ | `admin_set_subscription_active` |
| Waitlist / leads | ✅ | `admin_get_waitlist_leads` |
| Sistema documental corporativo | ✅ | `AdminDocumentosSection` — `trade_documents` |
| Repositorio de normativa | ✅ | `AdminRepositorioSection` — chunks vectorizados |
| Gestión de proveedores/catálogos | ✅ | `AdminSuppliersSection` — CSV upload, matching |
| AI Validation Center | ✅ | `AdminAIValidationSection` — benchmarks, versiones |
| Envío de emails desde admin | ✅ | `EmailModal` |
| Notas de soporte | ✅ | `admin_support_notes` |
| Regression Diff IA | ❌ | Sprint 4 P2 |
| Dashboard de observabilidad IA | ❌ | Sprint 4 P3 |

**Dependencias:** Solo acceso por `ADMIN_EMAIL` env var  
**Prioridad actual:** Sprint 4 — ampliar AI Validation Center  
**Próxima fase:** Fase 3 (Sprint 4)

---

## 13. Chatbot y Soporte

### Estado general: ✅ Producción

| Funcionalidad | Estado | Notas |
|---|---|---|
| Chatbot flotante en app | ✅ | `ChatbotWidget`, Claude Haiku |
| Conocimiento de todos los módulos | ✅ | System prompt completo |
| Registro de preguntas sin respuesta | ✅ | `trade_installer_needs` |
| Soporte por email | ⚠️ | Manual — no automatizado |
| Base de conocimiento pública | ❌ | No existe |
| Tickets de soporte | ❌ | No existe |

**Dependencias:** `trade-chatbot` Edge Function, Claude Haiku  
**Prioridad actual:** Mantenimiento.  
**Próxima fase:** Base de conocimiento pública (post-PMF).

---

## 14. API e Integraciones

### Estado general: ❌ No existe API pública

| Funcionalidad | Estado | Notas |
|---|---|---|
| API pública REST | ❌ | 2027 |
| API de catálogo para ERP de proveedor | ❌ | 2027 |
| Webhooks de pedidos | ❌ | 2027 |
| Integración Holded / Sage | ❌ | Post-PMF |
| Integración SAP (grandes proveedores) | ❌ | Post-PMF |
| Integración ERPs de instaladores | ❌ | Post-PMF |

**Dependencias:** Modelo de comisión, pilotos con proveedores  
**Prioridad actual:** No planificado para 2026.  
**Próxima fase:** 2027 — tras modelo de comisión operativo.

---

## Dependencias críticas entre dominios

```
Motor IA
    → ERP (genera partidas del presupuesto)
    → Catálogos (enriquece con precios de material)

ERP (Presupuesto)
    → Marketplace Checkout (carrito desde presupuesto)
    → Factura (desde presupuesto aceptado)

Marketplace Checkout
    → Portal Proveedor (el proveedor responde al pedido)
    → Notificaciones Push (cuando proveedor confirma)
    → Seguimiento (instalador rastrea el pedido)

Portal Proveedor
    → Catálogo Universal (vinculación de offerings)
    → Actores Marketplace (identidad del proveedor)

Stripe
    → Planes de usuario (desbloquea módulos)
    → Admin Panel (gestión de suscripciones)
    → Modelo comisión 2027 (Stripe Connect)

Asistente Técnico
    → Normativa vectorizada (chunks en Supabase pgvector)
    → Plan del usuario (límites diarios por plan)
```

---

## Resumen ejecutivo por dominio

| Dominio | Estado | Acción siguiente |
|---|---|---|
| ERP | ✅ Completo | Mantenimiento |
| Marketplace — Checkout | ✅ Completo | Consolidación UX |
| Marketplace — Seguimiento | ✅ Completo | Consolidación UX |
| Portal Proveedor | ✅ Completo | Consolidación UX + Sprint 2 |
| Motor IA | ✅ Producción | Sprint 4 (observabilidad) |
| Asistente Técnico | ✅ Producción | Completar PDFs de CTE/IDAE |
| Contratos SAT | ✅ Completo | Mantenimiento |
| Stripe / Billing | ✅ Completo | Stripe Connect en 2027 |
| Admin Panel | ✅ Completo | Sprint 4 (IA observabilidad) |
| Chatbot | ✅ Producción | Mantenimiento |
| Portal Cliente | ⚠️ Solo vistas públicas | Post-PMF |
| App Móvil | ⚠️ Mínima cobertura | 2027 |
| Analytics | ⚠️ Básico | Sprint 4 |
| Fabricantes | ❌ No existe | Post-PMF |
| API pública | ❌ No existe | 2027 |
| Stripe Connect | ❌ No existe | 2027 |
