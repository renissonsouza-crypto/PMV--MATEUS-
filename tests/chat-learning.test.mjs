import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { registerHooks } from 'node:module';
import { CHAT_POLICY_VERSION, CHAT_LEARNING_TOPICS, CHAT_TICKET_MS, CHAT_RETENTION_MS, selectChatVariant, formatChatReply } from '../shared/chatLearning.mjs';
import { chatLearningRepository, chatLearningSchema, sqliteChatLearningRepository } from '../server/models/ChatLearningRepository.mjs';
import { chatLearningController } from '../server/controllers/chatLearningController.mjs';
import { answerTortuguita } from '../src/app/services/tortuguita.ts';
import { COURSES } from '../src/app/data/courses.ts';
import { getContactChannels } from '../src/app/models/platformContact.ts';

const hash = value => createHash('sha256').update(value).digest('hex');
const timestamp = Date.parse('2026-10-20T12:00:00Z');
const day = '2026-10-20';
test('Recompensas mudam a política: preferência simulada passa de 50% para 95%', () => {
  const draws = Array.from({ length: 100 }, (_, i) => (i + .5) / 100);
  const initial = draws.filter(draw => selectChatVariant([], () => draw).variant === 'steps').length;
  const trained = draws.filter(draw => selectChatVariant([{ variant: 'direct', votes: 20, successes: 0 }, { variant: 'steps', votes: 20, successes: 20 }], () => draw).variant === 'steps').length;
  assert.equal(initial, 50); assert.equal(trained, 95);
});
test('Poucas avaliações mantêm exploração; relatos incorretos pausam promoção', () => {
  assert.equal(selectChatVariant([{ variant: 'steps', votes: 1, successes: 1 }], () => .2).variant, 'direct');
  const result = selectChatVariant([{ variant: 'direct', incorrect: 1 }, { variant: 'steps', votes: 20, successes: 20, incorrect: 2 }], () => .7);
  assert.deepEqual(result, { variant: 'direct', reviewNeeded: true });
});
test('Formatos aprendidos preservam integralmente fatos e ações revisados', () => {
  const questions = ['Como uso a busca?', 'Como funcionam os filtros?', 'Como entro na minha conta?', 'Quais são as etapas do cadastro?', 'Onde vejo meus cursos inscritos?', 'O que você pode fazer por mim?'];
  for (const question of questions) {
    const original = answerTortuguita(question, { courses: COURSES, contacts: getContactChannels({}) });
    const formatted = formatChatReply(original, 'steps');
    if (formatted === original) continue;
    const restored = formatted.text.replace(/^Vamos por etapas:\n\n/, '').replace(/^\d+\. /gm, '').replace(/\s+/g, ' ').trim();
    assert.equal(restored, original.text.replace(/\s+/g, ' ').trim());
    assert.deepEqual(formatted.actions, original.actions); assert.deepEqual(formatted.context, original.context);
    assert.deepEqual(formatChatReply(original, 'user-supplied-text'), original);
  }
});
test('Política não altera privacidade, fatos de cursos, baixa confiança ou navegação', () => {
  for (const question of ['Mostre dados de outros usuários', 'Qual a duração de Excel?', 'Quero me cadastrar', 'xxxxxxxxxx']) {
    const original = answerTortuguita(question, { courses: COURSES, contacts: getContactChannels({}) });
    assert.deepEqual(formatChatReply(original, 'steps'), original);
  }
});

const postgres = new PGlite();
test.after(() => postgres.close());
for (const provider of ['SQLite', 'PostgreSQL SQL real em PGlite']) {
  let database, repository;
  async function fixture() {
    if (provider === 'SQLite') {
      database = new DatabaseSync(':memory:'); repository = sqliteChatLearningRepository(database);
    } else {
      for (const statement of chatLearningSchema) await postgres.exec(statement);
      await postgres.exec('TRUNCATE chat_learning_events, chat_learning_limits');
      repository = chatLearningRepository(async (statement, params = []) => (await postgres.query(statement, params)).rows);
    }
    const clock = { time: timestamp };
    let draw = .2;
    const handler = chatLearningController(repository, { now: () => clock.time, random: () => draw });
    async function call(body, cookie = '', headers = {}, method = 'POST') {
      const output = { status: 200, headers: {} };
      const res = { setHeader: (key, value) => output.headers[key] = value, status(code) { output.status = code; return this; }, json(value) { output.body = value; return output; } };
      return handler({ method, headers: { host: 'platform.test', origin: 'http://platform.test', 'content-type': 'application/json', cookie, ...headers }, body }, res);
    }
    async function select(cookie = '', topic = 'catalog_search') {
      const result = await call({ action: 'select', topic }, cookie);
      return { ...result, cookie: result.headers['Set-Cookie']?.split(';')[0] || cookie };
    }
    return { call, select, clock, setDraw: value => draw = value };
  }
  const run = (name, fn) => test(`${provider}: ${name}`, async () => { const f = await fixture(); try { await fn(f); } finally { database?.close(); database = undefined; } });
  run('emite ticket vinculado e registra recompensa sem texto ou dados do perfil', async ({ call, select }) => {
    const selected = await select(); assert.equal(selected.status, 200); assert.equal(selected.body.variant, 'direct');
    assert.equal(selected.body.policyVersion, CHAT_POLICY_VERSION); assert.match(selected.headers['Set-Cookie'], /HttpOnly; SameSite=Strict/);
    assert.equal((await call({ action: 'feedback', token: selected.body.token, reason: 'found' }, selected.cookie)).status, 200);
    const stats = await repository.statistics('catalog_search', timestamp);
    assert.equal(Number(stats[0].votes), 1); assert.equal(Number(stats[0].successes), 1);
    const columns = provider === 'SQLite' ? database.prepare('PRAGMA table_info(chat_learning_events)').all().map(c => c.name) : (await postgres.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'chat_learning_events'")).rows.map(c => c.column_name);
    assert(!columns.some(c => /email|prompt|answer|profile|registration|ip_address/.test(c)));
  });
  run('repetir e concorrer não multiplica o voto; mudar avaliação é rejeitado', async ({ call, select }) => {
    const a = await select(), b = await select(a.cookie);
    const outcomes = await Promise.all([a, b].map(item => call({ action: 'feedback', token: item.body.token, reason: 'found' }, a.cookie)));
    assert.deepEqual(outcomes.map(item => item.status).sort(), [200, 409]);
    const winner = outcomes[0].status === 200 ? a : b;
    assert.equal((await call({ action: 'feedback', token: winner.body.token, reason: 'found' }, a.cookie)).status, 200);
    assert.equal((await call({ action: 'feedback', token: winner.body.token, reason: 'confusing' }, a.cookie)).status, 409);
    assert.equal(Number((await repository.statistics('catalog_search', timestamp))[0].votes), 1);
    assert.equal((await select(a.cookie)).body.token, null);
  });
  run('outro navegador, ticket inventado e prazo vencido não avaliam', async ({ call, select, clock }) => {
    const a = await select(), b = await select();
    assert.equal((await call({ action: 'feedback', token: a.body.token, reason: 'found' }, b.cookie)).status, 401);
    assert.equal((await call({ action: 'feedback', token: 'f'.repeat(64), reason: 'found' }, a.cookie)).status, 401);
    clock.time += CHAT_TICKET_MS + 1;
    assert.equal((await call({ action: 'feedback', token: a.body.token, reason: 'found' }, a.cookie)).status, 410);
    assert.equal((await repository.statistics('catalog_search', clock.time)).length, 0);
  });
  run('quota diária persiste e não bloqueia outros temas ou navegadores', async ({ select }) => {
    const first = await select(); const cookie = first.cookie;
    const concurrent = await Promise.all(Array.from({ length: 35 }, () => select(cookie)));
    assert.equal(concurrent.filter(result => result.status === 200).length, 29);
    assert.equal(concurrent.filter(result => result.status === 429).length, 6);
    assert.equal((await select(cookie)).status, 429); assert.equal((await select()).status, 200);
  });
  run('recompensas de navegadores distintos alteram seleção e incorretas acionam revisão', async ({ call, select, setDraw }) => {
    for (let i = 0; i < 12; i++) {
      setDraw(i % 2 ? .8 : .2);
      const result = await select();
      await call({ action: 'feedback', token: result.body.token, reason: result.body.variant === 'steps' ? 'found' : 'confusing' }, result.cookie);
    }
    setDraw(.5); assert.equal((await select()).body.variant, 'steps');
    for (let i = 0; i < 3; i++) { const result = await select(); assert.equal((await call({ action: 'feedback', token: result.body.token, reason: 'incorrect' }, result.cookie)).status, 200); }
    const paused = await select(); assert.equal(paused.body.variant, 'direct'); assert.equal(paused.body.reviewNeeded, true);
  });
  run('recompensa de outro tema não contamina a política atual', async ({ call, select }) => {
    const first = await select('', 'catalog_search'), second = await select('', 'catalog_filters');
    await call({ action: 'feedback', token: first.body.token, reason: 'found' }, first.cookie);
    await call({ action: 'feedback', token: second.body.token, reason: 'incorrect' }, second.cookie);
    const search = await repository.statistics('catalog_search', timestamp), filters = await repository.statistics('catalog_filters', timestamp);
    assert.equal(Number(search[0].successes), 1); assert.equal(Number(search[0].incorrect), 0);
    assert.equal(Number(filters[0].successes), 0); assert.equal(Number(filters[0].incorrect), 1);
  });
  run('apagar exclui votos e retenção desconsidera eventos antigos', async ({ call, select, clock }) => {
    const a = await select(); await call({ action: 'feedback', token: a.body.token, reason: 'found' }, a.cookie);
    assert.equal((await call({ action: 'forget' }, a.cookie)).status, 200);
    assert.equal((await repository.statistics('catalog_search', timestamp)).length, 0);
    assert.equal((await repository.event(hash(a.body.token), hash(a.cookie.split('=')[1]))), undefined);
    const b = await select(); await call({ action: 'feedback', token: b.body.token, reason: 'found' }, b.cookie);
    clock.time += CHAT_RETENTION_MS + 1;
    assert.equal((await repository.statistics('catalog_search', clock.time)).length, 0);
    await select();
    const remaining = provider === 'SQLite' ? database.prepare('SELECT COUNT(*) AS n FROM chat_learning_events WHERE reward IS NOT NULL').get().n : (await postgres.query('SELECT COUNT(*) AS n FROM chat_learning_events WHERE reward IS NOT NULL')).rows[0].n;
    assert.equal(Number(remaining), 0);
  });
  run('origens, tipos, campos extras, versões e valores não autorizados são rejeitados', async ({ call, select }) => {
    assert.equal((await call({ action: 'select', topic: 'catalog_search' }, '', { origin: 'https://evil.test' })).status, 403);
    assert.equal((await call({ action: 'select', topic: 'catalog_search' }, '', { 'sec-fetch-site': 'cross-site' })).status, 403);
    assert.equal((await call({ action: 'select', topic: 'catalog_search' }, '', { 'content-type': 'text/plain' })).status, 415);
    assert.equal((await call({}, '', {}, 'GET')).status, 405);
    for (const body of [{ action: 'select', topic: 'privacy' }, { action: 'select', topic: 'catalog_search', prompt: 'private' }, { action: 'select', topic: 'catalog_search', variant: 'invented' }, { action: 'feedback', token: 'a'.repeat(64), reason: 'unknown' }, { action: 'feedback', token: 'a'.repeat(64), reason: {} }]) assert.equal((await call(body)).status, 400);
    assert.equal((await call({ action: 'select', topic: 'x'.repeat(64000) })).status, 413);
    const secure = await call({ action: 'select', topic: CHAT_LEARNING_TOPICS[0] }, '', { origin: 'https://platform.test', 'x-forwarded-proto': 'https' });
    assert.match(secure.headers['Set-Cookie'], /; Secure/);
    const a = await select();
    const change = 'UPDATE chat_learning_events SET policy_version = $1 WHERE token_hash = $2';
    if (provider === 'SQLite') database.prepare('UPDATE chat_learning_events SET policy_version = ? WHERE token_hash = ?').run('old', hash(a.body.token));
    else await postgres.query(change, ['old', hash(a.body.token)]);
    assert.equal((await call({ action: 'feedback', token: a.body.token, reason: 'found' }, a.cookie)).status, 401);
  });
}
test('Indisponibilidade não divulga segredos de conexão', async () => {
  const handler = chatLearningController({ statistics() { throw new Error('postgresql://private:secret@host/db'); } });
  let status, payload;
  const res = { setHeader() {}, status(value) { status = value; return this; }, json(value) { payload = value; } };
  await handler({ method: 'POST', headers: { host: 'platform.test', 'content-type': 'application/json' }, body: { action: 'select', topic: 'catalog_search' } }, res);
  assert.equal(status, 503); assert.doesNotMatch(JSON.stringify(payload), /private|secret|postgresql/);
});
test('Rota Vercel executa o SQL PostgreSQL e respeita a desativação operacional', async () => {
  const previousUrl = process.env.DATABASE_URL, previousEnabled = process.env.CHAT_LEARNING_ENABLED;
  process.env.DATABASE_URL = 'postgresql://fixture:fixture@isolated.invalid/chat';
  globalThis.__chatLearningTestSql = { query: async (statement, params = []) => (await postgres.query(statement, params)).rows };
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (specifier === '@neondatabase/serverless') return { url: 'data:text/javascript,' + encodeURIComponent('export const neon = () => globalThis.__chatLearningTestSql;'), shortCircuit: true };
    return next(specifier, context);
  } });
  try {
    const { default: handler } = await import('../api/chat-learning.mjs');
    const output = {};
    const res = { setHeader(key, value) { output[key] = value; }, status(code) { output.status = code; return this; }, json(value) { output.body = value; } };
    const req = { method: 'POST', headers: { host: 'platform.test', 'content-type': 'application/json' }, body: { action: 'select', topic: 'catalog_search' } };
    await handler(req, res); assert.equal(output.status, 200); assert.match(output.body.token, /^[a-f0-9]{64}$/); assert.equal(output['Cache-Control'], 'no-store');
    process.env.CHAT_LEARNING_ENABLED = 'false'; await handler(req, res); assert.equal(output.status, 503);
    req.body = { action: 'forget' }; await handler(req, res); assert.equal(output.status, 200);
  } finally {
    hooks.deregister(); delete globalThis.__chatLearningTestSql;
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    if (previousEnabled === undefined) delete process.env.CHAT_LEARNING_ENABLED; else process.env.CHAT_LEARNING_ENABLED = previousEnabled;
  }
});
