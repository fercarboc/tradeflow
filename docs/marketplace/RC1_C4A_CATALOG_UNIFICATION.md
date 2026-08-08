# RC1-C.4A — Unificación catálogo Presupuestos ↔ Marketplace

**Estado:** ANÁLISIS — pendiente de aprobación de datos antes de implementar  
**Versión:** 1.0 — 2026-08-08

---

## 1. Diagnóstico: fuentes actuales de producto

### 1.1 Cómo se construye un presupuesto hoy

```
Usuario habla (voz o texto)
       ↓
Motor IA (Claude Haiku)
       ↓ analiza la obra
       ↓ genera partidas con:
         - descripcion (texto libre)
         - tipo (material / mano_obra)
         - familia (si la infiere)
         - supplier_key / supplier_name (si tiene contexto)
         - precio_material / precio_unitario
         - universal_product_id = NULL
       ↓
trade_quote_items
```

**Hallazgo crítico:** `trade_quote_items.universal_product_id` es `NULL` en todos los items de los presupuestos demo. El motor IA genera texto libre, no consulta el catálogo Marketplace al crear partidas.

### 1.2 Cómo se construye un carrito hoy

```
Comprar materiales
       ↓
create_cart_from_quote(quote_id)
       ↓ SQL function:
         - itera trade_quote_items donde tipo='material' AND qty>0
         - intenta match UP por texto (búsqueda full-text / admin-config)
         - si match → asigna universal_product_id + auto-selecciona offering
         - si no match → crea cart_item sin UP ni offering
       ↓
trade_marketplace_cart_items
  ├── UP matched: up_match_method='admin', confidence=0.9
  └── UP no matched: universal_product_id=NULL, selected_offering_id=NULL
```

El match ocurre **en el momento de crear el carrito**, no cuando se genera el presupuesto. Esto crea una desconexión: el instalador ve un precio en el presupuesto pero no sabe si ese producto tiene proveedor Marketplace hasta que pulsa "Comprar materiales".

### 1.3 Fuentes de datos identificadas

| Fuente | Tabla / Mecanismo | Uso actual |
|--------|------------------|------------|
| Motor IA (Haiku) | Generación en runtime | Genera partidas con descripciones libres y precios estimados |
| Base de referencia IA | `trade_ai_feedback`, `trade_catalog_products` | Precios históricos aprendidos |
| Catálogos legacy | `trade_supplier_catalogs` | Importación masiva de referencias de proveedor |
| Producto Universal | `trade_marketplace_universal_products` | 35 UPs activos con ofertas |
| Variantes | No existe tabla de variantes con nombre distinto | Fusionadas en offering |
| Offerings | `trade_marketplace_supplier_offerings` | Precio profesional real por proveedor |
| Matching text→UP | `create_cart_from_quote` SQL + admin-config | Solo se ejecuta al crear carrito |
| Precios presupuesto | Generados por IA con contexto de OBRAMAT | No se consulta offering real |

### 1.4 Inventario de UPs activos (35 total)

| Familia | UPs | Con offerings | Sin offerings |
|---------|-----|--------------|---------------|
| Accesorios | 2 | 1 | 1 |
| Baño | 2 | 2 | 0 |
| Cables y Conductores | 1 | 1 | 0 |
| Carpintería | 3 | 3 | 0 |
| Desagüe | 2 | 1 | 1 |
| Electricidad | 1 | 1 | 0 |
| Grifería | 5 | 3 | 2 |
| Iluminación | 1 | 1 | 0 |
| Impermeabilización | 1 | 1 | 0 |
| Mecanismos | 1 | 1 | 0 |
| Morteros y Cementos | 2 | 2 | 0 |
| Pintura | 2 | 2 | 0 |
| Revestimientos | 2 | 2 | 0 |
| Saneamiento | 1 | 1 | 0 |
| Sanitarios | 4 | 2 | 2 |
| Tubería | 4 | 1 | 3 |
| Válvulas | 2 | 2 | 0 |
| **TOTAL** | **35** | **27** | **8** |

### 1.5 Actores Marketplace activos

| Actor | Offerings | Familias cubiertas |
|-------|-----------|-------------------|
| OBRAMAT Demo | 225 | Accesorios, Baño, Desagüe, Electricidad, Grifería, Iluminación, Impermeabilización, Morteros, Pintura, Saneamiento, Sanitarios, Tubería, Válvulas |
| Suministros Técnicos Norte | 15 | Baño, Cables, Desagüe, Electricidad, Grifería, Mecanismos, Sanitarios, Válvulas |
| ElectroSuministros Cantábrico | 4 | Cables, Electricidad, Iluminación, Mecanismos |
| Revestimientos y Obra Norte | 5 | Impermeabilización, Morteros, Revestimientos |
| Pinturas Profesionales Norte | 2 | Pintura |
| Carpintería y Cerramientos Norte | 3 | Carpintería |
| TrabFlow (plataforma) | 0 | — |

---

## 2. Regla arquitectónica aprobada

```
Producto Universal
        ↓
Offering de proveedor (activa + matched + venta_profesional_habilitada)
        ↓
eligible_for_professional_procurement = true
        ↓
   Marketplace          Motor IA              Presupuestos
   Catálogo        →   candidatos         →   selector productos
   Carrito         →   auto-selección     →   precio real
   Pedido          ←   confirmación       ←   confirmación
```

**Invariancia:**  
`offering.activa = true AND offering.match_state = 'matched' AND actor.estado = 'active' AND offering.venta_profesional_habilitada = true`  
→ ese producto aparece automáticamente en Marketplace, selector de presupuestos y motor IA.  
**No requiere segunda publicación manual.**

---

## 3. Tres categorías de producto

### MARKETPLACE
- Existe offering activa y matched para este producto
- El instalador puede añadirlo al carrito directamente
- El precio del presupuesto debe reflejar el PVD del proveedor + margen instalador
- En presupuesto: badge verde `✓ Disponible en Marketplace · PROVEEDOR · Xd`

### EXTERNAL
- Producto/proveedor que el instalador conoce pero que no opera en TrabFlow
- `supplier_key` distinto a actores Marketplace, o campo explícito `external_supplier`
- En presupuesto: badge azul `Proveedor externo · gestión manual`
- En carrito: no aparece como línea comprable; se muestra en sección separada

### UNRESOLVED
- Material necesario para el trabajo, sin producto comercial seleccionado aún
- `universal_product_id = NULL` y sin `supplier_key` válido
- En presupuesto: badge ámbar `Sin proveedor seleccionado`
- En carrito: aparece en `UnresolvedLinesPanel`

---

## 4. Problema actual: el motor IA no consulta el catálogo Marketplace

### Flujo actual (roto)

```
IA genera → descripcion libre → presupuesto → precio estimado
                                                     ↓ (desconexión)
                                             Marketplace → match en runtime
```

### Flujo objetivo

```
IA recibe descripcion → consulta resolve_quote_material_candidates()
                              ↓
                  candidatos con offering_id, actor, precio profesional
                              ↓
                  selecciona mejor candidato (Marketplace > External > Estimado)
                              ↓
                  guarda universal_product_id en trade_quote_items
                              ↓
              presupuesto muestra precio real + badge de estado
                              ↓
          create_cart_from_quote lee universal_product_id → no necesita match
```

---

## 5. Función propuesta: resolve_quote_material_candidates

### Signatura

```typescript
// src/lib/api/marketplace-resolve.ts

interface QuoteMaterialCandidate {
  universal_product_id:  string;
  up_nombre:             string;
  up_familia:            string;
  variant_id:            string | null;
  offering_id:           string;
  actor_id:              string;
  supplier_name:         string;
  professional_price:    number;
  stock_disponible:      boolean;
  delivery_days:         number;
  marketplace_status:    'marketplace' | 'external' | 'unresolved';
  source_type:           'offering' | 'catalog_legacy' | 'ai_estimated';
  match_confidence:      number;
  warning:               string | null;
}

async function resolveQuoteMaterialCandidates(
  descripcion: string,
  familia:     string | null,
  oficio:      string | null,
  orgId:       string,
): Promise<QuoteMaterialCandidate[]>
```

### Lógica de ranking

```sql
-- Pseudo-código de la query SQL
SELECT candidates ORDER BY
  -- 1. Estado Marketplace primero
  CASE marketplace_status WHEN 'marketplace' THEN 0 WHEN 'external' THEN 1 ELSE 2 END,
  -- 2. Dentro de Marketplace: por relevancia técnica
  match_confidence DESC,
  -- 3. Proveedor con relación previa con la org (historial de pedidos)
  has_prior_relationship DESC,
  -- 4. Stock disponible
  stock_disponible DESC,
  -- 5. Plazo de entrega
  delivery_days ASC,
  -- 6. Precio profesional
  professional_price ASC
```

---

## 6. Cambios necesarios en el motor de presupuestos

### 6.1 Al generar partidas (sin modificar todavía)

Después del análisis IA, llamar `resolveQuoteMaterialCandidates()` y:
1. Si hay candidato Marketplace con confianza > 0.7 → asignar `universal_product_id`, `supplier_key = actor_slug`
2. Si hay candidato externo → `supplier_key = 'external'`, `supplier_name = nombre`
3. Si no hay candidato → dejar como UNRESOLVED

### 6.2 En create_cart_from_quote (sin modificar todavía)

Si `quote_item.universal_product_id IS NOT NULL`:
- No hacer text-match — usar el UP almacenado directamente
- Buscar offering activa del UP con mejor precio/plazo
- Beneficio: 0 texto-matching frágil, resultados predecibles

---

## 7. UI en Presupuesto (spec)

```
┌── MATERIAL ──────────────────────────────────────────────────┐
│  Plato de ducha (70x70 cm)                     1 ud   269 € │
│  ✓ Marketplace  OBRAMAT Demo  3d entrega                     │
└──────────────────────────────────────────────────────────────┘

┌── MATERIAL ──────────────────────────────────────────────────┐
│  Grifería de ducha monomando                   1 ud    45 € │
│  ✓ Marketplace  Suministros Técnicos Norte  2d               │
└──────────────────────────────────────────────────────────────┘

┌── MATERIAL ──────────────────────────────────────────────────┐
│  Sifón y válvula desagüe ducha                 1 ud    22 € │
│  ⚠ Proveedor externo · gestión manual                       │
└──────────────────────────────────────────────────────────────┘

┌── MATERIAL ──────────────────────────────────────────────────┐
│  Pequeño material y accesorios                 1 ud     7 € │
│  ○ Sin proveedor seleccionado · precio estimado              │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. Regla de precios

| Tipo | Precio en presupuesto | Etiqueta |
|------|----------------------|---------|
| MARKETPLACE | PVD proveedor × (1 + margen instalador) | Precio confirmado |
| EXTERNAL | Precio acordado con proveedor | Precio externo |
| UNRESOLVED | Estimación del motor IA | Precio estimado |

El precio del presupuesto que ve el cliente siempre incluye el margen del instalador. El PVD (precio profesional del proveedor) es interno.

---

## 9. Regla de onboarding de proveedor (invariancia futura)

```
Proveedor registrado en TrabFlow
    ↓ importa catálogo
    ↓ matching UP (manual o IA)
    ↓ offering.match_state = 'matched'
    ↓ offering.activa = true
    ↓ actor.estado = 'active'
    ↓ offering.venta_profesional_habilitada = true
    
→ AUTOMÁTICAMENTE disponible en:
   • Marketplace (catálogo + carrito)
   • Motor IA de presupuestos (candidatos)
   • Selector manual de productos en presupuesto
   • Comparador de proveedores
   • Creación de pedidos

No se requiere ningún paso adicional de "publicación en presupuestos".
```

---

## 10. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Motor IA genera precios distintos a los de offering real | Alta | Media | Mostrar siempre el precio de la offering; el precio IA es solo estimado inicial |
| Match UP erróneo silencioso (ej: "Grifo ducha" → "Grifo lavabo") | Media | Media | `match_confidence` visible en admin; validación humana antes de matched→active |
| create_cart_from_quote rompe si UP cambia de offering | Baja | Alta | Guardar offering_id en quote_item solo como sugerencia, no como hard-link |
| Proveedor desactiva offering después de que el presupuesto fue enviado | Baja | Alta | Al crear carrito: si offering inactiva → crear cart_item UNRESOLVED, no error |

---

## 11. Orden de ejecución propuesto

```
FASE 0 (ya completada): Auditoría — este documento
FASE 1: Gap matrix + plan de offerings demo (RC1_C4A_QUOTE_MARKETPLACE_GAP_MATRIX.md)
FASE 2: Aprobar offerings demo → insertar con match_state='pending_review'
FASE 3: Aprobación humana → matched
FASE 4: Verificar mejora de cobertura en demo
FASE 5: Diseñar resolve_quote_material_candidates()
FASE 6: Implementar en motor IA (post-pilotos comerciales)
```

**STOP después de FASE 1 para aprobación.**
