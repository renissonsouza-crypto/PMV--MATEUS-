import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright-core';
import { findBrowserExecutable, startTestEnvironment } from './e2e-support.mjs';

// Device emulation exercises touch layouts and viewport changes in Chromium.
// It does not substitute for Safari or a physical iPhone/Android device.
const targets = [
  { name: 'iPhone SE', ...devices['iPhone SE'] },
  { name: 'iPhone 13', ...devices['iPhone 13'] },
  { name: 'Pixel 7', ...devices['Pixel 7'] },
  { name: 'small phone', viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true },
  { name: 'landscape', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
  { name: 'tablet', viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true },
];
const environment = await startTestEnvironment();
const browser = await chromium.launch({ executablePath: findBrowserExecutable(), headless: true });
let passed = 0;
const withinScreen = async (page, locator) => {
  const bounds = await locator.boundingBox();
  assert(bounds && bounds.width > 0, 'Control must be visible');
  const width = await page.evaluate(() => innerWidth);
  assert(bounds.x >= -1 && bounds.x + bounds.width <= width + 1, 'Control extends past screen edge');
};
const noOverflow = async page => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Page has horizontal overflow');
const navigate = async (page, name) => {
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Menu', exact: true });
  await menu.getByRole('button', { name, exact: true }).first().click();
  await menu.waitFor({ state: 'hidden' });
};
try {
  for (const { name, ...device } of targets) {
    const context = await browser.newContext({ ...device, reducedMotion: 'reduce' });
    try {
      await environment.prepareContext(context);
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      await page.goto(environment.baseURL, { waitUntil: 'domcontentloaded' });
      await noOverflow(page);
      await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
      const menu = page.getByRole('dialog', { name: 'Menu', exact: true });
      assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).overflow), 'hidden', 'Menu must lock background scrolling');
      for (let i = 0; i < 5; i++) await menu.getByRole('button', { name: 'Aumentar tamanho da fonte', exact: true }).click();
      await menu.getByRole('button', { name: 'Ativar modo escuro', exact: true }).click();
      await menu.getByRole('button', { name: 'Fechar menu', exact: true }).click();
      assert(await page.getByRole('button', { name: 'Abrir menu', exact: true }).evaluate(el => el === document.activeElement), 'Closing menu must restore focus');
      await page.getByRole('button', { name: 'Buscar cursos', exact: true }).click();
      const search = page.getByRole('searchbox', { name: 'Buscar cursos no site', exact: true });
      await withinScreen(page, search);
      await search.press('Escape');
      assert(await page.getByRole('button', { name: 'Buscar cursos', exact: true }).evaluate(el => el === document.activeElement), 'Closing search must restore focus');
      await page.getByRole('button', { name: 'Buscar cursos', exact: true }).click();
      await search.fill('Excel');
      await search.press('Enter');
      await page.getByRole('heading', { name: /Encontre o curso ideal/ }).waitFor();
      assert.equal(await page.locator('main article').count(), 1);
      await withinScreen(page, page.getByRole('combobox', { name: 'Categoria', exact: true }));
      await noOverflow(page);
      await page.locator('main article').getByRole('button', { name: /Ver curso/ }).click();
      for (const tab of ['Sobre o curso', 'Conteúdo programático', 'Instrutor', 'Requisitos', 'Certificado', 'Instituição']) {
        const button = page.getByRole('button', { name: tab, exact: true });
        await button.scrollIntoViewIfNeeded();
        await button.click();
        assert.equal(await button.getAttribute('aria-pressed'), 'true');
        await noOverflow(page);
      }
      await navigate(page, 'Categorias');
      await noOverflow(page);
      await navigate(page, 'Sobre');
      await noOverflow(page);
      await navigate(page, 'Contato');
      await noOverflow(page);
      await navigate(page, 'Meu perfil');
      const next = page.getByRole('button', { name: 'Próximo', exact: true });
      const back = page.getByRole('button', { name: 'Voltar ao site', exact: true });
      await next.scrollIntoViewIfNeeded();
      await withinScreen(page, next);
      await withinScreen(page, back);
      await noOverflow(page);
      const phone = page.locator('[name="telefone"]');
      assert.equal(await phone.getAttribute('inputmode'), 'tel');
      assert(await phone.evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16), 'Mobile inputs must avoid iOS focus zoom');
      if (name === 'iPhone 13') {
        for (const [field, value] of Object.entries({ nome: 'Pessoa Mobile', cpf: '529.982.247-25', dataNascimento: '01011990', telefone: '27999999999', email: 'mobile@example.test', emailConfirm: 'mobile@example.test' })) {
          await page.locator(`[name="${field}"]`).fill(value);
        }
        await page.locator('[name="sexo"]').selectOption('Prefiro não informar');
        await page.locator('[name="escolaridade"]').selectOption('Ensino médio completo');
        await page.locator('[name="situacaoEmprego"]').selectOption('Desempregado');
        await next.click();
        const addressTitle = page.getByRole('heading', { name: 'Endereço de Moradia', exact: true });
        await addressTitle.waitFor();
        assert(await addressTitle.evaluate(el => el === document.activeElement), 'New form step must receive focus');
        const titleBounds = await addressTitle.boundingBox();
        assert(titleBounds.y >= 0 && titleBounds.y < 300, 'New form step must scroll into view');
        await page.locator('[name="cep"]').fill('29050-945');
        await page.locator('[name="cep"]').blur();
        await page.waitForFunction(() => document.querySelector('[name="bairro"]').value === 'Bento Ferreira');
        assert.equal(await page.locator('[name="numero"]').inputValue(), '');
        await next.click();
        await next.click();
        const finish = page.getByRole('button', { name: 'Concluir cadastro', exact: true });
        await finish.scrollIntoViewIfNeeded();
        await withinScreen(page, finish);
        await page.locator('[name="autorizaDados"]').check();
        await page.locator('[name="aceitaTermos"]').check();
        const [response] = await Promise.all([
          page.waitForResponse(r => r.url().endsWith('/api/registrations') && r.request().method() === 'POST'),
          finish.click(),
        ]);
        assert.equal(response.status(), 201);
        const saved = await response.json();
        assert.equal(environment.registration(saved.id).email, 'mobile@example.test');
        await page.getByRole('button', { name: 'Voltar ao início', exact: true }).click();
        await navigate(page, 'Meu perfil');
        await page.getByRole('heading', { name: 'Meu perfil', exact: true }).waitFor();
        await noOverflow(page);
        await page.getByRole('button', { name: 'Cursos cadastrados (0)', exact: true }).click();
        await page.getByText('Nenhum curso cadastrado', { exact: true }).waitFor();
        await navigate(page, 'Cursos');
        await page.locator('main article').first().getByRole('button', { name: /Ver curso/ }).click();
        await page.getByRole('button', { name: 'Inscrever-se', exact: true }).click();
        const confirm = page.getByRole('button', { name: 'Confirmar minha inscrição', exact: true });
        await confirm.scrollIntoViewIfNeeded();
        await withinScreen(page, confirm);
        await noOverflow(page);
        await confirm.click();
        await page.getByRole('status').filter({ hasText: 'Inscrição confirmada. O curso está disponível no seu perfil.' }).waitFor();
        assert.equal(environment.emails.length, 0);
        await navigate(page, 'Meu perfil');
      } else {
        await back.click();
      }
      await page.getByRole('button', { name: 'Abrir assistente virtual', exact: true }).click();
      const chat = page.getByRole('dialog', { name: 'Tortuguita', exact: true });
      await withinScreen(page, chat);
      await page.setViewportSize({ width: device.viewport.width, height: 320 });
      const input = chat.getByRole('textbox', { name: 'Sua dúvida ou busca', exact: true });
      await input.fill('Os cursos são gratuitos?');
      await page.waitForFunction(() => document.querySelector('.tortuguita-panel')?.getAttribute('data-compact') === 'true');
      const bounds = await input.boundingBox();
      assert(bounds.y >= 0 && bounds.y + bounds.height <= 320, 'Chat input must remain visible in a reduced viewport');
      await chat.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
      assert.match(await chat.getByRole('log').innerText(), /gratuit/i);
      await input.press('Escape');
      await chat.waitFor({ state: 'hidden' });
      if (name === 'tablet') {
        await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.getByRole('dialog', { name: 'Menu', exact: true }).waitFor({ state: 'hidden' });
        assert.notEqual(await page.locator('body').evaluate(el => getComputedStyle(el).overflow), 'hidden', 'Desktop breakpoint must release menu scroll lock');
        await page.locator('header').getByRole('button', { name: 'Cursos', exact: true }).waitFor();
      }
      console.log(`PASS\t${name}: navigation, search, filters, course sections, registration, zoom, dark mode, compact chat`);
      passed++;
    } catch (error) {
      console.error(`FAIL\t${name}: ${error.stack}`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); await environment.cleanup(); }
console.log(`RESULT\t${passed}/${targets.length} mobile configurations passed`);
if (passed !== targets.length) process.exitCode = 1;
