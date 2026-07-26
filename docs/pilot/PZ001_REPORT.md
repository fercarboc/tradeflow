# PZ-001 — Informe de Métricas

**Piloto Zero · TrabFlow Marketplace**
**Fecha inicio:** 2026-07-26
**Fecha fin:** _____________
**Versión:** aeee83c (Vercel prod)

---

## Actores

| Rol | Cuenta | Empresa |
|-----|--------|---------|
| Instalador | legal@inmostay.com | TrabFlow Instalaciones Demo |
| Proveedor | contacto@inmostay.com | OBRAMAT Demo |

---

## Tiempos por Paso

| Paso | Descripción | T. Inicio | T. Fin | Duración | Objetivo | ✓/✗ |
|------|-------------|-----------|--------|----------|----------|-----|
| 1 | Login instalador | | | | < 5s | |
| 2 | Crear presupuesto IA | | | | < 60s | |
| 3 | Aceptar presupuesto | | | | < 10s | |
| 4 | Acceder marketplace | | | | < 5s | |
| 5 | Revisar catálogo + carrito | | | | < 30s | |
| 6 | Confirmar compra | | | | < 10s | |
| 7 | Pedido generado | | | | < 3s | |
| **TOTAL INSTALADOR COMPRA** | | | | | **< 20s (pasos 4-7)** | |
| 9 | Login proveedor | | | | < 5s | |
| 10 | Centro de acción | | | | < 3s | |
| 11 | Confirmar pedido | | | | < 5s | |
| 12 | Preparar pedido | | | | < 3s | |
| 13 | Enviar pedido | | | | < 3s | |
| **TOTAL PROVEEDOR GESTIÓN** | | | | | **< 10s (pasos 11-13)** | |
| 14 | Tracking instalador | | | | < 5s | |
| 17 | Confirmar recepción | | | | < 5s | |
| 19 | Generar factura | | | | < 15s | |
| **TOTAL FLUJO COMPLETO** | | | | | **< 3 min** | |

---

## Métricas de Interacción

| Métrica | Valor |
|---------|-------|
| Número total de clics (flujo completo) | |
| Número de pantallas distintas visitadas | |
| Pasos innecesarios detectados | |
| Mensajes confusos | |
| Información faltante | |
| Información redundante | |
| Acciones bloqueantes | |

---

## Métricas de Negocio

| Métrica | Valor |
|---------|-------|
| Proveedor elegido | OBRAMAT Demo |
| Proveedor cambiado manualmente | No / Sí · Motivo: |
| Precio seleccionado (total pedido) | |
| Tiempo de respuesta proveedor (pasos 9-11) | |
| Pedidos completados | |
| Pedidos cancelados | |
| Tiempo medio confirmación proveedor | |
| Tiempo medio preparación | |
| Tiempo medio entrega (simulado) | |

---

## Objetivo UX Crítico

| Objetivo | Target | Real | ✓/✗ |
|----------|--------|------|-----|
| Instalador: Comprar material | < 20 seg | | |
| Proveedor: Gestionar pedido | < 10 seg | | |

**Análisis de dónde se pierde el tiempo (si no se cumple):**

```
Paso X → [descripción del cuello de botella]
Paso Y → [descripción]
```

---

## Bugs Encontrados (resumen)

| ID | Paso | Severidad | Estado |
|----|------|-----------|--------|
| | | | |

*Ver detalle completo en PZ001_BUGLOG.md*

---

## Mejoras UX Identificadas (resumen)

| ID | Paso | Prioridad |
|----|------|-----------|
| | | |

*Ver detalle completo en PZ001_UX.md*

---

## Estado del Piloto

- [ ] En curso
- [ ] Completado sin errores bloqueantes
- [ ] Completado con errores (ver buglog)
- [ ] Bloqueado (razón: _____________)

---

## Conclusión

*(A completar al finalizar el piloto)*

**¿Se cumplen los objetivos de tiempo?** Sí / No

**¿El flujo es completo y sin errores bloqueantes?** Sí / No

**¿Está listo para enseñar a un distribuidor?** Sí / No · Condiciones: ___________
