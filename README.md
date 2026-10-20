
# Qualifica Vix

Aplicação React/Vite com API local em SQLite e API de produção serverless para Vercel usando PostgreSQL (Neon).

## Tutorial de uso em PDF

[**Abrir o guia completo do Qualifica Vix**](docs/tutorial-qualifica-vix.pdf) — 63 páginas, 26 imagens, sumário clicável, instruções de uso, validações, documentos e roteiro de apresentação. Edição de 19/10/2026, com dados fictícios nas capturas.

Para salvar uma cópia, abra o PDF no GitHub e use **Download raw file** ou [baixe diretamente](https://github.com/renissonsouza-crypto/PMV--MATEUS-/raw/refs/heads/main/docs/tutorial-qualifica-vix.pdf). Em repositórios privados, entre na sua conta GitHub com acesso ao projeto.

## Apresentação animada para o navegador

[**Baixar a apresentação do Qualifica Vix**](https://github.com/renissonsouza-crypto/PMV--MATEUS-/raw/refs/heads/main/docs/apresentacao-qualifica-vix.zip) — 30 slides principais + 4 de consulta, Tortuguita como guia em todos os slides, animações por funcionalidade, telas reais e artes em laranja, azul e branco. Extraia o ZIP e abra **APRESENTACAO.html** no navegador; funciona sem internet e sem instalação. O pacote inclui PDF e roteiro do apresentador.

Use **F** para tela cheia, **← →** para navegar, **I** para o índice e **P** para o painel separado do apresentador. [Instruções e verificações](docs/apresentacao/README.md). Após a implantação, a página também fica disponível em `/apresentacao/`.

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
npm ci --include=dev
npm run dev
```

No **Windows PowerShell**, use o inicializador `.cmd` caso a política de scripts bloqueie `npm.ps1`:

```powershell
npm.cmd ci --include=dev
npm.cmd run dev
```

Execute os comandos na pasta que contém `package.json` e mantenha o terminal aberto. Abra o endereço `Local:` mostrado pelo Vite, normalmente `http://localhost:5173`. A porta pode mudar se estiver ocupada. **Abrir `index.html` pelo explorador de arquivos (`file:///...`) não executa React/TypeScript.**

`npm run dev` inicia a API SQLite na porta 3001 e o Vite; o frontend encaminha `/api/*` para essa API. Se uma API saudável já estiver rodando nessa porta, o script a reutiliza. `API_PORT` pode selecionar outra porta: a API, a verificação de saúde e o proxy usam o mesmo valor. `DB_PATH` pode selecionar outro arquivo SQLite. As variáveis precisam ser definidas antes de iniciar o processo.

No PowerShell, por exemplo:

```powershell
$env:API_PORT = "3002"
npm.cmd run dev
```

Se o terminal não mostrar `VITE` e `Local:`, confira o erro acima: versão antiga do Node, dependências ausentes, porta ocupada ou caminho do banco sem acesso impedem a inicialização. Se houver `Cannot find module ...vite.js` ou a mensagem de Vite não instalado, execute `npm ci --include=dev` (`npm.cmd ci --include=dev` no PowerShell). O Vite é uma dependência de desenvolvimento; essa opção também o instala quando a configuração do npm omite essas dependências. Se o Vite iniciar e a página não carregar, confirme o endereço e consulte o Console do navegador (F12). Não é necessário alterar a política de segurança do PowerShell para usar `npm.cmd`.

O desenvolvimento local não precisa de `DATABASE_URL`. Cadastros reais consultam `viacep.com.br` e imagens do catálogo usam `images.unsplash.com`. Em ambientes com proxy HTTP(S), preserve as configurações de proxy e certificados; o Node 24 pode usar `NODE_USE_ENV_PROXY=1` quando necessário.

Os scripts de instalação das versões fixadas de Tailwind Oxide e esbuild são autorizados em `allowScripts`. Use `npm install-scripts ls` nas versões do npm que disponibilizam esse comando para revisar outras necessidades. Preserve a verificação de integridade e TLS.

## Comportamento da plataforma

O catálogo apresenta os cursos definidos no projeto. A pesquisa, as categorias, os filtros e os favoritos usam esse catálogo; cursos em breve não aceitam inscrições. O assistente responde com essas informações e com as regras da plataforma.

Os contatos direcionam ao portal da Prefeitura de Vitória. Configure somente canais de atendimento verificados em `VITE_CONTACT_PHONE` e `VITE_CONTACT_EMAIL`, se disponíveis, antes de iniciar o Vite ou gerar o build. Variáveis `VITE_` ficam públicas no frontend e não devem conter segredos.

O cadastro exige endereço de Vitória-ES, dados e consentimentos válidos, além de responsável legal para menores de 18 anos. O cadastro e os depoimentos são enviados à API; depoimentos podem ser exibidos publicamente. O perfil, a foto e os favoritos ficam no navegador utilizado. Novas inscrições são confirmadas diretamente na plataforma e registradas no servidor, sem validação por e-mail. Editar o perfil atualiza esses dados locais. Sair limpa o perfil e os favoritos locais e solicita a revogação da sessão atual no servidor, sem excluir o cadastro. Sem conexão, essa revogação remota pode falhar.

O limite é de três inscrições realizadas no mês, incluindo inscrições canceladas. O prazo de cancelamento é de três dias após cada inscrição. Dados antigos são normalizados ao carregar; se o navegador negar gravações, a interface informa que as alterações duram somente enquanto a página estiver aberta.

## Assistente Tortuguita

A Tortuguita usa uma base local de 50 temas e 400 exemplos de perguntas, junto com o catálogo compartilhado pelas telas. Ela orienta cadastro, perfil, favoritos, consentimentos, inscrições, cancelamentos, suporte e escolha de cursos. A conversa permite continuar um assunto, comparar cursos e refinar preferências sem repetir toda a pergunta.

Esse funcionamento combina regras de interpretação de texto, exemplos e contexto da conversa; não envolve treinamento de pesos de um modelo de linguagem nem chamadas a uma API de IA. As respostas não inventam datas, docentes, critérios de certificação ou garantias de emprego ausentes do catálogo. Quando faltam informações, indicam como confirmá-las.

Pedidos claros, como “quero me cadastrar”, “quero informações sobre o curso de Excel” e “quero ver meus favoritos”, abrem automaticamente a tela correspondente e fecham o chat. Ao reabri-lo, a conversa continua de onde parou. Perguntas informativas sobre regras, comparações, negações e pedidos com mais de um destino permanecem no chat, com botões para escolher o próximo passo. Inscrições, cancelamentos e alterações continuam exigindo a ação do usuário na interface correspondente.

Com perfil cadastrado, a Tortuguita salva as conversas recentes, o assunto atual, as preferências e os cursos consultados em uma memória separada por identificador do perfil neste navegador. Fechar a aba ou reabrir a plataforma no mesmo endereço mantém esse histórico. Experimente “continuar de onde paramos”, “quais cursos mais procurei?” e “recomende um curso para mim”. O ranking é pessoal, baseado nas perguntas e visitas às fichas; não representa a procura de todos os alunos. As recomendações consideram as preferências e interesses salvos e deixam de fora cursos inscritos, conclusões informadas e ofertas em breve.

Para registrar uma conclusão, diga “já concluí Excel”, por exemplo; “ainda não concluí Excel” corrige o registro. Inscrição não significa conclusão, e essa memória não comprova certificação. O painel “Sua memória com a Tortuguita” mostra os interesses e conclusões e permite apagar a memória desse perfil sem remover suas inscrições. “Reiniciar conversa” limpa as mensagens e o assunto atual, preservando interesses, preferências e conclusões. São mantidas até 81 mensagens recentes; os interesses e conclusões continuam salvos além dessa janela.

Sem perfil, o chat dura apenas enquanto a página estiver aberta. Se o navegador bloquear a gravação, o chat continua funcionando e avisa que a memória está disponível somente nesta página. A memória do chat não é sincronizada entre dispositivos: limpar os dados do site ou encerrar uma sessão privada pode removê-la, mesmo quando uma inscrição continua registrada no servidor. Sair oculta a memória ao remover o perfil local, mas não apaga seu histórico salvo; use “Apagar minha memória” antes de sair se desejar removê-lo. O assistente não precisa receber documentos, senhas ou informações bancárias.

O catálogo compartilhado está em `shared/courses.mjs` (reexportado em `src/app/data/courses.ts`), o conhecimento editorial em `src/app/data/tortuguitaKnowledge.ts` e a interpretação em `src/app/services/tortuguita.ts`. Consulte [a manutenção da Tortuguita](docs/tortuguita-knowledge.md) antes de acrescentar respostas e valide mudanças com `npm test` e `npm run test:e2e`.

## Testes e build

[Relatório da regressão de 20/10/2026](docs/relatorio-regressao-2026-10-20.md): login Google simulado, inscrições no perfil e no banco, nove ofertas disponíveis e 350 verificações contabilizadas. Repetir os testes específicos: `npm run test:google` e `npm run test:enrollments`.

```bash
npm test
npm run build
npm run test:e2e
npm run test:mobile
npm run test:chatbot
```

No PowerShell, substitua `npm` por `npm.cmd`. `npm test` inclui testes de regras, armazenamento, cliente HTTP, validações, segurança, inicialização em portas alternativas, SQLite e rotas serverless.

`npm run test:chatbot` verifica conversa guiada, continuidade, correção de preferências, explicação simplificada, feedback e próximos passos em desktop e telefone, medindo o tempo de processamento e de exibição da resposta. Consulte [o relatório da Tortuguita](docs/validacao-chatbot-2026-10-20.md). Os critérios de qualidade são tarefas verificáveis; satisfação real depende da avaliação dos usuários.

Os testes usam bancos SQLite temporários e um serviço ViaCEP local controlado; preservam o banco de desenvolvimento. O teste serverless exercita controllers, models e SQL com transporte Neon isolado, sem credenciais de produção.

O teste `npm run test:mobile` verifica 12 configurações iniciais de telefone/tablet no Chromium, além de rotação, altura reduzida e seis regressões específicas. Ele exercita menu, busca, filtros, favoritos, seções do curso, cadastro, inscrição com conferência no SQLite, histórico Voltar/Avançar, fonte ampliada, tema escuro, políticas, caixa Google e chat. Consulte a [validação móvel de 20/10/2026](docs/validacao-mobile-2026-10-20.md) para os resultados e limites. A emulação não substitui a validação em Safari nem em aparelhos Android/iOS reais.

Para também executar WebKit, instale o navegador compatível com a versão local do Playwright (`node node_modules/playwright-core/cli.js install webkit`) e defina `MOBILE_ENGINES=chromium,webkit` no ambiente antes do teste. Um motor solicitado e ausente faz o comando falhar; ele nunca é contado como aprovado. `PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH` permite indicar uma instalação compatível e `MOBILE_TEST_ARTIFACTS` define a pasta dos relatórios e capturas.

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
  

## Inscrição diretamente na plataforma

Ao concluir o cadastro iniciado por um curso, o perfil e sua sessão são criados e a interface solicita a inscrição automaticamente ao servidor. Em um perfil existente, o aluno escolhe o curso, revisa os dados e clica em **Confirmar minha inscrição**. Só mostramos sucesso depois da confirmação da gravação. Falhas preservam o perfil e permitem tentar novamente sem refazer o cadastro.

Não é necessário Resend, provedor de e-mail, código ou link externo. As antigas operações públicas de envio e confirmação por e-mail retornam 410; links antigos orientam a voltar à plataforma, sem criar sessão ou inscrição. Inscrições já confirmadas permanecem válidas. Pedidos antigos pendentes não são convertidos automaticamente: precisam ser confirmados na plataforma por uma sessão válida.

A API valida a sessão contra o cadastro, a disponibilidade do curso e o limite de três inscrições por mês, incluindo cancelamentos. Repetições e cliques simultâneos não duplicam inscrições. O cancelamento continua disponível por três dias. Sessões aleatórias têm seus hashes armazenados em `profile_sessions`; a implantação pública deve usar HTTPS para proteger essas credenciais em trânsito. O cadastro e sua sessão inicial são criados na mesma transação nos dois bancos.

Perfis antigos sem credencial de sessão, ou com sessão expirada/revogada, precisam entrar novamente com Google (quando configurado); o ID e o e-mail locais não concedem acesso ao cadastro. Não é seguro emitir uma sessão apenas porque alguém conhece esses dados. O cadastro novo funciona sem configuração Google ou de e-mail; recuperação de acesso via Google continua dependendo do OAuth configurado.

Os termos exibidos vêm de `shared/policies.mjs`; a versão deve ser atualizada junto com mudanças nos textos. O servidor conserva a cópia dos termos aceitos nos novos cadastros, sem reescrever os registros anteriores. E-mail é apenas um campo de contato e não é considerado verificado pelo cadastro direto.

## Cadastro, entrada e recuperação com Google

A página Entrar / Cadastrar oferece **Continuar com Google** quando o servidor está configurado. O botão abre uma caixa acessível e adaptada ao celular, com o botão oficial Google Identity Services e sugestões One Tap/FedCM quando disponíveis no navegador. O SDK só é carregado depois que o usuário abre essa caixa. A plataforma não consulta nem desenha uma lista de contas salvas e não solicita a senha Google. O Google ou o próprio navegador controlam quais contas aparecem; se a sugestão não aparecer, o botão oficial permite escolher uma conta. **Continuar com Google em outra página** mantém o fluxo OAuth como alternativa para bloqueios de pop-up, SDK ou políticas do navegador.

Quando já existe um cadastro, a entrada associa a conta Gmail ou Google Workspace verificada a esse perfil. Para uma pessoa nova, o Google inicia um cadastro: nome e e-mail são pré-preenchidos, e o usuário completa CPF, nascimento, endereço de Vitória-ES, demais campos obrigatórios e consentimentos. O e-mail confirmado não pode ser trocado nessa tentativa. Nenhum perfil incompleto ou inscrição é criado apenas ao escolher uma conta Google. Na primeira associação verificada com Google, as sessões anteriores desse cadastro são revogadas para impedir que credenciais emitidas antes da verificação de identidade mantenham acesso. Após essa associação, a identidade é reconhecida pelo `sub` estável do Google, não apenas pelo texto do e-mail. Contas externas ao Gmail sem domínio Workspace verificado são recusadas. A entrada não cria cadastro incompleto e não confirma novas inscrições em cursos; cada inscrição deve ser confirmada diretamente na plataforma.

Para ativar:

1. No Google Cloud, crie um projeto, configure a tela de consentimento OAuth e selecione os escopos básicos `openid`, `email` e `profile`. Em modo de testes, adicione os usuários autorizados a testar. Para público geral, publique o aplicativo conforme os requisitos do Google.
2. Crie um cliente OAuth do tipo **Aplicativo da Web**. Em **Origens JavaScript autorizadas**, cadastre a origem exata do site, como `https://SEU-DOMINIO` ou `http://localhost:5173` (sem caminho). Cadastre a URI de redirecionamento exata `https://SEU-DOMINIO/api/auth?action=callback`. Em desenvolvimento no computador, use `http://localhost:5173/api/auth?action=callback` com `APP_BASE_URL=http://localhost:5173`. Não use `0.0.0.0` como endereço de redirecionamento.
3. Configure no servidor `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `APP_BASE_URL` (origem canônica do site). O segredo nunca deve ter prefixo `VITE_`, aparecer no Git ou ser enviado pela conversa. No Windows local, utilize o arquivo `.env` ignorado pelo Git e reinicie `npm.cmd run dev`.
4. Permita HTTPS de saída para `oauth2.googleapis.com` e `www.googleapis.com`. O navegador precisa de acesso a `https://accounts.google.com/gsi/client`, aos frames e às conexões GSI do Google. A CSP de produção autoriza somente esses endereços adicionais e o COOP permite os pop-ups de login. A alternativa de redirecionamento leva a `accounts.google.com`. O OAuth usa código de autorização, PKCE S256, nonce e estado assinado com validade de dez minutos em cookie HttpOnly/SameSite. Produção exige HTTPS e cookies Secure.
5. Teste com uma conta própria ainda não cadastrada: escolha Google, clique em Completar meu cadastro e preencha o formulário. Depois, saia e entre novamente com a mesma conta para conferir o perfil e as inscrições recuperadas. Para celular, use a origem pública HTTPS configurada; o endereço HTTP por IP local não é uma configuração suportada para esse login Google.

Sem essas variáveis, a interface informa que a entrada ainda está indisponível e não simula autenticação. A integração Google é independente da inscrição direta. O perfil e as inscrições confirmadas do servidor são recuperados; fotos, favoritos, edições locais e memória do chat não são sincronizados entre aparelhos. Sessões existentes em outro aparelho continuam válidas; Sair revoga somente as credenciais da sessão atual quando a solicitação chega ao servidor.

A sessão Google usa cookie HttpOnly e seu hash fica em `profile_sessions`, com validade de 90 dias. Para compatibilidade com o cancelamento de inscrições existente, o cliente autenticado também recebe a credencial de sessão e a armazena com o perfil local; isso mantém o risco residual de exposição em caso de XSS. As identidades ficam em `google_identities`, criada automaticamente nos dois bancos. O servidor valida assinatura RS256, emissor, destinatário, expiração, nonce e e-mail verificado; retornos nunca contêm tokens Google, CPF ou o payload integral do cadastro.

A confirmação inicial de cadastro Google é uma credencial opaca em cookie HttpOnly/SameSite (Secure em produção), válida por 30 minutos; somente o hash e os dados verificados necessários ficam em `google_signup_intents`. O cadastro, o vínculo à identidade Google, a sessão e o consumo dessa confirmação são gravados na mesma transação/consulta atômica. Falhas não deixam perfil parcial e preservam a tentativa para corrigir os dados. Uma confirmação consumida, cancelada ou expirada não pode criar outro perfil. Dados de identidade enviados no corpo do formulário não concedem vínculo Google. A pessoa pode cancelar e continuar sem Google. O curso escolhido é preservado quando o navegador permite sessionStorage; essa informação não concede autorização e a inscrição continua validada no servidor.

O retorno Google Identity Services é enviado por POST ao servidor e validado por assinatura, emissor, aplicativo, expiração e nonce. Cada caixa de entrada recebe um desafio vinculado a um cookie HttpOnly/SameSite (Secure em produção), válido por dez minutos. Somente hashes de desafios são guardados em `google_login_challenges`; consumo atômico impede reutilização, inclusive entre instâncias serverless. Abrir uma nova tentativa invalida a anterior deste navegador. A saída também invalida o desafio pendente. JWTs Google nunca são gravados no perfil local nem enviados em URLs.

Os testes usam JWTs assinados com chaves locais, o SDK simulado no navegador e um provedor isolado/injetado; não usam uma conta Google real. A validação final do OAuth publicado exige as credenciais e a URI de redirecionamento configuradas no Google Cloud.

Para verificar especificamente a recuperação de contas existentes, execute `npm run test:google` (no Windows, `npm.cmd run test:google`), com Node.js 24+ e Chrome/Chromium/Edge instalado. A suíte abre o frontend e a API reais em portas temporárias, cria duas pessoas e inscrições em SQLite descartável e simula somente a interface Google e suas chaves públicas. O servidor continua validando assinatura RS256, emissor, destinatário, expiração, e-mail verificado e nonce. As respostas de autenticação, recuperação de perfil e sessões não são simuladas. Nenhuma conta Google externa é criada ou utilizada, e os dados do desenvolvimento são preservados. Não use `TEST_URL` nessa suíte.

São verificados: primeiro acesso com o mesmo e-mail, identificação sem diferenciar maiúsculas e espaços, ausência de cadastro duplicado, preservação do nome e histórico de cursos, saída e nova entrada no celular, troca de pessoa com dados locais antigos, reconhecimento da identidade estável após mudança no e-mail, rejeição de identidade conflitante e de credenciais sem e-mail verificado ou com nonce incorreto. Uma conta Google sem cadastro segue para completar o formulário, sem acessar outro perfil nem criar um perfil incompleto. `npm test` também executa os testes dessas regras com o SQL de produção em PostgreSQL isolado via PGlite; isso não equivale a testar um banco Neon remoto ou uma conta Google real.

No formulário, nascimento usa digitação `DD/MM/AAAA`, máscara automática e teclado numérico no celular; a API continua recebendo `AAAA-MM-DD` e rejeita datas inexistentes ou futuras. O número do endereço é opcional tanto no formulário quanto na validação dos dois bancos; vazio é armazenado como string vazia.


Configuração local após criar o cliente no **Google Cloud** (não no serviço Auth0): crie `.env` na raiz do projeto, mantendo os valores somente no seu computador:

```dotenv
GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=SEU_SEGREDO_DO_CLIENTE
APP_BASE_URL=http://localhost:5173
```

Cadastre `http://localhost:5173` como origem JavaScript autorizada e `http://localhost:5173/api/auth?action=callback` como URI de redirecionamento. Reinicie `npm.cmd run dev` e abra o site exatamente em `http://localhost:5173`. Não envie o segredo pela conversa nem o adicione ao Git. `GET /api/auth?action=config` indica se as variáveis estão presentes, mas não valida as credenciais no Google. Para validar a integração real, escolha uma conta Google própria e complete o cadastro; os testes automatizados usam identidades assinadas e SDK isolado para não depender de credenciais reais.

Se a entrada continuar indisponível, execute na raiz do projeto:

```powershell
npm.cmd run auth:check
```

O diagnóstico informa quais variáveis faltam, alerta sobre `.env.txt` ou `.env.local` (a API lê `.env` e as variáveis do terminal) e compara o ID público com a API já em execução. Ele não exibe o segredo nem valida credenciais com o Google. Variáveis fornecidas pelo terminal ou pelo provedor de hospedagem têm prioridade sobre o arquivo. Se você mudou o segredo ou o endereço, reinicie a API mesmo quando o ID não mudou. A interface permite **Verificar novamente** depois de corrigir a configuração e diferencia falha na consulta de configuração ausente.

Para completar somente o endereço local quando ID e segredo já estão no `.env`:

```powershell
npm.cmd run auth:setup -- --origin http://localhost:5173
```

Também é possível baixar o JSON do cliente **Aplicativo da Web** no Google Cloud e importá-lo diretamente no computador:

```powershell
npm.cmd run auth:setup -- --credentials "C:\CAMINHO\client_secret_download.json" --origin http://localhost:5173
```

Esse comando preserva as demais configurações, grava somente no `.env` local ignorado pelo Git e recusa arquivos versionados ou links simbólicos. Nenhuma credencial é enviada pela rede. O JSON também contém um segredo: guarde-o fora do repositório; arquivos `client_secret*.json` são ignorados como proteção adicional. Após configurar, encerre o servidor com Ctrl+C e execute `npm.cmd run dev` novamente. Uma API antiga com login desativado ou outro ID impede a reutilização silenciosa da configuração incorreta; o comando orienta a reiniciá-la sem encerrar processos de terceiros.
