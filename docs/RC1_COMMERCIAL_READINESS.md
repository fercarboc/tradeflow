# RC-1 — Commercial Readiness Audit

**Versión:** 1.0  
**Fecha:** 2026-07-28  
**Ejecutado por:** Auditoría completa de código, UX, documentación y estrategia  
**Base:** PZ-001A completado · Motor IA v59 · Marketplace Phase 2  
**Objetivo:** Identificar qué separa al producto actual de ser presentable a OBRAMAT, SALTOKI, SONEPAR, APIEM, fondos de inversión e instaladores reales.

> **⚠️ SNAPSHOT HISTÓRICO — Estado del audit a 2026-07-28**  
> Este documento refleja el estado del producto en la fecha de la auditoría.  
> Los siguientes ítems han sido resueltos desde entonces: **RC1-C01** (NIF), **RC1-C02** (domicilio), **RC1-C03** (cookies), **RC1-C04-A** (analytics), **RC1-C04-B** (narrativa beta).  
> Para el estado actualizado de cada ítem, consultar [RC1_CHECKLIST.md](RC1_CHECKLIST.md) y [EXECUTION_BOARD.md](EXECUTION_BOARD.md).

---

## 1. Estado General del Producto

TrabFlow es un producto real con funcionalidad real. El motor IA está validado (98.2% OK rate, 400 casos benchmark). El Marketplace completo ha superado un piloto operativo interno (PZ-001A) con 2 ciclos de extremo a extremo sin errores bloqueantes pendientes. El ERP tiene módulos completos: presupuestos, facturas, clientes, contratos, mantenimientos, equipo, partes de trabajo, planificación.

Sin embargo, hay una brecha visible entre lo que funciona técnicamente y lo que comunica solidez profesional a alguien que entra en la plataforma por primera vez — ya sea un instalador autónomo, un responsable de compras de un distribuidor, o un inversor.

**Veredicto de estado:** Producto funcional en zona de transición entre MVP avanzado y producto comercial. El sistema es sólido. La envoltura no siempre lo parece.

---

## 2. Qué Está Listo

### Funcionalidad Core — Preparada
- **Motor IA voz-a-presupuesto** — v59 en producción, 98.2% OK rate, benchmark de 400 casos validado. Este es el diferenciador principal y está maduro.
- **Módulo ERP completo** — presupuestos, facturas, clientes, contratos de mantenimiento, partes de trabajo con firma digital, planificación, equipo, subcontratas. Todo en producción.
- **Marketplace Phase 2 completo** — checkout 2 pasos, seguimiento realtime, portal proveedor con centro de acción, gestión de pedidos (confirmar/preparar/enviar), historial, catálogo.
- **Multi-tenant y roles** — owner, técnico, admin, supplier. Gestión de equipo, invitaciones, permisos granulares.
- **Auth completo** — login, registro, magic link, reset password, confirmación de cuenta, workspace selector para múltiples membresías.
- **Stripe billing** — tres planes (Profesional 49€, Empresa 89€, Empresa+ 179€), checkout, portal de cliente, webhooks, trial de 3 meses.
- **PWA + push notifications** — service worker, manifest, notificaciones web push (infraestructura en producción).
- **Páginas legales** — Aviso Legal, Privacidad, Cookies, Términos, Beta, Disclaimer IA (páginas existen — contenido es delgado).
- **Landing page** — Hero, Funciones, Partners, Demo strip, Planificación, Pricing, Contacto, Footer.
- **Demo interactiva** — `/demo` y `/demo-socios` funcionan sin login.
- **Error boundary global** — captura errores, registra en Supabase, muestra pantalla de recuperación.
- **Edge Functions** — 25 funciones desplegadas (email, push, AI, Stripe, geocoding, OCR, mantenimiento).
- **Tests** — Vitest (unit + integration) y Playwright (E2E) presentes. Suite básica pero existente.
- **Design System v1** — paleta definida, tokens de código, componentes compartidos documentados.

### Infraestructura — Preparada
- Vercel + Supabase — SPA deploy + BD + auth + storage + Edge Functions.
- RLS en todas las tablas sensibles.
- Outbox pattern para eventos de marketplace.
- Error logging centralizado.
- Envío de email vía Resend.
- Código TypeScript + React 19.

---

## 3. Qué No Está Listo

### Legal y Cumplimiento — CRÍTICO
- **NIF de la empresa está como `[PENDIENTE]`** en el Aviso Legal. Esto es un incumplimiento legal en España (LSSI). No se puede operar comercialmente sin publicar el NIF.
- **Sin banner de cookies** — la plataforma usa cookies y no tiene mecanismo de consentimiento visible. Incumple RGPD/LSSI. Bloqueante para cualquier piloto con empresa.
- **Política de privacidad incompleta** — no menciona: períodos de retención de datos, transferencias internacionales (Supabase en USA, Resend en USA, Anthropic en USA), DPO o delegado de protección, base legal por cada finalidad, datos de menores.
- **Política de cookies insuficiente** — sin tabla de cookies específicas, sin categorización técnica/analítica/marketing, sin herramienta de gestión (ni siquiera un simple opt-in/opt-out en localStorage).
- **Sin Términos específicos del Marketplace** — los Términos genéricos no cubren: comisiones, responsabilidad de pedidos, plazos de entrega, disputas entre instalador y proveedor.
- **Sin contrato de proveedor / SLA del Marketplace** — el proveedor que se incorpora al marketplace no firma nada. Esto es un problema legal y de confianza.
- **Aviso Beta visible** — hay una página `/beta` con lenguaje de "beta privada" accesible públicamente. Destruye la percepción de producto terminado.
- **"Mayo de 2026"** como fecha de actualización en todas las páginas legales. Ya desfasada en julio 2026.

### Analytics y Visibilidad — CRÍTICO
- **Analytics = cero.** No hay Posthog, Mixpanel, Vercel Analytics, Plausible, ni Google Analytics. TrabFlow no sabe quién entra, qué hace, dónde abandona, ni cuánto tiempo pasa en cada pantalla. Imposible tomar decisiones de producto o de negocio basadas en datos. Un inversor o distribuidor preguntará "¿cuántos usuarios activos tenéis? ¿cuántos presupuestos al día?" y no habrá datos reales para responder.
- Sin funnel de conversión (registro → primer presupuesto → conversión a pago).
- Sin métricas de retención.
- Sin alertas de errores en producción (Sentry o similar).
- Sin dashboard de monitorización del sistema.

### Onboarding — ALTO
- **Sin onboarding para proveedor.** Un proveedor real que accede al Portal por primera vez se encuentra sin guía. No hay tutorial, no hay checklist de configuración, no hay primer flujo guiado. El piloto PZ-001A confirmó esto como riesgo.
- El onboarding de instalador existe (wizard de 7 pasos) pero no ha sido probado con un usuario real externo. Puede tener fricciones no detectadas.
- Sin email de bienvenida rico para el proveedor con pasos claros.
- Sin tutorial de primer presupuesto in-app.

### Contenido y Soporte — ALTO
- **Sin FAQ** — ni una página de preguntas frecuentes.
- **Sin centro de ayuda** — sin documentación de usuario, sin artículos de soporte.
- **Sin vídeos** — ni uno. El GTM dice que el vídeo de 30-60 segundos es el canal que convierte para instaladores.
- **Sin manual de usuario** — ni para instalador ni para proveedor.
- **Sin tutorial in-app** — primera experiencia sin guía de descubrimiento.

### Comunicación — MEDIO
- Templates de email embebidos como strings en Edge Functions. Sin HTML enriquecido, sin logo, sin diseño. Los emails transaccionales (bienvenida, confirmación) probablemente tienen aspecto básico.
- Sin email de seguimiento post-onboarding (día 3, día 7).
- Sin email de recordatorio para trial que expira.
- Sin email de activación de marketplace para proveedor nuevo.

### Monitorización y Operaciones — MEDIO
- Sin Sentry o equivalente para errores de frontend.
- Sin uptime monitoring (Better Uptime, Checkly o similar).
- Sin dashboard de métricas de negocio para el equipo (solo el Admin panel, que es interno).
- Sin proceso documentado de backups y recovery.
- Sin SLA definido.
- Sin página de estado (status page).

---

## 4. Qué Sobra

- **Página `/beta`** — existe como acuerdo de beta privada. Con RC-1, la narrativa de "beta" debe desaparecer de cara al exterior. La página puede mantenerse como `/condiciones-piloto` o eliminarse.
- **`/ia-disclaimer`** — el disclaimer de IA es importante pero podría integrarse en los Términos en lugar de ser una página separada, que genera confusión.
- **`/demo-socios`** (PartnerDemoView) y `/demo` (DemoView) — dos demos. Hay que decidir cuál es la demo comercial oficial y redirigir o consolidar. Dos demos en producción sin criterio claro generan inconsistencia.
- **`/herramientas`** (calculadoras gratuitas) — no está mal, pero si nadie la encuentra (sin analytics) es invisible. O se promociona activamente o no está justificado el mantenimiento.
- **Imágenes `ChatGPT Image *.png`** en `/public` — assets con nombre sin sentido que pueden filtrarse en referencias de código. Renombrar con nombres descriptivos.
- **`/asistente-tecnico`** (AsistenteTecnicoPublicView) — vista pública del asistente técnico sin autenticación. Revisar si debe seguir siendo público o si es solo para usuarios registrados.

---

## 5. Qué Falta

### Urgente (bloquea demos comerciales)
1. **NIF real** en el Aviso Legal.
2. **Banner de cookies** con consentimiento real.
3. **Analytics básicos** (Vercel Analytics o Posthog son gratuitos).
4. **Textos legales completos** (privacidad ampliada, cookies real).
5. **Narrativa sin "beta"** — eliminar referencias a "beta privada" de cara exterior.
6. **Términos del Marketplace** — sección específica o documento separado.

### Importante (bloquea pilotos externos reales)
7. **Onboarding de proveedor guiado** — checklist de primer acceso o wizard ligero.
8. **Email de bienvenida rico** para proveedor (con logo, pasos claros, enlace al portal).
9. **Guía de primer presupuesto** en la app (instalador nuevo sin contexto).
10. **FAQ básica** — 10-15 preguntas de los temas que más preguntan los usuarios en demo.
11. **Demo comercial ejecutable** — un guión ejecutable en 15 minutos con datos consistentes.
12. **Datos de demo consistentes** — presupuesto real, facturas reales, pedido real, todo con datos que tengan sentido narrativo.

### Necesario (bloquea conversión a pago y retención)
13. **Monitoring de errores** (Sentry o BetterStack).
14. **Uptime monitoring** (mejor si tiene status page).
15. **Email de recordatorio trial expira** — 7 días y 1 día antes.
16. **Canal de soporte** documentado y operativo.
17. **Vídeo demo de 60 segundos** — el canal de conversión más eficaz según el GTM.

---

## 6. Qué Eliminarías

1. **Página `/beta`** — o se renom bra con mensaje de "piloto controlado" o se elimina. El término "beta privada" no tiene lugar en un producto que se muestra a inversores.
2. **Término "TrabFlow AI"** como nombre primario — aparece mezclado con "TrabFlow" en distintos lugares. Elegir uno y ser consistente. "TrabFlow" es más limpio para B2B.
3. **Imágenes sin nombre** en public/ — renombrar `ChatGPT Image *.png` y similares.
4. **`/ia-disclaimer`** como página separada — integrar en los Términos. Nadie navega a `/ia-disclaimer` directamente. Como sección de los Términos, tiene más fuerza legal y menos fricción.
5. **Domicilio "Paseo de la Castellana 124, Madrid"** en el Aviso Legal — si este no es el domicilio social real, debe actualizarse antes de cualquier reunión con empresa que lo verifique.

---

## 7. Qué Simplificarías

1. **Dos demos (DemoView + PartnerDemoView)** → una sola demo, clara, con dos modos: "instalador" y "distribuidor". Actualmente hay confusión sobre cuál usar en cada contexto.
2. **Tres planes de precios** (Profesional, Empresa, Empresa+) → considerar si hay suficiente diferenciación perceptual o si dos planes son suficientes en esta etapa. Tres planes requieren más comunicación para que el usuario no se pierda.
3. **Tab "Beta" en sidebar/menú** — si existe alguna referencia interna a "beta", eliminarla.
4. **Páginas legales individuales** → consolidar en una página `/legal` con secciones navegables en lugar de 6 URLs distintas. Más fácil de mantener y de enlazar en footer.
5. **Onboarding wizard de 7 pasos** — revisar si todos son necesarios en el primer acceso o si pueden diferirse.
6. **Chatbot de ayuda** — actualmente separado del contexto del usuario. Explorar integrarlo como asistente contextual (sabe en qué pantalla está el usuario).

---

## 8. Qué Cambiarías Visualmente

### Textos que comunican MVP
- **"Beta privada"** en página `/beta` — cambiar a lenguaje de piloto o eliminar.
- **"[PENDIENTE]"** visible en Aviso Legal — corregir inmediatamente.
- **"Mayo de 2026"** en textos legales — actualizar.
- **`soporte@trabflow.com`** como único contacto legal — verificar que funciona y hay respuesta humana real.

### Percepción visual
- Las páginas legales tienen fondo `#020B16` (oscuro absoluto) con texto `white/55` — muy difícil de leer. Una mejora al 75-80% de opacidad y tipografía más legible mejoraría la percepción de seriedad.
- El diseño de los emails transaccionales (bienvenida, confirmación de cuenta) probablemente es texto plano. Implementar un template HTML básico con logo, colores de marca, y jerarquía clara elevaría enormemente la percepción de profesionalidad.
- Los iconos de trading en la landing (si los hay) o referencias a `ChatGPT Image` en nombres de archivo deben desaparecer.
- Favicon: `tradeflow.png` existe. Verificar que sea nítido en múltiples tamaños y contextos (tab oscuro, iOS).
- **Sin página de estado (status page)** — un simple `status.trabflow.com` o integración con BetterStack comunica madurez operativa.

### En la app
- Algunos estados de carga pueden ser inconsistentes (skeleton vs spinner vs texto "Cargando..."). Estandarizar.
- Los mensajes de error genéricos ("Error al cargar datos") deben incluir contexto y acción sugerida.
- Los modales de confirmación deben tener texto de acción claro, nunca "Aceptar" genérico.
- Los badges de estado de pedido deben ser consistentes en todos los módulos donde aparecen (ERP + Marketplace + Portal).

---

## 9. Qué Cambiarías Funcionalmente

1. **Registro → primer presupuesto:** medir y optimizar este tiempo. El GTM dice que si no lo consiguen en 3 minutos, no vuelven. No hay datos actuales de cuánto tarda realmente.
2. **Trial de 3 meses:** es generoso pero sin analytics no sabemos si convierte. Añadir email de recordatorio a los 45 días ("¿Cómo va la experiencia?") y a los 75 días ("Tu trial termina en 15 días").
3. **Sin referral/invitación de usuario a usuario:** el GTM menciona código de referido pero no está implementado. Es el canal orgánico más eficaz para instaladores.
4. **Sin "Compartir presupuesto" con analytics:** cuando el instalador envía el presupuesto al cliente, no hay tracking de si fue abierto. Un simple pixel de seguimiento o evento de apertura generaría datos valiosos.
5. **Búsqueda en ERP:** si hay muchos clientes y presupuestos, la búsqueda rápida en el panel principal puede ser un cuello de botella. Revisar.
6. **Panel de control del proveedor (Centro de Acción):** actualmente reactivo. Añadir métricas proactivas: pedidos esta semana vs. semana anterior, tiempo medio de respuesta, score de servicio visible al propio proveedor.

---

## 10. Qué Mejoraría la Percepción de Calidad

En orden de impacto:

1. **Emails HTML con diseño** — el primer email que recibe un usuario nuevo define su percepción del producto. Un email de bienvenida con logo, tipografía de marca, y 3 pasos claros vale más que 10 features.
2. **Banner de cookies funcionando** — comunica que la empresa cumple la ley. Cualquier empresa media o grande lo verificará antes de firmar.
3. **NIF visible y correcto** — igual que lo anterior.
4. **Status page o uptime badge** — "99.9% uptime" en la landing es vacío. Un widget de BetterStack con el uptime real de los últimos 90 días es concreto y verificable.
5. **Datos de demo coherentes y narrativos** — la demo debe contar una historia: "María García, instaladora de Barcelona, tiene 3 trabajos esta semana..." Los datos de demo deben ser consistentes, no placeholders ni datos de prueba visibles.
6. **Vídeo corto de 60 segundos** — un screencast profesional (o incluso grabado con Loom bien editado) del flujo de presupuesto por voz genera confianza instantánea.
7. **Testimonios reales** — aunque sean del piloto PZ-001A. "Un instalador de Cantabria completó 2 pedidos de material en menos de 3 minutos" es un testimonio real que puede aparecer en la landing.
8. **Referencia a resultados del Motor IA** — "98.2% de presupuestos generados correctamente. Validado sobre 400 casos" debe aparecer en la landing, en la demo, y en el dossier comercial.
9. **Separación visual "piloto" vs "producto"** — el portal del proveedor debe decir "TrabFlow Connect" o el nombre oficial del marketplace, no referencias internas de desarrollo.
10. **Páginas legales más completas** — no por obligación legal solo, sino porque un comprador de empresa (OBRAMAT, SALTOKI) o un inversor las leerá antes de firmar nada.

---

## 11. Qué Impediría Enseñar el Producto a un Mayorista

1. **NIF [PENDIENTE]** en el Aviso Legal — cualquier departamento legal de OBRAMAT, SALTOKI o SONEPAR que revise la web lo identificará en 10 segundos. Bloqueante absoluto.
2. **Sin Términos del Marketplace** — el mayorista necesita saber qué pasa si hay un pedido incorrecto, quién asume la responsabilidad, y cuáles son los plazos. Sin documento, no hay conversación.
3. **Sin contrato de proveedor** — el mayorista necesita un documento que firmar. No una demo.
4. **Sin analytics** — "¿cuántos instaladores tiene TrabFlow en nuestra zona?" requiere datos. Sin analytics, la respuesta honesta es "no lo sabemos".
5. **Sin catálogo demo completo** — OBRAMAT tiene 40.000+ referencias. Si la demo muestra 6 productos universales, la percepción de escala es incorrecta.
6. **Sin onboarding documentado para proveedor** — el mayorista necesita saber cuánto tiempo le llevará integrarse. Sin guía, la respuesta es "no lo sabemos, probamos".
7. **Sin SLA ni condiciones de servicio** — qué pasa si la plataforma cae durante una semana. Un mayorista no puede asumir eso sin garantías.
8. **Domicilio social posiblemente incorrecto** — "Paseo de la Castellana 124, Madrid" — verificar.
9. **Sin datos de facturación propia de la empresa** — las reuniones con empresas medianas/grandes requieren que TrabFlow Technologies S.L. esté constituida con CIF real, domicilio real, y representante legal identificado.

---

## 12. Qué Impediría Enseñar el Producto a un Instalador

1. **Sin tutorial de primer uso** — el instalador llega, se registra, y está solo. Si no crea su primer presupuesto en 5 minutos, se va.
2. **Sin FAQ** — las dudas que tendrá (¿puedo probar gratis? ¿cuánto cuesta? ¿cómo migro mis datos?) no tienen respuesta visible en el producto.
3. **Sin vídeo de demo** — el instalador quiere ver el producto en 60 segundos antes de registrarse. Sin vídeo, el texto de la landing no convierte.
4. **Precio sin contexto de ROI** — "49€/mes" no convierte. "Si ahorras 2 horas por semana a 35€/hora, TrabFlow se paga en 1 día al mes" convierte. Falta el argumento de ROI en la landing y en el onboarding.
5. **Sin referral** — el instalador que convence a otro instalador es el canal más efectivo. No existe.
6. **Sin confirmación de presupuesto por WhatsApp** — muchos instaladores trabajan por WhatsApp. La integración de envío de presupuesto por WhatsApp (o el enlace de confirmación) debe ser visible y fácil.
7. **Sin testimonio real** — "Créeme que ahorra tiempo" no convierte. "Pedro, fontanero en Valencia, ahora hace presupuestos en 2 minutos" con foto y nombre real sí convierte.

---

## 13. Qué Necesita un Inversor para Confiar

1. **Métricas reales** — MAU, DAU, presupuestos/día, conversión trial→pago, churn mensual, ARR. Sin estas métricas, cualquier conversación con un inversor termina en "volved cuando tengáis datos".
2. **Evidencia del motor IA** — "98.2% OK rate en 400 casos" es bueno. Necesita estar documentado formalmente, con metodología, y ser citado en el pitch.
3. **Primer cliente de pago** — el primer pago real de un cliente externo es el hito de validación de mercado. Hasta entonces, es un proyecto con potencial.
4. **Piloto con distribuidor real** — PZ-001A fue interno. El primer piloto con OBRAMAT o SALTOKI y datos reales cambia completamente la conversación.
5. **Equipo** — un inversor invertirá en el equipo tanto como en el producto. ¿Hay más personas aparte del fundador? ¿Cuál es el plan de equipo?
6. **Modelo de negocio claro** — los tres planes (49/89/179€) están definidos. Pero la comisión del marketplace (cuando llegue) necesita estar modelada y documentada.
7. **Competencia** — ¿quién más está haciendo esto? ¿Por qué TrabFlow gana? El documento `09_COMPETITIVE_MOAT.md` existe — debe convertirse en el slide 5 del pitch.
8. **Roadmap creíble** — no 200 features. Un roadmap de 12 meses con 3-4 hitos claros basados en feedback real de usuarios.
9. **Cap table y estructura legal** — TrabFlow Technologies S.L. constituida, NIF real, capital social, socio(s).
10. **Proyección financiera** — aunque sea ilustrativa, un modelo de "si conseguimos X instaladores en 12 meses a Y€/mes, con Z% de comisión del marketplace, llegamos a W€ ARR" comunica que entiendes tu negocio.

---

## 14. Qué Necesita un Distribuidor para Confiar

1. **Demostración del ciclo completo en vivo** — no slides, no vídeo. El distribuidor necesita ver: instalador crea presupuesto → añade material → llega pedido al portal del proveedor → proveedor lo gestiona. En 15 minutos. Con datos reales.
2. **Número de instaladores en su zona** — si el distribuidor es de Cataluña, necesita saber cuántos instaladores de Cataluña usan TrabFlow. Sin analytics, no hay respuesta.
3. **Proceso de integración de catálogo** — ¿cuánto tiempo lleva? ¿necesita IT? ¿qué formato? El GTM dice: CSV, 1-2 horas de trabajo del distribuidor. Esto debe ser un proceso documentado y ejecutado en < 1 semana.
4. **Qué control tiene sobre sus precios** — ¿puede actualizar precios sin pedir a TrabFlow? ¿Hay un panel de autogestión? Actualmente, hay un PortalCatalogo pero ¿el proveedor puede editar precios directamente?
5. **SLA y disponibilidad** — si la plataforma cae, ¿cuánto tarda en recuperarse? Sin uptime monitoring público, la respuesta es "confiamos en Vercel", que no convence a un distribuidor grande.
6. **Seguridad de datos** — ¿dónde se almacenan los datos? ¿Quién puede acceder a los pedidos del distribuidor? La arquitectura RLS de Supabase es correcta pero hay que poder explicarla.
7. **Condiciones económicas claras** — ¿qué paga el distribuidor? ¿hay comisión? ¿hay fee mensual? Actualmente, el modelo del distribuidor no está documentado como documento firmable.
8. **Casos de uso similares** — ¿hay otro distribuidor que ya use el sistema? PZ-001A fue con OBRAMAT Demo (interno). El primer distribuidor real necesita referencias o la garantía de que es el primero y eso se trata como privilegio, no como riesgo.

---

## 15. Qué Necesita un Instalador para Pagar

1. **Experiencia de primer uso impecable** — registro → primer presupuesto en < 5 minutos. Si no lo consigue, no paga.
2. **Argumento de ROI visible** — en la landing, en el onboarding, en los emails. No el precio: el retorno. "Ahorra 3 horas/semana. Cobra 35€/hora. TrabFlow se paga en 1 día al mes."
3. **Sin fricciones en el trial** — 3 meses gratis es generoso. Pero si en el mes 1 no ha creado 5+ presupuestos, no convertirá. El sistema necesita medir esto y actuar.
4. **Confianza básica** — NIF visible, política de privacidad legible, email de empresa real. Un autónomo no paga a una empresa que no puede verificar.
5. **Ver que otros instaladores lo usan** — testimonios reales, reseñas, o simplemente el número de presupuestos generados total ("Más de 10.000 presupuestos generados con TrabFlow IA"). Sin este indicador social, la fricción de pago sube.
6. **Soporte accesible** — un WhatsApp de soporte, un email que responde en < 24h, o un chatbot que resuelve dudas reales. El instalador no leerá documentación — preguntará.
7. **El Marketplace como argumento adicional** — "además de los presupuestos, puedes pedir material directamente desde TrabFlow a tu distribuidor habitual" es un argumento que añade valor percibido y justifica el precio mensual.

---

## Resumen Ejecutivo

| Categoría | Estado | Prioridad |
|-----------|--------|-----------|
| Funcionalidad ERP | ✅ Listo | — |
| Motor IA | ✅ Listo | — |
| Marketplace Phase 2 | ✅ Listo | — |
| Auth + Billing | ✅ Listo | — |
| NIF en Aviso Legal | ❌ PENDIENTE | CRÍTICO |
| Banner de cookies | ❌ No existe | CRÍTICO |
| Analytics | ❌ No existe | CRÍTICO |
| Narrativa sin "beta" | ❌ No resuelta | CRÍTICO |
| Políticas legales completas | ⚠️ Incompleto | ALTO |
| Términos del Marketplace | ❌ No existe | ALTO |
| Onboarding proveedor | ❌ No existe | ALTO |
| Emails con diseño | ⚠️ Básico | ALTO |
| FAQ y soporte | ❌ No existe | ALTO |
| Demo comercial ejecutable | ⚠️ Parcial | ALTO |
| Datos de demo consistentes | ⚠️ Parcial | ALTO |
| Monitoring y alertas | ❌ No existe | MEDIO |
| Vídeo demo | ❌ No existe | MEDIO |
| Canal de referido | ❌ No existe | MEDIO |
| Status page | ❌ No existe | MEDIO |

*RC-1 estará completo cuando todos los ítems CRÍTICOS y ALTOS estén resueltos.*
