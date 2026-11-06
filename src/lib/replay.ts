import "server-only";
// Replay mode (section 24.1): drives the same pipeline as a live call.
import { db } from "./db";
import { SESSION_ID } from "./env";
import { addTimeline } from "./actions";
import { T } from "./copy";
import { decoyConnected, getSession, requestDecoy } from "./pipeline";

export async function startReplay(): Promise<{ callId: string } | { error: string }> {
  let s = await getSession();
  if (s.state === "decoy_live") {
    return { error: s.replay ? "A replay is already running." : "Decoy is on a live call. End it or reset the demo first." };
  }

  if (s.state === "decoy_requested" && s.call_id) {
    // The live voice line did not connect: take over the waiting call.
    await db().update("calls", { id: s.call_id }, { source: "replay" });
    await db().update("demo_sessions", { id: SESSION_ID() }, { replay: true });
  } else {
    if (s.state !== "verified_scam") {
      // Walk the story forward so every screen shows the same steps.
      if (s.state === "idle" || s.state === "ended") {
        await addTimeline("call", T.callStarted);
      }
      await db().update("demo_sessions", { id: SESSION_ID() }, {
        state: "verified_scam",
        call_started_at: s.call_started_at ?? new Date().toISOString(),
        call_id: null,
        decoy_started_at: null,
        decoy_requested_at: null,
        ended_at: null,
      });
      await addTimeline("check", T.checkScam);
    }
    await requestDecoy({ replay: true });
  }
  s = await decoyConnected("replay");
  return { callId: s.call_id! };
}
