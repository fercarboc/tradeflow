import { describe, it, expect, vi, beforeEach } from 'vitest';

const invoke = vi.fn();
vi.mock('../../lib/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import { geocodeAddress, validateGeoResult } from '../../lib/geocoder';

const params = { direccion: 'Canalejas, 91', localidad: 'Santander', cp: '39004' };

describe('geocodeAddress con Geoapify (función de Transporte)', () => {
  beforeEach(() => invoke.mockReset());

  it('usa geocode con org y devuelve un resultado que pasa la validación', async () => {
    invoke.mockResolvedValueOnce({ data: { candidates: [{ lat: 43.46, lng: -3.80, display_name: 'Calle de Canalejas, 91, 39004 Santander, Cantabria, España' }] }, error: null });
    const r = await geocodeAddress(params, 'org-1');
    expect(invoke).toHaveBeenCalledWith('geocode', expect.objectContaining({ body: expect.objectContaining({ org_id: 'org-1' }) }));
    expect(r?.provider).toBe('geoapify');
    expect(r && validateGeoResult(r, params)).toBe(true);
  });

  it('rechaza en validación si el portal devuelto no coincide', async () => {
    invoke.mockResolvedValueOnce({ data: { candidates: [{ lat: 43.46, lng: -3.80, display_name: 'Calle de Canalejas, 39004 Santander, España' }] }, error: null });
    const r = await geocodeAddress(params, 'org-1');
    expect(r && validateGeoResult(r, params)).toBe(false);
  });

  it('si Geoapify falla usa el geocodificador de respaldo', async () => {
    invoke
      .mockResolvedValueOnce({ data: { error: 'GEO_FORBIDDEN' }, error: null })
      .mockResolvedValueOnce({ data: { status: 'ok', latitud: 1, longitud: 2, formatted_address: 'x' }, error: null });
    const r = await geocodeAddress(params, 'org-1');
    expect(invoke.mock.calls[1][0]).toBe('trade-geocode-address');
    expect(r?.latitud).toBe(1);
  });

  it('sin org usa solo el de respaldo', async () => {
    invoke.mockResolvedValueOnce({ data: { status: 'not_found', latitud: null }, error: null });
    expect(await geocodeAddress(params)).toBeNull();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][0]).toBe('trade-geocode-address');
  });
});
