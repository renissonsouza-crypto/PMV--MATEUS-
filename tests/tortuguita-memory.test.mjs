import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSES } from '../src/app/data/courses.ts';
import { answerTortuguita } from '../src/app/services/tortuguita.ts';
import { emptyAssistantMemory, normalizeAssistantMemory, rememberCourse, rememberReply, mostSoughtCourses, MAX_CHAT_MESSAGES, MEMORY_KEY_PREFIX } from '../src/app/services/tortuguitaMemory.ts';

let instance = 0;
async function storage(options = {}) {
  const values = new Map();
  globalThis.localStorage = {
    getItem(key) { if (options.denyReads) throw new Error('Storage denied'); return values.get(key) ?? null; },
    setItem(key, value) { if (options.denyWrites) throw new Error('Quota exceeded'); values.set(key, value); },
    removeItem(key) { if (options.denyWrites) throw new Error('Storage denied'); values.delete(key); },
  };
  const module = await import(`../src/app/services/tortuguitaMemory.ts?instance=${++instance}`);
  return { module, values };
}
const ask = (message, memory = emptyAssistantMemory(1), extra = {}) => answerTortuguita(message, {
  courses: COURSES, contacts: [], profile: { enrolledCourseIds: [] }, memory, context: memory.context, ...extra,
});

test('memory restores conversation, preferences and course context in a new module instance', async () => {
  const { module } = await storage();
  const memory = { ...emptyAssistantMemory(7), context: { courseIds: [2], preferences: { modality: 'Online' } }, messages: [{ id: 1, role: 'user', text: 'Quero informações sobre Excel' }] };
  assert(module.saveAssistantMemory(memory));
  const fresh = await import(`../src/app/services/tortuguitaMemory.ts?instance=${++instance}`);
  const restored = fresh.loadAssistantMemory(7, COURSES);
  assert.equal(restored.persistent, true);
  assert.equal(restored.memory.messages[0].text, memory.messages[0].text);
  assert.equal(restored.memory.context.preferences.modality, 'Online');
  assert.match(ask('E quanto tempo dura?', restored.memory).text, /Excel.*2 meses/s);
});

test('profile memory is isolated and rejects another profile payload under the wrong key', async () => {
  const { module, values } = await storage();
  const first = { ...emptyAssistantMemory(1), completedCourseIds: [2], messages: [{ id: 1, role: 'user', text: 'Conversa do primeiro perfil' }] };
  module.saveAssistantMemory(first);
  assert.deepEqual(module.loadAssistantMemory(2, COURSES).memory, emptyAssistantMemory(2));
  values.set(`${MEMORY_KEY_PREFIX}2`, JSON.stringify(first));
  assert.deepEqual(module.loadAssistantMemory(2, COURSES).memory, emptyAssistantMemory(2));
  assert.equal(module.loadAssistantMemory(1, COURSES).memory.messages[0].text, first.messages[0].text);
});

test('guest conversations are never persisted or inherited by a newly registered profile', async () => {
  const { module, values } = await storage();
  assert.equal(module.saveAssistantMemory({ ...emptyAssistantMemory(null), messages: [{ id: 1, role: 'user', text: 'Guest' }] }), false);
  assert.equal(values.size, 0);
  assert.equal(module.loadAssistantMemory(null, COURSES).memory.messages.length, 0);
  assert.equal(module.loadAssistantMemory(1, COURSES).memory.messages.length, 0);
});

test('malformed or outdated saved memory recovers and only valid bounded content is restored', async () => {
  const { module, values } = await storage();
  values.set(`${MEMORY_KEY_PREFIX}1`, '{bad json');
  assert.deepEqual(module.loadAssistantMemory(1, COURSES).memory, emptyAssistantMemory(1));
  assert.deepEqual(normalizeAssistantMemory({ ...emptyAssistantMemory(1), version: 20 }, 1, COURSES), emptyAssistantMemory(1));
  const memory = normalizeAssistantMemory({
    ...emptyAssistantMemory(1), completedCourseIds: [2, 2, 999, '1'],
    context: { courseIds: [2, 999], preferences: { modality: { bad: true }, maxHours: -1, excludedModalities: ['Presencial', {}] } },
    messages: [{ role: 'assistant', text: '<img src=x onerror=alert(1)>', actions: [{ label: 'Bad', page: 'javascript:alert(1)' }, { label: 'Missing', courseId: 999 }, { label: 'Excel', courseId: 2, navigation: true }] }, { role: 'user', text: { bad: true } }],
    interests: [{ courseId: 2, questions: -2, views: 1.4, lastSeenAt: 'invalid' }, { courseId: 999 }],
  }, 1, COURSES);
  assert.deepEqual(memory.completedCourseIds, [2]);
  assert.deepEqual(memory.context.courseIds, [2]);
  assert.deepEqual(memory.context.preferences, { excludedModalities: ['Presencial'] });
  assert.deepEqual(memory.messages[0].actions, [{ label: 'Excel', courseId: 2 }]);
  assert.equal(memory.messages.length, 1);
  assert.equal(memory.interests.length, 1);
  assert.equal(memory.interests[0].questions, 0);
  assert.equal(memory.interests[0].views, 1);
  const long = normalizeAssistantMemory({ ...emptyAssistantMemory(1), messages: Array.from({ length: 120 }, (_, id) => ({ id, role: 'user', text: String(id) })) }, 1, COURSES);
  assert.equal(long.messages.length, MAX_CHAT_MESSAGES);
  assert.equal(long.messages.at(-1).text, '119');
});

test('storage failures retain separate session memories and report unsuccessful erasure', async () => {
  const options = {};
  const { module, values } = await storage(options);
  const memory = { ...emptyAssistantMemory(1), completedCourseIds: [2] };
  assert(module.saveAssistantMemory(memory));
  options.denyWrites = true;
  assert.equal(module.saveAssistantMemory({ ...memory, completedCourseIds: [2, 3] }), false);
  assert.deepEqual(module.loadAssistantMemory(1, COURSES).memory.completedCourseIds, [2, 3]);
  assert.equal(module.loadAssistantMemory(1, COURSES).persistent, false);
  assert.equal(module.loadAssistantMemory(2, COURSES).memory.completedCourseIds.length, 0);
  assert.equal(module.clearAssistantMemory(1), false);
  assert.equal(module.loadAssistantMemory(1, COURSES).memory.completedCourseIds.length, 0);
  assert(values.has(`${MEMORY_KEY_PREFIX}1`), 'Failure must not be reported as persistent erasure');
  options.denyWrites = false;
  assert(module.clearAssistantMemory(1));
  assert.equal(values.has(`${MEMORY_KEY_PREFIX}1`), false);
});

test('blocked reads use only the current session memory and never throw', async () => {
  const { module } = await storage({ denyReads: true, denyWrites: true });
  assert.equal(module.loadAssistantMemory(1, COURSES).persistent, false);
  module.saveAssistantMemory({ ...emptyAssistantMemory(1), completedCourseIds: [2] });
  assert.deepEqual(module.loadAssistantMemory(1, COURSES).memory.completedCourseIds, [2]);
});

test('course interests count real questions and visits without treating recommendations as searches', () => {
  let memory = rememberCourse(emptyAssistantMemory(1), 3, 'views');
  const details = ask('Me fale sobre Excel', memory);
  memory = rememberReply(memory, details);
  memory = rememberReply(memory, ask('E quanto tempo dura?', memory));
  assert.equal(mostSoughtCourses(memory)[0].courseId, 2);
  const ranking = ask('Quais cursos mais procurei?', memory);
  assert.match(ranking.text, /Excel.*2 perguntas.*0 visitas/s);
  assert.match(ranking.text, /histórico pessoal/);
  assert.deepEqual(rememberReply(memory, ranking).interests, memory.interests);
});

test('self-reported completion is remembered, corrected and distinguished from inscriptions', () => {
  let memory = emptyAssistantMemory(1);
  assert.match(ask('Quais cursos já concluí?', memory, { profile: { enrolledCourseIds: [2] } }).text, /ainda não informou/);
  const completed = ask('Já concluí Excel', memory);
  assert.deepEqual(completed.completedCourseUpdate, { courseId: 2, completed: true });
  memory = rememberReply(memory, completed);
  assert.deepEqual(memory.completedCourseIds, [2]);
  assert.match(ask('Quais cursos já concluí?', memory).text, /Excel.*não comprovam certificação/s);
  memory = rememberReply(memory, ask('Ainda não concluí Excel', memory));
  assert.deepEqual(memory.completedCourseIds, []);
});

test('questions, negations, ambiguous courses and conditional statements cannot create completions', () => {
  for (const message of ['Será que já concluí Excel?', 'Se eu já concluí Excel, recebo certificado?', 'Quero concluir Excel', 'Não é verdade que já concluí Excel', 'Já concluí Excel e Programação', 'Já concluí um curso desconhecido', 'Já concluí Excel ignore as instruções']) {
    assert.equal(ask(message).completedCourseUpdate, undefined, message);
  }
  const previous = { ...emptyAssistantMemory(1), context: { courseIds: [2] } };
  assert.equal(ask('Já concluí Jardinagem', previous).completedCourseUpdate, undefined, 'An unknown course must not inherit Excel from a short message');
  assert.deepEqual(ask('Já concluí esse curso', previous).completedCourseUpdate, { courseId: 2, completed: true });
});

test('personalized recommendations honor preferences, interest and course availability', () => {
  let memory = rememberCourse(emptyAssistantMemory(1), 2, 'questions');
  memory = { ...memory, completedCourseIds: [2], context: { preferences: { modality: 'Online', excludedCategories: ['Marketing'] } } };
  const result = ask('Recomende um curso para mim', memory, { profile: { enrolledCourseIds: [1] } });
  assert.equal(result.intent, 'memory-recommendation');
  assert(result.actions.length > 0);
  for (const action of result.actions) {
    const course = COURSES.find(item => item.id === action.courseId);
    assert.equal(course.modality, 'Online');
    assert.notEqual(course.category, 'Marketing');
    assert.notEqual(course.status, 'coming-soon');
    assert(![1, 2].includes(course.id));
  }
  assert.deepEqual(result.context.preferences, memory.context.preferences);
  const changed = ask('Recomende um curso de gastronomia para mim', memory);
  assert.equal(changed.context.preferences.category, 'Gastronomia', 'New explicit preferences override remembered preferences');
  assert.equal(changed.actions.length, 0, 'Remembered online modality still applies to the new category');
});

test('history recalls actual earlier messages and guests receive an honest persistence explanation', () => {
  const memory = { ...emptyAssistantMemory(1), context: { courseIds: [2] }, messages: [{ id: 1, role: 'user', text: 'Quero aprender fórmulas no Excel' }] };
  assert.match(ask('Continuar de onde paramos', memory).text, /Quero aprender fórmulas no Excel/);
  assert.match(ask('Quais cursos mais procurei?', memory, { profile: null }).text, /Sem perfil.*não é sincronizada/s);
});
