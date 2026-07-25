# TrabFlow — Business Model

**Versión:** 1.0 — Julio 2026  
**Estado:** Normativo. Los números marcados como "PENDIENTE DE VALIDACIÓN" son hipótesis, no datos confirmados.  
**Propósito:** Definir cómo TrabFlow genera ingresos, por qué esos modelos son coherentes con la misión, y cómo evoluciona el modelo entre 2026 y 2030.

---

## Contexto

TrabFlow opera en un mercado donde el cliente principal (el instalador autónomo) tiene alta sensibilidad al precio y baja propensión a pagar por software que no entiende o no usa. El modelo de negocio debe ser:
1. **Simple de entender:** El instalador tiene que poder responder "¿cuánto me cuesta?" en 10 segundos.
2. **Fácil de justificar:** El coste debe ser visiblemente menor que el valor entregado.
3. **Escalable sin crecer el equipo proporcionalmente:** No depender de ventas manuales para crecer.

---

## Flujo de ingresos — Visión general 2026–2030

```
2026 ─── Suscripciones instaladores (único ingreso real)
2027 ─── Suscripciones + comisiones del Marketplace (GMV inicial)
         + fee de distribuidores integrados
2028 ─── Suscripciones + comisiones + partnerships de fabricantes
2029 ─── Todos los anteriores + API pública + suscripción básica para proveedores
2030 ─── Plataforma completa con múltiples flujos equilibrados
```

---

## Ingreso 1 — Suscripciones de instaladores

### Estado actual

Existe y está en producción. Stripe Checkout, Stripe Portal, webhooks, trial de 3 meses.

### Planes actuales

| Plan | Posicionamiento | Precio objetivo | Estado |
|---|---|---|---|
| Básico | Autónomo con necesidades básicas | PENDIENTE DE VALIDACIÓN | Implementado |
| Pro | Autónomo con normativa técnica avanzada | PENDIENTE DE VALIDACIÓN | Implementado |
| Profesional | Empresa pequeña (3–5 personas) | PENDIENTE DE VALIDACIÓN | Implementado |
| Empresa | Empresa mediana (5–15 personas) | PENDIENTE DE VALIDACIÓN | Implementado |
| Empresa Plus | Empresa grande con subcontratas y mayoristas | PENDIENTE DE VALIDACIÓN | Implementado |

**Nota:** El rango hipotético mencionado en documentación anterior es 29–49€/mes. No hay dato de conversión real. El precio final debe validarse con los primeros 50 usuarios que lleguen al final del trial.

### Qué desbloquea cada plan

La lógica actual de planes desbloquea módulos progresivamente:
- **Básico:** ERP core + motor IA + asistente técnico (REBT básico)
- **Pro:** + normativa RITE + features adicionales de presupuesto
- **Profesional:** + equipo, planificación, partes, mantenimiento SAT
- **Empresa:** + asistente técnico extendido (AEAT, SS, DGT) + contratos avanzados
- **Empresa Plus:** + subcontratas + mayoristas + todo el asistente técnico

### Ventajas de este modelo

- **Previsible:** Ingreso recurrente mensual o anual. Permite planificación.
- **Escalable:** Sin coste variable por usuario (infraestructura ya amortizada).
- **Alineado con el valor:** El instalador paga más cuando usa más módulos.

### Desventajas y riesgos

- **Churn en el mes 4 (fin de trial):** El instalador que no ha hecho su primer presupuesto en el trial no va a pagar. La activación rápida es crítica.
- **Resistencia al SaaS:** Muchos instaladores prefieren pagar una vez que una cuota mensual. Puede mitigarse con opción anual con descuento.
- **Competencia de precio con apps simples:** Hay apps de presupuestos gratuitas. TrabFlow compite con valor (IA, Marketplace, normativa), no con precio.

### Modelo de precio anual

Ofrecer descuento del 20% en pago anual reduce el churn y mejora el flujo de caja. Implementación: añadir precio anual en Stripe junto al mensual. **PENDIENTE DE IMPLEMENTAR.**

---

## Ingreso 2 — Comisiones del Marketplace

### Estado actual

La infraestructura técnica del Marketplace está implementada (actores, pedidos, portal proveedor). El modelo de comisión **no está implementado** — los pedidos actuales no tienen comisión. El Stripe Connect necesario para el split de pagos no existe todavía.

### Cómo funciona

Cuando un instalador hace un pedido a través de TrabFlow Marketplace, TrabFlow retiene un porcentaje del valor del pedido como comisión. El proveedor recibe el resto.

**Modelo propuesto (hipótesis — PENDIENTE DE VALIDACIÓN):**

| Opción | Descripción | Pros | Contras |
|---|---|---|---|
| A — Comisión porcentual | 2–3% del valor del pedido | Escalable, alineado con el volumen | Difícil de justificar a distribuidores grandes |
| B — Fee mensual del proveedor | El proveedor paga X€/mes por aparecer en el catálogo | Predecible, no depende del GMV | El proveedor paga aunque no haya pedidos |
| C — Fee del instalador por pedido | El instalador paga X€ por cada pedido procesado | Simple, no depende del proveedor | Puede desincentivar el uso del Marketplace |
| D — El distribuidor patrocina instaladores | El distribuidor paga el SaaS del instalador | Elimina fricción de pago para el instalador | Dependencia de un solo actor, riesgo de fidelidad |

**Recomendación actual:** Validar con el primer piloto qué modelo acepta el proveedor. Probablemente una combinación de A y B: fee mensual pequeño para activación + comisión sobre pedidos reales.

### Por qué este modelo es valioso

- **El GMV crece con la red de instaladores:** Más instaladores = más pedidos = más comisiones.
- **No tiene coste marginal de producción:** TrabFlow no compra ni vende material. Solo facilita la transacción.
- **Efecto de red natural:** Cada nuevo proveedor hace TrabFlow más valioso para los instaladores. Cada nuevo instalador hace TrabFlow más valioso para los proveedores.

### Proyecciones de GMV (hipóteticas — PENDIENTE DE VALIDACIÓN)

| Período | Instaladores activos | Pedidos/mes/instalador | Pedido medio | GMV mensual | Comisión (2.5%) |
|---|---|---|---|---|---|
| 2027 | 100 | 2 | 300€ | 60.000€ | 1.500€ |
| 2028 | 500 | 3 | 350€ | 525.000€ | 13.125€ |
| 2030 | 5.000 | 4 | 400€ | 8.000.000€ | 200.000€ |

**Importante:** Estas cifras son escenarios ilustrativos, no proyecciones validadas. Los supuestos (pedidos por instalador, pedido medio) deben validarse en el piloto.

### Implementación técnica pendiente

- Stripe Connect (cuentas conectadas para proveedores)
- `trade_marketplace_commissions` (tabla de registro de comisiones)
- Lógica de split de pago en `trade-stripe-checkout`
- Dashboard de liquidaciones para proveedores

---

## Ingreso 3 — Fee de integración de distribuidores

### Estado actual

No existe. Es una hipótesis de ingreso a validar con el primer piloto.

### Cómo funciona

Los distribuidores grandes (OBRAMAT, SALTOKI, SONEPAR) tienen incentivos para estar en TrabFlow porque sus instaladores clientes ya usan la plataforma. TrabFlow puede cobrar un fee de integración o un fee mensual de mantenimiento por su presencia en el catálogo.

**Opciones:**

| Opción | Descripción | Aplicable |
|---|---|---|
| Fee de alta | Pago único por integración del catálogo | Distributores que quieren estar desde el inicio |
| Fee mensual de presencia | X€/mes por aparecer en el catálogo activo | Todos los distribuidores integrados |
| Fee de visibilidad premium | X€/mes por aparecer primero en recomendaciones | Solo si el volumen justifica la distinción |

**Precaución:** El orden de recomendación en el catálogo no puede venderse si deteriora la experiencia del instalador. La visibilidad premium debe ser adicional, nunca sustituyendo al mejor resultado para el instalador.

### Cuándo implementar

Solo cuando haya suficiente volumen de instaladores activos para que el distribuidor perciba valor. Con 100 instaladores, el argumento es débil. Con 1.000, empieza a ser significativo.

---

## Ingreso 4 — Visibilidad de fabricantes

### Estado actual

No existe. Identificado como canal 4 en la estrategia comercial. Prioridad post-PMF.

### Cómo funciona

Los fabricantes de material (Schneider Electric, Roca, Baxi, Panasonic) quieren que sus productos aparezcan cuando un instalador genera un presupuesto. TrabFlow puede ofrecer visibilidad en forma de:
- Sus referencias aparecen primero en las búsquedas del catálogo
- Su logo aparece junto a la referencia cuando se recomienda
- Datos de cuántos instaladores han recomendado sus productos (inteligencia de mercado)

**Modelo:** Fee mensual o anual. No CPC (coste por clic) — demasiada complejidad operativa.

**Importante:** Este modelo solo funciona si hay volumen real de instaladores y pedidos. Es un ingreso de escala (2028+), no de arranque.

---

## Ingreso 5 — API pública (2027+)

### Estado actual

No existe. Planificado para 2027.

### Cómo funciona

Proveedores con ERP propio (SAP, Sage 200) o empresas de instalación con sistemas propios pueden querer integrarse con TrabFlow via API. El acceso a la API puede tener un precio diferenciado del plan de suscripción estándar.

**Modelos posibles:**
- Incluido en plan Empresa Plus (sin coste adicional)
- Fee adicional por encima del plan (para proveedores que no son instaladores)
- Modelo basado en llamadas a la API (por volumen de transacciones)

---

## Ingreso 6 — Suscripción para proveedores (2028+)

### Estado actual

No existe. El portal del proveedor es actualmente gratuito como herramienta de captación.

### Cuándo cobrar al proveedor

Solo cuando el valor entregado sea suficiente: el proveedor gestiona pedidos regularmente, el volumen justifica el pago, y existe competencia de otros proveedores que quieren el mismo espacio. Con el primer piloto, el portal del proveedor debe ser gratuito. Es la forma de que el proveedor adopte la plataforma sin fricción.

---

## Ventajas e inconvenientes del modelo completo

### Ventajas

**1. Múltiples flujos de ingreso, no dependencia de uno solo**  
Si la comisión del Marketplace no despega tan rápido como se espera, las suscripciones de instaladores sostienen la empresa. Si los instaladores tardan en pagar, el fee de distribuidores puede financiar el crecimiento.

**2. Efectos de red que se refuerzan mutuamente**  
Más instaladores → más pedidos → más valor para distribuidores → más distribuidores → más opciones para instaladores → más instaladores. El círculo virtuoso se construye desde el Marketplace.

**3. El coste marginal es casi cero**  
Cada nuevo instalador o proveedor que se une no requiere infraestructura proporcional. El coste de servir al usuario 1.000 es casi el mismo que servir al usuario 100.

**4. Datos que mejoran el producto**  
Cada presupuesto generado mejora el motor IA. Cada pedido de material mejora las recomendaciones de proveedor. Cada valoración mejora el health score. Los datos son una ventaja competitiva que crece con el uso.

### Inconvenientes y riesgos

**1. Bootstrapping difícil sin ingresos del Marketplace**  
Las suscripciones de instaladores a 29–49€/mes generan poco ingreso por cliente. Llegar a sostenibilidad financiera con solo suscripciones requiere ~200–400 clientes de pago. **PENDIENTE DE VALIDACIÓN.**

**2. El Marketplace requiere masa crítica**  
Un Marketplace con 10 instaladores no es atractivo para un distribuidor. Necesita masa crítica en instaladores antes de poder monetizar el lado del proveedor.

**3. Stripe Connect añade complejidad legal y fiscal**  
Gestionar el split de pagos implica responsabilidades fiscales adicionales. Puede requerir registro como intermediario de pagos en algunos países.

**4. Los distribuidores grandes son lentos**  
Un acuerdo con OBRAMAT puede tardar 6–12 meses desde el primer contacto hasta el primer pedido real. El modelo de comisión no genera ingresos hasta que ese acuerdo existe y produce pedidos.

---

## Evolución del modelo de negocio 2026–2030

| Año | Ingreso principal | Ingreso secundario | Objetivo MRR |
|---|---|---|---|
| 2026 | Suscripciones instaladores | — | PENDIENTE DE VALIDACIÓN |
| 2027 | Suscripciones instaladores | Comisiones Marketplace (piloto) | PENDIENTE DE VALIDACIÓN |
| 2028 | Suscripciones + Comisiones | Fee distribuidores + Fabricantes | PENDIENTE DE VALIDACIÓN |
| 2029 | Equilibrado entre las 4 fuentes | API pública | PENDIENTE DE VALIDACIÓN |
| 2030 | Comisiones Marketplace dominantes | Suscripciones como base estable | ≥ 250.000€/mes (hipótesis) |

---

## Modelo financiero simplificado (hipótesis — PENDIENTE DE VALIDACIÓN)

Las cifras siguientes son escenarios ilustrativos. No deben usarse en presentaciones a inversores sin datos reales que las soporten.

### Escenario conservador 2027

- 200 instaladores pagando: 200 × 35€ = 7.000€ MRR
- Comisiones Marketplace (piloto): 2.000€/mes
- **Total MRR conservador 2027:** ~9.000€

### Escenario base 2027

- 500 instaladores pagando: 500 × 38€ = 19.000€ MRR
- Comisiones Marketplace: 8.000€/mes
- 2 distribuidores integrados con fee: 2.000€/mes
- **Total MRR base 2027:** ~29.000€

### Escenario optimista 2027

- 1.000 instaladores pagando: 1.000 × 40€ = 40.000€ MRR
- Comisiones Marketplace: 20.000€/mes
- 5 distribuidores integrados: 5.000€/mes
- **Total MRR optimista 2027:** ~65.000€

**Nota:** El escenario base requiere tracción significativa que aún no está demostrada. Antes de proyectar, obtener datos reales de precio de conversión, retención a 6 meses, y pedidos por instalador en el Marketplace.

---

## Cuándo buscar financiación externa

La financiación externa (Business Angels, ENISA, Seed) se busca cuando:

1. **Hay datos reales de retención:** Al menos 50 clientes con 3+ meses de historial pagando.
2. **Hay un canal de captación que funciona:** Coste de adquisición conocido y LTV que lo justifica.
3. **Hay un acuerdo firmado con una asociación o distribuidor:** Demuestra que el modelo B2B funciona.
4. **Se conoce el uso del dinero:** La financiación acelera algo que ya funciona, no financia la búsqueda de un modelo que aún no existe.

**La trampa:** Buscar financiación antes de tener estos datos convierte la empresa en dependiente del inversor para sobrevivir. La financiación debe ser gasolina, no el motor.

---

## PENDIENTE DE VALIDACIÓN — Lista completa

Los siguientes datos son críticos y deben obtenerse en los próximos 3–6 meses:

- [ ] Precio de conversión de trial a pago (% de usuarios que pagan al mes 4)
- [ ] Retención a 3 meses (% de usuarios que siguen pagando)
- [ ] Retención a 12 meses (% de usuarios que siguen pagando)
- [ ] Precio medio de la suscripción (qué plan elige el mercado)
- [ ] Número medio de presupuestos por instalador y mes
- [ ] Número medio de pedidos de Marketplace por instalador y mes
- [ ] Valor medio de un pedido de Marketplace
- [ ] Tiempo desde registro hasta primer presupuesto creado (activación)
- [ ] Principales razones por las que los usuarios no convierten a pago
- [ ] Coste de adquisición de cliente (CAC) por canal
