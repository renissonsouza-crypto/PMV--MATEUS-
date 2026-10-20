# Regressão da plataforma · 20/10/2026

Os fluxos exercitados passaram: uma conta existente recupera o cadastro correto pelo Google simulado, e a inscrição confirmada aparece em **Cursos cadastrados** e na base SQLite temporária, vinculada ao usuário e ao curso corretos. Nenhum defeito bloqueante foi confirmado nesses fluxos. A revisão também identificou uma limitação de recuperação automática na página inicial, detalhada abaixo.

A aplicação analisada é a revisão `8c3250a`. As alterações desta rodada ampliam os testes e a documentação; não modificam o funcionamento da aplicação. As contas são fictícias, e as bases de teste são excluídas ao terminar. O banco de produção não foi acessado.

## Resultado executado

| Bateria | Resultado |
| --- | --- |
| Testes unitários e de integração | 269/269 |
| Fluxos gerais no navegador | 52/52 |
| Google: identidade, recuperação, sessões e inscrições | 14/14 |
| Integridade de inscrição: interface, API e SQLite | 9/9 |
| Configurações de tela móvel e tablet | 6/6 |
| Validação de cadastro, segurança, persistência SQLite e contratos serverless | Passaram |
| Build de produção | Passou |

São **350 verificações contabilizadas**, sem falhas finais, além dos scripts de validação listados separadamente. Os 269 testes incluem **13 casos com SQL e transações de produção PostgreSQL**, executados no PGlite local. Isso não verifica conectividade ou permissões no Neon de produção.

## Inscrição: o que foi comparado

A nova suíte fez **46 leituras SQL somente para consulta** e **271 comparações de integridade**. Para cada confirmação, comparou:

- O usuário e o curso retornados pela API com os enviados pelo formulário.
- O curso listado na aba **Cursos cadastrados**, inclusive após recarregar a página.
- `registration_id`, `course_id`, identificador da inscrição e horário no perfil e na linha do banco.
- `delivery = 'direct'`, confirmação preenchida e ausência de cancelamento na inscrição ativa.
- O histórico preservado ao cancelar, com remoção somente do curso cancelado da lista ativa.

A tabela autoritativa desse fluxo é **`course_enrollment_requests`**. A tabela `enrollments` é legada e não recebe as novas inscrições diretas. Para revisar registros em uma base autorizada, a consulta equivalente é:

```sql
SELECT id, registration_id, course_id, delivery, confirmed_at, cancelled_at
FROM course_enrollment_requests
WHERE registration_id = :registration_id
ORDER BY created_at, id;
```

Foram observados 20 vínculos distintos usuário/curso nesta suíte isolada: 18 ativos e 2 cancelados. Nenhum e-mail foi enviado. Confirmar inscrição ocorre dentro da plataforma.

## Catálogo disponível

Todas as nove ofertas disponíveis foram inscritas pela interface, em três contas fictícias para respeitar o limite mensal. A oferta em breve, Gestão de Projetos (ID 6), foi rejeitada pela tela e pela API, sem gerar inscrição.

| ID | Curso | Modalidade | Conferência |
| --- | --- | --- | --- |
| 1 | Introdução à Programação | Online | Perfil e SQLite conferidos |
| 2 | Excel do Básico ao Avançado | Online | Perfil e SQLite conferidos |
| 3 | Design Gráfico para Iniciantes | Presencial | Perfil e SQLite conferidos |
| 4 | Marketing Digital na Prática | Online | Perfil e SQLite conferidos |
| 5 | Desenvolvimento Web Completo | Online | Perfil e SQLite conferidos |
| 7 | Informática para o Mercado | Presencial | Perfil e SQLite conferidos |
| 8 | Atendimento ao Cliente | Online | Perfil e SQLite conferidos |
| 9 | Gastronomia Brasileira | Presencial | Perfil e SQLite conferidos |
| 10 | Eletricista Predial | Presencial | Perfil e SQLite conferidos |

Também passaram os cenários de cadastro completo em desktop e telefone, repetição simultânea sem duplicar inscrição, limite de três por mês incluindo canceladas, bloqueio de alteração de outra conta e resposta 503 sem falso sucesso. Após retirar a falha simulada, a nova tentativa criou uma única inscrição válida.

## Google: identidade e recuperação

O provedor de identidade e suas chaves são simulados. A aplicação verifica **tokens RS256 assinados**, nonce, expiração, destinatário, emissor e e-mail autorizado, utilizando a API, cookies e banco reais do ambiente isolado.

A suíte cobre conta existente, sugestão que devolve credencial sem clique adicional no botão de conta, recarregamento, retomada por cookie na rota de retorno, logout com revogação, troca de conta, outro navegador, identidade não verificada, nonce de outro navegador e novo usuário Workspace completando cadastro e inscrição.

Exemplos fictícios observados:

| Conta de teste | Resultado conferido |
| --- | --- |
| ID 8210, conta existente | Cursos ativos 1 e 4 na interface, sessão e SQLite; curso 2 cancelado somente no histórico; mesma inscrição recuperada ao entrar novamente. |
| ID 8232, nova conta Workspace simulada | Um único cadastro, identidade Google vinculada e curso 7 confirmado no banco e visível no perfil. |

A primeira entrada de um cadastro existente não gerou um segundo cadastro. Outra pessoa não recebeu seus cursos nem conseguiu alterar suas inscrições.

### Limitação observada no login automático

**A plataforma não seleciona silenciosamente uma conta Google ao abrir a página inicial.** O seletor é acionado pelo usuário e usa `auto_select: false`. Recarregar normalmente mantém o perfil salvo neste navegador.

Em uma verificação exploratória, apagamos apenas o perfil do armazenamento local, mantendo o cookie de sessão válido. O servidor retornou **200** em `/api/auth?action=session`, mas a página inicial continuou como visitante: ela não consulta automaticamente essa sessão. A rota `#google-login` recuperou corretamente o perfil e seus cursos. Isso foi registrado como limite funcional, sem alterar a aplicação nem criar um teste que imponha esse comportamento como desejado.

Esses resultados não comprovam acesso com uma conta Google real na instalação publicada. Não havia cliente OAuth ou acesso ao banco de produção configurado neste ambiente.

## Alcance e recursos externos

As configurações móveis foram simuladas no Chromium (iPhone SE, iPhone 13, Pixel 7, tela de 320 px, paisagem e tablet). Não foram testes em Safari ou aparelhos físicos.

As fotos opcionais do catálogo apresentaram erro de certificado no Chromium gerenciado. Uma requisição HTTPS independente ao mesmo provedor retornou 200 com TLS validado. A verificação TLS não foi desativada, e esses recursos externos não foram contados como fotos visualmente aprovadas. Os novos testes de integridade usam uma imagem de teste local para isolar autenticação e persistência. O build mantém o aviso existente sobre o tamanho do pacote principal.

## Repetir

```bash
npm test
npm run test:google
npm run test:enrollments
npm run test:e2e
npm run test:mobile
npm run build
```

Use Node.js 24+ e Chrome, Chromium ou Edge. Se necessário, defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. No Windows, use `npm.cmd`. Os testes específicos de Google e integridade exigem frontend e API temporários e não aceitam `TEST_URL`.

O [relatório estruturado](regressao-2026-10-20.json) contém resultados por cenário e observações do banco sem tokens de acesso. Os arquivos executáveis ficam em `tests/google-login.e2e.mjs`, `tests/enrollment-integrity.e2e.mjs` e no helper `tests/e2e-support.mjs`.
