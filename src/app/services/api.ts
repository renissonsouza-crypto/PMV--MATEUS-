// Service layer: comunicação HTTP entre as views e os controllers da API.
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Falha na comunicação com o servidor");
  return payload as T;
}

export type StoredTestimonial = { id: number; name: string; role: string; course: string; quote: string; rating: number };
export const getTestimonials = () => request<StoredTestimonial[]>("/testimonials");
export const createTestimonial = (data: Omit<StoredTestimonial, "id">) =>
  request<StoredTestimonial>("/testimonials", { method: "POST", body: JSON.stringify(data) });
export const createRegistration = (data: Record<string, unknown>) =>
  request<{ id: number; message: string }>("/registrations", { method: "POST", body: JSON.stringify(data) });
