import "../server/config/environment.mjs";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { checkReusedGoogleApi, getApiPort, requireSupportedNode, resolveViteCli } from "./dev-config.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
let viteCli;
let apiProcess;
let viteProcess;
let stopping = false;
let apiPort;

async function isApiHealthy() {
  try {
    const response = await fetch(`http://127.0.0.1:${apiPort}/api/health`, {
      signal: AbortSignal.timeout(1000),
    });
    if (!response.ok) return false;
    const health = await response.json();
    return health.status === "ok" && health.database === "connected";
  } catch {
    return false;
  }
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of [viteProcess, apiProcess]) {
    if (child && child.exitCode === null) child.kill();
  }
  process.exitCode = exitCode;
}

function watch(child, name) {
  child.on("error", error => {
    console.error(`${name} não iniciou: ${error.message}`);
    stop(1);
  });
  child.on("exit", (code, signal) => {
    if (stopping) return;
    console.error(`${name} encerrou${signal ? ` (${signal})` : ` com código ${code}`}.`);
    stop(code ?? 1);
  });
}

async function main() {
  requireSupportedNode();
  apiPort = getApiPort();
  viteCli = await resolveViteCli();
  try {
    await import("node:sqlite");
  } catch {
    throw new Error("O módulo node:sqlite não está disponível. Use uma instalação completa do Node.js 24 LTS ou superior.");
  }

  if (!(await isApiHealthy())) {
    apiProcess = spawn(process.execPath, ["server/server.mjs"], {
      cwd: root,
      stdio: "inherit",
    });
    watch(apiProcess, "API local");

    let apiReady = false;
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if (stopping || apiProcess.exitCode !== null) break;
      if (await isApiHealthy()) {
        apiReady = true;
        break;
      }
      await delay(100);
    }

    if (!apiReady) {
      console.error(`A API local não ficou disponível na porta ${apiPort}. Confira o erro acima e se a porta está ocupada.`);
      stop(1);
      return;
    }
  } else {
    await checkReusedGoogleApi(apiPort);
    console.log(`API local já está disponível na porta ${apiPort}.`);
    console.log('Se você alterou o .env, reinicie também essa API para aplicar os novos valores.');
  }

  if (stopping) return;
  viteProcess = spawn(process.execPath, [viteCli, ...process.argv.slice(2)], {
    cwd: root,
    stdio: "inherit",
  });
  watch(viteProcess, "Vite");
}

process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));
main().catch(error => {
  console.error(error.message);
  stop(1);
});
