# Marketplace TrabFlow — Arquitectura Funcional Objetivo

**Versión:** 1.0  
**Fecha:** 2026-08-03  
**Estado:** Propuesta para aprobación  
**Prerequisito:** `MARKETPLACE_GAP_ANALYSIS.md`

> Principio rector: un único flujo, un único carrito, un único marketplace, independientemente del origen de la compra.

---

## 1. Principios de diseño

### 1.1 Un único flujo
No hay flows distintos según el origen. Compra desde presupuesto, compra libre, recompra: todos terminan en el mismo carrito → checkout → pedido → ciclo de vida.

### 1.2 El carrito es el eje
El carrito es el punto de unión entre todos los orígenes (presupuesto, libre, sugerido, favorito) y todos los destinos (un proveedor, varios proveedores, mixto). El carrito no muere al cerrar la pestaña.

### 1.3 Producto Universal como moneda de cambio
Toda línea del carrito que se pueda identificar debe resolverse a un `universal_product_id`. Sin UP, hay carrito pero sin oferta de proveedor. Con UP, el sistema puede comparar proveedores, mostrar precio, stock y plazo.

### 1.4 El proveedor decide lo que publica
TrabFlow no impone precios. Los proveedores publican sus offerings con su precio, stock, plazo y condiciones. TrabFlow ordena y recomienda según criterios del instalador.

### 1.5 La relación comercial preexistente se preserva
Si el instalador ya compra a un proveedor con precio especial, TrabFlow debe ser capaz de reflejar esa relación (descuentos, crédito, recogida), no ignorarla.

---

## 2. Mapa de módulos

```
┌─────────────────────────────────────────────────────────────────────┐
│  PORTAL INSTALADOR                                                   │
│                                                                      │
│  ┌──────────────┐  ┌────────────────────────────────────────────┐   │
│  │  ERP         │  │  MARKETPLACE                               │   │
│  │              │  │                                            │   │
│  │  Presupuesto ├─►│  ScreenMarketplace (navegable)             │   │
│  │  (aceptado)  │  │  ├── Buscador + Filtros                   │   │
│  │              │  │  ├── Grid de productos (tarjeta UP)        │   │
│  │  "Comprar    │  │  ├── Ficha de producto + offerings         │   │
│  │  materiales" │  │  └── Carrito lateral persistente          │   │
│  │              │  │                                            │   │
│  │  Entrada B   │  │  Entrada directa desde menú               │   │
│  └──────────────┘  └────────────────────────────────────────────┘   │
│                                       │                              │
│                                       ▼                              │
│                              ┌─────────────────┐                     │
│                              │     CARRITO     │                     │
│                              │                 │                     │
│                              │  Líneas por UP  │                     │
│                              │  Por proveedor  │                     │
│                              │  Totales        │                     │
│                              │  Validaciones   │                     │
│                              └────────┬────────┘                     │
│                                       │                              │
│                                       ▼                              │
│                              ┌─────────────────┐                     │
│                              │    CHECKOUT     │                     │
│                              │                 │                     │
│                              │  Revisar        │                     │
│                              │  Dirección      │                     │
│                              │  Confirmar      │                     │
│                              └────────┬────────┘                     │
│                                       │                              │
│                                       ▼                              │
│                              ┌─────────────────┐                     │
│                              │    PEDIDOS      │                     │
│                              │                 │                     │
│                              │  Activos        │                     │
│                              │  Historial      │                     │
│                              │  Incidencias    │                     │
│                              │  Devoluciones   │                     │
│                              └─────────────────┘                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  PORTAL PROVEEDOR                                                    │
│                                                                      │
│  Dashboard | Catálogo | Pedidos | Clientes | Equipo | Informes | API│
│                                                                      │
│  Pedidos recibidos → confirmar → preparar → enviar/recoger          │
│  Catálogo propio → offerings → precios especiales por cliente        │
│  Clientes → ficha instalador → historial → condiciones              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  CATÁLOGO UNIVERSAL (admin)                                          │
│                                                                      │
│  Universal Products → Variantes → Offerings (por proveedor)         │
│  Categorías → Marcas → Especificaciones técnicas                    │
│  Matching: ean / mpn / semantic / admin / auto_seed                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Flujo unificado de compra

```
ORIGEN A: Desde presupuesto
──────────────────────────────
Presupuesto aceptado
    │ "Comprar materiales"
    ▼
create_cart_from_quote(quote_id)
    │ Level 0: UP/variante → offerings → selección automática proveedor
    ▼
Carrito (source_type='quote', source_ref='PRE-XXXX')
    │ 3 partidas → 3 cart_items con offering seleccionada

ORIGEN B: Compra libre
──────────────────────────────
ScreenMarketplace
    │ buscar producto / navegar categoría
    │ "Añadir al carrito"
    ▼
add_cart_item(cart_id, up_id, offering_id, cantidad)
    │ Si no hay carrito activo → create_cart() source_type='free'
    ▼
Carrito (source_type='free', source_ref=NULL)

ORIGEN C: Recompra
──────────────────────────────
ScreenPedidos → historial → "Repetir pedido"
    ▼
Añadir líneas del pedido anterior al carrito activo

UNIFICACIÓN EN EL CARRITO
──────────────────────────────
Carrito (puede tener líneas de distintos orígenes)
    │ Validar stock
    │ Recalcular precios
    │ Agrupar por proveedor
    ▼
CHECKOUT
    │ StepRevisar: revisar líneas, cambiar proveedor, ajustar cantidad
    │ StepDireccion: seleccionar dirección de entrega o recogida
    │ StepConfirmar: resumen total por proveedor, CTA
    ▼
checkout_cart(cart_id)
    │ → 1 trade_marketplace_orders por proveedor
    │ → N trade_marketplace_order_items por pedido
    │ → outbox events
    ▼
PEDIDOS (uno por proveedor)
    │ pending → confirmed → preparing → shipped/picked_up → delivered
    ▼
HISTORIAL
```

---

## 4. Módulos funcionales detallados

### 4.1 ScreenMarketplace (nuevo)

Pantalla navegable para el instalador. Punto de entrada desde el menú lateral.

**Secciones:**
- **Buscador superior**: búsqueda por nombre, marca, referencia, descripción. Autocompletado con UPs validados.
- **Filtros laterales**:
  - Categoría (árbol de categorías)
  - Marca
  - Rango de precio (slider)
  - Solo con stock
  - Solo en oferta
  - Plazo de entrega (< 24h, 24-48h, > 48h)
  - Solo con recogida disponible
- **Grid de productos**: tarjetas de UP con mejor offering disponible
- **Carrito lateral**: panel derecho siempre visible (ver §4.2)
- **Ordenación**: más vendidos, precio ↑, precio ↓, novedades, plazo ↑

**Fuente de datos:**
- Listado de UPs validated con al menos 1 offering matched activa
- Precio mostrado: `precio_venta` del offering seleccionado automáticamente (el más barato / el preferido)
- Stock agregado: si algún proveedor tiene stock, mostrar como disponible

### 4.2 Carrito Lateral Persistente (nuevo)

Panel lateral derecho visible siempre en ScreenMarketplace y en la ficha de producto. Colapsable en móvil (botón flotante con badge de cantidad).

**Datos por línea:**
- Imagen del producto (offering.image_url → up.image_url → placeholder)
- Nombre del UP + variante
- Proveedor seleccionado (nombre + logo)
- Referencia del proveedor (supplier_ref)
- Unidad y cantidad (input editable inline)
- Precio unitario y subtotal de línea
- Icono de stock (✓ disponible / ! bajo stock / ✗ sin stock)
- Badge de origen (presupuesto / libre / sugerido)
- Botón X para eliminar línea
- Enlace "Cambiar proveedor" (expande alternativas)

**Acciones del carrito:**
- ± cantidad por línea
- Eliminar línea
- Cambiar proveedor (inline, sin salir del carrito)
- Vaciar carrito
- Guardar para después (convierte carrito en "guardado", no en pedido)
- Finalizar compra → navega al checkout wizard

**Footer del carrito:**
- Subtotal por proveedor
- Subtotal global
- Envío estimado (o "Calcular al confirmar")
- Total estimado
- Botón "Finalizar compra" (desactivado si carrito vacío)
- Banner promocional si aplica (envío gratis desde X€)

**Persistencia:**
- `cart_id` guardado en `localStorage` (no `sessionStorage`) con `org_id`
- Al cargar la app: buscar carrito activo del org actual en BD, sincronizar
- Si hay carrito activo en BD sin `localStorage` local (otro dispositivo), mostrar banner "Tienes un carrito pendiente"

### 4.3 Tarjeta de Producto (nueva)

Componente `ProductCard.tsx` usado en el grid del marketplace.

**Datos mostrados:**
- Imagen principal (200×200, object-cover, lazy-load)
- Badge de oferta (si `precio_venta < precio_referencia`)
- Nombre del UP (2 líneas máx)
- Nombre de marca
- Variante activa (si tiene > 1 variante: selector inline)
- Precio desde: el precio_venta más bajo entre offerings matched activas
- Badge "N proveedores" si hay más de uno
- Proveedor preferido (nombre)
- Plazo de entrega (días)
- Indicador de stock (✓ / ! / ✗)
- Botón "Añadir" — añade 1 unidad al carrito con la offering más barata
- Botón "Ver opciones" — si hay más de 1 proveedor, abre panel de comparación

**Estados:**
- Normal
- Sin stock en todos los proveedores (overlay "Sin stock")
- Sin offering ("Próximamente" o "Solicitar oferta")
- En oferta (badge verde "-X%")
- Más vendido (badge azul)

### 4.4 Ficha de Producto (nueva)

Pantalla `ScreenProducto.tsx` o slide-over activado desde la tarjeta.

**Secciones:**
- Galería de imágenes
- Nombre, marca, modelo, referencia
- Descripción técnica (especificaciones del UP)
- Selector de variante (si UP tiene variantes activas)
- Tabla de proveedores disponibles:

```
PROVEEDOR        PRECIO    STOCK    PLAZO    RECOGIDA    ACCIÓN
─────────────────────────────────────────────────────────────────
OBRAMAT          €13,90    25 ud    48h      Sí          [Añadir]
Saltoki          €14,20    12 ud    24h      Sí          [Añadir]
Sonepar          Sin stock  —       —        —           [Avisar]
```

- Productos relacionados (mismo UP padre, distinta variante)
- Productos equivalentes (mismo oficio + familia, UPs distintos)

### 4.5 Checkout Wizard (ampliar existente)

El wizard actual tiene 2 pasos. Añadir StepDireccion entre StepRevisar y StepConfirmar.

**StepRevisar** (ya existe, mantener):
- Revisar líneas, cantidades, proveedor seleccionado
- Expandir alternativas por línea
- Estrategia de selección (mejor opción, menor precio, más rápido, un solo proveedor)

**StepDireccion** (nuevo):
- Seleccionar dirección de entrega (lista de `trade_delivery_addresses` del org)
- O añadir nueva dirección
- Por proveedor: elegir entre envío o recogida en almacén (si el proveedor tiene puntos de recogida)

**StepConfirmar** (ya existe, extender):
- Mostrar dirección de entrega seleccionada
- Mostrar modo de entrega (envío / recogida)
- Añadir campo de notas al proveedor por pedido

### 4.6 Seguimiento de Pedidos (extender existente)

`ScreenSeguimientoMaterial.tsx` ya existe con las tabs "Activos" / "Historial". Añadir:

- Tab "Incidencias" (nueva)
- Filtro por estado en la tab de historial
- Acción "Repetir pedido" en historial
- Acción "Abrir incidencia" en pedido activo o histórico

### 4.7 Portal Proveedor — módulo Clientes (nuevo)

Nueva tab en `PortalProveedorView.tsx`: **Clientes**.

Contenido:
- Listado de orgs que han realizado pedidos
- Ficha de cada org/instalador: empresa, CIF, contacto, teléfono, email
- Historial de pedidos con ese instalador
- Campo para nota interna del proveedor sobre el cliente
- Configuración de condiciones especiales (precio, crédito, rappel) — RC2

---

## 5. Modelo de actores

| Actor | Rol en el marketplace | Capacidades |
|---|---|---|
| **Instalador** | Comprador | Navegar, buscar, añadir al carrito, comprar, seguir pedidos, abrir incidencias, devolver |
| **Proveedor** | Vendedor | Recibir pedidos, gestionar catálogo, definir precios, gestionar stock, confirmar envío |
| **Admin TrabFlow** | Operador | Gestionar UPs, matching, categorías, usuarios, proveedores, calidad de datos |
| **Motor IA** | Agente | Resolver IDs estructurados en quote_items, sugerir productos, enriquecer datos |

---

## 6. Puntos de integración

| Integración | Estado | Descripción |
|---|---|---|
| Motor IA → Marketplace | ✅ Completo | `resolveMarketplaceIds` en trade-voice-to-quote v70 |
| Supplier API v1 | ✅ Completo | Bearer auth, /catalog/upsert, sync offerings |
| Supabase Realtime | ✅ Completo | ScreenSeguimientoMaterial tiene suscripción activa |
| Push Notifications | ⚠️ Parcial | Infraestructura OK; sin trigger para estado de pedido |
| Stripe (marketplace) | ❌ No existe | Pagos en marketplace: fuera de alcance RC1 |
| Logística (tracking externo) | ❌ No existe | tracking_ref es texto libre; sin integración |

---

## 7. Arquitectura de datos (resumen)

Ver `MARKETPLACE_DATA_MODEL.md` para detalle completo.

**Tablas existentes clave:**
- `trade_marketplace_carts` + `trade_marketplace_cart_items`
- `trade_marketplace_orders` + `trade_marketplace_order_items` + `trade_marketplace_order_events`
- `trade_marketplace_universal_products` + `trade_marketplace_universal_product_variants`
- `trade_marketplace_supplier_offerings`
- `trade_marketplace_actors` + `trade_marketplace_actor_members`
- `trade_marketplace_outbox` + `trade_marketplace_audit_log`

**Tablas nuevas necesarias (RC1):**
- `trade_delivery_addresses` — direcciones de entrega del org
- `trade_supplier_pickup_points` — puntos de recogida del proveedor

**Tablas nuevas (RC2):**
- `trade_supplier_relationships` — relación comercial instalador–proveedor
- `trade_supplier_customer_prices` — precios especiales por cliente
- `trade_supplier_credit_terms` — condiciones de pago
- `trade_order_incidents` — incidencias de pedido
- `trade_order_returns` — devoluciones

---

## 8. Ecosistema de proveedores demo — identidades oficiales (2026-08-08)

La arquitectura objetivo se demuestra con proveedores ficticios. **Ningún nombre de marca real** aparece en la identidad visible del Marketplace.

| # | Nombre demo | Slug | Especialidad | Estado |
|---|------------|------|-------------|--------|
| 1 | Obras y Materiales S.L. | `obramat-demo` | Materiales de construcción y reforma | ✅ Activo |
| 2 | Fontanería Saltos Quiroga S.L. | `fontaneria-saltos-quiroga` | Fontanería y climatización | ⏳ Pendiente crear |
| 3 | ElectroDistribución Cantábrica S.L. | `electrodistribucion-cantabrica` | Electricidad e iluminación | ⏳ Pendiente crear |
| 4 | Revestimientos y Obra Norte S.L. | `revestimientos-obra-norte` | Revestimientos, pavimentos, morteros | ✅ Activo (escaso) |
| 5 | Pinturas Profesionales del Norte S.L. | `pinturas-profesionales-norte` | Pinturas y tratamientos | ✅ Activo (escaso) |
| 6 | Carpintería y Cerramientos Norte S.L. | `carpinteria-cerramientos-norte` | Carpintería y cerramientos | ✅ Activo (escaso) |
| 7 | Sistemas Térmicos del Norte S.L. | `sistemas-termicos-norte` | ACS, aerotermia y climatización | ⏳ Pendiente crear |

Actores complementarios (no en la lista objetivo de 7, pero activos):
- **Suministros Técnicos Norte S.L.** (`suministros-tecnicos-norte`) — grifería premium
- **ElectroSuministros Cantábrico S.L.** (`electrosuministros-cantabrico`) — electricidad doméstica

Docs de referencia: `RC1_C4B_DEMO_SUPPLIERS.md`, `RC1_C4B_SUPPLIER_IDENTITY_GUIDE.md`

---

## 8. Invariantes que no cambian

Estos elementos del diseño actual **no se tocan** en la arquitectura objetivo:

1. `create_cart_from_quote` y Level 0 — correcto, no modificar
2. `checkout_cart` → ciclo de vida del pedido — correcto, extender
3. Portal Proveedor MVP 1-7 — correcto, extender con módulo Clientes
4. Supplier API v1 — correcto, no modificar
5. Modelo UP → variante → offering — correcto, es el corazón
6. `match_method` y `match_state` — correcto, no añadir valores sin aprobación

---

*Próximo documento: `MARKETPLACE_ROADMAP_RC1.md`*
