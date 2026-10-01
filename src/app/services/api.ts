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

import { getUnsubscribeDeadline, isEnrollmentAllowed, removeCourseEnrollment } from './enrollmentPolicy.js';

export type EnrolledCourse = {
  courseId: number;
  enrolledAt: string;
  unsubscribeDeadline: string;
};

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
  enrollments?: EnrolledCourse[];
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

function normalizeEnrollments(profile: Partial<UserProfile> | null | undefined): EnrolledCourse[] {
  const existing = Array.isArray(profile?.enrollments) ? profile.enrollments : [];
  const map = new Map<number, EnrolledCourse>();

  for (const entry of existing) {
    if (!entry || !Number.isFinite(entry.courseId)) continue;
    const enrolledAt = entry.enrolledAt || new Date().toISOString();
    map.set(entry.courseId, {
      courseId: entry.courseId,
      enrolledAt,
      unsubscribeDeadline: entry.unsubscribeDeadline || getUnsubscribeDeadline(enrolledAt) || new Date().toISOString(),
    });
  }

  for (const courseId of profile?.enrolledCourseIds ?? []) {
    if (!Number.isFinite(courseId)) continue;
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

export function getUserProfile(): UserProfile | null {
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved) as UserProfile;
    const normalized: UserProfile = {
      ...parsed,
      enrolledCourseIds: [...new Set(parsed.enrolledCourseIds ?? [])],
      enrollments: normalizeEnrollments(parsed),
    };

    localStorage.setItem(PROFILE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return null;
  }
}

export function saveUserProfile(data: Record<string, unknown>, id: number, courseId?: number) {
  const previous = getUserProfile();
  const existingEnrollments = normalizeEnrollments(previous);

  const nextEnrollments = courseId
    ? [
        ...existingEnrollments.filter(entry => entry.courseId !== courseId),
        {
          courseId,
          enrolledAt: new Date().toISOString(),
          unsubscribeDeadline: getUnsubscribeDeadline(new Date().toISOString()) || new Date().toISOString(),
        },
      ]
    : existingEnrollments;

  const enrolledCourseIds = [...new Set(nextEnrollments.map(entry => entry.courseId))];
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
    enrollments: nextEnrollments,
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

export function enrollUserInCourse(courseId: number) {
  const profile = getUserProfile();
  if (!profile) return null;

  const existingEnrollments = normalizeEnrollments(profile);
  const monthlyCheck = isEnrollmentAllowed(existingEnrollments, courseId, new Date());

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
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
  return nextProfile;
}

export function removeUserEnrollmentFromCourse(courseId: number) {
  const profile = getUserProfile();
  if (!profile) return null;

  const existingEnrollments = normalizeEnrollments(profile);
  const updatedEnrollments = removeCourseEnrollment(existingEnrollments, courseId);
  const nextProfile = {
    ...profile,
    enrolledCourseIds: [...new Set(updatedEnrollments.map(entry => entry.courseId))],
    enrollments: updatedEnrollments,
  };

  localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
  return nextProfile;
}

export function updateUserProfile(updates: Partial<UserProfile>) {
  const profile = getUserProfile();
  if (!profile) return null;
  const enrollments = normalizeEnrollments(profile);
  const updated: UserProfile = { ...profile, ...updates, id: profile.id, enrolledCourseIds: profile.enrolledCourseIds, enrollments };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
  return updated;
}

export function logoutUserProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(FAVORITES_KEY);
  } catch {
    // Logout should still work even if browser storage is unavailable.
  }
  return null;
}
