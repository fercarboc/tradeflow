import { supabase } from '../client';

// ── Admin: AI Feedback ────────────────────────────────────────────────────────

export interface AIFeedbackRow {
  id: string;
  org_id: string;
  transcript: string;
  actuacion_ids: string[];
  ai_partidas: unknown[];
  final_partidas: unknown[];
  nuevas_partidas: unknown[];
  kb_score: number;
  applied: boolean;
  created_at: string;
}

export async function adminLoadAIFeedback(): Promise<AIFeedbackRow[]> {
  const { data, error } = await supabase
    .from('trade_ai_feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as AIFeedbackRow[];
}

export async function adminMarkFeedbackApplied(id: string): Promise<void> {
  const { error } = await supabase
    .from('trade_ai_feedback')
    .update({ applied: true })
    .eq('id', id);
  if (error) throw error;
}

