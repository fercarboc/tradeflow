# TrabFlow AI — Módulo Trabajos Externalizados y Gastos

**Fecha implementación:** 2026-06-15  
**Estado:** IMPLEMENTADO Y DESPLEGADO  
**Nombre en UI:** "Trabajos Externalizados" (la palabra "subcontrata" nunca aparece al cliente)

---

## 1. Qué son los Trabajos Externalizados

Cuando una empresa no tiene disponibilidad o especialidad, subcontrata a otro instalador o empresa para que ejecute el trabajo. TrabFlow gestiona todo el ciclo internamente:

- El cliente ve una "partida de obra" en su presupuesto, nunca "subcontrata"
- El instalador define el coste del proveedor y el precio al cliente (con margen)
- Se lleva el seguimiento completo desde solicitar presupuesto hasta pagar la factura

---

## 2. Estados del trabajo externalizado (10 pasos)

| # | Estado | Descripción |
|---|--------|-------------|
| 1 | `pendiente` | Recién creado, sin acción tomada |
| 2 | `solicitado` | Has contactado al proveedor |
| 3 | `presupuesto_recibido` | El proveedor te ha enviado precio |
| 4 | `añadido_presupuesto` | Ya figura como partida en el presupuesto del cliente |
| 5 | `pendiente_cliente` | Esperando aceptación del cliente |
| 6 | `en_curso` | El proveedor está ejecutando el trabajo |
| 7 | `completado` | Trabajo terminado |
| 8 | `factura_recibida` | El proveedor ha enviado su factura |
| 9 | `pagado` | Factura pagada — **BLOQUEADO: solo lectura** |
| 10 | `cancelado` | Trabajo cancelado |

---

## 3. Calculadora de margen

Al crear o editar un trabajo externalizado puedes:
- Introducir el coste del proveedor
- Seleccionar margen con botones rápidos: 15% / 20% / 25% / 30% / 40%
- El precio al cliente se calcula automáticamente: `precio = coste / (1 - margen/100)`
- También puedes introducir el precio al cliente manualmente

---

## 4. Proveedores Colaboradores

Directorio de empresas y autónomos colaboradores con:
- Datos básicos: nombre, teléfono, email, CIF/NIF
- Dirección fiscal y dirección habitual de trabajo
- Persona de contacto, horarios, área de cobertura
- Valoración (1-5 estrellas)
- Estado: activo / pendiente / bloqueado
- Historial de todos los trabajos realizados con ese proveedor

---

## 5. Integración con Presupuestos

- Desde el panel de vista previa de un presupuesto se puede añadir un trabajo externalizado como partida
- Si el presupuesto ya está en estado "Facturado", el botón "+ Añadir trabajo externalizado" desaparece
- Al añadir, se vincula `presupuesto_id` en la tabla `trade_subcontratas`

---

## 6. Módulo Gastos (en ScreenIngresos)

ScreenIngresos tiene ahora 3 pestañas:

### Pestaña Ingresos
- Sin cambios: gráfico mensual, KPIs, top clientes

### Pestaña Gastos (sub-pestañas)
1. **Compras de material**: facturas de proveedores de material (mayoristas/distribuidores)
   - Concepto, proveedor (mayorista), referencia de factura, importe base, IVA (0/10/21%), fecha, vencimiento, pagado
   - Vinculable a un trabajo concreto
2. **Externalizados**: vista de todas las facturas a proveedores colaboradores
3. **Mayoristas / Distribuidores**: directorio de proveedores de material

### Pestaña Resultado
- Resultado neto = ingresos cobrados − (compras pagadas + externalizados pagados)
- Margen bruto en porcentaje
- Gráfico de barras dual: ingresos (azul) vs gastos (rojo) por mes

---

## 7. Mayoristas / Distribuidores (proveedores de material)

Son los proveedores que te venden materiales, distintos de los que prestan servicios.

Campos del proveedor:
- Nombre comercial, razón social, NIF
- Dirección fiscal, CP, ciudad, provincia
- Teléfono, email, persona de contacto, web
- Notas internas
- Activo / inactivo

Registro de facturas de compra:
- Concepto, referencia de factura, importe base, IVA (0/10/21%)
- Fecha de la factura, fecha de vencimiento
- Estado: pagada / pendiente
- Vinculación opcional a un trabajo concreto

---

## 8. Tablas en BD

### `trade_subcontractors` (proveedores colaboradores)
Ampliado con campos: `direccion_fiscal`, `direccion_trabajo`, `persona_contacto`, `horarios`, `cobertura`, `valoracion` (SMALLINT 1-5), `estado_proveedor` (activo/pendiente/bloqueado)

### `trade_subcontratas` (trabajos externalizados)
10 estados: pendiente / solicitado / presupuesto_recibido / añadido_presupuesto / pendiente_cliente / en_curso / completado / factura_recibida / pagado / cancelado

### `trade_mayoristas` (proveedores de material)
Tabla nueva. Campos fiscales completos + activo.

### `trade_compras` (facturas de compra de material)
Tabla nueva. FK a `trade_mayoristas`, FK a `trade_jobs`, `iva_pct`, `pagado`, `pagado_at`.

---

## 9. Reglas de negocio implementadas

- Un trabajo externalizado en estado `pagado` no se puede editar ni eliminar (solo lectura)
- No se pueden añadir trabajos externalizados a un presupuesto en estado "Facturado"
- La referencia SUB-YYYY-NNN se genera automáticamente por trigger de BD
- El cliente nunca ve el término "subcontrata" — el componente se llama `ScreenSubcontratas` internamente pero toda la UI lo llama "Trabajo externalizado" o "partida"

---

*Actualizado: 15 de junio de 2026 — Módulo completamente implementado y desplegado en producción*
