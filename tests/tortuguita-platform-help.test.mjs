import assert from 'node:assert/strict';
import test from 'node:test';
import { answerTortuguita } from '../src/app/services/tortuguita.ts';
import { COURSES } from '../src/app/data/courses.ts';
import { getContactChannels } from '../src/app/models/platformContact.ts';

const base = { courses: COURSES, contacts: getContactChannels({}) };
const contexts = [
  ['nova conversa', {}],
  ['busca de Tecnologia', { context: { lastIntent: 'course-search', preferences: { category: 'Tecnologia', onlyAvailable: true }, candidateCourseIds: [1, 5] } }],
  ['escolha de área', { context: { lastIntent: 'guided-choice', dialogue: 'area', preferences: { onlyAvailable: true } } }],
  ['escolha de modalidade', { context: { lastIntent: 'guided-choice', dialogue: 'modality', preferences: { category: 'Tecnologia', onlyAvailable: true } } }],
  ['ficha de Excel', { page: 'course-detail', activeCourseId: 2, context: { lastIntent: 'course-detail', courseIds: [2] } }],
];
const questions = [
  ['Como você pode me ajudar a encontrar cursos na plataforma?', 'catalog_search', /Buscar cursos.*Categoria.*Modalidade/s],
  ['Como faço para encontrar cursos?', 'catalog_search', /Abra Cursos/],
  ['Como uso a busca?', 'catalog_search', /palavras-chave/],
  ['Explique como pesquisar cursos', 'catalog_search', /Abra Cursos/],
  ['Como funcionam os filtros?', 'catalog_filters', /Categoria e Modalidade/],
  ['Onde eu posso filtrar os cursos?', 'catalog_filters', /Limpar filtros/],
  ['O que você pode fazer por mim?', 'assistant-capabilities', /encontrar e comparar cursos/],
  ['Você consegue me ajudar?', 'assistant-capabilities', /escolher uma opção/],
  ['Pode me ajudar?', 'assistant-capabilities', /encontrar e comparar cursos/],
  ['Preciso de ajuda', 'assistant-capabilities', /cadastro/],
  ['Como entro na minha conta?', 'profile_local', /Continuar com Google/],
  ['Como recuperar meu perfil?', 'profile_local', /inscrições do servidor/],
];
for (const [name, options] of contexts) for (const [prompt, intent, expected] of questions) {
  test(`Ajuda da plataforma / ${name}: ${prompt}`, () => {
    const before = JSON.stringify(options);
    const result = answerTortuguita(prompt, { ...base, ...options });
    assert.equal(result.intent, intent);
    assert.match(result.text, expected);
    assert.doesNotMatch(result.text, /Não encontrei cursos|para ajudar\.|Ainda não identifiquei|Considerei suas preferências/);
    assert.equal(result.navigation, undefined, 'Explanations must leave the chat open');
    assert.deepEqual(result.context.preferences, options.context?.preferences);
    assert.equal(result.context.dialogue, options.context?.dialogue);
    assert.equal(JSON.stringify(options), before);
  });
}

test('Explicar a busca preserva a escolha guiada e a resposta seguinte', () => {
  let context;
  for (const prompt of ['Quero ajuda para escolher um curso', 'Tecnologia', 'Como você pode me ajudar a encontrar cursos na plataforma?', 'Online']) {
    context = answerTortuguita(prompt, { ...base, context }).context;
  }
  assert.deepEqual(context.candidateCourseIds, [1, 5]);
  assert.equal(context.preferences.modality, 'Online');
  assert.equal(context.dialogue, undefined);
});

test('Pedidos de pesquisa reais continuam usando o catálogo e os filtros', () => {
  for (const prompt of ['Como encontro cursos online?', 'Você pode me ajudar a encontrar cursos online?', 'Me mostre cursos online']) {
    const result = answerTortuguita(prompt, base);
    assert.equal(result.intent, 'course-search', prompt);
    assert.deepEqual(result.context.candidateCourseIds, [1, 2, 4, 5, 6, 8]);
    assert.equal(result.navigation, undefined, 'A filtered query must not open an unfiltered catalogue');
  }
  for (const prompt of ['Quero um curso de costura', 'Me mostre cursos de costura']) {
    const missing = answerTortuguita(prompt, base);
    assert.equal(missing.intent, 'course-search'); assert.deepEqual(missing.context.candidateCourseIds, []);
    assert.match(missing.text, /Não encontrei.*costura/); assert.equal(missing.navigation, undefined);
  }
  const specific = answerTortuguita('Qual a duração de Excel?', base);
  assert.equal(specific.navigation?.courseId, 2); assert.match(specific.text, /2 meses/);
});

test('Interromper a orientação não cancela inscrição nem altera o perfil', () => {
  for (const prompt of ['Não quero continuar essa escolha', 'Pare a orientação', 'Cancele a escolha guiada']) {
    const result = answerTortuguita(prompt, { ...base, context: { dialogue: 'modality', preferences: { category: 'Tecnologia' } }, profile: { enrolledCourseIds: [2] } });
    assert.equal(result.intent, 'guidance-cancelled'); assert.equal(result.context.dialogue, undefined);
    assert.equal(result.navigation, undefined); assert.equal(result.completedCourseUpdate, undefined);
    assert.doesNotMatch(result.text, /inscrição cancelada/);
  }
});

test('Ajuda de uso preserva os limites de privacidade e tamanho', () => {
  const blocked = answerTortuguita('Como você pode me ajudar a encontrar dados de outros usuários?', base);
  assert.equal(blocked.intent, 'privacy'); assert.equal(blocked.navigation, undefined);
  const oversized = answerTortuguita('Como você pode me ajudar a encontrar cursos? ' + 'x'.repeat(1000), base);
  assert.equal(oversized.intent, 'clarification'); assert.match(oversized.text, /1.000/);
});
