import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  categoryClass,
  confidenceClass,
  confidenceLabel,
  formatRelative,
  statusBadge,
} from "@/lib/format";
import { Badge } from "@/components/Badge";
import type { InquiryListItem, InquiryStatus } from "@/types";

type Filter = "all" | InquiryStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "new", label: "未着手" },
  { key: "drafted", label: "草案あり" },
  { key: "sent", label: "送信済み" },
];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const filter: Filter =
    sp.status === "new" ||
    sp.status === "drafted" ||
    sp.status === "sent" ||
    sp.status === "archived"
      ? sp.status
      : "all";

  // 全件取得（小さなダッシュボード用）+ フィルタは別途 fetch（API がサーバー側でフィルタするため）
  const all = await apiFetch<InquiryListItem[]>("/api/inquiries");
  const items =
    filter === "all"
      ? all
      : await apiFetch<InquiryListItem[]>(`/api/inquiries?status=${filter}`);

  const counts = {
    total: all.length,
    new: all.filter((i) => i.status === "new").length,
    drafted: all.filter((i) => i.status === "drafted").length,
    sent: all.filter((i) => i.status === "sent").length,
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">
          受信箱
        </h1>
        <p className="text-sm text-stone-600">
          御社宛の問い合わせを一覧表示します。AI が返信草案を準備しています。
        </p>
      </header>

      {/* サマリ */}
      <section
        aria-label="ステータスサマリ"
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        <SummaryCard label="合計" value={counts.total} />
        <SummaryCard
          label="未着手"
          value={counts.new}
          tone="warn"
          href="/?status=new"
        />
        <SummaryCard
          label="草案あり"
          value={counts.drafted}
          tone="primary"
          href="/?status=drafted"
        />
        <SummaryCard
          label="送信済み"
          value={counts.sent}
          tone="muted"
          href="/?status=sent"
        />
      </section>

      {/* フィルタ */}
      <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white p-1">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          const href = f.key === "all" ? "/" : `/?status=${f.key}`;
          const count =
            f.key === "all"
              ? counts.total
              : f.key === "new"
              ? counts.new
              : f.key === "drafted"
              ? counts.drafted
              : counts.sent;
          return (
            <Link
              key={f.key}
              href={href}
              className={[
                "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                active
                  ? "bg-stone-900 text-white shadow-sm"
                  : "text-stone-600 hover:bg-stone-100",
              ].join(" ")}
              aria-pressed={active}
            >
              <span>{f.label}</span>
              <span
                className={[
                  "tabular-nums text-[11px]",
                  active ? "text-stone-300" : "text-stone-500",
                ].join(" ")}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* リスト */}
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white py-16 text-center text-sm text-stone-500">
          表示できる問い合わせがありません。
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
          {/* PC: テーブル */}
          <table className="hidden w-full text-sm md:table" aria-label="問い合わせ一覧">
            <thead className="border-b border-stone-200 bg-stone-50/80 text-[11px] uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">差出人</th>
                <th className="px-4 py-2.5 text-left font-medium">件名</th>
                <th className="px-4 py-2.5 text-left font-medium">カテゴリ</th>
                <th className="px-4 py-2.5 text-left font-medium">信頼度</th>
                <th className="px-4 py-2.5 text-left font-medium">受信</th>
                <th className="px-4 py-2.5 text-left font-medium">ステータス</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((it) => {
                const sb = statusBadge(it.status);
                return (
                  <tr
                    key={it.id}
                    className="transition-colors hover:bg-stone-50 focus-within:bg-stone-50"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-stone-900">{it.fromName}</div>
                      <div className="text-[11px] text-stone-500">{it.fromEmail}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/inquiries/${it.id}`}
                        className="block text-stone-900 underline-offset-2 hover:text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded-sm"
                      >
                        <span className="line-clamp-1">{it.subject}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {it.category ? (
                        <Badge className={categoryClass(it.category.name)}>
                          {it.category.name}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {it.latestDraft ? (
                        <Badge className={confidenceClass(it.latestDraft.confidence)}>
                          {confidenceLabel(it.latestDraft.confidence)}{" "}
                          <span className="opacity-70 tabular-nums">
                            {(it.latestDraft.confidence * 100).toFixed(0)}%
                          </span>
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-[12px] text-stone-600">
                      {formatRelative(it.receivedAt)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge className={sb.className} dot>
                        {sb.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* モバイル: カード */}
          <ul className="divide-y divide-stone-100 md:hidden" aria-label="問い合わせ一覧">
            {items.map((it) => {
              const sb = statusBadge(it.status);
              return (
                <li key={it.id}>
                  <Link
                    href={`/inquiries/${it.id}`}
                    className="block px-4 py-3 transition-colors hover:bg-stone-50 focus-visible:bg-stone-50 focus-visible:outline-none"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-1 text-sm font-medium text-stone-900">
                          {it.subject}
                        </div>
                        <div className="mt-0.5 text-[11px] text-stone-600">
                          {it.fromName} · {formatRelative(it.receivedAt)}
                        </div>
                      </div>
                      <Badge className={sb.className} dot>
                        {sb.label}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {it.category && (
                        <Badge className={categoryClass(it.category.name)}>
                          {it.category.name}
                        </Badge>
                      )}
                      {it.latestDraft && (
                        <Badge className={confidenceClass(it.latestDraft.confidence)}>
                          信頼度 {confidenceLabel(it.latestDraft.confidence)}
                        </Badge>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

const SummaryCard = ({
  label,
  value,
  tone = "default",
  href,
}: {
  label: string;
  value: number;
  tone?: "default" | "primary" | "warn" | "muted";
  href?: string;
}) => {
  const toneClass =
    tone === "primary"
      ? "text-emerald-700"
      : tone === "warn"
      ? "text-amber-700"
      : tone === "muted"
      ? "text-stone-500"
      : "text-stone-900";

  const inner = (
    <>
      <div className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
        {label}
      </div>
      <div className={`mt-1 text-[28px] font-semibold tabular-nums leading-none ${toneClass}`}>
        {value}
      </div>
      <div className="mt-1 text-[11px] text-stone-400">件</div>
    </>
  );

  const baseClass =
    "block rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition-colors";

  return href ? (
    <Link
      href={href}
      className={`${baseClass} hover:border-stone-300 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2`}
    >
      {inner}
    </Link>
  ) : (
    <div className={baseClass}>{inner}</div>
  );
};
