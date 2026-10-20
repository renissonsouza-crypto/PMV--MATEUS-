# Conversação e qualidade da Tortuguita — 20/10/2026

A Tortuguita ganhou escolha guiada de cursos, continuidade após perguntas intermediárias, correção de preferências, recuperação de dúvidas e feedback na última resposta. São habilidades implementadas sobre a base revisada e o catálogo da plataforma; não houve treinamento de um modelo externo, contratação de API ou criação de conta.

## O que mudou

- “Quero ajuda para escolher um curso” pergunta a área e a modalidade antes de sugerir opções disponíveis. “Ainda não sei” apresenta exemplos, e “Cancelar ajuda” encerra a orientação.
- A conversa mantém critérios após uma pergunta diferente. Exemplo: online → pergunta sobre gratuidade → de noite continua pesquisando opções online à noite.
- “Sou iniciante” e “Na verdade prefiro de manhã” são entendidos como refinamentos, sem eliminar resultados por palavras comuns da conversa. “Qualquer modalidade” mantém a área escolhida.
- “Não entendi” e “Explique melhor” retomam o assunto e oferecem uma explicação menor e próximos passos. “Como faço agora?” após consultar um curso explica como seguir até a inscrição e conferir o perfil.
- A última resposta oferece “Ajudou, obrigado” e “Explicar melhor”. A avaliação positiva gera uma confirmação; a segunda opção inicia a recuperação da dúvida. Esse feedback não é enviado a um servidor.
- Foram removidas instruções antigas de solicitar e-mail ou usar link de confirmação. A orientação agora acompanha a inscrição direta na plataforma, com sucesso confirmado pelo servidor.

## Avaliação

`npm run test:chatbot` passou em **18/18 cenários**: 16 tarefas de aceitação e dois fluxos no navegador, em 390 e 1440 px. Os testes existentes do assistente e sua memória também continuam sendo executados por `npm test`.

Após as melhorias, a regressão geral passou em 52/52 cenários, a móvel em 18/18 (32 combinações de viewport), os testes unitários e de integração em 269/269 e o build foi aprovado.

As tarefas verificam resultados concretos: os cursos sugeridos existem e atendem aos filtros; a conversa preserva preferências; áreas sem oferta não recebem cursos inventados; a pessoa encontra um próximo passo; a orientação de inscrição corresponde ao fluxo atual; informações ausentes não viram promessas de certificado; pedidos de dados de terceiros são recusados. A memória descarta estados guiados desconhecidos.

No navegador, a pessoa percorre a orientação por área e modalidade, avalia uma resposta, consulta Excel na ficha real, reabre a conversa, pede uma explicação melhor e recebe os próximos passos. A conversa permanece utilizável com altura reduzida a 320 px, sem esconder o campo de mensagem. O teste verifica que a orientação não cria inscrições.

## Tempo de resposta observado

| Medição local | Resultado |
| --- | --- |
| Chamadas ao serviço de respostas | 32 amostras |
| Mediana de processamento | 8,79 ms |
| Percentil 95 de processamento | 13,16 ms |
| Maior processamento observado | 14,40 ms |
| Envio até exibição no navegador | 6 amostras; 22,87 a 39,13 ms |

Os tempos medem execução local e renderização no Chromium, sem uma API externa de IA. Não representam latência de internet, aparelhos reais, teste de carga ou garantia de tempo de produção.

## Quanto a resposta ajuda

A utilidade foi avaliada pelas tarefas acima e pelo destino correto no navegador, com 18 cenários aprovados. **Isso não equivale a uma nota de satisfação humana**. Os botões permitem à pessoa sinalizar que a resposta ajudou ou pedir outra explicação, mas não há coleta centralizada de avaliações nem estatística de satisfação real.

Os resultados completos, incluindo tempos individuais, estão em [chatbot-2026-10-20.json](chatbot-2026-10-20.json). As capturas e o relatório são gerados em `../artifacts/chatbot-2026-10-20`, ou em `CHATBOT_TEST_ARTIFACTS`. Para reproduzir, use Node.js 24+, dependências instaladas e Chromium/Chrome/Edge, depois execute `npm run test:chatbot` (`npm.cmd` no Windows).

Continuam os limites da plataforma: informações não publicadas exigem confirmação oficial; o chat não emite certificados, não garante vagas ou emprego e não executa inscrições ou alterações de dados em nome da pessoa. A validação de layout usa emulação Chromium; Safari/iOS e aparelhos físicos não foram executados neste ambiente.
