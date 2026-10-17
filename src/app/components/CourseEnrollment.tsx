import { GoogleLoginButton } from "./GoogleLogin";
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { enrollDirectly, type UserProfile } from '../services/api';

export function EnrollmentAction({ courseId, profile, onProfileUpdated, automatic = false }: { courseId: number; profile: UserProfile; onProfileUpdated: (profile: UserProfile) => void; automatic?: boolean }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const started = useRef(false);
  const notice = useRef<HTMLDivElement>(null);
  const enrolled = profile.enrolledCourseIds.includes(courseId);
  const enroll = async () => {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError('');
    try { onProfileUpdated(await enrollDirectly(courseId)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível concluir a inscrição. Tente novamente.'); }
    finally { busy.current = false; setSaving(false); }
  };
  useEffect(() => { if (automatic && !started.current) { started.current = true; void enroll(); } }, []);
  useEffect(() => { if (error || enrolled) notice.current?.focus({ preventScroll: true }); }, [error, enrolled]);
  return <div className="space-y-3">
    {enrolled ? <div ref={notice} tabIndex={-1} role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">Inscrição confirmada. O curso está disponível no seu perfil.</div> : <>
      {error && <div ref={notice} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {error && /sessão|Entre novamente/.test(error) && <GoogleLoginButton />}
      <button type="button" onClick={() => void enroll()} disabled={saving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 font-bold text-white hover:bg-blue-800 disabled:opacity-60">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{saving ? 'Concluindo inscrição…' : 'Confirmar minha inscrição'}
      </button>
      {saving && <p role="status" className="text-sm text-slate-600">Aguarde a confirmação da plataforma.</p>}
    </>}
  </div>;
}

export function RetiredEmailConfirmation({ onHome }: { onHome: () => void }) {
  useEffect(() => { history.replaceState(null, '', location.pathname + location.search); }, []);
  return <main className="mx-auto max-w-lg space-y-5 px-4 py-16"><h1 className="text-2xl font-bold">Inscrição diretamente na plataforma</h1><p>A confirmação por e-mail foi desativada. Entre na plataforma, escolha o curso e confirme sua inscrição. Inscrições já concluídas continuam válidas.</p><button className="min-h-12 rounded-xl bg-blue-700 px-4 py-3 font-bold text-white" onClick={onHome}>Voltar à plataforma</button></main>;
}
