"use client";
import Link from "next/link";
import { use } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button, Footer } from "@/components/ui";
import { Markdown } from "@/lib/markdown";
import { dateTime, timer } from "@/lib/format";
import { useRealtime } from "@/lib/useRealtime";

export default function ReportPage({ params }: PageProps<"/ops/reports/[id]">) {
  const { id } = use(params);
  const { rows, loaded } = useRealtime("reports", { filter: { col: "id", value: id } });
  const report = rows[0];
  const { rows: calls } = useRealtime("calls", { filter: { col: "id", value: report?.call_id } });
  const { rows: campaigns } = useRealtime("campaigns");
  const call = calls[0];
  const campaign = campaigns.find((c) => c.id === call?.campaign_id);

  return (
    <div className="min-h-dvh bg-paper px-4 py-10">
      <div className="no-print mx-auto mb-4 flex max-w-[760px] items-center justify-between">
        <Link href="/ops" className="inline-flex items-center gap-1 text-[15px] font-medium text-brand">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <Button size="desktop" variant="secondary" onClick={() => window.print()}>
          <Printer size={16} /> Print
        </Button>
      </div>
      <article className="mx-auto max-w-[760px] rounded-[10px] border border-line bg-surface p-10 shadow-[0_8px_24px_rgba(20,18,26,.08)]">
        {!report ? (
          <p className="text-muted">{loaded ? "Report not found." : "Loading..."}</p>
        ) : (
          <>
            <h1 className="font-serif text-[32px] leading-[38px] font-semibold">{report.title}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-b border-line pb-4 text-[13px] text-muted">
              <span>{dateTime(report.created_at)}</span>
              <span className="tnum font-mono">Call {report.call_id.slice(0, 8)}</span>
              {campaign && <span>{campaign.name}</span>}
              {call?.duration_seconds != null && <span className="tnum font-mono">{timer(call.duration_seconds)}</span>}
              {report.sent_to && <span>Sent to {report.sent_to}</span>}
            </div>
            <div className="prose-report mt-2 text-[15px]">
              <Markdown source={report.body_md} />
            </div>
          </>
        )}
      </article>
      <Footer className="mt-6" />
    </div>
  );
}
