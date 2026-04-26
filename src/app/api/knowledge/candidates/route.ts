import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const candidates = await prisma.knowledgeCandidate.findMany({
    where: { status },
    include: { sourceInquiry: true },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(candidates);
}
