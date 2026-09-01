import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const dbPath = resolve("data", "qualificavix-test.sqlite");
if (existsSync(dbPath)) rmSync(dbPath);
const base = "http://127.0.0.1:3101/api";

function start() {
  return spawn(process.execPath, ["server/server.mjs"], {
    cwd: process.cwd(), env: { ...process.env, API_PORT: "3101", DB_PATH: dbPath }, stdio: ["ignore", "pipe", "pipe"]
  });
}
async function ready() {
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(`${base}/health`); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error("API não iniciou");
}
async function request(path, options) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { "Content-Type": "application/json" } });
  return { status: response.status, data: await response.json() };
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };

let server = start();
try {
  await ready();
  const health = await request("/health");
  assert(health.status === 200 && health.data.database === "connected", "Health check falhou");

  const invalid = await request("/testimonials", { method: "POST", body: JSON.stringify({ name: "Teste" }) });
  assert(invalid.status === 400, "Depoimento inválido deveria ser rejeitado");

  const testimonial = await request("/testimonials", { method: "POST", body: JSON.stringify({
    name: "Teste Automatizado", role: "Aluno", course: "Programação", quote: "Persistência funcionando", rating: 5
  }) });
  assert(testimonial.status === 201 && testimonial.data.id > 0, "Inserção de depoimento falhou");

  const registrationData = {
    nome: "Pessoa Teste", cpf: "99999999999", email: "db-test@example.com", telefone: "27999999999",
    dataNascimento: "1990-01-01", bairro: "Centro", cep: "29000-000", rua: "Rua Teste", numero: "10", aceitaTermos: true
  };
  const registration = await request("/registrations", { method: "POST", body: JSON.stringify(registrationData) });
  assert(registration.status === 201 && registration.data.id > 0, "Inserção de cadastro falhou");
  const duplicate = await request("/registrations", { method: "POST", body: JSON.stringify(registrationData) });
  assert(duplicate.status === 409, "Duplicidade de CPF/e-mail não foi bloqueada");

  const minorData = {
    ...registrationData, nome: "Pessoa Menor", cpf: "88888888888", email: "minor@example.com", dataNascimento: "2012-05-10"
  };
  const minorWithoutGuardian = await request("/registrations", { method: "POST", body: JSON.stringify(minorData) });
  assert(minorWithoutGuardian.status === 400 && /responsável/i.test(minorWithoutGuardian.data.error),
    "Cadastro de menor sem responsável deveria ser rejeitado");
  const minorWithGuardian = await request("/registrations", { method: "POST", body: JSON.stringify({
    ...minorData, nomeResponsavel: "Responsável Teste", cpfResponsavel: "77777777777",
    grauParentesco: "Mãe", telefoneResponsavel: "27988888888"
  }) });
  assert(minorWithGuardian.status === 201, "Cadastro de menor com responsável deveria ser aceito");

  server.kill("SIGTERM");
  await new Promise(resolveExit => server.once("exit", resolveExit));
  server = start();
  await ready();
  const persisted = await request("/testimonials");
  assert(persisted.status === 200 && persisted.data.some(item => item.id === testimonial.data.id), "Dados não persistiram após reinício");
  console.log("PASS\tconexão SQLite e health check");
  console.log("PASS\tvalidação de payload");
  console.log("PASS\tinserção e leitura de depoimento");
  console.log("PASS\tinserção de cadastro");
  console.log("PASS\tbloqueio de CPF/e-mail duplicado");
  console.log("PASS\trejeição de menor sem responsável legal");
  console.log("PASS\taceite de menor com responsável legal");
  console.log("PASS\tpersistência após reinício da API");
} finally {
  if (server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise(resolveExit => server.once("exit", resolveExit));
  }
  for (const path of [dbPath, `${dbPath}-shm`, `${dbPath}-wal`]) {
    if (existsSync(path)) rmSync(path, { force: true });
  }
}
