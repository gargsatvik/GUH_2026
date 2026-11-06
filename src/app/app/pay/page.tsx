"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Phone } from "lucide-react";
import clsx from "clsx";
import { AppScreen } from "@/components/app/AppScreen";
import { Button, Card, Sheet } from "@/components/ui";
import { post } from "@/lib/api";
import { COPY } from "@/lib/copy";
import { money } from "@/lib/format";
import { useSession } from "@/lib/useRealtime";

const formatSort = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 6);
  return d.replace(/(\d{2})(?=\d)/g, "$1-");
};

export type PayResult =
  | { status: "sent"; paymentId: string }
  | { status: "paused"; paymentId: string; reason: string; reportedAgo: string; reportCount: number; campaignName: string | null };

export default function PayPage() {
  const router = useRouter();
  const { session } = useSession();
  const [name, setName] = useState("");
  const [sort, setSort] = useState("");
  const [acct, setAcct] = useState("");
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [review, setReview] = useState(false);
  const [interrupt, setInterrupt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [netErr, setNetErr] = useState<string | null>(null);

  const pence = Math.round(parseFloat(amount.replace(/[£,\s]/g, "")) * 100);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = COPY.pay.errName;
    if (sort.replace(/\D/g, "").length !== 6) e.sort = COPY.pay.errSort;
    if (acct.replace(/\D/g, "").length !== 8) e.acct = COPY.pay.errAccount;
    if (!pence || pence <= 0) e.amount = COPY.pay.errAmount;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    setBusy(true);
    setNetErr(null);
    try {
      const r = await post<PayResult>("/api/payee-check", {
        payeeName: name.trim(),
        sortCode: sort,
        accountNumber: acct,
        amountPence: pence,
        reference: ref.trim() || undefined,
      });
      try {
        sessionStorage.setItem(`pay:${r.paymentId}`, JSON.stringify({ ...r, payeeName: name.trim(), sort, acct, pence }));
      } catch {}
      router.push(`/app/pay/result?id=${r.paymentId}`);
    } catch {
      setNetErr(COPY.errors.network);
      setBusy(false);
    }
  };

  // Payment-time interrupt (18.4): a new payee while a phone call is in progress.
  const onCall = session && ["call_active", "verified_scam", "decoy_live"].includes(session.state);
  const pay = () => (onCall ? setInterrupt(true) : submit());

  if (review) {
    return (
      <AppScreen back="/app/pay" backLabel="Edit">
        <h1 className="font-serif text-[28px] leading-9 font-semibold">{COPY.pay.review}</h1>
        <Card className="mt-5 divide-y divide-line">
          <Row label="To" value={name} />
          <Row label="Sort code" value={formatSort(sort)} mono />
          <Row label="Account number" value={acct} mono />
          <Row label="Amount" value={money(pence)} mono />
          {ref && <Row label="Reference" value={ref} />}
        </Card>
        {netErr && <p className="mt-3 text-[15px] text-danger">{netErr}</p>}
        <div className="mt-auto flex flex-col gap-3 pt-6">
          <Button loading={busy} onClick={pay}>
            {COPY.pay.payButton(money(pence))}
          </Button>
          <Button variant="secondary" onClick={() => setReview(false)}>
            Edit details
          </Button>
        </div>
        <Sheet open={interrupt} onClose={() => setInterrupt(false)} title={COPY.interrupt.title}>
          <div className="flex gap-3">
            <Phone size={20} className="mt-0.5 shrink-0 text-brand" />
            <p className="leading-6">{COPY.interrupt.body}</p>
          </div>
          <div className="mt-5 flex flex-col gap-3">
            <Button onClick={() => router.push("/app/check")}>{COPY.interrupt.check}</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setInterrupt(false);
                submit();
              }}
            >
              {COPY.interrupt.cont}
            </Button>
          </div>
        </Sheet>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <h1 className="font-serif text-[28px] leading-9 font-semibold">{COPY.pay.title}</h1>
      <form
        className="mt-5 flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (validate()) setReview(true);
        }}
      >
        <Field label={COPY.pay.name} error={errors.name}>
          <input className={inputCls(errors.name)} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label={COPY.pay.sort} error={errors.sort}>
          <input
            className={inputCls(errors.sort, true)}
            inputMode="numeric"
            placeholder="00-00-00"
            value={sort}
            onChange={(e) => setSort(formatSort(e.target.value))}
          />
        </Field>
        <Field label={COPY.pay.account} error={errors.acct}>
          <input
            className={inputCls(errors.acct, true)}
            inputMode="numeric"
            placeholder="12345678"
            value={acct}
            onChange={(e) => setAcct(e.target.value.replace(/\D/g, "").slice(0, 8))}
          />
        </Field>
        <Field label={COPY.pay.amount} error={errors.amount}>
          <div className="relative">
            <span className="absolute top-1/2 left-4 -translate-y-1/2 font-mono text-muted">£</span>
            <input
              className={clsx(inputCls(errors.amount, true), "pl-8")}
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
            />
          </div>
        </Field>
        <Field label={COPY.pay.reference}>
          <input className={inputCls()} value={ref} maxLength={18} onChange={(e) => setRef(e.target.value)} />
        </Field>
        <Button type="submit" className="mt-2">
          {COPY.pay.continue}
        </Button>
      </form>
    </AppScreen>
  );
}

const inputCls = (err?: string, mono?: boolean) =>
  clsx(
    "h-[52px] w-full rounded-[8px] border bg-surface px-4 text-[17px] outline-none focus:ring-2 focus:ring-brand",
    err ? "border-danger" : "border-line",
    mono && "tnum font-mono",
  );

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium tracking-[0.01em] text-muted">{label}</span>
      {children}
      {error && <span className="text-[13px] text-danger">{error}</span>}
    </label>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-[15px] text-muted">{label}</span>
      <span className={clsx("text-right text-[15px] font-medium", mono && "tnum font-mono")}>{value}</span>
    </div>
  );
}
