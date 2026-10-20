import '../server/config/environment.mjs';
import { ensurePostgresSchema, getSql } from "../server/config/postgres.mjs";
import { chatLearningSchema } from '../server/models/ChatLearningRepository.mjs';

await ensurePostgresSchema();
for (const statement of chatLearningSchema) await getSql().query(statement);
console.log("PostgreSQL schema ready");
