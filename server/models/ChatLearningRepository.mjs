import { CHAT_DAILY_TICKETS, CHAT_POLICY_VERSION, CHAT_RETENTION_MS } from '../../shared/chatLearning.mjs';

export const chatLearningSchema = [
  `CREATE TABLE IF NOT EXISTS chat_learning_events (
    token_hash TEXT PRIMARY KEY, visitor_hash TEXT NOT NULL, policy_version TEXT NOT NULL,
    topic TEXT NOT NULL, variant TEXT NOT NULL, day TEXT NOT NULL,
    issued_at BIGINT NOT NULL, expires_at BIGINT NOT NULL,
    reward SMALLINT CHECK(reward IN (-1, 1)), reason TEXT, rated_at BIGINT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS chat_learning_one_vote ON chat_learning_events(visitor_hash, policy_version, topic, day) WHERE reward IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS chat_learning_statistics ON chat_learning_events(policy_version, topic, issued_at)`,
  `CREATE TABLE IF NOT EXISTS chat_learning_limits (visitor_hash TEXT NOT NULL, day TEXT NOT NULL, issued INTEGER NOT NULL, PRIMARY KEY(visitor_hash, day))`,
];

// Identical parameterized SQL runs on SQLite locally and PostgreSQL in Vercel.
export function chatLearningRepository(query) {
  let ready;
  const ensure = () => ready ??= (async () => { for (const statement of chatLearningSchema) await query(statement); })().catch(error => { ready = undefined; throw error; });
  return {
    async statistics(topic, now) {
      await ensure();
      return query(`SELECT variant, COUNT(*) AS votes, SUM(CASE WHEN reward = 1 THEN 1 ELSE 0 END) AS successes,
        SUM(CASE WHEN reason = 'incorrect' THEN 1 ELSE 0 END) AS incorrect FROM chat_learning_events
        WHERE policy_version = $1 AND topic = $2 AND issued_at >= $3 AND reward IS NOT NULL GROUP BY variant`, [CHAT_POLICY_VERSION, topic, now - CHAT_RETENTION_MS]);
    },
    async rated(visitor, topic, day) {
      await ensure();
      return (await query('SELECT 1 FROM chat_learning_events WHERE visitor_hash = $1 AND policy_version = $2 AND topic = $3 AND day = $4 AND reward IS NOT NULL LIMIT 1', [visitor, CHAT_POLICY_VERSION, topic, day])).length > 0;
    },
    async issue(event) {
      await ensure();
      await query('DELETE FROM chat_learning_events WHERE issued_at < $1 OR (reward IS NULL AND expires_at < $2)', [event.now - CHAT_RETENTION_MS, event.now]);
      await query('DELETE FROM chat_learning_limits WHERE day < $1', [new Date(event.now - CHAT_RETENTION_MS).toISOString().slice(0, 10)]);
      const allowed = await query(`INSERT INTO chat_learning_limits(visitor_hash, day, issued) VALUES ($1, $2, 1)
        ON CONFLICT(visitor_hash, day) DO UPDATE SET issued = chat_learning_limits.issued + 1
        WHERE chat_learning_limits.issued < $3 RETURNING issued`, [event.visitor, event.day, CHAT_DAILY_TICKETS]);
      if (!allowed.length) return false;
      await query(`INSERT INTO chat_learning_events(token_hash, visitor_hash, policy_version, topic, variant, day, issued_at, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [event.tokenHash, event.visitor, CHAT_POLICY_VERSION, event.topic, event.variant, event.day, event.now, event.expires]);
      return true;
    },
    async event(tokenHash, visitor) {
      await ensure();
      return (await query('SELECT * FROM chat_learning_events WHERE token_hash = $1 AND visitor_hash = $2 AND policy_version = $3', [tokenHash, visitor, CHAT_POLICY_VERSION]))[0];
    },
    async reward(tokenHash, visitor, reward, reason, now) {
      await ensure();
      try {
        return (await query(`UPDATE chat_learning_events SET reward = $1, reason = $2, rated_at = $3
          WHERE token_hash = $4 AND visitor_hash = $5 AND policy_version = $6 AND reward IS NULL AND expires_at > $3 RETURNING token_hash`, [reward, reason, now, tokenHash, visitor, CHAT_POLICY_VERSION])).length > 0;
      } catch (error) {
        if (String(error.code) === '23505' || /UNIQUE constraint failed/.test(String(error.message))) return false;
        throw error;
      }
    },
    async forget(visitor) {
      await ensure();
      await query('DELETE FROM chat_learning_events WHERE visitor_hash = $1', [visitor]);
      // Operational issuance counters expire separately and contain no ratings.
    },
  };
}

export function sqliteChatLearningRepository(database) {
  return chatLearningRepository(async (statement, params = []) => {
    const ordered = [];
    const sqlite = statement.replace(/\$(\d+)/g, (_, position) => { ordered.push(params[Number(position) - 1]); return '?'; });
    return database.prepare(sqlite).all(...ordered);
  });
}
