"use client";
// Hidden demo controls (section 5.3). Press D on /ops.
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import { Button, Card } from "@/components/ui";
import { post } from "@/lib/api";
import type { DemoSession } from "@/lib/types";
import { useNow } from "@/lib/useRealtime";
import { resetDemoAction, setNatwestCallingAction, startCallAction, startReplayAction } from "@/app/ops/actions";

type Line = { speaker: "caller" | "decoy"; text: string; delayMs: number };
type Msg = { text: string; tone: "ok" | "error" } | null;

const STATE_WORDS: Record<string, string> = {
  call_active: "a customer call is already in progress",
  verified_genuine: "a customer call is already in progress",
  verified_scam: "a customer call is already in progress",
  decoy_requested: "the call is being passed to Decoy",
  decoy_live: "Decoy is on a call",
};

export function DemoPanel({ session }: { session: DemoSession | null }) {
  const [open, setOpen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const cancel = useRef(false);
  const speedRef = useRef(1);
  const sessionRef = useRef(session);
  const now = useNow(1000);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "d" || e.key === "D") setOpen((o) => !o);
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The voice line has not connected 8 s after the customer passed the call.
  const stuck = Boolean(
    now &&
      session?.state === "decoy_requested" &&
      !session.replay &&
      session.decoy_requested_at &&
      now - new Date(session.decoy_requested_at).getTime() > 8000,
  );

  useEffect(() => {
    if (stuck) setOpen(true);
  }, [stuck]);

  const act = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Something went wrong", tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms / speedRef.current));

  // The replay call is still the one on screen and still live.
  const stillLive = (callId: string) => {
    const s = sessionRef.current;
    return !cancel.current && s?.call_id === callId && s.state === "decoy_live";
  };

  const runReplay = async () => {
    setRunning(true);
    cancel.current = false;
    setMsg(null);
    try {
      const script: Line[] = await fetch("/replay/script.json", { cache: "no-store" }).then((r) => r.json());
      const started = await startReplayAction();
      if ("error" in started) {
        setMsg({ text: started.error, tone: "error" });
        return;
      }
      const { callId } = started;
      setMsg({ text: "Replay running", tone: "ok" });

      let inFlight = false;
      let again = false;
      const capture = () => {
        if (inFlight) {
          again = true;
          return;
        }
        inFlight = true;
        post("/api/capture", { callId })
          .catch(() => {})
          .finally(() => {
            inFlight = false;
            if (again && !cancel.current) {
              again = false;
              capture();
            }
          });
      };

      // Wait for this screen to see the live call before the first line.
      for (let i = 0; i < 20 && sessionRef.current?.call_id !== callId; i++) await new Promise((r) => setTimeout(r, 100));

      for (const line of script) {
        await sleep(line.delayMs);
        if (!stillLive(callId)) {
          if (!cancel.current) setMsg({ text: "Replay stopped: the call ended", tone: "ok" });
          return;
        }
        await post("/api/transcript", { callId, speaker: line.speaker, text: line.text });
        if (line.speaker === "caller") capture();
      }
      await sleep(1200);
      if (stillLive(callId)) {
        await post("/api/call/end", { callId, reason: "caller_hung_up" });
        setMsg({ text: "Replay finished", tone: "ok" });
      }
    } catch (e) {
      // A reset mid-replay removes the call; that is expected, not an error.
      if (!cancel.current) setMsg({ text: e instanceof Error ? e.message : "Replay failed", tone: "error" });
    } finally {
      setRunning(false);
    }
  };

  if (!open) return null;
  return (
    <Card raised className="fixed right-6 bottom-6 z-50 w-[320px] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Demo controls</h2>
        <button aria-label="Close" onClick={() => setOpen(false)} className="rounded-full p-1 text-muted hover:bg-paper">
          <X size={18} />
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <Button
          size="desktop"
          variant="secondary"
          loading={busy === "reset"}
          onClick={() =>
            act("reset", async () => {
              cancel.current = true;
              await resetDemoAction();
              setMsg({ text: "Demo reset", tone: "ok" });
            })
          }
        >
          Reset demo
        </Button>
        <Button
          size="desktop"
          loading={busy === "start"}
          onClick={() =>
            act("start", async () => {
              const r = await startCallAction();
              setMsg(
                r.ok
                  ? { text: "Customer call started", tone: "ok" }
                  : { text: `Can't start a call: ${STATE_WORDS[r.state ?? ""] ?? "a call is in progress"}. Reset the demo first.`, tone: "error" },
              );
            })
          }
        >
          Start customer call
        </Button>
        <label className="flex cursor-pointer items-center justify-between gap-2 rounded-[8px] border border-line px-3 py-2 text-[15px]">
          NatWest is calling this customer
          <input
            type="checkbox"
            aria-label="NatWest is calling this customer"
            className="h-4 w-4 accent-[var(--brand)]"
            checked={Boolean(session?.natwest_calling)}
            disabled={busy === "natwest"}
            onChange={(e) => {
              const value = e.target.checked;
              act("natwest", async () => {
                await setNatwestCallingAction(value);
                setMsg({ text: value ? "Checks now show a genuine NatWest call" : "Checks now show not NatWest", tone: "ok" });
              });
            }}
          />
        </label>
        <Button size="desktop" variant={stuck ? "primary" : "secondary"} loading={running} onClick={runReplay}>
          {stuck ? "Switch to replay" : "Run replay"}
        </Button>
        <div className="flex items-center gap-2 text-[15px]">
          <span className="text-muted">Replay speed</span>
          {[1, 2].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              aria-pressed={speed === s}
              className={clsx("h-8 rounded-[8px] px-3 font-mono", speed === s ? "bg-brand text-white" : "border border-line")}
            >
              {s}x
            </button>
          ))}
        </div>
        {msg && (
          <p role="status" className={clsx("text-[13px]", msg.tone === "error" ? "text-danger" : "text-muted")}>
            {msg.text}
          </p>
        )}
      </div>
    </Card>
  );
}
