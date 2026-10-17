import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { configureGoogleEnvironment } from './google-env.mjs';

try {
  const { values } = parseArgs({ options: { credentials: { type: 'string' }, origin: { type: 'string' } } });
  if (!values.credentials && !values.origin) throw new Error('Use npm run auth:setup -- --origin http://localhost:5173. Para importar o JSON Google, acrescente --credentials "CAMINHO_DO_JSON".');
  const result = await configureGoogleEnvironment(fileURLToPath(new URL('../', import.meta.url)), values);
  console.log('.env atualizado localmente, sem exibir nem enviar as credenciais.');
  console.log(`Origem JavaScript autorizada: ${result.origin}`);
  console.log(`URI de redirecionamento autorizada: ${result.redirectUri}`);
  console.log('Cadastre esses endereços no cliente Google Cloud. Reinicie a API e execute npm run auth:check.');
} catch (error) {
  // File/parser errors can contain sensitive source text; only our fixed messages are exposed.
  console.error(error.code ? 'Não foi possível atualizar a configuração local. Confira as permissões dos arquivos e os argumentos do comando.' : error.message);
  process.exitCode = 1;
}
