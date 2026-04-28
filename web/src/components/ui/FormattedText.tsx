import { Fragment, type ReactNode } from 'react';

/**
 * Renderiza texto com formatação no estilo WhatsApp:
 * - *negrito*
 * - _itálico_
 * - ~tachado~
 * - ```mono``` (bloco) ou `mono` (inline)
 * - Quebras de linha (\n)
 * - URLs viram links clicáveis (auto-detectadas)
 *
 * Implementação segura: nada de innerHTML; tudo é construído como árvore de
 * elementos React. Os caracteres delimitadores são removidos do output.
 */

type Token =
  | { type: 'text'; value: string }
  | { type: 'bold'; children: Token[] }
  | { type: 'italic'; children: Token[] }
  | { type: 'strike'; children: Token[] }
  | { type: 'code'; value: string }
  | { type: 'codeblock'; value: string }
  | { type: 'link'; value: string };

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?'"])/gi;

function tokenize(input: string): Token[] {
  if (!input) return [];

  // 1) Extrair codeblocks ```...``` primeiro (não interpretam nada dentro)
  const tokens: Token[] = [];
  const codeblockRe = /```([\s\S]+?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = codeblockRe.exec(input))) {
    if (m.index > last) {
      tokens.push(...tokenizeInline(input.slice(last, m.index)));
    }
    tokens.push({ type: 'codeblock', value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < input.length) {
    tokens.push(...tokenizeInline(input.slice(last)));
  }
  return tokens;
}

function tokenizeInline(input: string): Token[] {
  const result: Token[] = [];
  let buf = '';

  const flush = () => {
    if (buf) {
      // Quebrar em URLs
      const urlTokens = splitUrls(buf);
      result.push(...urlTokens);
      buf = '';
    }
  };

  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    // Inline code: `texto`
    if (ch === '`') {
      const close = input.indexOf('`', i + 1);
      if (close > i + 1) {
        flush();
        result.push({ type: 'code', value: input.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
    }
    // Bold: *texto*  (precisa de não-espaço imediatamente depois do *)
    if (ch === '*') {
      const inner = matchPair(input, i, '*');
      if (inner) {
        flush();
        result.push({ type: 'bold', children: tokenizeInline(inner.body) });
        i = inner.end;
        continue;
      }
    }
    // Italic: _texto_
    if (ch === '_') {
      const inner = matchPair(input, i, '_');
      if (inner) {
        flush();
        result.push({ type: 'italic', children: tokenizeInline(inner.body) });
        i = inner.end;
        continue;
      }
    }
    // Strike: ~texto~
    if (ch === '~') {
      const inner = matchPair(input, i, '~');
      if (inner) {
        flush();
        result.push({ type: 'strike', children: tokenizeInline(inner.body) });
        i = inner.end;
        continue;
      }
    }
    buf += ch;
    i += 1;
  }
  flush();
  return result;
}

function matchPair(
  str: string,
  start: number,
  delim: string,
): { body: string; end: number } | null {
  // O caractere logo após delim não pode ser espaço; precisa achar o próximo delim
  // que esteja precedido por não-espaço e seguido por borda (não-letra/dígito).
  if (str[start + 1] === undefined || /\s/.test(str[start + 1])) return null;
  // Para evitar conflitar com nomes de variáveis (foo_bar), só aceitamos abertura
  // se o caractere anterior é início, espaço ou pontuação.
  if (start > 0) {
    const prev = str[start - 1];
    if (delim === '_' && /[A-Za-z0-9]/.test(prev)) return null;
  }
  let i = start + 1;
  while (i < str.length) {
    if (str[i] === delim && !/\s/.test(str[i - 1])) {
      const next = str[i + 1];
      // Para `_`, exigir que o próximo char não seja letra/dígito (evita foo_bar_baz)
      if (delim === '_' && next !== undefined && /[A-Za-z0-9]/.test(next)) {
        i += 1;
        continue;
      }
      const body = str.slice(start + 1, i);
      if (!body) return null;
      return { body, end: i + 1 };
    }
    i += 1;
  }
  return null;
}

function splitUrls(text: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text))) {
    if (m.index > last) {
      tokens.push({ type: 'text', value: text.slice(last, m.index) });
    }
    tokens.push({ type: 'link', value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    tokens.push({ type: 'text', value: text.slice(last) });
  }
  return tokens;
}

function renderTokens(tokens: Token[]): ReactNode[] {
  return tokens.map((t, i) => {
    switch (t.type) {
      case 'text':
        return <Fragment key={i}>{t.value}</Fragment>;
      case 'bold':
        return <strong key={i} className="font-semibold">{renderTokens(t.children)}</strong>;
      case 'italic':
        return <em key={i} className="italic">{renderTokens(t.children)}</em>;
      case 'strike':
        return <s key={i} className="line-through opacity-80">{renderTokens(t.children)}</s>;
      case 'code':
        return (
          <code
            key={i}
            className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/15 font-mono text-[0.9em]"
          >
            {t.value}
          </code>
        );
      case 'codeblock':
        return (
          <pre
            key={i}
            className="my-1 px-2 py-1.5 rounded-md bg-black/10 dark:bg-white/15 font-mono text-[0.85em] whitespace-pre-wrap break-words"
          >
            {t.value}
          </pre>
        );
      case 'link': {
        const href = t.value.startsWith('http') ? t.value : `https://${t.value}`;
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-80 break-all"
          >
            {t.value}
          </a>
        );
      }
      default:
        return null;
    }
  });
}

export interface FormattedTextProps {
  text: string | null | undefined;
  className?: string;
}

export function FormattedText({ text, className }: FormattedTextProps) {
  if (!text) return null;
  const tokens = tokenize(text);
  return (
    <span className={className} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {renderTokens(tokens)}
    </span>
  );
}

export default FormattedText;
