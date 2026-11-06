// Fast pattern matcher (section 15.1). Runs on every caller line, no network.
// Additions to the plan: spoken tens ("twenty", "forty-five"), the letter O
// between digits ("O161"), and a simple caller-name pattern, so the demo
// still links through the alias when the structured pass is unavailable.
import { normaliseAccount, normalisePhone, normaliseUrl, normaliseAlias } from "../normalise";
import type { Candidate } from "../types";

const UNITS: Record<string, string> = {
  zero: "0", oh: "0", o: "0", nought: "0", nil: "0",
  one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9",
};
const TEENS: Record<string, string> = {
  ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14",
  fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19",
};
const TENS: Record<string, string> = {
  twenty: "2", thirty: "3", forty: "4", fourty: "4", fifty: "5",
  sixty: "6", seventy: "7", eighty: "8", ninety: "9",
};

function wordToNumber(w: string): string | null {
  if (w in UNITS) return UNITS[w];
  if (w in TEENS) return TEENS[w];
  if (/^\d+$/.test(w)) return w;
  return null;
}

/** Turn spoken numbers into digits. Keeps punctuation so sentences survive. */
export function spokenToDigits(input: string): string {
  let s = input.toLowerCase();
  s = s.replace(/\s+dot\s+/g, ".").replace(/\s+(dash|hyphen)\s+/g, "-");
  // "forty-five" -> "forty five"
  s = s.replace(
    /\b(twenty|thirty|forty|fourty|fifty|sixty|seventy|eighty|ninety)-(one|two|three|four|five|six|seven|eight|nine)\b/g,
    "$1 $2",
  );
  // letter o touching digits: "o161" -> "0161", "07o0" -> "0700"
  s = s.replace(/\bo(?=\d)/g, "0").replace(/(?<=\d)o\b/g, "0").replace(/(?<=\d)o(?=\d)/g, "0");

  const parts = s.split(/(\s+)/);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const tok = parts[i];
    if (/^\s+$/.test(tok) || tok === "") {
      out.push(tok);
      continue;
    }
    const m = tok.match(/^([a-z0-9]+)([^a-z0-9]*)$/);
    if (!m) {
      out.push(tok);
      continue;
    }
    const [, word, punct] = m;
    const nextWordTok = () => {
      // next non-space token index
      let j = i + 1;
      while (j < parts.length && /^\s*$/.test(parts[j])) j++;
      return j;
    };

    if (word === "double" || word === "triple") {
      const j = nextWordTok();
      const nm = parts[j]?.match(/^([a-z0-9]+)([^a-z0-9]*)$/);
      const n = nm ? wordToNumber(nm[1]) : null;
      if (n && n.length === 1 && !punct) {
        out.push((word === "double" ? n.repeat(2) : n.repeat(3)) + nm![2]);
        i = j;
        continue;
      }
    }

    if (word in TENS) {
      const tens = TENS[word];
      const j = nextWordTok();
      const nm = !punct ? parts[j]?.match(/^([a-z]+)([^a-z0-9]*)$/) : null;
      if (nm && nm[1] in UNITS && UNITS[nm[1]] !== "0" && nm[1] !== "o" && nm[1] !== "oh") {
        out.push(tens + UNITS[nm[1]] + nm[2]);
        i = j;
        continue;
      }
      out.push(tens + "0" + punct);
      continue;
    }

    const n = wordToNumber(word);
    // "o" / "oh" only count as zero when next to another number
    if (n !== null && (word === "o" || word === "oh")) {
      const prev = out.slice().reverse().find((t) => !/^\s*$/.test(t)) ?? "";
      const j = nextWordTok();
      const nextIsNum = parts[j] ? wordToNumber((parts[j].match(/^[a-z0-9]+/) ?? [""])[0]) !== null : false;
      if (!/\d[^a-z]*$/.test(prev) && !nextIsNum) {
        out.push(tok);
        continue;
      }
    }
    out.push(n !== null ? n + punct : tok);
  }
  return out.join("");
}

const RUN = /\d[\d\s,.-]*\d/g;
const LINK =
  /\b[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)*\.(example|com|co\.uk|uk|net|org|info|xyz|online|app)\b/g;
const NAME_LABEL = /\b[Nn]ame(?:\s+is|\s+on\s+(?:the\s+)?account(?:\s+is)?)?[,:]?\s+([A-Z][a-zA-Z.'-]*(?:\s+[A-Z][a-zA-Z'-]+){0,3})/;
const CALLER_NAME =
  /\b(?:[Tt]his is|I'm|I am|[Mm]y name is|[Ii]t's|[Ss]peaking to)\s+((?:[Oo]fficer|[Dd]etective|DC|PC)\s+)?([A-Z][a-z]+\s+[A-Z][a-z]+)\b|\b([A-Z][a-z]+\s+[A-Z][a-z]+),?\s+(?:from\s+)?(?:the\s+)?(?:NatWest|HMRC|police|Metropolitan)/;
const NOT_NAMES = new Set(["david wilson", "margaret wilson", "safe account", "sort code", "account number"]);

/**
 * Find details in the last few caller lines. Lines are scanned separately (so
 * digits from two lines never merge) but a sort code on one line still pairs
 * with an account number on a later line.
 */
export function findDetails(callerLines: string[]): Candidate[] {
  const window = callerLines.slice(-4);
  const found = new Map<string, Candidate>();
  const add = (c: Candidate | null) => {
    if (c && !found.has(`${c.kind}:${c.value}`)) found.set(`${c.kind}:${c.value}`, c);
  };

  let lastSort: { sort: string; line: string } | null = null;
  let lastLabel: string | null = null;

  for (const line of window) {
    const conv = spokenToDigits(line);
    const labelMatch = line.match(NAME_LABEL);
    if (labelMatch) lastLabel = labelMatch[1].replace(/[.,]$/, "");

    for (const m of conv.matchAll(RUN)) {
      const d = m[0].replace(/\D/g, "");
      if (d.length === 6) {
        lastSort = { sort: d, line };
      } else if (d.length === 8 && lastSort) {
        const a = normaliseAccount(lastSort.sort, d);
        if (a) {
          const quote = lastSort.line === line ? line : `${lastSort.line} ${line}`;
          add({ kind: "account", value: a.value, display: a.display, label: null, quote });
        }
      } else if (d.length === 14) {
        const a = normaliseAccount(d.slice(0, 6), d.slice(6));
        if (a) add({ kind: "account", value: a.value, display: a.display, label: null, quote: line });
      } else if ((d.length === 11 && d.startsWith("0")) || (d.length === 12 && d.startsWith("44"))) {
        const p = normalisePhone(d);
        if (p) add({ kind: "phone", value: p.value, display: p.display, quote: line });
      }
    }

    for (const m of conv.matchAll(LINK)) {
      const u = normaliseUrl(m[0]);
      if (u) add({ kind: "url", value: u, display: u, quote: line });
    }

    const n = line.match(CALLER_NAME);
    if (n) {
      const raw = (n[1] ?? "") + (n[2] ?? n[3] ?? "");
      const value = normaliseAlias(raw);
      if (value && !NOT_NAMES.has(value)) add({ kind: "alias", value, display: raw.trim(), quote: line });
    }
  }

  // An account name said just after the numbers ("Name, J Carter") labels it.
  if (lastLabel) {
    for (const c of found.values()) if (c.kind === "account" && !c.label) c.label = lastLabel;
  }
  return [...found.values()];
}
