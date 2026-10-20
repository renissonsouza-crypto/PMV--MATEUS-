// A contextual bandit learns presentation preferences, never facts or free text.
export const CHAT_POLICY_VERSION = 'presentation-v1';
export const CHAT_LEARNING_TOPICS = ['catalog_search', 'catalog_filters', 'catalog_categories', 'registration', 'registration_steps', 'profile_local', 'enrollments', 'assistant-capabilities'];
export const CHAT_VARIANTS = ['direct', 'steps'];
export const CHAT_FEEDBACK = { found: 1, not_found: -1, confusing: -1, incorrect: -1 };
export const CHAT_RETENTION_MS = 30 * 86400000;
export const CHAT_TICKET_MS = 15 * 60000;
export const CHAT_DAILY_TICKETS = 30;

export function selectChatVariant(statistics, random = Math.random) {
  const rows = CHAT_VARIANTS.map(variant => {
    const row = statistics.find(item => item.variant === variant) ?? {};
    const votes = Math.max(0, Number(row.votes) || 0);
    const successes = Math.min(votes, Math.max(0, Number(row.successes) || 0));
    return { variant, votes, score: (successes + 2) / (votes + 4), incorrect: Number(row.incorrect) || 0 };
  });
  // Reports of incorrect information require editorial review. Do not promote
  // another rendering as a factual correction or let a vote rewrite knowledge.
  if (rows.reduce((sum, row) => sum + row.incorrect, 0) >= 3) return { variant: 'direct', reviewNeeded: true };
  const draw = Math.max(0, Math.min(.999999, Number(random()) || 0));
  const total = rows.reduce((sum, row) => sum + row.votes, 0);
  if (total < 8 || rows.some(row => row.votes < 2)) return { variant: CHAT_VARIANTS[Math.floor(draw * 2)], reviewNeeded: false };
  // Ten percent exploration; otherwise choose the best Beta(2,2) posterior mean.
  if (draw < .1) return { variant: CHAT_VARIANTS[Math.floor(draw * 20)], reviewNeeded: false };
  return { variant: [...rows].sort((a, b) => b.score - a.score)[0].variant, reviewNeeded: false };
}

export function formatChatReply(reply, variant) {
  if (variant !== 'steps' || !CHAT_LEARNING_TOPICS.includes(reply.intent) || reply.navigation || reply.confidence !== 'high') return reply;
  const pieces = reply.text.split(/\n\n+|(?<=[.!?])\s+(?=[A-ZÀ-Ý])/u).filter(Boolean);
  if (pieces.length < 2) return reply;
  return { ...reply, text: `Vamos por etapas:\n\n${pieces.map((piece, index) => `${index + 1}. ${piece}`).join('\n\n')}` };
}
