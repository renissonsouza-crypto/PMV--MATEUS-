// Word boundaries keep unrelated words (for example “conta” and “contato”)
// separate. The vocabulary is platform data, never an external model response.
export function normalizeTortuguitaText(value: string): string {
  return String(value ?? "").slice(0, 1000).normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

const STOP_WORDS = new Set("a o as os de da do das dos em no na nos nas para por com e ou que eu meu minha meus minhas um uma uns umas qual quais como onde quando quanto quantos quanto posso pode podem quero queria gostaria saber tem ter tenho esta este esse essa esses essas ele ela isso aquele aquela aqui ai me se ao aos pelo pela sobre curso cursos plataforma site porfavor favor fazer mim voce voces tortuguita vix qualificavix ha ser sao nao sim mas tambem hoje agora muito mais menos ainda ja precisa preciso gostaria sera gostaria funciona funcionar faz funciona funcionar".split(" "));

const SPELLING: Record<string, string> = {
  inscricao: "inscricao", inscricoes: "inscricao", inscrever: "inscricao", inscrevo: "inscricao", inscrevese: "inscricao", matricula: "inscricao", matriculas: "inscricao", matricular: "inscricao", matriculado: "inscricao",
  cadastro: "cadastro", cadastrar: "cadastro", cadastramento: "cadastro", cadastrado: "cadastro", cadastrarme: "cadastro",
  cancelar: "cancelar", cancelamento: "cancelar", cancelo: "cancelar", cancelada: "cancelar", desistir: "cancelar", desistencia: "cancelar", desinscrever: "cancelar", desinscreverse: "cancelar", desmatricular: "cancelar",
  gratuito: "gratuito", gratuita: "gratuito", gratuitas: "gratuito", gratuitos: "gratuito", gratis: "gratuito",
  certificado: "certificado", certificados: "certificado", certificacao: "certificado", diploma: "certificado",
  favorito: "favorito", favoritos: "favorito", favoritar: "favorito", salvos: "favorito",
  atualizar: "editar", atualizacao: "editar", alterar: "editar", mudar: "editar", editar: "editar",
  apagar: "excluir", deletar: "excluir", eliminar: "excluir", exclusao: "excluir", excluir: "excluir",
  telefone: "telefone", celular: "telefone", telemovel: "telefone",
  endereco: "endereco", localizacao: "local", local: "local", locais: "local",
  remoto: "online", ead: "online", distancia: "online", virtual: "online",
  presencial: "presencial", presenciais: "presencial", online: "online", onlines: "online",
  noite: "noturno", noturna: "noturno", noturno: "noturno", tarde: "vespertino", vespertina: "vespertino", manha: "diurno", diurna: "diurno",
  basico: "iniciante", basica: "iniciante", iniciantes: "iniciante", iniciante: "iniciante", iniciando: "iniciante",
  horario: "horario", horarios: "horario", hora: "horas", mes: "meses", mensal: "meses",
  vaga: "vagas", vagas: "vagas", abertas: "aberto", aberta: "aberto", disponivel: "disponivel", disponiveis: "disponivel",
  crianca: "menor", adolescente: "menor", menores: "menor", responsavel: "responsavel", tutor: "responsavel",
  depoimento: "depoimento", depoimentos: "depoimento", avaliacao: "depoimento", avaliacoes: "depoimento",
  remuneracao: "salario", salarios: "salario", ganha: "salario", ganhar: "salario",
};

export function canonicalWord(word: string): string {
  const key = SPELLING[word];
  if (key) return key;
  if (/^inscr[i e]/.test(word) || /^inscrev/.test(word)) return "inscricao";
  if (/^cadastr/.test(word)) return "cadastro";
  if (/^cancel/.test(word) || /^desinscr/.test(word)) return "cancelar";
  if (/^certific/.test(word)) return "certificado";
  if (/^favorit/.test(word)) return "favorito";
  if (/^notifica/.test(word)) return "notificacao";
  if (/^deficien/.test(word)) return "deficiencia";
  if (/^obrigator/.test(word)) return "obrigatorio";
  return word.length > 5 && word.endsWith("s") ? word.slice(0, -1) : word;
}

export function meaningfulWords(value: string): string[] {
  return [...new Set(normalizeTortuguitaText(value).split(" ").filter(word => word && !STOP_WORDS.has(word)).map(canonicalWord))];
}

// Bounded Damerau-Levenshtein catches a mistyped or swapped letter without
// treating short, unrelated words as the same intent.
export function wordSimilarity(left: string, right: string): number {
  const a = canonicalWord(left), b = canonicalWord(right);
  if (a === b) return 1;
  if (Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 2 || Math.max(a.length, b.length) > 32) return 0;
  if (a[0] !== b[0] && !(a[0] === b[1] && a[1] === b[0])) return 0;
  const rows = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  const distance = rows[a.length][b.length];
  const allowed = Math.max(a.length, b.length) >= 8 ? 2 : 1;
  return distance <= allowed ? 1 - distance / Math.max(a.length, b.length) : 0;
}

export function hasPhrase(text: string, phrase: string): boolean {
  const normalized = normalizeTortuguitaText(phrase);
  return normalized.length > 0 && (` ${text} `).includes(` ${normalized} `);
}

export function hasAny(text: string, phrases: string[]): boolean {
  const words = text.split(" ");
  return phrases.some(phrase => hasPhrase(text, phrase) || (!phrase.includes(" ") && words.some(word =>
    canonicalWord(word) === canonicalWord(phrase) ||
    (phrase.length >= 7 && word.slice(0, 2) === phrase.slice(0, 2) && wordSimilarity(word, phrase) >= 0.86),
  )));
}
