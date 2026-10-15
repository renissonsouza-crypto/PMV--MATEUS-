import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, RotateCcw, Send, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { ASSISTANT_CAPABILITIES, QUICK_QUESTIONS } from "../data/tortuguitaKnowledge";
import type { Course } from "../models/Course";
import type { Page } from "../models/navigation";
import type { ContactChannel } from "../models/platformContact";
import type { UserProfile } from "../services/api";
import {
  answerTortuguita,
  getTortuguitaSuggestions,
  type AssistantAction,
} from "../services/tortuguita";
import {
  clearAssistantMemory, emptyAssistantMemory, loadAssistantMemory, MAX_CHAT_MESSAGES,
  mostSoughtCourses, rememberCourse, rememberReply, saveAssistantMemory,
  type AssistantMemory, type ChatMessage,
} from "../services/tortuguitaMemory";
import { TurtleMascot } from "./TurtleMascot";

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
const WELCOME: ChatMessage = {
  id: 0,
  role: "assistant",
  text: "Olá! Sou a Tortuguita Vix 🐢\nAjudo você a encontrar cursos, fazer seu cadastro e tirar dúvidas sobre a plataforma.\nComo posso ajudar hoje?",
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
  const [restored] = useState(() => loadAssistantMemory(profile?.id ?? null, courses));
  const [memory, setMemory] = useState(restored.memory);
  const memoryRef = useRef(restored.memory);
  const [persistent, setPersistent] = useState(restored.persistent);
  const [memoryNotice, setMemoryNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(restored.memory.messages.length ? restored.memory.messages : [WELCOME]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const nextIdRef = useRef(Math.max(0, ...restored.memory.messages.map(item => item.id)) + 1);
  const lastSubmissionRef = useRef({ text: "", time: 0 });
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const commitMemory = (next: AssistantMemory) => {
    memoryRef.current = next;
    setMemory(next);
    if (next.profileId !== null) setPersistent(saveAssistantMemory(next));
  };

  const querySuggestions = draft.trim().length >= 2 ? getTortuguitaSuggestions(draft, courses) : [];
  const suggestions = (querySuggestions.length > 0
    ? querySuggestions
    : followUps.length > 0 ? followUps : profile && memory.messages.length > 0
      ? ["Continuar de onde paramos", "Quais cursos mais procurei?", "Quais cursos já concluí?", "Recomende um curso para mim"]
      : initialSuggestions(page)).slice(0, 4);

  useEffect(() => {
    if (open && logRef.current) logRef.current.scrollTop = messages.length === 1 ? 0 : logRef.current.scrollHeight;
  }, [open, messages]);

  useEffect(() => {
    // A course opened manually becomes the subject and contributes to interests.
    if (activeCourseId !== undefined && courses.some(course => course.id === activeCourseId)) {
      const next = { ...memoryRef.current, context: { ...memoryRef.current.context, courseIds: [activeCourseId] } };
      commitMemory(profile ? rememberCourse(next, activeCourseId, "views") : next);
    }
  }, [activeCourseId, courses, profile?.id]);

  const resetConversation = () => {
    commitMemory({ ...memoryRef.current, context: { preferences: memoryRef.current.context.preferences }, messages: [] });
    setMessages([WELCOME]);
    setFollowUps([]);
    setDraft("");
    lastSubmissionRef.current = { text: "", time: 0 };
    inputRef.current?.focus();
  };

  const forgetMemory = () => {
    if (!profile || !window.confirm("Apagar as conversas, interesses e conclusões informadas à Tortuguita para este perfil neste navegador? Suas inscrições serão mantidas.")) return;
    const removed = clearAssistantMemory(profile.id);
    const empty = emptyAssistantMemory(profile.id);
    memoryRef.current = empty;
    setMemory(empty);
    setMessages([WELCOME]);
    setFollowUps([]);
    setDraft("");
    nextIdRef.current = 1;
    lastSubmissionRef.current = { text: "", time: 0 };
    setPersistent(removed);
    setMemoryNotice(removed ? "Memória deste perfil apagada. Suas inscrições foram mantidas." : "A memória foi limpa nesta página, mas o navegador não permitiu apagar os dados salvos. Libere o armazenamento e tente novamente antes de fechar.");
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
        context: memoryRef.current.context,
        memory: profile ? memoryRef.current : undefined,
        page,
        activeCourseId,
        // Questions about inscriptions need only course IDs and dates.
        profile: profile ? {
          enrolledCourseIds: profile.enrolledCourseIds,
          enrollments: profile.enrollments,
          enrollmentHistory: profile.enrollmentHistory,
        } : null,
      });
      const response: ChatMessage = { id: nextIdRef.current++, role: "assistant", text: reply.text, actions: reply.actions };
      const nextMessages = [...messages, userMessage, response].slice(-MAX_CHAT_MESSAGES);
      commitMemory({ ...rememberReply(memoryRef.current, reply), messages: nextMessages });
      setMessages(nextMessages);
      setFollowUps(reply.suggestions);
      if (reply.navigation) {
        const { courseId, page: destination } = reply.navigation;
        const alreadyThere = courseId !== undefined
          ? page === "course-detail" && activeCourseId === courseId
          : page === destination;
        if (!alreadyThere) followAction(reply.navigation);
      }
    } catch {
      const nextMessages: ChatMessage[] = [...messages, userMessage, {
        id: nextIdRef.current++,
        role: "assistant" as const,
        text: "Não consegui responder a esta pergunta. Tente reformular ou abra Contato para buscar orientação.",
        actions: [{ label: "Abrir Contato", page: "contato" as const }],
      }].slice(-MAX_CHAT_MESSAGES);
      commitMemory({ ...memoryRef.current, messages: nextMessages });
      setMessages(nextMessages);
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
          title="Converse com a Tortuguita Vix"
          aria-description="Chatbot da Tortuguita Vix para ajudar com cursos e cadastro"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border-2 border-white bg-blue-700 py-1.5 pl-3.5 pr-1.5 text-white shadow-xl transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          <span aria-hidden="true" className="text-left"><span className="block text-sm font-bold">Tortuguita Vix</span><span className="block text-xs text-blue-100">Seu chatbot de cursos</span></span>
          <span aria-hidden="true"><TurtleMascot size={48} /></span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-slate-950/25" />
        <Dialog.Content
          className="fixed bottom-4 right-4 z-[70] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[390px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl sm:bottom-24 sm:max-h-[calc(100dvh-7rem)]"
          style={{ height: "min(580px, calc(100dvh - 2rem))" }}
          onOpenAutoFocus={event => { event.preventDefault(); inputRef.current?.focus(); }}
          onCloseAutoFocus={event => { event.preventDefault(); launcherRef.current?.focus(); }}
          aria-describedby="tortuguita-description"
        >
          <div className="flex shrink-0 items-center gap-3 bg-gradient-to-r from-blue-900 to-blue-700 px-4 py-3 text-white">
            <span aria-hidden="true" className="shrink-0 rounded-2xl bg-white/15 p-1"><TurtleMascot size={38} /></span>
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

          {profile && <details className="shrink-0 max-h-52 overflow-y-auto border-b border-slate-200 bg-blue-50 px-4 py-2 text-xs text-slate-700">
            <summary className="cursor-pointer font-semibold">Sua memória com a Tortuguita</summary>
            <div className="mt-2 space-y-2">
              <div>Conversas e interesses deste perfil ficam neste navegador. Cursos concluídos são informações suas, sem comprovação de certificado.</div>
              <div className="font-semibold">Cursos mais consultados por você</div>
              {mostSoughtCourses(memory).slice(0, 3).map(item => <div key={item.courseId}>{courses.find(course => course.id === item.courseId)?.title} · {item.questions} perguntas · {item.views} visitas</div>)}
              {memory.interests.length === 0 && <div>Ainda não há consultas salvas.</div>}
              <div className="font-semibold">Conclusões informadas por você</div>
              <div>{courses.filter(course => memory.completedCourseIds.includes(course.id)).map(course => course.title).join(", ") || "Nenhuma. Para registrar, diga “já concluí Excel”, por exemplo."}</div>
              <button type="button" onClick={forgetMemory} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-2 font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700"><Trash2 className="h-3 w-3" aria-hidden="true" />Apagar minha memória</button>
            </div>
          </details>}
          {memoryNotice && <div role="status" className="shrink-0 px-4 py-2 text-xs text-slate-700">{memoryNotice}</div>}
          {profile && !persistent && <div role="status" className="shrink-0 bg-amber-50 px-4 py-2 text-xs text-amber-900">O navegador não permitiu salvar sua memória. Ela fica disponível somente enquanto esta página estiver aberta.</div>}

          <div ref={logRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-50 px-4 py-4">
            <div role="log" aria-label="Conversa com a Tortuguita" aria-live="polite" aria-relevant="additions text" className="space-y-3">
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
            </div>
            {messages.length === 1 && (
              <details className="rounded-xl border border-slate-200 bg-white p-3 text-slate-600">
                <summary className="cursor-pointer text-xs font-bold">Com o que posso ajudar?</summary>
                <ul className="mt-3 space-y-2 pl-4 text-xs leading-relaxed">
                  {ASSISTANT_CAPABILITIES.map(capability => <li key={capability} className="list-disc">{capability}</li>)}
                </ul>
              </details>
            )}
            <div className="pt-1">
              <div className="mb-2 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                <Sparkles className="h-3 w-3" aria-hidden="true" />{querySuggestions.length > 0 ? "Sugestões para sua pergunta" : messages.length === 1 ? "Comece por aqui" : "Continue a conversa"}
              </div>
              <div className="grid gap-2" aria-label="Perguntas sugeridas">
                {suggestions.map(suggestion => (
                  <button key={suggestion} type="button" onClick={() => sendMessage(suggestion)} disabled={sending}
                    className="max-w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs leading-snug text-slate-700 hover:border-blue-400 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50">
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white px-4 pb-3 pt-3">
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <textarea ref={inputRef} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={handleInputKeyDown}
                aria-label="Sua dúvida ou busca" aria-describedby="tortuguita-input-help" maxLength={MAX_INPUT_LENGTH} rows={1}
                placeholder="Escreva sua dúvida…" className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-2 focus:outline-blue-600" />
              <button type="submit" disabled={!draft.trim() || sending} aria-label="Enviar mensagem"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-40">
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
            <div id="tortuguita-input-help" className="mt-2 flex justify-between gap-2 text-[10px] text-slate-500">
              <span>Enter envia · Shift + Enter quebra a linha</span><span aria-live="off">{draft.length}/{MAX_INPUT_LENGTH}</span>
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-500"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />Não envie CPF, senhas ou documentos. {profile ? "Sua memória fica neste navegador, separada por perfil. Você pode apagá-la acima." : "Sem perfil, a conversa fica apenas nesta página."}</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
