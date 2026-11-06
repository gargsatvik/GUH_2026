import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/ui";
import { COPY } from "@/lib/copy";

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col px-4 py-16">
      <h1 className="font-serif text-[48px] leading-[56px] font-semibold">{COPY.landing.title}</h1>
      <p className="mt-3 text-[19px] leading-7 text-muted">{COPY.landing.line}</p>
      <div className="mt-10 flex flex-col gap-3">
        {COPY.landing.cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group flex items-center justify-between gap-4 rounded-[10px] border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(20,18,26,.04)] transition hover:border-brand/40"
          >
            <div>
              <div className="text-base font-semibold">{c.title}</div>
              <div className="mt-1 text-[15px] text-muted">{c.body}</div>
            </div>
            <ArrowRight size={20} className="shrink-0 text-brand transition group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
      <p className="mt-6 text-[15px] text-muted">
        Also: <Link className="text-brand underline-offset-4 hover:underline" href="/ally">Trusted contact (phone)</Link>
      </p>
      <Footer className="mt-auto pt-12" />
    </main>
  );
}
