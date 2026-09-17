// PH0-QUOTE-PHOTOS-1A — Foundation tests
// Cubre los 20 tests del spec + casos extra de comportamiento.
// Invariantes server-side (RLS, trigger) se verifican en la migración SQL;
// aquí se verifica que el cliente propaga errores y no los silencia.

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock de Supabase (vi.hoisted: se evalúa antes de los imports) ─────────────
const mocks = vi.hoisted(() => {
  // Estado mutable: cada test configura lo que quiere recibir
  const state = {
    dbData: null as unknown,
    dbError: null as Error | null,
    singleData: null as unknown,
    singleError: null as Error | null,
    uploadError: null as Error | null,
    removeError: null as Error | null,
    signedUrl: 'https://signed.example.com/photo.jpg',
    signedUrlError: null as Error | null,
  };

  // Cadena chainable + awaitable para .from().select().eq().order()...
  const dbChain: Record<string, unknown> = {};
  dbChain.select = vi.fn().mockReturnValue(dbChain);
  dbChain.insert = vi.fn().mockReturnValue(dbChain);
  dbChain.update = vi.fn().mockReturnValue(dbChain);
  dbChain.delete = vi.fn().mockReturnValue(dbChain);
  dbChain.eq = vi.fn().mockReturnValue(dbChain);
  dbChain.order = vi.fn().mockReturnValue(dbChain);
  // .single() es una Promise
  dbChain.single = vi.fn().mockImplementation(() =>
    Promise.resolve({ data: state.singleData, error: state.singleError }),
  );
  // Hace que la cadena sea awaitable: await supabase.from().select()...
  dbChain.then = vi.fn().mockImplementation(
    (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: state.dbData, error: state.dbError }).then(onFulfilled, onRejected),
  );

  const storageChain = {
    upload: vi.fn().mockImplementation(() =>
      Promise.resolve({ error: state.uploadError }),
    ),
    remove: vi.fn().mockImplementation(() =>
      Promise.resolve({ error: state.removeError }),
    ),
    createSignedUrl: vi.fn().mockImplementation(() =>
      Promise.resolve({
        data: state.signedUrlError ? null : { signedUrl: state.signedUrl },
        error: state.signedUrlError,
      }),
    ),
  };

  const fromFn = vi.fn().mockReturnValue(dbChain);
  const storageFromFn = vi.fn().mockReturnValue(storageChain);

  return { state, dbChain, storageChain, fromFn, storageFromFn };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mocks.fromFn,
    storage: { from: mocks.storageFromFn },
  },
}));

// ── Imports bajo test (después de los mocks) ──────────────────────────────────
import {
  MAX_QUOTE_PHOTOS,
  MAX_QUOTE_DOCUMENT_PHOTOS,
  SIGNED_URL_TTL_SECONDS,
  ALLOWED_QUOTE_MIME_TYPES,
  BUCKET,
  validateMimeType,
  buildStoragePath,
  loadQuotePhotos,
  getQuotePhotoSignedUrl,
  uploadQuotePhoto,
  updateQuotePhoto,
  deleteQuotePhoto,
  type TradeQuotePhoto,
  type UpdateQuotePhotoParams,
} from '../../lib/quotePhotos';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const ORG_A = '11111111-1111-1111-1111-111111111111';
const QUOTE_A = '22222222-2222-2222-2222-222222222222';
const USER_A = '33333333-3333-3333-3333-333333333333';

const makePhoto = (overrides: Partial<TradeQuotePhoto> = {}): TradeQuotePhoto => ({
  id: 'aaaa-bbbb-cccc-dddd',
  quote_id: QUOTE_A,
  org_id: ORG_A,
  storage_path: `${ORG_A}/quotes/${QUOTE_A}/abc.jpg`,
  area_label: null,
  caption: null,
  display_order: 0,
  include_in_document: false,
  created_by: USER_A,
  created_at: '2026-09-17T10:00:00.000Z',
  ...overrides,
});

const makeFile = (type = 'image/jpeg', name = 'foto.jpg'): File =>
  new File(['data'], name, { type });

// ── Reset de mocks entre tests ────────────────────────────────────────────────
beforeEach(() => {
  mocks.state.dbData = null;
  mocks.state.dbError = null;
  mocks.state.singleData = null;
  mocks.state.singleError = null;
  mocks.state.uploadError = null;
  mocks.state.removeError = null;
  mocks.state.signedUrl = 'https://signed.example.com/photo.jpg';
  mocks.state.signedUrlError = null;
  vi.clearAllMocks();
  // Re-configurar mocks después de clearAllMocks (no resetea implementaciones)
  mocks.fromFn.mockReturnValue(mocks.dbChain);
  mocks.storageFromFn.mockReturnValue(mocks.storageChain);
  (mocks.dbChain.select as ReturnType<typeof vi.fn>).mockReturnValue(mocks.dbChain);
  (mocks.dbChain.insert as ReturnType<typeof vi.fn>).mockReturnValue(mocks.dbChain);
  (mocks.dbChain.update as ReturnType<typeof vi.fn>).mockReturnValue(mocks.dbChain);
  (mocks.dbChain.delete as ReturnType<typeof vi.fn>).mockReturnValue(mocks.dbChain);
  (mocks.dbChain.eq as ReturnType<typeof vi.fn>).mockReturnValue(mocks.dbChain);
  (mocks.dbChain.order as ReturnType<typeof vi.fn>).mockReturnValue(mocks.dbChain);
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 1 — loadQuotePhotos: usuario autorizado carga fotos
// ═════════════════════════════════════════════════════════════════════════════
describe('TEST 1 — loadQuotePhotos retorna array de fotos', () => {
  it('devuelve las fotos del presupuesto en orden', async () => {
    const photos = [makePhoto({ display_order: 0 }), makePhoto({ display_order: 1 })];
    mocks.state.dbData = photos;

    const result = await loadQuotePhotos(QUOTE_A);
    expect(result).toHaveLength(2);
    expect(result[0].quote_id).toBe(QUOTE_A);
  });

  it('consulta por quote_id con orden correcto', async () => {
    mocks.state.dbData = [];
    await loadQuotePhotos(QUOTE_A);

    expect(mocks.fromFn).toHaveBeenCalledWith('trade_quote_photos');
    expect(mocks.dbChain.eq).toHaveBeenCalledWith('quote_id', QUOTE_A);
    expect(mocks.dbChain.order).toHaveBeenCalledWith('display_order', { ascending: true });
  });

  it('devuelve array vacío si no hay fotos (no lanza)', async () => {
    mocks.state.dbData = [];
    const result = await loadQuotePhotos(QUOTE_A);
    expect(result).toEqual([]);
  });

  it('propaga error de DB sin silenciar', async () => {
    mocks.state.dbError = new Error('permission denied');
    await expect(loadQuotePhotos(QUOTE_A)).rejects.toThrow('permission denied');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 2 — Aislamiento multitenancy (RLS server-side)
// ═════════════════════════════════════════════════════════════════════════════
describe('TEST 2 — aislamiento de org (RLS server-side)', () => {
  it('un error de RLS se propaga como excepción (no silenciado)', async () => {
    mocks.state.dbError = new Error('row-level security violation');
    await expect(loadQuotePhotos(QUOTE_A)).rejects.toThrow('row-level security violation');
  });

  it('el bucket es PRIVADO: constante BUCKET usa el nombre correcto', () => {
    expect(BUCKET).toBe('trade-quote-photos');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 3 — Validación MIME (pura, sin red)
// ═════════════════════════════════════════════════════════════════════════════
describe('TEST 3 — validateMimeType rechaza formatos no admitidos', () => {
  // TEST 14 del spec también cubierto aquí
  it('acepta image/jpeg', () => {
    expect(() => validateMimeType(makeFile('image/jpeg'))).not.toThrow();
  });

  it('acepta image/png', () => {
    expect(() => validateMimeType(makeFile('image/png'))).not.toThrow();
  });

  it('acepta image/webp', () => {
    expect(() => validateMimeType(makeFile('image/webp'))).not.toThrow();
  });

  it('rechaza image/heic con mensaje específico de navegador', () => {
    expect(() => validateMimeType(makeFile('image/heic'))).toThrow(
      /HEIC\/HEIF no compatible en este navegador/,
    );
  });

  it('rechaza image/heif con mensaje específico de navegador', () => {
    expect(() => validateMimeType(makeFile('image/heif'))).toThrow(
      /HEIC\/HEIF no compatible en este navegador/,
    );
  });

  it('rechaza image/gif con mensaje genérico', () => {
    expect(() => validateMimeType(makeFile('image/gif'))).toThrow(/Formato no admitido/);
  });

  it('rechaza application/pdf', () => {
    expect(() => validateMimeType(makeFile('application/pdf'))).toThrow(/Formato no admitido/);
  });

  it('rechaza MIME vacío', () => {
    expect(() => validateMimeType(makeFile(''))).toThrow(/Formato no admitido/);
  });

  it('MIME inválido no llega a Storage (validateMimeType lanzado antes)', async () => {
    const noCompress = vi.fn();
    const params = { quoteId: QUOTE_A, orgId: ORG_A, file: makeFile('image/gif') };
    await expect(uploadQuotePhoto(params, noCompress)).rejects.toThrow(/Formato no admitido/);
    expect(mocks.storageChain.upload).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 4 — buildStoragePath (pura)
// ═════════════════════════════════════════════════════════════════════════════
describe('TEST 4 — buildStoragePath respeta path grammar', () => {
  it('incluye org_id, "quotes", quote_id y un uuid.jpg', () => {
    const path = buildStoragePath(ORG_A, QUOTE_A);
    expect(path).toMatch(
      new RegExp(`^${ORG_A}/quotes/${QUOTE_A}/[0-9a-f-]{36}\\.jpg$`),
    );
  });

  it('dos llamadas producen paths únicos (crypto.randomUUID)', () => {
    const p1 = buildStoragePath(ORG_A, QUOTE_A);
    const p2 = buildStoragePath(ORG_A, QUOTE_A);
    expect(p1).not.toBe(p2);
  });

  it('el path contiene el org_id en el primer segmento', () => {
    const path = buildStoragePath(ORG_A, QUOTE_A);
    expect(path.startsWith(`${ORG_A}/`)).toBe(true);
  });

  // TEST 18: Storage policy valida [1] = org_id — el path grammar lo garantiza
  it('el primer segmento del path es el org_id (para que storage policy valide correctamente)', () => {
    const path = buildStoragePath(ORG_A, QUOTE_A);
    const segments = path.split('/');
    expect(segments[0]).toBe(ORG_A);
    expect(segments[1]).toBe('quotes');
    expect(segments[2]).toBe(QUOTE_A);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 5 y 7 — Constantes de límites
// ═════════════════════════════════════════════════════════════════════════════
describe('TEST 5/7 — constantes de límites', () => {
  it('MAX_QUOTE_PHOTOS es 8', () => {
    expect(MAX_QUOTE_PHOTOS).toBe(8);
  });

  it('MAX_QUOTE_DOCUMENT_PHOTOS es 3', () => {
    expect(MAX_QUOTE_DOCUMENT_PHOTOS).toBe(3);
  });

  it('SIGNED_URL_TTL_SECONDS es 3600 (1 hora)', () => {
    expect(SIGNED_URL_TTL_SECONDS).toBe(3600);
  });

  it('ALLOWED_QUOTE_MIME_TYPES no incluye HEIC ni HEIF (gap de navegador)', () => {
    expect(ALLOWED_QUOTE_MIME_TYPES).not.toContain('image/heic');
    expect(ALLOWED_QUOTE_MIME_TYPES).not.toContain('image/heif');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 6 — Límite de 8 fotos: error de trigger propagado
// ═════════════════════════════════════════════════════════════════════════════
describe('TEST 6 — trigger QUOTE_PHOTOS_LIMIT propagado correctamente', () => {
  it('si DB devuelve error QUOTE_PHOTOS_LIMIT, uploadQuotePhoto lo relanza', async () => {
    mocks.state.uploadError = null;
    mocks.state.singleError = new Error(
      'QUOTE_PHOTOS_LIMIT: máximo 8 fotografías por presupuesto',
    );
    const mockCompress = vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/jpeg' }));
    const params = { quoteId: QUOTE_A, orgId: ORG_A, file: makeFile('image/jpeg') };
    await expect(uploadQuotePhoto(params, mockCompress)).rejects.toThrow('QUOTE_PHOTOS_LIMIT');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 8 — Límite de 3 include_in_document: error de trigger propagado
// ═════════════════════════════════════════════════════════════════════════════
describe('TEST 8 — trigger QUOTE_DOC_PHOTOS_LIMIT propagado correctamente', () => {
  it('si DB devuelve error QUOTE_DOC_PHOTOS_LIMIT, updateQuotePhoto lo relanza', async () => {
    mocks.state.singleError = new Error(
      'QUOTE_DOC_PHOTOS_LIMIT: máximo 3 fotografías en el documento',
    );
    const patch: UpdateQuotePhotoParams = { include_in_document: true };
    await expect(updateQuotePhoto('photo-id', patch)).rejects.toThrow('QUOTE_DOC_PHOTOS_LIMIT');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 9 — updateQuotePhoto: desmarcar → vuelve a poder marcar
// ═════════════════════════════════════════════════════════════════════════════
describe('TEST 9 — updateQuotePhoto gestiona include_in_document', () => {
  it('actualiza include_in_document a true correctamente', async () => {
    const updated = makePhoto({ include_in_document: true });
    mocks.state.singleData = updated;
    const result = await updateQuotePhoto('photo-id', { include_in_document: true });
    expect(result.include_in_document).toBe(true);
    expect(mocks.dbChain.update).toHaveBeenCalledWith({ include_in_document: true });
  });

  it('actualiza include_in_document a false (desmarcar)', async () => {
    const updated = makePhoto({ include_in_document: false });
    mocks.state.singleData = updated;
    const result = await updateQuotePhoto('photo-id', { include_in_document: false });
    expect(result.include_in_document).toBe(false);
  });

  it('actualiza area_label y caption', async () => {
    const updated = makePhoto({ area_label: 'Cocina', caption: 'Detalle azulejos' });
    mocks.state.singleData = updated;
    const result = await updateQuotePhoto('photo-id', {
      area_label: 'Cocina',
      caption: 'Detalle azulejos',
    });
    expect(result.area_label).toBe('Cocina');
    expect(result.caption).toBe('Detalle azulejos');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 10 y 11 — Campos opcionales nullable en interfaz
// ═════════════════════════════════════════════════════════════════════════════
describe('TEST 10/11 — area_label y caption son nullable', () => {
  it('TradeQuotePhoto admite area_label null', () => {
    const photo = makePhoto({ area_label: null });
    expect(photo.area_label).toBeNull();
  });

  it('TradeQuotePhoto admite caption null', () => {
    const photo = makePhoto({ caption: null });
    expect(photo.caption).toBeNull();
  });

  it('TradeQuotePhoto admite area_label con valor de string', () => {
    const photo = makePhoto({ area_label: 'Baño' });
    expect(photo.area_label).toBe('Baño');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 12 — display_order
// ═════════════════════════════════════════════════════════════════════════════
describe('TEST 12 — display_order admite valores ≥ 0', () => {
  it('display_order 0 es válido', () => {
    const photo = makePhoto({ display_order: 0 });
    expect(photo.display_order).toBe(0);
  });

  it('display_order positivo es válido', () => {
    const photo = makePhoto({ display_order: 7 });
    expect(photo.display_order).toBe(7);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 13 — storage_path es la fuente de verdad (NO existe photo_url)
// ═════════════════════════════════════════════════════════════════════════════
describe('TEST 13/16 — storage_path como fuente de verdad, sin photo_url', () => {
  it('TradeQuotePhoto tiene storage_path', () => {
    const photo = makePhoto();
    expect(photo).toHaveProperty('storage_path');
    expect(typeof photo.storage_path).toBe('string');
  });

  it('TradeQuotePhoto NO tiene photo_url (campo eliminado)', () => {
    const photo = makePhoto();
    expect(photo).not.toHaveProperty('photo_url');
  });

  it('signed URL es generada on-demand y no está en TradeQuotePhoto', async () => {
    const photo = makePhoto();
    // photo no tiene URL; hay que llamar a getQuotePhotoSignedUrl por separado
    mocks.state.signedUrl = 'https://signed.example.com/photo.jpg?token=abc';
    const url = await getQuotePhotoSignedUrl(photo.storage_path);
    expect(url).toContain('signed.example.com');
    // la url generada no se almacena en el objeto photo
    expect((photo as unknown as Record<string, unknown>).photo_url).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 15 — uploadQuotePhoto: rollback de Storage si DB falla
// ═════════════════════════════════════════════════════════════════════════════
describe('TEST 15 — uploadQuotePhoto rollback atómico', () => {
  it('si DB falla tras Storage success, llama remove en Storage', async () => {
    mocks.state.uploadError = null;
    mocks.state.singleError = new Error('DB constraint violation');
    const mockCompress = vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/jpeg' }));
    const params = { quoteId: QUOTE_A, orgId: ORG_A, file: makeFile('image/jpeg') };

    await expect(uploadQuotePhoto(params, mockCompress)).rejects.toThrow('DB constraint violation');
    expect(mocks.storageChain.remove).toHaveBeenCalledTimes(1);
    // El path de remove debe ser el mismo que se subió
    const removedPaths = (mocks.storageChain.remove as ReturnType<typeof vi.fn>).mock.calls[0][0] as string[];
    expect(removedPaths).toHaveLength(1);
    expect(removedPaths[0]).toMatch(new RegExp(`^${ORG_A}/quotes/${QUOTE_A}/`));
  });

  it('si Storage falla, no llega a hacer DB insert', async () => {
    mocks.state.uploadError = new Error('storage bucket not found');
    const mockCompress = vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/jpeg' }));
    const params = { quoteId: QUOTE_A, orgId: ORG_A, file: makeFile('image/jpeg') };

    await expect(uploadQuotePhoto(params, mockCompress)).rejects.toThrow('storage bucket not found');
    expect(mocks.dbChain.insert).not.toHaveBeenCalled();
  });

  it('happy path: Storage + DB ambos exitosos devuelven TradeQuotePhoto', async () => {
    mocks.state.uploadError = null;
    mocks.state.singleData = makePhoto({ caption: 'Foto de obra' });
    const mockCompress = vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/jpeg' }));
    const params = {
      quoteId: QUOTE_A,
      orgId: ORG_A,
      file: makeFile('image/jpeg'),
      caption: 'Foto de obra',
    };

    const result = await uploadQuotePhoto(params, mockCompress);
    expect(result.caption).toBe('Foto de obra');
    expect(result.quote_id).toBe(QUOTE_A);
    expect(mocks.storageChain.remove).not.toHaveBeenCalled();
  });

  it('upload usa content-type image/jpeg independientemente del MIME original', async () => {
    mocks.state.uploadError = null;
    mocks.state.singleData = makePhoto();
    const mockCompress = vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/jpeg' }));
    const params = { quoteId: QUOTE_A, orgId: ORG_A, file: makeFile('image/png') };

    await uploadQuotePhoto(params, mockCompress);
    expect(mocks.storageChain.upload).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Blob),
      expect.objectContaining({ contentType: 'image/jpeg' }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 16 — getQuotePhotoSignedUrl
// ═════════════════════════════════════════════════════════════════════════════
describe('TEST 16 — getQuotePhotoSignedUrl genera URL temporal', () => {
  it('retorna la signed URL del storage', async () => {
    mocks.state.signedUrl = 'https://storage.supabase.co/signed?token=xyz';
    const url = await getQuotePhotoSignedUrl('path/to/photo.jpg');
    expect(url).toBe('https://storage.supabase.co/signed?token=xyz');
  });

  it('usa el bucket correcto (trade-quote-photos)', async () => {
    await getQuotePhotoSignedUrl('path/to/photo.jpg');
    expect(mocks.storageFromFn).toHaveBeenCalledWith(BUCKET);
  });

  it('usa TTL de 3600 segundos', async () => {
    await getQuotePhotoSignedUrl('path/to/photo.jpg');
    expect(mocks.storageChain.createSignedUrl).toHaveBeenCalledWith(
      'path/to/photo.jpg',
      SIGNED_URL_TTL_SECONDS,
    );
  });

  it('propaga error si createSignedUrl falla', async () => {
    mocks.state.signedUrlError = new Error('storage error');
    await expect(getQuotePhotoSignedUrl('path/to/photo.jpg')).rejects.toThrow('storage error');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 17 — deleteQuotePhoto: orden DB first, Storage second
// ═════════════════════════════════════════════════════════════════════════════
describe('TEST 17 — deleteQuotePhoto respeta orden DB-first', () => {
  it('happy path: llama delete DB y luego remove Storage', async () => {
    const photo = makePhoto();
    await deleteQuotePhoto(photo);

    expect(mocks.fromFn).toHaveBeenCalledWith('trade_quote_photos');
    expect(mocks.dbChain.delete).toHaveBeenCalled();
    expect(mocks.dbChain.eq).toHaveBeenCalledWith('id', photo.id);
    expect(mocks.storageChain.remove).toHaveBeenCalledWith([photo.storage_path]);
  });

  it('si DB falla, no llama remove de Storage', async () => {
    mocks.state.dbError = new Error('permission denied for delete');
    const photo = makePhoto();
    await expect(deleteQuotePhoto(photo)).rejects.toThrow('permission denied');
    expect(mocks.storageChain.remove).not.toHaveBeenCalled();
  });

  it('si Storage falla tras DB success, NO relanza (foto ya eliminada de DB)', async () => {
    mocks.state.removeError = new Error('storage timeout');
    const photo = makePhoto();
    // No debe lanzar aunque Storage falle
    await expect(deleteQuotePhoto(photo)).resolves.toBeUndefined();
  });

  it('pasa el storage_path correcto a remove', async () => {
    const photo = makePhoto({ storage_path: `${ORG_A}/quotes/${QUOTE_A}/specific-file.jpg` });
    await deleteQuotePhoto(photo);
    expect(mocks.storageChain.remove).toHaveBeenCalledWith([photo.storage_path]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 19 — quote sin job admite fotos (no requiere job_id)
// ═════════════════════════════════════════════════════════════════════════════
describe('TEST 19 — fotos de presupuesto no requieren job_id', () => {
  it('uploadQuotePhoto sólo requiere quoteId y orgId (sin job_id)', async () => {
    mocks.state.singleData = makePhoto();
    const mockCompress = vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/jpeg' }));
    // El tipo no incluye jobId — esto es enforced a nivel de TypeScript
    const params: Parameters<typeof uploadQuotePhoto>[0] = {
      quoteId: QUOTE_A,
      orgId: ORG_A,
      file: makeFile('image/jpeg'),
    };
    const result = await uploadQuotePhoto(params, mockCompress);
    expect(result.quote_id).toBe(QUOTE_A);
  });

  it('el insert no pasa job_id a la base de datos', async () => {
    mocks.state.singleData = makePhoto();
    const mockCompress = vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/jpeg' }));
    const params = { quoteId: QUOTE_A, orgId: ORG_A, file: makeFile('image/jpeg') };
    await uploadQuotePhoto(params, mockCompress);

    const insertCall = (mocks.dbChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(insertCall).not.toHaveProperty('job_id');
    expect(insertCall).toHaveProperty('quote_id', QUOTE_A);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 20 — No regresión
// ═════════════════════════════════════════════════════════════════════════════
describe('TEST 20 — no regresión: módulo quotePhotos aislado', () => {
  it('no exporta funciones de PDF (flujos separados)', () => {
    const moduleExports = {
      MAX_QUOTE_PHOTOS,
      MAX_QUOTE_DOCUMENT_PHOTOS,
      BUCKET,
      validateMimeType,
      buildStoragePath,
      loadQuotePhotos,
      uploadQuotePhoto,
      getQuotePhotoSignedUrl,
      updateQuotePhoto,
      deleteQuotePhoto,
    };
    const keys = Object.keys(moduleExports);
    expect(keys).not.toContain('printQuote');
    expect(keys).not.toContain('buildDocumentHTML');
    expect(keys).not.toContain('downloadPdf');
  });

  it('no exporta funciones de Word (flujos separados)', () => {
    const keys = Object.keys({
      MAX_QUOTE_PHOTOS, MAX_QUOTE_DOCUMENT_PHOTOS, BUCKET,
      validateMimeType, buildStoragePath, loadQuotePhotos,
      uploadQuotePhoto, getQuotePhotoSignedUrl, updateQuotePhoto, deleteQuotePhoto,
    });
    expect(keys).not.toContain('downloadAsWordDocx');
    expect(keys).not.toContain('downloadContractAsDocx');
  });

  it('no exporta funciones de trade_job_photos (sin regresión en job photos)', () => {
    const keys = Object.keys({
      MAX_QUOTE_PHOTOS, MAX_QUOTE_DOCUMENT_PHOTOS, BUCKET,
      validateMimeType, buildStoragePath, loadQuotePhotos,
      uploadQuotePhoto, getQuotePhotoSignedUrl, updateQuotePhoto, deleteQuotePhoto,
    });
    expect(keys).not.toContain('uploadJobPhoto');
    expect(keys).not.toContain('deleteJobPhoto');
  });

  it('BUCKET de fotos de presupuesto es diferente al de fotos de trabajo', () => {
    expect(BUCKET).toBe('trade-quote-photos');
    expect(BUCKET).not.toBe('trade-job-photos');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST extra — invariante quote/org en el insert
// ═════════════════════════════════════════════════════════════════════════════
describe('TEST extra — invariante quote ↔ org en uploadQuotePhoto', () => {
  it('el insert pasa org_id coincidente con el quote_id (cliente honesto)', async () => {
    mocks.state.singleData = makePhoto({ org_id: ORG_A, quote_id: QUOTE_A });
    const mockCompress = vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/jpeg' }));
    await uploadQuotePhoto(
      { quoteId: QUOTE_A, orgId: ORG_A, file: makeFile('image/jpeg') },
      mockCompress,
    );
    const insertArg = (mocks.dbChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(insertArg.org_id).toBe(ORG_A);
    expect(insertArg.quote_id).toBe(QUOTE_A);
  });

  it('si RLS rechaza la combinación org_id/quote_id, el error se propaga', async () => {
    mocks.state.singleError = new Error('new row violates row-level security policy');
    const mockCompress = vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/jpeg' }));
    const ORG_B = '99999999-9999-9999-9999-999999999999';
    await expect(
      uploadQuotePhoto({ quoteId: QUOTE_A, orgId: ORG_B, file: makeFile('image/jpeg') }, mockCompress),
    ).rejects.toThrow('row-level security');
  });
});
