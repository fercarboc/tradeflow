# MKT-ARCH-01 — Modelo Unificado de Proveedores, Catálogos y Marketplace

**Versión:** 2.0 (revisión post-aprobación de principios)  
**Fecha:** 2026-08-01  
**Estado:** Arquitectura objetivo aprobada en principios · Plan de ejecución pendiente de aprobación por fase  
**Tipo:** Documento de arquitectura · Sin migraciones · Sin código

> **Principio rector:** Un único modelo operativo.  
> `trade_marketplace_actors` es la identidad del proveedor.  
> `trade_marketplace_supplier_offerings` es el catálogo ofertado.  
> `trade_marketplace_universal_products` es el catálogo común.  
> Las tablas legacy son fuente de migración histórica, no infraestructura permanente.

---

## 1. Estado actual — recapitulación de la auditoría

*(Ver `MARKETPLACE_DATA_AUDIT_2026_07_31.md` para números completos.)*

Existen hoy dos sistemas operativos sin sincronización:

| Sistema | Tablas centrales | Registros activos | Rol hoy |
|---------|-----------------|------------------|---------|
| **Legacy ERP** | `trade_supplier_catalogs`, `trade_supplier_products`, `trade_global_catalog` | 921 + 891 + 136 | Motor IA + Central de Compras |
| **Marketplace** | `trade_marketplace_actors`, `trade_marketplace_supplier_offerings`, `trade_marketplace_universal_products` | 2 + 213 + 6 | Portal proveedor + compra |

El puente `trade_marketplace_actors.supplier_catalog_id → trade_supplier_catalogs` existe pero **no puede ser la arquitectura permanente**. Usarlo como columna vertebral perpetúa la duplicidad que hay que eliminar.

---

## 2. Modelo objetivo — tres tablas canónicas

```
┌──────────────────────────────────────────────────────────────────────┐
│  FUENTES DE ENTRADA (canales únicos de escritura)                   │
│                                                                      │
│  Portal Proveedor ──────────┐                                        │
│  Supplier API v1 ───────────┤──▶ trade_marketplace_supplier_offerings│
│  Admin (carga supervisada) ─┘         (fuente de verdad: oferta)    │
│                                                │                     │
│  Admin (revisión y validación) ─────────────────▶                   │
│                                 trade_marketplace_universal_products  │
│                                       (fuente de verdad: catálogo)   │
│                                                │                     │
│  Motor IA (presupuestos) ────────────────────────▶                   │
│                                 trade_marketplace_cart_items          │
│                                       (vía UP + offering)            │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  FUENTE DE VERDAD: PROVEEDOR                                        │
│                                                                      │
│  trade_marketplace_actors                                            │
│    ├── actor_type: supplier / platform / installer                   │
│    ├── estado: pending / active / suspended                          │
│    ├── verificado: false → true (admin)                              │
│    ├── trade_marketplace_actor_members (equipo)                      │
│    ├── trade_marketplace_roles (permisos)                            │
│    ├── trade_marketplace_supplier_config (ajustes)                   │
│    ├── trade_supplier_api_credentials (API v1)                       │
│    ├── trade_catalog_imports (historial de cargas)                   │
│    └── trade_marketplace_orders (pedidos recibidos)                  │
│                                                                      │
│  supplier_catalog_id → trade_supplier_catalogs                       │
│  (FK de compatibilidad temporal; se retirará en la Fase 3)          │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.1 Flujo obligatorio en el modelo objetivo

```
PROVEEDOR
  │
  ├── Portal Proveedor (CSV o formulario)
  │     └──▶ trade_marketplace_supplier_offerings
  │
  └── Supplier API v1 (sync ERP externo)
        └──▶ trade_marketplace_supplier_offerings
                        │
                        │  Motor de matching
                        │  (candidatos por pg_trgm + validación humana o reglas estrictas)
                        ▼
        trade_marketplace_universal_products
                        │
                        │  global_catalog_id (FK)
                        ▼
        trade_global_catalog  [read-only en Fase 2, retirado en Fase 3]
                        │
                        │  Motor IA
                        ▼
        trade_quote_items ──▶ trade_marketplace_cart_items ──▶ PEDIDO
```

**Lo que NO está en este flujo:**
- `trade_supplier_products` como staging obligatorio
- `trade_supplier_catalogs` como identidad operativa
- Central de Compras como paso del flujo de compra

---

## 3. Política de deprecación de tablas legacy

### 3.1 `trade_global_catalog` — Base maestra del Motor IA

**Rol actual:** Fuente de verdad de productos para el Motor IA (presupuestos). 921 registros activos.  
**Dependencias en código:** Motor IA, función `search_global_catalog`, autocompletado de líneas de presupuesto.

| Fase | Acción | Cuándo |
|------|--------|--------|
| **Fase 1** (hoy) | Sigue siendo la fuente operativa del Motor IA. Se añade `global_catalog_id` como FK en los UPs creados. | Ahora |
| **Fase 2** (3–6 m) | El Motor IA lee UPs cuando `global_catalog_id` tiene UP asociado; cae a `global_catalog` si no. Lógica de fallback. | Tras piloto UP aprobado |
| **Fase 3** (9–12 m) | El Motor IA lee exclusivamente de `trade_marketplace_universal_products`. `trade_global_catalog` queda frozen (no recibe escrituras). | Tras cobertura UP ≥ 80 % del catálogo activo |
| **Retirada** (12+ m) | `trade_global_catalog` se convierte en tabla de archivo. No se elimina (referencia histórica). | Tras verificación completa |

**Cuándo deja de recibir nuevas escrituras:** Fase 3 — cuando la cobertura de UPs supera el 80 % de los productos activos del Motor IA.

**Conversión en vista:** No se convierte en vista; se mantiene como tabla con restricción `NO INSERT/UPDATE via application`. Los scripts de migración histórica pueden leer de ella.

---

### 3.2 `trade_supplier_catalogs` — Registro de identidad legacy

**Rol actual:** Identity record del proveedor. 8 tablas apuntan a ella vía FK.  
**Dependencias en código:** Central de Compras (ScreenCatalog, selector de proveedor), admin de proveedores, `trade_compras`, `trade_supplier_orders`, `trade_org_suppliers`.

| Fase | Acción | Cuándo |
|------|--------|--------|
| **Fase 1** (hoy) | Se usa como identidad de proveedor en ambos sistemas via `supplier_catalog_id`. No se crean nuevas entradas para proveedores que solo participen en el Marketplace. | Ahora |
| **Fase 2** (3–6 m) | Los nuevos proveedores del Marketplace se crean SOLO en `trade_marketplace_actors`. Si el proveedor también aparece en Central de Compras, se crea una entrada en `trade_supplier_catalogs` automáticamente como efecto secundario (no como paso manual). | Tras piloto Saltoki/Sonepar |
| **Fase 3** (9–12 m) | `trade_supplier_catalogs` se congela: no recibe nuevas escrituras directas. Central de Compras lee desde una vista `v_supplier_catalogs` que combina datos de `trade_supplier_catalogs` (legacy) y `trade_marketplace_actors` (nuevos). | Tras migración ERP proveedores |
| **Retirada** (12+ m) | `trade_supplier_catalogs` se convierte en vista de lectura sobre `trade_marketplace_actors`. Las columnas legacy que no existen en actors (e.g., `margen_pct_default`, `prioridad`) se mueven a `trade_marketplace_supplier_config`. | Cuando Central de Compras esté refactorizado |

**Cuándo deja de recibir nuevas escrituras:** Fase 3.  
**Vista de compatibilidad:** `v_supplier_catalogs` — devuelve filas de `trade_supplier_catalogs` union con actores nuevos formateados igual.

---

### 3.3 `trade_supplier_products` — Productos legacy de catálogo ERP

**Rol actual:** 891 productos importados de 13 proveedores. Staging de la Central de Compras.  
**Dependencias en código:** Central de Compras (listado de productos por catálogo), `ScreenCatalog`.

| Fase | Acción | Cuándo |
|------|--------|--------|
| **Fase 1** (hoy) | Se usa **una sola vez** como fuente de migración para el piloto (datos de prueba existentes). No es staging en el flujo futuro. | Migración piloto |
| **Fase 2** (3–6 m) | Los nuevos proveedores con actor Marketplace suben catálogos vía Portal o API → directamente a `supplier_offerings`. `trade_supplier_products` no recibe nuevas filas para estos actores. | Tras piloto Saltoki/Sonepar |
| **Fase 3** (9–12 m) | `trade_supplier_products` queda frozen. Central de Compras muestra productos desde `trade_marketplace_supplier_offerings` (con filtro por actor vinculado al catálogo legacy). | Tras refactor Central de Compras |
| **Retirada** (12+ m) | `trade_supplier_products` se archiva. Los datos se mantienen por referencia histórica. | Cuando ningún flujo activo la escriba |

**Cuándo deja de recibir nuevas escrituras:** Fase 2 (para proveedores con actor Marketplace). Fase 3 (para todos).

---

### 3.4 Tablas auxiliares legacy — estado a 12 meses

| Tabla | Rol actual | Destino |
|-------|-----------|---------|
| `trade_catalog_products` (136) | Catálogo personalizado por org para Motor IA | Conservar; vincular a UPs en Fase 2 |
| `trade_catalog_variants` (268) | Variantes por org | Conservar; vincular a UPs en Fase 2 |
| `trade_compras` | Órdenes de compra directas | Conservar; leer desde offerings en Fase 3 |
| `trade_supplier_orders` | Pedidos a proveedor ERP | Migrar a `trade_marketplace_orders` en Fase 3 |
| `trade_org_suppliers` | Proveedores preferidos por org | Migrar a preferencias en actor config en Fase 3 |
| `trade_supplier_choices` | Selección de proveedor en presupuesto | Conservar; vincular a offerings en Fase 2 |
| `trade_budget_catalog_lines` | Vacía — tabla nueva sin uso | Evaluar si es necesaria o retirar antes de Fase 1 |

---

## 4. Clasificación de `trade_global_catalog` antes de crear UPs

### 4.1 Taxonomía obligatoria

Antes de convertir ningún registro en UP, cada entrada de `trade_global_catalog` debe clasificarse en una de estas cinco categorías:

| Categoría | Definición | Acción |
|-----------|-----------|--------|
| **Producto universal** | Artículo físico identificable, con unidad de venta estable, que cualquier proveedor puede ofertar | Crear UP `validation_state = 'draft'` → revisión → `'validated'` |
| **Variante** | Especificación concreta de un producto más genérico (e.g., "Tubo PVC DN50 1m" es variante de "Tubo PVC") | Crear como `trade_marketplace_universal_product_variants`, no como UP independiente |
| **Partida no comercial** | Servicio, mano de obra, desplazamiento, o coste no adquirible de un proveedor | No crear UP. Conservar en `trade_global_catalog` para el Motor IA |
| **Duplicado** | Mismo producto con descripción diferente (e.g., "Grifo monomando" y "Monomando lavabo Ø12") | Fusionar bajo un único UP. Eliminar duplicado del gc tras migración |
| **Requiere revisión** | Descripción ambigua, familia incorrecta, o sin contexto suficiente | Marcar para revisión humana antes de clasificar |

### 4.2 Criterios de clasificación automática preliminar

Estos criterios generan *candidatos de clasificación*, no clasificaciones definitivas:

```
Si gc.familia ILIKE '%mano de obra%' OR '%instalación%' OR '%desplazamiento%'
  → candidato: Partida no comercial

Si gc.descripcion es substring de otro gc.descripcion con misma familia y oficio
  → candidato: Duplicado

Si gc.descripcion contiene medida específica (DN50, 1.5mm², 20W, M10)
  Y existe otro gc con misma familia sin medida
  → candidato: Variante del gc sin medida

Resto:
  → candidato: Producto universal
```

La clasificación final es responsabilidad de una persona (admin o responsable de catálogo), no del sistema.

### 4.3 Piloto: 30–50 productos de fontanería

**Antes de cualquier migración masiva:** ejecutar un piloto controlado con 30–50 registros de `trade_global_catalog` del oficio Fontanería.

**Objetivo del piloto:**
1. Validar la taxonomía de clasificación
2. Detectar qué porcentaje de gc.fontanería es partida no comercial
3. Establecer el mapa familia → categoría con precisión real
4. Validar el matching con las 213 offerings existentes de OBRAMAT Demo

**Resultado estimado original vs resultado real (MKT-FASE1-PILOT-001, 2026-08-01):**

| Clasificación | Estimación original | Resultado real (40 registros analizados) |
|--------------|--------------------|-----------------------------------------|
| Producto universal | ~60–70 | 6 (15%) |
| Variante | ~15–20 | 15 (37.5%) |
| Partida no comercial | ~10–15 | 19 (47.5%) |
| Duplicado | ~5–10 | 0 |
| Requiere revisión | ~5 | 0 (todos resueltos por decisión humana) |

**Conclusión del piloto:** el catálogo de fontanería tiene un ratio de partidas no comerciales significativamente mayor al estimado (~47% vs ~10–15%). El catálogo productizable real es más reducido por oficio. Los 40 registros del piloto cubrieron 21 gc_ids como productos/variantes del Marketplace.

### 4.4 Estado Fase 1 — MKT-FASE1-PILOT-001

**Estado:** ✅ COMPLETADO — 2026-08-01

| Métrica | Valor |
|---|---|
| UPs creados | 16 (11 genéricos padre + 5 directos) |
| Variantes creadas | 15 |
| Categoría nueva | 1 (font-acs) |
| UP actualizado | 1 (PZ-FON-001 Grifo monomando lavabo) |
| Cobertura gc (producto) | 21 / 21 (100%) |
| DDL nuevo | `global_catalog_id uuid FK` en `trade_marketplace_universal_product_variants` |
| Constraints corregidos | `uq_variant_ean` y `uq_variant_gtin` → `NULLS DISTINCT` (índices parciales `WHERE columna IS NOT NULL`) |

**Próximo paso:** MKT-FASE1-PILOT-002 — Validación funcional del puente Motor IA → UP → variante → Marketplace.

---

## 5. Protocolo de matching — sin automatismos de baja calidad

### 5.1 Lo que pg_trgm hace y no hace

`pg_trgm >= 0.6` **genera candidatos**, no determina un match. Un candidato con similitud 0.6 significa que hay similitud textual, nada más.

### 5.2 Criterios para un match automático válido

Un offering puede marcarse `match_state = 'matched'` automáticamente **solo si cumple TODOS:**

| Criterio | Requisito |
|---------|-----------|
| **Identificador estable** | EAN coincidente, o `manufacturer_ref` coincidente, o `supplier_ref` coincidente con el del UP | *O* |
| **Similitud muy alta** | pg_trgm ≥ 0.90 sobre `descripcion_comercial` vs `nombre_canonico` | |
| **Mismo oficio** | `offering.unidad` coherente con UP.unidad | ✅ Obligatorio |
| **Misma familia** | Familia del UP encaja con la del catálogo del proveedor | ✅ Obligatorio |
| **Candidato único** | La búsqueda devuelve un solo UP candidato (sin ambigüedad) | ✅ Obligatorio |
| **Atributos compatibles** | Si el UP tiene especificaciones (potencia, diámetro, material), el offering no las contradice | ✅ Obligatorio |

### 5.3 Resultado de la revisión de matching

| Resultado | match_state | Acción siguiente |
|-----------|-------------|-----------------|
| Todos los criterios cumplidos | `matched` | Disponible para el Marketplace |
| Candidato único, similitud 0.6–0.89, sin EAN | `candidate` | Revisión humana en Admin |
| Múltiples candidatos | `ambiguous` | Revisión humana en Admin |
| Ningún candidato con similitud ≥ 0.6 | `unmatched` | El proveedor puede proponer UP nuevo |
| Criterios técnicos incompatibles | `rejected` | Registrar motivo |

**`pending_review` actual (197 offerings):** Se reclasificará según estos criterios. Ninguna se marcará `matched` sin validación.

---

## 6. Saltoki y Sonepar — actores demo completos

Los proveedores demo no son solo datos. Son entornos funcionales completos para validar el flujo antes de incorporar proveedores reales.

### 6.1 Checklist de un actor demo completo

Cada uno de los dos actores debe tener:

```
☐ Actor en trade_marketplace_actors
    actor_type = 'supplier'
    estado = 'active'
    verificado = true
    logo_url, website, email_contacto

☐ Al menos 1 usuario/miembro en trade_marketplace_actor_members
    con rol 'admin_proveedor'
    con email real (cuenta de test de TrabFlow)

☐ Configuración en trade_marketplace_supplier_config
    (margen, visibilidad, settings de portal)

☐ Roles correctos en trade_marketplace_roles

☐ Mínimo 30 offerings en trade_marketplace_supplier_offerings
    con: descripcion_comercial, precio_coste, precio_venta,
         unidad, stock_disponible = true, plazo_entrega_dias ≥ 1
    sin match aún (pending_review para validar el flujo de matching)

☐ Al menos 5 offerings con match_state = 'matched'
    para que el carrito pueda encontrar proveedores

☐ Al menos 1 pedido de prueba completado de extremo a extremo
    (carrito → checkout → pedido → confirmado → preparando → enviado → entregado)

☐ Acceso al Portal Proveedor verificado
    (login, dashboard muestra KPIs, catálogo visible, pedido en historial)

☐ Credencial de Supplier API v1 creada y testeada
    (al menos 1 llamada a /catalog/products exitosa)
```

### 6.2 Procedencia de los datos de prueba

Los datos de Saltoki y Sonepar que existen en `trade_supplier_products` (170 + 76 registros) se usan **una sola vez** como fuente para poblar las offerings iniciales de estos actores demo. Es una migración puntual de datos de prueba, no un flujo recurrente.

Una vez creadas las offerings vía este import puntual, el flujo futuro para Saltoki/Sonepar (y todos los proveedores) es exclusivamente:

```
Portal Proveedor o Supplier API → supplier_offerings
```

`trade_supplier_products` no vuelve a ser fuente de datos para estos actores.

---

## 7. Impacto por módulo en la arquitectura objetivo

### 7.1 Admin Panel

**Cambios en Fase 1:**
- `AdminSuppliersSection` muestra proveedores de `trade_supplier_catalogs` (legacy) con columna "Actor Marketplace" (nullable FK). Sin reescritura de la sección.
- Nueva acción: "Habilitar en Marketplace" → crea actor en `trade_marketplace_actors`.

**Cambios en Fase 2:**
- `AdminSuppliersSection` lee desde `trade_marketplace_actors` como fuente principal.
- Proveedores legacy sin actor aparecen como "Solo Central de Compras" (read-only).

**Cambios en Fase 3:**
- `AdminSuppliersSection` lee exclusivamente de `trade_marketplace_actors` + vista `v_supplier_catalogs`.
- Gestión de Central de Compras queda como módulo separado de solo lectura.

### 7.2 Portal Proveedor

**Sin cambios estructurales en ninguna fase.** El portal ya usa `trade_marketplace_actors` como identidad.

**Mejora en Fase 2:** Dashboard muestra métricas de matching (cuántas offerings tienen UP asignado).

### 7.3 Motor IA

**Fase 1:** Sin cambios. Motor IA sigue leyendo `trade_global_catalog`.

**Fase 2:** Motor IA implementa lógica de doble lectura:
```
IF UP existe con global_catalog_id = gc.id
  THEN buscar offering vía UP
  ELSE fallback: búsqueda textual como hoy
```

**Fase 3:** Motor IA lee exclusivamente de `trade_marketplace_universal_products`. `trade_global_catalog` no recibe actualizaciones.

### 7.4 Central de Compras (módulo ERP del instalador)

**Fase 1–2:** Sigue funcionando como hoy (read/write sobre `trade_supplier_catalogs` + `trade_supplier_products`).

**Fase 3:** Central de Compras lee desde vista `v_supplier_catalogs` + `trade_marketplace_supplier_offerings`. No escribe en las tablas legacy.

**Fase 4:** Central de Compras se refactoriza como una vista del Marketplace (los proveedores preferidos del instalador son actores del Marketplace con precio especial, no entradas en `trade_supplier_catalogs`).

### 7.5 Marketplace — compra

Sin cambios en ninguna fase en el código de compra. Los cambios son de datos: más UPs → más materiales disponibles → más alternativas de proveedor → mejor estrategia del Motor IA de selección.

---

## 8. Arquitectura objetivo a 12 meses

### Diagrama final

```
                    ┌─────────────────────┐
                    │   trade_marketplace  │
                    │       _actors        │◄── Identidad de TODO proveedor
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
       Portal Proveedor   Supplier API v1   Admin (supervisado)
              │                │                │
              └────────────────┴────────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │  trade_marketplace_supplier_   │
              │        _offerings              │◄── Fuente de verdad: oferta
              └───────────────┬────────────────┘
                              │
                    Motor de matching
                    (con validación)
                              │
                              ▼
              ┌────────────────────────────────┐
              │  trade_marketplace_universal_  │
              │        _products               │◄── Fuente de verdad: catálogo
              └───────────────┬────────────────┘
                              │
                   global_catalog_id (FK)
                              │
                              ▼
              ┌────────────────────────────────┐
              │     trade_global_catalog       │◄── Archivo (frozen, lectura)
              └────────────────────────────────┘

              ┌────────────────────────────────┐
              │     trade_supplier_catalogs    │◄── Vista de compatibilidad
              └────────────────────────────────┘    (sobre trade_marketplace_actors)

              ┌────────────────────────────────┐
              │     trade_supplier_products    │◄── Archivo histórico
              └────────────────────────────────┘
```

### Tabla de estado de cada tabla a los 12 meses

| Tabla | Estado a 12 m | Escribe código activo | Rol |
|-------|--------------|----------------------|-----|
| `trade_marketplace_actors` | **Operativa** | Sí (Portal, Admin, API) | Identidad proveedor |
| `trade_marketplace_supplier_offerings` | **Operativa** | Sí (Portal, API, matching) | Catálogo ofertado |
| `trade_marketplace_universal_products` | **Operativa** | Sí (Admin, matching) | Catálogo universal |
| `trade_marketplace_categories` | **Operativa** | Sí (Admin) | Árbol de categorías |
| `trade_global_catalog` | **Frozen** (read-only) | No | Archivo, referencia histórica |
| `trade_supplier_catalogs` | **Vista** | No (vista calculada) | Compatibilidad legacy |
| `trade_supplier_products` | **Archivo** | No | Datos históricos de prueba |
| `trade_catalog_products` | **Conservada** | Sí (Motor IA, por org) | Catálogo personalizado por org |
| `trade_catalog_variants` | **Conservada** | Sí (Motor IA, por org) | Variantes por org |

---

## 9. Plan de retirada del sistema legacy — cronograma

### Fase 1: Fundación (meses 1–3, agosto–octubre 2026)

**Objetivo:** Piloto controlado. Demostrar el flujo completo con datos de calidad.

| Tarea | Tipo | Prerequisito |
|-------|------|-------------|
| Clasificar 30–50 gc.fontanería (manual) | Datos | — |
| Crear 30–50 UPs con validation_state='draft' → revisión → 'validated' | Datos | Clasificación aprobada |
| Asignar category_id manualmente a esos UPs | Datos | UPs creados |
| Revisar 213 offerings de OBRAMAT Demo → reclasificar con protocolo §5 | Datos | UPs del piloto |
| Crear actor Saltoki con checklist §6 completo | Datos + config | — |
| Crear actor Sonepar con checklist §6 completo | Datos + config | — |
| Verificar un pedido E2E con Saltoki como proveedor | QA | Actor Saltoki completo |
| Verificar un pedido E2E con Sonepar como proveedor | QA | Actor Sonepar completo |
| `trade_supplier_products`: congelar escrituras para Saltoki y Sonepar | Política | Actores creados |

**KPI de cierre de Fase 1:**
- ≥ 30 UPs validated con global_catalog_id relleno
- ≥ 3 actores Marketplace (OBRAMAT, Saltoki, Sonepar) con pedido E2E completado
- `trade_supplier_products` no recibe nuevas filas para Saltoki y Sonepar

---

### Fase 2: Expansión y desacoplamiento (meses 3–6, octubre 2026–enero 2027)

**Objetivo:** Escalar el catálogo y desacoplar el Motor IA del legacy.

| Tarea | Tipo |
|-------|------|
| Clasificar el resto de gc.fontanería + gc.electricidad (~190 registros) | Datos |
| Crear UPs para todos los productos universales clasificados | Datos |
| Motor IA implementa doble lectura (UP si existe, gc como fallback) | Código |
| Admin: vista unificada cruza actors + supplier_catalogs | Código |
| Motor de matching v1 (candidatos automáticos + cola de revisión admin) | Código |
| Nuevos proveedores: solo vía `trade_marketplace_actors` | Política |
| `trade_supplier_catalogs`: no recibe nuevas entradas directas | Política |

**KPI de cierre de Fase 2:**
- ≥ 150 UPs validated cubriendo fontanería + electricidad
- Motor IA resuelve ≥ 70 % de los presupuestos con UPs (no fallback)
- 0 nuevos proveedores creados fuera de `trade_marketplace_actors`

---

### Fase 3: Congelación legacy (meses 6–9, enero–abril 2027)

**Objetivo:** Las tablas legacy dejan de ser operativas.

| Tarea | Tipo |
|-------|------|
| `trade_global_catalog`: frozen (no recibe escrituras) | Política + trigger |
| Motor IA lee exclusivamente de UPs | Código |
| `v_supplier_catalogs`: vista calculada sobre actors | Código |
| Central de Compras refactorizada: lee offerings vía actor | Código |
| `trade_supplier_products`: frozen (trigger de bloqueo) | Política + trigger |
| `trade_supplier_orders` migrados a `trade_marketplace_orders` | Datos |

**KPI de cierre de Fase 3:**
- `trade_global_catalog.updated_at` no cambia en 30 días
- `trade_supplier_products`: 0 INSERTs en 30 días
- Central de Compras funciona 100 % sobre offerings

---

### Fase 4: Retirada (meses 9–12, abril–julio 2027)

**Objetivo:** Solo existen las tres tablas canónicas como fuente de verdad.

| Tarea | Tipo |
|-------|------|
| `trade_supplier_catalogs` convertida en vista real sobre actors | Código |
| `trade_supplier_products` movida a schema `archive` | Migracion |
| `trade_global_catalog` movida a schema `archive` | Migración |
| `trade_compras` y `trade_supplier_orders` refactorizados o retirados | Código |
| Central de Compras v2: UI completamente sobre Marketplace | Código |
| Eliminar columna `supplier_catalog_id` de `trade_marketplace_actors` | Migración |
| Eliminar FK de `trade_marketplace_supplier_offerings.supplier_catalog_id` | Migración |

**KPI de cierre de Fase 4 (= arquitectura objetivo alcanzada):**
- `trade_marketplace_actors` es la única fuente de identidad de proveedor
- `trade_marketplace_supplier_offerings` es la única fuente de catálogo ofertado
- `trade_marketplace_universal_products` es la única fuente de catálogo universal
- 0 código activo escribe en tablas del schema `archive`

---

## 10. Código que hoy depende de las tablas legacy

Para planificar la retirada es necesario saber qué código se tocará en cada fase.

### `trade_global_catalog`

| Código | Localización estimada | Fase de cambio |
|--------|----------------------|----------------|
| Motor IA — búsqueda de productos | `src/lib/api/` motor IA | Fase 2 (doble lectura) → Fase 3 (solo UPs) |
| Autocompletado de líneas de presupuesto | `src/components/presupuesto/` | Fase 2 |
| Admin — gestión del catálogo global | `src/components/admin/` | Fase 3 |

### `trade_supplier_catalogs`

| Código | Localización estimada | Fase de cambio |
|--------|----------------------|----------------|
| ScreenCatalog (Central de Compras) | `src/components/` | Fase 3 |
| Selector de proveedor en presupuesto | `src/components/presupuesto/` | Fase 2 |
| Admin — gestión de proveedores | `src/components/admin/AdminSuppliersSection` | Fase 2 (vista unificada) |
| `trade_compras` y `trade_supplier_orders` | ERP compras | Fase 3 |

### `trade_supplier_products`

| Código | Localización estimada | Fase de cambio |
|--------|----------------------|----------------|
| ScreenCatalog — listado de productos por catálogo | `src/components/` | Fase 3 |
| (No existen rutas de escritura en código activo conocidas; los 891 productos actuales son de test) | — | — |

---

## 11. Riesgos y mitigación

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|--------|-------------|---------|------------|
| R1 | El piloto de 30–50 UPs revela que el ratio de partidas no comerciales es mucho mayor de lo esperado | Media | Medio | El piloto existe precisamente para medir esto; si ocurre, se revisa el catálogo antes de escalar |
| R2 | Central de Compras deja de funcionar al congelar `trade_supplier_catalogs` | Baja | Alto | La vista `v_supplier_catalogs` debe estar operativa **antes** de congelar la tabla |
| R3 | Motor IA empeora precisión al cambiar de `global_catalog` a UPs | Media | Alto | El modo fallback de Fase 2 garantiza que no hay regresión; KPI de benchmark antes/después |
| R4 | Saltoki o Sonepar demo no tienen precio_venta en sus ERP products | Alta | Bajo | `precio_venta` es nullable; el admin puede rellenarlo manualmente antes de activar |
| R5 | La retirada de FKs (Fase 4) rompe tablas que no se han detectado | Baja | Alto | Ejecutar `EXPLAIN` sobre todas las queries activas antes de eliminar FKs |
| R6 | Los proveedores reales (cuando lleguen) no quieren usar Portal ni API | Media | Medio | La Supplier API v1 permite integración con cualquier ERP externo sin tocar la UI |
| R7 | El motor de matching (Fase 2) produce matches incorrectos masivos | Media | Alto | Matching automático solo bajo criterios §5; todos los matches auto son revisables por admin |

---

## 12. Rollback por fase

| Fase | Cómo revertir |
|------|--------------|
| Fase 1 — UPs del piloto | `DELETE FROM trade_marketplace_universal_products WHERE origen = 'pilot_2026_08'` |
| Fase 1 — Actores Saltoki/Sonepar | `UPDATE trade_marketplace_actors SET estado = 'suspended'`; los datos se mantienen |
| Fase 2 — Motor IA doble lectura | Feature flag en configuración del motor; reverter a lectura exclusiva de gc |
| Fase 2 — Congelación de supplier_catalogs nuevas entradas | Revertir trigger de bloqueo |
| Fase 3 — Frozen legacy | Revertir triggers de bloqueo; el schema de archivo es reversible |
| Fase 4 — Eliminación de FKs | Las FKs se eliminan solo tras verificación en staging; rollback disponible 30 días |

---

## 13. Lo que esta arquitectura NO incluye

| Exclusión | Razón |
|-----------|-------|
| Stripe Connect (comisiones) | Post-pilotos comerciales; arquitectura no lo impide |
| Browse UI para compradores | Fase 3 de producto (catálogo libre); no afecta a las tablas de esta arquitectura |
| Motor de matching con IA/ML | El protocolo de matching de §5 es suficiente para pilotos; el motor avanzado es Sprint 2+ |
| Multi-org para proveedores | Un actor puede tener múltiples miembros; la multi-tenancy está cubierta |
| Ratings y valoraciones de offerings | No en el modelo de datos actual; futuro |

---

## 14. Criterio de aprobación de cada fase

Antes de iniciar cada fase, el responsable del proyecto debe verificar:

**Antes de Fase 1:**
- [ ] Clasificación de 30–50 gc.fontanería completada y revisada
- [ ] Mapa familia → categoría validado manualmente
- [ ] Checklist de actor demo definido y acordado

**Antes de Fase 2:**
- [ ] Piloto Fase 1: ≥ 30 UPs validated, ≥ 3 actores con pedido E2E
- [ ] Definición del benchmark del Motor IA (línea base antes de doble lectura)
- [ ] Vista `v_supplier_catalogs` testeada en staging

**Antes de Fase 3:**
- [ ] Motor IA resuelve ≥ 70 % con UPs (benchmark Fase 2 superado)
- [ ] Central de Compras refactorizada y testeada en staging
- [ ] 0 código activo con INSERT directo a `trade_global_catalog`

**Antes de Fase 4:**
- [ ] Auditoría de FKs activas en tablas que se retiran
- [ ] Plan de comunicación a usuarios de Central de Compras
- [ ] Schema `archive` creado y testeado

---

*Versión 2.0 — 2026-08-01*  
*Supersede v1.0 del mismo día*  
*Próxima revisión: al cerrar Fase 1 del piloto*
