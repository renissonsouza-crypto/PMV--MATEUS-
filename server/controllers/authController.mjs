import { authCookie, beginGoogle, beginGoogleIdentity, readGoogleIdentity, verifyGoogleIdentity, cookieValue, exchangeGoogle, finishGoogleAccess, clearGoogleSignupCookie, googleConfiguration, publicProfile, readGoogleState } from '../services/googleAuth.mjs';
import { digest, fail } from '../services/enrollmentConfirmation.mjs';
import { postgresAuthRepository } from '../models/AuthRepository.mjs';
import { validateJsonMutation } from './requestSecurity.mjs';
const tokenPattern = /^[a-f0-9]{64}$/;
export function authController(repository = postgresAuthRepository(), { configuration = googleConfiguration, exchange = exchangeGoogle, verify = verifyGoogleIdentity } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const url = new URL(req.url, 'http://localhost');
    const action = url.searchParams.get('action');
    try {
      if (action === 'cancel-signup') {
        if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método não permitido' }); }
        const error = validateJsonMutation(req);
        if (error) return res.status(error.status).json({ error: error.error });
        const signup = cookieValue(req, 'qv_signup');
        if (tokenPattern.test(signup)) await repository.revokeSignup(digest(signup));
        res.setHeader('Set-Cookie', clearGoogleSignupCookie);
        return res.status(200).json({ status: 'cancelled' });
      }
      if (['challenge', 'credential'].includes(action)) {
        if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método não permitido' }); }
        const error = validateJsonMutation(req);
        if (error) return res.status(error.status).json({ error: error.error });
        const config = configuration();
        if (action === 'challenge') {
          const old = cookieValue(req, 'qv_gis');
          let previous;
          try { previous = readGoogleIdentity(old, config); } catch { /* An expired or absent browser challenge needs no cleanup. */ }
          if (previous) await repository.consumeChallenge(digest(previous.nonce));
          const challenge = beginGoogleIdentity(config);
          await repository.challenge(digest(challenge.nonce), challenge.expiresAt);
          res.setHeader('Set-Cookie', challenge.cookie);
          return res.status(200).json({ nonce: challenge.nonce });
        }
        res.setHeader('Set-Cookie', authCookie('qv_gis', '', config, 0));
        if (typeof req.body?.credential !== 'string' || req.body.credential.length > 16000) throw fail('Credencial Google inválida.', 400);
        const challenge = readGoogleIdentity(cookieValue(req, 'qv_gis'), config);
        let identity;
        try { identity = await verify(req.body.credential, config, challenge.nonce); }
        catch { throw fail('Não foi possível validar a conta Google. Abra a entrada novamente e tente outra vez.', 403); }
        if (!await repository.consumeChallenge(digest(challenge.nonce))) throw fail('Esta tentativa já foi utilizada ou venceu. Abra a entrada com Google novamente.', 403);
        const access = await finishGoogleAccess(repository, identity);
        const previousSignup = cookieValue(req, 'qv_signup');
        if (tokenPattern.test(previousSignup)) await repository.revokeSignup(digest(previousSignup));
        res.setHeader('Set-Cookie', [authCookie('qv_gis', '', config, 0), access.kind === 'session' ? authCookie('qv_session', access.token, config, 90 * 86400) : authCookie('qv_session', '', config, 0), access.kind === 'signup' ? authCookie('qv_signup', access.token, config, 1800) : clearGoogleSignupCookie]);
        return res.status(200).json({ status: access.kind === 'session' ? 'authenticated' : 'registration-required' });
      }
      if (action === 'logout' && req.method === 'POST') {
        const error = validateJsonMutation(req);
        if (error) return res.status(error.status).json({ error: error.error });
        const tokens = [cookieValue(req, 'qv_session'), req.headers['x-profile-token']].filter(token => typeof token === 'string' && tokenPattern.test(token));
        await repository.revoke([...new Set(tokens.map(digest))]);
        const signup = cookieValue(req, 'qv_signup');
        if (tokenPattern.test(signup)) await repository.revokeSignup(digest(signup));
        let pendingIdentity;
        try { pendingIdentity = readGoogleIdentity(cookieValue(req, 'qv_gis'), configuration()); } catch { /* Missing or invalid Google state cannot authorize a login. */ }
        if (pendingIdentity) await repository.consumeChallenge(digest(pendingIdentity.nonce));
        res.setHeader('Set-Cookie', ['qv_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0', 'qv_oauth=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0', 'qv_gis=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0', clearGoogleSignupCookie]);
        return res.status(200).json({ status: 'signed-out' });
      }
      if (action === 'logout') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método não permitido' }); }
      if (req.method !== 'GET') { res.setHeader('Allow', action === 'logout' ? 'POST' : 'GET'); return res.status(405).json({ error: 'Método não permitido' }); }
      if (action === 'session') {
        const signup = cookieValue(req, 'qv_signup');
        if (signup) {
          const intent = tokenPattern.test(signup) ? await repository.signup(digest(signup)) : null;
          if (!intent) { res.setHeader('Set-Cookie', clearGoogleSignupCookie); throw fail('A confirmação Google venceu. Entre com Google novamente.', 401); }
          return res.status(200).json({ status: 'registration-required', identity: { nome: intent.name, email: intent.email } });
        }
        const token = cookieValue(req, 'qv_session');
        if (!tokenPattern.test(token)) throw fail('Entre novamente com sua conta Google.', 401);
        const person = await repository.authenticated(digest(token));
        if (!person) throw fail('Sua sessão venceu. Entre novamente com Google.', 401);
        return res.status(200).json({ profile: { ...publicProfile(person, await repository.enrollments(Number(person.id))), profileToken: token } });
      }
      if (!['config', 'start', 'callback'].includes(action)) throw fail('Operação inválida.', 400);
      const config = configuration();
      if (action === 'config') return res.status(200).json({ enabled: true, clientId: config.clientId });
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
        const access = await finishGoogleAccess(repository, identity);
        const previousSignup = cookieValue(req, 'qv_signup');
        if (tokenPattern.test(previousSignup)) await repository.revokeSignup(digest(previousSignup));
        res.setHeader('Set-Cookie', [authCookie('qv_oauth', '', config, 0), access.kind === 'session' ? authCookie('qv_session', access.token, config, 90 * 86400) : authCookie('qv_session', '', config, 0), access.kind === 'signup' ? authCookie('qv_signup', access.token, config, 1800) : clearGoogleSignupCookie]);
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
