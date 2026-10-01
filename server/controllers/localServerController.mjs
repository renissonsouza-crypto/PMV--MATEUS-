import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { validateRegistration, validateTestimonial, validateVitoriaCep } from "../models/validation.mjs";
import { validateJsonMutation } from "./requestSecurity.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = resolve(root, "data");
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(process.env.DB_PATH ? resolve(process.env.DB_PATH) : resolve(dataDir, "qualificavix.sqlite"));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cpf TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    birth_date TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS testimonials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    course TEXT NOT NULL,
    quote TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(registration_id, course_id),
    FOREIGN KEY(registration_id) REFERENCES registrations(id) ON DELETE CASCADE
  );
`);

const json = (res, status, payload) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  res.end(JSON.stringify(payload));
};

const MAX_BODY_BYTES = 1_000_000;
const body = req => new Promise((resolveBody, reject) => {
  const chunks = [];
  let size = 0;
  let tooLarge = false;
  req.on("data", chunk => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      tooLarge = true;
      chunks.length = 0;
      return;
    }
    if (!tooLarge) chunks.push(chunk);
  });
  req.on("end", () => {
    if (tooLarge) {
      reject(Object.assign(new Error("Payload muito grande"), { statusCode: 413 }));
      return;
    }
    try {
      const raw = Buffer.concat(chunks).toString("utf8");
      resolveBody(raw ? JSON.parse(raw) : {});
    } catch {
      reject(Object.assign(new Error("JSON inválido"), { statusCode: 400 }));
    }
  });
  req.on("error", reject);
});

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/api/health") {
      const result = db.prepare("SELECT 1 AS connected").get();
      return json(res, 200, { status: "ok", database: result.connected === 1 ? "connected" : "error" });
    }
    if (req.method === "GET" && url.pathname === "/api/testimonials") {
      const rows = db.prepare("SELECT id, name, role, course, quote, rating FROM testimonials ORDER BY id DESC LIMIT 100").all();
      return json(res, 200, rows);
    }
    if (req.method === "POST" && url.pathname === "/api/testimonials") {
      const requestError = validateJsonMutation(req, { checkOrigin: false });
      if (requestError) return json(res, requestError.status, { error: requestError.error });
      const validation = validateTestimonial(await body(req));
      if (validation.error) return json(res, 400, { error: validation.error });
      const { name, role, course, quote, rating } = validation.data;
      const result = db.prepare("INSERT INTO testimonials(name, role, course, quote, rating) VALUES (?, ?, ?, ?, ?)")
        .run(name, role, course, quote, rating);
      return json(res, 201, { id: Number(result.lastInsertRowid), name, role, course, quote, rating });
    }
    if (req.method === "POST" && url.pathname === "/api/registrations") {
      const requestError = validateJsonMutation(req, { checkOrigin: false });
      if (requestError) return json(res, requestError.status, { error: requestError.error });
      const validation = validateRegistration(await body(req));
      if (validation.error) return json(res, 400, { error: validation.error });
      const cepValidation = await validateVitoriaCep(validation.data.cep);
      if (cepValidation.unavailable) return json(res, 503, { error: "Não foi possível validar o CEP agora. Tente novamente." });
      if (!cepValidation.valid) return json(res, 400, { error: "O cadastro aceita somente CEPs de Vitória-ES" });
      const data = validation.data;
      try {
        const result = db.prepare(`INSERT INTO registrations
          (name, cpf, email, phone, birth_date, city, state, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(data.nome, data.cpf, data.email, data.telefone,
            data.dataNascimento, "", "", JSON.stringify(data));
        return json(res, 201, { id: Number(result.lastInsertRowid), message: "Cadastro realizado" });
      } catch (error) {
        if (String(error.message).includes("UNIQUE")) return json(res, 409, { error: "CPF ou e-mail já cadastrado" });
        throw error;
      }
    }
    return json(res, 404, { error: "Rota não encontrada" });
  } catch (error) {
    const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (status >= 500) console.error("Falha interna na API local:", error);
    return json(res, status, { error: status < 500 ? error.message : "Erro interno" });
  }
});

const port = Number(process.env.API_PORT || 3001);
server.listen(port, "127.0.0.1", () => console.log(`QualificaVix API: http://127.0.0.1:${port}`));

const shutdown = () => server.close(() => { db.close(); process.exit(0); });
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
