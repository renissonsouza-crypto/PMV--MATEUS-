// As datas do formulário e da API seguem o calendário UTC, sem depender do fuso do navegador.
export function getBirthDateAge(value: string, now = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return null;
  const birth = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime()) || birth.toISOString().slice(0, 10) !== value || birth > now) return null;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() ||
      (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

export function isValidBrazilianPhone(value: string): boolean {
  return typeof value === "string" && /^\d{10,11}$/.test(value.replace(/\D/g, ""));
}

export type VitoriaAddress = { bairro: string; rua: string };

export async function lookupVitoriaCep(value: string, fetcher: typeof fetch = fetch): Promise<VitoriaAddress> {
  const cepDigits = value.replace(/\D/g, "");
  if (!/^\d{8}$/.test(cepDigits)) throw new Error("CEP inválido");
  let response: Response;
  let data: Record<string, unknown>;
  try {
    response = await fetcher(`https://viacep.com.br/ws/${cepDigits}/json/`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("CEP service unavailable");
    data = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid CEP response");
  } catch {
    throw new Error("Não foi possível validar o CEP no momento. Tente novamente.");
  }
  if (data.erro || !data.localidade || !data.uf) throw new Error("CEP não encontrado. Verifique o valor informado.");
  const city = String(data.localidade).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  if (city !== "vitoria" || String(data.uf).trim().toUpperCase() !== "ES") {
    throw new Error("A plataforma aceita apenas CEPs da cidade de Vitória-ES.");
  }
  return {
    bairro: typeof data.bairro === "string" ? data.bairro.trim() : "",
    rua: typeof data.logradouro === "string" ? data.logradouro.trim() : "",
  };
}
