import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chatLearningSchema } from '../server/models/ChatLearningRepository.mjs';
import { CHAT_POLICY_VERSION } from '../shared/chatLearning.mjs';

test('Relatório lê o banco sem alterar votos nem exportar identificadores ou tickets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'qv-learning-report-'));
  const path = join(directory, 'fixture.sqlite'), database = new DatabaseSync(path);
  try {
    for (const statement of chatLearningSchema) database.exec(statement);
    const now = Date.now();
    database.prepare('INSERT INTO chat_learning_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('ticket-private', 'visitor-private', CHAT_POLICY_VERSION, 'catalog_search', 'direct', new Date(now).toISOString().slice(0, 10), now, now + 1000, 1, 'found', now);
    const output = execFileSync(process.execPath, [resolve('scripts/report-chat-learning.mjs')], { env: { ...process.env, DB_PATH: path, DATABASE_URL: '', POSTGRES_URL: '' }, encoding: 'utf8' });
    const report = JSON.parse(output);
    assert.equal(report.topics[0].variants[0].votes, 1); assert.equal(report.topics[0].learnedPreference, null);
    assert.doesNotMatch(output, /ticket-private|visitor-private|token_hash|visitor_hash/);
    assert.equal(database.prepare('SELECT COUNT(*) AS n FROM chat_learning_events').get().n, 1);
  } finally { database.close(); rmSync(directory, { recursive: true, force: true }); }
});
