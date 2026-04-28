"use client";

import { useEffect, useState } from "react";

export type GmailStatus = {
  /** マウント直後の初回 fetch 中は true */
  loading: boolean;
  /** OAuth クライアント情報がサーバ側に設定済みか */
  configured: boolean;
  /** トークンが保存され、Gmail と接続できているか */
  connected: boolean;
  /** 接続中のアカウントのメールアドレス */
  email: string | null;
  /** 手動で再取得する */
  refresh: () => void;
};

type ApiResponse = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  expiryDate?: number | null;
};

/**
 * `/api/auth/gmail/status` をマウント時に1回だけ取得する小さな hook。
 * 接続状態はリアルタイム性が要らない（OAuth 復帰時はページ全体がリロードされる）ので
 * SWR/poll 等は意図的に入れていない。
 */
export const useGmailStatus = (): GmailStatus => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/auth/gmail/status", { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as ApiResponse;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData({ configured: false, connected: false, email: null });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return {
    loading,
    configured: data?.configured ?? false,
    connected: data?.connected ?? false,
    email: data?.email ?? null,
    refresh: () => setTick((n) => n + 1),
  };
};
