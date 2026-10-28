import { describe, it, expect } from 'vitest';
import {
  vehicleDocStoragePath,
  VEHICLE_DOC_TIPO_LABELS,
  VEHICLE_DOCS_BUCKET,
  type VehicleDocTipo,
} from '../../lib/vehicleDocs';

// ── VD-1: vehicleDocStoragePath ───────────────────────────────────────────────

describe('vehicleDocStoragePath', () => {
  const ORG_ID = 'org-123';
  const VEH_ID = 'veh-456';

  it('VD-1-A: genera ruta con formato {org_id}/{vehicle_id}/{filename}', () => {
    const result = vehicleDocStoragePath(ORG_ID, VEH_ID, 'doc.pdf');
    expect(result).toBe('org-123/veh-456/doc.pdf');
  });

  it('VD-1-B: primer segmento es el org_id', () => {
    const result = vehicleDocStoragePath(ORG_ID, VEH_ID, 'file.jpg');
    expect(result.split('/')[0]).toBe(ORG_ID);
  });

  it('VD-1-C: segundo segmento es el vehicle_id', () => {
    const result = vehicleDocStoragePath(ORG_ID, VEH_ID, 'file.jpg');
    expect(result.split('/')[1]).toBe(VEH_ID);
  });

  it('VD-1-D: tercer segmento es el filename', () => {
    const result = vehicleDocStoragePath(ORG_ID, VEH_ID, 'itv_2026.pdf');
    expect(result.split('/')[2]).toBe('itv_2026.pdf');
  });

  it('VD-1-E: funciona con UUIDs reales', () => {
    const orgUuid = 'a0b1c2d3-e4f5-6789-abcd-ef0123456789';
    const vehUuid = 'fedcba98-7654-3210-fedc-ba9876543210';
    const result = vehicleDocStoragePath(orgUuid, vehUuid, 'permiso.pdf');
    expect(result).toBe(`${orgUuid}/${vehUuid}/permiso.pdf`);
    expect(result.startsWith(orgUuid)).toBe(true);
  });

  it('VD-1-F: no añade barras extras', () => {
    const result = vehicleDocStoragePath(ORG_ID, VEH_ID, 'cert.pdf');
    expect(result.split('/').length).toBe(3);
  });
});

// ── VD-2: VEHICLE_DOCS_BUCKET ────────────────────────────────────────────────

describe('VEHICLE_DOCS_BUCKET', () => {
  it('VD-2-A: es el string "vehicle-docs"', () => {
    expect(VEHICLE_DOCS_BUCKET).toBe('vehicle-docs');
  });
});

// ── VD-3: VEHICLE_DOC_TIPO_LABELS ────────────────────────────────────────────

describe('VEHICLE_DOC_TIPO_LABELS', () => {
  const TIPOS_ESPERADOS: VehicleDocTipo[] = [
    'itv',
    'seguro',
    'permiso_circulacion',
    'autorizacion_vvc',
    'autorizacion_mdp',
    'autorizacion_vde',
    'autorizacion_tpc',
    'certificado_tacografo',
    'otro',
  ];

  it('VD-3-A: tiene exactamente 9 entradas', () => {
    expect(Object.keys(VEHICLE_DOC_TIPO_LABELS).length).toBe(9);
  });

  it('VD-3-B: todos los tipos esperados están presentes', () => {
    TIPOS_ESPERADOS.forEach(tipo => {
      expect(VEHICLE_DOC_TIPO_LABELS).toHaveProperty(tipo);
    });
  });

  it('VD-3-C: todos los labels son strings no vacíos', () => {
    Object.values(VEHICLE_DOC_TIPO_LABELS).forEach(label => {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });

  it('VD-3-D: tipo "itv" tiene label legible', () => {
    expect(VEHICLE_DOC_TIPO_LABELS['itv'].toLowerCase()).toContain('itv');
  });

  it('VD-3-E: tipo "seguro" tiene label legible', () => {
    expect(VEHICLE_DOC_TIPO_LABELS['seguro'].toLowerCase()).toContain('seguro');
  });

  it('VD-3-F: tipo "otro" tiene label', () => {
    expect(VEHICLE_DOC_TIPO_LABELS['otro'].length).toBeGreaterThan(0);
  });

  it('VD-3-G: ningún label es undefined o null', () => {
    Object.entries(VEHICLE_DOC_TIPO_LABELS).forEach(([, v]) => {
      expect(v).toBeTruthy();
    });
  });
});

// ── VD-4: integración ruta + bucket ─────────────────────────────────────────

describe('integración: ruta de Storage', () => {
  it('VD-4-A: la ruta empieza por org_id (validación de política RLS)', () => {
    const orgId = 'org-aaa';
    const vehId = 'veh-bbb';
    const path = vehicleDocStoragePath(orgId, vehId, 'doc.pdf');
    const primer_segmento = path.split('/')[0];
    expect(primer_segmento).toBe(orgId);
  });

  it('VD-4-B: bucket y ruta combinados tienen formato correcto para Storage API', () => {
    const orgId = 'org-111';
    const vehId = 'veh-222';
    const path = vehicleDocStoragePath(orgId, vehId, 'itv.pdf');
    const fullRef = `${VEHICLE_DOCS_BUCKET}/${path}`;
    expect(fullRef).toBe(`vehicle-docs/org-111/veh-222/itv.pdf`);
  });
});
