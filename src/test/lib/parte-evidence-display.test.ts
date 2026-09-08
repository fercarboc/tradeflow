/**
 * PH0 PARTE DESKTOP EVIDENCE — display logic tests
 *
 * Tests the pure conditions that gate photo and signature visibility
 * in ScreenParteTrabajo for supplement / view / edit modes.
 * No DOM rendering — pure condition derivations.
 */
import { describe, it, expect } from 'vitest';

// ── Types (inline minimal) ────────────────────────────────────────────────────

type Mode = 'edit' | 'view' | 'supplement';

type Phase =
  | 'main' | 'completing' | 'firma' | 'guardando_firma'
  | 'confirmar_mant' | 'facturar' | 'generating' | 'done';

// ── Pure display conditions (mirror ScreenParteTrabajo render logic) ──────────

/** isReadonly = mode === 'supplement' */
function isReadonly(mode: Mode): boolean {
  return mode === 'supplement';
}

/** showPhotos: shows when mode !== supplement, OR when supplement + photos exist */
function showPhotoSection(mode: Mode, photoCount: number): boolean {
  return mode !== 'supplement' || photoCount > 0;
}

/** showUploadButton: only in edit mode */
function showUploadButton(mode: Mode): boolean {
  return mode === 'edit';
}

/** showDeleteButton: only in edit mode */
function showDeleteButton(mode: Mode): boolean {
  return mode === 'edit';
}

/** showSignature: shows when (phase=done OR isReadonly) AND firma_url exists */
function showSignature(phase: Phase, mode: Mode, firmaUrl: string | null): boolean {
  return (phase === 'done' || isReadonly(mode)) && firmaUrl !== null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Photos visibility
// ══════════════════════════════════════════════════════════════════════════════

describe('Photo section visibility', () => {
  it('test 1 — edit mode always shows photos section', () => {
    expect(showPhotoSection('edit', 0)).toBe(true);
    expect(showPhotoSection('edit', 5)).toBe(true);
  });

  it('test 2 — view mode always shows photos section', () => {
    expect(showPhotoSection('view', 0)).toBe(true);
    expect(showPhotoSection('view', 3)).toBe(true);
  });

  it('test 3 — supplement mode hides section when no photos', () => {
    expect(showPhotoSection('supplement', 0)).toBe(false);
  });

  it('test 4 — supplement mode shows section when photos exist (historical evidence)', () => {
    expect(showPhotoSection('supplement', 1)).toBe(true);
    expect(showPhotoSection('supplement', 4)).toBe(true);
  });

  it('test 5 — upload button hidden in supplement mode', () => {
    expect(showUploadButton('supplement')).toBe(false);
  });

  it('test 6 — delete button hidden in supplement mode', () => {
    expect(showDeleteButton('supplement')).toBe(false);
  });

  it('test 6b — upload and delete only visible in edit mode', () => {
    expect(showUploadButton('edit')).toBe(true);
    expect(showDeleteButton('edit')).toBe(true);
    expect(showUploadButton('view')).toBe(false);
    expect(showDeleteButton('view')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Signature visibility
// ══════════════════════════════════════════════════════════════════════════════

describe('Signature visibility', () => {
  it('test 7 — supplement mode shows signature when firma_url exists (historical evidence)', () => {
    expect(showSignature('main', 'supplement', 'https://example.com/sig.png')).toBe(true);
  });

  it('test 8 — supplement mode hides signature when no firma_url', () => {
    expect(showSignature('main', 'supplement', null)).toBe(false);
  });

  it('test 9 — edit mode shows signature only in phase=done', () => {
    expect(showSignature('done', 'edit', 'https://example.com/sig.png')).toBe(true);
    expect(showSignature('main', 'edit', 'https://example.com/sig.png')).toBe(false);
    expect(showSignature('facturar', 'edit', 'https://example.com/sig.png')).toBe(false);
  });

  it('test 10 — view mode shows signature only in phase=done', () => {
    expect(showSignature('done', 'view', 'https://example.com/sig.png')).toBe(true);
    expect(showSignature('main', 'view', 'https://example.com/sig.png')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// isReadonly derivation
// ══════════════════════════════════════════════════════════════════════════════

describe('isReadonly derivation', () => {
  it('isReadonly is true only for supplement mode', () => {
    expect(isReadonly('supplement')).toBe(true);
    expect(isReadonly('edit')).toBe(false);
    expect(isReadonly('view')).toBe(false);
  });
});
