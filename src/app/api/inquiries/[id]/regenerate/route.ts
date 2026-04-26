import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDraft } from "@/lib/llm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const inquiry = await prisma.inquiry.findUnique({ where: { id } });
  if (!inquiry) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  if (inquiry.status === "sent") {
    return Response.json({ error: "already sent" }, { status: 400 });
  }

  await prisma.draftReply.updateMany({
    where: { inquiryId: id, isLatest: true },
    data: { isLatest: false },
  });

  const articles = await prisma.knowledgeArticle.findMany();
  const generated = await generateDraft(inquiry, articles);

  const draft = await prisma.draftReply.create({
    data: {
      inquiryId: id,
      body: generated.body,
      confidence: generated.confidence,
      citedIds: JSON.stringify(generated.citedIds),
      model: generated.model,
      isLatest: true,
    },
  });

  await prisma.inquiry.update({ where: { id }, data: { status: "drafted" } });
  await prisma.auditLog.create({
    data: {
      inquiryId: id,
      action: "draft_generated",
      detail: JSON.stringify({ model: generated.model, confidence: generated.confidence, regenerated: true }),
    },
  });

  return Response.json(draft);
}
