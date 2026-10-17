import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown, stripMarkdown } from './markdown';

describe('mini-markdown', () => {
  it('reconnaît gras, italique, code et liens', () => {
    expect(parseInline('a **b** *c* `d` [e](https://x.fr)')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'bold', children: [{ type: 'text', value: 'b' }] },
      { type: 'text', value: ' ' },
      { type: 'italic', children: [{ type: 'text', value: 'c' }] },
      { type: 'text', value: ' ' },
      { type: 'code', value: 'd' },
      { type: 'text', value: ' ' },
      { type: 'link', href: 'https://x.fr', children: [{ type: 'text', value: 'e' }] },
    ]);
  });

  it('refuse les liens non http(s) (ex. javascript:)', () => {
    expect(parseInline('[x](javascript:alert(1))')).toEqual([{ type: 'text', value: '[x](javascript:alert(1))' }]);
  });

  it('ne transforme pas une multiplication en italique', () => {
    expect(parseInline('2 * 3 * 4')).toEqual([{ type: 'text', value: '2 * 3 * 4' }]);
  });

  it('découpe en blocs', () => {
    const blocks = parseMarkdown('# Titre\n\nligne 1\nligne 2\n\n- a\n- [x] b\n1. un\n> cité');
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'list', 'list', 'quote']);
    const list = blocks[2];
    expect(list?.type === 'list' && list.items.map((i) => i.checked)).toEqual([null, true]);
  });

  it('produit un texte brut pour les aperçus', () => {
    expect(stripMarkdown('## Plan\n- **lundi** : _course_')).toBe('Plan\nlundi : course');
  });
});
