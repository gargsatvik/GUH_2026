"use client";
// Stretch 8: crypto wallet trace. Simulated hops, clearly labelled as
// demonstration data. The same wallet always produces the same trace.
import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowLeft, Wallet } from "lucide-react";
import { Card, Footer, Pill } from "@/components/ui";

function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

const HEX = "0123456789abcdef";
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function fakeAddress(r: () => number, tron: boolean) {
  const chars = tron ? B58 : HEX;
  let s = tron ? "TDEMO" : "0xdemo";
  for (let i = 0; i < (tron ? 26 : 20); i++) s += chars[Math.floor(r() * chars.length)];
  return s;
}

const LABELS = ["Intermediate wallet", "Intermediate wallet", "Mixing service (suspected)", "Peel chain", "Exchange deposit address"];

function Trace() {
  const wallet = useSearchParams().get("wallet") ?? "";
  const tron = wallet.startsWith("T");
  const hops = useMemo(() => {
    const r = rng(wallet);
    let amount = 3000 + Math.round(r() * 9000);
    const start = Date.now() - 1000 * 60 * 60 * (6 + Math.round(r() * 30));
    return Array.from({ length: 5 }, (_, i) => {
      amount = Math.round(amount * (0.82 + r() * 0.15));
      return {
        address: fakeAddress(r, tron),
        label: LABELS[i],
        amount,
        at: new Date(start + i * 1000 * 60 * (20 + Math.round(r() * 90))),
        tx: Array.from({ length: 16 }, () => HEX[Math.floor(r() * 16)]).join(""),
      };
    });
  }, [wallet, tron]);

  return (
    <div className="min-h-dvh bg-paper px-4 py-10">
      <div className="mx-auto max-w-[760px]">
        <Link href="/ops" className="inline-flex items-center gap-1 text-[15px] font-medium text-brand">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-[32px] leading-[38px] font-semibold">Wallet trace</h1>
          <Pill tone="warning">Demonstration data</Pill>
        </div>
        <p className="mt-2 text-[15px] text-muted">
          Simulated hops on a test network. In a real deployment this would come from a blockchain analytics provider.
        </p>
        <Card className="mt-6 p-4">
          <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
            <Wallet size={14} /> Wallet given by the caller ({tron ? "USDT on Tron" : "USDT on Ethereum"})
          </div>
          <div className="tnum mt-1 font-mono text-[15px] font-medium break-all">{wallet || "No wallet selected"}</div>
        </Card>
        {wallet &&
          hops.map((h, i) => (
            <div key={h.tx}>
              <div className="flex items-center gap-2 py-2 pl-6 text-[13px] text-muted">
                <ArrowDown size={14} />
                <span className="tnum font-mono">{h.amount.toLocaleString("en-GB")} USDT</span>
                <span>· {h.at.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="tnum font-mono">· tx {h.tx}</span>
              </div>
              <Card className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[13px] font-medium text-muted">
                    Hop {i + 1} · {h.label}
                  </div>
                  {i === hops.length - 1 && <Pill tone="brand">Request freeze from exchange</Pill>}
                </div>
                <div className="tnum mt-1 font-mono text-[15px] break-all">{h.address}</div>
              </Card>
            </div>
          ))}
        <Footer className="mt-8" />
      </div>
    </div>
  );
}

export default function TracePage() {
  return (
    <Suspense>
      <Trace />
    </Suspense>
  );
}
