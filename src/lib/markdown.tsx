// A very small Markdown renderer for fraud reports: headings, paragraphs,
// lists, tables and bold. Escapes everything else.
import type { ReactNode } from "react";

function inline(text: string, key: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={`${key}-${i}`}>{p.slice(2, -2)}</strong> : <span key={`${key}-${i}`}>{p}</span>,
  );
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      out.push(<h2 key={i}>{inline(h[2], `h${i}`)}</h2>);
      i++;
      continue;
    }
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        <table key={`t${i}`}>
          <thead>
            <tr>{head?.map((c, j) => <th key={j}>{inline(c, `th${i}${j}`)}</th>)}</tr>
          </thead>
          <tbody>
            {body.map((r, k) => (
              <tr key={k}>{r.map((c, j) => <td key={j}>{inline(c, `td${i}${k}${j}`)}</td>)}</tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      out.push(
        <ul key={`u${i}`}>
          {items.map((it, j) => <li key={j}>{inline(it, `li${i}${j}`)}</li>)}
        </ul>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*[-*]\s|\s*\|)/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push(<p key={`p${i}`}>{inline(para.join(" "), `p${i}`)}</p>);
  }
  return <>{out}</>;
}
