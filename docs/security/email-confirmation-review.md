> Histórico: a confirmação por e-mail descrita nesta revisão foi desativada. O fluxo atual confirma inscrições diretamente na plataforma com sessão validada no servidor. As operações públicas antigas de envio e confirmação retornam 410; nenhum provedor de e-mail é necessário.

# Revisão da confirmação por e-mail — 2026-10-15

Escopo: código do serviço, rotas HTTP, consultas SQLite/PostgreSQL, template de e-mail, armazenamento de credenciais e testes locais. Não é uma certificação de segurança nem um teste de invasão do servidor publicado. Nenhum e-mail real ou banco de produção foi usado.

## Falhas corrigidas

- **Reutilização de link para obter acesso ao perfil:** a confirmação repetida emitia novas sessões e retornava dados pessoais durante as 24 horas de validade. Agora somente a transação que efetivamente confirma a inscrição pode autorizar a emissão da sessão. Repetições, inclusive concorrentes ou por outro link para o mesmo curso já confirmado, retornam 409 sem novo acesso. A inscrição original permanece confirmada.
- **Confirmação antes da aceitação do envio:** registros com entrega `sending` podiam ser confirmados. Agora a confirmação exige `sent`; falha ou envio ainda em andamento não autoriza inscrição nem sessão.

O link continua sendo uma credencial pessoal: quem o obtiver **antes** do primeiro uso pode confirmar e acessar os campos do perfil retornados pela API. O token tem 256 bits aleatórios, expira em 24 horas e somente seu hash é armazenado. O fragmento da URL não é enviado em requisições HTTP e a aplicação o remove do histórico.

## Verificações automatizadas

- Uso único sob oito tentativas simultâneas, em SQLite e PostgreSQL executado por PGlite; apenas uma sessão emitida.
- Tokens inválidos, adulterados, expirados, de entrega falha ou ainda em andamento não confirmam inscrições.
- Credenciais de acompanhamento não confirmam inscrição, não cancelam e não retornam dados pessoais nem sessões.
- Cancelamento rejeita sessão de outro usuário, sessão expirada e token do próprio e-mail usado como sessão.
- Limites de envio e de inscrições, duplicidade, cancelamento e concorrência continuam cobertos.
- GET e origem externa não autorizam confirmação; JSON e tamanho do corpo são validados.
- Conteúdo do e-mail escapa HTML, utiliza catálogo do servidor e contém um único botão; erros do provedor não expõem detalhes privados.
- `npm audit --omit=dev`: nenhuma vulnerabilidade conhecida de dependências de produção na data da revisão. Isso não exclui falhas desconhecidas ou de lógica da aplicação.

Validação final: `npm test` aprovado (232 testes unitários mais validação, segurança, SQLite e serverless); `npm run build` aprovado; `npm run test:e2e` com 46/46 verificações aprovadas. A auditoria completa (`npm audit`), incluindo desenvolvimento, também não encontrou vulnerabilidades conhecidas.

## Limites e trabalho de autenticação ainda necessário

1. **Proteção contra abuso público:** solicitar e-mail requer ID e e-mail do cadastro, mas não uma sessão autenticada. Esses campos não são segredos. Existem limites persistentes por cadastro (cinco solicitações/hora e intervalo por curso), mas ainda é necessário controle global/por IP e proteção contra cadastros automatizados para conter spam distribuído. O envio não prova autenticação; somente a posse do link recebido autoriza a confirmação.
2. **Sessões e saída:** o perfil e o token de sessão ficam no armazenamento do navegador; a sessão tem validade de 90 dias. Sair remove dados locais, mas não revoga no servidor uma cópia previamente roubada. Uma solução completa deve prever sessão em cookie HttpOnly/Secure, revogação e recuperação de acesso. A CSP de produção reduz a exposição a scripts injetados, mas não elimina esse risco.
3. **Perfil local:** os dados apresentados no navegador não são uma identidade autenticada para futuras operações. Novas rotas protegidas devem validar credenciais no servidor, nunca confiar em ID ou campos do armazenamento local.
4. **Perda da resposta:** se a primeira confirmação for processada e sua resposta se perder, o link já estará consumido. O acompanhamento no navegador original pode indicar inscrição confirmada, mas não recuperar uma nova sessão. É necessário um fluxo separado de recuperação autenticada para acesso em outro navegador após o uso.
5. **Configuração externa:** ainda precisam ser verificados no ambiente publicado HTTPS, cabeçalhos efetivamente servidos, acesso ao banco, segredos, remetente verificado, SPF/DKIM/DMARC e entrega pelo Resend. Desativar rastreamento de cliques e não registrar corpos das requisições de confirmação. Scanners que executem JavaScript podem consumir links; GET isolado não confirma.

Esses limites impedem afirmar que toda a autenticação da plataforma está resolvida. A revisão fortalece a confirmação e documenta separadamente as mudanças de infraestrutura e de autenticação que continuam necessárias.


## Atualização posterior: entrada com Google

A integração OAuth passou a permitir recuperação por identidade Google validada. A saída agora solicita revogação das credenciais da sessão atual e limpa cookies HttpOnly no servidor. Sem conexão, o cliente ainda consegue sair localmente, mas não garante a revogação remota. O cookie de sessão Google é HttpOnly/SameSite e Secure em produção; o token também é disponibilizado ao cliente autenticado para compatibilidade com as operações existentes. Portanto a migração completa das credenciais para cookies HttpOnly continua pendente. A proteção contra disparos abusivos de e-mail continua necessária. Consulte a configuração e as limitações no README.
