import type { ReactNode } from "react";

const INLINE_PATTERN = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href);
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE_PATTERN)) {
    const index = m.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const key = `${keyPrefix}-i${i}`;
    if (m[1] !== undefined) {
      nodes.push(<strong key={key}>{m[1]}</strong>);
    } else if (m[2] !== undefined) {
      nodes.push(<code key={key}>{m[2]}</code>);
    } else {
      const href = m[4] as string;
      nodes.push(
        <a key={key} href={href} {...(isExternal(href) ? { rel: "nofollow noopener" } : {})}>
          {m[3]}
        </a>,
      );
    }
    last = index + m[0].length;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function renderMarkdown(markdown: string): ReactNode[] {
  const blocks = markdown.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  return blocks
    .filter((block) => block.trim() !== "")
    .map((block, bi) => {
      const key = `md-${bi}`;
      if (block.startsWith("### ")) {
        return <h3 key={key}>{renderInline(block.slice(4).trim(), key)}</h3>;
      }
      if (block.startsWith("## ")) {
        return <h2 key={key}>{renderInline(block.slice(3).trim(), key)}</h2>;
      }
      const lines = block.split("\n");
      if (lines.every((line) => line.startsWith("- "))) {
        return (
          <ul key={key}>
            {lines.map((line, li) => (
              <li key={`${key}-${li}`}>
                {renderInline(line.slice(2).trim(), `${key}-${li}`)}
              </li>
            ))}
          </ul>
        );
      }
      return <p key={key}>{renderInline(lines.join(" ").trim(), key)}</p>;
    });
}

export function excerptFa(markdown: string, maxLength = 160): string {
  const block = markdown
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .find((b) => b.trim() !== "" && !b.startsWith("#"));
  if (block === undefined) return "";
  const text = block
    .split("\n")
    .map((line) => (line.startsWith("- ") ? line.slice(2) : line))
    .join(" ")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
