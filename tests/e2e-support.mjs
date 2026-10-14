import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createServer as createViteServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function findBrowserExecutable() {
  const override = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || process.env.CHROME_PATH;
  if (override) {
    if (!existsSync(override)) throw new Error(`Navegador configurado não encontrado: ${override}`);
    return override;
  }
  const windowsRoots = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
  const paths = process.platform === "win32"
    ? windowsRoots.flatMap(base => [join(base, "Google/Chrome/Application/chrome.exe"), join(base, "Microsoft/Edge/Application/msedge.exe")])
    : process.platform === "darwin"
      ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
      : ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/opt/google/chrome/chrome"];
  const found = paths.find(path => existsSync(path));
  if (!found) throw new Error("Instale Chrome/Chromium/Edge ou configure PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH com o caminho do executável.");
  return found;
}

export const cepAddress = { cep: "29050-945", logradouro: "Avenida Marechal Mascarenhas de Moraes", bairro: "Bento Ferreira", localidade: "Vitória", uf: "ES" };

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

async function stopChild(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  const timeout = setTimeout(() => child.kill("SIGKILL"), 5000);
  await exited;
  clearTimeout(timeout);
}

// All writes use the real application API against disposable SQLite data.
// ViaCEP is the only service fixture: tests do not depend on external services.
export async function startTestEnvironment() {
  const directory = mkdtempSync(join(tmpdir(), "qualificavix-e2e-"));
  const dbPath = join(directory, "test.sqlite");
  let api;
  let vite;
  let output = "";
  const cepServer = createServer((req, res) => {
    const cep = req.url?.match(/\/(\d{8})\/json\/$/)?.[1];
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(cep === "29050945" ? cepAddress : { ...cepAddress, localidade: "Vila Velha", cep: "29100-000" }));
  });
  const cleanup = async () => {
    if (vite) await vite.close();
    await stopChild(api);
    if (cepServer.listening) await new Promise(resolveClose => cepServer.close(resolveClose));
    rmSync(directory, { recursive: true, force: true });
  };
  try {
    const cepPort = await listen(cepServer);
    const reservation = createServer();
    const apiPort = await listen(reservation);
    await new Promise(resolveClose => reservation.close(resolveClose));
    api = spawn(process.execPath, [join(root, "server/server.mjs")], {
      cwd: root,
      env: { ...process.env, API_PORT: String(apiPort), DB_PATH: dbPath, VIA_CEP_BASE_URL: `http://127.0.0.1:${cepPort}/ws` },
      stdio: ["ignore", "pipe", "pipe"],
    });
    api.stdout.on("data", data => { output += data.toString(); });
    api.stderr.on("data", data => { output += data.toString(); });
    api.on("error", error => { output += error.message; });
    const apiURL = `http://127.0.0.1:${apiPort}`;
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (api.exitCode !== null) break;
      try {
        const response = await fetch(`${apiURL}/api/health`);
        if (response.ok && (await response.json()).database === "connected") { ready = true; break; }
      } catch { /* Startup has not completed yet. */ }
      await new Promise(resolveWait => setTimeout(resolveWait, 100));
    }
    if (!ready) throw new Error(`A API isolada não iniciou. Use Node.js 24 LTS.\n${output}`);
    let baseURL = process.env.TEST_URL;
    if (!baseURL) {
      const frontendReservation = createServer();
      const frontendPort = await listen(frontendReservation);
      await new Promise(resolveClose => frontendReservation.close(resolveClose));
      vite = await createViteServer({
        root, configFile: join(root, "vite.config.ts"), logLevel: "warn", cacheDir: join(directory, "vite-cache"),
        server: { host: "127.0.0.1", port: frontendPort, strictPort: true, proxy: { "/api": { target: apiURL } } },
      });
      await vite.listen();
      baseURL = `http://127.0.0.1:${vite.httpServer.address().port}`;
    }
    return {
      baseURL, apiURL, cleanup,
      registration(id) {
        const database = new DatabaseSync(dbPath, { readOnly: true });
        try { return database.prepare("SELECT id, name, email, payload FROM registrations WHERE id = ?").get(id); }
        finally { database.close(); }
      },
      async prepareContext(context) {
        await context.route("https://viacep.com.br/ws/*/json/", route => {
          const address = route.request().url().includes("/29050945/") ? cepAddress : { ...cepAddress, localidade: "Vila Velha", cep: "29100-000" };
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(address) });
        });
        if (process.env.TEST_URL) {
          // An explicitly supplied frontend still uses the disposable real backend.
          await context.route("**/api/**", async route => {
            const request = route.request();
            const url = new URL(request.url());
            const response = await fetch(`${apiURL}${url.pathname}${url.search}`, {
              method: request.method(), body: request.postDataBuffer() ?? undefined,
              headers: { "Content-Type": "application/json", Origin: apiURL },
            });
            await route.fulfill({ status: response.status, contentType: "application/json", body: await response.text() });
          });
        }
      },
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
