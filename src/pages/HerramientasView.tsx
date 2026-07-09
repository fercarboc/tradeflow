import { useState, useMemo, useEffect } from 'react';
import { ActivePage } from '../types';
import { Wrench, ArrowRight, Loader2, RefreshCw, ShoppingCart } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── DATOS ──────────────────────────────────────────────────────────────────

const SECCIONES_STD = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300];

const CAPACIDAD_CABLE: Record<number, { A: number; desc: string }> = {
  1.5: { A: 15, desc: '15 A' }, 2.5: { A: 21, desc: '21 A' },
  4: { A: 27, desc: '27 A' }, 6: { A: 34, desc: '34 A' },
  10: { A: 46, desc: '46 A' }, 16: { A: 62, desc: '62 A' },
  25: { A: 84, desc: '84 A' }, 35: { A: 101, desc: '101 A' },
  50: { A: 120, desc: '120 A' }, 70: { A: 150, desc: '150 A' },
  95: { A: 179, desc: '179 A' }, 120: { A: 204, desc: '204 A' },
};

const PRECIOS_MATERIALES = [
  { cat: 'Albañilería', item: 'Ladrillo cerámico hueco 24x11.5x7 cm', unidad: 'ud', min: 0.15, max: 0.25 },
  { cat: 'Albañilería', item: 'Bloque hormigón 40x20x20 cm', unidad: 'ud', min: 0.90, max: 1.40 },
  { cat: 'Albañilería', item: 'Mortero de cemento M-5 (saco 25 kg)', unidad: 'saco', min: 4.50, max: 7.00 },
  { cat: 'Albañilería', item: 'Yeso proyectado (saco 25 kg)', unidad: 'saco', min: 5.00, max: 8.00 },
  { cat: 'Albañilería', item: 'Tabique pladur 78/400 (doble placa)', unidad: 'm²', min: 28, max: 45 },
  { cat: 'Albañilería', item: 'Enfoscado de cemento exterior', unidad: 'm²', min: 12, max: 22 },
  { cat: 'Albañilería', item: 'Hormigón HA-25 (m³)', unidad: 'm³', min: 85, max: 120 },
  { cat: 'Albañilería', item: 'Ferralla Ø12 (kg)', unidad: 'kg', min: 0.85, max: 1.20 },
  { cat: 'Pavimentos', item: 'Porcelánico rectificado 60x60 (calidad media)', unidad: 'm²', min: 15, max: 35 },
  { cat: 'Pavimentos', item: 'Porcelánico gran formato 90x90', unidad: 'm²', min: 35, max: 80 },
  { cat: 'Pavimentos', item: 'Tarima laminada AC4 8mm', unidad: 'm²', min: 12, max: 25 },
  { cat: 'Pavimentos', item: 'Tarima maciza roble', unidad: 'm²', min: 45, max: 120 },
  { cat: 'Pavimentos', item: 'Azulejo baño 20x60', unidad: 'm²', min: 10, max: 30 },
  { cat: 'Pavimentos', item: 'Microcemento (kit 5 m²)', unidad: 'kit', min: 80, max: 150 },
  { cat: 'Pavimentos', item: 'Cola para pavimento (saco 25 kg)', unidad: 'saco', min: 8, max: 14 },
  { cat: 'Pavimentos', item: 'Junta epóxica (3 kg)', unidad: 'kg', min: 12, max: 20 },
  { cat: 'Pintura', item: 'Pintura plástica blanca interior (15 L)', unidad: 'L', min: 1.80, max: 3.50 },
  { cat: 'Pintura', item: 'Pintura exterior (15 L)', unidad: 'L', min: 2.50, max: 5.00 },
  { cat: 'Pintura', item: 'Pintura antihumedad (4 L)', unidad: 'L', min: 5.00, max: 9.00 },
  { cat: 'Pintura', item: 'Imprimación selladora (5 L)', unidad: 'L', min: 3.00, max: 6.00 },
  { cat: 'Pintura', item: 'Aplicación pintura interior (mano de obra)', unidad: 'm²', min: 5, max: 10 },
  { cat: 'Pintura', item: 'Aplicación pintura fachada (mano de obra)', unidad: 'm²', min: 8, max: 16 },
  { cat: 'Fontanería', item: 'Tubo PVC desagüe Ø110 (3 m)', unidad: 'ud', min: 8, max: 14 },
  { cat: 'Fontanería', item: 'Tubo PVC presión Ø32 (3 m)', unidad: 'ud', min: 5, max: 9 },
  { cat: 'Fontanería', item: 'Tubo multicapa 16mm (m)', unidad: 'm', min: 1.20, max: 2.00 },
  { cat: 'Fontanería', item: 'Inodoro suspendido (calidad media)', unidad: 'ud', min: 120, max: 350 },
  { cat: 'Fontanería', item: 'Lavabo sobre encimera', unidad: 'ud', min: 80, max: 300 },
  { cat: 'Fontanería', item: 'Plato de ducha 80x80 acrílico', unidad: 'ud', min: 60, max: 200 },
  { cat: 'Fontanería', item: 'Grifo monomando lavabo', unidad: 'ud', min: 35, max: 150 },
  { cat: 'Fontanería', item: 'Calentador de agua 80 L', unidad: 'ud', min: 180, max: 450 },
  { cat: 'Fontanería', item: 'Caldera de gas condensación', unidad: 'ud', min: 800, max: 2200 },
  { cat: 'Electricidad', item: 'Cable H07V-K 2.5mm² (rollo 100m)', unidad: 'rollo', min: 35, max: 55 },
  { cat: 'Electricidad', item: 'Cable H07V-K 6mm² (rollo 100m)', unidad: 'rollo', min: 70, max: 110 },
  { cat: 'Electricidad', item: 'Caja empotrar mecanismo Simon/BJC', unidad: 'ud', min: 0.50, max: 1.50 },
  { cat: 'Electricidad', item: 'Interruptor 10A (mecanismo)', unidad: 'ud', min: 4, max: 15 },
  { cat: 'Electricidad', item: 'Base enchufe 16A 2P+T', unidad: 'ud', min: 4, max: 18 },
  { cat: 'Electricidad', item: 'IGA 25A (interruptor general)', unidad: 'ud', min: 18, max: 35 },
  { cat: 'Electricidad', item: 'Cuadro distribución 16 módulos', unidad: 'ud', min: 40, max: 80 },
  { cat: 'Electricidad', item: 'Luminaria LED downlight 12W', unidad: 'ud', min: 8, max: 25 },
  { cat: 'Electricidad', item: 'Instalación punto de luz (m.o.)', unidad: 'ud', min: 45, max: 90 },
  { cat: 'Climatización', item: 'Split 1x1 2500 frig (inverter)', unidad: 'ud', min: 350, max: 700 },
  { cat: 'Climatización', item: 'Split 1x1 3000 frig (inverter)', unidad: 'ud', min: 450, max: 900 },
  { cat: 'Climatización', item: 'Split 1x1 5000 frig (inverter)', unidad: 'ud', min: 650, max: 1400 },
  { cat: 'Climatización', item: 'Multisplit 2x1 (2500+2500 frig)', unidad: 'ud', min: 900, max: 1800 },
  { cat: 'Climatización', item: 'Aerotermia monobloc 8kW', unidad: 'ud', min: 2800, max: 5500 },
  { cat: 'Climatización', item: 'Radiador bajo consumo 9 elementos', unidad: 'ud', min: 60, max: 180 },
  { cat: 'Climatización', item: 'Instalación split + cargos (m.o.)', unidad: 'ud', min: 180, max: 350 },
  { cat: 'Carpintería', item: 'Puerta de paso interior lacada 80cm', unidad: 'ud', min: 180, max: 500 },
  { cat: 'Carpintería', item: 'Puerta blindada entrada', unidad: 'ud', min: 600, max: 1800 },
  { cat: 'Carpintería', item: 'Ventana PVC doble acristalamiento 100x100', unidad: 'ud', min: 250, max: 600 },
  { cat: 'Carpintería', item: 'Ventana aluminio rotura puente 120x120', unidad: 'ud', min: 350, max: 800 },
  { cat: 'Carpintería', item: 'Armario empotrado 3 puertas (2.5m)', unidad: 'ud', min: 600, max: 2500 },
  { cat: 'Carpintería', item: 'Mueble cocina metro lineal (bajo)', unidad: 'm', min: 200, max: 600 },
  { cat: 'Aislamiento', item: 'Lana de roca 60mm (m²)', unidad: 'm²', min: 5, max: 10 },
  { cat: 'Aislamiento', item: 'Poliestireno expandido EPS 60mm (m²)', unidad: 'm²', min: 4, max: 8 },
  { cat: 'Aislamiento', item: 'Membrana impermeabilizante autoadhesiva', unidad: 'm²', min: 8, max: 18 },
  { cat: 'Aislamiento', item: 'Proyección poliuretano 5cm', unidad: 'm²', min: 12, max: 22 },
  { cat: 'Mano de obra', item: 'Oficial 1ª construcción (hora)', unidad: 'h', min: 22, max: 32 },
  { cat: 'Mano de obra', item: 'Peón ayuda (hora)', unidad: 'h', min: 16, max: 22 },
  { cat: 'Mano de obra', item: 'Oficial 1ª fontanero (hora)', unidad: 'h', min: 25, max: 38 },
  { cat: 'Mano de obra', item: 'Oficial 1ª electricista (hora)', unidad: 'h', min: 25, max: 38 },
  { cat: 'Mano de obra', item: 'Oficial 1ª carpintero (hora)', unidad: 'h', min: 24, max: 36 },
];

// ─── COMPONENTES UI ──────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-md p-6 ${className}`}>{children}</div>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-gray-700 mb-1">{children}</label>;
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50';
const selectCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50';

function Result({ label, value, warning = false, highlight = false }: {
  label: string; value: string; warning?: boolean; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 flex justify-between items-center ${
      warning ? 'bg-amber-50 border border-amber-200' :
      highlight ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
    }`}>
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`font-bold text-base ${warning ? 'text-amber-700' : highlight ? 'text-blue-700' : 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  );
}

function Badge({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  if (ok === null) return <span className="inline-block text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">ℹ️ {children}</span>;
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {ok ? '✓' : '✗'} {children}
    </span>
  );
}

// ─── CALCULADORA 1: FRIGORÍAS ─────────────────────────────────────────────────

function CalcFrigorias() {
  const [m2, setM2] = useState(20);
  const [altura, setAltura] = useState(2.5);
  const [zona, setZona] = useState('C');
  const [orient, setOrient] = useState('sur');
  const [aislamiento, setAislamiento] = useState('normal');
  const [personas, setPersonas] = useState(2);
  const [ventanas, setVentanas] = useState(20);

  const result = useMemo(() => {
    const baseWm2: Record<string, number> = { A: 140, B: 120, C: 100, D: 80, E: 65 };
    const factorOrient: Record<string, number> = { norte: 0.9, este: 1.0, sur: 1.1, oeste: 1.2, sureste: 1.05, suroeste: 1.15 };
    const factorAisl: Record<string, number> = { malo: 1.25, normal: 1.0, bueno: 0.85 };
    const factorAltura = altura > 2.7 ? 1 + (altura - 2.7) * 0.1 : 1;
    const factorVentanas = 1 + (ventanas - 15) * 0.005;
    const potBase = m2 * baseWm2[zona];
    const potCorr = potBase * factorOrient[orient] * factorAisl[aislamiento] * factorAltura * factorVentanas;
    const potTotal = potCorr + personas * 100;
    const frigorias = Math.round(potTotal * 0.86);
    const kw = (potTotal / 1000).toFixed(2);
    const btu = Math.round(potTotal * 3.412);
    let recomendacion = '';
    if (frigorias < 1500) recomendacion = 'Split 1x1 de 1.5 kW';
    else if (frigorias < 2500) recomendacion = 'Split 1x1 de 2.5 kW (2.150 frig)';
    else if (frigorias < 3500) recomendacion = 'Split 1x1 de 3.5 kW (3.010 frig)';
    else if (frigorias < 5000) recomendacion = 'Split 1x1 de 5 kW (4.300 frig)';
    else if (frigorias < 7000) recomendacion = 'Split 1x1 de 7 kW (6.020 frig)';
    else recomendacion = 'Equipo conductos o multisplit';
    return { frigorias: frigorias.toLocaleString('es-ES'), kw, btu: btu.toLocaleString('es-ES'), recomendacion };
  }, [m2, altura, zona, orient, aislamiento, personas, ventanas]);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <h3 className="font-bold text-gray-800 mb-4">Datos del espacio</h3>
        <div className="space-y-4">
          <div><Lbl>Superficie (m²)</Lbl><input className={inputCls} type="number" value={m2} min={5} max={500} onChange={e => setM2(+e.target.value)} /></div>
          <div><Lbl>Altura libre (m)</Lbl><input className={inputCls} type="number" value={altura} min={2} max={6} step={0.1} onChange={e => setAltura(+e.target.value)} /></div>
          <div>
            <Lbl>Zona climática España</Lbl>
            <select className={selectCls} value={zona} onChange={e => setZona(e.target.value)}>
              <option value="A">A — Extremadamente cálida (Almería, Málaga)</option>
              <option value="B">B — Muy cálida (Sevilla, Murcia, Alicante)</option>
              <option value="C">C — Cálida (Madrid, Barcelona, Valencia)</option>
              <option value="D">D — Moderada (Valladolid, Salamanca)</option>
              <option value="E">E — Fría (Burgos, Ávila, Soria)</option>
            </select>
          </div>
          <div>
            <Lbl>Orientación principal</Lbl>
            <select className={selectCls} value={orient} onChange={e => setOrient(e.target.value)}>
              <option value="norte">Norte (menor ganancia solar)</option>
              <option value="este">Este</option>
              <option value="sureste">Sureste</option>
              <option value="sur">Sur</option>
              <option value="suroeste">Suroeste</option>
              <option value="oeste">Oeste (mayor ganancia solar)</option>
            </select>
          </div>
          <div>
            <Lbl>Aislamiento del local</Lbl>
            <select className={selectCls} value={aislamiento} onChange={e => setAislamiento(e.target.value)}>
              <option value="malo">Malo (edificio antiguo sin aislar)</option>
              <option value="normal">Normal (construcción estándar)</option>
              <option value="bueno">Bueno (CTE 2020 o superior)</option>
            </select>
          </div>
          <div><Lbl>Personas habitualmente</Lbl><input className={inputCls} type="number" value={personas} min={0} max={50} onChange={e => setPersonas(+e.target.value)} /></div>
          <div><Lbl>% superficie de ventanas estimada</Lbl><input className={inputCls} type="number" value={ventanas} min={0} max={80} onChange={e => setVentanas(+e.target.value)} /></div>
        </div>
      </Card>
      <Card>
        <h3 className="font-bold text-gray-800 mb-4">Resultado</h3>
        <div className="space-y-3">
          <Result label="Potencia en frigorías" value={`${result.frigorias} frig`} highlight />
          <Result label="Potencia en kW" value={`${result.kw} kW`} />
          <Result label="Potencia en BTU/h" value={`${result.btu} BTU/h`} />
          <div className="mt-4 bg-blue-600 text-white rounded-xl p-4">
            <p className="text-xs uppercase font-semibold opacity-80 mb-1">Equipo recomendado</p>
            <p className="font-bold">{result.recomendacion}</p>
          </div>
          <p className="text-xs text-gray-400 mt-2">Cálculo orientativo. Para instalaciones oficiales consultar RITE/UNE-EN 15255.</p>
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
  const [material, setMaterial] = useState('cobre');
  const [cosPhi, setCosPhi] = useState(1);

  const result = useMemo(() => {
    const gamma = material === 'cobre' ? 56 : 34;
    const deltU = tension * (caida / 100);
    const I = potencia / (tension * cosPhi);
    const S_tension = (2 * longitud * potencia) / (gamma * deltU * tension);
    let S_intensidad = 300;
    for (const s of SECCIONES_STD) {
      if (CAPACIDAD_CABLE[s] && CAPACIDAD_CABLE[s].A >= I) { S_intensidad = s; break; }
    }
    const S_necesaria = Math.max(S_tension, S_intensidad);
    const S_std = SECCIONES_STD.find(s => s >= S_necesaria) || 300;
    const deltU_real = (2 * longitud * potencia) / (gamma * S_std * tension);
    const pct_real = (deltU_real / tension) * 100;
    return {
      I: I.toFixed(1),
      S_tension: S_tension.toFixed(2),
      S_std,
      pct_real: pct_real.toFixed(2),
      deltU_real: deltU_real.toFixed(1),
      ok_tension: pct_real <= caida,
      ok_corriente: !!(CAPACIDAD_CABLE[S_std] && CAPACIDAD_CABLE[S_std].A >= I),
      I_adm: CAPACIDAD_CABLE[S_std]?.desc || '>200 A',
    };
  }, [potencia, longitud, tension, caida, material, cosPhi]);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <h3 className="font-bold text-gray-800 mb-4">Datos del circuito</h3>
        <div className="space-y-4">
          <div><Lbl>Potencia a transportar (W)</Lbl><input className={inputCls} type="number" value={potencia} min={100} max={500000} onChange={e => setPotencia(+e.target.value)} /></div>
          <div><Lbl>Longitud del tramo (m — ida solamente)</Lbl><input className={inputCls} type="number" value={longitud} min={1} max={500} onChange={e => setLongitud(+e.target.value)} /></div>
          <div>
            <Lbl>Tensión de suministro</Lbl>
            <select className={selectCls} value={tension} onChange={e => setTension(+e.target.value)}>
              <option value={230}>230 V — Monofásico</option>
              <option value={400}>400 V — Trifásico</option>
            </select>
          </div>
          <div>
            <Lbl>Caída de tensión máxima admisible</Lbl>
            <select className={selectCls} value={caida} onChange={e => setCaida(+e.target.value)}>
              <option value={3}>3% — Alumbrado (REBT ITC-BT-19)</option>
              <option value={5}>5% — Fuerza / otros usos</option>
              <option value={1.5}>1.5% — Receptores sensibles</option>
            </select>
          </div>
          <div>
            <Lbl>Material conductor</Lbl>
            <select className={selectCls} value={material} onChange={e => setMaterial(e.target.value)}>
              <option value="cobre">Cobre (γ = 56 m/Ω·mm²)</option>
              <option value="aluminio">Aluminio (γ = 34 m/Ω·mm²)</option>
            </select>
          </div>
          <div>
            <Lbl>Factor de potencia cos φ</Lbl>
            <select className={selectCls} value={cosPhi} onChange={e => setCosPhi(+e.target.value)}>
              <option value={1}>1,0 — Cargas resistivas</option>
              <option value={0.9}>0,9 — Motores pequeños</option>
              <option value={0.85}>0,85 — Motores industriales</option>
              <option value={0.8}>0,8 — Cargas inductivas grandes</option>
            </select>
          </div>
        </div>
      </Card>
      <Card>
        <h3 className="font-bold text-gray-800 mb-4">Resultado (REBT ITC-BT-19)</h3>
        <div className="space-y-3">
          <Result label="Intensidad de corriente" value={`${result.I} A`} />
          <Result label="Sección mínima por c.d.t." value={`${result.S_tension} mm²`} />
          <Result label="Sección normalizada a instalar" value={`${result.S_std} mm²`} highlight />
          <Result label="Caída de tensión real" value={`${result.pct_real}% (${result.deltU_real} V)`} warning={!result.ok_tension} />
          <Result label="Intensidad admisible del cable" value={result.I_adm} />
          <div className="flex gap-2 flex-wrap mt-2">
            <Badge ok={result.ok_tension}>Caída de tensión ≤ {caida}%</Badge>
            <Badge ok={result.ok_corriente}>Capacidad térmica OK</Badge>
          </div>
          <p className="text-xs text-gray-400 mt-2">Calculado según REBT ITC-BT-19. No incluye correcciones por temperatura ni agrupamiento.</p>
        </div>
      </Card>
    </div>
  );
}

// ─── CALCULADORA 3: ESCALERAS ─────────────────────────────────────────────────

function CalcEscaleras() {
  const [alturaPlanta, setAlturaPlanta] = useState(280);
  const [contrahuellaDeseada, setContrahuellaDeseada] = useState(17);
  const [uso, setUso] = useState('privado');

  const result = useMemo(() => {
    const numPeldanios = Math.round(alturaPlanta / contrahuellaDeseada);
    const chReal = alturaPlanta / numPeldanios;
    const huella = 63 - 2 * chReal;
    const longitudTotal = (huella * numPeldanios) / 100;
    const hMax = uso === 'privado' ? 18.5 : 17.5;
    const blondelCheck = 2 * chReal + huella;
    return {
      numPeldanios,
      chReal: chReal.toFixed(1),
      huella: huella.toFixed(1),
      longitudTotal: longitudTotal.toFixed(2),
      blondelCheck: blondelCheck.toFixed(1),
      ok_hMax: chReal <= hMax,
      ok_hMin: chReal >= 13,
      ok_dMin: huella >= 28,
      ok_blondel: blondelCheck >= 54 && blondelCheck <= 70,
      hMax,
    };
  }, [alturaPlanta, contrahuellaDeseada, uso]);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <h3 className="font-bold text-gray-800 mb-4">Datos de la escalera</h3>
        <div className="space-y-4">
          <div>
            <Lbl>Altura total a salvar (cm)</Lbl>
            <input className={inputCls} type="number" value={alturaPlanta} min={100} max={1000} onChange={e => setAlturaPlanta(+e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">Altura libre de planta (suelo a suelo)</p>
          </div>
          <div>
            <Lbl>Contrahuella deseada (cm)</Lbl>
            <input className={inputCls} type="number" value={contrahuellaDeseada} min={13} max={20} step={0.5} onChange={e => setContrahuellaDeseada(+e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">Recomendado: 16–18 cm</p>
          </div>
          <div>
            <Lbl>Tipo de uso</Lbl>
            <select className={selectCls} value={uso} onChange={e => setUso(e.target.value)}>
              <option value="privado">Uso privado (vivienda unifamiliar)</option>
              <option value="publico">Uso restringido / público</option>
            </select>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 mt-2">
            <p className="text-xs font-semibold text-amber-700 mb-1">Ley de Blondel</p>
            <p className="text-sm text-amber-800">2 × contrahuella + huella = 63 cm · Rango: 54–70 cm</p>
          </div>
        </div>
      </Card>
      <Card>
        <h3 className="font-bold text-gray-800 mb-4">Resultado (CTE DB-SUA-1)</h3>
        <div className="space-y-3">
          <Result label="Número de peldaños" value={`${result.numPeldanios} ud`} highlight />
          <Result label="Contrahuella real" value={`${result.chReal} cm`} />
          <Result label="Huella (Ley de Blondel)" value={`${result.huella} cm`} />
          <Result label="Comprobación Blondel (2h+d)" value={`${result.blondelCheck} cm`} />
          <Result label="Longitud horizontal total" value={`${result.longitudTotal} m`} />
          <div className="flex gap-2 flex-wrap mt-2">
            <Badge ok={result.ok_hMax}>Contrahuella ≤ {result.hMax} cm</Badge>
            <Badge ok={result.ok_hMin}>Contrahuella ≥ 13 cm</Badge>
            <Badge ok={result.ok_dMin}>Huella ≥ 28 cm</Badge>
            <Badge ok={result.ok_blondel}>Blondel 54–70 cm</Badge>
          </div>
          <p className="text-xs text-gray-400 mt-2">CTE DB-SUA-1 Tabla 4.1. Verifica barandillas y ancho mínimo normativo.</p>
        </div>
      </Card>
    </div>
  );
}

// ─── CALCULADORA 4: PENDIENTES ─────────────────────────────────────────────────

function CalcPendientes() {
  const [modo, setModo] = useState('calcular_pendiente');
  const [desnivel, setDesnivel] = useState(10);
  const [longitud, setLongitud] = useState(100);
  const [pendientePct, setPendientePct] = useState(2);
  const [tipo, setTipo] = useState('saneamiento');

  const result = useMemo(() => {
    let pendiente: number, desnivelCalc: number, longitudCalc: number;
    if (modo === 'calcular_pendiente') {
      pendiente = (desnivel / longitud) * 100; desnivelCalc = desnivel; longitudCalc = longitud;
    } else if (modo === 'calcular_desnivel') {
      pendiente = pendientePct; longitudCalc = longitud; desnivelCalc = (pendientePct / 100) * longitud;
    } else {
      pendiente = pendientePct; desnivelCalc = desnivel; longitudCalc = (desnivel / pendientePct) * 100;
    }
    let checks: { label: string; ok: boolean | null }[] = [];
    if (tipo === 'saneamiento') {
      checks = [
        { label: 'Mín. CTE HS-5 para Ø50mm: 2%', ok: pendiente >= 2 },
        { label: 'Mín. CTE HS-5 para Ø75mm: 1.5%', ok: pendiente >= 1.5 },
        { label: 'Mín. CTE HS-5 para Ø100mm: 1%', ok: pendiente >= 1 },
        { label: 'Mín. CTE HS-5 para Ø≥150mm: 0.5%', ok: pendiente >= 0.5 },
      ];
    } else if (tipo === 'rampa_normal') {
      const maxPct = longitudCalc < 300 ? 12 : longitudCalc < 600 ? 10 : 8;
      checks = [{ label: `Máx. CTE DB-SUA: ${maxPct}%`, ok: pendiente <= maxPct }];
    } else if (tipo === 'rampa_accesible') {
      const maxPct = longitudCalc < 300 ? 8 : longitudCalc < 600 ? 6 : 5;
      checks = [
        { label: `Máx. CTE DB-SUA accesible: ${maxPct}%`, ok: pendiente <= maxPct },
        { label: 'Ancho mínimo libre 1,20 m (comprobar)', ok: null },
      ];
    } else {
      checks = [
        { label: 'Mín. CTE DB-HS1 cubierta convencional: 1%', ok: pendiente >= 1 },
        { label: 'Recomendado cubierta ajardinada: ≥ 2%', ok: pendiente >= 2 },
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
            <Lbl>Tipo de elemento</Lbl>
            <select className={selectCls} value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="saneamiento">Saneamiento / desagüe (CTE HS-5)</option>
              <option value="rampa_normal">Rampa uso general (CTE DB-SUA)</option>
              <option value="rampa_accesible">Rampa accesible (CTE DB-SUA)</option>
              <option value="cubierta_plana">Cubierta plana / tejado (CTE DB-HS1)</option>
            </select>
          </div>
          <div>
            <Lbl>Quiero calcular…</Lbl>
            <select className={selectCls} value={modo} onChange={e => setModo(e.target.value)}>
              <option value="calcular_pendiente">La pendiente (%) — doy desnivel y longitud</option>
              <option value="calcular_desnivel">El desnivel (cm) — doy pendiente y longitud</option>
              <option value="calcular_longitud">La longitud — doy pendiente y desnivel</option>
            </select>
          </div>
          {(modo === 'calcular_pendiente' || modo === 'calcular_longitud') && (
            <div><Lbl>Desnivel / diferencia de cota (cm)</Lbl><input className={inputCls} type="number" value={desnivel} min={0} step={0.5} onChange={e => setDesnivel(+e.target.value)} /></div>
          )}
          {(modo === 'calcular_pendiente' || modo === 'calcular_desnivel') && (
            <div><Lbl>Longitud horizontal (cm)</Lbl><input className={inputCls} type="number" value={longitud} min={1} onChange={e => setLongitud(+e.target.value)} /></div>
          )}
          {(modo === 'calcular_desnivel' || modo === 'calcular_longitud') && (
            <div><Lbl>Pendiente (%)</Lbl><input className={inputCls} type="number" value={pendientePct} min={0} max={100} step={0.1} onChange={e => setPendientePct(+e.target.value)} /></div>
          )}
        </div>
      </Card>
      <Card>
        <h3 className="font-bold text-gray-800 mb-4">Resultado</h3>
        <div className="space-y-3">
          <Result label="Pendiente" value={`${result.pendiente}%`} highlight />
          <Result label="Ángulo" value={`${result.pendienteDeg}°`} />
          <Result label="Desnivel" value={`${result.desnivel} cm`} />
          <Result label="Longitud horizontal" value={`${result.longitud} cm`} />
          <div className="space-y-2 mt-2">
            {result.checks.map((c, i) => (
              <div key={i} className={`flex items-center gap-2 text-sm p-2 rounded-lg ${
                c.ok === null ? 'bg-gray-50 text-gray-600' : c.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                <span>{c.ok === null ? 'ℹ️' : c.ok ? '✓' : '✗'}</span>
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

const PRECIOS_REFORMA: Record<string, { low: [number,number]; med: [number,number]; high: [number,number]; label: string }> = {
  integral:   { low: [200,350],  med: [350,600],  high: [600,1400],  label: 'Reforma integral (por m²)' },
  pintura:    { low: [5,8],      med: [8,13],     high: [13,22],     label: 'Pintura interior (por m²)' },
  solado:     { low: [20,35],    med: [35,70],    high: [70,150],    label: 'Solado / pavimento (por m²)' },
  alicatado:  { low: [25,45],    med: [45,90],    high: [90,180],    label: 'Alicatado (por m²)' },
  tabiqueria: { low: [25,40],    med: [40,65],    high: [65,110],    label: 'Tabiquería pladur (por m²)' },
  cubierta:   { low: [30,55],    med: [55,100],   high: [100,200],   label: 'Cubierta / tejado (por m²)' },
};
const PRECIOS_BANO: Record<string, [number,number]> = { low: [2500,4500], med: [4500,8000], high: [8000,20000] };
const PRECIOS_COCINA: Record<string, [number,number]> = { low: [3000,6000], med: [6000,14000], high: [14000,35000] };

function CalcReforma() {
  const [tipo, setTipo] = useState('integral');
  const [calidad, setCalidad] = useState('med');
  const [superficie, setSuperficie] = useState(80);
  const [banos, setBanos] = useState(1);
  const [cocinas, setCocinas] = useState(1);
  const [incluyeBano, setIncluyeBano] = useState(false);
  const [incluyeCocina, setIncluyeCocina] = useState(false);

  const result = useMemo(() => {
    const r = PRECIOS_REFORMA[tipo];
    const rango = r[calidad as 'low'|'med'|'high'];
    const minM2 = rango[0] * superficie;
    const maxM2 = rango[1] * superficie;
    let minExtra = 0, maxExtra = 0;
    if (incluyeBano)   { minExtra += PRECIOS_BANO[calidad][0] * banos;   maxExtra += PRECIOS_BANO[calidad][1] * banos; }
    if (incluyeCocina) { minExtra += PRECIOS_COCINA[calidad][0] * cocinas; maxExtra += PRECIOS_COCINA[calidad][1] * cocinas; }
    const min = minM2 + minExtra;
    const max = maxM2 + maxExtra;
    return {
      min: Math.round(min).toLocaleString('es-ES'),
      max: Math.round(max).toLocaleString('es-ES'),
      mid: Math.round((min + max) / 2).toLocaleString('es-ES'),
      minM2: rango[0], maxM2: rango[1],
    };
  }, [tipo, calidad, superficie, banos, cocinas, incluyeBano, incluyeCocina]);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <h3 className="font-bold text-gray-800 mb-4">Parámetros de la obra</h3>
        <div className="space-y-4">
          <div>
            <Lbl>Tipo de trabajo</Lbl>
            <select className={selectCls} value={tipo} onChange={e => setTipo(e.target.value)}>
              {Object.entries(PRECIOS_REFORMA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <Lbl>Nivel de calidad / acabados</Lbl>
            <select className={selectCls} value={calidad} onChange={e => setCalidad(e.target.value)}>
              <option value="low">Económico (materiales básicos)</option>
              <option value="med">Estándar (calidad media, buen acabado)</option>
              <option value="high">Premium (materiales alta gama)</option>
            </select>
          </div>
          <div><Lbl>Superficie (m²)</Lbl><input className={inputCls} type="number" value={superficie} min={5} max={2000} onChange={e => setSuperficie(+e.target.value)} /></div>
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-semibold text-gray-700">Extras (si aplica)</p>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="w-4 h-4" checked={incluyeBano} onChange={e => setIncluyeBano(e.target.checked)} />
              Incluir reforma de baño completo
            </label>
            {incluyeBano && <input className={inputCls} type="number" value={banos} min={1} max={10} onChange={e => setBanos(+e.target.value)} placeholder="Nº de baños" />}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="w-4 h-4" checked={incluyeCocina} onChange={e => setIncluyeCocina(e.target.checked)} />
              Incluir reforma de cocina completa
            </label>
            {incluyeCocina && <input className={inputCls} type="number" value={cocinas} min={1} max={5} onChange={e => setCocinas(+e.target.value)} placeholder="Nº de cocinas" />}
          </div>
        </div>
      </Card>
      <Card>
        <h3 className="font-bold text-gray-800 mb-4">Estimación de coste</h3>
        <div className="space-y-3">
          <div className="bg-blue-600 text-white rounded-xl p-5 text-center">
            <p className="text-xs uppercase opacity-80 mb-1">Horquilla estimada (sin IVA)</p>
            <p className="text-2xl font-bold">{result.min} — {result.max} €</p>
            <p className="text-sm opacity-80 mt-1">Precio medio: ~{result.mid} €</p>
          </div>
          <Result label="Precio por m² (sin extras)" value={`${result.minM2}–${result.maxM2} €/m²`} />
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ Aviso</p>
            <p className="text-xs text-amber-700">Precios orientativos España 2026. Sin IVA. Pueden variar según provincia y estado previo. Solicita siempre varios presupuestos.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── CALCULADORA 6: PRECIOS DE MATERIALES ─────────────────────────────────────

interface CatalogItem {
  id: string;
  familia: string;
  descripcion: string;
  unidad: string;
  precio_referencia: number;
  marca_sugerida?: string;
  fuente: string;
}

const CATALOGOS = [
  { key: 'base',    label: 'TrabFlow Base', available: true,  color: '#1A5A96' },
  { key: 'obramat', label: 'OBRAMAT',       available: false, color: '#E85B00' },
  { key: 'leroy',   label: 'Leroy Merlin',  available: false, color: '#007A33' },
] as const;

type CatalogoKey = typeof CATALOGOS[number]['key'];

function CalcPrecios() {
  const [catalogSource, setCatalogSource] = useState<CatalogoKey>('base');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [catFiltro, setCatFiltro] = useState('Todas');

  useEffect(() => {
    if (catalogSource !== 'base') return;
    setLoading(true);
    setError(null);
    supabase
      .from('trade_global_catalog')
      .select('id, familia, descripcion, unidad, precio_referencia, marca_sugerida')
      .eq('activo', true)
      .order('familia')
      .order('descripcion')
      .then(({ data, error: err }) => {
        setLoading(false);
        if (err || !data) {
          setError('No se pudo cargar el catálogo. Mostrando precios orientativos.');
          setItems(PRECIOS_MATERIALES.map((p, i) => ({
            id: String(i),
            familia: p.cat,
            descripcion: p.item,
            unidad: p.unidad,
            precio_referencia: (p.min + p.max) / 2,
            fuente: 'Orientativo',
          })));
        } else {
          setItems(data.map(d => ({ ...d, fuente: 'TrabFlow Base' })));
        }
      });
  }, [catalogSource]);

  const categorias = useMemo(() => ['Todas', ...Array.from(new Set(items.map(i => i.familia))).sort()], [items]);

  const filtrados = useMemo(() => items.filter(p => {
    const matchCat = catFiltro === 'Todas' || p.familia === catFiltro;
    const matchBusq = busqueda === '' ||
      p.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.familia.toLowerCase().includes(busqueda.toLowerCase());
    return matchCat && matchBusq;
  }), [items, busqueda, catFiltro]);

  return (
    <div>
      {/* Selector de catálogo */}
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {CATALOGOS.map(cat => (
            <button
              key={cat.key}
              onClick={() => cat.available && setCatalogSource(cat.key)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                catalogSource === cat.key
                  ? 'bg-blue-600 text-white border-blue-600 shadow'
                  : cat.available
                    ? 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                    : 'bg-gray-50 text-gray-400 border-gray-100 cursor-default'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              {cat.label}
              {!cat.available && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">pronto</span>
              )}
            </button>
          ))}
        </div>

        {catalogSource === 'base' && (
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Lbl>Buscar material o partida</Lbl>
              <input
                className={inputCls}
                type="text"
                placeholder="Ej: cable, tubo, ladrillo, split..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>
            <div className="w-full md:w-60">
              <Lbl>Familia</Lbl>
              <select className={selectCls} value={catFiltro} onChange={e => setCatFiltro(e.target.value)}>
                {categorias.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-400 mt-3">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando catálogo…
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
            <RefreshCw className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}
        {!loading && !error && items.length > 0 && (
          <p className="text-xs text-gray-400 mt-3">
            {filtrados.length} partidas · Catálogo {CATALOGOS.find(c => c.key === catalogSource)?.label} · Precios sin IVA
          </p>
        )}
      </Card>

      {/* Tabla — solo cuando hay datos */}
      {catalogSource === 'base' && !loading && (
        <div className="overflow-x-auto rounded-2xl shadow-md bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
                <th className="text-left px-4 py-3 font-semibold w-28">Familia</th>
                <th className="text-left px-4 py-3 font-semibold">Descripción</th>
                <th className="text-center px-4 py-3 font-semibold w-16">Ud.</th>
                <th className="text-right px-4 py-3 font-semibold w-28">Precio ref.</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p, i) => (
                <tr
                  key={p.id}
                  className={`border-t border-gray-100 hover:bg-blue-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                >
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">{p.familia}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-800">
                    {p.descripcion}
                    {p.marca_sugerida && (
                      <span className="ml-2 text-xs text-gray-400">· {p.marca_sugerida}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{p.unidad}</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700">
                    {p.precio_referencia.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-gray-400">No se encontraron resultados</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Placeholder proveedores no disponibles */}
      {catalogSource !== 'base' && (
        <Card className="text-center py-12">
          <ShoppingCart className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-500">Catálogo {CATALOGOS.find(c => c.key === catalogSource)?.label} próximamente</p>
          <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
            Estamos integrando precios en tiempo real de distribuidores. Mientras tanto usa el catálogo base de TrabFlow.
          </p>
          <button onClick={() => setCatalogSource('base')} className="mt-4 text-sm text-blue-600 underline cursor-pointer">
            Ver catálogo base
          </button>
        </Card>
      )}
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'frigorias',  label: 'Frigorías A/C',    icon: '❄️',  Comp: CalcFrigorias },
  { id: 'cable',      label: 'Cable Eléctrico',   icon: '⚡',  Comp: CalcCable },
  { id: 'escaleras',  label: 'Escaleras CTE',     icon: '📐',  Comp: CalcEscaleras },
  { id: 'pendientes', label: 'Pendientes',         icon: '📏',  Comp: CalcPendientes },
  { id: 'reforma',    label: 'Coste Reforma',      icon: '🏠',  Comp: CalcReforma },
  { id: 'precios',    label: 'Precios Material',   icon: '📋',  Comp: CalcPrecios },
] as const;

// ─── PÁGINA ────────────────────────────────────────────────────────────────────

interface Props {
  go: (page: ActivePage) => void;
}

export default function HerramientasView({ go }: Props) {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('frigorias');
  const activeTab = TABS.find(t => t.id === tab)!;
  const { Comp } = activeTab;

  return (
    <div className="bg-[#020B16] min-h-screen">

      {/* ── Hero ── */}
      <section className="relative py-14 px-4 overflow-hidden" style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 0%, #0b1e3a 0%, #020B16 70%)' }}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="relative max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-[#00CFE8]/10 border border-[#00CFE8]/25 rounded-full px-4 py-1.5">
            <Wrench className="w-3.5 h-3.5 text-[#00CFE8]" />
            <span className="text-[#00CFE8] text-xs font-semibold uppercase tracking-widest">Herramientas gratuitas</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
            Calculadoras de obra<br />
            <span className="text-[#FFC400]">para profesionales</span>
          </h1>
          <p className="text-white/50 text-base max-w-xl mx-auto">
            Frigorías, sección de cable, escaleras CTE, pendientes, costes de reforma y precios de materiales — todo actualizado a España 2026.
          </p>
        </div>
      </section>

      {/* ── Calculadoras ── */}
      <div className="max-w-5xl mx-auto px-4 pb-20">

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 bg-slate-900/60 border border-white/10 p-2 rounded-2xl">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                tab === t.id
                  ? 'bg-[#00CFE8] text-[#020B16] shadow-md'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <Comp />

        <p className="text-center text-xs text-white/20 mt-8">
          Calculadoras orientativas · Contrasta siempre con un técnico cualificado · España 2026
        </p>
      </div>

      {/* ── CTA ── */}
      <div className="border-t border-white/10 bg-[#020B16]">
        <div className="max-w-4xl mx-auto px-4 py-12 text-center space-y-4">
          <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">¿Quieres que TrabFlow haga los presupuestos por ti?</p>
          <h2 className="text-2xl sm:text-3xl font-black text-white">De la voz al presupuesto en segundos</h2>
          <p className="text-white/50 text-sm max-w-md mx-auto">Dictas el trabajo, la IA calcula y envía el presupuesto por WhatsApp. Prueba gratis 90 días.</p>
          <button
            onClick={() => go(ActivePage.Registro)}
            className="inline-flex items-center gap-2 bg-[#FFC400] hover:brightness-110 text-[#020B16] font-black text-sm uppercase tracking-widest px-8 py-3.5 rounded-lg transition-all shadow-xl shadow-[#FFC400]/20 cursor-pointer"
          >
            Prueba gratis — 90 días
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
}
