# RC1-C.5A.1 — Modelo de tiendas y almacenes de proveedor

**Versión:** 1.0  
**Fecha:** 2026-08-09  
**Estado:** DISEÑO — pendiente aprobación para crear tablas  
**Commit base:** 2c2d72d

---

## 1. Principios de arquitectura

### 1.1 Invariancias del modelo

```
ACTOR   = empresa/proveedor (trade_marketplace_actors)
CATÁLOGO = conjunto de referencias y precios (trade_supplier_catalogs)
LOCATION = tienda, almacén, delegación o punto de recogida
```

Una **location** pertenece a un **actor**. Un actor puede tener 1..N locations. Las locations nunca son actores. Una tienda física de Fontanería Saltos Quiroga no es un proveedor diferente: es una ubicación del proveedor.

```
Fontanería Saltos Quiroga S.L. (actor: ff426e57)
  └── Catálogo saltoki (supplier_catalog_id: 47fb567e)
  └── Locations
        ├── Santander (ubicación principal)
        ├── Torrelavega
        └── Bilbao
```

### 1.2 Decisión: pickup_points vs locations

La tabla `trade_marketplace_supplier_pickup_points` existe pero está vacía (0 registros).  
Su schema actual: `id, actor_id, nombre, direccion (jsonb), telefono, activo, orden, timestamps`.

**Decisión:** crear `trade_marketplace_supplier_locations` como tabla nueva, más expresiva.  
`pickup_points` se mantiene vacía pero no se elimina (puede tener referencias en RLS o código).  
Migración: no necesaria (0 registros que mover).

**Razón:** "pickup point" es un concepto restringido (recogida). "Location" cubre:
- almacén que no permite recogida pero sí entrega local
- delegación comercial sin stock
- punto de recogida puro
- tienda completa con stock + venta

---

## 2. Modelo de datos

### 2.1 `trade_marketplace_supplier_locations` (nueva tabla)

```sql
CREATE TYPE location_tipo AS ENUM (
  'tienda',           -- punto de venta al público profesional
  'almacen',          -- solo logística, sin atención directa
  'delegacion',       -- oficina comercial, sin stock propio
  'punto_recogida'    -- solo recogida de pedidos online
);

CREATE TABLE public.trade_marketplace_supplier_locations (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id              uuid NOT NULL REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,

  -- Identificación
  codigo_interno        text,             -- código interno del proveedor
  nombre                text NOT NULL,    -- nombre visible: "Torrelavega", "Almacén Central Madrid"
  tipo                  location_tipo NOT NULL DEFAULT 'tienda',

  -- Dirección
  direccion_linea1      text,
  direccion_linea2      text,
  codigo_postal         text,
  localidad             text NOT NULL,
  provincia             text NOT NULL,
  comunidad_autonoma    text,
  pais                  char(2) NOT NULL DEFAULT 'ES',

  -- Geolocalización
  latitud               numeric(9,6),
  longitud              numeric(9,6),

  -- Contacto
  telefono              text,
  email                 text,

  -- Horario (jsonb flexible)
  horario               jsonb,
  /*
    {
      "lunes":    {"abre": "08:00", "cierra": "19:00"},
      "martes":   {"abre": "08:00", "cierra": "19:00"},
      "sabado":   {"abre": "09:00", "cierra": "14:00"},
      "domingo":  {"cerrado": true},
      "festivos": "cerrado"
    }
  */

  -- Capacidades
  permite_recogida      bool NOT NULL DEFAULT true,
  permite_entrega_local bool NOT NULL DEFAULT false,
  radio_servicio_km     int,              -- NULL = sin entrega a domicilio

  -- Estado
  activa                bool NOT NULL DEFAULT true,
  orden                 int NOT NULL DEFAULT 0,

  -- Demo flag
  synthetic             bool NOT NULL DEFAULT false,
  synthetic_dataset     text,            -- 'RC1_C5A1_DEMO'

  -- Metadata libre
  metadata              jsonb NOT NULL DEFAULT '{}',

  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX ON public.trade_marketplace_supplier_locations (actor_id, activa);
CREATE INDEX ON public.trade_marketplace_supplier_locations (provincia, activa);
-- Para búsquedas geoespaciales futuras:
-- CREATE INDEX ON public.trade_marketplace_supplier_locations USING GIST (ll_to_earth(latitud, longitud));
```

### 2.2 `trade_marketplace_location_catalog` (relación location ↔ catálogo, opcional)

Por defecto, una location sirve el catálogo completo de su actor. Pero una location puede tener un catálogo reducido (solo fontanería, solo electricidad). Esta tabla captura la excepción:

```sql
CREATE TABLE public.trade_marketplace_location_catalog (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id uuid NOT NULL REFERENCES public.trade_marketplace_supplier_locations(id) ON DELETE CASCADE,
  familia     text NOT NULL,     -- 'fontaneria', 'electricidad', etc.
  activa      bool DEFAULT true
);
```

Si no existen filas para una location: sirve todas las familias del actor.

---

## 3. Relación con checkout

### 3.1 Flujo de recogida

```
Comprador elige "Recogida en tienda"
  → Sistema filtra locations:
    WHERE actor_id = $actor
    AND activa = true
    AND permite_recogida = true
  → Ordena por proximidad a:
    1. dirección de obra (prioridad máxima)
    2. dirección de entrega seleccionada
    3. dirección de la org del instalador
  → Muestra lista con:
    nombre · localidad · distancia · disponibilidad hoy
  → Comprador selecciona location
  → Pedido guarda snapshot:
    location_id + nombre + localidad + coordenadas (en el momento del pedido)
```

### 3.2 Snapshot en pedido

```sql
-- En trade_marketplace_orders (campo a añadir):
pickup_location_id       uuid REFERENCES public.trade_marketplace_supplier_locations(id),
pickup_location_snapshot jsonb,    -- copia del nombre/dirección en el momento del pedido
```

### 3.3 Ordenación por proximidad

```sql
-- Función auxiliar para ordenar por distancia
-- earth_distance(ll_to_earth(lat1, lon1), ll_to_earth(lat2, lon2))
-- Requiere extensión: CREATE EXTENSION earthdistance;

-- Query ejemplo:
SELECT l.*,
  earth_distance(
    ll_to_earth(l.latitud::float8, l.longitud::float8),
    ll_to_earth($obra_lat::float8, $obra_lon::float8)
  ) / 1000 AS distancia_km
FROM trade_marketplace_supplier_locations l
WHERE l.actor_id = $actor_id
  AND l.activa = true
  AND l.permite_recogida = true
ORDER BY distancia_km;
```

---

## 4. Relación con Portal Proveedor

### 4.1 Sección propuesta en Portal

```
Portal Proveedor
  └── Configuración
        └── Tiendas y almacenes
              ├── Listado de locations (paginado, búsqueda)
              ├── Crear location
              ├── Editar location
              │     ├── Datos generales
              │     ├── Horario
              │     ├── Capacidades (recogida, entrega local, radio)
              │     └── Stock local (tab)
              └── Activar / Desactivar
```

Un proveedor nacional puede tener decenas o cientos de locations. El listado debe soportar:
- Búsqueda por nombre o localidad
- Filtro por provincia o comunidad
- Filtro por tipo (tienda/almacén/delegación)
- Paginación (50 por página)

### 4.2 Permisos

Un miembro del actor con rol `supplier_admin` puede gestionar todas las locations del actor.  
Un miembro con rol `supplier_manager` puede gestionar solo las locations asignadas a su scope.

---

## 5. Dataset demo propuesto

### 5.1 Criterio

No crear cientos de tiendas. Solo las suficientes para que el flujo de checkout y comparador muestren variedad.

### 5.2 Locations demo por actor

**Obras y Materiales S.L. (ObrasMat) — 4 locations**

```
1. ObrasMat Santander — Centro
   Tipo: tienda
   Calle: Avda. Demo 12, Santander, Cantabria
   CP: 39001 · Lat: 43.4628 · Lon: -3.8099
   Recogida: sí · Entrega local: sí (20km)
   Horario: L-V 07:30-19:00 · S 08:00-14:00

2. ObrasMat Torrelavega
   Tipo: tienda
   Localidad: Torrelavega, Cantabria
   CP: 39300 · Lat: 43.3521 · Lon: -4.0483
   Recogida: sí · Entrega local: sí (15km)
   Horario: L-V 07:30-18:30

3. ObrasMat Bilbao — Almacén
   Tipo: almacen
   Localidad: Basauri, Bizkaia
   CP: 48970 · Lat: 43.2357 · Lon: -2.8912
   Recogida: no · Entrega local: sí (30km)
   Horario: L-V 06:00-20:00

4. ObrasMat Madrid — Punto recogida
   Tipo: punto_recogida
   Localidad: Alcobendas, Madrid
   CP: 28100 · Lat: 40.5463 · Lon: -3.6394
   Recogida: sí · Entrega local: no
   Horario: L-V 09:00-18:00
```

**Fontanería Saltos Quiroga S.L. — 3 locations**

```
1. FSQ Santander — Principal
   Tipo: tienda
   Localidad: Santander, Cantabria
   CP: 39007 · Lat: 43.4650 · Lon: -3.7940
   Recogida: sí · Entrega local: sí (25km)

2. FSQ Torrelavega
   Tipo: tienda
   Localidad: Torrelavega, Cantabria
   CP: 39300 · Lat: 43.3510 · Lon: -4.0460
   Recogida: sí · Entrega local: sí (15km)

3. FSQ Bilbao
   Tipo: delegacion
   Localidad: Bilbao, Bizkaia
   CP: 48001 · Lat: 43.2627 · Lon: -2.9253
   Recogida: sí · Entrega local: no
```

**ElectroDistribución Cantábrica S.L. — 3 locations**

```
1. EDC Santander
   Tipo: tienda
   Localidad: Santander, Cantabria
   Recogida: sí · Entrega local: sí (20km)

2. EDC Maliaño
   Tipo: almacen (distribución mayorista)
   Localidad: Maliaño, Cantabria
   Recogida: sí (para instaladores) · Entrega local: sí (40km)

3. EDC Oviedo
   Tipo: delegacion
   Localidad: Oviedo, Asturias
   Recogida: sí · Entrega local: no
```

**Sistemas Térmicos del Norte S.L. — 2 locations**

```
1. STN Santander — Principal
   Tipo: tienda
   Localidad: Santander, Cantabria
   Recogida: sí · Entrega local: sí (30km)

2. STN Gijón
   Tipo: delegacion
   Localidad: Gijón, Asturias
   Recogida: sí · Entrega local: no
```

**Resto de actores — 1 location cada uno**

```
STN-comp (Suministros Técnicos Norte): 1 — Santander, tienda
ElectroSuministros: 1 — Santander, tienda
Revestimientos: 1 — Torrelavega, tienda
Carpintería: 1 — Santander, tienda
Pinturas: 1 — Santander, delegacion
```

**Total dataset demo: 16 locations** — suficiente para mostrar variedad geográfica y tipos.

---

## 6. Migraciones propuestas

### 6.1 Nuevas extensiones requeridas

```sql
-- Para cálculo de distancias geoespaciales
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;
```

### 6.2 DDL completo

```sql
-- Tipo ENUM
CREATE TYPE public.location_tipo AS ENUM ('tienda','almacen','delegacion','punto_recogida');

-- Tabla principal
CREATE TABLE public.trade_marketplace_supplier_locations (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id              uuid NOT NULL REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,
  codigo_interno        text,
  nombre                text NOT NULL,
  tipo                  public.location_tipo NOT NULL DEFAULT 'tienda',
  direccion_linea1      text,
  codigo_postal         text,
  localidad             text NOT NULL,
  provincia             text NOT NULL,
  comunidad_autonoma    text,
  pais                  char(2) NOT NULL DEFAULT 'ES',
  latitud               numeric(9,6),
  longitud              numeric(9,6),
  telefono              text,
  email                 text,
  horario               jsonb,
  permite_recogida      bool NOT NULL DEFAULT true,
  permite_entrega_local bool NOT NULL DEFAULT false,
  radio_servicio_km     int,
  activa                bool NOT NULL DEFAULT true,
  orden                 int NOT NULL DEFAULT 0,
  synthetic             bool NOT NULL DEFAULT false,
  synthetic_dataset     text,
  metadata              jsonb NOT NULL DEFAULT '{}',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX ON public.trade_marketplace_supplier_locations (actor_id, activa);
CREATE INDEX ON public.trade_marketplace_supplier_locations (provincia, activa);

-- RLS
ALTER TABLE public.trade_marketplace_supplier_locations ENABLE ROW LEVEL SECURITY;

-- Política lectura: todos pueden ver locations activas
CREATE POLICY "locations_select_active" ON public.trade_marketplace_supplier_locations
  FOR SELECT USING (activa = true OR auth.role() = 'service_role');

-- Tabla catálogo reducido por location (opcional)
CREATE TABLE public.trade_marketplace_location_catalog (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id uuid NOT NULL REFERENCES public.trade_marketplace_supplier_locations(id) ON DELETE CASCADE,
  familia     text NOT NULL,
  activa      bool DEFAULT true
);
```

---

## 7. Riesgos

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Coordenadas demo incorrectas → distancias irreales | Alta | Bajo | Usar coordenadas aproximadas de las capitales de provincia (sin dirección exacta real) |
| `earthdistance` no disponible en la instancia Supabase | Baja | Medio | Verificar con `SELECT * FROM pg_extension WHERE extname='earthdistance'`; alternativa: calcular distancia en frontend |
| Schema de horario `jsonb` inconsistente entre locations | Media | Bajo | Definir schema fijo en documentación y validar en frontend |
| Muchos proveedores sin locations → checkout no muestra recogida | Baja | Bajo | La UI debe tener estado graceful: "Este proveedor no ofrece recogida en tienda" |
| `trade_marketplace_supplier_pickup_points` tiene FK en RLS u otro código | Baja | Medio | Antes de crearla como deprecada, buscar referencias: `grep -r pickup_points src/` |

## 8. Rollback

```sql
DROP TABLE IF EXISTS public.trade_marketplace_location_catalog;
DROP TABLE IF EXISTS public.trade_marketplace_supplier_locations;
DROP TYPE IF EXISTS public.location_tipo;
```

Sin impacto en offerings, pedidos, actores ni catálogos.
