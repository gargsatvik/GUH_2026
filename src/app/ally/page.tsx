"use client";
// Stretch 5: trusted contact. Claire approves or stops a paused payment.
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { UsersRound } from "lucide-react";
import { PhoneFrame } from "@/components/app/PhoneFrame";
import { Button, Card, IconCircle } from "@/components/ui";
import { post } from "@/lib/api";
import { formatSortCode } from "@/lib/normalise";
import { money } from "@/lib/format";
import { useRealtime } from "@/lib/useRealtime";

function Ally() {
  const id = useSearchParams().get("payment");
  const { rows: byId } = useRealtime("payments", { filter: { col: "id", value: id }, enabled: Boolean(id) });
  // With no id in the link, show the most recent paused payment.
  const { rows: paused } = useRealtime("payments", { filter: { col: "status", value: "paused" }, order: { col: "created_at", asc: false }, limit: 1, enabled: !id });
  const payment = id ? byId[0] : paused[0];
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const decide = async (decision: "approve" | "decline") => {
    if (!payment) return;
    setBusy(true);
    await post("/api/ally", { paymentId: payment.id, decision }).catch(() => {});
    setDone(true);
    setBusy(false);
  };

  return (
    <div className="flex flex-1 flex-col gap-5 p-5">
      <div className="flex items-center gap-3 pt-2">
        <IconCircle tone="brand" size={40}>
          <UsersRound size={20} />
        </IconCircle>
        <div>
          <div className="text-[13px] font-medium text-muted">NatWest trusted contact</div>
          <div className="font-semibold">Hi Claire</div>
        </div>
      </div>
      {!payment ? (
        <p className="text-muted">There are no payments waiting for you to check.</p>
      ) : done || payment.status !== "paused" ? (
        <p className="pt-6 text-[19px] leading-7 font-medium">Thank you. We&apos;ve let Margaret know.</p>
      ) : (
        <>
          <p className="font-serif text-[22px] leading-8 font-semibold">
            Margaret is trying to pay {money(payment.amount_pence)} to {payment.payee_name}. We&apos;ve paused it because the account was reported in a
            scam call.
          </p>
          <Card className="divide-y divide-line">
            <div className="flex justify-between px-4 py-3">
              <span className="text-muted">To</span>
              <span className="tnum text-right font-mono">
                {payment.payee_name}
                <br />
                {formatSortCode(payment.sort_code)} {payment.account_number}
              </span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-muted">Amount</span>
              <span className="tnum font-mono">{money(payment.amount_pence)}</span>
            </div>
          </Card>
          <div className="mt-auto flex flex-col gap-3">
            <Button loading={busy} onClick={() => decide("decline")}>
              Stop this payment
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => decide("approve")}>
              It&apos;s fine, let it go
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function AllyPage() {
  return (
    <PhoneFrame>
      <Suspense>
        <Ally />
      </Suspense>
    </PhoneFrame>
  );
}
