import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDraft } from "@/lib/llm";
import type { CitedArticle, InquiryDetail } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const inquiry = await prisma.inquiry.findUnique({
    where: { id },
    include: {
      category: true,
      drafts: { where: { isLatest: true }, take: 1, orderBy: { generatedAt: "desc" } },
      sent: true,
    },
  });

  if (!inquiry) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  let draft = inquiry.drafts[0] ?? null;

  if (!draft && !inquiry.sent) {
    const articles = await prisma.knowledgeArticle.findMany();
    const generated = await generateDraft(inquiry, articles);
    draft = await prisma.draftReply.create({
      data: {
        inquiryId: inquiry.id,
        body: generated.body,
        confidence: generated.confidence,
        citedIds: JSON.stringify(generated.citedIds),
        model: generated.model,
        isLatest: true,
      },
    });
    await prisma.inquiry.update({
      where: { id: inquiry.id },
      data: { status: "drafted" },
    });
    await prisma.auditLog.create({
      data: {
        inquiryId: inquiry.id,
        action: "draft_generated",
        detail: JSON.stringify({ model: generated.model, confidence: generated.confidence }),
      },
    });
  }

  let citedArticles: CitedArticle[] = [];
  if (draft) {
    const ids = safeParseIds(draft.citedIds);
    if (ids.length) {
      const articles = await prisma.knowledgeArticle.findMany({ where: { id: { in: ids } } });
      citedArticles = articles.map((a) => ({
        id: a.id,
        title: a.title,
        excerpt: a.body.slice(0, 200) + (a.body.length > 200 ? "…" : ""),
      }));
    }
  }

  const result: InquiryDetail = {
    ...inquiry,
    latestDraft: draft ? { ...draft, citedArticles } : null,
    sent: inquiry.sent,
  };
  return Response.json(result);
}

const safeParseIds = (raw: string): string[] => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};
