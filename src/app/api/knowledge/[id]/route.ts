import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  categoryId: z.string().nullish(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const json = await req.json();
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) return Response.json({ error: "invalid input" }, { status: 400 });

  const updated = await prisma.knowledgeArticle.update({ where: { id }, data: parsed.data });
  return Response.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.knowledgeArticle.delete({ where: { id } });
  return Response.json({ ok: true });
}
