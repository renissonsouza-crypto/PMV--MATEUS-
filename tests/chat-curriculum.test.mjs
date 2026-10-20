import assert from 'node:assert/strict';
import test from 'node:test';
import { answerTortuguita } from '../src/app/services/tortuguita.ts';
import { COURSES } from '../src/app/data/courses.ts';
import { getContactChannels } from '../src/app/models/platformContact.ts';
const base = { courses: COURSES, contacts: getContactChannels({}) };
const examples = [
  ['Me ajude a entender como pesquisar uma formação', /Buscar cursos, áreas ou palavras-chave/, 'catalog_search'],
  ['Como retiro os filtros da minha pesquisa?', /Limpar filtros/, 'catalog_filters'],
  ['Já fiz cadastro e quero voltar a acessar', /Continuar com Google/, 'profile_local'],
  ['Em qual parte vejo os cursos em que entrei?', /Cursos cadastrados/, 'enrollments'],
  ['Quero orientação sobre cada etapa para criar meu cadastro', /Dados Pessoais.*Endereço.*Acessibilidade.*Privacidade/s, 'registration_steps'],
  ['As avaliações do chat usam meu CPF?', /sem texto.*CPF/s, 'chat_learning'],
];
for (const [question, expected, intent] of examples) for (const dialogue of [undefined, 'area', 'modality']) test(`Currículo / ${dialogue ?? 'conversa nova'}: ${question}`, () => {
  const result = answerTortuguita(question, { ...base, context: { dialogue } });
  assert.equal(result.intent, intent); assert.match(result.text, expected); assert.equal(result.navigation, undefined);
});
test('Uma dúvida intermediária de cadastro não destrói a escolha guiada', () => {
  let context;
  for (const question of ['Quero ajuda para escolher um curso', 'Quais são as etapas do cadastro?', 'Tecnologia', 'Online']) context = answerTortuguita(question, { ...base, context }).context;
  assert.deepEqual(context.candidateCourseIds, [1, 5]);
});
test('Explicação de uma FAQ tem prioridade sobre uma ficha antiga', () => {
  const first = answerTortuguita('Qual a duração de Excel?', base);
  const account = answerTortuguita('Como entro na minha conta?', { ...base, context: first.context });
  const repair = answerTortuguita('Não entendi', { ...base, context: account.context });
  assert.match(repair.text, /Google|perfil|navegador/); assert.doesNotMatch(repair.text, /Excel/);
});
test('Desistência não promete devolver uma escolha nem executa cancelamento', () => {
  const result = answerTortuguita('Desistir de uma formação devolve uma escolha mensal?', base);
  assert.match(result.text, /cancelad|histórico|conta|limite/); assert.equal(result.navigation, undefined);
});
test('Explicação do aprendizado não é substituída pelo curso aberto', () => {
  const result = answerTortuguita('As avaliações do chat usam meu CPF?', { ...base, page: 'course-detail', activeCourseId: 2, context: { courseIds: [2] } });
  assert.equal(result.intent, 'chat_learning'); assert.match(result.text, /opcional/); assert.match(result.text, /não alteram fatos/);
});
