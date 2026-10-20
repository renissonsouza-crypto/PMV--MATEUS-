import '../server/config/environment.mjs';
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHAT_POLICY_VERSION, CHAT_RETENTION_MS, selectChatVariant } from '../shared/chatLearning.mjs';
import { getSql } from '../server/config/postgres.mjs';

// Read-only operational report. Never exports visitor identifiers or tickets.
const statement = `SELECT topic, variant, COUNT(*) AS votes,
  SUM(CASE WHEN reward = 1 THEN 1 ELSE 0 END) AS successes,
  SUM(CASE WHEN reason = 'incorrect' THEN 1 ELSE 0 END) AS incorrect
  FROM chat_learning_events WHERE policy_version = $1 AND issued_at >= $2 AND reward IS NOT NULL GROUP BY topic, variant ORDER BY topic, variant`;
const params = [CHAT_POLICY_VERSION, Date.now() - CHAT_RETENTION_MS];
try {
  let rows;
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) rows = await getSql().query(statement, params);
  else {
    const path = resolve(process.env.DB_PATH || 'data/qualificavix.sqlite');
    if (!existsSync(path)) rows = [];
    else {
      const database = new DatabaseSync(path, { readOnly: true });
      try { rows = database.prepare(statement.replace(/\$\d/g, '?')).all(...params); }
      catch (error) { if (/no such table/.test(error.message)) rows = []; else throw error; }
      finally { database.close(); }
    }
  }
  const topics = [...new Set(rows.map(row => row.topic))].map(topic => {
    const variants = rows.filter(row => row.topic === topic).map(row => ({ variant: row.variant, votes: Number(row.votes), successes: Number(row.successes), incorrect: Number(row.incorrect) }));
    const choice = selectChatVariant(variants, () => .5);
    const enough = variants.length === 2 && variants.every(row => row.votes >= 2) && variants.reduce((sum, row) => sum + row.votes, 0) >= 8;
    return { topic, variants, learnedPreference: enough && !choice.reviewNeeded ? choice.variant : null, reviewNeeded: choice.reviewNeeded };
  });
  console.log(JSON.stringify({ policyVersion: CHAT_POLICY_VERSION, retentionDays: 30, topics, note: 'Avaliações voluntárias indicam utilidade percebida, sem comprovar correção factual ou representar todos os usuários. Ausência de votos mantém exploração entre formatos revisados.' }, null, 2));
} catch { console.error('Não foi possível ler o relatório de aprendizado. Confira a configuração e a disponibilidade do banco; nenhum dado foi alterado.'); process.exitCode = 1; }
