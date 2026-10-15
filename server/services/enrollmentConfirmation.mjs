import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { COURSES } from '../../shared/courses.mjs';
import { emailConfiguration, sendCourseEmail } from './courseEmail.mjs';
export const digest = token => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('hex');
export const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const validToken = token => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
const mask = email => `${email.slice(0, 1)}***@${email.split('@')[1]}`;
const publicResult = row => ({
  status: row.cancelled_at ? 'cancelled' : row.confirmed_at ? 'confirmed' : row.delivery === 'failed' ? 'failed' : Date.parse(row.expires_at) <= Date.now() ? 'expired' : 'pending',
  courseId: Number(row.course_id), registrationId: Number(row.registration_id), requestId: row.id,
  enrolledAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null,
});

export function enrollmentService(repository, { send = sendCourseEmail, configuration = emailConfiguration } = {}) {
  return {
    async request(input) {
      const course = COURSES.find(item => item.id === input.courseId);
      if (!course || course.status === 'coming-soon') throw fail('Este curso não está disponível para inscrição.');
      if (!Number.isSafeInteger(input.registrationId) || typeof input.email !== 'string') throw fail('Dados do perfil inválidos.');
      configuration();
      const person = await repository.registration(input.registrationId);
      if (!person || person.email.trim().toLowerCase() !== input.email.trim().toLowerCase()) throw fail('Não foi possível localizar o perfil com este e-mail. Use o e-mail informado no cadastro.', 404);
      const registration = typeof person.payload === 'string' ? JSON.parse(person.payload) : person.payload;
      const consent = {
        receipt: registration?.policyReceipt ?? null,
        dataAuthorized: registration?.autorizaDados === true,
        termsAccepted: registration?.aceitaTermos === true,
      };
      const token = newToken();
      const statusToken = newToken();
      const row = {
        id: randomUUID(), registration_id: Number(person.id), course_id: course.id,
        token_hash: digest(token), status_hash: digest(statusToken), delivery: 'sending',
        created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString(),
      };
      await repository.createRequest(row);
      try {
        await send({ to: person.email, name: person.name, course, token, consent, requestId: row.id });
        await repository.delivery(row.id, 'sent');
      } catch (error) {
        await repository.delivery(row.id, 'failed').catch(() => {});
        throw error;
      }
      return { status: 'pending', courseId: course.id, requestId: row.id, statusToken, email: mask(person.email), expiresAt: row.expires_at };
    },
    async confirm(input) {
      if (!validToken(input.token)) throw fail('Link de confirmação inválido.', 400);
      const row = await repository.confirm(digest(input.token), new Date().toISOString());
      const course = COURSES.find(item => item.id === Number(row.course_id));
      if (!course || course.status === 'coming-soon') throw fail('As inscrições para este curso não estão disponíveis.', 409);
      const person = await repository.registration(Number(row.registration_id));
      const profileToken = newToken();
      await repository.session(Number(person.id), digest(profileToken));
      const data = typeof person.payload === 'string' ? JSON.parse(person.payload) : person.payload;
      const profile = Object.fromEntries(['nome', 'email', 'telefone', 'whatsapp', 'cep', 'bairro', 'rua', 'numero', 'complemento', 'escolaridade', 'situacaoEmprego'].map(key => [key, typeof data[key] === 'string' ? data[key] : '']));
      return { ...publicResult(row), courseTitle: course.title, profile: { ...profile, id: Number(person.id), profileToken } };
    },
    async status(input) {
      if (typeof input.requestId !== 'string' || !validToken(input.statusToken)) throw fail('Solicitação inválida.');
      const row = await repository.status(input.requestId, digest(input.statusToken));
      if (!row) throw fail('Solicitação não encontrada.', 404);
      return publicResult(row);
    },
    async cancel(input, profileToken) {
      if (!validToken(profileToken) || typeof input.requestId !== 'string') throw fail('Abra a confirmação recebida por e-mail neste navegador antes de cancelar a inscrição.', 403);
      const row = await repository.cancel(input.requestId, digest(profileToken), new Date().toISOString());
      return publicResult(row);
    },
  };
}
