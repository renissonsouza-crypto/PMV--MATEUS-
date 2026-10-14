import test from 'node:test';
import assert from 'node:assert/strict';

const profileKey = 'qualificavix-profile';
const favoriteKey = 'qualificavix-favorite-courses';
const basicProfile = {
  id: 1, nome: 'Pessoa Teste', email: 'teste@example.com', telefone: '27999990000',
  cep: '29010000', bairro: 'Centro', rua: 'Rua Teste', numero: '1', escolaridade: '',
  enrolledCourseIds: [], enrollments: [],
};
let moduleIndex = 0;

async function loadApi(saved = basicProfile, options = {}) {
  const values = new Map(saved === null ? [] : [[profileKey, JSON.stringify(saved)]]);
  globalThis.localStorage = {
    getItem(key) {
      if (options.denyReads) throw new Error('Storage disabled');
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (options.denyWrites) throw new Error('Quota exceeded');
      values.set(key, value);
    },
    removeItem(key) {
      if (options.denyWrites) throw new Error('Storage disabled');
      values.delete(key);
    },
  };
  const api = await import(`../src/app/services/api.ts?test=${++moduleIndex}`);
  return { api, values };
}

test('readable profile remains available when storage writes exceed quota', async () => {
  const { api } = await loadApi(basicProfile, { denyWrites: true });
  assert.equal(api.getUserProfile()?.nome, basicProfile.nome);
  const updated = api.updateUserProfile({ nome: 'Nome atualizado' });
  assert.equal(updated.nome, 'Nome atualizado');
  assert.equal(api.getUserProfile()?.nome, 'Nome atualizado');
});

test('registration and enrollment remain usable during the session with storage disabled', async () => {
  const { api } = await loadApi(null, { denyReads: true, denyWrites: true });
  assert.equal(api.saveUserProfile(basicProfile, 2).id, 2);
  assert.deepEqual(api.enrollUserInCourse(1).enrolledCourseIds, [1]);
  assert.deepEqual(api.getUserProfile().enrolledCourseIds, [1]);
  assert.deepEqual(api.removeUserEnrollmentFromCourse(1).enrolledCourseIds, []);
  api.logoutUserProfile();
  assert.equal(api.getUserProfile(), null);
});

test('malformed stored profile values cannot reach React as objects', async () => {
  const { api } = await loadApi({ ...basicProfile, nome: { unexpected: true }, bairro: ['Centro'] });
  assert.equal(api.getUserProfile(), null);
});

test('legacy profiles migrate course ids and remove malformed enrollments', async () => {
  const { api } = await loadApi({
    ...basicProfile,
    enrolledCourseIds: [1, 1, '2', 0, -1, 1.5, null],
    enrollments: [null, {}, { courseId: 3, enrolledAt: '2026-01-01T12:00:00.000Z' },
      { courseId: 4, enrolledAt: 'invalid', unsubscribeDeadline: 'invalid' }],
  });
  const profile = api.getUserProfile();
  assert.deepEqual(profile.enrolledCourseIds, [3, 1]);
  assert.equal(profile.enrollments[0].unsubscribeDeadline, '2026-01-04T12:00:00.000Z');
  assert.deepEqual(api.getUserProfile(), profile);
});

test('malformed course-id collections do not erase a valid profile', async () => {
  const { api } = await loadApi({ ...basicProfile, enrolledCourseIds: {}, enrollments: 'invalid' });
  assert.equal(api.getUserProfile().id, 1);
  assert.deepEqual(api.getUserProfile().enrollments, []);
});

test('expired enrollment cannot be removed through the storage service', async () => {
  const { api } = await loadApi({
    ...basicProfile,
    enrolledCourseIds: [1],
    enrollments: [{ courseId: 1, enrolledAt: '2020-01-01T12:00:00.000Z' }],
  });
  const result = api.removeUserEnrollmentFromCourse(1);
  assert.equal(result.unsubscribeBlocked, true);
  assert.deepEqual(result.enrolledCourseIds, [1]);
});

test('logout does not restore an old persisted profile when removing storage fails', async () => {
  const { api } = await loadApi(basicProfile, { denyWrites: true });
  api.getUserProfile();
  api.logoutUserProfile();
  assert.equal(api.getUserProfile(), null);
  assert.deepEqual(api.getFavoriteCourseIds(), []);
});

test('favorites remain available in the session when persistence fails', async () => {
  const { api } = await loadApi(null, { denyWrites: true });
  assert.deepEqual(api.saveFavoriteCourseIds([1, 1, 2, 0]), [1, 2]);
  assert.deepEqual(api.getFavoriteCourseIds(), [1, 2]);
  assert.equal(globalThis.localStorage.getItem(favoriteKey), null);
});

test('canceling enrollment preserves the total monthly limit across profile reloads', async () => {
  const { api } = await loadApi(basicProfile);
  api.enrollUserInCourse(1);
  api.enrollUserInCourse(2);
  api.enrollUserInCourse(3);
  const canceled = api.removeUserEnrollmentFromCourse(1);
  assert.deepEqual(canceled.enrolledCourseIds, [3, 2]);
  assert.equal(canceled.enrollmentHistory.length, 3);
  const reloaded = api.getUserProfile();
  assert.equal(reloaded.enrollmentHistory.length, 3);
  assert.equal(api.enrollUserInCourse(4).enrollmentReason, 'monthly_limit');
  assert.equal(api.enrollUserInCourse(1).enrollmentReason, 'monthly_limit');
});

test('a canceled course can be enrolled again before reaching the monthly limit', async () => {
  const { api } = await loadApi(basicProfile);
  api.enrollUserInCourse(1);
  api.removeUserEnrollmentFromCourse(1);
  const reenrolled = api.enrollUserInCourse(1);
  assert.deepEqual(reenrolled.enrolledCourseIds, [1]);
  assert.equal(reenrolled.enrollmentHistory.length, 2);
});
