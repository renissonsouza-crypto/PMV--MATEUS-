import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, Maximize2, Minimize2, MoveDiagonal2, RotateCcw, Send, Settings2, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
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
import { useChatWindow } from "../hooks/useChatWindow";
import { TurtleMascot } from "./TurtleMascot";
import { adaptChatReply, forgetChatFeedback, learningConsentKey, readLearningConsent, sendChatFeedback, storeLearningConsent, type FeedbackReason, type LearningTicket } from '../services/chatLearning';

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
  const { size, viewport, expanded, toggleExpanded, resetSize, resizeHandle } = useChatWindow(open);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(restored.memory.messages.length ? restored.memory.messages : [WELCOME]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [lastReplyIntent, setLastReplyIntent] = useState('');
  const [sending, setSending] = useState(false);
  const [helpful, setHelpful] = useState(false);
  const [learningEnabled, setLearningEnabled] = useState(() => readLearningConsent(profile?.id ?? null));
  const learningEnabledRef = useRef(learningEnabled);
  const [learningNotice, setLearningNotice] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [negativeFeedback, setNegativeFeedback] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [learningTicket, setLearningTicket] = useState<(LearningTicket & { messageId: number }) | null>(null);
  const [forgetBusy, setForgetBusy] = useState(false);
  const feedbackLock = useRef(false);
  const lastAnswerId = useRef(0);
  const operation = useRef(0);
  const sendingRef = useRef(false);
  const nextIdRef = useRef(Math.max(0, ...restored.memory.messages.map(item => item.id)) + 1);
  const lastSubmissionRef = useRef({ text: "", time: 0 });
  const launcherRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
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
  useEffect(() => () => { operation.current++; }, []);
  useEffect(() => {
    const syncConsent = (event: StorageEvent) => {
      if (event.key !== null && event.key !== learningConsentKey(profile?.id ?? null)) return;
      const enabled = readLearningConsent(profile?.id ?? null);
      learningEnabledRef.current = enabled; setLearningEnabled(enabled); setLearningTicket(null);
      setLearningNotice(enabled ? 'Aprendizado ativado em outra aba para as próximas respostas.' : 'Aprendizado desativado em outra aba.');
    };
    window.addEventListener('storage', syncConsent);
    return () => window.removeEventListener('storage', syncConsent);
  }, [profile?.id]);
  useEffect(() => {
    if (sendingRef.current) { operation.current++; sendingRef.current = false; setSending(false); }
  }, [page, activeCourseId]);

  useEffect(() => {
    // A course opened manually becomes the subject and contributes to interests.
    if (activeCourseId !== undefined && courses.some(course => course.id === activeCourseId)) {
      const next = { ...memoryRef.current, context: { ...memoryRef.current.context, courseIds: [activeCourseId] } };
      commitMemory(profile ? rememberCourse(next, activeCourseId, "views") : next);
    }
  }, [activeCourseId, courses, profile?.id]);

  const resetConversation = () => {
    operation.current++; sendingRef.current = false; setSending(false);
    lastAnswerId.current = 0; setLearningTicket(null); setFeedbackMessage(''); setFeedbackError(''); setNegativeFeedback(false);
    setHelpful(false);
    commitMemory({ ...memoryRef.current, context: { preferences: memoryRef.current.context.preferences }, messages: [] });
    setMessages([WELCOME]);
    setFollowUps([]);
    setLastReplyIntent('');
    setDraft("");
    lastSubmissionRef.current = { text: "", time: 0 };
    inputRef.current?.focus();
  };

  const forgetMemory = () => {
    if (!profile || !window.confirm("Apagar as conversas, interesses e conclusões informadas à Tortuguita para este perfil neste navegador? Suas inscrições serão mantidas.")) return;
    const removed = clearAssistantMemory(profile.id);
    operation.current++; sendingRef.current = false; setSending(false);
    lastAnswerId.current = 0; setLearningTicket(null); setFeedbackMessage(''); setFeedbackError(''); setNegativeFeedback(false);
    const empty = emptyAssistantMemory(profile.id);
    memoryRef.current = empty;
    setMemory(empty);
    setMessages([WELCOME]);
    setFollowUps([]);
    setLastReplyIntent('');
    setDraft("");
    nextIdRef.current = 1;
    lastSubmissionRef.current = { text: "", time: 0 };
    setPersistent(removed);
    setMemoryNotice(removed ? "Memória deste perfil apagada. Suas inscrições foram mantidas." : "A memória foi limpa nesta página, mas o navegador não permitiu apagar os dados salvos. Libere o armazenamento e tente novamente antes de fechar.");
    inputRef.current?.focus();
  };

  const sendMessage = async (value: string) => {
    const text = value.trim().slice(0, MAX_INPUT_LENGTH);
    if (!text || sendingRef.current) return;
    const now = Date.now();
    if (lastSubmissionRef.current.text === text && now - lastSubmissionRef.current.time < 750) return;
    const requestId = ++operation.current;
    setHelpful(false); setDraft(''); setSuggestionsOpen(false);
    lastSubmissionRef.current = { text, time: now };
    setFeedbackMessage(''); setFeedbackError(''); setNegativeFeedback(false); setLearningTicket(null);
    lastAnswerId.current = 0;
    sendingRef.current = true;
    setSending(true);
    const userMessage: ChatMessage = { id: nextIdRef.current++, role: "user", text };

    try {
      let reply = answerTortuguita(text, {
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
      let ticket: LearningTicket | null = null;
      if (learningEnabledRef.current) {
        const adapted = await adaptChatReply(reply);
        if (requestId !== operation.current) return;
        if (learningEnabledRef.current) {
          reply = adapted.reply; ticket = adapted.ticket;
          setLearningNotice(adapted.unavailable ? 'O aprendizado está indisponível agora. A resposta revisada continua disponível.' : '');
        }
      }
      const response: ChatMessage = { id: nextIdRef.current++, role: "assistant", text: reply.text, actions: reply.actions };
      lastAnswerId.current = response.id;
      if (ticket && learningEnabledRef.current) setLearningTicket({ ...ticket, messageId: response.id });
      const nextMessages = [...messages, userMessage, response].slice(-MAX_CHAT_MESSAGES);
      commitMemory({ ...rememberReply(memoryRef.current, reply), messages: nextMessages });
      setMessages(nextMessages);
      setFollowUps(reply.suggestions);
      setLastReplyIntent(reply.intent);
      if (reply.navigation) {
        const { courseId, page: destination } = reply.navigation;
        const alreadyThere = courseId !== undefined
          ? page === "course-detail" && activeCourseId === courseId
          : page === destination;
        if (!alreadyThere) followAction(reply.navigation);
      }
    } catch {
      if (requestId !== operation.current) return;
      const nextMessages: ChatMessage[] = [...messages, userMessage, {
        id: nextIdRef.current++,
        role: "assistant" as const,
        text: "Não consegui responder a esta pergunta. Tente reformular ou abra Contato para buscar orientação.",
        actions: [{ label: "Abrir Contato", page: "contato" as const }],
      }].slice(-MAX_CHAT_MESSAGES);
      commitMemory({ ...memoryRef.current, messages: nextMessages });
      setMessages(nextMessages);
      setFollowUps(["Como entro em contato?", "Quero ajuda para escolher um curso"]);
      setLastReplyIntent('fallback');
    } finally {
      if (requestId === operation.current) {
        sendingRef.current = false;
        setSending(false);
        inputRef.current?.focus();
      }
    }
  };

  const evaluateResponse = async (reason: FeedbackReason) => {
    if (feedbackLock.current) return;
    const messageId = lastAnswerId.current;
    feedbackLock.current = true; setFeedbackBusy(true); setFeedbackError('');
    try {
      let saved = false;
      if (learningEnabledRef.current && learningTicket?.token && learningTicket.messageId === messageId) {
        await sendChatFeedback(learningTicket, reason); saved = true;
      }
      if (lastAnswerId.current !== messageId) return;
      setHelpful(reason === 'found'); setNegativeFeedback(false);
      setFeedbackMessage(reason === 'found'
        ? `Que bom que ajudou! Pode continuar a conversa.${saved ? ' Sua avaliação foi registrada para melhorar as orientações.' : ''}`
        : `${saved ? 'Avaliação registrada.' : 'Obrigado por avisar.'} ${reason === 'incorrect' ? (saved ? 'O tema foi sinalizado para revisão. Avaliações não alteram informações da plataforma.' : 'Podemos buscar a informação na tela ou no atendimento.') : 'Podemos tentar uma explicação diferente.'}`);
    } catch (error) {
      if (lastAnswerId.current === messageId) setFeedbackError(error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.');
    } finally { feedbackLock.current = false; setFeedbackBusy(false); }
  };

  const changeLearningConsent = (enabled: boolean) => {
    learningEnabledRef.current = enabled; setLearningEnabled(enabled);
    storeLearningConsent(profile?.id ?? null, enabled); setLearningTicket(null); setLearningNotice('');
    setLearningNotice(enabled ? 'Ativado para as próximas respostas. Faça uma nova pergunta e avalie se encontrou a informação.' : 'Aprendizado desativado. Você pode apagar as avaliações já enviadas abaixo.');
  };
  const forgetFeedback = async () => {
    if (forgetBusy) return;
    lastAnswerId.current = 0; setFeedbackMessage(''); setFeedbackError('');
    changeLearningConsent(false); setForgetBusy(true);
    try { await forgetChatFeedback(); setLearningNotice('Avaliações deste navegador apagadas do aprendizado.'); }
    catch { setLearningNotice('Não foi possível apagar as avaliações agora. Tente novamente.'); }
    finally { setForgetBusy(false); }
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
          className="tortuguita-launcher fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border-2 border-white bg-blue-700 py-1.5 pl-3.5 pr-1.5 text-white shadow-xl transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          <span aria-hidden="true" className="text-left"><span className="block text-sm font-bold">Tortuguita Vix</span><span className="block text-xs text-blue-100">Seu chatbot de cursos</span></span>
          <span aria-hidden="true"><TurtleMascot size={48} /></span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-slate-950/25" />
        <Dialog.Content
          data-compact={Math.min(viewport.height, expanded ? viewport.height : size.height) < 480 ? "true" : undefined}
          data-expanded={expanded ? "true" : undefined}
          className="tortuguita-panel fixed z-[70] flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
          style={{
            "--chat-width": `${size.width}px`, "--chat-height": `${size.height}px`,
            "--chat-viewport-width": `${viewport.width}px`,
            ...(viewport.height > 0 ? { "--chat-viewport-height": `${viewport.height}px`, "--chat-keyboard-inset": `${viewport.inset}px` } : {}),
          } as CSSProperties}
          onOpenAutoFocus={event => {
            event.preventDefault();
            // Leave the introduction visible until the person chooses to type on a phone.
            if (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 640) titleRef.current?.focus();
            else inputRef.current?.focus();
          }}
          onCloseAutoFocus={event => { event.preventDefault(); launcherRef.current?.focus(); }}
          aria-describedby="tortuguita-description"
        >
          <button type="button" {...resizeHandle} aria-label="Redimensionar janela do chat"
            aria-describedby="chat-resize-help" title="Arraste para ajustar o tamanho ou use as setas do teclado"
            className="chat-resize-handle absolute left-0 top-0 z-10 flex h-7 w-7 items-center justify-center rounded-tl-3xl text-blue-100 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white">
            <MoveDiagonal2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span id="chat-resize-help" className="sr-only">Arraste o canto superior esquerdo. Setas para esquerda ou cima aumentam; direita ou baixo diminuem. Shift aumenta o passo.</span>
          <div className="chat-header flex shrink-0 items-center gap-1 bg-gradient-to-r from-blue-900 to-blue-700 px-4 py-3 text-white">
            <span aria-hidden="true" className="chat-avatar shrink-0 rounded-2xl bg-white/15 p-1"><TurtleMascot size={38} /></span>
            <div className="min-w-0 flex-1">
              <Dialog.Title ref={titleRef} tabIndex={-1} className="truncate text-base font-extrabold text-white">Tortuguita</Dialog.Title>
              <Dialog.Description id="tortuguita-description" className="mt-0.5 text-xs text-blue-100">Sua assistente sobre o Qualifica Vix</Dialog.Description>
            </div>
            <button type="button" aria-label="Opções do chat" title="Opções do chat" aria-expanded={optionsOpen} aria-controls="chat-options" onClick={() => setOptionsOpen(value => !value)} className="chat-toolbar-button rounded-lg p-2 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white">
              <Settings2 className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label={expanded ? "Restaurar tamanho do chat" : "Ampliar chat"} title={expanded ? "Restaurar tamanho do chat" : "Ampliar chat"} onClick={toggleExpanded} className="chat-toolbar-button rounded-lg p-2 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white">
              {expanded ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
            </button>
            <button type="button" aria-label="Reiniciar conversa" title="Reiniciar conversa" onClick={resetConversation}
              className="chat-toolbar-button rounded-lg p-2 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
            <Dialog.Close asChild>
              <button type="button" aria-label="Fechar assistente virtual" className="chat-toolbar-button rounded-lg p-2 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div id="chat-options" hidden={!optionsOpen} className="chat-context min-h-0 shrink-0 overflow-y-auto overscroll-contain">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2 text-xs">
              <span className="font-semibold text-slate-700">Preferências do chat</span>
              <button type="button" onClick={resetSize} className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700">Restaurar tamanho padrão</button>
            </div>
            <p className="px-4 py-2 text-xs text-slate-600">{profile ? "Sua memória fica neste navegador, separada por perfil." : "Sem perfil, a conversa fica apenas nesta página."}</p>
            <details className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-700">
              <summary className="min-h-11 cursor-pointer py-3 font-semibold">Melhorar a Tortuguita</summary>
              <p className="mt-2">Com sua permissão, suas avaliações ajudam a escolher entre explicações revisadas em texto ou por etapas. Enviamos apenas tema, formato e avaliação, sem perguntas, respostas ou dados do perfil. Você pode desativar e apagar suas avaliações.</p>
              <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2"><input type="checkbox" checked={learningEnabled} onChange={event => changeLearningConsent(event.target.checked)} />Permitir aprendizado com minhas avaliações</label>
              <button type="button" disabled={forgetBusy || sending} onClick={forgetFeedback} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold">{forgetBusy ? 'Apagando avaliações…' : 'Apagar minhas avaliações'}</button>
            </details>
            {profile && <details className="chat-memory border-b border-slate-200 bg-blue-50 px-4 py-2 text-xs text-slate-700">
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
          </div>

          <div ref={logRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-50 px-4 py-4">
            {learningNotice && <p role="status" className="text-xs text-slate-600">{learningNotice}</p>}
            {memoryNotice && <p role="status" className="text-xs text-slate-700">{memoryNotice}</p>}
            {profile && !persistent && <p role="status" className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">O navegador não permitiu salvar sua memória. Ela fica disponível somente enquanto esta página estiver aberta.</p>}
            <div role="log" aria-label="Conversa com a Tortuguita" aria-live="polite" aria-relevant="additions text" className="space-y-3">
              {messages.map(message => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[94%] min-w-0 rounded-2xl px-4 py-3 ${message.role === "user" ? "rounded-br-md bg-blue-700 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700"}`}>
                    <span className="sr-only">{message.role === "user" ? "Você: " : "Tortuguita: "}</span>
                    <p data-chat-message-text className="whitespace-pre-wrap break-words text-sm leading-relaxed" style={{ overflowWrap: "anywhere" }}>{message.text}</p>
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
                    {message.role === "assistant" && message.id !== 0 && message === messages[messages.length - 1] && !['greeting', 'thanks', 'acknowledgement', 'goodbye'].includes(lastReplyIntent) && (
                      <div className="chat-feedback mt-3 flex flex-wrap items-start gap-x-2 border-t border-slate-100 pt-2">
                        <details key={message.id} className="chat-rating text-xs">
                          <summary className="min-h-11 cursor-pointer py-3 font-semibold text-slate-600">Avaliar resposta</summary>
                        {learningEnabled && learningTicket?.messageId === message.id && learningTicket.token === null && <p className="mb-2 text-xs text-slate-500">Já recebemos sua avaliação deste tema hoje. Você ainda pode pedir outra explicação.</p>}
                        {feedbackMessage ? <p role="status" className="text-xs text-blue-700">{feedbackMessage}</p> : <div className="flex flex-wrap gap-2" aria-label="Avaliar esta resposta">
                          <button type="button" disabled={feedbackBusy} onClick={() => evaluateResponse('found')} className="min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Ajudou, obrigado</button>
                          <button type="button" disabled={feedbackBusy} onClick={() => setNegativeFeedback(value => !value)} className="min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Não ajudou</button>
                        </div>}
                        {negativeFeedback && !feedbackMessage && <div className="mt-2 flex flex-wrap gap-2" aria-label="O que faltou na resposta?">
                          {([['not_found', 'Não localizei a informação'], ['confusing', 'Resposta confusa'], ['incorrect', 'Informação incorreta']] as const).map(([reason, label]) => <button key={reason} type="button" disabled={feedbackBusy} onClick={() => evaluateResponse(reason)} className="min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-semibold">{label}</button>)}
                        </div>}
                        {feedbackError && <p role="alert" className="mt-2 text-xs text-red-700">{feedbackError}</p>}
                        </details>
                        {!helpful && <button type="button" disabled={feedbackBusy} onClick={() => sendMessage("Explique melhor")} className="min-h-11 rounded-lg px-2 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">Explicar melhor</button>}
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
              <button type="button" onClick={() => setSuggestionsOpen(value => !value)} aria-expanded={suggestionsOpen} aria-controls="chat-suggestions" className="mb-2 flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-blue-50">
                <Sparkles className="h-3 w-3" aria-hidden="true" />{suggestionsOpen ? "Recolher sugestões" : "Ver sugestões de perguntas"}
              </button>
              <div id="chat-suggestions" className="grid gap-2 sm:grid-cols-2" aria-label="Perguntas sugeridas">
                {(suggestionsOpen ? suggestions : messages.length === 1 || ['greeting', 'thanks', 'acknowledgement', 'guided-choice', 'conversation-repair', 'assistant-capabilities'].includes(lastReplyIntent) ? suggestions.slice(0, 2) : []).map(suggestion => (
                  <button key={suggestion} type="button" onClick={() => sendMessage(suggestion)} disabled={sending}
                    className="max-w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs leading-snug text-slate-700 hover:border-blue-400 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50">
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white px-4 pb-3 pt-3">
            {sending && <p role="status" className="mb-1 text-xs text-slate-500">Preparando sua orientação…</p>}
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <textarea ref={inputRef} value={draft} onChange={event => { setDraft(event.target.value); setSuggestionsOpen(event.target.value.trim().length >= 2); }} onKeyDown={handleInputKeyDown}
                aria-label="Sua dúvida ou busca" aria-describedby="tortuguita-input-help" maxLength={MAX_INPUT_LENGTH} rows={1}
                placeholder="Escreva sua dúvida…" className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-2 focus:outline-blue-600" />
              <button type="submit" disabled={!draft.trim() || sending} aria-label="Enviar mensagem"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-40">
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
            <div id="tortuguita-input-help" className="chat-input-help mt-2 flex justify-between gap-2 text-[10px] text-slate-500">
              <span>Enter envia · Shift + Enter quebra a linha</span><span aria-live="off">{draft.length}/{MAX_INPUT_LENGTH}</span>
            </div>
            <p className="chat-privacy mt-2 flex items-center gap-1.5 text-[11px] text-slate-500"><ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" />Não envie CPF, senhas ou documentos.</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
