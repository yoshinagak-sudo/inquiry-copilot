"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  confidenceClass,
  confidenceLabel,
  formatDateTime,
  parseProductRefs,
} from "@/lib/format";
import { Badge } from "@/components/Badge";
import type { CitedArticle, InquiryDetail } from "@/types";

const COUNTDOWN_SECONDS = 30;

type Props = {
  inquiry: InquiryDetail;
};

export const DraftEditor = ({ inquiry }: Props) => {
  // 送信済みなら read-only で表示
  if (inquiry.sent) {
    return <SentView inquiry={inquiry} />;
  }

  return <DraftWorkbench inquiry={inquiry} />;
};

// ──────────────── 草案編集ワークベンチ ────────────────

const DraftWorkbench = ({ inquiry }: Props) => {
  const initialBody = inquiry.latestDraft?.body ?? "";
  const [body, setBody] = useState(initialBody);
  const [draftMeta, setDraftMeta] = useState({
    confidence: inquiry.latestDraft?.confidence ?? 0,
    model: inquiry.latestDraft?.model ?? "—",
    citedArticles: inquiry.latestDraft?.citedArticles ?? [],
  });
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 送信フロー
  const [sendState, setSendState] = useState<"idle" | "counting" | "sending" | "done">(
    "idle",
  );
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);
  const [toast, setToast] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const stopCountdown = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startCountdown = () => {
    setSendState("counting");
    setRemaining(COUNTDOWN_SECONDS);
    stopCountdown();
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          stopCountdown();
          // 自動送信
          executeSend();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelCountdown = () => {
    stopCountdown();
    setSendState("idle");
    setRemaining(COUNTDOWN_SECONDS);
  };

  const executeSend = async () => {
    setSendState("sending");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/inquiries/${inquiry.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalBody: body }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `送信に失敗しました (${res.status})`);
      }
      const data = (await res.json()) as {
        candidate: { id: string } | null;
        diffRatio: number;
      };
      setSendState("done");
      if (data.candidate) {
        setToast("ナレッジ候補を1件生成しました（候補レビューへ）");
      } else {
        setToast("送信しました");
      }
      // 軽くディレイを入れてリロード（送信済みビューに切り替わる）
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "送信に失敗しました");
      setSendState("idle");
    }
  };

  const handleRegenerate = async () => {
    if (body !== initialBody) {
      const ok = window.confirm(
        "編集中の内容は破棄されます。再生成してよろしいですか？",
      );
      if (!ok) return;
    }
    setIsRegenerating(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/inquiries/${inquiry.id}/regenerate`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error(`再生成に失敗しました (${res.status})`);
      }
      // 詳細を取り直して引用ナレッジも更新
      const detailRes = await fetch(`/api/inquiries/${inquiry.id}`);
      if (detailRes.ok) {
        const detail = (await detailRes.json()) as InquiryDetail;
        if (detail.latestDraft) {
          setBody(detail.latestDraft.body);
          setDraftMeta({
            confidence: detail.latestDraft.confidence,
            model: detail.latestDraft.model,
            citedArticles: detail.latestDraft.citedArticles ?? [],
          });
        }
      }
      setToast("草案を再生成しました");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "再生成に失敗しました");
    } finally {
      setIsRegenerating(false);
    }
  };

  // トーストを 4 秒で消す
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const isCounting = sendState === "counting";
  const isSending = sendState === "sending";
  const isLocked = isCounting || isSending || sendState === "done";

  const productRefs = parseProductRefs(inquiry.productRefs);

  return (
    <section
      aria-labelledby="draft-title"
      className="rounded-lg border border-stone-200 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 id="draft-title" className="text-[13px] font-medium text-stone-700">
            返信草案
          </h2>
          {draftMeta.confidence > 0 && (
            <Badge className={confidenceClass(draftMeta.confidence)}>
              信頼度 {confidenceLabel(draftMeta.confidence)}{" "}
              <span className="opacity-70 tabular-nums">
                {(draftMeta.confidence * 100).toFixed(0)}%
              </span>
            </Badge>
          )}
          <span className="text-[11px] text-stone-500">
            <span className="font-mono">{draftMeta.model}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {inquiry.gmailThreadId && (
            <a
              href={`https://mail.google.com/mail/u/0/#inbox/${inquiry.gmailThreadId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 text-[12px] font-medium text-emerald-800 transition-colors hover:border-emerald-400 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              title="Gmail 上の下書きを別タブで開きます"
            >
              <span aria-hidden>📝</span>
              Gmail で開いて編集
              <span aria-hidden className="text-emerald-600/70">↗</span>
            </a>
          )}
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isRegenerating || isLocked}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 text-[12px] font-medium text-stone-700 transition-colors hover:border-stone-400 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden>↻</span>
            {isRegenerating ? "再生成中…" : "再生成"}
          </button>
        </div>
      </div>

      {/* Gmail 連携の補足説明 */}
      {inquiry.gmailThreadId && (
        <div className="border-b border-stone-100 bg-emerald-50/30 px-4 py-1.5">
          <p className="text-[11px] leading-5 text-emerald-900/80">
            Gmail 上の下書きを開きます。編集して Gmail から送信できます。
          </p>
        </div>
      )}

      {/* 過去納品事例ヒット注記（productRefs がある場合のみ） */}
      {productRefs.length > 0 && (
        <div className="border-b border-stone-100 bg-emerald-50/50 px-4 py-2">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] leading-5 text-emerald-900">
            <span aria-hidden className="text-emerald-700">●</span>
            <span>過去納品事例</span>
            {productRefs.map((ref) => (
              <span
                key={ref}
                className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[10.5px] font-medium leading-4 text-emerald-800 ring-1 ring-inset ring-emerald-200"
              >
                <span aria-hidden>#</span>
                <span className="font-mono">{ref}</span>
              </span>
            ))}
            <span>を優先的に引用しています</span>
          </p>
        </div>
      )}

      {/* 引用ナレッジ */}
      {draftMeta.citedArticles.length > 0 && (
        <details className="border-b border-stone-100 px-4 py-3 group">
          <summary className="flex items-center gap-2 text-[12px] text-stone-600 transition-colors hover:text-stone-900">
            <span
              aria-hidden
              className="inline-block transition-transform group-open:rotate-90"
            >
              ▸
            </span>
            <span>
              引用ナレッジ
              <span className="ml-1 tabular-nums text-stone-400">
                ({draftMeta.citedArticles.length})
              </span>
            </span>
          </summary>
          <ul className="mt-3 space-y-2">
            {draftMeta.citedArticles.map((a: CitedArticle) => (
              <li
                key={a.id}
                className="rounded-md border border-stone-200 bg-stone-50/60 p-3"
              >
                <Link
                  href="/knowledge"
                  className="block font-medium text-stone-900 hover:text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
                >
                  {a.title}
                </Link>
                <p className="mt-1 line-clamp-3 text-[12px] leading-6 text-stone-600">
                  {a.excerpt}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* テキストエリア */}
      <div className="px-4 py-4">
        <label
          htmlFor="draft-body"
          className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-stone-500"
        >
          <span>編集して送信</span>
          <span className="tabular-nums normal-case font-normal">
            {body.length} 文字
          </span>
        </label>
        <textarea
          id="draft-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={isLocked}
          rows={16}
          className="block w-full resize-y rounded-md border border-stone-300 bg-white px-3 py-2.5 font-mono text-[13px] leading-7 text-stone-900 shadow-inner focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:bg-stone-50"
          aria-describedby="draft-help"
        />
        <p id="draft-help" className="mt-1.5 text-[11px] text-stone-500">
          送信ボタンを押すと 30 秒のキャンセル猶予が始まります。
        </p>
      </div>

      {/* エラー */}
      {errorMsg && (
        <div className="mx-4 mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700" role="alert">
          {errorMsg}
        </div>
      )}

      {/* 送信フッター */}
      <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-stone-100 bg-stone-50/40 px-4 py-3">
        {!isCounting && !isSending ? (
          <>
            <span className="text-[11px] text-stone-500">
              宛先: <span className="font-mono">{inquiry.fromEmail}</span>
            </span>
            <button
              type="button"
              onClick={startCountdown}
              disabled={!body.trim() || isLocked}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-700 px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              <span aria-hidden>→</span>
              送信する
            </button>
          </>
        ) : (
          <CountdownBar
            remaining={remaining}
            total={COUNTDOWN_SECONDS}
            onCancel={cancelCountdown}
            isSending={isSending}
          />
        )}
      </footer>

      {/* トースト */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
        >
          <div className="rounded-full border border-emerald-200 bg-white px-4 py-2.5 text-[13px] text-stone-800 shadow-lg">
            <span aria-hidden className="mr-2 text-emerald-600">●</span>
            {toast}
            {toast.includes("候補") && (
              <Link
                href="/knowledge/candidates"
                className="ml-3 font-medium text-emerald-700 underline-offset-2 hover:underline"
              >
                確認する →
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

// ──────────────── カウントダウンバー ────────────────

const CountdownBar = ({
  remaining,
  total,
  onCancel,
  isSending,
}: {
  remaining: number;
  total: number;
  onCancel: () => void;
  isSending: boolean;
}) => {
  const progress = ((total - remaining) / total) * 100;
  return (
    <div
      className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-1 items-center gap-3">
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-emerald-50 text-[13px] font-semibold tabular-nums text-emerald-700">
          {isSending ? "…" : remaining}
        </span>
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-[12px] font-medium text-stone-800">
            {isSending ? "送信中…" : `${remaining} 秒後に送信されます`}
          </span>
          <div className="h-1 w-full overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full bg-emerald-500 transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        disabled={isSending}
        className="inline-flex h-9 items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-[13px] font-medium text-stone-700 transition-colors hover:border-stone-400 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        キャンセル
      </button>
    </div>
  );
};

// ──────────────── 送信済みビュー ────────────────

const SentView = ({ inquiry }: { inquiry: InquiryDetail }) => {
  const sent = inquiry.sent!;
  const diffPct = (sent.diffRatio * 100).toFixed(0);
  return (
    <section
      aria-labelledby="sent-title"
      className="rounded-lg border border-stone-200 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 bg-emerald-50/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 id="sent-title" className="text-[13px] font-medium text-emerald-800">
            送信済み
          </h2>
          <Badge className="bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200" dot>
            {formatDateTime(sent.sentAt)}
          </Badge>
        </div>
        <span className="text-[11px] text-stone-600">
          編集量{" "}
          <span className="font-mono tabular-nums text-stone-800">{diffPct}%</span>
        </span>
      </div>
      <div className="px-4 py-4">
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-stone-500">
          最終文面
        </h3>
        <p className="whitespace-pre-wrap rounded-md border border-stone-200 bg-stone-50/60 px-3 py-3 font-mono text-[13px] leading-7 text-stone-900">
          {sent.finalBody}
        </p>

        {inquiry.latestDraft && (
          <details className="mt-4 group">
            <summary className="flex items-center gap-2 text-[12px] text-stone-500 hover:text-stone-700">
              <span
                aria-hidden
                className="inline-block transition-transform group-open:rotate-90"
              >
                ▸
              </span>
              送信時点の AI 草案を表示
            </summary>
            <p className="mt-2 whitespace-pre-wrap rounded-md border border-dashed border-stone-300 bg-white px-3 py-3 font-mono text-[12px] leading-7 text-stone-700">
              {inquiry.latestDraft.body}
            </p>
          </details>
        )}
      </div>
    </section>
  );
};
