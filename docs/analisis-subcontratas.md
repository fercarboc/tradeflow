# Análisis: Módulo de Subcontratas en TrabFlow AI

**Fecha:** 2026-06-14  
**Estado:** Análisis — pendiente de aprobación antes de implementar  
**Afecta a:** Nueva sección "Subcontratas", ScreenFacturas, ScreenIngresos, trade_jobs

---

## 1. Qué es una subcontrata en este contexto

Una empresa tiene todos sus técnicos ocupados o no tiene la especialidad necesaria. Necesita que **otra empresa o técnico externo** realice un trabajo a su nombre. La empresa contratante:

1. Gestiona internamente al subcontratista (fecha, importe, notas)
2. Factura al cliente final **como si el trabajo lo hubiera hecho ella** (sin mencionar subcontrata)
3. El precio al cliente cubre el coste de la subcontrata **más un margen de beneficio** (20-30% típico)

---

## 2. Flujo completo de una subcontrata

```
Empresa recibe solicitud de trabajo
        │
        ▼
Todos los técnicos propios están ocupados
        │
        ▼
Se decide subcontratar
        │
        ▼
┌─────────────────────────────────────────┐
│  CREAR SUBCONTRATA                      │
│  • Trabajo a realizar                   │
│  • Fecha prevista                       │
│  • Subcontratista (empresa o autónomo)  │
│  • Importe que nos cobrará (coste)      │
│  • Importe que cobraremos al cliente    │
│    [auto: coste × 1.25 por defecto]     │
│  • Notas de comunicación               │
└─────────────────────────────────────────┘
        │
        ▼
Estado: PENDIENTE → contactar subcontratista
        │
        ▼
Subcontratista confirma → Estado: CONFIRMADO
        │
        ▼
Se realiza el trabajo → Estado: COMPLETADO
        │
        ▼
┌─────────────────────────────────────────┐
│  FACTURACIÓN AL CLIENTE FINAL           │
│  • Se incluye en factura como trabajo   │
│    normal (sin mencionar subcontrata)   │
│  • Importe = lo que acordamos cobrar    │
│    al cliente (coste + margen)          │
└─────────────────────────────────────────┘
        │
        ▼
Internamente: registrar coste de subcontrata
en Ingresos como gasto/coste del trabajo
```

---

## 3. Modelo de datos

### Tabla principal: `trade_subcontracts`

```sql
CREATE TABLE trade_subcontracts (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id                  uuid REFERENCES trade_organizations(id) ON DELETE CASCADE NOT NULL,
  job_id                  uuid REFERENCES trade_jobs(id) ON DELETE SET NULL,       -- trabajo vinculado (opcional)
  client_id               uuid REFERENCES trade_clients(id) ON DELETE SET NULL,    -- cliente final
  
  -- Descripción del trabajo
  descripcion             text NOT NULL,
  fecha_trabajo           date,
  direccion               text,                                                     -- si difiere del trabajo vinculado
  
  -- Subcontratista
  subcontratista_id       uuid REFERENCES trade_subcontractors(id) ON DELETE SET NULL, -- catálogo
  subcontratista_nombre   text NOT NULL,                                            -- nombre libre (o del catálogo)
  subcontratista_empresa  text,
  subcontratista_email    text,
  subcontratista_telefono text,
  
  -- Económico
  importe_subcontrata     numeric(10,2) NOT NULL DEFAULT 0,  -- lo que nos cobra a NOSOTROS
  margen_pct              numeric(5,2)  NOT NULL DEFAULT 25, -- % beneficio sobre el coste
  importe_cliente         numeric(10,2) NOT NULL DEFAULT 0,  -- lo que cobramos al CLIENTE FINAL
                                                              -- = importe_subcontrata × (1 + margen_pct/100)
                                                              -- editable manualmente si se desea
  
  -- Estado
  estado                  text NOT NULL DEFAULT 'pendiente'
                          CHECK (estado IN ('pendiente','ofertado','confirmado','en_curso','completado','cancelado')),
  
  -- Facturación
  invoice_id              uuid REFERENCES trade_invoices(id) ON DELETE SET NULL,   -- cuando se factura al cliente
  facturado_at            timestamptz,
  
  -- Comunicación
  notas                   text,                                                     -- log libre de comunicaciones
  
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);
```

### Tabla catálogo: `trade_subcontractors`

Directorio reutilizable de subcontratistas habituales de la empresa.

```sql
CREATE TABLE trade_subcontractors (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          uuid REFERENCES trade_organizations(id) ON DELETE CASCADE NOT NULL,
  nombre          text NOT NULL,
  empresa         text,
  email           text,
  telefono        text,
  especialidades  text[],               -- ['Fontanería','Gas','Calefacción']
  precio_hora     numeric(8,2),         -- tarifa orientativa por hora
  precio_visita   numeric(8,2),         -- tarifa orientativa por visita
  valoracion      smallint CHECK (valoracion BETWEEN 1 AND 5), -- puntuación interna 1-5★
  notas           text,                 -- notas internas sobre este subcontratista
  activo          boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);
```

### Campo adicional en `trade_jobs`
```sql
ALTER TABLE trade_jobs
  ADD COLUMN IF NOT EXISTS tiene_subcontrata boolean DEFAULT false;
-- Permite filtrar fácilmente trabajos con subcontrata vinculada
```

---

## 4. Cálculo del importe al cliente

Regla por defecto (editable manualmente):

```
importe_cliente = importe_subcontrata × (1 + margen_pct / 100)
```

Ejemplos:
| Coste subcontrata | Margen | Precio al cliente |
|---|---|---|
| 200 € | 20% | 240 € |
| 200 € | 25% | 250 € (por defecto) |
| 200 € | 30% | 260 € |
| 350 € | 25% | 437,50 € |

La UI mostrará un **slider de margen** (15% – 50%) con preview en tiempo real del precio al cliente. El usuario puede también editar directamente el importe cliente, y el sistema recalcula el margen resultante.

---

## 5. Estados del ciclo de vida

```
PENDIENTE → OFERTADO → CONFIRMADO → EN CURSO → COMPLETADO
                                                    │
    CANCELADO ◄─────── (desde cualquier estado)     │
                                                    ▼
                                             FACTURADO (estado virtual,
                                             cuando invoice_id queda enlazado)
```

| Estado | Significado |
|---|---|
| `pendiente` | Creado, aún no contactado el subcontratista |
| `ofertado` | Se le ha enviado el trabajo, esperando confirmación |
| `confirmado` | El subcontratista ha aceptado el trabajo |
| `en_curso` | El trabajo se está realizando |
| `completado` | Trabajo terminado, pendiente de facturar al cliente |
| `cancelado` | Se canceló (con nota de motivo) |

---

## 6. Pantalla principal: "Subcontratas"

### Vista lista (desktop)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SUBCONTRATAS                           [+ Nueva subcontrata]             │
│                                                                          │
│ Filtros: [Todos ▼]  [Este mes ▼]  [Buscar...]                           │
│                                                                          │
│ ┌────────────────────────────────────────────────────────────────────┐  │
│ │ # │ TRABAJO         │ FECHA  │ SUBCONTRATISTA    │ COSTE │ CLIENTE │ ESTADO │
│ ├───┼─────────────────┼────────┼───────────────────┼───────┼─────────┼────────┤
│ │ 1 │ Rep. calefacc.  │ 15 jun │ Técnico Martínez  │ 200€  │  250€   │ ✅ Conf │
│ │ 2 │ Inst. aire      │ 18 jun │ CoolTech S.L.     │ 480€  │  600€   │ 🕐 Pend │
│ │ 3 │ Fontanería      │ 22 jun │ Juan López        │ 150€  │  190€   │ ✅ Comp │
│ └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│ Totales mes:  Coste subcontratas: 830€  │  A facturar al cliente: 1.040€ │
│               Margen previsto: 210€ (25,3%)                              │
└──────────────────────────────────────────────────────────────────────────┘
```

### Ficha de subcontrata (detalle / edición)

```
┌─────────────────────────────────────────────────────────────┐
│ Subcontrata #SC-2026-003                    [CONFIRMADO ▼]  │
│                                                             │
│ TRABAJO                                                     │
│ Descripción: [Reparación calefacción c/ Mayor 14, 3B     ] │
│ Fecha:       [15/06/2026]                                   │
│ Trabajo vinculado: [Trabajo #T-089 — María Gómez ▼]        │
│ Cliente final:     [María Gómez — C/ Mayor 14]              │
│                                                             │
│ SUBCONTRATISTA                                              │
│ [🔍 Buscar en directorio]  o  [+ Nuevo]                    │
│ Nombre:   [Técnico Martínez                              ]  │
│ Empresa:  [Martínez Fontanería                           ]  │
│ Teléfono: [666 123 456]   Email: [mart@email.com]          │
│                                                             │
│ ECONÓMICO                                                   │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Coste subcontrata:    200,00 €                       │    │
│ │ Margen:  [████████░░] 25%   [slider 15-50%]         │    │
│ │ ─────────────────────────────────────────────────── │    │
│ │ Precio al cliente:    250,00 €  ✏️ (editable)       │    │
│ │ Beneficio neto:        50,00 €                       │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ NOTAS DE COMUNICACIÓN                               [+ Nota]│
│ ┌─────────────────────────────────────────────────────┐    │
│ │ 13/06 10:30 — Llamada: confirma disponibilidad,     │    │
│ │               puede el día 15 por la mañana.        │    │
│ │                                                     │    │
│ │ 14/06 09:15 — WhatsApp: enviada dirección y         │    │
│ │               datos del cliente.                    │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ [Guardar]    [Marcar completado]    [Facturar al cliente →] │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Directorio de subcontratistas

Sección auxiliar dentro de Subcontratas para gestionar el catálogo de proveedores habituales.

```
┌──────────────────────────────────────────────────────────────┐
│ DIRECTORIO DE SUBCONTRATISTAS            [+ Añadir]          │
│                                                              │
│ [🔍 Buscar por nombre, especialidad...]                      │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ [TM] Técnico Martínez                                │    │
│ │      Martínez Fontanería · ★★★★☆                    │    │
│ │      📱 666 123 456 · Fontanería, Gas, Calefacción   │    │
│ │      Precio visita: 80€ · Tarifa hora: 45€           │    │
│ │      [Ver trabajos] [Editar]                         │    │
│ ├──────────────────────────────────────────────────────┤    │
│ │ [CT] CoolTech S.L.                                   │    │
│ │      ★★★★★ · Climatización, Frío industrial         │    │
│ │      📱 910 456 789 · Tarifa hora: 65€               │    │
│ │      [Ver trabajos] [Editar]                         │    │
│ └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. Integración con Facturación

### Al crear la factura al cliente final

Cuando un trabajo tiene subcontrata vinculada y se va a facturar:

1. El sistema sugiere incluir el importe de la subcontrata en la factura
2. La línea aparece como trabajo normal (SIN mencionar "subcontrata"):

```
FACTURA F-2026-0089 — María Gómez
─────────────────────────────────────────────────────────
Concepto                           Cant.   P.Unit    Total
─────────────────────────────────────────────────────────
Reparación calefacción c/ Mayor      1     250,00   250,00  ← importe_cliente
─────────────────────────────────────────────────────────
Base imponible:                               250,00
IVA 21%:                                       52,50
TOTAL:                                        302,50
─────────────────────────────────────────────────────────
```

**El cliente NO ve** nada sobre "subcontrata", "Técnico Martínez" ni el coste real.  
Internamente TrabFlow registra que de esos 250€, 200€ son coste de subcontrata y 50€ son beneficio.

### Flujo de facturación desde la subcontrata

```
Subcontrata en estado COMPLETADO
        │
        ▼
Botón [Facturar al cliente →]
        │
        ▼
¿Hay factura preexistente para ese cliente/trabajo?
        │
   ┌────┴────┐
   │   Sí   │ ──► Opción: añadir a factura existente
   └────┬────┘                    o crear nueva
        │ No
        ▼
Crear nueva factura con:
  - Cliente: el del trabajo vinculado
  - Línea: descripción del trabajo (sin mencionar subcontrata)
  - Importe: importe_cliente de la subcontrata
  - IVA: el configurado en la empresa
        │
        ▼
Subcontrata.invoice_id = factura creada
Subcontrata.facturado_at = now()
Estado visual: FACTURADO
```

---

## 9. Integración con Ingresos / Rentabilidad

En el módulo de Ingresos, los trabajos subcontratados deben mostrar:

```
Trabajo: Rep. calefacción — María Gómez
  Facturado al cliente:    250,00 €
  Coste subcontrata:      -200,00 €  ← visible solo internamente
  ─────────────────────────────────
  Margen real:              50,00 € (20%)
```

Esto permite calcular la **rentabilidad real** diferenciando:
- Trabajos propios: margen = ingreso - horas × tarifa
- Trabajos subcontratados: margen = importe cliente - coste subcontrata

---

## 10. Integración con Planificación

Cuando se crea una subcontrata vinculada a un trabajo:
- El trabajo en el calendario muestra un badge `[SC]` o icono especial
- En el detalle del trabajo aparece: "⚠️ Subcontratada a Técnico Martínez — 200€"
- El trabajo NO se asigna a ningún trabajador propio (queda sin técnico asignado interno)
- El estado del trabajo puede avanzar según el estado de la subcontrata

---

## 11. Notificaciones y recordatorios

| Evento | Acción |
|---|---|
| Subcontrata creada sin confirmar + fecha en 3 días | Aviso: "Confirma la subcontrata para el trabajo del 15 jun" |
| Subcontrata confirmada + fecha mañana | Aviso: "Mañana tienes trabajo subcontratado a Martínez" |
| Subcontrata completada + sin facturar en 7 días | Aviso: "Pendiente de facturar al cliente el trabajo de c/ Mayor" |
| Subcontrata sin respuesta del subcontratista en 48h | Aviso: "Sin confirmación de CoolTech para el trabajo del 18 jun" |

---

## 12. Modelo de UI — Posición en la app

### Menú lateral desktop
```
📊 Panel Control
📄 Presupuestos
👥 Clientes CRM
🧾 Facturas
📦 Catálogo
📅 Planificación
🗺️ Ruta del Día
📈 Ingresos
👷 Subcontratas       ← NUEVA sección (solo Empresa/Empresa+)
👥 Equipo
🔧 Mantenimientos
📑 Contratos
⚙️ Ajustes y Tarifas
```

**Disponibilidad por plan:**
- `basico` / `profesional`: ❌ no disponible
- `empresa` / `empresa_plus`: ✅ disponible
- `trial`: ✅ disponible (para probar)

Esta restricción tiene sentido porque subcontratar es una práctica de empresas medianas/grandes con volumen de trabajo suficiente.

### Mobile
Subcontratas NO aparece en el bottom nav móvil (funcionalidad de gestión/oficina, no de campo). Accesible desde el menú de ajustes o icono en el header si es necesario.

---

## 13. Cambios técnicos necesarios

### 13a. Base de datos (migraciones)
```sql
-- 1. Tabla directorio subcontratistas
CREATE TABLE trade_subcontractors (...);

-- 2. Tabla subcontratas
CREATE TABLE trade_subcontracts (...);

-- 3. Campo en trade_jobs
ALTER TABLE trade_jobs ADD COLUMN tiene_subcontrata boolean DEFAULT false;

-- 4. RLS policies para ambas tablas (org_id = auth context)
```

### 13b. `src/lib/supabase.ts`
```typescript
// CRUD subcontratas
export async function loadSubcontracts(orgId: string): Promise<TradeSubcontract[]>
export async function createSubcontract(orgId: string, data: ...): Promise<TradeSubcontract>
export async function updateSubcontract(id: string, data: ...): Promise<void>
export async function deleteSubcontract(id: string): Promise<void>

// CRUD directorio subcontratistas
export async function loadSubcontractors(orgId: string): Promise<TradeSubcontractor[]>
export async function saveSubcontractor(orgId: string, data: ...): Promise<TradeSubcontractor>
export async function deleteSubcontractor(id: string): Promise<void>

// Tipos
export interface TradeSubcontract { ... }
export interface TradeSubcontractor { ... }
```

### 13c. Nuevos componentes
| Componente | Función |
|---|---|
| `ScreenSubcontratas.tsx` | Pantalla principal: lista + filtros + KPIs |
| `SubcontrataForm.tsx` | Modal de creación/edición de subcontrata |
| `SubcontractorDirectory.tsx` | Directorio de subcontratistas habituales |
| `SubcontrataBadge.tsx` | Badge `[SC]` para mostrar en trabajos del calendario |

### 13d. Modificaciones en componentes existentes
- `ScreenFacturas.tsx` / `supabase.ts` → al facturar, opción de incluir línea de subcontrata
- `ScreenPlanificacion.tsx` → mostrar badge `[SC]` en trabajos con subcontrata
- `ScreenIngresos.tsx` → desglosar coste subcontrata en margen de trabajos
- `AppDashboardView.tsx` → añadir item "Subcontratas" al sidebar (plan Empresa+)

---

## 14. Casos edge y reglas de negocio

| Caso | Regla |
|---|---|
| ¿Se puede tener varios subcontratistas para un mismo trabajo? | Sí: 1 trabajo puede tener N subcontratas (ej. electricidad + fontanería por separado) |
| ¿El subcontratista puede ser un técnico del directorio de trabajadores? | Sí: link opcional a `trade_workers` donde `rol = 'subcontratado'` |
| ¿La factura al subcontratista (lo que nos cobra) se registra en TrabFlow? | No en esta fase. Solo se registra el importe como coste. Factura del subcontratista se guarda como nota/adjunto. Fase futura: adjuntar PDF. |
| ¿Qué pasa si el subcontratista factura más de lo previsto? | Se puede editar `importe_subcontrata` y el sistema avisa si el margen baja por debajo del 10%. |
| ¿La subcontrata puede existir sin trabajo vinculado? | Sí: puede ser un servicio puntual no planificado previamente. |
| ¿El IVA de la subcontrata se gestiona? | No de cara al cliente (él ve precio final con IVA normal). Internamente: el coste de subcontrata es un gasto que incluye el IVA que nos cobra el subcontratista. |
| Subcontrata cancelada tras confirmación | Estado → cancelado, con nota obligatoria del motivo. Si ya había importe comprometido, aparece en alertas. |

---

## 15. KPIs del módulo (panel de subcontratas)

```
┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  Este mes      │  │  Pendientes    │  │  Coste total   │  │  Margen medio  │
│  8 subcontr.   │  │  3 sin confirmar│  │  2.340 €       │  │  24,5%         │
└────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘
```

---

## 16. Plan de implementación por fases

### Fase 1 — Core (lo mínimo funcional)
- Migración BD: `trade_subcontracts` + `trade_subcontractors`
- `ScreenSubcontratas.tsx`: lista + form básico
- Cálculo automático margen → precio cliente
- Log de notas cronológico
- Badge `[SC]` en planificación
- Sidebar item (plan Empresa)
- **Estimación:** 2 días

### Fase 2 — Integración facturación
- Botón "Facturar al cliente" desde subcontrata
- Creación/edición de factura con línea de subcontrata
- `invoice_id` enlazado
- **Estimación:** 1 día

### Fase 3 — Rentabilidad
- Desglose coste subcontrata en ScreenIngresos
- Margen real por trabajo
- **Estimación:** 0,5 días

### Fase 4 — Directorio y notificaciones (futuro)
- Directorio completo con historial y valoraciones
- Alertas automáticas de plazos
- Adjuntar factura del subcontratista (PDF)

---

## 17. Resumen de prioridades respecto a otros módulos

```
URGENTE          → Multi-perfil Fase 1 (registro técnico crea empresa)
SIGUIENTE        → Subcontratas Fase 1 + 2 (core + facturación)
DESPUÉS          → Multi-perfil Fase 2-3 (selector + indicador activo)
FUTURO           → Subcontratas Fase 3-4 + Multi-perfil Fase 4-5
```

---

*Documento de análisis — no implementar sin revisión y aprobación del flujo UX.*  
*Próxima acción: confirmar prioridad (multi-perfil primero o subcontratas primero) para proceder.*
