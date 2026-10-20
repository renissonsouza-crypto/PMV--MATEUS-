# Validação de navegação e responsividade — 20/10/2026

As falhas reproduzidas de busca, histórico e painéis foram corrigidas. A rodada final passou em **18/18 cenários móveis**, com **32 combinações distintas de largura e altura**, em Chromium 154.0.8037.57 com toque simulado. A regressão geral e o build também passaram.

Esta validação cobre layouts equivalentes aos de Android, iPhone e tablets. **Não certifica Safari nem aparelhos físicos**: o WebKit não estava instalado e o proxy do ambiente bloqueou o download oficial com HTTP 403. Não houve alteração na verificação TLS para contornar esse bloqueio.

## Problemas corrigidos

| Área | Comportamento reproduzido | Resultado da correção |
| --- | --- | --- |
| Busca no cabeçalho | Com fonte em 125%, a busca empurrava controles para fora da tela, inclusive em 640, 1280 e 1366 px. | A busca ocupa uma linha própria, com espaço reservado e controles dentro da largura disponível. |
| Voltar e Avançar | A troca de tela alterava somente o estado React; o comando Voltar saía da plataforma. | As telas passam a integrar o histórico do navegador, incluindo o identificador público do curso. Recarregar preserva a tela atual. |
| Histórico após sair | O histórico passou a precisar respeitar o encerramento da sessão. | Voltar para uma entrada de perfil após sair abre o cadastro; os dados pessoais não ficam no histórico. |
| Chat com memória expandida | Em 390×320, o campo de mensagem ficava abaixo do limite do painel. | Memória e avisos têm área de rolagem limitada, mantendo mensagem e envio acessíveis. |
| Políticas e caixa Google | Rolar o diálogo levava o botão de fechar para fora da tela. | Cabeçalho e fechamento permanecem visíveis; o conteúdo tem rolagem independente. |

O histórico guarda somente `page`, `courseId` e `scrollY`. A aplicação continua usando as verificações de sessão do servidor para operações de perfil e inscrição. Os ajustes da caixa Google são de layout; não mudam a autenticação.

## Cobertura móvel

| Configuração inicial | Área útil em pixels CSS |
| --- | --- |
| Android compacto | 320×658 |
| Android 360 | 360×740 |
| Pixel 7 — dimensões simuladas | 412×839 |
| iPhone SE — dimensões simuladas | 320×568 |
| iPhone 13 — dimensões simuladas | 390×664 |
| iPhone grande — dimensões simuladas | 430×932 |
| Paisagem compacta | 568×320 |
| iPhone em paisagem — dimensões simuladas | 844×390 |
| Android em paisagem — dimensões simuladas | 915×412 |
| Tablet 768 | 768×1024 |
| Tablet 834 | 834×1194 |
| Tablet em paisagem | 1024×768 |

Cada configuração percorreu menu, foco e bloqueio de rolagem, fonte ampliada para 125%, tema escuro, rotação, busca, filtros, favoritos persistidos, as seis seções do curso, páginas institucionais, termos, formulário e chat com altura reduzida. Foram verificados ausência de rolagem horizontal e alvos de toque de pelo menos 44 px nos controles exercitados. A passagem de tablet para desktop também verificou o fechamento do menu e a liberação da rolagem.

Em 360×740 e 390×664, o teste concluiu todo o cadastro, abriu o perfil, inscreveu a pessoa em um curso e comparou a inscrição com o SQLite temporário. Outros seis cenários verificaram especificamente:

1. Busca em 640×360 com fonte ampliada.
2. Histórico Voltar/Avançar entre telas.
3. Memória expandida e campo do chat acessível em 390×320.
4. Leitura até o fim dos termos em paisagem e fechamento sem voltar ao topo.
5. Rolagem das opções Google em 390×320 com fechamento acessível.
6. Voltar após sair sem reabrir o perfil anterior.

## Resultados finais

| Comando | Resultado |
| --- | --- |
| `npm test` | 269/269 testes unitários e de integração; validações, segurança, SQLite e contratos serverless aprovados. |
| `npm run test:e2e` | 52/52 cenários gerais aprovados. |
| `npm run test:google` | 14/14 cenários de Google aprovados. |
| `npm run test:enrollments` | 9/9 cenários; 46 leituras SQL e 271 verificações de consistência. |
| `npm run test:mobile` | 18/18 cenários; 32 combinações de viewport. |
| `npm run build` | Aprovado; permanece o aviso existente de pacote principal acima de 500 kB. |
| `git diff --check` | Aprovado. |

São **362 casos contabilizados**, além dos scripts complementares de validação. A suíte de inscrições verificou todas as nove ofertas disponíveis, duplicidade, cancelamento, limite mensal, isolamento entre pessoas e recuperação após falha. Os testes usam API real e bancos descartáveis, sem alterar dados de produção.

Ao preservar a tela no recarregamento, foi necessário tornar explícito o retorno ao Início nos helpers que preparam uma pessoa de teste. As verificações de autenticação, inscrição e isolamento foram mantidas.

## Limites da verificação

- Dimensões de iPhone no Chromium não equivalem a executar Safari/iOS. Teclado do sistema, recortes da tela, barras do navegador e gestos físicos precisam de conferência em aparelhos reais.
- A altura reduzida simula o espaço ocupado pelo teclado; não abre um teclado Android/iOS real.
- A caixa Google usa uma interface de provedor simulada. A suíte específica exercita validação de credenciais assinadas, sessões e persistência com chaves controladas, sem entrar em uma conta Google externa.
- Fotos remotas opcionais usam imagens de teste na suíte móvel. Disponibilidade de CDN e aparência dessas fotos não fazem parte da aprovação visual.
- Os testes de persistência são isolados; não certificam uma implantação externa ou conexão com o banco de produção.

## Reprodução

Com Node.js 24+, dependências instaladas e Chrome/Chromium/Edge disponível:

```bash
npm test
npm run test:e2e
npm run test:google
npm run test:enrollments
npm run test:mobile
npm run build
```

No Windows, use `npm.cmd`. A suíte móvel cria API, frontend e banco temporários e gera `results.json` e capturas em `../artifacts/mobile-2026-10-20`, ou na pasta definida em `MOBILE_TEST_ARTIFACTS`.

Para executar WebKit em um ambiente que permita sua instalação:

```bash
node node_modules/playwright-core/cli.js install webkit
MOBILE_ENGINES=chromium,webkit npm run test:mobile
```

No PowerShell, defina `$env:MOBILE_ENGINES="chromium,webkit"` antes de `npm.cmd run test:mobile`. Um motor solicitado e ausente provoca falha explícita; não aparece como aprovado.

Os resultados por cenário estão em [mobile-2026-10-20.json](mobile-2026-10-20.json). As capturas completas são geradas ao executar o teste. A revisão anterior às alterações é `66adc65`.
