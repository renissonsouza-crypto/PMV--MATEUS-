# Aprendizado por recompensas da Tortuguita

Implementado em 20/10/2026. A base revisada passa a ter **51 temas e 440 perguntas de referência**, com novos exemplos de pesquisa, filtros, cadastro, recuperação de conta, inscrições, privacidade e avaliação do chat.

O aprendizado automático usa uma política de escolha por recompensas (**contextual bandit**) que aprende qual apresentação ajuda mais em cada tema. A política escolhe entre o texto revisado e o mesmo conteúdo organizado por etapas. As duas versões preservam integralmente fatos, ações e regras. Não há contratação de uma API de IA nem treinamento de um modelo de linguagem externo.

## Uso na plataforma

1. Abra a Tortuguita, entre em **Opções do chat** e expanda **Melhorar a Tortuguita**.
2. Marque **Permitir aprendizado com minhas avaliações**. A permissão é opcional e vale para as próximas respostas.
3. Faça uma pergunta. Em temas elegíveis, o servidor seleciona o formato usando as avaliações recebidas.
4. Abra **Avaliar resposta** e responda se a orientação ajudou a localizar a informação correta. **Ajudou, obrigado** registra recompensa positiva. Em **Não ajudou**, escolha **Não localizei a informação**, **Resposta confusa** ou **Informação incorreta**.
5. Use **Explicar melhor** para continuar a conversa. Para encerrar novas contribuições, desmarque a permissão. **Apagar minhas avaliações** retira os votos enviados por este navegador.

Sem permissão, a conversa e os botões de ajuda continuam funcionando, com avaliação apenas local. Sem banco ou conexão, o chatbot entrega a resposta revisada; uma avaliação que falhe não aparece como registrada. A exclusão que falhe informa o erro e permite nova tentativa.

## Política de reforço

| Elemento | Implementação |
| --- | --- |
| Contexto | Tema reconhecido da orientação. |
| Ações | `direct`: texto revisado; `steps`: os mesmos fatos organizados por etapas. |
| Recompensa | `found`: +1; `not_found`, `confusing`, `incorrect`: −1. |
| Estimativa de utilidade | Média posterior Beta(2,2): `(votos positivos + 2) / (votos + 4)`. |
| Poucos dados | Exploração entre as duas versões até haver oito votos, com pelo menos dois para cada formato. |
| Aprendizado consolidado | 90% de seleção da melhor estimativa e 10% de exploração. |
| Atualização | A próxima seleção consulta os votos no banco; não depende de uma execução manual de treinamento. |
| Janela | Votos dos últimos 30 dias e da versão atual da política. |

Temas adaptativos: busca, filtros, categorias, cadastro, etapas de cadastro, entrada na conta, consulta de inscrições e capacidades do assistente. Respostas de baixa confiança, navegações automáticas, consultas pessoais e fatos específicos dos cursos usam o fluxo revisado. O aprendizado não executa inscrições, cancelamentos ou alterações no perfil.

Três registros de informação incorreta no mesmo tema pausam a promoção de formatos e mantêm a apresentação padrão. Qualquer registro desse tipo aparece nas contagens do relatório operacional para revisão editorial. Não existe notificação automática a um atendente nem correção de fatos por votação. Após uma mudança substancial de orientação, revise `CHAT_POLICY_VERSION` para iniciar uma nova política sem misturar avaliações de versões antigas.

## Persistência, privacidade e integridade

- SQLite no desenvolvimento e PostgreSQL na rota Vercel `/api/chat-learning`, usando o mesmo SQL parametrizado. O banco existente da plataforma é reutilizado.
- Registros contêm tema, formato, versão, recompensa, motivo, datas, hash do ticket e hash de um identificador aleatório do navegador. Não contêm perguntas, respostas, CPF, e-mail, documento, IP ou identificador de conta. O cookie é HttpOnly, SameSite=Strict, limitado à rota e Secure em HTTPS.
- A permissão fica separada por perfil no navegador. As avaliações enviadas têm identificação técnica por navegador, sem vínculo com o cadastro. A exclusão remove os votos desse navegador, inclusive os enviados em outras sessões no mesmo navegador.
- Ticket de avaliação válido por 15 minutos, vinculado ao navegador e à versão da política. Um voto por tema, navegador e dia UTC; repetição idêntica é idempotente. Uma mudança de voto ou outro ticket para o mesmo tema no dia é rejeitado por índice único, inclusive sob concorrência.
- Limite de 30 tickets por navegador e dia, com contador atômico. Esse mecanismo não verifica identidade humana; limpar cookies ou usar novos navegadores contorna a identidade técnica. A política permanece limitada a apresentações previamente revisadas mesmo diante de avaliações manipuladas.
- Requisições de outra origem, formatos inválidos, texto livre, campos adicionais e temas desconhecidos são rejeitados. Erros de banco não expõem credenciais.
- Votos antigos saem do cálculo após 30 dias; registros antigos e tickets expirados sem voto são removidos durante novas emissões. Contadores técnicos de requisição têm limpeza independente em até 30 dias durante esse processamento. Não há tarefa agendada de limpeza em instalações sem uso.
- O cliente limita a espera pelo aprendizado a três segundos e usa a resposta revisada em caso de falha. Reiniciar a conversa ou mudar de página invalida uma seleção pendente, impedindo que a resposta antiga volte depois.

A política de privacidade foi atualizada para `2026-10-20.1`; recibos já aceitos continuam arquivados com sua versão original. `CHAT_LEARNING_ENABLED=false` desativa novas seleções adaptativas e mantém a possibilidade de apagar avaliações anteriores.

## Operação e testes

```bash
npm test
npm run test:chatbot
npm run test:chatbot-learning
npm run test:e2e
npm run test:mobile
npm run build
npm run chatbot:report
```

No Windows, use `npm.cmd`. O relatório operacional executa somente leitura e mostra votos, avaliações positivas, relatos de informação incorreta e a preferência aprendida quando há dados suficientes. Não exporta identificadores de navegadores nem tickets. Com PostgreSQL configurado, lê esse banco; sem ele, lê o SQLite de `DB_PATH` ou `data/qualificavix.sqlite`. O comando `npm run db:migrate` prepara também as tabelas de aprendizado na implantação PostgreSQL.

Os testes de política cobrem recompensas, exploração, pausa para revisão, integridade do texto e isolamento de temas. O SQL é executado em SQLite e em PostgreSQL local via PGlite, incluindo votos simultâneos, cotas, repetição, expiração, exclusão, versão e a rota serverless. Os testes de currículo usam formulações diferentes dos novos exemplos e interrompem a escolha guiada com dúvidas sobre a plataforma.

A simulação controlada recompensa somente o formato por etapas: em 100 seleções com sorteios fixos, a política escolhe esse formato 50 vezes antes e 95 vezes depois de receber 20 avaliações positivas desse formato e 20 negativas do outro. **Esse resultado comprova o mecanismo na simulação; não mede uma melhora de 45 pontos na satisfação de usuários reais.**

Os testes no navegador exercitam consentimento, ausência de envio sem permissão, feedback positivo e negativo, votos repetidos, outro navegador, falha e repetição de gravação, exclusão com erro, retirada de permissão, altura reduzida, indisponibilidade, prazo de rede e reinício durante uma seleção. Os dados são descartáveis, sem contas externas nem banco de produção.

Resultado final: **378/378** testes unitários e de integração, **5/5** cenários do aprendizado no navegador, **18/18** de qualidade do chatbot, **52/52** gerais e **18/18** móveis em 32 combinações de viewport, com build e `git diff --check` aprovados. A retirada da permissão entre abas também foi validada. O [relatório estruturado](chatbot-aprendizado-resultados-2026-10-20.json) registra cenários, tempos locais e limites. Na rodada de qualidade sem aprendizado habilitado, a mediana de processamento foi 21,96 ms; esses tempos não são uma garantia de desempenho da implantação ou da seleção adaptativa via rede.

Limites: avaliações são voluntárias e podem ter viés; satisfação percebida não comprova correção factual. O texto do usuário não é incorporado automaticamente à base editorial. Chromium com toque simulado não substitui testes físicos de Android ou Safari/iOS. A disponibilidade e a latência da implantação e do PostgreSQL remoto precisam ser verificadas no ambiente publicado.
