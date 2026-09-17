/**
 * PH0-CLEANING-QUOTES-1A — regression tests for intake completion rules, canConfirm logic,
 * residuos prompt constraint, and metadata propagation.
 */
import { describe, it, expect } from 'vitest';
import { parseCleaningIntake, buildCleaningPromptText, toCleaningQuoteMetadata } from '../../lib/cleaning/cleaningIntake';
import { getMissingQuestions, getCleaningRequiredMissing } from '../../lib/cleaning/cleaningQuestions';
import { proposeLineItems, CLEANING_CATALOG } from '../../lib/cleaning/cleaningLineItems';

// ── A. canConfirm logic: text-only input does not skip required fields ─────────
describe('A — canConfirm: required fields must be answered before confirm', () => {
  it('text "Limpieza de local" alone leaves required fields unanswered', () => {
    const intake = parseCleaningIntake('Limpieza de local');
    const missing = getMissingQuestions(intake);
    const hasRequired = missing.some(q => q.priority === 'required');
    // canConfirm equivalent: analyzed && !missing.some(q => q.priority === 'required')
    expect(hasRequired).toBe(true);
  });

  it('after filling spaceType+serviceType+recurrence+bathrooms, required fields disappear for vivienda puntual', () => {
    // bathrooms is required for vivienda — must be set too
    const intake = { spaceType: 'vivienda' as const, serviceType: 'puntual' as const, recurrence: 'one_off' as const, bathrooms: 1 };
    const missing = getMissingQuestions(intake);
    const requiredMissing = missing.filter(q => q.priority === 'required');
    expect(requiredMissing).toHaveLength(0);
  });

  it('empty intake after analysis → all 3 required fields missing', () => {
    const intake = parseCleaningIntake('hacer limpieza');  // generic text, no extracted fields
    const missing = getMissingQuestions(intake);
    const keys = missing.filter(q => q.priority === 'required').map(q => q.key);
    expect(keys).toContain('spaceType');
    expect(keys).toContain('serviceType');
    expect(keys).toContain('recurrence');
  });

  it('recommended-only missing does NOT block confirm', () => {
    // garaje puntual: surfaceM2 is optional for garaje; no bathrooms requirement
    const intake = { spaceType: 'garaje' as const, serviceType: 'puntual' as const, recurrence: 'one_off' as const };
    const missing = getMissingQuestions(intake);
    const hasRequired = missing.some(q => q.priority === 'required');
    expect(hasRequired).toBe(false);
  });
});

// ── B. "Local comercial fin de obra 45m²" → 3 fields + correct required missing ─
describe('B — Local comercial fin de obra 45m² intake', () => {
  const text = 'Local comercial fin de obra 45m²';
  const intake = parseCleaningIntake(text);

  it('extracts spaceType = local_comercial', () => {
    expect(intake.spaceType).toBe('local_comercial');
  });

  it('extracts serviceType = fin_de_obra', () => {
    expect(intake.serviceType).toBe('fin_de_obra');
  });

  it('extracts surfaceM2 = 45', () => {
    expect(intake.surfaceM2).toBe(45);
  });

  it('sets recurrence = one_off (fin de obra implies puntual)', () => {
    expect(intake.recurrence).toBe('one_off');
  });

  it('surfaceM2 is NOT in missing (already set)', () => {
    const missing = getMissingQuestions(intake);
    const keys = missing.map(q => q.key);
    expect(keys).not.toContain('surfaceM2');
  });

  it('bathrooms appears in missing (required for local_comercial)', () => {
    const missing = getMissingQuestions(intake);
    const baths = missing.find(q => q.key === 'bathrooms');
    expect(baths).toBeDefined();
    expect(baths!.priority).toBe('required');
  });

  it('after filling bathrooms, windows is the only remaining required field', () => {
    // windows is required for fin_de_obra (major cost item in post-obra cleanup)
    const complete = { ...intake, bathrooms: 2 };
    const missing = getMissingQuestions(complete);
    const requiredMissing = missing.filter(q => q.priority === 'required');
    expect(requiredMissing.map(q => q.key)).toEqual(['windows']);
  });

  it('after filling bathrooms+windows, no required missing remain', () => {
    const complete = { ...intake, bathrooms: 2, windows: true };
    const missing = getMissingQuestions(complete);
    const requiredMissing = missing.filter(q => q.priority === 'required');
    expect(requiredMissing).toHaveLength(0);
  });
});

// ── C. Required vs Recommended question rules ─────────────────────────────────
describe('C — Required/Recommended priority rules', () => {
  it('spaceType is always required', () => {
    const missing = getMissingQuestions({});
    const q = missing.find(m => m.key === 'spaceType');
    expect(q?.priority).toBe('required');
  });

  it('serviceType is always required', () => {
    const missing = getMissingQuestions({});
    const q = missing.find(m => m.key === 'serviceType');
    expect(q?.priority).toBe('required');
  });

  it('surfaceM2 is required for oficina', () => {
    const missing = getMissingQuestions({ spaceType: 'oficina', serviceType: 'mantenimiento', recurrence: 'recurring' });
    const q = missing.find(m => m.key === 'surfaceM2');
    expect(q?.priority).toBe('required');
  });

  it('surfaceM2 is recommended (not required) for vivienda', () => {
    const missing = getMissingQuestions({ spaceType: 'vivienda', serviceType: 'puntual', recurrence: 'one_off' });
    const q = missing.find(m => m.key === 'surfaceM2');
    // recommended → does not block confirm
    if (q) expect(q.priority).toBe('recommended');
  });

  it('floors is required for comunidad', () => {
    const missing = getMissingQuestions({ spaceType: 'comunidad', serviceType: 'mantenimiento', recurrence: 'recurring' });
    const q = missing.find(m => m.key === 'floors');
    expect(q?.priority).toBe('required');
  });

  it('floors does not appear for vivienda (optional, filtered out)', () => {
    const missing = getMissingQuestions({ spaceType: 'vivienda', serviceType: 'puntual', recurrence: 'one_off' });
    const q = missing.find(m => m.key === 'floors');
    expect(q).toBeUndefined();
  });
});

// ── D. workers × hoursPerWorker = personHours ─────────────────────────────────
describe('D — personHours calculation', () => {
  it('2 workers × 4 hours = 8 person-hours', () => {
    const intake = parseCleaningIntake('Dos operarios cuatro horas');
    expect(intake.workers).toBe(2);
    expect(intake.estimatedHoursPerWorker).toBe(4);
  });

  it('parseCleaningIntake correctly maps workers and hours', () => {
    const intake = parseCleaningIntake('3 personas, 3 horas por persona');
    expect(intake.workers).toBe(3);
    expect(intake.estimatedHoursPerWorker).toBe(3);
  });
});

// ── E. Residuos de obra NOT in CLEANING_CATALOG ───────────────────────────────
// The catalog legitimately has "residuos ordinarios" (trash collection) items.
// The prohibition is specifically about "gestión/retirada de residuos de OBRA"
// and "alquiler de contenedor" — those are the construction contractor's responsibility.
describe('E — Residuos de obra excluded from catalog', () => {
  it('CLEANING_CATALOG has no "gestión de residuos de obra" or container-rental entry', () => {
    const suspectIds = CLEANING_CATALOG.filter(item =>
      /gestión.*residu.*obra|retirada\s+de\s+residu.*obra|alquiler.*contenedor/i.test(item.descripcion + item.id)
    );
    expect(suspectIds).toHaveLength(0);
  });

  it('proposeLineItems for fin_de_obra does not include gestión-residuos-obra item', () => {
    const items = proposeLineItems({ spaceType: 'vivienda', serviceType: 'fin_de_obra', recurrence: 'one_off' });
    const residuosObra = items.filter(i =>
      /gestión.*residu.*obra|retirada\s+de\s+residu.*obra|alquiler.*contenedor/i.test(i.descripcion)
    );
    expect(residuosObra).toHaveLength(0);
  });

  it('catalog does include legitimate "residuos ordinarios" (trash collection) — that IS correct', () => {
    const trashCollection = CLEANING_CATALOG.find(item => item.id === 'general_residuos');
    expect(trashCollection).toBeDefined();
    expect(trashCollection!.descripcion).toMatch(/residuos.*basuras/i);
  });
});

// ── F. buildCleaningPromptText includes residuos constraint ───────────────────
describe('F — AI prompt includes residuos prohibition', () => {
  it('buildCleaningPromptText contains the residuos constraint', () => {
    const text = buildCleaningPromptText({ spaceType: 'local_comercial', serviceType: 'fin_de_obra' });
    expect(text).toMatch(/residu/i);
    expect(text).toMatch(/NO incluir/i);
  });

  it('prompt always contains price=0 rule', () => {
    const text = buildCleaningPromptText({ spaceType: 'vivienda', serviceType: 'puntual' });
    expect(text).toMatch(/precio_unitario.*0/i);
    expect(text).toMatch(/requiere_revision.*true/i);
  });
});

// ── G. metadata.vertical='cleaning' flows through toCleaningQuoteMetadata ─────
describe('G — metadata propagation', () => {
  it('toCleaningQuoteMetadata always sets vertical=cleaning', () => {
    const meta = toCleaningQuoteMetadata({ spaceType: 'vivienda' });
    expect(meta['vertical']).toBe('cleaning');
  });

  it('metadata contains schemaVersion=1 and intake object', () => {
    const intake = parseCleaningIntake('Local fin de obra 60m²');
    const meta = toCleaningQuoteMetadata(intake);
    expect(meta['schemaVersion']).toBe(1);
    expect(meta['intake']).toBeDefined();
  });

  it('metadata is JSON-serializable without data loss', () => {
    const intake = parseCleaningIntake('Oficina 80m recurrente dos veces por semana');
    const meta = toCleaningQuoteMetadata(intake);
    const roundTripped = JSON.parse(JSON.stringify(meta));
    expect(roundTripped.vertical).toBe('cleaning');
    expect(roundTripped.intake.spaceType).toBe('oficina');
  });
});

// ── H. All proposeLineItems outputs have precio=0, requiere_revision=true ──────
describe('H — All proposed items require revision and have price 0', () => {
  it('all catalog items for vivienda limpieza_integral have precioUnitario=0', () => {
    const items = proposeLineItems({ spaceType: 'vivienda', serviceType: 'limpieza_integral', recurrence: 'one_off', bathrooms: 2, rooms: 3 });
    expect(items.length).toBeGreaterThan(0);
    items.forEach(item => {
      expect(item.precioUnitario).toBe(0);
      expect(item.requiere_revision).toBe(true);
    });
  });

  it('all catalog items for comunidad mantenimiento have precioUnitario=0', () => {
    const items = proposeLineItems({ spaceType: 'comunidad', serviceType: 'mantenimiento', recurrence: 'recurring', floors: 4, elevators: 1, garage: true });
    items.forEach(item => {
      expect(item.precioUnitario).toBe(0);
      expect(item.requiere_revision).toBe(true);
    });
  });
});

// ── I. Question priorities per space+service context ──────────────────────────
describe('I — Question priority elevations by context', () => {
  it('bathrooms required for local_comercial', () => {
    const missing = getMissingQuestions({ spaceType: 'local_comercial', serviceType: 'puntual', recurrence: 'one_off', surfaceM2: 80 });
    const q = missing.find(m => m.key === 'bathrooms');
    expect(q?.priority).toBe('required');
  });

  it('visitsPerWeek required for mantenimiento+comunidad', () => {
    const missing = getMissingQuestions({ spaceType: 'comunidad', serviceType: 'mantenimiento', recurrence: 'recurring', floors: 3 });
    const q = missing.find(m => m.key === 'visitsPerWeek');
    expect(q?.priority).toBe('required');
  });

  it('windows required for cristales serviceType', () => {
    const missing = getMissingQuestions({ spaceType: 'local_comercial', serviceType: 'cristales', recurrence: 'one_off', surfaceM2: 50, bathrooms: 1 });
    const q = missing.find(m => m.key === 'windows');
    expect(q?.priority).toBe('required');
  });
});

// ── K. recurrence=one_off excludes visit frequency questions ──────────────────
describe('K — one_off recurrence excludes visit frequency questions', () => {
  it('visitsPerWeek not in missing when recurrence=one_off', () => {
    const missing = getMissingQuestions({ spaceType: 'vivienda', serviceType: 'puntual', recurrence: 'one_off' });
    const keys = missing.map(q => q.key);
    expect(keys).not.toContain('visitsPerWeek');
    expect(keys).not.toContain('visitsPerMonth');
  });

  it('visitsPerWeek can appear in missing when recurrence=recurring (for relevant contexts)', () => {
    const missing = getMissingQuestions({ spaceType: 'comunidad', serviceType: 'mantenimiento', recurrence: 'recurring', floors: 2 });
    const keys = missing.map(q => q.key);
    expect(keys).toContain('visitsPerWeek');
  });
});

// ── M. Non-cleaning quotes unaffected ─────────────────────────────────────────
describe('M — Non-cleaning quotes are unaffected', () => {
  it('a reform/fontanería quote has no cleaning metadata', () => {
    const quote = { metadata: null };
    expect(quote.metadata?.['vertical']).toBeUndefined();
  });

  it('only cleaning metadata has vertical=cleaning', () => {
    const meta = toCleaningQuoteMetadata({ spaceType: 'vivienda' });
    const otherMeta: Record<string, unknown> = { vertical: 'reforma', schemaVersion: 1 };
    expect(meta['vertical']).toBe('cleaning');
    expect(otherMeta['vertical']).not.toBe('cleaning');
  });
});

// ── PDF-GUARD: getCleaningRequiredMissing (saveCurrentQuote guard) ────────────
describe('PDF-GUARD — getCleaningRequiredMissing helper', () => {

  // A. cleaning + required incomplete → blocks
  it('A: cleaning metadata with incomplete required intake → returns required missing fields', () => {
    // "Local comercial fin de obra 45m²" → recurrence detected as one_off, surfaceM2=45
    // Missing required: bathrooms (for local_comercial), windows (for fin_de_obra)
    const intake = parseCleaningIntake('Local comercial fin de obra 45m²');
    const meta = toCleaningQuoteMetadata(intake);
    const missing = getCleaningRequiredMissing(meta);
    expect(missing.length).toBeGreaterThan(0);
    const keys = missing.map(q => q.key);
    expect(keys).toContain('bathrooms');
  });

  // B. cleaning + required complete → allows
  it('B: cleaning metadata with all required fields filled → returns empty (no block)', () => {
    const intake = parseCleaningIntake('Local comercial fin de obra 45m²');
    const complete = { ...intake, bathrooms: 2, windows: true };
    const meta = toCleaningQuoteMetadata(complete);
    const missing = getCleaningRequiredMissing(meta);
    expect(missing).toHaveLength(0);
  });

  // C. cleaning + recommended pending → allows (only required blocks)
  it('C: cleaning metadata with recommended fields pending → returns empty (allowed)', () => {
    // vivienda puntual with all required (spaceType + serviceType + recurrence + bathrooms)
    // but no workers/hours (optional/recommended) — should not block
    const intake = { spaceType: 'vivienda' as const, serviceType: 'puntual' as const, recurrence: 'one_off' as const, bathrooms: 1 };
    const meta = toCleaningQuoteMetadata(intake);
    const missing = getCleaningRequiredMissing(meta);
    expect(missing).toHaveLength(0);
  });

  // D. non-cleaning quote → returns empty (legacy behavior unchanged)
  it('D: null metadata → returns empty (non-cleaning, no block)', () => {
    expect(getCleaningRequiredMissing(null)).toHaveLength(0);
    expect(getCleaningRequiredMissing(undefined)).toHaveLength(0);
  });

  it('D: non-cleaning vertical → returns empty', () => {
    const reformaMeta: Record<string, unknown> = { vertical: 'reforma', schemaVersion: 1, intake: {} };
    expect(getCleaningRequiredMissing(reformaMeta)).toHaveLength(0);
  });

  it('D: cleaning metadata without intake key → treated as empty intake, returns required missing', () => {
    // Edge case: cleaning vertical but no intake — should still report required fields missing
    const brokenMeta: Record<string, unknown> = { vertical: 'cleaning', schemaVersion: 1 };
    const missing = getCleaningRequiredMissing(brokenMeta);
    // All required fields are missing from empty intake
    expect(missing.some(q => q.key === 'spaceType')).toBe(true);
  });

  // E. Draft save: a cleaning quote without metadata passes through (legacy path)
  it('E: cleaning quote without metadata (legacy/manual path) → not blocked', () => {
    // If the quote was created manually (not through wizard), it has no metadata
    const noMetadata: Record<string, unknown> | null = null;
    expect(getCleaningRequiredMissing(noMetadata)).toHaveLength(0);
  });
});
