import { authCookie, beginGoogle, cookieValue, exchangeGoogle, finishGoogleLogin, googleConfiguration, publicProfile, readGoogleState } from '../services/googleAuth.mjs';
import { digest, fail } from '../services/enrollmentConfirmation.mjs';
import { postgresAuthRepository } from '../models/AuthRepository.mjs';
import { validateJsonMutation } from './requestSecurity.mjs';
const tokenPattern = /^[a-f0-9]{64}$/;
export function authController(repository = postgresAuthRepository(), { configuration = googleConfiguration, exchange = exchangeGoogle } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const url = new URL(req.url, 'http://localhost');
    const action = url.searchParams.get('action');
    try {
      if (action === 'logout' && req.method === 'POST') {
        const error = validateJsonMutation(req);
        if (error) return res.status(error.status).json({ error: error.error });
        const tokens = [cookieValue(req, 'qv_session'), req.headers['x-profile-token']].filter(token => typeof token === 'string' && tokenPattern.test(token));
        await repository.revoke([...new Set(tokens.map(digest))]);
        res.setHeader('Set-Cookie', ['qv_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0', 'qv_oauth=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0']);
        return res.status(200).json({ status: 'signed-out' });
      }
      if (action === 'logout') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método não permitido' }); }
      if (req.method !== 'GET') { res.setHeader('Allow', action === 'logout' ? 'POST' : 'GET'); return res.status(405).json({ error: 'Método não permitido' }); }
      if (action === 'session') {
        const token = cookieValue(req, 'qv_session');
        if (!tokenPattern.test(token)) throw fail('Entre novamente com sua conta Google.', 401);
        const person = await repository.authenticated(digest(token));
        if (!person) throw fail('Sua sessão venceu. Entre novamente com Google.', 401);
        return res.status(200).json({ profile: { ...publicProfile(person, await repository.enrollments(Number(person.id))), profileToken: token } });
      }
      if (!['config', 'start', 'callback'].includes(action)) throw fail('Operação inválida.', 400);
      const config = configuration();
      if (action === 'config') return res.status(200).json({ enabled: true });
      if (action === 'start') {
        const start = beginGoogle(config);
        res.setHeader('Set-Cookie', start.cookie);
        res.setHeader('Location', start.url);
        return res.status(302).end();
      }
      res.setHeader('Set-Cookie', authCookie('qv_oauth', '', config, 0));
      try {
        const state = readGoogleState(cookieValue(req, 'qv_oauth'), url.searchParams.get('state'), config);
        if (url.searchParams.has('error')) throw fail('O acesso com Google foi cancelado.', 403);
        const identity = await exchange(url.searchParams.get('code'), state, config);
        const token = await finishGoogleLogin(repository, identity);
        res.setHeader('Set-Cookie', [authCookie('qv_oauth', '', config, 0), authCookie('qv_session', token, config, 90 * 86400)]);
        res.setHeader('Location', `${config.origin}/#google-login`);
      } catch (error) {
        // Redirect only to the server-configured origin; never include provider error details or tokens.
        res.setHeader('Location', `${config.origin}/#google-login-error=${error.statusCode === 404 ? 'account' : 'failed'}`);
      }
      return res.status(302).end();
    } catch (error) {
      if (action === 'config') return res.status(200).json({ enabled: false });
      return res.status(error.statusCode || 503).json({ error: error.statusCode ? error.message : 'Não foi possível acessar sua conta. Tente novamente.' });
    }
  };
}
