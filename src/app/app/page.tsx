"use client";
import Link from "next/link";
import { ArrowLeftRight, CreditCard, HelpCircle, Phone, Send, ShieldCheck, ShoppingBag, Bus, Landmark, Pill as PillIcon } from "lucide-react";
import { Button, Card, Footer, IconCircle, Pill, Wordmark } from "@/components/ui";
import { COPY } from "@/lib/copy";
import { useNow, useSession } from "@/lib/useRealtime";
import { useRouter } from "next/navigation";

const TRANSACTIONS = [
  { name: "Tesco", amount: "-£23.40", icon: ShoppingBag, when: "Today" },
  { name: "Bus fare", amount: "-£2.00", icon: Bus, when: "Today" },
  { name: "Pension credit", amount: "+£1,203.15", icon: Landmark, when: "Yesterday" },
  { name: "Boots", amount: "-£8.99", icon: PillIcon, when: "Yesterday" },
];

function greeting(now: number) {
  if (!now) return "Hello";
  const h = new Date(now).getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const { session } = useSession();
  const now = useNow(60000);
  const router = useRouter();
  const state = session?.state ?? "idle";
  const onCall = state === "call_active" || state === "verified_genuine" || state === "verified_scam";
  const decoyOn = state === "decoy_requested" || state === "decoy_live";
  const first = session?.customer_first ?? "Margaret";

  return (
    <div className="flex flex-1 flex-col">
      <header className="h-[140px] shrink-0 bg-brand px-5 pt-4 text-white">
        <div className="flex items-center justify-between">
          <Wordmark />
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">MW</span>
        </div>
        <h1 className="mt-6 font-serif text-[26px] leading-8 font-semibold">
          {greeting(now)}, {first}
        </h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {onCall && (
          <Card raised className="slide-down border-l-4 border-l-brand p-4">
            <div className="flex gap-3">
              <IconCircle tone="brand" size={36}>
                <Phone size={18} />
              </IconCircle>
              <div className="flex-1">
                <h2 className="text-base leading-6 font-semibold">{COPY.banner.title}</h2>
                <p className="mt-1 text-[15px] leading-[22px] text-muted">{COPY.banner.body}</p>
              </div>
            </div>
            <Button className="mt-4" onClick={() => router.push("/app/check")}>
              {COPY.banner.button}
            </Button>
          </Card>
        )}

        {decoyOn && (
          <Link href="/app/decoy" className="slide-down">
            <Card className="flex items-center gap-3 border-l-4 border-l-brand bg-brand-tint p-4">
              <Pill tone="success" dot>
                {COPY.live.pill}
              </Pill>
              <span className="font-semibold">{COPY.live.title}</span>
            </Card>
          </Link>
        )}

        <Card className="p-4">
          <div className="text-[13px] font-medium text-muted">Current account · ending 4417</div>
          <div className="tnum mt-1 font-mono text-[28px] font-medium">£2,431.60</div>
        </Card>
        <Card className="p-4">
          <div className="text-[13px] font-medium text-muted">Instant Saver</div>
          <div className="tnum mt-1 font-mono text-[28px] font-medium">£18,200.00</div>
        </Card>

        <nav className="grid grid-cols-4 gap-2" aria-label="Actions">
          {[
            { label: "Pay", icon: Send, href: "/app/pay" },
            { label: "Transfer", icon: ArrowLeftRight, href: "#" },
            { label: "Cards", icon: CreditCard, href: "#" },
            { label: "Help", icon: HelpCircle, href: "#help" },
          ].map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-[10px] border border-line bg-surface text-[13px] font-medium hover:bg-brand-tint"
            >
              <a.icon size={22} className="text-brand" />
              {a.label}
            </Link>
          ))}
        </nav>

        <section>
          <h2 className="mb-2 text-base font-semibold">Recent</h2>
          <Card>
            {TRANSACTIONS.map((t, i) => (
              <div key={t.name} className={`flex items-center gap-3 px-4 py-3 ${i ? "border-t border-line" : ""}`}>
                <IconCircle tone="muted" size={32}>
                  <t.icon size={16} />
                </IconCircle>
                <div className="flex-1">
                  <div className="text-[15px] font-medium">{t.name}</div>
                  <div className="text-[13px] text-muted">{t.when}</div>
                </div>
                <div className={`tnum font-mono text-[15px] ${t.amount.startsWith("+") ? "text-success" : ""}`}>{t.amount}</div>
              </div>
            ))}
          </Card>
        </section>

        <Card className="p-4" >
          <div id="help" className="flex items-center gap-3">
            <IconCircle tone="brand" size={36}>
              <ShieldCheck size={18} />
            </IconCircle>
            <div className="flex-1">
              <div className="text-[15px] font-semibold">Not sure about a call?</div>
              <Link href="/app/check" className="text-[15px] text-brand underline-offset-4 hover:underline">
                Check a call
              </Link>
            </div>
          </div>
        </Card>

        <Footer className="mt-auto pt-2 min-[501px]:hidden" />
      </div>
    </div>
  );
}
