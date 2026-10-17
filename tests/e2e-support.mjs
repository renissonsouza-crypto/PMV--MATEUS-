import { createHash, randomBytes } from "node:crypto";
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
// ViaCEP and the mail provider use local fixtures; tests never send real emails.
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
  const emails = [];
  let mailFailures = 0;
  const mailServer = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const message = JSON.parse(Buffer.concat(chunks).toString());
    if (mailFailures > 0) { mailFailures--; res.writeHead(503, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Simulated mail outage" })); return; }
    emails.push(message);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ id: `mail-${emails.length}` }));
  });
  const cleanup = async () => {
    if (vite) await vite.close();
    await stopChild(api);
    if (cepServer.listening) await new Promise(resolveClose => cepServer.close(resolveClose));
    if (mailServer.listening) await new Promise(resolveClose => mailServer.close(resolveClose));
    rmSync(directory, { recursive: true, force: true });
  };
  try {
    const cepPort = await listen(cepServer);
    const mailPort = await listen(mailServer);
    const frontendReservation = createServer();
    const frontendPort = await listen(frontendReservation);
    await new Promise(resolveClose => frontendReservation.close(resolveClose));
    const reservation = createServer();
    const apiPort = await listen(reservation);
    await new Promise(resolveClose => reservation.close(resolveClose));
    api = spawn(process.execPath, [join(root, "server/server.mjs")], {
      cwd: root,
      env: { ...process.env, NODE_ENV: "test", RESEND_API_KEY: "", MAIL_FROM: "", APP_BASE_URL: "", MAIL_TEST_URL: `http://127.0.0.1:${mailPort}/emails`, API_PORT: String(apiPort), DB_PATH: dbPath, VIA_CEP_BASE_URL: `http://127.0.0.1:${cepPort}/ws` },
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
      vite = await createViteServer({
        root, configFile: join(root, "vite.config.ts"), logLevel: "warn", cacheDir: join(directory, "vite-cache"),
        server: { host: "127.0.0.1", port: frontendPort, strictPort: true, proxy: { "/api": { target: apiURL } } },
      });
      await vite.listen();
      baseURL = `http://127.0.0.1:${vite.httpServer.address().port}`;
    }
    return {
      baseURL, apiURL, cleanup, emails,
      failNextEmail() { mailFailures++; },
      seedRegistration(profile) {
        profile.profileToken = randomBytes(32).toString("hex");
        const database = new DatabaseSync(dbPath);
        try {
          database.prepare("DELETE FROM course_enrollment_requests WHERE registration_id = ?").run(profile.id);
          database.prepare("DELETE FROM profile_sessions WHERE registration_id = ?").run(profile.id);
          const payload = { ...profile, dataNascimento: "1990-01-01", cpf: String(profile.id).padStart(11, "0"), autorizaDados: true, aceitaTermos: true };
          database.prepare("INSERT OR IGNORE INTO registrations(id, name, cpf, email, phone, birth_date, city, state, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(profile.id, profile.nome, payload.cpf, profile.email, profile.telefone, payload.dataNascimento, "Vitória", "ES", JSON.stringify(payload));
          database.prepare('INSERT INTO profile_sessions(token_hash, registration_id, expires_at) VALUES (?, ?, ?)').run(createHash('sha256').update(profile.profileToken).digest('hex'), profile.id, new Date(Date.now() + 86400000).toISOString());
        } finally { database.close(); }
      },
      seedGoogleSignup(identity) {
        const token = randomBytes(32).toString('hex');
        const database = new DatabaseSync(dbPath);
        try { database.prepare('INSERT INTO google_signup_intents VALUES (?, ?, ?, ?, ?)').run(createHash('sha256').update(token).digest('hex'), identity.subject, identity.email, identity.nome, new Date(Date.now() + 1800000).toISOString()); }
        finally { database.close(); }
        return token;
      },
      googleIdentity(subject) {
        const database = new DatabaseSync(dbPath, { readOnly: true });
        try { return database.prepare('SELECT registration_id FROM google_identities WHERE subject = ?').get(subject); }
        finally { database.close(); }
      },
      confirmedEnrollments(id) {
        const database = new DatabaseSync(dbPath, { readOnly: true });
        try { return database.prepare("SELECT * FROM course_enrollment_requests WHERE registration_id = ? AND confirmed_at IS NOT NULL AND cancelled_at IS NULL").all(id); }
        finally { database.close(); }
      },
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
