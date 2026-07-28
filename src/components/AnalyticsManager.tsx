import { useEffect } from 'react';
import { inject } from '@vercel/analytics';
import { useCookieConsent } from '../context/CookieConsentContext';

/**
 * Gestiona la activación de herramientas de analítica según el consentimiento del usuario.
 * Arquitectura documentada en docs/ANALYTICS_ARCHITECTURE.md
 *
 * Capa 1 activa: Vercel Analytics (condicionado a categories.analytics)
 * Capa 3 pendiente: Google Analytics 4, Microsoft Clarity
 * Capa 2 pendiente: Meta Pixel
 */
export default function AnalyticsManager() {
  const { categories } = useCookieConsent();

  useEffect(() => {
    if (categories.analytics) {
      // inject() es idempotente — seguro llamarlo múltiples veces
      inject();
    }
  }, [categories.analytics]);

  return null;
}
