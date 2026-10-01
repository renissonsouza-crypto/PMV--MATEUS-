import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { once } from "node:events";

const dbPath = resolve("data", "qualificavix-test.sqlite");
if (existsSync(dbPath)) rmSync(dbPath);
const base = "http://127.0.0.1:3101/api";
const viaCepServer = createServer((req, res) => {
  const cep = new URL(req.url, "http://localhost").pathname.match(/\/(\d{8})\/json\/$/)?.[1];
  const isVitoria = cep === "29050945";
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(isVitoria
    ? { cep: "29050-945", logradouro: "Avenida Marechal Mascarenhas de Moraes", bairro: "Bento Ferreira", localidade: "Vitória", uf: "ES" }
    : { cep: "29100-000", logradouro: "Rua de Teste", bairro: "Centro", localidade: "Vila Velha", uf: "ES" }));
}).listen(0, "127.0.0.1");
await once(viaCepServer, "listening");
const viaCepBaseUrl = `http://127.0.0.1:${viaCepServer.address().port}/ws`;

function start() {
  return spawn(process.execPath, ["server/server.mjs"], {
    cwd: process.cwd(), env: { ...process.env, API_PORT: "3101", DB_PATH: dbPath, VIA_CEP_BASE_URL: viaCepBaseUrl }, stdio: ["ignore", "pipe", "pipe"]
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

  const nonJson = await fetch(`${base}/registrations`, {
    method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ nome: "Externo" })
  });
  assert(nonJson.status === 415, "Requisição de escrita sem JSON deveria ser rejeitada");

  const malformed = await fetch(`${base}/registrations`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{"
  });
  assert(malformed.status === 400, "JSON malformado deveria retornar 400");
  assert((await malformed.json()).error === "JSON inválido", "Erro de JSON malformado deveria ser genérico");

  const oversized = await request("/registrations", {
    method: "POST", body: JSON.stringify({ payload: "x".repeat(1_000_001) })
  });
  assert(oversized.status === 413, "Payload acima do limite deveria retornar 413");
  assert(oversized.data.error === "Payload muito grande", "Erro de payload grande deveria ser explícito e seguro");

  const testimonial = await request("/testimonials", { method: "POST", body: JSON.stringify({
    name: "Teste Automatizado", role: "Aluno", course: "Programação", quote: "Persistência funcionando", rating: 5
  }) });
  assert(testimonial.status === 201 && testimonial.data.id > 0, "Inserção de depoimento falhou");

  const registrationData = {
    nome: "Pessoa Teste", cpf: "99999999999", email: "db-test@example.com", telefone: "27999999999",
    dataNascimento: "1990-01-01", bairro: "Bento Ferreira", cep: "29050-945", rua: "Avenida Marechal Mascarenhas de Moraes", numero: "10", aceitaTermos: true
  };
  const registration = await request("/registrations", { method: "POST", body: JSON.stringify(registrationData) });
  assert(registration.status === 201 && registration.data.id > 0, "Inserção de cadastro falhou");
  const nonVitoria = await request("/registrations", { method: "POST", body: JSON.stringify({
    ...registrationData, cpf: "66666666666", email: "outside-vitoria@example.com", cep: "29100-000"
  }) });
  assert(nonVitoria.status === 400 && /Vitória-ES/.test(nonVitoria.data.error), "CEP de outra cidade deveria ser bloqueado");
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
  viaCepServer.close();
}
