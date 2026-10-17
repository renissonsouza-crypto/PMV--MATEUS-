// Service layer: comunicação HTTP entre as views e os controllers da API.
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, 15000);
  options?.signal?.addEventListener("abort", abort, { once: true });
  if (options?.signal?.aborted) abort();
  try {
    let response: Response;
    try {
      response = await fetch(`/api${path}`, {
        ...options,
        signal: controller.signal,
        headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
      });
    } catch {
      throw new Error("Não foi possível acessar o servidor. Verifique a conexão e se o projeto está em execução.");
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "Falha na comunicação com o servidor");
    if (payload === null) throw new Error("O servidor retornou uma resposta inválida. Verifique se a API está em execução.");
    return payload as T;
  } finally {
    clearTimeout(timeout);
    options?.signal?.removeEventListener("abort", abort);
  }
}

export type StoredTestimonial = { id: number; name: string; role: string; course: string; quote: string; rating: number };
function isTestimonial(value: unknown): value is StoredTestimonial {
  if (!value || typeof value !== "object") return false;
  const entry = value as StoredTestimonial;
  return isCourseId(entry.id) && [entry.name, entry.role, entry.course, entry.quote].every(text => typeof text === "string")
    && Number.isInteger(entry.rating) && entry.rating >= 1 && entry.rating <= 5;
}
export const getTestimonials = async () => {
  const data = await request<unknown>("/testimonials");
  if (!Array.isArray(data) || !data.every(isTestimonial)) throw new Error("Resposta de depoimentos inválida");
  return data;
};
export const createTestimonial = async (data: Omit<StoredTestimonial, "id">) => {
  const result = await request<unknown>("/testimonials", { method: "POST", body: JSON.stringify(data) });
  if (!isTestimonial(result)) throw new Error("Resposta de depoimento inválida");
  return result;
};
export const createRegistration = async (data: Record<string, unknown>) => {
  const result = await request<{ id: number; message: string; profileToken?: string }>("/registrations", { method: "POST", body: JSON.stringify(data) });
  if (!isCourseId(result.id)) throw new Error("Resposta de cadastro inválida");
  return result;
};

import { canUnsubscribeFromCourse, getUnsubscribeDeadline, isEnrollmentAllowed, removeCourseEnrollment } from './enrollmentPolicy.js';

export type EnrolledCourse = {
  courseId: number;
  enrolledAt: string;
  unsubscribeDeadline: string;
  requestId?: string;
};
export type PendingEnrollment = { requestId: string; statusToken: string; courseId: number; email: string; expiresAt: string };

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
  profileToken?: string;
  pendingEnrollments?: PendingEnrollment[];
  enrolledCourseIds: number[];
  enrollments?: EnrolledCourse[];
  enrollmentHistory?: Pick<EnrolledCourse, "courseId" | "enrolledAt">[];
};

const PROFILE_KEY = "qualificavix-profile";
const FAVORITES_KEY = "qualificavix-favorite-courses";
let cachedProfile: UserProfile | null = null;
let profileSessionOnly = false;
let useSessionProfile = false;
let cachedFavorites: number[] = [];
let favoritesSessionOnly = false;

export const isProfileSessionOnly = () => profileSessionOnly;
export const isFavoritesSessionOnly = () => favoritesSessionOnly;

const isCourseId = (id: unknown): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0;
const profileText = (value: unknown) => typeof value === "string" ? value.trim() : "";

function persistProfile(profile: UserProfile): UserProfile {
  cachedProfile = profile;
  try {
    const serialized = JSON.stringify(profile);
    localStorage.setItem(PROFILE_KEY, serialized);
    if (localStorage.getItem(PROFILE_KEY) !== serialized) throw new Error("Profile storage could not be verified");
    useSessionProfile = false;
    profileSessionOnly = false;
  } catch {
    // A API pode ter concluído o cadastro mesmo quando o navegador nega armazenamento.
    useSessionProfile = true;
    profileSessionOnly = true;
  }
  return profile;
}

export function getFavoriteCourseIds(): number[] {
  if (favoritesSessionOnly) return [...cachedFavorites];
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]");
    cachedFavorites = Array.isArray(saved) ? [...new Set(saved.filter(isCourseId))] : [];
    return [...cachedFavorites];
  } catch {
    return [...cachedFavorites];
  }
}

export function saveFavoriteCourseIds(courseIds: number[]) {
  const validIds = [...new Set(courseIds.filter(isCourseId))];
  cachedFavorites = validIds;
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(validIds));
    favoritesSessionOnly = false;
  } catch {
    favoritesSessionOnly = true;
  }
  return validIds;
}

function normalizeEnrollments(profile: Partial<UserProfile> | null | undefined): EnrolledCourse[] {
  const existing = Array.isArray(profile?.enrollments) ? profile.enrollments : [];
  const map = new Map<number, EnrolledCourse>();

  for (const entry of existing) {
    if (!entry || !isCourseId(entry.courseId) || typeof entry.enrolledAt !== "string") continue;
    const date = new Date(entry.enrolledAt);
    if (Number.isNaN(date.getTime())) continue;
    const enrolledAt = date.toISOString();
    map.set(entry.courseId, {
      courseId: entry.courseId,
      enrolledAt,
      unsubscribeDeadline: getUnsubscribeDeadline(enrolledAt)!,
      ...(typeof entry.requestId === "string" ? { requestId: entry.requestId } : {}),
    });
  }

  const legacyIds = Array.isArray(profile?.enrolledCourseIds) ? profile.enrolledCourseIds : [];
  for (const courseId of legacyIds) {
    if (!isCourseId(courseId)) continue;
    if (map.has(courseId)) continue;
    const enrolledAt = new Date().toISOString();
    map.set(courseId, {
      courseId,
      enrolledAt,
      unsubscribeDeadline: getUnsubscribeDeadline(enrolledAt) || enrolledAt,
    });
  }

  return [...map.values()].sort((a, b) => b.courseId - a.courseId);
}

function normalizeEnrollmentHistory(profile: Partial<UserProfile> | null, enrollments: EnrolledCourse[]) {
  const history: Pick<EnrolledCourse, "courseId" | "enrolledAt">[] = [];
  for (const entry of Array.isArray(profile?.enrollmentHistory) ? profile.enrollmentHistory : []) {
    if (!entry || !isCourseId(entry.courseId) || typeof entry.enrolledAt !== "string") continue;
    const date = new Date(entry.enrolledAt);
    if (!Number.isNaN(date.getTime())) history.push({ courseId: entry.courseId, enrolledAt: date.toISOString() });
  }
  for (const enrollment of enrollments) {
    if (!history.some(entry => entry.courseId === enrollment.courseId && entry.enrolledAt === enrollment.enrolledAt)) {
      history.push({ courseId: enrollment.courseId, enrolledAt: enrollment.enrolledAt });
    }
  }
  return history;
}

export function getUserProfile(): UserProfile | null {
  if (useSessionProfile) return cachedProfile;
  let saved: string | null;
  try {
    saved = localStorage.getItem(PROFILE_KEY);
  } catch {
    return cachedProfile;
  }
  if (!saved) {
    cachedProfile = null;
    return null;
  }
  try {
    const parsed = JSON.parse(saved);
    if (!parsed || Array.isArray(parsed) || !isCourseId(parsed.id) ||
        typeof parsed.nome !== "string" || !parsed.nome.trim() || typeof parsed.email !== "string") {
      cachedProfile = null;
      return null;
    }
    const enrollments = normalizeEnrollments(parsed);
    const normalized: UserProfile = {
      id: parsed.id,
      nome: parsed.nome.trim(),
      email: profileText(parsed.email),
      telefone: profileText(parsed.telefone),
      whatsapp: profileText(parsed.whatsapp),
      cep: profileText(parsed.cep),
      bairro: profileText(parsed.bairro),
      rua: profileText(parsed.rua),
      numero: profileText(parsed.numero),
      complemento: profileText(parsed.complemento),
      escolaridade: profileText(parsed.escolaridade),
      situacaoEmprego: profileText(parsed.situacaoEmprego),
      fotoPerfil: typeof parsed.fotoPerfil === "string" ? parsed.fotoPerfil : undefined,
      profileToken: typeof parsed.profileToken === "string" && /^[a-f0-9]{64}$/.test(parsed.profileToken) ? parsed.profileToken : undefined,
      pendingEnrollments: Array.isArray(parsed.pendingEnrollments) ? parsed.pendingEnrollments.filter((item: PendingEnrollment) => item && isCourseId(item.courseId) && typeof item.requestId === "string" && typeof item.statusToken === "string" && /^[a-f0-9]{64}$/.test(item.statusToken) && typeof item.email === "string" && typeof item.expiresAt === "string") : [],
      enrolledCourseIds: enrollments.map(entry => entry.courseId),
      enrollments,
      enrollmentHistory: normalizeEnrollmentHistory(parsed, enrollments),
    };
    cachedProfile = normalized;
    if (JSON.stringify(normalized) !== saved) persistProfile(normalized);
    return normalized;
  } catch {
    cachedProfile = null;
    return null;
  }
}

export function saveUserProfile(data: Record<string, unknown>, id: number, courseId?: number) {
  if (!isCourseId(id) || !profileText(data.nome) || !profileText(data.email)) throw new Error("Dados do perfil inválidos");
  const previous = getUserProfile();
  const sameProfile = previous?.id === id ? previous : null;
  const existingEnrollments = normalizeEnrollments(sameProfile);
  const enrolledAt = new Date().toISOString();

  const nextEnrollments = isCourseId(courseId)
    ? [
        ...existingEnrollments.filter(entry => entry.courseId !== courseId),
        {
          courseId,
          enrolledAt,
          unsubscribeDeadline: getUnsubscribeDeadline(enrolledAt)!,
        },
      ]
    : existingEnrollments;

  const enrolledCourseIds = [...new Set(nextEnrollments.map(entry => entry.courseId))];
  const profile: UserProfile = {
    id,
    nome: profileText(data.nome),
    email: profileText(data.email).toLowerCase(),
    telefone: profileText(data.telefone),
    whatsapp: profileText(data.whatsapp),
    cep: profileText(data.cep),
    bairro: profileText(data.bairro),
    rua: profileText(data.rua),
    numero: profileText(data.numero),
    complemento: profileText(data.complemento),
    escolaridade: profileText(data.escolaridade),
    situacaoEmprego: profileText(data.situacaoEmprego),
    fotoPerfil: sameProfile?.fotoPerfil,
    profileToken: typeof data.profileToken === "string" && /^[a-f0-9]{64}$/.test(data.profileToken) ? data.profileToken : sameProfile?.profileToken,
    pendingEnrollments: sameProfile?.pendingEnrollments ?? [],
    enrolledCourseIds,
    enrollments: nextEnrollments,
    enrollmentHistory: normalizeEnrollmentHistory(sameProfile, nextEnrollments),
  };
  return persistProfile(profile);
}

// A successful HTTP response alone is not enough: the profile must be usable.
export async function createRegistrationProfile(data: Record<string, unknown>, courseId?: number): Promise<UserProfile> {
  const result = await createRegistration(data);
  const saved = saveUserProfile({ ...data, profileToken: result.profileToken }, result.id);
  const available = getUserProfile();
  if (!available || available.id !== saved.id || available.email !== saved.email) {
    throw new Error("O servidor recebeu seu cadastro, mas não foi possível disponibilizar seu perfil. Tente acessar Meu perfil ou entre em contato com o atendimento.");
  }
  return available;
}

export function enrollUserInCourse(courseId: number) {
  const profile = getUserProfile();
  if (!profile) return null;
  if (!isCourseId(courseId)) return profile;

  const existingEnrollments = normalizeEnrollments(profile);
  const history = normalizeEnrollmentHistory(profile, existingEnrollments);
  const monthlyCheck = isEnrollmentAllowed(existingEnrollments, courseId, new Date(), history);

  if (monthlyCheck.reason === 'duplicate') {
    return profile;
  }

  if (!monthlyCheck.allowed) {
    return { ...profile, enrollmentLimitReached: true, enrollmentReason: monthlyCheck.reason } as UserProfile & {
      enrollmentLimitReached: boolean;
      enrollmentReason: string;
    };
  }

  const enrolledAt = new Date().toISOString();
  const nextProfile = {
    ...profile,
    enrolledCourseIds: [...new Set([...profile.enrolledCourseIds, courseId])],
    enrollments: [
      ...existingEnrollments,
      {
        courseId,
        enrolledAt,
        unsubscribeDeadline: getUnsubscribeDeadline(enrolledAt) || enrolledAt,
      },
    ],
    enrollmentHistory: [...history, { courseId, enrolledAt }],
  };
  return persistProfile(nextProfile);
}

export function removeUserEnrollmentFromCourse(courseId: number) {
  const profile = getUserProfile();
  if (!profile) return null;

  const existingEnrollments = normalizeEnrollments(profile);
  const enrollment = existingEnrollments.find(entry => entry.courseId === courseId);
  if (!enrollment || !canUnsubscribeFromCourse(enrollment)) {
    return { ...profile, unsubscribeBlocked: true as const };
  }
  const updatedEnrollments = removeCourseEnrollment(existingEnrollments, courseId);
  const nextProfile = {
    ...profile,
    enrolledCourseIds: [...new Set(updatedEnrollments.map(entry => entry.courseId))],
    enrollments: updatedEnrollments,
  };

  return persistProfile(nextProfile);
}

export function updateUserProfile(updates: Partial<UserProfile>) {
  const profile = getUserProfile();
  if (!profile) return null;
  const enrollments = normalizeEnrollments(profile);
  const updated: UserProfile = {
    ...profile, ...updates, id: profile.id, enrolledCourseIds: profile.enrolledCourseIds, enrollments,
    enrollmentHistory: normalizeEnrollmentHistory(profile, enrollments),
  };
  return persistProfile(updated);
}

export function logoutUserProfile() {
  const token = getUserProfile()?.profileToken;
  void request("/auth?action=logout", { method: "POST", headers: { "x-profile-token": token ?? "" }, body: "{}" }).catch(() => { /* Local sign-out still works offline; server session expires independently. */ });
  cachedProfile = null;
  cachedFavorites = [];
  profileSessionOnly = false;
  useSessionProfile = true;
  favoritesSessionOnly = true;
  try {
    localStorage.removeItem(PROFILE_KEY);
    useSessionProfile = false;
  } catch { /* Não restaurar o perfil antigo se a remoção for negada. */ }
  try {
    localStorage.removeItem(FAVORITES_KEY);
    favoritesSessionOnly = false;
  } catch { /* Favoritos também são limpos para esta sessão. */ }
  return null;
}


type EnrollmentResult = { status: string; registrationId: number; courseId: number; requestId: string; enrolledAt: string | null };
function applyConfirmedEnrollment(result: EnrollmentResult) {
  const profile = getUserProfile();
  if (!profile || profile.id !== result.registrationId || !isCourseId(result.courseId) || typeof result.requestId !== "string" || !result.enrolledAt || Number.isNaN(Date.parse(result.enrolledAt))) throw new Error("Resposta de confirmação inválida.");
  const enrolledAt = new Date(result.enrolledAt).toISOString();
  const enrollment = { courseId: result.courseId, enrolledAt, unsubscribeDeadline: getUnsubscribeDeadline(enrolledAt)!, requestId: result.requestId };
  const enrollments = [...normalizeEnrollments(profile).filter(item => item.courseId !== result.courseId), enrollment];
  const next = {
    ...profile, enrollments, enrolledCourseIds: enrollments.map(item => item.courseId),
    pendingEnrollments: (profile.pendingEnrollments ?? []).filter(item => item.courseId !== result.courseId),
    enrollmentHistory: normalizeEnrollmentHistory(profile, enrollments),
  };
  return persistProfile(next);
}

export async function enrollDirectly(courseId: number) {
  const profile = getUserProfile();
  if (!profile) throw new Error("Faça seu cadastro antes de se inscrever.");
  if (!profile.profileToken) throw new Error("Sua sessão antiga não permite novas inscrições. Entre novamente com Google para recuperar o acesso ao cadastro.");
  const result = await request<EnrollmentResult>("/enrollments", { method: "POST", headers: { "x-profile-token": profile.profileToken }, body: JSON.stringify({ action: "enroll", registrationId: profile.id, courseId }) });
  if (result.status !== "confirmed" || result.courseId !== courseId || result.registrationId !== profile.id) throw new Error("Não foi possível confirmar a inscrição. Tente novamente.");
  return applyConfirmedEnrollment(result);
}

export async function cancelConfirmedEnrollment(courseId: number) {
  const profile = getUserProfile();
  const enrollment = profile?.enrollments?.find(item => item.courseId === courseId);
  if (enrollment?.requestId) {
    const result = await request<EnrollmentResult>("/enrollments", { method: "POST", headers: { "x-profile-token": profile?.profileToken ?? "" }, body: JSON.stringify({ action: "cancel", requestId: enrollment.requestId }) });
    if (result.status !== "cancelled") throw new Error("Não foi possível confirmar o cancelamento.");
  }
  return removeUserEnrollmentFromCourse(courseId);
}


export async function restoreGoogleProfile(): Promise<UserProfile> {
  const result = await request<{ profile: UserProfile }>("/auth?action=session");
  const incoming = result.profile;
  if (!incoming || !Number.isSafeInteger(incoming.id) || typeof incoming.profileToken !== "string" || !/^[a-f0-9]{64}$/.test(incoming.profileToken)) throw new Error("Não foi possível recuperar o perfil com segurança.");
  const saved = saveUserProfile(incoming as unknown as Record<string, unknown>, incoming.id);
  const enrollments = normalizeEnrollments(incoming);
  return persistProfile({ ...saved, enrollments, enrolledCourseIds: enrollments.map(entry => entry.courseId), enrollmentHistory: normalizeEnrollmentHistory(incoming, enrollments) });
}
