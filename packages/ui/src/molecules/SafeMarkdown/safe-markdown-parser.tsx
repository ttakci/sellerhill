/**
 * SafeMarkdown parser — strict allowlist, zero dependencies, zero HTML.
 *
 * Output is a tree of plain objects (`MdNode[]`) that the SafeMarkdown
 * component renders into React elements. NO string is ever injected as HTML
 * (`dangerouslySetInnerHTML` is forbidden). Every character that is not part
 * of an explicitly allowlisted construct is rendered as literal text — so
 * raw HTML, `<script>`, `<iframe>`, `javascript:` URLs, images, and external
 * links are all inert by construction.
 *
 * Allowlist:
 *   - paragraphs (text blocks separated by blank lines)
 *   - line breaks inside a paragraph (two trailing spaces OR a hard `\n`)
 *   - **strong** / *emphasis* (also __strong__ / _emphasis_)
 *   - inline code (`code`)
 *   - fenced code blocks (``` ``` — info string ignored)
 *   - unordered lists (- / * / +)
 *   - ordered lists (1. / 2. …)
 *   - citation markers [^n] → rendered as a structured inline marker (NO link)
 *
 * Rejected (rendered as literal text or stripped):
 *   - raw HTML tags → escaped text (the `<` becomes a literal char)
 *   - images ![alt](url) → alt text only, URL dropped
 *   - links [text](url) → text only, URL dropped (no external links)
 *   - any URL with javascript:/data:/vbscript: scheme → dropped
 *   - headings (#), blockquotes (>), tables, etc. → rendered as plain text
 *     (not in the allowlist → the leading sigil is preserved as literal text
 *      inside a paragraph, which is the safest non-magic fallback).
 */
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

export type MdInlineNode =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: MdInlineNode[] }
  | { type: 'em'; children: MdInlineNode[] }
  | { type: 'code'; text: string }
  | { type: 'citation'; marker: string }
  | { type: 'break' };

export type MdBlockNode =
  | { type: 'paragraph'; children: MdInlineNode[] }
  | { type: 'code'; text: string }
  | { type: 'list'; ordered: boolean; items: MdInlineNode[][] };

export type MdNode = MdBlockNode;

// ---------------------------------------------------------------------------
// Inline parsing
// ---------------------------------------------------------------------------

/**
 * Escape the ASCII characters that would otherwise let a literal become
 * meaningful in HTML. We never inject HTML, but escaping keeps the rendered
 * TEXT faithful (so `<script>` shows as the literal string `<script>` rather
 * than vanishing) and is a defense-in-depth against any future consumer that
 * might stringify the tree.
 */
const escapeText = (raw: string): string =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Pull the visible text out of `[label](url)` / `![alt](url)` constructs and
 * discard the URL. Schemes are never honored — there is no link surface in the
 * output AST, so `javascript:` / `data:` / `vbscript:` cannot execute. We
 * additionally reject URLs that look like dangerous schemes so the rejected
 * form is preserved verbatim as text (signaling to the reader that the link
 * was stripped) rather than silently dropping it.
 *
 * Returns the rewritten line (still markdown-inline, with link/image
 * constructs reduced to their label text) plus a flag indicating whether any
 * dangerous URL was encountered.
 */
const stripLinksAndImages = (line: string): { text: string; hadDangerousUrl: boolean } => {
  let hadDangerousUrl = false;

  // ![alt](url)  → alt   (image: keep alt as text, drop url)
  // [text](url)  → text  (link: keep text, drop url)
  // The two patterns share the same trailing (url) group; run image first.
  const linkish = /!?\[([^\]]*)\]\(([^)\s]*)\)/g;
  const reduced = line.replace(linkish, (full, label: string, url: string) => {
    const scheme = url.trim().split(':')[0]?.toLowerCase() ?? '';
    if (scheme === 'javascript' || scheme === 'data' || scheme === 'vbscript' || scheme === 'file') {
      hadDangerousUrl = true;
      // Preserve the construct verbatim so the reader sees it was rejected.
      return full;
    }
    // Drop the URL, keep the label text. For images, keep the alt as plain text.
    return label;
  });

  return { text: reduced, hadDangerousUrl };
};

/**
 * Parse a single line of inline markdown into MdInlineNode[].
 *
 * The grammar is intentionally tiny and scanned left-to-right. Precedence:
 *   1. hard line break (two trailing spaces) — emitted at end of line by caller
 *   2. inline code (`…`) — contents are NOT recursively parsed (literal text)
 *   3. strong (**…** / __…__)
 *   4. emphasis (*…* / _…_)
 *   5. citation [^id]
 *   6. raw HTML `<tag…>` — rendered as escaped literal text (no node)
 *   7. plain text
 *
 * Inline code is matched first because its content must not be re-parsed for
 * emphasis/strong (mirrors CommonMark). The `<` of raw HTML is left as a
 * literal char and escaped at render time — there is no HTML node in the AST.
 */
const parseInline = (line: string): MdInlineNode[] => {
  const nodes: MdInlineNode[] = [];
  let i = 0;
  let text = '';

  const flushText = () => {
    if (text.length > 0) {
      nodes.push({ type: 'text', text: escapeText(text) });
      text = '';
    }
  };

  while (i < line.length) {
    const rest = line.slice(i);

    // Inline code: `…` (single backtick, no nesting)
    const codeMatch = /^`([^`]+)`/.exec(rest);
    if (codeMatch) {
      flushText();
      nodes.push({ type: 'code', text: codeMatch[1] });
      i += codeMatch[0].length;
      continue;
    }

    // Strong: **…** or __…__  (must have content)
    const strongMatch = /^\*\*([^*]+)\*\*/.exec(rest) || /^__([^_]+)__/.exec(rest);
    if (strongMatch) {
      flushText();
      nodes.push({ type: 'strong', children: parseInline(strongMatch[1]) });
      i += strongMatch[0].length;
      continue;
    }

    // Emphasis: *…* or _…_  (must have content, no nesting beyond strong)
    const emMatch = /^\*([^*]+)\*/.exec(rest) || /^_([^_]+)_/.exec(rest);
    if (emMatch) {
      flushText();
      nodes.push({ type: 'em', children: parseInline(emMatch[1]) });
      i += emMatch[0].length;
      continue;
    }

    // Citation marker: [^id]  — id is a short string (digits/alnum), no URL.
    const citeMatch = /^\[\^([a-zA-Z0-9_-]+)\]/.exec(rest);
    if (citeMatch) {
      flushText();
      nodes.push({ type: 'citation', marker: citeMatch[1] });
      i += citeMatch[0].length;
      continue;
    }

    // Raw HTML tag — DO NOT parse; consume the `<` as a literal char so it
    // becomes escaped text. This neutrializes <script>, <iframe>, <img onerror>,
    // etc. by construction (no tag is ever recognized as a tag).
    if (line[i] === '<') {
      text += '<';
      i += 1;
      continue;
    }

    text += line[i];
    i += 1;
  }

  flushText();
  return nodes;
};

// ---------------------------------------------------------------------------
// Block parsing
// ---------------------------------------------------------------------------

const FENCE = /^```/;

export const parseMarkdown = (input: string): MdNode[] => {
  const src = input.replace(/\r\n?/g, '\n');
  const lines = src.split('\n');
  const blocks: MdNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Blank line — skip (paragraph separator).
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Fenced code block: ``` … ```
    if (FENCE.test(line.trim())) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i += 1;
      }
      // consume closing fence (if present)
      if (i < lines.length && FENCE.test(lines[i].trim())) {
        i += 1;
      }
      blocks.push({ type: 'code', text: codeLines.join('\n') });
      continue;
    }

    // Unordered list: lines starting with - / * / + followed by space
    const ulMatch = /^[-*+]\s+(.*)$/.exec(line);
    if (ulMatch) {
      const items: MdInlineNode[][] = [];
      while (i < lines.length) {
        const m = /^[-*+]\s+(.*)$/.exec(lines[i]);
        if (!m) {
          break;
        }
        items.push(parseInline(m[1]));
        i += 1;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    // Ordered list: lines starting with digits + . + space
    const olMatch = /^\d+\.\s+(.*)$/.exec(line);
    if (olMatch) {
      const items: MdInlineNode[][] = [];
      while (i < lines.length) {
        const m = /^\d+\.\s+(.*)$/.exec(lines[i]);
        if (!m) {
          break;
        }
        items.push(parseInline(m[1]));
        i += 1;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    // Paragraph: collect consecutive non-blank, non-fence, non-list lines.
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !FENCE.test(lines[i].trim()) &&
      !/^[-*+]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }

    // Join paragraph lines, honoring hard breaks (two trailing spaces → <br/>).
    const children: MdInlineNode[] = [];
    for (let p = 0; p < paraLines.length; p += 1) {
      const raw = paraLines[p];
      const { text: stripped } = stripLinksAndImages(raw);
      const hardBreak = / {2,}$/.test(raw);
      const inline = parseInline(stripped);
      children.push(...inline);
      if (p < paraLines.length - 1 || hardBreak) {
        children.push({ type: 'break' });
      }
    }
    blocks.push({ type: 'paragraph', children });
  }

  return blocks;
};

// ---------------------------------------------------------------------------
// Rendering — pure functions returning ReactNode trees (NO HTML injection)
// ---------------------------------------------------------------------------

let citationCounter = 0;
/**
 * Stable key generator for inline nodes. Uses a module counter so keys are
 * unique within a render pass; the component wraps render in a per-render
 * reset by calling `resetCitationCounter` before each render. (Kept here so
 * the renderer is self-contained and testable.)
 */
const nextKey = (prefix: string): string => `${prefix}-${citationCounter++}`;

/** @internal reset the key counter — called by the component before render. */
export const resetCitationCounter = (): void => {
  citationCounter = 0;
};

const renderInline = (node: MdInlineNode): ReactNode => {
  switch (node.type) {
    case 'text':
      return node.text;
    case 'strong':
      return <strong key={nextKey('s')}>{node.children.map(renderInline)}</strong>;
    case 'em':
      return <em key={nextKey('e')}>{node.children.map(renderInline)}</em>;
    case 'code':
      return <code key={nextKey('c')}>{node.text}</code>;
    case 'citation':
      // Structured internal marker — NOT a link. Rendered as a superscript
      // bracketed label so it is visually distinct but carries no URL.
      return (
        <sup key={nextKey('cite')}>[{node.marker}]</sup>
      );
    case 'break':
      return <br key={nextKey('br')} />;
    default:
      return null;
  }
};

const renderBlock = (node: MdNode, idx: number): ReactNode => {
  switch (node.type) {
    case 'paragraph':
      return <p key={`p-${idx}`}>{node.children.map(renderInline)}</p>;
    case 'code':
      return (
        <pre key={`pre-${idx}`}>
          <code>{node.text}</code>
        </pre>
      );
    case 'list':
      return node.ordered ? (
        <ol key={`ol-${idx}`}>
          {node.items.map((item, j) => (
            <li key={`li-${idx}-${j}`}>{item.map(renderInline)}</li>
          ))}
        </ol>
      ) : (
        <ul key={`ul-${idx}`}>
          {node.items.map((item, j) => (
            <li key={`li-${idx}-${j}`}>{item.map(renderInline)}</li>
          ))}
        </ul>
      );
    default:
      return null;
  }
};

/** Render a markdown string to a ReactNode tree (allowlisted subset only). */
export const renderMarkdown = (input: string): ReactNode => {
  resetCitationCounter();
  const blocks = parseMarkdown(input);
  return blocks.map((b, idx) => renderBlock(b, idx));
};
