"use client";
import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { DISCLAIMER } from "@/lib/copy";

// ---------- Button (20.4) ----------

type Variant = "primary" | "secondary" | "quiet" | "danger";

export function Button({
  variant = "primary",
  size = "mobile",
  className,
  loading,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "mobile" | "desktop"; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-[8px] font-medium transition duration-150 ease-out select-none",
        "disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]",
        size === "mobile" ? "min-h-12 w-full px-5 text-base" : "h-10 px-4 text-[15px]",
        variant === "primary" && "bg-brand text-white hover:bg-brand-hover active:bg-brand-hover",
        variant === "secondary" && "border border-line bg-surface text-ink hover:bg-paper",
        variant === "danger" && "border border-danger/30 bg-surface text-danger hover:bg-danger-tint",
        variant === "quiet" && "min-h-0 w-auto px-0 text-brand underline-offset-4 hover:underline",
        className,
      )}
    >
      {loading && <Spinner className="h-4 w-4 border-2" light={variant === "primary"} />}
      {children}
    </button>
  );
}

export function Spinner({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "spin inline-block rounded-full border-[3px]",
        light ? "border-white/30 border-t-white" : "border-brand/15 border-t-brand",
        className,
      )}
    />
  );
}

// ---------- Card ----------

export function Card({ className, children, raised }: { className?: string; children: ReactNode; raised?: boolean }) {
  return (
    <div
      className={clsx(
        "rounded-[10px] border border-line bg-surface",
        raised ? "shadow-[0_8px_24px_rgba(20,18,26,.08)]" : "shadow-[0_1px_2px_rgba(20,18,26,.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------- Pill ----------

type Tone = "danger" | "warning" | "success" | "brand" | "muted";
const TONE: Record<Tone, string> = {
  danger: "bg-danger-tint text-danger",
  warning: "bg-warning-tint text-warning",
  success: "bg-success-tint text-success",
  brand: "bg-brand-tint text-brand",
  muted: "bg-paper text-muted border border-line",
};

export function Pill({ tone, children, dot, className }: { tone: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[13px] font-medium leading-none",
        TONE[tone],
        className,
      )}
    >
      {dot && <StatusDot tone={tone} live />}
      {children}
    </span>
  );
}

export function StatusDot({ tone = "success", live }: { tone?: Tone; live?: boolean }) {
  const color =
    tone === "success" ? "bg-success text-success/40" : tone === "warning" ? "bg-warning text-warning/40" : tone === "danger" ? "bg-danger text-danger/40" : "bg-brand text-brand/40";
  return <span aria-hidden className={clsx("inline-block h-2 w-2 shrink-0 rounded-full", color, live && "live-dot")} />;
}

// ---------- Icon circle ----------

export function IconCircle({ tone, size = 32, children, className }: { tone: Tone; size?: number; children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx("inline-flex shrink-0 items-center justify-center rounded-full", TONE[tone], className)}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}

// ---------- Count-up number (Stat, 20.4) ----------

export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 600);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(shown)}</>;
}

// ---------- Bottom sheet (mobile) ----------

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <div className="slide-up relative rounded-t-2xl bg-surface p-5 pb-8 shadow-[0_8px_24px_rgba(20,18,26,.08)] rise-in">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <div className="mb-2 flex items-start justify-between gap-4">
          <h2 className="font-serif text-[22px] leading-7 font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 text-muted hover:bg-paper">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Footer ----------

export function Footer({ className }: { className?: string }) {
  return <footer className={clsx("text-center text-[13px] leading-[18px] text-muted", className)}>{DISCLAIMER}</footer>;
}

export function Wordmark({ light = true }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={clsx("font-sans text-lg font-semibold tracking-tight", light ? "text-white" : "text-brand")}>NatWest</span>
      <span
        className={clsx(
          "rounded-full px-2 py-0.5 text-[11px] font-medium",
          light ? "bg-white/15 text-white" : "bg-brand-tint text-brand",
        )}
      >
        Concept
      </span>
    </span>
  );
}
