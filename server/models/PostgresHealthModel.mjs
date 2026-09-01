import { ensurePostgresSchema, getSql } from "../config/postgres.mjs";

export async function checkPostgresHealth() {
  await ensurePostgresSchema();
  const [result] = await getSql()`SELECT 1 AS connected`;
  return Number(result.connected) === 1;
}
