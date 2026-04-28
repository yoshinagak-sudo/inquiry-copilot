"use client";

import { useEffect, useState } from "react";
import { useGmailStatus } from "@/hooks/useGmailStatus";

type SyncResponse = {
  fetched: number;
  imported: number;
  skipped: number;
  errors?: string[];
};

type Toast =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

/**
 * 受信箱の見出し横に置く「Gmail から同期」ボタン。
 * 接続済みの時だけ表示。同期完了後に右上トーストを 3 秒出してからページを reload する。
 */
export const GmailSyncButton = () => {
  const { loading, connected } = useGmailStatus();
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      setToast(null);
      // 成功時だけ画面側のサーバ再取得をトリガー
      if (toast.kind === "success") {
        window.location.reload();
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const onClick = async () => {
    if (running) return;
    setRunning(true);
    try {
      const res = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as SyncResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `status ${res.status}`);
      setToast({
        kind: "success",
        message: `${json.imported} 件取り込み / ${json.skipped} 件スキップ`,
      });
    } catch (err) {
      setToast({
        kind: "error",
        message: `同期に失敗しました: ${(err as Error).message}`,
      });
    } finally {
      setRunning(false);
    }
  };

  // 未接続 / 未設定 / 初回 fetch 中は出さない
  if (loading || !connected) return null;

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={running}
        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-700 bg-white px-3 py-1.5 text-[13px] font-medium text-emerald-800 shadow-sm transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        {running ? (
          <Spinner />
        ) : (
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <path d="M21 4v5h-5" />
          </svg>
        )}
        <span>{running ? "同期中…" : "Gmail から同期"}</span>
      </button>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-50 max-w-sm"
        >
          <div
            className={[
              "flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm shadow-lg",
              toast.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900",
            ].join(" ")}
          >
            <span aria-hidden className="mt-0.5">
              {toast.kind === "success" ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              )}
            </span>
            <span className="leading-snug">{toast.message}</span>
          </div>
        </div>
      )}
    </>
  );
};

const Spinner = () => (
  <svg
    aria-hidden
    viewBox="0 0 24 24"
    className="h-3.5 w-3.5 animate-spin"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <path d="M21 12a9 9 0 1 1-6.2-8.55" opacity="0.9" />
    <path d="M3 12a9 9 0 0 1 9-9" opacity="0.25" />
  </svg>
);
