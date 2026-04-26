import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { InquiryListItem } from "@/types";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");

  const where = status ? { status } : {};
  const inquiries = await prisma.inquiry.findMany({
    where,
    include: {
      category: true,
      drafts: { where: { isLatest: true }, take: 1 },
      sent: true,
    },
    orderBy: { receivedAt: "desc" },
  });

  const result: InquiryListItem[] = inquiries.map((i) => ({
    ...i,
    latestDraft: i.drafts[0] ?? null,
    hasSent: Boolean(i.sent),
  }));

  return Response.json(result);
}
