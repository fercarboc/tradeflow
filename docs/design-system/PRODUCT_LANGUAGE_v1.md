# TrabFlow Product Language v1

**Estado:** Activo · Versión 1.0 · Julio 2026  
**Propósito:** Glosario oficial de terminología visible al usuario. Eliminar lenguaje técnico de la interfaz.

---

## Regla general

Si un término requiere conocimiento técnico previo para entenderse, debe sustituirse.  
La interfaz habla el idioma del instalador y del distribuidor, no del programador.

---

## Glosario

### Términos correctos (usar siempre estos)

| Contexto | Usar | No usar |
|---|---|---|
| Compra de materiales | "Comprar material" | "Checkout" |
| Proceso de compra | "Revisar pedido", "Confirmar pedido" | "Wizard", "Steps" |
| Proveedor sugerido | "Proveedor recomendado" | "Offering", "Best offering" |
| Coincidencia | "Coincidencia", "Vinculado a" | "Match", "Matching", "Universal Product match" |
| Puntuación interna | "Recomendado", "Bueno", "Disponible" | "Score X pts", "Score 75" |
| Referencia de producto | "Referencia", "Material" | "SKU", "Universal Product", "UP" |
| Catálogo estándar | "Catálogo TrabFlow" | "Universal Product Catalog", "UP Catalog" |
| Integración IA | "Análisis automático", "Recomendaciones IA" | "AI Matching", "IA Matching score" |
| Estado de pedido | Ver tabla de estados → | "pending", "confirmed" (en crudo) |
| Panel principal | "Inicio" | "Dashboard" |
| Proveedor activo | "Activo" | "active" (en inglés) |

### Estados de pedido — instalador

| Estado interno | Mostrar al instalador |
|---|---|
| `pending` | Pendiente |
| `confirmed` | Confirmado |
| `preparing` | Preparando |
| `shipped` | En tránsito |
| `delivered` | Recibido |
| `completed` | Completado |
| `cancelled` | Cancelado |

### Estados de pedido — proveedor

| Estado interno | Mostrar al proveedor |
|---|---|
| `pending` | Pedido |
| `confirmed` | Confirmado |
| `preparing` | Preparando |
| `shipped` | Enviado |
| `delivered` | Entregado |
| `completed` | Completado |
| `cancelled` | Cancelado |

### Estados de vinculación (portal proveedor — catálogo)

| Estado interno | Mostrar en UI |
|---|---|
| `matched` | Vinculado |
| `suggested` | Sugerido |
| `pending_review` | Por revisar |
| `unmatched` | Sin vincular |

### Estados IA del catálogo

| Estado interno | Mostrar en UI |
|---|---|
| `compatible` | Compatible |
| `revisar` | Revisar |
| `duplicado` | Duplicado |
| `mejor_coincidencia` | Sugerido |
| `sin_up` | Sin vincular |
| `sin_stock` | Sin stock |

### Estados de proveedor

| Estado interno | Mostrar en UI |
|---|---|
| `active` | Activo |
| `pending` | Pendiente |
| `suspended` | Suspendido |
| `banned` | Suspendido |

---

## Acciones — nombres de botones

| Acción | Texto correcto | No usar |
|---|---|---|
| Confirmar pedido (proveedor) | "Confirmar pedido" | "Accept order", "Confirm" |
| Iniciar preparación | "Iniciar preparación" | "Set preparing", "Start fulfillment" |
| Marcar enviado | "Marcar como enviado" | "Ship order", "Mark shipped" |
| Recibir material | "Confirmar recepción" | "Mark as delivered", "Deliver" |
| Cancelar pedido | "Cancelar pedido" | "Cancel order" |
| Vincular producto | "Vincular" | "Match", "Link UP" |
| Ver seguimiento | "Ver seguimiento" | "Track order", "View tracking" |
| Volver al inicio | "Volver al inicio" | "Back", "Go home" |

---

## Mensajes de estado vacío

| Situación | Mensaje correcto |
|---|---|
| Sin pedidos pendientes | "No hay pedidos en este estado." |
| Sin resultados de búsqueda | "Sin resultados para tu búsqueda." |
| Sin alertas ni acciones | "Todo al día. Sin alertas ni acciones pendientes." |
| Error de carga | "No se pudo cargar la información. Inténtalo de nuevo." |
| Sin conexión | "Sin conexión. Comprueba tu red e inténtalo de nuevo." |

---

## Mensajes de error

- **Siempre en español** y sin tecnicismos.
- **Siempre con acción:** no solo "Error" — explicar qué hacer.
- **Nunca mostrar:** stack traces, IDs de error internos, mensajes del servidor sin procesar.

```
❌ "Error: constraint violation on trade_marketplace_orders"
✅ "No se pudo confirmar el pedido. Inténtalo de nuevo o contacta con soporte."
```

---

## Comunicación contextual

### Saludos en portal proveedor

| Hora | Saludo |
|---|---|
| 00:00–11:59 | "Buenos días, [empresa]" |
| 12:00–19:59 | "Buenas tardes, [empresa]" |
| 20:00–23:59 | "Buenas noches, [empresa]" |

### Confirmaciones de acción

Siempre confirmar lo que acaba de pasar, no lo que va a pasar:

```
❌ "Se va a confirmar el pedido MP-2026-001"
✅ "Pedido MP-2026-001 confirmado. El instalador recibirá una notificación."
```

---

## Checklist de revisión de lenguaje

Antes de publicar cualquier pantalla nueva:

- [ ] ¿Hay algún término en inglés visible al usuario?
- [ ] ¿Hay algún identificador técnico (SKU, UP, UUID) visible?
- [ ] ¿Los estados de pedido usan las etiquetas correctas para el rol del usuario?
- [ ] ¿Los botones de acción dicen exactamente qué va a pasar?
- [ ] ¿Los mensajes de error explican qué hacer?
- [ ] ¿Los mensajes de estado vacío son constructivos?

---

## Alcance de este documento

Este documento cubre la **terminología de interfaz** (UI/UX): estados de pedido, nombres de botones, mensajes de error y estado vacío, términos visibles en la plataforma.

Para **terminología comercial** (qué decir a instaladores, distribuidores, asociaciones, inversores; términos aprobados/prohibidos como "usuario piloto" vs "beta tester"; mensajes por audiencia):

> **Referencia:** [`docs/PRODUCT_LANGUAGE.md`](../PRODUCT_LANGUAGE.md) — Guía oficial de lenguaje comercial (julio 2026)
