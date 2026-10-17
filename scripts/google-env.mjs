import { readFile, writeFile, rename, rm, lstat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import { googleConfiguration } from '../server/services/googleAuth.mjs';

export const googleVariables = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'APP_BASE_URL'];

export function inspectGoogleEnvironment(environment) {
  const missing = googleVariables.filter(name => !environment[name]?.trim());
  if (missing.length) return { ok: false, messages: missing.map(name => `${name}: ausente ou vazio.`) };
  try {
    const config = googleConfiguration(environment);
    return { ok: true, config: { origin: config.origin, redirectUri: config.redirectUri }, messages: ['Configuração local Google completa. Isso não valida as credenciais no Google.'] };
  } catch {
    return { ok: false, messages: ['APP_BASE_URL inválido: use somente a origem HTTPS do site ou http://localhost:5173 no desenvolvimento, sem caminho, parâmetros ou fragmento.'] };
  }
}

function isTracked(root, file) {
  try { return Boolean(execFileSync('git', ['ls-files', '--', file], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()); }
  catch { throw new Error('Não foi possível verificar a proteção do arquivo no Git. Nenhum valor foi gravado.'); }
}

export async function configureGoogleEnvironment(root, { credentials, origin }) {
  // Refuse tracked dotenv files and symlinks before handling secrets.
  if (isTracked(root, '.env')) throw new Error('O .env está versionado no Git. Remova-o do versionamento antes de gravar credenciais.');
  try {
    if (!(await lstat(join(root, '.env'))).isFile()) throw new Error('O .env deve ser um arquivo local regular.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { execFileSync('git', ['check-ignore', '-q', '--', '.env'], { cwd: root, stdio: 'ignore' }); }
  catch { throw new Error('Adicione .env ao .gitignore antes de configurar as credenciais.'); }
  let existing = '';
  try { existing = await readFile(join(root, '.env'), 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('Não foi possível ler o .env.'); }
  const values = parseEnv(existing);
  if (credentials) {
    let data;
    try { data = JSON.parse(await readFile(credentials, 'utf8')); }
    catch { throw new Error('Não foi possível ler o JSON de credenciais do Google.'); }
    const web = data?.web;
    if (typeof web?.client_id !== 'string' || !/^[\w-]+\.apps\.googleusercontent\.com$/.test(web.client_id) || typeof web.client_secret !== 'string' || !/^[\w-]+$/.test(web.client_secret)) {
      throw new Error('Use o JSON de um cliente OAuth do tipo Aplicativo da Web baixado do Google Cloud.');
    }
    values.GOOGLE_CLIENT_ID = web.client_id;
    values.GOOGLE_CLIENT_SECRET = web.client_secret;
  }
  if (origin !== undefined) values.APP_BASE_URL = origin;
  const report = inspectGoogleEnvironment(values);
  if (!report.ok) throw new Error(report.messages.join('\n'));
  // Only replace these three assignments; preserve unrelated settings and comments.
  const lines = existing.split(/\r?\n/);
  const updates = Object.fromEntries(googleVariables.map(name => [name, values[name].trim()]));
  const replaced = new Set();
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(/^\s*(?:export\s+)?(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|APP_BASE_URL)\s*=/);
    if (match) {
      // parseEnv accepts quoted values; never interpolate credentials into shell commands.
      lines[index] = `${match[1]}=${JSON.stringify(updates[match[1]])}`;
      replaced.add(match[1]);
    }
  }
  for (const [name, value] of Object.entries(updates)) if (!replaced.has(name)) lines.push(`${name}=${JSON.stringify(value)}`);
  const output = `${lines.join('\n').trimEnd()}\n`;
  // A multiline assignment could retain an old value or corrupt another setting.
  const parsed = parseEnv(output);
  for (const name of googleVariables) {
    if (parsed[name] !== values[name].trim()) throw new Error('Não foi possível atualizar o .env com segurança. Verifique as três configurações Google manualmente.');
  }
  for (const [name, value] of Object.entries(parseEnv(existing))) {
    if (!googleVariables.includes(name) && parsed[name] !== value) throw new Error('O .env contém uma configuração multilinha que precisa ser ajustada manualmente. Nenhum valor foi gravado.');
  }
  const temporary = join(root, `.env.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, output, { mode: 0o600, flag: 'wx' });
    await rename(temporary, join(root, '.env'));
  } finally { await rm(temporary, { force: true }); }
  return { origin: report.config.origin, redirectUri: report.config.redirectUri };
}
