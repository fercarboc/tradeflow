# TrabFlow — Investor & Partner Playbook

**Versión:** 1.0 — Julio 2026  
**Estado:** Normativo. Documento de trabajo interno, no material de marketing. Las cifras no validadas están marcadas claramente.  
**Propósito:** Respuesta estructurada a las preguntas de cualquier partner o inversor. Usar como base para preparar reuniones, no como guión de presentación.

---

## Qué es TrabFlow

TrabFlow es una plataforma de gestión operativa para instaladores técnicos: electricistas, fontaneros, instaladores de climatización, reformistas. Cubre el ciclo completo de su trabajo: crear el presupuesto, enviarlo al cliente, que el cliente lo acepte, pedir el material al proveedor, gestionar a los técnicos de campo, emitir la factura, y gestionar los contratos de mantenimiento.

Lo que hace diferente a TrabFlow de cualquier otro software de gestión es que el presupuesto se crea hablando. El instalador describe en voz alta el trabajo, y en 15–20 segundos tiene un presupuesto estructurado con precios reales del catálogo de su proveedor. No teclea nada. No busca referencias. No mira ningún catálogo.

El producto tiene un motor de inteligencia artificial construido específicamente para el sector de las instalaciones técnicas, con validación empírica en 400 casos reales. La versión actual (v59) genera un presupuesto correcto en el 98.2% de los casos.

---

## Por qué ahora

**Tres factores convergen en 2026:**

1. **La IA generativa es madura y asequible.** Hace dos años, un sistema capaz de entender el lenguaje de un instalador en obra y convertirlo en un presupuesto con precios reales costaba millones de dólares. Hoy, con Claude Haiku y OpenAI Whisper, el coste por presupuesto generado es inferior a 0,10€.

2. **El instalador usa el móvil.** El instalador que hasta hace cinco años rechazaba cualquier software usa el móvil con fluidez para WhatsApp, YouTube, y Google Maps. TrabFlow vive en ese mismo móvil.

3. **La digitalización del sector no espera.** Los clientes de los instaladores (comunidades de propietarios, empresas, promotores) exigen presupuestos formales, facturas digitales, y trazabilidad del trabajo. El instalador que no se digitalice pierde contratos frente a empresas más organizadas.

---

## Qué mercado existe

### Mercado España

- ~400.000 instaladores técnicos autónomos o microempresas (1–10 personas) en España. **Fuente: CNAE-93, Seguridad Social — datos orientativos, PENDIENTE DE VALIDACIÓN exacta.**
- Sectores cubiertos: electricidad, fontanería, climatización, reformas, pintura, carpintería, cerrajería, albanilería.
- Gasto anual de los instaladores en software de gestión: mayoritariamente en Excel y herramientas gratuitas. El mercado pagador es pequeño pero creciente.

### Mercado potencial (SAM — Servicios Accesibles del Mercado)

- Instaladores técnicos en España susceptibles de usar una app de gestión: ~80.000–120.000 (los que tienen smartphone, emiten facturas regularmente, y tienen clientes directos — no solo subcontratan). **PENDIENTE DE VALIDACIÓN.**
- Precio medio objetivo de suscripción: 35–45€/mes. **PENDIENTE DE VALIDACIÓN.**
- **SAM hipotético:** 80.000 × 40€ × 12 = 38M€/año en España. No incluye Marketplace ni distribuidores.

### Mercado europeo (tam)

- Mercado similar en Portugal (40.000 instaladores), Italia (150.000+), Francia (200.000+), Alemania (250.000+).
- El mercado europeo de instaladores técnicos es uno de los más fragmentados y menos digitalizados de Europa.
- **TAM hipotético Europa:** 10× el mercado español. **PENDIENTE DE VALIDACIÓN.**

---

## Qué oportunidad existe

La oportunidad no es solo el software. Es la posición como intermediario en la cadena de suministro del sector de instalaciones técnicas.

**Hoy, la cadena funciona así:**
1. El instalador habla con el distribuidor por teléfono o va en persona.
2. El distribuidor no sabe qué va a necesitar hasta que llaman.
3. No hay datos. No hay trazabilidad. No hay predicción.

**Con TrabFlow:**
1. El instalador pide el material desde el presupuesto — el proveedor lo recibe en tiempo real.
2. El distribuidor puede planificar stock porque sabe qué se está presupuestando.
3. Hay datos de qué materiales se usan, cuándo, dónde, y a qué precio.

Estos datos tienen valor económico para distribuidores, fabricantes, y analistas del sector. TrabFlow está en posición de ser el sistema de registro del sector de las instalaciones técnicas en España.

---

## Cómo gana dinero

### Hoy (2026)

Suscripciones mensuales de instaladores. Trial de 3 meses gratuito, conversión a pago. El precio exacto está en proceso de validación.

### 2027

Suscripciones + comisiones sobre pedidos en el Marketplace (estimado 2–3% del GMV). Los primeros distribuidores integrados pagan un fee mensual de presencia.

### 2028+

Las cuatro fuentes anteriores + visibilidad de fabricantes + API pública para ERP de proveedores.

**La curva de ingresos es no lineal:** Los primeros 200 clientes generan ingreso de suscripciones principalmente. A partir de 500 clientes con actividad de Marketplace, las comisiones empiezan a superar las suscripciones en crecimiento.

---

## Estado actual del producto

### Qué existe y funciona en producción

| Módulo | Estado |
|---|---|
| Motor IA (voz → presupuesto) | ✅ Producción — v59, 98.2% OK rate, 400 casos benchmark |
| ERP completo (presupuestos, facturas, clientes, trabajos) | ✅ Producción |
| Contratos de mantenimiento SAT | ✅ Producción |
| Asistente de normativa técnica (REBT, RITE, CTE, AEAT) | ✅ Producción |
| Marketplace — Checkout (instalador compra material) | ✅ Producción |
| Marketplace — Seguimiento en tiempo real | ✅ Producción |
| Portal del proveedor (proveedor gestiona pedidos) | ✅ Producción |
| Billing con Stripe (trial 3 meses, planes, portal) | ✅ Producción |
| Notificaciones push (Web Push / VAPID) | ✅ Producción |
| Chatbot de ayuda | ✅ Producción |
| App web (Progressive Web App, instalable) | ✅ Producción |
| Admin panel de plataforma | ✅ Producción |

### Qué falta

| Funcionalidad | Estado | Cuándo |
|---|---|---|
| Modelo de comisión (Stripe Connect) | ❌ No existe | 2027 |
| Registro auto-gestionado de proveedores | ❌ No existe | Sprint 2 (oct 2026) |
| Realtime en portal proveedor | ❌ Diferido (ADR-001) | Sprint 2 |
| App móvil en paridad con web | ⚠️ Parcial | 2027 |
| Staging separado de producción | ❌ No existe | Antes Sprint 2 |
| CI/CD automatizado | ❌ No existe | Antes Sprint 2 |
| API pública para integraciones | ❌ No existe | 2027 |
| Valoraciones de proveedores | ❌ No existe | 2027 |

---

## Roadmap resumido

| Período | Hito |
|---|---|
| Jul–Ago 2026 | Consolidación UX para piloto comercial |
| Sep–Oct 2026 | Sprint 2 Marketplace (Realtime, registro proveedor, email) |
| Oct–Nov 2026 | Primer acuerdo con asociación gremial |
| Nov–Dic 2026 | Primer piloto con distribuidor (OBRAMAT / SALTOKI) |
| 2027 | 100 usuarios pagadores, modelo de comisión, 5 distribuidores |
| 2028 | 500 usuarios, expansión a Portugal, modelo completo |

---

## Qué buscamos

### Para pilotos con distribuidores

**Qué necesitamos del distribuidor:**
- Catálogo en CSV (referencia, descripción, precio, stock, unidad)
- Contacto técnico para el proceso de integración
- Compromiso de gestionar los pedidos recibidos en < 48 horas hábiles durante el piloto

**Qué ofrece TrabFlow:**
- Integración del catálogo sin coste durante el piloto
- Portal de gestión de pedidos sin coste durante el piloto
- Visibilidad ante los instaladores que ya usan TrabFlow
- Datos de comportamiento de compra de sus instaladores clientes

**Criterio de éxito del piloto:**  
En 4 semanas, al menos X pedidos reales con un valor total de Y€. El distribuidor y TrabFlow definen X e Y antes de empezar.

### Para acuerdos con asociaciones

**Qué necesitamos de la asociación:**
- Acceso a la comunicación con sus asociados (email, newsletter, o similar)
- Respaldo oficial de la herramienta (recomendación, no exclusividad)
- Referencia de 2–3 instaladores de la asociación para testimonio piloto

**Qué ofrece TrabFlow:**
- Descuento del 20–30% en el primer año para asociados (hipótesis a negociar)
- Demo exclusiva para los asociados
- Posible co-branding en materiales de comunicación
- Informe semestral de uso y beneficios para la asociación

### Para inversores (Business Angels / Seed)

**Qué buscamos:**
- 300.000–500.000€ en ronda seed (hipótesis — PENDIENTE DE VALIDACIÓN)
- Inversor con experiencia en SaaS B2B, sector instalaciones, o marketplace

**Para qué:**
- 12 meses de runway sin necesidad de ingresos
- Contratar primer desarrollador para acelerar el roadmap técnico
- Activar canales de captación pagados con base empírica
- Preparar expansión a Portugal

**Cuándo:**
- Cuando haya datos reales de retención (> 6 meses de historial de clientes)
- Cuando haya un acuerdo firmado con una asociación o un distribuidor
- Cuando el CAC y el LTV estén validados

---

## Qué ofrecemos a cada tipo de partner

### Para el distribuidor de material

| Beneficio | Descripción |
|---|---|
| Canal de pedidos digital | Sus instaladores clientes les piden directamente desde la app, sin teléfono |
| Datos de comportamiento de compra | Qué piden, cuándo, a qué precio, con qué frecuencia |
| Visibilidad garantizada | Sus referencias aparecen cuando el instalador pide ese tipo de material |
| Sin coste de integración técnica | TrabFlow gestiona la carga del catálogo |
| Sin coste durante el piloto | El acuerdo comercial viene después de validar el valor |

### Para la asociación gremial

| Beneficio | Descripción |
|---|---|
| Herramienta de valor para sus asociados | Diferenciación respecto a otras asociaciones |
| Descuento exclusivo para asociados | TrabFlow se convierte en un beneficio tangible de estar en la asociación |
| Formación y soporte | TrabFlow organiza webinars de onboarding para los instaladores de la asociación |
| Datos del sector | Informe anual de cómo trabajan los instaladores de la asociación (anonimizado) |

### Para el fabricante de material

| Beneficio | Descripción |
|---|---|
| Visibilidad en el momento de decisión | Sus productos aparecen cuando el instalador crea el presupuesto |
| Datos de prescripción real | Qué instaladores recomiendan sus productos y en qué trabajos |
| Canal sin intermediarios | El instalador especifica el producto del fabricante desde el presupuesto |

*(Disponible a partir de 2028, cuando el volumen de instaladores lo justifique)*

### Para el inversor

| Beneficio | Descripción |
|---|---|
| Mercado desatendido | 400.000 instaladores técnicos en España sin software adecuado |
| Ventaja técnica validada | Motor IA con benchmark empírico, no promesa |
| Múltiples flujos de ingreso | Suscripciones + Marketplace + distribuidores + fabricantes |
| Efecto de red | Cada nuevo usuario mejora el producto para todos |
| Expansión europea clara | Portugal e Italia como primeros mercados internacionales |
| Fundador técnico con profundidad de dominio | No es un developer que descubrió el sector — es alguien que entiende el problema en profundidad |

---

## Preguntas frecuentes de inversores

**"¿Cuántos clientes de pago tienen?"**  
En proceso de conversión desde beta. Los datos de retención y precio validados estarán disponibles en el Q4 2026. **PENDIENTE DE VALIDACIÓN.**

**"¿Cuál es el CAC y el LTV?"**  
El CAC no está calculado — estamos en fase de captura orgánica. El LTV no está calculado — necesitamos 6+ meses de historial de pago. Ambos estarán disponibles en Q1 2027. **PENDIENTE DE VALIDACIÓN.**

**"¿Por qué no lo copia Holded o STEL Order?"**  
Holded es un ERP generalista — verticalizarse en instalaciones técnicas no es coherente con su estrategia. STEL Order podría añadir IA, pero replicar el motor (base de conocimiento por oficio, catálogos de proveedor reales, benchmark de 400 casos) requiere 12–18 meses de trabajo focalizado. En ese tiempo, TrabFlow puede haber consolidado su posición.

**"¿Qué pasa si los instaladores no pagan?"**  
El motor IA y el Marketplace tienen valor suficiente para justificar el pago incluso sin el ERP. Si el instalador no paga el SaaS, el Marketplace con comisión puede ser el modelo principal. El negocio no depende de un único vector de monetización.

**"¿Cuándo serán rentables?"**  
Con ~300 clientes de pago a precio objetivo, el negocio cubre costes de infraestructura. Con ~500 clientes más las comisiones del Marketplace, el negocio genera caja positiva. **PENDIENTE DE VALIDACIÓN** — depende del precio de conversión y del precio medio de suscripción.

**"¿Por qué no empezar por un mercado más grande (Alemania, Francia)?"**  
El motor IA está entrenado en español. La normativa técnica es española. Los distribuidores de referencia son españoles. España es el mercado natural de validación. Alemania o Francia requeriría rehacerlo todo en otro idioma y con otra normativa — es un riesgo innecesario en la fase de validación.
