# RC1-C.4A — Arquitectura: selector de productos en presupuesto

**Estado:** DISEÑO — pendiente de aprobación antes de implementar  
**Versión:** 1.0 — 2026-08-08

---

## 1. Problema que resuelve

Hoy el presupuesto y el Marketplace son mundos separados:

```
Presupuesto                    Marketplace
───────────                    ───────────
descripcion: texto libre       UPs con offerings reales
precio: estimado IA            precio: PVD proveedor
proveedor: texto libre         actor: entidad verificada
universal_product_id: NULL     —
        ↑
        gap — ningún vínculo hasta "Comprar materiales"
```

La función `resolve_quote_material_candidates()` cierra este gap. Se llama al generar o editar un ítem del presupuesto y devuelve candidatos Marketplace ordenados, permitiendo que el motor IA o el instalador elijan el mejor antes de que el presupuesto se envíe.

---

## 2. Flujo objetivo

```
Instalador describe obra
        ↓
Motor IA genera partidas materiales
        ↓
Para cada ítem tipo 'material':
  resolve_quote_material_candidates(descripcion, familia, orgId)
        ↓
  ┌─────────────────────────────────────────────┐
  │ candidatos: Marketplace > External > Estimated│
  └─────────────────────────────────────────────┘
        ↓
  IA selecciona candidato con confidence > 0.7
  si no → deja UNRESOLVED
        ↓
  guarda en trade_quote_items:
    universal_product_id = candidato.universal_product_id
    selected_offering_id = candidato.offering_id (sugerencia)
    supplier_key = candidato.actor_id
    marketplace_status = 'marketplace' | 'external' | 'unresolved'
        ↓
Presupuesto muestra estado por ítem
        ↓
Instalador puede sobrescribir manualmente
        ↓
"Comprar materiales"
  → create_cart_from_quote usa universal_product_id existente
  → NO necesita text-matching
```

---

## 3. Función TypeScript: resolveQuoteMaterialCandidates

### 3.1 Tipo de retorno

```typescript
// src/lib/api/marketplace-resolve.ts

export type MarketplaceStatus = 'marketplace' | 'external' | 'unresolved';

export interface QuoteMaterialCandidate {
  universal_product_id: string;
  up_nombre:            string;
  up_familia:           string;
  up_subfamilia:        string | null;
  up_unidad:            string;

  offering_id:          string;
  actor_id:             string;
  actor_nombre:         string;
  actor_slug:           string;

  professional_price:   number;
  pvp:                  number | null;
  unidad:               string;
  stock_disponible:     boolean;
  stock_cantidad:       number | null;
  delivery_days:        number;

  marketplace_status:   MarketplaceStatus;
  source_type:          'offering' | 'catalog_legacy' | 'ai_estimated';
  match_confidence:     number;        // 0..1
  match_method:         'text' | 'alias' | 'family' | 'ai' | 'admin';
  warning:              string | null; // ej: "match parcial: grifo lavabo ≠ grifo ducha"
}
```

### 3.2 Signatura

```typescript
export async function resolveQuoteMaterialCandidates(params: {
  descripcion: string;
  familia:     string | null;
  subfamilia:  string | null;
  unidad:      string | null;
  orgId:       string;
  maxResults?: number; // default: 5
}): Promise<QuoteMaterialCandidate[]>
```

### 3.3 Implementación interna

```typescript
// Estrategia en tres pasos:

// Paso 1: Full-text search en UPs por descripcion + aliases
const upCandidates = await supabase.rpc('search_universal_products', {
  query_text: descripcion,
  familia_filter: familia ?? null,
  max_results: 10,
});

// Paso 2: Para cada UP candidato, obtener mejor offering activa
const withOfferings = await Promise.all(
  upCandidates.data.map(up => getBestOffering(up.id, orgId))
);

// Paso 3: Ranking y formato
return withOfferings
  .filter(Boolean)
  .sort(rankingComparator)
  .slice(0, params.maxResults ?? 5);
```

### 3.4 Función SQL: search_universal_products

```sql
CREATE OR REPLACE FUNCTION public.search_universal_products(
  query_text     text,
  familia_filter text DEFAULT NULL,
  max_results    int  DEFAULT 10
)
RETURNS TABLE(
  up_id           uuid,
  nombre          text,
  familia         text,
  match_score     float,
  match_method    text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.nombre,
    p.familia,
    ts_rank(
      to_tsvector('spanish', p.nombre || ' ' || coalesce(p.descripcion, '') || ' ' || coalesce(array_to_string(p.search_aliases, ' '), '')),
      plainto_tsquery('spanish', query_text)
    ) AS score,
    'text'::text AS method
  FROM public.trade_marketplace_universal_products p
  WHERE
    p.activo = true
    AND (familia_filter IS NULL OR p.familia ILIKE '%' || familia_filter || '%')
    AND (
      to_tsvector('spanish', p.nombre || ' ' || coalesce(p.descripcion, '') || ' ' || coalesce(array_to_string(p.search_aliases, ' '), ''))
      @@ plainto_tsquery('spanish', query_text)
    )
  ORDER BY score DESC
  LIMIT max_results;
END;
$$;
```

**Nota:** Requiere columna `search_aliases text[]` en `trade_marketplace_universal_products`.  
Si no existe: `ALTER TABLE trade_marketplace_universal_products ADD COLUMN IF NOT EXISTS search_aliases text[] DEFAULT '{}';`

---

## 4. Persistencia en trade_quote_items

### 4.1 Campos necesarios (algunos pueden no existir aún)

```sql
-- Verificar qué columnas existen ya:
SELECT column_name 
FROM information_schema.columns
WHERE table_name = 'trade_quote_items';

-- Campos a añadir si no existen:
ALTER TABLE public.trade_quote_items
  ADD COLUMN IF NOT EXISTS universal_product_id uuid REFERENCES public.trade_marketplace_universal_products(id),
  ADD COLUMN IF NOT EXISTS suggested_offering_id uuid REFERENCES public.trade_marketplace_supplier_offerings(id),
  ADD COLUMN IF NOT EXISTS marketplace_status text DEFAULT 'unresolved'
    CHECK (marketplace_status IN ('marketplace', 'external', 'unresolved')),
  ADD COLUMN IF NOT EXISTS match_confidence float,
  ADD COLUMN IF NOT EXISTS match_method text;
```

### 4.2 Invariante de integridad

```
marketplace_status = 'marketplace' ↔ universal_product_id IS NOT NULL AND suggested_offering_id IS NOT NULL
marketplace_status = 'external'    ↔ supplier_key IS NOT NULL (proveedor externo conocido)
marketplace_status = 'unresolved'  ↔ sin UP ni proveedor externo
```

---

## 5. UI de selección de producto en presupuesto

### 5.1 Vista de ítem (badge de estado)

```
┌── MATERIAL ───────────────────────────────────────────────────────────────────┐
│  [====] Plato de ducha (70x70 cm)                          1 ud     269.00 € │
│  ┌─ ✓ Marketplace ─────────────────────────────────────────────────────────┐  │
│  │  OBRAMAT Demo · ref OBR-PLT-1234 · PVD 189€ + 30% margen · 3d entrega  │  │
│  └────────────────────────────────────────────────────────── [Cambiar ↓]  ┘  │
└───────────────────────────────────────────────────────────────────────────────┘

┌── MATERIAL ───────────────────────────────────────────────────────────────────┐
│  [====] Impermeabilización zona ducha                       1 ud      38.00 € │
│  ┌─ ⚠ Sin proveedor ──────────────────────────────────────────────────────┐  │
│  │  Precio estimado. [Ver candidatos (2)] →                               │  │
│  └──────────────────────────────────────────────────────────────────────  ┘  │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Panel de candidatos (dropdown o modal)

```
┌── Seleccionar proveedor para "Impermeabilización zona ducha" ──────────┐
│                                                                         │
│  ○  ✓ Membrana impermeabilizante líquida                                │
│     OBRAMAT Demo                                                        │
│     PVD 22€/kg · Stock disponible · 3d · Confianza: 82%               │
│                                                                         │
│  ○  ✓ Membrana impermeabilizante líquida                                │
│     Revestimientos y Obra Norte                                          │
│     PVD 19€/kg · Stock disponible · 5d · Confianza: 82%               │
│                                                                         │
│  ○  Sin proveedor Marketplace (gestión manual)                          │
│                                                                         │
│                              [Confirmar selección]                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Reglas de precio tras selección

Cuando el instalador confirma un candidato Marketplace:
1. `precio_material` del ítem se actualiza a `offering.precio_profesional × (1 + margen_org)`
2. El margen de la org se lee de `trade_organizations.default_material_margin` (o 30% por defecto)
3. El precio en el PDF del presupuesto refleja este valor actualizado
4. El cliente nunca ve el PVD — solo el precio final

---

## 6. Cómo mejora create_cart_from_quote

Tras implementar los pasos anteriores, `create_cart_from_quote` puede simplificarse:

### Antes (actual)
```sql
-- Busca match UP por texto para cada ítem
-- Frágil: "baldosas y alicatado" no matchea "Azulejo rectificado pared"
-- Resultado: 11% de cobertura
```

### Después (objetivo)
```sql
-- Si quote_item.universal_product_id IS NOT NULL → usar directamente
-- Si NULL → intentar text-match como fallback de seguridad
-- Resultado: >85% de cobertura (el match ya fue resuelto al generar presupuesto)

FOR item IN SELECT * FROM trade_quote_items 
  WHERE presupuesto_id = p_quote_id 
  AND tipo = 'material' 
  AND cantidad > 0
LOOP
  IF item.universal_product_id IS NOT NULL THEN
    -- Camino nuevo: UP ya resuelto — buscar mejor offering activa
    SELECT INTO v_offering_id id
    FROM trade_marketplace_supplier_offerings
    WHERE universal_product_id = item.universal_product_id
      AND activa = true
      AND venta_profesional_habilitada = true
    ORDER BY precio_profesional ASC
    LIMIT 1;
  ELSE
    -- Camino legacy: text-match como fallback
    v_offering_id := match_up_by_text(item.descripcion);
  END IF;

  INSERT INTO trade_marketplace_cart_items (...) VALUES (...);
END LOOP;
```

---

## 7. Tratamiento de cada categoría en el flujo completo

### MARKETPLACE

```
Presupuesto → badge verde → precio real (PVD + margen)
Carrito     → ítem con offering → añade al carrito normal
Checkout    → línea confirmada con precio garantizado por proveedor
Pedido      → proveedor recibe alerta → suministra → instalador confirma entrega
```

### EXTERNAL

```
Presupuesto → badge azul → precio acordado con proveedor externo
Carrito     → NO aparece en líneas comprables
            → aparece en sección "Materiales a gestionar manualmente"
Checkout    → no afecta al pedido TrabFlow
Pedido      → no genera pedido de proveedor (el instalador lo gestiona fuera)
```

### UNRESOLVED

```
Presupuesto → badge ámbar → precio estimado IA
Carrito     → aparece en UnresolvedLinesPanel
            → chip "Buscar [descripción]" → precarga búsqueda
Checkout    → no bloquea checkout (puede comprar lo resuelto + buscar lo no resuelto)
Pedido      → no genera línea de pedido
```

---

## 8. Fases de implementación

```
FASE A — Datos (sin código nuevo):
  • Añadir search_aliases a UPs existentes
  • Crear offerings faltantes (ver RC1_C4A_DEMO_OFFERINGS_PLAN.md)
  • Verificar cobertura demo

FASE B — SQL:
  • ADD COLUMN search_aliases, marketplace_status, match_confidence a trade_quote_items
  • CREATE FUNCTION search_universal_products()
  • Actualizar create_cart_from_quote para preferir UP almacenado

FASE C — TypeScript:
  • src/lib/api/marketplace-resolve.ts (resolveQuoteMaterialCandidates)
  • getBestOffering(), rankingComparator()
  • Tests unitarios (jest)

FASE D — Motor IA:
  • Modificar trade-ai-presupuestos Edge Function
  • Llamar resolveQuoteMaterialCandidates para cada ítem material
  • Seleccionar candidato > 0.7 confianza automáticamente
  • Actualizar quote_items con UP + status

FASE E — UI Presupuesto:
  • Badge MARKETPLACE / EXTERNAL / UNRESOLVED por ítem
  • Panel de candidatos (dropdown al pulsar "Cambiar")
  • Actualización de precio al confirmar candidato

NOTA: Solo FASE A no requiere aprobación de código.
      FASES B-E son post-pilotos comerciales.
```

---

## 9. Riesgos técnicos específicos

| Riesgo | Detalle | Mitigación |
|--------|---------|------------|
| UP incorrecto guardado en quote_item | Si IA falla match, UP erróneo queda persistido | `match_confidence` visible en admin + validación humana para confianza < 0.8 |
| Offering desactivada entre presupuesto y pedido | Proveedor da de baja producto después de enviar presupuesto | create_cart_from_quote → si offering inactiva → UNRESOLVED, no error |
| Presupuestos existentes con UP null | Al abrir presupuesto antiguo, up_match no se re-ejecuta automáticamente | Mostrar botón "Actualizar precios de materiales" en ScreenPresupuesto |
| text-search en español | PostgreSQL full-text con configuración 'spanish' puede fallar con términos técnicos | Añadir trigramas (pg_trgm) como fallback |
| Latencia en resolveQuoteMaterialCandidates | Si se llama para cada ítem, puede ralentizar generación de presupuesto | Llamar en paralelo (Promise.all), cachear resultados por descripción similar |

---

## 10. Métricas de éxito

| Métrica | Baseline actual | Objetivo FASE A | Objetivo FASES B-E |
|---------|----------------|-----------------|-------------------|
| Cobertura demo (items matcheados / items material) | 11% | 67% | 85% |
| quote_items con universal_product_id | 0% | 0% (sin cambio FASE A) | 80% |
| Presupuestos donde "Comprar materiales" abre >50% ítems en carrito | 1/3 (33%) | 2/3 (67%) | 3/3 (100%) |
| Precio en presupuesto = precio en offering (sin divergencia) | ~0% | ~0% | ~85% |
