# TrabFlow — Demo y Guía de Piloto

**Versión:** 1.0 — Julio 2026  
**Estado:** Normativo. Basado en el estado real del producto.  
**Audiencia:** Fernando (quien presenta) y futuros vendedores.

---

## Tipos de demo

| Tipo | Audiencia | Duración | Objetivo |
|---|---|---|---|
| Demo instalador (voz) | Instaladores, asociaciones | 10 min | Mostrar presupuesto por voz y flujo completo |
| Demo Marketplace (distribuidor) | OBRAMAT, SALTOKI, SONEPAR | 20–35 min | Mostrar el ciclo del pedido completo |
| Demo interactiva (sin login) | Cualquiera | Auto-guiada | Captura de leads en la landing |
| Demo partner guiada | Distribuidores en reunión | 15 min | Flujo desde perspectiva del distribuidor |

---

## Demo 1: Instalador — Presupuesto por voz

### Propósito

Mostrar que un instalador puede crear un presupuesto profesional en 30 segundos sin teclear nada.

### Configuración

- **Cuenta:** instalador-demo@trabflow.com
- **Oficio:** Electricidad
- **Plan:** Profesional (sin límites)
- **Asegurarse de:** Catálogo de proveedor cargado con referencias de electricidad

### Guión (10 min)

**1. Dashboard (1 min)**

Mostrar el dashboard. Mostrar KPIs (presupuestos, trabajos, clientes). El objetivo es demostrar que la app gestiona todo, no solo el presupuesto.

Frase: *"Esto es lo que ve el instalador cuando abre la app por la mañana."*

**2. Presupuesto por voz (3 min)**

1. Pulsar el micrófono grande.
2. Decir en voz alta, con el ritmo natural de una conversación:

   *"Presupuesto para cambio de cuadro eléctrico en local comercial. Cuadro de superficie 12 elementos, cable de 2,5 mm para circuitos, diferencial de 25 amperios, IGA de 40 amperios, luminaria LED para el local. El local tiene unos 80 metros cuadrados."*

3. El motor IA transcribe y genera las partidas en ~15-20 segundos.
4. Mostrar el resultado: partidas con precios, unidades, descripciones.

Frases clave:
- *"Ha entendido el trabajo. Ha buscado los precios en el catálogo del proveedor. Ha generado un presupuesto de verdad, no una lista."*
- *"El instalador habló 20 segundos. El sistema hizo el resto."*

**3. PDF y envío al cliente (2 min)**

1. Pulsar "Guardar" → el PDF se genera automáticamente.
2. Mostrar el PDF: logo, datos de empresa, partidas, IVA, total.
3. Pulsar "Enviar al cliente" → opciones: email, WhatsApp con link, descarga PDF.
4. Abrir el link en otra pestaña: el cliente ve el presupuesto limpio, puede aceptar con un clic.

Frase: *"El cliente acepta. TrabFlow lo registra. El instalador lo sabe en tiempo real."*

**4. Factura en un clic (2 min)**

1. Desde el presupuesto aceptado, pulsar "Crear factura".
2. La factura se genera con los datos del presupuesto. Legal, con número de factura, fecha, IVA desglosado.
3. El instalador puede enviarla al cliente directamente.

Frase: *"De obra a factura en menos de 5 minutos sin tocar un Excel."*

**5. Cierre (2 min)**

Mostrar el contrato de mantenimiento SAT si hay tiempo. Mostrar que se puede gestionar el equipo de técnicos. Mostrar la ruta del día.

---

## Demo 2: Marketplace — Ciclo del pedido completo

### Propósito

Mostrar a un distribuidor (OBRAMAT, SALTOKI, SONEPAR) cómo TrabFlow conecta sus catálogos con instaladores que ya están comprando material.

### Mensaje central

> *"Sus referencias de catálogo se convierten automáticamente en pedidos confirmados, sin que el instalador tenga que buscar nada ni hacer llamadas."*

### Configuración necesaria

**Cuenta instalador demo:**
```
Email:    instalador-demo@trabflow.com
Empresa:  Instalaciones Demo TrabFlow S.L.
Plan:     Profesional
Situación: Presupuesto DEMO-2026-001 en estado "Enviado" (aceptado por el cliente)
```

**Cuenta proveedor demo:**
```
Email:    proveedor-demo@trabflow.com
Empresa:  Distribución Demo TrabFlow S.A.
Catálogo: 500 referencias activas de electricidad y climatización
```

**Presupuesto demo de referencia:**
```
Presupuesto #DEMO-2026-001
Cliente: Comunidad de Propietarios Las Encinas
Trabajo: Renovación cuadro eléctrico + iluminación LED
Total: 4.850 €

Materiales incluidos:
- Cable manguera 3×2.5mm RZ1-K 100m
- Caja distribución superficie 12 elementos
- Interruptor diferencial 2P 25A 300mA
- Tira LED 4000K 14W/m (5m)
- Luminaria industrial LED 150W 4000K (×4)
- IGA 40A Schneider
```

### Checklist pre-demo

- [ ] Cuenta instalador activa, sesión iniciada
- [ ] Cuenta proveedor activa, catálogo cargado
- [ ] Presupuesto DEMO-2026-001 en estado "Enviado"
- [ ] Carrito de sesión anterior limpiado
- [ ] Dos dispositivos o dos pestañas del navegador preparadas (instalador + proveedor)
- [ ] Conexión de red estable
- [ ] Modo dark si se proyecta (mayor contraste)

### Guión (20 min)

**1. Contexto (3 min)**

Frase de apertura: *"Hoy les voy a mostrar cómo un instalador eléctrico pide material directamente desde el presupuesto que acaba de generar para su cliente. Sin email. Sin llamada. Sin buscar en ningún catálogo."*

Mostrar el presupuesto DEMO-2026-001 ya generado. El instalador ya tiene el trabajo cerrado. Solo le falta el material.

**2. Del presupuesto al pedido (5 min)**

1. Pulsar **"Comprar en Marketplace"** desde el presupuesto.
2. Pantalla "Revisar pedido" → el sistema ya seleccionó el proveedor recomendado automáticamente.
3. Señalar: precio total, días de entrega estimados, proveedor seleccionado.
4. Cambiar estrategia a "Menor precio" → mostrar que el sistema recalcula.
5. Pulsar "Siguiente" → pantalla de confirmación con resumen por proveedor.
6. Pulsar "Confirmar pedido" → pantalla de éxito.

Frases clave:
- *"El instalador no buscó en ningún catálogo. El sistema ya sabía qué material necesitaba y cuál es su proveedor preferido."*
- *"Si tiene cuenta en varios distribuidores, compara automáticamente."*
- *"En menos de 30 segundos ha hecho el pedido sin salir de la aplicación."*

**3. Vista del proveedor (7 min)**

Cambiar a la cuenta del proveedor (segunda pestaña o dispositivo).

1. Mostrar el Dashboard del proveedor → alerta: "1 pedido pendiente de confirmar".
2. Ir a "Pedidos" → el pedido recién llegado aparece destacado en ámbar.
3. El CTA "Confirmar pedido" es visible sin necesidad de expandir la tarjeta.
4. Pulsar "Confirmar pedido" → modal de confirmación → confirmar.
   - Estado cambia a "Confirmado".
5. Pulsar "Iniciar preparación" → estado cambia a "Preparando".
6. Pulsar "Marcar como enviado" → introducir referencia de tracking → confirmar.
   - Estado cambia a "Enviado".

Frases clave:
- *"Desde que llega el pedido hasta que lo confirman: menos de 10 segundos."*
- *"No hay emails, no hay llamadas. El instalador ve el cambio en tiempo real."*
- *"Si tienen ERP, esto puede conectarse por API."*

**4. Seguimiento del instalador (3 min)**

Volver a la cuenta del instalador → sección "Seguimiento".

1. Mostrar que el pedido ya está en "Preparando".
2. Cuando el proveedor marcó como enviado, aparece "En tránsito" con el número de tracking.
3. Mostrar en móvil si es posible.

Frases clave:
- *"El instalador sabe en tiempo real dónde está su material sin hacer ninguna llamada."*
- *"Cuando recibe el material, pulsa 'Confirmar recepción' y el trabajo queda listo para facturar."*

**5. Catálogo del proveedor (2 min)**

Mostrar la pestaña "Catálogo" del portal proveedor.

1. Buscar una referencia específica.
2. Mostrar el estado "Vinculado" → significa que los instaladores encontrarán esta referencia cuando pidan ese material.
3. Mostrar el estado "Por revisar" → referencias que el sistema sugirió pero el proveedor debe validar.

Frases clave:
- *"Sus referencias se mapean automáticamente al catálogo estándar de TrabFlow."*
- *"Para las que no se vinculan solas, hay un proceso sencillo de validación."*

---

## Q&A habitual — Distribuidores

**"¿Cómo se sube el catálogo?"**  
Via CSV estándar (referencia, descripción, precio, stock). También por API si tienen ERP. Tiempo estimado para el primer upload: 2 horas con soporte de TrabFlow.

**"¿Qué pasa si no tenemos stock de algo?"**  
El proveedor puede marcar referencias como sin stock desde el portal. Dejan de aparecer en las recomendaciones hasta que se reponga el stock.

**"¿Cómo saben los instaladores que estamos aquí?"**  
TrabFlow puede enviar invitaciones a los instaladores que ya compran con vosotros. También aparecéis automáticamente cuando un instalador pide el material que vosotros tenéis en catálogo.

**"¿Cuánto tiempo tarda en estar operativo?"**  
Piloto funcional en 2 semanas: semana 1 importación y validación del catálogo, semana 2 primeros pedidos reales.

**"¿Se integra con nuestro ERP?"**  
Hay una API REST en desarrollo. Para los pilotos iniciales se puede operar sin integración ERP — el portal es completamente autosuficiente.

**"¿Cuál es el coste?"**  
En la fase piloto, sin coste. Los modelos a largo plazo son: fee mensual por aparecer en el catálogo, o comisión del 2-3% sobre pedidos realizados a través de TrabFlow. Esto se define con cada distribuidor individualmente.

**"¿Cuántos instaladores tienen?"**  
[Completar con datos reales de usuarios activos cuando estén disponibles].

---

## Q&A habitual — Instaladores

**"¿Funciona para mi oficio?"**  
Electricidad, fontanería, climatización, reformas, pintura, carpintería, cerrajería, albanilería, y más. Si tienes dudas, lo probamos en vivo.

**"¿Cuánto cuesta?"**  
Trial gratuito de 3 meses. Después, desde 29€/mes. Puedes cancelar cuando quieras.

**"¿Necesito saber de tecnología?"**  
No. Solo necesitas saber hablar. Todo lo demás lo hace TrabFlow.

**"¿Funciona sin internet?"**  
Necesitas internet para crear presupuestos y sincronizar. La app está diseñada para funcionar bien con conexión de obra (3G/4G).

**"¿Mis datos están seguros?"**  
Sí. Los datos se guardan en servidores europeos con cifrado. Cada empresa solo accede a sus propios datos.

---

## Preparación de un piloto real

### Qué es un piloto

Un piloto es cuando un proveedor real carga su catálogo real y un instalador real hace un pedido real a través de TrabFlow.

Un piloto no es: una demo con datos ficticios, una promesa comercial sin producto, o una integración técnica compleja.

### Pasos para activar un piloto

**Semana 1 — Onboarding del proveedor**

1. Crear cuenta de actor Marketplace para el proveedor en la plataforma.
2. Enviar invitación al email del contacto del proveedor.
3. Proveedor acepta la invitación y accede al portal.
4. Exportar catálogo del proveedor a CSV (referencia, nombre, precio, stock, unidad).
5. Subir el CSV al portal desde `AdminSuppliersSection` o desde el propio portal del proveedor.
6. Ejecutar el proceso de vinculación IA (matching de referencias al catálogo universal).
7. Validar juntos las referencias con estado "Por revisar" — proveedor confirma o corrige.

**Semana 2 — Primer pedido real**

1. Identificar un instalador real de la red del proveedor.
2. Crear su cuenta en TrabFlow (trial gratuito).
3. Verificar que el instalador puede crear un presupuesto con material del proveedor.
4. El instalador hace un pedido real a través del Marketplace.
5. El proveedor lo recibe en su portal, lo confirma, lo prepara, lo envía.
6. El instalador confirma la recepción.
7. Recoger feedback de ambas partes.

### Errores conocidos y cómo gestionarlos

| Error | Causa probable | Solución |
|---|---|---|
| El proveedor no recibe la invitación | Spam / filtro de email corporativo | Comprobar carpeta spam. Reenviar desde admin si necesario. |
| Los precios del catálogo no coinciden con los del proveedor | CSV exportado con datos desactualizados | Pedir al proveedor un CSV fresco de su sistema. |
| Una referencia no aparece en las recomendaciones | La referencia tiene estado "Por revisar" o "Sin vincular" | Revisar el catálogo en el portal y vincular manualmente. |
| El proveedor no ve el pedido | El pedido está asociado a otro actor | Verificar que el instalador seleccionó al proveedor correcto en el checkout. |
| El instalador ve "Error al crear el carrito" | Presupuesto no está en estado "Enviado" | El presupuesto debe haber sido enviado y aceptado por el cliente para poder comprarse. |

### Recomendaciones para el primer piloto

1. **Empezar con un catálogo pequeño** — 50-100 referencias en lugar de todo el catálogo. Más fácil de validar y gestionar.
2. **Elegir instaladores motivados** — no usuarios aleatorios. Buscar a alguien que ya haya pedido la necesidad de esto.
3. **Hacer el primer pedido juntos** — estar presente (en persona o por videollamada) cuando el instalador hace su primer pedido. Identificar fricción inmediatamente.
4. **Documentar todo** — capturas de pantalla, tiempos, comentarios. Este es el contenido del caso de estudio para el segundo proveedor.

---

## Recomendaciones generales para demos

1. **Siempre en vivo** — nunca usar grabaciones en reuniones con inversores o proveedores. La demo en vivo demuestra que el producto es real y funciona.

2. **Preparar el reset del demo** — antes de cada demo, limpiar el carrito de la sesión anterior. Ejecutar el script de reset si existe.

3. **Tener datos de fallback** — si el motor IA tarda más de 20 segundos, tener un presupuesto ya generado para enseñar mientras tanto.

4. **Conocer los límites actuales** — no prometer Realtime en el portal del proveedor todavía (ADR-001). La lista se actualiza al recargar. Si preguntan, decir "está en el roadmap para el próximo sprint".

5. **El silencio es el error más caro** — si algo va mal en la demo, narrar lo que está pasando y mantener la confianza. *"El motor IA está analizando el texto. Normalmente tarda 15-20 segundos."*

---

## Script de reset de demo

Ejecutar antes de cada demo de Marketplace:

```sql
-- Limpiar estado de demo (ejecutar en Supabase SQL Editor)
-- Reemplazar [demo_org_id] con el ID real de la org de demo

-- Limpiar carrito
DELETE FROM trade_marketplace_carts 
WHERE org_id = '[demo_org_id]';

-- Limpiar pedidos de demo (cuidado: esto borra historial)
-- Solo ejecutar en cuenta de demo, nunca en producción real
DELETE FROM trade_marketplace_order_events 
WHERE order_id IN (
  SELECT id FROM trade_marketplace_orders WHERE org_id = '[demo_org_id]'
);
DELETE FROM trade_marketplace_order_lines 
WHERE order_id IN (
  SELECT id FROM trade_marketplace_orders WHERE org_id = '[demo_org_id]'
);
DELETE FROM trade_marketplace_orders 
WHERE org_id = '[demo_org_id]';

-- Resetear estado del presupuesto demo a "Enviado"
UPDATE trade_quotes 
SET estado = 'Enviado' 
WHERE numero = 'DEMO-2026-001' AND org_id = '[demo_org_id]';
```

> **Importante:** Este script solo debe ejecutarse en cuentas de demo, nunca en datos de instaladores reales.
