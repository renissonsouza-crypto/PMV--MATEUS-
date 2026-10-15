import { fail } from '../services/enrollmentConfirmation.mjs';
import { COURSES } from '../../shared/courses.mjs';
import { sqliteEnrollmentSchema } from './enrollmentSchema.mjs';
const monthStart = now => `${now.slice(0, 7)}-01T00:00:00.000Z`;
export function sqliteEnrollmentRepository(db) {
  db.exec(sqliteEnrollmentSchema);
  const transaction = run => {
    db.exec('BEGIN IMMEDIATE');
    try { const value = run(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const active = row => db.prepare('SELECT * FROM course_enrollment_requests WHERE registration_id = ? AND course_id = ? AND confirmed_at IS NOT NULL AND cancelled_at IS NULL ORDER BY confirmed_at LIMIT 1').get(row.registration_id, row.course_id);
  const count = row => db.prepare('SELECT count(*) AS count FROM course_enrollment_requests WHERE registration_id = ? AND confirmed_at >= ?').get(row.registration_id, monthStart(new Date().toISOString())).count;
  return {
    async registration(id) { return db.prepare('SELECT id, name, email, payload FROM registrations WHERE id = ?').get(id); },
    async session(id, hash) { db.prepare('INSERT INTO profile_sessions(token_hash, registration_id, expires_at) VALUES (?, ?, ?)').run(hash, id, new Date(Date.now() + 90 * 86400000).toISOString()); },
    async createRequest(row) {
      return transaction(() => {
        if (active(row)) throw fail('Você já confirmou sua inscrição neste curso.', 409);
        if (count(row) >= 3) throw fail('Você já atingiu o limite de três inscrições neste mês.', 409);
        const recent = db.prepare('SELECT count(*) AS count FROM course_enrollment_requests WHERE registration_id = ? AND created_at > ?').get(row.registration_id, new Date(Date.now() - 3600000).toISOString()).count;
        const cooldown = db.prepare("SELECT 1 FROM course_enrollment_requests WHERE registration_id = ? AND course_id = ? AND delivery IN ('sent', 'sending') AND created_at > ?").get(row.registration_id, row.course_id, new Date(Date.now() - 60000).toISOString());
        if (recent >= 5 || cooldown) throw fail('Aguarde antes de solicitar outro e-mail de confirmação.', 429);
        db.prepare('INSERT INTO course_enrollment_requests(id, registration_id, course_id, token_hash, status_hash, delivery, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(row.id, row.registration_id, row.course_id, row.token_hash, row.status_hash, row.delivery, row.created_at, row.expires_at);
      });
    },
    async delivery(id, state) { db.prepare('UPDATE course_enrollment_requests SET delivery = ? WHERE id = ?').run(state, id); },
    async confirm(hash, now) {
      return transaction(() => {
        const row = db.prepare('SELECT * FROM course_enrollment_requests WHERE token_hash = ?').get(hash);
        if (!row) throw fail('Link de confirmação inválido.', 404);
        if (row.expires_at <= now || row.delivery !== 'sent') throw fail('Este link venceu ou foi invalidado. Solicite outro e-mail na plataforma.', 410);
        if (row.cancelled_at) throw fail('Esta inscrição já foi cancelada.', 409);
        if (row.confirmed_at) throw fail('Este link já foi utilizado. A inscrição permanece confirmada; consulte o perfil no navegador utilizado na confirmação.', 409);
        if (!COURSES.some(course => course.id === row.course_id && course.status !== 'coming-soon')) throw fail('Este curso não está disponível.', 409);
        const existing = active(row);
        if (existing) throw fail('Você já confirmou sua inscrição neste curso. Este link não pode gerar outro acesso ao perfil.', 409);
        if (count(row) >= 3) throw fail('Você já atingiu o limite de três inscrições neste mês.', 409);
        db.prepare('UPDATE course_enrollment_requests SET confirmed_at = ? WHERE id = ? AND confirmed_at IS NULL').run(now, row.id);
        return { ...row, confirmed_at: now };
      });
    },
    async status(id, hash) {
      const row = db.prepare('SELECT * FROM course_enrollment_requests WHERE id = ? AND status_hash = ?').get(id, hash);
      return row && !row.confirmed_at ? active(row) || row : row;
    },
    async cancel(id, hash, now) {
      return transaction(() => {
        const row = db.prepare('SELECT * FROM course_enrollment_requests WHERE id = ?').get(id);
        if (!row || !db.prepare('SELECT 1 FROM profile_sessions WHERE token_hash = ? AND registration_id = ? AND expires_at > ?').get(hash, row.registration_id, now)) throw fail('Acesso ao perfil inválido. Abra o e-mail de confirmação neste navegador.', 403);
        if (!row.confirmed_at) throw fail('Esta inscrição ainda não foi confirmada.', 409);
        if (row.cancelled_at) return row;
        if (Date.parse(now) - Date.parse(row.confirmed_at) > 3 * 86400000) throw fail('O prazo de três dias para cancelar a inscrição terminou.', 409);
        db.prepare('UPDATE course_enrollment_requests SET cancelled_at = ? WHERE id = ?').run(now, id);
        return { ...row, cancelled_at: now };
      });
    },
  };
}
