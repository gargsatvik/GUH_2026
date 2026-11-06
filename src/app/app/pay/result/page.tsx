"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, PauseCircle, XCircle } from "lucide-react";
import { AppScreen, Emphasis, ResultIcon } from "@/components/app/AppScreen";
import { Button, Card } from "@/components/ui";
import { post } from "@/lib/api";
import { COPY } from "@/lib/copy";
import { formatSortCode } from "@/lib/normalise";
import { money } from "@/lib/format";
import { useRealtime } from "@/lib/useRealtime";
import type { PayResult } from "../page";

type Stored = PayResult & { payeeName: string; sort: string; acct: string; pence: number };

function Result() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const [stored, setStored] = useState<Stored | null>(null);
  const [busy, setBusy] = useState(false);
  const { rows } = useRealtime("payments", { filter: { col: "id", value: id } });
  const payment = rows[0];

  useEffect(() => {
    try {
      const raw = id && sessionStorage.getItem(`pay:${id}`);
      if (raw) setStored(JSON.parse(raw));
    } catch {}
  }, [id]);

  if (!payment) return <AppScreen>{null}</AppScreen>;
  const display = `${formatSortCode(payment.sort_code)} ${payment.account_number}`;

  if (payment.status === "sent" || payment.status === "approved") {
    return (
      <AppScreen hideBack>
        <div className="flex flex-1 flex-col gap-6 pt-8 text-center">
          <ResultIcon tone="success">
            <CheckCircle2 size={40} />
          </ResultIcon>
          <h1 className="font-serif text-[32px] leading-[38px] font-semibold">{COPY.sent.title}</h1>
          <p className="text-[17px]">
            <span className="tnum font-mono">{money(payment.amount_pence)}</span> to {payment.payee_name}
          </p>
          <Button className="mt-auto" onClick={() => router.push("/app")}>
            {COPY.sent.done}
          </Button>
        </div>
      </AppScreen>
    );
  }

  if (payment.status === "cancelled") {
    return (
      <AppScreen hideBack>
        <div className="flex flex-1 flex-col gap-6 pt-8 text-center">
          <ResultIcon tone="success">
            <XCircle size={40} />
          </ResultIcon>
          <p className="text-[19px] leading-7 font-medium">{COPY.paused.cancelled}</p>
          <Button className="mt-auto" onClick={() => router.push("/app")}>
            {COPY.sent.done}
          </Button>
        </div>
      </AppScreen>
    );
  }

  const paused = stored?.status === "paused" ? stored : null;
  return (
    <AppScreen hideBack>
      <div className="flex flex-1 flex-col gap-5 pt-4">
        <ResultIcon tone="warning">
          <PauseCircle size={40} />
        </ResultIcon>
        <div className="text-center">
          <h1 className="font-serif text-[32px] leading-[38px] font-semibold">{COPY.paused.title}</h1>
          <p className="mt-3 text-[17px] leading-7">{COPY.paused.body(paused?.reportedAgo ?? "recently")}</p>
        </div>
        <Card className="divide-y divide-line">
          <div className="flex justify-between gap-4 px-4 py-3">
            <span className="text-muted">To</span>
            <span className="text-right font-medium">
              {payment.payee_name}
              <span className="tnum block font-mono text-[15px] font-normal">{display}</span>
            </span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-muted">Amount</span>
            <span className="tnum font-mono font-medium">{money(payment.amount_pence)}</span>
          </div>
          {paused?.campaignName && <div className="px-4 py-3 text-[15px] font-medium">{COPY.paused.linked(paused.campaignName)}</div>}
        </Card>
        <Emphasis tone="warning">{COPY.paused.emphasis}</Emphasis>
        <div className="mt-auto flex flex-col gap-3 pt-2">
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await post("/api/payment/cancel", { paymentId: payment.id }).catch(() => {});
              setBusy(false);
            }}
          >
            {COPY.paused.cancel}
          </Button>
          <Button variant="secondary" onClick={() => router.push(`/app/protect?payment=${payment.id}`)}>
            {COPY.paused.talk}
          </Button>
          <p className="text-center text-[13px] text-muted">{COPY.paused.ally}</p>
        </div>
      </div>
    </AppScreen>
  );
}

export default function ResultPage() {
  return (
    <Suspense>
      <Result />
    </Suspense>
  );
}
