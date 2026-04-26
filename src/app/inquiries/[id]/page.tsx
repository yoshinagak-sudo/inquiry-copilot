import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  categoryClass,
  formatDateTime,
  formatRelative,
  statusBadge,
} from "@/lib/format";
import { Badge } from "@/components/Badge";
import { DraftEditor } from "./DraftEditor";
import type { InquiryDetail } from "@/types";

export default async function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let detail: InquiryDetail;
  try {
    detail = await apiFetch<InquiryDetail>(`/api/inquiries/${id}`);
  } catch {
    notFound();
  }

  if (!detail || !detail.id) notFound();

  const sb = statusBadge(detail.status);

  return (
    <div className="space-y-6">
      {/* パンくず */}
      <nav className="text-[12px] text-stone-500" aria-label="パンくず">
        <Link
          href="/"
          className="rounded-sm hover:text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          受信箱
        </Link>
        <span aria-hidden className="mx-2">/</span>
        <span className="text-stone-700">{detail.subject}</span>
      </nav>

      {/* 件名 + ステータス */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">
            {detail.subject}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-stone-600">
            <span>{detail.fromName}</span>
            <span className="text-stone-400">·</span>
            <span className="font-mono text-[11px]">{detail.fromEmail}</span>
            <span className="text-stone-400">·</span>
            <span>{formatRelative(detail.receivedAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {detail.category && (
            <Badge className={categoryClass(detail.category.name)}>
              {detail.category.name}
            </Badge>
          )}
          <Badge className={sb.className} dot>
            {sb.label}
          </Badge>
        </div>
      </header>

      {/* 問い合わせ本文 */}
      <section
        aria-labelledby="inquiry-body-title"
        className="rounded-lg border border-stone-200 bg-white shadow-sm"
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
          <h2
            id="inquiry-body-title"
            className="text-[13px] font-medium text-stone-700"
          >
            問い合わせ本文
          </h2>
          <span className="text-[11px] text-stone-500">
            受信: {formatDateTime(detail.receivedAt)}
          </span>
        </div>
        <div className="px-4 py-4">
          <p className="whitespace-pre-wrap text-[14px] leading-7 text-stone-800">
            {detail.body}
          </p>
        </div>
      </section>

      {/* 草案 / 送信済み */}
      <DraftEditor inquiry={detail} />
    </div>
  );
}
