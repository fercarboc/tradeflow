/**
 * Supabase admin helper for E2E tests.
 * Uses the service role key (never exposed to the client) to set up
 * and tear down test data without going through the UI.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.E2E_SUPABASE_SERVICE_KEY!,
);

export async function getOrgIdForUser(email: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('trade_org_members')
    .select('org_id, trade_profiles!inner(email)')
    .eq('trade_profiles.email', email)
    .eq('role', 'owner')
    .single();
  if (!data) throw new Error(`No org found for owner ${email}`);
  return data.org_id;
}

export async function deleteQuoteByTitle(title: string, orgId: string): Promise<void> {
  await supabaseAdmin
    .from('trade_quotes')
    .delete()
    .eq('org_id', orgId)
    .ilike('titulo', title);
}

export async function deleteInvitedMember(email: string, orgId: string): Promise<void> {
  const { data: profile } = await supabaseAdmin
    .from('trade_profiles')
    .select('id')
    .eq('email', email)
    .single();
  if (!profile) return;
  await supabaseAdmin
    .from('trade_org_members')
    .delete()
    .eq('org_id', orgId)
    .eq('profile_id', profile.id);
}
