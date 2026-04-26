import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const approveSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  categoryId: z.string().nullish(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let edits: z.infer<typeof approveSchema> = {};
  try {
    const json = await req.json();
    const parsed = approveSchema.safeParse(json);
    if (parsed.success) edits = parsed.data;
  } catch {
    // ignore - body optional
  }

  const candidate = await prisma.knowledgeCandidate.findUnique({ where: { id } });
  if (!candidate) return Response.json({ error: "not found" }, { status: 404 });
  if (candidate.status !== "pending") {
    return Response.json({ error: "already reviewed" }, { status: 400 });
  }

  const article = await prisma.knowledgeArticle.create({
    data: {
      title: edits.title ?? candidate.title,
      body: edits.body ?? candidate.body,
      categoryId: edits.categoryId ?? null,
      source: "candidate",
    },
  });

  await prisma.knowledgeCandidate.update({
    where: { id },
    data: { status: "approved", reviewedAt: new Date(), reviewedBy: "demo-user" },
  });

  await prisma.auditLog.create({
    data: {
      action: "candidate_approved",
      detail: JSON.stringify({ candidateId: id, articleId: article.id }),
    },
  });

  return Response.json({ article });
}
