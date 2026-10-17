import { authCookie, registrationGoogleIntent, clearGoogleSignupCookie } from "../services/googleAuth.mjs";
import { newToken, digest } from "../services/enrollmentConfirmation.mjs";
import { authController } from "./authController.mjs";
import { sqliteAuthRepository } from "../models/AuthRepository.mjs";
import { enrollmentController } from "./enrollmentController.mjs";
import { sqliteEnrollmentRepository } from "../models/SqliteEnrollmentRepository.mjs";
import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { validateRegistration, validateTestimonial, validateVitoriaCep } from "../models/validation.mjs";
import { MAX_JSON_BODY_BYTES, validateJsonMutation } from "./requestSecurity.mjs";
import { getApiPort } from "../../scripts/dev-config.mjs";

const port = getApiPort(process.env, { allowEphemeral: true });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = resolve(root, "data");
const dbPath = process.env.DB_PATH ? resolve(process.env.DB_PATH) : resolve(dataDir, "qualificavix.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
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

const enrollmentRepository = sqliteEnrollmentRepository(db);
const handleEnrollment = enrollmentController(enrollmentRepository);
const handleAuth = authController(sqliteAuthRepository(db));

const json = (res, status, payload, headers = {}) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    ...headers,
  });
  res.end(JSON.stringify(payload));
};

const body = req => new Promise((resolveBody, reject) => {
  const chunks = [];
  let size = 0;
  let tooLarge = false;
  req.on("data", chunk => {
    size += chunk.length;
    if (size > MAX_JSON_BODY_BYTES) {
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
  req.on("aborted", () => reject(Object.assign(new Error("Requisição interrompida"), { statusCode: 400 })));
});

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/auth") {
      if (req.method === 'POST') req.body = await body(req);
      const adapter = {
        setHeader: (key, value) => res.setHeader(key, value),
        status(status) { this.statusCode = status; return this; },
        json(payload) { return json(res, this.statusCode || 200, payload); },
        end() { res.statusCode = this.statusCode || 200; res.end(); },
      };
      return await handleAuth(req, adapter);
    }
    const methods = {
      "/api/enrollments": ["POST"],
      "/api/health": ["GET"],
      "/api/testimonials": ["GET", "POST"],
      "/api/registrations": ["POST"],
    }[url.pathname];
    if (methods && !methods.includes(req.method))
      return json(res, 405, { error: "Método não permitido" }, { Allow: methods.join(", ") });
    if (url.pathname === "/api/enrollments") {
      const requestError = validateJsonMutation(req);
      if (requestError) return json(res, requestError.status, { error: requestError.error });
      req.body = await body(req);
      const adapter = {
        setHeader: (key, value) => res.setHeader(key, value),
        status(status) { this.statusCode = status; return this; },
        json(payload) { return json(res, this.statusCode || 200, payload); },
      };
      return await handleEnrollment(req, adapter);
    }
    if (req.method === "GET" && url.pathname === "/api/health") {
      const result = db.prepare("SELECT 1 AS connected").get();
      return json(res, 200, { status: "ok", database: result.connected === 1 ? "connected" : "error" });
    }
    if (req.method === "GET" && url.pathname === "/api/testimonials") {
      const rows = db.prepare("SELECT id, name, role, course, quote, rating FROM testimonials ORDER BY id DESC LIMIT 100").all();
      return json(res, 200, rows);
    }
    if (req.method === "POST" && url.pathname === "/api/testimonials") {
      const requestError = validateJsonMutation(req);
      if (requestError) return json(res, requestError.status, { error: requestError.error });
      req.body = await body(req);
      const bodyError = validateJsonMutation(req);
      if (bodyError) return json(res, bodyError.status, { error: bodyError.error });
      const validation = validateTestimonial(req.body);
      if (validation.error) return json(res, 400, { error: validation.error });
      const { name, role, course, quote, rating } = validation.data;
      const result = db.prepare("INSERT INTO testimonials(name, role, course, quote, rating) VALUES (?, ?, ?, ?, ?)")
        .run(name, role, course, quote, rating);
      return json(res, 201, { id: Number(result.lastInsertRowid), name, role, course, quote, rating });
    }
    if (req.method === "POST" && url.pathname === "/api/registrations") {
      const requestError = validateJsonMutation(req);
      if (requestError) return json(res, requestError.status, { error: requestError.error });
      req.body = await body(req);
      const bodyError = validateJsonMutation(req);
      if (bodyError) return json(res, bodyError.status, { error: bodyError.error });
      const googleIntent = await registrationGoogleIntent(req, sqliteAuthRepository(db));
      const validation = validateRegistration(req.body);
      if (validation.error) return json(res, 400, { error: validation.error });
      const cepValidation = await validateVitoriaCep(validation.data.cep);
      if (cepValidation.unavailable) return json(res, 503, { error: "Não foi possível validar o CEP agora. Tente novamente." });
      if (!cepValidation.valid) return json(res, 400, { error: "O cadastro aceita somente CEPs de Vitória-ES" });
      const data = validation.data;
      try {
        const duplicate = db.prepare(`SELECT id FROM registrations
          WHERE replace(replace(replace(cpf, '.', ''), '-', ''), ' ', '') = ?
            OR lower(trim(email)) = ? LIMIT 1`).get(data.cpf, data.email);
        if (duplicate) return json(res, 409, { error: "CPF ou e-mail já cadastrado" });
        db.exec("BEGIN IMMEDIATE");
        try {
        if (googleIntent && !db.prepare('SELECT 1 FROM google_signup_intents WHERE token_hash = ? AND expires_at > ? AND email = ?').get(googleIntent.tokenHash, new Date().toISOString(), data.email)) throw Object.assign(new Error('A confirmação Google venceu ou já foi utilizada. Entre com Google novamente.'), { statusCode: 401 });
        const result = db.prepare(`INSERT INTO registrations
          (name, cpf, email, phone, birth_date, city, state, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(data.nome, data.cpf, data.email, data.telefone,
            data.dataNascimento, "Vitória", "ES", JSON.stringify(data));
        const profileToken = newToken();
        db.prepare("INSERT INTO profile_sessions(token_hash, registration_id, expires_at) VALUES (?, ?, ?)").run(digest(profileToken), Number(result.lastInsertRowid), new Date(Date.now() + 90 * 86400000).toISOString());
        if (googleIntent) {
          db.prepare('INSERT INTO google_identities(subject, registration_id) VALUES (?, ?)').run(googleIntent.subject, Number(result.lastInsertRowid));
          db.prepare('DELETE FROM google_signup_intents WHERE token_hash = ?').run(googleIntent.tokenHash);
        }
        db.exec("COMMIT");
        if (googleIntent) res.setHeader("Set-Cookie", [clearGoogleSignupCookie, authCookie("qv_session", profileToken, { secure: process.env.NODE_ENV === "production" || process.env.APP_BASE_URL?.startsWith("https://") }, 90 * 86400)]);
        return json(res, 201, { id: Number(result.lastInsertRowid), profileToken, message: "Cadastro realizado" });
        } catch (error) { db.exec("ROLLBACK"); throw error; }
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

server.listen(port, "127.0.0.1", () => console.log(`QualificaVix API: http://127.0.0.1:${server.address().port}`));

const shutdown = () => server.close(() => { db.close(); process.exit(0); });
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
