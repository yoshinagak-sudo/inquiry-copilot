import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const articles = await prisma.knowledgeArticle.findMany({
    include: { category: true },
    orderBy: { updatedAt: "desc" },
  });
  return Response.json(articles);
}

const createSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  categoryId: z.string().nullish(),
});

export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }
  const created = await prisma.knowledgeArticle.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      categoryId: parsed.data.categoryId ?? null,
    },
  });
  return Response.json(created);
}
