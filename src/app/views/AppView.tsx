import { useState, useEffect, useRef, type FormEvent } from "react";
import { RegisterPage } from "./RegisterView";
import { TurtleMascot } from "../components/TurtleMascot";
import { createTestimonial, enrollUserInCourse, getFavoriteCourseIds, getTestimonials, getUserProfile, logoutUserProfile, removeUserEnrollmentFromCourse, saveFavoriteCourseIds, updateUserProfile, type UserProfile } from "../services/api";
import { formatDateBR, getUnsubscribeDeadline } from "../services/enrollmentPolicy.js";
import { useAppController } from "../controllers/useAppController";
import type { Course } from "../models/Course";
import type { Testimonial } from "../models/Testimonial";
import type { Page } from "../models/navigation";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "../components/ui/carousel";
import qualificaVixLogo from "../../assets/qualifica-vix-logo.svg";
import qualificavixInformatica from "../../assets/hero/qualificavix-informatica.jpg";
import qualificavixCulinaria from "../../assets/hero/qualificavix-culinaria.jpg";
import qualificavixCozinhaAula from "../../assets/hero/qualificavix-cozinha-aula.jpg";
import qualificavixPanificacao from "../../assets/hero/qualificavix-panificacao.jpg";
import qualificavixTecnologia from "../../assets/hero/qualificavix-tecnologia.jpg";
import vitoriaDoisOlhos1 from "../../assets/hero/vitoria-dois-olhos-1.jpg";
import vitoriaDoisOlhos2 from "../../assets/hero/vitoria-dois-olhos-2.jpg";
import vitoriaTerceiraPonte from "../../assets/hero/vitoria-terceira-ponte-panorama.jpg";
import {
  Search, X, Clock, MapPin, ChevronRight, ChevronDown, Menu, Moon, Sun, Minus, Plus,
  ArrowRight, ArrowLeft, BookOpen, Filter, Star, Users, Award,
  CheckCircle2, Heart, Facebook, Instagram, Twitter, Phone, Mail,
  Monitor, Briefcase, Palette, Wrench, GraduationCap, Utensils,
  Laptop, Send, SlidersHorizontal, Globe, Building2, TrendingUp,
  PlayCircle, BarChart3, Target, Zap, UserCheck, Camera, Trash2, Pause, Play,
  LogOut,
} from "lucide-react";

// ─── Paleta de cores ─────────────────────────────────────────────────────────
const C = {
  blue:        "#0057d9",
  blueDark:    "#0a2f61",
  blueMid:     "#0078ce",
  blueLight:   "#cdeeff",
  bluePale:    "#eaf8ff",
  orange:      "#ff8500",
  orangeBrightEnd: "#ffb21a",
  orangeDark:  "#a84800",
  orangeActionEnd: "#c94e00",
  orangeLight: "#ffe0a6",
  white:       "#ffffff",
  slate50:     "#f8fafc",
  slate100:    "#f1f5f9",
  slate200:    "#e2e8f0",
  slate400:    "#94a3b8",
  slate500:    "#64748b",
  slate700:    "#334155",
  slate800:    "#1e293b",
  slate900:    "#0f172a",
};

// ─── Dados dos Cursos ─────────────────────────────────────────────────────────
const COURSES: Course[] = [
  {
    id: 1, title: "Introdução à Programação",
    category: "Tecnologia", categoryColor: "#2563eb",
    modality: "Online", hours: 120, level: "Iniciante",
    provider: "Instituição executora não informada no catálogo",
    location: "", enrolled: 342, status: "open",
    period: "Noturno", duration: "4 meses",
    targetAudience: ["Primeiro emprego", "Mudança de profissão"],
    avgSalary: "R$ 4.200/mês",
    description: "Comece pela lógica de programação e avance até pequenos programas, praticando como transformar um problema em etapas, escrever instruções e testar uma solução.",
    whatYouLearn: ["Lógica de programação e algoritmos", "Estruturas de dados básicas", "Fundamentos das principais linguagens", "Desenvolvimento de pequenos projetos", "Boas práticas e resolução de problemas"],
    about: "Com 120 horas distribuídas ao longo de 4 meses, a formação cobre algoritmos, variáveis, condições, repetições, funções e estruturas de dados básicas. As atividades conduzem da resolução de exercícios a pequenos projetos, com foco em raciocínio lógico, leitura de erros e testes. É uma introdução para quem busca o primeiro contato com desenvolvimento; linguagem utilizada, calendário e instituição executora não estão especificados nesta ficha.",
    image: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80",
    bgColor: "#1d4ed8", featured: 1,
  },
  {
    id: 2, title: "Excel do Básico ao Avançado",
    category: "Administração", categoryColor: "#16a34a",
    modality: "Online", hours: 60, level: "Todos os níveis",
    provider: "Instituição executora não informada no catálogo",
    location: "", enrolled: 289, status: "last-spots",
    period: "Flexível", duration: "2 meses",
    targetAudience: ["Atualização profissional", "Primeiro emprego"],
    avgSalary: "R$ 2.800/mês",
    description: "Pratique planilhas desde a organização de dados e fórmulas até tabelas dinâmicas, gráficos e automações, aplicando os recursos do Excel a tarefas administrativas.",
    whatYouLearn: ["Fórmulas e funções avançadas", "Tabelas dinâmicas e gráficos", "Macros e automação VBA", "Análise de dados", "Dashboards profissionais"],
    about: "A carga de 60 horas está prevista para 2 meses, em modalidade online e com período flexível. O conteúdo parte da estruturação de planilhas e referências de células, passa por funções, filtros, gráficos e tabelas dinâmicas e chega a macros e automação VBA, conforme o programa cadastrado. Os exercícios podem ser aplicados a controles, relatórios e análises de rotina; acesso a software e critérios de avaliação precisam ser confirmados na oferta da turma.",
    image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=80",
    bgColor: "#16a34a", featured: 2,
  },
  {
    id: 3, title: "Design Gráfico para Iniciantes",
    category: "Design", categoryColor: "#7c3aed",
    modality: "Presencial", hours: 80, level: "Iniciante",
    provider: "SENAI (unidade Beira Mar informada no catálogo)",
    location: "Senai – Beira Mar", enrolled: 156, status: "open",
    period: "Vespertino", duration: "3 meses",
    targetAudience: ["Primeiro emprego", "Empreendedor"],
    avgSalary: "R$ 3.400/mês",
    description: "Aprenda fundamentos de composição, tipografia e cor e aplique-os na criação de peças gráficas, materiais para redes sociais e uma identidade visual básica.",
    whatYouLearn: ["Princípios do design visual", "Tipografia e cores", "Adobe Photoshop e Illustrator", "Criação de identidade visual", "Design para redes sociais"],
    about: "São 80 horas presenciais ao longo de 3 meses, no período vespertino. A proposta percorre princípios de comunicação visual, composição, tipografia, paletas de cor e ferramentas como Photoshop e Illustrator, com exercícios de criação de peças e identidade visual. A ficha indica o SENAI – Beira Mar como local, mas não apresenta endereço completo, datas, nome da unidade oficial ou confirmação de parceria para esta edição; confirme esses dados antes do deslocamento.",
    image: "https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&w=1200&q=80",
    bgColor: "#7c3aed", featured: 3,
  },
  {
    id: 4, title: "Marketing Digital na Prática",
    category: "Marketing", categoryColor: "#db2777",
    modality: "Online", hours: 60, level: "Iniciante",
    provider: "Instituição executora não informada no catálogo",
    location: "", enrolled: 412, status: "open",
    period: "Flexível", duration: "2 meses",
    targetAudience: ["Empreendedor", "Atualização profissional", "Mudança de profissão"],
    avgSalary: "R$ 3.800/mês",
    description: "Planeje ações de marketing digital envolvendo conteúdo, busca, redes sociais, anúncios e métricas, conectando objetivos de negócio a indicadores de campanha.",
    whatYouLearn: ["SEO e tráfego orgânico", "Google Ads e Facebook Ads", "E-mail marketing", "Métricas e analytics", "Estratégias de conteúdo"],
    about: "A formação online prevê 60 horas em 2 meses, com período flexível. O percurso inclui SEO, planejamento de conteúdo, anúncios em plataformas digitais, e-mail marketing e leitura de métricas. Os exercícios podem envolver a definição de público, calendário editorial, orçamento e indicadores para uma campanha; plataformas utilizadas e ferramentas eventualmente pagas devem ser confirmadas na descrição oficial da turma.",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
    bgColor: "#db2777", featured: 4,
  },
  {
    id: 5, title: "Desenvolvimento Web Completo",
    category: "Tecnologia", categoryColor: "#2563eb",
    modality: "Online", hours: 150, level: "Intermediário",
    provider: "Instituição executora não informada no catálogo",
    location: "", enrolled: 278, status: "open",
    period: "Noturno", duration: "5 meses",
    targetAudience: ["Mudança de profissão", "Atualização profissional"],
    avgSalary: "R$ 5.500/mês",
    description: "Construa a base de uma aplicação web: páginas com HTML, CSS e JavaScript, interfaces com React, serviços com Node.js, integração com APIs e persistência de dados.",
    whatYouLearn: ["HTML, CSS e JavaScript", "React e Node.js", "Banco de dados SQL e NoSQL", "APIs RESTful", "Deploy e hospedagem"],
    about: "O curso prevê 150 horas ao longo de 5 meses, em modalidade online e período noturno. O conteúdo cadastrado vai de HTML, CSS e JavaScript a React, Node.js, bancos SQL e NoSQL, APIs REST e publicação de aplicações. A trilha é voltada a quem já tem noções iniciais e quer praticar partes de front-end e back-end; requisitos técnicos, tecnologias e ambiente de desenvolvimento da turma precisam ser confirmados com a instituição executora, ainda não identificada nesta ficha.",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    bgColor: "#0891b2",
  },
  {
    id: 6, title: "Gestão de Projetos",
    category: "Administração", categoryColor: "#16a34a",
    modality: "Online", hours: 60, level: "Intermediário",
    provider: "Instituição executora não informada no catálogo",
    location: "", enrolled: 198, status: "coming-soon",
    period: "Vespertino", duration: "2 meses",
    targetAudience: ["Atualização profissional", "Empreendedor"],
    avgSalary: "R$ 6.200/mês",
    description: "Pratique planejamento, acompanhamento e encerramento de projetos com escopo, cronograma, responsabilidades, riscos e métodos ágeis como Scrum e Kanban.",
    whatYouLearn: ["Metodologias ágeis (Scrum, Kanban)", "Gestão de equipes", "Planejamento e cronograma", "Controle de riscos", "Ferramentas: Trello, Jira, Asana"],
    about: "A previsão é de 60 horas em 2 meses, no período vespertino e em formato online. O conteúdo reúne definição de objetivos e escopo, organização de tarefas e cronograma, gestão de riscos e equipes, além de práticas Scrum e Kanban e uso de ferramentas como Trello, Jira e Asana. Como a turma aparece como futura, datas, provedor, ferramentas exigidas e formato das atividades ainda precisam ser confirmados quando as inscrições forem abertas.",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
    bgColor: "#059669",
  },
  {
    id: 7, title: "Informática para o Mercado",
    category: "Tecnologia", categoryColor: "#2563eb",
    modality: "Presencial", hours: 100, level: "Iniciante",
    provider: "Instituição executora não informada no catálogo",
    location: "Hub de Inovação", enrolled: 134, status: "open",
    period: "Diurno", duration: "3 meses",
    targetAudience: ["Primeiro emprego", "Atualização profissional"],
    avgSalary: "R$ 2.200/mês",
    description: "Desenvolva autonomia no uso do computador, internet, e-mail profissional e ferramentas de escritório, com atenção a segurança digital e organização de arquivos.",
    whatYouLearn: ["Windows e pacote Office", "Internet e e-mail profissional", "Segurança digital", "Google Workspace", "Noções de hardware"],
    about: "São 100 horas presenciais previstas para 3 meses, no período diurno e em nível iniciante. A trilha inclui sistema operacional, arquivos, pacote Office, Google Workspace, navegação, e-mail e noções de segurança e hardware. A ficha informa o Hub de Inovação como local, mas não identifica a instituição responsável nem detalha endereço, dias de aula ou equipamentos disponibilizados; esses dados devem ser confirmados antes da inscrição.",
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
    bgColor: "#0369a1",
  },
  {
    id: 8, title: "Atendimento ao Cliente",
    category: "Educação", categoryColor: "#d97706",
    modality: "Online", hours: 40, level: "Iniciante",
    provider: "Instituição executora não informada no catálogo",
    location: "", enrolled: 321, status: "open",
    period: "Flexível", duration: "1 mês",
    targetAudience: ["Primeiro emprego", "Mudança de profissão"],
    avgSalary: "R$ 1.800/mês",
    description: "Treine comunicação clara, escuta ativa, atendimento por diferentes canais, registro de solicitações, encaminhamento de problemas e acompanhamento pós-venda.",
    whatYouLearn: ["Comunicação e linguagem positiva", "Gestão de conflitos", "Atendimento multicanal", "Fidelização de clientes", "CRM e pós-venda"],
    about: "A carga prevista é de 40 horas em 1 mês, com aulas online e período flexível. Os temas incluem comunicação profissional, escuta e identificação de necessidades, atendimento multicanal, resolução e encaminhamento de conflitos, registro em CRM, fidelização e pós-venda. As práticas podem simular conversas e situações de atendimento; critérios de participação e ferramentas utilizadas não estão detalhados no cadastro.",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
    bgColor: "#d97706",
  },
  {
    id: 9, title: "Gastronomia Brasileira",
    category: "Gastronomia", categoryColor: "#ea580c",
    modality: "Presencial", hours: 80, level: "Iniciante",
    provider: "SENAC (unidade específica não identificada no catálogo)",
    location: "Senac – Vitória", enrolled: 89, status: "last-spots",
    period: "Diurno", duration: "3 meses",
    targetAudience: ["Primeiro emprego", "Empreendedor"],
    avgSalary: "R$ 2.500/mês",
    description: "Pratique técnicas de preparo da culinária brasileira, higiene e segurança alimentar, organização de cozinha e elaboração de fichas técnicas e cardápios.",
    whatYouLearn: ["Técnicas de corte e preparo", "Culinária regional brasileira", "Higiene e segurança alimentar", "Cardápio e fichas técnicas", "Noções de gestão de cozinha"],
    about: "O cadastro prevê 80 horas presenciais ao longo de 3 meses, no período diurno, com nível iniciante. A programação combina técnicas de corte, preparo e cocção, receitas regionais, higiene e segurança alimentar, fichas técnicas, planejamento de cardápio e noções de custos e organização de cozinha. O SENAC – Vitória aparece como local; unidade, endereço, disponibilidade de insumos e calendário devem ser confirmados na chamada oficial da turma.",
    image: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80",
    bgColor: "#ea580c",
  },
  {
    id: 10, title: "Eletricista Predial",
    category: "Técnico", categoryColor: "#ca8a04",
    modality: "Presencial", hours: 160, level: "Iniciante",
    provider: "SENAI (unidade Bento Ferreira informada no catálogo)",
    location: "Senai – Bento Ferreira", enrolled: 67, status: "open",
    period: "Noturno", duration: "5 meses",
    targetAudience: ["Primeiro emprego", "Mudança de profissão"],
    avgSalary: "R$ 4.000/mês",
    description: "Aprenda a interpretar projetos e executar instalações elétricas prediais, selecionar proteções, realizar verificações e aplicar procedimentos de segurança pertinentes.",
    whatYouLearn: ["Leitura de projetos elétricos", "Instalações residenciais e comerciais", "Normas NBR e NR10", "Quadros elétricos e proteções", "Manutenção corretiva"],
    about: "A formação prevê 160 horas presenciais durante 5 meses, no período noturno e em nível iniciante. Os tópicos cadastrados abrangem leitura de projetos, circuitos residenciais e comerciais, dimensionamento básico, quadros e dispositivos de proteção, manutenção e referências às normas NBR e à NR-10. A menção à NR-10 no conteúdo não confirma, por si só, que a turma conceda certificado dessa norma; confirme escopo, práticas em laboratório, equipamentos de proteção, requisitos e endereço completo com o SENAI – Bento Ferreira.",
    image: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1200&q=80",
    bgColor: "#ca8a04",
  },
];

const COURSE_IMAGES: Record<string, string> = {
  Tecnologia: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80",
  Administração: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=80",
  Design: "https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&w=1200&q=80",
  Marketing: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
  Educação: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
  Gastronomia: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80",
  Técnico: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1200&q=80",
};

const courseImage = (course: Course) => (course.image && course.image.trim().length > 0 ? course.image : COURSE_IMAGES[course.category] ?? qualificavixCozinhaAula);

const CATEGORIES = [
  { id: 1, label: "Tecnologia",    count: 126, color: "#2563eb", icon: Laptop },
  { id: 2, label: "Administração", count: 92,  color: "#16a34a", icon: Briefcase },
  { id: 3, label: "Criatividade",  count: 74,  color: "#7c3aed", icon: Palette },
  { id: 4, label: "Cursos Técnicos",count: 86, color: "#ca8a04", icon: Wrench },
  { id: 5, label: "Educação",      count: 64,  color: "#d97706", icon: GraduationCap },
  { id: 6, label: "Gastronomia",   count: 38,  color: "#ea580c", icon: Utensils },
  { id: 7, label: "Marketing",     count: 44,  color: "#db2777", icon: BarChart3 },
  { id: 8, label: "Saúde",         count: 29,  color: "#0891b2", icon: Heart },
];


const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    id: 1,
    name: "Sandra Lima",
    role: "Auxiliar de cozinha",
    course: "Gastronomia Brasileira",
    quote: "Eu fazia diárias e minha renda variava muito. No curso aprendi boas práticas e técnicas de preparo; depois consegui uma vaga fixa em uma cozinha.",
    rating: 5,
    illustrative: true,
  },
  {
    id: 2,
    name: "Marcos Pereira",
    role: "Eletricista auxiliar",
    course: "Eletricista Predial",
    quote: "Eu já ajudava em pequenos reparos, mas não tinha formação. Estudar segurança e instalações me ajudou a buscar oportunidades melhores e organizar meus serviços.",
    rating: 5,
    illustrative: true,
  },
  {
    id: 3,
    name: "Joana Souza",
    role: "Assistente administrativa",
    course: "Excel do Básico ao Avançado",
    quote: "Eu tinha dificuldade com planilhas e relatórios. Com a prática, ganhei confiança para concorrer a vagas administrativas e consegui uma oportunidade mais estável.",
    rating: 5,
    illustrative: true,
  },
  {
    id: 4,
    name: "Renata Alves",
    role: "Pequena empreendedora",
    course: "Marketing Digital na Prática",
    quote: "Eu vendia doces para conhecidos e quase não divulgava meu trabalho. Aprendi a planejar conteúdo e hoje alcanço clientes além do meu bairro.",
    rating: 5,
    illustrative: true,
  },
  {
    id: 5,
    name: "Paulo Henrique",
    role: "Assistente de suporte",
    course: "Informática para o Mercado",
    quote: "Depois de um tempo fora do mercado, eu precisava recuperar a confiança com computador e e-mail. O curso me ajudou a voltar a procurar trabalho com mais preparo.",
    rating: 5,
    illustrative: true,
  },
  {
    id: 6,
    name: "Aline Rocha",
    role: "Designer iniciante",
    course: "Design Gráfico para Iniciantes",
    quote: "Eu fazia artes simples no celular, sem saber explicar minhas escolhas. Aprendi composição e identidade visual e comecei a montar um portfólio para buscar clientes.",
    rating: 5,
    illustrative: true,
  },
  {
    id: 7,
    name: "Diego Martins",
    role: "Desenvolvedor júnior",
    course: "Introdução à Programação",
    quote: "Eu achava que tecnologia era uma área distante da minha realidade. Começar pela lógica e criar pequenos projetos me mostrou um caminho possível para mudar de carreira.",
    rating: 5,
    illustrative: true,
  },
  {
    id: 8,
    name: "Vera Costa",
    role: "Atendente de loja",
    course: "Atendimento ao Cliente",
    quote: "Eu já atendia clientes, mas não sabia como lidar com reclamações difíceis. As técnicas de comunicação me ajudaram a crescer para uma função de referência na equipe.",
    rating: 5,
    illustrative: true,
  },
];

const TESTIMONIAL_CAROUSEL_OPTIONS = { align: "start" as const, loop: true, slidesToScroll: 1 };

// ─── Turtle Mascot SVG ────────────────────────────────────────────────────────
function LegacyTurtleMascot({
  size = 55,
  className = ""
}: {
  size?: number;
  className?: string;
}) {
  const id = `turtle-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Tortuguita Vix"
    >
      <defs>
        <radialGradient id={`${id}-shell`} cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="24%" stopColor="#dbeafe" />
          <stop offset="58%" stopColor="#2583e8" />
          <stop offset="100%" stopColor="#083b83" />
        </radialGradient>

        <linearGradient
          id={`${id}-shell-edge`}
          x1="20"
          y1="25"
          x2="95"
          y2="95"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#fff7b2" />
          <stop offset="45%" stopColor="#ffd51f" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>

        <radialGradient id={`${id}-skin`} cx="35%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="42%" stopColor="#eaf4ff" />
          <stop offset="78%" stopColor="#69aef7" />
          <stop offset="100%" stopColor="#2878cf" />
        </radialGradient>

        <linearGradient id={`${id}-legs`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff8c8" />
          <stop offset="50%" stopColor="#ffd51f" />
          <stop offset="100%" stopColor="#e99a08" />
        </linearGradient>

        <filter
          id={`${id}-shadow`}
          x="-30%"
          y="-30%"
          width="160%"
          height="170%"
        >
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="3"
            floodColor="#06346b"
            floodOpacity="0.35"
          />
        </filter>

        <filter id={`${id}-soft`}>
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      {/* Sombra */}
      <ellipse
        cx="55"
        cy="102"
        rx="31"
        ry="6"
        fill="#06346b"
        opacity="0.30"
        filter={`url(#${id}-soft)`}
      />

      {/* Patas traseiras */}
      <path
        d="M32 77 C22 76 15 81 13 88 C11 94 16 98 22 96 C29 94 35 89 39 83 Z"
        fill={`url(#${id}-legs)`}
        stroke="#a96800"
        strokeWidth="1.5"
      />
      <path
        d="M88 77 C98 76 105 81 107 88 C109 94 104 98 98 96 C91 94 85 89 81 83 Z"
        fill={`url(#${id}-legs)`}
        stroke="#a96800"
        strokeWidth="1.5"
      />

      {/* Dedos traseiros */}
      <path
        d="M18 88 L13 91 M21 91 L17 95 M25 91 L23 96"
        stroke="#a96800"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M102 88 L107 91 M99 91 L103 95 M95 91 L97 96"
        stroke="#a96800"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* Casco */}
      <g filter={`url(#${id}-shadow)`}>
        <ellipse
          cx="55"
          cy="70"
          rx="50"
          ry="38"
          fill={`url(#${id}-shell)`}
          stroke="#073b79"
          strokeWidth="2"
        />

        <ellipse
          cx="60"
          cy="61"
          rx="40"
          ry="32"
          fill="none"
          stroke={`url(#${id}-shell-edge)`}
          strokeWidth="3"
          opacity="0.9"
        />

        {/* Placa central superior */}
        <path
          d="M60 28 C53 32 49 39 49 46 C49 52 53 57 60 60 C67 57 71 52 71 46 C71 39 67 32 60 28Z"
          fill="#ffd51f"
          opacity="0.75"
        />

        {/* Placa central inferior */}
        <path
          d="M60 60 C53 63 49 69 50 76 C51 82 55 88 60 94 C65 88 69 82 70 76 C71 69 67 63 60 60Z"
          fill="#ffffff"
          opacity="0.72"
        />

        {/* Placas laterais */}
        <path
          d="M48 35 C39 36 31 42 27 49 C25 54 28 59 34 61 C40 60 46 56 49 51 C52 45 51 40 48 35Z"
          fill="#0e66c2"
          opacity="0.8"
        />
        <path
          d="M72 35 C81 36 89 42 93 49 C95 54 92 59 86 61 C80 60 74 56 71 51 C68 45 69 40 72 35Z"
          fill="#0e66c2"
          opacity="0.8"
        />
        <path
          d="M34 61 C29 64 27 70 30 76 C34 82 41 85 50 86 C50 78 48 69 42 65 C39 63 36 62 34 61Z"
          fill="#0a4e9c"
          opacity="0.72"
        />
        <path
          d="M86 61 C91 64 93 70 90 76 C86 82 79 85 70 86 C70 78 72 69 78 65 C81 63 84 62 86 61Z"
          fill="#0a4e9c"
          opacity="0.72"
        />

        {/* Divisões naturais do casco */}
        <path
          d="M60 29 L60 94 M20 61 C34 60 43 60 60 60 C77 60 86 60 100 61 M31 43 C41 49 48 53 60 60 M89 43 C79 49 72 53 60 60 M31 79 C42 72 50 67 60 60 M89 79 C78 72 70 67 60 60"
          stroke="#eaf4ff"
          strokeWidth="1.3"
          opacity="0.65"
          fill="none"
        />

        {/* Textura */}
        <path
          d="M42 43 C46 39 50 37 54 36 M77 43 C73 39 69 37 66 36 M38 76 C42 79 46 81 49 81 M82 76 C78 79 74 81 71 81"
          stroke="#ffd51f"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.45"
          fill="none"
        />

        {/* Reflexo */}
        <ellipse
          cx="43"
          cy="43"
          rx="13"
          ry="7"
          fill="#ffffff"
          opacity="0.38"
          transform="rotate(-25 43 43)"
        />
      </g>

      {/* Pescoço */}
      <path
        d="M48 38 C46 33 47 29 50 26 L70 26 C73 30 74 35 72 40 Z"
        fill={`url(#${id}-skin)`}
        stroke="#175fa9"
        strokeWidth="1.5"
      />

      {/* Patas dianteiras */}
      <path
        d="M26 55 C17 52 10 55 8 62 C6 68 11 72 17 70 C24 68 30 63 33 59 Z"
        fill={`url(#${id}-legs)`}
        stroke="#a96800"
        strokeWidth="1.5"
      />
      <path
        d="M94 55 C103 52 110 55 112 62 C114 68 109 72 103 70 C96 68 90 63 87 59 Z"
        fill={`url(#${id}-legs)`}
        stroke="#a96800"
        strokeWidth="1.5"
      />

      {/* Dedos dianteiros */}
      <path
        d="M13 61 L8 61 M15 65 L10 68 M19 67 L16 71"
        stroke="#a96800"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M107 61 L112 61 M105 65 L110 68 M101 67 L104 71"
        stroke="#a96800"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* Cabeça */}
      <g filter={`url(#${id}-shadow)`}>
        <ellipse
          cx="60"
          cy="25"
          rx="20"
          ry="18"
          fill={`url(#${id}-skin)`}
          stroke="#175fa9"
          strokeWidth="1.8"
        />

        {/* Pequenas manchas naturais */}
        <circle cx="45" cy="31" r="2" fill="#ffd51f" opacity="0.75" />
        <circle cx="49" cy="35" r="1.5" fill="#2583e8" opacity="0.45" />
        <circle cx="75" cy="31" r="2" fill="#ffd51f" opacity="0.75" />
        <circle cx="71" cy="35" r="1.5" fill="#2583e8" opacity="0.45" />

        {/* Reflexo facial */}
        <ellipse
          cx="52"
          cy="20"
          rx="10"
          ry="5"
          fill="#ffffff"
          opacity="0.55"
          transform="rotate(-15 52 18)"
        />

        {/* Olhos */}
        <ellipse cx="51" cy="23" rx="6" ry="7" fill="#f8fafc" />
        <ellipse cx="51" cy="24" rx="3.2" ry="4.2" fill="#111827" />
        <circle cx="52" cy="22" r="1.2" fill="white" />

        <ellipse cx="69" cy="23" rx="6" ry="7" fill="#f8fafc" />
        <ellipse cx="69" cy="24" rx="3.2" ry="4.2" fill="#111827" />
        <circle cx="70" cy="22" r="1.2" fill="white" />

        {/* Narinas */}
        <ellipse cx="57" cy="30" rx="1.4" ry="1" fill="#134f91" />
        <ellipse cx="63" cy="30" rx="1.4" ry="1" fill="#134f91" />

        {/* Boca */}
        <path
          d="M54 34 C57 36 63 36 66 34"
          stroke="#134f91"
          strokeWidth="1.7"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* Cauda */}
      <path
        d="M60 94 C57 98 56 101 60 104 C64 101 63 98 60 94Z"
        fill="#ffd51f"
        stroke="#a96800"
        strokeWidth="1"
      />
    </svg>
  );
}

function TurtleSmall({ size = 32 }: { size?: number }) {
  return <TurtleMascot size={size} />;
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo({ navigate }: { navigate: (p: Page) => void }) {
  return (
    <button onClick={() => navigate("home")} className="flex items-center shrink-0" aria-label="Qualifica Vix - início">
      <img src={qualificaVixLogo} alt="Qualifica Vix" className="w-20 sm:w-24 h-14 object-contain" />
    </button>
  );
}

// ─── Badge de status ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Course["status"] }) {
  if (status === "open")
    return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-100 text-green-700">● Inscrições abertas</span>;
  if (status === "last-spots")
    return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">⚡ Últimas vagas</span>;
  return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">🕐 Início em breve</span>;
}

// ─── Course Card (catálogo) ───────────────────────────────────────────────────
function CourseCard({ course, onView, isFavorite, onToggleFavorite }: { course: Course; onView: (c: Course) => void; isFavorite: boolean; onToggleFavorite: (id: number) => void }) {
  return (
    <article className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col group">
      {/* Fotografia do curso, sem sobreposição de categoria ou cor */}
      <div className="h-40 relative overflow-hidden bg-slate-100">
        <img
          src={courseImage(course)}
          alt={course.title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(course.id); }}
          aria-label={isFavorite ? `Remover ${course.title} dos favoritos` : `Adicionar ${course.title} aos favoritos`}
          aria-pressed={isFavorite}
          title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 shadow-md backdrop-blur-sm flex items-center justify-center hover:bg-white hover:scale-105 transition-all">
          <Heart className={`w-4 h-4 ${isFavorite ? "text-red-500" : "text-slate-700"}`} fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-black text-sm text-slate-900 leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors">
          {course.title}
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{course.description}</p>

        <div className="flex flex-wrap items-center gap-2 mt-auto pt-2">
          <span className="flex items-center gap-1 text-xs text-slate-500 font-semibold">
            <Clock className="w-3.5 h-3.5" /> {course.hours}h
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold"
            style={{ color: course.modality === "Online" ? "#16a34a" : course.modality === "Presencial" ? C.blue : "#d97706" }}>
            <Monitor className="w-3.5 h-3.5" /> {course.modality}
          </span>
          <StatusBadge status={course.status} />
        </div>

        <button onClick={() => onView(course)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 font-bold text-sm py-2.5 rounded-xl text-white hover:opacity-90 hover:-translate-y-0.5 transition-all"
          style={{ background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueMid} 100%)` }}>
          Ver curso <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </article>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
const NAV = [
  { id: "home",       label: "Início" },
  { id: "cursos",     label: "Cursos" },
  { id: "favorites",  label: "Favoritos" },
  { id: "categorias", label: "Categorias" },
  { id: "sobre",      label: "Sobre" },
  { id: "contato",    label: "Contato" },
  { id: "profile",    label: "Meu perfil" },
];

function ProfileAvatar({ name, photo, size = "w-10 h-10" }: { name: string; photo?: string; size?: string }) {
  const initial = name.trim().charAt(0).toLocaleUpperCase("pt-BR") || "?";
  return (
    <span aria-hidden="true" className={`${size} shrink-0 rounded-full overflow-hidden border border-slate-200 bg-blue-700 text-white flex items-center justify-center font-black`}>
      {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : initial}
    </span>
  );
}

function Header({ page, navigate, darkMode, toggleDarkMode, increaseFont, decreaseFont, profile }: { page: Page; navigate: (p: Page) => void; darkMode: boolean; toggleDarkMode: () => void; increaseFont: () => void; decreaseFont: () => void; profile: UserProfile | null }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = query.trim();
    if (!normalized) return;
    sessionStorage.setItem("qualificavix-course-search", normalized);
    navigate("cursos");
    setSearchOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-6 h-14 sm:h-16">
          <Logo navigate={navigate} />

          {/* Nav desktop */}
          <nav className="hidden lg:flex items-center gap-1 flex-1">
            {NAV.map(n => (
              <button key={n.id} onClick={() => navigate(n.id as Page)}
                className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors relative ${
                  page === n.id ? "" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
                style={page === n.id ? { color: C.blue } : {}}>
                {n.label}
                {page === n.id && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                    style={{ backgroundColor: C.orange }} />
                )}
              </button>
            ))}
          </nav>

          {/* Central de acessibilidade */}
          <div className="hidden sm:flex items-center rounded-xl border border-slate-200 bg-slate-50/80 p-1 shadow-sm"
            role="group" aria-label="Controles de visualização">
            <span className="hidden xl:block pl-2.5 pr-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Visual</span>
            <div className="flex items-center rounded-xl bg-white border border-slate-200 overflow-hidden">
              <button onClick={decreaseFont} aria-label="Diminuir zoom" title="Diminuir zoom"
                className="h-8 min-w-9 px-2 flex items-center justify-center gap-0.5 text-slate-600 hover:bg-blue-50 hover:text-blue-700 active:scale-95 transition-all">
                <span className="text-xs font-black">A</span><Minus className="w-3 h-3" />
              </button>
              <span className="w-px h-4 bg-slate-200" aria-hidden="true" />
              <button onClick={increaseFont} aria-label="Aumentar zoom" title="Aumentar zoom"
                className="h-8 min-w-9 px-2 flex items-center justify-center gap-0.5 text-slate-600 hover:bg-blue-50 hover:text-blue-700 active:scale-95 transition-all">
                <span className="text-xs font-black">A</span><Plus className="w-3 h-3" />
              </button>
            </div>
            <button onClick={toggleDarkMode}
              aria-label={darkMode ? "Ativar modo claro" : "Ativar modo escuro"} aria-pressed={darkMode}
              title={darkMode ? "Usar modo claro" : "Usar modo escuro"}
              className={`ml-1 h-8 px-2.5 rounded-xl flex items-center gap-1.5 text-xs font-black active:scale-95 transition-all ${darkMode ? "bg-blue-700 text-white shadow-md shadow-blue-900/20" : "bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}>
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span className="hidden 2xl:inline">{darkMode ? "Claro" : "Escuro"}</span>
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto">
            {searchOpen ? (
              <form className="flex items-center gap-2" onSubmit={submitSearch}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                    onKeyDown={event => { if (event.key === "Enter") submitSearch(event); }}
                    placeholder="Buscar cursos..."
                    className="h-9 pl-9 pr-4 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400 w-40 sm:w-52 font-medium" />
                </div>
                <button type="button" onClick={() => setSearchOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </form>
            ) : (
              <button onClick={() => setSearchOpen(true)}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors">
                <Search className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => navigate(profile ? "profile" : "register")}
              aria-label={profile ? `Abrir perfil de ${profile.nome}` : "Entrar ou cadastrar"}
              title={profile ? `Perfil de ${profile.nome}` : "Entrar / Cadastrar"}
              className={profile
                ? "hidden sm:flex rounded-full p-0.5 ring-2 ring-orange-400 ring-offset-2 ring-offset-white hover:ring-orange-500 transition-all"
                : "hidden sm:flex items-center gap-1.5 text-xs sm:text-sm font-black px-3 sm:px-5 py-2 rounded-xl text-white shadow hover:opacity-90 hover:-translate-y-0.5 transition-all"
              }
              style={profile ? {} : { background: `linear-gradient(135deg, ${C.orangeDark} 0%, ${C.orangeActionEnd} 100%)` }}>
              {profile ? <ProfileAvatar name={profile.nome} photo={profile.fotoPerfil} /> : "Entrar / Cadastrar"}
            </button>
            <button onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-slate-100 py-3 flex flex-col gap-1">
            {NAV.map(n => (
              <button key={n.id} onClick={() => { navigate(n.id as Page); setMobileOpen(false); }}
                className={`text-left px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                  page === n.id ? "" : "text-slate-600 hover:bg-slate-50"
                }`}
                style={page === n.id ? { backgroundColor: C.bluePale, color: C.blue } : {}}>
                {n.label}
              </button>
            ))}
            <button onClick={() => { navigate(getUserProfile() ? "profile" : "register"); setMobileOpen(false); }}
              className="mt-1 flex items-center justify-center font-black text-sm py-2.5 rounded-xl text-white"
              style={{ background: `linear-gradient(135deg, ${C.orangeDark} 0%, ${C.orangeActionEnd} 100%)` }}>
              {getUserProfile() ? "Meu perfil" : "Entrar / Cadastrar"}
            </button>
            <div className="flex items-center gap-2 pt-2 mt-1 border-t border-slate-100">
              <button onClick={decreaseFont} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-sm font-black text-slate-600" aria-label="Reduzir tamanho da fonte"><Minus className="w-4 h-4" /> A−</button>
              <button onClick={increaseFont} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-sm font-black text-slate-600" aria-label="Aumentar tamanho da fonte"><Plus className="w-4 h-4" /> A+</button>
              <button onClick={toggleDarkMode} className="w-12 flex items-center justify-center py-2.5 rounded-xl border border-slate-200 text-slate-600" aria-label={darkMode ? "Ativar modo claro" : "Ativar modo escuro"}>{darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

// ─── Depoimentos ───────────────────────────────────────────────────────────────
function findTestimonialCourse(courseName: string): Course | undefined {
  const query = normalizeChatText(courseName);
  if (!query) return undefined;
  const exactMatch = COURSES.find(course => normalizeChatText(course.title) === query);
  if (exactMatch) return exactMatch;
  const partialMatches = COURSES.filter(course => {
    const title = normalizeChatText(course.title);
    return title.includes(query) || query.includes(title);
  });
  return partialMatches.length === 1 ? partialMatches[0] : undefined;
}

function TestimonialsSection({ onEnrollCourse }: { onEnrollCourse: (course: Course) => void }) {
  const [testimonials, setTestimonials] = useState<Testimonial[]>(DEFAULT_TESTIMONIALS);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | undefined>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [autoplayPaused, setAutoplayPaused] = useState(() =>
    typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [carouselHovered, setCarouselHovered] = useState(false);
  const [carouselFocused, setCarouselFocused] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [course, setCourse] = useState("");
  const [quote, setQuote] = useState("");
  const [rating, setRating] = useState(5);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!carouselApi) return;
    const updateCurrentSlide = () => setCurrentSlide(carouselApi.selectedScrollSnap());
    updateCurrentSlide();
    carouselApi.on("select", updateCurrentSlide);
    return () => { carouselApi.off("select", updateCurrentSlide); };
  }, [carouselApi]);

  useEffect(() => {
    if (!carouselApi || autoplayPaused || carouselHovered || carouselFocused || testimonials.length < 2) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") carouselApi.scrollNext();
    }, 5200);
    return () => window.clearInterval(timer);
  }, [carouselApi, autoplayPaused, carouselHovered, carouselFocused, testimonials.length]);

  useEffect(() => {
    let active = true;
    getTestimonials()
      .then(saved => { if (active) setTestimonials([...saved, ...DEFAULT_TESTIMONIALS]); })
      .catch(() => { /* Mantém os depoimentos padrão quando a API estiver indisponível. */ });
    return () => { active = false; };
  }, []);

  async function submitTestimonial(e: FormEvent) {
    e.preventDefault();

    const cleanName = name.trim();
    const cleanRole = role.trim();
    const cleanCourse = course.trim();
    const cleanQuote = quote.trim();

    if (!cleanName || !cleanRole || !cleanCourse || !cleanQuote) return;

    let testimonial: Testimonial;
    try {
      testimonial = await createTestimonial({ name: cleanName, role: cleanRole, course: cleanCourse, quote: cleanQuote, rating });
    } catch {
      return;
    }
    setTestimonials(current => [testimonial, ...current]);

    setName("");
    setRole("");
    setCourse("");
    setQuote("");
    setRating(5);
    setSubmitted(true);
    setShowForm(false);

    window.setTimeout(() => setSubmitted(false), 4500);
  }

  return (
    <section className="py-16 bg-gradient-to-b from-blue-50 via-white to-orange-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: C.orange }}>
            Histórias que inspiram
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900">
            Aprender pode abrir novos caminhos
          </h2>
          <p className="text-slate-600 mt-3 max-w-2xl mx-auto font-medium leading-relaxed">
            Conheça jornadas ilustrativas de pessoas que usaram a qualificação para buscar novas oportunidades.
            Os personagens e relatos fictícios estão identificados; depoimentos enviados por participantes aparecem separados.
          </p>
        </div>

        {submitted && (
          <div className="max-w-2xl mx-auto mb-6 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-center shadow-sm">
            <p className="font-black text-green-800">Depoimento enviado com sucesso! 🎉</p>
            <p className="text-sm text-green-700 mt-1">
              Sua história já está aparecendo nesta página neste navegador.
            </p>
          </div>
        )}

        <Carousel
          opts={TESTIMONIAL_CAROUSEL_OPTIONS}
          setApi={setCarouselApi}
          aria-label="Histórias de transformação"
          onMouseEnter={() => setCarouselHovered(true)}
          onMouseLeave={() => setCarouselHovered(false)}
          onFocusCapture={() => setCarouselFocused(true)}
          onBlurCapture={event => {
            const nextTarget = event.relatedTarget;
            if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setCarouselFocused(false);
          }}
        >
          <CarouselContent>
            {testimonials.map(testimonial => (
              <CarouselItem key={`${testimonial.illustrative ? "illustrative" : "participant"}-${testimonial.id}`} className="basis-full sm:basis-1/2 lg:basis-1/3">
                {(() => {
                  const matchingCourse = findTestimonialCourse(testimonial.course);
                  return (
                <article className="h-full min-h-80 bg-white rounded-2xl p-5 sm:p-6 shadow-md border border-blue-100 flex flex-col">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black shrink-0 shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueMid} 100%)` }}>
                        {testimonial.name.charAt(0).toLocaleUpperCase("pt-BR")}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 truncate">{testimonial.name}</p>
                        <p className="text-xs font-bold text-slate-500 truncate">{testimonial.role}</p>
                      </div>
                    </div>
                    {!testimonial.illustrative && (
                      <div className="flex gap-0.5 shrink-0" aria-label={`${testimonial.rating} de 5 estrelas`}>
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Star key={index} className="w-4 h-4" fill={index < testimonial.rating ? C.orange : "none"}
                            style={{ color: index < testimonial.rating ? C.orange : "#cbd5e1" }} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg px-3 py-2 mb-4 text-xs font-black inline-flex self-start"
                    style={{ backgroundColor: C.orangeLight, color: C.orangeDark }}>
                    {testimonial.course}
                  </div>

                  <blockquote className="text-sm sm:text-base text-slate-600 leading-relaxed italic flex-1">
                    “{testimonial.quote}”
                  </blockquote>

                  {matchingCourse && (
                    <button type="button" onClick={() => onEnrollCourse(matchingCourse)}
                      className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-slate-950 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 transition-all"
                      style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeBrightEnd} 100%)` }}>
                      Inscrever-se neste curso <ArrowRight className="w-4 h-4" />
                    </button>
                  )}

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-slate-600">
                    <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: testimonial.illustrative ? C.orangeDark : "#16a34a" }} />
                    {testimonial.illustrative ? "História ilustrativa · personagem fictício" : "Relato enviado por participante"}
                  </div>
                </article>
                  );
                })()}
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
            <p className="text-xs font-semibold text-slate-500" aria-live="polite">
              História {currentSlide + 1} de {carouselApi?.scrollSnapList().length ?? testimonials.length}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => carouselApi?.scrollPrev()} aria-label="História anterior" title="História anterior"
                className="w-10 h-10 rounded-full border border-slate-200 bg-white text-slate-700 flex items-center justify-center hover:border-blue-300 hover:text-blue-700 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setAutoplayPaused(paused => !paused)} aria-pressed={autoplayPaused}
                aria-label={autoplayPaused ? "Retomar passagem automática" : "Pausar passagem automática"}
                title={autoplayPaused ? "Retomar" : "Pausar"}
                className="w-10 h-10 rounded-full border border-slate-200 bg-white text-slate-700 flex items-center justify-center hover:border-orange-300 hover:text-orange-700 transition-colors">
                {autoplayPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button type="button" onClick={() => carouselApi?.scrollNext()} aria-label="Próxima história" title="Próxima história"
                className="w-10 h-10 rounded-full border border-slate-200 bg-white text-slate-700 flex items-center justify-center hover:border-blue-300 hover:text-blue-700 transition-colors">
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Carousel>

        <div className="text-center mt-10">
          <button
            onClick={() => setShowForm(value => !value)}
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-slate-950 font-black shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all"
            style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeBrightEnd} 100%)` }}
          >
            <Star className="w-5 h-5" fill="currentColor" />
            {showForm ? "Fechar formulário" : "Compartilhar minha história"}
          </button>
        </div>

        {showForm && (
          <div className="max-w-3xl mx-auto mt-8 bg-white rounded-3xl p-6 sm:p-8 border border-orange-100 shadow-xl">
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: C.orange }}>
                Sua experiência
              </p>
              <h3 className="text-2xl font-black text-slate-900">Como o curso mudou sua vida?</h3>
              <p className="text-sm text-slate-500 mt-2">
                Compartilhe sua experiência para inspirar outras pessoas a também buscarem uma oportunidade.
              </p>
            </div>

            <form onSubmit={submitTestimonial} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-sm font-black text-slate-700 mb-2">Seu nome</span>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={60}
                    required
                    placeholder="Ex.: João Silva"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm font-black text-slate-700 mb-2">Profissão / situação atual</span>
                  <input
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    maxLength={80}
                    required
                    placeholder="Ex.: Auxiliar administrativo"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </label>
              </div>

              <label className="block">
                <span className="block text-sm font-black text-slate-700 mb-2">Curso realizado</span>
                <input
                  value={course}
                  onChange={e => setCourse(e.target.value)}
                  maxLength={100}
                  required
                  placeholder="Ex.: Introdução à Programação"
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </label>

              <div>
                <span className="block text-sm font-black text-slate-700 mb-2">Sua avaliação</span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setRating(i + 1)}
                      aria-label={`Dar ${i + 1} estrela${i === 0 ? "" : "s"}`}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className="w-7 h-7"
                        fill={i < rating ? C.orange : "none"}
                        style={{ color: i < rating ? C.orange : "#94a3b8" }}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-sm font-bold text-slate-500">{rating}/5</span>
                </div>
              </div>

              <label className="block">
                <span className="block text-sm font-black text-slate-700 mb-2">
                  Conte sua história
                </span>
                <textarea
                  value={quote}
                  onChange={e => setQuote(e.target.value)}
                  maxLength={500}
                  required
                  rows={5}
                  placeholder="Conte o que mudou depois do curso: conseguiu emprego, abriu um negócio, mudou de carreira, aumentou sua renda..."
                  className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold outline-none resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
                <div className="text-right text-xs text-slate-400 font-semibold mt-1">
                  {quote.length}/500
                </div>
              </label>

              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pt-2">
                <p className="text-xs text-slate-400 max-w-md">
                  Ao enviar, o depoimento é salvo localmente neste navegador. Para publicação pública real,
                  será necessário conectar este formulário a um banco de dados/backend.
                </p>

                <button
                  type="submit"
                  className="shrink-0 px-7 py-3.5 rounded-xl text-white font-black shadow-lg hover:scale-105 transition-all"
                  style={{ background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueDark} 100%)` }}
                >
                  Publicar depoimento
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── HomePage ─────────────────────────────────────────────────────────────────
function HomePage({ navigate, onViewCourse, onEnrollCourse, favoriteCourseIds, onToggleFavorite, profile }: { navigate: (p: Page) => void; onViewCourse: (c: Course) => void; onEnrollCourse: (course: Course) => void; favoriteCourseIds: number[]; onToggleFavorite: (id: number) => void; profile: UserProfile | null }) {
  const [bgIdx, setBgIdx] = useState(0);
  const heroBgs = [
    { src: vitoriaDoisOlhos1, alt: "Vista panorâmica do skyline de Vitória-ES" },
    { src: vitoriaTerceiraPonte, alt: "Panorama da Terceira Ponte em Vitória-ES" },
    { src: vitoriaDoisOlhos2, alt: "Vista da cidade de Vitória-ES a partir da Pedra dos Dois Olhos" },
    { src: qualificavixTecnologia, alt: "Curso profissionalizante de tecnologia do QualificaVix" },
    { src: qualificavixInformatica, alt: "Aula de informática e capacitação profissional do QualificaVix" },
    { src: qualificavixCulinaria, alt: "Curso profissionalizante de culinária do QualificaVix" },
    { src: qualificavixCozinhaAula, alt: "Sala de aula de gastronomia do QualificaVix" },
    { src: qualificavixPanificacao, alt: "Curso profissionalizante de panificação do QualificaVix" },
  ];
  useEffect(() => {
    const t = setInterval(() => setBgIdx(i => (i + 1) % heroBgs.length), 5000);
    return () => clearInterval(t);
  }, []);

  const featured = COURSES.filter(c => c.featured).sort((a, b) => (a.featured ?? 0) - (b.featured ?? 0));

  return (
    <div>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.blueDark} 0%, ${C.blue} 60%, ${C.blueMid} 100%)` }}>
        {heroBgs.map((bg, i) => (
          <div key={bg.src} className={`absolute inset-0 transition-opacity duration-1000 ${i === bgIdx ? "opacity-45" : "opacity-0"}`}>
            <img src={bg.src} alt={bg.alt} loading={i < 2 ? "eager" : "lazy"}
              className="w-full h-full object-cover object-center scale-[1.01]" />
          </div>
        ))}
        {/* Dot pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 border border-white/20 mb-4 sm:mb-6">
                <Zap className="w-3.5 h-3.5 text-yellow-300" />
                <span className="text-[10px] sm:text-xs font-bold text-yellow-100">Cursos 100% gratuitos · Certificado incluso</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight mb-4 sm:mb-5">
                Encontre oportunidades para{" "}
                <span style={{ color: C.orange }}>transformar</span>
                {" "}o seu futuro.
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-blue-100 mb-6 sm:mb-8 leading-relaxed max-w-lg">
                Cursos, capacitações e oportunidades de qualificação profissional para você em Vitória&nbsp;-&nbsp;ES.
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                <button onClick={() => navigate("cursos")}
                  className="flex items-center justify-center gap-2 font-black text-slate-900 px-5 sm:px-7 py-3 sm:py-3.5 rounded-2xl shadow-xl hover:scale-105 transition-all text-sm sm:text-base"
                  style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeBrightEnd} 100%)` }}>
                  Explorar cursos <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button onClick={() => navigate("sobre")}
                  className="flex items-center justify-center gap-2 font-bold text-white px-5 sm:px-7 py-3 sm:py-3.5 rounded-2xl border-2 border-white/30 hover:bg-white/10 transition-all text-sm sm:text-base">
                  Saiba mais
                </button>
              </div>

              {/* Mini stats */}
              <div className="mt-8 sm:mt-10 grid grid-cols-3 gap-2 sm:gap-3 max-w-sm">
                {[
                  { n: "156+", l: "Cursos ativos" },
                  { n: "12k+", l: "Formados" },
                  { n: "20+", l: "Unidades" },
                ].map(s => (
                  <div key={s.l} className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5 sm:p-3 text-center border border-white/10">
                    <p className="text-xl sm:text-2xl font-black text-amber-300">{s.n}</p>
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-blue-100 font-semibold mt-0.5">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Wave bottom */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden">
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="block -mt-px" style={{ display: "block" }}>
            <path d="M0 48L1440 48L1440 0C1440 0 1200 40 720 40C240 40 0 0 0 0L0 48Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* ── Categorias ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div>
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest mb-1" style={{ color: C.orangeDark }}>Explore por área</p>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900">Explore por categoria</h2>
          </div>
          <button onClick={() => navigate("categorias")}
            className="flex items-center gap-1 text-xs sm:text-sm font-bold hover:underline" style={{ color: C.blue }}>
            Ver todos <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => navigate("cursos")}
              className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-2xl border border-slate-100 bg-white hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200 transition-all group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"
                style={{ backgroundColor: `${cat.color}18` }}>
                <cat.icon className="w-6 h-6" style={{ color: cat.color }} />
              </div>
              <div className="text-center">
                <p className="text-[10px] sm:text-xs font-black text-slate-800 leading-tight">{cat.label}</p>
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-semibold mt-0.5">{cat.count} cursos</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Cursos em destaque ── */}
      <section className="bg-slate-50 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: C.orangeDark }}>Mais populares</p>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Cursos em destaque</h2>
            </div>
            <button onClick={() => navigate("cursos")}
              className="flex items-center gap-1 text-sm font-bold hover:underline" style={{ color: C.blue }}>
              Ver todas <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {featured.map((c, i) => (
              <div key={c.id} className="relative">
                <div className="absolute -top-3 left-3 z-10 text-xs font-black px-3 py-1 rounded-full shadow-lg"
                  style={{ color: i === 0 ? "#123047" : "#ffffff", background: i === 0 ? C.orange : i === 1 ? C.blue : i === 2 ? "#7c3aed" : "#db2777" }}>
                  {i === 0 ? "1º Destaque" : i === 1 ? "2º Destaque" : i === 2 ? "3º Destaque" : "4º Destaque"}
                </div>
                <CourseCard course={c} onView={onViewCourse} isFavorite={favoriteCourseIds.includes(c.id)} onToggleFavorite={onToggleFavorite} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Como funciona ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <style>{`
          @keyframes registration-step-enter {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes registration-flow-draw {
            to { transform: scaleX(1); }
          }
          .registration-step { animation: registration-step-enter 480ms cubic-bezier(.2,.7,.2,1) both; }
          .registration-flow-track { display: none; }
          .registration-flow-track::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, #ff8500, #ffb21a);
            transform: scaleX(0);
            transform-origin: left;
            animation: registration-flow-draw 1.4s 250ms ease-out forwards;
          }
          @media (min-width: 1024px) {
            .registration-flow-track { display: block; }
          }
          @media (prefers-reduced-motion: reduce) {
            .registration-step, .registration-flow-track::after { animation: none; }
          }
        `}</style>
        <div className="text-center mb-12">
          <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: C.orangeDark }}>Simples assim</p>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Como se inscrever</h2>
          <p className="text-slate-500 mt-2 text-sm max-w-md mx-auto">Quatro passos simples para começar sua jornada de qualificação.</p>
        </div>
        <div className="relative">
          <div aria-hidden="true" className="registration-flow-track absolute left-[12.5%] right-[12.5%] top-[5rem] h-0.5 rounded-full bg-slate-200" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {[
            { step: "01", icon: UserCheck, title: "Crie sua conta", desc: "Cadastre-se gratuitamente com seus dados pessoais.", color: C.blue, action: () => navigate(profile ? "profile" : "register") },
            { step: "02", icon: Search, title: "Encontre o curso", desc: "Navegue pelo catálogo e escolha o que combina com você.", color: "#7c3aed", action: () => navigate("cursos") },
            { step: "03", icon: BookOpen, title: "Faça a inscrição", desc: "Inscreva-se no curso desejado com um clique.", color: C.orange, action: () => navigate("cursos") },
            { step: "04", icon: Award, title: "Receba o certificado", desc: "Conclua o curso e consulte suas informações no perfil.", color: "#16a34a", action: () => navigate(profile ? "profile" : "cursos") },
          ].map((stepItem, index) => (
            <button key={stepItem.step} type="button" onClick={stepItem.action}
              style={{ animationDelay: `${index * 110}ms` }}
              className="registration-step group relative z-10 min-h-64 w-full rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 text-left shadow-sm hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 transition-all">
              <span className="absolute top-4 right-4 text-5xl font-black opacity-[0.06]" style={{ color: stepItem.color }}>{stepItem.step}</span>
              <div className="relative z-10 mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ring-4 ring-white shadow-sm transition-transform group-hover:scale-105"
                style={{ backgroundColor: `${stepItem.color}15` }}>
                <stepItem.icon className="w-6 h-6" style={{ color: stepItem.color }} />
              </div>
              <h3 className="font-black text-slate-900 mb-2 flex items-center justify-between gap-2">
                {stepItem.title}<ArrowRight className="w-4 h-4 shrink-0 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-orange-500" />
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">{stepItem.desc}</p>
            </button>
          ))}
          </div>
        </div>
      </section>

      {/* ── Depoimentos e histórias de transformação ── */}
      <TestimonialsSection onEnrollCourse={onEnrollCourse} />

      {/* ── CTA Banner ── */}
      <section className="py-16" style={{ background: `linear-gradient(135deg, ${C.blueDark} 0%, ${C.blue} 100%)` }}>
        <div className="max-w-3xl mx-auto px-4 text-center text-white">
          <img src={qualificaVixLogo} alt="Qualifica Vix" className="w-32 h-28 object-contain mx-auto mb-4" />
          <h2 className="text-3xl font-black mb-3">Pronto para começar?</h2>
          <p className="text-blue-100 mb-7 font-medium">
            Mais de 12 mil cidadãos já transformaram suas carreiras. Cadastre-se e comece hoje.
          </p>
          <button onClick={() => navigate("register")}
            className="font-black text-slate-900 px-8 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all inline-flex items-center gap-2"
            style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeBrightEnd} 100%)` }}>
            Criar conta gratuita <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>
    </div>
  );
}

// ─── CoursesPage ──────────────────────────────────────────────────────────────
function CoursesPage({ navigate, onViewCourse, favoriteCourseIds, onToggleFavorite }: { navigate: (p: Page) => void; onViewCourse: (c: Course) => void; favoriteCourseIds: number[]; onToggleFavorite: (id: number) => void }) {
  const [search, setSearch] = useState(() => {
    const initialSearch = sessionStorage.getItem("qualificavix-course-search") ?? "";
    sessionStorage.removeItem("qualificavix-course-search");
    return initialSearch;
  });
  const [catFilter, setCatFilter] = useState("Todas");
  const [modalFilter, setModalFilter] = useState("Todas");
  const [areaFilter, setAreaFilter] = useState("Todas");

  const filtered = COURSES.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase()) ||
                        c.category.toLowerCase().includes(search.toLowerCase());
    const matchCat  = catFilter === "Todas"  || c.category === catFilter;
    const matchMod  = modalFilter === "Todas" || c.modality === modalFilter;
    return matchSearch && matchCat && matchMod;
  });

  const cats = ["Todas", ...Array.from(new Set(COURSES.map(c => c.category)))];
  const mods = ["Todas", "Online", "Presencial", "Híbrido"];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-100 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-3 font-semibold">
            <MapPin className="w-4 h-4" style={{ color: C.blue }} />
            <span style={{ color: C.blue }}>Vitória - ES</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-1">Encontre o curso ideal para você</h1>
          <p className="text-slate-500 font-medium">Explore opções de cursos e capacitações disponíveis em Vitória - ES.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search + filters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-sm">
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar cursos, áreas ou palavras-chave..."
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:border-blue-400 transition-colors" />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-lg text-sm font-bold text-white"
              style={{ background: C.blue }}>
              Buscar
            </button>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            {[
              { label: "Categoria", value: catFilter, setter: setCatFilter, opts: cats },
              { label: "Modalidade", value: modalFilter, setter: setModalFilter, opts: mods },
            ].map(f => (
              <div key={f.label} className="relative">
                <select value={f.value} onChange={e => f.setter(e.target.value)}
                  className="appearance-none h-9 pl-3 pr-8 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 outline-none cursor-pointer bg-white hover:border-blue-300 focus:border-blue-400 transition-colors">
                  {f.opts.map(o => <option key={o}>{o === "Todas" ? `${f.label}: ${o}` : o}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            ))}
            <button onClick={() => { setCatFilter("Todas"); setModalFilter("Todas"); setSearch(""); }}
              className="h-9 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-500 hover:border-red-300 hover:text-red-500 transition-colors flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Limpar filtros
            </button>
            <div className="ml-auto flex items-center gap-2 text-sm text-slate-500 font-semibold">
              <span className="font-black text-slate-900">{filtered.length}</span> cursos encontrados
            </div>
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <Search className="w-12 h-12 mx-auto mb-4 text-slate-300" aria-hidden="true" />
            <p className="font-bold text-slate-500">Nenhum curso encontrado para sua busca.</p>
            <button onClick={() => setSearch("")} className="mt-3 text-sm font-bold" style={{ color: C.blue }}>
              Limpar busca
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map(c => <CourseCard key={c.id} course={c} onView={onViewCourse} isFavorite={favoriteCourseIds.includes(c.id)} onToggleFavorite={onToggleFavorite} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function FavoritesPage({ favoriteCourseIds, onToggleFavorite, onViewCourse, navigate }: { favoriteCourseIds: number[]; onToggleFavorite: (id: number) => void; onViewCourse: (c: Course) => void; navigate: (p: Page) => void }) {
  const favoriteCourses = COURSES.filter(course => favoriteCourseIds.includes(course.id));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: C.orangeDark }}>Sua lista</p>
          <h1 className="text-3xl font-black text-slate-900 mb-1">Cursos favoritados</h1>
          <p className="text-slate-500 font-medium">Guarde cursos para consultar e se inscrever depois. A lista fica salva neste navegador.</p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {favoriteCourses.length ? (
          <>
            <p className="text-sm font-semibold text-slate-500 mb-5">{favoriteCourses.length} {favoriteCourses.length === 1 ? "curso salvo" : "cursos salvos"}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {favoriteCourses.map(course => (
                <CourseCard key={course.id} course={course} onView={onViewCourse} isFavorite onToggleFavorite={onToggleFavorite} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <Heart className="w-12 h-12 mx-auto mb-4 text-slate-300" aria-hidden="true" />
            <h2 className="font-black text-slate-800 mb-2">Sua lista está vazia</h2>
            <p className="text-sm text-slate-500 mb-5">Use o coração nos cursos para guardá-los aqui.</p>
            <button onClick={() => navigate("cursos")} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white font-black" style={{ background: C.blue }}>
              Explorar cursos <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CourseDetailPage ─────────────────────────────────────────────────────────
function CourseDetailPage({ course, navigate, onRegister, enrolled, isFavorite, onToggleFavorite, onUnsubscribe }: { course: Course; navigate: (p: Page) => void; onRegister: () => void; enrolled: boolean; isFavorite: boolean; onToggleFavorite: (id: number) => void; onUnsubscribe: (courseId: number) => void }) {
  const [tab, setTab] = useState<"sobre" | "conteudo" | "instrutor" | "requisitos" | "certificado" | "instituicao">(enrolled ? "conteudo" : "sobre");

  const handlePrimaryAction = () => {
    if (enrolled) {
      onUnsubscribe(course.id);
      return;
    }

    onRegister();
  };

  const tabs = [
    { id: "sobre",       label: "Sobre o curso" },
    { id: "conteudo",    label: "Conteúdo programático" },
    { id: "instrutor",   label: "Instrutor" },
    { id: "requisitos",  label: "Requisitos" },
    { id: "certificado", label: "Certificado" },
    { id: "instituicao", label: "Instituição" },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <button onClick={() => navigate("cursos")}
          className="flex items-center gap-1.5 text-sm font-semibold mb-6 hover:underline" style={{ color: C.blue }}>
          <ArrowLeft className="w-4 h-4" /> Voltar para o catálogo
        </button>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Imagem */}
          <div className="rounded-3xl overflow-hidden h-64 lg:h-80 relative bg-slate-100 shadow-sm border border-slate-200">
            <img
              src={courseImage(course)}
              alt={course.title} className="absolute inset-0 w-full h-full object-cover" />
          </div>

          {/* Info */}
          <div>
            <span className="inline-block text-xs font-black px-3 py-1 rounded-full text-white mb-3"
              style={{ backgroundColor: course.categoryColor }}>
              {course.category}
            </span>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 mb-3 leading-tight">{course.title}</h1>
            <p className="text-slate-500 leading-relaxed mb-5 font-medium">{course.description}</p>

            {/* Info pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { icon: Clock,   label: `${course.hours} horas`,   sub: "Carga horária" },
                { icon: Monitor, label: course.modality,           sub: "Modalidade" },
                { icon: Star,    label: course.level,              sub: "Nível" },
              ].map(info => (
                <div key={info.sub} className="bg-slate-100 rounded-xl p-3 text-center">
                  <info.icon className="w-5 h-5 mx-auto mb-1" style={{ color: C.blue }} />
                  <p className="font-black text-xs text-slate-900">{info.label}</p>
                  <p className="text-[10px] text-slate-500 font-semibold">{info.sub}</p>
                </div>
              ))}
              {course.location && course.modality !== "Online" && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${course.location}, Vitória - ES`)}`}
                  target="_blank" rel="noopener noreferrer"
                  aria-label={`Abrir rota para ${course.location} no Google Maps`}
                  title={`Como chegar a ${course.location}`}
                  className="bg-slate-100 rounded-xl p-3 text-center hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
                  <MapPin className="w-5 h-5 mx-auto mb-1" style={{ color: C.blue }} />
                  <p className="font-black text-xs text-slate-900">{course.location}</p>
                  <p className="text-[10px] text-slate-500 font-semibold">Como chegar</p>
                </a>
              )}
            </div>

            <div className="flex flex-wrap gap-3 mb-5">
              <StatusBadge status={course.status} />
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                📅 {course.period}
              </span>
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                ⏱ Duração prevista: {course.duration}
              </span>
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                👥 {course.enrolled} inscrições informadas no catálogo
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mb-5">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Instituição ofertante</p>
                <p className="text-xs font-bold text-slate-800">{course.provider}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Local do curso</p>
                <p className="text-xs font-bold text-slate-800">
                  {course.location || (course.modality === "Online" ? "Online, sem polo presencial informado" : "Polo presencial não informado")}
                </p>
                {course.location && <p className="text-[10px] text-slate-500 mt-1">Endereço completo não consta nesta ficha.</p>}
              </div>
              <div className="sm:col-span-2 rounded-xl border border-green-100 bg-green-50 p-3">
                <p className="text-xs font-black text-green-800">Referência salarial mensal de profissionais da área: {course.avgSalary}</p>
                <p className="text-[10px] leading-relaxed text-green-800/80 mt-1">
                  Valor ilustrativo do catálogo, sem fonte estatística ou recorte metodológico informado. A remuneração varia por função, experiência, região e vínculo; concluir o curso não garante emprego nem salário.
                </p>
              </div>
            </div>

            {/* Indicado para */}
            <div className="mb-5">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Indicado para</p>
              <div className="flex flex-wrap gap-2">
                {course.targetAudience.map(t => (
                  <span key={t} className="text-xs font-bold px-3 py-1 rounded-full border"
                    style={{ borderColor: C.blue, color: C.blue, backgroundColor: C.bluePale }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handlePrimaryAction}
                className="flex-1 flex items-center justify-center gap-2 font-black text-slate-950 py-3.5 rounded-xl hover:opacity-90 hover:-translate-y-0.5 transition-all shadow-lg"
                style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeBrightEnd} 100%)` }}>
                {enrolled ? "Desinscrever-se" : "Inscrever-se"} <ArrowRight className="w-5 h-5" />
              </button>
              <button onClick={() => onToggleFavorite(course.id)}
                aria-label={isFavorite ? `Remover ${course.title} dos favoritos` : `Adicionar ${course.title} aos favoritos`}
                aria-pressed={isFavorite}
                title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-colors ${isFavorite ? "border-red-300 text-red-500 bg-red-50" : "border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-500"}`}>
                <Heart className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex overflow-x-auto border-b border-slate-100">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`shrink-0 px-5 py-4 text-sm font-bold border-b-2 transition-colors ${
                  tab === t.id
                    ? "border-orange-500 text-orange-600 bg-orange-50"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          <div id="curso-informacoes" className="p-6 lg:p-8">
            {tab === "sobre" && (
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <h3 className="font-black text-slate-900 text-lg mb-4">O que você vai aprender</h3>
                  <ul className="space-y-2.5 mb-8">
                    {course.whatYouLearn.map(item => (
                      <li key={item} className="flex items-start gap-2.5 text-sm font-semibold text-slate-700">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.blue }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <h3 className="font-black text-slate-900 text-lg mb-3">Sobre o curso</h3>
                  <p className="text-slate-600 leading-relaxed">{course.about}</p>
                </div>
                <div>
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <h4 className="font-black text-slate-900 mb-4">Dados desta oferta</h4>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                        <Building2 className="w-6 h-6" style={{ color: C.blue }} />
                      </div>
                      <div>
                        <p className="font-black text-sm text-slate-900">{course.provider}</p>
                        <p className="text-xs text-slate-500 font-semibold">Instituição responsável conforme cadastro</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[
                        { icon: Clock, label: `${course.hours} horas de carga horária prevista` },
                        { icon: Clock, label: `Duração estimada: ${course.duration}` },
                        { icon: MapPin, label: course.location || "Oferta online; local físico não aplicável" },
                      ].map(item => (
                        <div key={item.label} className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <item.icon className="w-4 h-4" style={{ color: C.blue }} />
                          {item.label}
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-4">
                      Datas, endereço completo, instrutor, regras de certificado e confirmação da parceria não estão detalhados nesta ficha. Consulte o edital da turma antes de se inscrever.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {tab === "conteudo" && (
              <div>
                <h3 className="font-black text-slate-900 text-lg mb-5">Conteúdo programático</h3>
                <div className="space-y-3">
                  {course.whatYouLearn.map((topic, i) => (
                    <div key={topic} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-blue-200 transition-colors">
                      <span className="w-8 h-8 rounded-full font-black text-sm flex items-center justify-center text-white shrink-0"
                        style={{ background: C.blue }}>{i + 1}</span>
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Tópico {i + 1}</p>
                        <p className="font-semibold text-sm text-slate-700">{topic}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "instrutor" && (
              <div className="flex items-start gap-5">
                <div className="w-20 h-20 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
                  <Users className="w-8 h-8" style={{ color: C.blue }} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">Instrutor da turma</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Nome, formação e experiência do instrutor não foram informados no cadastro deste curso. Esses dados devem ser publicados pela instituição responsável junto ao calendário da turma.
                  </p>
                </div>
              </div>
            )}

            {tab === "requisitos" && (
              <div>
                <h3 className="font-black text-slate-900 text-lg mb-4">Pré-requisitos</h3>
                <div className="space-y-2">
                  { [
                    `Nível informado no catálogo: ${course.level}. Isso não substitui os pré-requisitos oficiais.`,
                    "Idade mínima, escolaridade e experiência prévia: confirmar no edital da turma.",
                    "Documentos, prazo de inscrição e critérios de seleção: confirmar com a instituição ofertante.",
                    course.modality === "Online" ? "É necessário acesso a um dispositivo compatível e à internet; plataforma e requisitos técnicos devem ser confirmados." : "Confira datas, turno e endereço completo do polo antes de se deslocar.",
                  ].map(r => (
                    <div key={r} className="flex items-center gap-2 text-sm font-semibold text-slate-700 p-3 bg-slate-50 rounded-xl">
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: C.blue }} />
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "certificado" && (
              <div className="text-center max-w-md mx-auto py-6">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: `${C.orange}15` }}>
                  <Award className="w-10 h-10" style={{ color: C.orange }} />
                </div>
                <h3 className="font-black text-slate-900 text-xl mb-3">Certificação</h3>
                <p className="text-slate-600 leading-relaxed mb-5 text-sm">
                  Esta ficha não informa se há certificado, quem o emite nem quais são os critérios de frequência e aproveitamento. Confirme essas condições no edital ou diretamente com a instituição ofertante antes da inscrição.
                </p>
                <div className="bg-slate-50 rounded-xl p-4 text-sm font-semibold text-slate-600">
                  A conclusão do curso não garante contratação, renda ou habilitação profissional regulamentada.
                </div>
              </div>
            )}

            {tab === "instituicao" && (
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-black text-slate-900 text-lg mb-4">Instituição e local do curso</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4">
                    <strong>Instituição ofertante:</strong> {course.provider}.<br />
                    <strong>Modalidade:</strong> {course.modality}.<br />
                    <strong>Local do curso:</strong> {course.location || (course.modality === "Online" ? "Online, sem polo presencial cadastrado." : "Não informado no catálogo.")}
                  </p>
                  <div className="space-y-2 text-sm font-semibold text-slate-600">
                    <p className="flex items-center gap-2"><MapPin className="w-4 h-4" style={{ color: C.blue }} /> Endereço completo: não informado nesta ficha</p>
                    {course.location && <p className="flex items-center gap-2"><Globe className="w-4 h-4" style={{ color: C.blue }} /> Use o mapa do local cadastrado e confirme a unidade antes de sair.</p>}
                  </div>
                </div>
                <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                  <h4 className="font-black text-slate-900 mb-3">Confirmações importantes</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Unidade, endereço, calendário, vagas, responsável pela oferta e regras de certificação podem variar por turma. A ficha atual não contém um contato direto nem o edital; consulte o canal oficial indicado para a inscrição para validar essas informações.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SobrePage ────────────────────────────────────────────────────────────────
function SobrePage({ navigate }: { navigate: (p: Page) => void }) {
  return (
    <div className="min-h-screen">
      {/* Hero da página */}
      <div className="py-16 text-white relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${C.blueDark} 0%, ${C.blue} 100%)` }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <img src={qualificaVixLogo} alt="Qualifica Vix" className="w-32 h-28 object-contain mx-auto mb-5" />
          <h1 className="text-4xl font-black mb-4">Sobre o QualificaVix</h1>
          <p className="text-xl text-blue-100 leading-relaxed font-medium max-w-2xl mx-auto">
            A plataforma oficial de cursos profissionalizantes gratuitos da Prefeitura de Vitória para os cidadãos capixabas.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Missão */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: C.orangeDark }}>Nossa missão</p>
            <h2 className="text-3xl font-black text-slate-900 mb-5 leading-tight">
              Qualificação profissional acessível para todo cidadão vitoriense
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              O <strong>QualificaVix</strong> é a plataforma digital de qualificação profissional criada pela
              Prefeitura Municipal de Vitória para democratizar o acesso à educação profissional de qualidade.
              Através de parcerias estratégicas com instituições de excelência como Senac, Senai, Sesc e
              diversas entidades educacionais, oferecemos <strong>cursos 100% gratuitos</strong> para
              moradores de Vitória - ES que desejam ingressar, recolocar-se ou crescer no mercado de trabalho.
            </p>
            <p className="text-slate-600 leading-relaxed">
              Acreditamos que a <strong>educação é o principal motor de transformação social</strong>.
              Por isso, trabalhamos para eliminar as barreiras que impedem o acesso ao conhecimento —
              sejam elas financeiras, geográficas ou de informação.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { n: "12.000+", l: "Alunos formados desde 2019", color: C.blue },
              { n: "156",     l: "Cursos ativos no catálogo",  color: C.orange },
              { n: "20+",     l: "Unidades de atendimento",    color: "#7c3aed" },
              { n: "89%",     l: "Taxa de empregabilidade",    color: "#16a34a" },
            ].map(s => (
              <div key={s.l} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-center">
                <p className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.n}</p>
                <p className="text-xs text-slate-500 font-semibold leading-snug">{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Por que criamos */}
        <div className="bg-blue-50 rounded-3xl p-8 lg:p-10 mb-16 border border-blue-100">
          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: C.blue }}>Contexto e propósito</p>
          <h2 className="text-2xl font-black text-slate-900 mb-5">Por que o QualificaVix existe?</h2>
          <div className="grid md:grid-cols-2 gap-6 text-slate-700">
            <div>
              <p className="leading-relaxed mb-4">
                Vitória é uma cidade de oportunidades. Capital de um dos estados mais prósperos do Brasil,
                o Espírito Santo tem um mercado de trabalho aquecido com alta demanda por profissionais
                qualificados em diversas áreas — de tecnologia e design à gastronomia, saúde e construção civil.
              </p>
              <p className="leading-relaxed">
                No entanto, identificamos que muitos cidadãos vitorienses encontravam barreiras para acessar
                formação profissional de qualidade: custos elevados de cursos, falta de informação sobre
                oportunidades disponíveis e dificuldade de conciliar estudos com rotina de trabalho.
              </p>
            </div>
            <div>
              <p className="leading-relaxed mb-4">
                O <strong>QualificaVix</strong> nasceu para resolver esses desafios. Criado pela Secretaria
                de Cidadania, Trabalho e Educação, a plataforma centraliza todas as oportunidades de
                qualificação profissional do município em um único lugar digital, acessível a qualquer hora
                pelo celular, tablet ou computador.
              </p>
              <p className="leading-relaxed">
                Com modalidades presenciais, online e híbridas, atendemos desde jovens em busca do
                primeiro emprego até profissionais experientes que buscam atualização ou mudança de carreira.
                <strong> Todas as idades. Todos os perfis. Todas as possibilidades.</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Como funciona */}
        <div className="mb-16">
          <p className="text-xs font-black uppercase tracking-widest mb-3 text-center" style={{ color: C.orangeDark }}>Metodologia</p>
          <h2 className="text-2xl font-black text-slate-900 mb-8 text-center">Como a plataforma funciona</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: Target,    title: "Curadoria de qualidade",    color: C.blue,   desc: "Todos os cursos passam por rigorosa avaliação pedagógica antes de entrar no catálogo. Trabalhamos apenas com instituições credenciadas pelo MEC ou com histórico comprovado de excelência." },
              { icon: Users,     title: "Para todos os perfis",      color: C.orange, desc: "Do jovem aprendiz ao profissional sênior, do desempregado ao empreendedor em potencial — nosso catálogo tem trilhas de aprendizado para cada momento da vida profissional." },
              { icon: Award,     title: "Certificação reconhecida",  color: "#16a34a",desc: "Todos os cursos emitem certificado digital reconhecido pela Prefeitura de Vitória, com validade para comprovação em carteira de trabalho e processos seletivos." },
            ].map(item => (
              <div key={item.title} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${item.color}15` }}>
                  <item.icon className="w-6 h-6" style={{ color: item.color }} />
                </div>
                <h3 className="font-black text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Parceiros */}
        <div className="mb-16">
          <h2 className="text-2xl font-black text-slate-900 mb-6 text-center">Instituições parceiras</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {["Senac Vitória", "Senai ES", "Sesc ES", "Sebrae ES", "IFES", "Hub de Inovação", "Secretaria de Ed.", "Sine Vitória"].map(inst => (
              <div key={inst} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-center text-center h-16">
                <p className="font-black text-xs text-slate-600">{inst}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <button onClick={() => navigate("register")}
            className="font-black text-slate-950 px-8 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all inline-flex items-center gap-2 mr-3"
            style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeBrightEnd} 100%)` }}>
            Criar conta gratuita <ArrowRight className="w-5 h-5" />
          </button>
          <button onClick={() => navigate("cursos")}
            className="font-black px-8 py-4 rounded-2xl border-2 hover:bg-blue-50 transition-colors inline-flex items-center gap-2"
            style={{ borderColor: C.blue, color: C.blue }}>
            Ver catálogo de cursos
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CategoriasPage ───────────────────────────────────────────────────────────
function CategoriasPage({ navigate, onViewCourse, favoriteCourseIds, onToggleFavorite }: { navigate: (p: Page) => void; onViewCourse: (c: Course) => void; favoriteCourseIds: number[]; onToggleFavorite: (id: number) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const filtered = selected ? COURSES.filter(c => c.category === selected) : COURSES;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-black text-slate-900 mb-1">Categorias</h1>
          <p className="text-slate-500 font-medium">Navegue pelos cursos agrupados por área de conhecimento.</p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category pills */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button onClick={() => setSelected(null)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${!selected ? "text-white border-transparent shadow" : "border-slate-200 text-slate-600 hover:border-blue-300"}`}
            style={!selected ? { background: C.blue } : {}}>
            Todas as áreas
          </button>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setSelected(cat.label === selected ? null : cat.label)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${selected === cat.label ? "text-white border-transparent shadow" : "border-slate-200 text-slate-600 hover:border-blue-300 bg-white"}`}
              style={selected === cat.label ? { background: cat.color } : {}}>
              <cat.icon className="w-4 h-4" />
              {cat.label}
              <span className="text-xs opacity-70">({cat.count})</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(c => <CourseCard key={c.id} course={c} onView={onViewCourse} isFavorite={favoriteCourseIds.includes(c.id)} onToggleFavorite={onToggleFavorite} />)}
        </div>
      </div>
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer({ navigate }: { navigate: (p: Page) => void }) {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-14 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={qualificaVixLogo} alt="Qualifica Vix" className="w-24 h-16 object-contain" />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-5">
              Plataforma oficial de qualificação profissional da Prefeitura Municipal de Vitória - ES.
            </p>
            <div className="flex gap-2.5" aria-label="Redes sociais oficiais da Prefeitura de Vitória">
              {[
                { label: "Facebook oficial da Prefeitura de Vitória", url: "https://www.facebook.com/vitoriaonline", icon: Facebook },
                { label: "Instagram oficial da Prefeitura de Vitória", url: "https://www.instagram.com/vitoriaonline", icon: Instagram },
                { label: "X oficial da Prefeitura de Vitória", url: "https://x.com/vitoriaonline", icon: Twitter },
              ].map(({ label, url, icon: Icon }) => (
                <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                  aria-label={label} title={label}
                  className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-blue-600 hover:border-blue-600 hover:-translate-y-0.5 transition-all">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
          {[
            { title: "Plataforma", links: [{ label: "Início", page: "home" }, { label: "Cursos", page: "cursos" }, { label: "Favoritos", page: "favorites" }, { label: "Categorias", page: "categorias" }, { label: "Sobre", page: "sobre" }] },
            { title: "Cursos", links: [{ label: "Tecnologia" }, { label: "Administração" }, { label: "Gastronomia" }, { label: "Design" }, { label: "Saúde" }] },
            { title: "Contato", links: [] },
          ].map(col => (
            <div key={col.title}>
              <h4 className="font-black text-white text-sm mb-4 uppercase tracking-wide">{col.title}</h4>
              {col.title === "Contato" ? (
                <ul className="space-y-2.5 text-sm">
                  <li className="flex items-start gap-2 text-slate-400"><MapPin className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" /> Vitória, Espírito Santo, Brasil</li>
                  <li className="flex items-center gap-2 text-slate-400"><Phone className="w-4 h-4 shrink-0 text-amber-400" /> 0800 123 4567</li>
                  <li className="flex items-center gap-2 text-slate-400"><Mail className="w-4 h-4 shrink-0 text-amber-400" /> contato@qualificavix.es.gov.br</li>
                </ul>
              ) : (
                <ul className="space-y-2">
                  {col.links.map((l: any) => (
                    <li key={l.label}>
                      <button onClick={() => l.page && navigate(l.page as Page)}
                        className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 group font-semibold">
                        <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        {l.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 font-semibold">
          <p>© {new Date().getFullYear()} QualificaVix · Prefeitura Municipal de Vitória · Todos os direitos reservados</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-slate-300 transition-colors">Termos de Uso</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Política de Privacidade</a>
            <a href="#" className="hover:text-slate-300 transition-colors">LGPD</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Chatbot Tortuguita ───────────────────────────────────────────────────────
const normalizeChatText = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const CHAT_SUGGESTED_QUESTIONS = [
  { terms: ["inscri", "matric", "cadastr", "cadastro"], question: "Como faço minha inscrição?" },
  { terms: ["perfil", "conta", "editar", "alterar", "dados"], question: "Quais dados posso editar no meu perfil?" },
  { terms: ["gratuit", "preco", "valor", "pagar", "custo", "mensalidade"], question: "Os cursos são gratuitos?" },
  { terms: ["modalidade", "online", "presencial", "hibrido", "tipo"], question: "Quais cursos são online ou presenciais?" },
  { terms: ["local", "endereco", "mapa", "chegar", "unidade", "onde fica"], question: "Como encontro o local do curso?" },
  { terms: ["certific", "diploma", "conclusao", "aproveitamento"], question: "Quais são os critérios do certificado?" },
  { terms: ["busca", "buscar", "filtro", "pesquisa", "filtrar"], question: "Como buscar e filtrar cursos?" },
  { terms: ["vaga", "disponivel", "aberta", "turma"], question: "Como vejo se um curso tem vaga?" },
  { terms: ["requisito", "idade", "escolaridade", "responsavel"], question: "Quais são os requisitos para inscrição?" },
  { terms: ["contato", "telefone", "email", "ajuda", "atendimento"], question: "Como entro em contato?" },
  { terms: ["curso", "catalogo", "lista", "opcoes", "cursos"], question: "Quais cursos têm no catálogo?" },
  { terms: ["horario", "periodo", "duracao", "carga", "tempo"], question: "Como vejo a carga horária e duração do curso?" },
  { terms: ["plataforma", "qualificavix", "site", "funciona"], question: "Como funciona a plataforma?" },
];

const PLATFORM_FAQS = [
  {
    id: "cadastro",
    keywords: ["cadastro", "cadastr", "primeiro cadastro", "criar conta", "registrar"],
    answer: "Para se cadastrar, abra a página de cursos, escolha um curso e clique em “Inscrever-se”. No primeiro acesso, o sistema solicita os dados básicos e depois salva o perfil no navegador para que você não precise preencher tudo novamente em outro curso.",
  },
  {
    id: "inscricao",
    keywords: ["inscri", "matric", "participar", "entrar no curso", "fazer curso", "vaga"],
    answer: "Para se inscrever, escolha o curso no catálogo, veja os detalhes e clique em “Inscrever-se”. Depois do cadastro inicial, o perfil pode ser reutilizado para outras inscrições sem repetir o formulário.",
  },
  {
    id: "perfil",
    keywords: ["perfil", "conta", "editar", "alterar", "dados", "meus dados", "atualizar"],
    answer: "Após o primeiro cadastro, acesse “Meu perfil” no menu para editar dados pessoais, endereço, escolaridade, situação de emprego e consultar os cursos em que você já se inscreveu. O perfil fica salvo neste navegador.",
  },
  {
    id: "gratuito",
    keywords: ["gratuit", "preco", "valor", "pagar", "custo", "mensalidade", "gratuito"],
    answer: "Os cursos da plataforma são gratuitos. A página de cada curso mostra a modalidade, carga horária, duração, período e as condições de inscrição antes de você confirmar a participação.",
  },
  {
    id: "modalidade",
    keywords: ["modalidade", "online", "presencial", "hibrido", "tipo de curso"],
    answer: "A plataforma disponibiliza cursos online e presenciais. Use os filtros por categoria ou modalidade para encontrar a opção que melhor combina com sua rotina e objetivo.",
  },
  {
    id: "local",
    keywords: ["local", "endereco", "mapa", "chegar", "unidade", "onde fica", "como chegar"],
    answer: "Para cursos presenciais, abra os detalhes do curso e clique no ícone de localização para abrir a rota no Google Maps. Cursos online não têm local presencial, e nem todos os cursos têm endereço completo cadastrado na plataforma.",
  },
  {
    id: "certificado",
    keywords: ["certific", "diploma", "conclusao", "aproveitamento", "certificado"],
    answer: "A página do curso traz as regras de certificação, incluindo aproveitamento mínimo e condições de emissão. Em geral, é necessário concluir as atividades e obter a aprovação mínima informada no curso.",
  },
  {
    id: "contato",
    keywords: ["contato", "telefone", "email", "ajuda", "falar", "atendimento", "suporte", "mais informacoes", "mais informações", "falar com a plataforma", "contato da plataforma", "quero falar com a plataforma", "entrar em contato com a plataforma"],
    answer: "Para mais informações sobre a plataforma, entre em contato pelo telefone 0800 123 4567 ou pelo e-mail contato@qualificavix.es.gov.br. A tortuguita também pode te orientar sobre cursos, inscrição e dúvidas gerais.",
  },
  {
    id: "catalogo",
    keywords: ["curso", "cursos", "catalogo", "lista", "opcao", "quais cursos", "tem curso"],
    answer: `O catálogo atual reúne ${COURSES.length} cursos em áreas como tecnologia, administração, marketing, design, educação, gastronomia e muito mais. Diga uma área ou o nome de um curso para eu indicar opções mais relevantes.`,
  },
  {
    id: "busca",
    keywords: ["buscar", "pesquisar", "pesquisa", "filtrar", "filtro", "encontrar curso"],
    answer: "Na tela de cursos, você pode pesquisar por nome da formação ou área de interesse e usar filtros de categoria e modalidade. Para limpar, basta selecionar “Limpar filtros”.",
  },
  {
    id: "requisitos",
    keywords: ["requisito", "idade", "escolaridade", "responsavel", "quem pode fazer", "pre requisito"],
    answer: "Os requisitos costumam incluir idade mínima, escolaridade e disponibilidade para o horário do curso. Quando houver menor de idade, o cadastro exige dados do responsável legal. Para detalhes exatos, consulte a página do curso.",
  },
  {
    id: "vagas",
    keywords: ["vaga", "vagas", "disponivel", "aberta", "turma", "inscricoes abertas"],
    answer: "Cada curso mostra seu status no catálogo: inscrições abertas, últimas vagas ou início em breve. Confira o curso desejado para ver a disponibilidade atual.",
  },
  {
    id: "horario",
    keywords: ["horario", "periodo", "duracao", "carga horaria", "tempo", "dias"],
    answer: "Na página do curso, você encontra a carga horária, duração, período e a disponibilidade de aulas. Se quiser, diga o nome do curso e eu te devolvo esse detalhamento.",
  },
  {
    id: "plataforma",
    keywords: ["plataforma", "qualificavix", "site", "como funciona", "o que e"],
    answer: "O QualificaVix é a plataforma de cursos profissionalizantes gratuitos da Prefeitura de Vitória. Nela, você pode navegar pelo catálogo, filtrar por categoria, consultar requisitos e vagas, e concluir a inscrição diretamente no curso escolhido.",
  },
  {
    id: "limite",
    keywords: ["limite", "3 cursos", "três cursos", "mais cursos", "inscricoes limitadas", "quantos cursos posso fazer"],
    answer: "A plataforma permite até 3 cursos cadastrados ao mesmo tempo. Se você já estiver com 3 inscrições ativas, só poderá fazer novos cadastros após concluir ou finalizar algum curso em andamento.",
  },
  {
    id: "cursos cadastrados",
    keywords: ["cursos cadastrados", "meus cursos", "cursos inscritos", "cadastros", "inscricoes ativas", "meus cadastros"],
    answer: "Na área de perfil, você pode ver todos os cursos cadastrados, com informações do curso, prazo para desistência e status da matrícula. Essa aba ajuda a acompanhar o que já foi inscrito e o que ainda está em andamento.",
  },
];

function getChatSuggestions(input: string) {
  const query = normalizeChatText(input);
  if (query.length < 2) return [];
  const queryWords = query.split(" ").filter(word => word.length >= 2);
  const lastWord = queryWords.at(-1) ?? query;

  const suggestions = CHAT_SUGGESTED_QUESTIONS
    .filter(item => item.terms.some(term => queryWords.some(word => term.startsWith(word) || word.startsWith(term))))
    .map(item => item.question);

  const matchingCourses = COURSES
    .filter(course => {
      const searchable = normalizeChatText(`${course.title} ${course.category} ${course.location}`);
      return searchable.includes(query) || searchable.split(" ").some(word => word.startsWith(lastWord));
    })
    .map(course => course.title);

  return [...new Set([...matchingCourses, ...suggestions])].slice(0, 5);
}

function chatbotAnswer(message: string) {
  const text = normalizeChatText(message);
  if (!text) return "Posso ajudar com cadastro, inscrição, perfil, catálogo, vagas, requisitos, local, certificado e contato. Digite sua dúvida ou escolha uma sugestão.";

  const words = text.split(" ");
  const isGreeting = /^(oi|ola|bom dia|boa tarde|boa noite)(\s|$)/.test(text);
  if (isGreeting) {
    return "Olá! Posso ajudar com cadastro, inscrição, perfil, busca de cursos, vagas, requisitos, modalidades, localização, certificados, limite de 3 cursos e contato. O que você precisa saber?";
  }

  const matchingCourse = COURSES.find(course => {
    const title = normalizeChatText(course.title);
    const category = normalizeChatText(course.category);
    if (text.includes(title)) return true;
    if (text.includes(category)) return true;
    return title.split(" ").some(word => word.length > 3 && words.includes(word));
  });

  if (matchingCourse) {
    const course = matchingCourse;
    const status = course.status === "open" ? "inscrições abertas" : course.status === "last-spots" ? "últimas vagas" : "início em breve";
    const place = course.modality === "Online" ? "modalidade online" : `local: ${course.location || "a confirmar"}`;
    const routeText = course.modality === "Online" ? "" : " Você pode abrir a rota no Maps pelo ícone de localização do curso.";
    return `${course.title}: ${course.hours} horas, ${course.modality.toLowerCase()}, nível ${course.level}, ${status}, ${place}. ${course.description}${routeText}`;
  }

  const categories = Array.from(new Set(COURSES.map(course => course.category)));
  const matchingCategory = categories.find(category => text.includes(normalizeChatText(category)));
  if (matchingCategory) {
    const titles = COURSES.filter(course => course.category === matchingCategory).map(course => course.title).join(", ");
    return `Na categoria ${matchingCategory}, o catálogo tem: ${titles}.`;
  }

  const faqMatch = PLATFORM_FAQS
    .map(item => ({
      item,
      score: item.keywords.reduce((total, keyword) => total + (text.includes(keyword) ? 1 : 0), 0),
      exact: item.keywords.some(keyword => text === keyword || text.includes(keyword) && text.length <= keyword.length + 8),
    }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.score - a.score)[0];

  if (faqMatch) return faqMatch.item.answer;

  if (/(buscar|pesquisar|pesquisa|filtrar|filtro|encontrar curso|achar curso)/.test(text)) {
    return "Na tela de cursos, você pode pesquisar por nome ou área e usar os filtros de categoria e modalidade. Para limpar, basta selecionar “Limpar filtros” e tentar outra busca.";
  }

  if (/(plataforma|qualificavix|site|como funciona|o que e|para que serve)/.test(text)) {
    return "O QualificaVix é a plataforma de cursos profissionalizantes gratuitos da Prefeitura de Vitória. Nela, você pode consultar o catálogo, filtrar por categoria e modalidade, verificar requisitos e vagas, e acompanhar os cursos cadastrados no seu perfil.";
  }

  if (/(vitoria|es|espirito santo|vitoriense)/.test(text)) {
    return "A plataforma é voltada para a cidade de Vitória-ES, com cursos online e opções presenciais na região. Quando o curso for presencial, pode ser aberto o mapa de rota pelo ícone de localização do curso.";
  }

  if (/(horario|periodo|duracao|carga horaria|tempo|dias)/.test(text)) {
    return "Na página do curso, você encontra a carga horária, a duração e o período de aulas. Se quiser, diga o nome do curso e eu te devolvo esse resumo com mais precisão.";
  }

  if (/(e? gratuito|e? pago|preco|valor|quanto custa|mensalidade)/.test(text)) {
    return "Os cursos da plataforma são gratuitos. O valor da formação não é cobrado ao aluno, e o catálogo informa as condições de participação e os requisitos antes da inscrição.";
  }

  if (/(limite|3 cursos|tres cursos|mais cursos|maximo|máximo)/.test(text)) {
    return "A plataforma permite até 3 cursos cadastrados ao mesmo tempo. Se você já estiver com 3 inscrições ativas, só poderá fazer novos cadastros após concluir ou finalizar algum curso em andamento.";
  }

  return "Posso te ajudar com inscrição, perfil, catálogo, modalidades, vagas, requisitos, local/Maps, certificado, busca, limite de 3 cursos e contato. Se for sobre um curso específico, escreva o nome dele ou uma categoria, como tecnologia, marketing ou administração.";
}

function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, role: "bot" as const, text: "Olá! 👋 Eu sou o assistente do Qualifica Vix. Como posso te ajudar hoje?", time: "agora" }
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const suggestions = getChatSuggestions(input);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  const quickActions = [
    "Cursos de tecnologia",
    "Como me inscrever?",
    "Como edito meu perfil?",
    "Como entro em contato?",
    "Qual o limite de cursos?",
  ];

  function send(text?: string) {
    const t = (text ?? input).trim();
    if (!t || typing) return;
    setInput("");
    const messageId = Date.now();
    setMessages(prev => [...prev, { id: messageId, role: "user", text: t, time: "agora" }]);
    setTyping(true);
    setTimeout(() => {
      const resp = chatbotAnswer(t);
      setMessages(prev => [...prev, { id: messageId + 1, role: "bot", text: resp, time: "agora" }]);
      setTyping(false);
    }, 450);
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[90vw] max-w-[360px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden" style={{ maxHeight: "calc(100vh - 120px)" }}>
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100"
            style={{ background: `linear-gradient(135deg, ${C.blueDark} 0%, ${C.blue} 100%)` }}>
            <TurtleSmall size={36} />
            <div className="flex-1">
              <p className="text-white font-black text-sm">Tortuguita Vix</p>
              <p className="text-blue-200 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Online agora
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 bg-slate-50">
            {messages.map(m => (
              <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                {m.role === "bot" && <TurtleSmall size={28} />}
                <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  m.role === "user"
                    ? "text-white rounded-tr-sm"
                    : "bg-white text-slate-700 border border-slate-200 rounded-tl-sm shadow-sm"
                }`} style={m.role === "user" ? { background: C.blue } : {}}>
                  {m.text}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex gap-2">
                <TurtleSmall size={28} />
                <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
                  <div className="flex gap-1 items-center">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick actions */}
          <div className="px-4 py-2 flex flex-wrap gap-1.5 border-t border-slate-100 bg-white">
            {quickActions.map(a => (
              <button key={a} onClick={() => send(a)} disabled={typing}
                className="text-xs font-bold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors">
                {a}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-100 bg-white">
            <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <input value={input} onChange={e => setInput(e.target.value)}
                  placeholder="Digite sua dúvida ou curso..."
                  autoComplete="off"
                  aria-label="Sua dúvida ou busca"
                  aria-autocomplete="list"
                  aria-expanded={suggestions.length > 0}
                  aria-controls="chat-suggestions"
                  className="w-full text-sm bg-slate-100 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-slate-400 font-medium" />
                {suggestions.length > 0 && (
                  <div id="chat-suggestions" role="group" aria-label="Sugestões de busca"
                    className="absolute bottom-full left-0 right-0 mb-2 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    <p className="px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-400">Sugestões</p>
                    {suggestions.map(suggestion => (
                      <button key={suggestion} type="button" disabled={typing} onClick={() => send(suggestion)}
                        className="w-full rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50">
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" disabled={!input.trim() || typing}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
                style={{ background: C.blue }}>
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FAB */}
      <div className="relative">
        {!open && (
          <div className="absolute -top-12 right-0 bg-white text-slate-700 text-[10px] sm:text-xs font-bold px-2.5 py-1.5 rounded-xl shadow-lg border border-slate-100 whitespace-nowrap max-w-[150px]">
            Olá! Sou a Tortuguita Vix 🐢
            <div className="absolute -bottom-1.5 right-4 w-3 h-3 bg-white border-r border-b border-slate-100 rotate-45" />
          </div>
        )}
        <button onClick={() => setOpen(!open)}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all duration-200 border-4 border-white"
          style={{ background: `linear-gradient(135deg, ${C.blueDark} 0%, ${C.blue} 100%)` }}
          aria-label="Abrir assistente virtual">
          {open ? <X className="w-7 h-7 text-white" /> : <TurtleMascot size={52} />}
        </button>
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
function resizeProfilePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("O arquivo selecionado não é uma imagem válida."));
      image.onload = () => {
        const maxDimension = 512;
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Não foi possível processar a imagem."));
          return;
        }
        try {
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        } catch {
          reject(new Error("Não foi possível processar a imagem."));
        }
      };
      image.src = String(reader.result ?? "");
    };
    reader.readAsDataURL(file);
  });
}

function CourseEnrollmentPage({ course, profile, onBack, onConfirm, onEditProfile }: { course: Course; profile: UserProfile; onBack: () => void; onConfirm: () => void; onEditProfile: () => void }) {
  const address = [profile.rua, profile.numero, profile.complemento, profile.bairro, profile.cep].filter(Boolean).join(", ");
  const savedDetails = [
    { label: "Nome", value: profile.nome },
    { label: "E-mail", value: profile.email },
    { label: "Telefone", value: profile.telefone },
    { label: "Endereço", value: address },
    { label: "Escolaridade", value: profile.escolaridade },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold mb-6 hover:underline" style={{ color: C.blue }}>
          <ArrowLeft className="w-4 h-4" /> Voltar ao curso
        </button>
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8">
          <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: C.orangeDark }}>Inscrição simplificada</p>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">Confirmar inscrição</h1>
          <p className="text-sm text-slate-500 mb-6">Vamos usar os dados do seu perfil salvo. Não é necessário preencher outro cadastro.</p>
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 mb-6">
            <p className="text-xs font-bold text-blue-700 mb-1">Curso selecionado</p>
            <p className="font-black text-slate-900">{course.title}</p>
            <p className="text-xs text-slate-600 mt-1">{course.modality} · {course.hours} horas · {course.location || "Online"}</p>
          </div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-black text-slate-900">Dados do seu perfil</h2>
            <button onClick={onEditProfile} className="text-sm font-bold hover:underline" style={{ color: C.blue }}>Editar perfil</button>
          </div>
          <dl className="grid sm:grid-cols-2 gap-3 mb-7">
            {savedDetails.map(detail => (
              <div key={detail.label} className="rounded-lg border border-slate-200 p-3 min-w-0">
                <dt className="text-[10px] font-black uppercase text-slate-500 mb-1">{detail.label}</dt>
                <dd className="text-sm font-semibold text-slate-800 break-words">{detail.value || "Não informado"}</dd>
              </div>
            ))}
          </dl>
          <button onClick={onConfirm} className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3.5 font-black text-slate-950 shadow-md hover:brightness-105 transition-all" style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeBrightEnd} 100%)` }}>
            Confirmar inscrição <ArrowRight className="w-5 h-5" />
          </button>
        </section>
      </div>
    </div>
  );
}

function ProfilePage({ profile, courses, onBack, onProfileUpdated, onOpenCourse, onLogout }: { profile: UserProfile; courses: Course[]; onBack: () => void; onProfileUpdated: (profile: UserProfile) => void; onOpenCourse: (course: Course) => void; onLogout: () => void }) {
  const [form, setForm] = useState({
    nome: profile.nome,
    email: profile.email,
    telefone: profile.telefone,
    whatsapp: profile.whatsapp ?? "",
    cep: profile.cep,
    bairro: profile.bairro,
    rua: profile.rua,
    numero: profile.numero,
    complemento: profile.complemento ?? "",
    escolaridade: profile.escolaridade,
    situacaoEmprego: profile.situacaoEmprego ?? "",
  });
  const [photo, setPhoto] = useState(profile.fotoPerfil ?? "");
  const [photoError, setPhotoError] = useState("");
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"dados" | "cadastrados">("dados");
  const enrolledCourses = courses
    .filter(course => profile.enrolledCourseIds.includes(course.id))
    .map(course => {
      const enrollment = profile.enrollments?.find(item => item.courseId === course.id);
      const deadline = enrollment?.unsubscribeDeadline ? new Date(enrollment.unsubscribeDeadline) : getUnsubscribeDeadline(new Date().toISOString()) ? new Date(getUnsubscribeDeadline(new Date().toISOString()) as string) : null;
      return { course, enrollment, deadline };
    });
  const registeredCourses = enrolledCourses;

  function updateField(field: keyof typeof form, value: string) {
    setForm(current => ({ ...current, [field]: value }));
    setSaved(false);
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Escolha um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("A imagem deve ter no máximo 5 MB.");
      return;
    }
    try {
      setPhoto(await resizeProfilePhoto(file));
      setPhotoError("");
      setSaved(false);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Não foi possível processar a imagem.");
    }
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const updated = updateUserProfile({ ...form, fotoPerfil: photo || undefined });
    if (updated) {
      onProfileUpdated(updated);
      setSaved(true);
    }
  }

  const fields: { key: keyof typeof form; label: string; type?: string }[] = [
    { key: "nome", label: "Nome completo" },
    { key: "email", label: "E-mail", type: "email" },
    { key: "telefone", label: "Telefone", type: "tel" },
    { key: "whatsapp", label: "WhatsApp", type: "tel" },
    { key: "cep", label: "CEP" },
    { key: "bairro", label: "Bairro" },
    { key: "rua", label: "Rua" },
    { key: "numero", label: "Número" },
    { key: "complemento", label: "Complemento" },
    { key: "escolaridade", label: "Escolaridade" },
    { key: "situacaoEmprego", label: "Situação de emprego" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold mb-6 hover:underline" style={{ color: C.blue }}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: C.blueLight }}>
              <UserCheck className="w-5 h-5" style={{ color: C.blue }} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Meu perfil</h1>
              <p className="text-sm text-slate-500">Perfil salvo neste navegador e pronto para novas inscrições.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <button type="button" onClick={() => setActiveTab("dados")} className={`px-4 py-2 rounded-xl text-sm font-black transition-colors ${activeTab === "dados" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              Dados do perfil
            </button>
            <button type="button" onClick={() => setActiveTab("cadastrados")} className={`px-4 py-2 rounded-xl text-sm font-black transition-colors ${activeTab === "cadastrados" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              Cursos cadastrados ({registeredCourses.length})
            </button>
          </div>

          {activeTab === "dados" ? (
            <form onSubmit={saveProfile} className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
                <ProfileAvatar name={form.nome} photo={photo || undefined} size="w-20 h-20 text-2xl" />
                <div className="flex flex-wrap items-center gap-3">
                  <label htmlFor="profile-photo" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:border-blue-300 cursor-pointer">
                    <Camera className="w-4 h-4" /> Escolher foto
                  </label>
                  <input id="profile-photo" type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} className="sr-only" />
                  {photo && (
                    <button type="button" onClick={() => { setPhoto(""); setSaved(false); setPhotoError(""); }} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold text-slate-600 hover:text-red-600">
                      <Trash2 className="w-4 h-4" /> Remover foto
                    </button>
                  )}
                  <div className="w-full">
                    <p className="text-xs text-slate-500">PNG, JPG ou WebP, até 5 MB. A foto é ajustada e salva neste navegador.</p>
                    {photoError && <p role="alert" className="text-xs font-semibold text-red-600 mt-1">{photoError}</p>}
                  </div>
                </div>
              </div>
              {fields.map(field => (
                <label key={field.key} className="flex flex-col gap-1.5 text-sm font-bold text-slate-700">
                  {field.label}
                  <input required={!['whatsapp', 'complemento', 'situacaoEmprego'].includes(field.key)}
                    type={field.type ?? "text"} value={form[field.key]}
                    onChange={event => updateField(field.key, event.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 font-medium outline-none focus:border-blue-500" />
                </label>
              ))}
              <div className="sm:col-span-2 flex flex-wrap items-center gap-3 pt-2">
                <button type="submit" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white font-black" style={{ background: C.blue }}>
                  <CheckCircle2 className="w-4 h-4" /> Salvar alterações
                </button>
                <button type="button" onClick={onLogout} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 font-black hover:bg-red-100">
                  <LogOut className="w-4 h-4" /> Sair da plataforma
                </button>
                {saved && <p role="status" className="text-sm font-bold text-green-700">Perfil atualizado.</p>}
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {registeredCourses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <p className="text-lg font-black text-slate-800">Nenhum curso cadastrado</p>
                  <p className="text-sm text-slate-500 mt-2">Você ainda não tem cursos registrados na plataforma. Explore o catálogo para começar.</p>
                </div>
              ) : (
                registeredCourses.map(({ course, enrollment, deadline }) => (
                  <article key={course.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full text-blue-700 bg-blue-100">{course.category}</span>
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full text-slate-700 bg-slate-200">{course.modality}</span>
                        </div>
                        <h2 className="text-xl font-black text-slate-900">{course.title}</h2>
                        <p className="text-sm text-slate-600 mt-2">{course.description}</p>
                      </div>

                      <button type="button" onClick={() => onOpenCourse(course)} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-black whitespace-nowrap" style={{ background: C.blue }}>
                        Ver curso <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-5">
                      <div className="rounded-xl bg-white border border-slate-200 p-3">
                        <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Carga</p>
                        <p className="text-sm font-bold text-slate-800">{course.hours}h</p>
                      </div>
                      <div className="rounded-xl bg-white border border-slate-200 p-3">
                        <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Duração</p>
                        <p className="text-sm font-bold text-slate-800">{course.duration}</p>
                      </div>
                      <div className="rounded-xl bg-white border border-slate-200 p-3">
                        <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Local</p>
                        <p className="text-sm font-bold text-slate-800">{course.location || "Online"}</p>
                      </div>
                      <div className="rounded-xl bg-white border border-slate-200 p-3">
                        <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Inscrição</p>
                        <p className="text-sm font-bold text-slate-800">{enrollment?.enrolledAt ? formatDateBR(enrollment.enrolledAt) : "Não informado"}</p>
                      </div>
                    </div>

                    <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-wide text-orange-700 mb-2">Prazo final para desistência</p>
                      <p className="text-sm font-bold text-slate-800">{deadline ? formatDateBR(deadline.toISOString()) : "Prazo não informado"}</p>
                      <p className="text-xs text-slate-600 mt-1">Você pode cancelar sua inscrição até essa data, conforme o prazo do curso e da plataforma.</p>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function App() {
  const {
    page, selectedCourse, darkMode, navigate, viewCourse: handleViewCourse,
    toggleDarkMode, increaseFont, decreaseFont,
  } = useAppController<Course>();
  const [favoriteCourseIds, setFavoriteCourseIds] = useState<number[]>(getFavoriteCourseIds);
  const [profile, setProfile] = useState<UserProfile | null>(() => getUserProfile());
  const [returnToEnrollmentConfirmation, setReturnToEnrollmentConfirmation] = useState(false);
  const handleToggleFavorite = (courseId: number) => {
    setFavoriteCourseIds(current => saveFavoriteCourseIds(
      current.includes(courseId) ? current.filter(id => id !== courseId) : [...current, courseId],
    ));
  };
  const getMonthlyEnrollmentCount = (userProfile: UserProfile | null) => {
    if (!userProfile?.enrollments) return 0;

    const now = new Date();
    const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    return userProfile.enrollments.filter(item => {
      const date = new Date(item.enrolledAt);
      if (Number.isNaN(date.getTime())) return false;
      const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      return monthKey === currentMonthKey;
    }).length;
  };

  const handleRegisterFromCourse = () => {
    if (!selectedCourse) return;

    if (!profile) {
      navigate("register");
      return;
    }

    if (profile.enrolledCourseIds.includes(selectedCourse.id)) {
      alert("Você já está inscrito neste curso e não pode se inscrever novamente.");
      return;
    }

    if (getMonthlyEnrollmentCount(profile) >= 3) {
      alert("Você pode cadastrar até 3 cursos por mês. Para fazer novas inscrições, aguarde o próximo mês.");
      return;
    }

    navigate("enrollment-confirmation");
  };
  const handleEnrollFromStory = (course: Course) => {
    if (profile && profile.enrolledCourseIds.includes(course.id)) {
      alert("Você já está inscrito neste curso e não pode se inscrever novamente.");
      return;
    }

    if (profile && getMonthlyEnrollmentCount(profile) >= 3) {
      alert("Você pode cadastrar até 3 cursos por mês. Para fazer novas inscrições, aguarde o próximo mês.");
      return;
    }

    handleViewCourse(course);
    navigate(profile ? "enrollment-confirmation" : "register");
  };
  const handleConfirmCourseEnrollment = () => {
    if (!selectedCourse) return;

    if (profile && profile.enrolledCourseIds.includes(selectedCourse.id)) {
      alert("Você já está inscrito neste curso e não pode se inscrever novamente.");
      navigate("course-detail");
      return;
    }

    if (profile && getMonthlyEnrollmentCount(profile) >= 3) {
      alert("Você pode cadastrar até 3 cursos por mês. Para fazer novas inscrições, aguarde o próximo mês.");
      navigate("course-detail");
      return;
    }

    const updatedProfile = enrollUserInCourse(selectedCourse.id);
    if (updatedProfile && (updatedProfile as UserProfile & { enrollmentLimitReached?: boolean }).enrollmentLimitReached) {
      alert("Você pode cadastrar até 3 cursos por mês. Para fazer novas inscrições, aguarde o próximo mês.");
      navigate("course-detail");
      return;
    }

    if (updatedProfile) setProfile(updatedProfile);
    navigate("course-detail");
  };

  const handleUnsubscribeCourse = (courseId: number) => {
    const confirmed = window.confirm("Tem certeza que deseja desinscrever-se deste curso? Esta ação removerá o curso da aba de cursos cadastrados.");
    if (!confirmed) return;

    const updatedProfile = removeUserEnrollmentFromCourse(courseId);
    if (updatedProfile) setProfile(updatedProfile);
  };
  const handleProfileBack = () => {
    const destination = returnToEnrollmentConfirmation ? "enrollment-confirmation" : "home";
    setReturnToEnrollmentConfirmation(false);
    navigate(destination);
  };
  const handleEditProfileForEnrollment = () => {
    setReturnToEnrollmentConfirmation(true);
    navigate("profile");
  };
  const handleLogout = () => {
    const confirmed = window.confirm("Deseja realmente sair da plataforma? Todos os dados do perfil e as inscrições vinculadas a este navegador serão removidos.");
    if (!confirmed) return;

    logoutUserProfile();
    setProfile(null);
    navigate("home");
  };

  if (page === "register" || (page === "profile" && !profile)) {
    if (profile) return <ProfilePage profile={profile} courses={COURSES} onBack={handleProfileBack} onProfileUpdated={setProfile} onLogout={handleLogout} />;
    return (
      <RegisterPage
        dark={darkMode}
        onBack={() => navigate("home")}
        courseId={selectedCourse?.id}
        onProfileCreated={setProfile}
      />
    );
  }

  return (
    <>
      <style>{`
        html { transition: background-color 0.2s ease; }
        html.qualificavix-dark, html.qualificavix-dark body { background: #020617 !important; }
        html.qualificavix-dark .bg-white { background-color: #0f172a !important; }
        html.qualificavix-dark .bg-slate-50 { background-color: #111827 !important; }
        html.qualificavix-dark .bg-slate-100 { background-color: #1e293b !important; }
        html.qualificavix-dark .bg-blue-50,
        html.qualificavix-dark .bg-blue-100 { background-color: #172554 !important; }
        html.qualificavix-dark .bg-orange-50,
        html.qualificavix-dark .bg-orange-100 { background-color: #431407 !important; }
        html.qualificavix-dark .text-slate-900 { color: #f8fafc !important; }
        html.qualificavix-dark .text-slate-800 { color: #f1f5f9 !important; }
        html.qualificavix-dark .text-slate-700 { color: #e2e8f0 !important; }
        html.qualificavix-dark .text-slate-600 { color: #cbd5e1 !important; }
        html.qualificavix-dark .text-slate-500 { color: #94a3b8 !important; }
        html.qualificavix-dark .text-slate-400 { color: #94a3b8 !important; }
        html.qualificavix-dark .border-slate-100 { border-color: #1e293b !important; }
        html.qualificavix-dark .border-slate-200 { border-color: #334155 !important; }
        html.qualificavix-dark input,
        html.qualificavix-dark select,
        html.qualificavix-dark textarea {
          background-color: #0f172a !important;
          color: #f8fafc !important;
          border-color: #334155 !important;
        }
        html.qualificavix-dark input::placeholder,
        html.qualificavix-dark textarea::placeholder { color: #64748b !important; }
        html.qualificavix-dark header {
          background-color: #0b1120 !important;
          border-color: #1e293b !important;
        }
        html.qualificavix-dark .hover\:bg-slate-50:hover { background-color: #1e293b !important; }
        html.qualificavix-dark .hover\:text-slate-900:hover { color: #ffffff !important; }
        html.qualificavix-dark [class*="shadow"] { --tw-shadow-color: rgba(0,0,0,.45); }
      `}</style>
      <div className="min-h-screen bg-white" style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>
        <Header
          page={page}
          navigate={navigate}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          increaseFont={increaseFont}
          decreaseFont={decreaseFont}
          profile={profile}
        />
      <main>
        {page === "home" && <HomePage navigate={navigate} onViewCourse={handleViewCourse} onEnrollCourse={handleEnrollFromStory} favoriteCourseIds={favoriteCourseIds} onToggleFavorite={handleToggleFavorite} profile={profile} />}
        {page === "cursos" && <CoursesPage navigate={navigate} onViewCourse={handleViewCourse} favoriteCourseIds={favoriteCourseIds} onToggleFavorite={handleToggleFavorite} />}
        {page === "favorites" && <FavoritesPage favoriteCourseIds={favoriteCourseIds} onToggleFavorite={handleToggleFavorite} onViewCourse={handleViewCourse} navigate={navigate} />}
        {page === "enrollment-confirmation" && selectedCourse && profile && (
          <CourseEnrollmentPage course={selectedCourse} profile={profile} onBack={() => navigate("course-detail")}
            onConfirm={handleConfirmCourseEnrollment} onEditProfile={handleEditProfileForEnrollment} />
        )}
        {page === "course-detail" && selectedCourse && (
          <CourseDetailPage course={selectedCourse} navigate={navigate} onRegister={handleRegisterFromCourse}
            isFavorite={favoriteCourseIds.includes(selectedCourse.id)} onToggleFavorite={handleToggleFavorite}
            enrolled={profile?.enrolledCourseIds.includes(selectedCourse.id) ?? false}
            onUnsubscribe={handleUnsubscribeCourse} />
        )}
        {page === "profile" && profile && <ProfilePage profile={profile} courses={COURSES} onBack={handleProfileBack} onProfileUpdated={setProfile} onOpenCourse={(course) => { handleViewCourse(course); navigate("course-detail"); }} onLogout={handleLogout} />}
        {page === "sobre" && <SobrePage navigate={navigate} />}
        {page === "categorias" && <CategoriasPage navigate={navigate} onViewCourse={handleViewCourse} favoriteCourseIds={favoriteCourseIds} onToggleFavorite={handleToggleFavorite} />}
        {page === "contato" && (
          <div className="max-w-2xl mx-auto px-4 py-20 text-center">
            <img src={qualificaVixLogo} alt="Qualifica Vix" className="w-32 h-28 object-contain mx-auto mb-6" />
            <h1 className="text-3xl font-black text-slate-900 mb-3">Entre em contato</h1>
            <p className="text-slate-500 mb-8">Estamos aqui para te ajudar a encontrar o curso ideal.</p>
            <div className="space-y-3 text-left max-w-sm mx-auto">
              {[
                { icon: Phone, label: "Telefone", value: "0800 123 4567" },
                { icon: Mail,  label: "E-mail",   value: "contato@qualificavix.es.gov.br" },
              ].map(c => (
                <div key={c.label} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200">
                  <c.icon className="w-5 h-5 shrink-0" style={{ color: C.blue }} />
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{c.label}</p>
                    <p className="font-semibold text-slate-800">{c.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      {page !== "register" && <Footer navigate={navigate} />}
        <Chatbot />
      </div>
    </>
  );
}
