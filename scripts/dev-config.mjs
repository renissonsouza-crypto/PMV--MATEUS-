import { createRequire } from "node:module";
import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";

export function getApiPort(environment = process.env, { allowEphemeral = false } = {}) {
  const value = environment.API_PORT ?? "3001";
  const port = Number(value);
  const minimum = allowEphemeral ? 0 : 1;
  if (!/^\d+$/.test(value) || !Number.isInteger(port) || port < minimum || port > 65535) {
    throw new Error(`API_PORT deve ser um número inteiro entre ${minimum} e 65535.`);
  }
  return port;
}

export function requireSupportedNode(version = process.versions.node) {
  const major = Number(version.split(".")[0]);
  if (!Number.isInteger(major) || major < 24) {
    throw new Error(`Node.js ${version} não é compatível com este projeto. Instale o Node.js 24 LTS ou superior e abra um novo terminal.`);
  }
}

export async function checkReusedGoogleApi(port, environment = process.env, fetcher = fetch) {
  if (![environment.GOOGLE_CLIENT_ID, environment.GOOGLE_CLIENT_SECRET, environment.APP_BASE_URL].every(value => value?.trim())) return;
  try {
    const response = await fetcher(`http://127.0.0.1:${port}/api/auth?action=config`, { signal: AbortSignal.timeout(2000), cache: 'no-store' });
    const config = response.ok ? await response.json() : null;
    if (config?.enabled === true && config.clientId === environment.GOOGLE_CLIENT_ID.trim()) return;
  } catch { /* An older API may not implement this endpoint. */ }
  throw new Error(`A API já aberta na porta ${port} não está usando a configuração Google deste terminal. Encerre a API antiga com Ctrl+C no terminal onde ela foi iniciada e execute npm run dev novamente. Para diagnosticar, execute npm run auth:check.`);
}

export async function resolveViteCli(fromUrl = import.meta.url) {
  try {
    const require = createRequire(fromUrl);
    const manifestPath = require.resolve("vite/package.json");
    const manifest = require(manifestPath);
    const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.vite;
    if (typeof bin !== "string") throw new Error("Vite CLI missing");
    const cli = resolve(dirname(manifestPath), bin);
    if (!(await stat(cli)).isFile()) throw new Error("Vite CLI is not a file");
    await access(cli, constants.R_OK);
    return cli;
  } catch {
    const installCommand = process.platform === "win32" ? "npm.cmd ci --include=dev" : "npm ci --include=dev";
    throw new Error(`O Vite não está instalado corretamente. Na pasta do projeto, execute ${installCommand} e tente iniciar novamente.`);
  }
}
