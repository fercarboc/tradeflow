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

### UX-004

**Paso:**
**Descripción:**
**Prioridad:**
**Impacto:**
**Esfuerzo:**
**Propuesta:**
**Estado:** Abierto

---

### UX-005

**Paso:**
**Descripción:**
**Prioridad:**
**Impacto:**
**Esfuerzo:**
**Propuesta:**
**Estado:** Abierto

---

## Resumen Ejecutivo UX

| ID | Descripción | Prioridad | Estado |
|----|-------------|-----------|--------|
| UX-001 | Botón "Salir del portal" ambiguo | CRÍTICA | ✅ Resuelto |
| UX-002 | Aviso "productos sin vincular" confuso para usuario nuevo | ALTA | Pendiente |
| UX-003 | "Cuenta sin verificar" como primer aviso — impresión negativa | ALTA | Pendiente |
| UX-004 | | | |
| UX-005 | | | |
