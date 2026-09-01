import assert from "node:assert/strict";
import { validateRegistration, validateTestimonial } from "../server/models/validation.mjs";

const adult = {
  nome: "Maria Silva", cpf: "123.456.789-01", email: "MARIA@example.com", telefone: "27999999999",
  dataNascimento: "1990-05-10", bairro: "Centro", cep: "29000-000", rua: "Rua A", numero: "10",
};

const validAdult = validateRegistration(adult);
assert.equal(validAdult.error, undefined);
assert.equal(validAdult.data.email, "maria@example.com");
assert.equal(validAdult.data.menorDeIdade, false);
assert.equal(validateRegistration({ ...adult, email: "email-invalido" }).error, "E-mail inválido");
assert.equal(validateRegistration({ ...adult, cpf: "123" }).error, "CPF inválido");
assert.equal(validateRegistration({ ...adult, dataNascimento: "2999-01-01" }).error, "Data de nascimento inválida");

const minor = { ...adult, dataNascimento: "2012-05-10", cpf: "987.654.321-00" };
assert.match(validateRegistration(minor).error, /Responsável legal/);
assert.equal(validateRegistration({
  ...minor, nomeResponsavel: "João Silva", cpfResponsavel: "111.222.333-44",
  grauParentesco: "Pai", telefoneResponsavel: "27988888888",
}).data.menorDeIdade, true);

assert.equal(validateTestimonial({ name: "Ana", role: "Aluna", course: "Excel", quote: "Ótimo", rating: 5 }).error, undefined);
assert.match(validateTestimonial({ name: "Ana", role: "Aluna", course: "Excel", quote: "Ótimo", rating: 6 }).error, /inválidos/);
console.log("✓ validações de cadastro, menor de idade e depoimentos");
