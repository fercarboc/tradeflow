# Análisis: Sistema Multi-Perfil / Cambio de Empresa en TrabFlow AI

**Fecha:** 2026-06-14  
**Estado:** Análisis — pendiente de aprobación antes de implementar  
**Afecta a:** SessionContext, ScreenLogin/Register, OnboardingWizard, AppDashboardView, mobile nav, notificaciones, datos de trabajos

---

## 1. Problema raíz

Un usuario (p. ej. un fontanero autónomo) puede tener **dos contextos** simultáneos en TrabFlow:

| Contexto | Relación con la plataforma | Rol |
|---|---|---|
| **Empresa ajena** | Invitado por su jefe | `tecnico` |
| **Su propio negocio** | Creó su propia cuenta | `owner` |

Hoy, al hacer login, el sistema elige uno (membresía de otra org si existe, la propia si no) y el otro queda inaccesible. El usuario no puede elegir ni cambiar.

---

## 2. Escenarios reales a cubrir

### 2a. Técnico empleado que quiere montar su empresa (NUEVO — el más importante)
- Juan trabaja como técnico de campo en "Fontanería García S.L."
- Decide empezar a hacer trabajos propios y quiere darse de alta en TrabFlow.
- Su email (`juan@gmail.com`) ya existe porque García le invitó como técnico.
- **Flujo esperado:** Juan entra en la página de registro, escribe su email → el sistema detecta que ya existe como técnico → le ofrece crear su propia empresa sin pedirle contraseña nueva (ya la tiene) → elige un plan → ahora tiene dos perfiles.

### 2b. Técnico empleado + autónomo consolidado
- Juan ya tiene ambos perfiles creados.
- Al hacer login elige en cuál quiere trabajar.
- Puede cambiar de perfil durante la jornada.

### 2c. Técnico que trabaja para varias empresas
- María está dada de alta como técnica en "Empresa A" y en "Empresa B".
- Dependiendo del día trabaja para una u otra.
- Necesita elegir cuál carga al inicio de sesión.

### 2d. Administrador/comercial + propietario
- Pedro tiene su propio estudio (owner) y además gestiona presupuestos para "Constructora X" como `comercial`.

### 2e. Un solo perfil (caso mayoritario — NO debe verse afectado)
- La gran mayoría de usuarios: solo tienen su empresa o solo son técnicos.
- Login directo, sin pantallas extra, igual que ahora.

---

## 3. Flujo de ALTA cuando el email ya existe (Escenario 2a)

Este es el flujo nuevo más crítico a implementar.

```
Usuario entra en https://trabflow.com/registro
        │
        ▼
  Escribe su email
        │
        ▼
  [Al salir del campo email, verificación silenciosa]
  ¿Existe este email en Supabase Auth?
        │
   ┌────┴────────────────────────────────────────────────────┐
   │ NO existe                                               │ SÍ existe → consultar perfil
   └────┬────────────────────────────────────────────────────┘
        │                                                          │
        ▼                                                          ▼
  Flujo normal de registro                          ¿Qué rol tiene actualmente?
  (nombre, empresa, contraseña,                              │
   plan, pago)                                    ┌──────────┴──────────┐
                                                  │                     │
                                            Ya es OWNER             Es TECNICO/MIEMBRO
                                            de su propia org        de otra org
                                                  │                     │
                                                  ▼                     ▼
                                         ❌ BLOQUEADO             ✅ PERMITIDO
                                         "Ya tienes una           "Hemos encontrado tu cuenta.
                                          empresa registrada       Inicia sesión para crear
                                          en TrabFlow.             tu propia empresa."
                                          Inicia sesión."
                                                                        │
                                                                        ▼
                                                              [Iniciar sesión con contraseña actual]
                                                              (NO se pide nueva contraseña)
                                                                        │
                                                                        ▼
                                                              Wizard abreviado: solo
                                                              nombre empresa + plan + pago
                                                                        │
                                                                        ▼
                                                              Se crea trade_organizations
                                                              con owner_id = user.id
                                                                        │
                                                                        ▼
                                                              Usuario tiene 2 perfiles →
                                                              selector de perfil en próximo login
```

### Pantalla intermedia para técnico con email existente

Cuando el sistema detecta que el email ya existe y el usuario es técnico, mostrar:

```
┌────────────────────────────────────────────────────────┐
│  👋 ¡Hola, Juan!                                       │
│                                                        │
│  Tu email ya tiene acceso a TrabFlow como              │
│  técnico de "Fontanería García S.L."                   │
│                                                        │
│  ¿Quieres crear también tu propia empresa?             │
│  Mantén tu acceso actual y añade un nuevo perfil       │
│  como autónomo / propietario.                          │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Contraseña actual                               │  │
│  │  [····················]                          │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  [Continuar con mi cuenta →]                           │
│                                                        │
│  ¿No eres tú? Usa otro email                           │
└────────────────────────────────────────────────────────┘
```

Tras autenticarse con su contraseña actual (sin campo de nueva contraseña):

```
┌────────────────────────────────────────────────────────┐
│  🏢 Crea tu empresa                                    │
│                                                        │
│  Nombre de tu empresa *                                │
│  [Juan López Instalaciones]                            │
│                                                        │
│  Oficio principal                                      │
│  [Fontanería ▼]                                        │
│                                                        │
│  Elige tu plan:                                        │
│  ○ Básico — 0€/mes (limitado)                          │
│  ● Profesional — 29€/mes ← recomendado para autónomos │
│  ○ Empresa — 79€/mes                                   │
│                                                        │
│  [Crear mi empresa →]                                  │
└────────────────────────────────────────────────────────┘
```

### Reglas de negocio del alta abreviada

| Condición del email | Resultado |
|---|---|
| Email nuevo, no existe en Auth | Flujo de registro completo (nombre, empresa, contraseña, plan) |
| Email existe, rol = `owner` en su propia org | Bloqueo total. "Ya tienes empresa. Inicia sesión." |
| Email existe, rol = `tecnico`/`comercial`/`miembro` en org ajena | Alta abreviada: login con contraseña actual + datos empresa + plan |
| Email existe, sin org propia ni membresía (raro, cuenta huérfana) | Tratar como técnico: permitir alta de empresa |

---

## 4. Modelo de datos: qué define un "perfil"

Un perfil activo = combinación de:
```typescript
interface ActiveProfile {
  org_id: string           // La organización que está activa
  org_nombre: string       // Para mostrar en la UI
  rol: Rol                 // 'owner' | 'tecnico' | 'comercial' | ...
  member_id?: string       // Si es miembro invitado (no owner)
  worker_profile_id?: string // Si es técnico de campo con perfil worker
  es_propia: boolean       // true si es su propia empresa (owner)
}
```

Un usuario tiene múltiples perfiles si:
- Tiene `trade_organizations` donde `owner_id = user.id`, **Y**
- Tiene registros en `trade_org_members` donde `activo = true` en orgs **distintas** a la suya

---

## 5. Flujo de LOGIN cuando hay múltiples perfiles

```
Usuario introduce email + contraseña
        │
        ▼
  Supabase Auth OK
        │
        ▼
  loadAllProfiles(user.id) → Profile[]
        │
   ┌────┴────┐
   │  1 solo │  ──────────────────────────────► App directa (flujo actual, SIN cambios)
   └────┬────┘
        │ 2 o más
        ▼
  ¿Hay perfil guardado en localStorage con remember_until válido?
        │
   ┌────┴────┐
   │   Sí   │  ──► Cargar ese perfil directamente (el usuario eligió "recordar")
   └────┬────┘
        │ No / expirado
        ▼
  ┌──────────────────────────────────────────┐
  │  "¿Con qué perfil deseas trabajar hoy?"  │
  │                                          │
  │  🏢 Fontanería García S.L.               │
  │     Técnico de campo · 3 trabajos hoy   │
  │     [Entrar →]                           │
  │                                          │
  │  🏠 Juan López Instalaciones             │
  │     Propietario · Plan Profesional       │
  │     [Entrar →]                           │
  │                                          │
  │  ☐ Recordar esta elección 7 días         │
  └──────────────────────────────────────────┘
        │ usuario elige
        ▼
  Guardar en localStorage si "recordar" marcado
        │
        ▼
  Cargar contexto del perfil elegido → App
```

---

## 6. Indicador de perfil activo — siempre visible

El usuario debe saber **EN TODO MOMENTO** en qué perfil está trabajando.

### Desktop (sidebar)
```
┌─────────────────────────┐
│ [JL] JUAN LÓPEZ         │
│ 🏠 Juan López Inst.     │  ← Nombre de la org activa
│ ● Propietario           │  ← Rol actual
│                         │
│  ⇄ Cambiar empresa      │  ← Botón siempre visible (solo si tiene ≥2 perfiles)
└─────────────────────────┘
```

Cuando está en perfil técnico:
```
┌─────────────────────────┐
│ [JL] JUAN LÓPEZ         │
│ 🏢 Fontanería García    │  ← Org del jefe (icono empresa ajena)
│ ● Técnico de campo      │
│                         │
│  ⇄ Cambiar empresa      │
└─────────────────────────┘
```

### Mobile (header)
- Badge existente: `TÉCNICO · Fontanería García` / `AUTÓNOMO · Juan López Inst.`
- Icono `⇄` en el header para cambio rápido (solo si tiene ≥2 perfiles)

### Banner de advertencia (crítico)
Cuando el usuario tiene trabajos `en_curso` en UN perfil y está viendo OTRO:
```
⚠️ Tienes 2 trabajos en curso en "Fontanería García". Estás trabajando como autónomo.
   [Cambiar a Fontanería García]
```

---

## 7. Cambio de perfil mid-session

```
Usuario pulsa "⇄ Cambiar empresa"
        │
        ▼
  ¿Hay trabajos "en_curso" en el perfil actual?
        │
   ┌────┴────┐
   │   Sí   │ ──► Modal advertencia:
   └─────────┘     "Tienes el trabajo #123 en curso.
                    ¿Seguro que quieres cambiar?"
                    [Cancelar] [Cambiar igualmente]
        │
        ▼
  Mostrar selector de perfiles (mismo componente que post-login)
        │
        ▼
  Cancelar requests pendientes (AbortController)
        │
        ▼
  Limpiar estado: jobs, facturas, presupuestos, clientes
        │
        ▼
  Cargar contexto del nuevo perfil
        │
        ▼
  Actualizar localStorage
```

---

## 8. Implicaciones de datos críticas

### 8a. Trabajos — ¿a qué org pertenece?
Cada `trade_job` tiene `org_id`. Al crear trabajo:
- Si está en perfil "Mi empresa" → `org_id = su propia org`
- Si está en perfil "Fontanería García" → `org_id = org del jefe`

**Chip visible al crear:**
```
[ + Nuevo Trabajo ]
💾 Se guardará en: Fontanería García S.L.
```

### 8b. Facturas y presupuestos
- Pertenecen a la org activa en el momento de crearlos.
- Mismo chip de org activa en formularios.

### 8c. Clientes, catálogo, tarifas
- Cada org es un silo independiente. No se comparten datos entre orgs.
- Al cambiar de perfil, todo el contenido se recarga desde cero.

---

## 9. Notificaciones push multi-perfil

- Mantener suscripciones push activas para **todas las orgs** del usuario.
- Payload de cada notificación incluye `org_id` y `org_nombre`.
- Notificación visible aunque el usuario esté en otro perfil:
  ```
  🔔 Fontanería García: Nuevo trabajo asignado para mañana
  ```
- Al pulsar la notificación → cambio automático al perfil correspondiente si es necesario.

---

## 10. Sesión y persistencia en localStorage

```typescript
// Clave: tf_active_profile
interface StoredProfile {
  user_id: string
  org_id: string
  rol: Rol
  chosen_at: string       // ISO timestamp
  remember_until?: string // ISO timestamp — si eligió "recordar X días"
}
```

| Situación | Comportamiento |
|---|---|
| Sin perfil guardado | Muestra selector siempre |
| `remember_until` válido | Carga perfil guardado directamente |
| `remember_until` expirado | Muestra selector |
| Perfil guardado pero usuario fue revocado | Filtra ese perfil y muestra selector |
| localStorage borrado (modo privado) | Muestra selector (comportamiento correcto) |

---

## 11. Cambios técnicos necesarios

### 11a. `src/lib/supabase.ts`
```typescript
// Nueva función
export async function loadAllProfiles(userId: string): Promise<ActiveProfile[]>
// Consulta:
// 1. trade_organizations WHERE owner_id = userId → perfil "owner"
// 2. trade_org_members WHERE user_id = userId AND activo = true
//    JOIN trade_organizations → perfiles "miembro"
// Devuelve array ordenado: org propia primero, luego por fecha de invitación
```

### 11b. `src/context/SessionContext.tsx`
```typescript
// Nuevo estado
availableProfiles: ActiveProfile[]

// Nueva acción exportada desde el contexto
switchProfile: (profile: ActiveProfile) => Promise<void>
// → cancela requests, limpia estado, carga nuevo perfil, actualiza localStorage
```

### 11c. Nuevos componentes

| Componente | Ubicación | Función |
|---|---|---|
| `ProfileSelector` | `src/components/ProfileSelector.tsx` | Pantalla de selección post-login o mid-session |
| `ActiveProfileBadge` | Dentro de sidebar y mobile header | Muestra org+rol+botón cambio |
| `SaveToOrgChip` | Formularios de crear trabajo/presupuesto/factura | Badge "Se guardará en: X" |

### 11d. `src/components/ScreenLogin.tsx` o página de registro
- Verificar email al escribirlo (llamada a edge function o RPC)
- Si existe como técnico → mostrar flujo abreviado
- Si existe como owner → bloqueo
- Si no existe → flujo normal

### 11e. Wizard de alta abreviada
- Reutilizar pasos del `OnboardingWizard` existente, pero:
  - Sin paso de contraseña (usuario ya autenticado)
  - Sin paso de email (ya conocido)
  - Solo: nombre empresa, oficio, plan, pago
  - Puede ser 3-4 pasos en vez de los 8 del wizard completo

---

## 12. Verificación del email en el registro: implementación

La verificación silenciosa del email durante el registro se puede hacer de dos formas:

### Opción A — Edge function (recomendada)
```typescript
// Edge function: check-email-profile
// Input: { email: string }
// Output: { exists: false } | { exists: true, type: 'owner' | 'tecnico' | 'orphan', org_nombre?: string }
// Usa service_role para consultar auth.users sin exponer datos
```
Ventaja: seguro, no expone información en cliente.

### Opción B — RPC en Supabase
```sql
-- Función SQL con SECURITY DEFINER
CREATE FUNCTION check_email_for_registration(p_email text)
RETURNS json AS $$
DECLARE
  v_user_id uuid;
  v_has_own_org boolean;
  v_member_org_name text;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  IF v_user_id IS NULL THEN RETURN '{"exists": false}'::json; END IF;
  
  SELECT EXISTS(SELECT 1 FROM trade_organizations WHERE owner_id = v_user_id)
  INTO v_has_own_org;
  
  IF v_has_own_org THEN RETURN '{"exists": true, "type": "owner"}'::json; END IF;
  
  SELECT o.nombre INTO v_member_org_name
  FROM trade_org_members m JOIN trade_organizations o ON o.id = m.org_id
  WHERE m.user_id = v_user_id AND m.activo = true LIMIT 1;
  
  IF v_member_org_name IS NOT NULL THEN
    RETURN json_build_object('exists', true, 'type', 'tecnico', 'org_nombre', v_member_org_name);
  END IF;
  
  RETURN '{"exists": true, "type": "orphan"}'::json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 13. Plan de implementación por fases

### Fase 0 — Fix urgente (YA HECHO)
- ✅ SessionContext prioriza membresía en org ajena sobre org propia
- Resuelve el bug de técnico con org propia que ve panel completo

### Fase 1 — Registro de técnico que quiere crear empresa (PRÓXIMA)
**Objetivo:** Un técnico puede darse de alta como autónomo sin perder su acceso como empleado.
- Edge function / RPC `check-email-for-registration`
- Detección de email en formulario de registro
- Pantalla intermedia: "Hemos encontrado tu cuenta como técnico"
- Login con contraseña actual (sin campo nueva contraseña)
- Wizard abreviado 3 pasos: empresa + oficio + plan + pago
- Creación de `trade_organizations` con `owner_id = user.id`
- **Estimación:** 1,5 días

### Fase 2 — Selector de perfil post-login
**Objetivo:** Usuario con múltiples perfiles puede elegir cuál cargar.
- `loadAllProfiles()` en supabase.ts
- Componente `ProfileSelector`
- Integración en SessionContext (`availableProfiles`, `switchProfile`)
- Persistencia con "recordar X días"
- **Estimación:** 1 día

### Fase 3 — Indicador de perfil activo + cambio mid-session
**Objetivo:** Usuario siempre sabe en qué contexto está trabajando.
- `ActiveProfileBadge` en sidebar (desktop) y header (móvil)
- Botón "⇄ Cambiar empresa" (solo visible si ≥2 perfiles)
- Modal de advertencia si hay trabajos en_curso al cambiar
- Banner warning cuando hay trabajos en_curso en otro perfil
- **Estimación:** 1 día

### Fase 4 — Seguridad de datos
**Objetivo:** Nunca crear datos en la org equivocada.
- `SaveToOrgChip` en formularios de nuevo trabajo, presupuesto, factura
- **Estimación:** 0,5 días

### Fase 5 — Notificaciones multi-org (futuro)
- Payload con `org_nombre` en todas las notificaciones push
- Tap en notificación → auto-switch al perfil correcto

---

## 14. Casos edge y riesgos

| Caso | Riesgo | Solución |
|---|---|---|
| Técnico intenta registrar email ya existente como owner | Crear segunda org | Bloqueo total en fase de registro |
| Técnico crea empresa y luego su jefe le revoca acceso | Queda solo con su propia org | `loadAllProfiles()` filtra revocados; baja a 1 perfil → sin selector |
| Usuario tiene ≥3 orgs (trabaja para múltiples empresas) | Selector demasiado largo | Lista scrollable con buscador |
| Pago fallido en alta abreviada | Org creada sin suscripción | Plan gratuito por defecto, se puede mejorar luego desde ajustes |
| Cambio de perfil con request API en vuelo | Race condition / datos mixtos | AbortController antes de cambiar contexto |
| localStorage borrado | Siempre pregunta perfil | Comportamiento correcto y seguro |
| Técnico sin email registrado quiere crear empresa | No puede usar flujo abreviado | Añadir email en ScreenEquipo → luego usar flujo normal de registro |
| Org del jefe eliminada | Perfil "Fontanería García" desaparece | `loadAllProfiles()` lo excluye; si queda ≥1 perfil, va directo |

---

## 15. Resumen de prioridades

```
YA HECHO     → Fix SessionContext (técnico con org propia ve panel correcto)

PRÓXIMO      → Fase 1: Registro de técnico que quiere crear su empresa
               (más valor de negocio: convierte técnicos en clientes de pago)

DESPUÉS      → Fase 2-3: Selector de perfil + indicador activo
               (cuando haya usuarios con múltiples perfiles reales)

FUTURO       → Fases 4-5: Seguridad de datos + notificaciones multi-org
```

---

*Documento de análisis — no implementar sin revisión y aprobación del flujo UX.*  
*Próxima acción: confirmar Fase 1 para proceder con la implementación.*
