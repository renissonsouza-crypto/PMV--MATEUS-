import { ensurePostgresSchema, getSql } from "../config/postgres.mjs";
import { COURSES } from "../../shared/courses.mjs";
import { fail } from "../services/enrollmentConfirmation.mjs";
import { isSafePublicName } from "./validation.mjs";

const normalize = row => {
  const course = COURSES.find(item => item.id === Number(row.course_id));
  if (!course || !isSafePublicName(row.name)) return null;
  return {
    id: Number(row.id),
    name: String(row.name),
    role: String(row.role),
    courseId: course.id,
    course: course.title,
    quote: String(row.quote),
    rating: Number(row.rating),
  };
};
export async function listPostgresTestimonials() {
  await ensurePostgresSchema();
  const rows = await getSql()`SELECT id, name, role, course_id, quote, rating FROM testimonials
    WHERE registration_id IS NOT NULL AND course_id IS NOT NULL ORDER BY id DESC LIMIT 100`;
  return rows.map(normalize).filter(Boolean);
}
export async function createPostgresTestimonial(data, sessionHash) {
  await ensurePostgresSchema();
  const sql = getSql();
  const now = new Date().toISOString();
  const [person] = await sql`SELECT registration.id, registration.name FROM registrations registration
    JOIN profile_sessions session ON session.registration_id = registration.id
    WHERE session.token_hash = ${sessionHash} AND session.expires_at > ${now}`;
  if (!person) throw fail("Entre novamente na plataforma para publicar seu depoimento.", 401);
  if (!isSafePublicName(person.name)) throw fail("O nome original do cadastro não pode ser exibido publicamente. Entre em contato com o atendimento antes de publicar.", 400);
  const rows = await sql`INSERT INTO testimonials(registration_id, course_id, name, role, course, quote, rating)
    SELECT registration.id, ${data.courseId}, registration.name, ${data.role}, ${data.course}, ${data.quote}, ${data.rating}
    FROM registrations registration
    JOIN profile_sessions session ON session.registration_id = registration.id
    WHERE session.token_hash = ${sessionHash} AND session.expires_at > ${now}
      AND EXISTS (
        SELECT 1 FROM course_enrollment_requests enrollment
        WHERE enrollment.registration_id = registration.id AND enrollment.course_id = ${data.courseId}
          AND enrollment.confirmed_at IS NOT NULL AND enrollment.cancelled_at IS NULL
      )
    ON CONFLICT (registration_id, course_id)
      WHERE registration_id IS NOT NULL AND course_id IS NOT NULL DO NOTHING
    RETURNING id, name, role, course_id, quote, rating`;
  const [row] = rows;
  if (!row) {
    const [enrollment] = await sql`SELECT 1 FROM course_enrollment_requests
      WHERE registration_id = ${person.id} AND course_id = ${data.courseId}
        AND confirmed_at IS NOT NULL AND cancelled_at IS NULL`;
    if (!enrollment) throw fail("Você só pode avaliar um curso em que possui inscrição ativa.", 403);
    throw fail("Você já publicou um depoimento para este curso.", 409);
  }
  return normalize(row);
}
