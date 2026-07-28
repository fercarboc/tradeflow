# RC-1 — Checklist Comercial

**Versión:** 1.0  
**Fecha:** 2026-07-28  
**Propósito:** Lista ejecutable de lo que debe estar completado antes de presentar TrabFlow a un distribuidor real, una asociación, o un inversor.  
**Referencia:** RC1_COMMERCIAL_READINESS.md — para análisis completo de cada ítem.

---

## Instrucciones

- **☐** = pendiente  
- **☑** = completado  
- **⚠️** = parcial — existe pero necesita mejora  

Cada sección tiene una estimación de prioridad:  
🔴 CRÍTICO — bloquea cualquier demo o piloto externo  
🟠 ALTO — bloquea pilotos serios y conversión  
🟡 MEDIO — bloquea escala y conversión sostenida  
🟢 BAJO — mejora la percepción pero no es bloqueante

---

## BLOQUE 1 — Legal y Cumplimiento

### Identidad legal

☑ 🔴 **NIF de TrabFlow Technologies S.L.** publicado en el Aviso Legal — provisional B11792515 *(RC1-C01 ✅)*  
☑ 🔴 **Domicilio social real** verificado y publicado — provisional C/ Las Varas 69, Castillo Pedroso, Cantabria *(RC1-C02 ✅)*  
☐ 🟠 **Nombre del representante legal** publicado en el Aviso Legal  
☐ 🟠 **Email de contacto legal** funcionando y con respuesta real (soporte@trabflow.com)  
☐ 🟡 **Número de registro mercantil** publicado  

### Política de Privacidad

☐ 🔴 **Períodos de retención de datos** especificados por categoría  
☐ 🔴 **Transferencias internacionales** declaradas (Supabase US, Resend US, Anthropic US, Google Cloud)  
☐ 🟠 **Base legal de cada tratamiento** especificada (consentimiento, interés legítimo, contrato)  
☐ 🟠 **Datos de contacto del DPO** o procedimiento de reclamación a la AEPD  
☐ 🟠 **Derechos RGPD** completos (acceso, rectificación, supresión, portabilidad, oposición, limitación)  
☐ 🟡 **Política de menores** (confirmación de no dirigirse a menores de 16 años)  
☐ 🟡 **Fecha de actualización** al día  

### Política de Cookies

☐ 🔴 **Banner de cookies** con consentimiento real (aceptar / rechazar / personalizar)  
☐ 🔴 **Tabla de cookies específicas** (nombre, proveedor, duración, finalidad) en la Política de Cookies  
☐ 🟠 **Gestión de preferencias** de cookies (al menos técnicas vs. analíticas)  
☐ 🟠 **Fecha de actualización** al día  

### Términos del Servicio

☐ 🟠 **Términos específicos del Marketplace** — responsabilidad de pedidos, plazos, disputas, cancelaciones  
☐ 🟠 **Condiciones del trial** — qué pasa al final del período gratuito, cómo cancelar  
☐ 🟡 **SLA implícito** — nivel de disponibilidad que TrabFlow garantiza  
☐ 🟡 **Resolución de conflictos** — jurisdicción y tribunal competente  

### Contratos específicos

☐ 🟠 **Contrato de Proveedor Marketplace** — documento firmable para distribuidores que se integran  
☐ 🟡 **Acuerdo de piloto** — documento para pilotos controlados (PZ-001B en adelante)  

### Narrativa

☐ 🔴 **Eliminar "beta privada"** de todas las páginas públicas (o renombrar a "piloto controlado")  
☐ 🟠 **Fecha "Mayo de 2026"** actualizada en páginas legales  
☐ 🟡 **`/ia-disclaimer`** integrado en los Términos o eliminado como página independiente  

---

## BLOQUE 2 — Dominio y Marca

☑ 🔴 **Dominio trabflow.com** — activo y con certificado SSL válido  
☐ 🟠 **Dominio de email** profesional — soporte@trabflow.com, legal@trabflow.com, hola@trabflow.com funcionando  
☐ 🟠 **Registros SPF/DKIM/DMARC** configurados para el dominio de email (evitar spam)  
☐ 🟡 **Subdominio status.trabflow.com** — página de estado del servicio  
☐ 🟡 **Nombre consistente** en toda la plataforma: "TrabFlow" (sin "AI" o "AI" sistemático — elegir uno)  
☐ 🟢 **Favicon nítido** en múltiples tamaños (browser tab, iOS homescreen, Android)  
☐ 🟢 **Open Graph tags** correctos en la landing (título, descripción, imagen) para links compartidos  

---

## BLOQUE 3 — Analytics y Métricas

☐ 🔴 **Analytics básico instalado** — Vercel Analytics, Posthog, o Plausible (mínimo pageviews y eventos)  
☐ 🔴 **Funnel de conversión** — registro → primer presupuesto → activación → conversión a pago  
☐ 🟠 **Eventos clave trackeados** — registro, primer presupuesto, aceptación de presupuesto, primer pedido marketplace, conversión  
☐ 🟠 **Dashboard de métricas de negocio** — MAU, DAU, presupuestos/día, ARR  
☐ 🟠 **Retención** — % de usuarios activos al día 7, día 30, día 90  
☐ 🟡 **Cohortes** — comparación de retención entre semanas/meses  
☐ 🟡 **Heatmaps** (Hotjar o Clarity) en onboarding y landing  

---

## BLOQUE 4 — Monitorización y Operaciones

☐ 🟠 **Error monitoring** — Sentry o BetterStack para errores de frontend y Edge Functions  
☐ 🟠 **Uptime monitoring** — alerta si la plataforma cae (BetterStack, Better Uptime, o Vercel Checks)  
☐ 🟠 **Alertas de errores** a email/Slack cuando hay un error en producción  
☐ 🟡 **Status page pública** — `status.trabflow.com` o widget embebido en la landing  
☐ 🟡 **Log de errores revisado semanalmente** — proceso documentado  
☐ 🟡 **Backup verificado** — confirmación de que Supabase backups están activos y se ha probado un restore  
☐ 🟡 **Runbook de incidencias** — qué hacer si la plataforma cae  
☐ 🟢 **Dashboard de métricas técnicas** — latencia de RPC, uso de Edge Functions, errores por hora  

---

## BLOQUE 5 — Soporte y Atención al Usuario

☐ 🟠 **Canal de soporte operativo** — email, chat, o WhatsApp con tiempo de respuesta < 24h en días laborables  
☐ 🟠 **FAQ pública** — mínimo 15 preguntas frecuentes sobre registro, precios, funcionalidades, marketplace  
☐ 🟠 **Centro de ayuda básico** — 5-10 artículos sobre los flujos principales (crear presupuesto, gestionar equipo, portal proveedor)  
☐ 🟡 **Chatbot de soporte** con respuestas a preguntas frecuentes (el ChatbotWidget existe — revisar calidad de respuestas)  
☐ 🟡 **Sistema de tickets** — aunque sea un formulario a email con SLA de respuesta  
☐ 🟢 **Escalado de soporte** — proceso documentado para incidencias críticas  

---

## BLOQUE 6 — Onboarding y Primera Experiencia

### Instalador nuevo
☐ 🔴 **Tutorial de primer uso in-app** — guía contextual en el primer acceso (tooltip chain o overlay)  
☐ 🔴 **Objetivo de activación medido** — el instalador crea su primer presupuesto en < 5 min (medido con analytics)  
☐ 🟠 **Email de bienvenida mejorado** — con logo, 3 pasos claros, enlace directo al primer presupuesto  
☐ 🟠 **Email día 3** — "¿Cómo va? Aquí tienes un truco de TrabFlow para ahorrar más tiempo"  
☐ 🟠 **Email día 30** — "Llevas un mes con TrabFlow. Estas son tus estadísticas" (número de presupuestos, clientes)  
☐ 🟡 **Email 7 días antes del fin del trial** — recordatorio con CTA a contratar  
☐ 🟡 **Email 1 día antes del fin del trial** — última oportunidad con oferta o garantía  
☐ 🟡 **Onboarding wizard revisado** — verificar con un usuario real externo que todos los 7 pasos son necesarios y claros  

### Proveedor nuevo
☐ 🔴 **Guía de primer acceso al Portal** — checklist visible en el dashboard del proveedor nuevo (ej: "Completa tu perfil", "Vincula tu catálogo", "Gestiona tu primer pedido")  
☐ 🟠 **Email de bienvenida específico para proveedor** — con logo, acceso al portal, 3 pasos para empezar  
☐ 🟠 **Proceso de carga de catálogo documentado** — guía paso a paso (CSV, qué columnas, qué pasa después)  
☐ 🟡 **Tutorial del portal del proveedor** — vídeo o guía escrita de 5 minutos  
☐ 🟡 **Email de primer pedido** — aviso especial para el primer pedido que recibe el proveedor ("¡Tienes tu primer pedido! Aquí te explicamos cómo gestionarlo")  

---

## BLOQUE 7 — Demo Comercial

☐ 🔴 **Guión de demo estandarizado** — 15 minutos ejecutable con datos consistentes  
☐ 🔴 **Datos de demo coherentes** — instalador con nombre real, clientes reales, presupuesto con narrativa, pedido de material completo  
☐ 🟠 **Demo proveedor** — 10 minutos desde el portal del proveedor hasta confirmar y enviar un pedido  
☐ 🟠 **Demo instalador** — 10 minutos desde la creación de presupuesto hasta el pedido de material  
☐ 🟠 **Cuentas de demo separadas** — no usar cuentas de producción reales para demos  
☐ 🟡 **Dossier comercial** — PDF de 5 páginas: problema, solución, casos, propuesta económica, próximos pasos  
☐ 🟡 **Deck de 10 slides** — para reuniones con directivos de distribuidor o inversores  
☐ 🟢 **Caso de uso demo OBRAMAT** — presupuesto de reforma con material de fontanería y eléctrico, pedido completo  
☐ 🟢 **Caso de uso demo asociación** — instalador autónomo, presupuesto en 2 minutos, envío al cliente  

---

## BLOQUE 8 — Contenido Comercial

☐ 🔴 **Vídeo demo de 60-90 segundos** — screencast del flujo de presupuesto por voz. Canal de conversión más efectivo.  
☐ 🟠 **Argumento de ROI en la landing** — no el precio: el retorno. "Si ahorras 2h/semana a 40€/h, TrabFlow se paga en 1 día al mes"  
☐ 🟠 **Testimonio real** — aunque sea del instalador del piloto. Con nombre, ciudad, y métrica concreta.  
☐ 🟠 **Métrica del Motor IA en la landing** — "98.2% de precisión. Validado en 400 presupuestos reales."  
☐ 🟡 **Manual de instalador** — PDF o web de 5 páginas: qué es TrabFlow, cómo crear el primer presupuesto, cómo invitar a un técnico  
☐ 🟡 **Manual de proveedor** — PDF o web de 5 páginas: qué es el Portal TrabFlow, cómo gestionar pedidos, cómo actualizar el catálogo  
☐ 🟡 **Tutorial vídeo instalador** — 5-10 minutos paso a paso del flujo principal  
☐ 🟡 **Tutorial vídeo proveedor** — 5-10 minutos del portal del proveedor  
☐ 🟢 **Blog/contenido SEO** — mínimo 3 artículos de búsqueda alta intención ("cómo hacer presupuesto electricidad")  
☐ 🟢 **Perfil de empresa en LinkedIn** — con descripción actualizada y enlace al demo  

---

## BLOQUE 9 — Catálogo y Datos

☐ 🔴 **Catálogo demo funcional** — mínimo 50-100 productos universales vinculados para una demo completa de marketplace  
☐ 🟠 **Productos universales por gremio** — fontanería, electricidad, climatización (los 3 oficios principales)  
☐ 🟠 **Datos de demo coherentes** — presupuesto PRE-DEMO-001 con cliente "María García", trabajo real, materiales reales, pedido MKT-DEMO-001 completado  
☐ 🟡 **Proceso de carga de catálogo** — herramienta de importación CSV probada y documentada para el distribuidor  
☐ 🟡 **Stock simulado** — los productos de demo tienen stock disponible  
☐ 🟢 **Precios de demo realistas** — coherentes con precios de mercado 2026  

---

## BLOQUE 10 — Emails Transaccionales

☐ 🟠 **Template HTML de bienvenida** — con logo TrabFlow, colores de marca, jerarquía tipográfica clara  
☐ 🟠 **Template HTML de confirmación de cuenta** — con botón claro de activación  
☐ 🟠 **Template HTML de invitación a equipo** — con contexto del instalador que invita  
☐ 🟡 **Template HTML de nuevo pedido (proveedor)** — alerta visual con detalles del pedido  
☐ 🟡 **Template HTML de estado de pedido (instalador)** — confirmación, preparación, envío, entrega  
☐ 🟡 **Template HTML de recordatorio de trial** — 7 días y 1 día antes  
☐ 🟡 **Template HTML de factura mensual** — si Stripe no gestiona el email, TrabFlow necesita enviar recibo  
☐ 🟢 **Footer de email** — con dirección legal, enlace de baja, NIF, link a privacidad  

---

## BLOQUE 11 — SEO y Presencia

☐ 🟡 **Title y meta description** correctos en todas las páginas públicas  
☐ 🟡 **OG tags** (Open Graph) para sharing en redes sociales y WhatsApp  
☐ 🟡 **Sitemap.xml** generado y enviado a Google Search Console  
☐ 🟡 **robots.txt** correcto (no indexar /app, /admin, /proveedor)  
☐ 🟡 **Google Search Console** configurado  
☐ 🟢 **Schema.org** (datos estructurados) en la landing para SaaS/software  
☐ 🟢 **Canonical tags** en páginas con contenido similar  

---

## BLOQUE 12 — PWA y Móvil

☑ 🟠 **Manifest.json** configurado (existe)  
☑ 🟠 **Service worker** registrado (existe)  
☑ 🟠 **Iconos PWA** en múltiples tamaños (existen)  
☐ 🟠 **Push notifications** probadas en dispositivo real (iOS/Android)  
☐ 🟠 **Flujo marketplace en móvil** probado end-to-end  
☐ 🟠 **Portal proveedor en móvil** probado y funcional  
☐ 🟡 **Banner "instalar app"** visible en primera visita desde móvil  
☐ 🟡 **ERP en móvil** — revisión de paridad funcional vs. desktop  
☐ 🟢 **PWA en App Store / Play Store** (via PWABuilder o Trusted Web Activity) — solo si hay demanda comprobada  

---

## BLOQUE 13 — Seguridad y Confianza

☑ 🔴 **RLS en todas las tablas** — implementado  
☑ 🔴 **Autenticación Supabase** — implementada con refresh tokens  
☑ 🟠 **service_role key** no en repositorio ni logs — regla activa  
☐ 🟠 **Política de contraseñas** — mínimo definido y documentado  
☐ 🟡 **2FA / MFA** disponible para cuentas de empresa  
☐ 🟡 **Auditoría de accesos** — log de quién accede a qué  
☐ 🟡 **HTTPS en todos los endpoints** — verificar no hay contenido mixto  
☐ 🟢 **Declaración de seguridad** — breve documento (o sección) sobre cómo TrabFlow protege los datos  

---

## BLOQUE 14 — Financiero y Stripe

☑ 🟠 **Stripe configurado** (checkout, portal, webhooks)  
☑ 🟠 **Tres planes** definidos en Stripe (Profesional, Empresa, Empresa+)  
☑ 🟠 **Trial de 3 meses** configurado  
☐ 🟠 **Facturación correcta** — verificar que Stripe emite facturas con IVA correcto (21% España)  
☐ 🟠 **Proceso de cancelación** claro y documentado — cómo cancela un usuario su suscripción  
☐ 🟡 **Proceso de downgrade** documentado — qué pasa con los datos si bajan de plan  
☐ 🟡 **Stripe Tax configurado** — IVA automático por país  
☐ 🟡 **Modo Stripe Live** verificado — todas las claves son de producción, no de test  
☐ 🟢 **Múltiples métodos de pago** — tarjeta + SEPA Direct Debit para empresas europeas  

---

## RESUMEN EJECUTIVO DEL CHECKLIST

| Bloque | Total ítems | Completados | Pendientes críticos |
|--------|-------------|-------------|---------------------|
| Legal y Cumplimiento | 17 | ~0 | NIF, cookies, beta |
| Dominio y Marca | 7 | 1 | Email profesional, SPF/DKIM |
| Analytics | 7 | 0 | Analytics básico, funnel |
| Monitorización | 8 | 0 | Error monitoring, uptime |
| Soporte | 6 | 0 | FAQ, canal de soporte |
| Onboarding | 12 | ~2 | Tutorial in-app, onboarding proveedor |
| Demo Comercial | 8 | 0 | Guión, datos coherentes |
| Contenido | 8 | 0 | Vídeo 60s, ROI en landing |
| Catálogo y Datos | 5 | 1 | Catálogo demo funcional |
| Emails Transaccionales | 8 | 0 | Templates HTML |
| SEO | 7 | 0 | Básico |
| PWA y Móvil | 9 | 3 | Push probado, móvil probado |
| Seguridad | 8 | 3 | 2FA, auditoría |
| Financiero | 8 | 3 | IVA correcto, cancelación |

**Items 🔴 CRÍTICOS totales: 11**  
**Items 🟠 ALTOS totales: ~30**  
**Items 🟡 MEDIOS totales: ~25**  
**Items 🟢 BAJOS totales: ~15**

---

*RC-1 se considera completo cuando todos los 🔴 CRÍTICOS y el 80%+ de los 🟠 ALTOS están resueltos.*
