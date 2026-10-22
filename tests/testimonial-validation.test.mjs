import assert from "node:assert/strict";
import test from "node:test";

import { validateTestimonial } from "../server/models/validation.mjs";
import { COURSES } from "../shared/courses.mjs";

const baseTestimonial = Object.freeze({
  role: "Auxiliar administrativa",
  courseId: 2,
  quote: "O curso me ajudou a organizar planilhas e aplicar fórmulas no trabalho.",
  rating: 5,
  acceptedGuidelines: true,
  website: "",
});

const validate = (overrides = {}) => validateTestimonial({ ...baseTestimonial, ...overrides });

function assertRejected(input, message) {
  const result = validateTestimonial(input);
  assert.equal(typeof result?.error, "string", message);
  assert.ok(result.error.trim(), message);
  assert.equal(result.data, undefined, `${message}: uma entrada rejeitada não pode produzir dados persistíveis`);
}

test("depoimento aceita somente IDs inteiros do catálogo e deriva o título canônico", () => {
  assert.ok(COURSES.length > 0, "o catálogo precisa ter cursos para alimentar a enumeração");
  assert.equal(new Set(COURSES.map(course => course.id)).size, COURSES.length, "IDs do catálogo devem ser únicos");
  assert.equal(new Set(COURSES.map(course => course.title)).size, COURSES.length, "títulos do catálogo devem ser únicos");

  for (const course of COURSES) {
    const result = validate({ courseId: course.id });
    assert.equal(result.error, undefined, `curso ${course.id} deveria ser aceito`);
    assert.equal(result.data.courseId, course.id);
    assert.equal(result.data.course, course.title, "o cliente não decide o texto exibido nem o destino do botão");
    assert.equal(result.data.name, undefined, "o nome precisa vir da sessão, não do formulário");
    assert.equal(result.data.website, undefined, "o honeypot nunca deve ser persistido");
  }
});

test("depoimento rejeita curso inexistente, tipo ambíguo e título livre legado", () => {
  const largestCourseId = Math.max(...COURSES.map(course => course.id));
  for (const courseId of [
    undefined, null, true, false, "2", "02", 0, -1, 1.5, NaN, Infinity,
    largestCourseId + 1, Number.MAX_SAFE_INTEGER, {}, [],
  ]) {
    assertRejected({ ...baseTestimonial, courseId }, `courseId ${String(courseId)} deveria ser rejeitado`);
  }

  const { courseId: _ignored, ...withoutId } = baseTestimonial;
  assertRejected({ ...withoutId, course: COURSES[0].title }, "um título livre não substitui courseId");
  assertRejected(
    { ...baseTestimonial, course: COURSES.at(-1).title },
    "um título enviado pelo cliente não pode divergir do curso associado ao botão",
  );
});

test("depoimento aplica uma lista fechada de campos contra mass assignment", () => {
  for (const [field, value] of Object.entries({
    name: "Nome escolhido pelo cliente",
    id: 999,
    approved: true,
    verified: true,
    moderationStatus: "approved",
    authorId: 1,
    createdAt: "2000-01-01T00:00:00.000Z",
  })) {
    assertRejected({ ...baseTestimonial, [field]: value }, `campo extra ${field} deveria ser rejeitado`);
  }

  const polluted = JSON.parse(JSON.stringify({ ...baseTestimonial }).slice(0, -1) + ',"__proto__":{"isAdmin":true}}');
  assertRejected(polluted, "chave de poluição de protótipo deveria ser rejeitada");
  assert.equal({}.isAdmin, undefined);
});

test("depoimento bloqueia marcação executável, links e cargas de injeção", () => {
  const maliciousValues = [
    ["role", "<svg onload=alert(1)>"],
    ["quote", "Gostei muito <script>alert(document.cookie)</script> do curso."],
    ["quote", "Veja detalhes em https://example.invalid/oferta e compre agora."],
    ["quote", "Acesse www.example.invalid para receber um prêmio gratuito."],
    ["quote", "Clique em [esta oferta](javascript:alert(1)) para continuar."],
    ["quote", "Bom curso'); DROP TABLE testimonials; -- não perca esta oferta."],
    ["quote", "Texto aparentemente normal\u0000com um caractere de controle oculto."],
  ];

  for (const [field, value] of maliciousValues) {
    assertRejected({ ...baseTestimonial, [field]: value }, `${field} malicioso deveria ser rejeitado`);
  }
});

test("depoimento impede a publicação acidental de dados pessoais de contato", () => {
  for (const quote of [
    "Gostei do curso; escreva para ana.souza@example.com para saber mais.",
    "Gostei do curso; meu telefone é (27) 99999-9999 para contato.",
    "Gostei do curso; meu CPF é 123.456.789-01 e posso explicar melhor.",
    "Gostei do curso; me procure pelo perfil @contato_particular para conversar.",
  ]) {
    assertRejected({ ...baseTestimonial, quote }, "contato ou documento pessoal não deve ficar público");
  }
});

test("depoimento bloqueia ofensas e ameaças sem impedir uma crítica construtiva", () => {
  for (const quote of [
    "Esse curso é uma merda e não deveria continuar disponível na plataforma.",
    "Vou agredir o professor porque não gostei das atividades desse curso.",
  ]) {
    assertRejected({ ...baseTestimonial, quote }, "ofensa ou ameaça deveria ser rejeitada");
  }

  assert.equal(validate({
    quote: "O curso teve pontos positivos, porém as aulas poderiam incluir mais exemplos práticos.",
  }).error, undefined);
  assertRejected({ ...baseTestimonial, role: "Instrutor idiota" }, "ofensa no campo de ocupação também deve ser rejeitada");
});

test("depoimento rejeita conteúdo vazio, curto, repetitivo ou sem texto útil", () => {
  const invalidFields = [
    ["role", "..."],
    ["quote", "Ótimo"],
    ["quote", "!!!!!!!!!!!!!!!!!"],
    ["quote", "a".repeat(80)],
    ["quote", "curso ".repeat(30)],
    ["quote", "asdf qwer zxcv hjkl asdf qwer zxcv hjkl"],
  ];

  for (const [field, value] of invalidFields) {
    assertRejected({ ...baseTestimonial, [field]: value }, `${field} sem conteúdo útil deveria ser rejeitado`);
  }
});

test("depoimento preserva críticas construtivas e português natural", () => {
  const legitimate = [
    {
      role: "Pessoa em transição de carreira",
      quote: "O conteúdo foi útil, mas senti falta de mais exercícios práticos nas últimas aulas.",
    },
    {
      role: "Aluno",
      quote: "Durante 3 meses aprendi HTML, CSS e JavaScript; agora consigo criar páginas simples.",
    },
    {
      role: "Desenvolvedor ASP.NET",
      quote: "No curso pratiquei ASP.NET e socket.io para compreender melhor aplicações conectadas.",
    },
  ];

  for (const values of legitimate) {
    const result = validate({ ...values, role: ` ${values.role} `, quote: ` ${values.quote} ` });
    assert.equal(result.error, undefined, `relato legítimo deveria ser aceito: ${values.quote}`);
    assert.equal(result.data.role, values.role);
    assert.equal(result.data.quote, values.quote);
  }
});

test("depoimento exige aceite explícito das diretrizes e rejeita o honeypot preenchido", () => {
  for (const acceptedGuidelines of [undefined, null, false, "true", 1]) {
    assertRejected(
      { ...baseTestimonial, acceptedGuidelines },
      `aceite ${String(acceptedGuidelines)} não deveria autorizar a publicação`,
    );
  }

  assert.equal(validate({ acceptedGuidelines: true, website: "" }).error, undefined);
  assert.equal(validate({ acceptedGuidelines: true, website: "   " }).error, undefined);
  for (const website of ["spam", "https://example.invalid", 123, {}, []]) {
    assertRejected({ ...baseTestimonial, website }, "honeypot preenchido ou malformado deveria ser rejeitado");
  }
});

test("depoimento exige nota numérica inteira entre 1 e 5", () => {
  for (const rating of [1, 2, 3, 4, 5]) assert.equal(validate({ rating }).error, undefined);
  for (const rating of [undefined, null, false, true, "1", "5", 0, 6, 1.5, NaN, Infinity, {}, []]) {
    assertRejected({ ...baseTestimonial, rating }, `nota ${String(rating)} deveria ser rejeitada`);
  }
});

test("validação não altera o objeto recebido", () => {
  const input = {
    ...baseTestimonial,
    role: "  Auxiliar administrativa ",
    quote: "  O curso me ajudou a organizar planilhas e aplicar fórmulas no trabalho.  ",
  };
  const before = structuredClone(input);
  const result = validateTestimonial(input);

  assert.equal(result.error, undefined);
  assert.deepEqual(input, before);
  assert.equal(result.data.role, "Auxiliar administrativa");
  assert.equal(result.data.quote, "O curso me ajudou a organizar planilhas e aplicar fórmulas no trabalho.");
});
