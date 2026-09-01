import { chromium } from "playwright-core";

const baseURL = process.env.TEST_URL || "http://127.0.0.1:5173";
const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const results = [];
let consoleErrors = [];
let failedResources = [];

function test(name, fn) { results.push({ name, fn }); }
function ok(value, message) { if (!value) throw new Error(message); }

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(6000);
page.setDefaultNavigationTimeout(10000);
page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
page.on("pageerror", error => consoleErrors.push(error.message));
page.on("response", response => { if (response.status() >= 400) failedResources.push(`${response.status()} ${response.url()}`); });

test("carregamento da página inicial", async () => {
  const response = await page.goto(baseURL, { waitUntil: "networkidle" });
  ok(response?.status() === 200, `HTTP ${response?.status()}`);
  await page.getByRole("heading", { name: /Encontre oportunidades/i }).waitFor();
  ok(await page.getByLabel(/Tortuguita Vix/i).count() > 0, "Mascote não renderizada");
});

test("navegação principal", async () => {
  const cases = [
    ["Cursos", /Encontre o curso ideal/i], ["Categorias", /^Categorias$/i],
    ["Sobre", /Sobre o QualificaVix/i], ["Contato", /Entre em contato/i], ["Início", /Encontre oportunidades/i]
  ];
  for (const [link, heading] of cases) {
    await page.getByRole("button", { name: link, exact: true }).first().click();
    await page.getByRole("heading", { name: heading }).first().waitFor();
  }
});

test("zoom, limites e persistência", async () => {
  const plus = page.getByRole("button", { name: "Aumentar zoom" }).first();
  const minus = page.getByRole("button", { name: "Diminuir zoom" }).first();
  await plus.click();
  ok((await page.locator("html").getAttribute("style"))?.includes("16.8px"), "Zoom não aumentou");
  for (let i = 0; i < 10; i++) await plus.click();
  ok((await page.locator("html").getAttribute("style"))?.includes("20px"), "Limite superior incorreto");
  for (let i = 0; i < 12; i++) await minus.click();
  ok((await page.locator("html").getAttribute("style"))?.includes("13.6px"), "Limite inferior incorreto");
  ok(await page.evaluate(() => localStorage.getItem("qualificavix-font-scale")) === "0.85", "Zoom não persistiu");
});

test("modo escuro e persistência", async () => {
  const theme = page.getByRole("button", { name: "Ativar modo escuro" }).first();
  await theme.click();
  ok(await page.locator("html").evaluate(el => el.classList.contains("qualificavix-dark")), "Classe escura ausente");
  ok(await page.evaluate(() => localStorage.getItem("qualificavix-dark-mode")) === "true", "Tema não persistiu");
  await page.getByRole("button", { name: "Ativar modo claro" }).first().click();
});

test("busca global do cabeçalho", async () => {
  await page.locator("header button:has(svg.lucide-search)").click();
  const input = page.getByPlaceholder("Buscar cursos...");
  await input.fill("Programação");
  await input.press("Enter");
  await page.waitForTimeout(300);
  ok(await page.getByRole("heading", { name: /Encontre o curso ideal/i }).count() > 0,
    "A busca global aceita texto, mas não executa pesquisa nem abre o catálogo");
});

test("catálogo: busca, filtros e limpeza", async () => {
  await page.getByRole("button", { name: "Cursos", exact: true }).first().click();
  const search = page.getByPlaceholder(/Buscar cursos, áreas/i);
  await search.fill("Programação");
  ok(await page.getByText("Introdução à Programação", { exact: true }).count() > 0, "Curso buscado não apareceu");
  await search.fill("curso inexistente xyz");
  await page.getByText(/Nenhum curso encontrado/i).waitFor();
  await page.getByRole("button", { name: /Limpar busca/i }).click();
  const modality = page.locator("select").nth(1);
  await modality.selectOption("Online");
  ok(await page.locator("article").count() > 0, "Filtro eliminou resultados válidos");
  await page.getByRole("button", { name: /Limpar filtros/i }).click();
  const values = await page.locator("select").evaluateAll(items => items.map(item => item.value));
  ok(values.every(value => value.endsWith("Todas")), `Filtros não foram totalmente limpos: ${values.join(", ")}`);
});

test("curso: detalhe, abas, favorito e inscrição", async () => {
  await page.getByRole("button", { name: /Ver curso/i }).first().click();
  await page.getByRole("heading", { name: /Introdução à Programação/i }).waitFor();
  for (const tab of ["Conteúdo programático", "Instrutor", "Requisitos", "Certificado", "Instituição", "Sobre o curso"])
    await page.getByRole("button", { name: tab, exact: true }).click();
  await page.getByRole("button", { name: /Inscrever-se/i }).click();
  await page.getByText(/Cadastro de usuário/i).waitFor();
});

test("cadastro: validação obrigatória e senha", async () => {
  await page.getByRole("button", { name: /Entrar \/ Cadastrar/i }).first().click();
  await page.getByRole("button", { name: /Próximo/i }).click();
  ok(await page.locator("text=/obrigat|informe|inválid/i").count() > 0, "Formulário avançou sem validar campos");
  const passwordToggle = page.getByRole("button", { name: /senha/i });
  if (await passwordToggle.count()) await passwordToggle.first().click();
});

test("depoimentos: abertura e validação do formulário", async () => {
  await page.getByRole("button", { name: "Início", exact: true }).first().click();
  const add = page.getByRole("button", { name: /Compartilhar minha história|Escrever depoimento/i });
  if (await add.count()) {
    await add.first().click();
    ok(await page.getByRole("heading", { name: /Como o curso mudou sua vida/i }).count() > 0, "Formulário de depoimento não abriu");
  }
});

test("assistente: abrir, enviar e receber resposta", async () => {
  const launcher = page.getByRole("button", { name: /Abrir assistente virtual/i });
  await launcher.click();
  const input = page.getByPlaceholder(/Digite sua mensagem/i);
  await input.fill("Quero cursos de tecnologia");
  await input.press("Enter");
  await page.waitForTimeout(1300);
  ok(await page.getByText(/tecnologia|opções/i).count() > 0, "Assistente não respondeu");
});

test("responsividade e menu móvel", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("header button.lg\\:hidden").click();
  ok(await page.getByRole("button", { name: "Cursos", exact: true }).count() > 0, "Menu móvel não abriu");
});

for (const item of results) {
  try {
    if (item.name !== "carregamento da página inicial") {
      await page.goto(baseURL, { waitUntil: "domcontentloaded" });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "networkidle" });
    }
    await item.fn(); item.status = "PASS";
  }
  catch (error) { item.status = "FAIL"; item.error = error.message; }
}

await browser.close();
for (const item of results) console.log(`${item.status}\t${item.name}${item.error ? `\t${item.error}` : ""}`);
console.log(`CONSOLE_ERRORS\t${consoleErrors.length}`);
for (const error of consoleErrors) console.log(`BROWSER_ERROR\t${error}`);
for (const resource of [...new Set(failedResources)]) console.log(`FAILED_RESOURCE\t${resource}`);
if (results.some(item => item.status === "FAIL") || consoleErrors.length) process.exitCode = 1;
