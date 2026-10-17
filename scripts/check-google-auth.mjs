import '../server/config/environment.mjs';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { inspectGoogleEnvironment } from './google-env.mjs';
import { checkReusedGoogleApi, getApiPort } from './dev-config.mjs';

const exists = async name => {
  try { await access(fileURLToPath(new URL(`../${name}`, import.meta.url))); return true; }
  catch { return false; }
};
try {
  console.log('Verificação Google — nenhum segredo é exibido ou enviado ao Google.');
  console.log(`Arquivo .env na raiz: ${await exists('.env') ? 'encontrado' : 'não encontrado'}.`);
  if (await exists('.env.txt')) console.log('Atenção: .env.txt não é carregado. No Windows, habilite a exibição das extensões e use o nome .env.');
  if (await exists('.env.local')) console.log('A API lê .env e as variáveis do terminal; ela não lê .env.local.');
  const report = inspectGoogleEnvironment(process.env);
  for (const message of report.messages) console.log(message);
  if (!report.ok) {
    console.log('Preencha as três variáveis no .env da raiz; .env.example é somente um modelo.');
    console.log('Se só falta o endereço local: npm run auth:setup -- --origin http://localhost:5173');
    process.exitCode = 1;
  } else {
    const port = getApiPort();
    let running = false;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) });
      const health = response.ok ? await response.json() : null;
      running = health?.status === 'ok' && health.database === 'connected';
    } catch { /* A stopped API is separate from missing configuration. */ }
    if (running) {
      await checkReusedGoogleApi(port);
      console.log('API em execução: login Google habilitado com o mesmo ID. Se você alterou o segredo ou o endereço, reinicie a API.');
    } else console.log('API não verificada em execução. Inicie npm run dev; se já estava aberta, reinicie para aplicar o .env.');
    console.log(`Origem JavaScript no Google Cloud: ${report.config.origin}`);
    console.log(`URI de redirecionamento no Google Cloud: ${report.config.redirectUri}`);
    console.log('Validação real pendente: abra o site nessa origem e entre com uma conta Google autorizada.');
  }
} catch {
  console.error('A API em execução não corresponde à configuração local ou a porta é inválida. Reinicie a API antiga e confira API_PORT antes de executar npm run dev novamente.');
  process.exitCode = 1;
}
