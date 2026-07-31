# RC1-Beta — Plan de Commercial Readiness Bloque 2

**Versión:** 1.0  
**Fecha:** 2026-07-31  
**Prerrequisito:** RC1-Alpha completado ✔  
**Desbloquea:** PZ-001B (primer instalador externo real)  
**Referencia:** `docs/EXECUTION_BOARD.md` · `docs/RC1_CHECKLIST.md`

---

## 1. Objetivo

RC1-Beta tiene un objetivo único y concreto:

> **Que TrabFlow pueda ejecutar una demo de 15 minutos ante un distribuidor o instalador real, y que ese proveedor pueda ser incorporado al marketplace sin intervención técnica.**

RC1-Alpha resolvió los bloqueantes legales y de percepción (NIF, cookies, "beta"). RC1-Beta resuelve los bloqueantes **operativos y comerciales**: sin un guión de demo, sin datos coherentes, sin catálogo funcional y sin onboarding para el proveedor, no se puede ejecutar un piloto externo real.

---

## 2. Alcance

### Incluido en RC1-Beta

| Código | Ítem | Checklist ref |
|--------|------|---------------|
| B01 | Guión de demo estandarizado — 15 min instalador + 10 min proveedor | Bloque 7 |
| B02 | Datos de demo coherentes (cliente, presupuesto, pedido, proveedor) | Bloque 7, 9 |
| B03 | Catálogo demo funcional — ≥ 50 Productos Universales vinculados | Bloque 9 |
| B04 | Checklist de bienvenida en Dashboard del proveedor nuevo | Bloque 6 |
| B05 | Email de bienvenida HTML (instalador y proveedor) | Bloque 10 |
| B06 | FAQ pública — mínimo 15 preguntas frecuentes | Bloque 5 |
| B07 | Canal de soporte operativo (WhatsApp/email con SLA < 24h) | Bloque 5 |
| B08 | Argumento de ROI en la landing | Bloque 8 |
| B09 | Tabla de cookies específicas en la Política de Cookies | Bloque 1 |
| B10 | Política de privacidad: retención de datos + transferencias internacionales | Bloque 1 |

### No incluido en RC1-Beta (se aborda en Gamma/Delta)

- Tutorial in-app (tooltips, overlays guiados) → RC1-Gamma
- Vídeo de demo de 60-90 segundos → RC1-Gamma
- Error monitoring (Sentry) → RC1-Gamma
- Templates de email para estados de pedido → RC1-Gamma
- Términos específicos del Marketplace → RC1-Delta
- Contrato firmable de proveedor → RC1-Delta
- SEO y sitemap → RC1-Delta
- Recordatorios de trial → RC1-Delta

### Explícitamente fuera de alcance

- No se implementa código nuevo de producto.
- No se modifica la base de datos ni la arquitectura.
- No se empieza Sprint 2 Marketplace.
- No se abre ningún módulo de Fase 3 (catálogo libre).

---

## 3. Criterios de Aceptación

RC1-Beta se considera completada cuando **todos** los siguientes criterios son verdaderos:

**B01 — Guión de demo**
- Existe un documento escrito con el guión paso a paso de 15 min
- El guión ha sido ejecutado al menos una vez de principio a fin internamente
- El tiempo real medido es ≤ 15 min sin apuros

**B02 — Datos de demo coherentes**
- Existe un instalador demo con nombre real, empresa real, ciudad real
- Existe al menos un presupuesto demo completo (cliente, trabajo, materiales, precio total)
- Existe al menos un pedido demo completado de extremo a extremo (MKT-DEMO-001)
- Los datos son plausibles y no incluyen "Test", "Prueba", o valores como "123"

**B03 — Catálogo demo funcional**
- ≥ 50 Productos Universales cargados en producción
- Cubren al menos 2 oficios: fontanería + electricidad
- El Motor IA sugiere al menos un proveedor para un presupuesto de reforma de baño estándar
- Los productos tienen precio, unidad, y stock disponible = true

**B04 — Checklist de bienvenida (proveedor)**
- El Dashboard del proveedor muestra un checklist visible en el primer acceso
- El checklist incluye: completar perfil, cargar catálogo, gestionar primer pedido
- Desaparece o se colapsa una vez completados todos los pasos

**B05 — Email HTML de bienvenida**
- El email de bienvenida del instalador tiene logo, diseño visual, 3 pasos claros, enlace directo al primer presupuesto
- El email de bienvenida del proveedor tiene logo, enlace al portal, 3 pasos para empezar
- Ambos emails se han enviado y visualizado en Gmail, Outlook, y móvil

**B06 — FAQ pública**
- La FAQ es accesible desde la landing y desde el footer
- Contiene mínimo 15 preguntas reales organizadas por categoría
- Cubre: registro, precios, marketplace, portal proveedor, catálogo, pedidos, soporte

**B07 — Canal de soporte operativo**
- Existe al menos un canal activo (email o WhatsApp) que recibe mensajes
- El SLA está documentado (< 24h laborables)
- El canal está publicado en la FAQ y en el footer

**B08 — ROI en la landing**
- La landing muestra al menos un argumento cuantificado de ahorro/retorno
- El argumento usa datos reales o plausibles (horas ahorradas × precio/hora)
- No es un claim genérico ("ahorra tiempo") sino una cifra concreta

**B09 — Tabla de cookies**
- La Política de Cookies contiene una tabla con: nombre, proveedor, duración, finalidad
- Cubre al mínimo: cookies de sesión Supabase, cookies de analytics Vercel, localStorage trabflow_cookie_consent

**B10 — Política de privacidad ampliada**
- Incluye sección "Períodos de retención" con plazos por categoría de dato
- Incluye sección "Transferencias internacionales" con: Supabase (EU/US), Resend (US), Anthropic (US), OpenAI (US), Stripe (US/EU)
- Incluye procedimiento para ejercer derechos RGPD (acceso, rectificación, supresión)

---

## 4. Pilotos Previstos Tras RC1-Beta

### PZ-001B — Primer Instalador Externo Real

**Prerrequisito directo de RC1-Beta.**

| Ítem | Detalle |
|------|---------|
| Actor instalador | Empresa instaladora real de Cantabria (por identificar) |
| Actor proveedor | OBRAMAT Demo (cuenta controlada TrabFlow) |
| Alcance | 1 pedido real desde un presupuesto real del instalador |
| Preparación | RC1-Beta completado · Sesión onboarding 10-15 min · Canal soporte activo |
| Criterio de éxito | El instalador completa el flujo sin asistencia técnica tras la demo |
| Restricciones | Mono-proveedor · No push notifications (protocolo manual) |

### PZ-001C — Primer Proveedor Externo Real

**Requiere PZ-001B completado.**

| Ítem | Detalle |
|------|---------|
| Actor proveedor | Distribuidor real (mayorista fontanería o electricidad) |
| Actor instalador | TrabFlow interno o instalador de PZ-001B |
| Alcance | Onboarding del proveedor + carga de su catálogo + ciclo completo de pedido |
| Preparación | RC1-Beta completado · 30 min onboarding · 30-50 productos del proveedor cargados |
| Criterio de éxito | El proveedor gestiona un pedido completo sin asistencia técnica |

---

## 5. Indicadores de Éxito (KPIs de RC1-Beta)

| Indicador | Objetivo | Cómo medir |
|-----------|----------|------------|
| Duración de la demo | ≤ 15 min | Cronómetro en ejecución de prueba |
| Productos Universales cargados | ≥ 50 | Consulta en Admin Panel |
| Gremios cubiertos en catálogo | ≥ 2 (fontanería + electricidad) | Revisión manual |
| Preguntas en FAQ | ≥ 15 | Conteo del documento |
| Email de bienvenida enviado y visualizado | ✅ | Prueba en Gmail + Outlook + móvil |
| Checklist proveedor funcional | ✅ | Test con cuenta nueva de proveedor |
| ROI cuantificado en landing | ✅ | Revisión visual de la landing |
| Tabla de cookies en Política | ✅ | Revisión de LegalViews.tsx |
| Retención + transferencias en Privacidad | ✅ | Revisión de LegalViews.tsx |
| Motor IA sugiere proveedor para reforma baño | ✅ | Prueba con presupuesto demo estándar |

---

## 6. Cronograma Estimado

RC1-Beta no tiene una fecha límite fija, pero la secuencia lógica de ejecución, estimando esfuerzo por ítem, es:

| Semana | Tareas | Esfuerzo estimado |
|--------|--------|-------------------|
| Semana 1 | B09, B10 (legal: tabla cookies + privacidad ampliada) | Bajo — redacción pura |
| Semana 1 | B03 (catálogo demo: cargar ≥ 50 productos) | Medio — carga de datos |
| Semana 1 | B02 (datos de demo coherentes: cliente, presupuesto, pedido) | Bajo — configuración |
| Semana 2 | B04 (checklist bienvenida proveedor) | Medio — componente React |
| Semana 2 | B01 (guión de demo escrito + ensayo) | Bajo — documento |
| Semana 2 | B06 (FAQ pública) | Bajo — contenido |
| Semana 3 | B05 (email HTML bienvenida instalador + proveedor) | Medio — template HTML en Edge Function |
| Semana 3 | B07 (canal de soporte operativo) | Bajo — configuración |
| Semana 3 | B08 (ROI en landing) | Bajo — texto + UI |

**Duración total estimada:** 2-3 semanas a ritmo normal.

---

## 7. Responsables

| Área | Responsable | Notas |
|------|-------------|-------|
| Redacción legal (B09, B10) | Fernando | Puede apoyarse en el asistente para redactar el texto |
| Carga de catálogo (B03) | Fernando + Dev | Fernando identifica los productos; Dev los carga si se usa la API |
| Datos de demo (B02) | Fernando | Decide el nombre, empresa, ciudad, y tipo de trabajo del instalador demo |
| Guión de demo (B01) | Fernando | Ejecuta el ensayo; Dev ajusta si hay fricción técnica |
| Componente React (B04) | Dev | Checklist de bienvenida en PortalDashboard |
| Template email HTML (B05) | Dev | Actualizar Edge Function trade-onboarding o equivalente |
| FAQ (B06) | Fernando | Contenido; Dev integra en la landing/footer |
| Canal de soporte (B07) | Fernando | Configurar WhatsApp Business o alias de email |
| ROI en landing (B08) | Fernando + Dev | Fernando aporta la cifra; Dev implementa el bloque en la landing |

---

## 8. Riesgos Específicos de RC1-Beta

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Cargar ≥ 50 productos manualmente es lento | Alta | Medio | Usar la Supplier API v1 (MVP-7) para importar CSV en lote |
| El guión de demo necesita varios ensayos para ajustarse | Media | Bajo | Reservar tiempo para 2-3 ensayos antes de la primera demo real |
| El email HTML no se visualiza bien en Outlook | Media | Medio | Usar tablas HTML, no flex/grid; probar en Litmus o Email on Acid |
| La FAQ no cubre las preguntas reales que hace el instalador | Media | Medio | Basar la FAQ en las preguntas de PZ-001A y en las preguntas de las reuniones con OBRAMAT/SALTOKI |
| El checklist de bienvenida del proveedor requiere estado en BD | Media | Bajo | Usar localStorage o una columna booleana simple en trade_marketplace_actors |

---

## 9. Dependencias Externas

| Dependencia | Qué necesita | Quién gestiona |
|-------------|-------------|----------------|
| Contacto para PZ-001B | Identificar empresa instaladora de Cantabria dispuesta a probar | Fernando |
| Contacto para PZ-001C | Identificar distribuidor (OBRAMAT, SALTOKI, mayorista local) dispuesto a probar | Fernando |
| NIF real de la sociedad | Inscripción en Registro Mercantil — reemplaza B11792515 provisional | Fernando (gestión legal) |
| Emails @trabflow.com operativos | Para canal de soporte (B07) y emails transaccionales (B05) | Fernando (configuración DNS) |

---

## 10. Checklist Final de RC1-Beta

Antes de declarar RC1-Beta completada y activar PZ-001B, verificar:

```
☐ B01 — Guión de demo escrito y ensayado (≤ 15 min medido)
☐ B02 — Datos de demo coherentes en producción (cliente, presupuesto, pedido)
☐ B03 — ≥ 50 Productos Universales cargados (≥ 2 gremios)
☐ B04 — Checklist de bienvenida visible en Dashboard del proveedor nuevo
☐ B05 — Email bienvenida instalador: visualizado en Gmail + Outlook + móvil
☐ B05 — Email bienvenida proveedor: visualizado en Gmail + Outlook + móvil
☐ B06 — FAQ pública accesible desde landing y footer (≥ 15 preguntas)
☐ B07 — Canal de soporte activo y probado (respuesta en < 24h laborables)
☐ B08 — Argumento de ROI cuantificado visible en la landing
☐ B09 — Tabla de cookies específicas en Política de Cookies
☐ B10 — Retención de datos y transferencias internacionales en Privacidad
☐ Motor IA: sugiere OBRAMAT Demo para un presupuesto estándar de reforma de baño
☐ Guión de demo ejecutado sin errores técnicos en producción
☐ Canal de soporte (B07): primera respuesta a mensaje de prueba en < 2h
☐ EXECUTION_BOARD.md actualizado con RC1-Beta como completada
☐ RC1_CHECKLIST.md: ítems B01-B10 marcados como ☑
```

---

## Relación con el Checklist RC-1

Los ítems de RC1-Beta cubren parcialmente los siguientes bloques del `RC1_CHECKLIST.md`:

| Bloque checklist | Ítems cubiertos en RC1-Beta | Ítems diferidos a Gamma/Delta |
|---|---|---|
| Bloque 1 — Legal | B09 (tabla cookies), B10 (privacidad) | Nombre representante, contrato marketplace |
| Bloque 5 — Soporte | B06 (FAQ), B07 (canal soporte) | Chatbot soporte, tickets |
| Bloque 6 — Onboarding | B04 (checklist proveedor), B05 (emails bienvenida) | Tutorial in-app, emails día 3/30 |
| Bloque 7 — Demo | B01 (guión), B02 (datos) | Cuentas demo separadas, dossier PDF |
| Bloque 8 — Contenido | B08 (ROI landing) | Vídeo 60s, testimonio real |
| Bloque 9 — Catálogo | B03 (≥ 50 productos) | Stock simulado, precios realistas |

---

*Documento creado 2026-07-31 — Complementa EXECUTION_BOARD.md v2.0*
*Próxima actualización: al cerrar RC1-Beta o al activar PZ-001B*
