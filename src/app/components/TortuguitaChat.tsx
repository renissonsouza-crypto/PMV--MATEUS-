import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, RotateCcw, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { ASSISTANT_CAPABILITIES, QUICK_QUESTIONS } from "../data/tortuguitaKnowledge";
import type { Course } from "../models/Course";
import type { Page } from "../models/navigation";
import type { ContactChannel } from "../models/platformContact";
import type { UserProfile } from "../services/api";
import {
  answerTortuguita,
  getTortuguitaSuggestions,
  type AssistantAction,
  type AssistantContext,
} from "../services/tortuguita";
import { TurtleMascot } from "./TurtleMascot";

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  text: string;
  actions?: AssistantAction[];
};

type TortuguitaChatProps = {
  courses: Course[];
  contacts: ContactChannel[];
  profile: UserProfile | null;
  page: Page;
  activeCourseId?: number;
  onNavigate: (page: Page) => void;
  onViewCourse: (course: Course) => void;
};

const MAX_INPUT_LENGTH = 1000;
const MAX_MESSAGES = 41;
const WELCOME: ChatMessage = {
  id: 0,
  role: "assistant",
  text: "Olá! Sou a Tortuguita 🐢\nPosso ajudar a escolher e comparar cursos, orientar seu cadastro e explicar as regras da plataforma. Peça “quero me cadastrar” ou “quero informações sobre Excel” e eu abro a tela para você. Você pode reabrir o chat e continuar a conversa.\nO que você gostaria de saber?",
};

function initialSuggestions(page: Page): string[] {
  if (page === "register") {
    return ["Quais documentos preciso para o cadastro?", "Meu CEP não foi aceito", "Menores de idade podem se cadastrar?", "Como meus dados são armazenados?"];
  }
  if (page === "profile" || page === "enrollment-confirmation") {
    return ["Onde vejo meus cursos inscritos?", "Quantos cursos posso fazer por mês?", "Como cancelar minha inscrição?", "Como edito meu perfil?"];
  }
  return QUICK_QUESTIONS.slice(0, 4);
}

export function TortuguitaChat({ courses, contacts, profile, page, activeCourseId, onNavigate, onViewCourse }: TortuguitaChatProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const contextRef = useRef<AssistantContext>({});
  const sendingRef = useRef(false);
  const nextIdRef = useRef(1);
  const lastSubmissionRef = useRef({ text: "", time: 0 });
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const previousProfileIdRef = useRef(profile?.id);

  const querySuggestions = draft.trim().length >= 2 ? getTortuguitaSuggestions(draft, courses) : [];
  const suggestions = (querySuggestions.length > 0
    ? querySuggestions
    : followUps.length > 0 ? followUps : initialSuggestions(page)).slice(0, 4);

  useEffect(() => {
    if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [open, messages]);

  useEffect(() => {
    // Opening another course changes the subject; later explicit chat questions
    // can still select a different course without changing the underlying page.
    if (activeCourseId !== undefined && courses.some(course => course.id === activeCourseId)) {
      contextRef.current = { ...contextRef.current, courseIds: [activeCourseId] };
    }
  }, [activeCourseId, courses]);

  useEffect(() => {
    // A new or removed local profile must not inherit another person's conversation.
    if (previousProfileIdRef.current !== profile?.id) {
      contextRef.current = {};
      setMessages([WELCOME]);
      setFollowUps([]);
      setDraft("");
      lastSubmissionRef.current = { text: "", time: 0 };
    }
    previousProfileIdRef.current = profile?.id;
  }, [profile?.id]);

  const resetConversation = () => {
    contextRef.current = {};
    setMessages([WELCOME]);
    setFollowUps([]);
    setDraft("");
    lastSubmissionRef.current = { text: "", time: 0 };
    inputRef.current?.focus();
  };

  const sendMessage = (value: string) => {
    const text = value.trim().slice(0, MAX_INPUT_LENGTH);
    if (!text || sendingRef.current) return;
    const now = Date.now();
    if (lastSubmissionRef.current.text === text && now - lastSubmissionRef.current.time < 750) return;
    lastSubmissionRef.current = { text, time: now };
    sendingRef.current = true;
    setSending(true);
    const userMessage: ChatMessage = { id: nextIdRef.current++, role: "user", text };

    try {
      const reply = answerTortuguita(text, {
        courses,
        contacts,
        context: contextRef.current,
        page,
        activeCourseId,
        // Questions about inscriptions need only course IDs and dates.
        profile: profile ? {
          enrolledCourseIds: profile.enrolledCourseIds,
          enrollments: profile.enrollments,
          enrollmentHistory: profile.enrollmentHistory,
        } : null,
      });
      contextRef.current = reply.context;
      const response: ChatMessage = { id: nextIdRef.current++, role: "assistant", text: reply.text, actions: reply.actions };
      setMessages(current => [...current, userMessage, response].slice(-MAX_MESSAGES));
      setFollowUps(reply.suggestions);
      if (reply.navigation) {
        const { courseId, page: destination } = reply.navigation;
        const alreadyThere = courseId !== undefined
          ? page === "course-detail" && activeCourseId === courseId
          : page === destination;
        if (!alreadyThere) followAction(reply.navigation);
      }
    } catch {
      setMessages(current => [...current, userMessage, {
        id: nextIdRef.current++,
        role: "assistant" as const,
        text: "Não consegui responder a esta pergunta. Tente reformular ou abra Contato para buscar orientação.",
        actions: [{ label: "Abrir Contato", page: "contato" as const }],
      }].slice(-MAX_MESSAGES));
      setFollowUps(["Como entro em contato?", "Quero ajuda para escolher um curso"]);
    } finally {
      setDraft("");
      sendingRef.current = false;
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendMessage(draft);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendMessage(draft);
    }
  };

  const followAction = (action: AssistantAction) => {
    if (action.courseId !== undefined) {
      const course = courses.find(item => item.id === action.courseId);
      if (!course) return;
      onViewCourse(course);
    } else if (action.page) {
      onNavigate(action.page);
    } else return;
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          ref={launcherRef}
          type="button"
          aria-label="Abrir assistente virtual"
          className="fixed bottom-5 right-5 z-40 flex h-[74px] w-[74px] items-center justify-center rounded-full border-2 border-white bg-blue-700 shadow-xl transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          <span aria-hidden="true"><TurtleMascot size={64} /></span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-slate-950/25" />
        <Dialog.Content
          className="fixed bottom-4 right-4 z-[70] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[430px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl sm:bottom-24 sm:max-h-[calc(100dvh-7rem)]"
          style={{ height: "min(700px, calc(100dvh - 2rem))" }}
          onOpenAutoFocus={event => { event.preventDefault(); inputRef.current?.focus(); }}
          onCloseAutoFocus={event => { event.preventDefault(); launcherRef.current?.focus(); }}
          aria-describedby="tortuguita-description"
        >
          <div className="flex shrink-0 items-center gap-3 bg-gradient-to-r from-blue-900 to-blue-700 px-4 py-4 text-white">
            <span aria-hidden="true" className="shrink-0 rounded-2xl bg-white/15 p-1"><TurtleMascot size={46} /></span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-extrabold text-white">Tortuguita</Dialog.Title>
              <Dialog.Description id="tortuguita-description" className="mt-0.5 text-xs text-blue-100">Sua assistente sobre o Qualifica Vix</Dialog.Description>
            </div>
            <button type="button" aria-label="Reiniciar conversa" title="Reiniciar conversa" onClick={resetConversation}
              className="rounded-lg p-2 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
            <Dialog.Close asChild>
              <button type="button" aria-label="Fechar assistente virtual" className="rounded-lg p-2 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div ref={logRef} role="log" aria-label="Conversa com a Tortuguita" aria-live="polite" aria-relevant="additions text"
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-slate-50 px-4 py-5">
            {messages.map(message => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[94%] min-w-0 rounded-2xl px-4 py-3 ${message.role === "user" ? "rounded-br-md bg-blue-700 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700"}`}>
                  <span className="sr-only">{message.role === "user" ? "Você: " : "Tortuguita: "}</span>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed" style={{ overflowWrap: "anywhere" }}>{message.text}</p>
                  {message.actions && message.actions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.actions.map((action, index) => (
                        <button key={`${action.label}-${index}`} type="button" onClick={() => followAction(action)}
                          className="flex max-w-full items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-left text-xs font-bold text-slate-800 hover:border-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600">
                          <span className="min-w-0 break-words">{action.label}</span><ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {messages.length === 1 && (
              <details className="rounded-xl border border-slate-200 bg-white p-3 text-slate-600">
                <summary className="cursor-pointer text-xs font-bold">Com o que posso ajudar?</summary>
                <ul className="mt-3 space-y-2 pl-4 text-xs leading-relaxed">
                  {ASSISTANT_CAPABILITIES.map(capability => <li key={capability} className="list-disc">{capability}</li>)}
                </ul>
              </details>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white px-4 pb-4 pt-3">
            <div className="mb-2 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              <Sparkles className="h-3 w-3" aria-hidden="true" />{querySuggestions.length > 0 ? "Sugestões para sua pergunta" : "Continue a conversa"}
            </div>
            <div className="mb-3 flex max-h-24 flex-wrap gap-2 overflow-y-auto" aria-label="Perguntas sugeridas">
              {suggestions.map(suggestion => (
                <button key={suggestion} type="button" onClick={() => sendMessage(suggestion)} disabled={sending}
                  className="max-w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs leading-snug text-slate-700 hover:border-blue-400 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50">
                  {suggestion}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <textarea ref={inputRef} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={handleInputKeyDown}
                aria-label="Sua dúvida ou busca" aria-describedby="tortuguita-input-help" maxLength={MAX_INPUT_LENGTH} rows={2}
                placeholder="Escreva sua dúvida…" className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-2 focus:outline-blue-600" />
              <button type="submit" disabled={!draft.trim() || sending} aria-label="Enviar mensagem"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-40">
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
            <div id="tortuguita-input-help" className="mt-2 flex justify-between gap-2 text-[10px] text-slate-500">
              <span>Enter envia · Shift + Enter quebra a linha</span><span aria-live="off">{draft.length}/{MAX_INPUT_LENGTH}</span>
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-500"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />Não envie CPF, senhas ou documentos. Esta conversa fica apenas enquanto a página estiver aberta.</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
