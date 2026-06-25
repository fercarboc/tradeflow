# TRADEFLOW OPERATING SYSTEM (OS)
## El manual de funcionamiento de la empresa
### Versión 1.0 — Junio 2026

---

> Este documento no es documentación técnica.
> Es la brújula de TrabFlow.
> Se escribe una vez y se consulta siempre.
> Cuando lleguen clientes, inversores, socios, o dudas —
> la respuesta está aquí.

---

# ÍNDICE

1. Por qué existe este documento
2. Visión y Misión
3. El cliente TrabFlow
4. Filosofía de producto
5. Sistema de decisión de features
6. Estrategia comercial
7. Sistema de arquitectura técnica
8. El calendario estratégico (2026–2027)
9. Priorización semanal — el protocolo del lunes
10. KPIs de la empresa
11. Dashboard CEO
12. Reglas para levantar inversión
13. Protocolo de crisis
14. Glosario TrabFlow

---

---

# 1. POR QUÉ EXISTE ESTE DOCUMENTO

La mayoría de los fundadores de startups técnicas toman decisiones reactivas. Un cliente pide una feature. La añaden. Un competidor lanza algo. Lo copian. Un inversor pregunta algo. Improvisan la respuesta.

Esto es normal al principio. Pero a partir del momento en que TrabFlow tiene beta testers, reuniones con asociaciones, e inversores potenciales, la improvisación se convierte en el mayor riesgo del negocio.

**Este documento existe para que Fernando no tenga que improvisar.**

Cuando un instalador pida una feature rara, aquí estará la respuesta.
Cuando un inversor pregunte por la estrategia de crecimiento, aquí estará la respuesta.
Cuando haya que decidir si un bug es urgente o puede esperar, aquí estará el criterio.
Cuando la cabeza esté llena de posibilidades y no se sepa por dónde empezar, aquí estará el orden.

**Regla de uso:** Antes de tomar cualquier decisión importante sobre producto, dinero, partnerships, o arquitectura — leer primero este documento.

---

---

# 2. VISIÓN Y MISIÓN

## Visión a 10 años

> **Ser la plataforma operativa estándar del instalador europeo.**

En 2036, un fontanero en Lisboa, un electricista en Berlín, y un instalador HVAC en Milán usan TrabFlow para gestionar su empresa. No porque no haya alternativas. Sino porque TrabFlow es la única plataforma construida exclusivamente para ellos, con IA integrada desde el primer día, y con los catálogos de los distribuidores locales conectados directamente.

## Misión actual (2026)

> **Dar a cada instalador español las herramientas que solo tienen las grandes empresas.**

Un instalador autónomo con TrabFlow puede hacer lo que antes solo podía hacer una empresa con un equipo administrativo: presupuesto profesional en 30 segundos, factura legal, gestión de contratos de mantenimiento, y seguimiento de técnicos de campo. Todo desde el móvil. Todo en su idioma. Todo adaptado a su oficio.

## Valores

### 1. El instalador primero
Cada decisión se toma pensando en el instalador en obra, no en el desarrollador en su ordenador. Si una feature no tiene valor en obra, no entra.

### 2. Menos clics, más trabajo hecho
La app debe hacer el trabajo, no añadirlo. Un presupuesto debe crearse más rápido con TrabFlow que a mano. Una factura debe generarse en un clic desde el presupuesto. Un parte de trabajo debe rellenarse en 30 segundos desde el móvil.

### 3. La IA es el fondo, no la portada
La inteligencia artificial de TrabFlow es la ventaja competitiva, pero el instalador no debe sentir que usa una app de IA. Debe sentir que usa una app que simplemente funciona. La IA es lo que hace que funcione, no lo que el instalador tiene que aprender.

### 4. Crecimiento sin pérdida de foco
TrabFlow puede expandirse a nuevos oficios, nuevos países, y nuevas integraciones. Pero solo cuando el núcleo esté sólido. Nunca a costa de la calidad de lo que ya existe.

### 5. Una empresa de una persona puede ganar
La ventaja de TrabFlow es la velocidad y el foco. Un equipo de tres personas en una corporación tarda 6 meses en hacer lo que un fundador solo puede hacer en 3 semanas. Esta ventaja se protege a toda costa.

---

---

# 3. EL CLIENTE TRABFLOW

## Perfil principal — El instalador autónomo

**Nombre:** Paco, Javi, Marcos, Miguel
**Edad:** 35-55 años
**Oficio:** Electricista, fontanero, climatizador, reformas
**Empresa:** Autónomo o empresa familiar de 1-5 personas
**Ingresos:** 30.000–80.000€/año
**Dolor principal:** "Pierdo media hora haciendo cada presupuesto a mano"
**Segundo dolor:** "Mis clientes no me toman en serio cuando les mando un WhatsApp con los precios"
**Tercer dolor:** "No tengo tiempo para llevar la administración"
**Tecnología:** Usa WhatsApp, YouTube, Google Maps. No usa Excel. Tiene miedo a "las apps complicadas".
**Cómo decide comprar:** Por recomendación de otro instalador o porque lo ve funcionar en persona.

## Perfil secundario — La empresa de instalación

**Nombre:** Instalaciones García SL, Electrotecnia Norte
**Tamaño:** 5-20 personas
**Roles:** Dueño + 3-8 técnicos de campo + 1-2 personas de oficina
**Dolor principal:** "No sé qué están haciendo mis técnicos en cada momento"
**Segundo dolor:** "Los partes de trabajo llegan tarde y mal"
**Tercer dolor:** "La facturación de los contratos de mantenimiento es un caos"
**Decisión de compra:** El dueño debe ver ROI claro. La oficina debe ver que es más fácil que lo que tienen ahora.

## Lo que NO es el cliente TrabFlow (ahora)

- Grandes constructoras (> 50 personas)
- Empresas con ERP ya implementado (SAP, Sage 200)
- Sectores fuera de instalaciones técnicas (limpieza, jardinería a escala, etc.)
- Instaladores que solo hacen subcontratas para otras empresas sin cliente final propio

## Cómo habla el cliente

El cliente no dice "automatización". Dice "que me lo haga solo".
El cliente no dice "IA generativa". Dice "que entienda lo que le digo".
El cliente no dice "integración con proveedores". Dice "que tenga los precios de Obramat".
El cliente no dice "SaaS". Dice "una app de suscripción mensual".

**Regla:** Todo el copy de la landing, los emails, y la app debe usar el vocabulario del cliente, no el del desarrollador.

---

---

# 4. FILOSOFÍA DE PRODUCTO

## Los 5 principios de producto

### Principio 1: El primer minuto es sagrado
El instalador que instala la app debe crear su primer presupuesto en menos de 3 minutos desde que introduce su email. Si no lo consigue, TrabFlow ha fracasado. No importa lo bueno que sea el resto.

### Principio 2: Cada módulo debe justificarse con una frase
"Con esto, el instalador puede [hacer X] en [tiempo Y] sin [dolor Z]."

Si no puedes rellenar esa frase con un beneficio concreto, el módulo no entra.

Ejemplo:
- ✅ "Con el presupuesto por voz, el instalador puede hacer un presupuesto en 30 segundos sin teclear nada."
- ✅ "Con los contratos de mantenimiento, el instalador puede facturar automáticamente sus revisiones mensuales sin recordarlo cada mes."
- ❌ "Con las rutas del día, el instalador puede optimizar su ruta." (Demasiado vago. Google Maps ya lo hace. ¿Por qué TrabFlow?)

### Principio 3: Móvil primero, siempre
El instalador usa el móvil en obra. El jefe usa el ordenador en la oficina. Todo flujo crítico debe funcionar perfectamente en móvil. Los flujos de gestión avanzada pueden ser solo PC.

### Principio 4: No añadir features, añadir valor
Una feature nueva que complica el producto es peor que no añadirla. Cada nueva funcionalidad aumenta la carga cognitiva del usuario. Solo entra si:
1. La piden 3 o más usuarios de la beta con las mismas palabras.
2. No puede cubrirse con algo que ya existe.
3. No complica los flujos existentes.

### Principio 5: El producto es la demo
Si el producto no es suficientemente bueno para mostrarlo en vivo a un inversor sin preparación, no está listo para crecer. La demo siempre es en vivo, nunca en grabación (durante las reuniones con asociaciones e inversores).

## Qué NO es TrabFlow (nunca)

- Una app de contabilidad completa (Holded, Sage)
- Un ERP para grandes empresas
- Un marketplace de instaladores
- Un sistema de gestión de proyectos genérico
- Una app de comunicación interna (Slack, Teams)

TrabFlow es una plataforma operativa específica para el instalador técnico. Ese foco es su ventaja. Perderlo es su mayor riesgo.

---

---

# 5. SISTEMA DE DECISIÓN DE FEATURES

## La pregunta de los 10 segundos

Antes de decidir si una feature entra, responde estas 3 preguntas:

1. **¿La pidió un instalador real con sus propias palabras?** (Si la imaginaste tú, no cuenta)
2. **¿La usaría un instalador en obra, no en la oficina?** (Si solo tiene sentido en ordenador, es menos urgente)
3. **¿Se puede explicar en una frase sin jerga técnica?** (Si no, es demasiado compleja)

Si las 3 respuestas son SÍ → entra en la lista de evaluación.
Si alguna es NO → puede entrar más adelante.

## El filtro de prioridad

Una vez que la feature pasa el filtro de 10 segundos, se evalúa con:

| Criterio | Peso |
|----------|------|
| Impacto en retención (¿los usuarios se quedan si la tienen?) | 40% |
| Impacto en adquisición (¿los usuarios se apuntan por esto?) | 30% |
| Tiempo de implementación | 20% |
| Riesgo técnico | 10% |

**Regla:** Si el impacto en retención es bajo (los usuarios no se van sin ello), la feature espera.

## El sistema de clasificación A/B/C/D/E

| Clase | Para features | Para cambios técnicos |
|-------|--------------|----------------------|
| A | Correcto, mantener | Correcto, no tocar |
| B | Mejorar antes de beta | Corregir antes de beta |
| C | Post-PMF | Post-PMF |
| D | No durante validación | No durante validación |
| E | No aporta valor al cliente | No aporta valor: se cancela |

## Ejemplos reales de clasificación

**Clase B (antes de beta):**
- Mejorar el onboarding (reduce churn en el primer día)
- Error boundary (la app no puede morir en blanco ante un inversor)
- Code splitting (primera carga < 2 segundos)

**Clase C (post-PMF):**
- Tests automáticos
- Routing con React Router
- Internacionalización

**Clase D (nunca durante validación):**
- Cambiar de Supabase a otra BD
- Microservicios
- Reescribir el frontend en otro framework

**Clase E (cancelar):**
- Renombrar carpetas del proyecto
- Reorganizar archivos sin beneficio funcional
- Añadir abstracciones por "limpieza"
- Documentar internamente lo que ya se entiende

---

---

# 6. ESTRATEGIA COMERCIAL

## El embudo de TrabFlow

```
CONCIENCIA
Instalador ve TrabFlow en redes / boca a boca de otro instalador

    ↓

INTERÉS
Visita la landing. Ve la demo. Piensa "esto me vendría bien".

    ↓

PRUEBA
Se registra. Trial de 3 meses. Crea su primer presupuesto.

    ↓

CONVERSIÓN
Se da cuenta de que ahorra 2 horas por semana. Paga.

    ↓

EXPANSIÓN
Invita a sus técnicos. Añade el módulo de mantenimiento.

    ↓

EMBAJADOR
Recomienda TrabFlow a otros instaladores en su gremio.
```

## Canal 1 — Instaladores directos (2026)

**Cómo llegan:** Boca a boca, LinkedIn, grupos de WhatsApp de instaladores, Instagram de obra.

**Cómo convencer:** La demo en vivo. Si el instalador ve a alguien hablar y tener un presupuesto en 30 segundos, lo quiere. No hay argumento más poderoso que eso.

**Precio:** 29-49€/mes (validar en la beta qué precio soporta el mercado).

**Objetivo 2026:** 20 beta → 100 de pago.

## Canal 2 — Asociaciones (octubre 2026)

**CONAIF** (Confederación Nacional de Instaladores de Fontanería, Gas, Calefacción y Afines)
**FENIE** (Federación Nacional de Instaladores de Telecomunicaciones)
**APIEM** (Asociación Provincial de Instaladores Eléctricos de Madrid)

**Qué buscan:** Herramientas que aporten valor a sus asociados. Acuerdos de precio preferencial. Soluciones que les hagan más competitivos.

**Qué les ofrecemos:** Acuerdo de distribución. TrabFlow como "herramienta recomendada por la asociación". Descuento para sus asociados. Posible co-branding.

**Cómo preparar la reunión:**
1. Dossier de 5 páginas con el problema del instalador y cómo lo resuelve TrabFlow.
2. Demo en vivo de 20 minutos (presupuesto por voz + cliente acepta).
3. 3 testimonios de beta testers.
4. Propuesta de acuerdo: % de comisión o fee fijo por instalador referido.

**Objetivo:** 1 acuerdo firmado con una asociación antes de fin de 2026.

## Canal 3 — Distribuidores (noviembre 2026)

**Obramat** (Leroy Merlin profesional)
**Saltoki** (distribuidor electricidad y fontanería)
**Sonepar** (distribuidor material eléctrico)

**Propuesta de valor para ellos:** Sus catálogos aparecen en los presupuestos que generan los instaladores con TrabFlow. El instalador pide el material directamente desde la app. El distribuidor vende más con menos esfuerzo comercial.

**Modelo de negocio con distribuidores:**
- Opción A: El distribuidor paga un fee mensual por aparecer en el catálogo de TrabFlow.
- Opción B: Comisión del 2-3% sobre pedidos realizados a través de TrabFlow.
- Opción C: El distribuidor patrocina cuentas TrabFlow para sus clientes (el distribuidor paga el SaaS, el instalador lo usa gratis).

**Cómo preparar la reunión:**
1. Datos de cuántos presupuestos se generan al mes con sus materiales.
2. Demo del flujo: presupuesto por voz → el material aparece con precios Obramat → el instalador lo pide en un clic.
3. Propuesta comercial clara con las 3 opciones.

## Canal 4 — Fabricantes e integraciones (noviembre–diciembre 2026)

**Objetivo:** Que los fabricantes de marca (Schneider Electric, Roca, Baxi, etc.) quieran que sus productos aparezcan en los presupuestos de TrabFlow.

**Modelo:** El fabricante paga por visibilidad en el catálogo. Similar a Amazon Ads pero para instaladores.

**Este canal es post-PMF si no hay recursos para activarlo antes.**

## Canal 5 — Inversión (diciembre 2026)

**Business Angels especializados en B2B SaaS o sector construcción/instalaciones.**

**ENISA** — Préstamo participativo para startups (financiado por el Estado). Hasta 300K€ a bajo interés. Requiere empresa constituida, plan de negocio, y primeros ingresos.

**Ronda Seed** — 300K–500K€ objetivo. Valoración pre-money estimada: 1.5–2M€ con 20 clientes de pago y acuerdo con al menos una asociación.

**Documentos necesarios para inversores:**
- Pitch deck (12 slides)
- One-pager ejecutivo
- Modelo financiero (proyección 3 años)
- Carta de intenciones de la asociación más importante
- 3 testimonios de clientes reales con métricas de ahorro

---

---

# 7. SISTEMA DE ARQUITECTURA TÉCNICA

## Principio absoluto

> La arquitectura sirve al producto. El producto sirve al cliente. El cliente paga la empresa. La empresa financia la arquitectura.
>
> En ese orden. Nunca al revés.

## Clasificación técnica (resumen)

| Clase | Significado | Ejemplo |
|-------|-------------|---------|
| A | Correcto — no tocar | RLS en Supabase, autenticación |
| B | Corregir antes de beta septiembre | Code splitting, Error Boundary |
| C | Post-PMF | React Router, división de supabase.ts |
| D | No tocar mientras se valida mercado | Cambiar el stack, microservicios |
| E | No aporta valor al cliente — cancelar | Renombrar carpetas, refactors estéticos |

## Stack técnico — permanente durante fase A (hasta PMF)

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage + RLS)
- **Edge Functions:** Deno (Supabase Edge Functions)
- **IA:** Google Generative AI (Gemini) + Voyage AI (embeddings)
- **Pagos:** Stripe
- **Deploy:** Vercel (frontend) + Supabase Cloud (backend)
- **PWA:** Service Worker + Web Push

**Regla:** No se cambia ninguna tecnología del stack durante la fase A. Cero debate sobre esto.

## Lo que nunca se hace durante validación de mercado

- Reescribir arquitectura
- Cambiar tecnologías
- Microservicios
- Refactor masivo
- Tests completos (excepto flujos críticos de pago)
- Documentación técnica extensa
- CI/CD completo (suficiente con `tsc --noEmit` local)

## El presupuesto técnico de la semana

Cada semana, el 80% del tiempo técnico va a producto (lo que el cliente ve). El 20% va a deuda técnica (lo que el cliente no ve pero que evita que el producto explote).

Si hay un bug crítico reportado por un beta tester, se para todo lo demás.

---

---

# 8. EL CALENDARIO ESTRATÉGICO

## FASE A — Julio–Diciembre 2026: Conseguir el PMF

**Objetivo:** 20 instaladores de pago. Primera asociación firmada. Primeros datos reales.

```
Julio 2026
├── Técnico: B1, B2, B9 (críticos), onboarding mejorado
├── Producto: Vídeo demo 90s, actualizar landing
└── Empresa: Seleccionar los 20 beta testers, pitch deck

Agosto 2026
├── Técnico: B5, B8, QA manual
├── Comercial: Dossier CONAIF/FENIE, dossier distribuidores, FAQs
└── Empresa: Vídeo demo 3-4 minutos, one-pager inversores

Septiembre 2026
├── Beta cerrada: 20 instaladores, 20 entrevistas
└── Objetivo: 20 aprendizajes documentados

Octubre 2026
├── Reuniones: CONAIF, FENIE, APIEM
├── Pilotos con 2-3 distribuidores
└── Incorporar feedback de la beta en el producto

Noviembre 2026
├── Reuniones: Obramat, Saltoki, Sonepar
├── Primera integración de catálogo
└── Inicio conversaciones con fabricantes

Diciembre 2026
├── Reuniones: Business Angels
├── Solicitud ENISA
├── Cierre de ronda Seed 300-500K€
└── Balance: ¿Tenemos PMF?
```

## DEFINICIÓN DE PMF PARA TRABFLOW

**TrabFlow tiene PMF cuando:**
1. 100 instaladores de pago activos (usan la app al menos 3 veces por semana).
2. El 40% de los usuarios dicen que estarían "muy decepcionados" si TrabFlow desapareciera (escala de Sean Ellis).
3. El churn mensual es < 5%.
4. Al menos un acuerdo firmado con una asociación del sector.

**Sin esto, no hay PMF. Con esto, se pasa a Fase B.**

## FASE B — 2027: Sprint Arquitectura + Escalado

**Prerequisito:** Tener PMF (100 clientes, 25K MRR, primera ronda).

**Duración:** 3 meses.

**Solo arquitectura.** Nada de nuevas funcionalidades.

```
Mes 1: Fundamentos
├── Testing de integración (flujos críticos)
├── CI/CD completo (GitHub Actions)
└── Sentry + observabilidad básica

Mes 2: Deuda técnica
├── React Router v7
├── Tipos generados Supabase
└── División de supabase.ts en servicios

Mes 3: Arquitectura de features
├── División de AppDashboardView.tsx
├── Feature Folders
└── Internacionalización (si hay señales de Portugal/LATAM)
```

## FASE C — 2027-2028: Escalado Real

**Prerequisito:** Ronda Seed cerrada. Equipo de 3-5 personas.

```
├── Feature Folders completados
├── Arquitectura por dominios
├── Librerías internas (design system)
├── CI/CD completo con preview deployments
├── Testing extensivo
├── Observabilidad y métricas avanzadas
└── Internacionalización completa
```

## FASE D — 2028+: Internacionalización

**Prerequisito:** 500 clientes. Serie A.

```
├── Portugal (euro, IVA 23%)
├── LATAM — México primero (MXN, IVA 16%)
├── Multimoneda real
├── Multiempresa
├── Versionado normativo por país
└── IA adaptada a cada región
```

---

---

# 9. PRIORIZACIÓN SEMANAL — EL PROTOCOLO DEL LUNES

## La regla de los 3 trabajos

Cada semana tiene exactamente 3 trabajos. No 10. No 5. Exactamente 3.

Si hay más de 3 trabajos urgentes, elegir los 3 que más acercan a:
1. Un cliente pagando dinero, o
2. Una reunión clave que avanza el negocio, o
3. Un bug que puede perder un cliente existente.

## El formato del lunes (30 minutos)

```
SEMANA X — [Fecha]

ESTADO DEL DASHBOARD (5 min)
├── ¿Qué avanzó la semana pasada?
└── ¿Qué está en rojo?

LOS 3 TRABAJOS DE ESTA SEMANA (10 min)
├── Trabajo 1: [qué, para quién, en cuánto tiempo]
├── Trabajo 2: [qué, para quién, en cuánto tiempo]
└── Trabajo 3: [qué, para quién, en cuánto tiempo]

UN APRENDIZAJE DE LA SEMANA PASADA (5 min)
└── [Una frase. ¿Qué funcionó o qué no funcionó?]

PROTEGER EL CALENDARIO (10 min)
└── ¿Hay algo que pueda retrasar una reunión o entrega clave?
    Si sí → ¿cómo mitigarlo?
```

## Cómo escribir un trabajo bien

**Mal:** "Mejorar el onboarding"
**Bien:** "Reducir el wizard de registro de 7 pasos a 3, para que el instalador llegue al dashboard en < 60 segundos"

**Mal:** "Arreglar bugs"
**Bien:** "Corregir el bug de pantalla en blanco al hacer logout desde iOS Safari (reportado por 2 beta testers)"

**Mal:** "Trabajar en la landing"
**Bien:** "Añadir el vídeo de 90 segundos en el hero de la landing y publicarlo antes del jueves"

## El test de viernes

El viernes por la tarde, antes de cerrar:

1. ¿Están los 3 trabajos completados? Si no, ¿por qué?
2. ¿Hay algún beta tester esperando respuesta a un bug? Si sí → resolver antes de cerrar.
3. ¿Hay alguna reunión la semana que viene que requiera preparación? Si sí → dedicar tiempo el lunes.

---

---

# 10. KPIs DE LA EMPRESA

## Fase A (ahora) — Los únicos 5 KPIs que importan

### KPI 1: Instaladores activos en beta
**Definición:** Instaladores que han usado la app al menos 3 veces en los últimos 7 días.
**Objetivo septiembre 2026:** 20.
**Cómo medirlo:** Supabase Analytics o query directa a `trade_quotes.created_at` por usuario.

### KPI 2: Presupuestos creados por instalador/semana
**Definición:** Media de presupuestos creados por usuario activo en los últimos 7 días.
**Objetivo:** > 3 presupuestos/semana/usuario.
**Por qué importa:** Si un instalador crea menos de 3, no lo está usando para trabajar. Está "probando".

### KPI 3: Tasa de conversión del presupuesto a factura
**Definición:** % de presupuestos en estado "Aceptado" que generan una factura.
**Objetivo:** > 70%.
**Por qué importa:** Si el instalador no convierte a factura, el flujo está roto o el cliente no paga.

### KPI 4: Churn mensual
**Definición:** % de usuarios de pago que cancelan en un mes.
**Objetivo:** < 5% mensual.
**Por qué importa:** Con 5% de churn, se pierde la mitad de los clientes en un año. Con 2%, se conserva el 78%.

### KPI 5: NPS (Net Promoter Score)
**Definición:** "¿Recomendarías TrabFlow a otro instalador? (0-10)"
**Objetivo:** > 40.
**Cómo medirlo:** Email o WhatsApp mensual a los beta testers. Fórmula: % promotores (9-10) − % detractores (0-6).

## Fase B (post-PMF) — KPIs adicionales

- MRR (Monthly Recurring Revenue)
- ARR (Annual Recurring Revenue)
- LTV (Lifetime Value por cliente)
- CAC (Coste de adquisición por canal)
- Payback period (meses para recuperar el CAC)
- Expansion revenue (upgrades de plan)

---

---

# 11. DASHBOARD CEO

*Una página. Una vez por semana. El lunes.*

## Formato del dashboard semanal

```
╔═══════════════════════════════════════════════════════════╗
║  TRABFLOW — CEO DASHBOARD — [SEMANA / FECHA]             ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  PRODUCTO                                                 ║
║  ├─ Beta lista para lanzar    [██████████] X%             ║
║  ├─ Onboarding < 60s          [████░░░░░░] X%             ║
║  └─ Bugs críticos abiertos    [número]                    ║
║                                                           ║
║  EMPRESA / COMERCIAL                                      ║
║  ├─ Pitch deck completo       [██████████] X%             ║
║  ├─ Vídeo demo listo          [░░░░░░░░░░] X%             ║
║  ├─ Dossier CONAIF listo      [░░░░░░░░░░] X%             ║
║  └─ Dossier distribuidores    [░░░░░░░░░░] X%             ║
║                                                           ║
║  BETA                                                     ║
║  ├─ Beta testers selec.       X / 20                      ║
║  ├─ Beta testers activos      X / 20                      ║
║  ├─ Entrevistas realizadas    X / 20                      ║
║  └─ Aprendizajes doc.         X / 20                      ║
║                                                           ║
║  ASOCIACIONES                                             ║
║  ├─ CONAIF                    [estado: pendiente/contacto/reunión/firmado] ║
║  ├─ FENIE                     [estado]                    ║
║  └─ APIEM                     [estado]                    ║
║                                                           ║
║  DISTRIBUIDORES                                           ║
║  ├─ Obramat                   [estado]                    ║
║  ├─ Saltoki                   [estado]                    ║
║  └─ Sonepar                   [estado]                    ║
║                                                           ║
║  INVERSIÓN                                                ║
║  ├─ Business Angels           [estado]                    ║
║  ├─ ENISA                     [estado]                    ║
║  └─ Ronda Seed                [estado]                    ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║  KPIs ESTA SEMANA                                         ║
║  ├─ Instaladores activos:     X                           ║
║  ├─ Presupuestos creados:     X                           ║
║  ├─ Conversion ppto→factura:  X%                          ║
║  ├─ MRR:                      X€                          ║
║  └─ NPS:                      X                           ║
║                                                           ║
║  LOS 3 TRABAJOS DE ESTA SEMANA                            ║
║  ├─ [1] ___________________________________               ║
║  ├─ [2] ___________________________________               ║
║  └─ [3] ___________________________________               ║
╚═══════════════════════════════════════════════════════════╝
```

## Reglas del dashboard

1. **Solo una pantalla.** Si no cabe en una pantalla, hay demasiada información.
2. **Sin decimales.** Los decimales en los porcentajes sugieren precisión falsa. Redondear siempre.
3. **El rojo llama la atención.** Si hay algo en rojo, es lo primero que se hace esa semana.
4. **Actualizar el lunes, revisar el viernes.**
5. **Los estados de asociaciones/distribuidores/inversores tienen solo 4 valores:**
   - `contacto pendiente` → `contactado` → `reunión agendada` → `firmado`

---

---

# 12. REGLAS PARA LEVANTAR INVERSIÓN

## Cuándo buscar inversión

**No antes de tener:**
- 20 instaladores de pago con al menos 2 meses de historial.
- NPS > 40.
- Un acuerdo firmado (o muy avanzado) con al menos una asociación o distribuidor.
- Un modelo financiero creíble que justifique el uso de los fondos.

**La razón:** Un inversor que entra antes de tener tracción controla demasiado. Un inversor que entra con tracción invierte a tu valoración.

## Cuánto pedir y a qué valoración

**Objetivo Seed:** 300.000–500.000€.

**Valoración pre-money objetivo:** 1.5–2M€.

**Esto implica:** Dar entre el 15% y el 25% de la empresa.

**Regla de oro:** No dar más del 20% en la primera ronda. Si se da más, las rondas futuras diluyen demasiado al fundador.

## Qué se hace con el dinero

**Uso de fondos (300K€):**

| Uso | Importe | Justificación |
|-----|---------|---------------|
| Salario fundador (12 meses) | 50.000€ | Sostenibilidad |
| Primer empleado técnico | 40.000€ | Escalar el producto |
| Marketing y ventas | 80.000€ | Adquisición de clientes |
| Infraestructura (Supabase, Vercel, AI) | 30.000€ | Escalar la plataforma |
| Legal y compliance | 20.000€ | ENISA, contratos, IP |
| Fondo de operaciones | 80.000€ | Colchón 18 meses |
| **Total** | **300.000€** | |

## Qué NO hacer al levantar inversión

- No aceptar dinero de alguien que no entiende el sector de instalaciones.
- No aceptar condiciones de liquidación preferente > 1x sin participación.
- No dar un asiento en el board sin tener al menos 2 años de runway.
- No hablar con inversores antes de tener los primeros 10 clientes de pago.
- No firmar un term sheet sin que lo revise un abogado especializado en startups.

## Cómo presentar TrabFlow a un inversor

**Los 12 slides del pitch deck:**

1. **El problema** — El instalador español pierde 5 horas por semana en papeleo
2. **La solución** — Demo en vivo del presupuesto por voz (30 segundos)
3. **El mercado** — 1.2M instaladores en España, 15B€ en Europa
4. **El producto** — Screenshots de los módulos clave
5. **La tecnología** — IA diferenciadora (voz, foto, RAG normativa)
6. **El modelo de negocio** — SaaS 29-99€/mes por empresa
7. **Tracción** — Beta testers, NPS, presupuestos creados, asociaciones
8. **Estrategia comercial** — Canal asociaciones + canal distribuidores
9. **Competencia** — Por qué TrabFlow gana (nadie tiene IA para instaladores en España)
10. **El equipo** — El fundador y la visión
11. **Financials** — Proyección 3 años, camino a la rentabilidad
12. **El ask** — 300-500K€ a X valoración, uso de fondos

## ENISA — Cómo solicitarlo

**ENISA** (Empresa Nacional de Innovación) ofrece préstamos participativos para startups de 25.000€ a 1.5M€ a tipos favorables (Euribor + 3-5%).

**Requisitos:**
- Empresa constituida en España (ya existe Trabflow Technologies SL).
- Menos de 6 años de antigüedad.
- Plan de negocio documentado.
- Al menos un inversor privado co-invirtiendo (ENISA no es el único inversor).
- No tener pérdidas acumuladas > fondos propios.

**Plazo de resolución:** 3-6 meses desde la solicitud.

**Cuándo solicitarlo:** Noviembre-diciembre 2026, con los primeros inversores privados ya comprometidos.

---

---

# 13. PROTOCOLO DE CRISIS

## Definición de crisis

Una crisis es cualquier evento que puede hacer perder clientes, dañar la reputación, o bloquear el negocio en las próximas 48 horas.

## Tipos de crisis y respuesta

### Tipo 1: Bug crítico en producción

**Definición:** La app no funciona para el 20%+ de los usuarios o un flujo de pago está caído.

**Respuesta (T+0 a T+4 horas):**
1. Comunicar inmediatamente a los beta testers afectados (WhatsApp directo).
2. Identificar y revertir el último deploy si es posible.
3. Si no es reversible, aislar el módulo afectado.
4. No publicar en redes hasta tener solución.
5. Publicar postmortem en el grupo de beta cuando esté resuelto.

**Regla:** Un cliente que ve que el fundador responde en < 2 horas confía más, no menos.

### Tipo 2: Filtración de datos

**Definición:** Datos de clientes expuestos o accedidos sin autorización.

**Respuesta (T+0 a T+24 horas):**
1. Identificar el alcance de la filtración.
2. Revocar todos los tokens de acceso afectados.
3. Notificar a los usuarios afectados directamente (obligación legal RGPD).
4. Notificar a la AEPD si afecta a > 72 horas sin notificación.
5. Contactar a un abogado especializado en protección de datos.

**Regla:** La transparencia inmediata reduce el daño legal y reputacional.

### Tipo 3: Competidor lanza algo similar

**Definición:** Un competidor directo lanza una feature que TrabFlow no tiene.

**Respuesta:**
1. Analizar con calma. ¿Es lo mismo o parece lo mismo?
2. Preguntar a los beta testers si les importa.
3. Si les importa → añadir a la lista de evaluación de features.
4. Si no les importa → ignorar y seguir el plan.

**Regla:** La mayoría de los "competidores" que lanzan features similares no tienen la misma profundidad. Ejecutar el plan es mejor que reaccionar al ruido.

### Tipo 4: Un beta tester clave cancela

**Definición:** Uno de los 20 beta testers abandona TrabFlow.

**Respuesta (T+0 a T+48 horas):**
1. Llamar (no email, no WhatsApp) para entender el motivo real.
2. Documentar el motivo en los aprendizajes de beta.
3. Si es un bug → arreglar en < 24 horas.
4. Si es precio → analizar si el precio es el problema o solo la excusa.
5. Si es funcionalidad faltante → evaluar si es una señal de mercado.

**Regla:** Un usuario que cancela y explica por qué vale más que diez que siguen sin comprometerse.

---

---

# 14. GLOSARIO TRABFLOW

**Beta cerrada:** Fase con 20 instaladores seleccionados. Sin registro público. Objetivo: aprender, no crecer.

**PMF (Product-Market Fit):** El punto en que el mercado "jala" el producto. Definido para TrabFlow como: 100 clientes de pago, NPS > 40, churn < 5%, 1 acuerdo con asociación.

**El momento wow:** El instante en que un instalador ve por primera vez el presupuesto generado por voz. Es el momento que hay que capturar en el vídeo de pitch.

**Clase B:** Mejora técnica que debe hacerse antes de beta. No es opcional.

**Clase E:** Cambio que no aporta valor al cliente. Se cancela automáticamente.

**Oficio:** El tipo de instalación (fontanería, electricidad, climatización, reformas, etc.).

**Org:** Una organización en TrabFlow. Corresponde a una empresa de instalación.

**Worker:** Un técnico de campo asociado a una organización. Ve solo sus trabajos.

**Base Maestra:** La base de datos de actuaciones (trabajos tipo) por oficio. Es el cerebro que alimenta los presupuestos por voz y foto.

**RAG (Retrieval-Augmented Generation):** El sistema que permite al Asistente Técnico buscar en la normativa real (REBT, RITE, CTE) antes de responder.

**Trial:** Período de prueba de 3 meses incluido en el registro. Sin necesidad de tarjeta de crédito.

**Distribuidores:** Las empresas de distribución de material (Obramat, Saltoki, Sonepar). Son un canal de ventas indirecto y potencial fuente de revenue por catálogo.

**Asociaciones:** CONAIF, FENIE, APIEM. Son multiplicadores de distribución: un acuerdo con una asociación puede significar acceso a miles de instaladores.

**ENISA:** Empresa Nacional de Innovación. Financia startups con préstamos participativos a bajo interés.

**Ronda Seed:** Primera ronda formal de inversión externa. Objetivo: 300-500K€.

---

---

# APÉNDICE — REGLAS NO NEGOCIABLES

*Estas reglas se siguen aunque alguien externo diga que son incorrectas.*

1. **El instalador primero.** Siempre. Sin excepción.
2. **El calendario comercial manda sobre la arquitectura técnica.**
3. **Clase E no se hace.** Nunca. Aunque parezca lógico.
4. **No más de 3 trabajos por semana.** Si se hacen más, hay un problema de priorización.
5. **Los beta testers son el equipo de producto.** Sus palabras literales son la spec.
6. **No hablar con inversores sin tracción.**
7. **No dar más del 20% en la primera ronda.**
8. **Un bug crítico para un beta tester es prioridad absoluta en las próximas 24 horas.**
9. **La demo siempre es en vivo.** Nunca en grabación en reuniones presenciales.
10. **El stack técnico no cambia durante la fase A. Cero debate.**

---

*TrabFlow Operating System — Versión 1.0*
*Redactado: 25 de junio de 2026*
*Próxima revisión: cuando se alcance el PMF (100 clientes, 25K MRR, primera ronda)*
*Propietario: Fernando — Founder & CEO, TrabFlow Technologies SL*
