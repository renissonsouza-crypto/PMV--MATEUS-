// Regras de domínio compartilhadas pelos bancos local e de produção.
export const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);

export function ageFromBirthDate(value) {
  const birthDate = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  if (today.getUTCMonth() < birthDate.getUTCMonth() ||
      (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() < birthDate.getUTCDate())) age--;
  return age;
}

export function validateRegistration(input) {
  const data = typeof input === "object" && input ? input : {};
  const required = ["nome", "cpf", "email", "telefone", "dataNascimento", "bairro", "cep", "rua", "numero"];
  if (required.some(key => !clean(data[key]))) return { error: "Campos obrigatórios ausentes" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(data.email, 180))) return { error: "E-mail inválido" };
  if (!/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/.test(clean(data.cpf, 14))) return { error: "CPF inválido" };
  const age = ageFromBirthDate(clean(data.dataNascimento, 10));
  if (age === null) return { error: "Data de nascimento inválida" };
  if (age < 18) {
    const guardian = ["nomeResponsavel", "cpfResponsavel", "grauParentesco", "telefoneResponsavel"];
    if (guardian.some(key => !clean(data[key]))) return { error: "Responsável legal obrigatório para menores de 18 anos" };
    if (!/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/.test(clean(data.cpfResponsavel, 14)))
      return { error: "CPF do responsável inválido" };
  }
  const fields = [
    "nome", "cpf", "email", "telefone", "dataNascimento", "bairro", "cep", "rua", "numero",
    "complemento", "nomeResponsavel", "cpfResponsavel", "grauParentesco", "telefoneResponsavel",
  ];
  const sanitized = Object.fromEntries(fields.map(key => [key, clean(data[key], key === "email" ? 180 : 160)]));
  sanitized.email = sanitized.email.toLowerCase();
  sanitized.menorDeIdade = age < 18;
  return { data: sanitized, age };
}

export function validateTestimonial(input) {
  const data = typeof input === "object" && input ? input : {};
  const parsed = {
    name: clean(data.name, 120), role: clean(data.role, 120), course: clean(data.course, 160),
    quote: clean(data.quote, 500), rating: Number(data.rating),
  };
  if (!parsed.name || !parsed.role || !parsed.course || !parsed.quote || !Number.isInteger(parsed.rating) || parsed.rating < 1 || parsed.rating > 5)
    return { error: "Dados do depoimento inválidos" };
  return { data: parsed };
}
