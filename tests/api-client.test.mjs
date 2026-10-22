import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistration, createTestimonial, getTestimonials } from '../src/app/services/api.ts';

const originalFetch = globalThis.fetch;
test.after(() => { globalThis.fetch = originalFetch; });

test('unexpected HTML from a missing API produces a useful error instead of fake success', async () => {
  globalThis.fetch = async () => new Response('<!doctype html><html></html>', { status: 200 });
  await assert.rejects(createRegistration({}), /resposta inválida/);
});

test('successful HTTP with a malformed registration id cannot create a local profile', async () => {
  for (const id of [undefined, '1', 0, -1, 1.5]) {
    globalThis.fetch = async () => Response.json({ id });
    await assert.rejects(createRegistration({}), /cadastro inválida/);
  }
});

test('network failure and server validation remain actionable', async () => {
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(createRegistration({}), /acessar o servidor/);
  globalThis.fetch = async () => Response.json({ error: 'CPF ou e-mail já cadastrado' }, { status: 409 });
  await assert.rejects(createRegistration({}), /CPF ou e-mail já cadastrado/);
});

test('testimonial response shapes cannot send malformed objects to the view', async () => {
  globalThis.fetch = async () => Response.json({ unexpected: [] });
  await assert.rejects(getTestimonials(), /depoimentos inválida/);
  const testimonial = { id: 1, name: 'Teste', role: 'Aluno', courseId: 2, course: 'Excel do Básico ao Avançado', quote: 'Depoimento', rating: 5 };
  globalThis.fetch = async () => Response.json([testimonial]);
  assert.deepEqual(await getTestimonials(), [testimonial]);
  for (const courseId of [undefined, '2', 0, -1, 1.5]) {
    globalThis.fetch = async () => Response.json([{ ...testimonial, courseId }]);
    await assert.rejects(getTestimonials(), /depoimentos inválida/);
  }
});

test('testimonial submission sends the authenticated profile header and validates courseId in the response', async () => {
  const profileToken = 'a'.repeat(64);
  const submission = {
    role: 'Aluno', courseId: 2,
    quote: 'O curso me ajudou a usar planilhas no trabalho.',
    rating: 5, acceptedGuidelines: true, website: '',
  };
  const testimonial = {
    id: 1, name: 'Pessoa autenticada', role: submission.role, courseId: 2,
    course: 'Excel do Básico ao Avançado', quote: submission.quote, rating: 5,
  };
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, '/api/testimonials');
    assert.equal(options.method, 'POST');
    assert.equal(new Headers(options.headers).get('x-profile-token'), profileToken);
    assert.deepEqual(JSON.parse(options.body), submission);
    return Response.json(testimonial);
  };
  assert.deepEqual(await createTestimonial(submission, profileToken), testimonial);
  assert.equal(calls, 1);

  for (const malformed of [
    { ...testimonial, courseId: undefined },
    { ...testimonial, quote: { invalid: true } },
  ]) {
    globalThis.fetch = async () => Response.json(malformed);
    await assert.rejects(createTestimonial(submission, profileToken), /depoimento inválida/);
  }
});

test('testimonial submission rejects an invalid session before making a request', async () => {
  const submission = {
    role: 'Aluno', courseId: 2,
    quote: 'O curso me ajudou a usar planilhas no trabalho.',
    rating: 5, acceptedGuidelines: true, website: '',
  };
  let called = false;
  globalThis.fetch = async () => { called = true; return Response.json({}); };
  for (const token of ['', 'token', 'A'.repeat(64), 'a'.repeat(63), 'g'.repeat(64)])
    await assert.rejects(createTestimonial(submission, token), /Entre novamente/);
  assert.equal(called, false);
});
