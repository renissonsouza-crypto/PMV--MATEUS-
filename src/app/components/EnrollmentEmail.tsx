import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { confirmCourseEmail, requestCourseConfirmation, isProfileSessionOnly, type UserProfile } from "../services/api";

export function EnrollmentEmailRequest({ courseId, profile, onProfileUpdated, automatic = false }: { courseId: number; profile: UserProfile; onProfileUpdated: (profile: UserProfile) => void; automatic?: boolean }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(false);
  const started = useRef(false);
  const noticeRef = useRef<HTMLDivElement>(null);
  const pending = profile.pendingEnrollments?.find(item => item.courseId === courseId);
  const expired = pending && Date.parse(pending.expiresAt) <= Date.now();
  const send = async () => {
    if (active.current) return;
    active.current = true;
    setSending(true);
    setError("");
    try { onProfileUpdated(await requestCourseConfirmation(courseId)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível enviar o e-mail. Tente novamente."); }
    finally { active.current = false; setSending(false); }
  };
  useEffect(() => { if (automatic && !started.current) { started.current = true; void send(); } }, []);
  useEffect(() => { if (error || pending) { noticeRef.current?.focus({ preventScroll: true }); noticeRef.current?.scrollIntoView({ block: "center" }); } }, [error, pending?.requestId]);
  if (profile.enrolledCourseIds.includes(courseId)) return <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">Inscrição confirmada. O curso está disponível no seu perfil.</p>;
  return <div className="space-y-3">
    {pending && <div ref={noticeRef} tabIndex={-1} role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
      <p className="font-bold">{expired ? "Link de confirmação expirado" : "Confirmação enviada por e-mail"}</p>
      {expired ? <p className="mt-1">Solicite outro e-mail para finalizar sua inscrição.</p> : <p className="mt-1">Confira a caixa de entrada e o spam de {pending.email}. Sua inscrição só será finalizada ao clicar em “Confirmar minha inscrição” no e-mail. O link vence em 24 horas.</p>}
    </div>}
    {error && <div ref={noticeRef} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    <button type="button" onClick={() => void send()} disabled={sending} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 font-bold text-white hover:bg-blue-800 disabled:opacity-60">
      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
      {sending ? "Enviando confirmação…" : pending ? "Reenviar e-mail de confirmação" : "Enviar e-mail de confirmação"}
    </button>
    {sending && <p role="status" className="text-sm text-slate-600">Sua inscrição ainda não foi finalizada. Aguarde o envio do e-mail.</p>}
  </div>;
}

export function EnrollmentEmailConfirmation({ token, onProfileUpdated, onOpenProfile, onHome }: { token: string; onProfileUpdated: (profile: UserProfile) => void; onOpenProfile: () => void; onHome: () => void }) {
  const [state, setState] = useState<{ loading: boolean; error: string; course: string }>({ loading: true, error: "", course: "" });
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    // The secret stays out of HTTP URLs, referrers and browser history after use.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    void confirmCourseEmail(token, controller.signal).then(result => {
      if (!active) return;
      onProfileUpdated(result.profile);
      setState({ loading: false, error: "", course: result.courseTitle });
    }).catch(error => { if (active) setState({ loading: false, error: error instanceof Error ? error.message : "Não foi possível confirmar sua inscrição.", course: "" }); });
    return () => { active = false; controller.abort(); };
  }, [token]);
  useEffect(() => { if (!state.loading) titleRef.current?.focus(); }, [state.loading]);
  return <main className="flex min-h-[80dvh] items-center justify-center px-4 py-10">
    <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      {state.loading ? <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-700" /> : !state.error ? <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-700" /> : <Mail className="mx-auto mb-4 h-12 w-12 text-red-700" />}
      <h1 ref={titleRef} tabIndex={-1} className="text-2xl font-black text-slate-900">{state.loading ? "Confirmando sua inscrição…" : state.error ? "Não foi possível confirmar" : "Inscrição confirmada!"}</h1>
      {state.error ? <p role="alert" className="mt-4 text-sm text-red-700">{state.error}</p> : <p role="status" className="mt-4 text-slate-600">{state.loading ? "Aguarde a resposta da plataforma." : `Sua inscrição em ${state.course} foi finalizada. O curso está disponível no seu perfil.`}</p>}
      {!state.loading && !state.error && isProfileSessionOnly() && <p role="status" className="mt-4 text-sm text-amber-800">O navegador não permitiu salvar o perfil. Ele estará disponível apenas enquanto esta página estiver aberta.</p>}
      {!state.loading && <button type="button" onClick={state.error ? onHome : onOpenProfile} className="mt-6 min-h-11 w-full rounded-xl bg-blue-700 px-4 py-3 font-bold text-white">{state.error ? "Voltar à plataforma" : "Acessar meu perfil"}</button>}
    </section>
  </main>;
}
