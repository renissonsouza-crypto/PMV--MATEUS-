import { useEffect, useRef, useState } from 'react';
import { restoreGoogleProfile, type UserProfile } from '../services/api';

export function GoogleLoginButton() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/auth?action=config', { signal: abort.signal, credentials: 'same-origin' })
      .then(response => response.ok ? response.json() : null)
      .then(data => setEnabled(data?.enabled === true))
      .catch(() => { if (!abort.signal.aborted) setEnabled(false); });
    return () => abort.abort();
  }, []);
  return <section aria-label="Acessar conta existente" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 dark:bg-slate-900 dark:border-slate-700">
    <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100">Já tem cadastro?</h2>
    <p className="mt-1 mb-4 text-sm text-slate-600 dark:text-slate-300">Entre com a mesma conta Google do e-mail informado no cadastro. Você poderá escolher uma conta salva no seu navegador.</p>
    {enabled ? <a href="/api/auth?action=start" className="flex min-h-12 items-center justify-center gap-3 rounded-xl border-2 border-slate-300 px-4 py-3 font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"><span aria-hidden="true">G</span> Continuar com Google</a>
      : <><button type="button" disabled className="min-h-12 w-full rounded-xl border-2 border-slate-200 px-4 py-3 font-bold text-slate-500 disabled:opacity-70">{enabled === null ? 'Verificando entrada com Google…' : 'Entrada com Google ainda indisponível'}</button>{enabled === false && <p className="mt-2 text-sm text-slate-500">A entrada com Google será liberada após a configuração pela plataforma.</p>}</>}
  </section>;
}

export function GoogleLoginResult({ error, onProfile, onHome }: { error?: string; onProfile: (profile: UserProfile) => void; onHome: () => void }) {
  const [message, setMessage] = useState(error === 'account' ? 'Não encontramos um cadastro para essa conta Google. Escolha a conta do e-mail cadastrado ou crie seu cadastro.' : error ? 'Não foi possível entrar com Google. Tente novamente e autorize o acesso à sua identidade.' : 'Recuperando seu perfil…');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    history.replaceState(null, '', location.pathname + location.search);
    if (error) return;
    let disposed = false;
    restoreGoogleProfile().then(value => { if (!disposed) { setProfile(value); setMessage('Sua conta foi recuperada com segurança.'); } }).catch(failure => { if (!disposed) setMessage(failure instanceof Error ? failure.message : 'Não foi possível recuperar seu perfil.'); });
    return () => { disposed = true; };
  }, [error]);
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 p-6 text-slate-800 dark:text-slate-100">
    <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold">{profile ? `Bem-vindo, ${profile.nome.split(' ')[0]}!` : 'Acesso com Google'}</h1>
    <p role="status">{message}</p>
    {profile ? <button className="min-h-12 rounded-xl bg-blue-700 p-3 font-bold text-white" onClick={() => onProfile(profile)}>Acessar meu perfil</button> : <GoogleLoginButton />}
    <button className="min-h-12 rounded-xl border p-3 font-bold" onClick={onHome}>Voltar ao site</button>
  </main>;
}
