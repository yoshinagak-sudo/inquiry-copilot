import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  META_PILL_PRODUCT_CLASS,
  categoryClass,
  formatDateTime,
  formatRelative,
  parseProductRefs,
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
  const productRefs = parseProductRefs(detail.productRefs);
  const hasMeta =
    Boolean(detail.budgetText) ||
    Boolean(detail.quantityText) ||
    productRefs.length > 0;

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

      {/* 案件メタサマリー（予算 / 個数 / 型番ヒット） */}
      {hasMeta && (
        <section
          aria-label="案件メタ情報"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-stone-200 bg-stone-50/60 px-4 py-2.5"
        >
          {detail.budgetText && (
            <MetaItem label="予算" value={detail.budgetText} />
          )}
          {detail.quantityText && (
            <MetaItem label="個数" value={detail.quantityText} />
          )}
          {productRefs.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                過去事例
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {productRefs.map((ref) => (
                  <span
                    key={ref}
                    className={META_PILL_PRODUCT_CLASS}
                    title={`型番ヒット: ${ref}`}
                  >
                    <span aria-hidden>#</span>
                    <span className="font-mono">{ref}</span>
                  </span>
                ))}
                <span className="text-[11px] text-stone-500">ヒット</span>
              </div>
            </div>
          )}
        </section>
      )}

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

/** 案件メタの「ラベル + 値」を小さく並べる単位 */
const MetaItem = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center gap-1.5">
    <span className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
      {label}
    </span>
    <span className="text-[13px] font-medium text-stone-800">{value}</span>
  </div>
);
