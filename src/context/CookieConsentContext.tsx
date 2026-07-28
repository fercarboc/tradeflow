import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'trabflow_cookie_consent';
const CONSENT_VERSION = 1;

export interface ConsentCategories {
  analytics: boolean;
  marketing: boolean;
}

interface StoredConsent {
  version: number;
  decidedAt: string;
  categories: ConsentCategories;
}

export interface CookieConsentContextValue {
  hasDecided: boolean;
  categories: ConsentCategories;
  preferencesOpen: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  saveCategories: (categories: ConsentCategories) => void;
  openPreferences: () => void;
}

export const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

function readStored(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(categories: ConsentCategories): void {
  const store: StoredConsent = {
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    categories,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function fireConsentMode(categories: ConsentCategories): void {
  if (typeof window === 'undefined') return;
  const g = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof g !== 'function') return;
  g('consent', 'update', {
    analytics_storage: categories.analytics ? 'granted' : 'denied',
    ad_storage: categories.marketing ? 'granted' : 'denied',
    ad_user_data: categories.marketing ? 'granted' : 'denied',
    ad_personalization: categories.marketing ? 'granted' : 'denied',
  });
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const stored = readStored();
  const [hasDecided, setHasDecided] = useState(stored !== null);
  const [categories, setCategories] = useState<ConsentCategories>(
    stored?.categories ?? { analytics: false, marketing: false }
  );
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    if (hasDecided) fireConsentMode(categories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyDecision = useCallback((cats: ConsentCategories) => {
    writeStored(cats);
    setCategories(cats);
    setHasDecided(true);
    setPreferencesOpen(false);
    fireConsentMode(cats);
  }, []);

  const acceptAll = useCallback(() => {
    applyDecision({ analytics: true, marketing: true });
  }, [applyDecision]);

  const rejectAll = useCallback(() => {
    applyDecision({ analytics: false, marketing: false });
  }, [applyDecision]);

  const saveCategories = useCallback(
    (cats: ConsentCategories) => {
      applyDecision(cats);
    },
    [applyDecision]
  );

  const openPreferences = useCallback(() => {
    setPreferencesOpen(true);
  }, []);

  return (
    <CookieConsentContext.Provider
      value={{
        hasDecided,
        categories,
        preferencesOpen,
        acceptAll,
        rejectAll,
        saveCategories,
        openPreferences,
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error('useCookieConsent must be used within CookieConsentProvider');
  return ctx;
}
