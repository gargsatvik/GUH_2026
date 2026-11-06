"use client";
// Sounds made with Web Audio, so there are no audio files to load.
let ctx: AudioContext | null = null;

function audio(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return ctx;
}

/** Play a silent sound inside a user gesture so later playback is allowed. */
export async function unlockAudio() {
  const a = audio();
  await a.resume();
  const g = a.createGain();
  g.gain.value = 0;
  const o = a.createOscillator();
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.05);
}

/** A single soft UK-style ring, about 1.5 seconds. */
export function playRing(): Promise<void> {
  const a = audio();
  const g = a.createGain();
  g.connect(a.destination);
  const t = a.currentTime;
  const burst = (start: number) => {
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.08, start + 0.03);
    g.gain.setValueAtTime(0.08, start + 0.37);
    g.gain.linearRampToValueAtTime(0, start + 0.4);
  };
  burst(t);
  burst(t + 0.6);
  for (const f of [400, 450]) {
    const o = a.createOscillator();
    o.frequency.value = f;
    o.connect(g);
    o.start(t);
    o.stop(t + 1.0);
  }
  return new Promise((r) => setTimeout(r, 1500));
}
