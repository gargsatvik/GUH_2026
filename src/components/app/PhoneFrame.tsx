"use client";
import { useRef, type ReactNode } from "react";
import { Footer } from "@/components/ui";
import { postSession } from "@/lib/api";
import { clockTime } from "@/lib/format";
import { useNow } from "@/lib/useRealtime";

/** Phone frame on desktop (390 x 844), full screen on phones (21.2). */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper min-[501px]:flex min-[501px]:flex-col min-[501px]:items-center min-[501px]:justify-center min-[501px]:gap-4 min-[501px]:py-8">
      <div className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-paper min-[501px]:h-[844px] min-[501px]:min-h-0 min-[501px]:w-[390px] min-[501px]:rounded-[44px] min-[501px]:border min-[501px]:border-line min-[501px]:shadow-[0_8px_24px_rgba(20,18,26,.08)]">
        <StatusBar />
        <div className="relative flex flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
      <Footer className="hidden max-w-[390px] px-4 min-[501px]:block" />
    </div>
  );
}

function StatusBar() {
  const now = useNow(10000);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hidden demo control: long press the time for 1 s to start a customer call.
  const start = () => {
    timer.current = setTimeout(() => {
      postSession("start_call").catch(() => {});
      navigator.vibrate?.(30);
    }, 1000);
  };
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  return (
    <div className="flex h-11 shrink-0 items-center justify-between bg-brand px-7 pt-[env(safe-area-inset-top)] text-[13px] font-semibold text-white min-[501px]:pt-0">
      <span
        className="tnum cursor-default select-none"
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        {now ? clockTime(new Date(now)) : "--:--"}
      </span>
      <span className="flex items-center gap-1.5" aria-hidden>
        <span className="flex items-end gap-[2px]">
          {[4, 6, 8, 10].map((h) => (
            <span key={h} className="w-[3px] rounded-sm bg-white" style={{ height: h }} />
          ))}
        </span>
        <span className="ml-1 h-[11px] w-[22px] rounded-[3px] border border-white/80 p-[1px]">
          <span className="block h-full w-[70%] rounded-[1px] bg-white" />
        </span>
      </span>
    </div>
  );
}
