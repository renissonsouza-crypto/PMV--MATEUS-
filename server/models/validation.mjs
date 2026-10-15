// Regras de domínio compartilhadas pelos bancos local e de produção.
export const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);

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
  return { data: sanitized, age };
}

export function validateTestimonial(input) {
  const data = typeof input === "object" && input && !Array.isArray(input) ? input : {};
  const limits = { name: 120, role: 120, course: 160, quote: 500 };
  if (Object.entries(limits).some(([key, max]) => typeof data[key] !== "string" || data[key].trim().length > max) ||
      !["number", "string"].includes(typeof data.rating))
    return { error: "Dados do depoimento inválidos" };
  const parsed = {
    name: clean(data.name, 120), role: clean(data.role, 120), course: clean(data.course, 160),
    quote: clean(data.quote, 500), rating: Number(data.rating),
  };
  if (!parsed.name || !parsed.role || !parsed.course || !parsed.quote || !Number.isInteger(parsed.rating) || parsed.rating < 1 || parsed.rating > 5)
    return { error: "Dados do depoimento inválidos" };
  return { data: parsed };
}
