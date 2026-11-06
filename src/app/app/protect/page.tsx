"use client";
// Stretch 6: coaching check ("NatWest Protect"). Uses the Protect voice line
// when it is configured, otherwise the same four questions as a short form.
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { Mic, ShieldCheck } from "lucide-react";
import { AppScreen, ResultIcon } from "@/components/app/AppScreen";
import { Button, Card, Pill } from "@/components/ui";
import { post } from "@/lib/api";
import { COPY } from "@/lib/copy";

type Answer = { question: string; answer: string };

function Protect() {
  const paymentId = useSearchParams().get("payment");
  const router = useRouter();
  const [voiceReady, setVoiceReady] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/voice/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { protect?: boolean }) => setVoiceReady(Boolean(d.protect)))
      .catch(() => setVoiceReady(false));
  }, []);

  const submit = async (answers: Answer[]) => {
    if (answers.length) await post("/api/coaching", { paymentId, answers }).catch(() => {});
    setDone(true);
  };

  if (done) {
    return (
      <AppScreen hideBack>
        <div className="flex flex-1 flex-col gap-6 pt-8 text-center">
          <ResultIcon tone="success">
            <ShieldCheck size={40} />
          </ResultIcon>
          <p className="text-[19px] leading-7 font-medium">{COPY.protect.thanks}</p>
          <Button className="mt-auto" onClick={() => router.push("/app")}>
            Back to home
          </Button>
        </div>
      </AppScreen>
    );
  }

  return (
    <AppScreen back={paymentId ? `/app/pay/result?id=${paymentId}` : "/app"} backLabel="Back">
      <h1 className="font-serif text-[28px] leading-9 font-semibold">{COPY.protect.title}</h1>
      <p className="mt-2 text-muted">{COPY.protect.intro}</p>
      {voiceReady === null ? null : voiceReady ? (
        <ConversationProvider>
          <VoiceCheck onDone={submit} />
        </ConversationProvider>
      ) : (
        <FormCheck onDone={submit} />
      )}
    </AppScreen>
  );
}

function FormCheck({ onDone }: { onDone: (a: Answer[]) => void }) {
  const [answers, setAnswers] = useState<string[]>(COPY.protect.questions.map(() => ""));
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-5 flex flex-1 flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onDone(COPY.protect.questions.map((q, i) => ({ question: q, answer: answers[i] })));
      }}
    >
      {COPY.protect.questions.map((q, i) => (
        <label key={q} className="flex flex-col gap-1.5">
          <span className="text-[15px] font-medium">{q}</span>
          <textarea
            rows={2}
            className="rounded-[8px] border border-line bg-surface px-4 py-3 text-[17px] outline-none focus:ring-2 focus:ring-brand"
            value={answers[i]}
            onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
          />
        </label>
      ))}
      <Button type="submit" className="mt-auto" loading={busy}>
        Send answers
      </Button>
    </form>
  );
}

function VoiceCheck({ onDone }: { onDone: (a: Answer[]) => void }) {
  const lines = useRef<{ role: "user" | "agent"; text: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    const answers: Answer[] = [];
    let q: string | null = null;
    for (const l of lines.current) {
      if (l.role === "agent") q = l.text;
      else if (q) {
        answers.push({ question: q, answer: l.text });
        q = null;
      }
    }
    onDone(answers);
  };

  const conv = useConversation({
    onMessage: ({ message, role }) => lines.current.push({ role, text: message }),
    onDisconnect: () => finish(),
    onError: () => setError(COPY.errors.network),
  });

  const start = async () => {
    setError(null);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const creds = await fetch("/api/voice/token?agent=protect").then((r) => r.json());
      conv.startSession(
        creds.conversationToken
          ? { conversationToken: creds.conversationToken, connectionType: "webrtc" }
          : { signedUrl: creds.signedUrl },
      );
    } catch {
      setError(COPY.errors.mic);
    }
  };

  const live = conv.status === "connected" || conv.status === "connecting";
  return (
    <div className="mt-6 flex flex-1 flex-col gap-4">
      <Card className="flex flex-col items-center gap-3 p-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-tint text-brand">
          <Mic size={28} />
        </span>
        {live ? (
          <Pill tone="success" dot>
            {conv.isSpeaking ? "Speaking" : "Listening"}
          </Pill>
        ) : (
          <p className="text-[15px] text-muted">Tap below to talk to us. Speak normally.</p>
        )}
      </Card>
      {error && <p className="text-[15px] text-danger">{error}</p>}
      <div className="mt-auto flex flex-col gap-3">
        {!live ? (
          <Button onClick={start}>Start the check</Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              conv.endSession();
              finish();
            }}
          >
            Finish
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ProtectPage() {
  return (
    <Suspense>
      <Protect />
    </Suspense>
  );
}
