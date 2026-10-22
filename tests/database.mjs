import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { once } from "node:events";
import { DatabaseSync } from "node:sqlite";

const tempDir = mkdtempSync(resolve(tmpdir(), "qualificavix-db-test-"));
// A nested directory also verifies first-run creation of a configured DB_PATH.
const dbPath = resolve(tempDir, "database", "test.sqlite");
mkdirSync(resolve(tempDir, "database"), { recursive: true });
const legacyDb = new DatabaseSync(dbPath);
legacyDb.exec(`CREATE TABLE testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  course TEXT NOT NULL,
  quote TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
legacyDb.prepare("INSERT INTO testimonials(name, role, course, quote, rating) VALUES (?, ?, ?, ?, ?)")
  .run("Registro legado", "Aluno", "Curso livre", "Relato anônimo anterior à autenticação", 5);
legacyDb.close();
const viaCepServer = createServer((req, res) => {
  const cep = new URL(req.url, "http://localhost").pathname.match(/\/(\d{8})\/json\/$/)?.[1];
  if (cep === "29000001") {
    res.writeHead(503); res.end(); return;
  }
  const isVitoria = cep === "29050945";
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(isVitoria
    ? { cep: "29050-945", logradouro: "Avenida Marechal Mascarenhas de Moraes", bairro: "Bento Ferreira", localidade: "Vitória", uf: "ES" }
    : { cep: "29100-000", logradouro: "Rua de Teste", bairro: "Centro", localidade: "Vila Velha", uf: "ES" }));
}).listen(0, "127.0.0.1");
await once(viaCepServer, "listening");
const viaCepBaseUrl = `http://127.0.0.1:${viaCepServer.address().port}/ws`;

function start() {
  const child = spawn(process.execPath, ["server/server.mjs"], {
    cwd: process.cwd(), env: { ...process.env, API_PORT: "0", DB_PATH: dbPath, VIA_CEP_BASE_URL: viaCepBaseUrl }, stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  const exited = once(child, "exit");
  const ready = new Promise((resolveReady, reject) => {
    const timeout = setTimeout(() => reject(new Error(`API não iniciou: ${output}`)), 5000);
    child.stdout.on("data", chunk => {
      const url = String(chunk).match(/QualificaVix API: (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
      if (url) { clearTimeout(timeout); resolveReady(`${url}/api`); }
    });
    child.once("error", error => { clearTimeout(timeout); reject(error); });
    child.once("exit", code => { clearTimeout(timeout); reject(new Error(`API encerrou com código ${code}: ${output}`)); });
  });
  return { child, exited, ready };
}
async function stop(server) {
  if (server.child.exitCode === null) server.child.kill("SIGTERM");
  await server.exited;
}
let base;
async function request(path, options) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  return { status: response.status, data: await response.json(), headers: response.headers };
}

let server = start();
try {
  base = await server.ready;
  const health = await request("/health");
  assert.equal(health.status, 200);
  assert.equal(health.data.database, "connected");
  for (const [path, method, allow] of [["/health", "POST", "GET"], ["/testimonials", "DELETE", "GET, POST"], ["/registrations", "GET", "POST"]]) {
    const response = await request(path, { method });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), allow);
  }
  assert.equal((await request("/unknown")).status, 404);

  assert.equal((await request("/testimonials", { method: "POST", body: JSON.stringify({ name: "Teste" }) })).status, 400);
  assert.equal((await request("/registrations", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" })).status, 415);
  const malformed = await request("/registrations", { method: "POST", body: "{" });
  assert.equal(malformed.status, 400);
  assert.equal(malformed.data.error, "JSON inválido");
  for (const body of ["null", "[]", '"text"']) {
    const response = await request("/registrations", { method: "POST", body });
    assert.equal(response.status, 400);
    assert.equal(response.data.error, "Corpo JSON inválido");
  }
  const oversized = await request("/registrations", { method: "POST", body: JSON.stringify({ payload: "x".repeat(64_001) }) });
  assert.equal(oversized.status, 413);
  assert.equal(oversized.data.error, "Payload muito grande");
  const whitespacePayload = await request("/registrations", { method: "POST", body: " ".repeat(64_001) + "{}" });
  assert.equal(whitespacePayload.status, 413, "Limite deve incluir bytes brutos, mesmo espaços JSON");
  const foreignOrigin = await request("/testimonials", { method: "POST", headers: { Origin: "https://evil.example" }, body: "{}" });
  assert.equal(foreignOrigin.status, 403);

  const registrationData = {
    nome: "Pessoa Teste", cpf: "999.999.999-99", email: "DB-TEST@example.com", telefone: "27999999999",
    dataNascimento: "1990-01-01", bairro: "Bento Ferreira", cep: "29050-945", rua: "Avenida Marechal Mascarenhas de Moraes", numero: "10", aceitaTermos: true, autorizaDados: true,
    escolaridade: "Ensino médio completo", situacaoEmprego: "Empregada", possuiDeficiencia: "sim", tiposDeficiencia: "visual", autorizaImagem: false,
  };
  for (const key of ["autorizaDados", "aceitaTermos"]) {
    for (const value of [undefined, false]) {
      const denied = await request("/registrations", { method: "POST", body: JSON.stringify({ ...registrationData, [key]: value }) });
      assert.equal(denied.status, 400);
      assert.match(denied.data.error, /autorizar o uso dos dados e aceitar os termos/);
    }
  }
  for (const field of ["telefone", "whatsapp"]) {
    const badPhone = await request("/registrations", { method: "POST", body: JSON.stringify({ ...registrationData, [field]: "x" }) });
    assert.equal(badPhone.status, 400);
    assert.match(badPhone.data.error, /inválido/);
  }
  const registration = await request("/registrations", { method: "POST", body: JSON.stringify(registrationData) });
  assert.equal(registration.status, 201);
  assert.ok(registration.data.id > 0);
  assert.match(registration.data.profileToken, /^[a-f0-9]{64}$/);

  const testimonialData = {
    role: "Aluna",
    courseId: 2,
    quote: "O curso de Excel me ajudou a organizar planilhas e aplicar fórmulas no trabalho.",
    rating: 5,
    acceptedGuidelines: true,
    website: "",
  };
  const testimonialHeaders = { Origin: new URL(base).origin, "x-profile-token": registration.data.profileToken };
  assert.equal((await request("/testimonials", { method: "POST", body: JSON.stringify(testimonialData) })).status, 401);
  const notEnrolled = await request("/testimonials", {
    method: "POST", headers: testimonialHeaders,
    body: JSON.stringify({ ...testimonialData, courseId: 3, quote: "As aulas de design seriam úteis para melhorar meu trabalho criativo." }),
  });
  assert.equal(notEnrolled.status, 403);

  const sessionDb = new DatabaseSync(dbPath);
  sessionDb.prepare("UPDATE profile_sessions SET expires_at = ? WHERE registration_id = ?")
    .run("2000-01-01T00:00:00.000Z", registration.data.id);
  sessionDb.close();
  assert.equal((await request("/testimonials", {
    method: "POST", headers: testimonialHeaders, body: JSON.stringify(testimonialData),
  })).status, 401, "uma sessão expirada não pode publicar");
  const restoredSessionDb = new DatabaseSync(dbPath);
  restoredSessionDb.prepare("UPDATE profile_sessions SET expires_at = ? WHERE registration_id = ?")
    .run(new Date(Date.now() + 86400000).toISOString(), registration.data.id);
  restoredSessionDb.close();

  const enrollment = await request("/enrollments", {
    method: "POST",
    headers: { "x-profile-token": registration.data.profileToken },
    body: JSON.stringify({ action: "enroll", registrationId: registration.data.id, courseId: 2 }),
  });
  assert.equal(enrollment.status, 200);
  const cancelled = await request("/enrollments", {
    method: "POST",
    headers: { "x-profile-token": registration.data.profileToken },
    body: JSON.stringify({ action: "cancel", requestId: enrollment.data.requestId }),
  });
  assert.equal(cancelled.status, 200);
  assert.equal((await request("/testimonials", {
    method: "POST", headers: testimonialHeaders, body: JSON.stringify(testimonialData),
  })).status, 403, "uma inscrição cancelada não autoriza depoimentos");
  assert.equal((await request("/enrollments", {
    method: "POST",
    headers: { "x-profile-token": registration.data.profileToken },
    body: JSON.stringify({ action: "enroll", registrationId: registration.data.id, courseId: 2 }),
  })).status, 200, "uma nova inscrição ativa volta a autorizar o relato");

  const testimonial = await request("/testimonials", {
    method: "POST", headers: testimonialHeaders, body: JSON.stringify(testimonialData),
  });
  assert.equal(testimonial.status, 201);
  assert.ok(testimonial.data.id > 0);
  assert.equal(testimonial.data.name, "Pessoa Teste", "o servidor deve derivar o autor do perfil autenticado");
  assert.equal(testimonial.data.courseId, 2);
  assert.equal(testimonial.data.course, "Excel do Básico ao Avançado");
  assert.equal((await request("/testimonials", {
    method: "POST", headers: testimonialHeaders, body: JSON.stringify(testimonialData),
  })).status, 409, "cada perfil pode publicar somente um relato por curso");
  assert.equal((await request("/testimonials", {
    method: "POST", headers: testimonialHeaders, body: JSON.stringify({ ...testimonialData, rating: true }),
  })).status, 400);
  assert.equal((await request("/testimonials", {
    method: "POST", headers: testimonialHeaders, body: JSON.stringify({ ...testimonialData, name: "Autor forjado" }),
  })).status, 400, "o cliente não pode escolher a autoria");

  const checkDb = new DatabaseSync(dbPath);
  const row = checkDb.prepare("SELECT cpf, email, city, state, payload FROM registrations WHERE id = ?").get(registration.data.id);
  assert.equal(row.cpf, "99999999999");
  assert.equal(row.email, "db-test@example.com");
  assert.equal(JSON.parse(row.payload).cep, "29050945");
  assert.equal(row.city, "Vitória");
  assert.equal(row.state, "ES");
  for (const key of ["escolaridade", "situacaoEmprego", "possuiDeficiencia", "tiposDeficiencia", "aceitaTermos", "autorizaDados", "autorizaImagem"])
    assert.equal(JSON.parse(row.payload)[key], registrationData[key]);
  const testimonialColumns = checkDb.prepare("PRAGMA table_info(testimonials)").all().map(column => column.name);
  assert.ok(testimonialColumns.includes("registration_id"));
  assert.ok(testimonialColumns.includes("course_id"));
  assert.equal(checkDb.prepare("SELECT registration_id, course_id FROM testimonials WHERE id = ?").get(testimonial.data.id).course_id, 2);
  // Simulate pre-existing records without migrating or deleting user data.
  checkDb.prepare("UPDATE registrations SET cpf = ?, email = ? WHERE id = ?")
    .run("999.999.999-99", "DB-TEST@example.com", registration.data.id);
  checkDb.close();
  assert.equal((await request("/registrations", { method: "POST", body: JSON.stringify({ ...registrationData, cpf: "99999999999", email: "other@example.com" }) })).status, 409);
  assert.equal((await request("/registrations", { method: "POST", body: JSON.stringify({ ...registrationData, cpf: "66666666666", email: "db-test@example.com" }) })).status, 409);
  const outside = await request("/registrations", { method: "POST", body: JSON.stringify({ ...registrationData, cpf: "66666666666", email: "outside@example.com", cep: "29100-000" }) });
  assert.equal(outside.status, 400);
  assert.match(outside.data.error, /Vitória-ES/);
  const unavailable = await request("/registrations", { method: "POST", body: JSON.stringify({ ...registrationData, cep: "29000-001" }) });
  assert.equal(unavailable.status, 503);
  assert.equal((await request("/registrations", { method: "POST", body: JSON.stringify({ ...registrationData, dataNascimento: "1990-02-30" }) })).status, 400);
  assert.equal((await request("/registrations", { method: "POST", body: JSON.stringify({ ...registrationData, nome: { text: "Pessoa" } }) })).status, 400);

  const minorData = { ...registrationData, nome: "Pessoa Menor", cpf: "88888888888", email: "minor@example.com", dataNascimento: "2012-05-10" };
  const minorWithoutGuardian = await request("/registrations", { method: "POST", body: JSON.stringify(minorData) });
  assert.equal(minorWithoutGuardian.status, 400);
  assert.match(minorWithoutGuardian.data.error, /responsável/i);
  const invalidGuardianPhone = await request("/registrations", { method: "POST", body: JSON.stringify({ ...minorData,
    nomeResponsavel: "Responsável Teste", cpfResponsavel: "777.777.777-77", grauParentesco: "Mãe", telefoneResponsavel: "x",
  }) });
  assert.equal(invalidGuardianPhone.status, 400);
  assert.match(invalidGuardianPhone.data.error, /Telefone do responsável inválido/);
  assert.equal((await request("/registrations", { method: "POST", body: JSON.stringify({ ...minorData,
    nomeResponsavel: "Responsável Teste", cpfResponsavel: "777.777.777-77", grauParentesco: "Mãe", telefoneResponsavel: "27988888888"
  }) })).status, 201);

  await stop(server);
  server = start();
  base = await server.ready;
  const persisted = await request("/testimonials");
  assert.equal(persisted.status, 200);
  assert.ok(persisted.data.some(item => item.id === testimonial.data.id));
  assert.equal(persisted.data.some(item => item.name === "Registro legado"), false, "relatos anônimos legados não devem ser publicados");
  const persistedDb = new DatabaseSync(dbPath, { readOnly: true });
  assert.equal(persistedDb.prepare("SELECT count(*) AS total FROM testimonials").get().total, 2, "a migração não deve apagar o dado legado");
  persistedDb.close();
  console.log("✓ SQLite: cadastro/depoimentos autenticados, vínculo ao curso, migração legada e persistência após reinício");
} finally {
  await stop(server);
  await new Promise(resolveClose => viaCepServer.close(resolveClose));
  rmSync(tempDir, { recursive: true, force: true });
}
