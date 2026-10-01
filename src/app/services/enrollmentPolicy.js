export const DEFAULT_UNSUBSCRIBE_DAYS = 3;

export function getMonthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function countEnrollmentsInCurrentMonth(enrollments = [], now = new Date()) {
  const monthKey = getMonthKey(now);
  if (!monthKey || !Array.isArray(enrollments)) return 0;

  return enrollments.filter(({ enrolledAt }) => {
    if (!enrolledAt) return false;
    return getMonthKey(enrolledAt) === monthKey;
  }).length;
}

export function isEnrollmentAllowed(enrollments = [], courseId, now = new Date()) {
  const targetCourseId = Number(courseId);
  const duplicate = Array.isArray(enrollments)
    && enrollments.some(({ courseId: enrolledCourseId }) => Number(enrolledCourseId) === targetCourseId);

  if (duplicate) {
    return { allowed: false, reason: 'duplicate' };
  }

  if (countEnrollmentsInCurrentMonth(enrollments, now) >= 3) {
    return { allowed: false, reason: 'monthly_limit' };
  }

  return { allowed: true, reason: 'ok' };
}

export function removeCourseEnrollment(enrollments = [], courseId) {
  const targetCourseId = Number(courseId);
  if (!Number.isFinite(targetCourseId)) return Array.isArray(enrollments) ? [...enrollments] : [];
  return (Array.isArray(enrollments) ? enrollments : []).filter(
    ({ courseId: enrolledCourseId }) => Number(enrolledCourseId) !== targetCourseId,
  );
}

export function getUnsubscribeDeadline(enrolledAt, days = DEFAULT_UNSUBSCRIBE_DAYS) {
  if (!enrolledAt) return null;

  const date = new Date(enrolledAt);
  if (Number.isNaN(date.getTime())) return null;

  const deadline = new Date(date.getTime());
  deadline.setUTCDate(deadline.getUTCDate() + days);
  return deadline.toISOString();
}

export function formatDateBR(value) {
  if (!value) return 'Não informado';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não informado';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}
