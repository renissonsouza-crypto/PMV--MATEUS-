const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function emailConfiguration(environment = process.env) {
  const { RESEND_API_KEY, MAIL_FROM, APP_BASE_URL } = environment;
  if (!RESEND_API_KEY || !MAIL_FROM || !APP_BASE_URL) throw Object.assign(new Error('O envio de confirmação por e-mail ainda não está configurado. Entre em contato com o atendimento.'), { statusCode: 503 });
  let origin;
  try { origin = new URL(APP_BASE_URL); }
  catch { throw Object.assign(new Error('O endereço público para confirmação não está configurado corretamente.'), { statusCode: 503 }); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (origin.username || origin.password || (origin.protocol !== 'https:' && !(local && environment.NODE_ENV !== 'production')) || origin.search || origin.hash || origin.pathname !== '/') {
    throw Object.assign(new Error('O endereço público para confirmação não está configurado corretamente.'), { statusCode: 503 });
  }
  if (/[\r\n]/.test(MAIL_FROM) || !/@/.test(MAIL_FROM)) throw Object.assign(new Error('O remetente de confirmação não está configurado corretamente.'), { statusCode: 503 });
  let endpoint = 'https://api.resend.com/emails';
  if (environment.NODE_ENV === 'test' && environment.MAIL_TEST_URL) {
    const testUrl = new URL(environment.MAIL_TEST_URL);
    if (testUrl.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(testUrl.hostname)) throw new Error('Invalid local mail test endpoint');
    endpoint = testUrl.href;
  }
  return { key: RESEND_API_KEY, from: MAIL_FROM, origin: origin.origin, endpoint };
}

export function buildCourseEmail({ name, course, token, origin }) {
  const link = `${origin}/#confirm-enrollment=${token}`;
  const location = course.location || (course.modality === 'Online' ? 'Online. O acesso às aulas será informado pela instituição.' : 'Local ainda não informado. Confirme com a instituição antes do início.');
  const lines = [
    `Olá, ${name}!`, `Você solicitou sua inscrição em ${course.title}.`,
    `Modalidade: ${course.modality}`, `Carga horária: ${course.hours} horas`, `Duração: ${course.duration}`,
    `Período: ${course.period}`, `Nível: ${course.level}`, `Local: ${location}`, `Instituição: ${course.provider}`,
    'Grade curricular:', ...course.whatYouLearn.map(topic => `• ${topic}`),
    'Informações adicionais:', course.about,
    'Datas de início, horários detalhados e endereço completo não informados no catálogo devem ser confirmados com a instituição.',
    'A inscrição só será finalizada após sua confirmação. Este link é pessoal e vence em 24 horas.',
    `Confirmar minha inscrição: ${link}`,
    'Se você não solicitou esta inscrição, ignore este e-mail.',
  ];
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#1e293b"><main style="max-width:600px;margin:24px auto;background:#fff;padding:24px;border-radius:16px"><h1 style="color:#0057d9;font-size:24px">Confirme sua inscrição</h1><p>Olá, ${escape(name)}!</p><h2>${escape(course.title)}</h2><p>Modalidade: ${escape(course.modality)}<br>Carga horária: ${course.hours} horas<br>Duração: ${escape(course.duration)}<br>Período: ${escape(course.period)}<br>Nível: ${escape(course.level)}</p><p><strong>Local:</strong> ${escape(location)}<br><strong>Instituição:</strong> ${escape(course.provider)}</p><h3>Grade curricular</h3><ul>${course.whatYouLearn.map(topic => `<li>${escape(topic)}</li>`).join('')}</ul><h3>Informações adicionais</h3><p>${escape(course.about)}</p><p>Datas de início, horários detalhados e endereço completo não informados no catálogo devem ser confirmados com a instituição.</p><p>A inscrição só será finalizada após sua confirmação. Este link é pessoal e vence em 24 horas.</p><p style="margin:28px 0;text-align:center"><a href="${escape(link)}" style="display:inline-block;padding:16px 24px;border-radius:12px;background:#0057d9;color:#fff;text-decoration:none;font-weight:bold">Confirmar minha inscrição</a></p><p style="font-size:12px;color:#64748b">Se você não solicitou esta inscrição, ignore este e-mail.</p></main></body></html>`;
  return { subject: `Confirme sua inscrição: ${course.title}`, text: lines.join('\n\n'), html };
}

export async function sendCourseEmail({ to, requestId, ...content }, fetcher = fetch) {
  const config = emailConfiguration();
  const message = buildCourseEmail({ ...content, origin: config.origin });
  let response;
  try {
    response = await fetcher(config.endpoint, {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `enrollment-${requestId}` },
      body: JSON.stringify({ from: config.from, to: [to], ...message }),
    });
    const result = await response.json();
    if (!response.ok || typeof result?.id !== 'string' || !result.id) throw new Error('Mail provider rejected the request');
  } catch {
    // Never expose the API key, recipient details or provider response in an error.
    throw Object.assign(new Error('Não foi possível enviar o e-mail de confirmação. Sua inscrição ainda não foi finalizada. Tente novamente.'), { statusCode: 503 });
  }
}
