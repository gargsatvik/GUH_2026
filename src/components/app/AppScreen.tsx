"use client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import clsx from "clsx";

/** Plain inner screen with a back link and padded content. */
export function AppScreen({
  children,
  back = "/app",
  backLabel = "Home",
  tint,
  hideBack,
}: {
  children: ReactNode;
  back?: string;
  backLabel?: string;
  tint?: "brand";
  hideBack?: boolean;
}) {
  return (
    <div className={clsx("flex flex-1 flex-col px-5 pb-8", tint === "brand" ? "bg-brand-tint" : "bg-paper")}>
      <div className="flex h-12 items-center">
        {!hideBack && (
          <Link href={back} className="-ml-2 inline-flex min-h-12 items-center gap-1 pr-3 text-[15px] font-medium text-brand">
            <ChevronLeft size={20} />
            {backLabel}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

export function ResultIcon({ tone, children }: { tone: "success" | "danger" | "warning"; children: ReactNode }) {
  const cls = tone === "success" ? "bg-success-tint text-success" : tone === "danger" ? "bg-danger-tint text-danger" : "bg-warning-tint text-warning";
  return <div className={clsx("pop-in mx-auto flex h-20 w-20 items-center justify-center rounded-full", cls)}>{children}</div>;
}

export function Emphasis({ tone, children }: { tone: "danger" | "warning"; children: ReactNode }) {
  return (
    <div
      className={clsx(
        "rounded-[10px] px-4 py-3 text-[15px] leading-[22px] font-medium",
        tone === "danger" ? "bg-danger-tint text-danger" : "bg-warning-tint text-warning",
      )}
    >
      {children}
    </div>
  );
}
