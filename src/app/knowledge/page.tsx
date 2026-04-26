import { apiFetch } from "@/lib/api";
import { KnowledgeManager } from "./KnowledgeManager";
import type { Category, KnowledgeArticle } from "@/types";

type ArticleWithCategory = KnowledgeArticle & { category: Category | null };

export default async function KnowledgePage() {
  const [articles, categories] = await Promise.all([
    apiFetch<ArticleWithCategory[]>("/api/knowledge"),
    apiFetch<Category[]>("/api/categories"),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">
          ナレッジ管理
        </h1>
        <p className="text-sm text-stone-600">
          AI が返信草案を作るときに参照するナレッジを編集できます。
        </p>
      </header>
      <KnowledgeManager
        initialArticles={articles}
        categories={categories}
      />
    </div>
  );
}
