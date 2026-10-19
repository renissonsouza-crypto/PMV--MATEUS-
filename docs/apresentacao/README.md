# Uma jornada de possibilidades · Qualifica Vix

Apresentação visual de uso da plataforma para um público sem conhecimento em programação. Nesta edição, a **Tortuguita Vix guia os 34 slides**, com uma orientação curta para cada funcionalidade e sua apresentação própria preservada. Laranja, azul e branco conduzem a identidade visual. São **30 slides principais e 4 de consulta**, com duração sugerida de **23 minutos**, telas reais com dados fictícios e artes na paleta azul e laranja do site. Conteúdo referente à versão de **19/10/2026**.

![Capa da apresentação](capa.jpg)

## Baixar e apresentar

[**Baixar o pacote para apresentar no navegador**](https://github.com/renissonsouza-crypto/PMV--MATEUS-/raw/refs/heads/main/docs/apresentacao-qualifica-vix.zip)

1. Extraia o ZIP no seu computador.
2. Abra **APRESENTACAO.html** no Chrome, Edge ou outro navegador atual.
3. Pressione **F** para tela cheia e use as setas **← →** para navegar.
4. Use **I** para o índice, **N** para notas na tela atual ou **P** para um painel separado do apresentador.

O arquivo HTML contém as imagens, fontes, estilos e código. Funciona sem internet, sem instalação, Node.js, login ou serviço externo. Links para o guia e outras páginas precisam de conexão. O pacote inclui PDF estático, roteiro de fala e instruções. Se o repositório for privado, entre na sua conta GitHub com acesso antes de baixar.

No site publicado, a página também é disponibilizada em **`/apresentacao/`**, após a implantação desta revisão. A página utiliza scripts externos compatíveis com a política de segurança existente. A versão HTML independente continua disponível na raiz do projeto, em `presentation.html`.

## Recursos da apresentação

- Transições, telas em perspectiva, busca digitada, destaques que percorrem menus e filtros, etapas do cadastro, confirmação de inscrição e balões de conversa. As cenas duram vários segundos e depois estabilizam.
- Ilustração vetorial de Vitória, fotografias locais, capturas da plataforma e mascote oficial.
- Busca por assunto, índice filtrável e links diretos para cada slide.
- Notas de fala, mensagem principal, tempo sugerido e páginas do guia por slide.
- Painel separado com notas, próximo slide, cronômetro e controles sincronizados. Mova-o para outra tela antes de projetar.
- Apontador luminoso (**L**), pausa da projeção (**B**), atividade com cronômetro e navegação por gestos.
- Tortuguita animada: aceno, piscadas e entrada do balão. **M** pausa todas as animações; **R** ou **Rever animações** reinicia a cena atual. A preferência por movimento reduzido é respeitada.
- PDF com 34 páginas, texto selecionável e 34 marcadores de navegação.

## Atualização e validação

As fontes do roteiro ficam em `roteiro.json`, os estilos e controles em `public/apresentacao/deck.css` e `deck.js`, e os layouts em `scripts/build-presentation.mjs`. Não edite os HTML gerados diretamente.

```bash
npm run presentation:build
npm run test:presentation
npm run test:presentation:guided
npm run presentation:pdf
npm run build
```

No Windows, use `npm.cmd` se necessário. A exportação de PDF e os testes precisam de Chrome, Chromium ou Edge instalado; defina `CHROMIUM_PATH` quando o caminho não for reconhecido. Para executar os testes fora do Linux deste ambiente, indique o navegador com `CHROMIUM_PATH`. O PDF publicado recebeu compressão de imagens e marcadores com PyMuPDF, preservando texto e links.

Consulte [a verificação executada](VERIFICACAO.md), [os créditos](CREDITOS.txt) e [a licença das fontes](FONT-LICENSE.txt).
