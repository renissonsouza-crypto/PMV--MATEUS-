import { ensurePostgresSchema, getSql } from '../config/postgres.mjs';
import { sqliteEnrollmentRepository } from './SqliteEnrollmentRepository.mjs';
import { postgresEnrollmentRepository } from './PostgresEnrollmentRepository.mjs';
export function sqliteAuthRepository(db) {
  return {
    session: sqliteEnrollmentRepository(db).session,
    async createSignup(hash, identity, expires) { db.prepare('DELETE FROM google_signup_intents WHERE expires_at <= ?').run(new Date().toISOString()); db.prepare('INSERT INTO google_signup_intents VALUES (?, ?, ?, ?, ?)').run(hash, identity.subject, identity.email, identity.name ?? '', expires); },
    async signup(hash) { return db.prepare('SELECT subject, email, name FROM google_signup_intents WHERE token_hash = ? AND expires_at > ?').get(hash, new Date().toISOString()); },
    async revokeSignup(hash) { db.prepare('DELETE FROM google_signup_intents WHERE token_hash = ?').run(hash); },
    async challenge(hash, expires) { db.prepare('DELETE FROM google_login_challenges WHERE expires_at <= ?').run(new Date().toISOString()); db.prepare('INSERT INTO google_login_challenges VALUES (?, ?)').run(hash, expires); },
    async consumeChallenge(hash) { return Boolean(db.prepare('DELETE FROM google_login_challenges WHERE token_hash = ? AND expires_at > ? RETURNING token_hash').get(hash, new Date().toISOString())); },
    async bySubject(subject) { return db.prepare('SELECT registration_id AS id FROM google_identities WHERE subject = ?').get(subject); },
    async bind(subject, id) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const inserted = db.prepare('INSERT INTO google_identities(subject, registration_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(subject, id);
        // First verified ownership invalidates credentials issued before identity verification.
        if (inserted.changes) db.prepare('DELETE FROM profile_sessions WHERE registration_id = ?').run(id);
        const row = db.prepare('SELECT registration_id AS id FROM google_identities WHERE subject = ?').get(subject);
        db.exec('COMMIT'); return row;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    async byEmail(email) { return db.prepare('SELECT id FROM registrations WHERE lower(trim(email)) = ? LIMIT 2').all(email); },
    async authenticated(hash) { return db.prepare('SELECT r.* FROM registrations r JOIN profile_sessions s ON s.registration_id = r.id WHERE s.token_hash = ? AND s.expires_at > ?').get(hash, new Date().toISOString()); },
    async enrollments(id) { return db.prepare('SELECT * FROM course_enrollment_requests WHERE registration_id = ? AND confirmed_at IS NOT NULL ORDER BY confirmed_at DESC').all(id); },
    async revoke(hashes) { for (const hash of hashes) db.prepare('DELETE FROM profile_sessions WHERE token_hash = ?').run(hash); },
  };
}
export function postgresAuthRepository() {
  const ready = async () => { await ensurePostgresSchema(); return getSql(); };
  return {
    session: postgresEnrollmentRepository().session,
    async createSignup(hash, identity, expires) { const sql = await ready(); await sql`DELETE FROM google_signup_intents WHERE expires_at <= ${new Date().toISOString()}`; await sql`INSERT INTO google_signup_intents(token_hash, subject, email, name, expires_at) VALUES (${hash}, ${identity.subject}, ${identity.email}, ${identity.name ?? ''}, ${expires})`; },
    async signup(hash) { const sql = await ready(); const [row] = await sql`SELECT subject, email, name FROM google_signup_intents WHERE token_hash = ${hash} AND expires_at > ${new Date().toISOString()}`; return row; },
    async revokeSignup(hash) { const sql = await ready(); await sql`DELETE FROM google_signup_intents WHERE token_hash = ${hash}`; },
    async challenge(hash, expires) { const sql = await ready(); await sql`DELETE FROM google_login_challenges WHERE expires_at <= ${new Date().toISOString()}`; await sql`INSERT INTO google_login_challenges(token_hash, expires_at) VALUES (${hash}, ${expires})`; },
    async consumeChallenge(hash) { const sql = await ready(); const rows = await sql`DELETE FROM google_login_challenges WHERE token_hash = ${hash} AND expires_at > ${new Date().toISOString()} RETURNING token_hash`; return rows.length === 1; },
    async bySubject(subject) { const sql = await ready(); const [row] = await sql`SELECT registration_id AS id FROM google_identities WHERE subject = ${subject}`; return row; },
    async bind(subject, id) {
      const sql = await ready();
      const results = await sql.transaction([
        sql`SELECT id FROM registrations WHERE id = ${id} FOR UPDATE`,
        sql`WITH linked AS (INSERT INTO google_identities(subject, registration_id) VALUES (${subject}, ${id}) ON CONFLICT DO NOTHING RETURNING registration_id)
          DELETE FROM profile_sessions WHERE registration_id IN (SELECT registration_id FROM linked)`,
        sql`SELECT registration_id AS id FROM google_identities WHERE subject = ${subject}`,
      ]);
      return results[2][0];
    },
    async byEmail(email) { const sql = await ready(); return sql`SELECT id FROM registrations WHERE lower(trim(email)) = ${email} LIMIT 2`; },
    async authenticated(hash) { const sql = await ready(); const [row] = await sql`SELECT r.* FROM registrations r JOIN profile_sessions s ON s.registration_id = r.id WHERE s.token_hash = ${hash} AND s.expires_at > ${new Date().toISOString()}`; return row; },
    async enrollments(id) { const sql = await ready(); return sql`SELECT * FROM course_enrollment_requests WHERE registration_id = ${id} AND confirmed_at IS NOT NULL ORDER BY confirmed_at DESC`; },
    async revoke(hashes) { const sql = await ready(); for (const hash of hashes) await sql`DELETE FROM profile_sessions WHERE token_hash = ${hash}`; },
  };
}
