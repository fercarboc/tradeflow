// TEMPORARY_MARKETPLACE_V2_PREVIEW
// Remove this file once VITE_MARKETPLACE_ENABLED=true is deployed to production.
const MARKETPLACE_V2_PREVIEW_EMAILS = ['legal@inmostay.com'];

export function canAccessMarketplaceV2(email: string | null | undefined): boolean {
  if (!email) return false;
  return MARKETPLACE_V2_PREVIEW_EMAILS.includes(email.toLowerCase().trim());
}
