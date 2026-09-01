import { useState, useEffect, useRef, type FormEvent } from "react";
import { RegisterPage } from "./RegisterView";
import { TurtleMascot } from "../components/TurtleMascot";
import { createTestimonial, getTestimonials } from "../services/api";
import { useAppController } from "../controllers/useAppController";
import type { Course } from "../models/Course";
import type { Testimonial } from "../models/Testimonial";
import type { Page } from "../models/navigation";
import vitoriaCidade from "../../assets/hero/vitoria-cidade.jpg";
import qualificavixInformatica from "../../assets/hero/qualificavix-informatica.jpg";
import qualificavixCulinaria from "../../assets/hero/qualificavix-culinaria.jpg";
import qualificavixCozinhaAula from "../../assets/hero/qualificavix-cozinha-aula.jpg";
import qualificavixPanificacao from "../../assets/hero/qualificavix-panificacao.jpg";
import qualificavixTecnologia from "../../assets/hero/qualificavix-tecnologia.jpg";
import vitoriaPaisagem from "../../assets/hero/vitoria-paisagem.jpg";
import {
  Search, X, Clock, MapPin, ChevronRight, ChevronDown, Menu, Moon, Sun, Minus, Plus,
  ArrowRight, ArrowLeft, BookOpen, Filter, Star, Users, Award,
  CheckCircle2, Heart, Facebook, Instagram, Twitter, Phone, Mail,
  Monitor, Briefcase, Palette, Wrench, GraduationCap, Utensils,
  Laptop, Send, SlidersHorizontal, Globe, Building2, TrendingUp,
  PlayCircle, BarChart3, Target, Zap, UserCheck,
} from "lucide-react";

// ─── Paleta de cores ─────────────────────────────────────────────────────────
const C = {
  blue:        "#1d4ed8",
  blueDark:    "#1e3a8a",
  blueMid:     "#2563eb",
  blueLight:   "#dbeafe",
  bluePale:    "#eff6ff",
  orange:      "#f97316",
  orangeDark:  "#ea580c",
  orangeLight: "#ffedd5",
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
    location: "Vitória - ES", enrolled: 342, status: "open",
    period: "Noturno", duration: "4 meses",
    targetAudience: ["Primeiro emprego", "Mudança de profissão"],
    avgSalary: "R$ 4.200/mês",
    description: "Aprenda os fundamentos da programação e desenvolva suas primeiras aplicações. Curso ideal para quem deseja iniciar na área de tecnologia.",
    whatYouLearn: ["Lógica de programação e algoritmos", "Estruturas de dados básicas", "Fundamentos das principais linguagens", "Desenvolvimento de pequenos projetos", "Boas práticas e resolução de problemas"],
    about: "Este curso é perfeito para quem está começando na área de programação. Você vai aprender os conceitos fundamentais e desenvolver projetos práticos para aplicar seus conhecimentos desde o início. Com metodologia prática e professores experientes, você terá toda a base necessária para iniciar uma carreira em tecnologia.",
    image: "photo-1517694712202-14dd9538aa97",
    bgColor: "#1d4ed8", featured: 1,
  },
  {
    id: 2, title: "Excel do Básico ao Avançado",
    category: "Administração", categoryColor: "#16a34a",
    modality: "Online", hours: 60, level: "Todos os níveis",
    location: "Online", enrolled: 289, status: "last-spots",
    period: "Flexível", duration: "2 meses",
    targetAudience: ["Atualização profissional", "Primeiro emprego"],
    avgSalary: "R$ 2.800/mês",
    description: "Domine fórmulas, gráficos e ferramentas avançadas do Excel para otimizar sua produtividade profissional.",
    whatYouLearn: ["Fórmulas e funções avançadas", "Tabelas dinâmicas e gráficos", "Macros e automação VBA", "Análise de dados", "Dashboards profissionais"],
    about: "O Excel é a ferramenta mais utilizada no mercado de trabalho. Neste curso você vai do básico ao avançado com aulas práticas e exercícios reais do dia a dia profissional.",
    image: "photo-1611532736597-de2d4265fba3",
    bgColor: "#16a34a", featured: 2,
  },
  {
    id: 3, title: "Design Gráfico para Iniciantes",
    category: "Design", categoryColor: "#7c3aed",
    modality: "Presencial", hours: 80, level: "Iniciante",
    location: "Senai – Beira Mar", enrolled: 156, status: "open",
    period: "Vespertino", duration: "3 meses",
    targetAudience: ["Primeiro emprego", "Empreendedor"],
    avgSalary: "R$ 3.400/mês",
    description: "Crie artes incríveis e domine os conceitos fundamentais do design com ferramentas profissionais.",
    whatYouLearn: ["Princípios do design visual", "Tipografia e cores", "Adobe Photoshop e Illustrator", "Criação de identidade visual", "Design para redes sociais"],
    about: "Aprenda a criar peças gráficas profissionais para o mercado digital e impresso. Com foco em ferramentas práticas e projetos reais, você sairá pronto para trabalhar como designer.",
    image: "photo-1558655146-9f40138edfeb",
    bgColor: "#7c3aed", featured: 3,
  },
  {
    id: 4, title: "Marketing Digital na Prática",
    category: "Marketing", categoryColor: "#db2777",
    modality: "Online", hours: 60, level: "Iniciante",
    location: "Online", enrolled: 412, status: "open",
    period: "Flexível", duration: "2 meses",
    targetAudience: ["Empreendedor", "Atualização profissional", "Mudança de profissão"],
    avgSalary: "R$ 3.800/mês",
    description: "Estratégias para atrair, engajar e converter na internet. Aprenda as principais ferramentas do marketing digital.",
    whatYouLearn: ["SEO e tráfego orgânico", "Google Ads e Facebook Ads", "E-mail marketing", "Métricas e analytics", "Estratégias de conteúdo"],
    about: "O marketing digital é uma das áreas que mais cresce no mercado. Aprenda a criar campanhas eficientes, gerenciar redes sociais e gerar resultados mensuráveis para qualquer negócio.",
    image: "photo-1432888498266-38ffec3eaf0a",
    bgColor: "#db2777", featured: 4,
  },
  {
    id: 5, title: "Desenvolvimento Web Completo",
    category: "Tecnologia", categoryColor: "#2563eb",
    modality: "Online", hours: 150, level: "Intermediário",
    location: "Online", enrolled: 278, status: "open",
    period: "Noturno", duration: "5 meses",
    targetAudience: ["Mudança de profissão", "Atualização profissional"],
    avgSalary: "R$ 5.500/mês",
    description: "Aprenda a criar sites e aplicações com as principais tecnologias modernas do desenvolvimento web.",
    whatYouLearn: ["HTML, CSS e JavaScript", "React e Node.js", "Banco de dados SQL e NoSQL", "APIs RESTful", "Deploy e hospedagem"],
    about: "Torne-se um desenvolvedor web full stack com este curso completo. Você aprenderá do front-end ao back-end, criando projetos reais para o seu portfólio.",
    image: "photo-1498050108023-c5249f4df085",
    bgColor: "#0891b2",
  },
  {
    id: 6, title: "Gestão de Projetos",
    category: "Administração", categoryColor: "#16a34a",
    modality: "Online", hours: 60, level: "Intermediário",
    location: "Online", enrolled: 198, status: "coming-soon",
    period: "Vespertino", duration: "2 meses",
    targetAudience: ["Atualização profissional", "Empreendedor"],
    avgSalary: "R$ 6.200/mês",
    description: "Planeje, execute e controle projetos com metodologias ágeis e ferramentas modernas de gestão.",
    whatYouLearn: ["Metodologias ágeis (Scrum, Kanban)", "Gestão de equipes", "Planejamento e cronograma", "Controle de riscos", "Ferramentas: Trello, Jira, Asana"],
    about: "Profissionais de gestão de projetos são altamente valorizados em todas as áreas. Aprenda as metodologias mais utilizadas no mercado e gerencie projetos com eficiência.",
    image: "photo-1521737711867-e3b97375f902",
    bgColor: "#059669",
  },
  {
    id: 7, title: "Informática para o Mercado",
    category: "Tecnologia", categoryColor: "#2563eb",
    modality: "Presencial", hours: 100, level: "Iniciante",
    location: "Hub de Inovação", enrolled: 134, status: "open",
    period: "Diurno", duration: "3 meses",
    targetAudience: ["Primeiro emprego", "Atualização profissional"],
    avgSalary: "R$ 2.200/mês",
    description: "Habilidades essenciais para o mercado de trabalho moderno: escritório, internet e ferramentas digitais.",
    whatYouLearn: ["Windows e pacote Office", "Internet e e-mail profissional", "Segurança digital", "Google Workspace", "Noções de hardware"],
    about: "Este curso prepara você para usar tecnologia no dia a dia profissional com segurança e eficiência, do básico ao suficiente para qualquer vaga de trabalho.",
    image: "photo-1516321318423-f06f85e504b3",
    bgColor: "#0369a1",
  },
  {
    id: 8, title: "Atendimento ao Cliente",
    category: "Educação", categoryColor: "#d97706",
    modality: "Online", hours: 40, level: "Iniciante",
    location: "Online", enrolled: 321, status: "open",
    period: "Flexível", duration: "1 mês",
    targetAudience: ["Primeiro emprego", "Mudança de profissão"],
    avgSalary: "R$ 1.800/mês",
    description: "Técnicas práticas para encantar clientes e gerar resultados. Aprenda a fidelizar e resolver conflitos.",
    whatYouLearn: ["Comunicação e linguagem positiva", "Gestão de conflitos", "Atendimento multicanal", "Fidelização de clientes", "CRM e pós-venda"],
    about: "O atendimento ao cliente é a base de qualquer negócio. Aprenda as melhores práticas para encantar clientes, resolver problemas e construir relacionamentos duradouros.",
    image: "photo-1556745753-b2904692b3cd",
    bgColor: "#d97706",
  },
  {
    id: 9, title: "Gastronomia Brasileira",
    category: "Gastronomia", categoryColor: "#ea580c",
    modality: "Presencial", hours: 80, level: "Iniciante",
    location: "Senac – Vitória", enrolled: 89, status: "last-spots",
    period: "Diurno", duration: "3 meses",
    targetAudience: ["Primeiro emprego", "Empreendedor"],
    avgSalary: "R$ 2.500/mês",
    description: "Aprenda técnicas culinárias da culinária brasileira com chefs experientes em cozinhas profissionais.",
    whatYouLearn: ["Técnicas de corte e preparo", "Culinária regional brasileira", "Higiene e segurança alimentar", "Cardápio e fichas técnicas", "Noções de gestão de cozinha"],
    about: "A gastronomia é uma paixão nacional. Neste curso presencial você aprende técnicas profissionais de culinária brasileira com aulas práticas em cozinhas totalmente equipadas.",
    image: "photo-1556909114-f6e7ad7d3136",
    bgColor: "#ea580c",
  },
  {
    id: 10, title: "Eletricista Predial",
    category: "Técnico", categoryColor: "#ca8a04",
    modality: "Presencial", hours: 160, level: "Iniciante",
    location: "Senai – Bento Ferreira", enrolled: 67, status: "open",
    period: "Noturno", duration: "5 meses",
    targetAudience: ["Primeiro emprego", "Mudança de profissão"],
    avgSalary: "R$ 4.000/mês",
    description: "Instalações elétricas residenciais e comerciais com segurança e conforme as normas da ABNT.",
    whatYouLearn: ["Leitura de projetos elétricos", "Instalações residenciais e comerciais", "Normas NBR e NR10", "Quadros elétricos e proteções", "Manutenção corretiva"],
    about: "O eletricista é um dos profissionais mais requisitados do mercado. Aprenda a executar instalações elétricas seguras e regulamentadas com muito suporte prático.",
    image: "photo-1621905251189-08b1489462df",
    bgColor: "#ca8a04",
  },
];

const COURSE_IMAGES: Record<string, string> = {
  Tecnologia: qualificavixTecnologia,
  Administração: qualificavixInformatica,
  Design: vitoriaCidade,
  Marketing: qualificavixTecnologia,
  Educação: qualificavixInformatica,
  Gastronomia: qualificavixCulinaria,
};

const courseImage = (course: Course) => COURSE_IMAGES[course.category] ?? qualificavixCozinhaAula;

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
    name: "Manuel Gomes",
    role: "Desenvolvedora Front-end",
    course: "Desenvolvimento Web",
    quote: "Mudei completamente de carreira após o curso. Em 4 meses consegui meu primeiro emprego em tecnologia.",
    rating: 5,
  },
  {
    id: 2,
    name: "Mateus Rangel",
    role: "Empreendedor Digital",
    course: "Marketing Digital",
    quote: "Abri meu negócio três meses depois. A plataforma me deu toda a base que eu precisava para empreender.",
    rating: 5,
  },
  {
    id: 3,
    name: "Ryan De Paula",
    role: "Designer Freelancer",
    course: "Design Gráfico",
    quote: "Eu buscava uma nova oportunidade profissional e o curso me ajudou a conquistar meus primeiros clientes.",
    rating: 5,
  },
];

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
    <button onClick={() => navigate("home")} className="flex items-center gap-2 shrink-0">
      <TurtleSmall size={50} />
      <div className="leading-none">
        <p className="font-black text-xl tracking-tight" style={{ color: C.blueDark }}>
          Qualifica
        </p>
        <p className="font-black text-xl tracking-tight -mt-1" style={{ color: C.orange }}>
          Vix
        </p>
      </div>
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
function CourseCard({ course, onView }: { course: Course; onView: (c: Course) => void }) {
  const [liked, setLiked] = useState(false);
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
        <button onClick={(e) => { e.stopPropagation(); setLiked(l => !l); }}
          aria-label={liked ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 shadow-md backdrop-blur-sm flex items-center justify-center hover:bg-white hover:scale-105 transition-all">
          <Heart className={`w-4 h-4 ${liked ? "text-red-500" : "text-slate-700"}`} fill={liked ? "currentColor" : "none"} />
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
  { id: "categorias", label: "Categorias" },
  { id: "sobre",      label: "Sobre" },
  { id: "contato",    label: "Contato" },
];

function Header({ page, navigate, darkMode, toggleDarkMode, increaseFont, decreaseFont }: { page: Page; navigate: (p: Page) => void; darkMode: boolean; toggleDarkMode: () => void; increaseFont: () => void; decreaseFont: () => void }) {
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6 h-16">
          <Logo navigate={navigate} />

          {/* Nav desktop */}
          <nav className="hidden lg:flex items-center gap-1 flex-1">
            {NAV.map(n => (
              <button key={n.id} onClick={() => navigate(n.id as Page)}
                className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors relative ${
                  page === n.id
                    ? "text-blue-700"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}>
                {n.label}
                {page === n.id && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                    style={{ backgroundColor: C.orange }} />
                )}
              </button>
            ))}
          </nav>

          {/* Central de acessibilidade */}
          <div className="hidden sm:flex items-center rounded-2xl border border-slate-200 bg-slate-50/80 p-1 shadow-sm"
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
                    className="h-9 pl-9 pr-4 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400 w-52 font-medium" />
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
            <button onClick={() => navigate("register")}
              className="hidden sm:flex items-center gap-1.5 text-sm font-black px-5 py-2 rounded-xl text-white shadow hover:opacity-90 hover:-translate-y-0.5 transition-all"
              style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)` }}>
              Entrar / Cadastrar
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
              <button key={n.id} onClick={() => { navigate(n.id as Page); setMobileOpen(true); }}
                className={`text-left px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                  page === n.id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                }`}>
                {n.label}
              </button>
            ))}
            <button onClick={() => { navigate("register"); setMobileOpen(false); }}
              className="mt-1 flex items-center justify-center font-black text-sm py-2.5 rounded-xl text-white"
              style={{ background: C.blueLight }}>
              Entrar / Cadastrar
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
function TestimonialsSection() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>(DEFAULT_TESTIMONIALS);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [course, setCourse] = useState("");
  const [quote, setQuote] = useState("");
  const [rating, setRating] = useState(5);
  const [submitted, setSubmitted] = useState(false);

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
            Histórias reais
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900">
            Quem estudou, transformou
          </h2>
          <p className="text-slate-600 mt-3 max-w-2xl mx-auto font-medium leading-relaxed">
            Conte como um curso do QualificaVix ajudou você a conquistar uma nova oportunidade,
            mudar de carreira, aumentar sua renda ou realizar um projeto.
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.slice(0, 6).map(t => (
            <article
              key={t.id}
              className="bg-white rounded-3xl p-6 shadow-md border border-blue-100 hover:-translate-y-1 hover:shadow-xl transition-all flex flex-col"
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black shrink-0 shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueMid} 100%)` }}
                  >
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-slate-900 truncate">{t.name}</p>
                    <p className="text-xs font-bold text-slate-500 truncate">{t.role}</p>
                  </div>
                </div>

                <div className="flex gap-0.5 shrink-0" aria-label={`${t.rating} de 5 estrelas`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4"
                      fill={i < t.rating ? C.orange : "none"}
                      style={{ color: i < t.rating ? C.orange : "#cbd5e1" }}
                    />
                  ))}
                </div>
              </div>

              <div
                className="rounded-xl px-3 py-2 mb-4 text-xs font-black inline-flex self-start"
                style={{ backgroundColor: C.orangeLight, color: C.orangeDark }}
              >
                📚 {t.course}
              </div>

              <blockquote className="text-sm sm:text-base text-slate-600 leading-relaxed italic flex-1">
                “{t.quote}”
              </blockquote>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-green-700">
                <CheckCircle2 className="w-4 h-4" />
                História de transformação
              </div>
            </article>
          ))}
        </div>

        <div className="text-center mt-10">
          <button
            onClick={() => setShowForm(value => !value)}
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-white font-black shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all"
            style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)` }}
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
function HomePage({ navigate, onViewCourse }: { navigate: (p: Page) => void; onViewCourse: (c: Course) => void }) {
  const [bgIdx, setBgIdx] = useState(0);
  const heroBgs = [
    { src: vitoriaCidade, alt: "Vista panorâmica da cidade de Vitória" },
    { src: qualificavixInformatica, alt: "Curso de informática do programa QualificaVix" },
    { src: qualificavixCulinaria, alt: "Curso de culinária oferecido pela Prefeitura de Vitória" },
    { src: vitoriaPaisagem, alt: "Paisagem urbana e natural de Vitória" },
    { src: qualificavixTecnologia, alt: "Curso de tecnologia apoiado pela Prefeitura de Vitória" },
    { src: qualificavixPanificacao, alt: "Alunos em curso profissionalizante de panificação" },
    { src: qualificavixCozinhaAula, alt: "Aula prática de gastronomia do QualificaVix" },
  ];
  useEffect(() => {
    const t = setInterval(() => setBgIdx(i => (i + 1) % heroBgs.length), 5000);
    return () => clearInterval(t);
  }, []);

  const featured = COURSES.filter(c => c.featured).sort((a, b) => (a.featured ?? 0) - (b.featured ?? 0));

  return (
    <div>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.blueDark} 0%, ${C.blue} 60%, #1e40af 100%)` }}>
        {heroBgs.map((bg, i) => (
          <div key={bg.src} className={`absolute inset-0 transition-opacity duration-1000 ${i === bgIdx ? "opacity-45" : "opacity-0"}`}>
            <img src={bg.src} alt={bg.alt} loading={i < 2 ? "eager" : "lazy"}
              className="w-full h-full object-cover object-center scale-[1.01]" />
          </div>
        ))}
        {/* Dot pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 mb-6">
                <Zap className="w-3.5 h-3.5 text-yellow-300" />
                <span className="text-xs font-bold text-yellow-100">Cursos 100% gratuitos · Certificado incluso</span>
              </div>
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight mb-5">
                Encontre oportunidades para{" "}
                <span style={{ color: C.orange }}>transformar</span>
                {" "}o seu futuro.
              </h1>
              <p className="text-base lg:text-lg text-blue-100 mb-8 leading-relaxed max-w-lg">
                Cursos, capacitações e oportunidades de qualificação profissional para você em Vitória&nbsp;-&nbsp;ES.
              </p>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => navigate("cursos")}
                  className="flex items-center gap-2 font-black text-slate-900 px-7 py-3.5 rounded-2xl shadow-xl hover:scale-105 transition-all"
                  style={{ background: `linear-gradient(135deg, ${C.orange} 0%, #fb923c 100%)` }}>
                  Explorar cursos <ArrowRight className="w-5 h-5" />
                </button>
                <button onClick={() => navigate("sobre")}
                  className="flex items-center gap-2 font-bold text-white px-7 py-3.5 rounded-2xl border-2 border-white/30 hover:bg-white/10 transition-all">
                  Saiba mais
                </button>
              </div>

              {/* Mini stats */}
              <div className="mt-10 grid grid-cols-3 gap-3 max-w-sm">
                {[
                  { n: "156+", l: "Cursos ativos" },
                  { n: "12k+", l: "Formados" },
                  { n: "20+", l: "Unidades" },
                ].map(s => (
                  <div key={s.l} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
                    <p className="text-2xl font-black text-amber-300">{s.n}</p>
                    <p className="text-[10px] uppercase tracking-wider text-blue-100 font-semibold mt-0.5">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Wave bottom */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 48L1440 48L1440 0C1440 0 1200 40 720 40C240 40 0 0 0 0L0 48Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* ── Categorias ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: C.orange }}>Explore por área</p>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Explore por categoria</h2>
          </div>
          <button onClick={() => navigate("categorias")}
            className="flex items-center gap-1 text-sm font-bold hover:underline" style={{ color: C.blue }}>
            Ver todos <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => navigate("cursos")}
              className="flex flex-col items-center gap-2.5 p-4 rounded-2xl border border-slate-100 bg-white hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200 transition-all group">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"
                style={{ backgroundColor: `${cat.color}18` }}>
                <cat.icon className="w-6 h-6" style={{ color: cat.color }} />
              </div>
              <div className="text-center">
                <p className="text-xs font-black text-slate-800 leading-tight">{cat.label}</p>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{cat.count} cursos</p>
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
              <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: C.orange }}>Mais populares</p>
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
                <div className="absolute -top-3 left-3 z-10 text-xs font-black text-white px-3 py-1 rounded-full shadow-lg"
                  style={{ background: i === 0 ? C.orange : i === 1 ? C.blue : i === 2 ? "#7c3aed" : "#db2777" }}>
                  {i === 0 ? "1º Destaque" : i === 1 ? "2º Destaque" : i === 2 ? "3º Destaque" : "4º Destaque"}
                </div>
                <CourseCard course={c} onView={onViewCourse} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Como funciona ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: C.orange }}>Simples assim</p>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Como se inscrever</h2>
          <p className="text-slate-500 mt-2 text-sm max-w-md mx-auto">Quatro passos simples para começar sua jornada de qualificação.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { step: "01", icon: UserCheck, title: "Crie sua conta", desc: "Cadastre-se gratuitamente com seus dados pessoais.", color: C.blue },
            { step: "02", icon: Search,    title: "Encontre o curso", desc: "Navegue pelo catálogo e escolha o que combina com você.", color: "#7c3aed" },
            { step: "03", icon: BookOpen,  title: "Faça a inscrição", desc: "Inscreva-se no curso desejado com um clique.", color: C.orange },
            { step: "04", icon: Award,     title: "Receba o certificado", desc: "Conclua o curso e obtenha seu certificado digital.", color: "#16a34a" },
          ].map(s => (
            <div key={s.step} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              <span className="absolute top-4 right-4 text-5xl font-black opacity-[0.06]" style={{ color: s.color }}>{s.step}</span>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                style={{ backgroundColor: `${s.color}15` }}>
                <s.icon className="w-6 h-6" style={{ color: s.color }} />
              </div>
              <h3 className="font-black text-slate-900 mb-2">{s.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Depoimentos e histórias de transformação ── */}
      <TestimonialsSection />

      {/* ── CTA Banner ── */}
      <section className="py-16" style={{ background: `linear-gradient(135deg, ${C.blueDark} 0%, ${C.blue} 100%)` }}>
        <div className="max-w-3xl mx-auto px-4 text-center text-white">
          <TurtleMascot size={80} className="mx-auto mb-4" />
          <h2 className="text-3xl font-black mb-3">Pronto para começar?</h2>
          <p className="text-blue-100 mb-7 font-medium">
            Mais de 12 mil cidadãos já transformaram suas carreiras. Cadastre-se e comece hoje.
          </p>
          <button onClick={() => navigate("register")}
            className="font-black text-slate-900 px-8 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all inline-flex items-center gap-2"
            style={{ background: `linear-gradient(135deg, ${C.orange} 0%, #fb923c 100%)` }}>
            Criar conta gratuita <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>
    </div>
  );
}

// ─── CoursesPage ──────────────────────────────────────────────────────────────
function CoursesPage({ navigate, onViewCourse }: { navigate: (p: Page) => void; onViewCourse: (c: Course) => void }) {
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
            <TurtleMascot size={80} className="mx-auto mb-4 opacity-40" />
            <p className="font-bold text-slate-500">Nenhum curso encontrado para sua busca.</p>
            <button onClick={() => setSearch("")} className="mt-3 text-sm font-bold" style={{ color: C.blue }}>
              Limpar busca
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map(c => <CourseCard key={c.id} course={c} onView={onViewCourse} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CourseDetailPage ─────────────────────────────────────────────────────────
function CourseDetailPage({ course, navigate, onRegister }: { course: Course; navigate: (p: Page) => void; onRegister: () => void }) {
  const [tab, setTab] = useState<"sobre" | "conteudo" | "instrutor" | "requisitos" | "certificado" | "instituicao">("sobre");

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
                { icon: MapPin,  label: course.location,           sub: "Localização" },
              ].map(info => (
                <div key={info.sub} className="bg-slate-100 rounded-xl p-3 text-center">
                  <info.icon className="w-5 h-5 mx-auto mb-1" style={{ color: C.blue }} />
                  <p className="font-black text-xs text-slate-900">{info.label}</p>
                  <p className="text-[10px] text-slate-500 font-semibold">{info.sub}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 mb-5">
              <StatusBadge status={course.status} />
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                📅 {course.period}
              </span>
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                ⏱ {course.duration}
              </span>
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                👥 {course.enrolled} inscritos
              </span>
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                💰 Média: {course.avgSalary}
              </span>
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
              <button onClick={onRegister}
                className="flex-1 flex items-center justify-center gap-2 font-black text-white py-3.5 rounded-xl hover:opacity-90 hover:-translate-y-0.5 transition-all shadow-lg"
                style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)` }}>
                Inscrever-se <ArrowRight className="w-5 h-5" />
              </button>
              <button className="w-12 h-12 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:border-red-300 hover:text-red-500 transition-colors">
                <Heart className="w-5 h-5" />
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

          <div className="p-6 lg:p-8">
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
                    <h4 className="font-black text-slate-900 mb-4">Instituição parceira</h4>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                        <Building2 className="w-6 h-6" style={{ color: C.blue }} />
                      </div>
                      <div>
                        <p className="font-black text-sm text-slate-900">Prefeitura de Vitória</p>
                        <p className="text-xs text-slate-500 font-semibold">Secretaria de Cidadania,<br/>Trabalho e Educação</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[
                        { icon: Award,   label: "Certificado ao final do curso" },
                        { icon: Clock,   label: `Acesso por ${course.duration}` },
                        { icon: Users,   label: "Suporte durante o curso" },
                      ].map(item => (
                        <div key={item.label} className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <item.icon className="w-4 h-4" style={{ color: C.blue }} />
                          {item.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "conteudo" && (
              <div>
                <h3 className="font-black text-slate-900 text-lg mb-5">Conteúdo programático</h3>
                <div className="space-y-3">
                  {["Módulo 1 — Fundamentos e conceitos básicos",
                    "Módulo 2 — Ferramentas e ambiente de trabalho",
                    "Módulo 3 — Prática guiada com projetos reais",
                    "Módulo 4 — Técnicas avançadas e boas práticas",
                    "Módulo 5 — Projeto final e avaliação"].map((mod, i) => (
                    <div key={mod} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-blue-200 transition-colors">
                      <span className="w-8 h-8 rounded-full font-black text-sm flex items-center justify-center text-white shrink-0"
                        style={{ background: C.blue }}>{i + 1}</span>
                      <p className="font-semibold text-sm text-slate-700">{mod}</p>
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
                  <h3 className="font-black text-slate-900 text-lg">Prof. Equipe QualificaVix</h3>
                  <p className="text-sm font-bold mb-2" style={{ color: C.blue }}>Especialista certificado · 10+ anos de experiência</p>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Nossa equipe de instrutores é formada por profissionais altamente qualificados, com vasta experiência
                    no mercado e dedicação ao aprendizado prático. Todos os professores passam por processo seletivo rigoroso
                    e recebem formação pedagógica continuada pela Secretaria de Educação de Vitória.
                  </p>
                </div>
              </div>
            )}

            {tab === "requisitos" && (
              <div>
                <h3 className="font-black text-slate-900 text-lg mb-4">Pré-requisitos</h3>
                <div className="space-y-2">
                  {["Ter 16 anos ou mais", "Residir ou trabalhar em Vitória - ES",
                    `Escolaridade mínima: ${course.level === "Iniciante" ? "Ensino Fundamental" : "Ensino Médio"} completo`,
                    "Disponibilidade para o horário do curso", "Acesso à internet (cursos online)"].map(r => (
                    <div key={r} className="flex items-center gap-2 text-sm font-semibold text-slate-700 p-3 bg-slate-50 rounded-xl">
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#16a34a" }} />
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
                <h3 className="font-black text-slate-900 text-xl mb-3">Certificado de Conclusão</h3>
                <p className="text-slate-600 leading-relaxed mb-5 text-sm">
                  Ao concluir o curso com aproveitamento mínimo de 75%, você receberá um certificado digital
                  emitido pela Prefeitura de Vitória, reconhecido pelo mercado de trabalho capixaba.
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-50 rounded-xl p-3 font-semibold text-slate-600">
                    ✅ Reconhecimento oficial
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 font-semibold text-slate-600">
                    📱 100% digital
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 font-semibold text-slate-600">
                    📤 Compartilhável no LinkedIn
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 font-semibold text-slate-600">
                    📁 Válido na CTPS
                  </div>
                </div>
              </div>
            )}

            {tab === "instituicao" && (
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-black text-slate-900 text-lg mb-4">Prefeitura Municipal de Vitória</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4">
                    A Prefeitura de Vitória, por meio da Secretaria de Cidadania, Trabalho e Educação,
                    é responsável pela coordenação do QualificaVix e pelo credenciamento de todas as
                    instituições parceiras que oferecem cursos na plataforma.
                  </p>
                  <div className="space-y-2 text-sm font-semibold text-slate-600">
                    <p className="flex items-center gap-2"><MapPin className="w-4 h-4" style={{ color: C.blue }} /> Vitória, Espírito Santo</p>
                    <p className="flex items-center gap-2"><Globe className="w-4 h-4" style={{ color: C.blue }} /> vitoria.es.gov.br</p>
                    <p className="flex items-center gap-2"><Phone className="w-4 h-4" style={{ color: C.blue }} /> 0800 123 4567</p>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                  <h4 className="font-black text-slate-900 mb-3">Secretaria parceira</h4>
                  <p className="text-sm font-bold text-blue-700 mb-2">Secretaria de Cidadania, Trabalho e Educação</p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Responsável pela política pública de qualificação profissional do município,
                    garantindo acesso gratuito à educação profissional para todos os cidadãos vitorienses.
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
          <TurtleMascot size={90} className="mx-auto mb-5" />
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
            <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: C.orange }}>Nossa missão</p>
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
          <p className="text-xs font-black uppercase tracking-widest mb-3 text-center" style={{ color: C.orange }}>Metodologia</p>
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
            className="font-black text-white px-8 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all inline-flex items-center gap-2 mr-3"
            style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)` }}>
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
function CategoriasPage({ navigate, onViewCourse }: { navigate: (p: Page) => void; onViewCourse: (c: Course) => void }) {
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
          {filtered.map(c => <CourseCard key={c.id} course={c} onView={onViewCourse} />)}
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
              <TurtleSmall size={36} />
              <div className="leading-none">
                <p className="font-black text-lg tracking-tight text-white">Qualifica</p>
                <p className="font-black text-lg tracking-tight -mt-1" style={{ color: C.orange }}>Vix</p>
              </div>
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
            { title: "Plataforma", links: [{ label: "Início", page: "home" }, { label: "Cursos", page: "cursos" }, { label: "Categorias", page: "categorias" }, { label: "Sobre", page: "sobre" }] },
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
function chatbotAnswer(message: string) {
  const text = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normalized = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const matchingCourse = COURSES.find(course => {
    const title = normalized(course.title);
    return text.includes(title) || title.split(" ").filter(word => word.length > 5).some(word => text.includes(word));
  });
  if (matchingCourse) {
    const status = matchingCourse.status === "open" ? "inscrições abertas" : matchingCourse.status === "last-spots" ? "últimas vagas" : "início em breve";
    return `${matchingCourse.title}: ${matchingCourse.hours} horas, modalidade ${matchingCourse.modality}, nível ${matchingCourse.level}, ${status}. Local: ${matchingCourse.location}. Duração: ${matchingCourse.duration}.`;
  }
  if (/(tecnologia|programacao|informatica|desenvolvimento web)/.test(text))
    return `Na área de tecnologia temos: ${COURSES.filter(c => c.category === "Tecnologia").map(c => c.title).join(", ")}. Diga o nome de um deles para consultar os detalhes.`;
  if (/(gastronomia|culinaria|cozinha)/.test(text))
    return "Gastronomia Brasileira é presencial, tem 80 horas e acontece no Senac Vitória. O curso inclui preparo, culinária regional e segurança alimentar.";
  if (/(inscri|matricula|cadastr)/.test(text))
    return "Escolha um curso, clique em “Ver curso” e depois em “Inscrever-se”. Complete os quatro passos. Menores de 18 anos precisam informar os dados do responsável legal.";
  if (/(menor|idade|responsavel)/.test(text))
    return "A idade é calculada pela data de nascimento. Para menores de 18 anos, nome, CPF, parentesco e telefone do responsável legal são obrigatórios.";
  if (/(gratuit|preco|valor|pagar)/.test(text))
    return "Os cursos divulgados no QualificaVix são gratuitos. Consulte cada curso para verificar duração, modalidade, local e vagas.";
  if (text.includes("certific"))
    return "Os cursos emitem certificado ao final, conforme os requisitos de frequência e conclusão definidos pela instituição responsável.";
  if (/(online|presencial|modalidade)/.test(text))
    return "Existem cursos online e presenciais. Na página Cursos, use o filtro “Modalidade” para encontrar a opção ideal.";
  if (/(local|endereco|vitoria)/.test(text))
    return "As oportunidades são voltadas para Vitória–ES. Cada curso informa o local específico; há opções online e em unidades como Senac, Senai e Hub de Inovação.";
  if (/(contato|telefone|email|ajuda)/.test(text))
    return "Fale com a equipe pelo telefone 0800 123 4567 ou pelo e-mail contato@qualificavix.es.gov.br. Esses dados também estão na página Contato.";
  if (/(curso|opcao|catalogo)/.test(text))
    return `O catálogo apresenta ${COURSES.length} cursos em tecnologia, administração, design, marketing, educação, gastronomia e áreas técnicas. Diga uma área ou curso para eu detalhar.`;
  if (/^(oi|ola|bom dia|boa tarde|boa noite)/.test(text))
    return "Olá! Posso explicar cursos, inscrições, gratuidade, certificados, modalidades, requisitos para menores de idade e contatos. O que você quer saber?";
  return "Não encontrei uma resposta exata. Pergunte sobre um curso, inscrição, certificado, modalidade, gratuidade, menor de idade ou contato.";
}

function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, role: "bot" as const, text: "Olá! 👋 Eu sou o assistente do Qualifica Vix. Como posso te ajudar hoje?", time: "agora" }
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  const quickActions = ["Cursos de tecnologia", "Como me inscrever?", "Os cursos são gratuitos?", "Menor de idade"];

  function send(text?: string) {
    const t = (text ?? input).trim();
    if (!t) return;
    setInput("");
    setMessages(prev => [...prev, { id: Date.now(), role: "user", text: t, time: "agora" }]);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      const resp = chatbotAnswer(t);
      setMessages(prev => [...prev, { id: Date.now() + 1, role: "bot", text: resp, time: "agora" }]);
    }, 1000);
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[340px] sm:w-[360px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden" style={{ maxHeight: "calc(100vh - 120px)" }}>
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
              <button key={a} onClick={() => send(a)}
                className="text-xs font-bold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors">
                {a}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-100 bg-white">
            <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="flex-1 text-sm bg-slate-100 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-slate-400 font-medium" />
              <button type="submit" disabled={!input.trim()}
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
          <div className="absolute -top-12 right-0 bg-white text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg border border-slate-100 whitespace-nowrap">
            Olá! Sou a Tortuguita Vix 🐢
            <div className="absolute -bottom-1.5 right-4 w-3 h-3 bg-white border-r border-b border-slate-100 rotate-45" />
          </div>
        )}
        <button onClick={() => setOpen(!open)}
          className="w-16 h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all duration-200 border-4 border-white"
          style={{ background: `linear-gradient(135deg, ${C.blueDark} 0%, ${C.blue} 100%)` }}
          aria-label="Abrir assistente virtual">
          {open ? <X className="w-7 h-7 text-white" /> : <TurtleMascot size={52} />}
        </button>
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const {
    page, selectedCourse, darkMode, navigate, viewCourse: handleViewCourse,
    toggleDarkMode, increaseFont, decreaseFont,
  } = useAppController<Course>();
  const handleRegisterFromCourse = () => navigate("register");

  if (page === "register") {
    return (
      <RegisterPage
        dark={darkMode}
        onBack={() => navigate("home")}
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
        />
      <main>
        {page === "home" && <HomePage navigate={navigate} onViewCourse={handleViewCourse} />}
        {page === "cursos" && <CoursesPage navigate={navigate} onViewCourse={handleViewCourse} />}
        {page === "course-detail" && selectedCourse && (
          <CourseDetailPage course={selectedCourse} navigate={navigate} onRegister={handleRegisterFromCourse} />
        )}
        {page === "sobre" && <SobrePage navigate={navigate} />}
        {page === "categorias" && <CategoriasPage navigate={navigate} onViewCourse={handleViewCourse} />}
        {page === "contato" && (
          <div className="max-w-2xl mx-auto px-4 py-20 text-center">
            <TurtleMascot size={80} className="mx-auto mb-6" />
            <h1 className="text-3xl font-black text-slate-900 mb-3">Entre em contato</h1>
            <p className="text-slate-500 mb-8">Estamos aqui para te ajudar a encontrar o curso ideal.</p>
            <div className="space-y-3 text-left max-w-sm mx-auto">
              {[
                { icon: Phone, label: "Telefone", value: "0800 123 4567" },
                { icon: Mail,  label: "E-mail",   value: "contato@qualificavix.es.gov.br" },
                { icon: MapPin,label: "Endereço", value: "Vitória, Espírito Santo, Brasil" },
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
