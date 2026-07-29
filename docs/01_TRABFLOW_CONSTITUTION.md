# TrabFlow Constitution

**Versión:** 1.0 — Julio 2026  
**Estado:** Normativo. Toda decisión de arquitectura, producto y diseño debe respetar este documento.  
**Propósito:** Recoger los principios técnicos, de producto y de diseño que gobiernan TrabFlow. Cuando exista duda entre dos caminos, este documento da la respuesta.

---

## Índice

1. [Principios de producto](#1-principios-de-producto)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Reglas de base de datos](#3-reglas-de-base-de-datos)
4. [Reglas de seguridad](#4-reglas-de-seguridad)
5. [Reglas de frontend](#5-reglas-de-frontend)
6. [Design System y UX](#6-design-system-y-ux)
7. [Product Language](#7-product-language)
8. [Accesibilidad](#8-accesibilidad)
9. [Motor IA](#9-motor-ia)
10. [Marketplace y B2B](#10-marketplace-y-b2b)
11. [Core ERP](#11-core-erp)
12. [Futuras integraciones](#12-futuras-integraciones)
13. [Architecture Decision Records](#13-architecture-decision-records)
14. [Normas para nuevos módulos](#14-normas-para-nuevos-módulos)

---

## 1. Principios de producto

### 1.1 El instalador primero
Cada decisión se toma pensando en el instalador en obra, no en el desarrollador en su ordenador. Si una feature no tiene valor en obra, no entra.

### 1.2 Menos clics, más trabajo hecho
La app debe hacer el trabajo, no añadirlo. Un presupuesto se crea más rápido con TrabFlow que a mano. Una factura se genera en un clic desde el presupuesto. Un parte de trabajo se rellena en 30 segundos desde el móvil.

### 1.3 La IA es el fondo, no la portada
La inteligencia artificial es la ventaja competitiva, pero el instalador no debe sentir que usa una app de IA. Debe sentir que usa una app que simplemente funciona.

### 1.4 Móvil primero
El instalador usa el móvil en obra. Todo flujo crítico funciona perfectamente en móvil. Los flujos de gestión avanzada pueden ser solo web.

### 1.5 No añadir features, añadir valor
Una feature que complica el producto es peor que no añadirla. Solo entra si:
1. La pidieron 3 o más usuarios reales con las mismas palabras.
2. No puede cubrirse con lo que ya existe.
3. No complica los flujos existentes.

### 1.6 El producto es la demo
Si el producto no es suficientemente bueno para mostrarlo en vivo a un inversor sin preparación, no está listo para crecer.

---

## 2. Arquitectura del sistema

### 2.1 Stack tecnológico

| Capa | Tecnología | Razón |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | SPA, velocidad de desarrollo |
| Estilos | Tailwind CSS v4 | Utility-first, consistencia |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage) | BaaS completo, RLS nativa |
| Serverless | Supabase Edge Functions (Deno) | Lógica sensible fuera del cliente |
| IA | Anthropic Claude Haiku 4.5 (presupuestos, mantenimiento) + OpenAI Whisper (transcripción) + Voyage AI (embeddings) | Mejor calidad/coste para cada tarea |
| Billing | Stripe | Industria estándar |
| Mobile | Expo / React Native | Compartir lógica con web |
| Hosting | Vercel | CDN global, CI/CD |

### 2.2 Patrón de acceso a datos

**Regla:** Todo acceso a la base de datos se hace a través de **RPCs (Remote Procedure Calls) definidas en PostgreSQL**. No se hacen queries directas desde el cliente a las tablas.

**Razón:** Las RPCs permiten aplicar lógica de negocio en la base de datos, donde se aplica RLS. Una query directa puede saltarse lógica de negocio; una RPC no.

**Excepciones permitidas:** Reads simples sobre tablas con RLS correcta, donde no hay lógica de negocio (p.ej. `select * from trade_clients where org_id = ...`).

### 2.3 Capa de API en frontend

Las llamadas a Supabase se organizan en `src/lib/api/` — un archivo por dominio:

```
src/lib/api/
├── marketplace-actors.ts      # Actores del Marketplace
├── marketplace-checkout.ts    # Carrito y checkout
├── marketplace-orders.ts      # Ciclo de vida de pedidos
├── marketplace-portal.ts      # Portal del proveedor
├── marketplace.ts             # Productos universales y búsqueda
├── mayoristas.ts              # Mayoristas y compras
├── pedidos.ts                 # Pedidos clasicos (pre-Marketplace)
└── subcontratas.ts            # Subcontratas
```

El resto de funciones de negocio vive en `src/lib/supabase.ts` (monolito existente). La migración progresiva a `src/lib/api/` es deuda técnica aceptada.

### 2.4 Outbox pattern

Los eventos que requieren procesamiento asíncrono (notificaciones push tras checkout) se escriben en `trade_marketplace_outbox`. Un Edge Function (`marketplace-outbox-consumer`) los procesa.

**Regla:** No llamar a servicios externos (Web Push, email) directamente desde una transacción de BD. Usar el outbox.

### 2.5 Realtime

Supabase Realtime se usa para actualizaciones en tiempo real usando canales de Postgres Changes.

**Regla:** Toda suscripción Realtime debe:
1. Usar un `channelRef` para evitar suscripciones duplicadas.
2. Limpiar el canal en el return del `useEffect`.
3. Filtrar por `org_id` o identificador equivalente — nunca suscribir a toda una tabla.
4. Mostrar indicador visual "En vivo" / "Reconectando".

**Decisión ADR-001:** Realtime en el portal del proveedor está diferido hasta confirmar que `supplier_actor_id` existe en el esquema y está cubierto por RLS. Ver `docs/adr/ADR-001-realtime-portal-proveedor.md`.

---

## 3. Reglas de base de datos

### 3.1 Row Level Security (RLS)

**Regla absoluta:** Toda tabla que contenga datos de usuario tiene RLS habilitada. Sin excepciones.

**Formato de política:**
```sql
-- SELECT: el usuario ve solo su organización
CREATE POLICY "org members only" ON trade_<tabla>
  FOR SELECT USING (org_id = (SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() LIMIT 1));
```

**Hardening aplicado (jun 2026):**
- `REVOKE EXECUTE ON FUNCTION <fn> FROM anon` en todas las funciones SECURITY DEFINER que no deben ser accesibles sin autenticación.
- RLS habilitado y auditado en `trade_supplier_orders`, `trade_marketplace_*`.

### 3.2 Funciones SECURITY DEFINER

**Regla:** Las funciones con `SECURITY DEFINER` deben usar `public.<tabla>` explícitamente en todas sus queries, no `<tabla>` a secas.

**Razón:** PostgreSQL con `search_path` variable puede resolver el nombre de tabla en un esquema inesperado si no se prefija con `public.`. Esto invalida la caché del schema de PostgREST y causa errores 404 en toda la API.

```sql
-- ✅ Correcto
SELECT * FROM public.trade_quotes WHERE org_id = _org_id;

-- ❌ Incorrecto — puede fallar con PostgREST
SELECT * FROM trade_quotes WHERE org_id = _org_id;
```

### 3.3 Migraciones

- Todas las migraciones viven en `supabase/migrations/`.
- Nombre: `YYYYMMDD_descripcion_corta.sql`.
- Cada migración es idempotente cuando es posible (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
- Una migración no puede modificar datos de producción sin una migración de rollback documentada.

### 3.4 Nomenclatura de tablas

- Prefijo `trade_` en todas las tablas del dominio principal.
- Prefijo `trade_marketplace_` en todas las tablas del Marketplace.
- Prefijo `admin_` en tablas de uso exclusivo del panel de administración.
- Nombres en `snake_case`.

### 3.5 Tipo generado (supabase.gen.ts)

El archivo `src/supabase.gen.ts` (13.131 líneas) se genera con Supabase CLI. Debe regenerarse tras cada sprint que incluya migraciones.

**Deuda actual:** Las RPCs del Marketplace no están tipadas en `supabase.gen.ts`. Como consecuencia, se usa `(supabase as any).rpc(...)` en todos los archivos de `src/lib/api/`. Esta deuda debe resolverse regenerando el tipo en Sprint 2.

---

## 4. Reglas de seguridad

### 4.1 Secrets y claves

- **Nunca** escribir la `service_role` key de Supabase en: migraciones, repositorio, logs, documentación, mensajes.
- Las variables de entorno se cargan con Vite (`import.meta.env.VITE_*`).
- Las claves de servicios externos (OpenAI, Anthropic, Voyage AI, VAPID) viven solo en las Edge Functions como variables de entorno de Deno. Nunca en el cliente.

### 4.2 Funciones de admin

Las funciones que requieren permisos de plataforma (no de organización) se implementan como RPCs con `SECURITY DEFINER`. Solo las funciones con prefijo `admin_` están disponibles para el email de admin (`ADMIN_EMAIL` env var). El resto de usuarios reciben un error de autorización.

### 4.3 Tokens públicos

Las vistas públicas (presupuesto, factura, parte de trabajo, valoración) usan tokens UUID generados en BD. El token no es predecible. El endpoint público no devuelve datos si el token no existe o está expirado.

### 4.4 Protección de endpoints de Edge Functions

- Los endpoints que modifican datos requieren `Authorization: Bearer <jwt>` (Supabase JWT del usuario).
- Los endpoints públicos (webhook Stripe, vista pública de presupuesto) se protegen con secrets propios o validando firma (Stripe webhook secret).

---

## 5. Reglas de frontend

### 5.1 No definir sub-componentes dentro de la función padre

```tsx
// ❌ Incorrecto — se re-monta en cada render del padre → pérdida de foco en inputs
function Parent() {
  function Child() { return <input />; }
  return <Child />;
}

// ✅ Correcto — definir a nivel de módulo
function Child() { return <input />; }
function Parent() { return <Child />; }
```

**Razón:** React desmonta y remonta el sub-componente en cada render del padre porque es una nueva referencia de función.

### 5.2 Estructura de archivos

- Un componente por archivo.
- Los componentes compartidos entre módulos van en `src/components/marketplace/shared/`.
- Los componentes UI atómicos van en `src/components/ui/`.
- La lógica de acceso a datos va en `src/lib/api/`, nunca inline en los componentes.

### 5.3 Manejo de estado asíncrono

Patrón estándar para carga de datos:
```tsx
const [data, setData] = useState<Tipo | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  let cancelled = false;
  async function load() {
    try {
      const result = await fetch...();
      if (!cancelled) setData(result);
    } catch (e) {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Error');
    } finally {
      if (!cancelled) setLoading(false);
    }
  }
  load();
  return () => { cancelled = true; };
}, [deps]);
```

### 5.4 Lazy loading

Las vistas pesadas se cargan con lazy loading en `App.tsx`:
```tsx
const AppDashboardView = lazy(() => import('./components/AppDashboardView'));
```

Obligatorio para: `AppDashboardView`, `AdminView`, `ScreenWorkerView`, `DemoView`.

### 5.5 Tipos

- Usar siempre tipos explícitos. Evitar `any`.
- **Deuda actual:** 67 ocurrencias de `as any` en `src/`. La totalidad son en llamadas RPC del Marketplace — pendiente de resolver regenerando `supabase.gen.ts`.

---

## 6. Design System y UX

### 6.1 Tokens del Design System

Todos los estilos se aplican a través de los tokens de `src/design-system/index.ts`:

```tsx
import { DS } from '../design-system';

<button className={DS.btn.primary}>Confirmar pedido</button>
<span className={`${DS.badge.base} ${DS.badge.pending}`}>Pendiente</span>
```

**Regla:** No copiar manualmente clases de Tailwind en componentes nuevos cuando existe un token equivalente.

### 6.2 Paleta de colores

| Uso | Token |
|---|---|
| Primario | `teal-600` (hover: `teal-500`) |
| Fondo (light) | `slate-50` / cards: `white` |
| Fondo (dark) | `slate-950` / cards: `slate-900` |
| Borde | `slate-200` (dark: `slate-800`) |
| Texto principal | `slate-900` |
| Texto secundario | `slate-500` |
| Alerta | `amber-600` |
| Error | `red-600` |
| Éxito | `emerald-600` |

### 6.3 Dark mode

Todos los componentes definen variantes `dark:*`. El toggle del usuario estampa `data-theme="dark"` en el root.

```tsx
// ✅ Correcto
<div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
```

### 6.4 Motion

Todas las transiciones usan prefijo `motion-safe:` para respetar `prefers-reduced-motion`.

```tsx
// ✅ Correcto
<div className="motion-safe:transition-colors motion-safe:animate-pulse">
```

### 6.5 Skeletons y estados de carga

```tsx
{loading ? (
  <div className="motion-safe:animate-pulse space-y-3">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="h-28 rounded-xl bg-slate-200 dark:bg-slate-800" />
    ))}
  </div>
) : items.map(...)}
```

---

## 7. Product Language

### 7.1 Regla general

Si un término requiere conocimiento técnico previo para entenderse, se sustituye. La interfaz habla el idioma del instalador, no del programador.

### 7.2 Términos correctos (referencia)

| No usar | Usar en su lugar |
|---|---|
| Checkout | Comprar material |
| Wizard / Steps | Revisar pedido / Confirmar pedido |
| Offering / SKU | Proveedor recomendado / Referencia |
| Match / Matching | Coincidencia / Vinculado |
| Score X pts | Recomendado / Bueno / Disponible |
| Dashboard | Inicio |
| pending / confirmed (en inglés crudo) | Pendiente / Confirmado |

### 7.3 Estados de pedido — instalador

| Interno | Mostrar |
|---|---|
| `pending` | Pendiente |
| `confirmed` | Confirmado |
| `preparing` | Preparando |
| `shipped` | En tránsito |
| `delivered` | Recibido |
| `completed` | Completado |
| `cancelled` | Cancelado |

### 7.4 Estados de pedido — proveedor

| Interno | Mostrar |
|---|---|
| `pending` | Pedido |
| `confirmed` | Confirmado |
| `preparing` | Preparando |
| `shipped` | Enviado |
| `delivered` | Entregado |
| `completed` | Completado |
| `cancelled` | Cancelado |

**Referencia UI/UX:** `docs/design-system/PRODUCT_LANGUAGE_v1.md` (estados de pedido, botones, mensajes de interfaz)  
**Referencia comercial:** `docs/PRODUCT_LANGUAGE.md` (julio 2026 — términos aprobados/prohibidos, mensajes para 6 audiencias)

---

## 8. Accesibilidad

### 8.1 Requisitos mínimos

| Elemento | Requisito |
|---|---|
| Botón icono sin texto | `aria-label` descriptivo |
| Botón expandir/colapsar | `aria-expanded` |
| Modal | `role="dialog"` + `aria-modal` + `aria-labelledby` |
| Alerta / toast | `role="alert"` + `aria-live="assertive"` |
| Contador dinámico | `aria-live="polite"` + `aria-atomic` |
| Paso activo en wizard | `aria-current="step"` |
| Focus visible | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500` |
| Tamaño táctil | Mínimo 44×44px en acciones primarias móvil |

### 8.2 Componentes compartidos accesibles

Los siguientes componentes de `src/components/marketplace/shared/` cumplen estos requisitos:
- `ConfirmModal.tsx` — focus trap, Escape, `role="dialog"`, `aria-modal`
- `OrderStatusBadge.tsx` — etiquetas ARIA correctas según rol (instalador/proveedor)
- `OrderTimeline.tsx` — `aria-current="step"`, `aria-label` en cada paso

---

## 9. Motor IA

### 9.1 Versión en producción

- **Versión:** v59
- **Edge Function:** `trade-voice-to-quote` (Deno)
- **Benchmark:** 400 casos — 98.2% de presupuestos generados correctamente
- **Modelo:** Claude Haiku 4.5 (partidas) + OpenAI Whisper (transcripción de audio)
- **max_tokens:** 8192 (universal, sin condicionales)

### 9.2 Proceso de promoción de versiones

Toda nueva versión del motor IA sigue el proceso documentado en `docs/ai-engine/PROMOTION_CRITERIA.md`:

1. Implementar cambio en Edge Function (nueva versión).
2. Ejecutar benchmark completo de 400 casos.
3. Comparar con versión anterior usando Regression Diff.
4. Cumplir todos los criterios de promoción (OK rate, TRUNCADO=0, PRECIO_INVALIDO=0).
5. Promover a producción con registro en `trade_ai_versions`.

**Regla:** Ningún cambio de prompt o de lógica de kbContext se despliega sin benchmark completo de 400 casos previo.

### 9.3 Límites del modelo actual

- La query "reforma compleja de 8192 tokens" excede el límite de output de Claude Haiku 4.5. El VACÍO residual en pos.374 del benchmark es irreducible con el modelo actual. Resolución pendiente en Sprint 5: reducir kbContext a ≤3 actuaciones cuando `tokens_in` supere umbral.
- Latencia P95 en benchmark: 30.6s (en umbral de alerta). Monitorizar en producción.

### 9.4 Normalización del lenguaje técnico en IA

El motor IA nunca expone al usuario el resultado bruto del modelo. Siempre se aplica el Product Language antes de mostrar cualquier texto generado por IA.

### 9.5 Chatbot de ayuda

- **Edge Function:** `trade-chatbot`
- **Modelo:** Claude Haiku 4.5
- **Alcance:** Conoce todos los módulos de la app. Responde preguntas sobre funcionalidades. No hace cambios en datos.
- Las preguntas que el chatbot no puede responder se guardan en `trade_installer_needs` para análisis posterior.

---

## 10. Marketplace y B2B

### 10.1 Modelo de datos del Marketplace

El Marketplace usa un sistema de actores independiente del sistema de usuarios:

```
trade_marketplace_actors         → Empresa proveedora (actor)
trade_marketplace_actor_members  → Usuarios del actor (con roles)
trade_marketplace_roles          → Permisos del actor (orders:manage, offerings:write, etc.)
trade_marketplace_supplier_offerings → Catálogo del proveedor
trade_marketplace_universal_products → Catálogo universal TrabFlow
trade_marketplace_carts          → Carrito del instalador
trade_marketplace_orders         → Pedido confirmado
trade_marketplace_order_lines    → Líneas del pedido
trade_marketplace_order_events   → Auditoría de cambios de estado
trade_marketplace_outbox         → Eventos pendientes de procesamiento asíncrono
```

### 10.2 Ciclo de vida de un pedido

```
pending → confirmed → preparing → shipped → delivered → completed
                                                       ↘ cancelled (desde cualquier estado)
```

- `pending` → `confirmed`: proveedor confirma el pedido (acción del proveedor)
- `confirmed` → `preparing`: proveedor inicia preparación (acción del proveedor)
- `preparing` → `shipped`: proveedor marca como enviado + tracking URL (acción del proveedor)
- `shipped` → `delivered`: instalador confirma recepción (acción del instalador)
- `delivered` → `completed`: automático o manual tras valoración

### 10.3 Realtime

- **Instalador:** Realtime activo en `ScreenSeguimientoMaterial`. Canal `org-orders-{orgId}`. Filtro por `org_id`.
- **Proveedor:** Sin Realtime. La lista se actualiza tras cada acción del proveedor. Diferido por ADR-001.

### 10.4 Seguridad del Marketplace

- RLS en todas las tablas `trade_marketplace_*`.
- El proveedor solo ve sus propios pedidos (via RPC `get_supplier_orders_unified`).
- El instalador solo ve sus propios pedidos (via RPC `get_org_active_orders`).
- No es posible que un proveedor acceda a datos de otro proveedor.

### 10.5 Estrategias de selección de proveedor

El instalador puede elegir entre tres estrategias:
1. **Proveedor recomendado** (por defecto) — proveedor preferido aprendido automáticamente.
2. **Menor precio** — proveedor con precio total más bajo.
3. **Entrega más rápida** — proveedor con menos días de entrega.

El aprendizaje implícito de preferencias se registra en `trade_supplier_choices` → auto-promueve al proveedor preferido tras 3 elecciones del mismo.

### 10.6 Normas para nuevas funcionalidades del Marketplace

1. Toda nueva acción del proveedor que modifique datos pasa por una RPC SECURITY DEFINER.
2. Toda notificación al instalador o proveedor usa el outbox pattern.
3. Toda nueva columna en `trade_marketplace_orders` se audita en una política RLS antes de usarse en filtros de Realtime.
4. El Product Language del Marketplace se aplica en toda pantalla nueva — ver sección 7.

---

## 11. Core ERP

### 11.1 Módulos del ERP

El ERP cubre: Presupuestos, Facturas, Clientes, Trabajos, Equipo, Mantenimiento, Contratos, Rutas.

### 11.2 Reglas para el ERP

1. **Un presupuesto, una fuente de verdad.** La tabla `trade_quotes` es la fuente de verdad. El PDF se genera desde ahí, no desde datos locales del componente.
2. **Las facturas nacen de presupuestos.** La RPC `create_invoice_from_quote` es el único camino oficial. No crear facturas sin pasar por esta función.
3. **Los partes de trabajo son inmutables tras firma.** Una vez firmado el parte (`trade_field_actions` con firma digital), no se puede modificar desde la UI.
4. **El equipo tiene roles con permisos.** Los roles `owner`, `admin`, `oficina`, `comercial`, `tecnico`, `visualizador` tienen permisos distintos definidos en `usePermissions.ts`. No saltarse este sistema añadiendo lógica de permisos inline.

### 11.3 Deuda técnica del ERP

- `AppDashboardView.tsx` (10.617 líneas) es un monolito. La extracción por módulos es deuda técnica pendiente post-PMF.
- `src/lib/supabase.ts` (3.987 líneas) mezcla inicialización del cliente y lógica de negocio. Migración progresiva a `src/lib/api/` en curso.

---

## 12. Futuras integraciones

### 12.1 API pública (2027)

Cuando se implemente, la API pública de TrabFlow seguirá estas normas:
- REST sobre HTTPS, autenticación con API key de organización.
- Endpoints solo de lectura en la primera versión (inventario, estado de pedidos).
- Rate limiting desde el primer día.
- Versioning semántico (`/v1/`, `/v2/`).

### 12.2 Webhooks de proveedor (2027)

El proveedor podrá registrar un endpoint HTTPS que reciba eventos de pedidos. Los webhooks se firman con un secret (HMAC-SHA256). El proveedor debe verificar la firma. No se hace retrying indefinido — máximo 3 intentos con backoff exponencial.

### 12.3 Stripe Connect (2027)

Cuando se implemente el modelo de comisión:
- El proveedor crea una cuenta Stripe Connect.
- TrabFlow actúa como plataforma (platform account).
- El split de pago se configura con `application_fee_amount`.
- Los pagos directos entre instalador y proveedor no pasan por TrabFlow.

### 12.4 Integración con ERP de proveedor

La integración con ERP de proveedor (SAP, Sage, etc.) se hace via API REST push — el ERP del proveedor llama a TrabFlow. No al revés. TrabFlow no hace polling a sistemas externos.

---

## 13. Architecture Decision Records

Los ADR documentan decisiones arquitecturales significativas que no son obvias en el código. Viven en `docs/adr/`.

**ADRs existentes:**

| ADR | Decisión | Estado |
|---|---|---|
| ADR-001 | Realtime en PortalPedidos diferido | Aceptado |

**Formato de un ADR:**

```markdown
# ADR-NNN — Título de la decisión

**Estado:** Aceptado / Reemplazado por ADR-XYZ / Obsoleto
**Fecha:** YYYY-MM-DD

## Contexto
Por qué se tomó esta decisión.

## Opciones evaluadas
Lista de alternativas consideradas con pros/contras.

## Decisión
Qué se eligió y por qué.

## Consecuencias
Qué implica esta decisión para el sistema.
```

**Regla:** Toda decisión que rechace una alternativa razonable debe tener un ADR. "Era obvio" no es justificación — lo que es obvio hoy deja de serlo en 6 meses.

---

## 14. Normas para nuevos módulos

### 14.1 Antes de crear un módulo

1. Verificar que no existe funcionalidad equivalente ya implementada.
2. Definir en una frase: "Con este módulo, el instalador puede [X] en [tiempo] sin [dolor]."
3. Identificar las tablas nuevas necesarias y su impacto en RLS.
4. Crear un ADR si la decisión de arquitectura no es obvia.

### 14.2 Estructura de un módulo nuevo

```
src/components/
└── ScreenNuevoModulo.tsx       # Pantalla principal (definida a nivel de módulo)

src/lib/api/
└── nuevo-modulo.ts             # Capa de acceso a datos (RPCs)

supabase/migrations/
└── YYYYMMDD_nuevo_modulo.sql   # Schema + RLS + funciones RPC

supabase/functions/
└── trade-nuevo-modulo/         # Edge Functions si necesarias (lógica sensible o asíncrona)
```

### 14.3 Checklist de un módulo nuevo

- [ ] RLS habilitado en todas las tablas nuevas.
- [ ] Funciones SECURITY DEFINER usan `public.<tabla>`.
- [ ] Producto Language aplicado en todos los textos visibles.
- [ ] Design System tokens usados (no clases Tailwind manuales).
- [ ] `aria-label` / `aria-live` / `role` en todos los elementos interactivos y dinámicos.
- [ ] Dark mode definido en todos los elementos.
- [ ] `motion-safe:` prefijo en todas las animaciones.
- [ ] Sub-componentes definidos a nivel de módulo, no dentro del padre.
- [ ] Lazy loading si el bundle del componente supera ~100KB.
- [ ] Test de integración para la RPC principal.
- [ ] `supabase.gen.ts` regenerado tras las migraciones.
