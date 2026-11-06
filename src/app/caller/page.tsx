"use client";
// Caller console (section 21.3). A teammate plays the caller here; their
// voice goes to the Decoy line through the ElevenLabs browser session.
import { useCallback, useEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { AlertTriangle, CreditCard, KeyRound, Mic, PhoneOff, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { Button, Card, Footer, Pill, StatusDot } from "@/components/ui";
import { post, postSession } from "@/lib/api";
import { CANARY_VARIABLES } from "@/lib/canary";
import { COPY } from "@/lib/copy";
import { timer } from "@/lib/format";
import { playRing, unlockAudio } from "@/lib/sounds";
import { useNow, useRealtime, useSession } from "@/lib/useRealtime";

const SCRIPT = {
  before: [
    "Mrs Wilson? Daniel Hughes, NatWest fraud team. Your account has been compromised.",
    "Open your NatWest app, we need to move your savings to a safe account.",
  ],
  after: [
    "Hi David. Daniel Hughes, NatWest fraud team. Your mum's account has been compromised. We need to move her savings to a safe account today.",
    "When asked for a number: \"You can call me back on oh one six one, four nine six, oh seven three two.\"",
    "\"The safe account is sort code twenty, forty-five, seventy-seven. Account number six three eight four, nine one two oh. Name, J Carter.\"",
    "\"Move two thousand pounds now. The rest once that's cleared.\"",
    "Optional: \"I'll also need the long number on her card to cancel it.\" / \"You'll get a code by text. Read it to me.\"",
    "Optional: \"David, please hurry, every minute they're taking more money.\"",
    "End: \"Forget it.\" Then press End call.",
  ],
};

export default function CallerPage() {
  const [pushToTalk, setPushToTalk] = useState(false);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!pushToTalk) return;
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => e.code === "Space" && setHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [pushToTalk]);

  return (
    <ConversationProvider isMuted={pushToTalk && !held}>
      <Console pushToTalk={pushToTalk} setPushToTalk={setPushToTalk} held={held} />
    </ConversationProvider>
  );
}

type LineError = "mic" | "voice" | null;

function Console({ pushToTalk, setPushToTalk, held }: { pushToTalk: boolean; setPushToTalk: (v: boolean) => void; held: boolean }) {
  const { session } = useSession();
  const now = useNow(500);
  const [armed, setArmed] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [error, setError] = useState<LineError>(null);
  const [voiceMissing, setVoiceMissing] = useState(false);

  // Without voice keys, run in practice mode: type the caller's lines, no microphone needed.
  useEffect(() => {
    fetch("/api/voice/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { decoy?: boolean }) => setVoiceMissing(!d.decoy))
      .catch(() => {});
  }, []);
  const [level, setLevel] = useState(0);
  const startedFor = useRef<string | null>(null);
  const callIdRef = useRef<string | null>(null);
  const endedRef = useRef(false);
  const { rows: calls } = useRealtime("calls", { filter: { col: "id", value: session?.call_id } });
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Single-flight capture guard (12.6)
  const capture = useRef({ inFlight: false, again: false });
  const queueCapture = useCallback((callId: string) => {
    const c = capture.current;
    if (c.inFlight) {
      c.again = true;
      return;
    }
    c.inFlight = true;
    post("/api/capture", { callId })
      .catch(() => {})
      .finally(() => {
        c.inFlight = false;
        if (c.again) {
          c.again = false;
          queueCapture(callId);
        }
      });
  }, []);

  const endCall = useCallback((reason: "caller_hung_up" | "operator_ended") => {
    const id = callIdRef.current;
    if (!id || endedRef.current) return;
    endedRef.current = true;
    post("/api/call/end", { callId: id, reason }).catch(() => {});
  }, []);

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      postSession("decoy_connected", { conversationId }).catch(() => {});
    },
    onMessage: ({ message, role }) => {
      const id = callIdRef.current;
      if (!id || !message?.trim()) return;
      // The person at the microphone is the caller.
      const speaker = role === "user" ? "caller" : "decoy";
      post("/api/transcript", { callId: id, speaker, text: message }).catch(() => {});
      if (speaker === "caller") queueCapture(id);
    },
    onDisconnect: () => {
      // Hanging up the voice line ends the call, unless replay or a reset took over.
      const s = sessionRef.current;
      if (s?.replay || s?.call_id !== callIdRef.current) return;
      endCall("caller_hung_up");
    },
    onError: () => setError("voice"),
  });

  const startDecoy = useCallback(
    async (callId: string) => {
      setError(null);
      callIdRef.current = callId;
      endedRef.current = false;
      try {
        const status = await fetch("/api/voice/status", { cache: "no-store" }).then((r) => r.json());
        if (!status.decoy) {
          setVoiceMissing(true);
          setError("voice");
          return;
        }
        const r = await fetch("/api/voice/token", { cache: "no-store" });
        const creds = await r.json();
        if (!r.ok) {
          if (creds.error === "not_configured") setVoiceMissing(true);
          setError("voice");
          return;
        }
        conversation.startSession({
          ...(creds.conversationToken
            ? { conversationToken: creds.conversationToken, connectionType: "webrtc" as const }
            : { signedUrl: creds.signedUrl }),
          dynamicVariables: CANARY_VARIABLES,
        });
      } catch {
        setError("voice");
      }
    },
    [conversation],
  );

  // React to the shared session (13): ring then connect when the customer passes the call.
  useEffect(() => {
    if (!armed || !session) return;
    if (session.state === "decoy_requested" && session.call_id && !session.replay && startedFor.current !== session.call_id) {
      startedFor.current = session.call_id;
      setRinging(true);
      const callId = session.call_id;
      playRing().then(() => {
        setRinging(false);
        const s = sessionRef.current;
        if (s?.state === "decoy_requested" && s.call_id === callId && !s.replay) startDecoy(callId);
      });
    }
    const voiceOn = conversation.status === "connected" || conversation.status === "connecting";
    const callOver = session.state === "ended" || session.state === "idle" || session.state === "call_active";
    if (voiceOn && (callOver || session.replay || session.call_id !== callIdRef.current)) conversation.endSession();
  }, [armed, session, startDecoy, conversation]);

  // Level indicator
  useEffect(() => {
    if (conversation.status !== "connected") return;
    const t = setInterval(() => {
      try {
        setLevel(conversation.isSpeaking ? conversation.getOutputVolume() : conversation.getInputVolume());
      } catch {}
    }, 120);
    return () => clearInterval(t);
  }, [conversation]);

  const arm = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.getTracks().forEach((t) => t.stop());
      await unlockAudio();
      setArmed(true);
    } catch {
      setError("mic");
    }
  };

  const live = conversation.status === "connected";
  const state = session?.state;
  const liveSecs = session?.decoy_started_at ? (now - new Date(session.decoy_started_at).getTime()) / 1000 : 0;
  const endedDur = calls[0]?.duration_seconds;

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="flex h-14 items-center gap-3 border-b border-line bg-surface px-6">
        <h1 className="font-serif text-xl font-semibold">Caller console</h1>
        <span className="text-[15px] text-muted">For the live demo only</span>
      </header>

      {voiceMissing && !error && (
        <div role="status" className="bg-brand-tint px-6 py-3 text-[15px] text-ink">
          <span className="font-semibold">Practice mode.</span> The voice line is not set up yet, so type the caller&apos;s lines instead. No microphone
          needed. Pass the call from the phone app, then press <span className="font-semibold">Connect typed line</span> here.
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-3 bg-danger-tint px-6 py-3 text-[15px] font-medium text-danger">
          <AlertTriangle size={18} />
          {error === "mic" ? COPY.errors.mic : COPY.errors.voice}
          {voiceMissing && (
            <span className="font-normal text-ink">
              The voice line is not set up yet (ELEVENLABS_API_KEY and ELEVENLABS_DECOY_AGENT_ID). Use replay on the dashboard, or type lines below.
            </span>
          )}
        </div>
      )}

      <main className="grid flex-1 grid-cols-1 gap-4 p-6 lg:grid-cols-[minmax(320px,420px)_1fr]">
        <section className="flex flex-col gap-4">
          <Card className="p-5">
            <div className="text-[13px] font-medium text-muted">Decoy line</div>
            {!armed ? (
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <StatusDot tone="muted" /> Line not armed
                </div>
                <Button size="desktop" onClick={arm}>
                  <Mic size={18} /> Arm line
                </Button>
              </div>
            ) : live ? (
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Pill tone="success" dot>
                    Live with Decoy
                  </Pill>
                  <span className="tnum font-mono text-2xl font-medium">{timer(liveSecs)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                    <div
                      className={clsx("h-full rounded-full transition-[width] duration-100", conversation.isSpeaking ? "bg-brand" : "bg-success")}
                      style={{ width: `${Math.min(100, Math.round(level * 140))}%` }}
                    />
                  </div>
                  <span className="w-32 text-[15px] font-medium">{conversation.isSpeaking ? "Decoy speaking" : "Listening"}</span>
                </div>
                {pushToTalk && (
                  <div className={clsx("rounded-[8px] px-3 py-2 text-center text-[15px] font-medium", held ? "bg-success-tint text-success" : "bg-paper text-muted")}>
                    {held ? "Talking" : "Hold space to talk"}
                  </div>
                )}
              </div>
            ) : ringing || conversation.status === "connecting" ? (
              <div className="mt-3 text-lg font-semibold">Ringing...</div>
            ) : state === "ended" ? (
              <div className="mt-3 text-lg font-semibold">Call ended{endedDur != null ? ` (${timer(endedDur)})` : ""}</div>
            ) : state === "call_active" || state === "verified_scam" || state === "verified_genuine" ? (
              <div className="mt-3 text-lg font-semibold">Customer on the line. Talk in the room.</div>
            ) : session?.replay && state === "decoy_live" ? (
              <div className="mt-3 text-lg font-semibold">Replay running on the dashboard.</div>
            ) : (
              <div className="mt-3 flex items-center gap-2 text-lg font-semibold">
                <StatusDot tone="success" /> Line armed. Waiting for the customer to pass the call.
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {live && (
                <Button size="desktop" variant="secondary" onClick={() => conversation.endSession()}>
                  <PhoneOff size={16} /> End call
                </Button>
              )}
              {armed && error === "voice" && session?.call_id && (
                <Button size="desktop" variant="quiet" onClick={() => startDecoy(session.call_id!)}>
                  <RefreshCw size={16} /> Reconnect
                </Button>
              )}
            </div>
            <label className="mt-4 flex items-center gap-2 text-[15px]">
              <input type="checkbox" checked={pushToTalk} onChange={(e) => setPushToTalk(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
              Hold space to talk (stops room noise reaching the line)
            </label>
          </Card>

          <Card className="p-5">
            <div className="text-[13px] font-medium text-muted">Decoy details tripwire</div>
            <p className="mt-1 text-[15px] text-muted">Act as the caller using details Decoy gave out.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="desktop" variant="secondary" onClick={() => post("/api/canary", { kind: "card" }).catch(() => {})}>
                <CreditCard size={16} /> Try stolen card
              </Button>
              <Button size="desktop" variant="secondary" onClick={() => post("/api/canary", { kind: "login" }).catch(() => {})}>
                <KeyRound size={16} /> Try stolen login
              </Button>
            </div>
          </Card>

          {(voiceMissing || !live) && session?.call_id && state === "decoy_live" && !session.replay && <TypeLine callId={session.call_id} onCaller={queueCapture} />}
          {voiceMissing && state === "decoy_requested" && session?.call_id && (
            <Card className="p-5">
              <div className="text-[13px] font-medium text-muted">Practice without voice</div>
              <p className="mt-1 text-[15px]">Connect a typed line so you can try the capture without the voice line.</p>
              <Button size="desktop" className="mt-3" onClick={() => postSession("decoy_connected", { conversationId: "typed" }).catch(() => {})}>
                Connect typed line
              </Button>
            </Card>
          )}
        </section>

        <section>
          <Card className="p-5">
            <h2 className="font-serif text-[22px] leading-7 font-semibold">Role card</h2>
            <p className="mt-1 text-[15px] text-muted">Speak clearly and say numbers in groups. If Decoy reads a number back wrong, correct it.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-[10px] bg-brand-tint p-4 font-mono text-[15px] sm:grid-cols-4">
              <Target label="Name" value="Daniel Hughes" />
              <Target label="Callback" value="0161 496 0732" />
              <Target label="Sort code" value="20-45-77" />
              <Target label="Account" value="63849120 (J Carter)" />
            </div>
            <Checklist title="Before the pass (to Margaret, in the room)" items={SCRIPT.before} start={1} />
            <Checklist title="After the pass (to Decoy, at the laptop)" items={SCRIPT.after} start={3} />
          </Card>
        </section>
      </main>
      <Footer className="pb-4" />
    </div>
  );
}

function Target({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-sans text-[13px] font-medium text-muted">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Checklist({ title, items, start }: { title: string; items: string[]; start: number }) {
  const [done, setDone] = useState<boolean[]>(items.map(() => false));
  return (
    <div className="mt-5">
      <h3 className="text-base font-semibold">{title}</h3>
      <ol className="mt-2 flex flex-col gap-2">
        {items.map((it, i) => (
          <li key={i}>
            <label className={clsx("flex cursor-pointer gap-3 rounded-[8px] p-2 text-[15px] leading-[22px] hover:bg-paper", done[i] && "text-muted line-through")}>
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
                checked={done[i]}
                onChange={() => setDone((d) => d.map((x, j) => (j === i ? !x : x)))}
              />
              <span>
                <span className="tnum mr-1 font-mono text-muted">{start + i}.</span>
                {it}
              </span>
            </label>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Lets you type caller lines when the voice line is not available. */
function TypeLine({ callId, onCaller }: { callId: string; onCaller: (id: string) => void }) {
  const [text, setText] = useState("");
  return (
    <Card className="p-5">
      <div className="text-[13px] font-medium text-muted">Type a line</div>
      <form
        className="mt-2 flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          setText("");
          await post("/api/transcript", { callId, speaker: "caller", text: t }).catch(() => {});
          onCaller(callId);
        }}
      >
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="As the caller..."
          className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[15px] outline-none focus:ring-2 focus:ring-brand"
        />
        <div className="flex gap-2">
          <Button size="desktop" type="submit">
            Send as caller
          </Button>
          <Button size="desktop" variant="secondary" type="button" onClick={() => post("/api/call/end", { callId, reason: "operator_ended" }).catch(() => {})}>
            End call
          </Button>
        </div>
      </form>
    </Card>
  );
}
