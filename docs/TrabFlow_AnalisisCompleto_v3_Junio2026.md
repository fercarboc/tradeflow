# TrabFlow AI — Análisis Completo de la Aplicación
## Versión 3.0 · Junio 2026

> **Documento de referencia técnico-funcional**  
> Para uso interno, formación de equipo, y documentación de producto.  
> Actualizado: 11 de junio de 2026

---

## ÍNDICE

1. [Visión General y Propuesta de Valor](#1-visión-general)
2. [Arquitectura Técnica](#2-arquitectura-técnica)
3. [Sistema de Roles y Permisos](#3-roles-y-permisos)
4. [Onboarding — Asistente de Configuración Inicial](#4-onboarding)
5. [Panel de Control (Dashboard)](#5-panel-de-control)
6. [Presupuestos](#6-presupuestos)
7. [Clientes CRM](#7-clientes-crm)
8. [Gestión de Facturas](#8-gestión-de-facturas)
9. [Catálogo de Productos y Servicios](#9-catálogo)
10. [Planificación de Trabajos](#10-planificación)
11. [Ruta del Día](#11-ruta-del-día)
12. [Ingresos y Rentabilidad](#12-ingresos)
13. [Equipo y Permisos](#13-equipo-y-permisos)
14. [Trabajadores y Rutas](#14-trabajadores)
15. [Contratos de Mantenimiento](#15-contratos-de-mantenimiento)
16. [Mantenimientos](#16-mantenimientos)
17. [Ajustes y Tarifas](#17-ajustes-y-tarifas)
18. [Módulo Técnico (App del Trabajador de Campo)](#18-módulo-técnico)
19. [Pipeline de Inteligencia Artificial](#19-pipeline-ia)
20. [Parte de Trabajo (ScreenParteTrabajo)](#20-parte-de-trabajo)
21. [PWA y Notificaciones Push](#21-pwa-y-notificaciones)
22. [Facturación Electrónica (VeriFactu)](#22-verifactu)
23. [Chatbot de Ayuda](#23-chatbot)
24. [Base de Datos — Tablas](#24-base-de-datos)
25. [Edge Functions (Supabase)](#25-edge-functions)
26. [Políticas RLS](#26-rls)
27. [Flujos de Negocio Principales](#27-flujos-de-negocio)
28. [Exportaciones y Documentos Generados](#28-exportaciones)
29. [Panel de Administración (Admin)](#29-panel-admin)
30. [Glosario de Términos](#30-glosario)

---

## 1. Visión General

**TrabFlow AI** es una plataforma SaaS de gestión para instaladores autónomos y PYMES del sector de servicios técnicos (fontanería, electricidad, climatización, cerrajería, reformas, etc.).

### Problema que resuelve
Los instaladores dedican entre 2-4 horas diarias a papeleo: presupuestos a mano, facturas en Excel, llamadas para confirmar visitas, seguimiento de cobros. TrabFlow automatiza todo esto con IA.

### Propuesta de valor principal
- **Voz → Presupuesto** en 30 segundos (dictado en furgoneta u obra)
- **Gestión completa** desde el presupuesto hasta la factura cobrada
- **Equipo coordinado**: asigna trabajos a técnicos, ellos ven solo lo suyo
- **Sin papel**: parte de trabajo digital, fotos, notas de voz

### Stack tecnológico
| Componente | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |
| Edge Functions | Deno (TypeScript) en Supabase |
| IA | Anthropic Claude (Haiku 4.5, Sonnet 4.6) |
| Pagos | Stripe |
| Hosting | Vercel |
| Documentos | docx library v9.7.1 (Word), HTML print (PDF) |
| Push notifications | Web Push API (VAPID) |

### URL de producción
`https://www.trabflow.com`

### Proyecto Supabase
- **ID:** `dqqjaujnulutinskmqsu`
- **Nombre:** GestionDebacuPro
- **Prefijo tablas:** `trade_`

---

## 2. Arquitectura Técnica

### Estructura del proyecto (src/)
```
src/
├── components/
│   ├── AppDashboardView.tsx    ← Componente principal (>8000 líneas)
│   ├── ScreenPlanificacion.tsx ← Gestión de trabajos
│   ├── ScreenRutaDia.tsx       ← Optimización de rutas
│   ├── ScreenParteTrabajo.tsx  ← Parte de trabajo / facturación campo
│   ├── ScreenFacturas.tsx      ← Gestión operativa de facturas
│   ├── ScreenEquipo.tsx        ← Gestión de equipo y permisos
│   ├── ScreenTrabajadores.tsx  ← Perfiles de trabajadores de campo
│   ├── ScreenContratos.tsx     ← Contratos de mantenimiento
│   ├── ScreenMantenimiento.tsx ← Gestión de mantenimientos
│   ├── ScreenIngresos.tsx      ← Dashboard de ingresos
│   ├── OnboardingWizard.tsx    ← Asistente configuración inicial
│   ├── ChatbotWidget.tsx       ← Chatbot flotante de ayuda
│   └── ...
├── context/
│   └── SessionContext.tsx      ← Estado global: user, org, rol, permisos
├── hooks/
│   └── usePermissions.ts       ← Hook can() para verificar permisos
├── lib/
│   ├── supabase.ts             ← Todas las funciones de acceso a BD
│   ├── exportWord.ts           ← Generación de documentos Word (.docx)
│   ├── contractTemplates.ts    ← Plantillas legales de contratos
│   └── printTradeInvoice.ts    ← Generación HTML de facturas PDF
└── types/
    └── index.ts                ← Tipos TypeScript compartidos
```

### Flujo de datos
```
Usuario (navegador)
    ↕ HTTPS
Vercel (frontend React/Vite)
    ↕ Supabase JS Client
Supabase (PostgreSQL + RLS + Auth)
    ↕ Deno
Edge Functions (IA, email, Stripe, etc.)
    ↕ API
Anthropic Claude API / Stripe API / SendGrid
```

### Autenticación
- **Supabase Auth** (email + password / magic link)
- JWT almacenado en localStorage
- `SessionContext.tsx` carga el perfil completo al iniciar: usuario, organización, plan, rol, permisos, workerProfile
- Invitaciones via email: `send-invite` edge function → `trade_org_members`

---

## 3. Roles y Permisos

### Tipos de roles
| Rol | Descripción |
|---|---|
| `owner` | Propietario. Acceso total incluida gestión de suscripción |
| `admin` | Todo excepto suscripción. Puede hacer partes de campo |
| `oficina` | Gestión diaria completa. Sin ajustes de empresa |
| `comercial` | Solo presupuestos y clientes |
| `tecnico` | Solo sus trabajos asignados y notas de campo |
| `visualizador` | Solo lectura de trabajos |

### Matriz de permisos detallada

| Función | Owner | Admin | Oficina | Comercial | Técnico | Visualizador |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Facturas | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Presupuestos | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Clientes CRM | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Catálogo | ✓ | ✓ | ✓ | ✗ | parcial | ✗ |
| Planificación | ✓ | ✓ | ✓ | ✗ | solo asignados | solo ver |
| Ingresos | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Equipo | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Mantenimiento | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Ajustes empresa | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Suscripción | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Notas de campo | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |

### Permisos en código (`ROL_PERMISOS` en SessionContext.tsx)
```typescript
tecnico:  ['jobs.view', 'jobs.manage', 'field_notes.create']
admin:    [...todo..., 'field_notes.create']  // puede hacer partes como autónomo
owner:    [...todo..., 'subscription.manage']
```

### Permisos personalizados por miembro
La tabla `trade_org_permissions` permite sobreescribir permisos individuales (granted/revoked) para cada miembro, sin cambiar su rol base.

---

## 4. Onboarding

**Componente:** `OnboardingWizard.tsx`  
**Cuándo aparece:** Al primer login del propietario (`org.is_onboarded = false`). Nunca para trabajadores de empresa.

### Pasos del wizard

| # | Paso | Qué hace | Guarda en |
|---|---|---|---|
| 1 | **Tu empresa** | Datos fiscales (nombre, CIF, dirección, tel, email) + bancarios (IBAN, banco, titular) | `trade_organizations` + localStorage `tf_biz_config` |
| 2 | **Tarifas** | Precio hora, margen materiales %, IVA %, descuento % | localStorage `tf_biz_config` + `trade_organizations.iva_default` |
| 3 | **Catálogo base** | Selección de 12 áreas de trabajo → carga artículos base | `trade_tarifas` (via `importCatalogItems`) + `trade_organizations.oficio` |
| 4 | **Plan** | Informacional: explica Beta gratuita y cómo contratar después | — |
| 5 | **Logo** | Upload de imagen corporativa | Supabase Storage `org-logos/` → `trade_organizations.logo_url` |
| 6 | **Plantillas** | Carga 7 plantillas de comunicación predefinidas | `trade_org_templates` (via `saveOrgTemplate`) |
| 7 | **Finalizar** | Toggle notificaciones push + resumen | `trade_organizations.is_onboarded = true` + localStorage |

### Catálogo base incluido
12 áreas: Fontanería, Electricidad, Climatización, Carpintería, Pintura, Albañilería, Telecomunicaciones, Cerrajería, Jardinería, Seguridad, Reformas, Mudanzas. ~8-10 artículos por área con precios orientativos.

### Omitir el wizard
Al pulsar "Saltar": confirmación con advertencia de que **no volverá a aparecer** y la app no funcionará bien sin configurar. Dos opciones: continuar configurando / sí saltar.

### Configuración incompleta
Si el propietario saltó sin completar, el **Panel de Control** muestra un banner ámbar con los pasos pendientes y botones directos a cada sección.

---

## 5. Panel de Control

**Tab:** `dashboard` (desktop) / `inicio` (mobile)  
**Componente:** `ScreenDashboard()` interno en `AppDashboardView.tsx`

### Vista Desktop

#### Métricas principales (KPIs)
| Métrica | Cálculo | Tabla fuente |
|---|---|---|
| Trimestre facturado | Suma de facturas Pagadas del trimestre actual | `trade_invoices` (estado=Pagada) |
| Pendiente de cobro | Suma de facturas Emitidas/Pendientes | `trade_invoices` (estado=Emitida/Pendiente) |
| Borradores en espera | Nº de presupuestos en estado Borrador | `trade_quotes` |
| Tasa de aceptación | % presupuestos Aceptados / (Aceptados+Rechazados) últimos 90 días | `trade_quotes` |

#### Quick Actions (accesos rápidos)
1. **Presupuesto por Voz IA** → abre `WizardPresupuesto` con dictado de voz
2. **Añadir Trabajo / Visita** → navega a Planificación + abre modal de nuevo trabajo
3. **Registrar Cliente CRM** → modal de nuevo cliente
4. **Presupuesto por Pasos** → `ScreenPresupuestoIncremental`
5. **Contrato Mantenimiento** → `ScreenMantenimientoWizard`

#### Secciones informativas
- **Ingresos recientes** — gráfico de barras últimos 6 meses
- **Presupuestos recientes** — lista con estado (Borrador/Enviado/Aceptado/Facturado)
- **Banner configuración incompleta** — aparece si faltan pasos del wizard

#### Smart Pricing (recomendador IA)
Si el precio/hora del instalador difiere significativamente del promedio de mercado en su zona, aparece una sugerencia para actualizar la tarifa.

### Vista Mobile (`MobileScreenInicio`)
- Sólo para roles no-técnico
- Saludo + fecha de hoy
- Trabajos del día (lista compacta con estado)
- Próximos 7 días
- Visitas pendientes
- Presupuestos enviados sin respuesta
- FAB (botón flotante) con acceso rápido a nueva tarea

---

## 6. Presupuestos

**Tab:** `quotes`  
**Componente:** `ScreenPresupuestos()` + `ScreenCreateQuote()` internos

### Estados de presupuesto
```
Borrador → Enviado → Aceptado → Facturado
                  ↘ Rechazado
                  ↘ Vencido (automático si pasan 30 días)
```

### Funciones principales

#### Crear presupuesto
**3 métodos:**

**a) Voz IA** (`trade-voice-to-quote`)
1. Grabar audio en el navegador
2. Edge function transcribe con Claude Haiku + web search de precios
3. Devuelve JSON con: descripción, partidas, cantidades, precios unitarios
4. El instalador revisa y ajusta en el wizard de presupuesto
5. Al guardar → guarda en `trade_quotes` + `trade_quote_items` + `trade_ai_feedback`

**b) Foto IA** (`trade-photo-scan` + `trade-presupuesto-foto`)
1. Toma foto del trabajo o plano
2. IA analiza la imagen y sugiere partidas
3. Mismo flujo que voz para revisión y guardado

**c) Manual por pasos** (`ScreenPresupuestoIncremental`)
1. Tipo de trabajo (selección de categoría)
2. Descripción del trabajo
3. Partidas línea a línea (búsqueda en catálogo o manual)
4. Revisión y totales

#### Wizard de Revisión (paso 4 del wizard de voz)
- Muestra todas las partidas detectadas
- Permite añadir/eliminar partidas
- Editar precios unitarios y cantidades
- Aplicar descuento global
- Seleccionar cliente (existente o nuevo inline)
- Vista previa del presupuesto final

**Graba en:** `trade_quotes` + `trade_quote_items`

#### Lista de presupuestos
- Filtros: estado, texto libre
- Orden: fecha descendente por defecto
- Por presupuesto:
  - Ver ficha completa
  - Descargar PDF (ventana emergente con HTML)
  - Descargar Word (.docx)
  - Enviar por WhatsApp (prefill de mensaje)
  - Enviar por email (`trade-email`)
  - Marcar como Enviado/Aceptado/Rechazado
  - **Convertir a Factura** → crea `trade_invoices`
  - Crear trabajo vinculado → crea `trade_jobs`
  - Duplicar presupuesto
  - Eliminar

#### Ficha de presupuesto (`ScreenPreview`)
Vista profesional imprimible con:
- Datos de empresa (logo, CIF, dirección)
- Datos del cliente
- Tabla de partidas (descripción, cantidad, precio unit., total)
- Descuento aplicado
- Base imponible + IVA + Total
- Condiciones de pago (pie de página)
- Pie personalizado

### Tablas afectadas
| Operación | Tabla | Acción |
|---|---|---|
| Crear presupuesto | `trade_quotes` | INSERT |
| Guardar partidas | `trade_quote_items` | INSERT/DELETE + INSERT |
| Marcar estado | `trade_quotes` | UPDATE estado |
| Eliminar | `trade_quotes` | DELETE (cascade → items) |
| Convertir a factura | `trade_invoices` + `trade_invoice_lines` | INSERT |
| Feedback IA | `trade_ai_feedback` | INSERT |
| Nuevo cliente inline | `trade_clients` | INSERT |

---

## 7. Clientes CRM

**Tab:** `crm`  
**Componente:** `ScreenCRM()` interno

### Funcionalidades

#### Lista de clientes
- Búsqueda en tiempo real (nombre, teléfono, email, dirección)
- Estadísticas por cliente: nº obras activas, total facturado, presupuestos
- Añadir nuevo cliente (inline modal)

#### Ficha de cliente (panel lateral)
Al pulsar en un cliente se abre un panel con pestañas:
- **Info general**: nombre, CIF/NIF, teléfono, email, dirección
- **Presupuestos**: lista de todos los presupuestos para ese cliente
- **Facturas**: lista de facturas con estado y totales
- **Trabajos**: trabajos planificados y completados vinculados al cliente
- **Historial**: línea de tiempo de actividad

#### Enlace de seguimiento
Genera un token único que el cliente puede usar para ver el estado de sus presupuestos y trabajos desde un enlace público.

#### Gestión de datos
| Operación | Tabla | Acción |
|---|---|---|
| Crear cliente | `trade_clients` | INSERT |
| Editar datos | `trade_clients` | UPDATE |
| Eliminar | `trade_clients` | DELETE (soft: `activo=false`) |
| Cargar facturas cliente | `trade_invoices` | SELECT WHERE client_id |
| Cargar presupuestos | `trade_quotes` | SELECT WHERE client_id |
| Generar enlace | `trade_clients` | UPDATE share_token |

---

## 8. Gestión de Facturas

**Tab:** `invoices` (antes había también `facturas` — ya unificado en uno solo)  
**Componente:** `ScreenFacturas.tsx`

### Estados de factura (máquina de estados)
```
Borrador → Emitida → Enviada → Pendiente → Pagada
                             ↘ Vencida
         ↘ Cancelada (desde cualquier estado)
         ↘ Rectificativa (crea nueva factura con importes negativos)
```

### KPIs del módulo
- Borradores / Emitidas / Pagadas / Vencidas (contadores)
- **Alertas próximas a cobrar** — franja ámbar: facturas con vencimiento en ≤15 días

### Funcionalidades

#### Lista de facturas
- Búsqueda: número, cliente, concepto
- Filtros por estado: Todos / Borrador / Emitida / Pendiente / Pagada / Vencida
- Filtros por serie: Todo / F- (trabajo puntual) / M- (mantenimiento)
- **Filtro de fechas**: Desde / Hasta (por fecha de emisión)
- **Ordenación**: click en columna "Fecha" ↑/↓ o botón "Fecha + reciente"

#### Acciones por factura (en lista)
- **Cobrar** (facturas Emitidas/Pendientes): abre modal de cobro
- **Icono PDF**: genera HTML y abre ventana de impresión/descarga
- **Ojo**: abre detalle completo

#### Modal de detalle de factura
Muestra:
- Datos completos: número, serie, cliente, fechas, método de pago, estado
- Líneas de detalle (descripción, cantidad, precio unit., subtotal)
- Totales: base imponible + IVA + TOTAL
- Historial de cambios de estado

**Acciones en detalle:**
| Acción | Disponible cuando | Qué hace |
|---|---|---|
| Emitir | Borrador | UPDATE estado=Emitida + asigna número definitivo |
| Marcar Pendiente | Emitida | UPDATE estado=Pendiente |
| Registrar Cobro | Emitida/Pendiente | Modal → UPDATE estado=Pagada + paid_at + metodo_pago |
| Anular Pago | Pagada | UPDATE estado=Emitida, cleared paid_at y metodo_pago |
| Ver PDF | No Borrador | Genera HTML con diseño profesional + VeriFactu footer |
| Descargar Word | No Borrador | Genera .docx editable |
| WhatsApp | Si cliente tiene teléfono | Abre WA con mensaje prefill |
| Crear Rectificativa | Emitida/Pagada/Pendiente | INSERT nueva factura con importes negativos |

#### Modal de registro de cobro
- Muestra: nº factura + importe total
- Selector de método de pago: **Transferencia / Efectivo / Bizum / Tarjeta / Domiciliación**
- Botones: Cancelar / Confirmar cobro

#### Envío a Gestoría
Botón "Gestoría" → modal con:
- Selección de trimestre/año (hasta 3 años atrás)
- Resumen del período: nº facturas, base imponible, IVA (modelo 303), total cobrado
- Exportar CSV — formato estándar con: número, fecha, cliente, NIF cliente, base, IVA %, IVA €, total, estado

### Series de facturación
| Serie | Tipo | Numeración |
|---|---|---|
| F- | Trabajo puntual (standard) | F-AAAA-NNNN |
| M- | Contrato de mantenimiento | M-AAAA-NNNN |

### Tablas afectadas
| Operación | Tabla | Acción |
|---|---|---|
| Cargar facturas | `trade_invoices` JOIN `trade_clients(nombre,telefono)` | SELECT |
| Emitir factura | `trade_invoices` | UPDATE estado, numero, fecha, fecha_vencimiento |
| Registrar cobro | `trade_invoices` | UPDATE estado=Pagada, paid_at, metodo_pago |
| Anular pago | `trade_invoices` | UPDATE estado=Emitida, paid_at=null |
| Crear rectificativa | `trade_invoices` + `trade_invoice_lines` | INSERT (importes negativos) |
| Cargar líneas | `trade_invoice_lines` | SELECT WHERE factura_id |

---

## 9. Catálogo

**Tab:** `catalog`  
**Componente:** `ScreenCatalog()` interno + `CatalogImportModal` + `GlobalCatalogModal`

### Dos sistemas de catálogo coexisten

#### Sistema Simple: `trade_tarifas`
Tabla directa con artículos individuales. La más usada por la IA y los partes de trabajo.
- Campos: `codigo`, `familia`, `descripcion`, `precio_base`, `unidad`, `activo`
- **Familias**: agrupan artículos por categoría (fontaneria, electricidad, etc.)

#### Sistema Avanzado: `trade_catalog_products` + `trade_catalog_variants`
- Productos con múltiples variantes (marcas, modelos)
- Precio de venta por variante
- Usado para el catálogo de fabricantes / proveedor

### Funcionalidades del catálogo

#### Vista de catálogo simple
- Lista de artículos por familia
- Editar precio directamente en la celda (click sobre el precio)
- Añadir artículo manualmente
- Desactivar artículo (soft delete: `activo=false`)

#### Importar catálogo
**Modal de importación CSV/Excel:**
- Modos: Añadir (mantiene existentes + añade nuevos) / Actualizar / Reemplazar
- Mapeo automático de columnas
- Validación antes de importar
- Resultado: X insertados, Y actualizados, Z errores

#### Importar catálogo global (cross-empresa)
`GlobalCatalogModal` — biblioteca de más de 2000 artículos pre-cargados por 20 oficios. El instalador selecciona los que quiere añadir a su catálogo.

#### Catálogo base por área (Onboarding)
En el wizard inicial, al seleccionar áreas de trabajo se cargan automáticamente ~8-10 artículos representativos por área.

### Tablas afectadas
| Operación | Tabla | Acción |
|---|---|---|
| Ver artículos | `trade_tarifas` | SELECT activo=true |
| Editar precio | `trade_tarifas` | UPDATE precio_base |
| Añadir artículo | `trade_tarifas` | INSERT |
| Desactivar | `trade_tarifas` | UPDATE activo=false |
| Importar | `trade_tarifas` | UPSERT (por codigo o descripcion) |
| Cargar catálogo global | `trade_tarifas` | INSERT |

---

## 10. Planificación

**Tab:** `planificacion`  
**Componente:** `ScreenPlanificacion.tsx`

### Concepto
Calendario semanal de trabajos con gestión completa del ciclo de vida de cada trabajo/visita.

### Vista de semana
- Cabecera con 7 columnas (L-D de la semana actual)
- Navegación por semanas (< >)
- Indicador "HOY"
- Filtro por estado: Todos / Planificado / En curso / Completado / Cancelado

### Tipos de trabajo
| Tipo | Descripción |
|---|---|
| `trabajo` | Instalación, reparación, mantenimiento puntual |
| `visita` | Valoración o primera visita a cliente |

### Estados del trabajo
```
planificado → en_curso → completado
           ↘ cancelado
```

### Modal de creación/edición de trabajo (`JobModalPanel`)
Campos:
- Tipo (Trabajo / Visita-Ver)
- Título *
- Cliente (selector o creación inline)
- Fecha inicio
- Hora inicio
- Duración (horas)
- Prioridad (normal/alta/urgente)
- Dirección, Localidad, C.P.
- Notas / instrucciones para el técnico
- **Asignación de trabajadores**: selector multi-trabajador con roles (responsable/asignado/apoyo)
- **Geolocalización**: botón para geocodificar la dirección automáticamente

**Guarda en:**
- `trade_jobs` INSERT/UPDATE
- `trade_job_workers` — INSERT para cada trabajador asignado

### Tablero de despacho (Dispatch Board)
Columna lateral que muestra:
- Trabajos sin fecha asignada
- Trabajos pendientes sin trabajador
- Botón "Asignar →" para abrir el modal de edición

### Auto-reprogramación de trabajos atrasados
Al cargar la pantalla, detecta automáticamente trabajos con `fecha_inicio < hoy` que no están completados/cancelados y los mueve a mañana. Muestra notificación toast con el número de trabajos reprogramados.

### Activar desde dashboard
Desde el Panel de Control, el botón "Añadir Trabajo / Visita" navega directamente a Planificación y abre el modal de creación (`triggerNew` prop).

### Parte de trabajo
Al pulsar "Parte" en un trabajo → abre `ScreenParteTrabajo` (ver sección 20).

### Tablas afectadas
| Operación | Tabla | Acción |
|---|---|---|
| Crear trabajo | `trade_jobs` | INSERT |
| Editar trabajo | `trade_jobs` | UPDATE |
| Eliminar trabajo | `trade_jobs` | DELETE |
| Asignar trabajador | `trade_job_workers` | INSERT |
| Quitar trabajador | `trade_job_workers` | DELETE |
| Cambiar estado (quick) | `trade_jobs` | UPDATE estado |
| Fotos del trabajo | `trade_job_photos` | SELECT |
| Auto-reprogramar | `trade_jobs` | UPDATE fecha_inicio |

---

## 11. Ruta del Día

**Tab:** `ruta_dia`  
**Componente:** `ScreenRutaDia.tsx`

### Concepto
Optimización automática de la ruta diaria ordenando los trabajos del día por distancia/prioridad desde la ubicación base de la empresa.

### Multi-trabajador
Cuando hay varios trabajadores asignados a trabajos del día, aparece una pestaña por trabajador. Cada pestaña muestra la ruta individual filtrada para ese técnico.

### Funcionalidades
- Lista ordenada de paradas del día con estimación de tiempo
- Botón **Optimizar** — reordena las paradas minimizando distancia total (basado en geocoordenadas o prioridad si no hay GPS)
- Botón **Guardar** — guarda el orden optimizado
- Botón **Google Maps** — abre la ruta completa en Google Maps con todas las paradas
- Info de origen: dirección base de la empresa
- Tiempo total estimado del día

### Filtrado por técnico
- Para el rol `tecnico`: solo ve sus trabajos del día
- Para owner/admin/oficina: ve todos los trabajadores con pestañas

### Tablas afectadas
| Operación | Tabla | Acción |
|---|---|---|
| Cargar trabajos del día | `trade_jobs` | SELECT fecha_inicio=hoy |
| Filtrar por trabajador | `trade_job_workers` | JOIN |
| Actualizar estado | `trade_jobs` | UPDATE estado |
| Guardar orden | `trade_jobs` | UPDATE orden o similar |

---

## 12. Ingresos, Gastos y Rentabilidad

**Tab:** `ingresos`  
**Componente:** `ScreenIngresos.tsx`  
**Planes:** Ingresos (todos) · Gastos y Resultado (Empresa y Empresa+)

### Concepto
Dashboard financiero completo con 3 pestañas: Ingresos, Gastos y Resultado.

### Pestaña Ingresos
- **Ingresos mensuales**: gráfico de barras comparativo (mes a mes, hasta 12 meses)
- **Total facturado acumulado** (periodo seleccionable)
- **Facturas por estado**: Pagadas vs Pendientes vs Vencidas
- **Por tipo**: trabajo puntual vs mantenimiento
- **Top clientes**: ranking por volumen facturado
- **Tasa de cobro**: % de facturas cobradas vs emitidas

### Pestaña Gastos (Empresa y Empresa+)
Tres sub-pestañas:

#### Compras de material
Registro de facturas de proveedores de material (mayoristas/distribuidores):
- Concepto, proveedor (mayorista), referencia de factura
- Importe base + IVA (selector 0%/10%/21%)
- Fecha de factura y fecha de vencimiento
- Estado: pagada / pendiente
- Vinculación opcional a un trabajo concreto (`trade_jobs`)

KPIs: total compras, compras pagadas, compras pendientes

#### Externalizados
Vista consolidada de todas las facturas pagadas a proveedores colaboradores (trabajos externalizados). Agrupa los datos de `trade_subcontratas` con `pagado = true`.

#### Mayoristas / Distribuidores
Directorio de proveedores de material. Alta, edición y baja desde aquí.

### Pestaña Resultado
- **Resultado neto** = ingresos cobrados − (compras pagadas + externalizados pagados)
- **Margen bruto** en porcentaje
- **Gráfico dual**: barras ingresos (azul) vs gastos (rojo) por mes
- Desgloses: ingresos cobrados, compras material pagadas, externalizados pagados

### Tablas fuente
| Datos | Tabla | Filtros |
|---|---|---|
| Ingresos | `trade_invoices` | estado=Pagada |
| Pendientes | `trade_invoices` | estado=Pendiente/Emitida |
| Vencidas | `trade_invoices` | estado=Vencida |
| Top clientes | `trade_invoices` GROUP BY client_id | — |
| Compras material | `trade_compras` | org_id |
| Externalizados | `trade_subcontratas` | pagado=true |
| Mayoristas | `trade_mayoristas` | org_id |

---

## 12b. Trabajos Externalizados

**Tab:** `subcontratas` (interno)  
**Componente:** `ScreenSubcontratas.tsx`  
**Planes:** Empresa y Empresa+  
**Nombre en UI:** "Trabajos Externalizados" (nunca se muestra "subcontrata" al cliente)

### Concepto
Gestión de trabajos que se delegan a otro instalador o empresa externa. El cliente solo ve la "partida de obra" en su presupuesto; internamente se lleva el seguimiento completo del proceso con el proveedor.

### 4 vistas
1. **Lista** — KPIs + tabla de todos los trabajos externalizados
2. **Detalle** — ficha completa del trabajo, barra de progreso de estados, calculadora de margen
3. **Proveedores** — directorio de proveedores colaboradores
4. **Detalle proveedor** — ficha completa + historial de trabajos con ese proveedor

### Estados (10 pasos)
| Estado | Descripción |
|--------|-------------|
| `pendiente` | Recién creado |
| `solicitado` | Contactado al proveedor |
| `presupuesto_recibido` | Precio recibido del proveedor |
| `añadido_presupuesto` | Incluido como partida en presupuesto del cliente |
| `pendiente_cliente` | Esperando aceptación del cliente |
| `en_curso` | Proveedor ejecutando el trabajo |
| `completado` | Trabajo terminado |
| `factura_recibida` | Factura del proveedor recibida |
| `pagado` | Factura pagada — **SOLO LECTURA** |
| `cancelado` | Cancelado |

### Calculadora de margen
- Coste proveedor → botones rápidos 15/20/25/30/40% → precio al cliente
- Fórmula: `precio_cliente = coste / (1 - margen/100)`
- O introducción manual del precio al cliente

### Referencia automática
El trigger `set_subcontrata_referencia` genera `SUB-YYYY-NNN` al insertar.

### Reglas de negocio
- Estado `pagado`: modo solo lectura (oculta botones Editar/Eliminar, barra de estados inactiva)
- No se pueden añadir trabajos externalizados a presupuestos en estado "Facturado"
- La integración con presupuestos vincula el campo `presupuesto_id` de `trade_subcontratas`

### Proveedores Colaboradores (`trade_subcontractors`)
- Datos básicos: nombre, teléfono, email, CIF/NIF
- Dirección fiscal y dirección de trabajo habitual
- Persona de contacto, horarios, área de cobertura
- Valoración 1-5 estrellas
- Estado: activo / pendiente / bloqueado

---

## 12c. Mayoristas y Distribuidores (Proveedores de Material)

**Sub-sección de:** ScreenIngresos → Pestaña Gastos  
**Planes:** Empresa y Empresa+

### Concepto
Proveedores que venden materiales (distintos de los que prestan servicios). Se registran en el directorio y se vinculan a las facturas de compra.

### Ficha de mayorista
| Campo | Descripción |
|-------|-------------|
| nombre | Nombre comercial |
| razon_social | Razón social legal |
| nif | NIF/CIF |
| direccion_fiscal | Dirección completa |
| cp, ciudad, provincia | — |
| telefono, email | — |
| persona_contacto | Nombre del contacto |
| web | URL web del proveedor |
| notas | Notas internas |
| activo | Soft delete |

### Factura de compra (`trade_compras`)
| Campo | Descripción |
|-------|-------------|
| concepto | Descripción de la compra |
| mayorista_id | FK `trade_mayoristas` (opcional) |
| referencia_factura | Nº de factura del proveedor |
| importe | Base imponible |
| iva_pct | 0, 10 o 21 % |
| fecha | Fecha de la factura |
| fecha_vencimiento | Fecha de pago máximo |
| pagado | bool |
| pagado_at | Timestamp del pago |
| job_id | FK `trade_jobs` (vinculación opcional) |

---

## 13. Equipo y Permisos

**Tab:** `equipo`  
**Componente:** `ScreenEquipo.tsx`

### Concepto
Gestión de los usuarios con acceso a la aplicación (distintos de los trabajadores de campo que son perfiles operativos).

### Funcionalidades

#### Lista de miembros
- Muestra: email, rol, estado (Activo/Pendiente)
- Tagline del rol debajo del email
- Click sobre el badge de rol → selector inline para cambiar rol

#### Invitar miembro
Modal en dos columnas:
- **Izquierda**: campo email + tarjetas de selección de rol (visual, con descripción)
- **Derecha**: panel de permisos del rol seleccionado (checklist ✓/—/✗ por función)

**Flujo de invitación:**
1. Owner/Admin introduce email y selecciona rol
2. Se llama edge function `send-invite`
3. El invitado recibe email con enlace mágico
4. Al aceptar → `trade_org_members.activo = true`
5. Si incluye `worker_profile_id` → el técnico queda vinculado a su perfil de campo

#### Tabla de permisos por rol
Vista desktop: tabla completa con filas = funciones, columnas = roles, celdas = ✓/—/✗

#### Límites por plan
| Plan | Miembros adicionales |
|---|---|
| Básico | 0 |
| Profesional | 0 |
| Empresa | 5 |
| Empresa+ | 15 |

#### Revocar acceso
Botón de papelera → confirmación → `trade_org_members.activo = false`

### Tablas afectadas
| Operación | Tabla | Acción |
|---|---|---|
| Cargar miembros | `trade_org_members` | SELECT activo=true |
| Invitar | `trade_org_members` | UPSERT (via edge function) |
| Cambiar rol | `trade_org_members` | UPDATE rol |
| Revocar | `trade_org_members` | UPDATE activo=false |
| Permisos custom | `trade_org_permissions` | SELECT/INSERT/DELETE |

---

## 14. Trabajadores

**Tab:** `trabajadores`  
**Componente:** `ScreenTrabajadores.tsx`

> **Distinción clave:** Los "trabajadores" aquí son **perfiles operativos** de campo (en `trade_workers`), NO usuarios de la aplicación. Un trabajador puede tener o no cuenta en la app.

### Funcionalidades

#### Lista de trabajadores
- Cards con: nombre, rol operativo (Técnico/Operario/Jefe de equipo), disponibilidad, especialidades, teléfono, máx. trabajos/día
- Badge de disponibilidad (Disponible/Ocupado/Vacaciones)

#### Crear/editar trabajador
Modal con:
- Nombre, teléfono, email
- Rol operativo (técnico/operario/jefe_equipo)
- Especialidades (múltiple selección: fontanería, electricidad, etc.)
- Disponibilidad (disponible/ocupado/vacaciones)
- Máx. trabajos por día
- Vehículo (sí/no)
- Horario (días y horas de trabajo)

**Guarda en:** `trade_workers` INSERT/UPDATE

#### Invitar a la app
Botón ✈ por trabajador → envía invitación por email incluyendo:
- `worker_profile_id` = ID del trabajador en `trade_workers`
- `rol` = 'tecnico'
- `org_id`

Esto vincula al usuario cuando acepta la invitación (`trade_org_members.worker_profile_id`).

#### Asignación a trabajos
Desde `ScreenPlanificacion`, al crear/editar un trabajo se puede asignar uno o más trabajadores. La asignación se guarda en `trade_job_workers`.

### Tablas afectadas
| Operación | Tabla | Acción |
|---|---|---|
| Crear trabajador | `trade_workers` | INSERT |
| Editar trabajador | `trade_workers` | UPDATE |
| Eliminar trabajador | `trade_workers` | DELETE |
| Cargar horario | `trade_worker_schedules` | SELECT/INSERT/UPDATE |
| Invitar a app | edge function `send-invite` | → `trade_org_members` UPSERT |
| Ver trabajos asignados | `trade_job_workers` | SELECT WHERE worker_id |

---

## 15. Contratos de Mantenimiento

**Tab:** `contratos`  
**Componente:** `ScreenContratos.tsx`

### Concepto
Gestión de contratos legales de mantenimiento periódico con clientes. 14 cláusulas predefinidas + anexos de condiciones. 23 sectores de trabajo soportados.

### Estados del contrato
```
Activo → Cancelado
      ↗
Presupuesto Mantenimiento (Aceptado) → Convertir a Contrato
```

### Wizard de creación de contrato
1. **Tipo de servicio** — sector (fontanería, electricidad, etc.)
2. **Cliente** — selector o nuevo inline
3. **Cobertura** — qué incluye el contrato (mano de obra, materiales, urgencias)
4. **Condiciones económicas** — precio mensual/anual, forma de pago
5. **Período** — inicio, duración, renovación automática
6. **Cláusulas** — 14 cláusulas base editable con IA por sector
7. **Revisión** — vista previa del documento
8. **Firma** — PDF generado para imprimir/enviar

### Generación de documentos
- **PDF**: `printTradeInvoice`-style HTML para imprimir
- **Word (.docx)**: `downloadContractAsDocx` — 14 cláusulas + anexos con variables del contrato rellenadas

### Variables en contratos
`{nombre_empresa}`, `{nif_empresa}`, `{nombre_cliente}`, `{nif_cliente}`, `{precio_mensual}`, `{precio_anual}`, `{fecha_inicio}`, `{duracion}`, `{servicios_incluidos}`, `{sector}`

### Conversión Presupuesto → Contrato
Si un presupuesto de mantenimiento es aceptado, aparece botón "Convertir a contrato" que pre-rellena el wizard con los datos del presupuesto.

### Tablas afectadas
| Operación | Tabla | Acción |
|---|---|---|
| Crear contrato | `trade_contracts` | INSERT |
| Editar contrato | `trade_contracts` | UPDATE |
| Cancelar contrato | `trade_contracts` | UPDATE estado=cancelado |
| Cargar contratos | `trade_contracts` JOIN `trade_clients` | SELECT |
| Variables del contrato | `trade_contracts.variables` | JSON field |

---

## 16. Mantenimientos

**Tab:** `mantenimiento`  
**Componente:** `ScreenMantenimiento.tsx`

> **Distinción con Contratos:** Los Contratos son el documento legal. Los Mantenimientos gestionan las **visitas y trabajos periódicos** derivados de esos contratos.

### Concepto
Gestión del calendario de mantenimientos programados. Generación automática de las visitas mensuales/trimestrales según el contrato.

### Funcionalidades

#### Vista de mantenimientos activos
- Tarjetas por contrato activo
- Estado de la visita del mes actual
- Próxima visita programada
- Indicador de materiales incluidos / a facturar

#### Generación automática de visitas
Edge function `trade-maintenance-generate` — crea `trade_jobs` de tipo mantenimiento para los contratos activos con vencimiento próximo.

#### Parte de mantenimiento
Al abrir un trabajo de mantenimiento → `ScreenParteTrabajo` en modo mantenimiento:
- Banner de "Trabajo de mantenimiento" indicando si materiales están incluidos
- Si no están incluidos: flujo normal de facturación al cerrar el parte

#### Facturación de mantenimientos
Edge function `trade-maintenance-billing` — genera facturas periódicas (serie M-) para los contratos con facturación automática.

### Tablas afectadas
| Operación | Tabla | Acción |
|---|---|---|
| Cargar contratos activos | `trade_contracts` | SELECT estado=activo |
| Generar visita | `trade_jobs` | INSERT (via edge function) |
| Registrar parte | `trade_jobs` | UPDATE estado=completado |
| Generar factura | `trade_invoices` | INSERT serie=M (via edge function) |
| Email aviso | via `trade-maintenance-email` edge function | — |

---

## 17. Ajustes y Tarifas

**Tab:** `settings`  
**Componente:** `ScreenSettings()` interno en `AppDashboardView.tsx`

### Secciones de Ajustes

#### 1. Datos de empresa
Campos editables:
- Nombre comercial, Razón social, NIF/CIF
- Dirección, Ciudad, C.P., Provincia
- Teléfono fijo, Móvil, Email, Web
- IBAN, Banco, Titular cuenta
- IVA por defecto (%)

**Guarda en:** `trade_organizations` (UPDATE) + localStorage `tf_biz_config`

#### 2. Logo de empresa
- Upload de imagen (PNG/JPG/WebP/SVG, máx. 2MB)
- Vista previa inmediata
- Se muestra en presupuestos y facturas
- Eliminar logo

**Guarda en:** Supabase Storage `org-logos/{orgId}/logo.{ext}` → `trade_organizations.logo_url`

#### 3. Tarifas operativas
| Campo | Descripción |
|---|---|
| Precio hora operario | Base para cálculo de mano de obra en IA |
| Margen sobre materiales | % de beneficio sobre precio de coste de piezas |
| Descuento cliente por defecto | % de descuento automático en presupuestos |

**Guarda en:** localStorage `tf_biz_config`

#### 4. Plantillas de comunicación
8 tipos de plantilla:
| Tipo | Uso |
|---|---|
| `whatsapp_presupuesto` | Mensaje WA al enviar presupuesto |
| `email_presupuesto` | Cuerpo del email al enviar presupuesto |
| `email_factura` | Cuerpo del email al enviar factura |
| `recordatorio_pago` | WA/email cuando factura próxima a vencer |
| `aviso_visita` | Confirmación de visita programada |
| `pie_presupuesto` | Texto en pie de página de presupuestos |
| `pie_factura` | Texto en pie de página de facturas |
| `contrato_mantenimiento` | Cláusulas personalizadas de contratos |

Cada plantilla tiene variables: `{nombre}`, `{empresa}`, `{numero}`, `{total}`, `{fecha}`, `{vencimiento}`, `{iva}`, `{cif}`, `{direccion}`

**Guarda en:** `trade_org_templates` via `saveOrgTemplate(orgId, tipo, contenido, nombre)`

#### 5. Plan de suscripción
- Muestra plan actual (Básico / Empresa / Empresa+)
- Estado (trial/activo/vencido)
- Días restantes si está en trial
- Botón "Ver planes" → `PlanUpgradeModal` (integrado con Stripe)
- Botón "Portal de facturación" → Stripe Customer Portal

**Planes disponibles:**
| Plan | Precio | Miembros | Mantenimiento |
|---|---|---|---|
| Básico | Gratis | 0 extra | ✗ |
| Empresa | 49€/mes | 5 | ✓ |
| Empresa+ | 89€/mes | 15 | ✓ |

#### 6. Notificaciones push
- Toggle activar/desactivar notificaciones web push
- Se subscribe a `trade_push_subscriptions` con endpoint VAPID

### Tablas afectadas
| Operación | Tabla | Acción |
|---|---|---|
| Guardar empresa | `trade_organizations` | UPDATE |
| Logo | Supabase Storage + `trade_organizations` | UPLOAD + UPDATE logo_url |
| Plantillas | `trade_org_templates` | UPSERT |
| Plan | `trade_subscriptions` | SELECT |
| Checkout Stripe | via `trade-stripe-checkout` edge function | → Stripe API |
| Push subscription | `trade_push_subscriptions` | INSERT/DELETE |

---

## 18. Módulo Técnico (App del Trabajador de Campo)

> El técnico tiene una vista completamente diferente al propietario/oficina.

### Detección del rol técnico
En `SessionContext.tsx`: si `rol === 'tecnico'` se carga `workerProfile` (perfil de `trade_workers` vinculado via `worker_profile_id` en `trade_org_members`).

### Vista Desktop (técnico)
**Sidebar simplificado:** solo muestra:
- Planificación (filtrada a sus trabajos)
- Ruta del Día (filtrada a sus trabajos)

**Sin:** Panel de Control, Presupuestos, Clientes, Facturas, Catálogo, Ingresos, Ajustes...

**Header del técnico:**
- Inicial verde + nombre del técnico
- "TÉCNICO · Nombre empresa"
- Sin botón de configuración

### Vista Mobile (técnico)
**Header:** nombre del técnico + "TÉCNICO · empresa" + botón logout  
**Bottom tabs:** solo 2 pestañas:
- **Mis Trabajos** → `ScreenPlanificacion` filtrada a trabajos donde `trade_job_workers.worker_id = workerProfile.id`
- **Mi Ruta** → `ScreenRutaDia` filtrada igual

**Botón "Nuevo trabajo"** → disponible (el técnico puede crear trabajos si surge uno en campo)

### Filtrado de trabajos por técnico
```typescript
jobs.filter(j => 
  j.trade_job_workers?.some(jw => jw.worker_id === workerProfile.id)
)
```

### Parte de trabajo del técnico (ScreenParteTrabajo modo técnico)
Diferencias respecto al modo propietario:
- **Sin catálogo de materiales** (no puede agregar artículos para facturar)
- **Sin selección de método de cobro**
- **Sin generación de factura** — al completar va directamente a pantalla "Completado — pendiente de facturar por oficina"
- **Con notas de campo** (sección exclusiva):
  - Tipo de nota (Presupuesto requerido / Material necesario / Incidencia / Consulta / Otro)
  - Textarea o dictado por voz
  - "Enviar nota a oficina" → guarda en `trade_jobs.notas_trabajador` + crea `trade_field_actions`
- **Fotos** del trabajo ✓
- **Notas de cierre** ✓

---

## 19. Pipeline de Inteligencia Artificial

### Flujo: Voz → Presupuesto

```
1. Grabar audio (MediaRecorder API, formato webm/mp4)
2. Convertir a base64
3. Enviar a edge function trade-voice-to-quote
4. Claude Haiku transcribe el audio
5. Búsqueda web de precios actuales (tool use: web_search_20250305)
6. Devuelve JSON estructurado:
   {
     descripcion: string,
     partidas: [{
       descripcion, tipo, cantidad, precioUnitario, total
     }]
   }
7. Pre-rellena el wizard de presupuesto
8. El instalador revisa y ajusta
9. Al guardar → INSERT en trade_quotes + trade_quote_items
10. Guarda en trade_ai_feedback para aprendizaje futuro
```

### Aprendizaje automático
Cuando el instalador **modifica** los precios sugeridos por la IA y guarda, se actualiza `trade_ai_feedback` con la corrección. La edge function `update_actuacion_learned` (RPC) actualiza los precios aprendidos para futuros presupuestos del mismo tipo.

### Flujo: Voz → Parte de Trabajo (materiales)

```
1. Grabar audio en ScreenParteTrabajo
2. Enviar a trade-parse-parte
3. Claude analiza y detecta:
   - Materiales usados (con cantidades)
   - Notas de cierre
4. Compara con catálogo de la empresa (primeros 150 artículos)
5. Sugiere: artículo del catálogo más próximo + precio
6. Añade automáticamente a la lista de materiales del parte
```

**Para rol técnico:** mismo audio pero en lugar de materiales → rellena la nota de campo.

### Flujo: Foto → Presupuesto

```
1. Fotografiar trabajo (cámara o upload)
2. Enviar a trade-photo-scan
3. Claude Haiku analiza la imagen
4. Devuelve lista de trabajos detectados
5. trade-presupuesto-foto estructura como partidas
6. Flujo igual al de voz desde paso 7
```

### Chatbot de Ayuda (`trade-chatbot`)
- Modelo: Claude Haiku 4.5
- Botón flotante en esquina inferior derecha
- Responde preguntas sobre la aplicación
- Detecta necesidades nuevas del instalador → `trade_installer_needs`
- Si pregunta sobre oficio no soportado → captura para roadmap

---

## 20. Parte de Trabajo

**Componente:** `ScreenParteTrabajo.tsx`  
**Se abre desde:** Planificación (botón "Parte") y Ruta del Día

### Modos de apertura
| Modo | Cuándo | Qué permite |
|---|---|---|
| `edit` | Trabajo no completado | Completar, añadir materiales, fotos, notas, generar factura |
| `view` | Trabajo completado sin factura (mantenimiento) | Ver el resumen, no editar |
| `supplement` | Trabajo completado con factura | Solo añadir material olvidado → factura suplementaria |

### Secciones del parte (modo edit)

#### 1. Info del trabajo
- Cliente, dirección, hora inicio/fin
- Banner de mantenimiento si aplica

#### 2. Dictado con IA
- Micrófono para dictar materiales y descripción del trabajo
- Para técnico: dictado de nota de campo (modo diferente)

#### 3. Fotos del trabajo
- Tomar foto directamente (cámara) o subir desde galería
- Grid de miniaturas con opción de eliminar
- **Guarda en:** Supabase Storage `job-photos/` → `trade_job_photos` (INSERT)

#### 4. Materiales
- Buscador en catálogo de la empresa
- Lista de materiales añadidos con cantidades editables
- Edición de precio inline (click sobre precio)
- Añadir línea personalizada (mano de obra, desplazamiento)
- Separación entre materiales normales y post-cierre

#### 5. Notas de cierre
- Textarea libre para observaciones
- Se rellena automáticamente con el resultado de la IA

#### 6. Notas de campo (solo técnico)
- Tipo: presupuesto_requerido / material_necesario / incidencia / consulta / otro
- Textarea o dictado por voz
- "Enviar nota a oficina"

### Flujo de completar trabajo (modo propietario/oficina/admin)

```
1. Pulsar "Completar trabajo"
2. Guarda: trade_jobs UPDATE (estado=completado, notas_cierre, hora_fin)
3. ¿Tiene materiales y no está cubierto por mantenimiento?
   → Fase FACTURAR:
     a. Ver resumen de materiales a facturar
     b. "Generar y registrar factura" → createInvoiceFromJob()
        INSERT trade_invoices (borrador) + trade_invoice_lines
     c. Elegir método de cobro (efectivo/bizum/tarjeta)
     d. "Cobrado" → emitirFactura() + markInvoicePaid()
        UPDATE trade_invoices (estado=Pagada, metodo_pago, paid_at)
     e. "Pendiente" → emitirFactura()
        UPDATE trade_invoices (estado=Emitida, metodo_pago=transferencia)
```

### Flujo de completar trabajo (técnico)

```
1. Pulsar "Completar trabajo"
2. Guarda: trade_jobs UPDATE (estado=completado)
3. Pantalla "Trabajo completado — pendiente de facturar por oficina"
4. Cerrar parte
```

### Tablas afectadas
| Operación | Tabla | Acción |
|---|---|---|
| Completar trabajo | `trade_jobs` | UPDATE estado, notas_cierre, hora_fin |
| Subir foto | Supabase Storage + `trade_job_photos` | UPLOAD + INSERT |
| Crear factura | `trade_invoices` | INSERT |
| Crear líneas | `trade_invoice_lines` | INSERT |
| Emitir factura | `trade_invoices` | UPDATE numero, estado, fecha |
| Registrar cobro | `trade_invoices` | UPDATE estado, paid_at, metodo_pago |
| Nota de campo | `trade_jobs.notas_trabajador` + `trade_field_actions` | UPDATE + INSERT |
| Factura suplementaria | `trade_invoices` + `trade_invoice_lines` | INSERT (es_suplementaria=true) |

---

## 21. PWA y Notificaciones Push

### Instalación PWA
- La app es instalable como PWA en Android, iOS y escritorio (Chrome, Edge, Safari)
- No requiere tiendas de aplicaciones
- `manifest.json` configurado para icono, nombre, orientación
- Service Worker registrado para funcionamiento offline básico

### Notificaciones Push (Web Push / VAPID)
- **Gratuito**: sin Firebase, usando Web Push Protocol con claves VAPID propias
- Tabla: `trade_push_subscriptions` (endpoint, keys p256dh y auth, user_id, org_id)

**Tipos de notificaciones enviadas:**
- Nuevo presupuesto recibido
- Trabajo asignado (para técnicos)
- Factura próxima a vencer
- Recordatorio de visita programada
- Cobro registrado

**Edge function:** `trade-push-notify` — envía notificación web push a todos los suscriptores de la organización.

---

## 22. VeriFactu

### Cumplimiento normativo
Las facturas generadas incluyen en el pie del PDF:
> *"Factura expedida en el marco del Reglamento de Sistemas de Facturación Verificable (VeriFactu) · RD 1007/2023"*

### Implementación actual
- Texto de conformidad en pie de factura PDF (`printTradeInvoice.ts`)
- Número de registro incluido en el footer
- Series de numeración estrictas (F- y M-)
- Numeración correlativa sin saltos (asignada al emitir)
- Estado de factura inmutable una vez emitida (solo anulación con rectificativa)

### Factura Rectificativa
- Crea nueva factura con importes negativos referenciando la original
- Tipo: `rectificativa`
- Color rojo en el PDF + banner de advertencia
- Número correlativo en serie R-

---

## 23. Chatbot

**Componente:** `ChatbotWidget.tsx`  
**Edge function:** `trade-chatbot`  
**Modelo:** Claude Haiku 4.5

### Posición
Botón flotante circular en esquina inferior derecha de toda la aplicación.

### Funcionalidad
- Responde preguntas sobre cómo usar la aplicación
- Explica funcionalidades, flujos y configuraciones
- Detecta necesidades del instalador que no están en la app → registra en `trade_installer_needs`
- Si pregunta sobre oficio no soportado → captura para roadmap

### Datos capturados
`trade_installer_needs`: tipo de necesidad, descripción, oficio del usuario, org_id, created_at

### Vista Admin
En el Panel de Administración hay una sección "Necesidades" que muestra todas las capturas del chatbot, agrupadas por tipo, para priorizar el roadmap.

---

## 24. Base de Datos

### Tablas principales

#### `trade_organizations`
Empresa del instalador. Una por cuenta de propietario.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | ID único |
| owner_id | uuid FK auth.users | Propietario |
| nombre | text | Nombre comercial |
| razon_social | text | Razón social legal |
| nif | text | NIF/CIF |
| direccion | text | Dirección fiscal |
| ciudad | text | Ciudad |
| cp | text | Código postal |
| telefono | text | Teléfono |
| email | text | Email de contacto |
| logo_url | text | URL del logo en Storage |
| oficio | text | Áreas de trabajo (csv) |
| iva_default | int | IVA por defecto (21) |
| iban | text | IBAN bancario |
| banco | text | Entidad bancaria |
| titular_cuenta | text | Titular IBAN |
| is_onboarded | bool | ¿Completó el wizard? |

#### `trade_clients`
Clientes del instalador.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| org_id | uuid FK | Organización propietaria |
| nombre | text | Nombre/empresa cliente |
| nif | text | NIF/CIF cliente |
| telefono | text | — |
| email | text | — |
| direccion | text | — |
| ciudad | text | — |
| activo | bool | Soft delete |
| share_token | text | Token de enlace público |

#### `trade_quotes`
Presupuestos.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| org_id | uuid FK | — |
| client_id | uuid FK | `trade_clients` |
| numero | text | Número de presupuesto |
| estado | text | Borrador/Enviado/Aceptado/Rechazado/Facturado/Vencido |
| fecha | date | Fecha de emisión |
| fecha_vencimiento | date | Vence (30 días por defecto) |
| total | numeric | Total sin IVA |
| descripcion | text | Descripción del trabajo |
| concepto | text | — |
| descuento | numeric | % descuento aplicado |

#### `trade_quote_items`
Partidas del presupuesto.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| quote_id | uuid FK | Presupuesto |
| descripcion | text | Descripción de la partida |
| tipo | text | material/mano_de_obra/desplazamiento |
| cantidad | numeric | — |
| precio_unitario | numeric | — |
| total | numeric | cantidad × precio |
| orden | int | Posición en el presupuesto |

#### `trade_invoices`
Facturas.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| org_id | uuid FK | — |
| client_id | uuid FK | `trade_clients` |
| job_id | uuid FK | `trade_jobs` (origen) |
| contract_id | uuid FK | `trade_contracts` (si es de mantenimiento) |
| numero | text | Número definitivo (asignado al emitir) |
| serie | text | F o M |
| tipo_factura | text | trabajo_puntual/contrato_cuota/contrato_extra/rectificativa |
| estado | text | Borrador/Emitida/Pendiente/Pagada/Vencida/Cancelada |
| fecha | date | Fecha emisión |
| fecha_vencimiento | date | — |
| fecha_emision | timestamptz | Timestamp exacto de emisión |
| subtotal | numeric | Base imponible |
| iva_pct | int | % IVA |
| iva_importe | numeric | Importe IVA |
| total | numeric | Total con IVA |
| concepto | text | Descripción |
| metodo_pago | text | transferencia/efectivo/bizum/tarjeta/domiciliacion |
| paid_at | timestamptz | Cuando se cobró |
| es_suplementaria | bool | Factura por material olvidado |
| factura_original_id | uuid FK | Si es rectificativa, factura original |
| razon_social_cliente | text | Snapshot de datos cliente al emitir |
| nif_cliente | text | — |
| direccion_cliente | text | — |

#### `trade_invoice_lines`
Líneas de detalle de factura.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| factura_id | uuid FK | `trade_invoices` |
| descripcion | text | — |
| cantidad | numeric | — |
| precio_unitario | numeric | — |
| subtotal | numeric | cantidad × precio_unitario |
| tipo | text | material/mano_de_obra/desplazamiento |
| orden | int | — |

#### `trade_jobs`
Trabajos planificados.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| org_id | uuid FK | — |
| client_id | uuid FK | — |
| titulo | text | Descripción breve del trabajo |
| tipo | text | trabajo/visita |
| estado | text | planificado/en_curso/completado/cancelado |
| prioridad | text | normal/alta/urgente |
| fecha_inicio | date | Fecha programada |
| hora_inicio | time | — |
| hora_fin | time | — |
| duracion_horas | int | Duración estimada |
| direccion | text | — |
| localidad | text | — |
| cp | text | — |
| latitud, longitud | float | Geocoordenadas |
| notas | text | Instrucciones para el técnico |
| notas_cierre | text | Lo que se hizo (rellena el técnico) |
| notas_trabajador | text | Nota de campo del técnico |
| notas_trabajador_at | timestamptz | Cuando dejó la nota |
| notas_trabajador_leida | bool | Si oficina la leyó |
| completado_at | timestamptz | — |
| contract_id | uuid FK | Si es visita de mantenimiento |

#### `trade_job_workers`
Asignación de trabajadores a trabajos.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| job_id | uuid FK | — |
| worker_id | uuid FK | `trade_workers` |
| rol | text | responsable/asignado/apoyo |
| aceptado | bool | Si el trabajador confirmó |

#### `trade_job_photos`
Fotos del parte de trabajo.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| job_id | uuid FK | — |
| photo_url | text | URL en Supabase Storage |
| tipo | text | installer/client/before/after |
| caption | text | Descripción opcional |
| created_at | timestamptz | — |

#### `trade_workers`
Perfiles operativos de trabajadores de campo.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| org_id | uuid FK | — |
| nombre | text | — |
| telefono | text | — |
| email | text | — |
| rol | text | tecnico/operario/jefe_equipo |
| especialidades | text[] | Array de áreas |
| disponibilidad | text | disponible/ocupado/vacaciones |
| max_trabajos_dia | int | — |
| tiene_vehiculo | bool | — |

#### `trade_org_members`
Usuarios con acceso a la app de una organización.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| org_id | uuid FK | — |
| user_id | uuid FK auth.users | — |
| email | text | — |
| rol | text | admin/oficina/comercial/tecnico/visualizador |
| activo | bool | Si aceptó la invitación |
| invited_at | timestamptz | — |
| worker_profile_id | uuid FK `trade_workers` | Vincula cuenta con perfil campo |

#### `trade_org_permissions`
Overrides de permisos individuales.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| member_id | uuid FK `trade_org_members` | — |
| permiso | text | Código del permiso |
| granted | bool | true=conceder, false=revocar |

#### `trade_field_actions`
Notas de campo de los técnicos.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| org_id | uuid FK | — |
| job_id | uuid FK | `trade_jobs` |
| worker_id | uuid FK | `trade_workers` |
| tipo | text | presupuesto_requerido/material_necesario/incidencia/consulta/otro |
| descripcion | text | Contenido de la nota |
| estado | text | pendiente/en_proceso/resuelto/descartado |
| resuelto_por | text | Quién resolvió |
| resuelto_at | timestamptz | — |

#### `trade_tarifas`
Catálogo simple de artículos/servicios.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| org_id | uuid FK | — |
| codigo | text | Código de referencia |
| familia | text | Categoría (fontaneria, etc.) |
| descripcion | text | Nombre del artículo |
| precio_base | numeric | Precio de venta base |
| unidad | text | ud/h/m²/ml/m³ |
| activo | bool | Soft delete |

#### `trade_contracts`
Contratos de mantenimiento.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| org_id | uuid FK | — |
| referencia | text | Nº de contrato |
| client_id | uuid FK | — |
| oficio | text | Tipo de servicio |
| estado | text | activo/cancelado/vencido |
| precio_mensual | numeric | — |
| precio_anual | numeric | — |
| fecha_inicio | date | — |
| duracion_meses | int | — |
| renovacion_automatica | bool | — |
| materiales_incluidos | bool | Si los materiales están cubiertos |
| variables | jsonb | Variables para el documento del contrato |

#### `trade_subscriptions`
Plan SaaS contratado.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| org_id | uuid FK | — |
| plan | text | basico/empresa/empresa_plus |
| status | text | trial/active/cancelled/expired |
| trial_end | timestamptz | Fin del periodo de prueba |
| stripe_subscription_id | text | ID en Stripe |
| stripe_customer_id | text | — |

#### `trade_org_templates`
Plantillas de comunicación personalizadas.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| org_id | uuid FK | — |
| tipo | text | whatsapp_presupuesto/email_factura/etc. |
| nombre | text | Nombre de la plantilla |
| contenido | text | Texto con variables {nombre}, {total}... |
| updated_at | timestamptz | — |

#### `trade_push_subscriptions`
Suscripciones a notificaciones push.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| user_id | uuid FK | — |
| org_id | uuid FK | — |
| endpoint | text | URL del servicio push |
| p256dh | text | Clave pública ECDH |
| auth | text | Clave de autenticación |

#### `trade_subcontractors`
Directorio de proveedores colaboradores (servicios externos).
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| org_id | uuid FK | — |
| nombre | text | Nombre comercial |
| telefono | text | — |
| email | text | — |
| nif | text | CIF/NIF |
| notas | text | — |
| direccion_fiscal | text | Dirección fiscal completa |
| direccion_trabajo | text | Zona de trabajo habitual |
| persona_contacto | text | Nombre del contacto |
| horarios | text | Horarios de disponibilidad |
| cobertura | text | Área geográfica cubierta |
| valoracion | smallint | 1-5 estrellas |
| estado_proveedor | text | activo / pendiente / bloqueado |
| activo | bool | Soft delete |

#### `trade_subcontratas`
Trabajos externalizados individuales.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| org_id | uuid FK | — |
| subcontractor_id | uuid FK | `trade_subcontractors` |
| referencia | text | SUB-YYYY-NNN (auto por trigger) |
| descripcion | text | Descripción del trabajo |
| estado | text | pendiente / solicitado / presupuesto_recibido / añadido_presupuesto / pendiente_cliente / en_curso / completado / factura_recibida / pagado / cancelado |
| coste | numeric | Coste del proveedor |
| precio_cliente | numeric | Precio al cliente (incluye margen) |
| margen_pct | numeric | % margen sobre coste |
| presupuesto_id | uuid FK | `trade_quotes` (si está vinculado) |
| pagado | bool | true cuando estado=pagado |
| notas | text | — |
| fecha_inicio | date | — |
| fecha_estimada_fin | date | — |

#### `trade_mayoristas`
Proveedores de material (mayoristas/distribuidores).
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| org_id | uuid FK | — |
| nombre | text | Nombre comercial |
| razon_social | text | Razón social legal |
| nif | text | NIF/CIF |
| direccion_fiscal | text | — |
| cp | text | — |
| ciudad | text | — |
| provincia | text | — |
| telefono | text | — |
| email | text | — |
| persona_contacto | text | — |
| web | text | — |
| notas | text | — |
| activo | bool | Soft delete |

#### `trade_compras`
Facturas de compra de material.
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | — |
| org_id | uuid FK | — |
| mayorista_id | uuid FK | `trade_mayoristas` (opcional) |
| referencia_factura | text | Nº de factura del proveedor |
| concepto | text | Descripción de la compra |
| importe | numeric | Base imponible |
| iva_pct | int | 0, 10 o 21 |
| fecha | date | Fecha de la factura |
| fecha_vencimiento | date | Fecha límite de pago |
| pagado | bool | — |
| pagado_at | timestamptz | Cuando se pagó |
| job_id | uuid FK | `trade_jobs` (vinculación opcional) |
| notas | text | — |

#### Tablas del panel de administración
- `trade_platform_invoices` — facturas de TrabFlow a sus clientes
- `trade_installer_needs` — necesidades capturadas por el chatbot
- `trade_waitlist` — lista de espera de nuevos usuarios

---

## 25. Edge Functions

### Listado completo

| Función | Trigger | Descripción |
|---|---|---|
| `send-invite` | Manual (admin) | Envía invitación por email. Crea `trade_org_members` con rol y `worker_profile_id` |
| `trade-voice-to-quote` | Usuario (mic) | Transcribe audio → estructura presupuesto con IA + web search de precios |
| `trade-parse-parte` | Usuario (mic en parte) | Transcribe audio del parte → detecta materiales usados del catálogo |
| `trade-photo-scan` | Usuario (foto) | Analiza imagen → detecta tipo de trabajo y materiales |
| `trade-presupuesto-foto` | Automático | Convierte resultado del scan fotográfico en partidas de presupuesto |
| `trade-email` | Manual/automático | Envío de emails (presupuesto, factura, recordatorio) via SendGrid/Resend |
| `trade-maintenance-generate` | Scheduled/manual | Genera trabajos de visita para contratos activos con vencimiento próximo |
| `trade-maintenance-billing` | Scheduled | Genera facturas mensuales para contratos de mantenimiento |
| `trade-maintenance-email` | Automático | Avisa al cliente de la visita programada |
| `trade-maintenance-parte` | Usuario | Registra parte de mantenimiento realizado |
| `trade-maintenance-detect` | IA | Detecta si una consulta de cliente corresponde a necesidad de mantenimiento |
| `trade-geocode-address` | Automático | Convierte dirección en texto → coordenadas GPS via API geocodificación |
| `trade-push-notify` | Eventos | Envía notificaciones push Web VAPID a los suscriptores |
| `trade-stripe-checkout` | Usuario | Crea sesión de pago en Stripe para upgrade de plan |
| `trade-stripe-portal` | Usuario | Redirige al portal de gestión de suscripción de Stripe |
| `trade-stripe-webhook` | Stripe → Supabase | Procesa eventos de pago (suscripción activada/cancelada/renovada) |

---

## 26. Políticas RLS

Todas las tablas tienen RLS habilitado. Política general:
- El propietario (`trade_organizations.owner_id = auth.uid()`) puede hacer TODO sobre su organización
- Los miembros activos (`trade_org_members.user_id = auth.uid() AND activo = true`) también pueden acceder según su rol

### Políticas destacadas
| Tabla | Política | Acceso |
|---|---|---|
| `trade_invoices` | `invoices_org_access` | Owner O miembro activo de la org |
| `trade_invoice_lines` | `invoice_lines_org_access` | Si la factura pertenece a la org |
| `trade_jobs` | Por org_id | Owner O miembro activo |
| `trade_field_actions` | Por org_id | Owner O miembro activo |
| `trade_org_members` | Lectura propia | Cada usuario ve solo su registro |
| `trade_push_subscriptions` | Por user_id | Solo el propio usuario |

---

## 27. Flujos de Negocio Principales

### Flujo 1: Del trabajo al cobro (autónomo en campo)

```
1. Cliente llama/WhatsApp solicitando trabajo
2. Instalador dicta presupuesto por voz (trade-voice-to-quote)
3. Revisa y ajusta partidas en wizard
4. Envía presupuesto al cliente (WhatsApp/email)
5. Cliente acepta → marca Aceptado en la app
6. Crea trabajo planificado → asigna fecha y hora
7. Día del trabajo: consulta Ruta del Día
8. Llega a la obra → abre Parte de Trabajo
9. Añade materiales usados (voz o catálogo)
10. Hace fotos del trabajo terminado
11. Completa el trabajo → genera factura
12. Selecciona método de cobro → factura Pagada
13. Envía factura al cliente por WhatsApp/email
```

### Flujo 2: Empresa con técnicos de campo

```
Admin/Propietario:
1. Crea perfil del técnico en Trabajadores
2. Invita al técnico a la app (email)
3. Crea trabajos en Planificación
4. Asigna técnicos a cada trabajo
5. Técnico recibe notificación push

Técnico (su app simplificada):
6. Ve sus trabajos en "Mis Trabajos"
7. Consulta "Mi Ruta" del día
8. Abre parte del trabajo
9. Dicta notas de lo realizado (material necesario, incidencias)
10. Hace fotos
11. Completa el trabajo → "Pendiente de facturar"

Admin/Propietario:
12. Ve las notas del técnico en el trabajo
13. Revisa los trade_field_actions (incidencias, presupuestos requeridos)
14. Genera la factura manualmente desde la ficha del trabajo
```

### Flujo 3: Contrato de mantenimiento

```
1. Visita comercial → presupuesto de mantenimiento
2. Cliente acepta → convertir a contrato
3. Sistema genera visita mensual automáticamente
4. Técnico realiza visita → parte de mantenimiento
5. Si materiales incluidos → no factura extra
6. Si materiales no incluidos → factura suplementaria
7. Facturación mensual automática (serie M-)
8. Email automático de aviso al cliente
```

### Flujo 4: Nuevo instalador (onboarding)

```
1. Registro en trabflow.com
2. Recibe email de confirmación
3. Primera vez: aparece wizard de 7 pasos
4. Configura empresa, tarifas, catálogo, logo, plantillas
5. App lista para trabajar
6. Si salta el wizard → banner de pasos pendientes en dashboard
```

---

## 28. Exportaciones y Documentos Generados

### Factura PDF
**Función:** `printTradeInvoice(inv, lines, org)`  
**Tecnología:** HTML generado + `window.print()` en nueva ventana  
**Incluye:**
- Barra de color superior (azul para trabajo, morado para mantenimiento, rojo para rectificativa)
- Logo de empresa + datos fiscales
- Número, fecha, estado badge
- Tabla de líneas de detalle
- Totales (base + IVA + TOTAL)
- Footer con datos empresa
- **Footer VeriFactu:** "Factura expedida en el marco del Reglamento de Sistemas de Facturación Verificable (VeriFactu) · RD 1007/2023"

### Presupuesto PDF
Mismo mecanismo que factura. Incluye pie de página personalizado de la plantilla.

### Factura Word (.docx)
**Función:** `downloadAsWordDocx(opts, filename)`  
**Tecnología:** librería `docx` v9.7.1  
Genera documento Word completo con el mismo contenido que el PDF, editable.

### Presupuesto Word (.docx)
Mismo mecanismo. Con tabla de partidas, condiciones, pie de página.

### Contrato de Mantenimiento Word (.docx)
**Función:** `downloadContractAsDocx(vars, filename)`  
14 cláusulas legales + anexos. Variables rellenadas con datos del contrato.

### Exportación Gestoría CSV
Libro de facturas emitidas del trimestre en formato CSV compatible con software de contabilidad. Campos: número, fecha, cliente, NIF, base, IVA %, IVA €, total, estado, método de pago.

---

## 29. Panel de Administración

**Acceso:** Solo para `fercarboc@gmail.com` (email del creador de TrabFlow)  
**URL interna:** navega a `ActivePage.Admin`

### KPIs de la plataforma
- Total de organizaciones registradas
- Usuarios por plan
- MRR (Monthly Recurring Revenue) estimado
- Conversión trial → pago
- Presupuestos generados (total y por organización)

### Módulos del panel admin
| Módulo | Descripción |
|---|---|
| Usuarios | Lista de todas las organizaciones con plan, estado, última actividad |
| Suscripciones | Estado de pagos, trials activos, renovaciones |
| Necesidades | Capture del chatbot: necesidades de los instaladores |
| Facturas plataforma | Las facturas que TrabFlow emite a sus clientes |
| Ajustes | Configuración de la plataforma |

### Funciones RPC admin (SECURITY DEFINER)
- `admin_get_trade_users()` — lee `auth.users` para el panel
- `admin_get_platform_invoices()` — facturas de TrabFlow
- `admin_set_subscription_active(org_id, plan)` — activa/cambia plan manualmente

---

## 30. Glosario

| Término | Definición |
|---|---|
| **Org / Organización** | Empresa del instalador en TrabFlow. Una por propietario |
| **Owner** | El dueño de la organización. Acceso total |
| **Técnico** | Trabajador de campo con cuenta en la app. Ve solo sus trabajos |
| **Trade Worker** | Perfil operativo del trabajador en `trade_workers`. Puede o no tener cuenta |
| **Parte de trabajo** | Documento que cierra un trabajo: materiales, fotos, notas, horas |
| **Borrador** | Estado inicial de presupuesto o factura. Editable |
| **Emitida** | Factura con número definitivo asignado. Enviable al cliente |
| **Serie F-** | Serie de facturas de trabajo puntual (Fontanería, Electricidad...) |
| **Serie M-** | Serie de facturas de contratos de mantenimiento |
| **Rectificativa** | Factura que anula y sustituye a otra emitida con error |
| **VeriFactu** | Reglamento español de facturación verificable (RD 1007/2023) |
| **VAPID** | Protocolo de notificaciones push web sin intermediarios (sin Firebase) |
| **RLS** | Row Level Security — control de acceso a nivel de fila en PostgreSQL |
| **Edge Function** | Función serverless de Supabase (Deno) que ejecuta lógica de servidor |
| **Pipeline IA** | Flujo completo desde grabación de voz hasta presupuesto estructurado |
| **Tarifa** | Artículo del catálogo simple (`trade_tarifas`) |
| **Worker Profile** | Vinculación entre cuenta de usuario (`auth.users`) y perfil de campo (`trade_workers`) |
| **Field Action** | Nota de campo del técnico: presupuesto requerido, incidencia, material necesario |
| **Onboarding** | Wizard de configuración inicial que aparece al primer login del propietario |
| **Plan Empresa** | Plan SaaS con hasta 5 miembros. Incluye trabajos externalizados y módulo de gastos. 89€/mes |
| **Plan Empresa+** | Plan SaaS con hasta 15 miembros y todos los módulos avanzados. 179€/mes |
| **Trabajo Externalizado** | Trabajo delegado a un proveedor colaborador. Internamente es una "subcontrata" pero nunca se muestra ese término al cliente |
| **Proveedor Colaborador** | Empresa o autónomo externo que ejecuta trabajos a nombre del instalador (`trade_subcontractors`) |
| **Mayorista / Distribuidor** | Proveedor de material (no de servicio). Registrado en `trade_mayoristas` |
| **Factura de Compra** | Factura que emite un proveedor de material al instalador (`trade_compras`) |
| **Margen Externalizado** | Diferencia entre el precio al cliente y el coste del proveedor. Calculado con botones rápidos 15-40% |
| **SUB-YYYY-NNN** | Referencia automática de trabajo externalizado generada por trigger de BD |

---

*Documento actualizado el 15 de junio de 2026 · TrabFlow AI v3.1*  
*Añadido: Trabajos Externalizados (v12b), Mayoristas (v12c), tablas trade_subcontractors/trade_subcontratas/trade_mayoristas/trade_compras, módulo Gastos en ScreenIngresos*  
*Para actualizar este documento, subir el fichero Markdown a Claude y solicitar la versión actualizada.*
