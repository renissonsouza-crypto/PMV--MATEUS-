import { normalizeTortuguitaText } from './tortuguitaText.ts';

export type SocialIntent = 'greeting' | 'thanks' | 'acknowledgement' | 'goodbye';
type Token = { value: string; start: number; end: number };

// Match whole expressions before the catalogue's spelling and synonym rules.
// In a greeting, “noite” is not a request to study at night.
const PREFIXES = [
  'muito obrigado', 'muito obrigada', 'bom dia', 'boa tarde', 'boa noite',
  'tudo bem', 'tudo bom', 'tudo certo', 'e ai', 'por favor', 'com licenca',
  'tortuguita vix', 'tortuguita', 'ola', 'oi', 'oie', 'opa', 'hey', 'hello', 'bomdia', 'boatarde', 'boanoite',
  'obrigado', 'obrigada', 'valeu',
];
const SUFFIXES = ['por favor', 'por gentileza', 'muito obrigado', 'muito obrigada', 'obrigado', 'obrigada'];
const GREETINGS: Record<string, string> = { 'bom dia': 'Bom dia', 'bomdia': 'Bom dia', 'boa tarde': 'Boa tarde', 'boatarde': 'Boa tarde', 'boa noite': 'Boa noite', 'boanoite': 'Boa noite' };
const THANKS = /^(?:(?:muito )?obrigad[oa]|valeu|obg|obgd|agradeco)(?: (?:mesmo|viu|pela ajuda|pela atencao|por ajudar|por tudo|de verdade|demais))*$|^(?:me ajudou|ajudou muito|era isso mesmo|consegui encontrar|consegui achar)(?: obrigado| obrigada)?$/;
const WELLBEING = /^(?:tudo (?:bem|bom|certo|otimo)(?: (?:e|com) (?:voce|vc))?|(?:e )?(?:voce|vc)|como (?:vai|esta|voce esta|voce ta|vc esta|vc ta)|ta tudo bem|td bem|td bom|(?:voce )?esta ai|tem alguem ai|boa (?:noite|tarde) (?:para|pra) voce|bom dia (?:para|pra) voce)(?: hoje)?$/;
const ACKNOWLEDGEMENT = /^(?:ok|okay|certo|entendi|sim|nao|pode ser|ta bom|esta bem|beleza|legal|bacana|perfeito|otimo|combinado|blz|aham|claro|vamos la|vamos|beleza obrigado|entendi obrigado)$/;
const GOODBYE = /^(?:e )?(?:tchau|ate (?:mais|logo|a proxima)|vou sair|por hoje e so|era so isso)(?: boa noite| obrigado| obrigada)?$/;

function matches(tokens: Token[], offset: number, phrase: string): boolean {
  return phrase.split(' ').every((word, index) => tokens[offset + index]?.value === word);
}

export function conversationEnvelope(message: string): { message: string; social?: SocialIntent; salutation?: string } {
  const raw = String(message ?? '');
  const tokens: Token[] = Array.from(raw.matchAll(/[\p{L}\p{N}]+/gu), match => ({
    value: normalizeTortuguitaText(match[0]).replace(/^o+i+e*$/, 'oi').replace(/^o+l+a+$/, 'ola'), start: match.index!, end: match.index! + match[0].length,
  }));
  let first = 0, last = tokens.length;
  let salutation: string | undefined, welcomed = false, thanked = false;
  while (first < last) {
    if (first > 0 && tokens[first].value === 'e' && PREFIXES.some(phrase => matches(tokens, first + 1, phrase))) first++;
    const phrase = PREFIXES.find(phrase => matches(tokens, first, phrase));
    if (!phrase) break;
    if (/obrigad|valeu/.test(phrase)) thanked = true;
    else if (!['por favor', 'com licenca', 'tortuguita', 'tortuguita vix'].includes(phrase)) {
      welcomed = true; salutation = GREETINGS[phrase] ?? salutation ?? 'Olá';
    }
    first += phrase.split(' ').length;
  }
  while (last > first) {
    const phrase = SUFFIXES.find(phrase => {
      const start = last - phrase.split(' ').length;
      return start >= first && matches(tokens, start, phrase);
    });
    if (!phrase) break;
    if (/obrigad/.test(phrase)) thanked = true;
    last -= phrase.split(' ').length;
  }
  const remaining = tokens.slice(first, last).map(token => token.value).join(' ');
  const normalized = normalizeTortuguitaText(raw);
  const social = GOODBYE.test(remaining) || GOODBYE.test(normalized) ? 'goodbye'
    : THANKS.test(remaining) || THANKS.test(normalized) ? 'thanks'
    : WELLBEING.test(remaining) || WELLBEING.test(normalized) || (welcomed && /^(?:(?:para|pra|com) (?:voce|vc)(?: tambem)?|por ai|ai)$/.test(remaining)) ? 'greeting'
    : ACKNOWLEDGEMENT.test(remaining) ? 'acknowledgement'
    : !remaining && tokens.length > 0 ? welcomed ? 'greeting' : thanked ? 'thanks' : 'acknowledgement'
    : undefined;
  // Preserve punctuation in the actual request. A question about completion
  // must retain “?” so that it cannot become a statement that updates memory.
  const start = first ? tokens[first - 1].end : 0;
  const end = last < tokens.length ? tokens[last].start : raw.length;
  let request = raw.slice(start, end).replace(/^[\s,;:!?.…\-]+/, '').trim();
  if (raw.includes('?') && !request.includes('?')) request += '?';
  return { message: social ? raw : request || raw, social, salutation };
}
