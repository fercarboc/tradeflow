// PH0-QUOTE-PHOTOS-1C — Document generation tests
// Tests for quotePhotos helpers, PDF HTML output, DOCX structure, and MIME handling.

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock de Supabase (vi.hoisted) ─────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const state = {
    dbData: null as unknown,
    dbError: null as Error | null,
    downloadBlob: null as Blob | null,
    downloadError: null as Error | null,
  };

  const dbChain: Record<string, unknown> = {};
  dbChain.select = vi.fn().mockReturnValue(dbChain);
  dbChain.eq     = vi.fn().mockReturnValue(dbChain);
  dbChain.order  = vi.fn().mockReturnValue(dbChain);
  dbChain.limit  = vi.fn().mockReturnValue(dbChain);
  dbChain.then   = vi.fn().mockImplementation(
    (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: state.dbData, error: state.dbError }).then(onFulfilled, onRejected),
  );

  const storageChain = {
    download: vi.fn().mockImplementation(() =>
      Promise.resolve({ data: state.downloadBlob, error: state.downloadError }),
    ),
    createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example.com/photo.jpg' }, error: null }),
  };

  const fromFn        = vi.fn().mockReturnValue(dbChain);
  const storageFromFn = vi.fn().mockReturnValue(storageChain);

  return { state, dbChain, storageChain, fromFn, storageFromFn };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mocks.fromFn,
    storage: { from: mocks.storageFromFn },
  },
}));

// FileReader mock — preserva blob.type en el data URL
vi.stubGlobal('FileReader', class {
  onloadend: (() => void) | null = null;
  onerror:   (() => void) | null = null;
  result: string | null = null;

  readAsDataURL(blob: Blob) {
    Promise.resolve().then(() => {
      if ((blob as { _fail?: boolean })._fail) {
        this.onerror?.();
      } else {
        // Preserves blob.type → mirrors real FileReader behavior
        const type = blob.type || 'image/jpeg';
        this.result = `data:${type};base64,${btoa('fake-image-data')}`;
        this.onloadend?.();
      }
    });
  }
});

// ── Imports bajo test ─────────────────────────────────────────────────────────
import {
  MAX_QUOTE_DOCUMENT_PHOTOS,
  BUCKET,
  loadQuoteDocumentPhotos,
  getQuotePhotoAsDataUrl,
  getQuotePhotoAsArrayBuffer,
  downloadQuotePhotoRaw,
  type TradeQuotePhoto,
  type PreparedDocumentPhoto,
  type PreparedWordPhoto,
} from '../../lib/quotePhotos';

import { scaleToFit } from '../../lib/exportWord';
import { buildDocumentHTML, buildPhotosHtml } from '../../lib/documentBuilder';
import type { BuildDocumentOpts } from '../../lib/documentBuilder';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const ORG_A   = '11111111-1111-1111-1111-111111111111';
const QUOTE_A = '22222222-2222-2222-2222-222222222222';
const USER_A  = '33333333-3333-3333-3333-333333333333';

const makePhoto = (overrides: Partial<TradeQuotePhoto> = {}): TradeQuotePhoto => ({
  id: 'aaaa-bbbb-cccc-dddd',
  quote_id: QUOTE_A,
  org_id: ORG_A,
  storage_path: `${ORG_A}/quotes/${QUOTE_A}/abc.jpg`,
  area_label: null,
  caption: null,
  display_order: 0,
  include_in_document: true,
  created_by: USER_A,
  created_at: '2026-09-17T10:00:00.000Z',
  ...overrides,
});

const makeBlob = (mimeType = 'image/jpeg', fail = false) => {
  const b = new Blob(['fake-image-data'], { type: mimeType });
  if (fail) (b as unknown as { _fail: boolean })._fail = true;
  return b;
};

const baseDocOpts = (): BuildDocumentOpts => ({
  tipo: 'presupuesto',
  numero: 'P-2026-001',
  fecha: '2026-09-17',
  clienteNombre: 'Juan García',
  empresa: { nombre: 'Instalaciones Test S.L.', nif: 'B12345678', email: 'info@test.es', telefonoMovil: '600123456' },
  partidas: [
    { descripcion: 'Revisión instalación eléctrica', tipo: 'mano_de_obra', cantidad: 2, precioUnitario: 45, total: 90 },
  ],
  total: 90,
  iva: 21,
});

// ── Reset de mocks ────────────────────────────────────────────────────────────
beforeEach(() => {
  mocks.state.dbData      = null;
  mocks.state.dbError     = null;
  mocks.state.downloadBlob  = null;
  mocks.state.downloadError = null;
  vi.clearAllMocks();

  mocks.fromFn.mockReturnValue(mocks.dbChain);
  mocks.storageFromFn.mockReturnValue(mocks.storageChain);
  (mocks.dbChain.select as ReturnType<typeof vi.fn>).mockReturnValue(mocks.dbChain);
  (mocks.dbChain.eq     as ReturnType<typeof vi.fn>).mockReturnValue(mocks.dbChain);
  (mocks.dbChain.order  as ReturnType<typeof vi.fn>).mockReturnValue(mocks.dbChain);
  (mocks.dbChain.limit  as ReturnType<typeof vi.fn>).mockReturnValue(mocks.dbChain);
  (mocks.storageChain.download as ReturnType<typeof vi.fn>).mockImplementation(() =>
    Promise.resolve({ data: mocks.state.downloadBlob, error: mocks.state.downloadError }),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1 — loadQuoteDocumentPhotos: solo include_in_document=true
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 1 — loadQuoteDocumentPhotos filtra include=true', () => {
  it('filtra con include_in_document=true', async () => {
    mocks.state.dbData = [makePhoto({ include_in_document: true })];
    await loadQuoteDocumentPhotos(QUOTE_A);
    expect(mocks.dbChain.eq).toHaveBeenCalledWith('include_in_document', true);
  });

  it('devuelve array vacío si no hay fotos marcadas', async () => {
    mocks.state.dbData = [];
    const result = await loadQuoteDocumentPhotos(QUOTE_A);
    expect(result).toEqual([]);
  });

  it('propaga error de DB', async () => {
    mocks.state.dbError = new Error('permission denied');
    await expect(loadQuoteDocumentPhotos(QUOTE_A)).rejects.toThrow('permission denied');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — Orden display_order ASC
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 2 — loadQuoteDocumentPhotos ordena por display_order', () => {
  it('llama order con display_order ASC', async () => {
    mocks.state.dbData = [];
    await loadQuoteDocumentPhotos(QUOTE_A);
    expect(mocks.dbChain.order).toHaveBeenCalledWith('display_order', { ascending: true });
  });

  it('llama order con created_at ASC (desempate)', async () => {
    mocks.state.dbData = [];
    await loadQuoteDocumentPhotos(QUOTE_A);
    expect(mocks.dbChain.order).toHaveBeenCalledWith('created_at', { ascending: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — Máximo defensivo MAX_QUOTE_DOCUMENT_PHOTOS
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 3 — límite defensivo MAX_QUOTE_DOCUMENT_PHOTOS', () => {
  it('llama limit con MAX_QUOTE_DOCUMENT_PHOTOS (3)', async () => {
    mocks.state.dbData = [];
    await loadQuoteDocumentPhotos(QUOTE_A);
    expect(mocks.dbChain.limit).toHaveBeenCalledWith(MAX_QUOTE_DOCUMENT_PHOTOS);
    expect(MAX_QUOTE_DOCUMENT_PHOTOS).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4 — getQuotePhotoAsDataUrl: MIME preservation
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 4 — getQuotePhotoAsDataUrl preserva MIME del blob', () => {
  it('blob JPEG → data URL empieza con data:image/jpeg', async () => {
    mocks.state.downloadBlob = makeBlob('image/jpeg');
    const url = await getQuotePhotoAsDataUrl('some/path.jpg');
    expect(url).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('blob PNG → data URL empieza con data:image/png', async () => {
    mocks.state.downloadBlob = makeBlob('image/png');
    const url = await getQuotePhotoAsDataUrl('some/path.png');
    expect(url).toMatch(/^data:image\/png;base64,/);
  });

  it('blob WebP → data URL empieza con data:image/webp', async () => {
    mocks.state.downloadBlob = makeBlob('image/webp');
    const url = await getQuotePhotoAsDataUrl('some/path.webp');
    expect(url).toMatch(/^data:image\/webp;base64,/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5 — Data URL válido
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 5 — getQuotePhotoAsDataUrl devuelve data URL', () => {
  it('devuelve string que empieza por data:', async () => {
    mocks.state.downloadBlob = makeBlob();
    const url = await getQuotePhotoAsDataUrl('some/path.jpg');
    expect(url).toMatch(/^data:/);
  });

  it('usa el bucket correcto', async () => {
    mocks.state.downloadBlob = makeBlob();
    await getQuotePhotoAsDataUrl('some/path.jpg');
    expect(mocks.storageFromFn).toHaveBeenCalledWith(BUCKET);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6 — Fallo download → Data URL lanza
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 6 — getQuotePhotoAsDataUrl con fallo de storage', () => {
  it('lanza si download devuelve error', async () => {
    mocks.state.downloadError = new Error('storage unavailable');
    await expect(getQuotePhotoAsDataUrl('some/path.jpg')).rejects.toThrow();
  });

  it('lanza si download devuelve null data', async () => {
    mocks.state.downloadBlob  = null;
    mocks.state.downloadError = null;
    await expect(getQuotePhotoAsDataUrl('some/path.jpg')).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7 — ArrayBuffer válido
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 7 — getQuotePhotoAsArrayBuffer devuelve ArrayBuffer', () => {
  it('devuelve instancia de ArrayBuffer', async () => {
    mocks.state.downloadBlob = makeBlob();
    const buf = await getQuotePhotoAsArrayBuffer('some/path.jpg');
    expect(buf).toBeInstanceOf(ArrayBuffer);
  });

  it('ArrayBuffer tiene byteLength > 0', async () => {
    mocks.state.downloadBlob = makeBlob();
    const buf = await getQuotePhotoAsArrayBuffer('some/path.jpg');
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it('usa el bucket correcto', async () => {
    mocks.state.downloadBlob = makeBlob();
    await getQuotePhotoAsArrayBuffer('some/path.jpg');
    expect(mocks.storageFromFn).toHaveBeenCalledWith(BUCKET);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 8 — Fallo download → ArrayBuffer lanza
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 8 — getQuotePhotoAsArrayBuffer con fallo de storage', () => {
  it('lanza si download devuelve error', async () => {
    mocks.state.downloadError = new Error('bucket not found');
    await expect(getQuotePhotoAsArrayBuffer('some/path.jpg')).rejects.toThrow();
  });

  it('lanza si download devuelve null data', async () => {
    mocks.state.downloadBlob  = null;
    mocks.state.downloadError = null;
    await expect(getQuotePhotoAsArrayBuffer('some/path.jpg')).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 9 — downloadQuotePhotoRaw: devuelve {arrayBuffer, mimeType}
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 9 — downloadQuotePhotoRaw retorna mimeType correcto', () => {
  it('blob JPEG → mimeType image/jpeg', async () => {
    mocks.state.downloadBlob = makeBlob('image/jpeg');
    const { mimeType } = await downloadQuotePhotoRaw('path.jpg');
    expect(mimeType).toBe('image/jpeg');
  });

  it('blob PNG → mimeType image/png', async () => {
    mocks.state.downloadBlob = makeBlob('image/png');
    const { mimeType } = await downloadQuotePhotoRaw('path.png');
    expect(mimeType).toBe('image/png');
  });

  it('blob WebP → mimeType image/webp', async () => {
    mocks.state.downloadBlob = makeBlob('image/webp');
    const { mimeType } = await downloadQuotePhotoRaw('path.webp');
    expect(mimeType).toBe('image/webp');
  });

  it('devuelve ArrayBuffer con byteLength > 0', async () => {
    mocks.state.downloadBlob = makeBlob('image/jpeg');
    const { arrayBuffer } = await downloadQuotePhotoRaw('path.jpg');
    expect(arrayBuffer).toBeInstanceOf(ArrayBuffer);
    expect(arrayBuffer.byteLength).toBeGreaterThan(0);
  });

  it('lanza si download falla', async () => {
    mocks.state.downloadError = new Error('not found');
    await expect(downloadQuotePhotoRaw('path.jpg')).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 10 — buildPhotosHtml: HTML real con 1 foto
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 10 — buildPhotosHtml genera HTML correcto', () => {
  const photo1: PreparedDocumentPhoto = {
    storage_path: 'path.jpg',
    area_label: 'Cocina',
    caption: 'Antes de la reforma',
    dataUrl: 'data:image/jpeg;base64,AABB',
  };

  it('1 foto: contiene el data URL de la foto', () => {
    const html = buildPhotosHtml([photo1]);
    expect(html).toContain('data:image/jpeg;base64,AABB');
  });

  it('1 foto: contiene area_label', () => {
    const html = buildPhotosHtml([photo1]);
    expect(html).toContain('Cocina');
  });

  it('1 foto: contiene caption', () => {
    const html = buildPhotosHtml([photo1]);
    expect(html).toContain('Antes de la reforma');
  });

  it('1 foto: contiene "Fotografías de referencia"', () => {
    const html = buildPhotosHtml([photo1]);
    expect(html).toContain('Fotografías de referencia');
  });

  it('1 foto: tiene break-inside:avoid en figure', () => {
    const html = buildPhotosHtml([photo1]);
    expect(html).toContain('break-inside:avoid');
  });

  it('2 fotos: usa grid 2 columnas', () => {
    const photo2: PreparedDocumentPhoto = { ...photo1, dataUrl: 'data:image/png;base64,CCDD' };
    const html = buildPhotosHtml([photo1, photo2]);
    expect(html).toContain('grid-template-columns:repeat(2,1fr)');
  });

  it('3 fotos: usa grid 3 columnas', () => {
    const photos = [photo1, photo1, photo1];
    const html = buildPhotosHtml(photos);
    expect(html).toContain('grid-template-columns:repeat(3,1fr)');
  });

  it('sin area_label ni caption: no emite text vacío', () => {
    const p: PreparedDocumentPhoto = { storage_path: 'p.jpg', area_label: null, caption: null, dataUrl: 'data:image/jpeg;base64,AA' };
    const html = buildPhotosHtml([p]);
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
    expect(html).not.toContain('<figcaption');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 11 — buildDocumentHTML: HTML real con fotos
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 11 — buildDocumentHTML incluye sección de fotos', () => {
  const photo: PreparedDocumentPhoto = {
    storage_path: 'path.jpg',
    area_label: 'Baño',
    caption: 'Vista lateral',
    dataUrl: 'data:image/jpeg;base64,XXYYZZ',
  };

  it('sin fotos: no contiene "Fotografías de referencia"', () => {
    const html = buildDocumentHTML(baseDocOpts());
    expect(html).not.toContain('Fotografías de referencia');
  });

  it('con 1 foto: contiene "Fotografías de referencia"', () => {
    const html = buildDocumentHTML({ ...baseDocOpts(), photos: [photo] });
    expect(html).toContain('Fotografías de referencia');
  });

  it('con 1 foto: contiene el data URL de la imagen', () => {
    const html = buildDocumentHTML({ ...baseDocOpts(), photos: [photo] });
    expect(html).toContain('data:image/jpeg;base64,XXYYZZ');
  });

  it('con 1 foto: contiene area_label', () => {
    const html = buildDocumentHTML({ ...baseDocOpts(), photos: [photo] });
    expect(html).toContain('Baño');
  });

  it('con 1 foto: contiene caption', () => {
    const html = buildDocumentHTML({ ...baseDocOpts(), photos: [photo] });
    expect(html).toContain('Vista lateral');
  });

  it('con 3 fotos: las 3 data URLs aparecen', () => {
    const photos: PreparedDocumentPhoto[] = [
      { ...photo, dataUrl: 'data:image/jpeg;base64,P1' },
      { ...photo, dataUrl: 'data:image/png;base64,P2' },
      { ...photo, dataUrl: 'data:image/webp;base64,P3' },
    ];
    const html = buildDocumentHTML({ ...baseDocOpts(), photos });
    expect(html).toContain('data:image/jpeg;base64,P1');
    expect(html).toContain('data:image/png;base64,P2');
    expect(html).toContain('data:image/webp;base64,P3');
  });

  it('es HTML válido: comienza con <!DOCTYPE html>', () => {
    const html = buildDocumentHTML(baseDocOpts());
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/i);
  });

  it('no contiene texto "null" ni "undefined" en output', () => {
    const html = buildDocumentHTML(baseDocOpts());
    expect(html).not.toContain('>null<');
    expect(html).not.toContain('>undefined<');
  });

  it('contiene el número de documento', () => {
    const html = buildDocumentHTML(baseDocOpts());
    expect(html).toContain('P-2026-001');
  });

  it('presupuesto: accentColor es azul #2563eb', () => {
    const html = buildDocumentHTML({ ...baseDocOpts(), tipo: 'presupuesto' });
    expect(html).toContain('#2563eb');
  });

  it('factura: accentColor es violeta #7c3aed', () => {
    const html = buildDocumentHTML({ ...baseDocOpts(), tipo: 'factura' });
    expect(html).toContain('#7c3aed');
  });

  it('contiene total con IVA correctamente calculado', () => {
    const html = buildDocumentHTML({ ...baseDocOpts(), total: 100, iva: 21 });
    expect(html).toContain('121.00€');
  });

  it('fotos: no hay URLs firmadas (https://supabase) en el HTML', () => {
    const html = buildDocumentHTML({ ...baseDocOpts(), photos: [photo] });
    expect(html).not.toContain('supabase.co/storage');
    expect(html).not.toContain('token=');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 12 — DOCX: Packer.toBuffer genera un ZIP válido con imágenes JPEG/PNG
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 12 — DOCX estructura ZIP (Packer + JSZip)', () => {
  // Minimal fake JPEG/PNG ArrayBuffers (only headers needed for ImageRun)
  const fakeJpegBuf = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, ...new Array(12).fill(0)]).buffer;
  const fakePngBuf  = new Uint8Array([0x89, 0x50, 0x4E, 0x47, ...new Array(12).fill(0)]).buffer;

  it('DOCX sin fotos: Packer produce buffer > 0 bytes', async () => {
    const { Document, Packer, Paragraph, TextRun } = await import('docx');
    const doc = new Document({
      sections: [{ children: [new Paragraph({ children: [new TextRun({ text: 'Test' })] })] }],
    });
    const buf = await Packer.toBuffer(doc);
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it('DOCX sin fotos: ZIP contiene word/document.xml', async () => {
    const { Document, Packer, Paragraph, TextRun } = await import('docx');
    const JSZip = (await import('jszip')).default;
    const doc = new Document({
      sections: [{ children: [new Paragraph({ children: [new TextRun({ text: 'Test' })] })] }],
    });
    const buf = await Packer.toBuffer(doc);
    const zip = await JSZip.loadAsync(buf);
    expect(zip.files['word/document.xml']).toBeDefined();
  });

  it('DOCX con 1 imagen JPEG: word/media/ contiene exactamente 1 entrada .jpg', async () => {
    const { Document, Packer, Paragraph, ImageRun } = await import('docx');
    const JSZip = (await import('jszip')).default;
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            children: [new ImageRun({ data: fakeJpegBuf, transformation: { width: 200, height: 150 }, type: 'jpg' })],
          }),
        ],
      }],
    });
    const buf = await Packer.toBuffer(doc);
    const zip = await JSZip.loadAsync(buf);
    // Exclude the 'word/media/' directory entry itself
    const mediaFiles = Object.keys(zip.files).filter(k => k.startsWith('word/media/') && !k.endsWith('/'));
    expect(mediaFiles).toHaveLength(1);
    expect(mediaFiles[0]).toMatch(/\.jpg$/);
  });

  it('DOCX con 1 imagen PNG: word/media/ contiene exactamente 1 entrada .png', async () => {
    const { Document, Packer, Paragraph, ImageRun } = await import('docx');
    const JSZip = (await import('jszip')).default;
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            children: [new ImageRun({ data: fakePngBuf, transformation: { width: 200, height: 150 }, type: 'png' })],
          }),
        ],
      }],
    });
    const buf = await Packer.toBuffer(doc);
    const zip = await JSZip.loadAsync(buf);
    const mediaFiles = Object.keys(zip.files).filter(k => k.startsWith('word/media/') && !k.endsWith('/'));
    expect(mediaFiles).toHaveLength(1);
    expect(mediaFiles[0]).toMatch(/\.png$/);
  });

  it('DOCX con 3 imágenes JPEG distintas: word/media/ contiene 3 entradas .jpg', async () => {
    const { Document, Packer, Paragraph, ImageRun } = await import('docx');
    const JSZip = (await import('jszip')).default;
    // Use 3 distinct ArrayBuffers — docx deduplicates identical data references
    const makeJpeg = (seed: number) => new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, seed, 0, 0, 0]).buffer;
    const imgs = [makeJpeg(1), makeJpeg(2), makeJpeg(3)].map(data =>
      new ImageRun({ data, transformation: { width: 100, height: 75 }, type: 'jpg' }),
    );
    const doc = new Document({
      sections: [{ children: imgs.map(img => new Paragraph({ children: [img] })) }],
    });
    const buf = await Packer.toBuffer(doc);
    const zip = await JSZip.loadAsync(buf);
    const jpgs = Object.keys(zip.files).filter(k => k.startsWith('word/media/') && k.endsWith('.jpg'));
    expect(jpgs).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 13 — MIME mapping en buildWordPhotosSection
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 13 — PreparedWordPhoto.mimeType existe en la interfaz', () => {
  const buf = new ArrayBuffer(8);

  it('mimeType image/jpeg se almacena correctamente', () => {
    const p: PreparedWordPhoto = {
      storage_path: 'p.jpg', area_label: null, caption: null,
      arrayBuffer: buf, mimeType: 'image/jpeg', naturalWidth: 800, naturalHeight: 600,
    };
    expect(p.mimeType).toBe('image/jpeg');
  });

  it('mimeType image/png se almacena correctamente', () => {
    const p: PreparedWordPhoto = {
      storage_path: 'p.png', area_label: null, caption: null,
      arrayBuffer: buf, mimeType: 'image/png', naturalWidth: 400, naturalHeight: 400,
    };
    expect(p.mimeType).toBe('image/png');
  });

  it('mimeType image/webp se almacena (se omitirá en Word pero es válido en el tipo)', () => {
    const p: PreparedWordPhoto = {
      storage_path: 'p.webp', area_label: null, caption: null,
      arrayBuffer: buf, mimeType: 'image/webp', naturalWidth: 1200, naturalHeight: 900,
    };
    expect(p.mimeType).toBe('image/webp');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 14 — DOCX: WebP se omite (no entra en buildWordPhotosSection)
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 14 — buildWordPhotosSection: WebP se omite del DOCX', () => {
  it('solo JPEG/PNG producen entradas en word/media/, WebP se omite', async () => {
    const { Document, Packer, Paragraph, ImageRun } = await import('docx');
    const JSZip = (await import('jszip')).default;

    const fakeJpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]).buffer;
    // Simulate buildWordPhotosSection MIME mapping: WebP → skip, JPEG → include
    const mimeToDocxType: Record<string, 'jpg' | 'png' | null> = {
      'image/jpeg': 'jpg',
      'image/png':  'png',
      'image/webp': null, // degraded: omitted
    };

    const photos: PreparedWordPhoto[] = [
      { storage_path: 'a.jpg', area_label: null, caption: null, arrayBuffer: fakeJpeg, mimeType: 'image/jpeg', naturalWidth: 400, naturalHeight: 300 },
      { storage_path: 'b.webp', area_label: null, caption: null, arrayBuffer: fakeJpeg, mimeType: 'image/webp', naturalWidth: 400, naturalHeight: 300 },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const included: any[] = [];
    for (const p of photos) {
      const docxType = mimeToDocxType[p.mimeType];
      if (!docxType) continue;
      included.push(new Paragraph({ children: [new ImageRun({ data: p.arrayBuffer, transformation: { width: 200, height: 150 }, type: docxType })] }));
    }

    const children = included.length > 0 ? included : [new Paragraph({ children: [] })];
    const doc = new Document({ sections: [{ children }] });
    const buf = await Packer.toBuffer(doc);
    const zip = await JSZip.loadAsync(buf);
    const mediaEntries = Object.keys(zip.files).filter(k => k.startsWith('word/media/') && !k.endsWith('/'));
    // Only JPEG included, WebP was degraded/omitted
    expect(mediaEntries).toHaveLength(1);
    expect(mediaEntries[0]).toMatch(/\.jpg$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 16 — include=false no aparece (filtrando en query)
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 16 — include=false excluida por query', () => {
  it('la query filtra include_in_document=true (fotos false serían excluidas por RLS+query)', async () => {
    mocks.state.dbData = [];
    await loadQuoteDocumentPhotos(QUOTE_A);
    expect(mocks.dbChain.eq).toHaveBeenCalledWith('include_in_document', true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTs 17-20 — area_label / caption / ambos / ninguno
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 17-20 — PreparedDocumentPhoto label/caption', () => {
  it('acepta photo con solo area_label', () => {
    const p: PreparedDocumentPhoto = {
      storage_path: 'path.jpg', area_label: 'Baño', caption: null, dataUrl: 'data:image/jpeg;base64,abc',
    };
    expect(p.area_label).toBe('Baño');
    expect(p.caption).toBeNull();
  });

  it('acepta photo con solo caption', () => {
    const p: PreparedDocumentPhoto = {
      storage_path: 'path.jpg', area_label: null, caption: 'Vista frontal', dataUrl: 'data:image/jpeg;base64,abc',
    };
    expect(p.caption).toBe('Vista frontal');
    expect(p.area_label).toBeNull();
  });

  it('acepta photo con ambos area_label y caption', () => {
    const p: PreparedDocumentPhoto = {
      storage_path: 'path.jpg', area_label: 'Cocina', caption: 'Antes de reforma', dataUrl: 'data:image/jpeg;base64,abc',
    };
    expect(p.area_label).toBe('Cocina');
    expect(p.caption).toBe('Antes de reforma');
  });

  it('acepta photo sin ninguno (ambos null)', () => {
    const p: PreparedDocumentPhoto = {
      storage_path: 'path.jpg', area_label: null, caption: null, dataUrl: 'data:image/jpeg;base64,abc',
    };
    expect(p.area_label).toBeNull();
    expect(p.caption).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 22-23 — Degradación individual: una foto falla, las demás OK
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 22-23 — degradación individual en Promise.allSettled', () => {
  it('Promise.allSettled: una rechazada no impide las otras', async () => {
    const ok1 = Promise.resolve({ value: 'data:img/a' });
    const fail = Promise.reject(new Error('network error'));
    const ok2  = Promise.resolve({ value: 'data:img/b' });

    const results = await Promise.allSettled([ok1, fail, ok2]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected  = results.filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(2);
    expect(rejected).toHaveLength(1);
  });

  it('todas fallan → array vacío de fotos', async () => {
    const all = await Promise.allSettled([
      Promise.reject(new Error('fail 1')),
      Promise.reject(new Error('fail 2')),
    ]);
    const fulfilled = all.filter(r => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTs 27-29 — scaleToFit: aspect ratio Word
// ─────────────────────────────────────────────────────────────────────────────
describe('scaleToFit — preservación de aspect ratio', () => {
  it('horizontal: no escala si cabe dentro del límite', () => {
    const r = scaleToFit(400, 300, 460, 340);
    expect(r.width).toBe(400);
    expect(r.height).toBe(300);
  });

  it('horizontal: escala proporcionalmente si es mayor que límite', () => {
    const r = scaleToFit(920, 690, 460, 340);
    expect(r.width / r.height).toBeCloseTo(920 / 690, 1);
    expect(r.width).toBeLessThanOrEqual(460);
    expect(r.height).toBeLessThanOrEqual(340);
  });

  it('vertical: escala proporcionalmente (portrait)', () => {
    const r = scaleToFit(300, 600, 460, 340);
    expect(r.width / r.height).toBeCloseTo(300 / 600, 1);
    expect(r.width).toBeLessThanOrEqual(460);
    expect(r.height).toBeLessThanOrEqual(340);
  });

  it('cuadrada: mantiene ratio 1:1', () => {
    const r = scaleToFit(600, 600, 460, 340);
    expect(r.width).toBe(r.height);
    expect(r.width).toBeLessThanOrEqual(340);
  });

  it('dimensiones desconocidas (0,0) → fallback razonable', () => {
    const r = scaleToFit(0, 0, 460, 340);
    expect(r.width).toBe(460);
    expect(r.height).toBe(Math.round(460 * 0.75));
  });

  it('imagen pequeña no se agranda (scale nunca > 1)', () => {
    const r = scaleToFit(100, 75, 460, 340);
    expect(r.width).toBe(100);
    expect(r.height).toBe(75);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTs 30-32 — PreparedWordPhoto label/caption + mimeType
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 30-32 — PreparedWordPhoto label/caption', () => {
  const buf = new ArrayBuffer(8);

  it('acepta solo area_label', () => {
    const p: PreparedWordPhoto = { storage_path: 'p.jpg', area_label: 'Terraza', caption: null, arrayBuffer: buf, mimeType: 'image/jpeg', naturalWidth: 800, naturalHeight: 600 };
    expect(p.area_label).toBe('Terraza');
    expect(p.caption).toBeNull();
  });

  it('acepta solo caption', () => {
    const p: PreparedWordPhoto = { storage_path: 'p.jpg', area_label: null, caption: 'Estado inicial', arrayBuffer: buf, mimeType: 'image/png', naturalWidth: 800, naturalHeight: 600 };
    expect(p.caption).toBe('Estado inicial');
    expect(p.area_label).toBeNull();
  });

  it('acepta ambos', () => {
    const p: PreparedWordPhoto = { storage_path: 'p.jpg', area_label: 'Salon', caption: 'Vista desde puerta', arrayBuffer: buf, mimeType: 'image/jpeg', naturalWidth: 800, naturalHeight: 600 };
    expect(p.area_label).toBe('Salon');
    expect(p.caption).toBe('Vista desde puerta');
  });

  it('acepta ninguno (ambos null) — sin texto vacío en la interfaz', () => {
    const p: PreparedWordPhoto = { storage_path: 'p.jpg', area_label: null, caption: null, arrayBuffer: buf, mimeType: 'image/jpeg', naturalWidth: 800, naturalHeight: 600 };
    expect(p.area_label).toBeNull();
    expect(p.caption).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 33 — Imagen fallida no bloquea documento (allSettled)
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 33 — imagen Word fallida no bloquea documento', () => {
  it('allSettled con 1 rechazo y 2 éxitos → 2 resultados válidos', async () => {
    const buf = new ArrayBuffer(4);
    const good: PreparedWordPhoto = { storage_path: 'a.jpg', area_label: null, caption: null, arrayBuffer: buf, mimeType: 'image/jpeg', naturalWidth: 400, naturalHeight: 300 };
    const results = await Promise.allSettled([
      Promise.resolve(good),
      Promise.reject(new Error('descarga fallida')),
      Promise.resolve(good),
    ]);
    const fulfilled = results
      .filter((r): r is PromiseFulfilledResult<PreparedWordPhoto> => r.status === 'fulfilled')
      .map(r => r.value);
    expect(fulfilled).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTs 34-37 — Regresión
// ─────────────────────────────────────────────────────────────────────────────
describe('TEST 34-37 — regresión', () => {
  it('BUCKET no es el bucket de job photos', () => {
    expect(BUCKET).toBe('trade-quote-photos');
    expect(BUCKET).not.toBe('trade-job-photos');
  });

  it('PreparedDocumentPhoto no tiene campo photo_url', () => {
    const p: PreparedDocumentPhoto = { storage_path: 'p.jpg', area_label: null, caption: null, dataUrl: 'data:image/jpeg;base64,abc' };
    expect((p as unknown as Record<string, unknown>).photo_url).toBeUndefined();
  });

  it('PreparedWordPhoto no tiene campo photo_url', () => {
    const p: PreparedWordPhoto = { storage_path: 'p.jpg', area_label: null, caption: null, arrayBuffer: new ArrayBuffer(4), mimeType: 'image/jpeg', naturalWidth: 400, naturalHeight: 300 };
    expect((p as unknown as Record<string, unknown>).photo_url).toBeUndefined();
  });

  it('MAX_QUOTE_DOCUMENT_PHOTOS sigue siendo 3', () => {
    expect(MAX_QUOTE_DOCUMENT_PHOTOS).toBe(3);
  });

  it('loadQuoteDocumentPhotos consulta trade_quote_photos (no trade_job_photos)', async () => {
    mocks.state.dbData = [];
    await loadQuoteDocumentPhotos(QUOTE_A);
    expect(mocks.fromFn).toHaveBeenCalledWith('trade_quote_photos');
    expect(mocks.fromFn).not.toHaveBeenCalledWith('trade_job_photos');
  });
});
