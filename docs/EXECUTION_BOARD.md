# TrabFlow — Execution Board

**Versión:** 1.0 · Inicio RC-1  
**Última actualización:** 2026-07-28  
**Propósito:** Documento de gobierno único del proyecto. Primer documento que se consulta en cada sesión de trabajo. Indica dónde estamos, qué está terminado, qué está en curso, cuál es el siguiente paso y qué depende de qué.

> **Regla de uso:** Este documento se actualiza al terminar cada tarea o fase. Nunca al empezarla. Si el EXECUTION_BOARD no refleja la realidad, el proyecto pierde el control.

---

## 1. ESTADO ACTUAL

```
FASE ACTIVA
─────────────────────────────────────
  RC-1  ›  RC1-Alpha
  Commercial Readiness — Bloque 1 de 4

ESTADO GENERAL
  ████████░░░░░░░░░░░░  RC-1: 20% (2 de 11 bloques completados)
  ██████████████████░░  Producto: 90% (funcional, en consolidación)
  ░░░░░░░░░░░░░░░░░░░░  Pilotos externos: 0 / 4

ÚLTIMA ACCIÓN
  2026-07-28  Auditoría RC-1 completada
              docs/RC1_COMMERCIAL_READINESS.md
              docs/RC1_CHECKLIST.md
              docs/RC1_MVP_ELEMENTS.md

PRÓXIMA ACCIÓN
  RC1-C01 — Publicar NIF de TrabFlow Technologies S.L. en el Aviso Legal
```

---

## 2. FASES TERMINADAS

Lista cronológica de todo lo que ha quedado validado. No se modifica. Solo se añade.

---

**✔ FASE 0 — ERP Base + Motor IA**  
`Ene–Jun 2026`  
Presupuestos (voz, foto, manual), facturas, clientes, trabajos, ruta del día, equipo, roles, contratos de mantenimiento SAT, subcontratas, ingresos, exportaciones DOCX/CSV/PDF. Motor IA v1–v59 con 98.2% OK rate. Benchmark de 400 casos validado. Stripe billing con trial de 3 meses. Onboarding wizard de 7 pasos. Chatbot de ayuda. Asistente técnico normativa. Admin Panel. Push notifications. PWA instalable.

---

**✔ FASE 1 — Marketplace Connect Phase 2**  
`Jun–Jul 2026`  
Tres phases completas: 2A checkout integrado (wizard 2 pasos, auto-selección de proveedor), 2B seguimiento de material en tiempo real (Supabase Realtime, timeline animado), 2C portal del proveedor completo (dashboard con IA, pedidos, catálogo, equipo, configuración). Design System v1 y Product Language v1 publicados. ADR-001 formaliza la decisión de diferir Realtime en portal proveedor.

---

**✔ FASE 2 — Consolidación UX pre-piloto**  
`Jul 2026`  
Fixes de routing (AppDashboard sin pérdida de sub-vista). Fix de auth del portal proveedor (workspaceResolver con cliente correcto). Integración de pedidos Marketplace en ScreenPedidosMaterial. Mejoras UX-001/002/003/004/005. Commit base: 0707f85.

---

**✔ PZ-001A — Piloto Zero Interno**  
`2026-07-26 / 2026-07-27`  
Primer piloto operativo completo del Marketplace de extremo a extremo. 2 ciclos de pedido (MKT-000001, MKT-000002) completados. 11 bugs encontrados y resueltos (4 bloqueantes, 5 altos). 5 mejoras UX resueltas. Ciclo completo proveedor MKT-000002: confirmar 12:06 → recibido 12:09 (~3 min). Resultado: PASS. Documentado en `docs/pilot/PZ001A_COMPLETED.md`.

---

**✔ AUDITORÍA RC-1**  
`2026-07-28`  
Auditoría comercial completa del producto. 15 secciones de análisis. Checklist de ~100 ítems en 14 bloques. Inventario de elementos con aspecto MVP. Plan priorizado en 4 sprints (RC1-Alpha/Beta/Gamma/Delta). Documentado en `docs/RC1_COMMERCIAL_READINESS.md`, `docs/RC1_CHECKLIST.md`, `docs/RC1_MVP_ELEMENTS.md`.

---

## 3. FASE EN CURSO

```
FASE:        RC1-Alpha
TIPO:        Commercial Readiness — Bloque 1
OBJETIVO:    Limpiar todos los bloqueantes legales y de percepción
             que impiden presentar el producto a cualquier empresa externa.
RESULTADO    Ningún elemento crítico legal o de percepción "beta"
ESPERADO:    visible al abrir trabflow.com.
DOCUMENTOS   RC1_COMMERCIAL_READINESS.md (§ RC1-Alpha)
AFECTADOS:   RC1_CHECKLIST.md (Bloque 1: Legal y Cumplimiento)
             RC1_MVP_ELEMENTS.md (CRÍTICOS: RC1-C01 a RC1-C04)
             src/components/LegalViews.tsx
DURACIÓN     1–2 semanas
ESTIMADA:
PRERREQUISITO: Auditoría RC-1 completada ✔
DESBLOQUEA:    RC1-Beta (demo comercial) y PZ-001B (piloto instalador real)
```

### Tareas de RC1-Alpha (en orden de ejecución)

| Código | Tarea | Esfuerzo | Estado |
|--------|-------|---------|--------|
| RC1-C01 | Publicar NIF real en Aviso Legal | Bajo | ⬜ ACTIVA |
| RC1-C02 | Verificar y corregir domicilio social | Bajo | ⬜ Pendiente |
| RC1-C03 | Implementar banner de cookies (consentimiento básico) | Bajo-Medio | ⬜ Pendiente |
| RC1-C04-A | Activar Vercel Analytics o Posthog | Bajo | ⬜ Pendiente |
| RC1-C04-B | Reescribir página /beta → eliminar narrativa "beta privada" | Bajo | ⬜ Pendiente |
| RC1-C05 | Actualizar fecha "Mayo 2026" en todas las páginas legales | Bajo | ⬜ Pendiente |
| RC1-C06 | Limpiar /public (renombrar ChatGPT Image *.png y presupuesto pruebas.pdf) | Bajo | ⬜ Pendiente |

---

## 4. TAREA ACTIVA

```
CÓDIGO:      RC1-C01
NOMBRE:      Publicar NIF de TrabFlow Technologies S.L. en el Aviso Legal
ARCHIVO:     src/components/LegalViews.tsx  (línea 79)
CAMBIO:      Reemplazar "NIF: [PENDIENTE]" con el NIF real de la sociedad.
             También: actualizar nombre del representante legal si aplica.
BLOQUEA:     Cualquier reunión con empresa que revise documentación legal.
SIGUENTE:    RC1-C02 — Verificar domicilio social
ESTADO:      ⬜ PENDIENTE
```

> **Nota operativa:** Antes de ejecutar RC1-C01, Fernando debe confirmar el NIF real de TrabFlow Technologies S.L. (dato societario, no técnico). Sin ese dato, la tarea no puede completarse.

---

## 5. COLA DE EJECUCIÓN

El orden es fijo. No se modifica sin actualizar este documento y registrar la razón del cambio.

```
  ✔ PZ-001A             Piloto Zero Interno — COMPLETADO
  ✔ Auditoría RC-1      Análisis completo — COMPLETADO

  ▶ RC1-Alpha           Bloqueantes legales y percepción     ← ACTIVO AHORA
    │
    ▼
    PZ-001B             Primer instalador externo real
    │
    ▼
    RC1-Beta            Demo comercial ejecutable + soporte
    │
    ▼
    PZ-001C             Primer proveedor externo real
    │
    ▼
    RC1-Gamma           Conversión: ROI, onboarding, emails HTML
    │
    ▼
    PZ-001D             Piloto multi-proveedor
    │
    ▼
    RC1-Delta           Legal completo + vídeo + SEO + recordatorios
    │
    ▼
    PZ-001E             Piloto móvil (instalador en campo con PWA)
    │
    ▼
    Cierre RC-1         Todos los CRÍTICOS y 80%+ ALTOS resueltos
    │
    ▼
    Sprint 2 Marketplace  Realtime portal, registro proveedor, email
    │
    ▼
    Roadmap 2027        Comisiones, valoraciones, catálogo público, mobile
```

### Pista paralela — Motor IA Sprint 4

El Sprint 4 del Motor IA (P2–P6) es una pista de ejecución paralela e independiente que no bloquea ni es bloqueada por la cola principal. Se ejecuta en paralelo cuando haya capacidad.

```
  PARALELO (independiente de la cola principal)
  
  ✔ Sprint 4 P1 — fix max_tokens → v59 (COMPLETADO)
  ⬜ Sprint 4 P2 — Regression Diff (AI Validation Center)
  ⬜ Sprint 4 P3 — Dashboard observabilidad motor IA
  ⬜ Sprint 4 P4 — Mejora detección de oficio (condicionado a análisis)
  ⬜ Sprint 4 P5 — SLA latencia y alertas
  ⬜ Sprint 4 P6 — Correlación benchmark ↔ producción real
  
  REGLA: P3-P6 no se inician hasta que P2 (Regression Diff) esté disponible.
```

---

## 6. DEPENDENCIAS

### Por qué cada fase necesita la anterior

```
PZ-001B requiere RC1-Alpha
  RAZÓN: El piloto con un instalador real no puede hacerse con un
  Aviso Legal incompleto (NIF pendiente), sin analytics para medir
  la sesión, ni con narrativa de "beta privada" visible.

RC1-Beta requiere PZ-001B
  RAZÓN: El guión de demo y los datos coherentes se refinan con lo
  aprendido en el primer piloto real. Sin PZ-001B, la demo es
  teórica. Con PZ-001B, la demo está validada con un usuario real.

PZ-001C requiere RC1-Beta
  RAZÓN: El primer proveedor externo necesita: (1) un guión de demo
  ejecutable, (2) un catálogo demo con ≥ 50 productos, (3) un
  onboarding guiado en el portal, y (4) un canal de soporte operativo.
  Todo eso se implementa en RC1-Beta.

RC1-Gamma requiere PZ-001C
  RAZÓN: Los emails HTML y el tutorial in-app se optimizan con el
  feedback real del primer proveedor externo (PZ-001C). Sin ese
  feedback, se optimiza a ciegas.

PZ-001D requiere RC1-Gamma
  RAZÓN: El piloto multi-proveedor requiere que la experiencia de
  onboarding del proveedor esté pulida (RC1-Gamma) y que haya al
  menos un proveedor ya incorporado con éxito (PZ-001C).

RC1-Delta requiere PZ-001D
  RAZÓN: Los Términos del Marketplace y el contrato de proveedor
  se redactan con base en los casos de uso reales observados en
  PZ-001B, PZ-001C, y PZ-001D. Sin esa base, los documentos legales
  son genéricos y no cubren los casos reales.

PZ-001E requiere RC1-Gamma
  RAZÓN: El piloto móvil requiere push notifications probadas y un
  onboarding de proveedor funcional en móvil. Ambos se cierran en
  RC1-Gamma y RC1-Delta.

Cierre RC-1 requiere PZ-001E
  RAZÓN: RC-1 se cierra cuando todos los CRÍTICOS y 80%+ de los
  ALTOS están resueltos, y cuando hay al menos 1 piloto exitoso por
  tipo de actor (instalador, proveedor, multi). PZ-001E es el
  último piloto antes del cierre.

Sprint 2 requiere Cierre RC-1
  RAZÓN: Sprint 2 añade funcionalidades nuevas (Realtime en portal
  proveedor, registro auto-gestionado, email al proveedor). No tiene
  sentido añadir funcionalidades nuevas si el producto actual tiene
  bloqueantes comerciales sin resolver. El orden es siempre: primero
  calidad y confianza, luego funcionalidades.
```

---

## 7. BLOQUEADORES

Situaciones externas o internas que impiden avanzar en la cola de ejecución.

| ID | Bloqueador | Estado | Acción necesaria | Responsable |
|----|-----------|--------|-----------------|-------------|
| BLQ-001 | NIF de TrabFlow Technologies S.L. | ⚠️ Pendiente confirmación | Fernando confirma el NIF societario antes de ejecutar RC1-C01 | Fernando |
| BLQ-002 | Domicilio social real de la sociedad | ⚠️ Pendiente verificación | Verificar si "Paseo de la Castellana 124, Madrid" es el domicilio registrado en el RM | Fernando |
| BLQ-003 | Sin datos de analytics anteriores | Aceptado | Analytics empieza desde 0 con Vercel Analytics en RC1-C04-A | Dev |
| BLQ-004 | supabase.gen.ts desactualizado (67 `as any`) | Deuda técnica | Regenerar antes de Sprint 2, no bloquea RC-1 | Dev |
| BLQ-005 | Sin staging separado de producción | Deuda infraestructura | Crear Supabase branch antes de Sprint 2, no bloquea RC-1 | Dev |
| BLQ-006 | ADR-001 sin resolver (Realtime portal proveedor) | Diferido a Sprint 2 | Auditar `supplier_actor_id` en RLS. Pendiente Sprint 2. | Dev |
| BLQ-007 | App móvil (Expo) con cobertura mínima | Deuda 2027 | PZ-001E puede realizarse vía PWA mientras tanto | — |

---

## 8. PILOTOS

### PZ-001A — Piloto Zero Interno

```
ESTADO:    ✔ COMPLETADO
FECHA:     2026-07-26 / 2026-07-27
ACTORES:   legal@inmostay.com (Instalador) · contacto@inmostay.com (Proveedor)
EMPRESA:   ANGEL AMETEO / OBRAMAT Demo
RESULTADO: PASS — 2 ciclos E2E completados
PEDIDOS:   MKT-000001 · MKT-000002 (ciclo ~3 min)
BUGS:      11 encontrados · 11 resueltos · 0 pendientes
UX:        5 encontrados · 5 resueltos
DOC:       docs/pilot/PZ001A_COMPLETED.md
```

---

### PZ-001B — Primer Instalador Externo Real

```
ESTADO:    ⬜ PENDIENTE
PREREQUISITO: RC1-Alpha completado
OBJETIVO:  Validar el flujo completo con un instalador real (no interno)
           usando su propio presupuesto. Sin asistencia técnica durante el flujo.
ACTORES:   Instalador real (empresa instaladora de Cantabria)
           Proveedor: OBRAMAT Demo (cuenta controlada por TrabFlow)
ALCANCE:   Flujo completo. 1 pedido real de material desde un presupuesto real.
PREPARACIÓN:
  - RC1-Alpha completado (legal, analytics, beta eliminada)
  - Catálogo con ≥ 50 Productos Universales cargados
  - Sesión de onboarding con el instalador de 10-15 min
CRITERIO   El instalador completa el flujo sin asistencia tras 10 min de demo.
DE ÉXITO:
DOC:       docs/pilot/PZ001A_COMPLETED.md (§ PZ-001B — plan definido)
```

---

### PZ-001C — Primer Proveedor Externo Real

```
ESTADO:    ⬜ PENDIENTE
PREREQUISITO: RC1-Beta completado · PZ-001B completado
OBJETIVO:  Validar el Portal Proveedor con un proveedor real.
           El proveedor gestiona un pedido sin intervención técnica.
ACTORES:   Proveedor real (distribuidor material fontanería o electricidad)
           Instalador: TrabFlow interno o instalador de PZ-001B
ALCANCE:   Onboarding del proveedor, carga del catálogo, ciclo completo de pedido.
PREPARACIÓN:
  - RC1-Beta completado (guión demo, catálogo, onboarding proveedor)
  - Sesión de incorporación de 30 min con el proveedor
  - Catálogo del proveedor: 30-50 productos principales cargados
CRITERIO   El proveedor gestiona un pedido completo sin asistencia técnica.
DE ÉXITO:
DOC:       docs/pilot/PZ001A_COMPLETED.md (§ PZ-001C — plan definido)
```

---

### PZ-001D — Piloto Multi-Proveedor

```
ESTADO:    ⬜ PENDIENTE
PREREQUISITO: PZ-001B · PZ-001C completados
OBJETIVO:  Validar carrito con materiales de 2 proveedores distintos.
ALCANCE:   Un instalador genera un presupuesto con materiales de 2 familias.
           El Motor IA asigna cada material al proveedor correcto.
           2 pedidos independientes, 2 portales distintos.
CRITERIO   2 pedidos gestionados de forma independiente con 2 confirmaciones
DE ÉXITO:  de entrega.
DOC:       docs/pilot/PZ001A_COMPLETED.md (§ PZ-001D — plan definido)
```

---

### PZ-001E — Piloto Móvil (Instalador en Campo)

```
ESTADO:    ⬜ PENDIENTE
PREREQUISITO: RC1-Gamma completado
OBJETIVO:  Validar el flujo completo desde móvil (PWA instalada).
ACTORES:   Técnico de campo con smartphone Android/iOS
ALCANCE:   Crear presupuesto por voz → marketplace → pedido, todo desde móvil.
           Confirmar recepción en obra.
CRITERIO   Técnico completa el flujo de pedido en < 5 min desde obra,
DE ÉXITO:  sin PC. Push notifications activas y funcionando.
DOC:       docs/pilot/PZ001A_COMPLETED.md (§ PZ-001E — plan definido)
```

---

## 9. SPRINTS

### Motor IA (pista paralela)

| Sprint | Período | Estado | Resultado |
|--------|---------|--------|-----------|
| IA Sprint 1 | Feb–Mar 2026 | ✔ Completado | Motor IA v1 en producción |
| IA Sprint 2 | Mar–Abr 2026 | ✔ Completado | Benchmark 200 casos. Oficios básicos |
| IA Sprint 3 | May–Jun 2026 | ✔ Completado | v59. Fix max_tokens. 98.2% OK. 400 casos |
| IA Sprint 4 | Jul–Sep 2026 | 🔧 En progreso | P1 completado. P2-P6 pendientes (paralelo a RC-1) |

### Marketplace

| Sprint | Período | Estado | Resultado |
|--------|---------|--------|-----------|
| Marketplace Sprint 0 | Ene–May 2026 | ✔ Completado | Catálogos, pedidos clásicos, proveedores preferidos |
| Marketplace Phase 2A | Jun 2026 | ✔ Completado | Checkout integrado 2 pasos |
| Marketplace Phase 2B | Jun–Jul 2026 | ✔ Completado | Seguimiento Realtime, timeline, historial |
| Marketplace Phase 2C | Jul 2026 | ✔ Completado | Portal proveedor completo |
| Marketplace Sprint 2 | Sep–Oct 2026 | ⬜ Pendiente | Realtime portal, registro proveedor, email alertas |

### RC-1 Commercial Readiness

| Bloque | Semana | Estado | Objetivo |
|--------|--------|--------|---------|
| RC1-Alpha | Sem 1-2 | 🔧 ACTIVO | Bloqueantes legales + analytics + sin "beta" |
| RC1-Beta | Sem 3-4 | ⬜ Pendiente | Demo ejecutable + catálogo + onboarding proveedor |
| RC1-Gamma | Sem 5-6 | ⬜ Pendiente | Conversión: ROI, tutorial in-app, emails HTML, Sentry |
| RC1-Delta | Sem 7-8 | ⬜ Pendiente | Legal completo, vídeo, SEO, recordatorios trial |

---

## 10. MÉTRICAS DEL PROYECTO

Tabla viva. Se actualiza al cerrar cada fase o tarea relevante.

| Métrica | Valor | Fecha |
|---------|-------|-------|
| Motor IA — OK rate | 98.2% | v59 · Jun 2026 |
| Motor IA — Benchmark | 400 casos | Jun 2026 |
| Motor IA — Versión producción | v59 | Jun 2026 |
| Marketplace | Phase 2 completa | Jul 2026 |
| Pilotos completados | 1 (PZ-001A) | Jul 2026 |
| Pilotos externos pendientes | 4 (B, C, D, E) | — |
| Bugs PZ-001A | 11 encontrados · 11 resueltos | Jul 2026 |
| UX PZ-001A | 5 encontrados · 5 resueltos | Jul 2026 |
| Edge Functions desplegadas | 25 | Jul 2026 |
| Módulos ERP | 17 módulos en producción | Jul 2026 |
| Tests Vitest | 13 archivos · suite activa | Jul 2026 |
| Tests Playwright E2E | 6 archivos · suite activa | Jul 2026 |
| Clientes de pago | No validado (dato pendiente) | — |
| MRR | No validado | — |
| MAU | Sin analytics — 0 datos | — |
| Analytics instalado | ❌ No — tarea RC1-C04-A | — |
| NIF en Aviso Legal | ❌ [PENDIENTE] — tarea RC1-C01 | — |
| Banner de cookies | ❌ No — tarea RC1-C03 | — |
| Producción | Vercel (trabflow.com) | — |
| Base de datos | Supabase (dqqjaujnulutinskmqsu) | — |
| Motor IA | Anthropic Claude Haiku 4.5 | — |
| Transcripción | OpenAI Whisper | — |
| Email | Resend | — |
| Billing | Stripe | — |

---

## 11. REGLAS

Estas reglas gobiernan el proyecto durante RC-1. No admiten excepciones sin decisión explícita.

```
REGLA-01  No comenzar Sprint 2 Marketplace hasta cerrar RC-1 completamente.

REGLA-02  No ejecutar PZ-001B antes de completar RC1-Alpha.
          Un piloto con usuario externo requiere que los bloqueantes
          legales estén resueltos.

REGLA-03  No ejecutar PZ-001C antes de completar PZ-001B.
          El aprendizaje del primer piloto informa el guión del segundo.

REGLA-04  No crear módulos nuevos durante RC-1.
          RC-1 es consolidación, no expansión.

REGLA-05  No abrir funcionalidades de Sprint 2 durante pilotos.
          Los pilotos validan lo existente, no prueban lo nuevo.

REGLA-06  No hay dos tareas activas simultáneas en la cola principal.
          La pista paralela del Motor IA es independiente y no
          cuenta como tarea de la cola principal.

REGLA-07  Todo cambio en el código durante RC-1 debe ser:
          (a) un fix de bug existente, o
          (b) una mejora de la lista RC1_MVP_ELEMENTS.md.
          Si no está en ninguna de las dos, no se implementa.

REGLA-08  Toda fase terminada actualiza este EXECUTION_BOARD.

REGLA-09  Todo cambio en una fase actualiza el README.md del proyecto.

REGLA-10  Toda decisión de arquitectura requiere un ADR.
          (Referencia: docs/adr/ADR-001-realtime-portal-proveedor.md)

REGLA-11  La service_role key no se escribe en migraciones, repositorio,
          logs, documentación ni mensajes.

REGLA-12  Ningún commit de código sin pasar por el flujo:
          verificar tarea activa → implementar → actualizar board → commit.
```

---

## 12. CHECKLIST DE SESIÓN

Protocolo a seguir al iniciar cualquier sesión de trabajo.

```
  ┌─────────────────────────────────────────────────────┐
  │           CHECKLIST DE INICIO DE SESIÓN             │
  └─────────────────────────────────────────────────────┘

  1. Abrir EXECUTION_BOARD.md
     ↓
  2. Leer § 1 ESTADO ACTUAL
     ↓
  3. Leer § 4 TAREA ACTIVA
     ↓
  4. Confirmar que la tarea sigue siendo válida
     (¿ha cambiado algo que la desbloquee o la bloquee?)
     ↓
  5. Ejecutar la tarea activa
     ↓
  6. Al terminar la tarea:
     a. Marcar como completada en § 3 (tabla de RC1-Alpha)
     b. Actualizar § 4 con la siguiente tarea de la cola
     c. Actualizar § 10 MÉTRICAS si aplica
     ↓
  7. Si se cierra una FASE completa:
     a. Mover la fase a § 2 FASES TERMINADAS
     b. Actualizar § 3 con la nueva fase en curso
     c. Actualizar § 1 ESTADO ACTUAL
     d. Actualizar § 5 COLA (marcar la fase como completada)
     e. Actualizar docs/README.md (estado del producto)
     ↓
  8. Commit con mensaje descriptivo
     ↓
  9. Fin de sesión
```

---

## APÉNDICE — Inconsistencias detectadas entre documentos

Registradas al crear este EXECUTION_BOARD. No requieren acción inmediata salvo indicación.

---

**INC-001 — "Fase 2 Consolidación UX" vs "RC-1 Commercial Readiness"**

`00_MASTER_ROADMAP.md` y `02_IMPLEMENTATION_MASTER_PLAN.md` denominan la fase activa como "Fase 2 — Consolidación UX para piloto comercial". La auditoría RC-1 (2026-07-28) amplía el alcance de esta fase: no solo es consistencia visual, sino cumplimiento legal, analytics, onboarding, emails, demo y percepción comercial completa. RC-1 absorbe y supera a Fase 2. Los documentos 00 y 02 no han sido actualizados para reflejar este cambio de nomenclatura.

**Acción sugerida:** Actualizar § "Fase 2" en 00_MASTER_ROADMAP.md y 02_IMPLEMENTATION_MASTER_PLAN.md para llamarla "RC-1 Commercial Readiness" y referenciar los nuevos documentos RC1_*.

---

**INC-002 — Motor IA Sprint 4 como pista paralela vs. fase secuencial**

`02_IMPLEMENTATION_MASTER_PLAN.md` lista el Sprint 4 del Motor IA como "Fase 3 — en progreso (paralelo a Fase 2)". La cola de ejecución de este EXECUTION_BOARD lo trata como pista paralela independiente. La denominación "Fase 3" puede confundirse con una fase secuencial bloqueante. En la práctica, el Sprint 4 del Motor IA no bloquea ni es bloqueado por RC-1 ni por los pilotos.

**Acción sugerida:** Clarificar en los documentos 00 y 02 que el Sprint 4 del Motor IA es una pista paralela, no una fase secuencial del roadmap principal.

---

**INC-003 — "Objetivos 2026" sin datos de clientes de pago**

`00_MASTER_ROADMAP.md` lista "Primeros ingresos de suscripción (≥ 5 clientes de pago)" como objetivo 2026 "En proceso". No hay datos disponibles sobre clientes de pago actuales (no hay analytics). Esta métrica no puede monitorizarse hasta RC1-Alpha (activación de analytics).

**Acción sugerida:** Tras activar analytics en RC1-C04-A, añadir el dato real de clientes de pago a la tabla de métricas de este EXECUTION_BOARD.

---

**INC-004 — `e2e/.auth/*.json` en el repositorio**

`02_IMPLEMENTATION_MASTER_PLAN.md` documenta esto como deuda técnica ("Revisar `.gitignore`"). No hay registro de que se haya resuelto. Las credenciales de sesión de Playwright en el repositorio suponen un riesgo de seguridad menor.

**Acción sugerida:** Verificar si `.gitignore` excluye `e2e/.auth/`. Si no, añadir la exclusión y eliminar los archivos del historial o simplemente del directorio (si no están en el índice de git).

---

**INC-005 — Domicilio social "Paseo de la Castellana 124, Madrid"**

Aparece en `LegalViews.tsx` como domicilio de TrabFlow Technologies S.L. No hay confirmación de que sea el domicilio social registrado en el Registro Mercantil. Si es incorrecto, es un problema legal además de comercial.

**Acción sugerida:** Fernando verifica el domicilio real antes de ejecutar RC1-C01. Si es incorrecto, se corrige en el mismo commit.

---

*Este documento se actualiza al terminar cada tarea. Nunca al empezarla.*  
*Versión controlada por Git. Toda modificación requiere commit con mensaje descriptivo.*
