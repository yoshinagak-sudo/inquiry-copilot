"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/Badge";
import type { CandidateDetail, CandidateStatus, Category } from "@/types";

type Props = {
  initialItems: CandidateDetail[];
  status: CandidateStatus;
  categories: Category[];
};

export const CandidateReviewList = ({
  initialItems,
  status,
  categories,
}: Props) => {
  const [items, setItems] = useState<CandidateDetail[]>(initialItems);
  const [toast, setToast] = useState<string | null>(null);

  // タブ切替時は親の page.tsx で `key={status}` を付けてリマウントさせるため、
  // ここでは初期 props 同期の useEffect を持たない（react-hooks/set-state-in-effect 回避）

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((c) => c.id !== id));
  };

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-stone-300 bg-white py-16 text-center text-sm text-stone-500">
        {status === "pending"
          ? "未レビューの候補はありません。送信文面から候補が自動生成されると、ここに表示されます。"
          : status === "approved"
          ? "承認済みの候補はありません。"
          : "却下された候補はありません。"}
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-4">
        {items.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            categories={categories}
            readOnly={status !== "pending"}
            onApproved={() => {
              removeItem(c.id);
              setToast("ナレッジとして昇格しました");
            }}
            onRejected={() => {
              removeItem(c.id);
              setToast("候補を却下しました");
            }}
          />
        ))}
      </ul>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
        >
          <div className="rounded-full border border-emerald-200 bg-white px-4 py-2.5 text-[13px] text-stone-800 shadow-lg">
            <span aria-hidden className="mr-2 text-emerald-600">●</span>
            {toast}
          </div>
        </div>
      )}
    </>
  );
};

// ──────────────── カード ────────────────

const CandidateCard = ({
  candidate,
  categories,
  readOnly,
  onApproved,
  onRejected,
}: {
  candidate: CandidateDetail;
  categories: Category[];
  readOnly: boolean;
  onApproved: () => void;
  onRejected: () => void;
}) => {
  const [title, setTitle] = useState(candidate.title);
  const [body, setBody] = useState(candidate.body);
  const [categoryId, setCategoryId] = useState<string>("");
  const [working, setWorking] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    if (!title.trim() || !body.trim()) {
      setError("タイトルと本文は必須です");
      return;
    }
    setWorking("approve");
    setError(null);
    try {
      const res = await fetch(
        `/api/knowledge/candidates/${candidate.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            body,
            categoryId: categoryId || null,
          }),
        },
      );
      if (!res.ok) throw new Error(`承認に失敗しました (${res.status})`);
      onApproved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "承認に失敗しました");
    } finally {
      setWorking(null);
    }
  };

  const handleReject = async () => {
    const ok = window.confirm("この候補を却下します。よろしいですか？");
    if (!ok) return;
    setWorking("reject");
    setError(null);
    try {
      const res = await fetch(
        `/api/knowledge/candidates/${candidate.id}/reject`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(`却下に失敗しました (${res.status})`);
      onRejected();
    } catch (e) {
      setError(e instanceof Error ? e.message : "却下に失敗しました");
    } finally {
      setWorking(null);
    }
  };

  const statusBadge =
    candidate.status === "pending"
      ? { label: "未レビュー", className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" }
      : candidate.status === "approved"
      ? { label: "承認済み", className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" }
      : { label: "却下", className: "bg-stone-100 text-stone-600 ring-1 ring-stone-200" };

  return (
    <li className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={statusBadge.className} dot>
              {statusBadge.label}
            </Badge>
            <span className="text-[11px] text-stone-500">
              生成: {formatDateTime(candidate.createdAt)}
            </span>
          </div>
          {readOnly && (
            <p className="mt-2 text-[14px] font-medium text-stone-900">
              {candidate.title}
            </p>
          )}
        </div>
      </header>

      {/* 生成理由 */}
      <div className="border-b border-stone-100 bg-amber-50/40 px-4 py-2.5">
        <div className="flex items-start gap-2">
          <span aria-hidden className="mt-0.5 text-amber-600">⚙</span>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
              生成理由
            </div>
            <p className="mt-0.5 text-[12px] leading-6 text-stone-700">
              {candidate.reason}
            </p>
          </div>
        </div>
      </div>

      {/* ソース問い合わせ折りたたみ */}
      {candidate.sourceInquiry && (
        <details className="border-b border-stone-100 px-4 py-3 group">
          <summary className="flex items-center gap-2 text-[12px] text-stone-600 transition-colors hover:text-stone-900">
            <span
              aria-hidden
              className="inline-block transition-transform group-open:rotate-90"
            >
              ▸
            </span>
            ソース問い合わせを表示
            <span className="text-stone-400">
              · {candidate.sourceInquiry.subject}
            </span>
          </summary>
          <div className="mt-3 rounded-md border border-stone-200 bg-stone-50/60 p-3">
            <div className="text-[11px] text-stone-500">
              {candidate.sourceInquiry.fromName} ·{" "}
              <span className="font-mono">
                {candidate.sourceInquiry.fromEmail}
              </span>
            </div>
            <div className="mt-1 text-[13px] font-medium text-stone-900">
              {candidate.sourceInquiry.subject}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-[12px] leading-6 text-stone-700">
              {candidate.sourceInquiry.body}
            </p>
          </div>
        </details>
      )}

      {/* 編集可能なフォーム or 読み取り表示 */}
      {readOnly ? (
        <div className="px-4 py-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
            本文
          </div>
          <p className="mt-1 whitespace-pre-wrap rounded-md border border-stone-200 bg-stone-50/40 px-3 py-3 font-mono text-[12px] leading-7 text-stone-700">
            {candidate.body}
          </p>
        </div>
      ) : (
        <div className="space-y-4 px-4 py-4">
          <div>
            <label
              htmlFor={`cand-title-${candidate.id}`}
              className="block text-[11px] font-medium uppercase tracking-wide text-stone-500"
            >
              タイトル
            </label>
            <input
              id={`cand-title-${candidate.id}`}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 shadow-sm focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
            />
          </div>

          <div>
            <label
              htmlFor={`cand-cat-${candidate.id}`}
              className="block text-[11px] font-medium uppercase tracking-wide text-stone-500"
            >
              カテゴリ
            </label>
            <select
              id={`cand-cat-${candidate.id}`}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 block h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 shadow-sm focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
            >
              <option value="">未設定</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={`cand-body-${candidate.id}`}
              className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-stone-500"
            >
              <span>本文（Markdown / 編集可）</span>
              <span className="tabular-nums normal-case font-normal">
                {body.length} 文字
              </span>
            </label>
            <textarea
              id={`cand-body-${candidate.id}`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="mt-1 block w-full resize-y rounded-md border border-stone-300 bg-white px-3 py-2.5 font-mono text-[13px] leading-7 text-stone-900 shadow-inner focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700"
            >
              {error}
            </div>
          )}
        </div>
      )}

      {/* フッター操作 */}
      {!readOnly && (
        <footer className="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50/40 px-4 py-3">
          <button
            type="button"
            onClick={handleReject}
            disabled={working !== null}
            className="inline-flex h-9 items-center rounded-md border border-stone-300 bg-white px-3 text-[13px] font-medium text-stone-700 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {working === "reject" ? "却下中…" : "却下"}
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={working !== null}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-700 px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            <span aria-hidden>✓</span>
            {working === "approve" ? "承認中…" : "承認してナレッジ化"}
          </button>
        </footer>
      )}
    </li>
  );
};
