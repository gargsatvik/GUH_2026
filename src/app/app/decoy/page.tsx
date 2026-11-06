"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Phone, ShieldCheck } from "lucide-react";
import { AppScreen, ResultIcon } from "@/components/app/AppScreen";
import { Button, Card, Pill, Spinner } from "@/components/ui";
import { post, postSession } from "@/lib/api";
import { COPY, DECOY_NUMBER } from "@/lib/copy";
import { durationWords, timer } from "@/lib/format";
import { useNow, useRealtime, useSession } from "@/lib/useRealtime";

export default function DecoyPage() {
  const { session, loaded } = useSession();
  const now = useNow(500);
  const router = useRouter();
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { rows: captured } = useRealtime("call_entities", { filter: { col: "call_id", value: session?.call_id } });
  const { rows: calls } = useRealtime("calls", { filter: { col: "id", value: session?.call_id } });

  if (!loaded || !session) return <AppScreen>{null}</AppScreen>;
  const state = session.state;

  if (state === "decoy_live") {
    const secs = session.decoy_started_at ? (now - new Date(session.decoy_started_at).getTime()) / 1000 : 0;
    return (
      <AppScreen tint="brand" hideBack>
        <div className="flex flex-1 flex-col items-center gap-5 pt-6 text-center">
          <Pill tone="success" dot>
            {COPY.live.pill}
          </Pill>
          <h1 className="font-serif text-[32px] leading-[38px] font-semibold">{COPY.live.title}</h1>
          <div className="tnum font-mono text-[48px] font-medium" aria-label="Call time">
            {timer(secs)}
          </div>
          <div className="text-[17px] font-medium" aria-live="polite">
            {COPY.live.captured(captured.length)}
          </div>
          <Card className="p-4 text-left text-[15px] leading-[22px]">{COPY.live.card}</Card>
          <Button
            variant="secondary"
            className="mt-auto"
            onClick={() => session.call_id && post("/api/call/end", { callId: session.call_id, reason: "operator_ended" }).catch(() => {})}
          >
            {COPY.live.leave}
          </Button>
        </div>
      </AppScreen>
    );
  }

  if (state === "ended") {
    const dur = calls[0]?.duration_seconds ?? 0;
    return (
      <AppScreen hideBack>
        <div className="flex flex-1 flex-col gap-6 pt-6">
          <ResultIcon tone="success">
            <ShieldCheck size={40} />
          </ResultIcon>
          <div className="text-center">
            <h1 className="font-serif text-[32px] leading-[38px] font-semibold">{COPY.summary.title(session.customer_first)}</h1>
            <p className="mt-3 text-[17px]">{COPY.summary.body(durationWords(dur))}</p>
          </div>
          <Card className="divide-y divide-line">
            {COPY.summary.rows.map((r) => (
              <div key={r} className="flex items-start gap-3 p-4">
                <Check size={20} className="mt-0.5 shrink-0 text-success" aria-hidden />
                <span className="text-[15px] leading-[22px]">{r}</span>
              </div>
            ))}
          </Card>
          <Button className="mt-auto" onClick={() => router.push("/app")}>
            {COPY.summary.home}
          </Button>
        </div>
      </AppScreen>
    );
  }

  if (state !== "verified_scam" && state !== "decoy_requested") {
    return (
      <AppScreen>
        <p className="pt-6 text-[17px] leading-7">{COPY.noCall}</p>
      </AppScreen>
    );
  }

  const requested = state === "decoy_requested";
  const waited = requested && session.decoy_requested_at ? now - new Date(session.decoy_requested_at).getTime() : 0;

  return (
    <AppScreen back="/app/check" backLabel="Back">
      <h1 className="font-serif text-[28px] leading-9 font-semibold">{COPY.pass.title}</h1>
      <p className="mt-1 text-muted">{COPY.pass.sub}</p>
      <ol className="mt-5 flex flex-col gap-3">
        <Step n={1}>
          <div className="text-[15px] font-semibold">{COPY.pass.step1}</div>
          <blockquote className="mt-2 border-l-2 border-brand pl-3 font-serif text-[19px] leading-7 italic">
            &ldquo;{COPY.pass.quote}&rdquo;
          </blockquote>
        </Step>
        <Step n={2}>
          <p className="text-[15px] leading-[22px]">{COPY.pass.step2}</p>
          <Button
            className="mt-3"
            loading={calling || requested}
            onClick={async () => {
              setCalling(true);
              setError(null);
              try {
                await postSession("request_decoy");
              } catch {
                setError(COPY.errors.network);
              } finally {
                setCalling(false);
              }
            }}
          >
            {requested || calling ? (
              COPY.pass.connecting
            ) : (
              <>
                <Phone size={18} />
                {COPY.pass.call}
              </>
            )}
          </Button>
          <div className="tnum mt-2 text-center font-mono text-[15px] text-muted">{DECOY_NUMBER}</div>
          {waited > 8000 && (
            <p className="mt-2 text-center text-[15px] text-muted" aria-live="polite">
              {COPY.pass.still}
            </p>
          )}
          {error && <p className="mt-2 text-[15px] text-danger">{error}</p>}
        </Step>
        <Step n={3}>
          <p className="text-[15px] leading-[22px]">{COPY.pass.step3}</p>
        </Step>
      </ol>
      {requested && (
        <div className="mt-4 flex items-center justify-center gap-2 text-[15px] text-muted">
          <Spinner className="h-4 w-4 border-2" /> {COPY.pass.connecting}
        </div>
      )}
    </AppScreen>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li>
      <Card className="flex gap-3 p-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-semibold text-white">
          {n}
        </span>
        <div className="flex-1">{children}</div>
      </Card>
    </li>
  );
}
