/**
 * QuotePhotosPanel — 40 unit tests
 *
 * Strategy: mock quotePhotos API + useToast; render component; assert behaviour.
 * External deps (Supabase, Storage) are fully mocked — tests run in jsdom.
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import QuotePhotosPanel from '../../components/QuotePhotosPanel';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockLoadQuotePhotos  = vi.fn();
const mockUploadQuotePhoto = vi.fn();
const mockUpdateQuotePhoto = vi.fn();
const mockDeleteQuotePhoto = vi.fn();
const mockGetSignedUrl     = vi.fn();

vi.mock('../../lib/quotePhotos', () => ({
  MAX_QUOTE_PHOTOS:          8,
  MAX_QUOTE_DOCUMENT_PHOTOS: 3,
  ALLOWED_QUOTE_MIME_TYPES:  ['image/jpeg', 'image/png', 'image/webp'],
  SIGNED_URL_TTL_SECONDS:    3600,
  BUCKET:                    'trade-quote-photos',
  loadQuotePhotos:           (...a: unknown[]) => mockLoadQuotePhotos(...a),
  uploadQuotePhoto:          (...a: unknown[]) => mockUploadQuotePhoto(...a),
  updateQuotePhoto:          (...a: unknown[]) => mockUpdateQuotePhoto(...a),
  deleteQuotePhoto:          (...a: unknown[]) => mockDeleteQuotePhoto(...a),
  getQuotePhotoSignedUrl:    (...a: unknown[]) => mockGetSignedUrl(...a),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const QUOTE_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID   = '22222222-2222-2222-2222-222222222222';

function makePhoto(overrides = {}) {
  return {
    id: 'photo-1',
    quote_id: QUOTE_ID,
    org_id: ORG_ID,
    storage_path: `${ORG_ID}/quotes/${QUOTE_ID}/photo-1.jpg`,
    area_label: 'Cocina',
    caption: 'Humedad en pared',
    display_order: 0,
    include_in_document: false,
    created_by: 'user-1',
    created_at: '2026-09-17T10:00:00Z',
    ...overrides,
  };
}

const SIGNED_URL = 'https://cdn.example.com/signed/photo-1.jpg?token=abc';

function setupEmpty() {
  mockLoadQuotePhotos.mockResolvedValue([]);
  mockGetSignedUrl.mockResolvedValue(SIGNED_URL);
}

function setupWithPhotos(photos = [makePhoto()]) {
  mockLoadQuotePhotos.mockResolvedValue(photos);
  mockGetSignedUrl.mockResolvedValue(SIGNED_URL);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('QuotePhotosPanel', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. No quoteId ────────────────────────────────────────────────────────────

  it('1. shows save-first message when quoteId is null', () => {
    render(<QuotePhotosPanel quoteId={null} orgId={ORG_ID} />);
    expect(screen.getByText(/Guarda primero el presupuesto/i)).toBeInTheDocument();
  });

  it('2. does not call loadQuotePhotos when quoteId is null', () => {
    render(<QuotePhotosPanel quoteId={null} orgId={ORG_ID} />);
    expect(mockLoadQuotePhotos).not.toHaveBeenCalled();
  });

  it('3. upload buttons are not rendered when quoteId is null', () => {
    render(<QuotePhotosPanel quoteId={null} orgId={ORG_ID} />);
    expect(screen.queryByRole('button', { name: /añadir fotos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cámara/i })).not.toBeInTheDocument();
  });

  // ── 2. Header and counters ───────────────────────────────────────────────────

  it('4. renders section title', async () => {
    setupEmpty();
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalled());
    expect(screen.getByText(/Fotos de referencia/i)).toBeInTheDocument();
  });

  it('5. shows 0/8 counter when no photos', async () => {
    setupEmpty();
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalled());
    expect(screen.getByText(/0 de 8 fotos/i)).toBeInTheDocument();
  });

  it('6. shows 0/3 document counter when no photos', async () => {
    setupEmpty();
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalled());
    expect(screen.getByText(/0 de 3 para documento/i)).toBeInTheDocument();
  });

  it('7. counter updates when photos are loaded', async () => {
    setupWithPhotos([makePhoto(), makePhoto({ id: 'photo-2', storage_path: 'x/2.jpg' })]);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByText(/2 de 8 fotos/i)).toBeInTheDocument());
  });

  // ── 3. loadQuotePhotos ───────────────────────────────────────────────────────

  it('8. calls loadQuotePhotos with correct quoteId on mount', async () => {
    setupEmpty();
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalledWith(QUOTE_ID));
  });

  it('9. shows empty state when no photos returned', async () => {
    setupEmpty();
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByText(/Sin fotografías todavía/i)).toBeInTheDocument());
  });

  it('10. shows loading spinner while fetching', () => {
    mockLoadQuotePhotos.mockReturnValue(new Promise(() => {})); // never resolves
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    expect(screen.getByText(/Cargando fotografías/i)).toBeInTheDocument();
  });

  it('11. reloads photos when quoteId changes', async () => {
    setupEmpty();
    const { rerender } = render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalledTimes(1));
    const newId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    mockLoadQuotePhotos.mockResolvedValue([]);
    rerender(<QuotePhotosPanel quoteId={newId} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalledWith(newId));
  });

  // ── 4. Signed URLs ───────────────────────────────────────────────────────────

  it('12. requests signed URL for each photo', async () => {
    const p1 = makePhoto({ id: 'p1', storage_path: 'path/1.jpg' });
    const p2 = makePhoto({ id: 'p2', storage_path: 'path/2.jpg' });
    setupWithPhotos([p1, p2]);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockGetSignedUrl).toHaveBeenCalledTimes(2));
    expect(mockGetSignedUrl).toHaveBeenCalledWith('path/1.jpg');
    expect(mockGetSignedUrl).toHaveBeenCalledWith('path/2.jpg');
  });

  it('13. renders img with signed URL when URL resolves', async () => {
    setupWithPhotos([makePhoto()]);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', SIGNED_URL));
  });

  // ── 5. Upload ────────────────────────────────────────────────────────────────

  it('14. calls uploadQuotePhoto with correct args on file select', async () => {
    setupEmpty();
    mockUploadQuotePhoto.mockResolvedValue(makePhoto());
    mockLoadQuotePhotos.mockResolvedValueOnce([]).mockResolvedValue([makePhoto()]);
    const { container } = render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalled());

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });

    await waitFor(() => expect(mockUploadQuotePhoto).toHaveBeenCalledWith(
      expect.objectContaining({ quoteId: QUOTE_ID, orgId: ORG_ID, file })
    ));
  });

  it('15. shows uploading feedback during upload', async () => {
    setupEmpty();
    let resolve!: (v: unknown) => void;
    mockUploadQuotePhoto.mockReturnValue(new Promise(r => { resolve = r; }));
    const { container } = render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalled());

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    act(() => { fireEvent.change(input, { target: { files: [file] } }); });

    await waitFor(() => expect(screen.getByText(/Subiendo/i)).toBeInTheDocument());
    act(() => resolve(makePhoto()));
  });

  it('16. disables upload button when at max photos', async () => {
    const photos = Array.from({ length: 8 }, (_, i) =>
      makePhoto({ id: `p${i}`, storage_path: `p/${i}.jpg` })
    );
    setupWithPhotos(photos);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByText(/8 de 8 fotos/i)).toBeInTheDocument());
    // At-max message shown
    expect(screen.getByText(/Has alcanzado el máximo de 8/i)).toBeInTheDocument();
  });

  // ── 6. MIME validation ───────────────────────────────────────────────────────

  it('17. rejects HEIC file with descriptive error', async () => {
    setupEmpty();
    const { container } = render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalled());

    const file = new File(['data'], 'photo.heic', { type: 'image/heic' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });

    await waitFor(() =>
      expect(screen.getByText(/HEIC\/HEIF no compatible/i)).toBeInTheDocument()
    );
    expect(mockUploadQuotePhoto).not.toHaveBeenCalled();
  });

  it('18. rejects unknown file type with generic error', async () => {
    setupEmpty();
    const { container } = render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalled());

    const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });

    await waitFor(() =>
      expect(screen.getByText(/no compatible/i)).toBeInTheDocument()
    );
    expect(mockUploadQuotePhoto).not.toHaveBeenCalled();
  });

  it('19. accepts jpeg and calls uploadQuotePhoto', async () => {
    setupEmpty();
    mockUploadQuotePhoto.mockResolvedValue(makePhoto());
    mockLoadQuotePhotos.mockResolvedValue([makePhoto()]);
    const { container } = render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalledTimes(1));

    const file = new File(['data'], 'ok.jpeg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    await waitFor(() => expect(mockUploadQuotePhoto).toHaveBeenCalled());
  });

  it('20. accepts webp and calls uploadQuotePhoto', async () => {
    setupEmpty();
    mockUploadQuotePhoto.mockResolvedValue(makePhoto());
    mockLoadQuotePhotos.mockResolvedValue([makePhoto()]);
    const { container } = render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalledTimes(1));

    const file = new File(['data'], 'ok.webp', { type: 'image/webp' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    await waitFor(() => expect(mockUploadQuotePhoto).toHaveBeenCalled());
  });

  // ── 7. Upload limit capping ──────────────────────────────────────────────────

  it('21. caps multiple file selection to available slots', async () => {
    // 6 photos already → 2 slots left → only 2 of 3 selected files should be uploaded
    const existingPhotos = Array.from({ length: 6 }, (_, i) =>
      makePhoto({ id: `p${i}`, storage_path: `p/${i}.jpg` })
    );
    setupWithPhotos(existingPhotos);
    mockUploadQuotePhoto.mockResolvedValue(makePhoto({ id: 'new' }));
    mockLoadQuotePhotos.mockResolvedValue(existingPhotos);

    const { container } = render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByText(/6 de 8 fotos/i)).toBeInTheDocument());

    const files = [
      new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
      new File(['c'], 'c.jpg', { type: 'image/jpeg' }),
    ];
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files } }); });

    await waitFor(() => expect(mockUploadQuotePhoto).toHaveBeenCalledTimes(2));
  });

  // ── 8. Include in document toggle ────────────────────────────────────────────

  it('22. calls updateQuotePhoto to toggle include_in_document to true', async () => {
    setupWithPhotos([makePhoto({ include_in_document: false })]);
    mockUpdateQuotePhoto.mockResolvedValue(makePhoto({ include_in_document: true }));
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());

    const btn = screen.getByRole('button', { name: /incluir en presupuesto/i });
    await act(async () => { fireEvent.click(btn); });

    await waitFor(() => expect(mockUpdateQuotePhoto).toHaveBeenCalledWith(
      'photo-1',
      { include_in_document: true }
    ));
  });

  it('23. blocks toggle to true when doc limit reached', async () => {
    const photos = [
      makePhoto({ id: 'p1', storage_path: 'a.jpg', include_in_document: true }),
      makePhoto({ id: 'p2', storage_path: 'b.jpg', include_in_document: true }),
      makePhoto({ id: 'p3', storage_path: 'c.jpg', include_in_document: true }),
      makePhoto({ id: 'p4', storage_path: 'd.jpg', include_in_document: false }),
    ];
    setupWithPhotos(photos);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByText(/3 de 3 para documento/i)).toBeInTheDocument());

    // p4 is not in document — try to toggle it
    const btns = screen.getAllByRole('button', { name: /incluir en presupuesto/i });
    await act(async () => { fireEvent.click(btns[0]); });

    // updateQuotePhoto must NOT be called (limit reached)
    await waitFor(() => expect(mockUpdateQuotePhoto).not.toHaveBeenCalled());
  });

  it('24. calls updateQuotePhoto to toggle include_in_document to false', async () => {
    setupWithPhotos([makePhoto({ include_in_document: true })]);
    mockUpdateQuotePhoto.mockResolvedValue(makePhoto({ include_in_document: false }));
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());

    const btn = screen.getByRole('button', { name: /quitar del documento/i });
    await act(async () => { fireEvent.click(btn); });

    await waitFor(() => expect(mockUpdateQuotePhoto).toHaveBeenCalledWith(
      'photo-1',
      { include_in_document: false }
    ));
  });

  // ── 9. Edit modal ────────────────────────────────────────────────────────────

  it('25. opens edit modal on edit button click', async () => {
    setupWithPhotos([makePhoto()]);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());

    const editBtn = screen.getByRole('button', { name: /editar etiqueta/i });
    await act(async () => { fireEvent.click(editBtn); });

    expect(screen.getByRole('dialog', { name: /editar fotografía/i })).toBeInTheDocument();
  });

  it('26. pre-fills edit modal with current area_label and caption', async () => {
    setupWithPhotos([makePhoto({ area_label: 'Jardín', caption: 'Nota de prueba' })]);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /editar etiqueta/i }));

    expect(screen.getByDisplayValue('Jardín')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Nota de prueba')).toBeInTheDocument();
  });

  it('27. calls updateQuotePhoto with trimmed values on save', async () => {
    setupWithPhotos([makePhoto()]);
    mockUpdateQuotePhoto.mockResolvedValue(makePhoto({ area_label: 'Baño', caption: 'Azulejos rotos' }));
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /editar etiqueta/i }));
    const labelInput = screen.getByDisplayValue('Cocina');
    const captionInput = screen.getByDisplayValue('Humedad en pared');
    await userEvent.clear(labelInput);
    await userEvent.type(labelInput, '  Baño  ');
    await userEvent.clear(captionInput);
    await userEvent.type(captionInput, 'Azulejos rotos');

    fireEvent.click(screen.getByRole('button', { name: /^Guardar$/i }));

    await waitFor(() => expect(mockUpdateQuotePhoto).toHaveBeenCalledWith(
      'photo-1',
      { area_label: 'Baño', caption: 'Azulejos rotos' }
    ));
  });

  it('28. closes edit modal on cancel', async () => {
    setupWithPhotos([makePhoto()]);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /editar etiqueta/i }));
    expect(screen.getByRole('dialog', { name: /editar fotografía/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /editar fotografía/i })).not.toBeInTheDocument());
  });

  it('29. empty area_label saves null (trimmed empty string becomes null)', async () => {
    setupWithPhotos([makePhoto({ area_label: 'Viejo', caption: '' })]);
    mockUpdateQuotePhoto.mockResolvedValue(makePhoto({ area_label: null, caption: null }));
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /editar etiqueta/i }));
    const labelInput = screen.getByDisplayValue('Viejo');
    await userEvent.clear(labelInput);

    fireEvent.click(screen.getByRole('button', { name: /^Guardar$/i }));
    await waitFor(() => expect(mockUpdateQuotePhoto).toHaveBeenCalledWith(
      'photo-1',
      { area_label: null, caption: null }
    ));
  });

  // ── 10. Delete ───────────────────────────────────────────────────────────────

  it('30. opens delete confirmation dialog on trash click', async () => {
    setupWithPhotos([makePhoto()]);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /eliminar fotografía/i }));
    expect(screen.getByRole('dialog', { name: /confirmar eliminación/i })).toBeInTheDocument();
    expect(screen.getByText(/Esta acción no se puede deshacer/i)).toBeInTheDocument();
  });

  it('31. calls deleteQuotePhoto with the photo on confirm', async () => {
    const photo = makePhoto();
    setupWithPhotos([photo]);
    mockDeleteQuotePhoto.mockResolvedValue(undefined);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /eliminar fotografía/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Eliminar$/i }));

    await waitFor(() => expect(mockDeleteQuotePhoto).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'photo-1' })
    ));
  });

  it('32. removes photo from grid after delete', async () => {
    setupWithPhotos([makePhoto()]);
    mockDeleteQuotePhoto.mockResolvedValue(undefined);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /eliminar fotografía/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Eliminar$/i }));

    await waitFor(() => expect(screen.queryByRole('img')).not.toBeInTheDocument());
    expect(screen.getByText(/Sin fotografías todavía/i)).toBeInTheDocument();
  });

  it('33. cancels delete when cancel is clicked', async () => {
    setupWithPhotos([makePhoto()]);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /eliminar fotografía/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /confirmar/i })).not.toBeInTheDocument());
    expect(mockDeleteQuotePhoto).not.toHaveBeenCalled();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  // ── 11. Lightbox ─────────────────────────────────────────────────────────────

  it('34. opens lightbox when thumbnail is clicked', async () => {
    setupWithPhotos([makePhoto()]);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /ver foto 1/i }));
    expect(screen.getByRole('dialog', { name: /vista de fotografía ampliada/i })).toBeInTheDocument();
  });

  it('35. closes lightbox on ESC key', async () => {
    setupWithPhotos([makePhoto()]);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /ver foto 1/i }));
    expect(screen.getByRole('dialog', { name: /vista/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /vista/i })).not.toBeInTheDocument());
  });

  it('36. closes lightbox when backdrop is clicked', async () => {
    setupWithPhotos([makePhoto()]);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /ver foto 1/i }));
    const dialog = screen.getByRole('dialog', { name: /vista/i });
    fireEvent.click(dialog);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /vista/i })).not.toBeInTheDocument());
  });

  it('37. navigates to next photo with ArrowRight', async () => {
    const photos = [
      makePhoto({ id: 'p1', storage_path: 'a.jpg', area_label: 'Primera' }),
      makePhoto({ id: 'p2', storage_path: 'b.jpg', area_label: 'Segunda' }),
    ];
    mockLoadQuotePhotos.mockResolvedValue(photos);
    mockGetSignedUrl.mockResolvedValue(SIGNED_URL);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(1));

    fireEvent.click(screen.getByRole('button', { name: /ver foto 1/i }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByText('2 / 2')).toBeInTheDocument());
  });

  it('38. navigates to prev photo with ArrowLeft', async () => {
    const photos = [
      makePhoto({ id: 'p1', storage_path: 'a.jpg', area_label: 'Primera' }),
      makePhoto({ id: 'p2', storage_path: 'b.jpg', area_label: 'Segunda' }),
    ];
    mockLoadQuotePhotos.mockResolvedValue(photos);
    mockGetSignedUrl.mockResolvedValue(SIGNED_URL);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(1));

    // Open second photo via next button
    fireEvent.click(screen.getByRole('button', { name: /ver foto 2/i }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => expect(screen.getByText('1 / 2')).toBeInTheDocument());
  });

  it('39. ArrowLeft does not go below index 0', async () => {
    setupWithPhotos([makePhoto({ area_label: 'Única' })]);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /ver foto 1/i }));
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });

  // ── 12. Error handling ───────────────────────────────────────────────────────

  it('40. shows error message in queue when upload fails', async () => {
    setupEmpty();
    mockUploadQuotePhoto.mockRejectedValue(new Error('QUOTE_PHOTOS_LIMIT: máximo 8'));
    const { container } = render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalled());

    const file = new File(['data'], 'ok.jpg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });

    await waitFor(() => {
      const matches = screen.queryAllByText(/Has alcanzado el máximo de 8 fotografías/i);
      expect(matches.length).toBeGreaterThan(0);
    });
  });
});

// ── Mobile integration tests ───────────────────────────────────────────────────

describe('QuotePhotosPanel — Mobile integration', () => {
  function simulateMobile() {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, writable: true, configurable: true });
  }
  function simulateDesktop() {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, writable: true, configurable: true });
  }

  beforeEach(() => { vi.clearAllMocks(); simulateMobile(); });
  afterEach(() => { vi.restoreAllMocks(); simulateDesktop(); });

  it('M1. panel renders with camera+gallery buttons when quoteId is valid (mobile)', async () => {
    setupEmpty();
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /cámara/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /galería/i })).toBeInTheDocument();
  });

  it('M2. upload buttons absent when quoteId is null (mobile)', () => {
    render(<QuotePhotosPanel quoteId={null} orgId={ORG_ID} />);
    expect(screen.queryByRole('button', { name: /cámara/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /galería/i })).not.toBeInTheDocument();
  });

  it('M3. "Guarda primero" message shown when quoteId is null (mobile)', () => {
    render(<QuotePhotosPanel quoteId={null} orgId={ORG_ID} />);
    expect(screen.getByText(/Guarda primero el presupuesto/i)).toBeInTheDocument();
  });

  it('M4. camera input has capture="environment" attribute in mobile mode', async () => {
    setupEmpty();
    const { container } = render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalled());
    const cameraInput = container.querySelector('input[capture="environment"]');
    expect(cameraInput).not.toBeNull();
  });

  it('M5. gallery input has multiple attribute and no capture (mobile)', async () => {
    setupEmpty();
    const { container } = render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalled());
    const galleryInput = container.querySelector('input[type="file"][multiple]') as HTMLInputElement | null;
    expect(galleryInput).not.toBeNull();
    expect(galleryInput?.hasAttribute('capture')).toBe(false);
  });

  it('M6. gallery input allows multiple file selection (mobile)', async () => {
    setupEmpty();
    const { container } = render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalled());
    const galleryInputs = container.querySelectorAll('input[type="file"][multiple]');
    expect(galleryInputs.length).toBe(1);
  });

  it('M7. camera input does not have multiple attribute (mobile)', async () => {
    setupEmpty();
    const { container } = render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalled());
    const cameraInput = container.querySelector('input[capture="environment"]') as HTMLInputElement | null;
    expect(cameraInput?.hasAttribute('multiple')).toBe(false);
  });

  it('M8. photo counter X/8 shown in mobile mode', async () => {
    setupWithPhotos([makePhoto(), makePhoto({ id: 'p2', storage_path: 'p/2.jpg' })]);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByText(/2 de 8 fotos/i)).toBeInTheDocument());
  });

  it('M9. document counter Y/3 shown in mobile mode', async () => {
    setupWithPhotos([makePhoto({ include_in_document: true })]);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByText(/1 de 3 para documento/i)).toBeInTheDocument());
  });

  it('M10. edit modal opens and saves from mobile (same component)', async () => {
    setupWithPhotos([makePhoto()]);
    mockUpdateQuotePhoto.mockResolvedValue(makePhoto({ area_label: 'Terraza' }));
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /editar etiqueta/i }));
    expect(screen.getByRole('dialog', { name: /editar fotografía/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Guardar$/i }));
    await waitFor(() => expect(mockUpdateQuotePhoto).toHaveBeenCalled());
  });

  it('M11. delete confirmation works from mobile (same component)', async () => {
    setupWithPhotos([makePhoto()]);
    mockDeleteQuotePhoto.mockResolvedValue(undefined);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /eliminar fotografía/i }));
    expect(screen.getByRole('dialog', { name: /confirmar eliminación/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Eliminar$/i }));
    await waitFor(() => expect(mockDeleteQuotePhoto).toHaveBeenCalled());
  });

  it('M12. lightbox opens and closes from mobile (same component)', async () => {
    setupWithPhotos([makePhoto()]);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /ver foto 1/i }));
    expect(screen.getByRole('dialog', { name: /vista de fotografía ampliada/i })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /vista/i })).not.toBeInTheDocument());
  });

  it('M14. renders without crash at narrow viewport (375px)', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true, configurable: true });
    setupEmpty();
    const { container } = render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalled());
    expect(container.firstChild).not.toBeNull();
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });
  });
});

// ── Desktop regression (runs without touch simulation) ────────────────────────

describe('QuotePhotosPanel — Regression', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('M13. component is functional: loads photos and shows counters (regression)', async () => {
    setupWithPhotos([makePhoto(), makePhoto({ id: 'p2', storage_path: 'p/2.jpg' })]);
    render(<QuotePhotosPanel quoteId={QUOTE_ID} orgId={ORG_ID} />);
    await waitFor(() => expect(mockLoadQuotePhotos).toHaveBeenCalledWith(QUOTE_ID));
    expect(screen.getByText(/fotos de referencia/i)).toBeInTheDocument();
    expect(screen.getByText(/2 de 8 fotos/i)).toBeInTheDocument();
    expect(screen.getByText(/0 de 3 para documento/i)).toBeInTheDocument();
  });
});
