# PRE-RC1 — Resultados de Importación STN: 12 Offerings de Fontanería

**Versión:** 1.0  
**Fecha:** 2026-08-03  
**Import ID:** `d82b640d-b3e2-4946-9901-6b4fd28f4948`  
**Idempotency-Key:** `PRE-RC1-STN-import-001`  
**Estado:** COMPLETADO y VALIDADO (P2.6)

---

## 1. Resumen del import

| Métrica | Valor |
|---|---|
| Proveedor | Suministros Técnicos Norte S.L. |
| Catálogo ID | `1aec572f-d22c-4556-9fbf-315ec7b3ba02` |
| Actor ID | `aeca7bac-f559-4e01-8ba4-7fd1b7aae9b9` |
| Método | Supplier API v1 (`POST /catalog/upsert`) |
| Recibidos | 12 |
| Insertados | 12 |
| Actualizados | 0 |
| Rechazados | 0 |
| Errores | 0 |
| match_state inicial | `pending_review` (todos) |
| Timestamp | 2026-08-03 19:33:38 UTC |

---

## 2. Catálogo importado

### Grifería (3 artículos)

| Ref. STN | Descripción | Precio coste | Precio venta | Stock | Plazo |
|---|---|---|---|---|---|
| STN-FON-001 | Grifo monomando lavabo caño alto cromado | €43.50 | €50.90 | ✅ | 2 días |
| STN-FON-002 | Grifo monomando lavabo caño bajo cromado | €36.50 | €42.70 | ✅ | 2 días |
| STN-FON-004 | Grifo monomando ducha empotrado cromado | €85.00 | €98.60 | ✅ | 2 días |

### Válvulas (1 artículo)

| Ref. STN | Descripción | Precio coste | Precio venta | Stock | Plazo |
|---|---|---|---|---|---|
| STN-FON-006 | Válvula de esfera palanca 1/2" PN25 latón | €6.50 | €7.45 | ✅ | 2 días |

### Platos de ducha (3 artículos)

| Ref. STN | Descripción | Precio coste | Precio venta | Stock | Plazo |
|---|---|---|---|---|---|
| STN-FON-011 | Plato de ducha resina antideslizante 80x80 blanco | €183.00 | €215.90 | ✅ | 2 días |
| STN-FON-012 | Plato de ducha resina antideslizante 90x90 blanco | €209.00 | €246.60 | ✅ | 2 días |
| STN-FON-013 | Plato de ducha resina extraplano 120x80 blanco | €262.00 | €309.00 | ❌ sin stock | 5 días |

### Mamparas (2 artículos)

| Ref. STN | Descripción | Precio coste | Precio venta | Stock | Plazo |
|---|---|---|---|---|---|
| STN-FON-014 | Mampara de ducha angular 80x80 cristal 6mm | €238.00 | €280.80 | ✅ | 2 días |
| STN-FON-015 | Mampara de ducha frontal 120cm abatible cristal 6mm | €288.00 | €339.80 | ❌ sin stock | 4 días |

### Sanitarios (2 artículos)

| Ref. STN | Descripción | Precio coste | Precio venta | Stock | Plazo |
|---|---|---|---|---|---|
| STN-FON-016 | Inodoro compacto suspendido porcelana blanca | €189.00 | €223.00 | ✅ | 3 días |
| STN-FON-018 | Lavabo sobre encimera oval porcelana blanca | €85.00 | €99.40 | ✅ | 3 días |

### Accesorios (1 artículo)

| Ref. STN | Descripción | Precio coste | Precio venta | Stock | Plazo |
|---|---|---|---|---|---|
| STN-FON-030 | Kit desagüe plato ducha click-clack 90mm inox | €21.00 | €24.75 | ✅ | 2 días |

---

## 3. Diferenciación respecto a OBRAMAT Demo

El catálogo STN se diseñó para ser **complementario** a OBRAMAT Demo, no duplicado:

| Categoría | OBRAMAT Demo | STN |
|---|---|---|
| Griferías lavabo | Disponibles | Disponibles (alternativa de precio) |
| Griferías ducha empotrado | No disponible | STN-FON-004 |
| Válvulas de corte | No disponible | STN-FON-006 |
| Platos de ducha 80x80 | Puede existir | STN-FON-011 (precio alternativo) |
| Mamparas angulares | No disponible | STN-FON-014 |
| Mamparas frontales | No disponible | STN-FON-015 |
| Inodoros suspendidos | No disponible | STN-FON-016 |
| Lavabos encimera | No disponible | STN-FON-018 |
| Desagüe click-clack | No disponible | STN-FON-030 |

**Efecto demo buscado:** Al hacer un presupuesto de baño completo en TrabFlow, el instalador puede ver que OBRAMAT ofrece algunos materiales y STN ofrece otros (o los mismos a precio diferente). Esto demuestra el valor de la comparación de proveedores.

---

## 4. Metadata de trazabilidad

Cada offering tiene el siguiente bloque en su campo `metadata` JSONB:

```json
{
  "last_import_id":   "d82b640d-b3e2-4946-9901-6b4fd28f4948",
  "source_system":    "PRE_RC1_STN_001_DEMO",
  "synced_at":        "2026-08-03T19:33:38Z",
  "_demo":            true,
  "_dataset":         "PRE_RC1_STN_001",
  "_source":          "legacy_test_catalog",
  "_source_ref":      "SAL-FON-XXX"
}
```

El campo `_source_ref` permite rastrear el origen en el catálogo legacy de Saltoki si fuera necesario reverter o auditar.

---

## 5. Validación P2.6 — Checklist completo

| Criterio | Resultado | Estado |
|---|---|---|
| 12 offerings exactas | 12 | ✅ |
| 12 supplier_ref únicas (STN-FON-*) | 12 distintas | ✅ |
| 0 duplicados | 0 | ✅ |
| 0 errores de import | 0 | ✅ |
| Actor correcto (`aeca7bac-...`) | Confirmado vía join | ✅ |
| Catálogo correcto (`1aec572f-...`) | Confirmado | ✅ |
| import_id registrado en `trade_catalog_imports` | `d82b640d-...`, `modo=api`, `estado=matching_pendiente` | ✅ |
| Todas `pending_review` | 12/12 | ✅ |
| Ninguna offering OBRAMAT modificada | 21 matched + 197 pending (sin cambios) | ✅ |
| Total nuevo `pending_review` | 209 (197 OBRAMAT + 12 STN) | ✅ |
| Metadata `_demo=true` aplicada | 12/12 con `source_ref` correcto | ✅ |

---

## 6. Estado del catálogo marketplace tras el import

### Por actor

| Actor | matched | pending_review | Total |
|---|---|---|---|
| OBRAMAT Demo | 21 | 197 | 218 |
| Suministros Técnicos Norte S.L. | 0 | 12 | 12 |
| **TOTAL** | **21** | **209** | **230** |

### Por stock en STN

| Stock | Cantidad |
|---|---|
| Disponible (`stock_disponible = true`) | 10 |
| Sin stock (`stock_disponible = false`) | 2 (STN-FON-013, STN-FON-015) |

---

## 7. Próximos pasos

1. **Matching admin** (P2.7): El admin debe asignar las 12 offerings STN a UPs (`trade_marketplace_universal_products`) en el panel de administración. Ver `PRE_RC1_STN_MATCHING_MATRIX.md` para la guía de emparejamiento.
2. **Portal STN**: Aceptar la invitación con `proveedor@inmostay.com` para verificar aislamiento y acceso al catálogo.
3. **Punto de recogida**: Crear punto de recogida en Torrelavega (propuesto en la matriz de matching).
4. **Imágenes**: Asignar imágenes a las UPs emparejadas para el demo visual.
