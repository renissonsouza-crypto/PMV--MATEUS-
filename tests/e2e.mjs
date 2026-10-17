import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { findBrowserExecutable, startTestEnvironment } from "./e2e-support.mjs";

const tests = [];
const optionalResources = new Set();
const test = (name, run, options = {}) => tests.push({ name, run, options });
const courseTitles = ["Introdução à Programação", "Excel do Básico ao Avançado", "Design Gráfico para Iniciantes", "Marketing Digital na Prática", "Desenvolvimento Web Completo", "Gestão de Projetos", "Informática para o Mercado", "Atendimento ao Cliente", "Gastronomia Brasileira", "Eletricista Predial"];
const PROFILE_KEY = "qualificavix-profile";
const FAVORITES_KEY = "qualificavix-favorite-courses";
const MEMORY_KEY = "qualificavix-tortuguita-memory:";
const profileFixture = () => ({ id: 1000, nome: "Pessoa Teste", email: "browser@example.test", telefone: "27999999999", cep: "29050-945", bairro: "Bento Ferreira", rua: "Avenida Marechal Mascarenhas de Moraes", numero: "10", escolaridade: "Ensino médio completo", enrolledCourseIds: [], enrollments: [] });
const isOptionalResource = url => {
  try { return ["images.unsplash.com", "fonts.googleapis.com", "fonts.gstatic.com"].includes(new URL(url).hostname); }
  catch { return false; }
};

async function navigate(page, label) {
  const mobile = page.getByRole("button", { name: "Abrir menu", exact: true });
  if (await mobile.isVisible()) {
    await mobile.click();
    await page.getByRole("dialog", { name: "Menu", exact: true }).getByRole("button", { name: label, exact: true }).first().click();
  } else await page.locator("header").getByRole("button", { name: label, exact: true }).first().click();
}
async function catalog(page) {
  await navigate(page, "Cursos");
  await page.getByRole("heading", { name: /Encontre o curso ideal/i }).waitFor();
}
async function expectCourses(page, titles) {
  await page.waitForFunction(expected => {
    const actual = [...document.querySelectorAll("main article h3")].map(el => el.textContent);
    return actual.length === expected.length && actual.every((title, i) => title === expected[i]);
  }, titles);
  assert.deepEqual(await page.locator("main article h3").allTextContents(), titles);
}
async function openCourse(page, title) {
  await catalog(page);
  await page.getByPlaceholder(/Buscar cursos, áreas/i).fill(title);
  await expectCourses(page, [title]);
  await page.locator("main article").getByRole("button", { name: /Ver curso/i }).click();
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
}
async function seedProfile(page, profile) {
  environment.seedRegistration(profile);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: PROFILE_KEY, value: profile });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /Encontre oportunidades/i }).waitFor();
}
const storedProfile = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), PROFILE_KEY);
async function openProfile(page) {
  await page.getByRole("button", { name: /Abrir perfil de/i }).first().click();
  await page.getByRole("heading", { name: "Meu perfil", exact: true }).waitFor();
}
async function waitForDirectEnrollment(page) {
  await page.getByRole('status').filter({ hasText: 'Inscrição confirmada. O curso está disponível no seu perfil.' }).waitFor();
  assert.equal(environment.emails.length, 0, 'Direct enrollment must never send email');
}
async function requestAndConfirm(page, title) {
  await page.getByRole('button', { name: 'Confirmar minha inscrição', exact: true }).click();
  await waitForDirectEnrollment(page);
  await openCourse(page, title);
}

async function fillPersonalData(page, overrides = {}) {
  const values = { nome: "Pessoa Teste Navegador", cpf: "529.982.247-25", dataNascimento: "01/01/1990", telefone: "27999999999", email: "registration-browser@example.test", emailConfirm: "registration-browser@example.test", ...overrides };
  for (const [name, value] of Object.entries(values)) {
    const input = page.locator(`[name="${name}"]`);
    if (!await input.count()) continue;
    if (await input.isEditable()) await input.fill(value);
    else assert.equal(await input.inputValue(), value);
  }
  await page.locator('[name="sexo"]').selectOption("Prefiro não informar");
  await page.locator('[name="escolaridade"]').selectOption("Ensino médio completo");
  await page.locator('[name="situacaoEmprego"]').selectOption("Desempregado");
}
async function fillAddress(page) {
  const cep = page.locator('[name="cep"]');
  await cep.fill("29050-945");
  await cep.blur();
  await page.waitForFunction(() => document.querySelector('[name="bairro"]')?.value === "Bento Ferreira");
  await page.locator('[name="numero"]').fill("10");
}
async function openAssistant(page) {
  await page.getByRole("button", { name: "Abrir assistente virtual", exact: true }).click();
  await page.getByRole("dialog", { name: "Tortuguita", exact: true }).waitFor();
}
async function askAssistant(page, message) {
  const log = page.getByRole("log", { name: "Conversa com a Tortuguita", exact: true });
  const previousCount = await log.locator("p").count();
  const input = page.getByRole("textbox", { name: "Sua dúvida ou busca", exact: true });
  await input.fill(message);
  await input.press("Enter");
  // A request can open a page and close the chat. Reopen it to inspect the
  // retained response; dedicated navigation cases below check the closed state.
  await page.waitForFunction(previous => {
    const log = document.querySelector('[role="log"][aria-label="Conversa com a Tortuguita"]');
    return !log || log.querySelectorAll("p").length >= previous + 2;
  }, previousCount);
  if (!await page.getByRole("dialog", { name: "Tortuguita", exact: true }).isVisible()) await openAssistant(page);
  const response = log.locator("p").nth(previousCount + 1);
  await response.waitFor();
  return response.innerText();
}

// Every case gets a new context, so viewport, dialogs and browser storage never leak.
test("carregamento da página inicial e API SQLite", async (page, environment) => {
  assert(await page.getByLabel(/Tortuguita Vix/i).count() > 0, "Mascote não renderizada");
  const response = await page.request.get(`${process.env.TEST_URL ? environment.apiURL : environment.baseURL}/api/health`);
  assert.equal(response.status(), 200);
  assert.equal((await response.json()).database, "connected");
});

test("navegação principal", async page => {
  for (const [label, heading] of [["Cursos", /Encontre o curso ideal/i], ["Categorias", /^Categorias$/i], ["Sobre", /Sobre o QualificaVix/i], ["Contato", /Entre em contato/i], ["Início", /Encontre oportunidades/i]]) {
    await navigate(page, label);
    await page.getByRole("heading", { name: heading }).first().waitFor();
    if (label === "Contato") {
      for (const landmark of ["main", "footer"]) {
        const portal = page.locator(landmark).getByRole("link", { name: "Atendimento: Portal da Prefeitura de Vitória", exact: true });
        assert.equal(await portal.getAttribute("href"), "https://www.vitoria.es.gov.br/");
        assert.equal(await portal.getAttribute("target"), "_blank");
        assert.match(await portal.getAttribute("rel"), /noopener/);
      }
      assert.doesNotMatch(await page.locator("body").innerText(), /0800 123 4567|contato@qualificavix\.es\.gov\.br/);
    }
  }
});

test("zoom: limites e persistência após recarregar", async page => {
  const plus = page.getByRole("button", { name: "Aumentar zoom" }).first();
  const minus = page.getByRole("button", { name: "Diminuir zoom" }).first();
  await plus.click();
  assert.equal(await page.locator("html").evaluate(el => el.style.fontSize), "16.8px");
  for (let i = 0; i < 10; i++) await plus.click();
  assert.equal(await page.locator("html").evaluate(el => el.style.fontSize), "20px");
  for (let i = 0; i < 12; i++) await minus.click();
  assert.equal(await page.locator("html").evaluate(el => el.style.fontSize), "13.6px");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.style.fontSize === "13.6px");
});

test("modo escuro: persistência após recarregar", async page => {
  await page.getByRole("button", { name: "Ativar modo escuro" }).first().click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.classList.contains("qualificavix-dark"));
  await page.getByRole("button", { name: "Ativar modo claro" }).first().click();
  assert.equal(await page.evaluate(() => localStorage.getItem("qualificavix-dark-mode")), "false");
});

test("busca do cabeçalho: primeira pesquisa e nova pesquisa no catálogo", async page => {
  for (const title of ["Introdução à Programação", "Excel do Básico ao Avançado"]) {
    await page.locator("header button:has(svg.lucide-search)").click();
    const input = page.getByPlaceholder("Buscar cursos...");
    await input.fill(title);
    await input.press("Enter");
    await expectCourses(page, [title]);
  }
});

test("catálogo: busca, filtros combinados, todas as categorias e limpeza", async page => {
  await catalog(page);
  await expectCourses(page, courseTitles);
  const search = page.getByPlaceholder(/Buscar cursos, áreas/i);
  await search.fill("Programação");
  await expectCourses(page, [courseTitles[0]]);
  await search.fill("curso inexistente xyz");
  await page.getByText(/Nenhum curso encontrado/i).waitFor();
  await page.getByRole("button", { name: /Limpar busca/i }).click();
  await expectCourses(page, courseTitles);
  const category = page.locator("main select").nth(0);
  const modality = page.locator("main select").nth(1);
  await category.selectOption("Tecnologia");
  await expectCourses(page, [courseTitles[0], courseTitles[4], courseTitles[6]]);
  await modality.selectOption("Online");
  await expectCourses(page, [courseTitles[0], courseTitles[4]]);
  await category.selectOption({ label: "Categoria: Todas" });
  await expectCourses(page, [courseTitles[0], courseTitles[1], courseTitles[3], courseTitles[4], courseTitles[5], courseTitles[7]]);
  await modality.selectOption("Presencial");
  await expectCourses(page, [courseTitles[2], courseTitles[6], courseTitles[8], courseTitles[9]]);
  await page.getByRole("button", { name: /Limpar filtros/i }).click();
  await expectCourses(page, courseTitles);
  assert.deepEqual(await page.locator("main select").evaluateAll(items => items.map(item => item.value)), ["Todas", "Todas"]);
});

test("categorias: rótulos mapeados e contagens reais", async page => {
  await navigate(page, "Categorias");
  await page.getByRole("button", { name: "Criatividade (1)", exact: true }).click();
  await expectCourses(page, [courseTitles[2]]);
  await page.getByRole("button", { name: "Cursos Técnicos (1)", exact: true }).click();
  await expectCourses(page, [courseTitles[9]]);
  await page.getByRole("button", { name: "Todas as áreas", exact: true }).click();
  await expectCourses(page, courseTitles);
});

test("categorias: atalhos da página inicial e rodapé", async page => {
  await page.locator("main").getByRole("button", { name: /Criatividade.*1 curso/i }).click();
  await expectCourses(page, [courseTitles[2]]);
  await page.locator("footer").getByRole("button", { name: "Tecnologia", exact: true }).click();
  await expectCourses(page, [courseTitles[0], courseTitles[4], courseTitles[6]]);
});

test("curso: conteúdo de todas as abas e inscrição exige cadastro", async page => {
  await openCourse(page, courseTitles[0]);
  for (const [tab, heading] of [["Conteúdo programático", "Conteúdo programático"], ["Instrutor", "Instrutor da turma"], ["Requisitos", "Pré-requisitos"], ["Certificado", "Certificação"], ["Instituição", "Instituição e local do curso"], ["Sobre o curso", "O que você vai aprender"]]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await page.locator("#curso-informacoes").getByRole("heading", { name: heading, exact: true }).waitFor();
  }
  await page.getByRole("button", { name: "Inscrever-se", exact: true }).click();
  await page.getByRole("heading", { name: "Dados Pessoais", exact: true }).waitFor();
});

test("curso futuro: inscrição indisponível", async page => {
  await openCourse(page, courseTitles[5]);
  assert(await page.getByRole("button", { name: "Inscrições em breve", exact: true }).isDisabled());
});

test("favoritos: adicionar, persistir e remover", async page => {
  await catalog(page);
  await page.getByRole("button", { name: `Adicionar ${courseTitles[0]} aos favoritos`, exact: true }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await navigate(page, "Favoritos");
  await expectCourses(page, [courseTitles[0]]);
  await page.getByRole("button", { name: `Remover ${courseTitles[0]} dos favoritos`, exact: true }).click();
  assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), FAVORITES_KEY), []);
  assert.equal(await page.locator("main article").count(), 0);
});

test("cadastro: obrigatórios e confirmação de e-mail", async page => {
  await page.getByRole("button", { name: "Entrar ou cadastrar", exact: true }).first().click();
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await page.getByText("Nome obrigatório", { exact: true }).waitFor();
  await fillPersonalData(page, { emailConfirm: "outro@example.test" });
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await page.getByText("Os e-mails não coincidem", { exact: true }).waitFor();
  await page.getByRole("heading", { name: "Dados Pessoais", exact: true }).waitFor();
});

test("cadastro: menor exige responsável e CEP fora de Vitória é rejeitado", async page => {
  await page.getByRole("button", { name: "Entrar ou cadastrar", exact: true }).first().click();
  await fillPersonalData(page, { dataNascimento: `${new Date().getFullYear() - 12}-01-01` });
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await page.getByRole("heading", { name: "Endereço de Moradia", exact: true }).waitFor();
  await fillAddress(page);
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await page.getByText("Obrigatório para menor de idade", { exact: true }).first().waitFor();
  await page.locator('[name="cep"]').fill("29100-000");
  await page.locator('[name="cep"]').blur();
  await page.getByText(/apenas CEPs da cidade de Vitória-ES/i).waitFor();
});

test("cadastro: Enter valida emprego e data futura sem enviar antecipadamente", async page => {
  let posts = 0;
  page.on("request", request => {
    if (request.url().endsWith("/api/registrations") && request.method() === "POST") posts++;
  });
  await page.getByRole("button", { name: "Entrar ou cadastrar", exact: true }).first().click();
  await fillPersonalData(page);
  await page.locator('[name="situacaoEmprego"]').selectOption("");
  await page.locator('[name="telefone"]').press("Enter");
  assert.equal(posts, 0);
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await page.getByText("Campo obrigatório", { exact: true }).waitFor();
  await page.getByRole("heading", { name: "Dados Pessoais", exact: true }).waitFor();
  assert.equal(posts, 0);
  await page.locator('[name="situacaoEmprego"]').selectOption("Desempregado");
  await page.locator('[name="dataNascimento"]').fill(`${new Date().getFullYear() + 1}-01-01`);
  await page.locator('[name="telefone"]').press("Enter");
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await page.getByText("Data de nascimento inválida", { exact: true }).waitFor();
  assert.equal(posts, 0);
  await page.locator('[name="dataNascimento"]').fill("1990-01-01");
  await page.locator('[name="telefone"]').press("Enter");
  if (await page.getByRole("heading", { name: "Dados Pessoais", exact: true }).count()) {
    await page.getByRole("button", { name: "Próximo", exact: true }).click();
  }
  await page.getByRole("heading", { name: "Endereço de Moradia", exact: true }).waitFor();
  assert.equal(posts, 0);
});

test("cadastro completo: formulário, API real, SQLite e perfil persistido", async (page, environment) => {
  await openCourse(page, courseTitles[0]);
  await page.getByRole("button", { name: "Inscrever-se", exact: true }).click();
  await fillPersonalData(page);
  const birthday = page.locator('[name="dataNascimento"]');
  await birthday.fill('');
  await birthday.pressSequentially('25081990');
  assert.equal(await birthday.inputValue(), '25/08/1990');
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await fillAddress(page);
  await page.locator('[name="numero"]').fill('');
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await page.locator('label').filter({ has: page.locator('input[name="possuiDeficiencia"][value="sim"]') }).click();
  await page.locator('[name="tiposDeficiencia"]').selectOption("Deficiência visual");
  await page.locator('label').filter({ has: page.locator('input[name="beneficioProgramaSocial"][value="sim"]') }).click();
  await page.locator('input[name="quaisBeneficios"][value="BPC / LOAS"]').check();
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await page.getByRole("button", { name: "Anterior", exact: true }).click();
  assert(await page.locator('input[name="possuiDeficiencia"][value="sim"]').isChecked());
  assert(await page.locator('input[name="beneficioProgramaSocial"][value="sim"]').isChecked());
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await page.locator('[name="autorizaDados"]').check();
  await page.locator('[name="aceitaTermos"]').check();
  const [response] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/registrations") && response.request().method() === "POST"),
    page.getByRole("button", { name: "Concluir cadastro", exact: true }).click(),
  ]);
  assert.equal(response.status(), 201, await response.text());
  await page.getByRole("heading", { name: "Inscrição confirmada!", exact: true }).waitFor();
  await waitForDirectEnrollment(page);
  assert.deepEqual((await storedProfile(page)).enrolledCourseIds, [1]);
  const profile = await storedProfile(page);
  assert.equal(profile.nome, "Pessoa Teste Navegador");
  assert.deepEqual(profile.enrolledCourseIds, [1]);
  const persisted = environment.registration(profile.id);
  assert.equal(persisted.email, "registration-browser@example.test");
  const payload = JSON.parse(persisted.payload);
  assert.equal(payload.dataNascimento, '1990-08-25');
  assert.equal(payload.policyReceipt.version, '2026-10-17.3');
  assert(payload.policyReceipt.policies.privacy.paragraphs.length > 0);
  assert.equal(payload.numero, '');
  assert.equal(payload.autorizaDados, true);
  assert.equal(payload.possuiDeficiencia, "sim");
  assert.equal(payload.beneficioProgramaSocial, "sim");
  assert.deepEqual(payload.quaisBeneficios, ["BPC / LOAS"]);
  await page.getByRole("button", { name: "Acessar meu perfil", exact: true }).click();
  await page.getByRole("heading", { name: "Meu perfil", exact: true }).waitFor();
  assert.equal(await page.getByLabel("Nome completo", { exact: true }).inputValue(), profile.nome);
  assert.equal(await page.getByLabel("E-mail", { exact: true }).inputValue(), profile.email);
  await page.reload({ waitUntil: "domcontentloaded" });
  await openProfile(page);
  await page.getByRole("button", { name: "Cursos cadastrados (1)", exact: true }).click();
  await page.getByRole("heading", { name: courseTitles[0], exact: true }).waitFor();
});

test("cadastro: falhas ficam visíveis no celular e nova tentativa grava os mesmos dados", async (page, environment) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page.getByRole("dialog", { name: "Menu", exact: true }).getByRole("button", { name: "Entrar / Cadastrar", exact: true }).click();
  await fillPersonalData(page, { cpf: "123.456.789-09", email: "registration-retry@example.test", emailConfirm: "registration-retry@example.test" });
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await fillAddress(page);
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  const finish = page.getByRole("button", { name: "Concluir cadastro", exact: true });
  await finish.click();
  await page.getByRole("alert").getByText("Consentimento obrigatório", { exact: true }).waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute("name") === "autorizaDados");
  assert.equal(await storedProfile(page), null);
  await page.locator('[name="autorizaDados"]').check();
  await page.locator('[name="aceitaTermos"]').check();
  // Fail the actual submission transport, not validation or profile storage.
  for (const [status, message] of [[503, "Não foi possível validar o CEP agora. Tente novamente."], [409, "CPF ou e-mail já cadastrado"], [500, "Erro ao realizar cadastro"], [200, "Resposta de cadastro inválida"]]) {
    let release;
    const pending = status === 503 ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
    const handler = async route => { await pending; await route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: message }) }); };
    await page.route("**/api/registrations", handler);
    // These error responses are intentional and must not be treated as page failures.
    await finish.click();
    if (release) {
      await page.getByRole("status").getByText("Salvando seu cadastro. Aguarde a confirmação.", { exact: true }).waitFor();
      assert(await page.locator('form button[type="submit"]').isDisabled(), "Pending submission must prevent duplicate clicks");
      assert.equal(await page.locator("form[aria-busy]").getAttribute("aria-busy"), "true");
      release();
    }
    const alert = page.getByRole("alert");
    await alert.getByText(message, { exact: true }).waitFor();
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "alert");
    const bounds = await alert.boundingBox();
    assert(bounds.y >= 0 && bounds.y + bounds.height <= 700, "Submission error must be visible without scrolling");
    assert(await finish.isEnabled(), "Submission must unlock after an API error");
    assert.equal(await storedProfile(page), null, "Failed submission must not create a profile");
    await page.unroute("**/api/registrations", handler);
  }
  const [response] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/registrations") && response.request().method() === "POST"),
    finish.click(),
  ]);
  assert.equal(response.status(), 201);
  await page.getByRole("heading", { name: "Cadastro realizado!", exact: true }).waitFor();
  const profile = await storedProfile(page);
  assert.equal(profile.email, "registration-retry@example.test");
  assert.equal(environment.registration(profile.id).email, profile.email);
  assert(await page.getByRole("heading", { name: "Cadastro realizado!", exact: true }).evaluate(el => el === document.activeElement));
}, { registrationFailures: true });

test("perfil: editar, persistir e sair", async page => {
  await seedProfile(page, profileFixture());
  await catalog(page);
  await page.getByRole("button", { name: `Adicionar ${courseTitles[0]} aos favoritos`, exact: true }).click();
  await openProfile(page);
  await page.getByLabel("Nome completo", { exact: true }).fill("Pessoa Nome Atualizado");
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Perfil atualizado." }).waitFor();
  await page.reload({ waitUntil: "domcontentloaded" });
  await openProfile(page);
  assert.equal(await page.getByLabel("Nome completo", { exact: true }).inputValue(), "Pessoa Nome Atualizado");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Sair da plataforma", exact: true }).click();
  await page.getByRole("button", { name: "Entrar ou cadastrar", exact: true }).first().waitFor();
  assert.equal(await storedProfile(page), null);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), FAVORITES_KEY), null);
  await navigate(page, "Favoritos");
  assert.equal(await page.locator("main article").count(), 0);
});

test("perfil: endereço de outra cidade é rejeitado sem alterar os dados salvos", async page => {
  await seedProfile(page, profileFixture());
  await openProfile(page);
  await page.getByLabel("CEP", { exact: true }).fill("29100-000");
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: /Vitória/i }).waitFor();
  assert.equal((await storedProfile(page)).cep, "29050-945");
  assert.equal(await page.getByRole("status").filter({ hasText: "Perfil atualizado." }).count(), 0);
});

test("inscrição: confirmação, edição do perfil e desistência dentro do prazo", async page => {
  await seedProfile(page, profileFixture());
  await openCourse(page, courseTitles[1]);
  await page.getByRole("button", { name: "Inscrever-se", exact: true }).click();
  await page.getByRole("heading", { name: "Confirmar inscrição", exact: true }).waitFor();
  await page.getByRole("button", { name: "Editar perfil", exact: true }).click();
  await page.getByLabel("Nome completo", { exact: true }).fill("Pessoa Inscrição Atualizada");
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await page.locator("main").getByRole("button", { name: "Voltar", exact: true }).click();
  await page.getByRole("heading", { name: "Confirmar inscrição", exact: true }).waitFor();
  await requestAndConfirm(page, courseTitles[1]);
  await page.getByRole("button", { name: "Desinscrever-se", exact: true }).waitFor();
  assert.deepEqual((await storedProfile(page)).enrolledCourseIds, [2]);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Desinscrever-se", exact: true }).click();
  await page.getByRole("button", { name: "Inscrever-se", exact: true }).waitFor();
  assert.deepEqual((await storedProfile(page)).enrolledCourseIds, []);
});

test("inscrição: três cursos por mês bloqueiam o quarto", async page => {
  await seedProfile(page, profileFixture());
  for (const id of [1, 2, 3]) {
    await openCourse(page, courseTitles[id - 1]);
    await page.getByRole("button", { name: "Inscrever-se", exact: true }).click();
    await requestAndConfirm(page, courseTitles[id - 1]);
    await page.getByRole("button", { name: "Desinscrever-se", exact: true }).waitFor();
  }
  await openCourse(page, courseTitles[3]);
  const dialogPromise = page.waitForEvent("dialog").then(async dialog => {
    const message = dialog.message();
    await dialog.accept();
    assert.match(message, /3 cursos por mês/i);
  });
  await Promise.all([page.getByRole("button", { name: "Inscrever-se", exact: true }).click(), dialogPromise]);
  assert.deepEqual((await storedProfile(page)).enrolledCourseIds.toSorted((a, b) => a - b), [1, 2, 3]);
  await openCourse(page, courseTitles[2]);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Desinscrever-se", exact: true }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await openCourse(page, courseTitles[3]);
  const afterCancellation = page.waitForEvent("dialog").then(async dialog => {
    const message = dialog.message();
    await dialog.accept();
    assert.match(message, /3 cursos por mês/i);
  });
  await Promise.all([page.getByRole("button", { name: "Inscrever-se", exact: true }).click(), afterCancellation]);
  assert.deepEqual((await storedProfile(page)).enrolledCourseIds.toSorted((a, b) => a - b), [1, 2]);
});

test("inscrição direta: falha permite nova tentativa, repetição não duplica e outro navegador precisa autenticar", async page => {
  await seedProfile(page, profileFixture());
  await openCourse(page, courseTitles[0]);
  await page.getByRole('button', { name: 'Inscrever-se', exact: true }).click();
  let fail = true;
  await page.route('**/api/enrollments', async route => {
    if (route.request().postDataJSON()?.action === 'enroll' && fail) {
      fail = false;
      return route.fulfill({ status: 503, json: { error: 'Não foi possível concluir a inscrição. Tente novamente.' } });
    }
    return route.continue();
  });
  await page.getByRole('button', { name: 'Confirmar minha inscrição', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: /Não foi possível concluir/ }).waitFor();
  assert.deepEqual((await storedProfile(page)).enrolledCourseIds, []);
  assert.equal(environment.confirmedEnrollments(1000).length, 0);
  await page.getByRole('button', { name: 'Confirmar minha inscrição', exact: true }).click();
  await waitForDirectEnrollment(page);
  const profile = await storedProfile(page);
  const again = await page.request.post(`${environment.apiURL}/api/enrollments`, { headers: { 'x-profile-token': profile.profileToken }, data: { action: 'enroll', registrationId: profile.id, courseId: 1 } });
  assert.equal(again.status(), 200);
  assert.equal(environment.confirmedEnrollments(1000).length, 1);
  const anonymous = await page.request.post(`${environment.apiURL}/api/enrollments`, { data: { action: 'enroll', registrationId: profile.id, courseId: 2, email: profile.email } });
  assert.equal(anonymous.status(), 401);
  const oldLink = await page.request.post(`${environment.apiURL}/api/enrollments`, { data: { action: 'confirm', token: 'a'.repeat(64) } });
  assert.equal(oldLink.status(), 410);
}, { enrollmentFailures: true });

test("inscrição: desistência encerrada permanece inscrita", async page => {
  const profile = profileFixture();
  const enrolledAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const unsubscribeDeadline = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  profile.enrolledCourseIds = [1];
  profile.enrollments = [{ courseId: 1, enrolledAt, unsubscribeDeadline }];
  await seedProfile(page, profile);
  await openCourse(page, courseTitles[0]);
  assert(await page.getByRole("button", { name: "Prazo de desistência encerrado", exact: true }).isDisabled());
  assert.deepEqual((await storedProfile(page)).enrolledCourseIds, [1]);
});

test("depoimentos: formulário obrigatório e publicação pela API real", async (page, environment) => {
  await page.getByRole("button", { name: "Compartilhar minha história", exact: true }).click();
  await page.getByRole("heading", { name: "Como o curso mudou sua vida?", exact: true }).waitFor();
  const form = page.locator("form").filter({ has: page.getByPlaceholder("Ex.: João Silva") });
  assert.equal(await form.evaluate(el => el.checkValidity()), false);
  await page.getByPlaceholder("Ex.: João Silva").fill("Pessoa Depoimento Teste");
  await page.getByPlaceholder("Ex.: Auxiliar administrativo").fill("Aluno");
  await page.getByPlaceholder("Ex.: Introdução à Programação").fill(courseTitles[0]);
  await form.locator("textarea").fill("Aprendi lógica e pratiquei a criação de pequenos programas.");
  const [published] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/testimonials") && response.request().method() === "POST"),
    form.getByRole("button", { name: "Publicar depoimento", exact: true }).click(),
  ]);
  assert.equal(published.status(), 201);
  await page.getByText(/Depoimento enviado com sucesso/i).waitFor();
  await page.reload({ waitUntil: "domcontentloaded" });
  const response = await page.request.get(`${process.env.TEST_URL ? environment.apiURL : environment.baseURL}/api/testimonials`);
  assert((await response.json()).some(item => item.name === "Pessoa Depoimento Teste"));
});

test("assistente: pedidos abrem cadastro e ficha de Excel sem cliques adicionais", async page => {
  let writes = 0;
  page.on("request", request => { if (request.method() === "POST") writes++; });
  await openAssistant(page);
  const input = page.getByRole("textbox", { name: "Sua dúvida ou busca", exact: true });
  await input.fill("Quero fazer minha inscrição na plataforma");
  await input.press("Enter");
  await page.getByRole("dialog", { name: "Tortuguita", exact: true }).waitFor({ state: "hidden" });
  await page.getByRole("heading", { name: "Dados Pessoais", exact: true }).waitFor();
  await openAssistant(page);
  assert.match(await page.getByRole("log").innerText(), /Quero fazer minha inscrição na plataforma/);
  await input.fill("Quero informações sobre o curso de Excel");
  await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
  await page.getByRole("dialog", { name: "Tortuguita", exact: true }).waitFor({ state: "hidden" });
  await page.locator("main").getByRole("heading", { name: courseTitles[1], exact: true }).waitFor();
  assert.equal(writes, 0, "Navigation must not create registrations or enrollments");
  await openAssistant(page);
  assert.match(await askAssistant(page, "E quanto tempo dura?"), /2 meses/);
  assert(await page.getByRole("dialog", { name: "Tortuguita", exact: true }).isVisible(), "Follow-up on the current course stays open");
  await input.fill("Quero informações sobre Excel");
  await input.press("Enter");
  await page.getByRole("log").locator("p").last().filter({ hasText: /Excel do Básico ao Avançado/ }).waitFor();
  assert(await page.getByRole("dialog", { name: "Tortuguita", exact: true }).isVisible(), "Requesting the already open course keeps the chat open");
});

test("assistente: pedidos abrem favoritos, atendimento e perfil existente", async page => {
  await seedProfile(page, profileFixture());
  for (const [message, heading] of [["Quero ver meus favoritos", /Cursos favoritados/i], ["Quero falar com o atendimento", /Entre em contato/i], ["Quero me cadastrar", /^Meu perfil$/i]]) {
    await openAssistant(page);
    await page.getByRole("textbox", { name: "Sua dúvida ou busca", exact: true }).fill(message);
    await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
    await page.getByRole("dialog", { name: "Tortuguita", exact: true }).waitFor({ state: "hidden" });
    await page.locator("main").getByRole("heading", { name: heading }).waitFor();
  }
  assert.deepEqual((await storedProfile(page)).enrolledCourseIds, []);
});

test("assistente: negações e cursos ambíguos aguardam escolha no chat", async page => {
  await openAssistant(page);
  for (const message of ["Não quero me cadastrar", "Compare Excel e Marketing Digital", "Quero informações sobre Excel ou Marketing Digital"]) {
    await askAssistant(page, message);
    assert(await page.getByRole("dialog", { name: "Tortuguita", exact: true }).isVisible());
  }
  await page.getByRole("button", { name: "Fechar assistente virtual", exact: true }).click();
  await page.getByRole("heading", { name: /Encontre oportunidades/i }).waitFor();
});

test("assistente: memória retoma conversa e curso após fechar a aba", async (page, environment) => {
  await seedProfile(page, profileFixture());
  await openAssistant(page);
  await askAssistant(page, "Me conte sobre Excel");
  assert.match(await askAssistant(page, "Já concluí Excel"), /Anotei.*Excel/s);
  const context = page.context();
  await page.close();
  const reopened = await context.newPage();
  reopened.setDefaultTimeout(8000);
  const errors = [];
  reopened.on("pageerror", error => errors.push(error.message));
  await reopened.goto(environment.baseURL);
  await openAssistant(reopened);
  assert.match(await reopened.getByRole("log").innerText(), /Me conte sobre Excel.*Já concluí Excel/s);
  assert.match(await askAssistant(reopened, "E quanto tempo dura?"), /2 meses/);
  assert.match(await askAssistant(reopened, "Quais cursos mais procurei?"), /Excel.*perguntas.*visitas/s);
  assert.match(await askAssistant(reopened, "Quais cursos já concluí?"), /Excel.*não comprovam certificação/s);
  assert.deepEqual((await storedProfile(reopened)).enrolledCourseIds, []);
  assert.deepEqual(errors, []);
});

test("assistente: recomendações usam preferências salvas e excluem inscritos e conclusões", async page => {
  const profile = profileFixture();
  profile.enrolledCourseIds = [1];
  await seedProfile(page, profile);
  await openAssistant(page);
  await askAssistant(page, "Quero cursos online de tecnologia");
  await askAssistant(page, "Já concluí Excel");
  await page.reload({ waitUntil: "domcontentloaded" });
  await openAssistant(page);
  const recommendation = await askAssistant(page, "Recomende um curso para mim");
  assert.match(recommendation, /Desenvolvimento Web Completo/);
  assert.doesNotMatch(recommendation, /Excel do Básico|Introdução à Programação|Gestão de Projetos|Informática para o Mercado/);
  assert.match(recommendation, /inscritos.*conclusões/s);
  const memory = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), `${MEMORY_KEY}${profile.id}`);
  assert.equal(memory.context.preferences.modality, "Online");
  assert.equal(memory.context.preferences.category, "Tecnologia");
  assert.deepEqual(memory.completedCourseIds, [2]);
});

test("assistente: sair e alternar perfis não mistura conversas", async page => {
  await seedProfile(page, profileFixture());
  await openAssistant(page);
  await askAssistant(page, "Me conte sobre Excel");
  await page.getByRole("button", { name: "Fechar assistente virtual", exact: true }).click();
  await openProfile(page);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Sair da plataforma", exact: true }).click();
  await openAssistant(page);
  assert.doesNotMatch(await page.getByRole("log").innerText(), /Me conte sobre Excel/);
  assert.equal(await page.getByText("Sua memória com a Tortuguita", { exact: true }).count(), 0);
  await seedProfile(page, { ...profileFixture(), id: 1001, nome: "Outro Perfil", email: "other@example.test" });
  await openAssistant(page);
  assert.doesNotMatch(await page.getByRole("log").innerText(), /Me conte sobre Excel/);
  await askAssistant(page, "Me conte sobre Introdução à Programação");
  await seedProfile(page, profileFixture());
  await openAssistant(page);
  const history = await page.getByRole("log").innerText();
  assert.match(history, /Me conte sobre Excel/);
  assert.doesNotMatch(history, /Me conte sobre Introdução à Programação/);
});

test("assistente: reiniciar mantém interesses e apagar memória remove somente dados do chat", async page => {
  const profile = profileFixture();
  profile.enrolledCourseIds = [1];
  await seedProfile(page, profile);
  await openAssistant(page);
  await askAssistant(page, "Já concluí Excel");
  await askAssistant(page, "Me conte sobre Excel");
  await page.getByRole("button", { name: "Reiniciar conversa", exact: true }).click();
  assert.equal(await page.getByRole("log").locator("p").count(), 1);
  assert.match(await askAssistant(page, "Quais cursos já concluí?"), /Excel/);
  assert.match(await askAssistant(page, "Quais cursos mais procurei?"), /Excel/);
  await page.getByText("Sua memória com a Tortuguita", { exact: true }).click();
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Apagar minha memória", exact: true }).click();
  assert(await page.evaluate(key => localStorage.getItem(key) !== null, `${MEMORY_KEY}${profile.id}`));
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Apagar minha memória", exact: true }).click();
  await page.getByRole("status").filter({ hasText: /Memória deste perfil apagada/ }).waitFor();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), `${MEMORY_KEY}${profile.id}`), null);
  assert.deepEqual((await storedProfile(page)).enrolledCourseIds, [1]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await openAssistant(page);
  assert.equal(await page.getByRole("log").locator("p").count(), 1);
  assert.match(await askAssistant(page, "Quais cursos já concluí?"), /ainda não informou/);
});

test("assistente: memória corrompida recupera e gravação bloqueada avisa sem perder a sessão", async page => {
  const profile = profileFixture();
  await page.evaluate(key => localStorage.setItem(key, '{invalid'), `${MEMORY_KEY}${profile.id}`);
  await seedProfile(page, profile);
  await openAssistant(page);
  assert.equal(await page.getByRole("log").locator("p").count(), 1);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("qualificavix-tortuguita-memory:")) throw new DOMException("Quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await askAssistant(page, "Já concluí Excel");
  await page.getByRole("status").filter({ hasText: /não permitiu salvar sua memória/ }).waitFor();
  assert.match(await askAssistant(page, "Quais cursos já concluí?"), /Excel/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Sua memória com a Tortuguita", { exact: true }).click();
  assert(await page.getByRole("textbox", { name: "Sua dúvida ou busca" }).isVisible());
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
});

test("assistente: visitantes não guardam conversas entre recarregamentos", async page => {
  await openAssistant(page);
  await askAssistant(page, "Me conte sobre Excel");
  assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("qualificavix-tortuguita-memory:")).length), 0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await openAssistant(page);
  assert.equal(await page.getByRole("log").locator("p").count(), 1);
  assert.match(await askAssistant(page, "Quais cursos mais procurei?"), /crie um perfil/);
});

test("assistente: resposta às mensagens de categoria e limite mensal", async page => {
  await openAssistant(page);
  const courses = await askAssistant(page, "Quero cursos de tecnologia");
  for (const title of [courseTitles[0], courseTitles[4], courseTitles[6]]) assert(courses.includes(title));
  assert.match(await askAssistant(page, "Qual o limite de cursos?"), /3.*(?:inscriç|cursos).*mês/is);
  assert.match(await askAssistant(page, "Como entro em contato?"), /Contato.*https:\/\/www\.vitoria\.es\.gov\.br\//is);
});

test("assistente: contexto do curso, duração e ação real para abrir ficha", async page => {
  await openAssistant(page);
  assert.match(await askAssistant(page, "Me conte sobre Excel"), /Excel do Básico ao Avançado/);
  assert.match(await askAssistant(page, "E quanto tempo dura?"), /2 meses/);
  const log = page.getByRole("log", { name: "Conversa com a Tortuguita" });
  await log.getByRole("button", { name: /Excel do Básico ao Avançado/i }).last().click();
  await page.locator("main").getByRole("heading", { name: courseTitles[1], exact: true }).waitFor();
  await openAssistant(page);
  assert.match(await log.innerText(), /E quanto tempo dura/);
  assert.match(await askAssistant(page, "O que vou aprender nele?"), /tabelas dinâmicas|planilhas|fórmulas/i);
});

test("assistente: ficha manual sincroniza contexto e respeita seleção posterior na conversa", async page => {
  await openCourse(page, courseTitles[0]);
  await openAssistant(page);
  const reply = await askAssistant(page, "Quanto tempo dura?");
  assert.match(reply, /4 meses/);
  assert.match(reply, /120\s*(?:h|horas)/i);
  await askAssistant(page, "Me conte sobre Excel");
  await page.getByRole("button", { name: "Fechar assistente virtual", exact: true }).click();
  await openCourse(page, courseTitles[4]);
  await openAssistant(page);
  assert.match(await askAssistant(page, "Quanto tempo dura?"), /5 meses/);
  await askAssistant(page, "Me conte sobre Excel");
  assert.match(await askAssistant(page, "E quanto tempo dura?"), /2 meses/);
});

test("assistente: comparação e recomendação respeitam catálogo e preferências", async page => {
  await openAssistant(page);
  const comparison = await askAssistant(page, "Compare Excel com Introdução à Programação");
  assert.match(comparison, /Excel do Básico ao Avançado/);
  assert.match(comparison, /Introdução à Programação/);
  assert.match(comparison, /60\s*(?:h|horas)/i);
  assert.match(comparison, /120\s*(?:h|horas)/i);
  await page.getByRole("button", { name: "Reiniciar conversa", exact: true }).click();
  const recommendation = await askAssistant(page, "Quero tecnologia, mas não presencial");
  assert.match(recommendation, /Introdução à Programação/);
  assert.match(recommendation, /Desenvolvimento Web Completo/);
  assert.doesNotMatch(recommendation, /Informática para o Mercado/);
});

test("assistente: orienta cadastro e mantém conversa sem enviar formulário", async page => {
  let posts = 0;
  page.on("request", request => {
    if (request.url().endsWith("/api/registrations") && request.method() === "POST") posts++;
  });
  await openAssistant(page);
  assert.match(await askAssistant(page, "Como faço meu cadastro?"), /cadastro|cadastrar/i);
  const log = page.getByRole("log", { name: "Conversa com a Tortuguita" });
  await log.getByRole("button", { name: /cadastr/i }).last().click();
  await page.getByRole("heading", { name: "Dados Pessoais", exact: true }).waitFor();
  await openAssistant(page);
  assert.match(await log.innerText(), /Como faço meu cadastro/);
  assert.match(await askAssistant(page, "Quais documentos preciso para o cadastro?"), /CPF/i);
  assert.equal(posts, 0, "Chat actions and Enter must not submit the registration form");
});

test("assistente: ação para perfil e histórico local sem expor dados pessoais", async page => {
  const profile = profileFixture();
  profile.enrolledCourseIds = [2];
  profile.enrollments = [{ courseId: 2, enrolledAt: new Date().toISOString() }];
  await seedProfile(page, profile);
  await openAssistant(page);
  const reply = await askAssistant(page, "Quais são meus cursos inscritos?");
  assert.match(reply, /Excel do Básico ao Avançado/);
  assert.doesNotMatch(reply, /browser@example\.test|27999999999/);
  await page.getByRole("log").getByRole("button", { name: /perfil/i }).last().click();
  await page.getByRole("heading", { name: "Meu perfil", exact: true }).waitFor();
  await openAssistant(page);
  assert.match(await page.getByRole("log").innerText(), /Quais são meus cursos inscritos/);
});

test("assistente: reinicia contexto, limita texto e trata HTML como texto", async page => {
  await openAssistant(page);
  await askAssistant(page, "Me fale sobre Excel");
  await page.getByRole("button", { name: "Fechar assistente virtual", exact: true }).click();
  await navigate(page, "Início");
  await openAssistant(page);
  await page.getByRole("button", { name: "Reiniciar conversa", exact: true }).click();
  const log = page.getByRole("log", { name: "Conversa com a Tortuguita" });
  assert.equal(await log.locator("p").count(), 1);
  const reply = await askAssistant(page, "Quanto tempo dura?");
  assert.match(reply, /qual|nome|escolh/i);
  assert.doesNotMatch(reply, /Excel do Básico ao Avançado/);
  const input = page.getByRole("textbox", { name: "Sua dúvida ou busca", exact: true });
  await input.fill("a".repeat(1200));
  assert.equal((await input.inputValue()).length, 1000);
  await askAssistant(page, "<img src=x onerror=alert('chat-xss')>");
  assert.equal(await log.locator("img").count(), 0);
  assert.match(await log.innerText(), /<img src=x/);
});

test("assistente no celular: teclado, sugestões, foco e largura", async page => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAssistant(page);
  const input = page.getByRole("textbox", { name: "Sua dúvida ou busca", exact: true });
  assert(await input.evaluate(el => el === document.activeElement));
  await input.fill("Quero cursos");
  await input.press("Shift+Enter");
  assert.match(await input.inputValue(), /\n/);
  assert.equal(await page.getByRole("log").locator("p").count(), 1);
  await input.fill("exc");
  await page.getByLabel("Perguntas sugeridas", { exact: true }).getByRole("button", { name: /Excel/i }).first().click();
  await page.getByRole("dialog", { name: "Tortuguita", exact: true }).waitFor({ state: "hidden" });
  await page.locator("main").getByRole("heading", { name: courseTitles[1], exact: true }).waitFor();
  await openAssistant(page);
  await page.getByRole("log").getByText(/Excel do Básico ao Avançado/).last().waitFor();
  const dialog = page.getByRole("dialog", { name: "Tortuguita", exact: true });
  const bounds = await dialog.boundingBox();
  assert(bounds.x >= 0 && bounds.x + bounds.width <= 391, "Chat must fit a mobile viewport");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await input.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert(await page.getByRole("button", { name: "Abrir assistente virtual", exact: true }).evaluate(el => el === document.activeElement));
});

test("responsividade: menu e catálogo no celular", async page => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page.getByRole("dialog", { name: "Menu", exact: true }).getByRole("button", { name: "Cursos", exact: true }).click();
  await page.getByRole("heading", { name: /Encontre o curso ideal/i }).waitFor();
  await expectCourses(page, courseTitles);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Layout ultrapassa largura da tela");
});

test("políticas: termos, privacidade e dados pessoais abrem e fecham", async page => {
  const cases = [
    ["Termos de Uso", "Termos de uso", /três inscrições por mês/i],
    ["Política de Privacidade", "Política de privacidade", /não exclui automaticamente o cadastro/i],
    ["LGPD", "Informações sobre dados pessoais", /responsável pela operação da plataforma/i],
  ];
  for (const [label, title, content] of cases) {
    await page.locator("footer").getByRole("button", { name: label, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("heading", { name: title, exact: true }).waitFor();
    await dialog.getByText(content).waitFor();
    await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
  }
});

test("armazenamento inválido: página, catálogo e preferências continuam funcionando", async page => {
  await page.evaluate(({ profileKey, favoritesKey }) => {
    localStorage.setItem(profileKey, '{"id":1,"enrolledCourseIds":"inválido","enrollments":"inválido"}');
    localStorage.setItem(favoritesKey, '"inválido"');
    localStorage.setItem("qualificavix-font-scale", "NaN");
  }, { profileKey: PROFILE_KEY, favoritesKey: FAVORITES_KEY });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /Encontre oportunidades/i }).waitFor();
  await catalog(page);
  await expectCourses(page, courseTitles);
  await page.getByRole("button", { name: "Aumentar zoom" }).first().click();
  assert.equal(await page.locator("html").evaluate(el => el.style.fontSize), "16.8px");
});

test("armazenamento bloqueado: catálogo, busca, favoritos e preferências", async page => {
  await catalog(page);
  await page.getByRole("button", { name: `Adicionar ${courseTitles[0]} aos favoritos`, exact: true }).click();
  await navigate(page, "Favoritos");
  await expectCourses(page, [courseTitles[0]]);
  await page.getByRole("button", { name: "Ativar modo escuro" }).first().click();
  assert(await page.locator("html").evaluate(el => el.classList.contains("qualificavix-dark")));
  await page.locator("header button:has(svg.lucide-search)").click();
  const input = page.getByPlaceholder("Buscar cursos...");
  await input.fill(courseTitles[1]);
  await input.press("Enter");
  await expectCourses(page, [courseTitles[1]]);
}, { blockedStorage: true });

test("armazenamento bloqueado: cadastro genérico mantém perfil durante a sessão sem matricular curso visitado", async (page, environment) => {
  await openCourse(page, courseTitles[0]);
  await page.getByRole("button", { name: "Entrar ou cadastrar", exact: true }).first().click();
  await fillPersonalData(page, { cpf: "111.444.777-35", email: "session-browser@example.test", emailConfirm: "session-browser@example.test" });
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await fillAddress(page);
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await page.locator('[name="autorizaDados"]').check();
  await page.locator('[name="aceitaTermos"]').check();
  const [response] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/registrations") && response.request().method() === "POST"),
    page.getByRole("button", { name: "Concluir cadastro", exact: true }).click(),
  ]);
  assert.equal(response.status(), 201);
  const saved = await response.json();
  assert.equal(environment.registration(saved.id).email, "session-browser@example.test");
  await page.getByRole("heading", { name: "Cadastro realizado!", exact: true }).waitFor();
  await page.getByRole("status").filter({ hasText: /apenas enquanto esta página estiver aberta/i }).waitFor();
  await page.getByRole("button", { name: "Acessar meu perfil", exact: true }).click();
  await page.getByRole("heading", { name: "Meu perfil", exact: true }).waitFor();
  await page.getByRole("button", { name: "Cursos cadastrados (0)", exact: true }).click();
  await page.getByText("Nenhum curso cadastrado", { exact: true }).waitFor();
}, { blockedStorage: true });

test("cadastro: gravação silenciosamente bloqueada mantém perfil acessível com aviso", async (page, environment) => {
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key !== "qualificavix-profile") write.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Entrar ou cadastrar", exact: true }).click();
  await fillPersonalData(page, { cpf: "935.411.347-80", email: "silent-storage@example.test", emailConfirm: "silent-storage@example.test" });
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await fillAddress(page);
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await page.locator('[name="autorizaDados"]').check();
  await page.locator('[name="aceitaTermos"]').check();
  const [response] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/registrations") && response.request().method() === "POST"),
    page.getByRole("button", { name: "Concluir cadastro", exact: true }).click(),
  ]);
  assert.equal(response.status(), 201);
  const { id } = await response.json();
  assert.equal(environment.registration(id).email, "silent-storage@example.test");
  await page.getByRole("heading", { name: "Cadastro realizado!", exact: true }).waitFor();
  await page.getByRole("status").getByText(/apenas enquanto esta página estiver aberta/i).waitFor();
  assert.equal(await storedProfile(page), null, "Storage silently ignored the write");
  await page.getByRole("button", { name: "Acessar meu perfil", exact: true }).click();
  await page.getByRole("heading", { name: "Meu perfil", exact: true }).waitFor();
  assert.equal(await page.getByLabel("E-mail", { exact: true }).inputValue(), "silent-storage@example.test");
});

const googleSdkFixture = `
  window.google = { accounts: { id: {
    initialize(options) { window.__googleSettings = options; },
    renderButton(parent, options) {
      const button = document.createElement('button');
      button.textContent = 'Entrar com Google (provedor de teste)';
      button.style.cssText = 'min-height:44px;width:' + options.width + 'px;max-width:100%';
      button.onclick = () => window.__googleSettings.callback({ credential: 'signed-provider-fixture' });
      parent.append(button);
    },
    prompt() { window.__googlePrompts = (window.__googlePrompts || 0) + 1; },
    cancel() { window.__googleCancelled = (window.__googleCancelled || 0) + 1; }
  } } };
`;
async function mockGoogleChooser(page, script = googleSdkFixture) {
  await page.route('**/api/auth?action=config', route => route.fulfill({ json: { enabled: true, clientId: 'test.apps.googleusercontent.com' } }));
  await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({ contentType: 'application/javascript', body: script }));
  await page.route('**/api/auth?action=challenge', route => route.fulfill({ json: { nonce: 'a'.repeat(64) } }));
}
test("Google: caixa de contas, sugestões oficiais e recuperação após autenticação", async page => {
  await mockGoogleChooser(page);
  await page.route('**/api/auth?action=credential', route => {
    assert.deepEqual(route.request().postDataJSON(), { credential: 'signed-provider-fixture' });
    return route.fulfill({ json: { status: 'authenticated' } });
  });
  await page.route('**/api/auth?action=session', route => route.fulfill({ json: { profile: { ...profileFixture(), profileToken: 'a'.repeat(64) } } }));
  await page.getByRole('button', { name: 'Entrar ou cadastrar', exact: true }).first().click();
  assert.equal(await page.evaluate(() => Boolean(window.google)), false, 'Google is loaded only after the user opens sign-in');
  await page.getByRole('button', { name: 'Continuar com Google', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Entrar na sua conta' });
  await chooser.getByRole('button', { name: 'Entrar com Google (provedor de teste)' }).waitFor();
  assert.equal(await page.evaluate(() => window.__googleSettings.auto_select), false);
  assert.equal(await page.evaluate(() => window.__googleSettings.use_fedcm_for_prompt), true);
  assert.equal(await page.evaluate(() => window.__googlePrompts), 1);
  assert.equal(await chooser.getByRole('link', { name: 'Continuar com Google em outra página' }).getAttribute('href'), '/api/auth?action=start');
  await chooser.getByRole('button', { name: 'Entrar com Google (provedor de teste)' }).click();
  await page.getByRole('button', { name: 'Acessar meu perfil', exact: true }).click();
  await page.getByRole('heading', { name: 'Meu perfil', exact: true }).waitFor();
  assert.equal((await storedProfile(page)).email, profileFixture().email);
  assert.equal(new URL(page.url()).hash, '');
});

test("Google: caixa no celular, fechar restaura foco e credencial rejeitada permite nova tentativa", async page => {
  await mockGoogleChooser(page);
  await page.route('**/api/auth?action=credential', route => route.fulfill({ json: { status: 'rejected' } }));
  await page.getByRole('button', { name: 'Entrar ou cadastrar', exact: true }).first().click();
  await page.setViewportSize({ width: 320, height: 640 });
  const trigger = page.getByRole('button', { name: 'Continuar com Google', exact: true });
  await trigger.click();
  const chooser = page.getByRole('dialog', { name: 'Entrar na sua conta' });
  await chooser.getByRole('button', { name: 'Entrar com Google (provedor de teste)' }).waitFor();
  const bounds = await chooser.boundingBox();
  assert(bounds.x >= 0 && bounds.x + bounds.width <= 321);
  assert(bounds.height <= 640);
  await chooser.getByRole('button', { name: 'Fechar', exact: true }).click();
  assert(await trigger.evaluate(element => element === document.activeElement));
  assert.equal(await page.evaluate(() => window.__googleCancelled), 1);
  await trigger.click();
  await chooser.getByRole('button', { name: 'Entrar com Google (provedor de teste)' }).click();
  await chooser.getByRole('alert').filter({ hasText: 'A plataforma não confirmou seu acesso.' }).waitFor();
  assert.equal(await storedProfile(page), null);
  await chooser.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await chooser.getByRole('button', { name: 'Entrar com Google (provedor de teste)' }).waitFor();
  await page.keyboard.press('Escape');
  assert(await trigger.evaluate(element => element === document.activeElement));
});

test("Google: falha no SDK oferece alternativa e permite recarregar", async page => {
  await mockGoogleChooser(page, '/* Provider unavailable in this isolated test. */');
  await page.getByRole('button', { name: 'Entrar ou cadastrar', exact: true }).first().click();
  await page.getByRole('button', { name: 'Continuar com Google', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Entrar na sua conta' });
  await chooser.getByRole('alert').filter({ hasText: 'Não foi possível carregar a entrada do Google.' }).waitFor();
  await chooser.getByRole('link', { name: 'Continuar com Google em outra página' }).waitFor();
  await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({ contentType: 'application/javascript', body: googleSdkFixture }));
  await chooser.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await chooser.getByRole('button', { name: 'Entrar com Google (provedor de teste)' }).waitFor();
});

test("Google: novo usuário completa cadastro verificado e se inscreve no curso sem e-mail", async (page, environment) => {
  const identity = { nome: 'Pessoa Google Nova', email: 'new-google-signup@gmail.com', subject: 'browser-google-signup' };
  const token = environment.seedGoogleSignup(identity);
  await mockGoogleChooser(page);
  await page.route('**/api/auth?action=credential', route => route.fulfill({ headers: { 'set-cookie': `qv_signup=${token}; Path=/; HttpOnly; SameSite=Lax` }, json: { status: 'registration-required' } }));
  await openCourse(page, courseTitles[0]);
  await page.getByRole('button', { name: 'Inscrever-se', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar com Google', exact: true }).click();
  await page.getByRole('dialog', { name: 'Entrar na sua conta' }).getByRole('button', { name: 'Entrar com Google (provedor de teste)' }).click();
  await page.getByRole('button', { name: 'Completar meu cadastro', exact: true }).click();
  await page.getByRole('status').filter({ hasText: `Conta Google confirmada: ${identity.email}` }).waitFor();
  assert.equal((await storedProfile(page)), null, 'Identity alone must not create an incomplete profile');
  assert.equal(await page.locator('[name="email"]').isEditable(), false);
  assert.equal(await page.locator('[name="nome"]').inputValue(), identity.nome);
  assert.equal(await page.locator('[name="emailConfirm"]').count(), 0);
  const tampered = await page.request.post(`${environment.baseURL}/api/registrations`, { data: { googleSignup: true, email: 'other-account@gmail.com' } });
  assert.equal(tampered.status(), 400);
  assert.equal(environment.googleIdentity(identity.subject), undefined);
  await fillPersonalData(page, { nome: identity.nome, cpf: '987.654.321-00', email: identity.email, emailConfirm: identity.email });
  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await fillAddress(page);
  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await page.locator('[name="autorizaDados"]').check();
  await page.locator('[name="aceitaTermos"]').check();
  const [response] = await Promise.all([
    page.waitForResponse(result => result.url().endsWith('/api/registrations') && result.request().method() === 'POST'),
    page.getByRole('button', { name: 'Concluir cadastro', exact: true }).click(),
  ]);
  assert.equal(response.status(), 201, await response.text());
  await waitForDirectEnrollment(page);
  const profile = await storedProfile(page);
  assert.equal(profile.email, identity.email);
  assert.equal(environment.googleIdentity(identity.subject).registration_id, profile.id);
  assert.equal(environment.confirmedEnrollments(profile.id).length, 1);
  assert(!(await page.context().cookies()).some(cookie => cookie.name === 'qv_signup'));
  const replay = await page.request.post(`${environment.baseURL}/api/registrations`, { headers: { Cookie: `qv_signup=${token}` }, data: { googleSignup: true, email: identity.email } });
  assert.equal(replay.status(), 401, 'Consumed signup confirmation cannot create another profile');
  const session = await page.request.get(`${environment.baseURL}/api/auth?action=session`);
  assert.equal(session.status(), 200);
  assert.equal((await session.json()).profile.id, profile.id);
  await page.getByRole('button', { name: 'Acessar meu perfil', exact: true }).click();
  await page.getByRole('heading', { name: 'Meu perfil', exact: true }).waitFor();
});

const environment = await startTestEnvironment();
let browser;
try {
  browser = await chromium.launch({ executablePath: findBrowserExecutable(), headless: true });
  console.log(`TEST_URL\t${environment.baseURL}`);
  console.log("TEST_ISOLATION\tAPI real, SQLite temporário, ViaCEP e e-mail locais; dados locais preservados");
  for (const item of tests) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, baseURL: environment.baseURL, reducedMotion: "reduce" });
    const errors = [];
    try {
      await environment.prepareContext(context);
      if (item.options.blockedStorage) {
        await context.addInitScript(() => {
          for (const name of ["localStorage", "sessionStorage"]) {
            Object.defineProperty(window, name, { configurable: true, get() { throw new DOMException("Armazenamento bloqueado", "SecurityError"); } });
          }
        });
      }
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      page.setDefaultNavigationTimeout(15000);
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => {
        if (message.type() !== "error") return;
        const url = message.location().url;
        if (item.options.enrollmentFailures && url.includes("/api/enrollments") && /Failed to load resource/.test(message.text())) return;
        if (item.options.registrationFailures && url.includes("/api/registrations") && /Failed to load resource/.test(message.text())) return;
        if (isOptionalResource(url) && /Failed to load resource/.test(message.text())) optionalResources.add(`${message.text()} ${url}`);
        else errors.push(message.text());
      });
      page.on("response", response => {
        if (response.status() < 400) return;
        if (item.options.enrollmentFailures && new URL(response.url()).pathname === "/api/enrollments" && response.status() === 503) return;
        if (item.options.registrationFailures && new URL(response.url()).pathname === "/api/registrations" && [409, 500, 503].includes(response.status())) return;
        if (isOptionalResource(response.url())) optionalResources.add(`${response.status()} ${response.url()}`);
        else errors.push(`HTTP ${response.status()} ${response.url()}`);
      });
      page.on("requestfailed", request => {
        const detail = `${request.failure()?.errorText} ${request.url()}`;
        if (isOptionalResource(request.url())) optionalResources.add(detail);
        else if (request.failure()?.errorText !== "net::ERR_ABORTED") errors.push(detail);
      });
      const response = await page.goto(environment.baseURL, { waitUntil: "domcontentloaded" });
      assert.equal(response?.status(), 200);
      await page.getByRole("heading", { name: /Encontre oportunidades/i }).waitFor();
      await item.run(page, environment);
      assert.deepEqual(errors, [], "Erros inesperados de JavaScript/recursos locais");
      item.status = "PASS";
    } catch (error) {
      item.status = "FAIL";
      item.error = `${error.message}${errors.length ? `; BROWSER_ERRORS: ${errors.join(" | ")}` : ""}`;
    } finally {
      await context.close();
    }
    console.log(`${item.status}\t${item.name}${item.error ? `\t${item.error}` : ""}`);
  }
} finally {
  if (browser) await browser.close();
  await environment.cleanup();
}
for (const resource of optionalResources) console.log(`OPTIONAL_EXTERNAL_RESOURCE\t${resource}`);
const passed = tests.filter(item => item.status === "PASS").length;
console.log(`RESULT\t${passed}/${tests.length} verificações aprovadas`);
if (passed !== tests.length) process.exitCode = 1;
