import { ensurePostgresSchema, getSql } from '../config/postgres.mjs';
import { fail } from '../services/enrollmentConfirmation.mjs';
import { COURSES } from '../../shared/courses.mjs';
const start = now => `${now.slice(0, 7)}-01T00:00:00.000Z`;
export function postgresEnrollmentRepository() {
  const ready = async () => { await ensurePostgresSchema(); return getSql(); };
  return {
    async enrollDirect(row, sessionHash) {
      const sql = await ready();
      const results = await sql.transaction([
        sql`SELECT id FROM registrations WHERE id = ${row.registration_id} FOR UPDATE`,
        sql`SELECT 1 FROM profile_sessions WHERE token_hash = ${sessionHash} AND registration_id = ${row.registration_id} AND expires_at > ${row.created_at}`,
        sql`INSERT INTO course_enrollment_requests(id, registration_id, course_id, token_hash, status_hash, delivery, created_at, expires_at, confirmed_at)
          SELECT ${row.id}, ${row.registration_id}, ${row.course_id}, ${row.token_hash}, ${row.status_hash}, 'direct', ${row.created_at}, ${row.expires_at}, ${row.created_at}
          WHERE EXISTS (SELECT 1 FROM profile_sessions WHERE token_hash = ${sessionHash} AND registration_id = ${row.registration_id} AND expires_at > ${row.created_at})
          AND NOT EXISTS (SELECT 1 FROM course_enrollment_requests WHERE registration_id = ${row.registration_id} AND course_id = ${row.course_id} AND confirmed_at IS NOT NULL AND cancelled_at IS NULL)
          AND (SELECT count(*) FROM course_enrollment_requests WHERE registration_id = ${row.registration_id} AND confirmed_at >= ${start(row.created_at)}) < 3 RETURNING *`,
        sql`SELECT * FROM course_enrollment_requests WHERE registration_id = ${row.registration_id} AND course_id = ${row.course_id} AND confirmed_at IS NOT NULL AND cancelled_at IS NULL ORDER BY confirmed_at LIMIT 1`,
      ]);
      if (!results[1].length) throw fail('Sua sessão venceu. Entre novamente para se inscrever.', 401);
      const result = results[2][0] || results[3][0];
      if (!result) throw fail('Você já atingiu o limite de três inscrições neste mês.', 409);
      return result;
    },
    async registration(id) { const sql = await ready(); const [row] = await sql`SELECT id, name, email, payload FROM registrations WHERE id = ${id}`; return row; },
    async session(id, hash) { const sql = await ready(); await sql`INSERT INTO profile_sessions(token_hash, registration_id, expires_at) VALUES (${hash}, ${id}, ${new Date(Date.now() + 90 * 86400000).toISOString()})`; },
    async createRequest(row) {
      const sql = await ready();
      const now = row.created_at;
      const result = await sql.transaction([
        sql`SELECT id FROM registrations WHERE id = ${row.registration_id} FOR UPDATE`,
        sql`INSERT INTO course_enrollment_requests(id, registration_id, course_id, token_hash, status_hash, delivery, created_at, expires_at)
          SELECT ${row.id}, ${row.registration_id}, ${row.course_id}, ${row.token_hash}, ${row.status_hash}, ${row.delivery}, ${row.created_at}, ${row.expires_at}
          WHERE NOT EXISTS (SELECT 1 FROM course_enrollment_requests WHERE registration_id = ${row.registration_id} AND course_id = ${row.course_id} AND confirmed_at IS NOT NULL AND cancelled_at IS NULL)
          AND (SELECT count(*) FROM course_enrollment_requests WHERE registration_id = ${row.registration_id} AND confirmed_at >= ${start(now)}) < 3
          AND (SELECT count(*) FROM course_enrollment_requests WHERE registration_id = ${row.registration_id} AND created_at > ${new Date(Date.parse(now) - 3600000).toISOString()}) < 5
          AND NOT EXISTS (SELECT 1 FROM course_enrollment_requests WHERE registration_id = ${row.registration_id} AND course_id = ${row.course_id} AND delivery IN ('sent', 'sending') AND created_at > ${new Date(Date.parse(now) - 60000).toISOString()})
          RETURNING id`,
      ]);
      if (!result[1].length) throw fail('Inscrição já confirmada, limite mensal atingido ou solicitações recentes em excesso. Aguarde antes de tentar novamente.', 429);
    },
    async delivery(id, state) { const sql = await ready(); await sql`UPDATE course_enrollment_requests SET delivery = ${state} WHERE id = ${id}`; },
    async confirm(hash, now) {
      const sql = await ready();
      const [initial] = await sql`SELECT * FROM course_enrollment_requests WHERE token_hash = ${hash}`;
      if (!initial) throw fail('Link de confirmação inválido.', 404);
      if (!COURSES.some(course => course.id === Number(initial.course_id) && course.status !== 'coming-soon')) throw fail('Este curso não está disponível.', 409);
      const results = await sql.transaction([
        sql`SELECT id FROM registrations WHERE id = ${initial.registration_id} FOR UPDATE`,
        sql`UPDATE course_enrollment_requests SET confirmed_at = ${now}
          WHERE id = ${initial.id} AND token_hash = ${hash} AND confirmed_at IS NULL AND cancelled_at IS NULL AND expires_at > ${now} AND delivery = 'sent'
          AND NOT EXISTS (SELECT 1 FROM course_enrollment_requests other WHERE other.registration_id = ${initial.registration_id} AND other.course_id = ${initial.course_id} AND other.confirmed_at IS NOT NULL AND other.cancelled_at IS NULL)
          AND (SELECT count(*) FROM course_enrollment_requests WHERE registration_id = ${initial.registration_id} AND confirmed_at >= ${start(now)}) < 3
          RETURNING *`,
        sql`SELECT * FROM course_enrollment_requests WHERE token_hash = ${hash}`,
        sql`SELECT * FROM course_enrollment_requests WHERE registration_id = ${initial.registration_id} AND course_id = ${initial.course_id} AND confirmed_at IS NOT NULL AND cancelled_at IS NULL ORDER BY confirmed_at LIMIT 1`,
      ]);
      const row = results[2][0];
      if (!row || new Date(row.expires_at).toISOString() <= now || row.delivery !== 'sent') throw fail('Este link venceu ou foi invalidado. Solicite outro e-mail na plataforma.', 410);
      if (row.cancelled_at) throw fail('Esta inscrição já foi cancelada.', 409);
      if (results[1].length) return results[1][0];
      if (row.confirmed_at) throw fail('Este link já foi utilizado. A inscrição permanece confirmada; consulte o perfil no navegador utilizado na confirmação.', 409);
      if (results[3][0]) throw fail('Você já confirmou sua inscrição neste curso. Este link não pode gerar outro acesso ao perfil.', 409);
      throw fail('Você já atingiu o limite de três inscrições neste mês.', 409);
    },
    async status(id, hash) {
      const sql = await ready();
      const [row] = await sql`SELECT * FROM course_enrollment_requests WHERE id = ${id} AND status_hash = ${hash}`;
      if (!row || row.confirmed_at) return row;
      const [active] = await sql`SELECT * FROM course_enrollment_requests WHERE registration_id = ${row.registration_id} AND course_id = ${row.course_id} AND confirmed_at IS NOT NULL AND cancelled_at IS NULL ORDER BY confirmed_at LIMIT 1`;
      return active || row;
    },
    async cancel(id, hash, now) {
      const sql = await ready();
      const [row] = await sql`UPDATE course_enrollment_requests SET cancelled_at = COALESCE(cancelled_at, ${now}) WHERE id = ${id} AND confirmed_at IS NOT NULL AND confirmed_at >= ${new Date(Date.parse(now) - 3 * 86400000).toISOString()}
        AND EXISTS (SELECT 1 FROM profile_sessions WHERE token_hash = ${hash} AND registration_id = course_enrollment_requests.registration_id AND expires_at > ${now}) RETURNING *`;
      if (!row) throw fail('Não foi possível cancelar. Confira o prazo de três dias e entre novamente na plataforma.', 403);
      return row;
    },
  };
}
