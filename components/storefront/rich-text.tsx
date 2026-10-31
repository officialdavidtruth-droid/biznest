import type { ReactNode } from "react";

/**
 * Renders the product form's "Detailed Description" (a small markdown subset:
 * **bold**, _italic_, ~~strike~~, <u>underline</u>, "- " bullets, "1. " lists).
 * Output is built from React elements only, never raw HTML, so merchant text
 * can't inject markup or scripts into the storefront.
 */
const INLINE = /\*\*(.+?)\*\*|~~(.+?)~~|<u>(.+?)<\/u>|(?<![\w])_(.+?)_(?![\w])/g;

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const k = `${keyBase}-${i++}`;
    if (m[1] !== undefined) out.push(<strong key={k}>{m[1]}</strong>);
    else if (m[2] !== undefined) out.push(<s key={k}>{m[2]}</s>);
    else if (m[3] !== undefined) out.push(<u key={k}>{m[3]}</u>);
    else out.push(<em key={k}>{m[4]}</em>);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-*] /.test(l))) {
          return <ul key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*[-*] /, ""), `${bi}-${li}`)}</li>)}</ul>;
        }
        if (lines.every((l) => /^\s*\d+\. /.test(l))) {
          return <ol key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*\d+\. /, ""), `${bi}-${li}`)}</li>)}</ol>;
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <span key={li}>
                {li > 0 && <br />}
                {inline(l, `${bi}-${li}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
