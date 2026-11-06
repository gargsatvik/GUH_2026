"use client";
import { useEffect, useRef } from "react";
import clsx from "clsx";
import { spokenToDigits } from "@/lib/capture/patterns";
import type { Entity, TranscriptLine } from "@/lib/types";

/** Digit or text signatures that show a captured detail is in a sentence. */
function signatures(e: Entity): string[] {
  switch (e.kind) {
    case "account": {
      const [s, a] = e.value.split(":");
      return [s, a];
    }
    case "phone":
      return ["0" + e.value.slice(3)];
    default:
      return [e.value.toLowerCase()];
  }
}

function highlight(text: string, captured: Entity[]) {
  if (!captured.length) return [{ text, hit: false }];
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  return sentences.map((s) => {
    const conv = spokenToDigits(s);
    const digits = conv.replace(/\D/g, "");
    const lower = conv.toLowerCase();
    const hit = captured.some((e) =>
      signatures(e).some((sig) => (/^\d+$/.test(sig) ? sig.length >= 6 && digits.includes(sig) : lower.includes(sig))),
    );
    return { text: s, hit };
  });
}

export function Transcript({ lines, captured }: { lines: TranscriptLine[]; captured: Entity[] }) {
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div
      ref={box}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }}
      className="flex-1 overflow-y-auto pr-1"
      aria-live="polite"
    >
      <ol className="flex flex-col gap-3">
        {lines.map((l) => (
          <li key={l.id} className="rise-in">
            <div className={clsx("text-[13px] font-semibold", l.speaker === "caller" ? "text-ink" : "text-brand")}>
              {l.speaker === "caller" ? "Caller" : "Decoy"}
            </div>
            <p className={clsx("text-[15px] leading-[22px]", l.speaker === "decoy" && "text-muted")}>
              {l.speaker === "caller"
                ? highlight(l.text, captured).map((p, i) =>
                    p.hit ? (
                      <mark key={i} className="border-b border-brand bg-brand-tint text-ink">
                        {p.text}
                      </mark>
                    ) : (
                      <span key={i}>{p.text}</span>
                    ),
                  )
                : l.text}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
