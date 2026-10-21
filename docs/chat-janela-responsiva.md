# Tamanho e organização da janela da Tortuguita

Validação de 20/10/2026.

O tamanho inicial passou de 390 × 580 para até **480 × 680 pixels**. A janela respeita o espaço disponível, as áreas seguras da tela, a rotação e a altura do teclado. O campo de mensagem permanece separado da rolagem da conversa.

## Como ajustar

- **Ampliar chat**, no cabeçalho, usa a altura disponível e até 860 pixels de largura. **Restaurar tamanho do chat** volta ao tamanho anterior.
- Em telas a partir de 640 pixels, arraste o canto superior esquerdo para ajustar largura e altura. O controle também aceita setas: esquerda/cima aumentam; direita/baixo diminuem; Shift muda o passo de 20 para 40 pixels. Toque com arraste está habilitado em tablets.
- O tamanho escolhido fica salvo neste navegador. A janela encolhe quando necessário sem substituir essa preferência; ao voltar a uma tela maior, recupera o tamanho escolhido. As dimensões personalizadas são limitadas a 320–1200 pixels e recortadas ao espaço da tela.
- **Opções do chat → Restaurar tamanho padrão** remove o ajuste personalizado. Preferência inválida ou armazenamento bloqueado não impede o uso do chat.
- Em celulares, use o botão de ampliação para alternar o tamanho. O arraste do canto fica oculto em telas estreitas. Abrir o chat com toque não aciona o teclado até a pessoa escolher o campo de mensagem.

## Menos informações simultâneas

Memória, aprendizado, exclusão de avaliações e restauração do tamanho ficam em **Opções do chat**. Esse painel tem rolagem limitada para preservar o campo de mensagem. Avisos de falha continuam aparecendo mesmo com as opções fechadas.

O início mostra duas perguntas rápidas. **Ver sugestões de perguntas** mostra outras; elas também aparecem durante a digitação e são recolhidas após o envio. Cumprimentos e orientações guiadas mantêm duas escolhas rápidas à vista para continuar a interação. **Avaliar resposta** revela as opções de avaliação. **Explicar melhor** permanece disponível ao lado. Consentimento, exclusão de dados, navegação e respostas do assistente foram preservados.

## Verificações executadas

| Comando | Resultado |
| --- | --- |
| `npm run test:chat-window` | 7/7 cenários: organização, arraste com mouse e toque, setas, limites mínimo/máximo, tamanho salvo, ampliação/restauração, rotação, alturas reduzidas e armazenamento bloqueado. |
| `npm run test:chatbot-learning` | 5/5 cenários, incluindo acesso às opções recolhidas, votos, falhas, exclusão e sincronização da permissão entre abas. |
| `npm run test:chatbot` | 18/18 verificações de conversa e qualidade, incluindo desktop e telefone. |
| `npm run test:mobile` | 18/18 cenários em 32 combinações de navegador/tamanho, incluindo fonte ampliada, tema escuro, memória expandida e altura reduzida. |
| `npm run test:e2e` | 52/52 verificações gerais da plataforma. |
| `npm test` | Regras, integração, validação, segurança, banco e rotas serverless aprovados. |
| `npm run build` | Build de produção aprovado. |

Os testes usam Chromium e bancos temporários. O arraste com toque usa eventos de toque do navegador; a redução de altura simula espaço ocupado pelo teclado. Não substituem testes com teclado real, Safari ou aparelhos Android/iOS físicos. A implantação publicada não foi validada nesta rodada.

Código: `src/app/hooks/useChatWindow.ts`, `src/app/components/TortuguitaChat.tsx` e `src/styles/mobile.css`. A suíte específica está em `tests/chat-window.e2e.mjs`; capturas e resultados locais são gravados em `../artifacts/chat-window`.
