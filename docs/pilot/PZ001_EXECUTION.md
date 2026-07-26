# PZ-001 — Guía de Ejecución Operativa

**Piloto Zero · TrabFlow Marketplace**
**Fecha:** 2026-07-26
**Ejecutor:** Fernando (TrabFlow)
**Versión Vercel:** aeee83c

---

## Actores

| Rol | Cuenta | Nombre comercial |
|-----|--------|-----------------|
| Instalador | legal@inmostay.com | TrabFlow Instalaciones Demo |
| Proveedor | contacto@inmostay.com | OBRAMAT Demo |

> Tratar ambas cuentas exactamente como si fueran clientes reales de primer acceso.

---

## Cómo usar esta guía

- Ejecuta cada paso en el navegador exactamente como lo haría un usuario real.
- Anota el tiempo (puedes usar el reloj del sistema o el cronómetro del navegador).
- Si encuentras un bug, anótalo en `PZ001_BUGLOG.md`.
- Si encuentras una confusión UX, anótala en `PZ001_UX.md`.
- Actualiza el estado de cada paso: ✅ Correcto / ❌ Error / ⚠️ Mejorable.

---

## BLOQUE 1 — INSTALADOR: Crear y Aceptar Presupuesto

### PASO 1 — Login Instalador

**Cuenta:** legal@inmostay.com
**URL:** https://www.trabflow.com/login

**Pasos:**
1. Ir a trabflow.com
2. Hacer clic en "Iniciar sesión"
3. Introducir credenciales de legal@inmostay.com
4. Confirmar que entra directamente al Panel de Control del ERP

**Verificar:**
- [ ] Entra directamente al ERP sin WorkspaceSelector
- [ ] El header muestra "TrabFlow AI — Panel de gestión"
- [ ] Se ve el panel de control con KPIs y accesos rápidos
- [ ] No hay bucle ni flash de pantalla

**Tiempo:** ___ seg
**Estado:** □ Pendiente / ✅ Correcto / ❌ Error / ⚠️ Mejorable
**Notas:**

---

### PASO 2 — Crear Presupuesto por Voz IA

**Desde:** Panel de Control

**Pasos:**
1. Hacer clic en "PRESUPUESTO POR VOZ IA" (tarjeta azul)
2. Esperar que cargue el asistente de voz
3. Dictar o escribir algo como:
   > "Instalar 3 grifos monomando en baño, 2 horas de mano de obra, desplazamiento"
4. Revisar las partidas generadas por la IA
5. Añadir cliente: "TrabFlow Instalaciones Demo · Cliente 1" (o crear nuevo)
6. Guardar el presupuesto

**Verificar:**
- [ ] El asistente de voz/texto responde correctamente
- [ ] La IA genera al menos 3 partidas con precios
- [ ] Se puede editar las partidas antes de guardar
- [ ] El presupuesto queda en estado "Borrador" o similar

**Tiempo:** ___ seg
**Estado:** □ Pendiente / ✅ Correcto / ❌ Error / ⚠️ Mejorable
**Notas:**

---

### PASO 3 — Aceptar Presupuesto

**Desde:** Presupuestos → el presupuesto recién creado

**Pasos:**
1. Ir a la sección "Presupuestos"
2. Localizar el presupuesto recién creado
3. Abrirlo y marcarlo como "Aceptado" (simular que el cliente ha aceptado)
   — o usar el flujo de firma digital si está disponible

**Verificar:**
- [ ] El estado del presupuesto cambia a "Aceptado"
- [ ] Se genera o sugiere la creación de un Trabajo asociado
- [ ] La interfaz es clara sobre el siguiente paso

**Tiempo:** ___ seg
**Estado:** □ Pendiente / ✅ Correcto / ❌ Error / ⚠️ Mejorable
**Notas:**

---

## BLOQUE 2 — INSTALADOR: Comprar Material en Marketplace

### PASO 4 — Acceder al Marketplace

**Desde:** Panel de Control o menú lateral

**Pasos:**
1. Localizar el acceso al Marketplace en el menú lateral (puede llamarse "Pedidos", "Marketplace", o similar)
2. O desde el presupuesto aceptado, si hay un CTA "Comprar material"
3. Entrar a la sección de Marketplace/Catálogo de proveedores

**Verificar:**
- [ ] El acceso al Marketplace es visible y claro desde el panel
- [ ] Carga correctamente con los proveedores disponibles
- [ ] OBRAMAT Demo aparece como proveedor activo

**Tiempo:** ___ seg
**Estado:** □ Pendiente / ✅ Correcto / ❌ Error / ⚠️ Mejorable
**Notas:**

---

### PASO 5 — Revisar Catálogo y Añadir al Carrito

**Desde:** Marketplace · OBRAMAT Demo

**Pasos:**
1. Entrar al catálogo de OBRAMAT Demo
2. Buscar artículos relacionados con el presupuesto (grifos, tubería, etc.)
3. Añadir al menos 2 artículos al carrito
4. Verificar que el carrito muestra los artículos correctamente

**Verificar:**
- [ ] El catálogo muestra productos con precio
- [ ] La búsqueda funciona
- [ ] El botón "Añadir al carrito" funciona
- [ ] El contador del carrito se actualiza
- [ ] Los precios son coherentes

**Tiempo:** ___ seg
**Estado:** □ Pendiente / ✅ Correcto / ❌ Error / ⚠️ Mejorable
**Notas:**

---

### PASO 6 — Revisar Carrito y Confirmar Compra

**Desde:** Carrito de compra

**Pasos:**
1. Ir al carrito
2. Revisar el resumen de artículos y precio total
3. Seleccionar o confirmar la dirección de entrega
4. Hacer clic en "Confirmar pedido" o "Realizar compra"

**Verificar:**
- [ ] El carrito muestra un resumen claro
- [ ] El total es correcto
- [ ] Hay campo para notas o dirección de entrega
- [ ] El botón de confirmación es visible y funcional

**Tiempo:** ___ seg
**Estado:** □ Pendiente / ✅ Correcto / ❌ Error / ⚠️ Mejorable
**Notas:**

---

### PASO 7 — Pedido Generado

**Tras confirmar la compra:**

**Verificar:**
- [ ] Se genera un número de pedido
- [ ] El instalador recibe confirmación (pantalla o notificación)
- [ ] El pedido queda en estado "Pendiente de confirmación" por el proveedor
- [ ] Hay alguna forma de ver el estado del pedido (Seguimiento)

**Tiempo:** ___ seg
**Estado:** □ Pendiente / ✅ Correcto / ❌ Error / ⚠️ Mejorable
**Notas:**

---

## BLOQUE 3 — PROVEEDOR: Gestionar el Pedido

### PASO 8 — Pedido Llega al Portal Proveedor

*(Inmediatamente después del Paso 7, sin cerrar sesión de instalador)*

**Verificar en DB o lógica:**
- [ ] El pedido creado aparece en el sistema con estado correcto
- [ ] El actor OBRAMAT Demo tiene el pedido asociado

**Notas:**

---

### PASO 9 — Login Proveedor

**Cuenta:** contacto@inmostay.com
**URL:** https://www.trabflow.com/login (o /proveedor)

**Pasos:**
1. Abrir ventana de incógnito o Edge InPrivate
2. Ir a trabflow.com
3. Iniciar sesión con contacto@inmostay.com
4. Confirmar que entra directamente al Portal Proveedor OBRAMAT Demo

**Verificar:**
- [ ] Entra al Portal Proveedor sin pasar por ERP ni WorkspaceSelector
- [ ] La cabecera muestra "OBRAMAT Demo · Portal"
- [ ] No hay bucle

**Tiempo:** ___ seg
**Estado:** □ Pendiente / ✅ Correcto / ❌ Error / ⚠️ Mejorable
**Notas:**

---

### PASO 10 — Centro de Acción

**Desde:** Portal OBRAMAT Demo · Inicio

**Pasos:**
1. Verificar que el Centro de Acción muestra el nuevo pedido
2. Hacer clic en "Ver pedidos →" o similar

**Verificar:**
- [ ] El contador "Pedidos sin confirmar" ha aumentado a 1 (o más)
- [ ] El Centro de Acción muestra el pedido del instalador
- [ ] La urgencia es clara (menos de 24h para mantener el score)

**Tiempo:** ___ seg
**Estado:** □ Pendiente / ✅ Correcto / ❌ Error / ⚠️ Mejorable
**Notas:**

---

### PASO 11 — Confirmar Pedido

**Desde:** Portal · Pedidos

**Pasos:**
1. Entrar a la sección "Pedidos"
2. Localizar el pedido del instalador TrabFlow Instalaciones Demo
3. Revisar el detalle: artículos, cantidades, dirección de entrega
4. Hacer clic en "Confirmar pedido"

**Verificar:**
- [ ] El pedido muestra el detalle correcto de artículos
- [ ] Hay un botón "Confirmar" visible y accesible
- [ ] Al confirmar, el estado cambia correctamente
- [ ] El instalador recibiría una notificación (aunque no se verifique en tiempo real)

**Tiempo:** ___ seg
**Estado:** □ Pendiente / ✅ Correcto / ❌ Error / ⚠️ Mejorable
**Notas:**

---

### PASO 12 — Preparar Pedido

**Desde:** Portal · Pedidos · Pedido confirmado

**Pasos:**
1. Desde el pedido confirmado, hacer clic en "Preparar" o "En preparación"
2. Confirmar que el estado cambia a "En preparación"

**Verificar:**
- [ ] Existe la acción "Preparar" disponible
- [ ] El cambio de estado es inmediato y visible
- [ ] El timeline del pedido se actualiza

**Tiempo:** ___ seg
**Estado:** □ Pendiente / ✅ Correcto / ❌ Error / ⚠️ Mejorable
**Notas:**

---

### PASO 13 — Enviar Pedido

**Desde:** Portal · Pedidos · Pedido en preparación

**Pasos:**
1. Hacer clic en "Enviar" o "Marcar como enviado"
2. Opcionalmente, introducir número de seguimiento (puede ser ficticio: "OBRAMAT-001")
3. Confirmar el envío

**Verificar:**
- [ ] Existe la acción "Enviar" disponible tras preparar
- [ ] Se puede añadir número de tracking (opcional)
- [ ] El estado cambia a "Enviado" o "En camino"

**Tiempo:** ___ seg
**Estado:** □ Pendiente / ✅ Correcto / ❌ Error / ⚠️ Mejorable
**Notas:**

---

## BLOQUE 4 — INSTALADOR: Recibir y Confirmar

### PASO 14 — Tracking del Pedido

**Cuenta:** legal@inmostay.com (volver a esta sesión)

**Pasos:**
1. Ir a la sección de Seguimiento / Pedidos en el ERP
2. Verificar que el pedido aparece actualizado con el estado "En camino"

**Verificar:**
- [ ] El instalador puede ver el estado actualizado del pedido
- [ ] El número de tracking (si se introdujo) es visible
- [ ] La interfaz de seguimiento es clara

**Tiempo:** ___ seg
**Estado:** □ Pendiente / ✅ Correcto / ❌ Error / ⚠️ Mejorable
**Notas:**

---

### PASO 15 — Push al Instalador

**Verificar:**
- [ ] Si las notificaciones push están activas, el instalador recibe una notificación de envío
- [ ] El contenido de la notificación es claro y accionable

*(Si push no está activo en el dispositivo de prueba, marcar como N/A)*

**Estado:** □ N/A / ✅ Correcto / ❌ Error / ⚠️ Mejorable
**Notas:**

---

### PASO 16 — Seguimiento Detallado

**Desde:** ERP Instalador · Pedidos / Seguimiento

**Pasos:**
1. Abrir el pedido en detalle
2. Revisar el timeline completo: Pendiente → Confirmado → Preparación → Enviado

**Verificar:**
- [ ] El timeline muestra todos los estados con fechas
- [ ] La información de seguimiento es suficiente para el instalador
- [ ] No hay estados confusos o incompletos

**Tiempo:** ___ seg
**Estado:** □ Pendiente / ✅ Correcto / ❌ Error / ⚠️ Mejorable
**Notas:**

---

### PASO 17 — Confirmar Recepción

**Desde:** ERP Instalador · Pedidos

**Pasos:**
1. Hacer clic en "Confirmar recepción" o "He recibido el pedido"
2. Opcional: dejar valoración del proveedor

**Verificar:**
- [ ] Existe la acción "Confirmar recepción"
- [ ] El estado del pedido cambia a "Entregado" o similar
- [ ] Hay opción de valoración o feedback

**Tiempo:** ___ seg
**Estado:** □ Pendiente / ✅ Correcto / ❌ Error / ⚠️ Mejorable
**Notas:**

---

## BLOQUE 5 — CIERRE: Trabajo y Factura

### PASO 18 — Trabajo Desbloqueado

**Verificar:**
- [ ] El trabajo asociado al presupuesto está disponible para avanzar
- [ ] No hay bloqueos por el estado del pedido de material
- [ ] La relación Presupuesto → Trabajo → Pedido es trazable

**Estado:** □ Pendiente / ✅ Correcto / ❌ Error / ⚠️ Mejorable
**Notas:**

---

### PASO 19 — Generar Factura

**Desde:** ERP Instalador · Presupuestos o Trabajos

**Pasos:**
1. Desde el presupuesto aceptado, convertir a factura
2. Revisar los datos de la factura
3. Generar PDF o descargar

**Verificar:**
- [ ] El flujo presupuesto → factura es directo
- [ ] La factura incluye todos los datos fiscales correctos
- [ ] Se puede descargar en PDF o Word
- [ ] El número de factura es correlativo y correcto

**Tiempo:** ___ seg
**Estado:** □ Pendiente / ✅ Correcto / ❌ Error / ⚠️ Mejorable
**Notas:**

---

### PASO 20 — Fin del Flujo

**Verificar el estado final del sistema:**
- [ ] El presupuesto está en estado "Aceptado" / "Facturado"
- [ ] El trabajo está en estado "Completado" (si aplica)
- [ ] El pedido está en estado "Entregado"
- [ ] El instalador tiene la factura generada
- [ ] El proveedor tiene el pedido cerrado en su portal
- [ ] No quedan estados intermedios colgados

**Estado:** □ Pendiente / ✅ Correcto / ❌ Error / ⚠️ Mejorable
**Notas:**

---

## Resumen de Tiempos

| Bloque | Actividad | Tiempo Objetivo | Tiempo Real | Resultado |
|--------|-----------|----------------|-------------|-----------|
| 1 | Login instalador | < 5 seg | | |
| 1-2 | Crear presupuesto IA | < 60 seg | | |
| 3 | Aceptar presupuesto | < 10 seg | | |
| 4-7 | Comprar material completo | **< 20 seg** | | |
| 9 | Login proveedor | < 5 seg | | |
| 10-13 | Gestionar pedido completo | **< 10 seg** | | |
| 14-17 | Recibir y confirmar | < 15 seg | | |
| 19 | Generar factura | < 15 seg | | |
| **TOTAL** | **Flujo completo** | **< 3 min** | | |

---

## Checklist Final

- [ ] Flujo completo realizado sin errores bloqueantes
- [ ] Tiempos medidos
- [ ] Bugs registrados en PZ001_BUGLOG.md
- [ ] UX evaluada en PZ001_UX.md
- [ ] Métricas actualizadas en PZ001_REPORT.md
- [ ] Documentación lista para enseñar a distribuidor
