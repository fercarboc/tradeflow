# RC-1 — Elementos con Aspecto MVP y Plan Priorizado

**Versión:** 1.0  
**Fecha:** 2026-07-28  
**Propósito:** Identificar qué hace que el producto "todavía parezca una beta" y priorizarlo por impacto comercial.

> **⚠️ SNAPSHOT HISTÓRICO — Estado del audit a 2026-07-28**  
> Este documento refleja los problemas identificados en la auditoría inicial.  
> Los ítems marcados con ✅ RESUELTO han sido corregidos en las tareas RC1-C01 a RC1-C04-B.  
> Para el estado actualizado, consultar [RC1_CHECKLIST.md](RC1_CHECKLIST.md) y [EXECUTION_BOARD.md](EXECUTION_BOARD.md).

---

## FASE 4 — Elementos con Aspecto de MVP

Todo aquello que, al verlo, un observador externo piensa: *"Esto todavía no está terminado."*

---

### TEXTOS

| Elemento | Dónde | Problema |
|----------|-------|---------|
| `NIF: [PENDIENTE]` | Aviso Legal | Texto de placeholder visible al público. Absolutamente crítico. **✅ RESUELTO RC1-C01** |
| `"Última actualización: Mayo de 2026"` | Todas las páginas legales | Desactualizado en julio 2026. *(RC1-C05 programado)* |
| `"TrabFlow AI se encuentra actualmente en fase beta privada"` | Página `/beta` | Contradice ser un producto comercial. **✅ RESUELTO RC1-C04-B** |
| `"El servicio se proporciona AS IS"` | Términos | Lenguaje demasiado técnico/descuidado para un SaaS comercial español. |
| `soporte@trabflow.com como único contacto legal` | Aviso Legal | Un email de soporte no es un contacto legal. Necesita `legal@trabflow.com`. |
| Domicilio "Paseo de la Castellana 124, Madrid" | Aviso Legal | Si no es el domicilio real, es un dato incorrecto en un documento legal. **✅ RESUELTO RC1-C02** |
| "Presupuesto pruebas.pdf" | public/ | Asset de prueba visible en producción. |
| "ChatGPT Image *.png" | public/ | Nombres de archivo revelan proceso de desarrollo. |
| Precios sin contexto de ROI | PreciosView | "49€/mes" sin argumento de retorno es demasiado abstracto. |

---

### BOTONES Y ACCIONES

| Elemento | Dónde | Problema |
|----------|-------|---------|
| CTAs de plan sin urgencia ni prueba social | PreciosView | "Activar Profesional" sin "Prueba 3 meses gratis" visible. El CTA no refleja el beneficio del trial. |
| Botones de confirmación con texto genérico "Aceptar" | Modales varios | No describe qué pasa al confirmar. |
| Sin botón de "Contactar por WhatsApp" | Landing, Contacto | Los instaladores usan WhatsApp. Un link wa.me/ convierte más que un formulario. |
| "Cargando..." como estado de carga en algunos módulos | Varios | Inconstante: algunos tienen skeleton loaders, otros texto plano. |

---

### COLORES E ICONOS

| Elemento | Dónde | Problema |
|----------|-------|---------|
| Mezcla de paleta entre módulos | ERP vs Portal vs Landing | Landing usa `#00CFE8` (cyan), app usa `teal-600`. El teal del Design System no es exactamente el mismo cyan de la landing. Pequeña inconsistencia visible. |
| Iconos de alerta genéricos (AlertTriangle) | Mensajes de error | Mismo icono para todos los errores, independientemente de la naturaleza. |
| Sin favicon adaptado a dark mode | Browser tab | El favicon estándar puede no ser legible en tabs oscuras. |

---

### TABLAS Y LISTAS

| Elemento | Dónde | Problema |
|----------|-------|---------|
| Sin estado vacío ilustrado | Módulos sin datos (cliente nuevo) | "No hay presupuestos" como texto plano. Debería ser estado vacío con ilustración y CTA claro. |
| Tablas sin paginación visible | AdminView, módulos con muchos registros | Si hay > 50 ítems, la UX degrada. |
| Números sin formateo consistente | Precios, facturas | `1000` vs `1.000` vs `1,000€` en distintos lugares. |

---

### LOADERS Y ESTADOS DE CARGA

| Elemento | Dónde | Problema |
|----------|-------|---------|
| Spinner global bloqueante | Workspace resolver en algunos casos | La pantalla completa se bloquea mientras resuelve el workspace. Ya mejorado parcialmente (PRESERVED_APP_PAGES) pero no en todos los casos. |
| Sin skeleton en módulos clave | PortalDashboard, ScreenPlanificacion | El contenido aparece bruscamente sin transición. |
| "Cargando..." sin tiempo máximo visible | Varios | Si la carga falla silenciosamente, el usuario espera indefinidamente. |

---

### MODALES

| Elemento | Dónde | Problema |
|----------|-------|---------|
| Modales sin overlay animado en algunos casos | ConfirmModal vs otros modales | Inconsistencia en la animación de apertura/cierre. |
| Sin gestión de focus trap en todos los modales | Algunos modales del ERP | El foco puede escapar al resto de la página. |
| Modales sin `aria-modal` sistemático | ERP general | Accesibilidad no uniforme. |

---

### FORMULARIOS

| Elemento | Dónde | Problema |
|----------|-------|---------|
| Validación inline ausente en algunos campos | Formularios del ERP | El error aparece solo al intentar guardar, no mientras se escribe. |
| Sin autocompletado en campo de dirección del cliente | Formulario de cliente | Hay un geocoder implementado pero puede no estar activado en todos los campos de dirección. |
| Campos sin etiqueta visible (solo placeholder) | Algunos formularios | El placeholder desaparece al escribir, el usuario pierde el contexto. |

---

### MENSAJES Y ERRORES

| Elemento | Dónde | Problema |
|----------|-------|---------|
| "Error al cargar datos" sin contexto | Varios (detectado en piloto) | El usuario no sabe qué falló ni qué puede hacer. |
| Toast de error sin duración suficiente | Toast.tsx | Si el mensaje de error es largo, el toast desaparece antes de que el usuario lo lea. |
| Pantalla de error global básica | ErrorBoundary en App.tsx | Solo muestra "Ha ocurrido un error" con botón de recarga. Sin contexto, sin número de incidencia, sin opción de reportar. |
| Sin mensaje de "sin conexión" | Global | Si el usuario pierde internet, la app falla sin aviso amigable. |

---

### EMAILS

| Elemento | Dónde | Problema |
|----------|-------|---------|
| Templates embebidos como strings | Edge Functions (trade-email, trade-maintenance-email) | Los emails transaccionales son probablemente texto plano o HTML básico sin diseño de marca. |
| Sin logo en emails | trade-email | El primer email que recibe el usuario nuevo no incluye el logo de TrabFlow. |
| Sin footer legal en emails | Todos los templates | Falta: dirección, NIF, enlace de baja (requerido por CAN-SPAM/RGPD). |
| "Beta" o "Prueba" en asuntos de email | Posiblemente en welcome email | Debe comunicar producto terminado, no experimento. |

---

### NOTIFICACIONES Y BADGES

| Elemento | Dónde | Problema |
|----------|-------|---------|
| Badge de notificaciones sin distinguir tipos | Portal sidebar | El badge numérico no distingue entre alertas críticas y informativas. |
| Push notification sin acción directa | trade-push-notify | La notificación lleva al usuario al portal genérico, no al pedido específico. |
| Sin historial de notificaciones | Portal e Instalador | Si el usuario pierde una notificación push, no puede verla después. |

---

### ESTADOS EN EL MARKETPLACE

| Elemento | Dónde | Problema |
|----------|-------|---------|
| "Entregado" vs "Recibido" vs "Completado" | Ya resuelto en PZ-001A | ✅ Resuelto — documentado aquí solo por contexto histórico |
| Sin indicador de tiempo estimado de entrega | ScreenSeguimientoMaterial | El timeline muestra estados pero no fechas estimadas. |
| Sin estado "En revisión" para disputas | Marketplace | No hay flujo para cuando el instalador tiene un problema con el pedido. |

---

### ONBOARDING

| Elemento | Dónde | Problema |
|----------|-------|---------|
| Sin tooltip de bienvenida | AppDashboard primer acceso | El usuario nuevo llega al dashboard vacío sin guía. |
| Wizard de onboarding de 7 pasos | OnboardingWizard | No probado con usuario externo real. Puede tener pasos innecesarios o confusos. |
| Sin checklist de "completar perfil" | AppDashboard | El usuario nuevo no sabe qué le falta por configurar. |
| Sin tutorial contextual | Módulo Marketplace | El instalador que abre el marketplace por primera vez no sabe por dónde empezar. |

---

## FASE 5 — Lista Priorizada por Impacto Comercial

---

### 🔴 CRÍTICO

Estos elementos impiden cualquier demo o piloto externo serio. Si se presenta el producto con alguno de estos problemas, la demo puede fracasar por razones no técnicas.

---

**RC1-C01 — NIF [PENDIENTE] en el Aviso Legal**
- **Impacto:** Cualquier empresa o inversor que revise la web descubrirá que la sociedad no tiene NIF publicado. Rompe la credibilidad legal al instante.
- **Esfuerzo:** Bajo — rellenar el dato en LegalViews.tsx + actualizar textos.
- **Riesgo:** Sin riesgo técnico. Riesgo operativo si el NIF no está disponible (sociedad no constituida).
- **Beneficio:** Cumplimiento legal inmediato. Ningún departamento legal de empresa bloqueará la reunión.

---

**RC1-C02 — Banner de cookies (RGPD/LSSI)**
- **Impacto:** La plataforma usa cookies de sesión (Supabase) y posiblemente analíticas. Sin consentimiento, cualquier empresa regulada que revise la web puede rechazar la reunión.
- **Esfuerzo:** Bajo-Medio — implementar un banner simple con aceptar/rechazar. No necesita ser un CMP completo en RC-1.
- **Riesgo:** Bajo. No interfiere con la funcionalidad.
- **Beneficio:** Cumplimiento RGPD básico. Señal de madurez operativa.

---

**RC1-C03 — Analytics básico**
- **Impacto:** Sin datos, cualquier pregunta de "¿cuántos usuarios activos?" o "¿cuántos presupuestos al día?" tiene respuesta "no lo sabemos". Esto es inaceptable en cualquier reunión con inversor o distribuidor.
- **Esfuerzo:** Bajo — Vercel Analytics se activa con 2 líneas. Posthog con 5 líneas y es más potente. Plausible también.
- **Riesgo:** Muy bajo. Puede impactar levemente el rendimiento pero Vercel Analytics es edge-native.
- **Beneficio:** A partir del día siguiente se empieza a acumular datos reales: usuarios, páginas más visitadas, conversión de registro.

---

**RC1-C04 — Eliminar narrativa "beta privada"**
- **Impacto:** La página `/beta` sigue diciendo "TrabFlow AI se encuentra actualmente en fase beta privada". Un instalador que llegue a esa URL (por enlace en footer) pensará que el producto no está terminado.
- **Esfuerzo:** Bajo — reescribir el contenido de la página o redirigir a Términos.
- **Riesgo:** Ninguno.
- **Beneficio:** Narrativa coherente con producto comercial en RC-1.

---

**RC1-C05 — Guión de demo estandarizado con datos coherentes**
- **Impacto:** Sin un guión y sin datos de demo coherentes, cada demo es diferente. Los datos de prueba visibles (emails de test, nombres aleatorios, cantidades de 0€) destruyen la percepción de producto terminado.
- **Esfuerzo:** Medio — 2-3 días de preparación de datos + escritura del guión.
- **Riesgo:** Ninguno técnico.
- **Beneficio:** Cualquier demo deja la misma impresión. Repetible. Escalable.

---

**RC1-C06 — Catálogo demo con ≥ 50 productos universales**
- **Impacto:** En la demo actual, el marketplace solo funciona con los 6 productos universales piloto de PZ-001A. Una demo comercial con 6 productos parece un prototipo.
- **Esfuerzo:** Medio — cargar manualmente 50-100 UPs en las categorías de fontanería, electricidad y climatización. Puede hacerse desde el admin.
- **Riesgo:** Ninguno.
- **Beneficio:** La demo del marketplace muestra escala real, no un piloto.

---

**RC1-C07 — Onboarding de proveedor con guía de primer acceso**
- **Impacto:** PZ-001A confirmó que sin guía, el primer acceso del proveedor requiere intervención directa. En PZ-001B, el proveedor será real y puede estar solo.
- **Esfuerzo:** Medio — checklist de 5 pasos en el PortalDashboard para actor nuevo (completar perfil, vincular catálogo, configurar equipo, gestionar primer pedido, marcar tutorial como visto).
- **Riesgo:** Ninguno. Aditivo.
- **Beneficio:** El proveedor puede completar el onboarding sin soporte directo.

---

### 🟠 ALTO

Estos elementos no impiden una demo pero sí impiden que un piloto externo llegue a buen puerto o que un instalador real convierta.

---

**RC1-A01 — Templates HTML de emails transaccionales**
- **Impacto:** El primer email que recibe un usuario nuevo define la percepción del producto. Un email de texto plano sin logo dice "startup en beta". Un email con diseño dice "producto comercial".
- **Esfuerzo:** Medio — implementar un template base con logo, colores de marca, y tipografía. Reutilizable para todos los emails.
- **Riesgo:** Bajo. Los templates están en Edge Functions (supabase/functions/trade-email/). No afecta a la app.
- **Beneficio:** Percepción de calidad en el primer punto de contacto digital.

---

**RC1-A02 — FAQ pública (15+ preguntas)**
- **Impacto:** Un instalador que llega a la landing y no encuentra respuesta a "¿Cuánto cuesta?" o "¿Puedo probarlo gratis?" se va. Una FAQ responde antes de que se vaya.
- **Esfuerzo:** Bajo — contenido + componente. El componente puede ser simple (acordeón).
- **Riesgo:** Ninguno.
- **Beneficio:** Reduce la tasa de abandono en la landing. Reduce las preguntas repetidas al soporte.

---

**RC1-A03 — Argumento de ROI en la landing**
- **Impacto:** "49€/mes" no convierte. "Si ahorras 2 horas/semana a 40€/hora, TrabFlow se paga en 1 día al mes" convierte. El ROI es el argumento principal para el instalador autónomo.
- **Esfuerzo:** Bajo — solo texto y una calculadora simple (input: tarifa hora → output: días de ROI).
- **Riesgo:** Ninguno.
- **Beneficio:** Convierte a más visitantes en registros. El argumento de ROI es el más efectivo para el segmento principal.

---

**RC1-A04 — Tutorial de primer uso in-app (instalador)**
- **Impacto:** El instalador nuevo que llega al dashboard por primera vez está solo. Sin guía, el primer presupuesto puede tardar 15 minutos o no crearse nunca. El GTM dice: si no lo consigue en 3 minutos, no vuelve.
- **Esfuerzo:** Medio — puede ser tan simple como un overlay de bienvenida con 3 pasos ("Crea tu primer cliente", "Genera un presupuesto por voz", "Envíalo"). Sin librería externa.
- **Riesgo:** Bajo. Añadir un `useEffect` con flag en localStorage para mostrarlo solo una vez.
- **Beneficio:** Mejora directamente el time-to-value del instalador nuevo.

---

**RC1-A05 — Canal de soporte operativo**
- **Impacto:** Un proveedor o instalador que tiene un problema durante un piloto y no puede contactar a TrabFlow perderá confianza. No necesita ser un centro de soporte completo — basta con un WhatsApp de soporte y una respuesta en < 4h.
- **Esfuerzo:** Bajo — añadir enlace a WhatsApp Business en la landing y en la app.
- **Riesgo:** Ninguno.
- **Beneficio:** Durante los primeros pilotos, el soporte directo salva pilotos. Luego se formaliza.

---

**RC1-A06 — Política de Privacidad completa**
- **Impacto:** Una empresa que quiera firmar un contrato con TrabFlow como procesador de datos (RGPD) necesita una política completa. La actual está incompleta.
- **Esfuerzo:** Medio — redactar las secciones faltantes (retención, transferencias internacionales, DPO).
- **Riesgo:** Ninguno técnico. Riesgo de incumplimiento RGPD si no se hace.
- **Beneficio:** Cumplimiento legal. Confianza de empresas medianas y grandes.

---

**RC1-A07 — Monitoring de errores (Sentry o BetterStack)**
- **Impacto:** Sin Sentry, los errores en producción son invisibles hasta que un usuario los reporta. Durante pilotos externos, un error no detectado puede costar el piloto.
- **Esfuerzo:** Bajo — Sentry tiene integración de React en < 30 minutos. Plan gratuito suficiente para RC-1.
- **Riesgo:** Mínimo impacto en rendimiento.
- **Beneficio:** Detección proactiva de errores. Capacidad de responder antes de que el usuario lo reporte.

---

**RC1-A08 — Métrica "98.2% OK rate" visible en la landing**
- **Impacto:** Esta métrica es el principal diferenciador técnico del Motor IA. No aparece en la landing. Un instalador que vea "Motor IA con 98.2% de precisión, validado en 400 presupuestos reales" tiene un argumento concreto para confiar.
- **Esfuerzo:** Bajo — solo texto y quizás un elemento visual de KPI en la landing.
- **Riesgo:** Ninguno.
- **Beneficio:** Convierte visitantes escépticos en registros. Refuerza el argumento técnico.

---

**RC1-A09 — Email de recordatorio de trial (7 días y 1 día antes)**
- **Impacto:** Sin recordatorio, muchos usuarios que han probado TrabFlow durante el trial se irán sin decidir. El email de "tu trial termina en 7 días" es el momento de mayor tasa de conversión.
- **Esfuerzo:** Medio — nueva Edge Function o lógica en el cron diario existente (trade-cron-daily).
- **Riesgo:** Bajo. Requiere acceso a la fecha de fin de trial desde trade_subscriptions.
- **Beneficio:** Aumenta la conversión de trial a pago de forma directa.

---

**RC1-A10 — Vídeo demo de 60-90 segundos**
- **Impacto:** El GTM dice que el vídeo corto del presupuesto por voz es el canal de conversión más efectivo para instaladores. Sin vídeo, la landing depende solo de texto.
- **Esfuerzo:** Bajo en recursos (grabación con OBS o Loom), Medio en producción (edición, subtítulos).
- **Riesgo:** Ninguno.
- **Beneficio:** El vídeo de 60s del presupuesto por voz puede ser el elemento que más registros genere de toda la landing.

---

### 🟡 MEDIO

Estos elementos mejoran significativamente la percepción de calidad pero no bloquean pilotos.

---

**RC1-M01 — Status page pública**
- **Impacto:** Un widget de uptime real ("99.9% últimos 90 días") es más convincente que cualquier frase de marketing sobre fiabilidad.
- **Esfuerzo:** Bajo — BetterStack tiene plan gratuito con status page pública. 30 minutos de configuración.
- **Riesgo:** Ninguno.
- **Beneficio:** Percepción de madurez operativa.

---

**RC1-M02 — Testimonio real en la landing**
- **Impacto:** PZ-001A generó datos reales. "Un instalador de Cantabria completó 2 ciclos de pedido de material en menos de 3 minutos con TrabFlow." Es un testimonio verificable.
- **Esfuerzo:** Bajo — texto y quizás una foto representativa.
- **Riesgo:** Ninguno.
- **Beneficio:** Prueba social real. El elemento que más influye en la decisión de registro después del precio y el vídeo.

---

**RC1-M03 — Mejora de páginas legales (tipografía y contraste)**
- **Impacto:** Las páginas legales actuales tienen fondo `#020B16` con texto `white/55` (opacity 55%). Muy difícil de leer. Un abogado o responsable legal que las intente leer las abandonará.
- **Esfuerzo:** Bajo — aumentar opacidad del texto a `white/80` mínimo y mejorar la tipografía de secciones.
- **Riesgo:** Ninguno.
- **Beneficio:** Las páginas legales se pueden leer. Reduce el riesgo de firma de contratos con cláusulas "no leídas".

---

**RC1-M04 — Estados vacíos ilustrados en módulos clave**
- **Impacto:** Un instalador nuevo que llega al módulo de Presupuestos y ve solo texto "No hay presupuestos" no tiene claro qué hacer. Un estado vacío con ilustración y CTA "Crear mi primer presupuesto" convierte.
- **Esfuerzo:** Bajo — para cada estado vacío, añadir ilustración simple (SVG o emoji) + texto + CTA.
- **Riesgo:** Ninguno.
- **Beneficio:** Mejor time-to-value para usuario nuevo. Reduce abandono en primera sesión.

---

**RC1-M05 — Consistencia de nombres de archivo en /public**
- **Impacto:** Archivos como "ChatGPT Image *.png" o "presupuesto pruebas.pdf" son visibles en producción para quien inspeccione las referencias del código.
- **Esfuerzo:** Bajo — renombrar archivos y actualizar referencias.
- **Riesgo:** Muy bajo — riesgo de referencias rotas si no se actualizan todos los lugares donde se usa el nombre del archivo.
- **Beneficio:** Limpieza profesional del repositorio.

---

**RC1-M06 — Consistencia de loaders y skeletons**
- **Impacto:** Algunos módulos tienen skeleton loaders, otros tienen "Cargando...", otros tienen spinners. Esta inconsistencia señala que el producto fue construido por piezas sin revisión final.
- **Esfuerzo:** Medio — auditar todos los estados de carga y estandarizar el patrón del Design System.
- **Riesgo:** Ninguno.
- **Beneficio:** El producto parece construido de forma coherente.

---

**RC1-M07 — Términos del Marketplace**
- **Impacto:** El proveedor que se integra al marketplace necesita saber cuál es su responsabilidad, cuáles son los plazos, qué pasa si hay una disputa. Sin estos términos, el distribuidor no puede firmar.
- **Esfuerzo:** Medio — redactar 2-3 páginas de términos específicos del marketplace.
- **Riesgo:** Requiere revisión legal.
- **Beneficio:** Elimina el freno más común en la firma de contratos con distribuidores.

---

### 🟢 BAJO

Estos elementos mejoran la percepción global pero tienen menor impacto en las decisiones de adopción inmediata.

---

**RC1-B01 — SEO básico (title, meta, og, sitemap)**
- **Impacto:** Sin SEO, nadie encuentra TrabFlow en Google. El GTM dice que el SEO tiene lag de 6-12 meses — cuanto antes se empiece, mejor.
- **Esfuerzo:** Bajo — implementar `<title>` y `<meta description>` dinámicos por página, sitemap.xml.
- **Riesgo:** Ninguno.
- **Beneficio:** A 6-12 meses: tráfico orgánico de instaladores que buscan software de presupuestos.

---

**RC1-B02 — Open Graph tags para sharing**
- **Impacto:** Cuando alguien comparte un link a la landing de TrabFlow en WhatsApp o LinkedIn, el preview debe mostrar título, descripción, e imagen de marca. Actualmente probablemente no está configurado.
- **Esfuerzo:** Muy bajo — 4-5 meta tags en el index.html.
- **Riesgo:** Ninguno.
- **Beneficio:** Cada link compartido de TrabFlow hace marketing automático.

---

**RC1-B03 — Formateo consistente de números**
- **Impacto:** `1000.00€` vs `1.000,00 €` vs `1,000 EUR` en distintos lugares señala falta de atención al detalle.
- **Esfuerzo:** Bajo — implementar una función de formateo centralizada y usarla en todos los módulos.
- **Riesgo:** Bajo. Puede afectar a tests que dependan del formato exacto.
- **Beneficio:** El producto parece construido con atención al detalle.

---

**RC1-B04 — Sistema de referidos básico**
- **Impacto:** El GTM dice que el referido instalador→instalador es el canal más efectivo. Sin mecanismo de referido, cada nuevo usuario debe venir por cuenta propia.
- **Esfuerzo:** Alto — requiere lógica de generación de código, tracking de conversiones, descuento automático.
- **Riesgo:** Medio — necesita BD y Stripe para aplicar descuentos.
- **Beneficio:** Canal de captación orgánico de alta calidad. Bajo en RC-1 porque es complejo y hay otras prioridades.

---

## Resumen de Prioridades

| Código | Elemento | Prioridad | Esfuerzo | Impacto |
|--------|----------|-----------|---------|---------|
| RC1-C01 | NIF en Aviso Legal | 🔴 CRÍTICO | Bajo | Cumplimiento legal |
| RC1-C02 | Banner de cookies | 🔴 CRÍTICO | Bajo-Medio | Cumplimiento RGPD |
| RC1-C03 | Analytics básico | 🔴 CRÍTICO | Bajo | Datos de negocio |
| RC1-C04 | Eliminar narrativa "beta" | 🔴 CRÍTICO | Bajo | Percepción comercial |
| RC1-C05 | Guión de demo + datos coherentes | 🔴 CRÍTICO | Medio | Efectividad comercial |
| RC1-C06 | Catálogo demo 50+ productos | 🔴 CRÍTICO | Medio | Demo de escala |
| RC1-C07 | Onboarding guiado proveedor | 🔴 CRÍTICO | Medio | PZ-001B |
| RC1-A01 | Templates HTML emails | 🟠 ALTO | Medio | Primera impresión |
| RC1-A02 | FAQ pública | 🟠 ALTO | Bajo | Reducir abandono |
| RC1-A03 | Argumento ROI en landing | 🟠 ALTO | Bajo | Conversión |
| RC1-A04 | Tutorial primer uso in-app | 🟠 ALTO | Medio | Time-to-value |
| RC1-A05 | Canal de soporte operativo | 🟠 ALTO | Bajo | Confianza pilotos |
| RC1-A06 | Política de privacidad completa | 🟠 ALTO | Medio | Cumplimiento + confianza |
| RC1-A07 | Monitoring de errores (Sentry) | 🟠 ALTO | Bajo | Estabilidad pilotos |
| RC1-A08 | Métrica IA en landing | 🟠 ALTO | Bajo | Diferenciación |
| RC1-A09 | Email recordatorio trial | 🟠 ALTO | Medio | Conversión trial→pago |
| RC1-A10 | Vídeo demo 60-90s | 🟠 ALTO | Bajo-Medio | Canal de conversión |
| RC1-M01 | Status page pública | 🟡 MEDIO | Bajo | Percepción operativa |
| RC1-M02 | Testimonio real | 🟡 MEDIO | Bajo | Prueba social |
| RC1-M03 | Páginas legales legibles | 🟡 MEDIO | Bajo | Legibilidad |
| RC1-M04 | Estados vacíos ilustrados | 🟡 MEDIO | Bajo | UX primer uso |
| RC1-M05 | Limpieza /public | 🟡 MEDIO | Bajo | Profesionalidad |
| RC1-M06 | Consistencia loaders | 🟡 MEDIO | Medio | Coherencia UX |
| RC1-M07 | Términos Marketplace | 🟡 MEDIO | Medio | Contratos distribuidores |
| RC1-B01 | SEO básico | 🟢 BAJO | Bajo | Tráfico orgánico futuro |
| RC1-B02 | Open Graph tags | 🟢 BAJO | Muy bajo | Sharing automático |
| RC1-B03 | Formateo de números | 🟢 BAJO | Bajo | Atención al detalle |
| RC1-B04 | Sistema de referidos | 🟢 BAJO | Alto | Canal captación orgánico |

---

## FASE 6 — Plan Completo de RC-1

### Sprint RC1-Alpha (semana 1-2): Limpiar los bloqueantes legales y de percepción

| Tarea | Código | Quién |
|-------|--------|-------|
| Publicar NIF real en Aviso Legal | RC1-C01 | Dev |
| Actualizar domicilio social en Aviso Legal | RC1-C01 | Fernando |
| Implementar banner de cookies básico | RC1-C02 | Dev |
| Activar Vercel Analytics o Posthog | RC1-C03 | Dev |
| Reescribir página /beta → /condiciones-piloto | RC1-C04 | Dev + Fernando |
| Actualizar fecha "Mayo 2026" en textos legales | — | Dev |
| Limpiar /public (renombrar archivos) | RC1-M05 | Dev |

**Objetivo:** Ningún elemento crítico legal o de percepción visible al abrir la URL.

---

### Sprint RC1-Beta (semana 3-4): Demo comercial y soporte

| Tarea | Código | Quién |
|-------|--------|-------|
| Cargar 50-100 Productos Universales en admin | RC1-C06 | Fernando |
| Preparar guión de demo estandarizado 15 min | RC1-C05 | Fernando |
| Preparar datos de demo coherentes (cuentas demo, presupuesto DEMO-001) | RC1-C05 | Fernando + Dev |
| Implementar checklist de onboarding en PortalDashboard | RC1-C07 | Dev |
| Añadir canal de soporte WhatsApp visible | RC1-A05 | Fernando |
| Implementar FAQ (10-15 preguntas) | RC1-A02 | Fernando + Dev |

**Objetivo:** Demo ejecutable en 15 minutos con datos coherentes, sin datos de prueba visibles.

---

### Sprint RC1-Gamma (semana 5-6): Conversión y percepción

| Tarea | Código | Quién |
|-------|--------|-------|
| Template HTML emails (bienvenida, confirmación) | RC1-A01 | Dev |
| Añadir argumento ROI en landing | RC1-A03 | Dev + Fernando |
| Tutorial primer uso in-app (overlay bienvenida) | RC1-A04 | Dev |
| Instalar Sentry (error monitoring) | RC1-A07 | Dev |
| Añadir métrica "98.2%" en landing | RC1-A08 | Dev |
| Añadir testimonio real | RC1-M02 | Fernando |
| Activar BetterStack (uptime + status page) | RC1-M01 | Dev |

**Objetivo:** Un instalador nuevo que llega a la landing entiende el valor en 30 segundos y puede registrarse y crear un presupuesto en < 5 minutos sin ayuda.

---

### Sprint RC1-Delta (semana 7-8): Contenido y legal completo

| Tarea | Código | Quién |
|-------|--------|-------|
| Política de Privacidad completa | RC1-A06 | Fernando + asesor legal |
| Términos del Marketplace | RC1-M07 | Fernando + asesor legal |
| Email recordatorio trial (7 días, 1 día) | RC1-A09 | Dev |
| Vídeo demo 60-90 segundos | RC1-A10 | Fernando |
| Estados vacíos ilustrados (módulos clave) | RC1-M04 | Dev |
| SEO básico (title, meta, sitemap) | RC1-B01 | Dev |
| Open Graph tags | RC1-B02 | Dev |
| Formateo de números consistente | RC1-B03 | Dev |

**Objetivo:** El producto está listo para PZ-001B (piloto con instalador externo real).

---

### Criterio de cierre de RC-1

RC-1 se cierra cuando:
1. ✅ Todos los 🔴 CRÍTICOS resueltos
2. ✅ ≥ 80% de los 🟠 ALTOS resueltos
3. ✅ PZ-001B ejecutado con éxito (primer instalador externo real)
4. ✅ Analytics activo con ≥ 2 semanas de datos
5. ✅ Ningún elemento "beta" visible en páginas públicas

*Después de RC-1, se abre el plan para PZ-001C (primer proveedor real) y se retoma Sprint 2 del Marketplace.*
