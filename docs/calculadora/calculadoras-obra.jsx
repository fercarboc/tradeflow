import { useState, useMemo } from "react";

// ─── DATOS ──────────────────────────────────────────────────────────────────

const SECCIONES_STD = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300];

const CAPACIDAD_CABLE = {
  1.5: { A: 15, desc: "15 A" }, 2.5: { A: 21, desc: "21 A" },
  4: { A: 27, desc: "27 A" }, 6: { A: 34, desc: "34 A" },
  10: { A: 46, desc: "46 A" }, 16: { A: 62, desc: "62 A" },
  25: { A: 84, desc: "84 A" }, 35: { A: 101, desc: "101 A" },
  50: { A: 120, desc: "120 A" }, 70: { A: 150, desc: "150 A" },
  95: { A: 179, desc: "179 A" }, 120: { A: 204, desc: "204 A" },
};

const PRECIOS_MATERIALES = [
  // Albañilería
  { cat: "Albañilería", item: "Ladrillo cerámico hueco 24x11.5x7 cm", unidad: "ud", min: 0.15, max: 0.25 },
  { cat: "Albañilería", item: "Bloque hormigón 40x20x20 cm", unidad: "ud", min: 0.90, max: 1.40 },
  { cat: "Albañilería", item: "Mortero de cemento M-5 (saco 25 kg)", unidad: "saco", min: 4.50, max: 7.00 },
  { cat: "Albañilería", item: "Yeso proyectado (saco 25 kg)", unidad: "saco", min: 5.00, max: 8.00 },
  { cat: "Albañilería", item: "Tabique pladur 78/400 (doble placa)", unidad: "m²", min: 28, max: 45 },
  { cat: "Albañilería", item: "Enfoscado de cemento exterior", unidad: "m²", min: 12, max: 22 },
  { cat: "Albañilería", item: "Hormigón HA-25 (m³)", unidad: "m³", min: 85, max: 120 },
  { cat: "Albañilería", item: "Ferralla Ø12 (kg)", unidad: "kg", min: 0.85, max: 1.20 },
  // Pavimentos
  { cat: "Pavimentos", item: "Porcelánico rectificado 60x60 (calidad media)", unidad: "m²", min: 15, max: 35 },
  { cat: "Pavimentos", item: "Porcelánico gran formato 90x90", unidad: "m²", min: 35, max: 80 },
  { cat: "Pavimentos", item: "Tarima laminada AC4 8mm", unidad: "m²", min: 12, max: 25 },
  { cat: "Pavimentos", item: "Tarima maciza roble", unidad: "m²", min: 45, max: 120 },
  { cat: "Pavimentos", item: "Azulejo baño 20x60", unidad: "m²", min: 10, max: 30 },
  { cat: "Pavimentos", item: "Microcemento (kit 5 m²)", unidad: "kit", min: 80, max: 150 },
  { cat: "Pavimentos", item: "Cola para pavimento (saco 25 kg)", unidad: "saco", min: 8, max: 14 },
  { cat: "Pavimentos", item: "Junta epóxica (3 kg)", unidad: "kg", min: 12, max: 20 },
  // Pintura
  { cat: "Pintura", item: "Pintura plástica blanca interior (15 L)", unidad: "L", min: 1.80, max: 3.50 },
  { cat: "Pintura", item: "Pintura exterior (15 L)", unidad: "L", min: 2.50, max: 5.00 },
  { cat: "Pintura", item: "Pintura antihumedad (4 L)", unidad: "L", min: 5.00, max: 9.00 },
  { cat: "Pintura", item: "Imprimación selladora (5 L)", unidad: "L", min: 3.00, max: 6.00 },
  { cat: "Pintura", item: "Aplicación pintura interior (mano de obra)", unidad: "m²", min: 5, max: 10 },
  { cat: "Pintura", item: "Aplicación pintura fachada (mano de obra)", unidad: "m²", min: 8, max: 16 },
  // Fontanería
  { cat: "Fontanería", item: "Tubo PVC desagüe Ø110 (3 m)", unidad: "ud", min: 8, max: 14 },
  { cat: "Fontanería", item: "Tubo PVC presión Ø32 (3 m)", unidad: "ud", min: 5, max: 9 },
  { cat: "Fontanería", item: "Tubo multicapa 16mm (m)", unidad: "m", min: 1.20, max: 2.00 },
  { cat: "Fontanería", item: "Inodoro suspendido (calidad media)", unidad: "ud", min: 120, max: 350 },
  { cat: "Fontanería", item: "Lavabo sobre encimera", unidad: "ud", min: 80, max: 300 },
  { cat: "Fontanería", item: "Plato de ducha 80x80 acrílico", unidad: "ud", min: 60, max: 200 },
  { cat: "Fontanería", item: "Grifo monomando lavabo", unidad: "ud", min: 35, max: 150 },
  { cat: "Fontanería", item: "Calentador de agua 80 L", unidad: "ud", min: 180, max: 450 },
  { cat: "Fontanería", item: "Caldera de gas condensación", unidad: "ud", min: 800, max: 2200 },
  // Electricidad
  { cat: "Electricidad", item: "Cable H07V-K 2.5mm² (rollo 100m)", unidad: "rollo", min: 35, max: 55 },
  { cat: "Electricidad", item: "Cable H07V-K 6mm² (rollo 100m)", unidad: "rollo", min: 70, max: 110 },
  { cat: "Electricidad", item: "Caja empotrar mecanismo Simon/BJC", unidad: "ud", min: 0.50, max: 1.50 },
  { cat: "Electricidad", item: "Interruptor 10A (mecanismo)", unidad: "ud", min: 4, max: 15 },
  { cat: "Electricidad", item: "Base enchufe 16A 2P+T", unidad: "ud", min: 4, max: 18 },
  { cat: "Electricidad", item: "IGA 25A (interruptor general)", unidad: "ud", min: 18, max: 35 },
  { cat: "Electricidad", item: "Cuadro distribución 16 módulos", unidad: "ud", min: 40, max: 80 },
  { cat: "Electricidad", item: "Luminaria LED downlight 12W", unidad: "ud", min: 8, max: 25 },
  { cat: "Electricidad", item: "Instalación punto de luz (m.o.)", unidad: "ud", min: 45, max: 90 },
  // Climatización
  { cat: "Climatización", item: "Split 1x1 2500 frig (inverter)", unidad: "ud", min: 350, max: 700 },
  { cat: "Climatización", item: "Split 1x1 3000 frig (inverter)", unidad: "ud", min: 450, max: 900 },
  { cat: "Climatización", item: "Split 1x1 5000 frig (inverter)", unidad: "ud", min: 650, max: 1400 },
  { cat: "Climatización", item: "Multisplit 2x1 (2500+2500 frig)", unidad: "ud", min: 900, max: 1800 },
  { cat: "Climatización", item: "Aerotermia monobloc 8kW", unidad: "ud", min: 2800, max: 5500 },
  { cat: "Climatización", item: "Radiador bajo consumo 9 elementos", unidad: "ud", min: 60, max: 180 },
  { cat: "Climatización", item: "Instalación split + cargos (m.o.)", unidad: "ud", min: 180, max: 350 },
  // Carpintería
  { cat: "Carpintería", item: "Puerta de paso interior lacada 80cm", unidad: "ud", min: 180, max: 500 },
  { cat: "Carpintería", item: "Puerta blindada entrada", unidad: "ud", min: 600, max: 1800 },
  { cat: "Carpintería", item: "Ventana PVC doble acristalamiento 100x100", unidad: "ud", min: 250, max: 600 },
  { cat: "Carpintería", item: "Ventana aluminio rotura puente 120x120", unidad: "ud", min: 350, max: 800 },
  { cat: "Carpintería", item: "Armario empotrado 3 puertas (2.5m)", unidad: "ud", min: 600, max: 2500 },
  { cat: "Carpintería", item: "Mueble cocina metro lineal (bajo)", unidad: "m", min: 200, max: 600 },
  // Aislamiento
  { cat: "Aislamiento", item: "Lana de roca 60mm (m²)", unidad: "m²", min: 5, max: 10 },
  { cat: "Aislamiento", item: "Poliestireno expandido EPS 60mm (m²)", unidad: "m²", min: 4, max: 8 },
  { cat: "Aislamiento", item: "Membrana impermeabilizante autoadhesiva", unidad: "m²", min: 8, max: 18 },
  { cat: "Aislamiento", item: "Proyección poliuretano 5cm", unidad: "m²", min: 12, max: 22 },
  // Mano de obra
  { cat: "Mano de obra", item: "Oficial 1ª construcción (hora)", unidad: "h", min: 22, max: 32 },
  { cat: "Mano de obra", item: "Peón ayuda (hora)", unidad: "h", min: 16, max: 22 },
  { cat: "Mano de obra", item: "Oficial 1ª fontanero (hora)", unidad: "h", min: 25, max: 38 },
  { cat: "Mano de obra", item: "Oficial 1ª electricista (hora)", unidad: "h", min: 25, max: 38 },
  { cat: "Mano de obra", item: "Oficial 1ª carpintero (hora)", unidad: "h", min: 24, max: 36 },
];

// ─── COMPONENTES AUXILIARES ──────────────────────────────────────────────────

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl shadow-md p-6 ${className}`}>
      {children}
    </div>
  );
}

function Label({ children }) {
  return <label className="block text-sm font-semibold text-gray-700 mb-1">{children}</label>;
}

function Input({ ...props }) {
  return (
    <input
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
      {...props}
    />
  );
}

function Select({ children, ...props }) {
  return (
    <select
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
      {...props}
    >
      {children}
    </select>
  );
}

function Result({ label, value, unit = "", highlight = false, warning = false }) {
  return (
    <div className={`rounded-xl p-4 flex justify-between items-center ${
      warning ? "bg-amber-50 border border-amber-200" :
      highlight ? "bg-blue-50 border border-blue-200" : "bg-gray-50"
    }`}>
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`font-bold text-lg ${warning ? "text-amber-700" : highlight ? "text-blue-700" : "text-gray-800"}`}>
        {value} <span className="text-sm font-normal">{unit}</span>
      </span>
    </div>
  );
}

function Badge({ ok, children }) {
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${
      ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
    }`}>
      {ok ? "✓" : "✗"} {children}
    </span>
  );
}

// ─── CALCULADORA 1: FRIGORÍAS ─────────────────────────────────────────────────

function CalcFrigorias() {
  const [m2, setM2] = useState(20);
  const [altura, setAltura] = useState(2.5);
  const [zona, setZona] = useState("C");
  const [orient, setOrient] = useState("sur");
  const [aislamiento, setAislamiento] = useState("normal");
  const [personas, setPersonas] = useState(2);
  const [ventanas, setVentanas] = useState(20);

  const result = useMemo(() => {
    const baseWm2 = { A: 140, B: 120, C: 100, D: 80, E: 65 }[zona];
    const factorOrient = { norte: 0.9, este: 1.0, sur: 1.1, oeste: 1.2, sureste: 1.05, suroeste: 1.15 }[orient];
    const factorAisl = { malo: 1.25, normal: 1.0, bueno: 0.85 }[aislamiento];
    const factorAltura = altura > 2.7 ? 1 + (altura - 2.7) * 0.1 : 1;
    const factorVentanas = 1 + (ventanas - 15) * 0.005;

    const potBase = m2 * baseWm2;
    const potCorr = potBase * factorOrient * factorAisl * factorAltura * factorVentanas;
    const potPersonas = personas * 100;
    const potTotal = potCorr + potPersonas;

    const frigorias = potTotal * 0.86;
    const kw = potTotal / 1000;
    const btu = potTotal * 3.412;

    let recomendacion = "";
    if (frigorias < 1500) recomendacion = "Split 1x1 de 1.5 kW";
    else if (frigorias < 2500) recomendacion = "Split 1x1 de 2.5 kW (2.150 frig)";
    else if (frigorias < 3500) recomendacion = "Split 1x1 de 3.5 kW (3.010 frig)";
    else if (frigorias < 5000) recomendacion = "Split 1x1 de 5 kW (4.300 frig)";
    else if (frigorias < 7000) recomendacion = "Split 1x1 de 7 kW (6.020 frig)";
    else recomendacion = "Equipo conductos o multisplit";

    return { frigorias: Math.round(frigorias), kw: kw.toFixed(2), btu: Math.round(btu), recomendacion };
  }, [m2, altura, zona, orient, aislamiento, personas, ventanas]);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <h3 className="font-bold text-gray-800 mb-4">Datos del espacio</h3>
        <div className="space-y-4">
          <div>
            <Label>Superficie (m²)</Label>
            <Input type="number" value={m2} min={5} max={500} onChange={e => setM2(+e.target.value)} />
          </div>
          <div>
            <Label>Altura libre (m)</Label>
            <Input type="number" value={altura} min={2} max={6} step={0.1} onChange={e => setAltura(+e.target.value)} />
          </div>
          <div>
            <Label>Zona climática España</Label>
            <Select value={zona} onChange={e => setZona(e.target.value)}>
              <option value="A">A — Extremadamente cálida (Almería, Málaga)</option>
              <option value="B">B — Muy cálida (Sevilla, Murcia, Alicante)</option>
              <option value="C">C — Cálida (Madrid, Barcelona, Valencia)</option>
              <option value="D">D — Moderada (Valladolid, Salamanca)</option>
              <option value="E">E — Fría (Burgos, Ávila, Soria)</option>
            </Select>
          </div>
          <div>
            <Label>Orientación principal</Label>
            <Select value={orient} onChange={e => setOrient(e.target.value)}>
              <option value="norte">Norte (menor ganancia solar)</option>
              <option value="este">Este</option>
              <option value="sureste">Sureste</option>
              <option value="sur">Sur</option>
              <option value="suroeste">Suroeste</option>
              <option value="oeste">Oeste (mayor ganancia solar)</option>
            </Select>
          </div>
          <div>
            <Label>Aislamiento del local</Label>
            <Select value={aislamiento} onChange={e => setAislamiento(e.target.value)}>
              <option value="malo">Malo (edificio antiguo sin aislar)</option>
              <option value="normal">Normal (construcción estándar)</option>
              <option value="bueno">Bueno (CTE 2020 o superior)</option>
            </Select>
          </div>
          <div>
            <Label>Personas habitualmente</Label>
            <Input type="number" value={personas} min={0} max={50} onChange={e => setPersonas(+e.target.value)} />
          </div>
          <div>
            <Label>% superficie de ventanas estimada</Label>
            <Input type="number" value={ventanas} min={0} max={80} onChange={e => setVentanas(+e.target.value)} />
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-gray-800 mb-4">Resultado</h3>
        <div className="space-y-3">
          <Result label="Potencia necesaria en frigorías" value={result.frigorias.toLocaleString("es-ES")} unit="frig" highlight />
          <Result label="Potencia en kW" value={result.kw} unit="kW" />
          <Result label="Potencia en BTU/h" value={result.btu.toLocaleString("es-ES")} unit="BTU/h" />
          <div className="mt-4 bg-blue-600 text-white rounded-xl p-4">
            <p className="text-xs uppercase font-semibold opacity-80 mb-1">Equipo recomendado</p>
            <p className="font-bold">{result.recomendacion}</p>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Cálculo orientativo basado en cargas simplificadas. Para instalaciones oficiales consultar RITE/UNE-EN 15255.
          </p>
        </div>
      </Card>
    </div>
  );
}

// ─── CALCULADORA 2: SECCIÓN DE CABLE ─────────────────────────────────────────

function CalcCable() {
  const [potencia, setPotencia] = useState(2000);
  const [longitud, setLongitud] = useState(20);
  const [tension, setTension] = useState(230);
  const [caida, setCaida] = useState(3);
  const [material, setMaterial] = useState("cobre");
  const [cosPhi, setCosPhi] = useState(1);

  const result = useMemo(() => {
    const gamma = material === "cobre" ? 56 : 34;
    const U = tension;
    const P = potencia;
    const L = longitud;
    const deltU = U * (caida / 100);
    const I = P / (U * cosPhi);

    // Sección mínima por caída de tensión
    const S_tension = (2 * L * P) / (gamma * deltU * U);

    // Sección mínima por intensidad admisible (encontrar la más pequeña que soporte I)
    let S_intensidad = 300;
    for (const s of SECCIONES_STD) {
      if (CAPACIDAD_CABLE[s] && CAPACIDAD_CABLE[s].A >= I) {
        S_intensidad = s;
        break;
      }
    }

    // Sección necesaria: la mayor de las dos restricciones
    const S_necesaria = Math.max(S_tension, S_intensidad);

    // Redondear hacia arriba al estándar
    const S_std = SECCIONES_STD.find(s => s >= S_necesaria) || 300;

    // Caída de tensión real con la sección elegida
    const deltU_real = (2 * L * P) / (gamma * S_std * U);
    const pct_real = (deltU_real / U) * 100;

    const ok_tension = pct_real <= caida;
    const ok_corriente = CAPACIDAD_CABLE[S_std] && CAPACIDAD_CABLE[S_std].A >= I;

    return {
      I: I.toFixed(1),
      S_tension: S_tension.toFixed(2),
      S_std,
      pct_real: pct_real.toFixed(2),
      deltU_real: deltU_real.toFixed(1),
      ok_tension,
      ok_corriente,
      I_adm: CAPACIDAD_CABLE[S_std]?.desc || ">200 A",
    };
  }, [potencia, longitud, tension, caida, material, cosPhi]);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <h3 className="font-bold text-gray-800 mb-4">Datos del circuito</h3>
        <div className="space-y-4">
          <div>
            <Label>Potencia a transportar (W)</Label>
            <Input type="number" value={potencia} min={100} max={500000} onChange={e => setPotencia(+e.target.value)} />
          </div>
          <div>
            <Label>Longitud del tramo (m — ida solamente)</Label>
            <Input type="number" value={longitud} min={1} max={500} onChange={e => setLongitud(+e.target.value)} />
          </div>
          <div>
            <Label>Tensión de suministro</Label>
            <Select value={tension} onChange={e => setTension(+e.target.value)}>
              <option value={230}>230 V — Monofásico</option>
              <option value={400}>400 V — Trifásico</option>
            </Select>
          </div>
          <div>
            <Label>Caída de tensión máxima admisible (%)</Label>
            <Select value={caida} onChange={e => setCaida(+e.target.value)}>
              <option value={3}>3% — Alumbrado (REBT ITC-BT-19)</option>
              <option value={5}>5% — Fuerza / otros usos</option>
              <option value={1.5}>1.5% — Receptores sensibles</option>
            </Select>
          </div>
          <div>
            <Label>Material conductor</Label>
            <Select value={material} onChange={e => setMaterial(e.target.value)}>
              <option value="cobre">Cobre (γ = 56 m/Ω·mm²)</option>
              <option value="aluminio">Aluminio (γ = 34 m/Ω·mm²)</option>
            </Select>
          </div>
          <div>
            <Label>Factor de potencia cos φ</Label>
            <Select value={cosPhi} onChange={e => setCosPhi(+e.target.value)}>
              <option value={1}>1,0 — Cargas resistivas (resistencias, iluminación)</option>
              <option value={0.9}>0,9 — Motores pequeños</option>
              <option value={0.85}>0,85 — Motores industriales</option>
              <option value={0.8}>0,8 — Cargas inductivas grandes</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-gray-800 mb-4">Resultado (REBT ITC-BT-19)</h3>
        <div className="space-y-3">
          <Result label="Intensidad de corriente" value={result.I} unit="A" />
          <Result label="Sección mínima por c.d.t." value={result.S_tension} unit="mm²" />
          <Result label="Sección normalizada a instalar" value={result.S_std} unit="mm²" highlight />
          <Result label="Caída de tensión real" value={`${result.pct_real}% (${result.deltU_real} V)`} unit="" warning={!result.ok_tension} />
          <Result label="Intensidad admisible del cable" value={result.I_adm} unit="" />
          <div className="flex gap-2 flex-wrap mt-2">
            <Badge ok={result.ok_tension}>Caída de tensión ≤ {caida}%</Badge>
            <Badge ok={result.ok_corriente}>Capacidad térmica OK</Badge>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Calculado según REBT ITC-BT-19. Caída de tensión calculada por el método de resistencia activa.
            No incluye correcciones por temperatura ni agrupamiento.
          </p>
        </div>
      </Card>
    </div>
  );
}

// ─── CALCULADORA 3: ESCALERAS ─────────────────────────────────────────────────

function CalcEscaleras() {
  const [alturaPlanta, setAlturaPlanta] = useState(280);
  const [contrahuellaDeseada, setContrahuellaDeseada] = useState(17);
  const [uso, setUso] = useState("privado");

  const result = useMemo(() => {
    const h = alturaPlanta;
    const ch = contrahuellaDeseada;

    // Número de peldaños (redondeando)
    const numPeldanios = Math.round(h / ch);
    const chReal = h / numPeldanios;

    // Huella por Ley de Blondel: 2h + d = 63 cm
    const huella = 63 - 2 * chReal;

    // Longitud horizontal total
    const longitudTotal = huella * numPeldanios;

    // Límites CTE DB-SUA-1
    const hMax = uso === "privado" ? 18.5 : 17.5;
    const hMin = 13;
    const dMin = 28;
    const blondelMin = 54;
    const blondelMax = 70;
    const blondelCheck = 2 * chReal + huella;

    const ok_hMax = chReal <= hMax;
    const ok_hMin = chReal >= hMin;
    const ok_dMin = huella >= dMin;
    const ok_blondel = blondelCheck >= blondelMin && blondelCheck <= blondelMax;

    return {
      numPeldanios,
      chReal: chReal.toFixed(1),
      huella: huella.toFixed(1),
      longitudTotal: (longitudTotal / 100).toFixed(2),
      blondelCheck: blondelCheck.toFixed(1),
      ok_hMax, ok_hMin, ok_dMin, ok_blondel,
      hMax, hMin, dMin,
    };
  }, [alturaPlanta, contrahuellaDeseada, uso]);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <h3 className="font-bold text-gray-800 mb-4">Datos de la escalera</h3>
        <div className="space-y-4">
          <div>
            <Label>Altura total a salvar (cm)</Label>
            <Input type="number" value={alturaPlanta} min={100} max={1000} onChange={e => setAlturaPlanta(+e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">Altura libre de planta (suelo a suelo)</p>
          </div>
          <div>
            <Label>Contrahuella deseada (cm)</Label>
            <Input type="number" value={contrahuellaDeseada} min={13} max={20} step={0.5} onChange={e => setContrahuellaDeseada(+e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">Altura de cada peldaño. Recomendado: 16–18 cm</p>
          </div>
          <div>
            <Label>Tipo de uso</Label>
            <Select value={uso} onChange={e => setUso(e.target.value)}>
              <option value="privado">Uso privado (vivienda unifamiliar)</option>
              <option value="publico">Uso restringido / público</option>
            </Select>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 mt-2">
            <p className="text-xs font-semibold text-amber-700 mb-1">Ley de Blondel</p>
            <p className="text-sm text-amber-800">2 × contrahuella + huella = 63 cm</p>
            <p className="text-xs text-amber-600 mt-1">Rango aceptable: 54–70 cm</p>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-gray-800 mb-4">Resultado (CTE DB-SUA-1)</h3>
        <div className="space-y-3">
          <Result label="Número de peldaños" value={result.numPeldanios} unit="ud" highlight />
          <Result label="Contrahuella real" value={`${result.chReal} cm`} unit="" />
          <Result label="Huella (Ley de Blondel)" value={`${result.huella} cm`} unit="" />
          <Result label="Comprobación Blondel (2h+d)" value={`${result.blondelCheck} cm`} unit="" />
          <Result label="Longitud horizontal total" value={`${result.longitudTotal} m`} unit="" />
          <div className="flex gap-2 flex-wrap mt-2">
            <Badge ok={result.ok_hMax}>Contrahuella ≤ {result.hMax} cm</Badge>
            <Badge ok={result.ok_hMin}>Contrahuella ≥ {result.hMin} cm</Badge>
            <Badge ok={result.ok_dMin}>Huella ≥ {result.dMin} cm</Badge>
            <Badge ok={result.ok_blondel}>Blondel 54–70 cm</Badge>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Comprobaciones según CTE DB-SUA-1 Tabla 4.1. Verificar barandillas (h ≥ 900 mm) y ancho mínimo por normativa de aplicación.
          </p>
        </div>
      </Card>
    </div>
  );
}

// ─── CALCULADORA 4: PENDIENTES ─────────────────────────────────────────────────

function CalcPendientes() {
  const [modo, setModo] = useState("calcular_pendiente");
  const [desnivel, setDesnivel] = useState(10);
  const [longitud, setLongitud] = useState(100);
  const [pendientePct, setPendientePct] = useState(2);
  const [tipo, setTipo] = useState("saneamiento");

  const result = useMemo(() => {
    let pendiente, desnivelCalc, longitudCalc;

    if (modo === "calcular_pendiente") {
      pendiente = (desnivel / longitud) * 100;
      desnivelCalc = desnivel;
      longitudCalc = longitud;
    } else if (modo === "calcular_desnivel") {
      pendiente = pendientePct;
      longitudCalc = longitud;
      desnivelCalc = (pendientePct / 100) * longitud;
    } else {
      pendiente = pendientePct;
      desnivelCalc = desnivel;
      longitudCalc = (desnivel / pendientePct) * 100;
    }

    // Verificaciones según tipo
    let checks = [];
    if (tipo === "saneamiento") {
      checks = [
        { label: "Mín. CTE HS-5 para Ø50mm: 2%", ok: pendiente >= 2 },
        { label: "Mín. CTE HS-5 para Ø75mm: 1.5%", ok: pendiente >= 1.5 },
        { label: "Mín. CTE HS-5 para Ø100mm: 1%", ok: pendiente >= 1 },
        { label: "Mín. CTE HS-5 para Ø≥150mm: 0.5%", ok: pendiente >= 0.5 },
      ];
    } else if (tipo === "rampa_normal") {
      const maxPct = longitudCalc < 300 ? 12 : longitudCalc < 600 ? 10 : 8;
      checks = [
        { label: `Máx. CTE DB-SUA (L=${longitudCalc<300?"<3m":longitudCalc<600?"3-6m":">6m"}): ${maxPct}%`, ok: pendiente <= maxPct },
        { label: "Sin limitación de longitud mínima", ok: true },
      ];
    } else if (tipo === "rampa_accesible") {
      const maxPct = longitudCalc < 300 ? 8 : longitudCalc < 600 ? 6 : 5;
      checks = [
        { label: `Máx. CTE DB-SUA accesible (L=${longitudCalc<300?"<3m":longitudCalc<600?"3-6m":">6m"}): ${maxPct}%`, ok: pendiente <= maxPct },
        { label: "Ancho mínimo libre 1,20 m (comprobar)", ok: null },
      ];
    } else if (tipo === "cubierta_plana") {
      checks = [
        { label: "Mín. CTE DB-HS1 cubierta convencional: 1%", ok: pendiente >= 1 },
        { label: "Recomendado cubierta invertida: ≥ 1%", ok: pendiente >= 1 },
        { label: "Recomendado cubierta ajardinada: ≥ 2%", ok: pendiente >= 2 },
      ];
    }

    return {
      pendiente: pendiente.toFixed(2),
      desnivel: desnivelCalc.toFixed(1),
      longitud: longitudCalc.toFixed(0),
      pendienteDeg: (Math.atan(pendiente / 100) * (180 / Math.PI)).toFixed(2),
      checks,
    };
  }, [modo, desnivel, longitud, pendientePct, tipo]);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <h3 className="font-bold text-gray-800 mb-4">Parámetros</h3>
        <div className="space-y-4">
          <div>
            <Label>Tipo de elemento</Label>
            <Select value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="saneamiento">Saneamiento / desagüe (CTE HS-5)</option>
              <option value="rampa_normal">Rampa uso general (CTE DB-SUA)</option>
              <option value="rampa_accesible">Rampa accesible (CTE DB-SUA)</option>
              <option value="cubierta_plana">Cubierta plana / tejado (CTE DB-HS1)</option>
            </Select>
          </div>
          <div>
            <Label>Quiero calcular…</Label>
            <Select value={modo} onChange={e => setModo(e.target.value)}>
              <option value="calcular_pendiente">La pendiente (%) — doy desnivel y longitud</option>
              <option value="calcular_desnivel">El desnivel (cm) — doy pendiente y longitud</option>
              <option value="calcular_longitud">La longitud — doy pendiente y desnivel</option>
            </Select>
          </div>
          {(modo === "calcular_pendiente" || modo === "calcular_longitud") && (
            <div>
              <Label>Desnivel / diferencia de cota (cm)</Label>
              <Input type="number" value={desnivel} min={0} step={0.5} onChange={e => setDesnivel(+e.target.value)} />
            </div>
          )}
          {(modo === "calcular_pendiente" || modo === "calcular_desnivel") && (
            <div>
              <Label>Longitud horizontal (cm)</Label>
              <Input type="number" value={longitud} min={1} onChange={e => setLongitud(+e.target.value)} />
            </div>
          )}
          {(modo === "calcular_desnivel" || modo === "calcular_longitud") && (
            <div>
              <Label>Pendiente (%)</Label>
              <Input type="number" value={pendientePct} min={0} max={100} step={0.1} onChange={e => setPendientePct(+e.target.value)} />
            </div>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-gray-800 mb-4">Resultado</h3>
        <div className="space-y-3">
          <Result label="Pendiente" value={`${result.pendiente}%`} unit="" highlight />
          <Result label="Ángulo" value={`${result.pendienteDeg}°`} unit="" />
          <Result label="Desnivel" value={`${result.desnivel} cm`} unit="" />
          <Result label="Longitud horizontal" value={`${result.longitud} cm`} unit="" />
          <div className="space-y-2 mt-2">
            {result.checks.map((c, i) => (
              <div key={i} className={`flex items-center gap-2 text-sm p-2 rounded-lg ${
                c.ok === null ? "bg-gray-50 text-gray-600" : c.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}>
                <span>{c.ok === null ? "ℹ️" : c.ok ? "✓" : "✗"}</span>
                <span>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── CALCULADORA 5: COSTE DE REFORMA ─────────────────────────────────────────

const PRECIOS_REFORMA = {
  integral: { low: [200, 350], med: [350, 600], high: [600, 1400], label: "Reforma integral (por m²)" },
  pintura: { low: [5, 8], med: [8, 13], high: [13, 22], label: "Pintura interior (por m²)" },
  solado: { low: [20, 35], med: [35, 70], high: [70, 150], label: "Solado / pavimento (por m²)" },
  alicatado: { low: [25, 45], med: [45, 90], high: [90, 180], label: "Alicatado (por m²)" },
  tabiqueria: { low: [25, 40], med: [40, 65], high: [65, 110], label: "Tabiquería pladur (por m²)" },
  cubierta: { low: [30, 55], med: [55, 100], high: [100, 200], label: "Cubierta / tejado (por m²)" },
};

const PRECIOS_BANO = { low: [2500, 4500], med: [4500, 8000], high: [8000, 20000] };
const PRECIOS_COCINA = { low: [3000, 6000], med: [6000, 14000], high: [14000, 35000] };

function CalcReforma() {
  const [tipo, setTipo] = useState("integral");
  const [calidad, setCalidad] = useState("med");
  const [superficie, setSuperficie] = useState(80);
  const [banos, setBanos] = useState(1);
  const [cocinas, setCocinas] = useState(1);
  const [incluyeBano, setIncluyeBano] = useState(false);
  const [incluyeCocina, setIncluyeCocina] = useState(false);

  const result = useMemo(() => {
    const r = PRECIOS_REFORMA[tipo];
    const rango = r[calidad];
    const minM2 = rango[0] * superficie;
    const maxM2 = rango[1] * superficie;

    let minExtra = 0, maxExtra = 0;
    if (incluyeBano) {
      minExtra += PRECIOS_BANO[calidad][0] * banos;
      maxExtra += PRECIOS_BANO[calidad][1] * banos;
    }
    if (incluyeCocina) {
      minExtra += PRECIOS_COCINA[calidad][0] * cocinas;
      maxExtra += PRECIOS_COCINA[calidad][1] * cocinas;
    }

    const min = minM2 + minExtra;
    const max = maxM2 + maxExtra;
    const mid = (min + max) / 2;

    return {
      min: Math.round(min).toLocaleString("es-ES"),
      max: Math.round(max).toLocaleString("es-ES"),
      mid: Math.round(mid).toLocaleString("es-ES"),
      minM2: rango[0], maxM2: rango[1],
    };
  }, [tipo, calidad, superficie, banos, cocinas, incluyeBano, incluyeCocina]);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <h3 className="font-bold text-gray-800 mb-4">Parámetros de la obra</h3>
        <div className="space-y-4">
          <div>
            <Label>Tipo de trabajo</Label>
            <Select value={tipo} onChange={e => setTipo(e.target.value)}>
              {Object.entries(PRECIOS_REFORMA).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Nivel de calidad / acabados</Label>
            <Select value={calidad} onChange={e => setCalidad(e.target.value)}>
              <option value="low">Económico (materiales básicos, mano de obra ajustada)</option>
              <option value="med">Estándar (calidad media, buen acabado)</option>
              <option value="high">Premium (materiales de alta gama, acabado de lujo)</option>
            </Select>
          </div>
          <div>
            <Label>Superficie (m²)</Label>
            <Input type="number" value={superficie} min={5} max={2000} onChange={e => setSuperficie(+e.target.value)} />
          </div>
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-semibold text-gray-700">Extras (si aplica)</p>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="w-4 h-4" checked={incluyeBano} onChange={e => setIncluyeBano(e.target.checked)} />
              Incluir reforma de baño completo
            </label>
            {incluyeBano && (
              <Input type="number" value={banos} min={1} max={10} onChange={e => setBanos(+e.target.value)} placeholder="Nº de baños" />
            )}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="w-4 h-4" checked={incluyeCocina} onChange={e => setIncluyeCocina(e.target.checked)} />
              Incluir reforma de cocina completa
            </label>
            {incluyeCocina && (
              <Input type="number" value={cocinas} min={1} max={5} onChange={e => setCocinas(+e.target.value)} placeholder="Nº de cocinas" />
            )}
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-gray-800 mb-4">Estimación de coste</h3>
        <div className="space-y-3">
          <div className="bg-blue-600 text-white rounded-xl p-5 text-center">
            <p className="text-xs uppercase opacity-80 mb-1">Horquilla estimada</p>
            <p className="text-2xl font-bold">{result.min} — {result.max} €</p>
            <p className="text-sm opacity-80 mt-1">Precio medio: ~{result.mid} €</p>
          </div>
          <Result label="Precio por m² (sin extras)" value={`${result.minM2}–${result.maxM2} €/m²`} unit="" />
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ Aviso importante</p>
            <p className="text-xs text-amber-700">
              Precios orientativos para España 2026. No incluyen IVA. Pueden variar significativamente
              según provincia, accesibilidad del local y estado previo. Solicita siempre varios presupuestos.
            </p>
          </div>
          <p className="text-xs text-gray-400">
            Fuente: precios medios de mercado España 2026. Basado en datos del sector de reformas y construcción.
          </p>
        </div>
      </Card>
    </div>
  );
}

// ─── CALCULADORA 6: PRECIOS DE MATERIALES ─────────────────────────────────────

function CalcPrecios() {
  const [busqueda, setBusqueda] = useState("");
  const [catFiltro, setCatFiltro] = useState("Todas");

  const categorias = ["Todas", ...Array.from(new Set(PRECIOS_MATERIALES.map(p => p.cat)))];

  const filtrados = useMemo(() => {
    return PRECIOS_MATERIALES.filter(p => {
      const matchCat = catFiltro === "Todas" || p.cat === catFiltro;
      const matchBusq = busqueda === "" || p.item.toLowerCase().includes(busqueda.toLowerCase());
      return matchCat && matchBusq;
    });
  }, [busqueda, catFiltro]);

  return (
    <div>
      <Card className="mb-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Label>Buscar material o partida</Label>
            <Input
              type="text"
              placeholder="Ej: ladrillo, tubo, cable, pintura..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          <div className="w-full md:w-64">
            <Label>Categoría</Label>
            <Select value={catFiltro} onChange={e => setCatFiltro(e.target.value)}>
              {categorias.map(c => <option key={c}>{c}</option>)}
            </Select>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          {filtrados.length} partidas · Precios orientativos España 2026 (material + m.o. donde se indica) · Sin IVA
        </p>
      </Card>

      <div className="overflow-x-auto rounded-2xl shadow-md bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
              <th className="text-left px-4 py-3 font-semibold w-28">Categoría</th>
              <th className="text-left px-4 py-3 font-semibold">Partida / Material</th>
              <th className="text-center px-4 py-3 font-semibold w-16">Ud.</th>
              <th className="text-right px-4 py-3 font-semibold w-24">Mínimo</th>
              <th className="text-right px-4 py-3 font-semibold w-24">Máximo</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p, i) => (
              <tr key={i} className={`border-t border-gray-100 hover:bg-blue-50 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">{p.cat}</span>
                </td>
                <td className="px-4 py-3 text-gray-800">{p.item}</td>
                <td className="px-4 py-3 text-center text-gray-500">{p.unidad}</td>
                <td className="px-4 py-3 text-right font-semibold text-blue-700">{p.min.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</td>
                <td className="px-4 py-3 text-right font-semibold text-blue-700">{p.max.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">No se encontraron resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── APP PRINCIPAL ─────────────────────────────────────────────────────────────

const TABS = [
  { id: "frigorias", label: "Frigorías A/C", icon: "❄️", comp: CalcFrigorias },
  { id: "cable", label: "Cable Eléctrico", icon: "⚡", comp: CalcCable },
  { id: "escaleras", label: "Escaleras", icon: "📐", comp: CalcEscaleras },
  { id: "pendientes", label: "Pendientes", icon: "📏", comp: CalcPendientes },
  { id: "reforma", label: "Coste Reforma", icon: "🏠", comp: CalcReforma },
  { id: "precios", label: "Precios Material", icon: "📋", comp: CalcPrecios },
];

export default function CalculadorasObra() {
  const [tab, setTab] = useState("frigorias");
  const activeTab = TABS.find(t => t.id === tab);
  const Comp = activeTab?.comp;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">🏗️ Calculadoras de Obra</h1>
          <p className="text-gray-500 mt-2">Herramientas gratuitas para el sector de la construcción · España 2026</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 bg-white p-2 rounded-2xl shadow-sm">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === t.id
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span>{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {Comp && <Comp />}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-8">
          Calculadoras orientativas · Siempre contrasta con un técnico cualificado
        </p>
      </div>
    </div>
  );
}
