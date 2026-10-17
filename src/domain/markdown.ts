/**
 * Mini-Markdown pour les notes. Sous-ensemble volontairement réduit :
 *   # Titre, ## Sous-titre, ### Section
 *   - élément de liste   1. liste numérotée   - [ ] case à cocher   > citation
 *   **gras**  *italique*  `code`  [lien](https://exemple.fr)
 * Le résultat est un arbre de données (jamais du HTML brut) : le rendu React
 * échappe tout le texte, donc aucun risque d'injection de script.
 */

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'bold'; children: Inline[] }
  | { type: 'italic'; children: Inline[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: Inline[] };

export interface ListItem {
  checked: boolean | null; // null = pas une case à cocher
  content: Inline[];
}

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; content: Inline[] }
  | { type: 'list'; ordered: boolean; items: ListItem[] }
  | { type: 'quote'; lines: Inline[][] }
  | { type: 'paragraph'; lines: Inline[][] };

const INLINE_PATTERNS: { re: RegExp; build: (m: RegExpExecArray) => Inline }[] = [
  { re: /`([^`]+)`/, build: (m) => ({ type: 'code', value: m[1]! }) },
  { re: /\*\*(.+?)\*\*/, build: (m) => ({ type: 'bold', children: parseInline(m[1]!) }) },
  { re: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/, build: (m) => ({ type: 'link', href: m[2]!, children: parseInline(m[1]!) }) },
  { re: /(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\*)|(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)/, build: (m) => ({ type: 'italic', children: parseInline(m[1] ?? m[2]!) }) },
];

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  while (rest.length > 0) {
    // On prend le motif qui apparaît le plus tôt dans le texte restant.
    let best: { index: number; length: number; node: Inline } | null = null;
    for (const { re, build } of INLINE_PATTERNS) {
      const m = re.exec(rest);
      if (m && (best === null || m.index < best.index)) best = { index: m.index, length: m[0].length, node: build(m) };
    }
    if (!best) {
      out.push({ type: 'text', value: rest });
      break;
    }
    if (best.index > 0) out.push({ type: 'text', value: rest.slice(0, best.index) });
    out.push(best.node);
    rest = rest.slice(best.index + best.length);
  }
  return out;
}

const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^\s*[-*]\s+(?:\[( |x|X)\]\s+)?(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let current: Block | null = null;

  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const line of lines) {
    if (line.trim() === '') {
      flush();
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      flush();
      blocks.push({ type: 'heading', level: h[1]!.length as 1 | 2 | 3, content: parseInline(h[2]!) });
      continue;
    }
    const b = BULLET.exec(line);
    const o = b ? null : ORDERED.exec(line);
    if (b || o) {
      const ordered = !!o;
      const item: ListItem = b ? { checked: b[1] === undefined ? null : b[1].toLowerCase() === 'x', content: parseInline(b[2]!) } : { checked: null, content: parseInline(o![1]!) };
      if (current?.type === 'list' && current.ordered === ordered) current.items.push(item);
      else {
        flush();
        current = { type: 'list', ordered, items: [item] };
      }
      continue;
    }
    const q = QUOTE.exec(line);
    if (q) {
      if (current?.type === 'quote') current.lines.push(parseInline(q[1]!));
      else {
        flush();
        current = { type: 'quote', lines: [parseInline(q[1]!)] };
      }
      continue;
    }
    if (current?.type === 'paragraph') current.lines.push(parseInline(line));
    else {
      flush();
      current = { type: 'paragraph', lines: [parseInline(line)] };
    }
  }
  flush();
  return blocks;
}

/** Texte brut (pour les aperçus et la recherche). */
export function stripMarkdown(source: string): string {
  return source
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/^\s*[-*]\s+(\[[ xX]\]\s+)?/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}
