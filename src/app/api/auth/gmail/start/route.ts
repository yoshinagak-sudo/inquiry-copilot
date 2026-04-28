import { NextRequest } from "next/server";
import { isGmailConfigured, getAuthUrl } from "@/lib/gmail";

export async function GET(_req: NextRequest) {
  if (!isGmailConfigured()) {
    return Response.json(
      { error: "GOOGLE_OAUTH_CLIENT_ID / SECRET が未設定です。.env.local に設定してください。" },
      { status: 500 },
    );
  }
  // CSRF 簡易対策: 短いランダム state（本番は session 紐付け推奨）
  const state = Math.random().toString(36).slice(2, 18);
  const url = getAuthUrl(state);
  return Response.redirect(url, 302);
}
