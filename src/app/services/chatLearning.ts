import { CHAT_LEARNING_TOPICS, CHAT_POLICY_VERSION, CHAT_VARIANTS, formatChatReply } from '../../../shared/chatLearning.mjs';
import type { AssistantReply } from './tortuguita';

export type LearningTicket = { token: string | null; variant: string; topic: string };
export type FeedbackReason = 'found' | 'not_found' | 'confusing' | 'incorrect';
export const learningConsentKey = (profileId: number | null) => `qualificavix-chat-learning:${profileId ?? 'visitor'}`;
export function readLearningConsent(profileId: number | null): boolean {
  try { return localStorage.getItem(learningConsentKey(profileId)) === 'true'; } catch { return false; }
}
export function storeLearningConsent(profileId: number | null, enabled: boolean) {
  try { if (enabled) localStorage.setItem(learningConsentKey(profileId), 'true'); else localStorage.removeItem(learningConsentKey(profileId)); } catch { /* Session preference still works. */ }
}
class LearningRequestError extends Error {}
async function request(body: object) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch('/api/chat-learning', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    if (!response.ok) throw new LearningRequestError(response.status === 410
      ? 'Esta avaliação expirou. Faça uma nova pergunta para avaliar outra resposta.'
      : response.status === 409 ? 'Já recebemos uma avaliação deste tema neste período. Você pode continuar a conversa.'
      : response.status === 401 ? 'Esta avaliação não está disponível neste navegador. Faça uma nova pergunta.'
      : 'Não foi possível registrar a avaliação agora. Tente novamente.');
    return await response.json();
  } catch (error) {
    if (error instanceof LearningRequestError) throw error;
    throw new LearningRequestError('Não foi possível registrar a avaliação agora. Confira sua conexão e tente novamente.');
  } finally { clearTimeout(timeout); }
}
export async function adaptChatReply(reply: AssistantReply): Promise<{ reply: AssistantReply; ticket: LearningTicket | null; unavailable?: boolean }> {
  if (!CHAT_LEARNING_TOPICS.includes(reply.intent) || reply.navigation || reply.confidence !== 'high') return { reply, ticket: null };
  try {
    const selection = await request({ action: 'select', topic: reply.intent });
    if (selection.policyVersion !== CHAT_POLICY_VERSION || !CHAT_VARIANTS.includes(selection.variant) ||
      (selection.token !== null && (typeof selection.token !== 'string' || !/^[a-f0-9]{64}$/.test(selection.token)))) throw new Error('Invalid learning policy');
    return { reply: formatChatReply(reply, selection.variant), ticket: { topic: reply.intent, token: selection.token, variant: selection.variant } };
  } catch { return { reply, ticket: null, unavailable: true }; }
}
export async function sendChatFeedback(ticket: LearningTicket, reason: FeedbackReason) {
  if (!ticket.token) throw new Error('Esta resposta não tem uma avaliação disponível. Faça uma nova pergunta.');
  const response = await request({ action: 'feedback', token: ticket.token, reason });
  if (response.saved !== true) throw new Error('Não foi possível registrar a avaliação agora.');
}
export async function forgetChatFeedback() {
  const response = await request({ action: 'forget' });
  if (response.forgotten !== true) throw new Error('Não foi possível apagar as avaliações agora.');
}
