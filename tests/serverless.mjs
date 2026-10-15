import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Exercise the actual Vercel routes/controllers/models without a production DB
// or network calls. Only the Neon transport is replaced by an isolated SQL fake.
const rows = { registrations: [], testimonials: [] };
let schemaCalls = 0;
let failNextSchema = true;
let failDatabase = false;
let healthValue = 1;
const sql = async (parts, ...params) => {
  const query = parts.join("?");
  if (failDatabase) throw new Error("postgresql://private-user:private-password@private-host/database");
  if (/CREATE INDEX/.test(query)) return [];
  if (/CREATE TABLE/.test(query)) {
    schemaCalls++;
    if (failNextSchema) { failNextSchema = false; throw new Error("transient schema connection failure"); }
    return [];
  }
  if (/SELECT 1 AS connected/.test(query)) return [{ connected: healthValue }];
  if (/SELECT id FROM registrations/.test(query)) {
    assert.match(query, /regexp_replace\(cpf/);
    assert.match(query, /lower\(trim\(email\)\)/);
    return rows.registrations.filter(row => row.cpf.replace(/\D/g, "") === params[0] || row.email.trim().toLowerCase() === params[1]).slice(0, 1);
  }
  if (/INSERT INTO registrations/.test(query)) {
    const [name, cpf, email, phone, birth_date, neighborhood, payload] = params;
    const row = { id: String(rows.registrations.length + 1), name, cpf, email, phone, birth_date, neighborhood, payload: JSON.parse(payload) };
    rows.registrations.push(row);
    return [row];
  }
  if (/INSERT INTO testimonials/.test(query)) {
    const [name, role, course, quote, rating] = params;
    const row = { id: String(rows.testimonials.length + 1), name, role, course, quote, rating: String(rating) };
    rows.testimonials.push(row);
    return [row];
  }
  if (/SELECT id, name, role, course, quote, rating FROM testimonials/.test(query)) return [...rows.testimonials].reverse();
  throw new Error(`SQL não esperado no teste: ${query}`);
};
sql.query = query => sql([query]);
globalThis.__qualificaVixTestSql = sql;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@neondatabase/serverless") {
      const source = "export const neon = () => globalThis.__qualificaVixTestSql;";
      return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const savedConfig = { DATABASE_URL: process.env.DATABASE_URL, POSTGRES_URL: process.env.POSTGRES_URL, NODE_ENV: process.env.NODE_ENV };
const originalFetch = globalThis.fetch;
process.env.DATABASE_URL = "postgresql://test:test@isolated.invalid/test";
process.env.NODE_ENV = "production";
globalThis.fetch = async url => {
  const cep = String(url).match(/\/(\d{8})\/json\/$/)?.[1];
  if (!cep) throw new Error("External network is disabled in this test");
  if (cep === "29000001") throw new Error("ViaCEP offline");
  return { ok: true, json: async () => ({ localidade: cep === "29050945" ? "Vitória" : "Vila Velha", uf: "ES" }) };
};

try {
  const { ensurePostgresSchema } = await import("../server/config/postgres.mjs");
  const initial = await Promise.allSettled([ensurePostgresSchema(), ensurePostgresSchema()]);
  assert.ok(initial.every(result => result.status === "rejected"));
  assert.equal(schemaCalls, 1, "Falhas concorrentes devem compartilhar a tentativa de schema");
  await Promise.all([ensurePostgresSchema(), ensurePostgresSchema()]);
  assert.equal(schemaCalls, 7, "Schema deve tentar novamente depois de falha transitória");
  const [{ default: registration }, { default: testimonials }, { default: health }] = await Promise.all([
    import("../api/registrations.mjs"), import("../api/testimonials.mjs"), import("../api/health.mjs"),
  ]);
  async function call(controller, method, body, headers = {}) {
    const response = {
      code: 200, headers: {}, payload: null,
      status(code) { this.code = code; return this; },
      json(payload) { this.payload = payload; return this; },
      setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    };
    await controller({ method, body, headers: {
      host: "qualificavix.example", "content-type": "application/json", "x-forwarded-proto": "https", ...headers,
    } }, response);
    return response;
  }
  for (const [controller, method, allow] of [[registration, "GET", "POST"], [testimonials, "DELETE", "GET, POST"], [health, "POST", "GET"]]) {
    const response = await call(controller, method);
    assert.equal(response.code, 405);
    assert.equal(response.headers.allow, allow);
  }
  assert.equal((await call(health, "GET")).payload.database, "connected");
  healthValue = 0;
  assert.equal((await call(health, "GET")).code, 503);
  healthValue = 1;
  const adult = {
    nome: "Maria Silva", cpf: "123.456.789-01", email: " MARIA@example.com ", telefone: "27999999999",
    dataNascimento: "1990-05-10", bairro: "Centro", cep: "29050-945", rua: "Rua A", numero: "10",
    escolaridade: "Ensino médio completo", situacaoEmprego: "Empregada", possuiDeficiencia: "sim", tiposDeficiencia: "visual",
    aceitaTermos: true, autorizaDados: true, autorizaImagem: false, beneficioProgramaSocial: "sim", quaisBeneficios: ["Bolsa Família"],
  };
  for (const controller of [registration, testimonials]) {
    assert.equal((await call(controller, "POST", {} , { "content-type": "text/plain" })).code, 415);
    assert.equal((await call(controller, "POST", {} , { origin: "https://evil.example" })).code, 403);
    assert.equal((await call(controller, "POST", { payload: "x".repeat(64_001) })).code, 413);
    for (const body of [null, [], "text"]) assert.equal((await call(controller, "POST", body)).code, 400);
  }
  for (const key of ["autorizaDados", "aceitaTermos"]) {
    for (const value of [undefined, false]) {
      const denied = await call(registration, "POST", { ...adult, [key]: value });
      assert.equal(denied.code, 400);
      assert.match(denied.payload.error, /autorizar o uso dos dados e aceitar os termos/);
    }
  }
  for (const field of ["telefone", "whatsapp"]) {
    const badPhone = await call(registration, "POST", { ...adult, [field]: "x" });
    assert.equal(badPhone.code, 400);
    assert.match(badPhone.payload.error, /inválido/);
  }
  assert.equal((await call(registration, "POST", { ...adult, dataNascimento: "1990-02-30" })).code, 400);
  assert.equal((await call(registration, "POST", { ...adult, cep: "29100-000" })).code, 400);
  assert.equal((await call(registration, "POST", { ...adult, cep: "29000-001" })).code, 503);
  const created = await call(registration, "POST", adult, { origin: "https://qualificavix.example" });
  assert.equal(created.code, 201);
  assert.equal(created.payload.id, 1);
  assert.equal(rows.registrations[0].cpf, "12345678901");
  assert.equal(rows.registrations[0].email, "maria@example.com");
  assert.equal(rows.registrations[0].payload.cep, "29050945");
  for (const key of ["escolaridade", "situacaoEmprego", "possuiDeficiencia", "tiposDeficiencia", "aceitaTermos", "autorizaDados", "autorizaImagem", "quaisBeneficios"])
    assert.deepEqual(rows.registrations[0].payload[key], adult[key]);
  rows.registrations[0].cpf = "123.456.789-01";
  rows.registrations[0].email = "MARIA@example.com";
  assert.equal((await call(registration, "POST", { ...adult, cpf: "12345678901", email: "other@example.com" })).code, 409);
  assert.equal((await call(registration, "POST", { ...adult, cpf: "22222222222" })).code, 409);
  const minor = { ...adult, dataNascimento: "2012-05-10", cpf: "98765432100", email: "minor@example.com" };
  assert.equal((await call(registration, "POST", minor)).code, 400);
  const invalidGuardianPhone = await call(registration, "POST", { ...minor,
    nomeResponsavel: "João Silva", cpfResponsavel: "111.222.333-44", grauParentesco: "Pai", telefoneResponsavel: "x",
  });
  assert.equal(invalidGuardianPhone.code, 400);
  assert.match(invalidGuardianPhone.payload.error, /Telefone do responsável inválido/);
  assert.equal((await call(registration, "POST", { ...minor,
    nomeResponsavel: "João Silva", cpfResponsavel: "111.222.333-44", grauParentesco: "Pai", telefoneResponsavel: "27988888888",
  })).code, 201);
  const testimonialData = { name: "Ana", role: "Aluna", course: "Excel", quote: "Ótimo", rating: 5 };
  assert.equal((await call(testimonials, "POST", { ...testimonialData, rating: true })).code, 400);
  const testimonial = await call(testimonials, "POST", testimonialData);
  assert.equal(testimonial.code, 201);
  assert.deepEqual(testimonial.payload, { ...testimonialData, id: 1 });
  const list = await call(testimonials, "GET");
  assert.equal(list.code, 200);
  assert.deepEqual(list.payload, [testimonial.payload]);
  failDatabase = true;
  const brokenHealth = await call(health, "GET");
  assert.equal(brokenHealth.code, 503);
  assert.equal(brokenHealth.payload.error, "Banco de dados indisponível");
  for (const response of [brokenHealth, await call(registration, "POST", { ...adult, cpf: "66666666666", email: "other@example.com" }), await call(testimonials, "GET")]) {
    assert.ok(response.code >= 500);
    assert.equal(JSON.stringify(response.payload).includes("private-password"), false);
    assert.equal(response.payload.detail, undefined);
  }
  failDatabase = false;
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  assert.equal((await call(health, "GET")).code, 503, "Conexão não configurada deve retornar resposta segura");
  assert.equal(schemaCalls, 7, "Schema concluído deve ser reutilizado durante a instância");
  console.log("✓ serverless: contratos HTTP, models PostgreSQL isolados, retry de schema e falhas seguras sem acesso ao banco real");
} finally {
  hooks.deregister();
  delete globalThis.__qualificaVixTestSql;
  globalThis.fetch = originalFetch;
  for (const [name, value] of Object.entries(savedConfig)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
