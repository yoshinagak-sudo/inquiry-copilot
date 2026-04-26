import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { CandidateReviewList } from "./CandidateReviewList";
import type { CandidateDetail, CandidateStatus, Category } from "@/types";

const TABS: { key: CandidateStatus; label: string }[] = [
  { key: "pending", label: "未レビュー" },
  { key: "approved", label: "承認済み" },
  { key: "rejected", label: "却下" },
];

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status: CandidateStatus =
    sp.status === "approved" || sp.status === "rejected"
      ? sp.status
      : "pending";

  // 各タブの件数を出すために 3 ステータス分まとめて取得
  const [pending, approved, rejected, categories] = await Promise.all([
    apiFetch<CandidateDetail[]>("/api/knowledge/candidates?status=pending"),
    apiFetch<CandidateDetail[]>("/api/knowledge/candidates?status=approved"),
    apiFetch<CandidateDetail[]>("/api/knowledge/candidates?status=rejected"),
    apiFetch<Category[]>("/api/categories"),
  ]);

  const counts: Record<CandidateStatus, number> = {
    pending: pending.length,
    approved: approved.length,
    rejected: rejected.length,
  };
  const items = status === "pending" ? pending : status === "approved" ? approved : rejected;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">
            ナレッジ候補レビュー
          </h1>
          <p className="text-sm text-stone-600">
            送信文面から自動生成された候補を確認し、承認するとナレッジに昇格します。
          </p>
        </div>
        <Link
          href="/knowledge"
          className="text-[12px] text-stone-500 underline-offset-2 hover:text-emerald-700 hover:underline"
        >
          ナレッジ管理へ →
        </Link>
      </header>

      {/* タブ */}
      <div
        role="tablist"
        aria-label="候補ステータス"
        className="flex w-full items-center gap-1 rounded-lg border border-stone-200 bg-white p-1 sm:w-fit"
      >
        {TABS.map((t) => {
          const active = t.key === status;
          const href = `/knowledge/candidates?status=${t.key}`;
          return (
            <Link
              key={t.key}
              href={href}
              role="tab"
              aria-selected={active}
              className={[
                "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:flex-none",
                active
                  ? "bg-stone-900 text-white shadow-sm"
                  : "text-stone-600 hover:bg-stone-100",
              ].join(" ")}
            >
              <span>{t.label}</span>
              <span
                className={[
                  "tabular-nums text-[11px]",
                  active ? "text-stone-300" : "text-stone-500",
                ].join(" ")}
              >
                {counts[t.key]}
              </span>
            </Link>
          );
        })}
      </div>

      <CandidateReviewList
        key={status}
        initialItems={items}
        status={status}
        categories={categories}
      />
    </div>
  );
}
