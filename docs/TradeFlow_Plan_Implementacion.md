# TradeFlow AI — Plan de Implementación por Fases
**Versión:** 3.0 — 27 Mayo 2026  
**Proyecto Supabase:** `dqqjaujnulutinskmqsu` (GestionDebacuPro)  
**Repositorio:** https://github.com/fercarboc/tradeflow.git  
**Producción:** https://www.trabflow.com

---

## Estado Real Actual (27 May 2026)

### Tablas Supabase — todas creadas y operativas
| Tabla | Estado |
|-------|--------|
| `trade_organizations` | ✅ Con campos fiscales extendidos |
| `trade_subscriptions` | ✅ trial/active/cancelled/expired |
| `trade_clients` | ✅ CRM + dedup por teléfono |
| `trade_quotes` + `trade_quote_items` | ✅ |
| `trade_invoices` | ✅ Cobro con método de pago |
| `trade_waitlist` | ✅ También recibe contactos y tickets soporte |
| `trade_workers` | ✅ Roles: admin/tecnico/comercial |
| `trade_tarifas` | ✅ Catálogo Excel-imported (hasta 5000 refs) |
| `trade_catalog_products` + `trade_catalog_variants` | ✅ AI catalog con 3 calidades |
| `trade_jobs` + `trade_job_workers` | ✅ Planificación y asignación |
| `trade_job_photos` | ✅ Storage bucket `trade-job-photos` |
| `trade_push_subscriptions` | ✅ VAPID Web Push |
| `trade_subcontractors` | ✅ Proveedores colaboradores (ampliado Jun-2026) |
| `trade_subcontratas` | ✅ Trabajos externalizados, 10 estados |
| `trade_mayoristas` | ✅ Proveedores de material (Jun-2026) |
| `trade_compras` | ✅ Facturas de compra de material (Jun-2026) |

### Edge Functions desplegadas
| Función | Estado | Modelo |
|---------|--------|--------|
| `trade-voice-to-quote` | ✅ Claude Haiku 4.5 | Voz → JSON partidas |
| `trade-photo-scan` | ✅ Claude Haiku 4.5 Vision | Foto → JSON partidas |
| `trade-push-notify` | ✅ VAPID P-256 nativo Deno | Web Push |
| `trade-chatbot` | ✅ Claude Haiku 4.5 | Chatbot de ayuda con conocimiento completo |
| `trade-email` | ⚠️ Parcial | Necesita tipos contact_admin/support_admin |

### Variables de entorno — Vercel + Supabase
| Variable | Estado |
|----------|--------|
| `VITE_SUPABASE_URL` | ✅ |
| `VITE_SUPABASE_ANON_KEY` | ✅ |
| `VITE_VAPID_PUBLIC_KEY` | ✅ |
| `ANTHROPIC_API_KEY` (Supabase secrets) | ✅ Verificado |
| `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` / `VAPID_SUBJECT` | ✅ |

---

## Arquitectura de Roles (implementado)

```
auth.users
  │
  ├── fercarboc@gmail.com → AdminView (panel SaaS)
  │
  ├── trade_workers.rol = 'admin' → AppDashboardView completo
  │                                  (accede a la org del instalador vía workerOrgId)
  │
  ├── trade_workers.rol = 'tecnico' → ScreenWorkerView (solo planificación + fotos)
  │
  └── owner_id en trade_organizations → AppDashboardView completo (instalador autónomo)
```

---

## FASE 1 — Cimientos ✅ COMPLETADA

- [x] Wizard de registro 3 pasos
- [x] `trade_organizations` + `trade_subscriptions` se crean al registrar
- [x] Login modal Supabase Auth
- [x] Datos fiscales persistentes (`saveFiscalData`)
- [x] Trabajadores CRUD (`loadWorkers`, `addWorker`, `deleteWorker`)
- [x] Catálogo Excel CRUD (`loadTarifas`, `addTarifa`, `deleteTarifa`, `updateTarifaPrice`)
- [x] Import masivo desde Excel (hasta 5000 refs con validación)
- [x] Export catálogo a Excel
- [x] Catálogo IA (`trade_catalog_products` + variantes por calidad)
- [x] Seed catálogo global → org nueva vía RPC `seed_org_catalog`

---

## FASE 2 — Core App ✅ COMPLETADA

- [x] Dashboard con métricas reales (presupuestos mes, facturado, cobros pendientes)
- [x] CRM clientes — lista, búsqueda, CRUD
- [x] **Dedup clientes por teléfono** — al finalizar presupuesto wizard, busca por phone primero
- [x] Presupuesto manual desktop (selector cliente + partidas + PDF)
- [x] **Botón "+ Nuevo Cliente"** inline en formulario de presupuesto desktop
- [x] Presupuesto por voz (wizard 5 pasos móvil)
- [x] Presupuesto por foto IA (Claude Haiku Vision)
- [x] **Compresión imagen client-side** antes de enviar (Canvas API, max 2000px, JPEG ≤4MB)
- [x] **Catálogo learning** — precio asignado en partida `requiere_precio` → auto-save a `trade_catalog_variants`
- [x] Facturas — convertir presupuesto → factura, PDF, estado cobro
- [x] **Cobrar con método de pago** — bottom sheet Efectivo / Bizum / Transferencia
- [x] Envío PDF por WhatsApp

---

## FASE 3 — Trabajadores y Planificación ✅ COMPLETADA

- [x] `trade_jobs` y `trade_job_workers` creadas en Supabase
- [x] ScreenWorkerView (vista campo para técnicos)
- [x] WeekStrip — navegación semanal con dots de estado
- [x] Fotos por trabajo (upload Storage)
- [x] FAB crear trabajo + bottom sheet form
- [x] EditJobModal inline
- [x] Filter pills por estado
- [x] Asignación trabajadores a jobs
- [x] "Ruta del día" con links Google Maps
- [x] **Rol admin en workers** → entra al AppDashboard completo (no al worker view limitado)
- [x] **Worker-admin org fallback** — usa `org_id` de su perfil worker si no tiene org propia

---

## FASE 4 — Panel Admin SaaS ✅ COMPLETADA (básico)

- [x] AdminView (`fercarboc@gmail.com`)
- [x] Lista de organizaciones con suscripciones
- [x] Alta manual de instalador + período de prueba (90 días)
- [x] Cambiar plan y ciclo de facturación
- [x] Ver leads/waitlist con estado (nuevo/contactado/convertido)
- [x] Stripe UI básico (checkout + portal links)
- [ ] Stripe webhooks automáticos (invoice.paid → actualizar estado) — **PENDIENTE**
- [ ] `trade_platform_invoices` — facturas TradeFlow → instalador — **PENDIENTE**
- [ ] Métricas MRR / churn / evolución — **PENDIENTE**

---

## FASE 5 — App Móvil Completa ✅ COMPLETADA

- [x] AppDashboardView modo móvil (5 tabs: Inicio, Presupuestos, Trabajos, Clientes, Facturas)
- [x] Tab bar carousel horizontal (overflow-x-auto)
- [x] FAB central (+) con menú flotante
- [x] **Presupuestos móvil** — filtro por cliente + toggle "Este mes / Todos"
- [x] **Clientes móvil** — al expandir muestra presupuestos del cliente + WhatsApp href real
- [x] **Facturas móvil** — filtro por cliente + mes + banner total pendiente + cobrar con método
- [x] Header móvil con LogOut (solo live mode)
- [x] Dark theme AppDashboard + páginas auth
- [x] Push Notifications Web Push VAPID
- [x] **Fix VAPID key** — `urlBase64ToUint8Array` correcto para Chrome/Firefox
- [x] Bell toggle en ScreenWorkerView (amber cuando activo)
- [x] PWA — `manifest.json`, `sw.js` con push handler, install prompt

---

## FASE 6 — Catálogo Avanzado + Web Pública ✅ COMPLETADA (parcial)

### Catálogo
- [x] Importación Excel masiva (hasta 5000 refs, validación, resumen errores)
- [x] **Edición inline de precios** — lápiz en cada fila de `trade_tarifas`, guardar en BD
- [x] **Filtro por familia/sector** — pills seleccionables (ej. "Fontanería (234)"), multi-select, "Todos" reset
- [x] Export catálogo filtrado a Excel
- [x] Catálogo IA con variantes por calidad (Económico/Preferido/Premium) + edición precio
- [ ] **Catálogo maestro TradeFlow (5000 productos)** — pendiente generación y distribución

### Web pública
- [x] **Footer** — "Prueba gratis 15 días" + 20 oficios en "Ideal para:"
- [x] **ContactoView** — formulario de contacto/info simple (Nombre, Teléfono, Motivo, Mensaje)
  - Guarda en `trade_waitlist` → admin lo ve en panel
  - Dispara email `contact_admin`
- [x] **Modal soporte en app** — botón "💬 Contactar soporte" en sidebar, graba en BD + email

---

## FASE 7 — Módulos Empresa (Junio 2026) ✅ COMPLETADA

- [x] **Trabajos Externalizados** — `ScreenSubcontratas.tsx` reescrito con 10 estados, calculadora de margen, lock solo lectura al pagar
- [x] **Proveedores Colaboradores** — directorio con valoración, cobertura, historial
- [x] **Mayoristas / Distribuidores** — `trade_mayoristas` + CRUD completo
- [x] **Facturas de compra** — `trade_compras` con IVA (0/10/21%), vencimiento, vinculación a trabajo
- [x] **ScreenIngresos 3 pestañas** — Ingresos / Gastos / Resultado con KPIs y gráfico dual
- [x] **Bloqueo de presupuestos facturados** — no se puede añadir partida externalizada a presupuesto Facturado
- [x] **"Enviar al cliente"** — modal canal WhatsApp / Email (mailto prellenado) / Solo registrar
- [x] **Chatbot v3** — conocimiento actualizado de todos los módulos, precios Profesional/Empresa/Empresa+
- [x] **ComoFuncionaView** — nueva sección pública: Trabajos Externalizados + Gastos
- [x] **Documentación actualizada** — analisis-subcontratas.md, TrabFlow_AnalisisCompleto_v3, plan implementación

### Migraciones BD aplicadas (Jun-2026)
- `expand_subcontratas_estados_and_proveedor_fields` — 10 estados + 7 campos en `trade_subcontractors`
- `create_mayoristas_and_compras` — tablas `trade_mayoristas` y `trade_compras` con RLS completo

---

## FASE 8 — Pendientes próximas

### 🔴 Crítico / Bloquea usuarios reales

| Tarea | Motivo urgente |
|-------|----------------|
| **Email edge function** — añadir tipos `contact_admin` y `support_admin` al `trade-email` | Los formularios de contacto y soporte disparan emails que la función no sabe manejar |
| **Catálogo maestro TradeFlow 5000** | Los instaladores nuevos no tienen referencias; pedido explícitamente |
| **Export Excel del catálogo filtrado** | Al exportar con filtro activo debería exportar solo lo visible, no todo |

### 🟡 Alta prioridad

| Tarea | Detalle |
|-------|---------|
| **RegistroView** — cambiar "3 meses" → "15 días" | `RegistroView.tsx` líneas 230, 233, 328, 468, 477 siguen con "3 meses" |
| **Notificaciones automáticas push** | Trigger en BD o cron al asignar trabajo → llama a `trade-push-notify` |
| **Stripe webhooks** | `invoice.paid` → `trade_subscriptions.status = active` + `trade_platform_invoices` |
| **Prueba push end-to-end** | Suscribir campana → asignar trabajo → recibir notif. VAPID en móvil |
| **Selector oficio en registro** | Solo 5 opciones; añadir los 20 oficios completos |
| **ContactoView** — quitar "Lista de espera" de EmailSubject | El form nuevo envía bien a BD pero el subject del email sigue siendo "waitlist" |

### 🟢 Media prioridad

| Tarea | Detalle |
|-------|---------|
| **Catálogo desde móvil** | Ver catálogo y añadir items a presupuesto desde ScreenWorkerView |
| **Perfil/Plan en móvil** | Botón perfil → ver plan actual, presupuestos usados/disponibles (plan básico), pagos |
| **Firma digital en cierre de trabajo** | Canvas HTML5 → imagen guardada en Storage |
| **Offline-first** | sw.js cachea trabajos del día para uso sin conexión |
| **Reporte PDF diario** | Exportar resumen del día con fotos incluidas |
| **Chat interno por trabajo** | Mensajes entre admin y técnico por trabajo |
| **Métricas admin MRR** | Panel SaaS completo con gráficos: MRR, churn, trials |
| **`trade_platform_invoices`** | Facturas que TradeFlow emite a cada instalador |

### 🔵 Baja prioridad / Ideas futuras

| Tarea | Detalle |
|-------|---------|
| **Integración Google Calendar** | Exportar trabajos como eventos |
| **Facturación automática** | Generar factura al marcar trabajo como completado |
| **App nativa iOS/Android** | Capacitor wrapping del PWA actual |
| **Multi-idioma** | Inglés/Portugués para expansión |
| **Integración Google Places** | Autocompletado de dirección en formulario de trabajo |
| **Geolocalización en ruta** | Ordenar trabajos del día por distancia real |
| **Recordatorios automáticos WhatsApp** | Recordar al cliente 24h antes del trabajo |

---

## Próximos 3 pasos concretos (orden recomendado)

### Paso 1 — Catálogo maestro 5000 productos (2-3h)
Crear un script `scripts/generate-master-catalog.ts` que genere un Excel con ~5000 referencias de los 20 oficios principales con precios orientativos de mercado español 2026. Añadir botón "Descargar Catálogo Base TradeFlow" en el modal de importación del catálogo.

Familias a incluir (250 refs c/u aprox):
Fontanería, Electricidad, Climatización/HVAC, Calefacción, Albañilería, Carpintería/Ventanas, Cerrajería, Pintura, Suelos/Tarimas, Pladur/Escayola, Cristalería, Persianas/Cierres, Jardinería, Telecomunicaciones, CCTV/Seguridad, Energía Solar, Ascensores/Elevadores, Taller Mecánico, Limpieza Industrial, Mano de Obra (común todos)

### Paso 2 — Email edge function (1h)
Actualizar `supabase/functions/trade-email/index.ts` para manejar:
- `contact_admin` → Email a info@trabflow.com con datos del formulario de contacto público
- `support_admin` → Email a info@trabflow.com con datos del ticket de soporte desde el panel

### Paso 3 — RegistroView "15 días" (30min)
Buscar y reemplazar todas las menciones de "3 meses" en `RegistroView.tsx` por "15 días".

---

## Archivos clave del proyecto

| Archivo | Rol | Líneas aprox |
|---------|-----|-------------|
| `src/App.tsx` | Router + gestión de sesión + routing por rol | ~240 |
| `src/types.ts` | ActivePage enum, TradeType | ~80 |
| `src/lib/supabase.ts` | Cliente Supabase + todos los helpers + tipos | ~1400 |
| `src/components/AppDashboardView.tsx` | Panel principal (desktop + móvil) | ~5500 |
| `src/components/ScreenWorkerView.tsx` | Vista campo para técnicos | ~900 |
| `src/components/RegistroView.tsx` | Wizard de registro 3 pasos + pricing | ~500 |
| `src/components/AdminView.tsx` | Panel admin SaaS (fercarboc@gmail.com) | ~600 |
| `src/components/ContactoView.tsx` | Formulario contacto/info público | ~170 |
| `src/components/Footer.tsx` | Footer con 20 oficios | ~190 |
| `supabase/functions/trade-voice-to-quote/` | Edge fn voz → presupuesto (Claude Haiku) | ~200 |
| `supabase/functions/trade-photo-scan/` | Edge fn foto → presupuesto (Claude Haiku Vision) | ~215 |
| `supabase/functions/trade-push-notify/` | Edge fn push notifications VAPID | ~200 |
| `supabase/functions/trade-email/` | Edge fn email via Resend | ~100 |
| `public/sw.js` | Service Worker PWA + push handler | ~120 |
| `docs/TradeFlow_Supabase_Guide.md` | Schema BD completo + RLS + edge functions | ~1800 |

---

## Convenciones del proyecto

- **Prefijo tablas:** `trade_`
- **Roles worker:** `admin` (dashboard completo) | `tecnico` (worker view) | `comercial`
- **Estados trabajo:** `planificado | en_curso | completado | cancelado | pendiente_material`
- **Estados factura:** `Pendiente | Pagada | Vencida`
- **Estados presupuesto:** `Borrador | Enviado | Aceptado | Facturado`
- **IVA default:** 21%
- **Imágenes foto-scan:** Canvas compresión → max 2000px, JPEG quality 0.85, ≤4MB
- **Soft delete:** campo `activo boolean DEFAULT true`
- **Numeración:** `P-YYYY-NNN` presupuestos, `F-YYYY-NNN` facturas
- **Regla arquitectónica:** Sub-componentes SIEMPRE a nivel módulo, NUNCA dentro del padre (causa re-mount)
- **Demo data:** `cli-1`, `cli-2`... IDs hardcoded. En live mode siempre se limpian y reemplazan

---

*Actualizado: 27 Mayo 2026 — TradeFlow AI v3.0*
