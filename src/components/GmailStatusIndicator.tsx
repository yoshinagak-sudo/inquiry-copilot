"use client";

import { useGmailStatus } from "@/hooks/useGmailStatus";

/**
 * ヘッダー右側、ナビ左隣に置く Gmail 接続ステータス。
 *
 * 状態:
 *  - loading: スケルトン的な薄い枠
 *  - configured=false: 控えめに「Gmail: 未設定」
 *  - connected=false: 「Gmail と接続」ボタン（emerald primary）
 *  - connected=true:  緑ドット + email
 */
export const GmailStatusIndicator = () => {
  const { loading, configured, connected, email } = useGmailStatus();

  if (loading) {
    return (
      <div
        aria-hidden
        className="hidden h-7 w-28 animate-pulse rounded-md bg-stone-100 sm:block"
      />
    );
  }

  if (!configured) {
    return (
      <span
        className="hidden text-[11px] text-stone-400 sm:inline"
        title="Gmail OAuth が未設定です"
      >
        Gmail: 未設定
      </span>
    );
  }

  if (!connected) {
    return (
      <a
        href="/api/auth/gmail/start"
        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
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
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
        <span>Gmail と接続</span>
      </a>
    );
  }

  return (
    <div
      className="hidden items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-[12px] text-stone-700 sm:inline-flex"
      title={`接続中: ${email ?? ""}`}
      aria-label={`Gmail 接続中: ${email ?? ""}`}
    >
      <span
        aria-hidden
        className="relative inline-flex h-2 w-2"
      >
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="max-w-[180px] truncate tabular-nums">{email}</span>
    </div>
  );
};
