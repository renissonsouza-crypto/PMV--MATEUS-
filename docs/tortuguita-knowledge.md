# Conhecimento da Tortuguita

A Tortuguita orienta o uso do Qualifica Vix com regras verificáveis do projeto e informações do catálogo disponibilizadas à conversa. A ampliação usa uma base editorial, reconhecimento de perguntas e contexto; não representa o treinamento de um modelo externo com dados de usuários.

## Base editorial

`src/app/data/tortuguitaKnowledge.ts` contém 50 temas, 400 perguntas de referência, palavras e expressões de reconhecimento, respostas, sugestões de continuidade e destinos de navegação. Também exporta 12 perguntas rápidas e 8 descrições de capacidades. As perguntas servem para reconhecimento de formulações diferentes; a cobertura não se limita às frases exatas.

A base cobre exploração e escolha de cursos, filtros, modalidades, status, gratuidade, conteúdo, calendário, local, instituição, docentes, certificação, requisitos e limites dos resultados profissionais. Inclui cadastro em quatro passos, documentos, telefone com DDD, e-mail, endereço de Vitória-ES, consulta de CEP, responsável por menor de idade, acessibilidade, renda, consentimentos e notificações. Explica perfil, foto, armazenamento por navegador, recuperação indisponível, saída, privacidade, solicitações ao responsável, favoritos, inscrições locais, limite mensal, duplicidade e cancelamento. Há orientação para depoimentos, histórias ilustrativas, contatos, preferências visuais e erros comuns de execução e envio.

## Fontes e fatos que devem permanecer corretos

| Assunto | Fonte de implementação |
| --- | --- |
| Fluxo geral, execução local e limites da implantação | `README.md` |
| Etapas, campos, opcionais e consentimentos do cadastro | `src/app/views/RegisterView.tsx` |
| Formatos de telefone, idade e consulta de CEP | `src/app/services/registrationValidation.ts`, `server/models/validation.mjs` |
| Limite mensal e prazo exato para cancelamento | `src/app/services/enrollmentPolicy.js` |
| Perfil, histórico, favoritos, saída e armazenamento local | `src/app/services/api.ts` |
| Termos, privacidade e exclusão dos dados enviados | `src/app/components/PlatformPolicy.tsx` |
| Catálogo e dados de cada formação | `shared/courses.mjs`, `src/app/data/courses.ts` |
| Fichas, busca, inscrições, depoimentos e controles visuais | `src/app/views/AppView.tsx` |
| Preferências de leitura | `src/app/controllers/useAppController.ts` |
| Canais oficiais e configurações públicas de contato | `src/app/models/platformContact.ts` |

O cadastro pessoal e os depoimentos são enviados ao serviço. Novas inscrições ficam pendentes até confirmar o link pessoal enviado por Resend, válido por 24 horas; confirmações e cancelamentos são registrados no servidor. O link permite abrir o perfil do destinatário em outro navegador, mas não transfere fotos, favoritos ou memória do chat. Editar o perfil ainda não atualiza o cadastro remoto e Sair não exclui inscrições confirmadas. Não há login por senha nem emissão de certificados. Quando configurado, Continuar com Google recupera o cadastro existente e as inscrições do servidor após validar a identidade Google; número do endereço é opcional e nascimento pode ser digitado como DD/MM/AAAA. A mensagem de confirmação é operacional e independe da preferência opcional por novidades; não há campanhas automáticas de notícias ou WhatsApp.

O limite é de três inscrições realizadas por mês do calendário UTC, incluindo canceladas. O cancelamento é permitido por três dias corridos (72 horas) após a inscrição, até o instante final do prazo. A comparação mensal não usa uma janela móvel de 30 dias. Uma nova inscrição após cancelamento também conta para o limite.

Disponibilidade, modalidade, conteúdos, duração, carga horária, nomes das formações e menções a ofertantes devem vir do catálogo atual. A base editorial não fixa contagens de cursos ou de vagas. Algumas fichas mencionam SENAI ou SENAC e outras não identificam o executor; uma menção não comprova parceria ou oferta oficial desta edição. Datas exatas, professor, ofertante, edital, requisitos específicos, critérios de seleção, acessibilidade da unidade, emissão ou reconhecimento de certificados e benefícios materiais precisam de confirmação quando ausentes na ficha. O chatbot não pode transformar um tema NR-10, uma localização, uma história ilustrativa ou uma descrição de curso em prova de certificação, parceria ou emprego.

## Manutenção e validação

Ao mudar uma regra de domínio ou uma tela, revise o tema correspondente. Use palavras específicas e expressões completas para evitar que um termo genérico, como curso, capture perguntas de vários assuntos. Mantenha as sugestões ligadas a temas existentes e use apenas destinos suportados pelo tipo `Page`. Não inclua telefones, e-mails, senhas, documentos ou credenciais reais na base.

Para adicionar uma habilidade, descreva o comportamento que a plataforma realmente oferece e um limite claro. Navegação orientada não equivale a efetuar inscrição, cancelar, editar perfil, publicar um relato ou excluir dados. Essas ações devem permanecer nos controles próprios da interface e em seus fluxos de confirmação.

`AssistantReply.navigation` representa uma decisão de navegação automática, separada dos botões opcionais de `actions`. Pedidos explícitos de cadastro abrem `register` (ou `profile` se já houver perfil local). Consultas a um único curso identificado abrem sua ficha, com os dados do catálogo atual; pedidos para abrir favoritos, perfil, atendimento, catálogo, categorias, início e informações do projeto usam somente páginas internas. A interface fecha o chat ao mudar de destino e preserva as mensagens. Se a ficha ou página já está aberta, a conversa permanece visível para as próximas perguntas.

Não escolha automaticamente entre cursos ou destinos ambíguos. Negações, condicionais, comparações e solicitações de alteração de dados não devem acionar a navegação automática. As respostas de regras e requisitos continuam no chat; os botões existentes permanecem disponíveis. Ao testar novos comandos, verifique o destino real no navegador, a continuidade da conversa e a ausência de gravações ou inscrições automáticas.

## Memória por perfil

`tortuguitaMemory.ts` armazena uma memória versionada em `qualificavix-tortuguita-memory:<id do perfil>` no navegador. Restaura até 81 mensagens recentes e seu contexto, incluindo preferências de busca, sem executar novamente as navegações antigas. Mantém contagens de perguntas e visitas por curso e conclusões declaradas pelo usuário. Dados inválidos, destinos desconhecidos e cursos removidos do catálogo são descartados na leitura. Falhas de armazenamento usam memória de sessão com aviso, separada por perfil. Mensagens de visitantes não são transferidas para um cadastro novo.

Pedidos como “continuar de onde paramos”, “quais cursos mais procurei?”, “quais cursos já concluí?” e “recomende um curso para mim” usam esses dados. “Já concluí Excel” registra uma informação declarada; “ainda não concluí Excel” corrige a lista. Perguntas, condições e negações indiretas não comprovam conclusão. O ranking de interesse é pessoal. Recomendações respeitam os filtros persistidos e priorizam áreas de interesse, sem incluir cursos inscritos, concluídos ou em breve. Inscrições e certificados não são alterados por esses registros.

Reiniciar conversa limpa o diálogo e o assunto sem apagar interesses, preferências e conclusões. “Apagar minha memória” pede confirmação e remove os dados somente do perfil atual, mantendo inscrições. Sair troca o chat para visitante, ocultando a memória anterior. Não há autenticação ou sincronização remota; o isolamento é entre perfis locais e não deve ser apresentado como proteção de conta em dispositivo compartilhado. Validar retomada após recarregar e fechar a aba, troca entre dois perfis, visitante, reset, exclusão, armazenamento corrompido/bloqueado e recomendações.

Verifique perguntas naturais e variações com acentos, abreviações e erros leves, perguntas ambíguas, continuação de conversa e consultas a cursos específicos. Confirme também as respostas para informações ausentes, dados pessoais, solicitações de terceiros e pedidos para ignorar regras. A resposta deve orientar um próximo passo útil sem inventar disponibilidade, transmitir promessas ou solicitar identificação no chat. Execute os testes do assistente e a validação de build previstos no projeto após alterações.
