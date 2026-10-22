import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { mkdtemp, rm, mkdir, writeFile, copyFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getApiPort, requireSupportedNode, resolveViteCli } from "../scripts/dev-config.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

async function freePort() {
  const probe = createServer().listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}

test("local startup rejects unsupported Node and invalid ports with actionable messages", () => {
  assert.throws(() => requireSupportedNode("20.19.0"), /Node.js 24 LTS/);
  assert.doesNotThrow(() => requireSupportedNode("24.0.0"));
  for (const API_PORT of ["", "0", "-1", "3001.5", "65536", "abc"]) {
    assert.throws(() => getApiPort({ API_PORT }), /API_PORT/);
  }
  assert.equal(getApiPort({ API_PORT: "0" }, { allowEphemeral: true }), 0);
});

test("Vite resolution supports hoisted dependencies and detects an incomplete installation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "qualificavix cli "));
  try {
    const app = join(directory, "packages", "app");
    const vite = join(directory, "node_modules", "vite");
    await mkdir(join(vite, "bin"), { recursive: true });
    await mkdir(join(app, "scripts"), { recursive: true });
    await writeFile(join(vite, "package.json"), JSON.stringify({ name: "vite", bin: { vite: "bin/vite.js" } }));
    await writeFile(join(vite, "bin", "vite.js"), "// fixture\n");
    const fromUrl = pathToFileURL(join(app, "scripts", "dev-config.mjs"));
    assert.equal(await resolveViteCli(fromUrl), join(vite, "bin", "vite.js"));
    await rm(join(vite, "bin", "vite.js"));
    await assert.rejects(resolveViteCli(fromUrl), /npm(?:\.cmd)? ci --include=dev/);
    await mkdir(join(vite, "bin", "vite.js"));
    await assert.rejects(resolveViteCli(fromUrl), /Vite não está instalado corretamente/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("missing Vite stops before API startup with the dependency recovery command", { timeout: 10_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "qualificavix-no-vite-"));
  try {
    await mkdir(join(directory, "scripts"));
    await mkdir(join(directory, "server", "config"), { recursive: true });
    await copyFile(join(root, "server", "config", "environment.mjs"), join(directory, "server", "config", "environment.mjs"));
    for (const file of ["dev.mjs", "dev-config.mjs"]) await copyFile(join(root, "scripts", file), join(directory, "scripts", file));
    await writeFile(join(directory, "server", "server.mjs"), "import {writeFileSync} from 'node:fs'; writeFileSync('api-started', 'yes'); process.exit(99);\n");
    const child = spawn(process.execPath, [join(directory, "scripts", "dev.mjs")], {
      cwd: directory, env: { ...process.env, API_PORT: String(await freePort()), NODE_PATH: "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", data => { output += data; });
    child.stderr.on("data", data => { output += data; });
    const [code] = await once(child, "exit");
    assert.equal(code, 1);
    assert.match(output, /npm(?:\.cmd)? ci --include=dev/);
    assert.doesNotMatch(output, /Cannot find module|API local encerrou/);
    await assert.rejects(stat(join(directory, "api-started")), { code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("dev starts API and Vite on alternate ports and proxies real database mutations", { timeout: 30_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "qualificavix-dev-"));
  const apiPort = await freePort();
  let frontendPort = await freePort();
  while (frontendPort === apiPort) frontendPort = await freePort();
  const origin = `http://127.0.0.1:${frontendPort}`;
  const child = spawn(process.execPath, ["scripts/dev.mjs", "--host", "127.0.0.1", "--port", String(frontendPort), "--strictPort"], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'test', GOOGLE_CLIENT_ID: 'startup.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'startup-test-secret', APP_BASE_URL: origin, API_PORT: String(apiPort), DB_PATH: join(directory, "test.sqlite"), VITE_CACHE_DIR: join(directory, "vite-cache") },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", data => { output += data; });
  child.stderr.on("data", data => { output += data; });

  try {
    let ready = false;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Dev exited before readiness:\n${output}`);
      try {
        const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(500) });
        if (response.ok && (await response.json()).database === "connected") { ready = true; break; }
      } catch {}
      await delay(100);
    }
    assert.ok(ready, `Vite/API did not become ready:\n${output}`);
    const page = await fetch(origin);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /\/src\/main\.tsx/);
    const entry = await fetch(`${origin}/src/main.tsx`);
    assert.equal(entry.status, 200);
    assert.match(entry.headers.get("content-type"), /javascript/);
    const google = await fetch(`${origin}/api/auth?action=config`);
    assert.equal(google.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await google.json(), { enabled: true, clientId: 'startup.apps.googleusercontent.com' }, 'Configured API must expose availability and public ID only');

    const profileToken = "a".repeat(64);
    const database = new DatabaseSync(join(directory, "test.sqlite"));
    const now = new Date().toISOString();
    const profilePayload = { nome: "Teste de inicialização", email: "startup@example.com", telefone: "27999999999", autorizaDados: true, aceitaTermos: true };
    const registration = database.prepare(`INSERT INTO registrations
      (name, cpf, email, phone, birth_date, city, state, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      profilePayload.nome, "12345678901", profilePayload.email, profilePayload.telefone, "1990-01-01", "Vitória", "ES", JSON.stringify(profilePayload),
    );
    database.prepare("INSERT INTO profile_sessions(token_hash, registration_id, expires_at) VALUES (?, ?, ?)")
      .run(createHash("sha256").update(profileToken).digest("hex"), Number(registration.lastInsertRowid), new Date(Date.now() + 86_400_000).toISOString());
    database.prepare(`INSERT INTO course_enrollment_requests
      (id, registration_id, course_id, token_hash, status_hash, delivery, created_at, expires_at, confirmed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "startup-enrollment", Number(registration.lastInsertRowid), 1, "b".repeat(64), "c".repeat(64), "direct", now, now, now,
    );
    database.close();

    const testimonialData = {
      role: "Aluna",
      courseId: 1,
      quote: "O curso de programação me ajudou a praticar lógica e criar pequenos projetos.",
      rating: 5,
      acceptedGuidelines: true,
      website: "",
    };
    const anonymous = await fetch(`${origin}/api/testimonials`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify(testimonialData),
    });
    assert.equal(anonymous.status, 401);

    const created = await fetch(`${origin}/api/testimonials`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin, "x-profile-token": profileToken },
      body: JSON.stringify(testimonialData),
    });
    assert.equal(created.status, 201, await created.clone().text());
    const testimonial = await created.json();
    assert.equal(testimonial.name, profilePayload.nome);
    assert.equal(testimonial.course, "Introdução à Programação");
    assert.equal(testimonial.courseId, 1);
    const list = await (await fetch(`${origin}/api/testimonials`)).json();
    assert.ok(list.some(item => item.id === testimonial.id));

    const duplicate = await fetch(`${origin}/api/testimonials`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin, "x-profile-token": profileToken },
      body: JSON.stringify(testimonialData),
    });
    assert.equal(duplicate.status, 409);

    const notEnrolled = await fetch(`${origin}/api/testimonials`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin, "x-profile-token": profileToken },
      body: JSON.stringify({ ...testimonialData, courseId: 2, quote: "O curso de Excel poderia ajudar meu trabalho com planilhas e relatórios." }),
    });
    assert.equal(notEnrolled.status, 403);

    const rejected = await fetch(`${origin}/api/testimonials`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "https://outside.example" },
      body: JSON.stringify(testimonialData),
    });
    assert.equal(rejected.status, 403);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      await exited;
    }
    await rm(directory, { recursive: true, force: true });
  }
});

test('dev refuses to reuse a stale API without killing the existing service', { timeout: 10_000 }, async () => {
  const api = createHttpServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.url === '/api/health' ? { status: 'ok', database: 'connected' } : { enabled: false }));
  }).listen(0, '127.0.0.1');
  await once(api, 'listening');
  const port = api.address().port;
  try {
    const child = spawn(process.execPath, ['scripts/dev.mjs'], {
      cwd: root,
      env: { ...process.env, API_PORT: String(port), GOOGLE_CLIENT_ID: 'startup.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'startup-test-secret', APP_BASE_URL: 'http://localhost:5173' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    const [code] = await once(child, 'exit');
    assert.equal(code, 1);
    assert.match(output, /API já aberta.*Ctrl\+C/);
    assert.doesNotMatch(output, /startup-test-secret|VITE v|Local:/);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`)).status, 200);
  } finally { await new Promise(resolve => api.close(resolve)); }
});
