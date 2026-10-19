# Verificação da apresentação Qualifica Vix

Data: 19/10/2026. Arquivo: `presentation.html`.

A suíte `npm run test:presentation` concluiu **16 verificações, sem falhas**, no Chromium 154.0.8037.57. Ela abre uma cópia local da apresentação, sem iniciar a API e sem utilizar contas ou informações pessoais.

| Verificação | Resultado |
| --- | --- |
| 34 slides: 30 da apresentação e 4 de consulta | Passou |
| Imagens e fontes incorporadas, notas e referências ao tutorial | Passou |
| Um único slide ativo; slides inativos ocultos de leitores de tela e sem interação | Passou |
| Setas, espaço, Home/End, limites e indicador de progresso | Passou |
| Índice, busca com ou sem acentos, filtros e acesso a um assunto | Passou |
| Notas atualizadas a cada slide, fechamento dos painéis e retorno do foco | Passou |
| Pausa de efeitos, pausa da projeção e apontador luminoso | Passou |
| Cronômetro da atividade: início, pausa, reinício, término e saída do slide | Passou |
| Painel separado do apresentador: notas e navegação sincronizadas | Passou |
| Link direto para um slide de consulta e recarregamento | Passou |
| Todos os slides e controles em 1366 × 768 | Passou |
| Todos os slides e controles em 390 × 844 | Passou |
| Todos os slides e controles em 844 × 390 | Passou |
| Gestos horizontais, preferência por movimento reduzido e armazenamento bloqueado | Passou |
| HTML em contexto sem rede; nenhuma requisição HTTP externa durante o uso | Passou |
| Impressão: 34 slides consecutivos, no formato 16:9 | Passou |

O teste mantém o tráfego externo bloqueado e falha se a apresentação tentar buscar uma imagem, fonte, script ou outro recurso na internet. Links externos de consulta só precisam de internet quando são abertos pelo usuário. A verificação da impressão não exporta um PDF; a geração e a revisão do PDF são etapas separadas.

## Repetir os testes

Com as dependências do projeto e o Chromium instalados:

```bash
npm run test:presentation
```

Para indicar outro executável do Chromium, configure `CHROMIUM_PATH`. Para escolher o local do relatório JSON, configure `PRESENTATION_TEST_ARTIFACTS`. Por padrão, o relatório fica em `../artifacts/apresentacao-qualifica-vix/test-results.json`, em relação à raiz do repositório. O relatório registra os resultados individuais e a versão do navegador.

## Alcance da validação

A abertura nativa de endereços `file://` é bloqueada pela política do navegador gerenciado deste ambiente. Por isso, a independência de rede foi verificada carregando o próprio HTML em um contexto offline do navegador, além dos testes por HTTP local. Essa limitação não deve ser apresentada como uma abertura nativa do arquivo testada aqui.

As dimensões de telefone foram simuladas no Chromium. Os resultados não substituem testes em aparelhos Android físicos, no Safari ou em iPhone/iPad. A entrada em tela cheia depende das permissões do navegador; este ambiente gerenciado a bloqueia, então a suíte não afirma ter validado esse modo.

O conteúdo apresenta a versão analisada em 19/10/2026. Disponibilidade de cursos e configuração do login Google devem ser conferidas na instalação utilizada durante uma demonstração ao vivo.

## Revisão visual, PDF e versão hospedada

Os 34 slides foram capturados e revisados em 1920 × 1200, com verificação de enquadramento e carregamento das imagens. Nenhum elemento de conteúdo ultrapassou o rodapé ou as laterais na verificação executada. A diagramação usa uma área de apresentação 16:9, ajustada ao espaço disponível.

O PDF final possui **34 páginas, 34 marcadores e texto selecionável**. As imagens foram comprimidas para reduzir o arquivo para aproximadamente 4,5 MB, mantendo o conteúdo textual. A cópia estática foi conferida separadamente dos testes do HTML.

`npm run build` concluiu com sucesso. A página produzida em `dist/apresentacao/` foi servida com os mesmos cabeçalhos de segurança de `vercel.json`: scripts externos, imagens, fontes, navegação e painel do apresentador funcionaram sem erros de política de conteúdo. Isso verifica o artefato de implantação localmente; não comprova uma implantação na Vercel. O build mantém o aviso já existente sobre o tamanho do pacote principal da aplicação.

## Edição guiada pela Tortuguita

A revisão acrescenta a Tortuguita com uma orientação específica nos **34 slides**, preservando o slide 24 dedicado à apresentação da assistente. A paleta usa azul `#0057d9`, laranja `#ff8500` e branco. Texto marinho sobre laranja mantém contraste adequado. As descrições agora explicam as ações de cada menu ou recurso com frases curtas.

A suíte adicional **`npm run test:presentation:guided` passou 10 verificações**, totalizando **26 verificações funcionais sem falhas** junto da suíte original. Ela verificou:

- Falas distintas, personagem e controle de repetição em todos os slides.
- Preservação da apresentação dedicada à assistente e cores renderizadas.
- 68 enquadramentos em 1366 × 768 e 1920 × 1080, sem a faixa da guia cobrir imagens ou textos principais.
- Mudanças visuais reais nas cenas de menu, busca, cadastro, confirmação, inscrição e chat.
- Pausa e retomada de animações CSS e de cenas programadas, repetição com R e com o botão visível.
- Cancelamento da cena anterior ao navegar e respeito ao movimento reduzido.
- Impressão durante uma animação: os 34 slides e suas guias ficam visíveis em estado estável.

As animações incluem digitação ilustrativa da busca, percursos de destaque, telas em perspectiva, passos em sequência, confirmação visual, balões e acenos/piscadas da personagem. R repete a cena atual; M pausa todas as animações. A impressão cancela os efeitos em andamento para preservar o conteúdo. Não há avanço automático dos slides.
