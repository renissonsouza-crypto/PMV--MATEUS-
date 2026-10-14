
# Qualifica Vix

Aplicação React/Vite com API local em SQLite e API de produção serverless para Vercel usando PostgreSQL (Neon).

## Arquitetura MVC

```text
api/                         Rotas serverless da Vercel
server/
  config/                    Conexões e configuração de infraestrutura
  controllers/               Fluxo HTTP e coordenação das regras
  models/                    Acesso a dados e validações do domínio
  server.mjs                 Entrada da API local
src/app/
  models/                    Tipos e entidades do frontend
  controllers/               Estado, navegação e ações da aplicação
  views/                     Telas e composição visual
  services/                  Comunicação com as APIs
  components/                Componentes visuais reutilizáveis
```

O fluxo segue `View → Controller → Service/Route → Controller → Model → Banco`. Os arquivos em `api/` são entradas finas exigidas pela Vercel e delegam imediatamente aos controllers.

## Desenvolvimento local

Requisitos: **Node.js 24 LTS ou superior** e npm. A API local usa o módulo `node:sqlite`, incluído nessa versão do Node. O arquivo `.nvmrc` indica a versão principal utilizada pelo projeto.

```bash
npm ci
npm run dev
```

No **Windows PowerShell**, use o inicializador `.cmd` caso a política de scripts bloqueie `npm.ps1`:

```powershell
npm.cmd ci
npm.cmd run dev
```

Execute os comandos na pasta que contém `package.json` e mantenha o terminal aberto. Abra o endereço `Local:` mostrado pelo Vite, normalmente `http://localhost:5173`. A porta pode mudar se estiver ocupada. **Abrir `index.html` pelo explorador de arquivos (`file:///...`) não executa React/TypeScript.**

`npm run dev` inicia a API SQLite na porta 3001 e o Vite; o frontend encaminha `/api/*` para essa API. Se uma API saudável já estiver rodando nessa porta, o script a reutiliza. `API_PORT` pode selecionar outra porta: a API, a verificação de saúde e o proxy usam o mesmo valor. `DB_PATH` pode selecionar outro arquivo SQLite. As variáveis precisam ser definidas antes de iniciar o processo.

No PowerShell, por exemplo:

```powershell
$env:API_PORT = "3002"
npm.cmd run dev
```

Se o terminal não mostrar `VITE` e `Local:`, confira o erro da API acima: versão antiga do Node, porta ocupada ou caminho do banco sem acesso impedem a inicialização. Se o Vite iniciar e a página não carregar, confirme o endereço e consulte o Console do navegador (F12). Não é necessário alterar a política de segurança do PowerShell para usar `npm.cmd`.

O desenvolvimento local não precisa de `DATABASE_URL`. Cadastros reais consultam `viacep.com.br` e imagens do catálogo usam `images.unsplash.com`. Em ambientes com proxy HTTP(S), preserve as configurações de proxy e certificados; o Node 24 pode usar `NODE_USE_ENV_PROXY=1` quando necessário.

Os scripts de instalação das versões fixadas de Tailwind Oxide e esbuild são autorizados em `allowScripts`. Use `npm install-scripts ls` nas versões do npm que disponibilizam esse comando para revisar outras necessidades. Preserve a verificação de integridade e TLS.

## Comportamento da plataforma

O catálogo apresenta os cursos definidos no projeto. A pesquisa, as categorias, os filtros e os favoritos usam esse catálogo; cursos em breve não aceitam inscrições. O assistente responde com essas informações e com as regras da plataforma.

Os contatos direcionam ao portal da Prefeitura de Vitória. Configure somente canais de atendimento verificados em `VITE_CONTACT_PHONE` e `VITE_CONTACT_EMAIL`, se disponíveis, antes de iniciar o Vite ou gerar o build. Variáveis `VITE_` ficam públicas no frontend e não devem conter segredos.

O cadastro exige endereço de Vitória-ES, dados e consentimentos válidos, além de responsável legal para menores de 18 anos. O cadastro e os depoimentos são enviados à API; depoimentos podem ser exibidos publicamente. O perfil, a foto, os favoritos e as inscrições em cursos são mantidos no navegador utilizado, sem um sistema de login entre dispositivos. Editar o perfil atualiza esses dados locais. Sair limpa o perfil e os favoritos locais, sem apagar automaticamente registros enviados à API.

O limite é de três inscrições realizadas no mês, incluindo inscrições canceladas. O prazo de cancelamento é de três dias após cada inscrição. Dados antigos são normalizados ao carregar; se o navegador negar gravações, a interface informa que as alterações duram somente enquanto a página estiver aberta.

## Testes e build

```bash
npm test
npm run build
npm run test:e2e
```

No PowerShell, substitua `npm` por `npm.cmd`. `npm test` inclui testes de regras, armazenamento, cliente HTTP, validações, segurança, inicialização em portas alternativas, SQLite e rotas serverless.

Os testes usam bancos SQLite temporários e um serviço ViaCEP local controlado; preservam o banco de desenvolvimento. O teste serverless exercita controllers, models e SQL com transporte Neon isolado, sem credenciais de produção.

O teste de navegador inicia sua própria API/Vite e usa Chrome, Chromium ou Edge instalado. Ele verifica navegação, filtros, favoritos, cadastro e depoimentos persistidos, perfil, inscrições, cancelamentos, assistente, acessibilidade do formulário e responsividade. Para outro executável, configure `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` ou `CHROME_PATH`. `TEST_URL` permite apontar para um frontend já iniciado, mantendo um backend temporário para as gravações do teste.

Ambientes que tornem o banco de certificados do Chromium somente leitura precisam permitir sua inicialização para carregar HTTPS com a CA do proxy; não desative a verificação TLS. Os caches de Vite dos testes são isolados dos processos de desenvolvimento.

Para validar diretamente o PostgreSQL de produção, configure `DATABASE_URL` e execute `npm run test:postgres`.

Esse teste prepara tabelas ausentes no banco configurado. Use uma instância de teste apropriada; os testes locais e serverless isolados não substituem a validação de uma implantação Vercel/Neon real.

## Implantação na Vercel

1. Envie o repositório ao seu provedor Git e importe o projeto na Vercel.
2. No Marketplace da Vercel, adicione um banco Neon ao projeto.
3. Confirme que `DATABASE_URL` existe nos ambientes Production, Preview e Development.
4. Execute `npm run db:migrate` com essa variável para preparar as tabelas. As APIs também verificam o schema automaticamente.
5. Faça o deploy. O `vercel.json` define Vite, pasta `dist`, rotas SPA e cabeçalhos de segurança.
6. Valide `https://SEU-DOMINIO/api/health`; a resposta esperada contém `database: "connected"`.

Nunca salve a URL real do banco no Git. Use `.env.example` apenas como referência e configure segredos na Vercel.

## APIs

- `GET /api/health`: saúde da aplicação e conexão do banco.
- `GET /api/testimonials`: lista depoimentos.
- `POST /api/testimonials`: cria um depoimento validado.
- `POST /api/registrations`: cria cadastro e exige responsável legal para menores de 18 anos.
  
