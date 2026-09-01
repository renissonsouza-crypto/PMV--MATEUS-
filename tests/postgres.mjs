import assert from "node:assert/strict";
import { ensurePostgresSchema, getSql } from "../server/config/postgres.mjs";

if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
  console.error("Defina DATABASE_URL para testar a conexão PostgreSQL de produção.");
  process.exit(1);
}

await ensurePostgresSchema();
const sql = getSql();
const [connection] = await sql`SELECT 1 AS connected`;
assert.equal(Number(connection.connected), 1);
const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
for (const table of ["enrollments", "registrations", "testimonials"])
  assert.ok(tables.some(row => row.tablename === table), `Tabela ${table} não encontrada`);
console.log("✓ PostgreSQL conectado e schema validado");
