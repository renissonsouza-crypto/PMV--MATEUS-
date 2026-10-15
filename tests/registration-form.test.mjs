import test from 'node:test';
import assert from 'node:assert/strict';
import { getBirthDateAge, isValidBrazilianPhone, lookupVitoriaCep } from '../src/app/services/registrationValidation.ts';
import { canUnsubscribeFromCourse } from '../src/app/services/enrollmentPolicy.js';

test('age switches at the eighteenth birthday consistently with the API calendar', () => {
  const birth = '2008-10-14';
  assert.equal(getBirthDateAge(birth, new Date('2026-10-13T23:59:59.000Z')), 17);
  assert.equal(getBirthDateAge(birth, new Date('2026-10-14T00:00:00.000Z')), 18);
});

test('birth dates reject impossible, future and incorrectly formatted values', () => {
  const now = new Date('2026-10-14T12:00:00.000Z');
  for (const value of ['', '2026-02-30', '2025-02-29', '2026-13-01', '2027-01-01', '14/10/2000']) {
    assert.equal(getBirthDateAge(value, now), null, value);
  }
  assert.equal(getBirthDateAge('2000-02-29', now), 26);
});

test('registration and profile share the Brazilian phone length requirement including DDD', () => {
  for (const value of ['', ' ', 'x', '99999-0000', '279999900001']) assert.equal(isValidBrazilianPhone(value), false, value);
  for (const value of ['2733330000', '(27) 99999-0000']) assert.equal(isValidBrazilianPhone(value), true, value);
});

test('Vitória CEP lookup validates destination, HTTP status and response shape', async () => {
  let requestedUrl;
  const result = await lookupVitoriaCep('29010-000', async (url, options) => {
    requestedUrl = url;
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ localidade: 'Vitória', uf: 'ES', bairro: ' Centro ', logradouro: ' Rua Teste ' });
  });
  assert.equal(requestedUrl, 'https://viacep.com.br/ws/29010000/json/');
  assert.deepEqual(result, { bairro: 'Centro', rua: 'Rua Teste' });
  await assert.rejects(lookupVitoriaCep('123', () => { throw new Error('Must not call'); }), /CEP inválido/);
  await assert.rejects(lookupVitoriaCep('29010000', async () => Response.json({ localidade: 'Vila Velha', uf: 'ES' })), /apenas CEPs/);
  await assert.rejects(lookupVitoriaCep('29010000', async () => Response.json({ erro: true })), /não encontrado/);
  await assert.rejects(lookupVitoriaCep('29010000', async () => Response.json({}, { status: 503 })), /Não foi possível/);
  await assert.rejects(lookupVitoriaCep('29010000', async () => Response.json(null)), /Não foi possível/);
});

test('cancellation permits only the three-day window and valid past enrollment dates', () => {
  const enrollment = { enrolledAt: '2026-10-01T12:00:00.000Z' };
  assert.equal(canUnsubscribeFromCourse(enrollment, new Date('2026-10-04T12:00:00.000Z')), true);
  assert.equal(canUnsubscribeFromCourse(enrollment, new Date('2026-10-04T12:00:00.001Z')), false);
  assert.equal(canUnsubscribeFromCourse(enrollment, new Date('2026-09-30T12:00:00.000Z')), false);
  assert.equal(canUnsubscribeFromCourse(undefined), false);
  assert.equal(canUnsubscribeFromCourse({ enrolledAt: 'invalid' }), false);
});

test('birth date accepts numeric typing and pasted ISO dates while preserving API format', async () => {
  const { formatBirthDateInput, birthDateToISO } = await import('../src/app/services/registrationValidation.ts');
  assert.equal(formatBirthDateInput('25081990'), '25/08/1990');
  assert.equal(formatBirthDateInput('1990-08-25'), '25/08/1990');
  assert.equal(birthDateToISO('25/08/1990'), '1990-08-25');
  assert.equal(birthDateToISO('25/08/'), '');
  assert.equal(getBirthDateAge(birthDateToISO('31/02/2000')), null);
});
