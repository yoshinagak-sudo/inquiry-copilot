/**
 * Server Component から API ルートを叩くための fetch ヘルパ。
 * dev / prod で URL を解決する。
 */
import { headers } from "next/headers";

export const getBaseUrl = async (): Promise<string> => {
  // 環境変数優先
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
};

export const apiFetch = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`, {
    cache: "no-store",
    ...init,
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
};
