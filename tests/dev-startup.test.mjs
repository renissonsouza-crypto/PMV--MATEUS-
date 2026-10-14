import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { getApiPort, requireSupportedNode } from "../scripts/dev-config.mjs";

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

test("dev starts API and Vite on alternate ports and proxies real database mutations", { timeout: 30_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "qualificavix-dev-"));
  const apiPort = await freePort();
  let frontendPort = await freePort();
  while (frontendPort === apiPort) frontendPort = await freePort();
  const origin = `http://127.0.0.1:${frontendPort}`;
  const child = spawn(process.execPath, ["scripts/dev.mjs", "--host", "127.0.0.1", "--port", String(frontendPort), "--strictPort"], {
    cwd: root,
    env: { ...process.env, API_PORT: String(apiPort), DB_PATH: join(directory, "test.sqlite"), VITE_CACHE_DIR: join(directory, "vite-cache") },
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

    const created = await fetch(`${origin}/api/testimonials`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ name: "Teste de inicialização", role: "Aluno", course: "Programação", quote: "API e frontend conectados", rating: 5 }),
    });
    assert.equal(created.status, 201, await created.clone().text());
    const testimonial = await created.json();
    const list = await (await fetch(`${origin}/api/testimonials`)).json();
    assert.ok(list.some(item => item.id === testimonial.id));

    const rejected = await fetch(`${origin}/api/testimonials`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "https://outside.example" },
      body: JSON.stringify({ name: "Teste", role: "Aluno", course: "Excel", quote: "Outra origem", rating: 5 }),
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
