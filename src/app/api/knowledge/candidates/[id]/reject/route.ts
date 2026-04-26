import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const candidate = await prisma.knowledgeCandidate.findUnique({ where: { id } });
  if (!candidate) return Response.json({ error: "not found" }, { status: 404 });
  if (candidate.status !== "pending") {
    return Response.json({ error: "already reviewed" }, { status: 400 });
  }

  await prisma.knowledgeCandidate.update({
    where: { id },
    data: { status: "rejected", reviewedAt: new Date(), reviewedBy: "demo-user" },
  });

  await prisma.auditLog.create({
    data: {
      action: "candidate_rejected",
      detail: JSON.stringify({ candidateId: id }),
    },
  });

  return Response.json({ ok: true });
}
