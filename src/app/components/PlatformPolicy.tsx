import type { ReactNode } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "./ui/dialog";

type PolicyKind = "terms" | "privacy" | "data";

const policies: Record<PolicyKind, { title: string; description: string; content: ReactNode }> = {
  terms: {
    title: "Termos de uso",
    description: "Regras de cadastro e inscrição no Qualifica Vix.",
    content: <>
      <p>Informe dados verdadeiros e confira os requisitos, a modalidade e a disponibilidade do curso antes de se inscrever.</p>
      <p>O cadastro aceita endereços de Vitória-ES. Menores de 18 anos precisam informar um responsável legal.</p>
      <p>A inscrição em um curso só é finalizada após clicar no botão de confirmação enviado ao e-mail cadastrado. Até esse clique, o pedido fica pendente; o link pessoal vence em 24 horas.</p>
      <p>O perfil permite até três inscrições por mês. Cursos com inscrições ainda indisponíveis não podem receber novas inscrições.</p>
      <p>O cancelamento pode ser feito no perfil até três dias após a inscrição. O prazo de cada curso aparece na lista de cursos cadastrados.</p>
      <p>Ao publicar um depoimento, compartilhe somente informações que deseja tornar públicas e evite incluir dados pessoais de terceiros.</p>
    </>,
  },
  privacy: {
    title: "Política de privacidade",
    description: "Como os dados informados são utilizados nesta plataforma.",
    content: <>
      <p>O cadastro envia ao serviço da plataforma seus dados pessoais, endereço, contato, escolaridade e os demais campos preenchidos, incluindo informações opcionais e autorizações.</p>
      <p>Ao solicitar inscrição em um curso, o nome, e-mail e as informações do curso são usados para enviar uma confirmação pelo provedor Resend. A inscrição fica pendente até a confirmação do link, que vence em 24 horas. Pedidos, confirmações e cancelamentos ficam registrados no servidor; os links são pessoais e não devem ser compartilhados. O link permite recuperar o perfil cadastrado no navegador em que for aberto.</p>
      <p>O perfil, a foto, os favoritos e as inscrições em cursos também ficam salvos no navegador utilizado. Em um navegador que bloqueie esse armazenamento, a plataforma informa quando os dados estarão disponíveis somente enquanto a página estiver aberta.</p>
      <p>Com um perfil cadastrado, as conversas recentes com a Tortuguita, os interesses, as preferências e as conclusões de cursos informadas por você são guardados neste navegador, separados por perfil, para retomar o atendimento. Essa memória não é enviada a um serviço de IA nem sincronizada entre dispositivos. Você pode consultá-la e apagá-la em Sua memória com a Tortuguita, sem alterar suas inscrições.</p>
      <p>O CEP informado é consultado no ViaCEP para verificar se o endereço pertence a Vitória-ES. As imagens externas do catálogo são carregadas do Unsplash.</p>
      <p>Depoimentos enviados são armazenados pelo serviço e podem ser exibidos publicamente com nome, curso, avaliação e texto.</p>
      <p>O botão Sair limpa o perfil e os favoritos deste navegador. Essa ação não exclui automaticamente o cadastro ou os depoimentos enviados ao serviço.</p>
      <p>Sair remove o acesso deste navegador, mas não apaga inscrições confirmadas no servidor. A confirmação de inscrição é uma mensagem operacional, independente da opção de receber notícias.</p>
      <p>Sair também oculta a memória do chat, mas não apaga seu histórico salvo. Use Apagar minha memória no chat antes de sair se quiser remover essas conversas e interesses deste navegador.</p>
    </>,
  },
  data: {
    title: "Informações sobre dados pessoais",
    description: "Uso do perfil e informações sobre a LGPD.",
    content: <>
      <p>Você pode consultar e editar os dados disponíveis na página Meu perfil. Campos de acessibilidade, renda e autorização de imagem são opcionais no cadastro.</p>
      <p>Autorizações de cadastro e depoimentos são informações diferentes: um depoimento publicado fica visível aos visitantes da plataforma.</p>
      <p>Evite cadastrar dados de outras pessoas sem autorização, com exceção das informações do responsável legal necessárias para um cadastro de menor de idade.</p>
      <p>A exclusão de dados enviados ao serviço precisa ser tratada com o responsável pela operação da plataforma; o botão Sair remove somente os dados deste navegador.</p>
      <p>Consulte o texto oficial da <a href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">Lei Geral de Proteção de Dados Pessoais</a> para conhecer os direitos e deveres previstos na legislação.</p>
    </>,
  },
};

export function PlatformPolicyLink({ kind, children, className }: { kind: PolicyKind; children: ReactNode; className?: string }) {
  const policy = policies[kind];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={className}>{children}</button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle className="pr-10 text-xl">{policy.title}</DialogTitle>
          <DialogDescription>{policy.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-relaxed text-slate-700">{policy.content}</div>
      </DialogContent>
    </Dialog>
  );
}
