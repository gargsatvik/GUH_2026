"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneOff, ShieldAlert, ShieldCheck } from "lucide-react";
import { AppScreen, Emphasis, ResultIcon } from "@/components/app/AppScreen";
import { Button, Card, Sheet, Spinner } from "@/components/ui";
import { post } from "@/lib/api";
import { COPY } from "@/lib/copy";

type Result =
  | { result: "genuine"; code: string; agentName: string }
  | { result: "not_natwest" }
  | { result: "no_call" }
  | { result: "error" };

export default function CheckPage() {
  const [res, setRes] = useState<Result | null>(null);
  const [whatIs, setWhatIs] = useState(false);
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    post<Result>("/api/check-call")
      .then(setRes)
      .catch(() => setRes({ result: "error" }));
  }, []);

  if (!res) {
    return (
      <AppScreen hideBack>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center" aria-live="polite">
          <Spinner className="h-14 w-14" />
          <div>
            <h1 className="font-serif text-[28px] leading-9 font-semibold">{COPY.checking.title}</h1>
            <p className="mt-2 text-muted">{COPY.checking.body}</p>
          </div>
        </div>
      </AppScreen>
    );
  }

  if (res.result === "genuine") {
    const name = res.agentName.split(",")[0];
    return (
      <AppScreen>
        <div className="flex flex-1 flex-col gap-6 pt-4">
          <ResultIcon tone="success">
            <ShieldCheck size={40} />
          </ResultIcon>
          <div className="text-center">
            <h1 className="font-serif text-[32px] leading-[38px] font-semibold">{COPY.genuine.title}</h1>
            <p className="mt-3 text-muted">{COPY.genuine.body(name)}</p>
          </div>
          <Card className="p-5 text-center">
            <div className="text-[13px] font-medium text-muted">{COPY.genuine.codeLabel}</div>
            <div className="tnum mt-1 font-mono text-[40px] font-medium tracking-[0.15em]">{res.code}</div>
            <p className="mt-2 text-[15px] text-muted">{COPY.genuine.codeBody(name)}</p>
          </Card>
          <Button className="mt-auto" onClick={() => router.push("/app")}>
            {COPY.genuine.done}
          </Button>
        </div>
      </AppScreen>
    );
  }

  if (res.result === "not_natwest") {
    return (
      <AppScreen>
        <div className="flex flex-1 flex-col gap-5 pt-2">
          <ResultIcon tone="danger">
            <ShieldAlert size={40} />
          </ResultIcon>
          <div className="text-center">
            <h1 className="font-serif text-[32px] leading-[38px] font-semibold">{COPY.notNatwest.title}</h1>
            <p className="mt-3 text-muted">{COPY.notNatwest.body}</p>
          </div>
          <Emphasis tone="danger">{COPY.notNatwest.emphasis}</Emphasis>
          <div className="mt-auto flex flex-col gap-3">
            <Button onClick={() => router.push("/app/decoy")}>{COPY.notNatwest.pass}</Button>
            <p className="text-center text-[13px] leading-[18px] text-muted">{COPY.notNatwest.passHelp}</p>
            <Button variant="secondary" onClick={() => router.push("/app")}>
              <PhoneOff size={18} />
              {COPY.notNatwest.hangUp}
            </Button>
            <Button variant="quiet" className="mx-auto min-h-12" onClick={() => setWhatIs(true)}>
              {COPY.notNatwest.whatIs}
            </Button>
          </div>
        </div>
        <Sheet open={whatIs} onClose={() => setWhatIs(false)} title={COPY.notNatwest.whatIs}>
          <p className="leading-6 text-ink">{COPY.notNatwest.whatIsBody}</p>
        </Sheet>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <div className="flex flex-1 flex-col gap-6 pt-4">
        <ResultIcon tone={res.result === "error" ? "warning" : "success"}>
          <ShieldCheck size={40} />
        </ResultIcon>
        <p className="text-center text-[17px] leading-7">{res.result === "error" ? COPY.errors.check : COPY.noCall}</p>
        <Button className="mt-auto" onClick={() => router.push("/app")}>
          Back to home
        </Button>
      </div>
    </AppScreen>
  );
}
