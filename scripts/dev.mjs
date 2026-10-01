import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const viteCli = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
let apiProcess;
let viteProcess;
let stopping = false;

async function isApiHealthy() {
  try {
    const response = await fetch("http://127.0.0.1:3001/api/health");
    if (!response.ok) return false;
    const health = await response.json();
    return health.database === "connected";
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
  if (!(await isApiHealthy())) {
    apiProcess = spawn(process.execPath, ["server/server.mjs"], {
      cwd: root,
      stdio: "inherit",
    });
    watch(apiProcess, "API local");

    let apiReady = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      if (stopping || apiProcess.exitCode !== null) break;
      if (await isApiHealthy()) {
        apiReady = true;
        break;
      }
      await delay(100);
    }

    if (!apiReady) {
      console.error("A API local não ficou disponível na porta 3001.");
      stop(1);
      return;
    }
  } else {
    console.log("API local já está disponível na porta 3001.");
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
  console.error(error);
  stop(1);
});