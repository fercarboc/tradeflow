# TrabFlow — Competitive Moat

**Versión:** 1.0 — Julio 2026  
**Estado:** Normativo. Análisis honesto de ventajas competitivas. No es una presentación de ventas.  
**Propósito:** Entender qué hace que TrabFlow sea difícil de replicar y cómo fortalecer esas barreras.

---

## El mercado actual

El instalador técnico español tiene acceso a varias categorías de software:

| Categoría | Ejemplos | Para quién están realmente hechos |
|---|---|---|
| ERP generalistas | Holded, Sage 50, Contaplus | Contables y asesores |
| Software de gestión de instalaciones | STEL Order, ProManager, Gestion.pro | Empresa mediana de instalaciones |
| Apps de presupuestos simples | Varios en iOS/Android | Usuario muy básico, sin ERP |
| Marketplaces B2B genéricos | Amazon Business, Manomano Pro | Cualquier empresa, no especializado |
| Apps de normativa técnica | Boletines oficiales, PDFs | Técnicos con formación avanzada |

Ninguno de estos productos combina los tres elementos que TrabFlow une: flujo de trabajo del instalador, IA integrada desde el núcleo, y conexión directa con la cadena de suministro del sector.

---

## Análisis de competidores directos

### Holded

**Quién es:** ERP SaaS español para pymes. Facturación, contabilidad, RRHH, CRM. 60.000+ empresas.

**Fortaleza:** Marca consolidada, producto maduro, integraciones contables.

**Por qué no es el mismo mercado:**
- Holded está diseñado para que lo use el contable, no el instalador.
- No tiene IA generativa de presupuestos.
- No tiene gestión de campo ni partes de trabajo.
- No tiene Marketplace de material.
- El instalador que intenta usar Holded en obra lo abandona en 2 semanas.

**Riesgo real:** Holded podría añadir un módulo para instalaciones técnicas. Pero es un ERP generalista con 200+ integraciones — añadir profundidad sectorial sin sacrificar la generalidad es difícil. Su incentivo es horizontal, no vertical.

**Probabilidad de que replique TrabFlow en 2 años:** Baja. El coste de oportunidad de focalizarse en un sector concreto es demasiado alto para Holded.

---

### STEL Order

**Quién es:** Software de gestión para pymes de servicios técnicos. Instalaciones, mantenimiento, SAT. Fundada en Murcia, 2016.

**Fortaleza:** Profundidad en gestión de mantenimiento SAT, presencia establecida en el sector, app móvil funcional.

**Por qué es el competidor más directo:**
- Mismo segmento (empresas de instalaciones técnicas).
- Tiene módulos de mantenimiento, partes de trabajo, y gestión de técnicos.
- Presencia española consolidada con base de clientes real.

**Debilidades de STEL Order:**
- No tiene IA generativa de presupuestos. El presupuesto se crea manualmente.
- No tiene Marketplace de material.
- Interfaz orientada a empresa con gestión centralizada, no a autónomo en obra.
- Sin conexión directa con catálogos de proveedores.
- Sin asistente de normativa técnica.

**Riesgo real:** STEL Order podría añadir IA a sus presupuestos. Pero replicar el motor IA de TrabFlow (con benchmark de 400 casos, base de conocimiento por oficio, integración con catálogos de proveedor) requiere 12–24 meses de desarrollo focalizado. En ese tiempo, TrabFlow puede haber consolidado su posición de mercado.

**Probabilidad de que replique el motor IA en 1 año:** Media. Tienen el incentivo pero no la base técnica actual.

---

### ProManager

**Quién es:** Software de gestión para empresas de mantenimiento e instalaciones. Módulos de SAT, GMAO (Gestión de Mantenimiento Asistido por Ordenador).

**Fortaleza:** Profundidad en GMAO, clientes medianos y grandes en el sector industrial.

**Por qué no es el mismo mercado:**
- Enfocado en empresa mediana/grande con departamento de mantenimiento.
- El autónomo o empresa familiar no es su cliente.
- Sin IA, sin Marketplace.
- Precio alto, implementación larga, orientado a sector industrial (no residencial).

**Riesgo real:** Bajo para el segmento de TrabFlow. Son mercados adyacentes pero no superpuestos.

---

### ERP tradicionales (Sage 200, SAP)

**Por qué no son competidores relevantes para TrabFlow:**
- Precio y complejidad incompatibles con el instalador autónomo o empresa familiar.
- Sin verticalización para instalaciones técnicas.
- Requieren implementación y formación de semanas o meses.
- El instalador que puede permitirse un SAP ya tiene un gestor que lo usa. TrabFlow no lo necesita.

---

### Amazon Business / Marketplace B2B genérico

**Por qué no es el mismo mercado:**
- Amazon Business no está integrado en el flujo de trabajo del instalador. El instalador tiene que entrar en Amazon, buscar, comparar, pedir. TrabFlow hace todo eso desde el presupuesto.
- Amazon no entiende las referencias técnicas de material eléctrico. No puede recomendar "el diferencial que corresponde a este circuito según el presupuesto".
- Los distribuidores especializados (OBRAMAT, SALTOKI) tienen ventaja sobre Amazon en material técnico: garantías, asesoría técnica, devoluciones, entregas a obra.

**Riesgo real:** Amazon podría lanzar un marketplace específico para instalaciones técnicas con IA integrada. Pero Amazon no tiene acceso a los flujos de trabajo del instalador ni a los catálogos especializados. TrabFlow tiene los dos desde el día 1.

---

## Las 5 ventajas competitivas de TrabFlow

### Ventaja 1 — Integración vertical única

TrabFlow es el único producto que conecta en un solo flujo: voz → presupuesto → cliente acepta → material pedido → proveedor responde → instalador recibe → factura emitida.

Ningún competidor tiene los cinco eslabones. Holded tiene el último. STEL Order tiene la gestión del trabajo. Amazon Business tiene el pedido de material. Ninguno los une.

Esta integración no es solo una feature — es una apuesta arquitectural hecha desde el día 1 que es costosa de replicar porque requiere que todos los módulos estén diseñados para trabajar juntos.

### Ventaja 2 — Motor IA entrenado en el sector

El motor IA de TrabFlow no es un wrapper genérico de GPT-4 o Claude. Es un sistema con:
- Base de conocimiento de 20+ oficios (`trade_actuaciones`) construida con conocimiento del sector
- Búsqueda semántica en catálogos de proveedores reales
- Validación con benchmark de 400 casos reales del sector
- Aprendizaje automático de las preferencias del instalador
- Versioning, criterios de promoción, y proceso de rollback

Un competidor que quisiera replicar esto en 2026 necesitaría:
1. Construir o adquirir la base de conocimiento por oficio (meses de trabajo con expertos del sector)
2. Integrar catálogos de proveedores reales (acuerdos comerciales + técnicos)
3. Crear el benchmark de validación (400 casos representativos del sector)
4. Validar el motor con instaladores reales
5. Crear el proceso de mejora continua

Estimación: 12–18 meses para un competidor bien financiado.

### Ventaja 3 — Red de datos

Con cada presupuesto generado:
- El motor IA recibe feedback implícito (qué aceptó el instalador, qué modificó)
- El catálogo mejora (qué materiales se usan en cada oficio y región)
- Las recomendaciones de proveedor se refinan (qué proveedores prefieren los instaladores)

Esta red de datos es una barrera que crece con el tiempo. TrabFlow con 1.000 instaladores tiene un motor IA mejor que TrabFlow con 100, no porque el equipo sea más grande sino porque hay más datos de los que aprender.

Un competidor que entre tarde tendrá que competir contra un motor IA que lleva meses aprendiendo del mercado real.

### Ventaja 4 — Red de proveedores

Cada proveedor que integra su catálogo en TrabFlow crea valor para todos los instaladores de la plataforma. Cada instalador que se une a TrabFlow crea valor para todos los proveedores que ya están integrados.

Este efecto de red doble (instaladores + proveedores) es la barrera más importante a largo plazo. Una vez que el Marketplace tiene masa crítica en ambos lados, el coste de cambiar a otro sistema es alto para ambas partes.

Los proveedores no van a mantener su catálogo en dos sistemas si TrabFlow ya tiene suficientes instaladores. Los instaladores no van a cambiar de plataforma si todos sus proveedores preferidos ya están en TrabFlow.

### Ventaja 5 — Conocimiento del sector

TrabFlow ha acumulado conocimiento explícito e implícito del sector de instalaciones técnicas que es difícil de comprar:
- 20+ oficios con base de conocimiento de partidas y precios orientativos
- Normativa técnica vectorizada (REBT, RITE, CTE, AEAT, SS, DGT)
- Comprensión del vocabulario del instalador (cómo describe su trabajo, qué términos usa)
- Conocimiento de los distribuidores del sector y sus modelos de relación con los instaladores

Este conocimiento no está en ningún libro. Se construye trabajando con instaladores reales durante meses.

---

## Barreras de entrada que se construirán

Las ventajas actuales son defensivas pero no suficientes a largo plazo. Las siguientes barreras deben construirse activamente:

### Barrera 1 — Contratos con asociaciones gremiales

Un acuerdo exclusivo o preferente con CONAIF, FENIE, o APIEM hace que cada nuevo asociado de esas organizaciones tenga un canal directo a TrabFlow. Si el acuerdo incluye integración en el proceso de alta de nuevos asociados, el flujo de instaladores es semi-automático.

**Dificultad de replicar:** Alta. Las asociaciones no firman acuerdos con tres competidores al mismo tiempo. Una vez firmado el acuerdo, el competidor tiene que esperar a que expire.

### Barrera 2 — Datos exclusivos de catálogos de proveedores

Si TrabFlow tiene acuerdos de catálogo exclusivos (o preferenciales) con los distribuidores más grandes, los competidores no pueden ofrecer los mismos precios y referencias. El instalador que usa TrabFlow tiene acceso a mejores precios que el instalador que usa el competidor.

**Dificultad de replicar:** Media-Alta. Los distribuidores pueden dar acceso a múltiples plataformas, pero los términos negociados (precios, exclusividad de referencias) pueden ser ventajosos para quien llegó primero.

### Barrera 3 — Switching cost del historial

Un instalador con 500 presupuestos, 200 clientes, y 50 contratos de mantenimiento en TrabFlow no va a cambiar de plataforma fácilmente. El historial tiene valor económico directo: el instalador puede recuperar un presupuesto de hace 2 años para hacer uno nuevo similar.

**Dificultad de replicar:** Alta. El historial no se puede transferir sin que el instalador lo exporte y lo importe. Es un trabajo que la mayoría no hará.

### Barrera 4 — El motor IA como estándar del sector

Si los instaladores empiezan a describir el proceso de hacer un presupuesto como "lo hago con TrabFlow", el motor IA se convierte en el estándar de facto del sector. Es el objetivo del marketing boca a boca: que el nombre del producto se convierta en el verbo de la acción.

**Dificultad de replicar:** Muy alta, una vez establecido. Pero requiere masa crítica y tiempo.

---

## Efecto red detallado

```
Instalador se une a TrabFlow
    ↓
Genera presupuestos → datos mejoran motor IA
    ↓
Motor IA mejor → más instaladores se unen
    ↓
Más instaladores → más pedidos de material
    ↓
Más pedidos → distribuidores tienen incentivo para integrar catálogos
    ↓
Más distribuidores → más opciones y mejores precios para instaladores
    ↓
Mejores opciones → más instaladores se quedan y recomiendan
```

Este ciclo no funciona con 10 instaladores. Empieza a funcionar con 100–200. Se acelera con 1.000.

---

## Datos que se acumularán y su valor

| Dato acumulado | Valor competitivo |
|---|---|
| Patrones de lenguaje del instalador por oficio y región | Mejora el motor IA para instaladores de ese oficio y región específicamente |
| Preferencias de proveedor por tipo de trabajo | Recomendaciones más precisas, menos tiempo de selección |
| Precios históricos de mercado por material y región | Detección de anomalías de precio, alertas al instalador |
| Estacionalidad del trabajo por oficio | Predicción de demanda para proveedores, planificación de stock |
| Tasas de aceptación de presupuestos por tipo de trabajo | Optimización de precios sugeridos |
| Motivos de modificación de presupuesto por instalador | Mejora continua del motor IA |
| Tiempo medio entre presupuesto y factura por tipo de trabajo | Benchmarking para el instalador |

---

## Lo que TrabFlow no puede hacer y otros sí

La honestidad sobre los límites competitivos es parte del análisis:

- **Holded tiene mejor contabilidad.** TrabFlow no pretende reemplazar la contabilidad. El instalador sigue necesitando un asesor fiscal.
- **STEL Order tiene mejor gestión de flotas grandes.** Para una empresa de 50 técnicos con contratos de mantenimiento industriales, STEL Order es hoy más maduro.
- **Amazon Business tiene más referencias.** El catálogo de Amazon es infinito. El de TrabFlow solo tiene lo que los distribuidores del sector han subido.
- **Google Maps optimiza rutas mejor.** El optimizador de ruta de TrabFlow es bueno para 5–10 paradas diarias. Para una flota de camiones, no es la solución.

Esto no es debilidad — es foco. TrabFlow sirve al instalador autónomo o empresa familiar de instalaciones técnicas, y para ese cliente concreto es mejor que cualquier alternativa. No necesita ganar en todos los segmentos para ser el líder en el suyo.

---

## Resumen del moat

| Ventaja | Fortaleza actual | Fortaleza en 2027 |
|---|---|---|
| Integración vertical (flujo completo) | Alta — única en el mercado | Muy alta — más módulos conectados |
| Motor IA sectorial | Alta — benchmark validado | Muy alta — más datos, más oficios |
| Red de datos | Media — pocos usuarios todavía | Alta — con 1.000 usuarios, diferencia visible |
| Red de proveedores | Baja — piloto en curso | Media — con 3–5 distribuidores integrados |
| Switching cost del historial | Baja — pocos usuarios con historial largo | Media — con 2 años de historia de usuario |
| Acuerdos con asociaciones | No existe todavía | Media si se firma 1 acuerdo en 2026 |
| Conocimiento del sector | Media — acumulado durante desarrollo | Alta — continúa creciendo |
