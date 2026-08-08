# RC1-C.4A — Plan de offerings demo

**Estado:** IMPLEMENTADO — RC1-C.4A FASE A completada 2026-08-08  
**Versión:** 1.1 — 2026-08-08

---

## Objetivo

Elevar la cobertura del flujo Presupuesto → Marketplace del 11% actual al 85% usando solo cambios de datos, sin modificar código. Los cambios de código (resolver IA, persist UP en quote_items) son fase posterior.

---

## 1. Actores demo disponibles

| Actor slug | Nombre | Especialidad demo |
|------------|--------|-------------------|
| `obramat-demo` | OBRAMAT Demo | Materiales de construcción y reforma — catálogo amplio |
| `suministros-tecnicos-norte` | Suministros Técnicos Norte | Fontanería, electricidad, grifería premium |
| `electrosuministros-cantabrico` | ElectroSuministros Cantábrico | Electricidad, iluminación, mecanismos |
| `revestimientos-obra-norte` | Revestimientos y Obra Norte | Azulejos, pavimentos, impermeabilizantes, morteros |
| `pinturas-profesionales-norte` | Pinturas Profesionales Norte | Pinturas y tratamientos superficiales |
| `carpinteria-cerramientos-norte` | Carpintería y Cerramientos Norte | Puertas, ventanas, mamparas |

---

## 2. Aliases de text-matching (prioridad: inmediata)

Estos aliases se añaden a los UPs existentes para que `create_cart_from_quote` los conecte. No crean nuevos UPs ni offerings — solo mejoran el matching de texto.

### UP: Sifón y desagüe ducha (8a235fa5)
```
aliases: ["sifón", "válvula desagüe", "desagüe ducha", "sifon ducha", "válvula sifón"]
```

### UP: Membrana impermeabilizante líquida (0f1411fd)
```
aliases: ["impermeabilización", "impermeabilizante", "membrana", "zona ducha impermeabilizar", 
          "impermeabilizar suelo", "impermeabilizar paredes"]
```

### UP: Azulejo rectificado pared (exists)
```
aliases: ["baldosa", "alicatado", "azulejo", "cerámica pared", "baldosas pared", 
          "material alicatado", "revestimiento pared"]
```

### UP: Baldosa porcelánica 60×60 (exists)
```
aliases: ["baldosa suelo", "pavimento", "porcelánico", "R11", "antideslizante suelo",
          "baldosa antideslizante"]
```

### UP: Mampara de ducha (0bb256f1)
```
aliases: ["mampara", "cristal templado", "ducha fija", "mampara fija", "panel ducha"]
```

### UP: Grifo monomando lavabo (7ba1e338)
```
aliases: ["grifo monomando lavabo", "grifería lavabo", "grifo lavabo", "monomando lavabo básico"]
```

### UP: Pintura plástica anti-humedad (exists)
```
aliases: ["pintura paredes", "pintura techo", "antihumedad", "pintura baño", 
          "pintura antihumedad", "pintura plástica"]
```

### UP: Mortero adhesivo (exists)
```
aliases: ["mortero adhesivo", "adhesivo alicatado", "pegamento cerámica", 
          "mortero cola", "adhesivo porcelánico"]
```

### UP: Mecanismo enchufe schuko IP44 (exists)
```
aliases: ["enchufe IP44", "enchufe baño", "mecanismo baño", "enchufe húmedo"]
```

### UP: Luminaria baño LED IP44 (8373f246)
```
aliases: ["luminaria LED", "downlight LED", "luminarias LED", "foco baño", 
          "punto de luz", "luminaria empotrada", "downlight baño"]
```

---

## 3. Offerings a crear para UPs sin cobertura activa

### 3.1 Lavabo sobre encimera

**UP:** Lavabo cerámica suspendido  
**Estado actual:** UP existe, sin offerings activas en demo  
**Actor asignado:** OBRAMAT Demo (por volumen y visibilidad en demo)

```sql
-- SOLO EJECUTAR TRAS APROBACIÓN
INSERT INTO trade_marketplace_supplier_offerings (
  universal_product_id,
  supplier_catalog_id,  -- catálogo de OBRAMAT Demo
  referencia_proveedor,
  nombre_producto,
  descripcion,
  precio_profesional,
  precio_pvp,
  unidad,
  stock_disponible,
  stock_cantidad,
  plazo_entrega_dias,
  activa,
  venta_profesional_habilitada,
  match_state
) VALUES (
  '<lavabo_up_id>',      -- completar con UUID real
  '<obramat_catalog_id>',-- completar con UUID real
  'OBR-LAV-1001',
  'Lavabo sobre encimera cerámica blanco 60cm',
  'Lavabo de cerámica sanitaria sobre encimera, 60cm, acabado blanco brillo. Compatible con mueble 60cm estándar.',
  89.00,
  129.00,
  'ud',
  true,
  15,
  3,
  true,
  true,
  'matched'
);
```

### 3.2 Inodoro suspendido compact

**UP:** Inodoro suspendido compact  
**Estado actual:** UP existe, sin offerings activas en demo  
**Actor asignado:** OBRAMAT Demo

```sql
-- SOLO EJECUTAR TRAS APROBACIÓN
INSERT INTO trade_marketplace_supplier_offerings (
  universal_product_id,
  supplier_catalog_id,
  referencia_proveedor,
  nombre_producto,
  descripcion,
  precio_profesional,
  precio_pvp,
  unidad,
  stock_disponible,
  stock_cantidad,
  plazo_entrega_dias,
  activa,
  venta_profesional_habilitada,
  match_state
) VALUES (
  '<inodoro_up_id>',
  '<obramat_catalog_id>',
  'OBR-INO-2001',
  'Inodoro suspendido compact rimless blanco',
  'Inodoro suspendido compacto sin reborde (rimless), cerámica sanitaria blanca, sin tapa. Compatible con bastidores estándar Geberit y Roca.',
  195.00,
  289.00,
  'ud',
  true,
  8,
  3,
  true,
  true,
  'matched'
);
```

---

## 4. Nuevos UPs a crear (con offerings incluidas)

### 4.1 Grifo monomando ducha empotrado (prioridad alta)

**Aparece en:** PRE-2026-085  
**Actor:** Suministros Técnicos Norte (especialidad fontanería premium)  

```sql
-- SOLO EJECUTAR TRAS APROBACIÓN

-- UP
INSERT INTO trade_marketplace_universal_products (
  nombre, descripcion, familia, subfamilia, unidad, activo
) VALUES (
  'Grifo monomando ducha empotrado',
  'Grifo monomando empotrado para ducha, cuerpo inoxidable o latón cromado, incluye mezclador termostático o manual. Para instalación en pared.',
  'Grifería', 'Grifería Ducha', 'ud', true
);

-- Offering STN
INSERT INTO trade_marketplace_supplier_offerings (
  universal_product_id, supplier_catalog_id, referencia_proveedor,
  nombre_producto, precio_profesional, precio_pvp, unidad,
  stock_disponible, stock_cantidad, plazo_entrega_dias,
  activa, venta_profesional_habilitada, match_state
) VALUES (
  '<nuevo_up_id>', '<stn_catalog_id>',
  'STN-GRF-5501',
  'Grifo monomando ducha empotrado cromado',
  72.00, 115.00, 'ud', true, 6, 2, true, true, 'matched'
);
```

### 4.2 Kit fontanería / conexiones baño (prioridad alta)

**Aparece en:** PRE-2026-089  
**Descripción en presupuesto:** "Adaptación fontanería (llaves escuadra, flexibles)"  
**Actor:** Suministros Técnicos Norte  

```sql
INSERT INTO trade_marketplace_universal_products (
  nombre, descripcion, familia, subfamilia, unidad, activo
) VALUES (
  'Kit conexiones fontanería baño',
  'Kit de conexiones para instalación de baño: llaves de escuadra 1/2", flexibles de conexión, collarines y elementos de fijación.',
  'Saneamiento', 'Conexiones y Accesorios', 'kit', true
);

-- Offering STN
INSERT INTO trade_marketplace_supplier_offerings (
  universal_product_id, supplier_catalog_id, referencia_proveedor,
  nombre_producto, precio_profesional, precio_pvp, unidad,
  stock_disponible, stock_cantidad, plazo_entrega_dias,
  activa, venta_profesional_habilitada, match_state
) VALUES (
  '<nuevo_up_id>', '<stn_catalog_id>',
  'STN-KIT-0201',
  'Kit conexiones baño completo 1/2" — llaves + flexibles',
  14.50, 22.00, 'kit', true, 30, 2, true, true, 'matched'
);
```

### 4.3 Silicona sanitaria (prioridad alta)

**Aparece en:** PRE-2026-089  
**Actor:** OBRAMAT Demo (disponibilidad inmediata)  

```sql
INSERT INTO trade_marketplace_universal_products (
  nombre, descripcion, familia, subfamilia, unidad, activo
) VALUES (
  'Silicona sanitaria sellado baño',
  'Silicona acetoxi o neutra para sellado de juntas en baños y zonas húmedas. Apta para contacto agua. Color blanco.',
  'Accesorios', 'Sellantes y Adhesivos', 'cartucho', true
);

-- Offering OBRAMAT
INSERT INTO trade_marketplace_supplier_offerings (
  universal_product_id, supplier_catalog_id, referencia_proveedor,
  nombre_producto, precio_profesional, precio_pvp, unidad,
  stock_disponible, stock_cantidad, plazo_entrega_dias,
  activa, venta_profesional_habilitada, match_state
) VALUES (
  '<nuevo_up_id>', '<obramat_catalog_id>',
  'OBR-SIL-0099',
  'Silicona sanitaria blanca cartucho 310ml',
  4.50, 7.00, 'cartucho', true, 60, 3, true, true, 'matched'
);
```

### 4.4 Mecanismo interruptor baño IP44 (prioridad media)

**Aparece en:** PRE-2026-085  
**Actor:** ElectroSuministros Cantábrico + STN  

```sql
INSERT INTO trade_marketplace_universal_products (
  nombre, descripcion, familia, subfamilia, unidad, activo
) VALUES (
  'Mecanismo interruptor pulsador IP44 baño',
  'Interruptor o pulsador para instalación en zona húmeda (baño), protección IP44 contra salpicaduras. Incluye marco y tapa.',
  'Mecanismos', 'Interruptores', 'ud', true
);

-- Offering ElectroSuministros
INSERT INTO trade_marketplace_supplier_offerings (
  universal_product_id, supplier_catalog_id, referencia_proveedor,
  nombre_producto, precio_profesional, precio_pvp, unidad,
  stock_disponible, stock_cantidad, plazo_entrega_dias,
  activa, venta_profesional_habilitada, match_state
) VALUES (
  '<nuevo_up_id>', '<electro_catalog_id>',
  'ESC-MEC-1102',
  'Interruptor IP44 baño blanco + marco',
  6.80, 11.50, 'ud', true, 20, 2, true, true, 'matched'
);
```

### 4.5 Mueble baño conjunto (prioridad media)

**Aparece en:** PRE-2026-085  
**Nota:** Categoría compleja — muchas variantes. Para demo, UP genérico con rango de precio.  

```sql
INSERT INTO trade_marketplace_universal_products (
  nombre, descripcion, familia, subfamilia, unidad, activo
) VALUES (
  'Mueble baño conjunto 60cm',
  'Mueble de baño con lavabo integrado o sobre encimera, 60cm de ancho. Incluye mueble inferior y lavabo. Sin espejo. Para instalación suspendida.',
  'Baño', 'Muebles de Baño', 'ud', true
);

-- Offering OBRAMAT (entrada de gama para demo)
INSERT INTO trade_marketplace_supplier_offerings (
  universal_product_id, supplier_catalog_id, referencia_proveedor,
  nombre_producto, precio_profesional, precio_pvp, unidad,
  stock_disponible, stock_cantidad, plazo_entrega_dias,
  activa, venta_profesional_habilitada, match_state
) VALUES (
  '<nuevo_up_id>', '<obramat_catalog_id>',
  'OBR-MUE-3001',
  'Mueble baño suspendido 60cm + lavabo blanco',
  285.00, 420.00, 'ud', true, 4, 5, true, true, 'matched'
);
```

### 4.6 Caja empotrar y pequeño material eléctrico (prioridad baja)

**Aparece en:** PRE-2026-090  
**Nota:** Material muy genérico; puede ser kit de "pequeño material".  

```sql
INSERT INTO trade_marketplace_universal_products (
  nombre, descripcion, familia, subfamilia, unidad, activo
) VALUES (
  'Caja empotrar y pequeño material eléctrico',
  'Caja de empotrar para mecanismos eléctricos, cinta aislante, bridas y elementos de instalación eléctrica de fontanería. Kit estándar de instalación.',
  'Electricidad', 'Accesorios Eléctricos', 'kit', true
);

-- Offering ElectroSuministros
INSERT INTO trade_marketplace_supplier_offerings (
  universal_product_id, supplier_catalog_id, referencia_proveedor,
  nombre_producto, precio_profesional, precio_pvp, unidad,
  stock_disponible, stock_cantidad, plazo_entrega_dias,
  activa, venta_profesional_habilitada, match_state
) VALUES (
  '<nuevo_up_id>', '<electro_catalog_id>',
  'ESC-KIT-0001',
  'Kit pequeño material eléctrico instalación baño',
  9.50, 14.00, 'kit', true, 25, 2, true, true, 'matched'
);
```

---

## 5. Resumen de cambios de datos

| Acción | Cantidad | Actor/Tabla | Urgencia |
|--------|---------|-------------|---------|
| Añadir aliases text-matching a UPs existentes | 10 UPs | `trade_marketplace_universal_products.search_aliases` o config | Inmediata |
| Crear offerings para UPs sin cobertura (lavabo, inodoro) | 2 offerings | OBRAMAT Demo | Alta |
| Crear nuevos UPs con offerings | 6 UPs + 6 offerings | STN, OBRAMAT, ElectroSuministros | Alta |
| **Total filas a insertar** | ~20 | varios | — |

---

## 6. IDs a completar antes de ejecutar

Los SQL de arriba usan placeholders `<xxx_id>`. Antes de ejecutar, obtener:

```sql
-- UPs existentes sin offering
SELECT id, nombre FROM trade_marketplace_universal_products 
WHERE nombre ILIKE '%lavabo%' OR nombre ILIKE '%inodoro%';

-- Catálogos de actores
SELECT sc.id, a.nombre 
FROM trade_supplier_catalogs sc
JOIN trade_marketplace_actors a ON a.id = sc.actor_id
WHERE a.estado = 'active';
```

---

## 7. Verificación post-inserción

Después de insertar los datos, verificar con:

```sql
-- Cobertura PRE-2026-089
SELECT 
  qi.descripcion,
  up.nombre as up_nombre,
  o.nombre_producto as offering,
  a.nombre as actor
FROM trade_quote_items qi
LEFT JOIN trade_marketplace_universal_products up ON up.id = qi.universal_product_id
LEFT JOIN trade_marketplace_supplier_offerings o ON o.universal_product_id = up.id AND o.activa = true
LEFT JOIN trade_supplier_catalogs sc ON sc.id = o.supplier_catalog_id
LEFT JOIN trade_marketplace_actors a ON a.id = sc.actor_id
WHERE qi.presupuesto_id = '<PRE-2026-089-id>'
  AND qi.tipo = 'material';
```

Cobertura esperada post-inserción: **>80% en PRE-2026-089, >50% en PRE-2026-090, >60% en PRE-2026-085**.

---

## 8. Lo que NO se hace en esta fase

- No se modifica `create_cart_from_quote` (función SQL)
- No se toca el motor IA de presupuestos
- No se añaden campos nuevos a `trade_quote_items`
- No se modifica el checkout ni el flujo de carrito
- No se crean migraciones de esquema

Todo son operaciones INSERT/UPDATE de datos de configuración.
