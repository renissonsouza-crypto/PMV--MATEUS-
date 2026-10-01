import { useState } from "react";
import { useForm } from "react-hook-form";
import qualificaVixLogo from "../../assets/qualifica-vix-logo.svg";
import { createRegistration, saveUserProfile, type UserProfile } from "../services/api";
import {
  ArrowLeft, ArrowRight, User, MapPin, HeartHandshake,
  ShieldCheck, CheckCircle2, Eye, EyeOff, Info, AlertCircle,
  ChevronDown, GraduationCap, Phone, Mail, FileText, Home,
  Users, DollarSign, Loader2,
} from "lucide-react";

// ─── Paleta (mesma do site principal) ───────────────────────────────────────
const BLUE     = "#0057d9";
const BLUE_MID = "#0078ce";
const RED      = "#ff8500";
const RED_LIGHT= "#ffb21a";
const GOLD     = "#ff8500";
const GOLD_LIGHT="#ffb21a";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface RegisterData {
  // Passo 1 — Dados Pessoais
  nome: string;
  cpf: string;
  dataNascimento: string;
  sexo: string;
  telefone: string;
  whatsapp: string;
  email: string;
  emailConfirm: string;
  escolaridade: string;
  situacaoEmprego: string;
  // Passo 2 — Endereço + Responsável Legal
  cep: string;
  bairro: string;
  rua: string;
  numero: string;
  complemento: string;
  // Responsável legal
  menorDeIdade: boolean;
  nomeResponsavel: string;
  cpfResponsavel: string;
  grauParentesco: string;
  telefoneResponsavel: string;
  // Passo 3 — Acessibilidade & Renda
  possuiDeficiencia: string;
  tiposDeficiencia: string[];
  necessitaAdaptacao: string;
  tiposAdaptacao: string;
  rendaFamiliar: string;
  numeroDependentes: string;
  beneficioProgramaSocial: string;
  quaisBeneficios: string;
  // Passo 4 — LGPD & Consentimentos
  autorizaImagem: boolean;
  autorizaDados: boolean;
  aceitaTermos: boolean;
  receberNotificacoes: boolean;
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

function FieldWrap({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-1 ${className}`}>{children}</div>;
}

function Input({
  reg, placeholder, type = "text", error, mask,
}: {
  reg: any; placeholder?: string; type?: string; error?: string; mask?: string;
}) {
  const [showPwd, setShowPwd] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="relative">
      <input
        {...reg}
        type={isPassword ? (showPwd ? "text" : "password") : type}
        placeholder={placeholder}
        className={`w-full px-4 py-3 rounded-xl border-2 text-sm font-medium outline-none transition-all bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 ${
          error
            ? "border-red-400 focus:border-red-500"
            : "border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-400"
        }`}
      />
      {isPassword && (
        <button type="button" onClick={() => setShowPwd(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
          {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500 font-semibold mt-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}

function Select({ reg, children, error }: { reg: any; children: React.ReactNode; error?: string }) {
  return (
    <div className="relative">
      <select
        {...reg}
        className={`w-full px-4 py-3 rounded-xl border-2 text-sm font-medium outline-none transition-all appearance-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 cursor-pointer ${
          error
            ? "border-red-400 focus:border-red-500"
            : "border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-400"
        }`}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500 font-semibold mt-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 p-3.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-700 dark:text-blue-300 font-medium leading-relaxed">
      <Info className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_MID} 100%)` }}>
        <Icon className="w-5 h-5 text-amber-300" />
      </div>
      <div>
        <h3 className="font-black text-slate-900 dark:text-white text-base leading-tight">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Passos ───────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Dados Pessoais",   icon: User },
  { id: 2, label: "Endereço",         icon: Home },
  { id: 3, label: "Acessibilidade",   icon: HeartHandshake },
  { id: 4, label: "Privacidade",      icon: ShieldCheck },
];

// ─── Componente principal ─────────────────────────────────────────────────────
export function RegisterPage({ onBack, dark, courseId, onProfileCreated }: { onBack: () => void; dark: boolean; courseId?: number; onProfileCreated: (profile: UserProfile) => void }) {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [menorDeIdade, setMenorDeIdade] = useState(false);
  const [possuiDeficiencia, setPossuiDeficiencia] = useState("nao");
  const [beneficio, setBeneficio] = useState("nao");
  const [submissionError, setSubmissionError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    trigger,
    getValues,
    setValue,
    setError,
    clearErrors,
  } = useForm<RegisterData>({ mode: "onBlur" });

  // Verifica se é menor ao mudar data de nascimento
  function checkMinor(date: string) {
    if (!date) return;
    const birth = new Date(date);
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    const dayDiff = today.getDate() - birth.getDate();
    const realAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
    setMenorDeIdade(realAge < 18);
  }

  async function validateVitoriaCep(value: string) {
    const cepDigits = value.replace(/\D/g, "");
    if (!/^\d{8}$/.test(cepDigits)) {
      return "CEP inválido";
    }

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
      const data = await response.json();

      if (data.erro || !data.localidade || !data.uf) {
        return "CEP não encontrado. Verifique o valor informado.";
      }

      const localidade = String(data.localidade).trim().toLowerCase();
      const uf = String(data.uf).trim().toUpperCase();
      const isVitoria = uf === "ES" && (localidade === "vitoria" || localidade === "vitória");

      if (!isVitoria) {
        return "A plataforma aceita apenas CEPs da cidade de Vitória-ES. Seu cadastro será bloqueado se o endereço não pertencer à cidade.";
      }

      setValue("bairro", String(data.bairro ?? "").trim(), { shouldValidate: true });
      setValue("rua", String(data.logradouro ?? "").trim(), { shouldValidate: true });
      clearErrors("cep");
      return true;
    } catch (error) {
      return "Não foi possível validar o CEP no momento. Tente novamente.";
    }
  }

  // Navega para o próximo passo com validação
  async function nextStep() {
    const fields: Record<number, (keyof RegisterData)[]> = {
      1: ["nome", "cpf", "dataNascimento", "sexo", "telefone", "email", "emailConfirm", "escolaridade"],
      2: menorDeIdade
        ? ["cep", "bairro", "rua", "numero", "nomeResponsavel", "cpfResponsavel", "grauParentesco", "telefoneResponsavel"]
        : ["cep", "bairro", "rua", "numero"],
      3: [],
    };
    const valid = await trigger(fields[step] ?? []);
    if (valid) setStep(s => Math.min(s + 1, 4));
  }

  async function onSubmit(data: RegisterData) {
    setSubmissionError("");
    try {
      const result = await createRegistration(data as unknown as Record<string, unknown>);
      const profile = saveUserProfile(data as unknown as Record<string, unknown>, result.id, courseId);
      onProfileCreated(profile);
      setSubmitted(true);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Não foi possível concluir o cadastro");
    }
  }

  if (submitted) {
    return (
      <div className={dark ? "dark" : ""}>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl"
              style={{ background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_MID} 100%)` }}>
              <CheckCircle2 className="w-12 h-12 text-amber-300" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3">
              Cadastro realizado!
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              Seu perfil foi criado. Você pode atualizar seus dados e usá-los para se inscrever em outros cursos sem preencher o cadastro novamente.
            </p>
            <button onClick={onBack}
              className="font-black text-white px-8 py-3.5 rounded-2xl shadow-lg hover:scale-105 transition-all inline-flex items-center gap-2"
              style={{ background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_MID} 100%)` }}>
              <ArrowLeft className="w-5 h-5" /> Voltar ao início
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={dark ? "dark" : ""} style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">

        {/* ─── Header da página ─── */}
        <div className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-sm">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center gap-4 py-4">
            <button onClick={onBack}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Voltar">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <img src={qualificaVixLogo} alt="Qualifica Vix" className="w-20 h-12 object-contain" />
            <div className="ml-auto text-right hidden sm:block">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Cadastro de usuário</p>
              <p className="text-[11px] text-slate-400 font-medium">Passo {step} de {STEPS.length}</p>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-20">

          {/* ─── Indicador de progresso ─── */}
          <div className="mb-8">
            {/* Barra de progresso */}
            <div className="flex items-center justify-between relative mb-4">
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-700 z-0" />
              <div
                className="absolute top-5 left-0 h-0.5 z-10 transition-all duration-500"
                style={{
                  background: `linear-gradient(90deg, ${BLUE} 0%, ${BLUE_MID} 100%)`,
                  width: `${((step - 1) / (STEPS.length - 1)) * 100}%`,
                }}
              />
              {STEPS.map((s) => {
                const done = step > s.id;
                const active = step === s.id;
                return (
                  <div key={s.id} className="flex flex-col items-center gap-2 z-20">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2 font-black text-sm shadow ${
                        done ? "border-transparent text-white" :
                        active ? "border-transparent text-white scale-110 shadow-lg" :
                        "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400"
                      }`}
                      style={done || active ? {
                        background: `linear-gradient(135deg, ${done ? GOLD : BLUE} 0%, ${done ? GOLD_LIGHT : BLUE_MID} 100%)`
                      } : {}}
                    >
                      {done ? <CheckCircle2 className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                    </div>
                    <span className={`text-[11px] font-bold transition-colors hidden sm:block ${
                      active ? "text-blue-700 dark:text-blue-400" : done ? "text-amber-600 dark:text-amber-400" : "text-slate-400"
                    }`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── Formulário ─── */}
          {submissionError && (
            <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {submissionError}
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 sm:p-8">

                {/* ══════════════ PASSO 1: DADOS PESSOAIS ══════════════ */}
                {step === 1 && (
                  <div className="space-y-5">
                    <SectionTitle icon={User} title="Dados Pessoais"
                      subtitle="Informe seus dados de identificação. Todos os campos marcados com * são obrigatórios." />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FieldWrap className="sm:col-span-2">
                        <Label required>Nome completo</Label>
                        <Input reg={register("nome", { required: "Nome obrigatório" })}
                          placeholder="Seu nome completo" error={errors.nome?.message} />
                      </FieldWrap>

                      <FieldWrap>
                        <Label required>CPF</Label>
                        <Input reg={register("cpf", {
                          required: "CPF obrigatório",
                          pattern: { value: /^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/, message: "CPF inválido" }
                        })}
                          placeholder="000.000.000-00" error={errors.cpf?.message} />
                      </FieldWrap>

                      <FieldWrap>
                        <Label required>Data de nascimento</Label>
                        <Input reg={register("dataNascimento", {
                          required: "Data obrigatória",
                          onChange: (e: any) => checkMinor(e.target.value),
                        })}
                          type="date" error={errors.dataNascimento?.message} />
                        {menorDeIdade && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Menor de idade — dados do responsável obrigatórios no passo 2
                          </p>
                        )}
                      </FieldWrap>

                      <FieldWrap>
                        <Label required>Sexo</Label>
                        <Select reg={register("sexo", { required: "Campo obrigatório" })} error={errors.sexo?.message}>
                          <option value="">Selecione...</option>
                          <option>Masculino</option>
                          <option>Feminino</option>
                          <option>Não-binário</option>
                          <option>Prefiro não informar</option>
                        </Select>
                      </FieldWrap>

                      <FieldWrap>
                        <Label required>Telefone / WhatsApp</Label>
                        <Input reg={register("telefone", { required: "Telefone obrigatório" })}
                          placeholder="(27) 99999-0000" type="tel" error={errors.telefone?.message} />
                      </FieldWrap>

                      <FieldWrap>
                        <Label required>E-mail para contato</Label>
                        <Input reg={register("email", {
                          required: "E-mail obrigatório",
                          pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "E-mail inválido" }
                        })}
                          placeholder="seu@email.com" type="email" error={errors.email?.message} />
                      </FieldWrap>

                      <FieldWrap>
                        <Label required>Confirmar e-mail</Label>
                        <Input reg={register("emailConfirm", {
                          required: "Confirmação obrigatória",
                          validate: v => v === getValues("email") || "Os e-mails não coincidem",
                        })}
                          placeholder="Repita seu e-mail" type="email" error={errors.emailConfirm?.message} />
                      </FieldWrap>

                      <FieldWrap>
                        <Label required>Escolaridade</Label>
                        <Select reg={register("escolaridade", { required: "Campo obrigatório" })} error={errors.escolaridade?.message}>
                          <option value="">Selecione...</option>
                          <option>Ensino fundamental incompleto</option>
                          <option>Ensino fundamental completo</option>
                          <option>Ensino médio incompleto</option>
                          <option>Ensino médio completo</option>
                          <option>Ensino técnico</option>
                          <option>Ensino superior incompleto</option>
                          <option>Ensino superior completo</option>
                          <option>Pós-graduação / MBA</option>
                        </Select>
                      </FieldWrap>

                      <FieldWrap>
                        <Label required>Situação profissional atual</Label>
                        <Select reg={register("situacaoEmprego", { required: "Campo obrigatório" })} error={errors.situacaoEmprego?.message}>
                          <option value="">Selecione...</option>
                          <option>Empregado com carteira assinada</option>
                          <option>Autônomo / Freelancer</option>
                          <option>Desempregado</option>
                          <option>Primeiro emprego</option>
                          <option>Estudante</option>
                          <option>Aposentado / Pensionista</option>
                          <option>Empreendedor</option>
                        </Select>
                      </FieldWrap>
                    </div>
                  </div>
                )}

                {/* ══════════════ PASSO 2: ENDEREÇO + RESPONSÁVEL ══════════════ */}
                {step === 2 && (
                  <div className="space-y-6">
                    <SectionTitle icon={Home} title="Endereço de Moradia"
                      subtitle="Informe seu endereço residencial atual." />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FieldWrap>
                        <Label required>CEP</Label>
                        <Input reg={register("cep", {
                          required: "CEP obrigatório",
                          pattern: { value: /^\d{5}-?\d{3}$/, message: "CEP inválido" },
                          validate: async value => await validateVitoriaCep(String(value ?? ""))
                        })}
                          placeholder="29000-000" error={errors.cep?.message} />
                      </FieldWrap>

                      <FieldWrap>
                        <Label required>Bairro</Label>
                        <Input reg={register("bairro", { required: "Bairro obrigatório" })}
                          placeholder="Praia do Canto" error={errors.bairro?.message} />
                      </FieldWrap>

                      <FieldWrap className="sm:col-span-2">
                        <Label required>Logradouro / Rua</Label>
                        <Input reg={register("rua", { required: "Rua obrigatória" })}
                          placeholder="Av. Marechal Mascarenhas de Moraes" error={errors.rua?.message} />
                      </FieldWrap>

                      <FieldWrap>
                        <Label required>Número</Label>
                        <Input reg={register("numero", { required: "Número obrigatório" })}
                          placeholder="1927" error={errors.numero?.message} />
                      </FieldWrap>

                      <FieldWrap>
                        <Label>Complemento</Label>
                        <Input reg={register("complemento")} placeholder="Apto 201, Bloco B..." />
                      </FieldWrap>
                    </div>

                    {/* Responsável Legal */}
                    <div>
                      <div className="flex items-center gap-3 mb-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: menorDeIdade ? `linear-gradient(135deg, ${RED} 0%, ${RED_LIGHT} 100%)` : `${BLUE}20` }}>
                          <Users className={`w-5 h-5 ${menorDeIdade ? "text-white" : "text-slate-400"}`} />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 dark:text-white text-base">Responsável Legal</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {menorDeIdade
                              ? "⚠️ Obrigatório — candidato menor de idade"
                              : "Opcional — preencha apenas se o candidato for menor de 18 anos"}
                          </p>
                        </div>
                      </div>

                      {menorDeIdade && (
                        <InfoBox>
                          Como o candidato tem menos de 18 anos, os dados do responsável legal são obrigatórios
                          e o responsável deverá assinar a autorização de matrícula presencialmente na unidade.
                        </InfoBox>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <FieldWrap className="sm:col-span-2">
                          <Label required={menorDeIdade}>Nome completo do responsável</Label>
                          <Input reg={register("nomeResponsavel", {
                            required: menorDeIdade ? "Obrigatório para menor de idade" : false
                          })}
                            placeholder="Nome do pai, mãe ou responsável legal"
                            error={errors.nomeResponsavel?.message} />
                        </FieldWrap>

                        <FieldWrap>
                          <Label required={menorDeIdade}>CPF do responsável</Label>
                          <Input reg={register("cpfResponsavel", {
                            required: menorDeIdade ? "Obrigatório para menor de idade" : false,
                            pattern: menorDeIdade
                              ? { value: /^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/, message: "CPF do responsável inválido" }
                              : undefined,
                          })}
                            placeholder="000.000.000-00" error={errors.cpfResponsavel?.message} />
                        </FieldWrap>

                        <FieldWrap>
                          <Label required={menorDeIdade}>Grau de parentesco</Label>
                          <Select reg={register("grauParentesco", {
                            required: menorDeIdade ? "Obrigatório" : false
                          })} error={errors.grauParentesco?.message}>
                            <option value="">Selecione...</option>
                            <option>Pai</option>
                            <option>Mãe</option>
                            <option>Avô / Avó</option>
                            <option>Irmão / Irmã</option>
                            <option>Tutor legal</option>
                            <option>Outro</option>
                          </Select>
                        </FieldWrap>

                        <FieldWrap>
                          <Label required={menorDeIdade}>Telefone do responsável</Label>
                          <Input reg={register("telefoneResponsavel", {
                            required: menorDeIdade ? "Obrigatório para menor de idade" : false
                          })}
                            placeholder="(27) 99999-0000" type="tel"
                            error={errors.telefoneResponsavel?.message} />
                        </FieldWrap>
                      </div>
                    </div>
                  </div>
                )}

                {/* ══════════════ PASSO 3: ACESSIBILIDADE & RENDA ══════════════ */}
                {step === 3 && (
                  <div className="space-y-6">
                    <SectionTitle icon={HeartHandshake} title="Acessibilidade & Renda Familiar"
                      subtitle="Estas informações são usadas para garantir melhor atendimento e inclusão." />

                    <InfoBox>
                      As informações de deficiência e renda são coletadas exclusivamente para fins de
                      acessibilidade, adaptação de recursos e métricas de impacto social. Nunca serão
                      usadas para discriminação ou restrição de acesso.
                    </InfoBox>

                    {/* Deficiência */}
                    <div>
                      <h4 className="font-black text-slate-800 dark:text-slate-200 text-sm mb-3 flex items-center gap-2">
                        <HeartHandshake className="w-4 h-4" style={{ color: BLUE }} />
                        Deficiência e/ou necessidades especiais
                      </h4>
                      <FieldWrap>
                        <Label>Você possui alguma deficiência ou necessidade especial?</Label>
                        <div className="flex flex-wrap gap-3">
                          {["nao", "sim"].map(v => (
                            <label key={v} className={`flex items-center gap-2.5 px-5 py-3 rounded-xl border-2 cursor-pointer transition-all font-bold text-sm select-none ${
                              possuiDeficiencia === v
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300"
                            }`}>
                              <input type="radio" {...register("possuiDeficiencia")}
                                value={v} className="sr-only"
                                onChange={() => setPossuiDeficiencia(v)} />
                              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                possuiDeficiencia === v ? "border-blue-500" : "border-slate-300"
                              }`}>
                                {possuiDeficiencia === v && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                              </span>
                              {v === "nao" ? "Não" : "Sim"}
                            </label>
                          ))}
                        </div>
                      </FieldWrap>

                      {possuiDeficiencia === "sim" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800">
                          <FieldWrap>
                            <Label>Tipo de deficiência</Label>
                            <Select reg={register("tiposDeficiencia")}>
                              <option value="">Selecione o tipo...</option>
                              <option>Deficiência física</option>
                              <option>Deficiência visual</option>
                              <option>Deficiência auditiva / surdez</option>
                              <option>Deficiência intelectual</option>
                              <option>Deficiência múltipla</option>
                              <option>Transtorno do espectro autista (TEA)</option>
                              <option>Superdotação / Altas habilidades</option>
                              <option>Outra</option>
                            </Select>
                          </FieldWrap>

                          <FieldWrap>
                            <Label>Necessita de adaptações especiais?</Label>
                            <Select reg={register("necessitaAdaptacao")}>
                              <option value="">Selecione...</option>
                              <option>Não necessito de adaptações</option>
                              <option>Intérprete de Libras</option>
                              <option>Material em Braille</option>
                              <option>Acessibilidade em cadeira de rodas</option>
                              <option>Tempo ampliado para atividades</option>
                              <option>Sala acessível no térreo</option>
                              <option>Outro recurso</option>
                            </Select>
                          </FieldWrap>

                          <FieldWrap className="sm:col-span-2">
                            <Label>Descreva suas necessidades (opcional)</Label>
                            <textarea
                              {...register("tiposAdaptacao")}
                              rows={3}
                              placeholder="Descreva como podemos melhor te atender..."
                              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 focus:border-blue-500 text-sm font-medium outline-none resize-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition-all"
                            />
                          </FieldWrap>
                        </div>
                      )}
                    </div>

                    {/* Renda Familiar */}
                    <div>
                      <h4 className="font-black text-slate-800 dark:text-slate-200 text-sm mb-3 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" style={{ color: GOLD }} />
                        Renda e Situação Socioeconômica
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FieldWrap>
                          <Label>Faixa de renda familiar mensal</Label>
                          <Select reg={register("rendaFamiliar")}>
                            <option value="">Selecione a faixa...</option>
                            <option>Até R$ 500 (sem renda)</option>
                            <option>De R$ 500 a R$ 1.412 (até 1 salário mínimo)</option>
                            <option>De R$ 1.412 a R$ 2.824 (1 a 2 salários)</option>
                            <option>De R$ 2.824 a R$ 5.648 (2 a 4 salários)</option>
                            <option>De R$ 5.648 a R$ 11.296 (4 a 8 salários)</option>
                            <option>Acima de R$ 11.296 (mais de 8 salários)</option>
                            <option>Prefiro não informar</option>
                          </Select>
                        </FieldWrap>

                        <FieldWrap>
                          <Label>Número de pessoas que dependem desta renda</Label>
                          <Select reg={register("numeroDependentes")}>
                            <option value="">Selecione...</option>
                            <option>Apenas eu</option>
                            <option>2 pessoas</option>
                            <option>3 pessoas</option>
                            <option>4 pessoas</option>
                            <option>5 ou mais pessoas</option>
                          </Select>
                        </FieldWrap>

                        <FieldWrap className="sm:col-span-2">
                          <Label>Você é beneficiário de algum programa social?</Label>
                          <div className="flex flex-wrap gap-3">
                            {["nao", "sim"].map(v => (
                              <label key={v} className={`flex items-center gap-2.5 px-5 py-3 rounded-xl border-2 cursor-pointer transition-all font-bold text-sm select-none ${
                                beneficio === v
                                  ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-300"
                              }`}>
                                <input type="radio" {...register("beneficioProgramaSocial")}
                                  value={v} className="sr-only"
                                  onChange={() => setBeneficio(v)} />
                                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  beneficio === v ? "border-amber-500" : "border-slate-300"
                                }`}>
                                  {beneficio === v && <span className="w-2 h-2 rounded-full bg-amber-500" />}
                                </span>
                                {v === "nao" ? "Não" : "Sim"}
                              </label>
                            ))}
                          </div>
                        </FieldWrap>

                        {beneficio === "sim" && (
                          <FieldWrap className="sm:col-span-2">
                            <Label>Quais programas?</Label>
                            <div className="flex flex-wrap gap-2">
                              {["Bolsa Família / CadÚnico", "BPC / LOAS", "Minha Casa Minha Vida", "Tarifa Social de Energia", "Passe Livre", "Outro"].map(prog => (
                                <label key={prog} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-amber-400 transition-colors text-xs font-bold text-slate-600 dark:text-slate-300 select-none">
                                  <input type="checkbox" {...register("quaisBeneficios")} value={prog} className="w-3.5 h-3.5 accent-amber-500" />
                                  {prog}
                                </label>
                              ))}
                            </div>
                          </FieldWrap>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ══════════════ PASSO 4: LGPD & CONSENTIMENTOS ══════════════ */}
                {step === 4 && (
                  <div className="space-y-6">
                    <SectionTitle icon={ShieldCheck} title="Privacidade e Consentimentos (LGPD)"
                      subtitle="Leia com atenção antes de aceitar. Sua privacidade é nossa prioridade." />

                    <InfoBox>
                      De acordo com a Lei Geral de Proteção de Dados (Lei n.º 13.709/2018 — LGPD),
                      informamos que seus dados são coletados exclusivamente para fins de cadastro,
                      matrícula e acompanhamento pedagógico na plataforma QualificaVix. Você tem o
                      direito de acessar, corrigir ou solicitar a exclusão dos seus dados a qualquer momento.
                    </InfoBox>

                    {/* Uso de imagem */}
                    <div className="p-5 border-2 border-slate-200 dark:border-slate-700 rounded-2xl">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: `${BLUE}15` }}>
                          <FileText className="w-4 h-4" style={{ color: BLUE }} />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 dark:text-white text-sm">Autorização de Uso de Imagem</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            A Prefeitura de Vitória poderá utilizar fotos e vídeos captados durante as aulas,
                            formaturas e eventos do QualificaVix para divulgação nos canais oficiais
                            (site, redes sociais, impressos e televisão), sem fins lucrativos,
                            conforme Art. 20 do Código Civil e Art. 7º da LGPD.
                            <br /><br />
                            <strong>O que será captado:</strong> imagens, voz, nome e depoimentos do aluno
                            em contexto educacional.<br />
                            <strong>Finalidade:</strong> divulgação institucional e promoção da plataforma.<br />
                            <strong>Prazo:</strong> por tempo indeterminado, podendo ser revogado a qualquer momento.
                          </p>
                        </div>
                      </div>
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" {...register("autorizaImagem")}
                          className="mt-0.5 w-5 h-5 shrink-0 accent-blue-600 cursor-pointer" />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                          Autorizo o uso da minha imagem para divulgação institucional pela Prefeitura de Vitória / QualificaVix
                        </span>
                      </label>
                    </div>

                    {/* Dados pessoais */}
                    <div className="p-5 border-2 border-slate-200 dark:border-slate-700 rounded-2xl">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: `${GOLD}15` }}>
                          <ShieldCheck className="w-4 h-4" style={{ color: GOLD }} />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 dark:text-white text-sm">Tratamento de Dados Pessoais</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            Os dados informados neste cadastro (nome, CPF, endereço, contato, escolaridade e renda)
                            serão tratados pela Prefeitura Municipal de Vitória com base no legítimo interesse
                            público (Art. 7º, III da LGPD) para gestão de matrículas, emissão de certificados,
                            comunicações sobre cursos e elaboração de relatórios estatísticos anonimizados.
                            <br /><br />
                            <strong>Dados sensíveis</strong> (deficiência, renda) são tratados somente para
                            garantia de acessibilidade e inclusão, com proteção reforçada conforme Art. 11 da LGPD.
                          </p>
                        </div>
                      </div>
                      <label className={`flex items-start gap-3 cursor-pointer group ${!watch("autorizaDados") && errors.autorizaDados ? "text-red-500" : ""}`}>
                        <input type="checkbox"
                          {...register("autorizaDados", { required: "Consentimento obrigatório" })}
                          className="mt-0.5 w-5 h-5 shrink-0 accent-blue-600 cursor-pointer" />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                          Concordo com o tratamento dos meus dados pessoais pela Prefeitura de Vitória conforme a LGPD <span className="text-red-500">*</span>
                        </span>
                      </label>
                      {errors.autorizaDados && (
                        <p className="flex items-center gap-1 text-xs text-red-500 font-semibold mt-2 ml-8">
                          <AlertCircle className="w-3 h-3" /> {errors.autorizaDados.message}
                        </p>
                      )}
                    </div>

                    {/* Termos de uso */}
                    <div className="p-5 border-2 border-slate-200 dark:border-slate-700 rounded-2xl">
                      <label className={`flex items-start gap-3 cursor-pointer group`}>
                        <input type="checkbox"
                          {...register("aceitaTermos", { required: "Você deve aceitar os termos" })}
                          className="mt-0.5 w-5 h-5 shrink-0 accent-blue-600 cursor-pointer" />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-snug">
                          Declaro que li e concordo com os{" "}
                          <a href="#" className="underline hover:text-blue-600 transition-colors" style={{ color: BLUE }}>
                            Termos de Uso
                          </a>{" "}
                          e a{" "}
                          <a href="#" className="underline hover:text-blue-600 transition-colors" style={{ color: BLUE }}>
                            Política de Privacidade
                          </a>{" "}
                          do QualificaVix <span className="text-red-500">*</span>
                        </span>
                      </label>
                      {errors.aceitaTermos && (
                        <p className="flex items-center gap-1 text-xs text-red-500 font-semibold mt-2 ml-8">
                          <AlertCircle className="w-3 h-3" /> {errors.aceitaTermos.message}
                        </p>
                      )}
                    </div>

                    {/* Notificações (opcional) */}
                    <label className="flex items-start gap-3 cursor-pointer group p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <input type="checkbox" {...register("receberNotificacoes")}
                        className="mt-0.5 w-5 h-5 shrink-0 accent-blue-600 cursor-pointer" />
                      <div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-snug">
                          Desejo receber notificações sobre novos cursos e oportunidades por e-mail e WhatsApp
                        </span>
                        <p className="text-xs text-slate-400 mt-0.5">Opcional — você pode cancelar a qualquer momento</p>
                      </div>
                    </label>

                    <div className="p-4 rounded-2xl text-center"
                      style={{ background: `${BLUE}08`, border: `1px solid ${BLUE}20` }}>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        🔒 Seus dados estão protegidos e armazenados em servidores seguros
                        da Prefeitura Municipal de Vitória, em conformidade com a LGPD.
                        Para exercer seus direitos (acesso, correção, portabilidade, exclusão),
                        entre em contato: <strong>lgpd@vitoria.es.gov.br</strong>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ─── Rodapé do formulário (botões de navegação) ─── */}
              <div className="flex items-center justify-between gap-4 px-6 sm:px-8 py-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <button
                  type="button"
                  onClick={step === 1 ? onBack : () => setStep(s => s - 1)}
                  className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300 px-5 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-white dark:hover:bg-slate-800 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {step === 1 ? "Voltar ao site" : "Anterior"}
                </button>

                <div className="flex items-center gap-2">
                  {STEPS.map(s => (
                    <div key={s.id} className={`rounded-full transition-all ${
                      s.id === step ? "w-6 h-2" : "w-2 h-2"
                    }`}
                      style={{ background: s.id <= step ? BLUE : "#e2e8f0" }} />
                  ))}
                </div>

                {step < 4 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="flex items-center gap-2 text-white font-black text-sm px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                    style={{ background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_MID} 100%)` }}
                  >
                    Próximo <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 text-slate-950 font-black text-sm px-7 py-2.5 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    style={{ background: `linear-gradient(135deg, ${RED} 0%, ${RED_LIGHT} 100%)` }}
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4" /> Concluir cadastro</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
