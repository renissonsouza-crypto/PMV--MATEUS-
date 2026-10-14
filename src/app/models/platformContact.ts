export type ContactChannel = { label: string; value: string; href: string };

export const MUNICIPAL_PORTAL_URL = "https://www.vitoria.es.gov.br/";

export function getContactChannels(environment: Record<string, string | undefined>): ContactChannel[] {
  const channels: ContactChannel[] = [];
  const phone = environment.VITE_CONTACT_PHONE?.trim();
  const email = environment.VITE_CONTACT_EMAIL?.trim();
  if (phone && /^\+?[\d\s().-]+$/.test(phone) && phone.replace(/\D/g, "").length >= 10) {
    channels.push({ label: "Telefone", value: phone, href: `tel:${phone.replace(/[^\d+]/g, "")}` });
  }
  if (email && /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email)) {
    channels.push({ label: "E-mail", value: email, href: `mailto:${email}` });
  }
  channels.push({ label: "Atendimento", value: "Portal da Prefeitura de Vitória", href: MUNICIPAL_PORTAL_URL });
  return channels;
}
