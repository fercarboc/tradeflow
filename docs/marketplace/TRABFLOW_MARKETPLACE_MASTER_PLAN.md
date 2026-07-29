# TrabFlow Marketplace — Master Plan

> **Clasificación:** Documento de Arquitectura y Estrategia — Uso Interno  
> **Versión:** 1.0 — 2026-07-23  
> **Autor:** Arquitectura de Producto — TrabFlow Technologies  
> **Estado:** Documento vivo — se actualiza con cada sprint relevante  
> **Referencia cruzada:** ARQUITECTURA.md · TRABFLOW_CONNECT_AUDIT.md · docs/ai-engine/

---

## NOTA PRELIMINAR

Este documento no describe un marketplace genérico. Describe la evolución natural del ERP de TrabFlow hacia un sistema operativo completo del instalador. Cada decisión arquitectónica parte de lo que ya existe y funciona en producción. Ninguna sección puede leerse en aislamiento: el Marketplace es TrabFlow, no un módulo adjunto.

El documento usa el siguiente convenio:

- `✅ EXISTE` — implementado y en producción
- `🔜 FASE X` — planificado en la fase indicada
- `⚠️ DECISIÓN PENDIENTE` — requiere validación con el equipo
- `🚫 FUERA DE SCOPE` — explícitamente excluido del roadmap

---

# PARTE I — VISIÓN Y ESTRATEGIA

---

## 1. VISIÓN

### 1.1 Formulación de visión

> **TrabFlow debe convertirse en el sistema operativo del instalador.**
> El Marketplace es la evolución que convierte un presupuesto aceptado en un pedido inteligente,
> sin que el instalador salga nunca de TrabFlow.

Hoy, cuando un instalador acepta un presupuesto, empieza un proceso manual fragmentado:

```
Presupuesto aceptado
    │
    ├── Abre WhatsApp → busca contacto del proveedor → escribe pedido en lenguaje natural
    ├── Llama por teléfono → espera confirmación → anota en papel
    ├── Visita el almacén → pide por referencia de memoria → lleva ticket de caja
    └── Recopila facturas manualmente → introduce en TrabFlow
```

TrabFlow Marketplace elimina todos esos pasos intermedios:

```
Presupuesto aceptado
    │
    └── TrabFlow detecta materiales → sugiere proveedores → el instalador confirma
        → pedido enviado → confirmación recibida → seguimiento en tiempo real
        → factura del proveedor integrada → rentabilidad calculada automáticamente
```

### 1.2 El instalador como protagonista, no como comprador

La diferencia fundamental con Amazon o cualquier marketplace horizontal es el CONTEXTO. El instalador no entra al Marketplace a comprar: entra a TrabFlow a trabajar. El Marketplace aparece en el momento exacto en que tiene sentido: cuando hay un presupuesto aceptado con materiales que pedir.

No hay carrito de compra en el menú principal. No hay página de inicio con ofertas. El Marketplace es invisible hasta que es necesario, y en ese momento, es indispensable.

### 1.3 Posicionamiento estratégico

```
TrabFlow hoy:        ERP para instaladores (presupuestos, facturas, clientes, equipo)
TrabFlow Marketplace: ERP + canal de compra integrado + red de proveedores

Competencia directa en ERP:
  - Holded, Quipu, Sage (genéricos, no instaladores)
  - Syncros, GADE (nicho instaladores, sin IA)
  
Competencia directa en marketplace materiales:
  - Ninguna con integración ERP real
  - Amazon Business (genérico, sin IA de presupuesto)
  - Leroy Merlin Pro (catálogo, no integración)
  - Würth Online (solo Würth, sin multi-proveedor)

Ventaja competitiva de TrabFlow:
  La IA ya sabe qué materiales necesita el presupuesto.
  Eso convierte el marketplace en una lista de compra inteligente,
  no en un catálogo de búsqueda manual.
```

---

## 2. OBJETIVOS

### 2.1 Objetivos de producto

| Objetivo | Métrica de éxito | Horizonte |
|----------|-----------------|-----------|
| Eliminar el proceso manual de pedir material | % presupuestos aceptados con pedido generado desde TrabFlow ≥ 60% | 12 meses post-lanzamiento |
| Ser el canal de compra preferido del instalador | NPS Marketplace ≥ 50 | 18 meses post-lanzamiento |
| Reducir el tiempo entre presupuesto aceptado y material pedido | < 10 minutos (vs. 24-48h actuales) | En el lanzamiento |
| Dar visibilidad al proveedor de la demanda real | Dashboard proveedor activo para ≥ 80% de proveedores | 6 meses post Fase 2 |
| Integrar la factura del proveedor en la rentabilidad del trabajo | % trabajos con coste real calculado ≥ 70% | 24 meses post-lanzamiento |

### 2.2 Objetivos de negocio

| Objetivo | Métrica | Horizonte |
|----------|---------|-----------|
| Fuente de ingresos adicional independiente de suscripciones | GMV > 500.000€/mes | 24 meses post-lanzamiento |
| Comisión de plataforma sobre pedidos completados | 2% del GMV | Desde Fase 3 |
| Suscripción de proveedor para funcionalidades avanzadas | ≥ 50 proveedores con plan Premium | 12 meses post Fase 2 |
| Reducir churn de instaladores (el Marketplace crea lock-in positivo) | Churn mensual < 2% en instaladores con ≥ 1 pedido/mes | 18 meses |
| Acuerdos marco con 5 distribuidoras nacionales | Firmados | Antes del lanzamiento |

### 2.3 Objetivos técnicos

- Latencia de búsqueda de material < 300ms (P95)
- Disponibilidad del módulo de pedidos ≥ 99.9%
- Ningún cambio en el motor IA del Core (`trade-voice-to-quote`) sin benchmark de 400 casos
- Todos los datos del Marketplace bajo RLS independiente del Core
- Stripe Connect activo para pagos con split de comisión

---

## 3. FILOSOFÍA DE PRODUCTO

### 3.1 El Marketplace como consecuencia, no como destino

El instalador nunca dice "voy a usar el Marketplace". Dice "voy a preparar este trabajo". El Marketplace es la respuesta natural de TrabFlow a la pregunta implícita: "¿Y ahora cómo pido el material?"

Esta filosofía tiene implicaciones de diseño concretas:

**No existe una pantalla de inicio del Marketplace.** El punto de entrada es siempre un presupuesto aceptado, un trabajo planificado, o un contrato de mantenimiento activo.

**No hay búsqueda genérica de productos.** La búsqueda parte siempre de un contexto: "materiales para el presupuesto PRE-2026-077" o "consumibles del contrato de mantenimiento CT-2026-001".

**No hay carrito permanente.** El carrito existe solo en el contexto de un pedido concreto vinculado a un trabajo. Cuando el pedido se completa, el carrito desaparece.

### 3.2 IA como motor invisible

El instalador no ve "recomendaciones de la IA". Ve que TrabFlow ya sabe lo que necesita. La IA trabaja en segundo plano:

- Detecta que en el presupuesto falta el kit de anclaje para el calentador
- Detecta que el instalador siempre compra cinta de teflón con cualquier pedido de fontanería
- Detecta que el proveedor A tiene el mismo producto un 12% más caro que el proveedor B
- Detecta que el plazo de entrega del proveedor A es 2 días vs. 5 días del B

Estas inferencias no se presentan como "sugerencias de la IA". Se presentan como hechos: "El proveedor B tiene este producto 12% más barato y lo entrega 3 días antes."

### 3.3 Privacidad comercial como principio de diseño

Los instaladores son competidores entre sí. Sus márgenes, sus proveedores preferidos, y sus precios negociados son información confidencial. El Marketplace garantiza:

- El `precio_coste` nunca se expone a otro instalador ni proveedor
- El proveedor no sabe el margen que aplica el instalador
- Las preferencias de proveedor de un instalador son privadas
- Los datos agregados (índice de precios de mercado) son solo estadísticas anónimas

### 3.4 Escalabilidad sin dependencia de un único proveedor

TrabFlow no es el distribuidor. TrabFlow es el canal inteligente entre el instalador y los proveedores que el instalador ya conoce o quiere conocer. Agregar un nuevo proveedor no debe requerir desarrollo personalizado: debe ser un proceso de configuración (CSV + contrato + parámetros de margen).

---

## 4. CASOS DE USO

### 4.1 Caso de uso principal: Presupuesto aceptado → Pedido inteligente

**Actor:** Instalador (fontanero, electricista, reformista)
**Contexto:** Acaba de recibir confirmación del cliente de un presupuesto de reforma de baño

```
FLUJO NOMINAL:

1. Cliente acepta el presupuesto PRE-2026-077 (vía enlace o manualmente)
2. TrabFlow notifica al instalador: "PRE-2026-077 aceptado"
3. En la vista del presupuesto aparece: [Pedir material] 
4. El instalador pulsa "Pedir material"
5. TrabFlow muestra lista de materiales del presupuesto con:
   - Partidas de material extraídas automáticamente
   - Proveedor sugerido para cada línea (basado en preferencias aprendidas)
   - Precio de coste estimado por línea
   - Total estimado del pedido
   - Indicador de stock disponible (si la integración está activa)
6. El instalador revisa, ajusta si necesita, y pulsa [Confirmar pedido]
7. TrabFlow genera los sub-pedidos por proveedor y los envía
8. Cada proveedor recibe su pedido y responde con confirmación
9. El instalador recibe confirmación y fecha de entrega
10. Material recibido → instalador marca como recibido
11. Factura del proveedor → integrada automáticamente en el coste del trabajo
```

**Variantes:**
- El instalador añade materiales que no estaban en el presupuesto
- Uno de los proveedores no tiene stock → TrabFlow sugiere alternativa
- El instalador quiere dividir el pedido entre dos proveedores

### 4.2 Caso de uso: Pedido desde contrato de mantenimiento

**Actor:** Técnico de mantenimiento con contrato activo

```
FLUJO:

1. Técnico completa parte de mantenimiento preventivo
2. Detecta que el filtro de la caldera necesita cambio
3. En el parte: [Pedir consumible] 
4. TrabFlow sabe: el contrato es de calderas Baxi → proveedor preferido para filtros Baxi
5. El técnico confirma la cantidad y pulsa [Pedir]
6. Pedido enviado a Baxi Comercial (o distribuidor configurado)
7. El coste del consumible se carga al contrato de mantenimiento
```

### 4.3 Caso de uso: Pedido recurrente

**Actor:** Electricista con instalaciones periódicas similares

```
FLUJO:

1. El instalador crea un presupuesto para instalación eléctrica de garaje
2. La IA detecta que es similar a 4 trabajos anteriores
3. TrabFlow sugiere: "Pedido similar al de marzo — ¿usar la misma lista de material?"
4. El instalador confirma o ajusta cantidades
5. Pedido generado en segundos (sin buscar referencias)
```

### 4.4 Caso de uso: Panel del proveedor — gestión de pedidos

**Actor:** Gestor de almacén de distribuidora regional

```
FLUJO:

1. Llega pedido de instalador (notificación email + panel web)
2. Gestor revisa: artículos, referencias, cantidades, dirección de entrega
3. Confirma pedido y estima fecha de entrega
4. Prepara el pedido en almacén
5. Marca como "enviado" → instalador recibe notificación
6. Instalador recibe material → marca como "recibido"
7. El gestor genera factura → TrabFlow la integra automáticamente
```

### 4.5 Caso de uso: Fabricante — actualización de catálogo

**Actor:** Brand manager de GROHE España

```
FLUJO:

1. GROHE lanza nueva colección de grifería
2. Sube fichas técnicas, imágenes, vídeos, normativa al panel de fabricante
3. Define precio de referencia recomendado (PVP instalador)
4. Los distribuidores que tienen GROHE en su catálogo reciben notificación
5. Cada distribuidor asocia los nuevos productos a su catálogo con su precio y stock
6. Los instaladores ven los nuevos productos con la documentación oficial de GROHE
7. La IA puede recomendar la nueva colección cuando el contexto es adecuado
```

### 4.6 Caso de uso: Comparación de proveedores con IA

**Actor:** Instalador que quiere el mejor precio sin perder tiempo

```
FLUJO:

1. En el pedido de material, pulsa [Comparar] en una línea
2. TrabFlow muestra: 4 proveedores tienen este producto
   - Proveedor A: 289€ | Stock: Sí | Entrega: 24h | ★ Preferido
   - Proveedor B: 261€ | Stock: Sí | Entrega: 48h
   - Proveedor C: 299€ | Stock: No | Entrega: 5 días
   - Proveedor D: 275€ | Stock: Sí | Entrega: 3h (recogida en tienda)
3. La IA añade: "Si lo combinas con los otros 3 artículos que necesitas, el proveedor B
   sale más barato en el total aunque este artículo sea más caro"
4. El instalador elige proveedor B para toda la línea
5. El sistema aprende la elección → mejora futuros pedidos
```

### 4.7 Caso de uso: Gestión de asociaciones como canal de distribución

**Actor:** Presidente de asociación de electricistas de Cantabria

```
FLUJO:

1. La asociación negocia con Schneider Electric condiciones especiales para sus asociados
2. El acuerdo se configura en TrabFlow: código de descuento + catálogo especial
3. Los instaladores miembros de la asociación ven precios con el descuento de la asociación
4. La asociación tiene visibilidad del GMV generado por sus asociados
5. Renova el acuerdo anualmente con datos reales de volumen
```

---

## 5. ARQUITECTURA FUNCIONAL

### 5.1 Módulos del Marketplace

El Marketplace se compone de 8 módulos funcionales, cada uno con responsabilidad única:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TRABFLOW MARKETPLACE                             │
├────────────┬────────────┬────────────┬────────────┬────────────────┤
│  CATÁLOGO  │  PEDIDOS   │ LOGÍSTICA  │   PAGOS    │      IA        │
│  MODULE    │  MODULE    │  MODULE    │  MODULE    │    MODULE      │
│            │            │            │            │                │
│ Productos  │ Carrito    │ Entrega    │ Stripe     │ Sugerencias    │
│ Stock      │ Checkout   │ Recogida   │ Connect    │ Comparación    │
│ Precios    │ Sub-orders │ Tracking   │ Comisiones │ Optimización   │
│ Categorías │ Histórico  │ Devolución │ Facturas   │ Aprendizaje    │
├────────────┴────────────┴────────────┴────────────┴────────────────┤
│  PANEL INSTALADOR  │  PANEL PROVEEDOR  │  PANEL FABRICANTE         │
├────────────────────┴───────────────────┴───────────────────────────┤
│                    PLATAFORMA CORE TRABFLOW                        │
│     ERP · CRM · Presupuestos IA · Facturas · Planificación         │
│          Contratos · Mantenimiento · Equipo · Stripe               │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Flujos de datos entre módulos

```
Presupuesto aceptado (Core)
    │
    ▼
Catálogo Module
    ├── Busca productos para cada partida material
    ├── Recupera precios y stock por proveedor
    └── Aplica márgenes y descuentos de asociación
    │
    ▼
IA Module
    ├── Detecta materiales faltantes
    ├── Sugiere agrupación óptima de pedidos
    └── Recomienda proveedor basado en historial
    │
    ▼
Pedidos Module
    ├── Crea orden de compra principal
    ├── Divide en sub-pedidos por proveedor
    └── Notifica a cada proveedor
    │
    ▼
Logística Module
    ├── Calcula opciones de entrega
    ├── Gestiona tracking
    └── Confirma recepción
    │
    ▼
Pagos Module
    ├── Procesa pago del instalador (Stripe)
    ├── Split hacia cada proveedor (Stripe Connect)
    └── Retiene comisión TrabFlow
    │
    ▼
Core ERP
    ├── Factura del proveedor → coste del trabajo
    ├── Rentabilidad del presupuesto actualizada
    └── Contabilidad sincronizada
```

### 5.3 Tipos de entidades

```
ACTOR                  ROL EN MARKETPLACE               CUENTA SUPABASE
─────────────────────────────────────────────────────────────────────
Instalador             Comprador                        trade_organizations
Técnico (empleado)     Comprador delegado               trade_org_members
Proveedor              Vendedor                         trade_marketplace_suppliers
Fabricante             Propietario de marca             trade_marketplace_brands
Asociación             Canal de descuento               trade_associations (nuevo)
Admin TrabFlow         Operador de plataforma           email en VITE_ADMIN_EMAIL
```

### 5.4 Integraciones con el Core

```
MÓDULO CORE          PUNTO DE INTEGRACIÓN           DIRECCIÓN
────────────────────────────────────────────────────────────────
trade_quotes          Origen del pedido              Core → Marketplace
trade_quote_items     Lista de materiales a pedir    Core → Marketplace
trade_jobs            Trabajo al que pertenece       Core → Marketplace
trade_contracts       Pedidos de mantenimiento       Core → Marketplace
trade_invoices        Coste real del trabajo         Marketplace → Core
trade_tarifas         Fallback de precio material    Core → Marketplace
trade_global_catalog  Referencia de productos        Core → Marketplace
trade_organizations   Identidad del comprador        Core → Marketplace
trade_org_members     Permisos de compra             Core → Marketplace
trade_subscriptions   Plan del instalador            Core → Marketplace
trade_associations    Descuentos por asociación      Core → Marketplace
```

---

## 6. ARQUITECTURA TÉCNICA

### 6.1 Stack tecnológico (sin cambios en Core)

```
CAPA                TECNOLOGÍA          ESTADO
──────────────────────────────────────────────
Frontend            React 19 + TypeScript    Existente
Estilos             Tailwind v4              Existente
Build               Vite 6                   Existente
Deploy              Vercel                   Existente
Base de datos       Supabase (PostgreSQL 15) Existente
Autenticación       Supabase Auth            Existente
Storage             Supabase Storage         Existente
Edge Functions      Deno (Supabase)          Existente
AI Engine           Claude Sonnet 4.6        Existente
Búsqueda            PostgreSQL full-text     Existente
Pagos               Stripe + Stripe Connect  Ampliar
Real-time           Supabase Realtime        Nuevo uso
Email               Supabase + SMTP          Existente
Push               Web Push (VAPID)          Existente
```

**Principio:** El Marketplace NO introduce nuevas tecnologías de infraestructura. Extiende las existentes.

### 6.2 Arquitectura de autenticación multi-actor

```
Usuario           Tipo de cuenta         Cómo se autentica
─────────────────────────────────────────────────────────────
Instalador        trade_organizations    Supabase Auth existente
Técnico           trade_org_members      Supabase Auth existente
Proveedor         trade_marketplace_suppliers  Supabase Auth (email nuevo)
Fabricante        trade_marketplace_brands     Supabase Auth (email nuevo)
Admin TrabFlow    email en settings      Supabase Auth existente

RESOLUCIÓN DE TIPO al hacer login:
  1. ¿Tiene registro en trade_organizations como owner_id? → Instalador
  2. ¿Tiene registro en trade_org_members como user_id? → Técnico/empleado
  3. ¿Tiene registro en trade_marketplace_suppliers como user_id? → Proveedor
  4. ¿Tiene registro en trade_marketplace_brands como user_id? → Fabricante
  5. ¿Email === VITE_ADMIN_EMAIL? → Admin TrabFlow
  6. → Cuenta sin rol (redirect a registro)
```

### 6.3 Routing de la aplicación

```
RUTAS EXISTENTES (Core)
  /                     → HomeView
  /dashboard            → AppDashboardView (instalador)
  /admin/*              → AdminView (admin TrabFlow)
  /presupuesto/:token   → QuoteAcceptView (público)
  /valorar/:token       → ScreenValoraciones (público)

NUEVAS RUTAS (Marketplace)
  /marketplace          → Redirect a /marketplace/pedidos (no home pública)
  /marketplace/pedidos  → Historial de pedidos del instalador
  /marketplace/favoritos → Productos favoritos
  /marketplace/recurrentes → Plantillas de pedido recurrente

  /proveedor            → SupplierPortalView (requiere auth proveedor)
  /proveedor/dashboard  → Dashboard KPIs proveedor
  /proveedor/catalogo   → Gestión de catálogo
  /proveedor/pedidos    → Pedidos recibidos
  /proveedor/logistica  → Configuración de entrega y zonas
  /proveedor/stats      → Analítica de ventas
  /proveedor/config     → Configuración de cuenta

  /fabricante           → BrandPortalView (requiere auth fabricante)
  /fabricante/dashboard → Dashboard KPIs fabricante
  /fabricante/catalogo  → Catálogo oficial (fichas técnicas, imágenes)
  /fabricante/distribuidores → Red de distribuidores vinculados
  /fabricante/campanas  → Campañas y promociones
  /fabricante/stats     → Analytics de la marca
```

### 6.4 Supabase Realtime para el Marketplace

El Marketplace introduce el primer uso real de Supabase Realtime en TrabFlow:

```typescript
// Panel del proveedor: pedidos en tiempo real
const channel = supabase
  .channel('supplier-orders')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'trade_marketplace_sub_orders',
    filter: `supplier_id=eq.${supplierId}`,
  }, payload => {
    // Nuevo pedido → actualizar lista sin reload
    addNewOrder(payload.new as MarketplaceSubOrder);
    playNotificationSound();
  })
  .subscribe();

// Panel del instalador: tracking de pedido en tiempo real
const trackingChannel = supabase
  .channel(`order-tracking-${orderId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'trade_marketplace_sub_orders',
    filter: `main_order_id=eq.${orderId}`,
  }, payload => {
    updateOrderStatus(payload.new as MarketplaceSubOrder);
  })
  .subscribe();
```

### 6.5 Estrategia de caché y rendimiento

```
DATO                        ESTRATEGIA              TTL
────────────────────────────────────────────────────────
Catálogo de productos       PostgreSQL + índices     No cache: datos frescos
Stock en tiempo real        Polling edge function    5 minutos
Precios de proveedor        DB + invalidación        Cuando proveedor actualiza
Índice de precios mercado   Materialized view        Refresh diario (cron)
Historial de pedidos        DB directa               No cache
Sugerencias IA              trade_marketplace_ai_suggestions  24h
Favoritos del instalador    DB directa               No cache
```

---

## 7. MODELO DE DATOS COMPLETO

### 7.1 Tablas existentes que participan en el Marketplace

```
TABLA                           USO EN MARKETPLACE
────────────────────────────────────────────────────────────────────
trade_organizations             Identificación del instalador comprador
trade_org_members               Permisos de compra por empleado
trade_org_permissions           Granularidad: ¿puede pedir material?
trade_quotes                    Origen del pedido de material
trade_quote_items               Lista de materiales a pedir
trade_jobs                      Trabajo asociado al pedido
trade_invoices                  Destino de la factura del proveedor
trade_supplier_catalogs         Catálogos de proveedor (existente)
trade_supplier_products         Productos con precio_coste (existente)
trade_supplier_orders           Pedidos de material (existente, ampliar)
trade_supplier_order_lines      Líneas de pedido (existente, ampliar)
trade_org_suppliers             Relación instalador ↔ proveedor (existente)
trade_supplier_choices          Aprendizaje de preferencias (existente)
trade_global_catalog            Referencia de productos TradeFlow
trade_subscriptions             Plan del instalador (límites)
trade_stripe_prices             Precios Stripe
trade_platform_invoices         Facturas de plataforma
```

### 7.2 Nuevas tablas — Marketplace Core

```sql
-- ═══════════════════════════════════════════════════════════════════
-- CUENTAS DE PROVEEDOR (actor nuevo)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_marketplace_suppliers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_key          text NOT NULL UNIQUE,   -- FK a trade_supplier_catalogs
  nombre_comercial      text NOT NULL,
  razon_social          text NOT NULL,
  nif                   text NOT NULL,
  email_contacto        text NOT NULL,
  telefono              text,
  direccion             text,
  localidad             text,
  provincia             text,
  cp                    text,
  pais                  text NOT NULL DEFAULT 'ES',

  -- Estado del acuerdo con TrabFlow
  estado                text NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','activo','suspendido','cancelado')),
  acuerdo_firmado       boolean NOT NULL DEFAULT false,
  acuerdo_fecha         timestamptz,
  acuerdo_version       text,  -- versión del contrato firmado

  -- Plan de proveedor
  plan                  text NOT NULL DEFAULT 'piloto'
                        CHECK (plan IN ('piloto','basic','premium','enterprise')),
  plan_inicio           timestamptz,
  plan_fin              timestamptz,

  -- Stripe Connect
  stripe_customer_id    text,
  stripe_connect_id     text,    -- Stripe Connect account ID
  stripe_connect_status text,    -- 'pending' | 'active' | 'restricted'
  stripe_onboarding_url text,    -- link temporal de onboarding

  -- Configuración de comisión
  commission_pct        numeric(5,2) NOT NULL DEFAULT 2.0,

  -- Metadatos
  logo_url              text,
  website               text,
  descripcion           text,
  sectores              text[],  -- ['fontaneria','electricidad','climatizacion']
  zonas_entrega         text[],  -- ['Cantabria','Asturias','País Vasco']

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- CUENTAS DE FABRICANTE (actor nuevo)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_marketplace_brands (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_key             text NOT NULL UNIQUE,  -- 'grohe', 'roca', 'vaillant'
  nombre                text NOT NULL,         -- 'GROHE España'
  razon_social          text,
  nif                   text,
  email_contacto        text NOT NULL,
  website               text,
  logo_url              text,
  descripcion           text,
  sectores              text[],
  paises                text[] NOT NULL DEFAULT '{ES}',

  estado                text NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','activo','suspendido')),

  -- Estadísticas de presencia
  num_distribuidores    integer DEFAULT 0,  -- cuántos distribuidores usan sus productos
  num_productos         integer DEFAULT 0,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- CATEGORÍAS JERÁRQUICAS DEL MARKETPLACE
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_marketplace_categories (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id             uuid REFERENCES public.trade_marketplace_categories(id),
  slug                  text NOT NULL UNIQUE,  -- 'sanitarios/platos-ducha'
  nombre                text NOT NULL,
  descripcion           text,
  icono                 text,       -- nombre de icono Lucide
  oficio                text,       -- oficio de TrabFlow al que pertenece
  orden                 integer NOT NULL DEFAULT 0,
  activo                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Índice para navegación jerárquica
CREATE INDEX idx_marketplace_categories_parent ON public.trade_marketplace_categories(parent_id);

-- ═══════════════════════════════════════════════════════════════════
-- PRODUCTOS DEL MARKETPLACE (vinculados a catálogos de proveedor)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_marketplace_products (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id           uuid NOT NULL REFERENCES public.trade_marketplace_suppliers(id),
  catalog_product_id    uuid REFERENCES public.trade_supplier_products(id),
  brand_id              uuid REFERENCES public.trade_marketplace_brands(id),
  category_id           uuid REFERENCES public.trade_marketplace_categories(id),

  -- Identificación
  ref_proveedor         text NOT NULL,
  ean                   text,
  nombre                text NOT NULL,
  descripcion           text,
  descripcion_tecnica   text,
  familia               text,
  subfamilia            text,
  unidad                text NOT NULL DEFAULT 'ud',

  -- Precios (visibles para instaladores según contrato)
  precio_coste          numeric(10,2) NOT NULL,     -- precio que paga TrabFlow al proveedor
  precio_venta          numeric(10,2),              -- calculado: precio_coste + margen
  precio_pvp_recomendado numeric(10,2),             -- PVP del fabricante (orientativo)
  margen_pct            numeric(5,2),               -- margen override para este producto

  -- Stock y disponibilidad
  stock_disponible      integer,        -- null = no integrado, número = stock real
  stock_reservado       integer DEFAULT 0,
  stock_minimo          integer DEFAULT 0,
  plazo_entrega_dias    integer,        -- null = consultar
  disponible            boolean NOT NULL DEFAULT true,

  -- Logística
  peso_kg               numeric(8,3),
  volumen_m3            numeric(10,6),
  requiere_transporte_especial boolean DEFAULT false,
  fragil                boolean DEFAULT false,

  -- SEO y búsqueda
  search_vector         tsvector,
  tags                  text[],

  -- Estado
  activo                boolean NOT NULL DEFAULT true,
  visible_en_marketplace boolean NOT NULL DEFAULT true,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Índice para búsqueda full-text
CREATE INDEX idx_marketplace_products_search ON public.trade_marketplace_products
  USING GIN(search_vector);

-- Trigger para actualizar search_vector
CREATE OR REPLACE FUNCTION public.update_marketplace_product_search()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector = to_tsvector('spanish',
    COALESCE(NEW.nombre, '') || ' ' ||
    COALESCE(NEW.descripcion, '') || ' ' ||
    COALESCE(NEW.ref_proveedor, '') || ' ' ||
    COALESCE(NEW.familia, '') || ' ' ||
    COALESCE(NEW.tags::text, '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_marketplace_product_search
  BEFORE INSERT OR UPDATE ON public.trade_marketplace_products
  FOR EACH ROW EXECUTE FUNCTION public.update_marketplace_product_search();
```

### 7.3 Nuevas tablas — Sistema de pedidos

```sql
-- ═══════════════════════════════════════════════════════════════════
-- ORDEN DE COMPRA PRINCIPAL (vista del instalador)
-- Un instalador crea una orden; el sistema la divide en sub-órdenes
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_marketplace_orders (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                text NOT NULL UNIQUE,  -- 'PED-2027-001'
  org_id                uuid NOT NULL REFERENCES public.trade_organizations(id),
  created_by            uuid REFERENCES auth.users(id),

  -- Origen del pedido
  quote_id              uuid REFERENCES public.trade_quotes(id),
  job_id                uuid REFERENCES public.trade_jobs(id),
  contract_id           uuid,  -- referencia a contrato de mantenimiento
  origen                text NOT NULL DEFAULT 'presupuesto'
                        CHECK (origen IN ('presupuesto','trabajo','mantenimiento','manual','recurrente')),

  -- Estado del pedido global
  estado                text NOT NULL DEFAULT 'borrador'
                        CHECK (estado IN (
                          'borrador',      -- en construcción
                          'pendiente',     -- enviado, esperando confirmación
                          'confirmado',    -- todos los sub-pedidos confirmados
                          'parcial',       -- algunos sub-pedidos confirmados
                          'en_preparacion',
                          'enviado',
                          'parcialmente_recibido',
                          'recibido',      -- todo recibido
                          'completado',    -- facturado y cerrado
                          'cancelado'
                        )),

  -- Importes
  importe_materiales    numeric(12,2) NOT NULL DEFAULT 0,
  importe_entrega       numeric(12,2) NOT NULL DEFAULT 0,
  importe_total         numeric(12,2) NOT NULL DEFAULT 0,
  moneda                text NOT NULL DEFAULT 'EUR',

  -- Logística
  tipo_entrega          text NOT NULL DEFAULT 'entrega'
                        CHECK (tipo_entrega IN ('entrega','recogida','mixta')),
  direccion_entrega     text,
  localidad_entrega     text,
  cp_entrega            text,
  notas_entrega         text,
  fecha_entrega_solicitada date,
  fecha_entrega_real    date,

  -- Pago
  stripe_payment_intent text,
  pago_estado           text DEFAULT 'pendiente'
                        CHECK (pago_estado IN ('pendiente','procesado','fallido','reembolsado')),

  -- Metadatos
  notas                 text,
  tags                  text[],

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Numeración automática
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.numero = 'PED-' || EXTRACT(YEAR FROM now())::text || '-' ||
    LPAD((SELECT COUNT(*) + 1 FROM public.trade_marketplace_orders
          WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM now()))::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_order_number BEFORE INSERT ON public.trade_marketplace_orders
  FOR EACH ROW WHEN (NEW.numero IS NULL OR NEW.numero = '')
  EXECUTE FUNCTION public.generate_order_number();

-- ═══════════════════════════════════════════════════════════════════
-- LÍNEAS DEL PEDIDO (unificadas antes de dividir por proveedor)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_marketplace_order_lines (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              uuid NOT NULL REFERENCES public.trade_marketplace_orders(id) ON DELETE CASCADE,
  product_id            uuid REFERENCES public.trade_marketplace_products(id),
  supplier_id           uuid REFERENCES public.trade_marketplace_suppliers(id),

  -- Origen de la línea
  quote_item_id         uuid REFERENCES public.trade_quote_items(id),
  origen                text NOT NULL DEFAULT 'manual'
                        CHECK (origen IN ('presupuesto','manual','ia_sugerido','recurrente')),

  -- Datos del producto (snapshot en el momento del pedido)
  descripcion           text NOT NULL,
  ref_proveedor         text,
  unidad                text NOT NULL DEFAULT 'ud',
  cantidad              numeric(10,3) NOT NULL DEFAULT 1,

  -- Precios (snapshot)
  precio_coste_unitario numeric(10,2) NOT NULL,
  precio_coste_total    numeric(12,2) NOT NULL,
  margen_pct            numeric(5,2),
  precio_venta_unitario numeric(10,2),  -- el que factura el instalador al cliente
  precio_venta_total    numeric(12,2),

  -- Estado
  estado                text NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','confirmado','enviado','recibido','cancelado')),

  -- Logística de la línea
  sub_order_id          uuid,  -- FK a trade_marketplace_sub_orders (FK circular, ver nota)
  fecha_entrega_estimada date,
  fecha_entrega_real    date,

  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- SUB-ÓRDENES (un pedido por proveedor, dentro de la orden principal)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_marketplace_sub_orders (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                text NOT NULL UNIQUE,  -- 'PED-2027-001-A', 'PED-2027-001-B'
  main_order_id         uuid NOT NULL REFERENCES public.trade_marketplace_orders(id) ON DELETE CASCADE,
  supplier_id           uuid NOT NULL REFERENCES public.trade_marketplace_suppliers(id),

  estado                text NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN (
                          'pendiente','confirmado','en_preparacion',
                          'enviado','recibido','cancelado','devolucion'
                        )),

  -- Importes de este sub-pedido
  importe_materiales    numeric(12,2) NOT NULL DEFAULT 0,
  importe_entrega       numeric(12,2) NOT NULL DEFAULT 0,
  importe_total         numeric(12,2) NOT NULL DEFAULT 0,

  -- Logística
  tipo_entrega          text,
  fecha_entrega_estimada date,
  fecha_entrega_real    date,
  tracking_id           text,
  tracking_url          text,
  transportista         text,

  -- Pago y comisión
  commission_pct        numeric(5,2),
  commission_amount     numeric(10,2),
  stripe_transfer_id    text,
  factura_proveedor_url text,
  factura_proveedor_numero text,

  -- Comunicación
  notas_instalador      text,
  notas_proveedor       text,
  confirmado_at         timestamptz,
  enviado_at            timestamptz,
  recibido_at           timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- FK diferida (líneas → sub-órdenes)
ALTER TABLE public.trade_marketplace_order_lines
  ADD CONSTRAINT fk_order_line_sub_order
  FOREIGN KEY (sub_order_id)
  REFERENCES public.trade_marketplace_sub_orders(id)
  DEFERRABLE INITIALLY DEFERRED;
```

### 7.4 Nuevas tablas — Logística y disponibilidad

```sql
-- ═══════════════════════════════════════════════════════════════════
-- OPCIONES DE ENTREGA POR PROVEEDOR
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_marketplace_logistics (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id           uuid NOT NULL REFERENCES public.trade_marketplace_suppliers(id),
  tipo                  text NOT NULL CHECK (tipo IN ('entrega_domicilio','recogida_almacen','punto_entrega')),
  nombre                text NOT NULL,  -- 'Entrega en obra (24h)', 'Recogida en almacén Santander'
  descripcion           text,
  precio_base           numeric(8,2) NOT NULL DEFAULT 0,
  precio_por_km         numeric(6,4) DEFAULT 0,
  precio_min_pedido_gratis numeric(8,2),  -- pedido mínimo para entrega gratis
  plazo_dias_min        integer NOT NULL DEFAULT 1,
  plazo_dias_max        integer NOT NULL DEFAULT 3,
  zonas                 text[],  -- provincias o comunidades donde aplica
  horario_corte         time,   -- hora límite para pedido del día
  activo                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- STOCK EN TIEMPO REAL (sincronizado desde APIs de proveedor)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_marketplace_stock_snapshots (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            uuid NOT NULL REFERENCES public.trade_marketplace_products(id),
  supplier_id           uuid NOT NULL REFERENCES public.trade_marketplace_suppliers(id),
  stock_disponible      integer NOT NULL DEFAULT 0,
  stock_reservado       integer NOT NULL DEFAULT 0,
  plazo_reposicion_dias integer,
  sync_method           text NOT NULL DEFAULT 'manual'
                        CHECK (sync_method IN ('manual','api','webhook','csv_upload')),
  synced_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, supplier_id)
);

-- ═══════════════════════════════════════════════════════════════════
-- PUNTOS DE RECOGIDA
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_marketplace_pickup_points (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id           uuid NOT NULL REFERENCES public.trade_marketplace_suppliers(id),
  nombre                text NOT NULL,
  direccion             text NOT NULL,
  localidad             text NOT NULL,
  provincia             text NOT NULL,
  cp                    text NOT NULL,
  lat                   numeric(10,7),
  lng                   numeric(10,7),
  horario               jsonb,  -- {lunes: "9:00-18:00", sabado: "9:00-14:00", ...}
  telefono              text,
  activo                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);
```

### 7.5 Nuevas tablas — Fabricantes y catálogo oficial

```sql
-- ═══════════════════════════════════════════════════════════════════
-- PRODUCTOS OFICIALES DE FABRICANTE
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_marketplace_brand_products (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              uuid NOT NULL REFERENCES public.trade_marketplace_brands(id),
  category_id           uuid REFERENCES public.trade_marketplace_categories(id),

  -- Referencia oficial del fabricante
  ref_fabricante        text NOT NULL,
  ean                   text,
  nombre_oficial        text NOT NULL,
  descripcion_oficial   text,
  descripcion_tecnica   text,

  -- Precio de referencia (PVP instalador recomendado)
  pvp_recomendado       numeric(10,2),
  unidad                text NOT NULL DEFAULT 'ud',

  -- Categorización
  familia               text,
  subfamilia            text,
  linea_producto        text,  -- 'Serie Eurosmart', 'Colección Terran'
  tags                  text[],

  -- Estado
  activo                boolean NOT NULL DEFAULT true,
  novedad               boolean NOT NULL DEFAULT false,
  descatalogado         boolean NOT NULL DEFAULT false,
  sustituido_por        uuid REFERENCES public.trade_marketplace_brand_products(id),

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- DOCUMENTACIÓN TÉCNICA DE FABRICANTE
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_marketplace_brand_media (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              uuid NOT NULL REFERENCES public.trade_marketplace_brands(id),
  brand_product_id      uuid REFERENCES public.trade_marketplace_brand_products(id),
  tipo                  text NOT NULL
                        CHECK (tipo IN (
                          'imagen_producto','imagen_ambiente','video_instalacion',
                          'manual_instalacion','ficha_tecnica','certificado',
                          'normativa','catalogo_pdf','curso_formacion'
                        )),
  titulo                text NOT NULL,
  descripcion           text,
  url                   text NOT NULL,   -- URL en Supabase Storage
  storage_path          text,
  tamanio_bytes         bigint,
  formato               text,  -- 'PDF', 'MP4', 'JPEG', etc.
  idioma                text DEFAULT 'es',
  version               text,
  activo                boolean NOT NULL DEFAULT true,
  orden                 integer DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- VINCULACIÓN DISTRIBUIDOR ↔ PRODUCTO DE FABRICANTE
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_marketplace_brand_distributor (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_product_id      uuid NOT NULL REFERENCES public.trade_marketplace_brand_products(id),
  supplier_id           uuid NOT NULL REFERENCES public.trade_marketplace_suppliers(id),
  marketplace_product_id uuid REFERENCES public.trade_marketplace_products(id),

  -- El distribuidor indica solo sus condiciones (no el catálogo de la marca)
  precio_coste          numeric(10,2),      -- su precio de compra al fabricante
  precio_venta          numeric(10,2),      -- su precio al instalador
  stock_disponible      integer,
  plazo_entrega_dias    integer,
  referencia_propia     text,               -- su propia referencia interna
  activo                boolean NOT NULL DEFAULT true,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(brand_product_id, supplier_id)
);
```

### 7.6 Nuevas tablas — Favoritos, recurrentes y IA

```sql
-- ═══════════════════════════════════════════════════════════════════
-- FAVORITOS DEL INSTALADOR
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_marketplace_favorites (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.trade_organizations(id),
  product_id            uuid NOT NULL REFERENCES public.trade_marketplace_products(id),
  supplier_id           uuid NOT NULL REFERENCES public.trade_marketplace_suppliers(id),
  nombre_personalizado  text,   -- alias que pone el instalador
  notas                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, product_id, supplier_id)
);

-- ═══════════════════════════════════════════════════════════════════
-- PLANTILLAS DE PEDIDO RECURRENTE
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_marketplace_recurring_templates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.trade_organizations(id),
  nombre                text NOT NULL,  -- 'Kit instalación eléctrica garaje'
  descripcion           text,
  oficio                text,           -- 'electricidad'
  activo                boolean NOT NULL DEFAULT true,
  uso_count             integer NOT NULL DEFAULT 0,
  ultimo_uso            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.trade_marketplace_recurring_lines (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id           uuid NOT NULL REFERENCES public.trade_marketplace_recurring_templates(id) ON DELETE CASCADE,
  product_id            uuid REFERENCES public.trade_marketplace_products(id),
  supplier_id           uuid REFERENCES public.trade_marketplace_suppliers(id),
  descripcion           text NOT NULL,
  ref_proveedor         text,
  cantidad              numeric(10,3) NOT NULL DEFAULT 1,
  unidad                text NOT NULL DEFAULT 'ud',
  orden                 integer DEFAULT 0
);

-- ═══════════════════════════════════════════════════════════════════
-- CACHÉ DE SUGERENCIAS IA
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_marketplace_ai_suggestions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.trade_organizations(id),
  contexto              text NOT NULL,    -- 'presupuesto' | 'mantenimiento' | 'trabajo'
  contexto_id           uuid,            -- ID del presupuesto/trabajo/contrato
  oficio                text,
  sugerencias           jsonb NOT NULL,  -- array de productos sugeridos con justificación
  generado_at           timestamptz NOT NULL DEFAULT now(),
  expira_at             timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  aplicadas             integer NOT NULL DEFAULT 0,
  descartadas           integer NOT NULL DEFAULT 0
);

-- ═══════════════════════════════════════════════════════════════════
-- COMISIONES DE PLATAFORMA
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_marketplace_commissions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_order_id          uuid NOT NULL REFERENCES public.trade_marketplace_sub_orders(id),
  supplier_id           uuid NOT NULL REFERENCES public.trade_marketplace_suppliers(id),
  org_id                uuid NOT NULL REFERENCES public.trade_organizations(id),

  importe_pedido        numeric(12,2) NOT NULL,
  commission_pct        numeric(5,2) NOT NULL,
  commission_amount     numeric(10,2) NOT NULL,

  stripe_payment_intent text,
  stripe_transfer_id    text,
  stripe_fee_amount     numeric(8,2),  -- fee de Stripe (2.9% + 0.30€)

  estado                text NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','procesado','fallido','reembolsado')),
  procesado_at          timestamptz,
  error_message         text,

  created_at            timestamptz NOT NULL DEFAULT now()
);
```

### 7.7 Nuevas tablas — Promociones y valoraciones

```sql
-- ═══════════════════════════════════════════════════════════════════
-- PROMOCIONES DE PROVEEDOR
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_marketplace_promotions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id           uuid NOT NULL REFERENCES public.trade_marketplace_suppliers(id),
  tipo                  text NOT NULL
                        CHECK (tipo IN (
                          'descuento_pct',      -- % descuento sobre precio_coste
                          'descuento_fijo',     -- importe fijo de descuento
                          'envio_gratis',       -- entrega sin coste
                          '2x1',                -- dos por uno
                          'regalo',             -- producto adicional
                          'precio_fijo'         -- precio especial por tiempo limitado
                        )),
  nombre                text NOT NULL,
  descripcion           text,
  codigo                text UNIQUE,          -- código promocional opcional

  -- Alcance
  product_ids           uuid[],              -- null = toda la tienda
  category_ids          uuid[],
  oficio                text,                -- null = todos los oficios

  -- Valor
  descuento_pct         numeric(5,2),
  descuento_fijo        numeric(8,2),
  precio_especial       numeric(10,2),

  -- Condiciones
  pedido_minimo         numeric(8,2),
  unidades_minimas      integer,
  max_usos_total        integer,
  max_usos_por_org      integer DEFAULT 1,
  uso_count             integer NOT NULL DEFAULT 0,

  -- Vigencia
  inicio               timestamptz NOT NULL,
  fin                  timestamptz,
  activo               boolean NOT NULL DEFAULT true,

  -- Aprobación TrabFlow
  aprobada             boolean NOT NULL DEFAULT false,
  aprobada_at          timestamptz,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- VALORACIONES DE PROVEEDOR
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_marketplace_supplier_reviews (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id           uuid NOT NULL REFERENCES public.trade_marketplace_suppliers(id),
  org_id                uuid NOT NULL REFERENCES public.trade_organizations(id),
  sub_order_id          uuid REFERENCES public.trade_marketplace_sub_orders(id),

  -- Valoración
  puntuacion_general    integer NOT NULL CHECK (puntuacion_general BETWEEN 1 AND 5),
  puntuacion_entrega    integer CHECK (puntuacion_entrega BETWEEN 1 AND 5),
  puntuacion_calidad    integer CHECK (puntuacion_calidad BETWEEN 1 AND 5),
  puntuacion_atencion   integer CHECK (puntuacion_atencion BETWEEN 1 AND 5),
  comentario            text,

  -- Verificación
  verificada            boolean NOT NULL DEFAULT false,  -- pedido recibido = verified purchase
  respuesta_proveedor   text,
  respuesta_at          timestamptz,

  -- Moderación
  visible               boolean NOT NULL DEFAULT true,
  moderada_at           timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, org_id, sub_order_id)
);
```

### 7.8 Nuevas tablas — Analytics y asociaciones

```sql
-- ═══════════════════════════════════════════════════════════════════
-- ASOCIACIONES DE INSTALADORES (para descuentos colectivos)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.trade_associations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                text NOT NULL,
  slug                  text NOT NULL UNIQUE,
  descripcion           text,
  tipo                  text NOT NULL DEFAULT 'gremio'
                        CHECK (tipo IN ('gremio','cooperativa','franquicia','grupo_compra','otro')),
  logo_url              text,
  website               text,
  email_contacto        text,
  activo                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.trade_association_members (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id        uuid NOT NULL REFERENCES public.trade_associations(id),
  org_id                uuid NOT NULL REFERENCES public.trade_organizations(id),
  estado                text NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','activo','suspendido','baja')),
  codigo_socio          text,
  fecha_alta            date,
  fecha_baja            date,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(association_id, org_id)
);

CREATE TABLE public.trade_association_agreements (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id        uuid NOT NULL REFERENCES public.trade_associations(id),
  supplier_id           uuid NOT NULL REFERENCES public.trade_marketplace_suppliers(id),
  descuento_pct         numeric(5,2) NOT NULL DEFAULT 0,
  codigo_descuento      text,
  condiciones           text,
  vigente_desde         date NOT NULL,
  vigente_hasta         date,
  activo                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- ANALYTICS DEL MARKETPLACE (vistas materializadas)
-- ═══════════════════════════════════════════════════════════════════

-- Estadísticas diarias por proveedor
CREATE MATERIALIZED VIEW public.trade_marketplace_supplier_daily_stats AS
SELECT
  supplier_id,
  DATE_TRUNC('day', created_at) AS dia,
  COUNT(*)                      AS num_sub_orders,
  COUNT(*) FILTER (WHERE estado = 'recibido')  AS num_completados,
  SUM(importe_total)            AS gmv_total,
  SUM(importe_total) FILTER (WHERE estado = 'recibido') AS gmv_completado,
  AVG(importe_total)            AS ticket_medio
FROM public.trade_marketplace_sub_orders
GROUP BY supplier_id, DATE_TRUNC('day', created_at)
WITH DATA;

-- Estadísticas diarias del marketplace global
CREATE MATERIALIZED VIEW public.trade_marketplace_daily_stats AS
SELECT
  DATE_TRUNC('day', created_at) AS dia,
  COUNT(*)                       AS num_orders,
  COUNT(DISTINCT org_id)         AS num_compradores,
  SUM(importe_total)             AS gmv_total,
  SUM(importe_total) FILTER (WHERE estado IN ('recibido','completado')) AS gmv_completado,
  AVG(importe_total)             AS ticket_medio
FROM public.trade_marketplace_orders
GROUP BY DATE_TRUNC('day', created_at)
WITH DATA;

-- Índice de precios por familia
CREATE MATERIALIZED VIEW public.trade_marketplace_price_index AS
SELECT
  mp.familia,
  DATE_TRUNC('month', so.created_at) AS mes,
  COUNT(*)                            AS num_transacciones,
  AVG(ol.precio_coste_unitario) FILTER (WHERE ol.precio_coste_unitario > 0) AS precio_coste_medio,
  PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY ol.precio_coste_unitario
  ) FILTER (WHERE ol.precio_coste_unitario > 0)                             AS precio_coste_mediana
FROM public.trade_marketplace_order_lines ol
JOIN public.trade_marketplace_products mp ON mp.id = ol.product_id
JOIN public.trade_marketplace_sub_orders so ON so.id = ol.sub_order_id
WHERE so.estado IN ('recibido', 'completado')
GROUP BY mp.familia, DATE_TRUNC('month', so.created_at)
WITH DATA;
```

---

## 8. RLS — ROW LEVEL SECURITY DEL MARKETPLACE

```sql
-- ═══════════════════════════════════════════════════════════════════
-- HELPER: resolución de supplier_id desde el JWT
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public._supplier_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.trade_marketplace_suppliers
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._brand_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.trade_marketplace_brands
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- trade_marketplace_orders — el instalador ve sus pedidos
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.trade_marketplace_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_installer_select" ON public.trade_marketplace_orders
  FOR SELECT USING (
    org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
               UNION SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true)
  );

CREATE POLICY "orders_installer_insert" ON public.trade_marketplace_orders
  FOR INSERT WITH CHECK (
    org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
               UNION SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true)
  );

-- ═══════════════════════════════════════════════════════════════════
-- trade_marketplace_sub_orders — proveedor ve sus sub-pedidos
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.trade_marketplace_sub_orders ENABLE ROW LEVEL SECURITY;

-- Instalador ve sus sub-pedidos (a través de la orden principal)
CREATE POLICY "sub_orders_installer_select" ON public.trade_marketplace_sub_orders
  FOR SELECT USING (
    main_order_id IN (
      SELECT id FROM trade_marketplace_orders
      WHERE org_id IN (
        SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
        UNION SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true
      )
    )
  );

-- Proveedor ve solo los sub-pedidos dirigidos a él
CREATE POLICY "sub_orders_supplier_select" ON public.trade_marketplace_sub_orders
  FOR SELECT USING (supplier_id = public._supplier_id());

-- Proveedor puede actualizar estado (confirmar, marcar enviado)
CREATE POLICY "sub_orders_supplier_update" ON public.trade_marketplace_sub_orders
  FOR UPDATE USING (supplier_id = public._supplier_id())
  WITH CHECK (supplier_id = public._supplier_id());

-- ═══════════════════════════════════════════════════════════════════
-- trade_marketplace_products — públicos para instaladores autenticados
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.trade_marketplace_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_read_authenticated" ON public.trade_marketplace_products
  FOR SELECT USING (activo = true AND visible_en_marketplace = true AND auth.uid() IS NOT NULL);

CREATE POLICY "products_supplier_manage" ON public.trade_marketplace_products
  FOR ALL USING (supplier_id = public._supplier_id());

-- ═══════════════════════════════════════════════════════════════════
-- trade_marketplace_brand_products — públicos para lectura
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.trade_marketplace_brand_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_products_read" ON public.trade_marketplace_brand_products
  FOR SELECT USING (activo = true AND auth.uid() IS NOT NULL);

CREATE POLICY "brand_products_manage" ON public.trade_marketplace_brand_products
  FOR ALL USING (brand_id = public._brand_id());

-- ═══════════════════════════════════════════════════════════════════
-- trade_marketplace_commissions — solo admin TrabFlow
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.trade_marketplace_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commissions_admin_only" ON public.trade_marketplace_commissions
  FOR ALL USING (
    auth.jwt() ->> 'email' = current_setting('app.admin_email', true)
  );
```



---

# PARTE II — INTEGRACIÓN CON EL CORE

---

## 9. EDGE FUNCTIONS DEL MARKETPLACE

### 9.1 Inventario de edge functions necesarias

| Función | Propósito | Prioridad |
|---------|-----------|-----------|
| `trade-marketplace-search` | Búsqueda inteligente de productos con IA | Fase 1 |
| `trade-marketplace-order-create` | Crear orden, dividir en sub-órdenes, notificar | Fase 1 |
| `trade-marketplace-order-confirm` | Proveedor confirma pedido | Fase 1 |
| `trade-marketplace-stock-sync` | Sincronizar stock desde APIs de proveedor | Fase 2 |
| `trade-marketplace-ai-suggest` | Sugerencias IA de materiales faltantes | Fase 2 |
| `trade-marketplace-payment` | Procesar pago con Stripe Connect | Fase 3 |
| `trade-marketplace-logistics-quote` | Calcular coste y plazo de entrega | Fase 1 |
| `trade-marketplace-notify` | Notificaciones email + push a todos los actores | Fase 1 |
| `trade-marketplace-invoice-sync` | Integrar factura del proveedor en el ERP | Fase 3 |
| `trade-marketplace-price-index` | Refresh diario de índice de precios | Fase 3 |
| `trade-marketplace-promotions` | Validar y aplicar promociones | Fase 2 |
| `trade-marketplace-returns` | Gestionar devoluciones | Fase 4 |

### 9.2 trade-marketplace-search — diseño funcional

La búsqueda del Marketplace es siempre contextual. Recibe el texto de la partida del presupuesto
(ya procesado por la IA) y devuelve los mejores productos disponibles, ordenados por preferencia
del instalador, score de coincidencia, precio y disponibilidad.

```
INPUT:
  query: "inodoro suspendido blanco" (descripción de la partida)
  org_id: uuid del instalador
  context: { quote_id, oficio: 'fontaneria', familia: 'sanitarios' }
  filters: { stock_disponible: true, precio_max: 400 }

PIPELINE DE BÚSQUEDA:
  1. Normalizar query (eliminar stopwords, añadir sinónimos técnicos)
  2. Llamar a search_marketplace_products (RPC PostgreSQL full-text)
  3. Boost de score para proveedores preferidos del instalador
  4. Enriquecer resultados con:
     - Imagen del producto (del fabricante si vinculado)
     - Ficha técnica PDF (del fabricante)
     - Datos de logística (plazo, coste de entrega para la zona del instalador)
  5. Aplicar descuento de asociación si aplica
  6. Devolver ordenado: preferido primero, luego por score × precio

OUTPUT POR RESULTADO:
  product_id, supplier_id, supplier_name, descripcion, ref_proveedor,
  precio_coste, precio_venta, precio_con_descuento_asociacion,
  stock_disponible, plazo_entrega_dias, coste_entrega_estimado,
  es_preferido, rating_proveedor, imagen_url, ficha_tecnica_url, score
```

### 9.3 trade-marketplace-order-create — lógica completa

```typescript
// Pseudocódigo del flujo de creación de orden

async function createMarketplaceOrder(req) {
  // 1. Validar permisos del usuario (RLS + plan)
  const { org_id, plan } = await resolveOrgAndPlan(supabase, userId);
  
  // 2. Generar número de pedido
  const numero = await generateOrderNumber(org_id);
  
  // 3. Crear orden principal (estado: 'borrador')
  const order = await insertMainOrder({
    numero, org_id, quote_id: req.quote_id,
    importe_total: sumLines(req.lines),
    tipo_entrega: req.tipo_entrega,
    direccion_entrega: req.direccion_entrega,
  });
  
  // 4. Agrupar líneas por supplier_id
  const bySupplier = groupBy(req.lines, 'supplier_id');
  
  // 5. Para cada proveedor: crear sub-orden + calcular logística
  const subOrders = [];
  for (const [supplierId, lines] of Object.entries(bySupplier)) {
    const logistics = await getLogisticsOption(supplierId, req.tipo_entrega, req.cp_entrega);
    const subOrder = await insertSubOrder({
      main_order_id: order.id, supplier_id: supplierId,
      importe_materiales: sumLines(lines),
      importe_entrega: logistics.precio,
      importe_total: sumLines(lines) + logistics.precio,
      tipo_entrega: logistics.tipo,
      commission_pct: await getSupplierCommission(supplierId),
    });
    // Insertar líneas en la sub-orden
    await insertOrderLines(lines.map(l => ({ ...l, sub_order_id: subOrder.id })));
    subOrders.push(subOrder);
  }
  
  // 6. Si req.confirm: cambiar estado a 'pendiente' y notificar proveedores
  if (req.confirm) {
    await updateOrderStatus(order.id, 'pendiente');
    for (const subOrder of subOrders) {
      await updateSubOrderStatus(subOrder.id, 'pendiente');
      await notifySupplier(subOrder);  // email + push
    }
  }
  
  // 7. Marcar partidas del presupuesto como pedidas (Core integration)
  if (req.quote_id) {
    const quotedItemIds = req.lines
      .filter(l => l.quote_item_id)
      .map(l => l.quote_item_id);
    await markQuoteItemsOrdered(quotedItemIds);
  }
  
  // 8. Registrar preferencias para aprendizaje
  for (const [supplierId, lines] of Object.entries(bySupplier)) {
    for (const line of lines) {
      if (line.familia) {
        await recordSupplierChoice(org_id, supplierId, line.familia);
      }
    }
  }
  
  return { order, subOrders };
}
```

### 9.4 trade-marketplace-notify — sistema de notificaciones

```typescript
// Notificaciones para cada evento del ciclo de vida del pedido

const NOTIFICATION_TEMPLATES = {
  // Al instalador
  order_confirmed: {
    push: "Tu pedido {numero} está confirmado. Entrega: {fecha_estimada}",
    email: "template_order_confirmed",
  },
  order_shipped: {
    push: "📦 Tu pedido de {supplier_name} está en camino. Tracking: {tracking_id}",
    email: "template_order_shipped",
  },
  material_reminder: {
    push: "El trabajo {job_title} es en {days} días. ¿Pedir material ahora?",
    email: null,  // solo push
  },
  
  // Al proveedor
  new_order: {
    push: "🛒 Nuevo pedido {numero} — {importe}€ — {localidad}",
    email: "template_supplier_new_order",
  },
  order_received_by_installer: {
    push: "El instalador ha recibido el pedido {numero}",
    email: null,
  },
};
```

---

## 10. APIs DEL MARKETPLACE

### 10.1 API pública REST (futuro — Fase 5)

Para proveedores que quieran integrar sus sistemas con TrabFlow:

```
BASE URL: https://api.trabflow.com/v1/marketplace/

ENDPOINTS:

GET  /suppliers/{id}/orders
  Listar pedidos recibidos del proveedor (requiere API key del proveedor)
  Filtros: estado, fecha_desde, fecha_hasta
  Paginación: cursor-based

PATCH /suppliers/{id}/orders/{order_id}
  Actualizar estado del pedido: confirmar, marcar enviado
  Body: { estado, tracking_id?, tracking_url?, fecha_entrega_estimada? }

POST /suppliers/{id}/products/sync
  Sincronizar catálogo completo vía CSV o JSON
  Content-Type: multipart/form-data (CSV) o application/json

POST /suppliers/{id}/stock/update
  Actualizar stock de uno o varios productos
  Body: [{ ref_proveedor, stock_disponible, plazo_entrega_dias }]

POST /suppliers/{id}/webhooks
  Registrar endpoint para recibir eventos de TrabFlow
  Body: { url, secret, eventos: ['pedido.nuevo', 'pedido.cancelado'] }
```

### 10.2 Webhooks de TrabFlow hacia proveedores

```json
{
  "evento": "pedido.nuevo",
  "timestamp": "2027-03-15T10:30:00Z",
  "signature": "sha256=abc123...",
  "data": {
    "sub_order_id": "uuid",
    "numero": "PED-2027-042-A",
    "instalador": {
      "nombre": "Instalaciones García",
      "telefono": "+34 618 000 000",
      "email": "garcia@example.com"
    },
    "entrega": {
      "tipo": "entrega_domicilio",
      "direccion": "Calle Mayor 15",
      "localidad": "Santander",
      "cp": "39001",
      "fecha_solicitada": "2027-03-17"
    },
    "lineas": [
      {
        "ref_proveedor": "ROCA-DEB-BL",
        "descripcion": "Inodoro Roca Debba Blanco",
        "cantidad": 1,
        "unidad": "ud",
        "precio_acordado": 189.00
      }
    ],
    "importe_total": 189.00,
    "notas": "Entregar en mañana (9-14h)"
  }
}
```

---

## 11. INTEGRACIÓN CON EL ERP

### 11.1 Flujo presupuesto → pedido → coste real → rentabilidad

```
CORE ERP                           MARKETPLACE
─────────────────────────────────────────────────────────────
trade_quotes (Aceptado)
    │
    │ El instalador pulsa "Pedir material"
    ▼
get_quote_marketplace_suggestions()
    → Devuelve producto sugerido por cada partida material
    │
    ▼
MarketplaceOrderFlow (UI)
    → El instalador revisa y confirma
    │
    ▼
trade_marketplace_orders (creado)
trade_marketplace_sub_orders (por proveedor)
trade_marketplace_order_lines (partidas confirmadas)
    │
    │ Actualiza:
    │ trade_quote_items.material_order_placed = true
    │ trade_jobs.tiene_pedido_material = true
    │ trade_jobs.coste_material_presupuestado = SUM(precio_coste × cantidad)
    │
    ▼
[Material recibido y factura del proveedor]
    │
    │ Integración Fase 3:
    │ trade_invoices (tipo_factura='recibida', sub_order_id=...)
    │ trade_jobs.coste_material_real = SUM(facturas_recibidas)
    │
    ▼
trade_ingresos (ya existente)
    → Rentabilidad = ingresos_presupuesto - coste_mano_obra - coste_material_real
    → KPI: margen real vs. margen presupuestado
```

### 11.2 Nuevos campos en tablas del Core

```sql
-- trade_jobs: tracking de material
ALTER TABLE public.trade_jobs
  ADD COLUMN IF NOT EXISTS tiene_pedido_material    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS coste_material_presupuestado numeric(12,2),
  ADD COLUMN IF NOT EXISTS coste_material_real          numeric(12,2),
  ADD COLUMN IF NOT EXISTS fecha_material_pedido         date,
  ADD COLUMN IF NOT EXISTS fecha_material_recibido       date;

-- trade_invoices: facturas recibidas de proveedores
ALTER TABLE public.trade_invoices
  ADD COLUMN IF NOT EXISTS tipo_factura text DEFAULT 'emitida'
    CHECK (tipo_factura IN ('emitida','recibida')),
  ADD COLUMN IF NOT EXISTS proveedor_marketplace_id uuid
    REFERENCES public.trade_marketplace_suppliers(id),
  ADD COLUMN IF NOT EXISTS sub_order_id uuid
    REFERENCES public.trade_marketplace_sub_orders(id);
```

### 11.3 Integración con Contratos de Mantenimiento

Los contratos de mantenimiento tienen dos puntos de integración con el Marketplace:

**A. Consumibles en partes de mantenimiento:**
```
Técnico registra consumible en el parte
→ [Pedir repuesto] button en ScreenMantenimiento
→ Búsqueda contextual: "filtro caldera Baxi 24T"
→ El proveedor preferido para mantenimiento Baxi aparece primero
→ El pedido se vincula al contrato: coste imputable al cliente del contrato
```

**B. Pedido anticipado antes de la revisión periódica:**
```
7 días antes de revisión periódica programada
→ Cron job detecta: contrato X tiene revisión el 2027-03-22
→ Notificación al instalador: "¿Quieres pedir los consumibles habituales para esta revisión?"
→ Plantilla recurrente del contrato (si existe) → pedido en un toque
```

### 11.4 Vista de rentabilidad con coste de material real

```
ScreenIngresos (ya existente) — nuevo KPI:

Trabajo: Reforma baño García
  Presupuesto cerrado:         2.450€
  Coste mano de obra:           480€ (16h × 30€)
  Coste material presupuestado: 847€ (estimado)
  Coste material real:          823€ (según facturas recibidas del proveedor)
  ────────────────────────────────────────────────────────
  Beneficio bruto:            1.147€ (vs. 1.123€ presupuestado)
  Margen real:                46.8% (vs. 45.8% presupuestado)
  Desviación material:          -24€ ✅ (ahorro)
```

---

## 12. INTEGRACIÓN CON PRESUPUESTOS IA

### 12.1 Regla de oro: el motor IA no se toca

```
trade-voice-to-quote → INTOCABLE
  - Versión v59, OK rate 98.2%
  - Cualquier cambio requiere benchmark de 400 casos
  - El Marketplace usa sus outputs, no modifica su lógica

El Marketplace amplía el CATÁLOGO disponible:
  Hoy: ~2.200 productos en trade_supplier_products (admin carga CSV)
  Fase 2: potencialmente 50.000+ en trade_marketplace_products (proveedores gestionan)
  
  enrichWithSupplierProducts() sigue funcionando igual:
  → search_supplier_products() busca en trade_supplier_products (no cambia)
  → search_marketplace_products() es la versión extendida del Marketplace
  → La IA no cambia. El catálogo disponible crece.
```

### 12.2 Nuevo campo en la respuesta del Motor IA

Cuando el Motor IA genera una partida y la enriquece con un producto del Marketplace,
se añaden nuevos campos al objeto de partida (sin cambiar el schema existente,
usando campos ya previstos: `supplier_key`, `supplier_ref`, etc.):

```typescript
// Partida enriquecida con datos del Marketplace
{
  descripcion: "Inodoro suspendido Roca Debba",
  tipo: "material",
  cantidad: 1,
  precio_unitario: 189,
  total: 189,
  origen: "catalogo_proveedor_saltoki",
  requiere_revision: false,
  supplier_key: "saltoki",
  supplier_name: "Saltoki Cantabria",
  supplier_ref: "ROCA-DEB-BL",
  supplier_precio_coste: 145,    // ← precio que paga el instalador
  supplier_margen_pct: 30,       // ← margen aplicado
  // NUEVO: vínculo con Marketplace
  marketplace_product_id: "uuid",  // ← si el producto está en trade_marketplace_products
}
```

### 12.3 Panel de sugerencias de la IA (wizard existente → Marketplace)

El wizard de sugerencias `suggestionsTemplates.ts` (ya implementado) se enriquece:

```
ACTUAL (wizard de sugerencias):
  Detecta familias faltantes y muestra opciones básicas/estándar/premium
  con precios fijos codificados en la plantilla

CON MARKETPLACE:
  Las opciones de cada familia se enriquecen con productos REALES del Marketplace:
  - Precio real del proveedor (no hardcodeado)
  - Stock disponible
  - Foto del producto (del fabricante)
  - Rating del proveedor
  - Plazo de entrega estimado
  
  El instalador elige en el wizard → automáticamente se añade
  a la lista de materiales del pedido
```

---

## 13. INTEGRACIÓN CON LA BASE MAESTRA

### 13.1 Rol actual de trade_global_catalog

```
trade_global_catalog (2.200 productos, precios de referencia)
  FUNCIÓN ACTUAL:
    Fallback de precio cuando no hay catálogo de proveedor
    enrichWithCatalogPrices() lo usa como segunda fuente

  FUNCIÓN EN MARKETPLACE:
    1. Referencia semántica: oficio + familia → category_id del Marketplace
    2. Precio de referencia para detectar anomalías de precio
       (si un proveedor pone un producto al 300% del precio de referencia → alerta)
    3. Catálogo de "último recurso" si no hay proveedor disponible
```

### 13.2 Enriquecimiento progresivo de la Base Maestra

Con el tiempo, los datos reales de transacciones del Marketplace mejoran la Base Maestra:

```sql
-- Actualización periódica de precios de referencia
-- Solo se actualiza si hay ≥ 10 transacciones y la diferencia es significativa
CREATE OR REPLACE FUNCTION public.refresh_global_catalog_prices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.trade_global_catalog gc
  SET
    precio_referencia = pi.precio_coste_mediana,
    updated_at = now()
  FROM public.trade_marketplace_price_index pi
  WHERE
    pi.familia = gc.oficio
    AND pi.mes = DATE_TRUNC('month', now() - interval '1 month')
    AND pi.num_transacciones >= 10
    AND ABS(pi.precio_coste_mediana - gc.precio_referencia) / NULLIF(gc.precio_referencia, 0) > 0.10;
    -- Solo actualiza si diferencia > 10%
END;
$$;

-- Llamado por el cron diario
```

### 13.3 Mapeo oficio → categoría del Marketplace

```sql
-- Tabla de mapeo para conectar el mundo de oficios del Core
-- con el árbol de categorías del Marketplace
CREATE TABLE public.trade_marketplace_oficio_category_map (
  oficio          text NOT NULL,   -- oficio de TrabFlow ('fontaneria', 'electricidad')
  familia         text NOT NULL,   -- familia de la partida ('sanitarios', 'tuberias')
  category_id     uuid REFERENCES public.trade_marketplace_categories(id),
  PRIMARY KEY (oficio, familia)
);

-- Ejemplos de mapeo:
-- fontaneria / sanitarios → categoria: Baños > Inodoros y WC
-- fontaneria / griferia   → categoria: Baños > Grifería
-- electricidad / cuadros  → categoria: Electricidad > Cuadros y Protecciones
-- climatizacion / splits  → categoria: Climatización > Unidades Split
```

---

## 14. INTEGRACIÓN CON STRIPE

### 14.1 Arquitectura de pagos

```
FASE 1-2 — Pago directo (sin plataforma):
  El pedido se genera en TrabFlow
  El pago sigue siendo el proceso habitual entre instalador y proveedor
  (transferencia bancaria, tarjeta en tienda, crédito del proveedor)
  TrabFlow registra el pago cuando el instalador lo confirma
  TrabFlow factura su suscripción mensual (sin cambios)
  
FASE 3 — Pago integrado (Stripe Connect):
  Instalador paga en TrabFlow con tarjeta o SEPA
  Stripe distribuye automáticamente a cada proveedor (Stripe Connect)
  TrabFlow retiene comisión (application_fee_amount)
  
  FLUJO DE PAGO:
    PaymentIntent → Stripe → charge
    charge → Transfer → proveedor.stripe_connect_id (menos comisión)
    application_fee → TrabFlow account
    
FASE 4 — Factura unificada mensual:
  TrabFlow agrega todos los pedidos del mes del instalador
  Cobra una única factura mensual
  Paga a proveedores en el ciclo mensual
  Requiere línea de crédito o factoring para financiar el gap
```

### 14.2 Modelo de Stripe Connect (Standard Accounts)

```
POR QUÉ STANDARD (no Express o Custom):
  - El proveedor gestiona sus propios impuestos y declaraciones
  - TrabFlow no es responsable de la fiscalidad del proveedor
  - Menos carga legal para TrabFlow
  - El proveedor tiene acceso a su propio dashboard de Stripe

ONBOARDING DEL PROVEEDOR EN STRIPE:
  1. En /proveedor/configuracion → [Conectar con Stripe]
  2. TrabFlow crea account Standard: stripe.accounts.create({ type: 'standard' })
  3. TrabFlow crea AccountLink y redirige al proveedor al onboarding de Stripe
  4. El proveedor completa KYC en Stripe (DNI, datos bancarios)
  5. Stripe notifica (webhook account.updated) cuando el estado es 'active'
  6. TrabFlow actualiza trade_marketplace_suppliers.stripe_connect_status = 'active'
  
PROCESAMIENTO DE PAGOS:
  Usar "Separate Charges and Transfers" (no Destination Charges)
  Razón: permite distribuir un cargo a múltiples proveedores
  
  1. PaymentIntent en la cuenta de TrabFlow (el instalador paga aquí)
  2. Cuando el pedido está en estado 'recibido' (no antes):
     Transfers automáticos desde el cargo a cada proveedor
  3. La comisión de TrabFlow se retiene como application_fee
```

### 14.3 Gestión de comisiones

```sql
-- Cálculo y registro de comisiones
CREATE OR REPLACE FUNCTION public.process_marketplace_commission(
  p_sub_order_id      uuid,
  p_stripe_charge_id  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub_order     public.trade_marketplace_sub_orders%ROWTYPE;
  v_supplier      public.trade_marketplace_suppliers%ROWTYPE;
  v_commission    numeric;
  v_transfer_amt  numeric;
BEGIN
  SELECT * INTO v_sub_order FROM public.trade_marketplace_sub_orders WHERE id = p_sub_order_id;
  SELECT * INTO v_supplier FROM public.trade_marketplace_suppliers WHERE id = v_sub_order.supplier_id;
  
  v_commission := ROUND(v_sub_order.importe_total * v_sub_order.commission_pct / 100, 2);
  v_transfer_amt := v_sub_order.importe_total - v_commission;
  
  -- Registrar comisión
  INSERT INTO public.trade_marketplace_commissions (
    sub_order_id, supplier_id, org_id,
    importe_pedido, commission_pct, commission_amount,
    stripe_payment_intent, estado
  ) VALUES (
    p_sub_order_id, v_sub_order.supplier_id,
    (SELECT org_id FROM trade_marketplace_orders WHERE id = v_sub_order.main_order_id),
    v_sub_order.importe_total, v_sub_order.commission_pct, v_commission,
    p_stripe_charge_id, 'pendiente'
  );
END;
$$;
```

---

## 15. INTEGRACIÓN CON ASOCIACIONES

### 15.1 Modelo de descuento colectivo

```
FLUJO COMPLETO:

1. TrabFlow firma acuerdo con Asociación Electricistas Cantabria
   → trade_associations INSERT
   
2. La asociación invita a sus socios a registrarse en TrabFlow
   → trade_association_members (org_id del instalador socio)
   
3. TrabFlow negocia con Saltoki descuento del 8% para los socios
   → trade_association_agreements (association_id, supplier_id, descuento_pct: 8)
   
4. Cuando el socio busca materiales en Saltoki:
   → search_marketplace_products aplica el descuento automáticamente
   → Precio mostrado: precio_coste × (1 - 8%) × (1 + margen_instalador%)
   
5. En el presupuesto, el instalador ve el ahorro:
   "Precio con descuento asociación: 189€ (precio normal: 205€, ahorro: 16€)"
   
6. Al final del mes, la asociación tiene:
   → GMV generado por sus socios
   → Ahorro total generado por el acuerdo negociado
   → Datos para renovar o mejorar condiciones
```

### 15.2 Tipos de descuento soportados

```
DESCUENTO PORCENTUAL: -8% sobre precio_coste del proveedor
PRECIO ESPECIAL: precio fijo pactado para X producto
ENVÍO GRATUITO: sin coste de entrega para los socios
FINANCIACIÓN: 30/60/90 días sin interés para socios de la asociación
CATÁLOGO EXCLUSIVO: productos solo disponibles para socios
```

---

# PARTE III — PANELES Y UX

---

## 16. DASHBOARD DEL INSTALADOR

### 16.1 Puntos de entrada al Marketplace

**El instalador NO ve una pantalla de inicio del Marketplace.**
El acceso es siempre contextual:

```
DESDE PRESUPUESTO ACEPTADO (punto de entrada principal):
  AppDashboardView → Presupuesto PRE-2026-077 (Aceptado)
  → Botón [Pedir material] ya existe en ScreenPedidosMaterial
  → Nuevo: auto-sugerencia de productos del Marketplace por cada partida

DESDE TRABAJO PLANIFICADO (7 días antes):
  AppDashboardView → ScreenPlanificacion → Trabajo X
  → Banner: "Este trabajo es en 7 días — ¿Pedir material ahora?"
  → Botón [Preparar pedido] → abre MarketplaceOrderFlow

DESDE PARTE DE MANTENIMIENTO:
  ScreenMantenimiento → Parte activo
  → Botón [+ Pedir consumible] en la sección de materiales del parte

DESDE MENÚ LATERAL (historial únicamente):
  "Pedidos de material" → ScreenPedidosMaterial (ampliado)
```

### 16.2 Flujo de pedido desde presupuesto — pantallas detalladas

**Pantalla 1: Resumen de materiales detectados**

```
┌──────────────────────────────────────────────────────────┐
│  Pedido para PRE-2026-077 — Reforma baño Ruiz García    │
├──────────────────────────────────────────────────────────┤
│  ✅ 5 artículos encontrados en tu catálogo de proveedor │
│  ⚠️  1 artículo sin precio — elige proveedor            │
│  💡 La IA detecta 2 consumibles adicionales             │
│     [Ver sugerencias +]                                  │
├──────────────────────────────────────────────────────────┤
│  ARTÍCULO           PROVEEDOR        PRECIO COSTE       │
│  Plato ducha 90×90  ★ Saltoki        289,00 €           │
│  Mampara 90cm       ★ Saltoki        245,00 €           │
│  Grifo ducha GROHE  ★ Saltoki         89,00 €           │
│  Azulejo 30×60 rect Azulejos Norte    18,00 €/m²        │
│  Pintura antihúmedad★ Saltoki         22,00 €           │
│  ─────────────────────────────────────────────          │
│  Inodoro suspendido [Elegir proveedor →]                │
├──────────────────────────────────────────────────────────┤
│  ESTIMACIÓN:  842,00 € materiales + entrega estimada   │
│  [← Volver]              [Continuar →]                  │
└──────────────────────────────────────────────────────────┘
```

**Pantalla 2: Comparación para artículo sin proveedor**

```
┌──────────────────────────────────────────────────────────┐
│  Inodoro suspendido — 4 opciones disponibles            │
├──────────────────────────────────────────────────────────┤
│  ★ SALTOKI                                              │
│  Inodoro Roca Debba Blanco BT · Ref: 342917000         │
│  189,00 € · Stock: Sí · Entrega: 24h · ★★★★★ (48)    │
│  [📄 Ficha técnica]   [Elegir este →]                  │
├──────────────────────────────────────────────────────────┤
│  OBRAMAT                                                │
│  Inodoro Geberit Acanto · Ref: 501.600.00.1            │
│  210,00 € · Stock: Sí · Entrega: 48h · ★★★★☆ (23)   │
│  [📄 Ficha técnica]   [Elegir este →]                  │
├──────────────────────────────────────────────────────────┤
│  BRICOMART PRO                                          │
│  Inodoro Teka MM · Ref: TK-MM-BL                       │
│  165,00 € · Stock: No (5 días) · ★★★☆☆ (8)           │
│  [Elegir este →]                                        │
├──────────────────────────────────────────────────────────┤
│  💡 IA: "Comprando el inodoro en Saltoki ahorras       │
│  12€ en entrega al agrupar con el resto del pedido"    │
└──────────────────────────────────────────────────────────┘
```

**Pantalla 3: Resumen del pedido dividido**

```
┌──────────────────────────────────────────────────────────┐
│  Tu pedido se enviará a 2 proveedores                   │
├──────────────────────────────────────────────────────────┤
│  📦 SALTOKI (6 artículos)                               │
│     Materiales: 834,00 €                                │
│     Entrega en obra 24-48h: GRATIS (pedido > 300€)     │
│     Subtotal: 834,00 €                                  │
├──────────────────────────────────────────────────────────┤
│  📦 AZULEJOS NORTE (1 artículo: azulejo 18m²)          │
│     Materiales: 216,00 €                                │
│     Entrega en obra 3-4 días: 25,00 €                  │
│     Subtotal: 241,00 €                                  │
├──────────────────────────────────────────────────────────┤
│  TOTAL MATERIALES:  1.050,00 €                          │
│  TOTAL ENTREGA:        25,00 €                          │
│  TOTAL PEDIDO:      1.075,00 €                          │
│                                                          │
│  📍 Entrega en: Calle Mayor 15, 39001 Santander         │
│  📅 Fecha deseada: lunes 2027-07-28                     │
│                                                          │
│  [← Modificar]    [✓ Confirmar y enviar pedido]        │
└──────────────────────────────────────────────────────────┘
```

### 16.3 Historial y seguimiento de pedidos

```
ScreenPedidosMaterial (ampliado con Marketplace):

PESTAÑAS: [En curso] [Recibidos] [Todos] [Favoritos]

TARJETA DE PEDIDO EN CURSO:
  PED-2027-042
  Reforma baño Ruiz García — PRE-2026-077
  ─────────────────────────────────────────
  📦 Saltoki     → 🚚 En camino (SEUR EP923847)
  📦 Azulejos N. → 📋 Confirmado — llega el 28/07
  ─────────────────────────────────────────
  Total: 1.075€  |  2026-07-24
  [Seguimiento]  [Contactar proveedor]  [Ver detalle]

TARJETA DE PEDIDO RECIBIDO:
  PED-2027-039  ✓ Recibido
  Instalación eléctrica — PRE-2026-071
  ─────────────────────────────────────────
  Saltoki · 320€  |  2026-07-18
  [Repetir pedido]  [Valorar proveedor]  [Ver factura]
```

---

## 17. DASHBOARD DEL PROVEEDOR

### 17.1 Arquitectura del portal /proveedor

El portal proveedor es una SPA separada dentro de TrabFlow,
montada en la misma Vercel deployment pero con rutas protegidas.

```typescript
// src/components/SupplierPortalView.tsx
// Punto de entrada para todo el portal del proveedor

const SupplierPortalView = () => {
  const { supplierAccount, loading } = useSupplierAuth();
  
  if (!supplierAccount) return <SupplierLoginView />;
  
  return (
    <SupplierLayout account={supplierAccount}>
      <Routes>
        <Route path="/proveedor/dashboard" element={<SupplierDashboard />} />
        <Route path="/proveedor/pedidos"   element={<SupplierOrdersScreen />} />
        <Route path="/proveedor/catalogo"  element={<SupplierCatalogScreen />} />
        <Route path="/proveedor/logistica" element={<SupplierLogisticsScreen />} />
        <Route path="/proveedor/stats"     element={<SupplierStatsScreen />} />
        <Route path="/proveedor/config"    element={<SupplierConfigScreen />} />
      </Routes>
    </SupplierLayout>
  );
};
```

### 17.2 Dashboard principal — KPIs en tiempo real

```
Métricas visible en la pantalla principal:

HOY:
  Nuevos pedidos: 8        GMV hoy: 2.340€
  Pendientes de confirmar: 3    SLA entrega: 97%

ESTA SEMANA:
  Total pedidos: 22       GMV semana: 8.920€
  Ticket medio: 405€      Clientes únicos: 16

ALERTAS ACTIVAS:
  🔴 3 pedidos sin confirmar (> 2 horas)
  🟡 8 artículos con stock en 0
  🟢 2 nuevas valoraciones esta semana

GRÁFICO: Pedidos y GMV últimas 4 semanas
```

### 17.3 Gestión de pedidos recibidos — estados desde el proveedor

```
LISTA DE PEDIDOS (tiempo real via Supabase Realtime):

  🔴 PED-2027-042-A · URGENTE
     Saltoki Cantabria ← Instalaciones García
     Reforma baño · Santander · 834€
     Recibido hace 8 min · Confirmar antes de: 14:00 hoy
     [✓ Confirmar]  [📋 Ver detalle]  [✗ Rechazar]
  
  🟡 PED-2027-039-B · En preparación
     320€ · Preparar antes de las 16:00
     [📦 Marcar como enviado]
     
  ✅ PED-2027-035-A · Enviado
     SEUR EP923847 · Entrega hoy
     [Confirmar entrega]

FILTROS: Hoy / Esta semana / Todos · Por estado · Por importe
```

### 17.4 Gestión del catálogo del proveedor

```
PANTALLA /proveedor/catalogo:

BARRA SUPERIOR:
  [+ Añadir producto]  [⬆ Importar CSV]  [⬇ Exportar CSV]
  Búsqueda: [campo de búsqueda]
  
TABLA DE PRODUCTOS:
  Ref.          Descripción          Familia    Precio   Stock  Activo
  ROCA-DEB-BL  Inodoro Roca Debba  sanitarios  189,00€  12     ✅
  GEB-01-BL    Inodoro Geberit     sanitarios  210,00€   5     ✅
  GROH-ECO-M   Grifo monom. GROHE  griferia     65,50€   0     ⚠️
  
  [Editar fila inline] · [Desactivar] · [Ver en Marketplace]

ALERTAS DEL CATÁLOGO:
  "Precio de GROH-ECO-M está un 38% por encima del mercado (65,50€ vs. 47,40€ mediana)"
  "15 productos sin imagen — los productos con imagen tienen 3× más pedidos"
  "8 artículos sin stock — considera desactivarlos o actualizar plazo"
```

### 17.5 Configuración de logística

```
PANTALLA /proveedor/logistica:

ZONAS DE ENTREGA:
  ┌─────────────────┬──────────┬──────────┬────────────────────┐
  │ Zona            │ Precio   │ Plazo    │ Pedido mín. gratis │
  ├─────────────────┼──────────┼──────────┼────────────────────┤
  │ Cantabria       │ 8,50 €   │ 24-48h   │ 300 €              │
  │ Asturias        │ 12,00 €  │ 48-72h   │ 500 €              │
  │ País Vasco      │ 10,00 €  │ 24-48h   │ 400 €              │
  │ Nacional        │ 18,00 €  │ 3-5 días │ 800 €              │
  └─────────────────┴──────────┴──────────┴────────────────────┘
  [+ Añadir zona]  [Guardar cambios]
  
HORARIO DE CORTE:
  Pedidos antes de: [13:00] → entrega al día siguiente
  Pedidos después de las 13:00 → entrega en 2 días hábiles
  
PUNTOS DE RECOGIDA:
  ● Almacén Santander (Pol. Raos) · Lun-Vie 8:00-18:00 · Tel: 942 000 000
  ● Almacén Torrelavega · Lun-Vie 9:00-17:00
  [+ Añadir punto de recogida]
```

### 17.6 Analytics del proveedor — detalle

```
PANTALLA /proveedor/stats:

MÉTRICAS DE NEGOCIO (mensual):
  GMV:           18.420€ (+12% vs mes anterior)
  Nº pedidos:       67   (+8%)
  Ticket medio:   274€   (+4%)
  Instaladores:     31   (24 recurrentes, 7 nuevos)

TOP PRODUCTOS:
  1. Inodoro Roca Debba (189€) — 23 unidades vendidas
  2. Grifo GROHE Eurosmart (65€) — 41 unidades vendidas
  3. Mampara 90cm (245€) — 12 unidades vendidas

ANÁLISIS OPERACIONAL:
  Tasa de confirmación: 94%  (6% rechazados — motivo principal: sin stock)
  Tiempo medio de confirmación: 1h 23min (SLA objetivo: < 2h)
  Tasa de entrega en plazo: 91%  (objetivo: > 95%)
  Incidencias: 3 (< 5% objetivo)

MAPA DE CALOR GEOGRÁFICO:
  (Opcional Fase 3) — Provincias con más pedidos
```

---

## 18. DASHBOARD DEL FABRICANTE

### 18.1 Diferencia fundamental con el proveedor

```
PROVEEDOR (distribuidora):
  → Vende directamente al instalador
  → Gestiona stock, pedidos, entrega
  → Su KPI principal es GMV y pedidos recibidos

FABRICANTE (marca):
  → No vende directamente
  → Gestiona información, documentación, presencia de marca
  → Su KPI principal es: ¿cuántos instaladores ven mis productos?
                          ¿cuántos distribuidores los ofrecen?
                          ¿cuál es mi penetración de mercado?
```

### 18.2 Catálogo oficial del fabricante

```
PANTALLA /fabricante/catalogo:

ESTRUCTURA:
  GROHE > Grifeŕia baño > Eurosmart > [12 referencias]
  GROHE > Grifería cocina > Minta > [8 referencias]
  
POR CADA PRODUCTO:
  Ficha técnica: ✅ (PDF subido 2025-03-01)
  Manual instalación: ✅ (PDF subido 2025-03-01)
  Imágenes: 3/5 recomendadas
  Vídeo instalación: ❌ (pendiente)
  Distribuidores que lo ofrecen: 4
  Instaladores que lo han presupuestado: 23 (último mes)

ACCIONES:
  [+ Nuevo producto]  [Actualizar desde ERP]  [⬆ CSV masivo]
  [Subir documentación]  [Ver en Marketplace]
```

### 18.3 Red de distribuidores del fabricante

```
PANTALLA /fabricante/distribuidores:

DISTRIBUIDORES ACTIVOS CON PRODUCTOS GROHE:
  
  Saltoki Cantabria
    Productos GROHE en catálogo: 34/82 (41%)
    Pedidos con GROHE último mes: 12
    Rating: ★★★★★ (4.8)
    Zonas: Cantabria, Asturias
    [Ver detalle]  [Enviar comunicación]
    
  OBRAMAT Santander
    Productos GROHE en catálogo: 28/82 (34%)
    Pedidos con GROHE último mes: 8
    Rating: ★★★★☆ (4.2)
    Zonas: Cantabria
    [Ver detalle]

DISTRIBUIDORES NO ACTIVOS (oportunidad):
  BigMat Torrelavega → No tiene catálogo GROHE
  [Invitar a incorporar catálogo GROHE]
```

### 18.4 Campañas del fabricante

```
PANTALLA /fabricante/campanas:

CAMPAÑA ACTIVA:
  "Nueva colección Eurosmart 2027"
  Tipo: Novedad de producto
  Duración: 2027-01-01 → 2027-03-31
  Productos: 12 referencias nuevas
  Instaladores que la han visto: 847
  Instaladores que han presupuestado productos: 34
  Pedidos generados: 18 (GMV: 2.340€)

CREAR NUEVA CAMPAÑA:
  Tipo: [Novedad / Oferta / Formación / Incentivo distribuidor]
  Productos: [seleccionar del catálogo]
  Mensaje para instaladores: [textarea]
  Duración: [fecha inicio - fecha fin]
  [Vista previa] [Enviar a TrabFlow para aprobación]
```

---

## 19. ROLES Y PERMISOS

### 19.1 Permisos del marketplace en el plan Empresa

```sql
-- Nuevas entradas en trade_org_permissions para Marketplace
-- (los campos se añaden a la tabla existente)

ALTER TABLE public.trade_org_permissions
  ADD COLUMN IF NOT EXISTS marketplace_view          boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS marketplace_order_create  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketplace_order_approve boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketplace_order_limit   numeric(10,2);
  -- null = sin límite de aprobación
  -- número = pedidos por encima de X€ requieren aprobación del admin
```

**Flujo de aprobación para plan Empresa:**

```
Técnico crea pedido de 1.850€
  → Límite de aprobación de esa org: 500€
  → Estado: 'pendiente_aprobacion'
  → Notificación push al owner: "El técnico García ha pedido 1.850€ en materiales"
  → Owner revisa en AppDashboardView → [Aprobar] o [Rechazar con motivo]
  → Si aprobado: estado cambia a 'pendiente', se envía a proveedores
```

### 19.2 Resumen de roles y accesos

```
                    Owner  Admin  Comercial  Técnico  Visualizador
Ver pedidos          ✓      ✓       ✓         ✓         ✓
Crear pedido         ✓      ✓       ✓         ✓*        ✗
Aprobar pedido       ✓      ✓       ✗         ✗         ✗
Cancelar pedido      ✓      ✓       ✗         ✗         ✗
Ver catálogo         ✓      ✓       ✓         ✓         ✓
Gestionar favoritos  ✓      ✓       ✓         ✓         ✗
Plantillas recur.    ✓      ✓       ✓         ✗         ✗
Ver analytics        ✓      ✓       ✓         ✗         ✗
Configurar asociac.  ✓      ✗       ✗         ✗         ✗

* Técnico: solo si marketplace_order_create = true en sus permisos
```

---

## 20. MOTOR IA DEL MARKETPLACE

### 20.1 Capacidades por fase

```
FASE 1 — IA BÁSICA:
  - Búsqueda semántica (ya existe: search_supplier_products)
  - Preferencias de proveedor aprendidas (ya implementado)
  - Sugerencias del wizard de familias faltantes (ya implementado)
  
FASE 2 — IA INTERMEDIA:
  - Detección de materiales consumibles olvidados
  - Optimización de agrupación de proveedores por coste total
  - Alertas de incompatibilidad (mampara ≠ plato)
  - Plantillas recurrentes sugeridas automáticamente

FASE 3 — IA AVANZADA:
  - Predicción de necesidades antes de que el presupuesto se genere
  - Análisis de tendencias de precio por familia
  - Recomendación de marcas basada en historial de instalaciones exitosas
  - Detección de oportunidades de compra (stock promocional del proveedor)

FASE 5 — IA ESTRATÉGICA (si procede):
  - Índice de precios de mercado en tiempo real
  - Alertas de variación significativa de precio
  - Sugerencias de alternativas cuando el artículo preferido sube de precio
```

### 20.2 Algoritmo de detección de materiales faltantes

```
ENTRADA: presupuesto con N partidas
SALIDA: lista de materiales adicionales sugeridos

ALGORITMO:
  1. Extraer familias presentes en el presupuesto
  2. Determinar tipo de trabajo (reforma baño, instalación eléctrica, etc.)
     usando la lógica ya existente de suggestionsTemplates.ts
  3. Cargar plantilla de trabajo correspondiente
     (SUG_BANO, SUG_COCINA, etc. — ya implementadas)
  4. Identificar familias de la plantilla AUSENTES en el presupuesto
  5. Para cada familia ausente:
     a. Buscar productos disponibles en el Marketplace (search_marketplace_products)
     b. Calcular probabilidad de necesidad (0-1):
        - Alta (> 0.9): consumibles de instalación (silicona, cinta teflón)
        - Media (0.5-0.9): accesorios complementarios (kit anclaje, válvula)
        - Baja (< 0.5): mejoras opcionales (termostato programable)
     c. Solo sugerir familias con probabilidad > 0.6
  6. Presentar máximo 8 sugerencias ordenadas por probabilidad

MEJORA CON DATOS DEL MARKETPLACE:
  Con suficiente volumen de transacciones:
  "Los instaladores que hicieron este tipo de trabajo también compraron..."
  → Mejora continua sin cambio de algoritmo (más datos = mejor resultado)
```

### 20.3 Optimización de agrupación de pedidos

```
PROBLEMA: El instalador tiene artículos de 3 proveedores.
          ¿Cuál es la combinación óptima?

ALGORITMO (para < 20 artículos):
  Fuerza bruta sobre todas las asignaciones posibles proveedor → artículo
  Para cada asignación posible:
    coste_total = SUM(precio_coste_proveedor × cantidad) + SUM(coste_entrega_proveedor)
  Devolver la asignación con menor coste_total
  
  Restricciones:
  - Si un artículo solo está disponible en un proveedor → fijado
  - Si el stock de X proveedor es 0 → excluir ese proveedor para ese artículo

ALGORITMO (para ≥ 20 artículos):
  Greedy: asignar cada artículo al proveedor con mejor (precio + entrega prorrateada)
  Resultado subóptimo pero aceptable en tiempo real

PRESENTACIÓN AL INSTALADOR:
  Opción 1 (óptima por coste): 1.020€ total (2 proveedores)
  Opción 2 (más rápida):       1.085€ total (todo en Saltoki, 24h)
  Opción 3 (por proveedor favorito): [custom]
  
  El instalador elige con criterio propio (coste vs. urgencia vs. relación)
```

---

## 21. UX DESKTOP — DETALLE

### 21.1 Principios de diseño específicos del Marketplace

```
COHERENCIA CON EL CORE:
  Mismo dark sidebar, mismo sistema de colores Tailwind
  Mismas convenciones de modal y overlay
  Mismos iconos (Lucide React)
  
DIFERENCIADORES VISUALES:
  Badges de estado del pedido con colores semánticos:
    🔵 Pendiente  🟡 Confirmado  🟠 En camino  🟢 Recibido
  
  Indicadores de stock con colores:
    🟢 > 10 unidades
    🟡 1-10 unidades  
    🔴 Sin stock
  
  Badge "★ Preferido" en resultados de búsqueda (ya implementado)
  Badge "🏷️ Oferta asociación" cuando hay descuento colectivo
  Badge "🆕 Nuevo" para productos marcados como novedad por el fabricante

INFORMACIÓN PROGRESIVA:
  Vista compacta: proveedor + precio + disponibilidad
  Vista expandida: foto + ficha técnica + rating + logística completa
  Vista comparación: lado a lado con tabla de diferencias
```

### 21.2 Panel lateral de documentación del fabricante

```
Cuando el instalador pulsa [📄 Documentación] en un resultado de búsqueda:

Panel deslizante desde la derecha (no modal, no pierde contexto):

┌──────────────────────────────────────┐
│ Inodoro ROCA Debba Suspendido Blanco │
│ Ref. Fabricante: 342917000           │
├──────────────────────────────────────┤
│ [Imagen del producto — grande]       │
├──────────────────────────────────────┤
│ 📄 Ficha técnica (PDF) [Ver | Desg.] │
│ 🔧 Manual instalación   [Ver | Desg.]│
│ 🎥 Vídeo de instalación [Ver]        │
│ 📜 Certificado CE        [Ver | Desg.]│
├──────────────────────────────────────┤
│ ESPECIFICACIONES:                    │
│ Anchura: 370mm · Fondo: 580mm        │
│ Salida: Horizontal                   │
│ Descarga: Dual (3/6L)                │
│ Color: Blanco brillante              │
│ Garantía: 5 años                     │
├──────────────────────────────────────┤
│ DISTRIBUTIDORES (en tu zona):        │
│ ★ Saltoki Cantabria · 189€ · 24h    │
│ OBRAMAT · 210€ · 48h                │
└──────────────────────────────────────┘
```

---

## 22. UX MOBILE — DETALLE

### 22.1 Pantallas mobile críticas (prioridad de implementación)

```
PRIORIDAD 1 (Fase 1):
  - Historial de pedidos con estado
  - Confirmación de pedido creado en desktop
  - Seguimiento en tiempo real (tracking)

PRIORIDAD 2 (Fase 2):
  - Crear pedido simple desde mobile
  - Comparación de proveedores (versión mobile)
  - Pedir consumible desde parte de mantenimiento

PRIORIDAD 3 (Fase 3):
  - Escáner de código de barras
  - Firma de recepción (confirmar entrega con foto o firma)
  - Chat con proveedor
```

### 22.2 Diseño de pantalla mobile — historial de pedidos

```
MOBILE — /marketplace/pedidos

[← Menú]  Mis pedidos  [🔔 3]

🔴 EN CURSO
  PED-2027-042
  Reforma baño · García
  ─────────────────────────────
  📦 Saltoki     🚚 En camino
  📦 Azulejos N. ✅ Preparado
  ─────────────
  1.075€  |  Entrega hoy 14h
  [Ver detalle] [Tracking]

🟢 RECIBIDO AYER
  PED-2027-039
  Instalación eléctrica
  ─────────────────────────────
  ✅ Saltoki  |  320€
  [Valorar] [Repetir pedido]
```

### 22.3 Confirmación rápida de pedido (desde notificación push)

```
El instalador recibe push: "Tu pedido PED-2027-042 está listo para enviar"

Al abrir:

[← Cerrar]  Pedido PED-2027-042

📋 RESUMEN:
  Reforma baño García
  2 proveedores · 1.075€

  ★ Saltoki (6 artículos · 834€)
  □ Azulejos Norte (1 artículo · 241€)

📍 Entregar en Calle Mayor 15, Santander
📅 Mañana lunes 28 de julio

[✓ Confirmar y enviar]   [Ver más detalle →]
```

### 22.4 Pedir consumible desde parte de mantenimiento (mobile)

```
ScreenParteTrabajo → sección materiales → [+ Pedir material]

Panel deslizante inferior:

─────────────────────────
🔍 [campo de búsqueda: voz o texto]

Recientes:
  Filtro caldera Baxi · Baxi Comercial · 12€
  Junta tórica 1/2" · Fontisur · 0,35€
  
[Buscar en catálogo]
─────────────────────────

Si el instalador elige "Filtro caldera Baxi":
  Baxi Comercial · 12,50€ · Recogida mañana
  [Añadir al pedido de este parte]
```

---

## 23. SISTEMA DE PEDIDOS — ESTADOS Y TRANSICIONES

### 23.1 Diagrama de estados completo

```
                     BORRADOR
                        │
              [Instalador confirma]
                        │
                     PENDIENTE ──────── [Proveedor rechaza] ──► CANCELADO
                        │
         ┌──────────────┴──────────────┐
   [todos confir.]             [alguno rechazado]
         │                             │
     CONFIRMADO                     PARCIAL
         │                          (sub-órdenes pendientes se manejan aparte)
   [preparando]
         │
    EN_PREPARACION
         │
      [enviado]
         │
       ENVIADO ──────── [Tracking: entregado] ──►
         │
   [Instalador confirma recepción]
         │
      RECIBIDO
         │
   [Factura integrada]
         │
     COMPLETADO


CANCELACIÓN: Permitida desde BORRADOR, PENDIENTE y CONFIRMADO
             Restringida desde EN_PREPARACION (requiere contacto con proveedor)
             No permitida desde ENVIADO o posterior
```

### 23.2 Numeración de pedidos

```
ORDEN PRINCIPAL:    PED-YYYY-NNNN       (PED-2027-0042)
SUB-ORDEN:          PED-YYYY-NNNN-X     (PED-2027-0042-A, PED-2027-0042-B)
DEVOLUCION:         DEV-YYYY-NNNN       (DEV-2027-0001)

Numeración anual (reinicia cada 1 de enero).
Los números se generan secuencialmente con bloqueo de concurrencia.
```

### 23.3 Gestión de pedidos parciales

```
ESCENARIO: El pedido tiene 2 sub-órdenes.
  Sub-orden A (Saltoki): confirmada y entregada ✅
  Sub-orden B (Azulejos Norte): rechazada (sin stock) ❌

ESTADO DEL PEDIDO PRINCIPAL: PARCIAL

SISTEMA SUGIERE AL INSTALADOR:
  "Azulejos Norte no puede servir el azulejo 30×60.
   ¿Quieres buscar alternativa?"
   [Buscar alternativa] → abre comparación para ese artículo
   
   Instalador elige Azulejos del Norte → nueva sub-orden C generada
   Estado del pedido: CONFIRMADO (todas las sub-órdenes cubiertas)
```

---

## 24. SISTEMA LOGÍSTICO — DETALLE

### 24.1 Cálculo de opciones de entrega

```
POR CADA SUB-ORDEN, el sistema calcula:

1. Cargar opciones de logística del proveedor
   (trade_marketplace_logistics WHERE supplier_id = X AND activo = true)

2. Para cada opción:
   a. Verificar zona: ¿el CP de entrega está en la zona del proveedor?
   b. Calcular precio de entrega para esa zona
   c. Aplicar gratuidad si importe_sub_orden ≥ precio_min_pedido_gratis
   d. Calcular fecha estimada según plazo_dias + horario_corte
   
3. Ordenar opciones:
   Entrega gratis primero → más rápida → más barata

4. Presentar al instalador:
   Opción 1: Entrega en obra — GRATIS — mañana 24h
   Opción 2: Recogida en almacén — GRATIS — disponible hoy
   Opción 3: Entrega urgente — 25€ — hoy antes de las 18h (surcharge)
```

### 24.2 Tracking automático (Fase 4)

```
FLUJO DE TRACKING:

1. Proveedor marca sub-orden como ENVIADO:
   - Introduce nº de tracking del transportista
   - Selecciona transportista (SEUR / MRW / GLS / Correos Express / otro)
   - Sistema guarda en trade_marketplace_sub_orders.tracking_id

2. Cron cada 4h: trade-marketplace-tracking
   - Para cada sub-orden en estado ENVIADO con tracking_id:
   - Llama a API del transportista correspondiente
   - Si estado cambia (entregado, intento fallido, etc.):
     → Actualiza trade_marketplace_sub_orders
     → Notificación push al instalador

3. El instalador ve en su app:
   "En camino · SEUR · Hoy 10:00-14:00"
   [Ver en SEUR] → link a tracking.seur.com

FASE INICIAL (sin integración API):
  El proveedor pega el link de tracking manualmente
  El instalador recibe el link y hace el seguimiento fuera de TrabFlow
  Sin automatización de actualización de estado

INTEGRACIÓN API (Fase 4):
  SEUR API: https://api.seur.com/tracking
  MRW API: https://www.mrw.es/seguimiento_envios/api
  GLS: https://api.gls-group.eu/public/v1/tracking
  Correos Express: API REST documentada
```

### 24.3 Gestión de entregas fallidas

```
ENTREGA FALLIDA (instalador no estaba en obra):

El transportista reporta intento fallido → TrabFlow recibe vía webhook/polling
→ Notificación push: "Intento de entrega fallido — ¿segunda entrega o recogida en depósito?"

Opciones:
  [Programar segunda entrega] → instalador elige franja horaria
  [Recoger en depósito] → dirección y horario del depósito más cercano
  [Cambiar dirección de entrega] → nueva dirección (si el proveedor lo permite)

Segundo fallo → notificación al proveedor para gestión directa con el transportista
```


---

# PARTE IV — COMERCIAL, ANALÍTICA Y SEGURIDAD

---

## 25. SISTEMA DE PROMOCIONES

### 25.1 Tipos de promoción soportados

```
TIPO 1 — DESCUENTO PORCENTUAL
  Proveedor: Saltoki
  Productos: toda la familia sanitarios
  Descuento: -15%
  Período: 01/04/2027 — 30/04/2027 (abril, mes del baño)
  
TIPO 2 — PRECIO FIJO ESPECIAL
  Proveedor: OBRAMAT
  Producto: Inodoro Roca Debba BT (ref específica)
  Precio especial: 149€ (normal: 189€)
  Stock asignado: 50 unidades
  
TIPO 3 — ENVÍO GRATUITO
  Proveedor: Azulejos Norte
  Condición: pedidos de azulejo > 200€
  Sin límite de tiempo
  
TIPO 4 — PACK
  Proveedor: Saltoki
  Pack "Baño completo": inodoro + lavabo + grifería
  Precio pack: 520€ (precio individual sumado: 620€)
  
TIPO 5 — DESCUENTO POR ASOCIACIÓN
  Ver sección 15 — negociado a nivel de gremio/cooperativa

TIPO 6 — DESCUENTO VOLUMEN
  Saltoki:
    5+ unidades de ref X: -5%
   10+ unidades de ref X: -10%
   20+ unidades de ref X: -15%
```

### 25.2 Modelo de datos de promociones

```sql
-- trade_marketplace_promotions (ya definida en sección 8)
-- Aquí se detalla la lógica de aplicación

-- Función para obtener el precio final aplicando todas las promociones vigentes
CREATE OR REPLACE FUNCTION public.get_final_price(
  p_product_id  uuid,
  p_supplier_id uuid,
  p_org_id      uuid,
  p_cantidad    numeric DEFAULT 1
)
RETURNS TABLE (
  precio_base       numeric,
  precio_con_promo  numeric,
  descuento_pct     numeric,
  promo_nombre      text,
  promo_id          uuid
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_precio_base  numeric;
  v_best_promo   record;
BEGIN
  -- Precio base del producto
  SELECT precio_coste INTO v_precio_base
  FROM public.trade_marketplace_products
  WHERE id = p_product_id;
  
  -- Buscar la mejor promoción aplicable (mayor descuento gana)
  SELECT
    mp.id, mp.nombre,
    CASE mp.tipo
      WHEN 'porcentual' THEN mp.valor_descuento
      WHEN 'precio_fijo' THEN ROUND((v_precio_base - mp.precio_especial) / v_precio_base * 100, 2)
      WHEN 'volumen' THEN (
        SELECT vm.descuento_pct
        FROM jsonb_to_recordset(mp.escalado_volumen) AS vm(cantidad_min int, descuento_pct numeric)
        WHERE vm.cantidad_min <= p_cantidad
        ORDER BY vm.cantidad_min DESC
        LIMIT 1
      )
      ELSE 0
    END AS descuento_efectivo
  INTO v_best_promo
  FROM public.trade_marketplace_promotions mp
  WHERE
    mp.supplier_id = p_supplier_id
    AND mp.activa = true
    AND now() BETWEEN mp.fecha_inicio AND mp.fecha_fin
    AND (mp.product_id IS NULL OR mp.product_id = p_product_id)
    AND (mp.association_id IS NULL OR EXISTS (
      SELECT 1 FROM public.trade_association_members am
      WHERE am.org_id = p_org_id AND am.association_id = mp.association_id
    ))
  ORDER BY descuento_efectivo DESC
  LIMIT 1;

  RETURN QUERY
  SELECT
    v_precio_base,
    CASE
      WHEN v_best_promo.id IS NULL THEN v_precio_base
      ELSE ROUND(v_precio_base * (1 - v_best_promo.descuento_efectivo / 100), 2)
    END,
    COALESCE(v_best_promo.descuento_efectivo, 0),
    v_best_promo.nombre,
    v_best_promo.id;
END;
$$;
```

### 25.3 Presentación de promociones al instalador

```
REGLAS DE PRESENTACIÓN:

1. Badge en el resultado de búsqueda:
   🏷️ -15% ABRIL    (tipo porcentual con período)
   🏷️ -23% HOY      (tipo precio fijo expresado como % para uniformidad)
   🏷️ ENVÍO GRATIS  (tipo envío)

2. El precio mostrado ya incluye la promoción (nunca dos precios).
   Excepción: mostrar tachado si el descuento es > 15% (más impacto visual)

3. En el resumen del pedido, línea de descuento:
   Plato ducha 90×90        289,00€
   Descuento "Abril baño": -43,35€
   ─────────────────────────────────
   Precio final:             245,65€

4. En el Word del pedido, se registra el precio final pagado.
   Las promociones no aparecen en el presupuesto al cliente final.
```

---

## 26. ANALYTICS

### 26.1 Analytics del instalador

**Disponible en AppDashboardView (módulo de Ingresos ampliado):**

```
KPI PANEL — MATERIALES
  Gasto total en materiales (año):   18.420€
  vs. año anterior:                  +12% ▲
  
  Gasto por proveedor:
    Saltoki:         11.240€ (61%)  ████████████▌
    OBRAMAT:          4.120€ (22%)  ████▌
    Azulejos Norte:   2.240€ (12%)  ██▌
    Otros:              820€  (5%)  ▌
    
  Gasto por oficio:
    Fontanería:       9.200€ (50%)  ─── (fontanería lidera, coherente con perfil)
    Electricidad:     5.480€ (30%)
    Climatización:    2.180€ (12%)
    Otros:            1.560€  (8%)

  Ahorro vs. precio de referencia (Base Maestra):
    Ahorro estimado:  1.840€/año  (9.1% sobre precio de mercado)
    "Comparando con los precios de mercado de la Base Maestra,
     tu acuerdo con Saltoki te ha ahorrado 1.840€ este año."
```

### 26.2 Analytics del proveedor

Ver sección 17.6 — Dashboard Proveedor. Resumen:

```
KPIs CLAVE:
  GMV mensual / semanal
  Nº pedidos y ticket medio
  Tasa de confirmación (% pedidos confirmados vs. recibidos)
  Tasa de entrega en plazo (% sub-órdenes entregadas a tiempo)
  Productos más vendidos
  Instaladores recurrentes vs. nuevos
  Nº reviews y valoración media
  
ALERTAS OPERACIONALES:
  Productos con stock en 0 que han sido buscados (demanda no atendida)
  Pedidos sin confirmar con SLA en riesgo
  Precios anómalos vs. mercado (detectados por el sistema)
```

### 26.3 Analytics de TrabFlow (panel admin)

El panel de administración de TrabFlow (ya existente) añade sección de Marketplace:

```
GRUPO 8 — MARKETPLACE (nuevo en AdminPanel)

KPIs GLOBALES:
  GMV total (mes / acumulado)
  Nº pedidos procesados
  Comisiones generadas (€ y % del GMV)
  Proveedores activos (con ≥ 1 pedido en 30 días)
  Instaladores que han hecho ≥ 1 pedido en 30 días
  Ratio de adopción: % de orgs activas que han hecho pedidos

EMBUDO DE CONVERSIÓN:
  Presupuestos aceptados con materiales →
  Abierto panel de comparación →
  Pedido iniciado →
  Pedido confirmado
  
  (cada paso con %)

TOP PROVEEDORES (por GMV):
  1. Saltoki Cantabria     42.300€ GMV · 187 pedidos · ★★★★★
  2. OBRAMAT Santander     18.900€ GMV · 89 pedidos  · ★★★★☆
  3. Azulejos Norte         9.400€ GMV · 67 pedidos  · ★★★★☆

TOP FAMILIAS DE PRODUCTOS (por volumen):
  1. Sanitarios          38% del GMV
  2. Grifería            22%
  3. Electricidad B2B    14%
  4. Climatización       12%
  5. Otros               14%

MAPA DE COBERTURA:
  Provincias donde hay instaladores activos pero sin proveedor local:
  → Burgos: 12 instaladores, 0 proveedores
  → La Rioja: 8 instaladores, 1 proveedor (cobertura parcial)
  [Estas son oportunidades de captación de proveedores]

ÍNDICE DE PRECIOS:
  Evolución del precio mediano por familia (gráfico de los últimos 6 meses)
  "El precio de sanitarios ha subido un 8% en 3 meses — posible presión de suministro"
```

### 26.4 Arquitectura de analytics

```
DATOS:
  PostgreSQL (Supabase) → vistas materializadas → panel admin
  
  Vistas materializadas (ya definidas en sección 8):
    trade_marketplace_supplier_daily_stats   → stats por proveedor/día
    trade_marketplace_daily_stats            → stats globales por día
    trade_marketplace_price_index            → precio mediano por familia/mes
  
  Actualización:
    Cron diario a las 02:00 UTC → REFRESH MATERIALIZED VIEW CONCURRENTLY

HERRAMIENTAS EXTERNAS (futuro Fase 4):
  Posthog o Mixpanel para embudo de conversión de UI
  (clics, tiempo en pantalla, abandono en comparación de proveedores)
  
  Looker Studio o Metabase conectado a Supabase para informes ad hoc
  (solo si el equipo de ventas lo necesita — no desde el principio)
```

---

## 27. SEGURIDAD

### 27.1 Principios de seguridad del Marketplace

```
PRINCIPIO 1 — ZERO TRUST EN RLS
  Cada actor solo puede leer/escribir sus propios datos.
  El frontend NUNCA tiene bypass de RLS.
  Las políticas de RLS están definidas y testeadas para todos los actores
  (instalador, proveedor, fabricante, admin).

PRINCIPIO 2 — SECURITY DEFINER MÍNIMO
  Solo las funciones que necesitan elevar privilegios usan SECURITY DEFINER.
  Todas usan SET search_path = public (regla PostgREST anti-cache-invalidation).
  Nunca se expone un SECURITY DEFINER a inputs sin validar.

PRINCIPIO 3 — PRECIOS OPACOS
  precio_coste del proveedor NUNCA es visible para otros instaladores.
  Solo el org_id del pedido puede ver sus propios precios_coste.
  En el catálogo global se muestra solo precio_venta (precio_coste + margen aplicado).

PRINCIPIO 4 — AISLAMIENTO DE ACTORES
  Un proveedor no puede ver datos de otro proveedor.
  Un fabricante no puede ver datos de otro fabricante.
  Un instalador no puede ver pedidos de otros instaladores.
  La función _supplier_id() y _brand_id() resuelven el actor desde auth.uid().

PRINCIPIO 5 — AUDITORÍA
  Todas las acciones de escritura en tablas críticas tienen updated_at automático.
  Cambios de estado de pedido se registran en trade_marketplace_order_events (Fase 2).
  No se borran pedidos: solo se cancelan (soft delete por estado).
```

### 27.2 Verificación de seguridad de datos de precio

```sql
-- Test de RLS: verificar que el proveedor B no puede ver datos del proveedor A

-- Como proveedor B autenticado:
SELECT * FROM trade_marketplace_products WHERE supplier_id = [proveedor_A_id];
-- Debe devolver 0 filas (RLS filtra)

-- Como proveedor A autenticado:
SELECT * FROM trade_marketplace_products WHERE supplier_id = [proveedor_A_id];
-- Debe devolver sus propios productos

-- Como instalador:
SELECT * FROM trade_marketplace_products;
-- Debe devolver SOLO los productos de proveedores a los que está vinculado (org_suppliers)
-- precio_coste no debe estar expuesto (vista o selección controlada)
```

### 27.3 Seguridad en pagos (Fase 3 — Stripe)

```
MEDIDAS ESPECÍFICAS:

1. Nunca se procesan datos de tarjeta en TrabFlow:
   → Stripe.js en frontend: el número de tarjeta va directamente a Stripe
   → TrabFlow solo maneja PaymentIntent IDs

2. Validación de webhooks de Stripe:
   → Verificar stripe-signature header con STRIPE_WEBHOOK_SECRET
   → Rechazar si la firma no coincide
   → Registrar en logs todos los eventos recibidos

3. Idempotencia de pagos:
   → Cada PaymentIntent tiene un idempotency_key único (order_id + timestamp)
   → Si el webhook se recibe dos veces, la segunda ejecución es no-op

4. Limitación de cantidades en backend:
   → El importe del PaymentIntent se calcula en backend (edge function)
   → Nunca se acepta el importe enviado por el frontend como válido

5. Retención de comisión:
   → El application_fee se calcula en backend
   → El proveedor no puede modificarlo desde su portal
```

### 27.4 Seguridad en la API REST pública (Fase 5)

```
AUTENTICACIÓN:
  API Keys de proveedores: secretos de 64 caracteres (SHA-256)
  Almacenados en trade_marketplace_suppliers.api_key_hash (hash, no plaintext)
  Rate limiting: 1.000 req/hora por API key (Supabase Edge Functions rate limit)

AUTORIZACIÓN:
  Cada endpoint verifica que la API key corresponde al supplier_id de la URL
  Un proveedor no puede llamar endpoints de otro proveedor

VALIDACIÓN DE WEBHOOKS SALIENTES:
  TrabFlow firma el payload con HMAC-SHA256 y el secret del proveedor
  El proveedor puede verificar que el webhook es auténtico antes de procesarlo

HTTPS OBLIGATORIO:
  Todo el tráfico va por HTTPS (Vercel + Supabase Edge)
  Sin fallback a HTTP
```

---

# PARTE V — ROADMAP Y ESTRATEGIA

---

## 28. ROADMAP 2027-2030

### 28.1 Visión general del roadmap

```
LÍNEA TEMPORAL:

Core TrabFlow:
  2026      Programa piloto controlado → primeros instaladores reales
  2027      Iteración beta → feedback → refinamiento
  01/2028   Lanzamiento público del Core

Marketplace:
  Q4 2026   Fase 0: Infraestructura (staging, CI/CD, deuda técnica)
  Q1 2027   Fase 1: Portal Proveedor MVP (proveedores piloto, sin pagos)
  Q2-3 2027 Fase 2: Portal Fabricante + mejoras IA + asociaciones
  Q4 2027   Fase 3: Pagos integrados (Stripe Connect)
  
  2028      Lanzamiento del Marketplace junto con el Core (o antes si el producto está listo)
  
  2028-2030 Fases 4 y 5: Logística avanzada, API REST pública, expansión nacional

NOTA: Las fechas del Marketplace son indicativas. El criterio de lanzamiento es la
madurez del producto y los acuerdos comerciales con proveedores, no una fecha fija.
```

### 28.2 Fase 0 — Infraestructura (Q4 2026)

```
OBJETIVO: Eliminar la deuda técnica antes de escalar

ENTREGABLES:
  □ CI/CD completo (GitHub Actions: tests + lint + deploy automático a staging)
  □ Entorno staging separado de producción
    - Supabase project staging independiente
    - Vercel preview deployments por PR
  □ Refactoring exportWord.ts para soportar tipo 'pedido'
  □ Test de smoke E2E del motor IA (pendiente desde Sprint 4)
  □ Monitorización básica: Sentry en frontend + logging en edge functions
  □ Variables de entorno documentadas (.env.example completo)

CRITERIO DE ÉXITO:
  Todo PR tiene CI verde antes de merge
  Los despliegues a producción son automáticos tras merge a main
  El motor IA tiene smoke test que se ejecuta en cada despliegue
```

### 28.3 Fase 1 — Portal Proveedor MVP (Q1 2027)

```
OBJETIVO: 5+ proveedores reales usando el portal, recibiendo pedidos estructurados

ENTREGABLES:
  □ Migración: trade_marketplace_suppliers + RLS + auth
  □ Login de proveedor independiente (email + password)
  □ Dashboard proveedor con pedidos en tiempo real (Supabase Realtime)
  □ Gestión básica de catálogo (editar precio, activar/desactivar)
  □ Importación CSV de catálogo
  □ Notificación email al proveedor cuando llega un pedido
  □ Confirmación de pedido desde el portal
  □ Registro del estado de entrega (manual)
  □ Configuración de zonas de entrega y precio

  NO INCLUYE (Fase 2): Stripe, fabricantes, asociaciones, API REST

CRITERIO DE ÉXITO:
  5 proveedores con portal activo
  20+ pedidos procesados por semana
  Tiempo de confirmación medio < 2 horas
```

### 28.4 Fase 2 — Ecosistema Completo (Q2-Q3 2027)

```
OBJETIVO: Modelo de datos completo, IA mejorada, todos los actores

ENTREGABLES:
  □ Portal Fabricante MVP (catálogo oficial, docs, distribuidores)
  □ Aprendizaje IA de materiales faltantes (detección automática)
  □ Integración con Asociaciones (descuentos colectivos)
  □ Sistema de promociones (tipos: porcentual, precio fijo, envío gratis)
  □ Ratings y reviews de proveedores
  □ Plantillas de pedido recurrente (para contratos de mantenimiento)
  □ Optimización de agrupación de pedidos por coste total
  □ Analytics de proveedor completas (todas las métricas de sección 26)
  □ Push notifications para estado de pedido

CRITERIO DE ÉXITO:
  1 fabricante nacional con catálogo oficial integrado
  3+ asociaciones con descuento activado
  NPS de proveedores: ≥ 50
```

### 28.5 Fase 3 — Pagos Integrados (Q4 2027)

```
OBJETIVO: Transacciones 100% dentro de TrabFlow, modelo de comisiones activo

ENTREGABLES:
  □ Stripe Connect (Standard Accounts) para proveedores
  □ Pago con tarjeta en el checkout del instalador
  □ Transferencia automática al proveedor tras confirmación de recepción
  □ Retención de comisión (application_fee)
  □ Factura automática al instalador (factura recibida en el ERP)
  □ Panel de comisiones en AdminPanel
  □ Reconciliación mensual automatizada

CRITERIO DE ÉXITO:
  80% de los pedidos pagados vía Stripe Connect
  Comisiones = primer flujo de ingresos del Marketplace
  Latencia de pago al proveedor: < 5 días hábiles tras recepción
```

### 28.6 Fase 4 — Logística Avanzada (2028)

```
ENTREGABLES:
  □ Integración de tracking con transportistas (SEUR, MRW, GLS)
  □ Actualización automática de estado de entrega
  □ Escáner de código de barras en mobile para recepción de materiales
  □ Firma digital de recepción
  □ Gestión de devoluciones automatizada
  □ API REST pública v1 para proveedores (webhook + endpoints)
  □ Puntos de recogida en mapa (integración Maps/Leaflet)
```

### 28.7 Fase 5 — Expansión Nacional (2029-2030)

```
ENTREGABLES:
  □ Expansión geográfica: de Cantabria al nacional
  □ Internacionalización: ES → PT → LA
  □ Índice de precios de mercado en tiempo real
  □ Marketplace de servicios: subcontratación entre instaladores
  □ Financiación integrada: BNPL (compra ahora, paga en 30/60/90 días)
  □ Catálogo de segunda mano: materiales de obra sobrantes
```

### 28.8 KPIs de negocio del Marketplace por año

```
TARGET 2027 (Fases 1-2):
  GMV mensual objetivo:    50.000€/mes (final de Fase 2)
  Proveedores activos:     20
  Instaladores activos:    100 (todos los del Core)
  Pedidos/mes:             200
  Comisión (aún 0%):       0€ (modelo en construcción)

TARGET 2028 (Fase 3 — lanzamiento con pagos):
  GMV mensual:             300.000€/mes
  Proveedores activos:     80
  Instaladores activos:    500 (crecimiento junto con el Core)
  Comisión media:          2%
  Ingresos por comisión:   ~6.000€/mes
  
TARGET 2029:
  GMV mensual:             1.500.000€/mes (1.5M€)
  Comisión media:          1.8% (mix de planes)
  Ingresos marketplace:    ~27.000€/mes
  
TARGET 2030:
  GMV mensual:             5.000.000€/mes (5M€)
  Ingresos marketplace:    ~90.000€/mes
  
NOTA IMPORTANTE: Estos targets son proyecciones indicativas del potencial del modelo,
no compromisos contractuales. El ritmo real dependerá de la adopción del Core,
los acuerdos con proveedores y las condiciones del mercado.
```

---

## 29. RIESGOS

### 29.1 Riesgos técnicos

```
RIESGO T1 — Regresión del Motor IA ★★★★★ (CRÍTICO)
  Descripción: Cualquier cambio en trade-voice-to-quote puede romper el motor
  Probabilidad: Baja si se siguen los protocolos
  Impacto: Catastrófico (la IA es la ventaja competitiva principal)
  Mitigación:
    → Regla de oro: NUNCA modificar sin benchmark de 400 casos
    → CI/CD con smoke test en cada despliegue
    → Rollback en < 5 minutos si OK rate cae bajo 95%
    → El Marketplace NO toca el motor — amplía el catálogo, no la lógica

RIESGO T2 — Complejidad de RLS con múltiples actores ★★★★☆
  Descripción: Con instalador + proveedor + fabricante + admin, los errores de RLS
               son más probables y más difíciles de detectar
  Probabilidad: Media
  Impacto: Brecha de seguridad (proveedor ve datos de otro) o datos invisibles
  Mitigación:
    → Tests de RLS automatizados por actor (parte de la estrategia de tests)
    → Code review de TODA migración SQL por el fundador
    → Entorno staging para probar RLS con usuarios reales simulados

RIESGO T3 — Supabase Realtime en producción ★★★☆☆
  Descripción: Es el primer uso real de Realtime en TrabFlow
               Puede tener problemas de estabilidad bajo carga
  Probabilidad: Media
  Impacto: El proveedor no recibe los pedidos en tiempo real
  Mitigación:
    → Siempre con email como canal de respaldo
    → Monitorizar reconexiones y latencia desde el día 1
    → Polling fallback si Realtime falla (degradación elegante)

RIESGO T4 — Stripe Connect onboarding ★★★☆☆
  Descripción: El KYC de Stripe puede bloquear a proveedores pequeños
               o regionales que no tienen todos los documentos
  Probabilidad: Media
  Impacto: Bloquea el modelo de comisiones
  Mitigación:
    → Fase 1 y 2 sin Stripe (pedidos con pago directo)
    → Dar tiempo a los proveedores para completar el KYC
    → Soporte dedicado al onboarding en Stripe

RIESGO T5 — Escalabilidad de búsqueda full-text ★★★☆☆
  Descripción: PostgreSQL full-text es suficiente hasta ~100.000 productos
               Por encima puede necesitar Elasticsearch o similar
  Probabilidad: Baja (Fase 1-3)
  Impacto: Búsquedas lentas → mala experiencia de usuario
  Mitigación:
    → Monitorizar P95 de search_marketplace_products desde el primer día
    → Índice GIN ya en la migración desde el principio
    → Si supera 500ms P95: evaluar Algolia o Typesense (integración sencilla)
```

### 29.2 Riesgos de negocio

```
RIESGO N1 — Tracción de proveedores ★★★★☆
  Descripción: Los proveedores no se registran o no usan el portal
  Probabilidad: Media-alta (es el riesgo principal de un marketplace)
  Impacto: Sin oferta → sin adopción de instaladores → sin GMV → sin ingresos
  Mitigación:
    → Fase 1 con onboarding manual (TrabFlow carga el catálogo, no el proveedor)
    → Primeros 5 proveedores son relaciones personales del fundador
    → Modelo sin coste en piloto (3 meses gratis)
    → Medir: ¿cuántos instaladores buscan materiales que no están en catálogo?
              → ese dato es el argumento comercial para el proveedor

RIESGO N2 — Competencia de marketplaces consolidados ★★★☆☆
  Descripción: Amazon Business, Leroy Merlin Pro, Würth Online, Manomano Pro
               pueden copiar la integración con ERP o mejorar la suya
  Probabilidad: Alta (en Fase 5+ si TrabFlow crece mucho)
  Impacto: Presión de precio en comisiones, dificultad para atraer proveedores
  Mitigación:
    → Ventaja de contexto: TrabFlow conoce el presupuesto, el trabajo y el cliente
      → imposible de replicar sin el ERP integrado
    → Barrera de salida del instalador: sus datos, preferencias y aprendizaje
      están en TrabFlow
    → Primero crecer en verticales específicos (fontanería + electricidad)
      donde Amazon no tiene especialización

RIESGO N3 — Márgenes de proveedores ★★★☆☆
  Descripción: Los proveedores rechazan el 2% de comisión como demasiado alto
               especialmente los de márgenes ajustados (distribuidoras)
  Probabilidad: Media
  Impacto: Sin acuerdos con proveedores grandes
  Mitigación:
    → El modelo de suscripción fija (49€/mes) puede ser alternativo al porcentaje
    → Para grandes distribuidoras: negociar %, no imponerlo
    → El valor diferencial (pedidos estructurados, 0 errores de referencia)
      puede justificar el 2% con argumento de ahorro operacional

RIESGO N4 — Regulatorio ★★☆☆☆
  Descripción: Si TrabFlow actúa como intermediario de pagos, puede requerir
               licencia de entidad de pago (PSD2)
  Probabilidad: Baja si se usa Stripe Connect correctamente
  Impacto: Legal y operacional si se materializa
  Mitigación:
    → Con Stripe Connect Standard, el contrato es entre instalador y proveedor
    → TrabFlow es "marketplace facilitator" — Stripe gestiona la regulación
    → Consultar con abogado antes de lanzar Fase 3
```

---

## 30. OPORTUNIDADES

### 30.1 Oportunidades de mercado

```
OPORTUNIDAD 1 — Financiación BNPL para instaladores ★★★★★
  El instalador pone el material sin cobrarlo hasta que termina el trabajo.
  El gap de tesorería es un pain crítico en el sector.
  TrabFlow puede actuar como intermediario:
    → Proveedor cobra a TrabFlow (30 días)
    → TrabFlow cobra al instalador (cuando cobra al cliente)
    → TrabFlow cobra los intereses o una comisión por adelanto
  
  Requiere: línea de crédito, regulación financiera o partnership con fintech
  Tiempo: Fase 5 (2029)

OPORTUNIDAD 2 — Marketplace de Servicios (subcontratación) ★★★★☆
  Un instalador de fontanería busca un yesero para terminar el trabajo.
  TrabFlow ya tiene el perfil de todos los instaladores (oficios, zona, valoraciones).
  Crear un canal de subcontratación B2B entre instaladores.
  
  Requiere: sistema de valoraciones ya existente (sección 8), nuevo módulo de match
  Tiempo: Fase 5 (2029)

OPORTUNIDAD 3 — Datos de demanda para fabricantes ★★★★☆
  Los fabricantes no saben qué instaladores están presupuestando sus productos.
  TrabFlow lo sabe antes de que se haga el pedido.
  Modelo B2B2B: vender datos de demanda agregados a fabricantes.
  
  → "1.200 instaladores en España han presupuestado caldera Vaillant 28kW en Q1 2027"
  → Datos anónimos y agregados, no por instalador
  → Requiere: RGPD compliance, acuerdo de datos con instaladores
  Tiempo: Fase 4 (2028)

OPORTUNIDAD 4 — Material de segunda mano / excedentes de obra ★★★☆☆
  Los instaladores tienen frecuentemente material sobrante de obras.
  Crear un canal de venta entre instaladores.
  → Ejemplo: "Tengo 5 cajas de azulejo 30×60 blanco sobrantes de una obra. 15€/m²"
  → El comprador es otro instalador que está haciendo la misma obra
  Tiempo: Fase 5 (2030)

OPORTUNIDAD 5 — Expansión a Portugal y Latinoamérica ★★★★☆
  El sector de instaladores es similar en toda la región hispanohablante.
  TrabFlow sin marketplace ya tiene valor en esos mercados.
  Con marketplace, la propuesta de valor crece (proveedores locales integrados).
  
  Portugal: primer mercado natural (similar regulación, proximidad)
  México/Colombia: mercado enorme pero más complejo operacionalmente
  Tiempo: Fase 5 (2029-2030)
```

### 30.2 Oportunidades de eficiencia interna

```
OPORTUNIDAD I1 — Aprendizaje cruzado entre instaladores ★★★☆☆
  "Los instaladores como tú que hacen reformas de baño en Cantabria
   compran estos materiales. ¿Los añades a tu presupuesto?"
  
  Basado en datos agregados (no datos individuales de otros instaladores).
  Mejora la calidad del presupuesto sin que el instalador tenga que buscar.

OPORTUNIDAD I2 — Predicción de necesidades ★★★☆☆
  Si el instalador tiene un trabajo de instalación eléctrica en 2 semanas,
  TrabFlow puede proactivamente sugerir pedir el material ahora:
  → Evita la situación de "llegar a la obra y que falte material"
  → El pedido anticipado reduce urgencia y puede reducir coste
  
  Requiere: calendario de trabajos (ya existe) + integración con pedidos

OPORTUNIDAD I3 — Negociación colectiva de precios ★★★☆☆
  Si TrabFlow concentra suficiente volumen de un proveedor,
  puede negociar descuentos para todos sus instaladores.
  → "50 instaladores de TrabFlow compran caldera Vaillant → 8% de descuento colectivo"
  → Similar al modelo de asociaciones (sección 15) pero gestionado por TrabFlow
```

---

## 31. ESTRATEGIA DE IMPLANTACIÓN

### 31.1 Secuencia de captación

```
SEMANA 1-4 (Captación personal):
  El fundador contacta directamente con 3-5 distribuidoras locales de confianza.
  Propuesta: "Te cargo el catálogo yo mismo. Cero trabajo para ti. Piloto gratuito 3 meses."
  Objetivo: 3 proveedores activos con catálogo real.

MES 2-3 (Validación técnica):
  Con los primeros proveedores y sus catálogos reales:
  → Verificar que la búsqueda funciona bien con datos reales
  → Ajustar el wizard de sugerencias con productos reales disponibles
  → Los instaladores beta empiezan a pedir material desde TrabFlow
  Objetivo: 10+ pedidos reales procesados.

MES 4-6 (Escalado comercial):
  Con datos de los primeros pedidos (GMV, ahorro de tiempo, feedback):
  → Contratar comercial B2B
  → Aproximarse a distribuidoras nacionales (OBRAMAT, Bricomart Pro)
  → Presentar al fundador: "Tenemos X instaladores activos que generaron Y€ de pedidos"
  Objetivo: 20 proveedores activos, 50+ pedidos/semana.

MES 7-12 (Portal proveedor autónomo):
  Los proveedores gestionan su propio catálogo y pedidos sin intervención de TrabFlow.
  Objetivo: Operaciones del marketplace sin soporte del fundador para cada proveedor.
```

### 31.2 Métricas de arranque (North Star Metrics)

```
¿CÓMO SABEMOS QUE EL MARKETPLACE ESTÁ FUNCIONANDO?

North Star 1 (tracción de proveedores):
  Proveedores activos (≥ 1 pedido en 30 días) ≥ 5

North Star 2 (adopción de instaladores):
  % de orgs que han hecho ≥ 1 pedido en los últimos 30 días ≥ 30%
  (de las que tienen presupuestos aceptados con materiales)

North Star 3 (volumen):
  GMV mensual ≥ 50.000€

North Star 4 (calidad operacional):
  Tasa de confirmación de pedidos > 90%
  Tiempo medio de confirmación < 2 horas

Si North Star 1 y 2 no se cumplen en 3 meses → evaluar pivote (ver sección 29)
```

### 31.3 Estrategia de lanzamiento público

```
LANZAMIENTO DEL MARKETPLACE (principios-mediados-finales de 2028,
dependiendo de la madurez del producto y los acuerdos comerciales):

PRE-LANZAMIENTO (3 meses antes):
  → Activar proveedores en lista de espera (los que han contactado durante la beta)
  → Comunicar a instaladores beta que el marketplace "oficial" abre
  → Preparar materiales de marketing: video demo, one-pager, caso de éxito

DÍA DE LANZAMIENTO:
  → Email a todos los instaladores con el video demo
  → Press release en medios del sector (Instalación Profesional, Instalaciones Eléctricas)
  → LinkedIn con caso de éxito de un instalador piloto
  → Webinar de 30 minutos: "Cómo pedir material directamente desde tu presupuesto"

POST-LANZAMIENTO (90 días):
  → Medir NPS de instaladores y proveedores
  → Ajustar basado en feedback real
  → Si GMV crece > 20% mes a mes: acelerar captación de proveedores
```

### 31.4 Estrategia de precios del Marketplace

```
MODELO DE MONETIZACIÓN DEL MARKETPLACE:

Para instaladores:
  → Incluido en los planes existentes del Core (Básico, Pro, Empresa)
  → Sin coste adicional por acceder al marketplace
  → El marketplace aumenta el valor del plan sin subir el precio
  → Esto maximiza la adopción y el GMV (más volumen = más comisión)

Para proveedores:
  PILOTO (3 meses): Gratis
  BÁSICO: 49€/mes + 2% de comisión por pedido completado
  PREMIUM: 199€/mes + 1% de comisión (para volumen alto)
  ENTERPRISE: A negociar (para grandes distribuidoras nacionales)
  
  Nota: Los planes de proveedor son independientes de los planes de instalador.
  Un proveedor puede estar en plan Piloto aunque todos sus instaladores sean Enterprise.

Para fabricantes:
  Fase 2: Free (para incentivar que suban su catálogo y docs)
  Fase 3+: Modelo de visibilidad (pago por aparecer como recomendado por la IA)
```

---

## 32. FUTURAS EVOLUCIONES

### 32.1 TrabFlow como sistema operativo del sector

```
VISIÓN 2030: TrabFlow no es una app de gestión.
Es el sistema operativo del instalador profesional.

CAPAS DEL SISTEMA OPERATIVO:

CAPA 1 — Gestión (ya en producción):
  Presupuestos, trabajos, facturación, planificación, equipo, mantenimientos

CAPA 2 — Materiales (Marketplace):
  Búsqueda, pedido, seguimiento, factura de proveedor

CAPA 3 — Financiero (futuro):
  Tesorería: cuándo cobro, cuándo pago materiales
  BNPL: pagar material cuando cobro al cliente
  Seguro de impago (si el cliente no paga, TrabFlow lo cubre)

CAPA 4 — Conocimiento (futuro):
  Manuales de instalación por marca/modelo (del fabricante → al técnico)
  Fichas de mantenimiento por equipo instalado
  Alertas de recall o actualizaciones de seguridad de equipos instalados

CAPA 5 — Comunidad (futuro):
  Subcontratación entre instaladores
  Formación y certificaciones
  Foros de dudas técnicas con respuesta de la IA
```

### 32.2 TrabFlow Connect como estándar B2B del sector

```
VISIÓN: El "EDI" moderno del sector de la instalación profesional

El EDI (Electronic Data Interchange) lleva 40 años siendo el estándar
de intercambio de pedidos B2B en sectores como el automovilístico.
Es técnicamente complicado y caro.

TrabFlow puede convertirse en el estándar moderno equivalente
para el sector de la instalación:

  → Pedido estructurado desde el presupuesto (sin error de referencia)
  → Confirmación automática del proveedor
  → Tracking integrado
  → Factura del proveedor integrada en el ERP del instalador

Cuando 500+ instaladores y 100+ proveedores usen TrabFlow,
el protocolo de comunicación entre ellos SE CONVIERTE EN EL ESTÁNDAR.
Los proveedores empezarán a recomendar TrabFlow a sus clientes instaladores
para reducir la fricción de los pedidos.

Esto es una barrera de entrada que ningún competidor puede replicar sin partir de cero.
```

### 32.3 Integración con domótica y mantenimiento predictivo

```
TENDENCIA: Los equipos instalados por el técnico se vuelven "conectados"
(calderas Vaillant, sistemas Daikin, paneles solares).

OPORTUNIDAD: Si el equipo reporta un fallo o un mantenimiento necesario,
la notificación puede llegar al técnico que lo instaló:
  → "Tu caldera Vaillant 24T instalada en Casa García reporta fallo E9"
  → TrabFlow crea automáticamente un parte de mantenimiento
  → Sugiere los repuestos del Marketplace para ese modelo específico
  → El técnico confirma y pide el repuesto antes de ir a la obra

Requiere: API del fabricante o hub IoT (ej: Daikin API, Vaillant myVAILLANT API)
Tiempo: Fase 5 / más allá de 2030
```

### 32.4 Expansión del modelo de IA

```
EVOLUCIÓN DEL MOTOR IA:

HOY (v59):
  voz → texto → presupuesto estructurado
  con enriquecimiento de catálogos

PRÓXIMO:
  voz → presupuesto → PEDIDO automático de materiales
  con confirmación del instalador en un toque

FUTURO CERCANO:
  foto del espacio → presupuesto completo
  (el instalador fotografía el baño, la IA genera la reforma)

FUTURO LEJANO:
  presupuesto de mantenimiento predictivo
  basado en histórico de averías del tipo de equipo + edad + uso

EL MARKETPLACE HACE QUE CADA AVANCE DEL MOTOR IA TENGA MÁS VALOR:
  Un presupuesto más preciso → materiales más correctos → pedido más fácil
  La cadena de valor completa amplifica cada mejora de la IA.
```

### 32.5 Certificación y homologación de instaladores

```
OPORTUNIDAD: Las marcas quieren que sus productos sean instalados correctamente.
Vaillant tiene su "VaillantPartner". GROHE tiene su "GROHE Academy".

TrabFlow puede convertirse en la plataforma de certificación:
  → El fabricante publica cursos de formación en TrabFlow
  → El técnico los completa (video + test)
  → Obtiene certificado digital en su perfil de TrabFlow
  → El fabricante puede ver cuántos instaladores certificados usan TrabFlow
  → Los clientes finales pueden verificar la certificación del técnico
  
Para el fabricante: visibilidad de quién instala sus productos
Para el técnico: diferenciación competitiva ("instalador certificado Vaillant")
Para el instalador-empresa: argumento comercial ante clientes corporativos
Para TrabFlow: nueva fuente de ingresos (plataforma de formación B2B)

Tiempo: Fase 5+ (cuando el Marketplace tenga suficiente masa crítica)
```

---

# APÉNDICES

---

## APÉNDICE A — GLOSARIO

```
Actor: Cada tipo de usuario del sistema (instalador, técnico, proveedor, fabricante, admin)
Base Maestra / trade_global_catalog: Catálogo de referencia de precios de mercado
GMV: Gross Merchandise Volume — volumen total de productos vendidos
Oficio: Especialidad del instalador (fontanería, electricidad, climatización, etc.)
Partida: Línea de un presupuesto (descripción + cantidad + precio + tipo)
Plan del Instalador: Básico / Pro / Empresa — determina los límites de uso
Proveedor Preferido: Proveedor que el instalador elige habitualmente para una categoría
RLS: Row Level Security — seguridad a nivel de fila en PostgreSQL/Supabase
SECURITY DEFINER: Función SQL que se ejecuta con los privilegios de su creador
Sub-orden: División de un pedido principal por proveedor
trade_: Prefijo de todas las tablas de TrabFlow en la base de datos
```

## APÉNDICE B — CONVENCIONES DE CÓDIGO

```
TABLAS:
  Prefijo: trade_marketplace_
  Siempre tienen: id (uuid, PK), created_at (timestamptz DEFAULT now())
  Las que representan un estado tienen: updated_at (timestamptz DEFAULT now())
  Actualización de updated_at: trigger <nombre_tabla>_updated_at
  
FUNCIONES SECURITY DEFINER:
  Siempre tienen SET search_path = public
  Nunca reciben p_user_id del exterior: usan auth.uid() internamente
  Siempre validan que el actor tiene acceso al recurso antes de actuar
  
EDGE FUNCTIONS:
  Prefijo: trade-marketplace-
  Usan el cliente supabase server (supabaseAdmin) para bypass de RLS
  Solo cuando se requiere acceso multi-actor
  Verifican la sesión del usuario manualmente antes de actuar
  
COMPONENTES REACT:
  No inner components (feedback_no_inner_components.md)
  Pantallas: Screen<Nombre>.tsx en src/components/
  Sub-componentes: <Nombre>Component.tsx o <Nombre>Section.tsx
```

## APÉNDICE C — CHECKLIST DE LANZAMIENTO DE CADA FASE

```
ANTES DE LANZAR CUALQUIER FASE EN PRODUCCIÓN:

□ Todos los tests de RLS pasan para todos los actores involucrados
□ La migración SQL se ha probado en staging sin errores
□ Las edge functions tienen variables de entorno configuradas en Vercel
□ El smoke test del motor IA sigue verde
□ Se ha revisado el plan de rollback (qué hacer si algo falla)
□ El equipo de soporte está informado de los nuevos flujos
□ La documentación interna está actualizada
□ Hay al menos 1 proveedor piloto que ha probado el nuevo flujo en staging
□ Se ha grabado un Loom explicando el nuevo flujo para el equipo

ESPECÍFICO PARA MIGRACIONES QUE TOCAN DATOS EXISTENTES:
□ Backup de la tabla antes de la migración
□ La migración es additive (no elimina columnas existentes)
□ Si elimina datos, hay confirmación explícita del fundador
```

## APÉNDICE D — REFERENCIAS TÉCNICAS

```
DOCUMENTOS INTERNOS:
  ARQUITECTURA.md                  — Stack y visión general del sistema
  docs/ai-engine/SPRINT4_PLAN.md  — Estado del motor IA (v59, 98.2%)
  docs/marketplace/TRABFLOW_CONNECT_AUDIT.md — Auditoría técnica detallada
  src/components/ScreenPedidosMaterial.tsx   — Implementación actual de pedidos
  supabase/migrations/20260623_supplier_orders_rls.sql — RLS de pedidos

DOCUMENTACIÓN EXTERNA:
  Supabase RLS: https://supabase.com/docs/guides/database/row-level-security
  Supabase Realtime: https://supabase.com/docs/guides/realtime
  Stripe Connect: https://stripe.com/docs/connect
  SEUR API: https://api.seur.com (acceso bajo registro)
  PostgreSQL Full-text Search: https://www.postgresql.org/docs/current/textsearch.html

HERRAMIENTAS DE TERCEROS EVALUADAS:
  Typesense: búsqueda si PostgreSQL FTS no escala
  Algolia: alternativa a Typesense (más cara)
  Posthog: analytics de producto
  Metabase: BI para el equipo
  Sentry: error tracking en producción
```

---

*Documento generado el 2026-07-23*
*TrabFlow Technologies SL — Confidencial*
*Versión 1.0 — Sujeto a revisión trimestral*
