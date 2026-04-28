import { NextRequest } from "next/server";
import { z } from "zod";
import { diffChars } from "diff";
import { prisma } from "@/lib/prisma";
import { generateKnowledgeCandidate } from "@/lib/llm";
import { getActiveClient, sendMail } from "@/lib/gmail";

const sendSchema = z.object({ finalBody: z.string().min(1) });

const computeDiffRatio = (a: string, b: string): number => {
  const parts = diffChars(a, b);
  const changed = parts
    .filter((p) => p.added || p.removed)
    .reduce((acc, p) => acc + p.value.length, 0);
  const total = a.length + b.length;
  return total === 0 ? 0 : Math.min(1, changed / total);
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const json = await req.json();
  const parsed = sendSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const { finalBody } = parsed.data;

  const inquiry = await prisma.inquiry.findUnique({
    where: { id },
    include: { drafts: { where: { isLatest: true }, take: 1 }, sent: true },
  });
  if (!inquiry) return Response.json({ error: "not found" }, { status: 404 });
  if (inquiry.sent) return Response.json({ error: "already sent" }, { status: 400 });

  const draft = inquiry.drafts[0];
  const draftBody = draft?.body ?? "";
  const diffRatio = computeDiffRatio(draftBody, finalBody);

  // Gmail 連携が有効かつスレッドIDがある場合は実送信、そうでなければモック
  let gmailSent = false;
  const gmailCtx = inquiry.gmailMessageId ? await getActiveClient() : null;
  if (gmailCtx) {
    try {
      const replySubject = inquiry.subject.startsWith("Re:")
        ? inquiry.subject
        : `Re: ${inquiry.subject}`;
      await sendMail(
        gmailCtx.client,
        inquiry.fromEmail,
        replySubject,
        finalBody,
        inquiry.gmailThreadId,
      );
      gmailSent = true;
    } catch (err) {
      console.error("[gmail send]", err);
      return Response.json(
        { error: "Gmail 送信に失敗しました: " + (err as Error).message },
        { status: 500 },
      );
    }
  }

  const sent = await prisma.sentReply.create({
    data: { inquiryId: id, finalBody, draftBody, diffRatio },
  });

  await prisma.inquiry.update({ where: { id }, data: { status: "sent" } });

  // 引用ナレッジの利用統計を更新
  if (draft) {
    let citedIds: string[] = [];
    try {
      const parsed = JSON.parse(draft.citedIds);
      if (Array.isArray(parsed)) citedIds = parsed.filter((x) => typeof x === "string");
    } catch {
      // ignore
    }
    if (citedIds.length) {
      await prisma.knowledgeArticle.updateMany({
        where: { id: { in: citedIds } },
        data: { refCount: { increment: 1 }, lastUsedAt: new Date() },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      inquiryId: id,
      action: "sent",
      detail: JSON.stringify({
        diffRatio: Number(diffRatio.toFixed(3)),
        to: inquiry.fromEmail,
        gmailSent,
      }),
    },
  });

  // ナレッジ自動更新ロジック: 編集量が大きければ候補生成
  let candidate = null;
  if (diffRatio >= 0.25 || finalBody.length > draftBody.length + 200) {
    const candidatePayload = await generateKnowledgeCandidate({ inquiry, draftBody, finalBody });
    if (candidatePayload) {
      candidate = await prisma.knowledgeCandidate.create({
        data: {
          title: candidatePayload.title,
          body: candidatePayload.body,
          reason: candidatePayload.reason,
          sourceInquiryId: id,
        },
      });
      await prisma.auditLog.create({
        data: {
          inquiryId: id,
          action: "candidate_created",
          detail: JSON.stringify({ candidateId: candidate.id, reason: candidatePayload.reason }),
        },
      });
    }
  }

  return Response.json({ sent, candidate, diffRatio, gmailSent });
}
