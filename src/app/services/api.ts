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

export type UserProfile = {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  whatsapp?: string;
  cep: string;
  bairro: string;
  rua: string;
  numero: string;
  complemento?: string;
  escolaridade: string;
  situacaoEmprego?: string;
  fotoPerfil?: string;
  enrolledCourseIds: number[];
};

const PROFILE_KEY = "qualificavix-profile";
const FAVORITES_KEY = "qualificavix-favorite-courses";

export function getFavoriteCourseIds(): number[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return [...new Set(saved.filter((id): id is number => Number.isSafeInteger(id) && id > 0))];
  } catch {
    return [];
  }
}

export function saveFavoriteCourseIds(courseIds: number[]) {
  const validIds = [...new Set(courseIds.filter(id => Number.isSafeInteger(id) && id > 0))];
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(validIds));
  } catch {
    // Favorites remain usable for the current session if browser storage is unavailable.
  }
  return validIds;
}

export function getUserProfile(): UserProfile | null {
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    return saved ? JSON.parse(saved) as UserProfile : null;
  } catch {
    return null;
  }
}

export function saveUserProfile(data: Record<string, unknown>, id: number, courseId?: number) {
  const previous = getUserProfile();
  const enrolledCourseIds = [...new Set([
    ...(previous?.enrolledCourseIds ?? []),
    ...(courseId ? [courseId] : []),
  ])];
  const profile: UserProfile = {
    id,
    nome: String(data.nome ?? ""),
    email: String(data.email ?? ""),
    telefone: String(data.telefone ?? ""),
    whatsapp: String(data.whatsapp ?? ""),
    cep: String(data.cep ?? ""),
    bairro: String(data.bairro ?? ""),
    rua: String(data.rua ?? ""),
    numero: String(data.numero ?? ""),
    complemento: String(data.complemento ?? ""),
    escolaridade: String(data.escolaridade ?? ""),
    situacaoEmprego: String(data.situacaoEmprego ?? ""),
    fotoPerfil: previous?.fotoPerfil,
    enrolledCourseIds,
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

export function enrollUserInCourse(courseId: number) {
  const profile = getUserProfile();
  if (!profile) return null;
  if (!profile.enrolledCourseIds.includes(courseId)) {
    profile.enrolledCourseIds = [...profile.enrolledCourseIds, courseId];
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }
  return profile;
}

export function updateUserProfile(updates: Partial<UserProfile>) {
  const profile = getUserProfile();
  if (!profile) return null;
  const updated = { ...profile, ...updates, id: profile.id, enrolledCourseIds: profile.enrolledCourseIds };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
  return updated;
}
