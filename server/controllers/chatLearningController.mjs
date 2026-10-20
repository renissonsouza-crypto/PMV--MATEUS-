import { createHash, randomBytes } from 'node:crypto';
import { validateJsonMutation } from './requestSecurity.mjs';
import { CHAT_FEEDBACK, CHAT_LEARNING_TOPICS, CHAT_POLICY_VERSION, CHAT_TICKET_MS, selectChatVariant } from '../../shared/chatLearning.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const validToken = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const cookieName = 'qv_chat_feedback';
const cookie = req => String(req.headers?.cookie ?? '').split(';').map(part => part.trim()).find(part => part.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
const exactKeys = (body, keys) => Object.keys(body).every(key => keys.includes(key)) && keys.every(key => Object.hasOwn(body, key));

export function chatLearningController(repository, { now = Date.now, random = Math.random } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método não permitido' }); }
    const requestError = validateJsonMutation(req);
    if (requestError) return res.status(requestError.status).json({ error: requestError.error });
    if (req.headers?.['sec-fetch-site'] === 'cross-site') return res.status(403).json({ error: 'Origem não permitida' });
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Corpo JSON inválido' });
    const timestamp = now();
    const secure = req.socket?.encrypted || String(req.headers?.['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https';
    const setCookie = (value, maxAge) => res.setHeader('Set-Cookie', `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/api/chat-learning; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
    let visitor = cookie(req);
    try {
      if (body.action === 'select' && exactKeys(body, ['action', 'topic']) && CHAT_LEARNING_TOPICS.includes(body.topic)) {
        if (process.env.CHAT_LEARNING_ENABLED === 'false') return res.status(503).json({ error: 'Aprendizado desativado. O chat continua disponível.' });
        if (!validToken(visitor)) { visitor = randomBytes(32).toString('hex'); setCookie(visitor, 30 * 86400); }
        const visitorHash = digest(visitor), day = new Date(timestamp).toISOString().slice(0, 10);
        const choice = selectChatVariant(await repository.statistics(body.topic, timestamp), random);
        if (await repository.rated(visitorHash, body.topic, day)) return res.status(200).json({ ...choice, token: null, policyVersion: CHAT_POLICY_VERSION });
        const token = randomBytes(32).toString('hex');
        const issued = await repository.issue({ tokenHash: digest(token), visitor: visitorHash, topic: body.topic, variant: choice.variant, day, now: timestamp, expires: timestamp + CHAT_TICKET_MS });
        if (!issued) return res.status(429).json({ error: 'Limite de avaliações deste navegador atingido. O chat continua disponível.' });
        return res.status(200).json({ ...choice, token, policyVersion: CHAT_POLICY_VERSION });
      }
      if (body.action === 'feedback' && exactKeys(body, ['action', 'token', 'reason']) && validToken(body.token) && typeof body.reason === 'string' && Object.hasOwn(CHAT_FEEDBACK, body.reason)) {
        if (!validToken(visitor)) return res.status(401).json({ error: 'Abra uma nova resposta para avaliar.' });
        const visitorHash = digest(visitor), tokenHash = digest(body.token);
        const event = await repository.event(tokenHash, visitorHash);
        if (!event) return res.status(401).json({ error: 'Avaliação não autorizada.' });
        if (event.reward !== null) return Number(event.reward) === CHAT_FEEDBACK[body.reason] && event.reason === body.reason
          ? res.status(200).json({ saved: true }) : res.status(409).json({ error: 'Esta resposta já foi avaliada.' });
        if (Number(event.expires_at) <= timestamp) return res.status(410).json({ error: 'A avaliação expirou. Faça uma nova pergunta.' });
        const saved = await repository.reward(tokenHash, visitorHash, CHAT_FEEDBACK[body.reason], body.reason, timestamp);
        if (!saved) {
          const repeated = await repository.event(tokenHash, visitorHash);
          if (Number(repeated?.reward) === CHAT_FEEDBACK[body.reason] && repeated.reason === body.reason) return res.status(200).json({ saved: true });
          return res.status(409).json({ error: 'Já recebemos uma avaliação deste tema hoje.' });
        }
        return res.status(200).json({ saved: true });
      }
      if (body.action === 'forget' && exactKeys(body, ['action'])) {
        if (validToken(visitor)) await repository.forget(digest(visitor));
        setCookie('', 0); return res.status(200).json({ forgotten: true });
      }
      return res.status(400).json({ error: 'Avaliação inválida. Não envie textos ou dados pessoais.' });
    } catch {
      return res.status(503).json({ error: 'Aprendizado temporariamente indisponível. Você pode continuar usando o chat.' });
    }
  };
}
