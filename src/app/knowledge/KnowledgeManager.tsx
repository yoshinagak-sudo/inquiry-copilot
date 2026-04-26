"use client";

import { useEffect, useMemo, useState } from "react";
import { categoryClass, formatDate } from "@/lib/format";
import { Badge } from "@/components/Badge";
import type { Category, KnowledgeArticle } from "@/types";

type ArticleWithCategory = KnowledgeArticle & { category: Category | null };

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; article: ArticleWithCategory }
  | null;

type Props = {
  initialArticles: ArticleWithCategory[];
  categories: Category[];
};

export const KnowledgeManager = ({
  initialArticles,
  categories,
}: Props) => {
  const [articles, setArticles] = useState<ArticleWithCategory[]>(initialArticles);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<EditorState>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q),
    );
  }, [articles, query]);

  const reload = async () => {
    const res = await fetch("/api/knowledge", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as ArticleWithCategory[];
      setArticles(data);
    }
  };

  const handleSave = async (
    payload: { title: string; body: string; categoryId: string | null },
    targetId?: string,
  ) => {
    const url = targetId ? `/api/knowledge/${targetId}` : "/api/knowledge";
    const method = targetId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`保存に失敗しました (${res.status})`);
    }
    await reload();
    setToast(targetId ? "ナレッジを更新しました" : "ナレッジを追加しました");
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm(
      "このナレッジを削除します。元に戻せません。よろしいですか？",
    );
    if (!ok) return;
    const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    if (!res.ok) {
      window.alert("削除に失敗しました");
      return;
    }
    await reload();
    setEditor(null);
    setToast("ナレッジを削除しました");
  };

  return (
    <>
      {/* 検索 + 新規 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
          >
            ⌕
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="タイトル・本文で検索"
            className="block h-10 w-full rounded-md border border-stone-300 bg-white pl-9 pr-3 text-sm text-stone-900 shadow-sm focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
            aria-label="ナレッジを検索"
          />
        </div>
        <button
          type="button"
          onClick={() => setEditor({ mode: "create" })}
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-emerald-700 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          <span aria-hidden>＋</span>
          新規追加
        </button>
      </div>

      <p className="mt-2 text-[12px] text-stone-500">
        全 <span className="tabular-nums">{articles.length}</span> 件
        {query && (
          <>
            {" "}
            / 検索結果 <span className="tabular-nums">{filtered.length}</span> 件
          </>
        )}
      </p>

      {/* 一覧 */}
      {filtered.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-stone-300 bg-white py-16 text-center text-sm text-stone-500">
          {query
            ? "検索条件に一致するナレッジがありません。"
            : "ナレッジがまだありません。「新規追加」から作成してください。"}
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
          <table className="hidden w-full text-sm md:table" aria-label="ナレッジ一覧">
            <thead className="border-b border-stone-200 bg-stone-50/80 text-[11px] uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">タイトル</th>
                <th className="px-4 py-2.5 text-left font-medium">カテゴリ</th>
                <th className="px-4 py-2.5 text-left font-medium">出典</th>
                <th className="px-4 py-2.5 text-right font-medium">引用回数</th>
                <th className="px-4 py-2.5 text-left font-medium">最終利用</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  className="cursor-pointer transition-colors hover:bg-stone-50"
                  onClick={() => setEditor({ mode: "edit", article: a })}
                >
                  <td className="px-4 py-3 align-top">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditor({ mode: "edit", article: a });
                      }}
                      className="text-left font-medium text-stone-900 underline-offset-2 hover:text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded-sm"
                    >
                      {a.title}
                    </button>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-stone-500">
                      {a.body.replace(/[#*`]/g, "").slice(0, 80)}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {a.category ? (
                      <Badge className={categoryClass(a.category.name)}>
                        {a.category.name}
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-stone-400">未設定</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Badge
                      className={
                        a.source === "candidate"
                          ? "bg-violet-50 text-violet-700 ring-1 ring-violet-200"
                          : "bg-stone-100 text-stone-600 ring-1 ring-stone-200"
                      }
                    >
                      {a.source === "candidate" ? "候補昇格" : "手動"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right align-top tabular-nums text-stone-700">
                    {a.refCount}
                  </td>
                  <td className="px-4 py-3 align-top text-[12px] text-stone-600">
                    {a.lastUsedAt ? formatDate(a.lastUsedAt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(a.id);
                      }}
                      className="rounded px-2 py-1 text-[12px] text-stone-500 transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                      aria-label={`${a.title} を削除`}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* モバイル */}
          <ul className="divide-y divide-stone-100 md:hidden" aria-label="ナレッジ一覧">
            {filtered.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="block w-full px-4 py-3 text-left transition-colors hover:bg-stone-50"
                  onClick={() => setEditor({ mode: "edit", article: a })}
                >
                  <div className="font-medium text-stone-900">{a.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {a.category && (
                      <Badge className={categoryClass(a.category.name)}>
                        {a.category.name}
                      </Badge>
                    )}
                    <span className="text-[11px] text-stone-500">
                      引用 {a.refCount} 回
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* モーダル */}
      {editor && (
        <KnowledgeEditorDialog
          state={editor}
          categories={categories}
          onClose={() => setEditor(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      {/* トースト */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
        >
          <div className="rounded-full border border-emerald-200 bg-white px-4 py-2.5 text-[13px] text-stone-800 shadow-lg">
            <span aria-hidden className="mr-2 text-emerald-600">●</span>
            {toast}
          </div>
        </div>
      )}
    </>
  );
};

// ──────────────── ダイアログ ────────────────

const KnowledgeEditorDialog = ({
  state,
  categories,
  onClose,
  onSave,
  onDelete,
}: {
  state: NonNullable<EditorState>;
  categories: Category[];
  onClose: () => void;
  onSave: (
    payload: { title: string; body: string; categoryId: string | null },
    targetId?: string,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) => {
  const isEdit = state.mode === "edit";
  const [title, setTitle] = useState(isEdit ? state.article.title : "");
  const [body, setBody] = useState(isEdit ? state.article.body : "");
  const [categoryId, setCategoryId] = useState<string>(
    isEdit ? state.article.categoryId ?? "" : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ESC で閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError("タイトルと本文は必須です");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          title: title.trim(),
          body,
          categoryId: categoryId || null,
        },
        isEdit ? state.article.id : undefined,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="knowledge-editor-title"
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-stone-900/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="relative my-8 w-full max-w-2xl rounded-lg border border-stone-200 bg-white shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
          <h3
            id="knowledge-editor-title"
            className="text-[14px] font-semibold text-stone-900"
          >
            {isEdit ? "ナレッジを編集" : "ナレッジを新規追加"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="閉じる"
          >
            ✕
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label
              htmlFor="kn-title"
              className="block text-[11px] font-medium uppercase tracking-wide text-stone-500"
            >
              タイトル
            </label>
            <input
              id="kn-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 block h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 shadow-sm focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
            />
          </div>

          <div>
            <label
              htmlFor="kn-category"
              className="block text-[11px] font-medium uppercase tracking-wide text-stone-500"
            >
              カテゴリ
            </label>
            <select
              id="kn-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 block h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 shadow-sm focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
            >
              <option value="">未設定</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="kn-body"
              className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-stone-500"
            >
              <span>本文（Markdown）</span>
              <span className="tabular-nums normal-case font-normal">
                {body.length} 文字
              </span>
            </label>
            <textarea
              id="kn-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={14}
              className="mt-1 block w-full resize-y rounded-md border border-stone-300 bg-white px-3 py-2.5 font-mono text-[13px] leading-7 text-stone-900 shadow-inner focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
              placeholder={"## 質問\n## 回答\n..."}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700"
            >
              {error}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-stone-200 bg-stone-50/40 px-5 py-3">
          <div>
            {isEdit && (
              <button
                type="button"
                onClick={() => onDelete(state.article.id)}
                className="rounded-md px-3 py-1.5 text-[12px] font-medium text-rose-600 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                削除
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-md border border-stone-300 bg-white px-3 text-[13px] font-medium text-stone-700 transition-colors hover:border-stone-400 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 items-center rounded-md bg-emerald-700 px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
};
