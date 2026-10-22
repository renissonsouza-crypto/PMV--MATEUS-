import { policyReceipt, POLICY_VERSION } from "../../shared/policies.mjs";
import { COURSES } from "../../shared/courses.mjs";
// Regras de domínio compartilhadas pelos bancos local e de produção.
export const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);
export const isSafePublicName = value => {
  if (typeof value !== "string") return false;
  const text = value.trim();
  return text.length >= 1 && text.length <= 120 && /\p{L}/u.test(text) &&
    !/[<>\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u.test(text) &&
    !/(?:https?:\/\/|www\.|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/iu.test(text);
};

export async function validateVitoriaCep(value, fetcher = fetch) {
  const cep = clean(value, 12).replace(/\D/g, "");
  if (!/^\d{8}$/.test(cep)) return { valid: false, unavailable: false };

  try {
    const baseUrl = (process.env.VIA_CEP_BASE_URL || "https://viacep.com.br/ws").replace(/\/$/, "");
    const response = await fetcher(`${baseUrl}/${cep}/json/`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return { valid: false, unavailable: true };
    const address = await response.json();
    if (address.erro || !address.localidade || !address.uf) return { valid: false, unavailable: false };

    const city = String(address.localidade).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    return { valid: city === "vitoria" && String(address.uf).trim().toUpperCase() === "ES", unavailable: false };
  } catch {
    return { valid: false, unavailable: true };
  }
}

export function ageFromBirthDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const birthDate = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(birthDate.getTime()) || birthDate.toISOString().slice(0, 10) !== value || birthDate > new Date()) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  if (today.getUTCMonth() < birthDate.getUTCMonth() ||
      (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() < birthDate.getUTCDate())) age--;
  return age;
}

export function validateRegistration(input) {
  const data = typeof input === "object" && input && !Array.isArray(input) ? input : {};
  if (data.policyVersion !== undefined && data.policyVersion !== POLICY_VERSION) return { error: "Os termos foram atualizados. Recarregue a página, leia os termos e confirme novamente." };
  const limits = {
    nome: 120, cpf: 14, email: 180, telefone: 30, dataNascimento: 10, bairro: 120,
    cep: 9, rua: 160, numero: 160, complemento: 160, nomeResponsavel: 160,
    cpfResponsavel: 14, grauParentesco: 160, telefoneResponsavel: 30,
    sexo: 160, whatsapp: 30, escolaridade: 160, situacaoEmprego: 160,
    possuiDeficiencia: 160, tiposDeficiencia: 500, necessitaAdaptacao: 160,
    tiposAdaptacao: 500, rendaFamiliar: 160, numeroDependentes: 160, beneficioProgramaSocial: 160,
  };
  const consents = ["autorizaImagem", "autorizaDados", "aceitaTermos", "receberNotificacoes"];
  if (Object.keys(limits).some(key => data[key] != null && typeof data[key] !== "string"))
    return { error: "Dados do cadastro inválidos" };
  if (consents.some(key => data[key] !== undefined && typeof data[key] !== "boolean") ||
      (data.quaisBeneficios !== undefined && (!Array.isArray(data.quaisBeneficios) ||
        data.quaisBeneficios.some(value => typeof value !== "string" || value.trim().length > 160))))
    return { error: "Dados do cadastro inválidos" };
  const required = ["nome", "cpf", "email", "telefone", "dataNascimento", "bairro", "cep", "rua"];
  if (required.some(key => !clean(data[key]))) return { error: "Campos obrigatórios ausentes" };
  if (Object.entries(limits).some(([key, max]) => String(data[key] ?? "").trim().length > max))
    return { error: "Dados do cadastro excedem o tamanho permitido" };
  if (data.autorizaDados !== true || data.aceitaTermos !== true)
    return { error: "É necessário autorizar o uso dos dados e aceitar os termos" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) return { error: "E-mail inválido" };
  if (!/^(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})$/.test(data.cpf.trim())) return { error: "CPF inválido" };
  const validPhone = value => /^\d{10,11}$/.test(String(value ?? "").replace(/\D/g, ""));
  if (!validPhone(data.telefone)) return { error: "Telefone inválido: informe 10 ou 11 dígitos com DDD" };
  if (data.whatsapp?.trim() && !validPhone(data.whatsapp)) return { error: "WhatsApp inválido: informe 10 ou 11 dígitos com DDD" };
  if (!/^(?:\d{5}-\d{3}|\d{8})$/.test(data.cep.trim())) return { error: "CEP inválido" };
  const age = ageFromBirthDate(data.dataNascimento.trim());
  if (age === null) return { error: "Data de nascimento inválida" };
  if (age < 18) {
    const guardian = ["nomeResponsavel", "cpfResponsavel", "grauParentesco", "telefoneResponsavel"];
    if (guardian.some(key => !clean(data[key]))) return { error: "Responsável legal obrigatório para menores de 18 anos" };
    if (!/^(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})$/.test(data.cpfResponsavel.trim()))
      return { error: "CPF do responsável inválido" };
    if (!validPhone(data.telefoneResponsavel)) return { error: "Telefone do responsável inválido: informe 10 ou 11 dígitos com DDD" };
  }
  const sanitized = Object.fromEntries(Object.entries(limits).map(([key, max]) => [key, clean(data[key], max)]));
  sanitized.email = sanitized.email.toLowerCase();
  sanitized.cpf = sanitized.cpf.replace(/\D/g, "");
  sanitized.cpfResponsavel = sanitized.cpfResponsavel.replace(/\D/g, "");
  sanitized.cep = sanitized.cep.replace(/\D/g, "");
  for (const key of consents) if (data[key] !== undefined) sanitized[key] = data[key];
  if (data.quaisBeneficios !== undefined) sanitized.quaisBeneficios = data.quaisBeneficios.map(value => value.trim());
  sanitized.menorDeIdade = age < 18;
  // Only claim a versioned receipt when the form identifies the displayed version.
  // Legacy clients remain compatible, without inventing evidence of the text they saw.
  if (data.policyVersion === POLICY_VERSION) sanitized.policyReceipt = policyReceipt();
  return { data: sanitized, age };
}

export function validateTestimonial(input) {
  const data = typeof input === "object" && input && !Array.isArray(input) ? input : {};
  const allowedFields = new Set(["role", "courseId", "quote", "rating", "acceptedGuidelines", "website"]);
  if (Object.keys(data).some(key => !allowedFields.has(key)))
    return { error: "O depoimento contém campos que não são permitidos." };
  if (typeof data.website !== "string" || data.website.trim())
    return { error: "Não foi possível validar o envio do depoimento." };
  if (data.acceptedGuidelines !== true)
    return { error: "Confirme as regras de publicação antes de enviar o depoimento." };
  if (typeof data.role !== "string" || typeof data.quote !== "string" ||
      typeof data.rating !== "number" || !Number.isSafeInteger(data.courseId))
    return { error: "Dados do depoimento inválidos." };

  const course = COURSES.find(item => item.id === data.courseId);
  if (!course) return { error: "Selecione um curso disponível no catálogo." };

  const role = data.role.trim().replace(/\s+/gu, " ");
  const quote = data.quote.trim().replace(/\s+/gu, " ");
  if (role.length < 2 || role.length > 80 || quote.length < 30 || quote.length > 500 ||
      !Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5)
    return { error: "Informe sua ocupação, uma experiência com pelo menos 30 caracteres e uma nota de 1 a 5." };

  const hiddenCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;
  const markupOrCode = /<\s*\/?\s*[a-z][^>]*>|\bon[a-z]+\s*=|javascript\s*:|\]\s*\(\s*(?:javascript|data)\s*:|\b(?:drop\s+table|delete\s+from|insert\s+into|alter\s+table|truncate\s+table)\b|--/iu;
  const publicContact = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b(?:https?:\/\/|www\.)\S+|\b[A-Z0-9-]{2,}\.(?:com(?:\.br)?|org\.br|br)(?:\/\S*)?\b|@\w{2,}|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|(?:\(?\d{2}\)?[\s.-]*)?(?:9[\s.-]*)?\d{4}[\s.-]*\d{4}\b/iu;
  const abusiveContent = /\b(?:caralho|porra|merda|foda-se|idiota|imbecil|vou\s+(?:matar|agredir)|discurso\s+de\s+odio)\b/iu;
  const gibberish = /\b(?:asdf|qwer|zxcv|hjkl)\b/iu;
  const repeatedCharacter = /(.)\1{7,}/u;
  const repeatedWord = /\b([\p{L}\p{N}]{2,})\b(?:[\s,;.!?-]+\1\b){3,}/iu;
  if ([role, quote].some(value => hiddenCharacters.test(value) || markupOrCode.test(value) || publicContact.test(value) || abusiveContent.test(value)))
    return { error: "Remova links, contatos pessoais, códigos ou conteúdo ofensivo antes de publicar." };
  if (gibberish.test(quote) || repeatedCharacter.test(quote) || repeatedWord.test(quote))
    return { error: "Escreva um relato claro, sem texto repetitivo ou aleatório." };
  if (!/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}\s.'’/&()+-]*$/u.test(role))
    return { error: "Informe a profissão ou situação atual usando texto simples." };

  const words = quote.toLocaleLowerCase("pt-BR").match(/[\p{L}\p{N}]+/gu) ?? [];
  const meaningfulWords = words.filter(word => word.length > 2);
  const uniqueWords = new Set(meaningfulWords);
  const courseTerms = `${course.title} ${course.category} ${course.whatYouLearn.join(" ")}`
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9]+/g) ?? [];
  const normalizedQuote = quote.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const experienceTerms = [
    "curso", "aula", "aprendi", "aprendizado", "conteudo", "atividade", "exercicio", "pratica",
    "professor", "formacao", "conhecimento", "habilidade", "trabalho", "emprego", "carreira",
    "oportunidade", "ajudou", "melhorei", "recomendo", "gostei", "dificuldade", "util", "estudo",
  ];
  const relevant = [...experienceTerms, ...courseTerms.filter(term => term.length > 3)]
    .some(term => new RegExp(`\\b${term}\\b`, "u").test(normalizedQuote));
  if (meaningfulWords.length < 6 || uniqueWords.size < 5 || !relevant)
    return { error: "Conte de forma clara como o curso contribuiu para sua experiência." };

  return { data: { role, courseId: course.id, course: course.title, quote, rating: data.rating } };
}
