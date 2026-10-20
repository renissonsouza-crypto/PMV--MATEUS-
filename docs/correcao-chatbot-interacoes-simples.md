# Correção de interações simples da Tortuguita — 20/10/2026

O erro relatado foi reproduzido: “Como você pode me ajudar a encontrar cursos na plataforma?” era classificado como pesquisa. A palavra “ajudar” virava um requisito de conteúdo; os critérios de Tecnologia e inscrições disponíveis de uma conversa anterior eram reutilizados, produzindo a falsa impressão de que não existiam opções para aquela dúvida.

Agora, perguntas sobre usar a interface são respondidas antes da escolha guiada e da consulta ao curso anterior. A resposta explica:

> Abra Cursos e use Buscar cursos, áreas ou palavras-chave. […] Você também pode combinar a busca com Categoria e Modalidade.

As sugestões permitem iniciar a escolha guiada, entender os filtros ou consultar categorias. Os critérios antigos continuam disponíveis para retomar uma pesquisa, mas não são aplicados à explicação.

Outras correções incluídas:

- Perguntas sobre filtros recebem instruções sobre Categoria, Modalidade e Limpar filtros.
- Pedidos gerais de ajuda explicam as capacidades e oferecem próximos passos.
- Perguntas sobre entrar ou recuperar a conta orientam a entrada com Google quando disponível.
- Interromper uma escolha guiada não cancela inscrições nem altera dados do perfil.
- Pedidos como “Me mostre cursos online” mantêm os resultados filtrados na conversa, sem serem substituídos por uma navegação ao catálogo completo.
- Perguntas sobre cursos reais, áreas sem oferta e consultas a um curso específico mantêm seus comportamentos próprios.

## Validação

Foram adicionados **64 testes de regressão**, incluindo 12 perguntas em cinco contextos: conversa nova, busca anterior em Tecnologia, escolha de área, escolha de modalidade e ficha de Excel aberta. Os testes verificam intenção correta, conteúdo útil, preservação do contexto, ausência de navegação indevida e limites de privacidade.

Os testes de navegador agora incluem a pergunta exata da imagem e dúvidas sobre filtros, conta e capacidades no meio da escolha guiada. Em telas de 390 e 1440 px, a pessoa recebe as explicações, continua com “Online” e obtém as duas opções reais de Tecnologia online. O teste também verifica que não houve envio automático de cadastro, inscrição ou alteração de perfil.

Resultados:

- `npm test`: **333/333** testes unitários e de integração; scripts de validação, segurança, SQLite e contratos serverless aprovados.
- `npm run test:chatbot`: **18/18** cenários aprovados, com os dois fluxos de navegador ampliados.
- `npm run test:e2e`: **52/52** cenários gerais aprovados.
- `npm run build` e `git diff --check`: aprovados.

Os testes usam dados temporários. A verificação de navegador foi feita em Chromium; não representa uma validação em Safari ou aparelhos físicos. Esses cenários reduzem as falhas conhecidas, sem garantir que toda formulação possível em linguagem natural será interpretada corretamente.

Arquivos: `src/app/services/tortuguita.ts`, `tests/tortuguita-platform-help.test.mjs` e `tests/chatbot-quality.mjs`. Os comandos acima permitem reproduzir a validação.
