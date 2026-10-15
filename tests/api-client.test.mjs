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
  const testimonial = { id: 1, name: 'Teste', role: 'Aluno', course: 'Curso Teste', quote: 'Depoimento', rating: 5 };
  globalThis.fetch = async () => Response.json([testimonial]);
  assert.deepEqual(await getTestimonials(), [testimonial]);
  globalThis.fetch = async () => Response.json({ ...testimonial, quote: { invalid: true } });
  await assert.rejects(createTestimonial(testimonial), /depoimento inválida/);
});
