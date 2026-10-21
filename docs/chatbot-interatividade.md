# Interações e continuidade da Tortuguita

O caso “ola boa noite” foi reproduzido: o reconhecedor antigo aceitava apenas cumprimentos com até duas palavras consideradas relevantes. A frase composta escapava desse limite e “noite” era interpretada como horário de estudo. A consulta ainda recebia “boa” como termo livre, gerando a resposta indevida de ausência de cursos.

## Comportamento implementado

- Cumprimentos compostos, acentos, emojis e variações comuns, como “oiii”, são reconhecidos antes das regras do catálogo.
- Saudações e cortesia são separadas do pedido. “Olá, boa noite! Quero cursos online de tecnologia, por favor” busca os cursos solicitados sem adicionar o período noturno. “Quero cursos presenciais de noite” continua aplicando o turno.
- Agradecimentos, confirmações curtas e despedidas preservam o assunto, as opções encontradas e as preferências. Um “sim” isolado pede uma escolha mais clara; não confirma inscrições ou alterações.
- A resposta considera a etapa da escolha, o curso selecionado, o assunto anterior e a página atual. “Você não entendeu”, “essa resposta está errada” e pedidos sucessivos de explicação mantêm o tópico para esclarecer a dúvida.
- Pedidos amplos, como “quero fazer um curso”, iniciam a escolha guiada. “Estou perdido” e “não sei usar o site” apresentam opções de ajuda.
- Duas escolhas rápidas ficam visíveis em orientações e interações sociais; outras continuam disponíveis em **Ver sugestões de perguntas**. Cumprimentos e agradecimentos não exibem avaliação de resposta ou **Explicar melhor**.

Exemplo validado: **olá boa noite → escolha de curso → Tecnologia → agradecimento → dúvida → Online**. A conversa retoma a pergunta sobre modalidade e termina com as opções reais de Tecnologia online, preservando o contexto.

## Integridade

A mudança usa regras locais e o conhecimento revisado existente. Não contrata serviços nem transforma o assistente em um modelo generativo. Perguntas e respostas não são enviadas a um serviço externo por esta implementação.

O processamento preserva sinais de pergunta, negações e o limite original de mil caracteres. Uma pergunta como “Olá, já concluí Excel?” não vira uma declaração de conclusão na memória. Permissão para aprendizado, isolamento de perfis, dados pessoais e confirmação de inscrições permanecem sob as regras existentes.

## Testes

| Verificação | Resultado |
| --- | --- |
| `npm test` | Validações, segurança, banco e rotas serverless aprovados; 391 testes unitários e de integração, incluindo 13 novos testes de interação. |
| Cumprimentos | 24 expressões em cinco contextos: 120 combinações sem buscas indevidas, mudanças de preferências ou navegação automática. |
| `npm run test:chat-interaction` | Duas conversas completas no navegador, em 390 e 1440 pixels, com escolhas por botão, interrupções, reparos, busca noturna real e altura reduzida. Sem gravações de cadastros, inscrições ou avaliações não consentidas. |
| `npm run test:chatbot` | 18/18 verificações de qualidade e continuidade. |
| `npm run test:chatbot-learning` | 5/5 cenários de consentimento, avaliações, falhas e exclusão. |
| `npm run test:chat-window` | 7/7 cenários de tamanho, teclado, arraste e responsividade. |
| `npm run test:e2e` | 52/52 verificações gerais. |
| `npm run build` | Build de produção aprovado. |

A suíte específica grava capturas e tempos locais em `../artifacts/chat-interaction`. Usa Chromium, toque emulado e banco temporário; não representa testes em aparelhos físicos ou Safari, nem uma medida de satisfação de usuários reais. A publicação em produção precisa concluir o processo de implantação do repositório.
