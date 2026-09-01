import { neon } from "@neondatabase/serverless";

// Configuração de infraestrutura; os models consomem esta conexão.

let schemaPromise;

export function getSql() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada");
  return neon(connectionString);
}

export function ensurePostgresSchema() {
  if (!schemaPromise) {
    const sql = getSql();
    schemaPromise = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS registrations (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        cpf VARCHAR(14) NOT NULL UNIQUE,
        email VARCHAR(180) NOT NULL UNIQUE,
        phone VARCHAR(30) NOT NULL,
        birth_date DATE NOT NULL,
        neighborhood VARCHAR(120) NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS testimonials (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        role VARCHAR(120) NOT NULL,
        course VARCHAR(160) NOT NULL,
        quote VARCHAR(500) NOT NULL,
        rating SMALLINT NOT NULL CHECK(rating BETWEEN 1 AND 5),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS enrollments (
        id BIGSERIAL PRIMARY KEY,
        registration_id BIGINT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
        course_id INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(registration_id, course_id)
      )`;
    })().catch(error => { schemaPromise = undefined; throw error; });
  }
  return schemaPromise;
}
