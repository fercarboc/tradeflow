# PZ-001A — Cierre Oficial del Piloto Zero

**Estado: COMPLETADO**
**Tipo:** Piloto interno de validación operativa
**Periodo de ejecución:** 2026-07-26 / 2026-07-27
**Ejecutor:** Fernando García (TrabFlow)
**Versión base:** commit `aeee83c` · Vercel producción
**Versión cierre:** commit `0707f85`

---

## 1. Resumen Ejecutivo

PZ-001A es el primer piloto operativo completo del marketplace de TrabFlow. Se ejecutó de forma interna simulando dos actores reales: un instalador ERP y un proveedor con portal propio.

Durante dos días de ejecución se completaron **dos ciclos de pedido de extremo a extremo** (MKT-000001 y MKT-000002), se detectaron y resolvieron **11 bugs** y **5 mejoras UX**, y el flujo quedó validado como funcional sin errores bloqueantes pendientes.

El resultado es que el marketplace de TrabFlow **es operable** y puede ser presentado a un proveedor piloto externo bajo condiciones controladas. Existen riesgos conocidos que deben mitigarse antes de un piloto con un distribuidor real no supervisado.

---

## 2. Objetivo del Piloto

Verificar que el flujo completo instalador → marketplace → proveedor → entrega → recepción funciona de extremo a extremo en producción, sin errores bloqueantes, en un tiempo razonable, y con una UX inteligible sin formación previa.

---

## 3. Alcance

| Elemento | Incluido |
|----------|----------|
| Autenticación y routing instalador | ✅ |
| Creación de presupuesto (voz/texto IA) | ✅ |
| Aceptación de presupuesto | ✅ |
| Flujo Marketplace (carrito → checkout 2 pasos) | ✅ |
| Seguimiento de pedido en tiempo real | ✅ |
| Portal Proveedor (login, pedidos, estados) | ✅ |
| Confirmación → Preparación → Envío (proveedor) | ✅ |
| Confirmación de recepción (instalador) | ✅ |
| Historial de pedidos (ambas vistas) | ✅ |
| Centro de Acción del proveedor | ✅ |
| Notificaciones push | ❌ No probado (PWA no instalada en dispositivo de prueba) |
| Facturación post-entrega | ❌ No en scope PZ-001A |
| Múltiples proveedores en un carrito | ❌ No en scope PZ-001A |

---

## 4. Flujo Completo Validado

### BLOQUE 1 — Instalador: Autenticación y Presupuesto

| Paso | Descripción | Resultado |
|------|-------------|-----------|
| 1 | Login `legal@inmostay.com` → ERP directo | ✅ OK |
| 2 | Crear presupuesto PRE-2026-081 (reforma de baño, voz/texto IA) | ✅ OK |
| 3 | Aceptar presupuesto — estado cambia a "Aceptado" | ✅ OK |

### BLOQUE 2 — Instalador: Compra en Marketplace

| Paso | Descripción | Resultado |
|------|-------------|-----------|
| 4 | Acceder a Marketplace desde el presupuesto PRE-2026-081 | ✅ OK (tras fix BUG-004 y BUG-005) |
| 5 | Revisar carrito generado por IA con materiales de baño + OBRAMAT Demo asignado | ✅ OK |
| 6 | Checkout paso 1 (revisar) → paso 2 (confirmar) → confirmar compra | ✅ OK |
| 7 | Pedido MKT-000001 y MKT-000002 generados con número de referencia | ✅ OK |

### BLOQUE 3 — Proveedor: Gestión del Pedido

| Paso | Descripción | Resultado |
|------|-------------|-----------|
| 8 | Pedido aparece en BD con estado `pending` y actor OBRAMAT Demo | ✅ OK |
| 9 | Login `contacto@inmostay.com` → Portal Proveedor OBRAMAT Demo directo | ✅ OK (tras fix BUG-001, BUG-002, BUG-003) |
| 10 | Centro de Acción muestra pedido sin confirmar; badge de notificación actualizado | ✅ OK |
| 11 | Confirmar pedido desde Portal · Pedidos | ✅ OK (tras fix BUG-006, BUG-007, BUG-008) |
| 12 | Preparar pedido → estado `preparing` | ✅ OK |
| 13 | Enviar pedido → estado `shipped` | ✅ OK |

### BLOQUE 4 — Instalador: Seguimiento y Recepción

| Paso | Descripción | Resultado |
|------|-------------|-----------|
| 14 | Seguimiento de Material muestra estado actualizado en tiempo real | ✅ OK |
| 15 | Notificaciones push | N/A — no probado en este piloto |
| 16 | Timeline completo: Pendiente → Confirmado → Preparación → Enviado | ✅ OK |
| 17 | Confirmar recepción → estado `delivered` en BD / "Recibido" en UI | ✅ OK |

### BLOQUE 5 — Cierre

| Paso | Descripción | Resultado |
|------|-------------|-----------|
| 18 | Pedido aparece en Historial de ambas vistas (instalador y proveedor) | ✅ OK |
| 19 | Pedido aparece en "Pedidos de Material" con badge correcto | ✅ OK (añadido en cierre PZ-001A) |
| 20 | Estado final: MKT-000001 y MKT-000002 en "Completados" / "Recibido" | ✅ OK |

---

## 5. Resultado por Fase

| Fase | Estado | Observaciones |
|------|--------|---------------|
| Autenticación instalador | ✅ PASS | Directo al ERP, sin flash ni bucle |
| Presupuesto IA | ✅ PASS | Generación correcta con voz/texto |
| Marketplace checkout | ✅ PASS | 2 pasos. Requirió fix BUG-004 y BUG-005 en setup |
| Login proveedor | ✅ PASS | Requirió 3 fixes críticos de routing y auth (BUG-001/002/003) |
| Gestión pedido proveedor | ✅ PASS | Requirió 3 fixes bloqueantes en BD (BUG-006/007/008) |
| Seguimiento instalador | ✅ PASS | Tiempo real correcto |
| Recepción | ✅ PASS | Estado BD correcto; etiquetas UI unificadas |
| Historial | ✅ PASS | Ambas vistas correctas tras fix BUG-010 |

---

## 6. Tiempos Aproximados Observados

Los tiempos corresponden a una ejecución limpia (sin bugs, entorno ya configurado):

| Bloque | Actividad | Tiempo Observado | Objetivo |
|--------|-----------|-----------------|----------|
| Login instalador | Autenticación | ~3 seg | < 5 seg ✅ |
| Presupuesto IA | Dictado + generación | ~45 seg | < 60 seg ✅ |
| Aceptar presupuesto | Cambio de estado | ~5 seg | < 10 seg ✅ |
| Acceso Marketplace + checkout | Pasos 4-7 completos | ~20-30 seg | < 20 seg ⚠️ (límite) |
| Login proveedor | Autenticación portal | ~4 seg | < 5 seg ✅ |
| Confirmar + preparar + enviar | Pasos 11-13 | ~60 seg | < 10 seg ⚠️ (UX mejorable) |
| Seguimiento + recepción | Pasos 14-17 | ~60 seg | < 15 seg ⚠️ |
| **Ciclo completo limpio** | **Pasos 4-17** | **~3 min** | **< 3 min ✅** |

> **Nota sobre tiempos de proveedor:** Los pasos 11-13 (confirmar/preparar/enviar) se ejecutaron en MKT-000002 en ~1 minuto real incluyendo lectura de la UI. El objetivo de < 10 seg refería a la mecánica de clic, no al tiempo de revisión del pedido. El objetivo es alcanzable con práctica.

> **Tiempos de primera ejecución (con bugs incluidos):** ~2 horas de ejecución total distribuidas en dos días, dado el volumen de incidencias detectadas y resueltas en tiempo real.

---

## 7. Bugs Encontrados y Estado

| ID | Paso | Descripción | Severidad | Estado |
|----|------|-------------|-----------|--------|
| BUG-001 | Paso 11 | "Salir del portal" bucle infinito para usuario supplier-only | ALTA | ✅ Resuelto |
| BUG-002 | Paso 9 | Org fantasma creada por service worker con caché antigua | ALTA | ✅ Resuelto |
| BUG-003 | Paso 9 | workspaceResolver usaba segundo cliente Supabase sin sesión | BLOQUEANTE | ✅ Resuelto |
| BUG-004 | Paso 4 | "Error al preparar el carrito" por PostgrestError mal parseado | ALTA | ✅ Resuelto |
| BUG-005 | Paso 5 | Carrito sin alternativas de proveedor (sin Productos Universales) | BLOQUEANTE | ✅ Resuelto |
| BUG-006 | Paso 11 | "Error al cargar pedidos" — marketplace-portal usaba cliente secundario | BLOQUEANTE | ✅ Resuelto |
| BUG-007 | Paso 11 | `column reference "id" is ambiguous` en get_supplier_orders_unified | BLOQUEANTE | ✅ Resuelto |
| BUG-008 | Paso 11 | `function is not unique` en confirm_supplier_order — firma duplicada en BD | BLOQUEANTE | ✅ Resuelto |
| BUG-009 | Paso 11 | `column reference "id" is ambiguous` en get_supplier_offerings_paged | ALTA | ✅ Resuelto |
| BUG-010 | Paso 12 | Tab "Completados" del portal mostraba 0 — mismatch delivered/completed | ALTA | ✅ Resuelto |
| BUG-011 | Todos | Panel instalador pierde sub-vista (activeTab) al volver de otra app | ALTA | ✅ Resuelto |

**Bugs pendientes al cierre:** 0

*Detalle completo en [PZ001_BUGLOG.md](PZ001_BUGLOG.md)*

---

## 8. Mejoras UX Aplicadas Durante PZ-001A

| ID | Descripción | Impacto | Estado |
|----|-------------|---------|--------|
| UX-001 | "Salir del portal" → "Cerrar sesión" / "Cambiar de espacio" según rol | Alto | ✅ Resuelto |
| UX-002 | "N productos sin vincular al Motor IA" — texto más claro y motivacional | Medio | ✅ Resuelto |
| UX-003 | Verificación: severidad bajada a `warning` + texto que no alarma al proveedor nuevo | Medio | ✅ Resuelto |
| UX-004 | Badge "Entregado" vs tab "Completados" — unificado vía mapeo BD delivered→completed | Bajo | ✅ Resuelto |
| UX-005 | Panel instalador pierde vista al volver de otra pestaña — fix routing + localStorage + workspaceResolving | Alto | ✅ Resuelto |

*Detalle completo en [PZ001_UX.md](PZ001_UX.md)*

---

## 9. Mejoras Pendientes para RC-1

Estas mejoras no son bloqueantes para los próximos pilotos controlados, pero deben resolverse antes de un lanzamiento a usuarios no supervisados:

| Prioridad | Descripción | Impacto |
|-----------|-------------|---------|
| ALTA | Onboarding del proveedor: flujo guiado para primer acceso (sin necesidad de setup manual) | Sin onboarding, el primer acceso de un proveedor real requiere intervención |
| ALTA | Notificaciones push funcionales: el proveedor debe recibir alerta instantánea de nuevo pedido | Sin push, el proveedor no sabe que tiene pedidos si no entra al portal |
| ALTA | Más Productos Universales vinculados: cobertura actual baja — el Motor IA solo puede sugerir proveedor para materiales con match | Limita la utilidad del marketplace para presupuestos variados |
| ALTA | Paridad móvil: revisión del flujo marketplace en móvil (instalador campo) | El instalador en obra puede necesitar hacer pedidos desde el teléfono |
| MEDIA | Catálogo navegable libre (Fase 3): permitir que el instalador explore el catálogo sin presupuesto previo | Amplía el caso de uso del marketplace |
| MEDIA | Tiempo de respuesta del proveedor: recordatorio automático a las 12h si no ha confirmado | Sin recordatorio, el score de respuesta degrada silenciosamente |
| MEDIA | Panel "Mis Pedidos" mejorado: vista unificada de legacy y marketplace con más detalle por pedido | La vista actual es informativa pero no permite gestionar acciones |
| BAJA | Tracking real del transportista: integración con URL de seguimiento de mensajería | Actualmente el campo existe pero no hay integración real |
| BAJA | Valoración del proveedor post-entrega: flujo guiado de valoración | El campo existe en BD pero no hay UX explícita para el instalador |

---

## 10. Riesgos Antes de un Piloto con Distribuidor Real

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Proveedor real sin onboarding guiado: se perderá en el primer acceso | Alta | Alto | Sesión de incorporación presencial o videollamada de 15 min |
| Catálogo sin vincular: el Motor IA no sugiere al proveedor para el presupuesto real del instalador | Alta | Alto | Vincular manualmente los 20-30 productos clave antes del piloto |
| Sin notificaciones push: el proveedor no se enterará de pedidos nuevos | Alta | Alto | Establecer protocolo de revisión manual del portal (2x/día) durante el piloto |
| Múltiples proveedores en un carrito: no probado, posibles bugs | Media | Alto | Limitar primer piloto real a un único proveedor por pedido |
| Pedidos con cantidades o materiales incorrectos: el IA puede sugerir materiales que no corresponden | Media | Medio | El instalador revisa el carrito antes de confirmar (flujo de 2 pasos lo permite) |
| Rendimiento bajo carga real: solo se ha probado con 2 usuarios y 2 pedidos | Baja | Medio | Monitorizar logs de Vercel y Supabase durante el piloto; escalar si necesario |
| Bugs en flujos no probados (múltiples pedidos simultáneos, cancelaciones) | Media | Medio | Documentar casos no probados y mantener canal de soporte directo |

---

## 11. Conclusiones

1. **El flujo de extremo a extremo funciona.** Los dos ciclos completos (MKT-000001 y MKT-000002) se ejecutaron sin errores bloqueantes pendientes.

2. **El coste de puesta en marcha fue alto en este piloto** (11 bugs, mayoritariamente de infraestructura auth y BD). Esto era esperable en un primer piloto interno; los bugs de setup no se repetirán con proveedores reales que usen cuentas ya configuradas.

3. **La UX del proveedor es suficiente** para un usuario con una sesión de incorporación previa de 10-15 minutos. Sin formación, el primer acceso puede generar dudas.

4. **La UX del instalador es sólida.** El flujo desde presupuesto hasta pedido en marketplace es intuitivo y rápido.

5. **El Motor IA necesita más cobertura de productos.** Los 6 Productos Universales creados para el piloto son insuficientes para presupuestos reales. Este es el riesgo más alto antes de un piloto externo.

6. **Las notificaciones push son un requisito operativo real,** no opcional. Sin ellas, el proveedor depende de su propia disciplina para revisar el portal.

7. **El sistema de estados y trazabilidad es correcto y completo.** La cadena pending → confirmed → preparing → shipped → delivered está bien implementada y es visible para ambos actores.

---

## 12. Recomendación sobre Preparación para Piloto Externo

> **El flujo actual está preparado para un piloto externo controlado, con condiciones.**

**Condiciones obligatorias antes de PZ-001B (piloto con instalador/proveedor reales):**

1. **Vincular manualmente los 30-50 productos más comunes** del proveedor piloto al catálogo de Productos Universales — el Motor IA necesita ese mínimo para ser útil.
2. **Establecer protocolo de revisión del portal** (el proveedor revisa el portal mínimo 2 veces al día hasta tener push activo).
3. **Sesión de incorporación de 15 min con el proveedor** antes del primer pedido real.
4. **Limitar el primer piloto externo** a 1 proveedor, 1 instalador, pedidos mono-proveedor.
5. **Canal de soporte directo** (WhatsApp o Telegram) entre TrabFlow y los actores del piloto durante las primeras 2 semanas.

**Lo que NO es bloqueante** para un piloto externo controlado:
- Push notifications (sustituible por revisión manual)
- Catálogo libre navegable (el flujo desde presupuesto es suficiente)
- Múltiples proveedores en carrito (se puede restringir en el piloto)
- Facturación integrada (el instalador ya tiene su propio flujo)

---

## Plan de Continuación — PZ-001B a PZ-001E

*(Definidos. No implementar hasta cerrar preparativos de PZ-001B.)*

### PZ-001B — Primer Piloto con Instalador Real
- **Objetivo:** Validar el flujo con un instalador real (no interno) usando su propio presupuesto.
- **Actor instalador:** Una empresa instaladora real de Cantabria.
- **Actor proveedor:** OBRAMAT Demo (cuenta controlada por TrabFlow).
- **Alcance:** Flujo completo, 1 pedido real de material desde un presupuesto real.
- **Preparación:** Vincular productos del proveedor demo al catálogo. Sesión de onboarding con el instalador.
- **Criterio de éxito:** El instalador completa el flujo sin asistencia tras 10 min de demo.

### PZ-001C — Primer Piloto con Proveedor Real
- **Objetivo:** Validar el Portal Proveedor con un proveedor real (mayorista o distribuidor).
- **Actor instalador:** TrabFlow interno o instalador de PZ-001B.
- **Actor proveedor:** Un distribuidor real (candidato: mayorista de fontanería o electricidad local).
- **Alcance:** Onboarding del proveedor, carga del catálogo, ciclo completo de pedido.
- **Preparación:** Sesión de 30 min de incorporación. Vincular los 50 productos más comunes.
- **Criterio de éxito:** El proveedor gestiona un pedido completo sin asistencia técnica.

### PZ-001D — Piloto Multi-Proveedor
- **Objetivo:** Validar un carrito con materiales de 2 proveedores distintos.
- **Prerrequisito:** PZ-001B y PZ-001C completados satisfactoriamente.
- **Alcance:** Un instalador genera un presupuesto con materiales de 2 familias distintas. El Motor IA asigna cada material al proveedor correcto. 2 pedidos independientes.
- **Criterio de éxito:** Los 2 pedidos se gestionan de forma independiente y el instalador recibe 2 confirmaciones de entrega.

### PZ-001E — Piloto Móvil (Instalador en Campo)
- **Objetivo:** Validar el flujo completo desde móvil (PWA instalada).
- **Actor:** Instalador técnico de campo con smartphone Android/iOS.
- **Alcance:** Crear presupuesto por voz → marketplace → pedido, todo desde móvil. Confirmar recepción en obra.
- **Preparación:** PWA instalada en el dispositivo. Push notifications activas.
- **Criterio de éxito:** El técnico completa el flujo de pedido en < 5 minutos desde obra, sin conexión a PC.

---

*Documento generado al cierre de PZ-001A · 2026-07-27 · TrabFlow*
