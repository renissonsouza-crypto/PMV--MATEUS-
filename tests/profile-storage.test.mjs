import test from 'node:test';
import assert from 'node:assert/strict';

const originalFetch = globalThis.fetch;
test.after(() => { globalThis.fetch = originalFetch; });

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
      if (!options.ignoreWrites) values.set(key, value);
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

test('registration completion returns an available profile only after the server confirms its id', async () => {
  const { api, values } = await loadApi(null);
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, '/api/registrations');
    assert.equal(options.method, 'POST');
    assert.equal(JSON.parse(options.body).email, basicProfile.email);
    assert.equal(api.getUserProfile(), null, 'No profile can exist before server confirmation');
    return Response.json({ id: 12, message: 'Cadastro realizado' }, { status: 201 });
  };
  const profile = await api.createRegistrationProfile(basicProfile, 3);
  assert.equal(calls, 1);
  assert.equal(profile.id, 12);
  assert.deepEqual(profile.enrolledCourseIds, [], 'A course cannot be activated before email confirmation');
  assert.deepEqual(api.getUserProfile(), profile);
  assert.equal(JSON.parse(values.get(profileKey)).id, 12);
});

test('registration failures and malformed success responses never replace an existing profile', async () => {
  for (const response of [
    () => Response.json({ error: 'CPF ou e-mail já cadastrado' }, { status: 409 }),
    () => Response.json({ error: 'Servidor indisponível' }, { status: 503 }),
    () => Response.json({ id: '12' }, { status: 201 }),
    () => Response.json({}, { status: 201 }),
    () => new Response('<html>Missing API</html>'),
    () => { throw new TypeError('Network unavailable'); },
  ]) {
    const { api } = await loadApi(basicProfile);
    globalThis.fetch = async () => response();
    await assert.rejects(api.createRegistrationProfile({ ...basicProfile, nome: 'Novo perfil' }));
    assert.equal(api.getUserProfile().id, basicProfile.id);
    assert.equal(api.getUserProfile().nome, basicProfile.nome);
  }
});

test('silent storage failures retain the newly confirmed profile in the session with an explicit warning', async () => {
  for (const options of [{ ignoreWrites: true }, { denyWrites: true }, { denyReads: true }]) {
    const { api } = await loadApi(basicProfile, options);
    globalThis.fetch = async () => Response.json({ id: 15 }, { status: 201 });
    const profile = await api.createRegistrationProfile({ ...basicProfile, nome: 'Perfil confirmado' });
    assert.equal(profile.id, 15);
    assert.equal(api.getUserProfile().nome, 'Perfil confirmado');
    assert.equal(api.getUserProfile().id, 15);
    assert.equal(api.isProfileSessionOnly(), true);
  }
});

test('failure to activate a server-confirmed profile returns an explicit error instead of success', async () => {
  const { api } = await loadApi(null);
  globalThis.fetch = async () => Response.json({ id: 18 }, { status: 201 });
  const read = globalThis.localStorage.getItem;
  let reads = 0;
  globalThis.localStorage.getItem = key => key === profileKey && ++reads >= 3 ? null : read(key);
  await assert.rejects(api.createRegistrationProfile(basicProfile), /servidor recebeu seu cadastro.*não foi possível disponibilizar seu perfil/);
  assert.equal(api.getUserProfile(), null);
});
