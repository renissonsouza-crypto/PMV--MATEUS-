import { ensurePostgresSchema, getSql } from "../config/postgres.mjs";

const normalize = row => ({ ...row, id: Number(row.id), rating: Number(row.rating) });
export async function listPostgresTestimonials() {
  await ensurePostgresSchema();
  const rows = await getSql()`SELECT id, name, role, course, quote, rating FROM testimonials ORDER BY id DESC LIMIT 100`;
  return rows.map(normalize);
}
export async function createPostgresTestimonial(data) {
  await ensurePostgresSchema();
  const sql = getSql();
  const [row] = await sql`INSERT INTO testimonials(name, role, course, quote, rating)
    VALUES (${data.name}, ${data.role}, ${data.course}, ${data.quote}, ${data.rating})
    RETURNING id, name, role, course, quote, rating`;
  return normalize(row);
}
