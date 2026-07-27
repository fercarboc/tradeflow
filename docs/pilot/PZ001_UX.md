# PZ-001 — Mejoras UX Identificadas

**Piloto Zero · TrabFlow Marketplace**
**Fecha:** 2026-07-26

---

## Clasificación

| Prioridad | Criterio |
|-----------|---------|
| **CRÍTICA** | Impide o confunde al usuario en el flujo principal. Debe corregirse antes del primer piloto real. |
| **ALTA** | Afecta significativamente la experiencia. Corregir en siguiente sprint. |
| **MEDIA** | Mejoraría la UX notablemente. Priorizar según recursos. |
| **BAJA** | Cosmético o mejora menor. Backlog. |

## Estimaciones

- **Impacto:** Alto / Medio / Bajo
- **Esfuerzo:** Alto (>1 día) / Medio (2-4h) / Bajo (<2h)
- **Prioridad:** 1-5 (1 = urgente)

---

## Mejoras Pre-Piloto (detectadas en setup)

### UX-001 — "Salir del portal" era ambiguo

**Paso:** Portal Proveedor · Footer sidebar
**Descripción:** El botón "Salir del portal" era semánticamente ambiguo. Un usuario que no tiene otro espacio de trabajo no puede "salir" a ningún lado.
**Prioridad:** CRÍTICA
**Impacto:** Alto — provocaba bucle infinito
**Esfuerzo:** Bajo
**Solución aplicada:** Reemplazado por "Cerrar sesión" (supplier-only) / "Cambiar de espacio" + "Cerrar sesión" (dual role).
**Commit:** aeee83c
**Estado:** ✅ Resuelto

---

### UX-002 — 178 productos sin Producto Universal (aviso en Centro de Acción)

**Paso:** Portal Proveedor · Centro de Acción
**Descripción:** El aviso "178 productos sin Producto Universal" es correcto pero puede asustar a un proveedor en su primer acceso. No explica con suficiente claridad qué es un "Producto Universal" ni por qué importa.
**Prioridad:** ALTA
**Impacto:** Medio — confunde al proveedor nuevo
**Esfuerzo:** Bajo — mejorar el texto del aviso
**Propuesta:**
- Cambiar a: "Vincula tus productos al catálogo para aparecer en las búsquedas del Motor IA"
- Añadir tooltip o enlace "¿Qué es esto?"
- Ofrecer "Hacer esto después" sin culpa
**Estado:** Abierto — pendiente de sprint

---

### UX-003 — "Cuenta sin verificar" como primer aviso en el Centro de Acción

**Paso:** Portal Proveedor · Centro de Acción
**Descripción:** "Cuenta sin verificar — Completa la verificación de tu cuenta para que los instaladores puedan encontrarte." Es el primer aviso que ve el proveedor. Para OBRAMAT Demo puede dar sensación de que la cuenta no está operativa.
**Prioridad:** ALTA
**Impacto:** Medio — primera impresión negativa
**Esfuerzo:** Bajo — aclarar que el proveedor ya puede operar y recibir pedidos
**Propuesta:** Cambiar el texto a: "Para aparecer en el catálogo público, completa la verificación. Los instaladores que ya te conozcan pueden seguir haciendo pedidos." y reducir la urgencia visual del aviso.
**Estado:** Abierto — pendiente de sprint

---

## Mejoras Durante PZ-001

*Registrar aquí las mejoras UX encontradas durante la ejecución del piloto.*

### UX-004 — Inconsistencia "Entregado" (badge) vs "Completados" (tab filtro) en Portal Proveedor

**Paso:** Paso 13 (después de confirmar recepción desde instalador)
**Descripción:** En el portal del proveedor, el badge del pedido completado dice "Entregado" pero el tab de filtro correspondiente dice "Completados". El instalador ve "Recibido". Las tres etiquetas para el mismo estado final son confusas.
**Prioridad:** BAJA
**Impacto:** Bajo — el flujo funciona, es solo confusión terminológica
**Esfuerzo:** Bajo — alinear etiqueta del badge con el tab ("Completado") en OrderStatusBadge
**Propuesta:** Unificar: proveedor ve "Completado" (tab y badge), instalador ve "Recibido". El tab de filtro ya usa "Completados" — solo hay que hacer que el badge use la misma etiqueta.
**Estado:** Abierto — backlog post-piloto

---

### UX-005 — Panel instalador pierde la vista al volver de otra pestaña

**Paso:** Todos (afecta a cualquier vista del instalador: Seguimiento, Marketplace, etc.)
**Descripción:** Al abandonar la pestaña Edge del instalador y volver (browser tab discard / cambio de foco), la app se reiniciaba en el Dashboard inicial en lugar de conservar la vista donde estaba el usuario (p.ej. Seguimiento de Material con MKT-000002 visible).
**Prioridad:** ALTA
**Impacto:** Medio — el usuario tiene que navegar de nuevo hasta donde estaba
**Esfuerzo:** Bajo — dos líneas en App.tsx
**Propuesta aplicada:** (1) El estado inicial de `currentPage` usa `pathToPage(window.location.pathname)` para detectar páginas de app en la URL de recarga. (2) `resolveAndRoute` preserva la página actual si ya es una página de app válida (SeguimientoMaterial, MarketplaceComprar, PortalProveedor, AppDashboard).
**Estado:** ✅ Resuelto — commit pendiente deploy

---

## Resumen Ejecutivo UX

| ID | Descripción | Prioridad | Estado |
|----|-------------|-----------|--------|
| UX-001 | Botón "Salir del portal" ambiguo | CRÍTICA | ✅ Resuelto |
| UX-002 | Aviso "productos sin vincular" confuso para usuario nuevo | ALTA | Pendiente |
| UX-003 | "Cuenta sin verificar" como primer aviso — impresión negativa | ALTA | Pendiente |
| UX-004 | Badge "Entregado" vs tab "Completados" — inconsistencia terminológica | BAJA | Pendiente |
| UX-005 | Panel instalador pierde vista al volver de otra pestaña | ALTA | ✅ Resuelto |
