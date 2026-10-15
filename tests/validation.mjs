import assert from "node:assert/strict";
import { ageFromBirthDate, validateRegistration, validateTestimonial } from "../server/models/validation.mjs";

const adult = {
  nome: "Maria Silva", cpf: "123.456.789-01", email: "MARIA@example.com", telefone: "27999999999",
  dataNascimento: "1990-05-10", bairro: "Centro", cep: "29000-000", rua: "Rua A", numero: "10",
  autorizaDados: true, aceitaTermos: true,
};

const validAdult = validateRegistration(adult);
assert.equal(validAdult.error, undefined);
assert.equal(validAdult.data.email, "maria@example.com");
assert.equal(validAdult.data.menorDeIdade, false);
assert.equal(validAdult.data.cpf, "12345678901");
assert.equal(validAdult.data.cep, "29000000");
for (const key of ["autorizaDados", "aceitaTermos"]) {
  for (const value of [undefined, false])
    assert.match(validateRegistration({ ...adult, [key]: value }).error, /autorizar o uso dos dados e aceitar os termos/);
}
for (const telefone of ["x", "99999999", "279999999999"])
  assert.match(validateRegistration({ ...adult, telefone }).error, /Telefone inválido/);
for (const telefone of ["(27) 99999-9999", "(27) 3333-3333"])
  assert.equal(validateRegistration({ ...adult, telefone, whatsapp: telefone }).error, undefined);
assert.match(validateRegistration({ ...adult, whatsapp: "x" }).error, /WhatsApp inválido/);
assert.equal(validateRegistration({ ...adult, whatsapp: "" }).error, undefined);
assert.equal(validateRegistration({ ...adult, email: "email-invalido" }).error, "E-mail inválido");
assert.equal(validateRegistration({ ...adult, cpf: "123" }).error, "CPF inválido");
assert.equal(validateRegistration({ ...adult, dataNascimento: "2999-01-01" }).error, "Data de nascimento inválida");
for (const date of ["2023-02-29", "2000-02-30", "1990-04-31", "1990-13-01", "1990-05-10extra", "1990-5-10"])
  assert.equal(ageFromBirthDate(date), null, `${date} deveria ser uma data inválida`);
assert.equal(ageFromBirthDate("2000-02-29") !== null, true);
assert.ok(validateRegistration({ ...adult, dataNascimento: "2000-02-30" }).error);
assert.ok(validateRegistration({ ...adult, dataNascimento: "1990-05-10extra" }).error);
assert.ok(validateRegistration({ ...adult, cpf: "12345678901extra" }).error);
assert.ok(validateRegistration({ ...adult, cep: "abc29000-000" }).error);
for (const value of [{ text: "Maria" }, ["Maria"], true, 123])
  assert.equal(validateRegistration({ ...adult, nome: value }).error, "Dados do cadastro inválidos");
for (const [field, length] of [["nome", 121], ["telefone", 31], ["bairro", 121], ["email", 181]])
  assert.ok(validateRegistration({ ...adult, [field]: "a".repeat(length) }).error, `Campo ${field} não deve ser truncado`);
const metadata = {
  sexo: "Feminino", escolaridade: "Ensino médio completo", situacaoEmprego: "Empregada", whatsapp: "27999999999",
  possuiDeficiencia: "sim", tiposDeficiencia: "visual", necessitaAdaptacao: "sim", tiposAdaptacao: "Material acessível",
  rendaFamiliar: "Até 1 salário mínimo", numeroDependentes: "2", beneficioProgramaSocial: "sim", quaisBeneficios: [" Bolsa Família "],
  autorizaImagem: false, autorizaDados: true, aceitaTermos: true, receberNotificacoes: false,
};
const savedMetadata = validateRegistration({ ...adult, ...metadata, emailConfirm: adult.email }).data;
for (const [key, value] of Object.entries(metadata))
  assert.deepEqual(savedMetadata[key], key === "quaisBeneficios" ? ["Bolsa Família"] : value);
assert.equal(savedMetadata.emailConfirm, undefined);
assert.ok(validateRegistration({ ...adult, autorizaDados: "true" }).error);
assert.ok(validateRegistration({ ...adult, quaisBeneficios: "Bolsa Família" }).error);
assert.ok(validateRegistration({ ...adult, quaisBeneficios: [{}] }).error);

const minor = { ...adult, dataNascimento: "2012-05-10", cpf: "987.654.321-00" };
assert.match(validateRegistration(minor).error, /Responsável legal/);
assert.equal(validateRegistration({
  ...minor, nomeResponsavel: "João Silva", cpfResponsavel: "111.222.333-44",
  grauParentesco: "Pai", telefoneResponsavel: "27988888888",
}).data.menorDeIdade, true);
assert.match(validateRegistration({
  ...minor, nomeResponsavel: "João Silva", cpfResponsavel: "111.222.333-44",
  grauParentesco: "Pai", telefoneResponsavel: "x",
}).error, /Telefone do responsável inválido/);

assert.equal(validateTestimonial({ name: "Ana", role: "Aluna", course: "Excel", quote: "Ótimo", rating: 5 }).error, undefined);
assert.match(validateTestimonial({ name: "Ana", role: "Aluna", course: "Excel", quote: "Ótimo", rating: 6 }).error, /inválidos/);
for (const rating of [true, false, [5], "5extra", null])
  assert.ok(validateTestimonial({ name: "Ana", role: "Aluna", course: "Excel", quote: "Ótimo", rating }).error);
assert.ok(validateTestimonial({ name: { text: "Ana" }, role: "Aluna", course: "Excel", quote: "Ótimo", rating: 5 }).error);
assert.ok(validateTestimonial({ name: "Ana", role: "Aluna", course: "Excel", quote: "x".repeat(501), rating: 5 }).error);
console.log("✓ validações de cadastro, menor de idade e depoimentos");

for (const numero of ['', undefined, 'Sem número']) {
  const result = validateRegistration({ ...adult, numero });
  assert.equal(result.error, undefined, 'Address number is optional on the server');
  assert.equal(result.data.numero, numero ?? '');
}
