import { Fragment } from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { parseMarkdown, type Inline } from '../domain/markdown';

function InlineNodes({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case 'text':
            return <Fragment key={i}>{n.value}</Fragment>;
          case 'bold':
            return (
              <strong key={i} className="font-semibold">
                <InlineNodes nodes={n.children} />
              </strong>
            );
          case 'italic':
            return (
              <em key={i}>
                <InlineNodes nodes={n.children} />
              </em>
            );
          case 'code':
            return (
              <code key={i} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.85em]">
                {n.value}
              </code>
            );
          case 'link':
            return (
              <a key={i} href={n.href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
                <InlineNodes nodes={n.children} />
              </a>
            );
        }
      })}
    </>
  );
}

const lines = (ls: Inline[][]) =>
  ls.map((l, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      <InlineNodes nodes={l} />
    </Fragment>
  ));

/** Affiche le texte d'une note avec le formatage simple (voir domain/markdown). */
export function Markdown({ source }: { source: string }) {
  const blocks = parseMarkdown(source);
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading': {
            const cls = b.level === 1 ? 'text-lg font-semibold' : b.level === 2 ? 'text-base font-semibold' : 'text-sm font-semibold';
            const Tag = (`h${b.level + 1}`) as 'h2' | 'h3' | 'h4';
            return (
              <Tag key={i} className={cls}>
                <InlineNodes nodes={b.content} />
              </Tag>
            );
          }
          case 'list': {
            const Tag = b.ordered ? 'ol' : 'ul';
            const isChecklist = b.items.every((it) => it.checked !== null);
            const cls = b.ordered ? 'list-decimal pl-5' : isChecklist ? '' : 'list-disc pl-5';
            return (
              <Tag key={i} className={`space-y-1 ${cls}`}>
                {b.items.map((it, j) => (
                  <li key={j} className={it.checked !== null ? 'flex items-start gap-2' : ''}>
                    {it.checked !== null && (it.checked ? <CheckSquare size={15} className="mt-0.5 shrink-0 text-success" /> : <Square size={15} className="mt-0.5 shrink-0 text-faint" />)}
                    <span className={it.checked ? 'text-muted line-through' : ''}>
                      <InlineNodes nodes={it.content} />
                    </span>
                  </li>
                ))}
              </Tag>
            );
          }
          case 'quote':
            return (
              <blockquote key={i} className="border-l-2 border-line pl-3 text-muted">
                {lines(b.lines)}
              </blockquote>
            );
          case 'paragraph':
            return <p key={i}>{lines(b.lines)}</p>;
        }
      })}
    </div>
  );
}
