import { fail } from "../services/enrollmentConfirmation.mjs";
import { ensurePostgresSchema, getSql } from "../config/postgres.mjs";
import { clean } from "./validation.mjs";

export async function createPostgresRegistration(data, sessionHash, googleIntentHash) {
  await ensurePostgresSchema();
  const sql = getSql();
  // Existing databases may contain formatted CPFs or mixed-case emails.
  const duplicates = await sql`SELECT id FROM registrations
    WHERE regexp_replace(cpf, '[^0-9]', '', 'g') = ${data.cpf}
      OR lower(trim(email)) = ${data.email}
    LIMIT 1`;
  if (duplicates.length) throw Object.assign(new Error("CPF ou e-mail já cadastrado"), { code: "23505" });
  const payload = JSON.stringify(data);
  if (googleIntentHash) {
    const [created] = await sql`WITH claimed AS (
      DELETE FROM google_signup_intents WHERE token_hash = ${googleIntentHash} AND email = ${data.email} AND expires_at > ${new Date().toISOString()} RETURNING subject, email
    ), person AS (
      INSERT INTO registrations(name, cpf, email, phone, birth_date, neighborhood, payload)
      SELECT ${clean(data.nome, 120)}, ${clean(data.cpf, 14)}, claimed.email, ${clean(data.telefone, 30)}, ${clean(data.dataNascimento, 10)}, ${clean(data.bairro, 120)}, ${payload}::jsonb FROM claimed RETURNING id
    ), identity AS (
      INSERT INTO google_identities(subject, registration_id) SELECT claimed.subject, person.id FROM claimed CROSS JOIN person RETURNING registration_id
    ), session AS (
      INSERT INTO profile_sessions(token_hash, registration_id, expires_at) SELECT ${sessionHash}, registration_id, ${new Date(Date.now() + 90 * 86400000).toISOString()} FROM identity RETURNING registration_id
    ) SELECT registration_id AS id FROM session`;
    if (!created) throw fail('A confirmação Google venceu ou já foi utilizada. Entre com Google novamente.', 401);
    return Number(created.id);
  }
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
