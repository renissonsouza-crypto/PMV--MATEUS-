import type { Course } from "../models/Course.ts";
import type { AssistantAction, AssistantContext, AssistantReply } from "./tortuguita.ts";

export const MAX_CHAT_MESSAGES = 81;
export const MEMORY_KEY_PREFIX = "qualificavix-tortuguita-memory:";
export type ChatMessage = { id: number; role: "assistant" | "user"; text: string; actions?: AssistantAction[] };
export type CourseInterest = { courseId: number; questions: number; views: number; lastSeenAt: string };
export type AssistantMemory = {
  version: 1;
  profileId: number | null;
  messages: ChatMessage[];
  context: AssistantContext;
  interests: CourseInterest[];
  completedCourseIds: number[];
};

const sessionMemories = new Map<number, AssistantMemory>();
const sessionOnly = new Set<number>();
const pages = new Set(["home", "cursos", "course-detail", "sobre", "categorias", "contato", "register", "profile", "favorites", "enrollment-confirmation"]);
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isProfileId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;

export function emptyAssistantMemory(profileId: number | null): AssistantMemory {
  return { version: 1, profileId, messages: [], context: {}, interests: [], completedCourseIds: [] };
}

function ids(value: unknown, courses: Course[]): number[] {
  return Array.isArray(value) ? [...new Set(value.filter(id => courses.some(course => course.id === id)))] : [];
}

export function normalizeAssistantMemory(value: unknown, profileId: number | null, courses: Course[]): AssistantMemory {
  const empty = emptyAssistantMemory(profileId);
  if (!isObject(value) || value.version !== 1 || value.profileId !== profileId) return empty;
  const context = isObject(value.context) ? value.context : {};
  const preferences: NonNullable<AssistantContext["preferences"]> = {};
  if (isObject(context.preferences)) {
    const source = context.preferences;
    for (const key of ["category", "modality", "period", "level", "goal"] as const) {
      if (typeof source[key] === "string") preferences[key] = source[key].slice(0, 100);
    }
    for (const key of ["maxHours", "maxMonths"] as const) {
      if (typeof source[key] === "number" && Number.isFinite(source[key]) && source[key] > 0) preferences[key] = source[key];
    }
    if (typeof source.onlyAvailable === "boolean") preferences.onlyAvailable = source.onlyAvailable;
    for (const key of ["modalities", "levels", "excludedCategories", "excludedModalities", "excludedPeriods"] as const) {
      if (Array.isArray(source[key])) preferences[key] = source[key].filter((item): item is string => typeof item === "string").slice(0, 8).map(item => item.slice(0, 50));
    }
  }
  const messages: ChatMessage[] = [];
  for (const entry of Array.isArray(value.messages) ? value.messages.slice(-MAX_CHAT_MESSAGES) : []) {
    if (!isObject(entry) || !["user", "assistant"].includes(String(entry.role)) || typeof entry.text !== "string" || !entry.text.trim()) continue;
    const actions: AssistantAction[] = [];
    for (const action of entry.role === "assistant" && Array.isArray(entry.actions) ? entry.actions.slice(0, 6) : []) {
      if (!isObject(action) || typeof action.label !== "string") continue;
      if (courses.some(course => course.id === action.courseId)) actions.push({ label: action.label.slice(0, 150), courseId: action.courseId as number });
      else if (typeof action.page === "string" && pages.has(action.page) && !["course-detail", "enrollment-confirmation"].includes(action.page)) actions.push({ label: action.label.slice(0, 150), page: action.page as AssistantAction["page"] });
    }
    messages.push({ id: messages.length + 1, role: entry.role as ChatMessage["role"], text: entry.text.slice(0, entry.role === "user" ? 1000 : 12000), ...(actions.length ? { actions } : {}) });
  }
  const interests: CourseInterest[] = [];
  const count = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100000, Math.floor(value))) : 0;
  for (const entry of Array.isArray(value.interests) ? value.interests : []) {
    if (!isObject(entry) || !courses.some(course => course.id === entry.courseId) || interests.some(item => item.courseId === entry.courseId)) continue;
    interests.push({ courseId: entry.courseId as number, questions: count(entry.questions), views: count(entry.views), lastSeenAt: typeof entry.lastSeenAt === "string" && Number.isFinite(Date.parse(entry.lastSeenAt)) ? entry.lastSeenAt : "1970-01-01T00:00:00.000Z" });
  }
  return { ...empty, messages, interests, completedCourseIds: ids(value.completedCourseIds, courses), context: {
    courseIds: ids(context.courseIds, courses), candidateCourseIds: ids(context.candidateCourseIds, courses),
    ...(typeof context.lastIntent === "string" ? { lastIntent: context.lastIntent.slice(0, 80) } : {}),
    ...(context.dialogue === "area" || context.dialogue === "modality" ? { dialogue: context.dialogue } : {}),
    ...(Object.keys(preferences).length ? { preferences } : {}),
  } };
}

export function loadAssistantMemory(profileId: number | null, courses: Course[]): { memory: AssistantMemory; persistent: boolean } {
  if (!isProfileId(profileId)) return { memory: emptyAssistantMemory(null), persistent: false };
  if (sessionOnly.has(profileId)) return { memory: normalizeAssistantMemory(sessionMemories.get(profileId), profileId, courses), persistent: false };
  try {
    const raw = localStorage.getItem(`${MEMORY_KEY_PREFIX}${profileId}`);
    let parsed: unknown;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }
    const memory = normalizeAssistantMemory(parsed, profileId, courses);
    sessionMemories.set(profileId, memory);
    return { memory, persistent: true };
  } catch {
    return { memory: normalizeAssistantMemory(sessionMemories.get(profileId), profileId, courses), persistent: false };
  }
}

export function saveAssistantMemory(memory: AssistantMemory): boolean {
  if (!isProfileId(memory.profileId)) return false;
  sessionMemories.set(memory.profileId, memory);
  try {
    localStorage.setItem(`${MEMORY_KEY_PREFIX}${memory.profileId}`, JSON.stringify(memory));
    sessionOnly.delete(memory.profileId);
    return true;
  } catch {
    sessionOnly.add(memory.profileId);
    return false;
  }
}

export function clearAssistantMemory(profileId: number): boolean {
  const empty = emptyAssistantMemory(profileId);
  sessionMemories.set(profileId, empty);
  try {
    localStorage.removeItem(`${MEMORY_KEY_PREFIX}${profileId}`);
    sessionOnly.delete(profileId);
    return true;
  } catch {
    // Overwriting with an empty memory may still work when removal is denied.
    return saveAssistantMemory(empty);
  }
}

export function rememberCourse(memory: AssistantMemory, courseId: number, kind: "questions" | "views", now = new Date()): AssistantMemory {
  const previous = memory.interests.find(item => item.courseId === courseId) ?? { courseId, questions: 0, views: 0, lastSeenAt: now.toISOString() };
  const interest = { ...previous, [kind]: Math.min(previous[kind] + 1, 100000), lastSeenAt: now.toISOString() };
  return { ...memory, interests: [...memory.interests.filter(item => item.courseId !== courseId), interest] };
}

export function mostSoughtCourses(memory: AssistantMemory): CourseInterest[] {
  return [...memory.interests].sort((a, b) => (b.questions + b.views) - (a.questions + a.views) || b.lastSeenAt.localeCompare(a.lastSeenAt) || a.courseId - b.courseId);
}

export function rememberReply(memory: AssistantMemory, reply: AssistantReply): AssistantMemory {
  let next = { ...memory, context: reply.context };
  if (reply.intent === "course-detail" || reply.intent === "course-comparison") {
    for (const id of reply.context.courseIds ?? []) next = rememberCourse(next, id, "questions");
  }
  if (reply.completedCourseUpdate) {
    const { courseId, completed } = reply.completedCourseUpdate;
    next = { ...next, completedCourseIds: completed ? [...new Set([...next.completedCourseIds, courseId])] : next.completedCourseIds.filter(id => id !== courseId) };
  }
  return next;
}
