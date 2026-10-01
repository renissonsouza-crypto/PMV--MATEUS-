import assert from "node:assert/strict";
import { validateJsonMutation } from "../server/controllers/requestSecurity.mjs";
import { validateVitoriaCep } from "../server/models/validation.mjs";

assert.equal(validateJsonMutation({ headers: { "content-type": "application/json; charset=utf-8" } }), null);
assert.deepEqual(
  validateJsonMutation({ headers: { "content-type": "text/plain" } }),
  { status: 415, error: "Content-Type deve ser application/json" },
);
assert.deepEqual(
  validateJsonMutation({ headers: { "content-type": "application/json" }, body: { text: "x".repeat(64_001) } }),
  { status: 413, error: "Payload muito grande" },
);
assert.deepEqual(
  validateJsonMutation({ headers: { "content-type": "application/json", origin: "https://evil.example", host: "qualificavix.example" } }),
  { status: 403, error: "Origem não permitida" },
);
assert.deepEqual(
  validateJsonMutation({ headers: { "content-type": "application/json", origin: "https://evil.example", host: "qualificavix.example", "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" } }),
  { status: 403, error: "Origem não permitida" },
);
assert.deepEqual(
  validateJsonMutation({ headers: { "content-type": "application/json", origin: "http://qualificavix.example", host: "qualificavix.example", "x-forwarded-proto": "https" } }),
  { status: 403, error: "Origem não permitida" },
);
assert.equal(
  validateJsonMutation({ headers: { "content-type": "application/json", origin: "https://qualificavix.example", host: "qualificavix.example", "x-forwarded-proto": "https" } }),
  null,
);

const lookup = address => async () => ({ ok: true, json: async () => address });
assert.deepEqual(await validateVitoriaCep("29050-945", lookup({ localidade: "Vitória", uf: "ES" })), { valid: true, unavailable: false });
assert.deepEqual(await validateVitoriaCep("29100-000", lookup({ localidade: "Vila Velha", uf: "ES" })), { valid: false, unavailable: false });
assert.deepEqual(await validateVitoriaCep("29050-945", lookup({ localidade: "Vitória", uf: "RJ" })), { valid: false, unavailable: false });
assert.deepEqual(await validateVitoriaCep("00000-000", lookup({ erro: true })), { valid: false, unavailable: false });
assert.deepEqual(await validateVitoriaCep("29050-945", async () => { throw new Error("indisponível"); }), { valid: false, unavailable: true });
console.log("✓ content-type JSON e origens cruzadas bloqueadas");