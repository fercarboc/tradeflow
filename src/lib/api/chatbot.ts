import { supabase } from '../client';

// ── Chatbot ───────────────────────────────────────────────────────────────────

export interface InstallerNeed {
  id: string;
  org_id?: string;
  oficio?: string;
  question: string;
  context: Record<string, string>;
  tipo: 'unanswered' | 'unknown_oficio' | 'feature_request';
  reviewed: boolean;
  created_at: string;
}

export interface ChatbotMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatbotContext {
  oficio?: string;
  plan?: string;
  currentScreen?: string;
  orgId?: string;
}

export interface ChatbotResponse {
  answer: string;
  chips: string[];
  action: { label: string; page: string } | null;
  canAnswer: boolean;
  unknownOficio: boolean;
}

export async function callChatbot(
  message: string,
  history: ChatbotMessage[],
  context: ChatbotContext,
): Promise<ChatbotResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trade-chatbot`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, history, context }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chatbot error: ${err}`);
  }
  return res.json();
}

export async function loadInstallerNeeds(): Promise<InstallerNeed[]> {
  const { data, error } = await supabase
    .from('trade_installer_needs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InstallerNeed[];
}

export async function markNeedReviewed(id: string): Promise<void> {
  const { error } = await supabase
    .from('trade_installer_needs')
    .update({ reviewed: true })
    .eq('id', id);
  if (error) throw error;
}

