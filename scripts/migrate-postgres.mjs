import { ensurePostgresSchema } from "../server/config/postgres.mjs";

await ensurePostgresSchema();
console.log("PostgreSQL schema ready");
