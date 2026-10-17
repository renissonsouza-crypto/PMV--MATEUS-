import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { loadGoogleIdentity, rememberGoogleCourse, type GoogleIdentity } from '../services/googleIdentity';
import { useEffect, useId, useRef, useState } from 'react';
import { resolveGoogleAccess, cancelGoogleSignup, beginGoogleSignIn, completeGoogleSignIn, type GoogleSignupIdentity, type UserProfile } from '../services/api';

function GoogleAccountChooser({ clientId }: { clientId: string }) {
  const button = useRef<HTMLDivElement>(null);
  const promptId = useId().replace(/:/g, '');
  const [status, setStatus] = useState('Preparando as opções da sua conta Google…');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    let alive = true;
    let sdk: GoogleIdentity | undefined;
    let submitting = false;
    let resize: ResizeObserver | undefined;
    button.current?.replaceChildren();
    setError('');
    setStatus('Preparando as opções da sua conta Google…');
    const authenticate = async (credential?: string) => {
      if (!alive || submitting) return;
      if (!credential) { setError('O Google não retornou uma conta. Tente novamente.'); return; }
      submitting = true;
      setStatus('Validando sua conta na plataforma…');
      try {
        await completeGoogleSignIn(credential, abort.signal);
        if (!alive) return;
        window.location.hash = 'google-login';
      } catch (failure) {
        if (alive) { setError(failure instanceof Error ? failure.message : 'Não foi possível entrar. Tente novamente.'); setStatus(''); }
      }
    };
    void (async () => {
      try {
        sdk = await loadGoogleIdentity();
        if (!alive) return;
        const nonce = await beginGoogleSignIn(abort.signal);
        if (!alive || !button.current) return;
        sdk.initialize({ client_id: clientId, nonce, callback: result => void authenticate(result.credential), auto_select: false, use_fedcm_for_prompt: true, prompt_parent_id: promptId });
        let previousWidth = 0;
        const render = () => {
          if (!alive || !button.current || !sdk) return;
          const width = Math.floor(Math.min(360, Math.max(200, button.current.clientWidth)));
          if (width === previousWidth) return;
          previousWidth = width;
          button.current.replaceChildren();
          sdk.renderButton(button.current, { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', width, locale: 'pt-BR' });
        };
        render();
        resize = new ResizeObserver(render);
        resize.observe(button.current);
        setStatus('Escolha uma conta nas sugestões do Google ou use o botão abaixo.');
        sdk.prompt();
      } catch (failure) {
        if (alive) { setError(failure instanceof Error ? failure.message : 'Não foi possível carregar o Google.'); setStatus(''); }
      }
    })();
    return () => { alive = false; abort.abort(); resize?.disconnect(); sdk?.cancel(); };
  }, [clientId, attempt, promptId]);
  return <div className="space-y-4">
    {status && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{status}</p>}
    <div id={promptId} className="max-w-full overflow-x-auto" />
    <div ref={button} className="min-h-11 w-full overflow-hidden" />
    {error && <><p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)} className="min-h-11 w-full rounded-xl border px-4 py-2 font-semibold">Tentar novamente</button></>}
    <p className="text-sm text-slate-500">As contas são mostradas pelo Google conforme suas sessões e as permissões do navegador. A plataforma não acessa sua lista de contas nem sua senha.</p>
    <a href="/api/auth?action=start" className="flex min-h-11 items-center justify-center rounded-xl border border-slate-300 p-3 text-center text-sm font-semibold text-blue-700 dark:text-blue-300">Continuar com Google em outra página</a>
  </div>;
}

export function GoogleLoginButton({ courseId }: { courseId?: number }) {
  const [config, setConfig] = useState<{ enabled: boolean; clientId?: string } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/auth?action=config', { signal: abort.signal, credentials: 'same-origin' })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!abort.signal.aborted) setConfig({ enabled: data?.enabled === true, clientId: typeof data?.clientId === 'string' ? data.clientId : undefined }); })
      .catch(() => { if (!abort.signal.aborted) setConfig({ enabled: false }); });
    return () => abort.abort();
  }, []);
  return <section aria-label="Acesso e cadastro com Google" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 dark:bg-slate-900 dark:border-slate-700">
    <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100">Entre ou cadastre-se com Google</h2>
    <p className="mt-1 mb-4 text-sm text-slate-600 dark:text-slate-300">Use sua conta Google para acessar o perfil ou começar seu cadastro.</p>
    {config?.enabled && config.clientId ? <Dialog open={open} onOpenChange={value => { if (value) rememberGoogleCourse(courseId); setOpen(value); }}>
      <DialogTrigger asChild><button type="button" className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border-2 border-slate-300 px-4 py-3 font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"><span aria-hidden="true">G</span> Continuar com Google</button></DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md sm:max-w-md bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader><DialogTitle className="pr-8">Entrar na sua conta</DialogTitle><DialogDescription>Escolha sua conta Google para entrar ou completar seu cadastro no Qualifica Vix.</DialogDescription></DialogHeader>
        {open && <GoogleAccountChooser clientId={config.clientId} />}
      </DialogContent>
    </Dialog> : <><button type="button" disabled className="min-h-12 w-full rounded-xl border-2 border-slate-200 px-4 py-3 font-bold text-slate-500 disabled:opacity-70">{config === null ? 'Verificando entrada com Google…' : 'Entrada com Google ainda indisponível'}</button>{config !== null && <p className="mt-2 text-sm text-slate-500">A entrada com Google será liberada após a configuração pela plataforma.</p>}</>}
  </section>;
}

export function GoogleLoginResult({ error, onProfile, onSignup, onHome }: { error?: string; onProfile: (profile: UserProfile) => void; onSignup: (identity: GoogleSignupIdentity) => void; onHome: () => void }) {
  const [message, setMessage] = useState(error === 'account' ? 'Não encontramos um cadastro para essa conta Google. Escolha a conta do e-mail cadastrado ou crie seu cadastro.' : error ? 'Não foi possível entrar com Google. Tente novamente e autorize o acesso à sua identidade.' : 'Recuperando seu perfil…');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [signup, setSignup] = useState<GoogleSignupIdentity | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    history.replaceState(null, '', location.pathname + location.search);
    if (error) return;
    let disposed = false;
    resolveGoogleAccess().then(value => { if (!disposed) { if (value.signup) { setSignup(value.signup); setMessage('Sua conta Google foi confirmada. Complete os dados obrigatórios e os consentimentos para criar seu perfil.'); } else { setProfile(value.profile); setMessage('Sua conta foi recuperada com segurança.'); } } }).catch(failure => { if (!disposed) setMessage(failure instanceof Error ? failure.message : 'Não foi possível recuperar seu perfil.'); });
    return () => { disposed = true; };
  }, [error]);
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 p-6 text-slate-800 dark:text-slate-100">
    <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold">{profile ? `Bem-vindo, ${profile.nome.split(' ')[0]}!` : 'Acesso com Google'}</h1>
    <p role="status">{message}</p>
    {profile ? <button className="min-h-12 rounded-xl bg-blue-700 p-3 font-bold text-white" onClick={() => onProfile(profile)}>Acessar meu perfil</button> : signup ? <button className="min-h-12 rounded-xl bg-blue-700 p-3 font-bold text-white" onClick={() => onSignup(signup)}>Completar meu cadastro</button> : <GoogleLoginButton />}
    <button className="min-h-12 rounded-xl border p-3 font-bold" onClick={() => { if (signup) void cancelGoogleSignup().then(onHome).catch(failure => setMessage(failure instanceof Error ? failure.message : "Não foi possível encerrar a tentativa.")); else onHome(); }}>Voltar ao site</button>
  </main>;
}
