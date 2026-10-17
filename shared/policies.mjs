export const POLICY_VERSION = "2026-10-16.2";

export const PLATFORM_POLICIES = {
  "terms": {
    "title": "Termos de uso",
    "description": "Regras de cadastro e inscrição no Qualifica Vix.",
    "paragraphs": [
      "Informe dados verdadeiros e confira os requisitos, a modalidade e a disponibilidade do curso antes de se inscrever.",
      "O cadastro aceita endereços de Vitória-ES. Menores de 18 anos precisam informar um responsável legal.",
      "A inscrição em um curso é confirmada diretamente na plataforma após a gravação pelo servidor. Não é necessário receber e-mail, código ou clicar em um link externo.",
      "O perfil permite até três inscrições por mês. Cursos com inscrições ainda indisponíveis não podem receber novas inscrições.",
      "O cancelamento pode ser feito no perfil até três dias após a inscrição. O prazo de cada curso aparece na lista de cursos cadastrados.",
      "Ao publicar um depoimento, compartilhe somente informações que deseja tornar públicas e evite incluir dados pessoais de terceiros."
    ]
  },
  "privacy": {
    "title": "Política de privacidade",
    "description": "Como os dados informados são utilizados nesta plataforma.",
    "paragraphs": [
      "O cadastro envia ao serviço da plataforma seus dados pessoais, endereço, contato, escolaridade e os demais campos preenchidos, incluindo informações opcionais e autorizações.",
      "As inscrições e os cancelamentos são registrados diretamente no servidor da plataforma. Não enviamos e-mail para validar inscrições. Uma sessão de acesso é criada no cadastro e deve ser mantida em sigilo; o e-mail de contato não é uma prova de identidade.",
      "Quando disponível, Continuar com Google usa a identidade e o e-mail verificado da sua conta Google para recuperar o cadastro existente e as inscrições registradas no servidor. A plataforma não recebe sua senha Google. Guardamos o identificador da conta Google e uma sessão de acesso; fotos, favoritos e conversas locais não são transferidos.",
      "O perfil, a foto, os favoritos e as inscrições em cursos também ficam salvos no navegador utilizado. Em um navegador que bloqueie esse armazenamento, a plataforma informa quando os dados estarão disponíveis somente enquanto a página estiver aberta.",
      "Com um perfil cadastrado, as conversas recentes com a Tortuguita, os interesses, as preferências e as conclusões de cursos informadas por você são guardados neste navegador, separados por perfil, para retomar o atendimento. Essa memória não é enviada a um serviço de IA nem sincronizada entre dispositivos. Você pode consultá-la e apagá-la em Sua memória com a Tortuguita, sem alterar suas inscrições.",
      "O CEP informado é consultado no ViaCEP para verificar se o endereço pertence a Vitória-ES. As imagens externas do catálogo são carregadas do Unsplash.",
      "Depoimentos enviados são armazenados pelo serviço e podem ser exibidos publicamente com nome, curso, avaliação e texto.",
      "O botão Sair limpa o perfil e os favoritos deste navegador e solicita a revogação da sessão atual no servidor. Sem conexão, a revogação remota pode não ser concluída. Essa ação não exclui automaticamente o cadastro ou os depoimentos enviados ao serviço.",
      "Sair remove o acesso deste navegador, mas não apaga inscrições confirmadas no servidor. A inscrição não depende da opção de receber notícias, que continua opcional.",
      "Sair também oculta a memória do chat, mas não apaga seu histórico salvo. Use Apagar minha memória no chat antes de sair se quiser remover essas conversas e interesses deste navegador."
    ]
  },
  "data": {
    "title": "Informações sobre dados pessoais",
    "description": "Uso do perfil e informações sobre a LGPD.",
    "paragraphs": [
      "Você pode consultar e editar os dados disponíveis na página Meu perfil. Campos de acessibilidade, renda e autorização de imagem são opcionais no cadastro.",
      "Autorizações de cadastro e depoimentos são informações diferentes: um depoimento publicado fica visível aos visitantes da plataforma.",
      "Evite cadastrar dados de outras pessoas sem autorização, com exceção das informações do responsável legal necessárias para um cadastro de menor de idade.",
      "A exclusão de dados enviados ao serviço precisa ser tratada com o responsável pela operação da plataforma; o botão Sair remove somente os dados deste navegador.",
      "Consulte o texto oficial da Lei Geral de Proteção de Dados Pessoais para conhecer os direitos e deveres previstos na legislação. https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm"
    ]
  }
};

export function policyReceipt(now = new Date()) {
  return { version: POLICY_VERSION, acceptedAt: now.toISOString(), policies: JSON.parse(JSON.stringify(PLATFORM_POLICIES)) };
}
