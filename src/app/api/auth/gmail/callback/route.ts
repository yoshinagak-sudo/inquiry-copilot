import { NextRequest } from "next/server";
import { exchangeCodeForTokens, isGmailConfigured, saveCredentials } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  if (!isGmailConfigured()) {
    return Response.json({ error: "Gmail OAuth not configured" }, { status: 500 });
  }
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  if (error) {
    return new Response(`OAuth error: ${error}`, { status: 400 });
  }
  if (!code) {
    return new Response("missing code", { status: 400 });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const { email } = await saveCredentials(tokens);
    const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>Gmail 連携完了</title>
<style>body{font-family:system-ui;background:#fafaf9;color:#1c1917;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}main{background:white;border:1px solid #e7e5e4;border-radius:12px;padding:32px 40px;max-width:480px;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,0.04)}h1{font-size:20px;margin:0 0 8px}p{color:#57534e;font-size:14px;line-height:1.7}a{display:inline-block;margin-top:16px;padding:8px 16px;background:#047857;color:white;text-decoration:none;border-radius:6px;font-size:14px}</style>
</head><body><main>
<h1>✅ Gmail と連携しました</h1>
<p>連携アカウント: <strong>${email}</strong></p>
<p>受信箱に戻り、「Gmail から同期」ボタンで実メールを取り込めます。</p>
<a href="/">受信箱に戻る</a>
</main></body></html>`;
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    console.error("[gmail callback]", err);
    return new Response(`callback failed: ${(err as Error).message}`, { status: 500 });
  }
}
