import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import type { OAuth2Client, Credentials } from "google-auth-library";
import { prisma } from "@/lib/prisma";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

const REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT_URI ??
  "http://localhost:3000/api/auth/gmail/callback";

export const isGmailConfigured = () =>
  Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);

export const buildOAuthClient = (): OAuth2Client => {
  if (!isGmailConfigured()) {
    throw new Error("Gmail OAuth credentials are not configured (set GOOGLE_OAUTH_CLIENT_ID/SECRET).");
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    REDIRECT_URI,
  );
};

export const getAuthUrl = (state: string): string => {
  const client = buildOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state,
  });
};

export const exchangeCodeForTokens = async (code: string): Promise<Credentials> => {
  const client = buildOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
};

const getProfileEmail = async (client: OAuth2Client): Promise<string> => {
  const gmail = google.gmail({ version: "v1", auth: client });
  const profile = await gmail.users.getProfile({ userId: "me" });
  return profile.data.emailAddress ?? "unknown";
};

export const saveCredentials = async (tokens: Credentials): Promise<{ email: string }> => {
  const client = buildOAuthClient();
  client.setCredentials(tokens);
  const email = await getProfileEmail(client);

  await prisma.oAuthCredential.upsert({
    where: { email },
    update: {
      provider: "gmail",
      accessToken: tokens.access_token ?? "",
      refreshToken: tokens.refresh_token ?? undefined,
      scope: tokens.scope ?? undefined,
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
    create: {
      provider: "gmail",
      email,
      accessToken: tokens.access_token ?? "",
      refreshToken: tokens.refresh_token ?? undefined,
      scope: tokens.scope ?? undefined,
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
  });

  return { email };
};

export const getConnectedAccount = async (): Promise<{ email: string; expiryDate: Date | null } | null> => {
  const cred = await prisma.oAuthCredential.findFirst({
    where: { provider: "gmail" },
    orderBy: { updatedAt: "desc" },
  });
  if (!cred) return null;
  return { email: cred.email, expiryDate: cred.expiryDate };
};

export const getActiveClient = async (): Promise<{ client: OAuth2Client; email: string } | null> => {
  const cred = await prisma.oAuthCredential.findFirst({
    where: { provider: "gmail" },
    orderBy: { updatedAt: "desc" },
  });
  if (!cred) return null;

  const client = buildOAuthClient();
  client.setCredentials({
    access_token: cred.accessToken,
    refresh_token: cred.refreshToken ?? undefined,
    scope: cred.scope ?? undefined,
    expiry_date: cred.expiryDate ? cred.expiryDate.getTime() : undefined,
  });

  // 期限切れ近傍なら自動リフレッシュ（google-auth-library が refresh_token があれば自動で行う）
  client.on("tokens", async (newTokens: Credentials) => {
    await prisma.oAuthCredential.update({
      where: { email: cred.email },
      data: {
        accessToken: newTokens.access_token ?? cred.accessToken,
        refreshToken: newTokens.refresh_token ?? cred.refreshToken,
        scope: newTokens.scope ?? cred.scope,
        expiryDate: newTokens.expiry_date ? new Date(newTokens.expiry_date) : cred.expiryDate,
      },
    });
  });

  return { client, email: cred.email };
};

export type ParsedGmailMessage = {
  messageId: string;          // Gmail API の内部 ID
  messageIdHeader: string;    // RFC822 Message-ID ヘッダー値（In-Reply-To に使う）
  threadId: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  receivedAt: Date;
};

const decodeBase64Url = (data: string): string => {
  const buf = Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  return buf.toString("utf-8");
};

const extractBody = (payload: gmail_v1.Schema$MessagePart | undefined): string => {
  if (!payload) return "";
  // text/plain を優先、 なければ text/html を テキスト化（雑）
  const findPart = (
    p: gmail_v1.Schema$MessagePart,
    mime: string,
  ): gmail_v1.Schema$MessagePart | null => {
    if (p.mimeType === mime && p.body?.data) return p;
    for (const child of p.parts ?? []) {
      const found = findPart(child, mime);
      if (found) return found;
    }
    return null;
  };
  const text = findPart(payload, "text/plain");
  if (text?.body?.data) return decodeBase64Url(text.body.data);
  const html = findPart(payload, "text/html");
  if (html?.body?.data) {
    const raw = decodeBase64Url(html.body.data);
    return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
};

const parseFrom = (raw: string): { name: string; email: string } => {
  // "山田 太郎 <yamada@example.com>" or "yamada@example.com"
  const m = raw.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim() || m[2], email: m[2].trim() };
  return { name: raw.trim(), email: raw.trim() };
};

export const parseGmailMessage = (msg: gmail_v1.Schema$Message): ParsedGmailMessage => {
  const headers = msg.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
  const fromHeader = get("From");
  const { name, email } = parseFrom(fromHeader);
  const dateHeader = get("Date");
  const receivedAt = dateHeader ? new Date(dateHeader) : new Date(Number(msg.internalDate ?? 0));
  return {
    messageId: msg.id ?? "",
    messageIdHeader: get("Message-ID") || get("Message-Id"),
    threadId: msg.threadId ?? "",
    fromName: name,
    fromEmail: email,
    subject: get("Subject") || "(件名なし)",
    body: extractBody(msg.payload ?? undefined),
    receivedAt,
  };
};

export const fetchInboxMessages = async (
  client: OAuth2Client,
  limit = 10,
): Promise<ParsedGmailMessage[]> => {
  const gmail = google.gmail({ version: "v1", auth: client });
  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: limit,
    q: "in:inbox -category:promotions -category:social",
  });
  const ids = (list.data.messages ?? []).map((m) => m.id).filter(Boolean) as string[];
  const results: ParsedGmailMessage[] = [];
  for (const id of ids) {
    const msg = await gmail.users.messages.get({ userId: "me", id, format: "full" });
    results.push(parseGmailMessage(msg.data));
  }
  return results;
};

// Gmail に「下書き」 として返信を作成する（担当者は Gmail 上の下書きを開いて編集→送信するだけ）
export const createDraftReply = async (
  client: OAuth2Client,
  params: {
    to: string;
    subject: string;
    body: string;
    threadId: string;
    inReplyTo?: string; // 元メールの Message-ID ヘッダー
  },
): Promise<{ draftId: string }> => {
  const gmail = google.gmail({ version: "v1", auth: client });
  const subjectEncoded = `=?UTF-8?B?${Buffer.from(params.subject, "utf-8").toString("base64")}?=`;
  const headers = [
    `To: ${params.to}`,
    `Subject: ${subjectEncoded}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    `MIME-Version: 1.0`,
  ];
  if (params.inReplyTo) {
    headers.push(`In-Reply-To: ${params.inReplyTo}`);
    headers.push(`References: ${params.inReplyTo}`);
  }
  const raw = Buffer.from(`${headers.join("\r\n")}\r\n\r\n${params.body}`, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw, threadId: params.threadId } },
  });
  return { draftId: res.data.id ?? "" };
};

export const sendMail = async (
  client: OAuth2Client,
  to: string,
  subject: string,
  body: string,
  threadId?: string | null,
): Promise<{ messageId: string }> => {
  const gmail = google.gmail({ version: "v1", auth: client });
  const subjectEncoded = `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
  const headers = [
    `To: ${to}`,
    `Subject: ${subjectEncoded}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    "MIME-Version: 1.0",
  ].join("\r\n");
  const raw = Buffer.from(`${headers}\r\n\r\n${body}`, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, threadId: threadId ?? undefined },
  });
  return { messageId: res.data.id ?? "" };
};
