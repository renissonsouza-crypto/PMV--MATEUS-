import { ensurePostgresSchema, getSql } from "../config/postgres.mjs";
import { clean } from "./validation.mjs";

export async function createPostgresRegistration(data, sessionHash) {
  await ensurePostgresSchema();
  const sql = getSql();
  // Existing databases may contain formatted CPFs or mixed-case emails.
  const duplicates = await sql`SELECT id FROM registrations
    WHERE regexp_replace(cpf, '[^0-9]', '', 'g') = ${data.cpf}
      OR lower(trim(email)) = ${data.email}
    LIMIT 1`;
  if (duplicates.length) throw Object.assign(new Error("CPF ou e-mail já cadastrado"), { code: "23505" });
  const payload = JSON.stringify(data);
  const insert = sql`INSERT INTO registrations(name, cpf, email, phone, birth_date, neighborhood, payload)
    VALUES (${clean(data.nome, 120)}, ${clean(data.cpf, 14)}, ${clean(data.email, 180).toLowerCase()},
      ${clean(data.telefone, 30)}, ${clean(data.dataNascimento, 10)}, ${clean(data.bairro, 120)}, ${payload}::jsonb)
    RETURNING id`;
  const [row] = sessionHash ? (await sql.transaction([
    insert,
    sql`INSERT INTO profile_sessions(token_hash, registration_id, expires_at)
      SELECT ${sessionHash}, id, ${new Date(Date.now() + 90 * 86400000).toISOString()} FROM registrations WHERE email = ${clean(data.email, 180).toLowerCase()}`,
  ]))[0] : await insert;
  return Number(row.id);
}
