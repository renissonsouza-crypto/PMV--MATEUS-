import type { Course } from "../models/Course.ts";
import type { Page } from "../models/navigation.ts";
import type { ContactChannel } from "../models/platformContact.ts";
import { PLATFORM_KNOWLEDGE, QUICK_QUESTIONS } from "../data/tortuguitaKnowledge.ts";
import type { KnowledgeIntent } from "../data/tortuguitaKnowledge.ts";
import { countEnrollmentsInCurrentMonth, canUnsubscribeFromCourse, getUnsubscribeDeadline } from "./enrollmentPolicy.js";
import { normalizeTortuguitaText, meaningfulWords, wordSimilarity, hasPhrase, hasAny } from "./tortuguitaText.ts";
import { mostSoughtCourses, type AssistantMemory } from "./tortuguitaMemory.ts";

export type AssistantPreferences = {
  category?: string; modality?: string; period?: string; level?: string;
  modalities?: string[]; levels?: string[]; excludedPeriods?: string[];
  maxHours?: number; maxMonths?: number; onlyAvailable?: boolean;
  excludedCategories?: string[]; excludedModalities?: string[]; goal?: string;
};
export type AssistantContext = {
  lastIntent?: string; courseIds?: number[]; candidateCourseIds?: number[]; preferences?: AssistantPreferences;
  dialogue?: "area" | "modality";
};
export type AssistantAction = { label: string; page?: Page; courseId?: number };
export type AssistantReply = {
  text: string; intent: string; confidence: "high" | "medium" | "low";
  actions: AssistantAction[]; suggestions: string[]; context: AssistantContext;
  navigation?: AssistantAction;
  completedCourseUpdate?: { courseId: number; completed: boolean };
};
export type AssistantOptions = {
  courses: Course[]; contacts: ContactChannel[]; context?: AssistantContext; now?: Date;
  profile?: { enrolledCourseIds: number[]; enrollments?: { courseId: number; enrolledAt: string }[]; enrollmentHistory?: { courseId: number; enrolledAt: string }[] } | null;
  page?: Page; activeCourseId?: number;
  memory?: AssistantMemory;
};
export type TortuguitaContext = AssistantContext;
export type TortuguitaAction = AssistantAction;
export type TortuguitaReply = AssistantReply;

const PAGE_LABELS: Partial<Record<Page, string>> = { home: "Início", cursos: "Explorar cursos", categorias: "Ver categorias", sobre: "Sobre a plataforma", contato: "Canais de atendimento", register: "Cadastro", profile: "Meu perfil", favorites: "Meus favoritos" };
const CATEGORY_ALIASES: Record<string, string[]> = {
  Tecnologia: ["tecnologia", "ti", "tecnologico"], Administração: ["administracao", "administrativo", "administrativa"], Design: ["design", "criatividade", "criativo"], Marketing: ["marketing", "publicidade"], Educação: ["educacao", "educacional"], Gastronomia: ["gastronomia", "culinaria", "cozinha"], Técnico: ["tecnico", "tecnica", "cursos tecnicos"], Saúde: ["saude", "enfermagem"],
};
const MODALITY_ALIASES: Record<string, string[]> = { Online: ["online", "on line", "ead", "a distancia", "remoto", "de casa"], Presencial: ["presencial", "presenciais", "pessoalmente"], Híbrido: ["hibrido", "hibrida", "semipresencial"] };
const PERIOD_ALIASES: Record<string, string[]> = { Noturno: ["noturno", "noturna", "a noite", "de noite"], Diurno: ["diurno", "diurna", "de manha", "pela manha"], Vespertino: ["vespertino", "vespertina", "a tarde", "de tarde"], Flexível: ["flexivel", "livre", "meu horario"] };
const COURSE_ALIASES: Record<string, string[]> = {
  "introducao a programacao": ["programacao", "programar", "logica de programacao"],
  "excel do basico ao avancado": ["excel", "planilhas", "planilha"],
  "design grafico para iniciantes": ["design grafico", "design", "photoshop", "illustrator"],
  "marketing digital na pratica": ["marketing digital", "marketing", "seo"],
  "desenvolvimento web completo": ["desenvolvimento web", "web", "sites", "frontend", "front end", "back end", "javascript", "react", "html", "css"],
  "gestao de projetos": ["gestao de projetos", "projetos", "scrum", "kanban"],
  "informatica para o mercado": ["informatica", "computador", "office"],
  "atendimento ao cliente": ["atendimento ao cliente", "atender clientes", "atendimento cliente"],
  "gastronomia brasileira": ["gastronomia", "culinaria", "cozinha"],
  "eletricista predial": ["eletricista", "eletrica", "instalacao eletrica"],
};

function unique<T>(values: T[]): T[] { return [...new Set(values)]; }
function validIds(ids: number[] | undefined, courses: Course[]): number[] { return unique((Array.isArray(ids) ? ids : []).slice(0, 10).filter(id => courses.some(course => course.id === id))); }
function cleanContext(context: AssistantContext | undefined, courses: Course[]): AssistantContext {
  const preferences: AssistantPreferences = {};
  const source = context?.preferences;
  if (source) {
    for (const key of ["category", "modality", "period", "level", "goal"] as const) if (typeof source[key] === "string") preferences[key] = source[key]!.slice(0, 100);
    for (const key of ["maxHours", "maxMonths"] as const) if (Number.isFinite(source[key]) && source[key]! > 0) preferences[key] = source[key];
    if (typeof source.onlyAvailable === "boolean") preferences.onlyAvailable = source.onlyAvailable;
    for (const key of ["excludedCategories", "excludedModalities", "excludedPeriods", "modalities", "levels"] as const) if (Array.isArray(source[key])) preferences[key] = source[key]!.filter(item => typeof item === "string").slice(0, 8).map(item => item.slice(0, 50));
  }
  return { ...(typeof context?.lastIntent === "string" ? { lastIntent: context.lastIntent.slice(0, 80) } : {}), ...(context?.dialogue === "area" || context?.dialogue === "modality" ? { dialogue: context.dialogue } : {}), courseIds: validIds(context?.courseIds, courses), candidateCourseIds: validIds(context?.candidateCourseIds, courses), ...(Object.keys(preferences).length ? { preferences } : {}) };
}
function reply(text: string, intent: string, context: AssistantContext, actions: AssistantAction[] = [], suggestions: string[] = [], confidence: AssistantReply["confidence"] = "high"): AssistantReply {
  return { text, intent, confidence, context: { ...context, lastIntent: intent }, actions: actions.slice(0, 6), suggestions: unique(suggestions).slice(0, 5) };
}
function courseActions(courses: Course[]): AssistantAction[] { return courses.slice(0, 5).map(course => ({ label: `Ver ${course.title}`, courseId: course.id })); }
function status(course: Course): string { return course.status === "coming-soon" ? "Início em breve — inscrições indisponíveis" : course.status === "last-spots" ? "Últimas vagas" : "Inscrições abertas"; }
function courseLine(course: Course): string { return `${course.title}: ${course.modality}, ${course.hours} horas, ${course.duration}, período ${course.period.toLowerCase()}, nível ${course.level.toLowerCase()}. ${status(course)}.`; }
function courseQuestions(course: Course): string[] { return [`O que vou aprender em ${course.title}?`, `Como me inscrevo em ${course.title}?`, `Qual o certificado de ${course.title}?`]; }
function bestSimilarity(word: string, candidates: string[]): number { return Math.max(0, ...candidates.map(candidate => wordSimilarity(word, candidate))); }

// The phrases and examples are scored as words. A single generic “curso” cannot
// make the bot choose a topic, and spelling tolerance never removes boundaries.
function scoreIntent(text: string, words: string[], item: KnowledgeIntent): number {
  let score = 0;
  for (const keyword of item.keywords) {
    const keyWords = meaningfulWords(keyword);
    if (!keyWords.length) continue;
    const matches = keyWords.map(word => bestSimilarity(word, words));
    const coverage = matches.filter(value => value >= 0.78).length / keyWords.length;
    if (coverage === 1) score = Math.max(score, 3 + Math.min(3, keyWords.length) + (hasPhrase(text, keyword) ? 1.5 : 0));
  }
  for (const question of item.questions) {
    if (normalizeTortuguitaText(question) === text) return 14;
    const questionWords = meaningfulWords(question);
    if (!questionWords.length) continue;
    const matched = questionWords.map(word => bestSimilarity(word, words));
    const coverage = matched.filter(value => value >= 0.78).length / questionWords.length;
    const overlap = matched.filter(value => value >= 0.78).length;
    if (overlap && coverage >= 0.5) score = Math.max(score, coverage * 4 + Math.min(overlap, 4) * 0.65);
  }
  return score;
}
function rankedKnowledge(text: string): { item: KnowledgeIntent; score: number }[] {
  const words = meaningfulWords(text);
  const semantic = semanticIntent(text);
  return PLATFORM_KNOWLEDGE.map(item => ({ item, score: Math.max(scoreIntent(text, words, item), item.id === semantic ? 12 : 0) })).filter(item => item.score >= 3.6).sort((a, b) => b.score - a.score);
}
function semanticIntent(text: string): string | undefined {
  const has = (...phrases: string[]) => hasAny(text, phrases);
  if (has("revogar", "excluir", "apague", "apagar", "deletar", "eliminar") && has("dados", "conta", "cadastro", "banco", "consentimento", "imagem") && !has("sair", "logout", "cancelar", "desinscrever")) return "data_deletion";
  if ((has("treinar", "treinam", "aprende", "modelo", "lgpd", "privacidade") && has("cadastro", "dados", "informacoes", "modelo")) || (has("senha", "cartao", "bancarios") && has("chat", "aqui", "enviar", "passar"))) return "privacy";
  if (has("senha", "login", "outro dispositivo", "outro celular", "outro computador", "outro navegador", "outra conta")) return "profile_local";
  if (has("sair", "logout", "encerrar sessao") && !has("empregado", "emprego", "salario", "trabalho")) return "logout";
  if (has("favorito", "favoritar", "coracao", "salvar para depois", "olhar mais tarde", "ver mais tarde", "guardar curso")) return "favorites";
  if (has("notificacoes", "notificacao", "lembretes", "avisos", "mensagens automaticas") || (has("chatbot", "tortuguita", "robo", "assistente") && has("whatsapp", "email", "mensagem", "lembrar"))) return "notifications";
  if (has("libras", "surdez", "surdo", "deficiencia", "braille", "cadeira de rodas", "adaptacao", "necessidade de acessibilidade", "necessidades especiais")) return "accessibility_registration";
  if (has("texto maior", "letras maiores", "tamanho da fonte", "aumentar letras", "modo escuro", "contraste", "teclado", "diminuir fonte")) return "accessibility_interface";
  if (has("publicar", "avaliar", "relato", "comentario", "estrelas", "depoimento") && has("experiencia", "depoimento", "relato", "comentario", "publico", "estrelas")) return "testimonials";
  if (has("email de confirmacao", "e mail de confirmacao", "link de confirmacao", "reenviar email", "reenviar e mail")) return "registration_email";
  if (has("perfil", "telefone", "email", "endereco", "cpf") && has("editar", "altero", "alterar", "mudar", "atualizar", "corrigir") && !has("confirmar", "invalido")) return "profile_edit";
  if (has("cep")) return has("vila velha", "cariacica", "serra", "fora de vitoria", "outro municipio") ? "registration_address" : "registration_cep";
  if (has("menor", "pais", "responsavel legal", "menos de 18") || (has("responsavel") && !has("instituicao", "ofertante", "oferece", "professor", "instrutor")) || /\b(?:tenho|idade de) (?:[1-9]|1[0-7]) anos\b/.test(text)) return "minors";
  if ((has("cpf", "rg", "documento", "documentos", "dados obrigatorios", "campos obrigatorios", "informacoes pessoais obrigatorias") || (has("obrigatorio", "obrigatorios", "obrigatorias") && has("informacoes", "dados", "cadastro"))) && !has("chat", "aqui", "outros usuarios", "alunos", "excluir", "apagar", "mudar", "corrigir")) return "registration_documents";
  if (has("pix", "mensalidade", "taxa", "transporte", "materiais", "alimentacao", "pagar", "custa", "custos")) return "free_courses";
  if (has("matricula oficial", "comprova matricula", "comprovante", "enviada a instituicao", "confirmar minha inscricao")) return "enrollments";
  if (has("limite", "quantas inscricoes", "quantos cursos", "mesmo mes", "por mes", "quarto curso") && !has("duracao", "maximo", "menos de", "ate")) return "enrollment_limit";
  if (has("ao vivo", "gravado", "gravadas", "gravada", "acessar as aulas", "assistir aulas", "plataforma de aulas", "videoaula", "videos")) return "learning_access";
  if (has("qual horario", "qual turno", "qual periodo", "dias de aula", "data exata") || (has("quero saber", "preciso saber") && has("horario", "turno", "periodo", "calendario"))) return "course_schedule";
  if (has("online", "presencial", "hibrido") && has("significa", "significam", "querem dizer", "diferenca", "o que e")) return "modalities";
  if (has("horas", "duracao") && has("diferenca")) return "course_details";
  if (has("professor", "instrutor", "quem vai dar", "quem da aulas")) return "instructors";
  if (has("empregado", "emprego garantido", "garante emprego", "salario garantido")) return "employment_outcomes";
  return undefined;
}
function findCourseMentions(text: string, courses: Course[]): Course[] {
  const words = meaningfulWords(text);
  const ranked = courses.map(course => {
    const title = normalizeTortuguitaText(course.title);
    const aliases = unique([title, ...(COURSE_ALIASES[title] ?? [])]);
    let score = 0;
    for (const alias of aliases) {
      const aliasWords = meaningfulWords(alias);
      if (!aliasWords.length) continue;
      const covered = aliasWords.every(word => bestSimilarity(word, words) >= 0.78);
      if (covered) score = Math.max(score, 4 + aliasWords.length + (hasPhrase(text, alias) ? 2 : 0));
    }
    return { course, score };
  }).filter(item => item.score >= 5).sort((a, b) => b.score - a.score);
  if (ranked.length) return ranked.map(item => item.course);
  // Search the actual curriculum, including new course data supplied by callers.
  // Only meaningful query terms count; generic descriptions never match alone.
  const searchWords = words.filter(word => !["ensina", "ensinem", "ensinar", "aprender", "aprendo", "estudar", "estudo", "estudem", "formacao", "formacoes", "indique", "recomende", "procuro", "busco", "conteudo", "conhecer", "ensine"].includes(word));
  if (!searchWords.length || !hasAny(text, ["curso", "cursos", "aprender", "estudar", "ensina", "ensinem", "conteudo", "formacao"])) return [];
  const contentMatches = courses.map(course => {
    const contentWords = meaningfulWords(`${course.title} ${course.description} ${course.whatYouLearn.join(" ")}`);
    const matched = searchWords.filter(word => bestSimilarity(word, contentWords) >= 0.9).length;
    return { course, matched, coverage: matched / searchWords.length };
  }).filter(item => item.coverage >= 0.75 && (item.matched >= 2 || (item.matched === 1 && searchWords[0].length >= 4)));
  return contentMatches.sort((a, b) => b.matched - a.matched).map(item => item.course);
}
function contextualCourses(text: string, context: AssistantContext, courses: Course[]): Course[] {
  const ordinals: Record<string, number> = { primeiro: 0, primeira: 0, segundo: 1, segunda: 1, terceiro: 2, terceira: 2, quarto: 3, quarta: 3, quinto: 4, quinta: 4 };
  const ordinal = Object.entries(ordinals).find(([word]) => hasPhrase(text, word));
  const source = context.candidateCourseIds?.length ? context.candidateCourseIds : context.courseIds;
  if (ordinal && source?.[ordinal[1]] !== undefined) return courses.filter(course => course.id === source[ordinal[1]]);
  if (hasAny(text, ["esse", "essa", "este", "esta", "ele", "ela", "dele", "dela", "desse", "dessa", "o mesmo", "e o", "e a"]) || text.split(" ").length <= 5) return courses.filter(course => context.courseIds?.includes(course.id));
  return [];
}
function negated(text: string, aliases: string[]): boolean {
  return aliases.some(alias => {
    const normalized = normalizeTortuguitaText(alias);
    const index = (` ${text} `).indexOf(` ${normalized} `);
    if (index < 0) return false;
    const prefix = (` ${text} `).slice(Math.max(0, index - 55), index).trim().split(" ").slice(-5).join(" ");
    return /(?:^| )(?:nao|sem|exceto|excluir|evitar|menos)(?: [a-z]+){0,4}$/.test(prefix);
  });
}
function extractPreferences(text: string, previous?: AssistantPreferences): { preferences: AssistantPreferences; explicit: boolean } {
  const clear = hasAny(text, ["limpar filtros", "todas as categorias", "todos os cursos", "limpe preferencias", "recomecar"]);
  const preferences: AssistantPreferences = clear ? {} : { ...previous };
  let explicit = clear;
  if (hasPhrase(text, "qualquer modalidade")) {
    delete preferences.modality; delete preferences.modalities; delete preferences.excludedModalities;
    explicit = true;
  }
  for (const [field, aliasesMap] of [["category", CATEGORY_ALIASES], ["modality", MODALITY_ALIASES], ["period", PERIOD_ALIASES]] as const) {
    for (const [value, aliases] of Object.entries(aliasesMap)) {
      if (!hasAny(text, aliases)) continue;
      explicit = true;
      if (negated(text, aliases)) {
        if (field === "category") { preferences.excludedCategories = unique([...(preferences.excludedCategories ?? []), value]); if (preferences.category === value) delete preferences.category; }
        else if (field === "modality") { preferences.excludedModalities = unique([...(preferences.excludedModalities ?? []), value]); if (preferences.modality === value) delete preferences.modality; }
        else { preferences.excludedPeriods = unique([...(preferences.excludedPeriods ?? []), value]); if (preferences.period === value) delete preferences.period; }
      } else {
        preferences[field] = value;
        if (field === "category") preferences.excludedCategories = (preferences.excludedCategories ?? []).filter(item => item !== value);
        if (field === "modality") preferences.excludedModalities = (preferences.excludedModalities ?? []).filter(item => item !== value);
        if (field === "period") preferences.excludedPeriods = (preferences.excludedPeriods ?? []).filter(item => item !== value);
      }
    }
  }
  const wantedModalities = Object.entries(MODALITY_ALIASES).filter(([, aliases]) => hasAny(text, aliases) && !negated(text, aliases)).map(([value]) => value);
  if (wantedModalities.length > 1 && hasAny(text, ["ou", "e"])) { preferences.modalities = wantedModalities; delete preferences.modality; }
  else if (wantedModalities.length === 1) delete preferences.modalities;
  if (hasAny(text, ["iniciante", "iniciantes", "basico", "do zero", "comecando", "primeiro emprego"])) { preferences.level = "Iniciante"; explicit = true; }
  else if (hasAny(text, ["intermediario", "intermediaria"])) { preferences.level = "Intermediário"; explicit = true; }
  else if (hasAny(text, ["avancado", "avancada"]) && !hasAny(text, ["excel"])) { preferences.level = "Avançado"; explicit = true; }
  if (hasAny(text, ["iniciante", "iniciantes", "basico"]) && hasAny(text, ["intermediario", "intermediarios"]) && hasPhrase(text, "ou")) { preferences.levels = ["Iniciante", "Intermediário"]; delete preferences.level; }
  const hours = text.match(/(?:ate|menos de|no maximo|maximo|maxima)\s+(\d{1,3})\s*(?:h|horas?)\b/);
  const months = text.match(/(?:ate|menos de|no maximo|maximo|maxima)\s+(\d{1,2})\s*(?:mes|meses)\b/);
  if (hours && Number(hours[1]) > 0) { preferences.maxHours = Number(hours[1]) - (hasPhrase(text, "menos de") ? 0.001 : 0); explicit = true; }
  if (months && Number(months[1]) > 0) { preferences.maxMonths = Number(months[1]) - (hasPhrase(text, "menos de") ? 0.001 : 0); explicit = true; }
  if (hasAny(text, ["curto", "rapido", "pouco tempo", "menor duracao"])) { preferences.maxMonths = 2; explicit = true; }
  if (hasAny(text, ["inscricoes abertas", "aberto", "abertos", "aberta", "abertas", "disponiveis", "disponivel", "com vagas", "posso me inscrever", "nao em breve"])) { preferences.onlyAvailable = true; explicit = true; }
  if (hasAny(text, ["primeiro emprego", "mudar de profissao", "mudanca de profissao", "empreender", "empreendedor", "atualizacao profissional"])) {
    preferences.goal = hasAny(text, ["primeiro emprego"]) ? "Primeiro emprego" : hasAny(text, ["empreender", "empreendedor"]) ? "Empreendedor" : hasAny(text, ["mudar de profissao", "mudanca de profissao"]) ? "Mudança de profissão" : "Atualização profissional";
    explicit = true;
  }
  return { preferences, explicit };
}
function searchCourses(text: string, options: AssistantOptions, context: AssistantContext, mentioned: Course[]): AssistantReply {
  const { preferences } = extractPreferences(text, context.preferences);
  let candidates = options.courses.filter(course =>
    (!preferences.category || course.category === preferences.category) && (!preferences.modality || course.modality === preferences.modality) && (!preferences.modalities || preferences.modalities.includes(course.modality)) &&
    (!preferences.period || course.period === preferences.period) && (!preferences.level || course.level === preferences.level || course.level === "Todos os níveis") &&
    (!preferences.maxHours || course.hours <= preferences.maxHours) && (!preferences.maxMonths || Number.parseFloat(course.duration) <= preferences.maxMonths) &&
    (!preferences.onlyAvailable || course.status !== "coming-soon") && (!preferences.excludedCategories?.includes(course.category)) && (!preferences.excludedModalities?.includes(course.modality)) && (!preferences.excludedPeriods?.includes(course.period)) && (!preferences.levels || preferences.levels.includes(course.level) || course.level === "Todos os níveis") &&
    (!preferences.goal || course.targetAudience.includes(preferences.goal)),
  );
  if (mentioned.length && !preferences.category) candidates = candidates.filter(course => mentioned.some(item => item.id === course.id));
  const filterWords = new Set(meaningfulWords(Object.values(CATEGORY_ALIASES).flat().concat(Object.values(MODALITY_ALIASES).flat(), Object.values(PERIOD_ALIASES).flat()).join(" ")));
  const instructionWords = new Set(meaningfulWords("todos todas qualquer nenhum mostrar mostre liste listar opções opcao opcoes formação formacao formações formacoes área area ensina ensinem ensine ensinem aprender estudar busco buscar procura procuro recomende recomendar indicar indique sugira sugestões sugestoes ajuda escolher combina comigo disponível aberto apenas so excluindo exceto quero preciso tem existe existem alguma algum vocês me oferece oferecem primeiros emprego empreendedor atualização profissional inicial do zero iniciante intermediario avancado curto rapido pouco tempo menor maior no máximo maximo maxima até horas h meses mes duração dure dura carga flexível livre turno período preferencia ver com vagas últimas ultimas primeiro segundo terceiro pois aí mais menos exatamente trabalhar nao pessoalmente categoria categorias escola curso cursos chamada saber rotina estou atras encontro encontrar achei inscrições matriculas seja sejam for forem nem sou verdade prefiro prefere gostaria agora então entao ajudar auxiliar encontrar procurar pesquisar descobrir consegue poderia"));
  const freeWords = meaningfulWords(text).filter(word => !filterWords.has(word) && !instructionWords.has(word) && !/^\d+$/.test(word));
  if (freeWords.length) candidates = candidates.filter(course => {
    const content = meaningfulWords(`${course.title} ${course.category} ${course.description} ${course.about} ${course.whatYouLearn.join(" ")} ${course.provider} ${course.location} ${course.targetAudience.join(" ")}`);
    return freeWords.every(word => bestSimilarity(word, content) >= 0.88);
  });
  if (hasAny(text, ["menor carga", "menos horas"])) candidates.sort((a, b) => a.hours - b.hours);
  else if (hasAny(text, ["mais curto", "mais rapido"])) candidates.sort((a, b) => Number.parseFloat(a.duration) - Number.parseFloat(b.duration));
  const durationLabel = (maximum: number | undefined, unit: string) => maximum ? Number.isInteger(maximum) ? `até ${maximum} ${unit}` : `menos de ${Math.ceil(maximum)} ${unit}` : "";
  const filters = [preferences.category, preferences.modality, preferences.modalities?.join(" ou "), preferences.period, preferences.level, preferences.levels?.join(" ou "), durationLabel(preferences.maxHours, "horas"), durationLabel(preferences.maxMonths, "meses"), preferences.onlyAvailable ? "inscrições disponíveis" : "", preferences.goal, ...(preferences.excludedModalities ?? []).map(value => `sem ${value.toLowerCase()}`), ...(preferences.excludedCategories ?? []).map(value => `sem ${value}`), ...(preferences.excludedPeriods ?? []).map(value => `sem período ${value.toLowerCase()}`)].filter(Boolean).join(", ");
  const newContext = { ...context, preferences, candidateCourseIds: candidates.slice(0, 10).map(course => course.id), courseIds: candidates.length === 1 ? [candidates[0].id] : [] };
  if (!candidates.length) return reply(`Não encontrei cursos no catálogo atual${filters ? ` com estes critérios: ${filters}` : ""}${freeWords.length ? ` para ${freeWords.slice(0, 5).join(" ")}` : ""}. Isso não confirma uma turma futura. Você pode retirar um filtro ou consultar Contato para verificar novas ofertas.`, "course-search", newContext, [{ label: "Explorar cursos", page: "cursos" }, { label: "Canais de atendimento", page: "contato" }], ["Mostrar todos os cursos", "Quais categorias existem?", "Como entro em contato?"]);
  const lines = candidates.map((course, index) => `${index + 1}. ${courseLine(course)}`);
  return reply(`Encontrei ${candidates.length} ${candidates.length === 1 ? "opção" : "opções"} no catálogo atual${filters ? ` (${filters})` : ""}:\n\n${lines.join("\n\n")}\n\nOs status são dados do catálogo; confirme as condições da turma no canal oficial. Diga um nome ou “o primeiro”, por exemplo, para ver detalhes.`, "course-search", newContext, courseActions(candidates), candidates.length === 1 ? courseQuestions(candidates[0]) : ["Quero saber mais sobre o primeiro", "Comparar o primeiro e o segundo", "Mostrar apenas cursos online"]);
}

function dynamicCourse(text: string, course: Course, context: AssistantContext): AssistantReply {
  const sections: string[] = [];
  if (hasAny(text, ["aprendo", "aprender", "ensina", "conteudo", "ementa", "programatico", "aprendizado", "ferramentas", "habilidades"])) sections.push(`Conteúdo de ${course.title}:\n${course.whatYouLearn.map(item => `• ${item}`).join("\n")}\n\n${course.about}`);
  if (hasAny(text, ["horas", "carga horaria", "duracao", "quanto tempo", "dura", "horario", "periodo", "turno", "dias de aula", "data", "comeca", "inicio", "calendario", "quando"])) sections.push(`Carga horária: ${course.hours} horas. Duração: ${course.duration}. Período: ${course.period}. Datas exatas de início e término, dias da semana e horários de entrada e saída não estão informados no catálogo; confirme com a instituição.`);
  if (hasAny(text, ["modalidade", "online", "presencial", "hibrido", "ead", "gravada", "ao vivo"])) sections.push(`Modalidade de ${course.title}: ${course.modality}. ${course.modality === "Online" ? "O catálogo não confirma se as aulas são ao vivo ou gravadas nem informa a ferramenta de acesso." : "Confirme os dias de aula, equipamentos e endereço completo antes de se deslocar."}`);
  if (hasAny(text, ["local", "endereco", "onde", "rota", "mapa", "maps"])) sections.push(course.modality === "Online" ? `${course.title} é online e não tem local presencial cadastrado. O endereço de acesso às aulas não está informado.` : `Local cadastrado: ${course.location || "Não informado"}. O endereço completo não consta na ficha. Nos detalhes, o ícone de localização abre uma pesquisa de rota no Google Maps; confirme a unidade e o endereço antes de sair.`);
  if (hasAny(text, ["certificado", "diploma", "mec", "nr10", "nr 10", "frequencia", "aproveitamento", "conclusao"])) sections.push(`A ficha de ${course.title} não informa se há certificado, quem o emite ou quais são os critérios de frequência e aproveitamento. Não há reconhecimento MEC confirmado. ${hasAny(normalizeTortuguitaText(course.whatYouLearn.join(" ")), ["nr10", "nr 10"]) ? "A referência à NR-10 no conteúdo não comprova uma certificação NR-10. " : ""}Confirme no edital ou com a instituição ofertante.`);
  if (hasAny(text, ["instituicao", "oferece", "ofertante", "provider", "professor", "instrutor", "senai", "senac", "quem vai dar", "quem da aulas"])) sections.push(`Instituição registrada: ${course.provider}. Nome do instrutor, contatos diretos, endereço completo e confirmação da parceria para esta edição não estão detalhados no catálogo.`);
  if (hasAny(text, ["requisitos", "prerequisitos", "pre requisitos", "escolaridade", "ensino medio", "idade", "preciso saber", "equipamentos", "material", "software"])) sections.push(`Nível de ${course.title}: ${course.level}. Público indicado: ${course.targetAudience.join(", ")}. A ficha não confirma idade mínima da turma, escolaridade, conhecimentos prévios, equipamentos ou software exigidos; confirme o edital. O cadastro aceita endereço de Vitória-ES e exige responsável legal para menores de 18 anos; isso não substitui os requisitos específicos da turma.`);
  if (hasAny(text, ["salario", "ganhar", "remuneracao", "emprego", "empregado", "trabalho", "contratacao"])) sections.push(`A ficha apresenta ${course.avgSalary} como referência de remuneração; a origem e o período dessa estimativa não estão informados. O curso não garante emprego, contratação ou esse salário. Conteúdo e público indicado: ${course.targetAudience.join(", ")}.`);
  if (hasAny(text, ["vagas", "disponivel", "status", "abertas", "inscricao", "inscrever", "matricular", "matricula", "reserva", "fila de espera", "lista de espera"])) sections.push(`Status de ${course.title}: ${status(course)}. ${course.status === "coming-soon" ? "Este curso ainda não aceita inscrição no site, e não há data de abertura, reserva ou lista de espera implementada." : "Para se inscrever, abra os detalhes e clique em Inscrever-se; no primeiro acesso, complete o cadastro. Clique em Confirmar minha inscrição diretamente na plataforma e aguarde o aviso de sucesso do servidor. Não é necessário confirmar por e-mail; se houver erro, a inscrição não deve ser considerada concluída. O limite é de 3 inscrições no mês, incluindo canceladas. A confirmação no navegador não substitui a validação da matrícula pela instituição."} A contagem de inscritos é um dado do catálogo, sem confirmação de vagas em tempo real.`);
  if (hasAny(text, ["preco", "custo", "custa", "pago", "pagar", "gratuito", "mensalidade", "taxa"])) sections.push(`${course.title} é apresentado como gratuito; o site não cobra inscrição nem mensalidade. Materiais, transporte, alimentação, equipamentos e internet não têm cobertura confirmada.`);
  if (!sections.length) sections.push(`${courseLine(course)}\n\n${course.description}\n\nConteúdo:\n${course.whatYouLearn.map(item => `• ${item}`).join("\n")}\n\nInstituição registrada: ${course.provider}. ${course.location ? `Local cadastrado: ${course.location}. ` : ""}Datas exatas, acesso às aulas, endereço completo e critérios de certificado precisam ser confirmados no canal responsável.`);
  if (hasAny(text, ["baixar", "baixo", "download", "emitir"]) && hasAny(text, ["certificado", "diploma"])) sections.push("Não há emissão nem download de certificado implementados nesta plataforma; confirme o procedimento oficial com o ofertante.");
  return reply(`${course.title}\n\n${sections.join("\n\n")}`, "course-detail", { ...context, courseIds: [course.id] }, courseActions([course]), courseQuestions(course));
}
function compareCourses(courses: Course[], context: AssistantContext): AssistantReply {
  const selected = courses.slice(0, 2);
  if (selected.length < 2) return reply("Posso comparar conteúdo, modalidade, nível, carga horária, duração, período e status de dois cursos. Diga os dois nomes que deseja comparar.", "clarification", context, [], ["Compare Programação e Desenvolvimento Web", "Compare Excel e Marketing Digital"], "low");
  const blocks = selected.map(course => `${course.title}\n• Área: ${course.category}\n• Modalidade: ${course.modality}\n• Nível: ${course.level}\n• Carga horária: ${course.hours} horas; duração: ${course.duration}\n• Período: ${course.period}\n• Status: ${status(course)}\n• Conteúdo: ${course.whatYouLearn.join("; ")}`);
  return reply(`${blocks.join("\n\n")}\n\nEscolha pelo conteúdo, nível e rotina que combinam com seu objetivo. Nenhuma opção garante emprego, remuneração ou certificado; confirme os requisitos e condições oficiais antes da inscrição.`, "course-comparison", { ...context, courseIds: selected.map(course => course.id), candidateCourseIds: selected.map(course => course.id) }, courseActions(selected), selected.map(course => `Como me inscrevo em ${course.title}?`));
}
function formatDeadline(value: string): string { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(value)) + " UTC"; }
function personalReply(text: string, options: AssistantOptions, context: AssistantContext, courses: Course[]): AssistantReply | undefined {
  const now = options.now && Number.isFinite(options.now.getTime()) ? options.now : new Date();
  if ((hasAny(text, ["cancelar", "cancelo", "cancelamento", "desistir", "desistencia", "desinscrever"]) || (hasAny(text, ["excluir", "apagar"]) && hasAny(text, ["matricula", "inscricao"]))) && !hasAny(text, ["cadastro", "conta", "dados", "perfil", "sair", "logout"])) {
    const selected = courses[0];
    const enrollment = selected ? options.profile?.enrollments?.find(item => item.courseId === selected.id) : undefined;
    let explanation = `Você pode cancelar uma inscrição em até 3 dias (72 horas) após a inscrição. Abra Meu perfil → Cursos cadastrados → Ver curso → Desinscrever-se. Depois do prazo, procure Contato. Cancelar não devolve uma inscrição ao limite mensal de 3.`;
    if (enrollment) {
      const deadline = getUnsubscribeDeadline(enrollment.enrolledAt);
      explanation += deadline ? `\n\nPara ${selected!.title}, o prazo termina em ${formatDeadline(deadline)}. ${canUnsubscribeFromCourse(enrollment, now) ? "O prazo está aberto neste momento." : "O cancelamento pelo site está fora do prazo neste momento; procure atendimento."}` : "\n\nA data dessa inscrição não está disponível; não consigo confirmar o prazo individual.";
    } else if (selected && options.profile) explanation += `\n\nNão encontrei uma inscrição ativa em ${selected.title} neste perfil local. Confira Meu perfil. Sem a data de inscrição, não consigo calcular um prazo individual.`;
    else if (!options.profile) explanation += "\n\nNão há perfil local disponível nesta conversa; a orientação acima é geral.";
    return reply(explanation, "cancellation", { ...context, ...(selected ? { courseIds: [selected.id] } : {}) }, [{ label: "Meu perfil", page: "profile" }, { label: "Canais de atendimento", page: "contato" }], ["Quantos cursos posso fazer por mês?", "Como vejo meus cursos inscritos?"]);
  }
  if (hasAny(text, ["limite", "quantos cursos", "3 cursos", "tres cursos", "quantas inscricoes", "por mes", "neste mes", "esse mes"]) && !hasAny(text, ["calendario", "duracao", "dure", "dura", "meses de duracao", "maximo", "menos de", "ate"])) {
    const history = options.profile?.enrollmentHistory ?? options.profile?.enrollments ?? [];
    const count = countEnrollmentsInCurrentMonth(history, now);
    const remaining = Math.max(0, 3 - count);
    let explanation = "O limite é de 3 inscrições realizadas no mês, contado pelo calendário UTC da plataforma. Inscrições canceladas continuam nessa contagem; ela reinicia no próximo mês.";
    if (options.profile) explanation += `\n\nNeste perfil local, há ${count} ${count === 1 ? "inscrição registrada" : "inscrições registradas"} no mês atual e ${remaining} ${remaining === 1 ? "inscrição restante" : "inscrições restantes"} até o limite. Essa consulta usa o histórico disponível neste navegador.`;
    return reply(explanation, "enrollment-quota", context, [{ label: "Meu perfil", page: "profile" }], ["Como vejo meus cursos inscritos?", "Como cancelar minha inscrição?"]);
  }
  if (hasAny(text, ["meus cursos", "minhas inscricoes", "meus inscritos", "cursos cadastrados", "meus cursos inscritos", "minhas matriculas"]) || ((hasAny(text, ["me matriculei", "me inscrevi"])) && !hasAny(text, ["nao me inscrevi", "nao me matriculei", "ainda nao"]))) {
    if (!options.profile) return reply("Não há perfil local disponível nesta conversa. Após o cadastro, abra Meu perfil → Cursos cadastrados para consultar suas inscrições neste navegador. Para recuperar sua conta em outro navegador, use Continuar com Google quando disponível. Não é necessário confirmar a inscrição por e-mail.", "my-enrollments", context, [{ label: "Meu perfil", page: "profile" }], ["Como faço meu cadastro?", "Meu perfil desapareceu"]);
    const ids = validIds(options.profile.enrolledCourseIds, options.courses);
    const enrolled = options.courses.filter(course => ids.includes(course.id));
    const lines = enrolled.map(course => {
      const entry = options.profile?.enrollments?.find(item => item.courseId === course.id);
      const deadline = entry ? getUnsubscribeDeadline(entry.enrolledAt) : null;
      return `• ${course.title}${deadline ? ` — cancelamento até ${formatDeadline(deadline)} (${canUnsubscribeFromCourse(entry, now) ? "dentro do prazo" : "fora do prazo"})` : " — data de inscrição não disponível"}.`;
    });
    return reply(enrolled.length ? `Neste perfil local há ${enrolled.length} ${enrolled.length === 1 ? "curso inscrito" : "cursos inscritos"}:\n\n${lines.join("\n")}\n\nAbra Meu perfil para acompanhar. Isso não confirma matrícula oficial nem acesso a aulas.` : "Não encontrei cursos inscritos no perfil local disponível. Explore o catálogo e confirme os detalhes antes da inscrição.", "my-enrollments", { ...context, candidateCourseIds: ids, courseIds: [] }, [{ label: "Meu perfil", page: "profile" }, ...courseActions(enrolled)], ["Quantos cursos posso fazer por mês?", "Como cancelar minha inscrição?"]);
  }
  return undefined;
}
function knowledgeReply(items: KnowledgeIntent[], options: AssistantOptions, context: AssistantContext): AssistantReply {
  const blocks = items.map(item => item.id === "contact" ? `${item.answer}\n\nCanais disponíveis: ${options.contacts.map(channel => `${channel.label}: ${channel.value}${channel.label === "Atendimento" ? ` (${channel.href})` : ""}`).join("; ")}.` : item.answer);
  const actions = unique(items.flatMap(item => item.actionPages ?? [])).map(page => ({ label: PAGE_LABELS[page] ?? "Abrir página", page }));
  return reply(blocks.join("\n\n"), items.map(item => item.id).join("+"), context, actions, items.flatMap(item => item.followUps));
}

// Questions about using the interface are not catalogue queries. Resolve them
// before a pending guided choice or a remembered course can consume the words.
function platformUsageReply(text: string, options: AssistantOptions, context: AssistantContext): AssistantReply | undefined {
  const question = /^(?:(?:oi|ola) )?(?:como|onde|de que forma|de que maneira|para que|pra que|o que|explique|me explique|ensine|me ensine)\b/.test(text);
  const assistantHelp = /\b(?:voce|voces|tortuguita|assistente)\b/.test(text) && /\b(?:ajudar|auxiliar|ajuda)\b/.test(text);
  const search = /\b(?:buscar|busco|encontrar|encontro|procurar|procuro|pesquisar|pesquiso|busca|pesquisa)\b/.test(text);
  const searchControl = /\b(?:busca|pesquisa|barra de busca|campo de busca|lupa)\b/.test(text);
  const courseSubject = /\b(?:curso|cursos|formacao|formacoes) (?:de|sobre|em|para)\b/.test(text);
  const explain = (id: string) => knowledgeReply([PLATFORM_KNOWLEDGE.find(item => item.id === id)!], options, context);

  if (question && /\b(?:filtro|filtros|filtrar)\b/.test(text)) return explain("catalog_filters");
  if (question && search && (searchControl || assistantHelp || (!courseSubject && !extractPreferences(text).explicit && !findCourseMentions(text, options.courses).length))) {
    const result = explain("catalog_search");
    return { ...result, suggestions: ["Quero ajuda para escolher um curso", "Como usar os filtros?", "Quais categorias existem?"] };
  }
  if (question && /\b(?:entrar|entro|acessar|acesso|recuperar|recupero|login)\b/.test(text) && /\b(?:conta|perfil|google|login)\b/.test(text)) return explain("profile_local");
  if (/^(?:(?:oi|ola) )?(?:o que voce (?:pode fazer|faz)(?: por mim| aqui| na plataforma| no site)?|como voce (?:pode|consegue) me ajudar|em que voce pode me ajudar|com o que voce pode me ajudar|(?:voce )?(?:pode|consegue|poderia) me ajudar|preciso de ajuda|me ajude|(?:quais|quais sao) (?:as )?suas (?:funcoes|funcionalidades|habilidades))(?: por favor)?$/.test(text)) {
    return reply("Posso ajudar você a encontrar e comparar cursos do catálogo, explicar como usar a busca e os filtros e orientar sobre cadastro, acesso com Google, perfil, favoritos e inscrições. Você pode me dizer o que deseja aprender ou escolher uma opção abaixo. Não faço inscrições nem altero seus dados pelo chat.", "assistant-capabilities", context, [], ["Quero ajuda para escolher um curso", "Como uso a busca?", "Como faço meu cadastro?", "Como entro na minha conta?"]);
  }
  return undefined;
}

function guidedConversation(text: string, options: AssistantOptions, context: AssistantContext): AssistantReply | undefined {
  const start = hasAny(text, ["quero ajuda para escolher um curso", "me ajude a escolher", "nao sei qual curso", "me ajude a descobrir", "nao sei por onde comecar"]);
  if (hasAny(text, ["como faco agora", "qual o proximo passo", "e agora"])) {
    const selected = options.courses.find(course => context.courseIds?.length === 1 && course.id === context.courseIds[0]);
    if (selected) return reply(selected.status === "coming-soon" ? `${selected.title} ainda não aceita inscrição. Você pode consultar sua ficha ou procurar outro curso disponível.` : `Para seguir com ${selected.title}:\n1. Abra a ficha e confira conteúdo e requisitos.\n2. Toque em Inscrever-se. Se necessário, complete seu cadastro.\n3. Confirme diretamente na plataforma e aguarde o aviso de sucesso. Depois, confira Meu perfil → Cursos cadastrados. Não precisa de confirmação por e-mail.`, "next-step", context, courseActions([selected]), ["Quais são os requisitos para inscrição?", "Onde vejo meus cursos inscritos?", "Quero ajuda para escolher um curso"]);
  }
  if (hasAny(text, ["cancelar ajuda", "sair da escolha", "parar orientacao"]) || (/\b(?:nao quero|pare|parar|cancele|cancelar|encerrar|sair)\b/.test(text) && /\b(?:escolha|orientacao|ajuda guiada)\b/.test(text))) return reply("Tudo bem, encerramos a escolha guiada. Pode perguntar sobre um curso, cadastro ou outra função da plataforma.", "guidance-cancelled", { ...context, dialogue: undefined });
  if (hasAny(text, ["nao entendi", "explique melhor", "explicar melhor", "mais simples", "nao ajudou", "nao era isso", "preciso de mais ajuda"])) {
    const selected = options.courses.find(course => context.courseIds?.length === 1 && course.id === context.courseIds[0]);
    if (selected) return reply(`Vamos por partes. ${courseLine(selected)}\n\nVocê pode consultar o conteúdo, conferir as condições ou abrir a ficha. A inscrição só é concluída na plataforma após sua confirmação. Qual dessas partes você quer entender melhor?`, "conversation-repair", context, courseActions([selected]), [`O que vou aprender em ${selected.title}?`, `Como me inscrevo em ${selected.title}?`, "Quero ajuda para escolher um curso"]);
    const topic = PLATFORM_KNOWLEDGE.find(item => item.id === context.lastIntent);
    const explanation = topic ? topic.answer.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ") + "\n\n" : "";
    return reply(`${explanation}Vamos por partes: você precisa escolher um curso, preencher o cadastro ou consultar uma inscrição? Escolha uma opção ou diga onde ficou a dúvida.`, "conversation-repair", context, [], ["Quero ajuda para escolher um curso", "Quais são as etapas do cadastro?", "Onde vejo meus cursos inscritos?", "Como entro em contato?"]);
  }
  if (!start && !context.dialogue) return undefined;
  const next = start ? { ...context, courseIds: [], candidateCourseIds: [], preferences: { onlyAvailable: true } as AssistantPreferences, dialogue: "area" as const } : context;
  const extracted = extractPreferences(text, next.preferences);
  if (!start && next.dialogue === "area" && hasAny(text, ["ainda nao sei", "sem ideia", "estou em duvida"])) return reply("Podemos começar pelo que você gosta de fazer: Tecnologia para explorar computadores e programação; Administração para planilhas e organização; Gastronomia para cozinha. São exemplos de temas do catálogo, sem promessa de emprego. Qual dessas áreas você gostaria de explorar?", "guided-choice", next, [], ["Tecnologia", "Administração", "Gastronomia", "Cancelar ajuda"]);
  if (start || (next.dialogue === "area" && !extracted.preferences.category)) return reply("Vamos encontrar uma opção que combine com você 🐢 Qual área desperta seu interesse? Há Tecnologia, Administração, Design, Marketing, Educação, Gastronomia, Técnico e Saúde; a oferta depende do catálogo. Se ainda não sabe, posso dar exemplos.", "guided-choice", { ...next, preferences: extracted.preferences, dialogue: "area" }, [], ["Tecnologia", "Administração", "Gastronomia", "Ainda não sei"]);
  if (next.dialogue === "area" && !extracted.preferences.modality) return reply(`Certo, vamos olhar ${extracted.preferences.category}. Você prefere estudar online, presencialmente ou aceita as duas modalidades? Vou considerar as inscrições disponíveis.`, "guided-choice", { ...next, preferences: extracted.preferences, dialogue: "modality" }, [], ["Online", "Presencial", "Qualquer modalidade", "Cancelar ajuda"]);
  if (!extracted.explicit && !hasAny(text, ["as duas", "tanto faz", "qualquer modalidade"])) return undefined;
  const preferences = { ...extracted.preferences, onlyAvailable: true };
  if (hasAny(text, ["as duas", "tanto faz", "qualquer modalidade"])) { delete preferences.modality; delete preferences.modalities; }
  const result = searchCourses("Quero cursos", options, { ...next, dialogue: undefined, lastIntent: "course-search", preferences }, []);
  return { ...result, text: `Considerei suas preferências para esta escolha.\n\n${result.text}` };
}

function answerSingleTortuguita(message: string, options: AssistantOptions): AssistantReply {
  const text = normalizeTortuguitaText(message);
  const context = cleanContext(options.context, options.courses);
  if (!text) return reply("Sou a Tortuguita Vix 🐢 Posso orientar sobre os cursos do catálogo, cadastro, inscrições, perfil, favoritos e regras da plataforma. Digite sua dúvida ou escolha uma sugestão.", "greeting", context, [], QUICK_QUESTIONS.slice(0, 5));
  if (String(message).length > 1000) return reply("Sua pergunta é muito longa. Envie uma dúvida de até 1.000 caracteres para eu ajudar com clareza.", "clarification", context, [], QUICK_QUESTIONS.slice(0, 3), "low");
  if (/^((oi|ola|bom dia|boa tarde|boa noite|e ai|hey|hello|tudo bem)( |$)){1,3}[a-z ]*$/.test(text) && meaningfulWords(text).length <= 2) return reply("Olá! Sou a Tortuguita Vix 🐢 Posso encontrar cursos, comparar opções e explicar cadastro, inscrições, perfil e regras do Qualifica Vix. Como posso ajudar?", "greeting", context, [], QUICK_QUESTIONS.slice(0, 5));
  if (hasAny(text, ["obrigado", "obrigada", "valeu", "agradeco"]) && meaningfulWords(text).length <= 3) return reply("Por nada! 🐢 Quando precisar, posso ajudar com cursos e dúvidas sobre a plataforma.", "thanks", context, [], QUICK_QUESTIONS.slice(0, 3));
  if (hasAny(text, ["ignore instrucoes", "ignore as instrucoes", "prompt do sistema", "system prompt", "chave api", "api key", "seu token", "senha do banco", "dados de outros usuarios", "cpf dos usuarios", "hackear"])) return reply("Posso orientar sobre a plataforma e os dados públicos do catálogo. Não acesso segredos, credenciais nem dados de outros usuários, e não altero inscrições ou apago registros pelo chat. Para tratar dados pessoais, use os canais de atendimento.", "privacy", context, [{ label: "Canais de atendimento", page: "contato" }], ["Como meus dados são armazenados?", "Como solicitar exclusão dos meus dados?"]);
  if (hasAny(text, ["seu nome", "quem e voce", "voce e uma ia", "voce usa ia", "como voce funciona", "voce e um robo", "assistente virtual"])) return reply("Sou a Tortuguita Vix, assistente local do Qualifica Vix. Respondo com informações revisadas da plataforma, dados do catálogo e contexto desta conversa. Não consulto uma IA externa nem acesso dados de outros usuários. Posso orientar, mas inscrições e alterações exigem sua ação nas telas.", "assistant-capabilities", context, [], QUICK_QUESTIONS.slice(0, 5));
  const usage = platformUsageReply(text, options, context);
  if (usage) return usage;
  const guided = guidedConversation(text, options, context);
  if (guided) return guided;
  const mentions = findCourseMentions(text, options.courses);
  const conversationalCourses = contextualCourses(text, context, options.courses);
  const activeCourse = ["course-detail", "enrollment-confirmation"].includes(options.page ?? "") ? options.courses.filter(course => course.id === options.activeCourseId) : [];
  const relevantCourses = mentions.length ? mentions : conversationalCourses.length ? conversationalCourses : activeCourse;
  const knowledge = rankedKnowledge(text);
  const top = knowledge[0];
  if (top && ["favorites", "logout", "privacy", "data_deletion", "notifications", "registration_documents", "minors", "accessibility_registration", "profile_local"].includes(top.item.id) && top.score >= 10) return knowledgeReply([top.item], options, context);
  const personal = personalReply(text, options, context, relevantCourses);
  if (personal) return personal;
  const preferences = extractPreferences(text, context.preferences);
  if ((preferences.preferences.maxHours || preferences.preferences.maxMonths) && preferences.explicit && !relevantCourses.length) return searchCourses(text, options, context, mentions);
  if (top && top.score >= 12 && !relevantCourses.length && !["course_recommendation", "coming_soon", "course_availability"].includes(top.item.id)) return knowledgeReply([top.item], options, context);
  const importantPlatformIds = new Set(["cancellation", "enrollment_limit", "duplicate_enrollment", "registration", "registration_steps", "registration_documents", "registration_phone", "registration_email", "registration_address", "registration_cep", "minors", "accessibility_registration", "socioeconomic", "consents", "notifications", "profile_edit", "profile_photo", "profile_local", "profile_missing", "logout", "privacy", "data_deletion", "favorites", "enrollments", "testimonials", "illustrative_testimonials", "contact", "accessibility_interface", "troubleshooting_local", "troubleshooting_dependencies", "troubleshooting_api"]);
  // Specific platform actions take priority over an incidental course title.
  if (top && importantPlatformIds.has(top.item.id) && top.score >= 4.5 && !(relevantCourses.length && ["registration", "registration_steps"].includes(top.item.id) && !hasAny(text, ["cadastro", "cadastrar"]))) {
    const clauses = text.split(/\b(?:e tambem|tambem|alem disso)\b/).filter(Boolean);
    const extra = clauses.length > 1 ? clauses.slice(1, 3).map(clause => rankedKnowledge(clause)[0]).filter(item => item && item.score >= 4.5 && item.item.id !== top.item.id).map(item => item.item) : [];
    return knowledgeReply(unique([top.item, ...extra]), options, context);
  }
  const comparison = ["comparar", "compare", "comparacao", "diferenca entre", "qual e melhor", "versus", "vs"].some(phrase => hasPhrase(text, phrase));
  if (comparison && (!top || relevantCourses.length >= 2 || top.score < 7)) {
    let comparing = relevantCourses;
    if (hasAny(text, ["primeiro e o segundo", "primeiro e segundo", "os dois", "entre eles", "entre esses"]) && context.candidateCourseIds?.length) comparing = context.candidateCourseIds.slice(0, 2).flatMap(id => options.courses.filter(course => course.id === id));
    return compareCourses(comparing, context);
  }
  const searchRequest = hasAny(text, ["recomende", "recomendar", "indicar", "indique", "sugira", "quero cursos", "quais cursos", "que curso", "tem curso", "tem cursos", "procuro", "busco", "mostrar cursos", "mostre cursos", "mostrar apenas", "so cursos", "apenas cursos", "quero estudar", "quero aprender", "quero trabalhar", "quero um curso", "curso curto", "todos os cursos", "qual curso", "curso de", "curso no", "curso na", "cursos no", "cursos na", "ensinem"]);
  const specificFacet = hasAny(text, ["certificado", "carga horaria", "duracao", "horario", "local", "endereco", "onde", "aprendo", "conteudo", "aprenderei", "requisito", "data exata", "comeca", "salario", "matricula", "inscrever", "aulas", "instituicao", "ofertante", "oferece", "professor", "instrutor", "escolaridade", "ensino medio", "idade", "preco", "custa", "pagar", "frequencia", "empregado"]);
  const categoryOnly = preferences.explicit && (!relevantCourses.length || (searchRequest && !specificFacet));
  if (categoryOnly || (searchRequest && (!top || top.score < 7.5) && !specificFacet) || (context.lastIntent === "course-search" && preferences.explicit && !specificFacet)) return searchCourses(text, options, context, mentions);
  if (relevantCourses.length > 1 && !searchRequest) return reply(`Encontrei mais de uma formação: ${relevantCourses.map(course => course.title).join("; ")}. Qual delas você quer consultar? Posso também comparar duas opções.`, "clarification", { ...context, candidateCourseIds: relevantCourses.map(course => course.id) }, courseActions(relevantCourses), relevantCourses.map(course => `Quero saber sobre ${course.title}`), "low");
  if (relevantCourses.length === 1) return dynamicCourse(text, relevantCourses[0], context);
  if (specificFacet && (hasAny(text, ["ele", "ela", "esse", "essa", "desse", "dessa"]) || context.candidateCourseIds?.length)) return reply("De qual curso você está falando? Diga o nome ou escolha uma das opções para eu consultar os dados corretos do catálogo.", "clarification", context, courseActions(options.courses.filter(course => context.candidateCourseIds?.includes(course.id))), ["Quais cursos são online ou presenciais?"], "low");
  if (top) {
    if (top.score < 4.5 && knowledge[1] && Math.abs(top.score - knowledge[1].score) < 0.3) return reply(`Você quer saber sobre ${top.item.title.toLowerCase()} ou ${knowledge[1].item.title.toLowerCase()}? Escolha uma pergunta para eu responder com precisão.`, "clarification", context, [], [top.item.questions[0], knowledge[1].item.questions[0]], "low");
    const segments = text.split(/\b(?:e tambem|tambem|alem disso)\b/).filter(Boolean);
    const extra = segments.length > 1 ? segments.slice(1, 3).map(segment => rankedKnowledge(segment)[0]).filter(item => item && item.score >= 4.5 && item.item.id !== top.item.id).map(item => item.item) : [];
    return knowledgeReply(unique([top.item, ...extra]), options, context);
  }
  if (hasAny(text, ["receita", "clima", "futebol", "politica", "presidente", "medico", "diagnostico", "investimento", "bitcoin", "traduzir", "piada", "horoscopo", "escreva codigo"])) return reply("Meu atendimento é voltado ao Qualifica Vix: cursos cadastrados, cadastro, inscrições, perfil e regras da plataforma. Posso ajudar a encontrar uma formação relacionada ao seu objetivo.", "out-of-scope", context, [{ label: "Explorar cursos", page: "cursos" }], QUICK_QUESTIONS.slice(0, 3), "low");
  return reply("Ainda não identifiquei sua dúvida com segurança. Posso ajudar com cursos do catálogo, cadastro, inscrição, perfil, favoritos, limite mensal, cancelamento e contato. Escreva o nome do curso ou escolha uma pergunta abaixo. Para uma informação não publicada, consulte o atendimento oficial.", "fallback", context, [{ label: "Explorar cursos", page: "cursos" }, { label: "Canais de atendimento", page: "contato" }], QUICK_QUESTIONS.slice(0, 5), "low");
}

function answerConversation(message: string, options: AssistantOptions): AssistantReply {
  const text = normalizeTortuguitaText(message);
  // Keep comparison names, OR filters and compound facets together. Different
  // topics can be answered in one turn, with context carried to pronouns.
  if (String(message).length <= 1000 && rankedKnowledge(text)[0]?.score !== 14 && !["comparar", "compare", "comparacao", "versus", "vs", "diferenca"].some(phrase => hasPhrase(text, phrase))) {
    const clauses = String(message).split(/\s+(?:e(?:\s+tamb[eé]m)?|tamb[eé]m|al[eé]m disso)\s+/iu).map(normalizeTortuguitaText).filter(Boolean).slice(0, 3);
    if (clauses.length > 1 && clauses.every(clause => meaningfulWords(clause).length > 0)) {
      const answers: AssistantReply[] = [];
      let context = options.context;
      for (const clause of clauses) {
        const result = answerSingleTortuguita(clause, { ...options, context });
        answers.push(result); context = result.context;
      }
      const accepted = answers.filter(result => !["fallback", "clarification", "out-of-scope", "greeting", "thanks"].includes(result.intent));
      if (accepted.length > 1 && unique(accepted.map(result => result.intent)).length > 1) {
        const actions = accepted.flatMap(result => result.actions).filter((action, index, all) => all.findIndex(other => other.page === action.page && other.courseId === action.courseId) === index);
        return reply(accepted.map(result => result.text).join("\n\n"), accepted.map(result => result.intent).join("+"), accepted[accepted.length - 1].context, actions, accepted.flatMap(result => result.suggestions));
      }
    }
  }
  const result = answerSingleTortuguita(message, options);
  if (result.intent === "registration_documents" && hasAny(text, ["cpf"]) && hasAny(text, ["ja usei", "ja cadastrado", "ja existe", "duplicado", "outro cadastro"])) {
    return { ...result, text: result.text + "\n\nSe esse CPF já foi usado em um cadastro, não repita o registro para contornar validações. Confira o perfil existente neste navegador; se precisar corrigir ou recuperar um registro, procure o atendimento oficial." };
  }
  return result;
}

function memoryReply(message: string, options: AssistantOptions): AssistantReply | undefined {
  const text = normalizeTortuguitaText(message);
  const context = cleanContext(options.context, options.courses);
  const memory = options.profile ? options.memory : undefined;
  const completion = /^(?:eu )?(?:(?:ja )?(?:conclui|terminei|completei|finalizei)|ja fiz)\b/.test(text);
  const undoCompletion = /^(?:eu )?(?:ainda )?nao (?:conclui|terminei|fiz|completei|finalizei)\b/.test(text);
  const asksCompleted = /\b(?:quais|que cursos|meus cursos|liste|listar|mostrar|mostre)\b/.test(text) && /\b(?:conclui|concluidos|feitos|ja fiz|terminei|completos)\b/.test(text);
  const asksInterests = /\b(?:mais (?:procurei|consultei|busquei|pesquisei|procurados|consultados)|meus interesses)\b/.test(text);
  const asksHistory = /\b(?:continuar de onde paramos|retomar (?:a )?conversa|sobre o que conversamos|minhas conversas|meu historico|minha memoria|lembra de mim|lembra sobre mim|o que voce lembra)\b/.test(text);
  const recommendation = /\b(?:recomende|recomendar|indique|sugira|recomendacao|sugestao)\b/.test(text) && /\b(?:para mim|meu perfil|meus interesses|meu historico)\b/.test(text);
  if (!completion && !undoCompletion && !asksCompleted && !asksInterests && !asksHistory && !recommendation) return undefined;
  if (!memory) return reply("Para guardar conversas e interesses entre visitas, crie um perfil neste navegador. Sem perfil, a conversa fica apenas nesta página. A memória não é sincronizada entre dispositivos.", "memory-unavailable", context, [{ label: "Cadastro", page: "register" }]);

  if ((completion || undoCompletion) && !asksCompleted && !message.includes("?") && !/\b(?:se|talvez|quero|vou|pretendo|gostaria|nunca)\b/.test(text)) {
    const mentions = findCourseMentions(text, options.courses);
    const refersBack = /\b(?:esse|este|aquele|ele|primeiro|segundo|terceiro|ultimo)\b/.test(text);
    const referenced = mentions.length ? mentions : refersBack ? contextualCourses(text, context, options.courses) : [];
    if (referenced.length !== 1) return reply("Qual curso você concluiu ou quer corrigir? Diga um nome do catálogo por vez para eu atualizar sua memória corretamente.", "memory-clarification", context, courseActions(referenced));
    const course = referenced[0];
    const completed = !undoCompletion;
    return { ...reply(completed ? `Anotei que você informou ter concluído ${course.title}. Vou considerar isso nas próximas recomendações. Esse registro é uma informação sua; não é uma certificação nem altera sua inscrição.` : `Retirei ${course.title} da lista de conclusões informadas. Suas inscrições continuam como estavam.`, "memory-completion", { ...context, courseIds: [course.id] }, courseActions([course]), ["Quais cursos já concluí?", "Recomende um curso para mim"]), completedCourseUpdate: { courseId: course.id, completed } };
  }
  const completed = options.courses.filter(course => memory.completedCourseIds.includes(course.id));
  if (asksCompleted) return reply(completed.length ? `Você informou ter concluído:\n${completed.map(course => `• ${course.title}`).join("\n")}\n\nInscrições não contam como conclusão. Esses registros são informados por você e não comprovam certificação. Para corrigir, diga “ainda não concluí” seguido do nome do curso.` : "Você ainda não informou nenhum curso concluído. Uma inscrição não significa conclusão. Se já fez um curso, diga, por exemplo, “já concluí Excel”.", "memory-completed", context, courseActions(completed));
  const interests = mostSoughtCourses(memory).flatMap(item => {
    const course = options.courses.find(course => course.id === item.courseId);
    return course ? [{ ...item, course }] : [];
  });
  if (asksInterests) return reply(interests.length ? `Os cursos mais consultados por você neste navegador são:\n${interests.slice(0, 5).map(item => `• ${item.course.title}: ${item.questions} perguntas e ${item.views} visitas à ficha`).join("\n")}\n\nEsse é seu histórico pessoal, não um ranking de todos os alunos.` : "Ainda não há cursos consultados na sua memória. Pergunte sobre uma formação ou abra uma ficha para começar seu histórico pessoal.", "memory-interests", context, courseActions(interests.map(item => item.course)));
  if (recommendation) {
    // Reuse the existing search constraints, including negative preferences.
    const pool = options.courses.filter(course => !memory.completedCourseIds.includes(course.id) && !options.profile?.enrolledCourseIds.includes(course.id) && course.status !== "coming-soon");
    const preferences = extractPreferences(text, memory.context.preferences).preferences;
    const filtered = searchCourses("", { ...options, courses: pool }, { ...context, lastIntent: "course-search", preferences }, findCourseMentions(text, pool));
    const candidates = pool.filter(course => filtered.context.candidateCourseIds?.includes(course.id));
    const affinity = (course: Course) => interests.reduce((score, interest) => score + (interest.course.category === course.category ? interest.questions + interest.views : 0), 0);
    candidates.sort((a, b) => affinity(b) - affinity(a) || a.id - b.id);
    const selected = candidates.slice(0, 3);
    return reply(selected.length ? `Considerando seus interesses e preferências salvos, estas são opções para você:\n\n${selected.map(courseLine).join("\n\n")}\n\nDeixei de fora cursos já inscritos, conclusões que você informou e cursos em breve. As condições de cada turma precisam ser confirmadas.` : "Não encontrei novas opções disponíveis que atendam às suas preferências salvas e ainda não estejam inscritas ou concluídas por você. Você pode pedir “limpar filtros” para ampliar a busca.", "memory-recommendation", { ...context, preferences, candidateCourseIds: selected.map(course => course.id), courseIds: [] }, courseActions(selected), ["Quais cursos mais procurei?", "Quais cursos já concluí?", "Limpar filtros"]);
  }
  if (asksHistory) {
    const lastCourses = options.courses.filter(course => context.courseIds?.includes(course.id));
    const previous = memory.messages.filter(item => item.role === "user").slice(-3);
    return reply(previous.length ? `Podemos continuar de onde paramos. Suas últimas mensagens foram:\n${previous.map(item => `• ${item.text}`).join("\n")}\n\n${lastCourses.length ? `Último assunto de curso: ${lastCourses.map(course => course.title).join(", ")}. Pode perguntar sobre ele sem repetir o nome.` : "Também guardo seus interesses e as conclusões que você informar."}` : "Sua memória está pronta para guardar as próximas conversas deste perfil neste navegador. Pergunte sobre cursos ou suas preferências para começar.", "memory-history", context, courseActions(lastCourses), ["Quais cursos mais procurei?", "Quais cursos já concluí?", "Recomende um curso para mim"]);
  }
  return undefined;
}

export function answerTortuguita(message: string, options: AssistantOptions): AssistantReply {
  const result = answerConversation(message, options);
  const text = normalizeTortuguitaText(message);
  if (String(message).length <= 1000 && result.intent !== "privacy" && !result.intent.includes("+")) {
    const remembered = memoryReply(message, options);
    if (remembered) return remembered;
  }
  // Navigation is a separate decision: suggested actions in an explanation are
  // not permission to choose a destination. Unclear or negative requests stay in chat.
  if (String(message).length > 1000 || /\b(?:nao|nunca|sem|talvez|se|ou)\b/.test(text) ||
    /\b(?:e tambem|alem disso)\b|\be (?:quero|preciso|gostaria|abra|mostre)\b/.test(text) ||
    result.intent.includes("+") || ["privacy", "out-of-scope", "course-comparison"].includes(result.intent)) return result;

  const mentioned = /\bsobre (?:a plataforma|o projeto)\b/.test(text) ? [] : findCourseMentions(text, options.courses);
  const wantsRegistration = /\b(?:quero|desejo|gostaria de|preciso|vou) (?:(?:fazer|realizar) (?:(?:a|o|minha|meu) )*|me )?(?:cadastro|cadastrar|inscricao|inscrever)\b/.test(text) ||
    /\b(?:abra|abrir|ir para|acesse|acessar|leve me|me leve|me redirecione para) (?:a |o |area de |tela de |pagina de )*(?:cadastro|cadastrar)\b/.test(text);
  if (wantsRegistration && (!mentioned.length || /\b(?:na plataforma|no site)\b/.test(text))) {
    const destination: AssistantAction = options.profile
      ? { label: "Meu perfil", page: "profile" }
      : { label: "Cadastro", page: "register" };
    const registration = knowledgeReply([PLATFORM_KNOWLEDGE.find(item => item.id === "registration")!], options, cleanContext(options.context, options.courses));
    return { ...registration, text: options.profile ? "Você já tem um perfil neste navegador. Abra Meu perfil para consultar seus dados e inscrições." : registration.text, navigation: destination };
  }

  const wantsCourseInfo = /\b(?:informacoes|informacao|detalhes|ficha|sobre|conteudo)\b/.test(text);
  if (mentioned.length === 1 && (result.intent === "course-detail" || (wantsCourseInfo && result.intent === "course-search"))) {
    const details = dynamicCourse(text, mentioned[0], cleanContext(options.context, options.courses));
    return { ...details, navigation: courseActions(mentioned)[0] };
  }
  // Explicit requests to open other areas use only internal, supported pages.
  const wantsToOpen = /\b(?:quero|desejo|gostaria de|preciso) (?:ver|abrir|acessar|consultar|ir para|falar com)\b|\b(?:abra|acesse|mostre|me leve|leve me)\b/.test(text);
  if (wantsToOpen && !mentioned.length) {
    const destinations: [RegExp, Page][] = [
      [/\b(?:favoritos|cursos favoritados|cursos salvos)\b/, "favorites"],
      [/\b(?:meu perfil|minhas inscricoes|meus cursos inscritos)\b/, options.profile ? "profile" : "register"],
      [/\b(?:contato|atendimento|suporte)\b/, "contato"],
      [/\b(?:catalogo|cursos(?! inscritos| favoritos| favoritados| salvos))\b/, "cursos"],
      [/\bcategorias\b/, "categorias"],
      [/\b(?:inicio|pagina inicial)\b/, "home"],
      [/\b(?:sobre a plataforma|sobre o projeto)\b/, "sobre"],
    ];
    const matches = destinations.filter(([pattern]) => pattern.test(text));
    if (matches.length === 1) {
      const page = matches[0][1];
      // “Mostre cursos online” asks for matching options, not an unfiltered page.
      if (page === "cursos" && result.intent === "course-search" &&
        (extractPreferences(text).explicit || /\b(?:curso|cursos|formacao|formacoes) (?:de|sobre)\b/.test(text))) return result;
      const action = { label: PAGE_LABELS[page] ?? "Abrir página", page };
      return { ...reply(`Vou abrir ${action.label} para você.`, "navigation", result.context, [action]), navigation: action };
    }
  }
  return result;
}

export function getTortuguitaSuggestions(input: string, courses: Course[]): string[] {
  const text = normalizeTortuguitaText(input);
  if (!text) return QUICK_QUESTIONS.slice(0, 5);
  const mentions = findCourseMentions(text, courses);
  if (mentions.length) return mentions.slice(0, 2).flatMap(courseQuestions).slice(0, 5);
  if (text.length >= 3) {
    const partial = courses.filter(course => normalizeTortuguitaText(course.title).split(" ").some(word => word.startsWith(text)));
    if (partial.length) return partial.slice(0, 2).flatMap(courseQuestions).slice(0, 5);
  }
  const knowledge = rankedKnowledge(text);
  if (knowledge.length) return unique(knowledge.slice(0, 3).flatMap(({ item }) => [item.questions[0], ...item.followUps])).slice(0, 5);
  const words = meaningfulWords(text);
  if (text.length < 3) return [];
  return PLATFORM_KNOWLEDGE.flatMap(item => item.questions).filter(question => meaningfulWords(question).some(word => words.some(inputWord => word.startsWith(inputWord) || wordSimilarity(word, inputWord) >= 0.8))).slice(0, 5);
}
