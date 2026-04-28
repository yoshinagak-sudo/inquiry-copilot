import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fetchInboxMessages, getActiveClient, isGmailConfigured } from "@/lib/gmail";
import { classifyInquiry, extractMetadata, generateDraft } from "@/lib/llm";

const inputSchema = z.object({
  limit: z.number().int().positive().max(50).optional(),
});

export async function POST(req: NextRequest) {
  if (!isGmailConfigured()) {
    return Response.json({ error: "Gmail OAuth が未設定です" }, { status: 500 });
  }
  const ctx = await getActiveClient();
  if (!ctx) {
    return Response.json({ error: "Gmail と未接続です。/api/auth/gmail/start で接続してください" }, { status: 400 });
  }

  let limit = 10;
  try {
    const json = await req.json();
    const parsed = inputSchema.safeParse(json);
    if (parsed.success && parsed.data.limit) limit = parsed.data.limit;
  } catch {
    // body 省略可
  }

  let imported = 0;
  let skipped = 0;
  const messages = await fetchInboxMessages(ctx.client, limit);

  const categories = await prisma.category.findMany();
  const categoryNames = categories.map((c) => c.name);
  const categoryByName = new Map(categories.map((c) => [c.name, c.id]));
  const articles = await prisma.knowledgeArticle.findMany();

  const errors: string[] = [];
  for (const m of messages) {
    if (!m.messageId) continue;
    const existing = await prisma.inquiry.findUnique({ where: { gmailMessageId: m.messageId } });
    if (existing) {
      skipped++;
      continue;
    }
    try {
      const meta = await extractMetadata({ subject: m.subject, body: m.body });
      const className = await classifyInquiry({ subject: m.subject, body: m.body }, categoryNames);

      const inq = await prisma.inquiry.create({
        data: {
          fromName: m.fromName,
          fromEmail: m.fromEmail,
          subject: m.subject,
          body: m.body,
          receivedAt: m.receivedAt,
          gmailMessageId: m.messageId,
          gmailThreadId: m.threadId,
          categoryId: className ? categoryByName.get(className) ?? null : null,
          budgetText: meta.budgetText,
          quantityText: meta.quantityText,
          summaryNote: meta.summaryNote,
          productRefs: meta.productRefs.length ? JSON.stringify(meta.productRefs) : null,
        },
      });

      const generated = await generateDraft(inq, articles);
      await prisma.draftReply.create({
        data: {
          inquiryId: inq.id,
          body: generated.body,
          confidence: generated.confidence,
          citedIds: JSON.stringify(generated.citedIds),
          model: generated.model,
          isLatest: true,
        },
      });
      await prisma.inquiry.update({ where: { id: inq.id }, data: { status: "drafted" } });
      await prisma.auditLog.create({
        data: {
          inquiryId: inq.id,
          action: "draft_generated",
          detail: JSON.stringify({ source: "gmail-sync", model: generated.model, confidence: generated.confidence }),
        },
      });
      imported++;
    } catch (err) {
      console.error("[gmail-sync] failed for", m.messageId, err);
      errors.push(`${m.subject}: ${(err as Error).message}`);
    }
  }

  return Response.json({
    fetched: messages.length,
    imported,
    skipped,
    errors,
    account: ctx.email,
  });
}
