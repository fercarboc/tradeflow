// Catálogo inicial de partidas de limpieza y función de propuesta.
// Las partidas son SUGERIDAS — el profesional puede añadir, editar, eliminar.
// NO se incluyen precios universales: precio 0, requiere_revision = true.
// El profesional aplica su tarifa.

import { CleaningQuoteIntake, SpaceType, ServiceType } from './cleaningIntake';

export interface CleaningLineItemTemplate {
  id: string;
  categoria: string;     // agrupación visible en UI
  descripcion: string;
  unidad: 'ud' | 'hora' | 'm2' | 'ml' | 'mes' | 'visita';
  tipo: 'material' | 'mano_de_obra';
  // Condición que activa la inclusión de esta partida en la propuesta.
  when: (intake: Partial<CleaningQuoteIntake>) => boolean;
}

const ALWAYS = (_: Partial<CleaningQuoteIntake>) => true;
const hasSpace = (...s: SpaceType[]) => (i: Partial<CleaningQuoteIntake>) =>
  s.includes(i.spaceType as SpaceType);
const hasService = (...s: ServiceType[]) => (i: Partial<CleaningQuoteIntake>) =>
  s.includes(i.serviceType as ServiceType);
const isRecurring = (i: Partial<CleaningQuoteIntake>) => i.recurrence === 'recurring';
const isOneOff = (i: Partial<CleaningQuoteIntake>) => i.recurrence !== 'recurring';
const hasField = (k: keyof CleaningQuoteIntake) => (i: Partial<CleaningQuoteIntake>) =>
  !!i[k];

export const CLEANING_CATALOG: CleaningLineItemTemplate[] = [

  // ── GENERAL ────────────────────────────────────────────────────────────────
  {
    id: 'general_barrer_fregar',
    categoria: 'General',
    descripcion: 'Barrido y fregado de suelos',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: ALWAYS,
  },
  {
    id: 'general_polvo',
    categoria: 'General',
    descripcion: 'Retirada de polvo en superficies, muebles y rodapiés',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: ALWAYS,
  },
  {
    id: 'general_residuos',
    categoria: 'General',
    descripcion: 'Recogida y retirada ordinaria de residuos y basuras',
    unidad: 'ud',
    tipo: 'mano_de_obra',
    when: ALWAYS,
  },
  {
    id: 'general_puntos_contacto',
    categoria: 'General',
    descripcion: 'Desinfección de interruptores, pomos y puntos de contacto',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: (i) => !!i.spaceType && ['oficina', 'comunidad', 'local_comercial'].includes(i.spaceType),
  },
  {
    id: 'general_productos',
    categoria: 'General',
    descripcion: 'Productos de limpieza y consumibles',
    unidad: 'ud',
    tipo: 'material',
    when: ALWAYS,
  },

  // ── COCINA ─────────────────────────────────────────────────────────────────
  {
    id: 'cocina_integral',
    categoria: 'Cocina',
    descripcion: 'Limpieza integral de cocina: encimeras, fregadero, azulejos y frentes',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: hasSpace('vivienda', 'local_comercial', 'nave'),
  },
  {
    id: 'cocina_muebles_ext',
    categoria: 'Cocina',
    descripcion: 'Limpieza exterior de muebles de cocina',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: (i) => i.spaceType === 'vivienda' && i.furnishingState !== 'vacio',
  },
  {
    id: 'cocina_muebles_int',
    categoria: 'Cocina',
    descripcion: 'Limpieza interior de muebles de cocina',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: (i) => i.spaceType === 'vivienda' && (i.serviceType === 'limpieza_integral' || i.serviceType === 'fin_de_obra' || i.serviceType === 'cambio_inquilino'),
  },
  {
    id: 'cocina_electrodomesticos',
    categoria: 'Cocina',
    descripcion: 'Limpieza de electrodomésticos: campana, horno, vitrocerámica',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: (i) => i.spaceType === 'vivienda' && i.serviceType !== 'puntual',
  },

  // ── BAÑOS ──────────────────────────────────────────────────────────────────
  {
    id: 'bano_integral',
    categoria: 'Baños / Aseos',
    descripcion: 'Limpieza integral de baño/aseo: sanitarios, ducha/bañera, grifería, azulejos',
    unidad: 'ud',
    tipo: 'mano_de_obra',
    when: (i) => (i.bathrooms ?? 0) > 0 || hasSpace('vivienda', 'oficina', 'local_comercial')(i),
  },
  {
    id: 'bano_mampara',
    categoria: 'Baños / Aseos',
    descripcion: 'Limpieza de mampara de ducha',
    unidad: 'ud',
    tipo: 'mano_de_obra',
    when: (i) => i.spaceType === 'vivienda' && (i.serviceType === 'limpieza_integral' || i.serviceType === 'fin_de_obra'),
  },
  {
    id: 'bano_espejos',
    categoria: 'Baños / Aseos',
    descripcion: 'Limpieza de espejos y accesorios de baño',
    unidad: 'ud',
    tipo: 'mano_de_obra',
    when: (i) => (i.bathrooms ?? 0) > 0,
  },

  // ── HABITACIONES / DESPACHOS ───────────────────────────────────────────────
  {
    id: 'habitaciones_suelos',
    categoria: 'Habitaciones',
    descripcion: 'Limpieza de suelos de habitaciones: barrido/aspirado y fregado',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: hasSpace('vivienda'),
  },
  {
    id: 'habitaciones_mobiliario',
    categoria: 'Habitaciones',
    descripcion: 'Limpieza de mobiliario: puertas, marcos, rodapiés y superficies',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: (i) => i.spaceType === 'vivienda' && i.furnishingState !== 'vacio',
  },

  // ── SALÓN / ZONAS COMUNES ──────────────────────────────────────────────────
  {
    id: 'salon_integral',
    categoria: 'Salón / Zonas comunes',
    descripcion: 'Limpieza integral de salón: suelos, mobiliario, puertas y superficies',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: hasSpace('vivienda'),
  },
  {
    id: 'zonas_comunes_oficina',
    categoria: 'Zonas comunes',
    descripcion: 'Limpieza de zonas comunes, pasillos y zonas de paso',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: hasSpace('oficina', 'despacho', 'nave'),
  },

  // ── CRISTALES ──────────────────────────────────────────────────────────────
  {
    id: 'cristales_ventanas',
    categoria: 'Cristales',
    descripcion: 'Limpieza de cristales y ventanas (interior y exterior accesible)',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: (i) => !!i.windows || i.serviceType === 'cristales' || i.serviceType === 'fin_de_obra',
  },
  {
    id: 'cristales_marcos',
    categoria: 'Cristales',
    descripcion: 'Limpieza de marcos y carriles de ventanas',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: (i) => !!i.windows || i.serviceType === 'fin_de_obra',
  },
  {
    id: 'cristales_escaparate',
    categoria: 'Cristales',
    descripcion: 'Limpieza de escaparate / cristalera exterior',
    unidad: 'ud',
    tipo: 'mano_de_obra',
    when: (i) => !!i.escaparates || i.spaceType === 'local_comercial',
  },
  {
    id: 'cristales_persianas',
    categoria: 'Cristales',
    descripcion: 'Limpieza de persianas (lamas y guías)',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: hasField('blinds'),
  },

  // ── TERRAZA / EXTERIOR ─────────────────────────────────────────────────────
  {
    id: 'terraza_barrido',
    categoria: 'Terraza / Exterior',
    descripcion: 'Barrido y fregado de terraza o patio',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: hasField('terrace'),
  },
  {
    id: 'terraza_barandillas',
    categoria: 'Terraza / Exterior',
    descripcion: 'Limpieza de barandillas y cerramientos de terraza',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: hasField('terrace'),
  },

  // ── COMUNIDADES ────────────────────────────────────────────────────────────
  {
    id: 'com_portal',
    categoria: 'Comunidad',
    descripcion: 'Limpieza de portal: suelos, paredes, buzones y cristales entrada',
    unidad: 'ud',
    tipo: 'mano_de_obra',
    when: hasSpace('comunidad', 'edificio'),
  },
  {
    id: 'com_escaleras',
    categoria: 'Comunidad',
    descripcion: 'Limpieza de escaleras, rellanos y pasamanos',
    unidad: 'visita',
    tipo: 'mano_de_obra',
    when: hasSpace('comunidad', 'edificio'),
  },
  {
    id: 'com_ascensor',
    categoria: 'Comunidad',
    descripcion: 'Limpieza de ascensor: cabina, espejos, botonera y puertas',
    unidad: 'visita',
    tipo: 'mano_de_obra',
    when: (i) => hasSpace('comunidad', 'edificio')(i) && !!i.elevators,
  },
  {
    id: 'com_garaje',
    categoria: 'Comunidad',
    descripcion: 'Limpieza de garaje comunitario',
    unidad: 'mes',
    tipo: 'mano_de_obra',
    when: (i) => hasSpace('comunidad', 'edificio')(i) && !!i.garage,
  },
  {
    id: 'com_cuarto_basuras',
    categoria: 'Comunidad',
    descripcion: 'Limpieza y desinfección de cuarto de basuras',
    unidad: 'mes',
    tipo: 'mano_de_obra',
    when: hasSpace('comunidad', 'edificio'),
  },

  // ── GARAJE INDEPENDIENTE ───────────────────────────────────────────────────
  {
    id: 'garaje_general',
    categoria: 'Garaje',
    descripcion: 'Limpieza general de garaje: suelos, paredes y techo accesible',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: hasSpace('garaje'),
  },

  // ── NAVE / LOCAL INDUSTRIAL ────────────────────────────────────────────────
  {
    id: 'nave_suelos',
    categoria: 'Nave / Oficina',
    descripcion: 'Limpieza de suelos industriales: barrido y fregado',
    unidad: 'm2',
    tipo: 'mano_de_obra',
    when: hasSpace('nave'),
  },
  {
    id: 'nave_aseos',
    categoria: 'Nave / Oficina',
    descripcion: 'Limpieza de aseos y vestuarios',
    unidad: 'ud',
    tipo: 'mano_de_obra',
    when: hasSpace('nave'),
  },

  // ── OFICINAS ───────────────────────────────────────────────────────────────
  {
    id: 'ofic_puestos',
    categoria: 'Oficina',
    descripcion: 'Limpieza de puestos de trabajo: mesas, sillas, equipos',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: hasSpace('oficina', 'despacho'),
  },
  {
    id: 'ofic_salas',
    categoria: 'Oficina',
    descripcion: 'Limpieza de salas de reuniones',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: hasSpace('oficina'),
  },
  {
    id: 'ofic_office',
    categoria: 'Oficina',
    descripcion: 'Limpieza de office / zona de cocina',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: hasSpace('oficina', 'despacho'),
  },
  {
    id: 'ofic_papeleras',
    categoria: 'Oficina',
    descripcion: 'Vaciado y limpieza de papeleras y contenedores',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: (i) => hasSpace('oficina', 'despacho')(i) && isRecurring(i),
  },

  // ── FIN DE OBRA ────────────────────────────────────────────────────────────
  {
    id: 'fo_polvo_obra',
    categoria: 'Fin de obra',
    descripcion: 'Retirada de polvo de obra en todas las superficies',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: hasService('fin_de_obra'),
  },
  {
    id: 'fo_suelos',
    categoria: 'Fin de obra',
    descripcion: 'Limpieza profunda de suelos: extracción de residuos superficiales y lechada',
    unidad: 'm2',
    tipo: 'mano_de_obra',
    when: hasService('fin_de_obra'),
  },
  {
    id: 'fo_azulejos',
    categoria: 'Fin de obra',
    descripcion: 'Limpieza de azulejos y revestimientos: lechada, silicona y restos',
    unidad: 'm2',
    tipo: 'mano_de_obra',
    when: hasService('fin_de_obra'),
  },
  {
    id: 'fo_carpinterias',
    categoria: 'Fin de obra',
    descripcion: 'Limpieza de carpinterías: puertas, marcos, rodapiés y zócalos',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: hasService('fin_de_obra'),
  },
  {
    id: 'fo_sanitarios',
    categoria: 'Fin de obra',
    descripcion: 'Limpieza inicial de sanitarios instalados',
    unidad: 'ud',
    tipo: 'mano_de_obra',
    when: hasService('fin_de_obra'),
  },
  {
    id: 'fo_mobiliario_instalado',
    categoria: 'Fin de obra',
    descripcion: 'Limpieza de mobiliario instalado: cocina, armarios empotrados',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: (i) => i.serviceType === 'fin_de_obra' && i.furnishingState !== 'vacio',
  },
  {
    id: 'fo_limpieza_final',
    categoria: 'Fin de obra',
    descripcion: 'Limpieza final de repaso y entrega',
    unidad: 'hora',
    tipo: 'mano_de_obra',
    when: hasService('fin_de_obra'),
  },

  // ── RECURRENTE — PRECIO MENSUAL ───────────────────────────────────────────
  {
    id: 'rec_servicio_mensual',
    categoria: 'Servicio recurrente',
    descripcion: 'Servicio de limpieza mensual (según frecuencia acordada)',
    unidad: 'mes',
    tipo: 'mano_de_obra',
    when: (i) => isRecurring(i) && !hasSpace('comunidad', 'edificio')(i),
  },
];

export interface ProposedLineItem {
  id: string;
  categoria: string;
  descripcion: string;
  unidad: string;
  tipo: 'material' | 'mano_de_obra';
  cantidad: number;
  precioUnitario: 0;   // always 0 — professional sets the price
  total: 0;
  requiere_revision: true;
}

export function proposeLineItems(intake: Partial<CleaningQuoteIntake>): ProposedLineItem[] {
  const seen = new Set<string>();
  const result: ProposedLineItem[] = [];

  for (const tpl of CLEANING_CATALOG) {
    if (!tpl.when(intake)) continue;
    if (seen.has(tpl.id)) continue;
    seen.add(tpl.id);

    // Calcular cantidad inicial si se puede derivar del intake.
    let cantidad = 1;
    if (tpl.id === 'bano_integral' || tpl.id === 'bano_mampara' || tpl.id === 'bano_espejos') {
      if (intake.bathrooms) cantidad = intake.bathrooms;
    }
    if (tpl.id === 'com_ascensor' && intake.elevators) {
      cantidad = intake.elevators;
    }
    if (tpl.id === 'fo_sanitarios' && intake.bathrooms) {
      cantidad = intake.bathrooms;
    }

    result.push({
      id: tpl.id,
      categoria: tpl.categoria,
      descripcion: tpl.descripcion,
      unidad: tpl.unidad,
      tipo: tpl.tipo,
      cantidad,
      precioUnitario: 0,
      total: 0,
      requiere_revision: true,
    });
  }

  return result;
}
