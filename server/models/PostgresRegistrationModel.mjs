import { ensurePostgresSchema, getSql } from "../config/postgres.mjs";
import { clean } from "./validation.mjs";

export async function createPostgresRegistration(data) {
  await ensurePostgresSchema();
  const sql = getSql();
  // Existing databases may contain formatted CPFs or mixed-case emails.
  const duplicates = await sql`SELECT id FROM registrations
    WHERE regexp_replace(cpf, '[^0-9]', '', 'g') = ${data.cpf}
      OR lower(trim(email)) = ${data.email}
    LIMIT 1`;
  if (duplicates.length) throw Object.assign(new Error("CPF ou e-mail já cadastrado"), { code: "23505" });
  const payload = JSON.stringify(data);
  const [row] = await sql`INSERT INTO registrations(name, cpf, email, phone, birth_date, neighborhood, payload)
    VALUES (${clean(data.nome, 120)}, ${clean(data.cpf, 14)}, ${clean(data.email, 180).toLowerCase()},
      ${clean(data.telefone, 30)}, ${clean(data.dataNascimento, 10)}, ${clean(data.bairro, 120)}, ${payload}::jsonb)
    RETURNING id`;
  return Number(row.id);
}
