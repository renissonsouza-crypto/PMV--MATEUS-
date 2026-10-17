import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, mkdir, copyFile, symlink, stat } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { configureGoogleEnvironment, inspectGoogleEnvironment } from '../scripts/google-env.mjs';
import { checkReusedGoogleApi } from '../scripts/dev-config.mjs';

const settings = { GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'fixture-server-secret', APP_BASE_URL: 'http://localhost:5173' };
const root = fileURLToPath(new URL('../', import.meta.url));
async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'google env '));
  try {
    execFileSync('git', ['init', '-q', directory]);
    await writeFile(join(directory, '.gitignore'), '.env\n.env.*\n');
    await run(directory);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test('Google diagnostics identify every missing field and unsafe URL without disclosing values', () => {
  assert.equal(inspectGoogleEnvironment(settings).ok, true);
  assert(!JSON.stringify(inspectGoogleEnvironment(settings)).includes(settings.GOOGLE_CLIENT_SECRET));
  assert.equal(inspectGoogleEnvironment({ ...settings, GOOGLE_CLIENT_ID: '  ', APP_BASE_URL: '' }).ok, false);
  const missing = inspectGoogleEnvironment({ GOOGLE_CLIENT_ID: settings.GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET: settings.GOOGLE_CLIENT_SECRET });
  assert.match(missing.messages.join('\n'), /APP_BASE_URL/);
  const invalid = inspectGoogleEnvironment({ ...settings, APP_BASE_URL: 'https://user:private@example.test/?secret=private' });
  assert.equal(invalid.ok, false);
  for (const message of [...missing.messages, ...invalid.messages]) assert.doesNotMatch(message, /private|fixture-server-secret|fixture.apps/);
});

test('setup repairs missing base URL, preserves unrelated dotenv values and loads from repository root', () => fixture(async directory => {
  const original = `# Local settings\nDATABASE_URL="postgresql://local/database?sslmode=require"\nGOOGLE_CLIENT_ID=${settings.GOOGLE_CLIENT_ID}\nGOOGLE_CLIENT_SECRET=${settings.GOOGLE_CLIENT_SECRET}\n`;
  await writeFile(join(directory, '.env'), original);
  await configureGoogleEnvironment(directory, { origin: settings.APP_BASE_URL });
  const updated = await readFile(join(directory, '.env'), 'utf8');
  assert.match(updated, /# Local settings/);
  assert.equal(parseEnv(updated).DATABASE_URL, parseEnv(original).DATABASE_URL);
  assert.equal(parseEnv(updated).APP_BASE_URL, settings.APP_BASE_URL);
  await mkdir(join(directory, 'server', 'config'), { recursive: true });
  await copyFile(join(root, 'server', 'config', 'environment.mjs'), join(directory, 'server', 'config', 'environment.mjs'));
  const environment = { ...process.env };
  for (const name of Object.keys(settings)) delete environment[name];
  const source = `import ${JSON.stringify(pathToFileURL(join(directory, 'server', 'config', 'environment.mjs')).href)}; import {googleConfiguration} from ${JSON.stringify(pathToFileURL(join(root, 'server', 'services', 'googleAuth.mjs')).href)}; console.log(googleConfiguration().origin);`;
  assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', source], { cwd: tmpdir(), env: environment, encoding: 'utf8' }).trim(), settings.APP_BASE_URL);
  const again = await configureGoogleEnvironment(directory, { origin: settings.APP_BASE_URL });
  assert.equal(await readFile(join(directory, '.env'), 'utf8'), updated, 'Repeated setup must be stable');
  assert.equal(again.redirectUri, `${settings.APP_BASE_URL}/api/auth?action=callback`);
}));

test('setup imports only Web OAuth JSON and creates a private ignored dotenv file', () => fixture(async directory => {
  const credentials = join(directory, 'downloaded.json');
  const web = { client_id: settings.GOOGLE_CLIENT_ID, client_secret: settings.GOOGLE_CLIENT_SECRET };
  await writeFile(credentials, JSON.stringify({ installed: web }));
  await assert.rejects(configureGoogleEnvironment(directory, { credentials, origin: settings.APP_BASE_URL }), /Aplicativo da Web/);
  await assert.rejects(readFile(join(directory, '.env')), { code: 'ENOENT' });
  await writeFile(credentials, JSON.stringify({ web }));
  const result = await configureGoogleEnvironment(directory, { credentials, origin: settings.APP_BASE_URL });
  assert.deepEqual(parseEnv(await readFile(join(directory, '.env'), 'utf8')), settings);
  assert(!JSON.stringify(result).includes(settings.GOOGLE_CLIENT_SECRET));
  if (process.platform !== 'win32') assert.equal((await stat(join(directory, '.env'))).mode & 0o777, 0o600);
}));

test('setup never writes secrets to tracked files, symlinks, or unignored files', () => fixture(async directory => {
  const content = Object.entries(settings).map(([name, value]) => `${name}=${value}`).join('\n');
  await writeFile(join(directory, '.env'), content);
  execFileSync('git', ['add', '-f', '.env'], { cwd: directory });
  await assert.rejects(configureGoogleEnvironment(directory, { origin: 'https://example.test' }), /versionado/);
  assert.equal(await readFile(join(directory, '.env'), 'utf8'), content);
  execFileSync('git', ['rm', '--cached', '-f', '.env'], { cwd: directory });
  await rm(join(directory, '.env'));
  await writeFile(join(directory, 'other'), content);
  await symlink(join(directory, 'other'), join(directory, '.env'));
  await assert.rejects(configureGoogleEnvironment(directory, { origin: 'https://example.test' }), /regular/);
  assert.equal(await readFile(join(directory, 'other'), 'utf8'), content);
  await rm(join(directory, '.env'));
  await writeFile(join(directory, '.gitignore'), '');
  await assert.rejects(configureGoogleEnvironment(directory, { origin: settings.APP_BASE_URL }), /gitignore/);
  await assert.rejects(readFile(join(directory, '.env')), { code: 'ENOENT' });
}));

test('reusing an API with disabled or different Google configuration fails with restart instructions', async () => {
  for (const config of [{ enabled: false }, { enabled: true, clientId: 'another-client' }, null]) {
    await assert.rejects(checkReusedGoogleApi(3001, settings, async () => ({ ok: true, json: async () => config })), error => {
      assert.match(error.message, /Ctrl\+C/);
      assert(!error.message.includes(settings.GOOGLE_CLIENT_SECRET));
      return true;
    });
  }
  await assert.rejects(checkReusedGoogleApi(3001, settings, async () => { throw new Error('unreachable'); }), /auth:check/);
  await checkReusedGoogleApi(3001, settings, async () => ({ ok: true, json: async () => ({ enabled: true, clientId: settings.GOOGLE_CLIENT_ID }) }));
});

async function runDoctor(environment) {
  const child = spawn(process.execPath, [join(root, 'scripts', 'check-google-auth.mjs')], { cwd: tmpdir(), env: { ...process.env, NODE_ENV: 'development', ...environment }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const [code] = await once(child, 'exit');
  assert(!output.includes(settings.GOOGLE_CLIENT_SECRET), 'Diagnostics must not print the server secret');
  return { code, output };
}

test('diagnostic command exits unsuccessfully for missing fields and names exactly what is missing', async () => {
  const result = await runDoctor({ ...settings, APP_BASE_URL: '' });
  assert.equal(result.code, 1);
  assert.match(result.output, /APP_BASE_URL: ausente ou vazio/);
  assert.doesNotMatch(result.output, /GOOGLE_CLIENT_ID: ausente|GOOGLE_CLIENT_SECRET: ausente/);
});

test('diagnostic command distinguishes a stale live API from one configured with the same public ID', async () => {
  let enabled = false;
  const api = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.url === '/api/health' ? { status: 'ok', database: 'connected' } : { enabled, clientId: enabled ? settings.GOOGLE_CLIENT_ID : undefined }));
  }).listen(0, '127.0.0.1');
  await once(api, 'listening');
  try {
    const environment = { ...settings, API_PORT: String(api.address().port) };
    const stale = await runDoctor(environment);
    assert.equal(stale.code, 1);
    assert.match(stale.output, /Reinicie a API antiga/);
    enabled = true;
    const ready = await runDoctor(environment);
    assert.equal(ready.code, 0);
    assert.match(ready.output, /login Google habilitado com o mesmo ID/);
    assert.match(ready.output, /Validação real pendente/);
  } finally { await new Promise(resolve => api.close(resolve)); }
});
