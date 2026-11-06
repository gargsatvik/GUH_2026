"use server";
// Server actions for the hidden demo panel. Running on the server means the
// shared secret never reaches browser code (section 12).
import { resetDemo, setNatwestCalling, startCall, TransitionError } from "@/lib/pipeline";
import { startReplay } from "@/lib/replay";

export async function resetDemoAction() {
  await resetDemo();
}

export async function startCallAction(): Promise<{ ok: boolean; state?: string }> {
  try {
    await startCall();
    return { ok: true };
  } catch (e) {
    if (e instanceof TransitionError) return { ok: false, state: e.state };
    throw e;
  }
}

export async function setNatwestCallingAction(value: boolean) {
  await setNatwestCalling(value);
}

export async function startReplayAction() {
  return startReplay();
}
