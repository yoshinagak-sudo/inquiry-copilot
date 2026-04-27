import { formatDistanceToNow, format } from "date-fns";
import { ja } from "date-fns/locale";

/** 受信日時などの相対表示。「3時間前」など */
export const formatRelative = (d: Date | string): string => {
  const date = typeof d === "string" ? new Date(d) : d;
  return formatDistanceToNow(date, { addSuffix: true, locale: ja });
};

/** 絶対日時（YYYY-MM-DD HH:mm） */
export const formatDateTime = (d: Date | string): string => {
  const date = typeof d === "string" ? new Date(d) : d;
  return format(date, "yyyy-MM-dd HH:mm", { locale: ja });
};

export const formatDate = (d: Date | string): string => {
  const date = typeof d === "string" ? new Date(d) : d;
  return format(date, "yyyy-MM-dd", { locale: ja });
};

/** 信頼度を 高 / 中 / 低 に分類 */
export type ConfidenceTone = "high" | "mid" | "low";
export const confidenceTone = (c: number): ConfidenceTone => {
  if (c >= 0.7) return "high";
  if (c >= 0.4) return "mid";
  return "low";
};

export const confidenceLabel = (c: number): string => {
  const t = confidenceTone(c);
  return t === "high" ? "高" : t === "mid" ? "中" : "低";
};

/** 信頼度バッジの Tailwind クラス */
export const confidenceClass = (c: number): string => {
  const t = confidenceTone(c);
  if (t === "high") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (t === "mid") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
};

/** カテゴリ名から色トークンを引く（業務系の温かみ + 米農家のトーン） */
export const categoryClass = (name: string | undefined | null): string => {
  switch (name) {
    case "商品・購入":
      return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
    case "配送・送料":
      return "bg-sky-50 text-sky-800 ring-1 ring-sky-200";
    case "クレーム":
      return "bg-rose-50 text-rose-800 ring-1 ring-rose-200";
    case "採用":
      return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
    case "ふるさと納税":
      return "bg-violet-50 text-violet-800 ring-1 ring-violet-200";
    default:
      return "bg-stone-100 text-stone-700 ring-1 ring-stone-200";
  }
};

/**
 * `productRefs` は JSON 配列文字列で保存されている（例: `'["tk_18"]'`）。
 * 不正値や null は空配列として扱う。
 */
export const parseProductRefs = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/** メタピル（予算 / 個数 / 型番）の共通 className */
export const META_PILL_CLASS =
  "inline-flex items-center gap-1 rounded-md bg-stone-100 px-1.5 py-0.5 text-[10.5px] font-medium leading-4 text-stone-700 ring-1 ring-inset ring-stone-200";

export const META_PILL_PRODUCT_CLASS =
  "inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-medium leading-4 text-emerald-800 ring-1 ring-inset ring-emerald-200";

/** ステータスバッジのクラスとラベル */
export const statusBadge = (
  status: string,
): { label: string; className: string } => {
  switch (status) {
    case "new":
      return {
        label: "未着手",
        className: "bg-stone-100 text-stone-700 ring-1 ring-stone-200",
      };
    case "drafted":
      return {
        label: "草案あり",
        className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
      };
    case "sent":
      return {
        label: "送信済み",
        className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
      };
    case "archived":
      return {
        label: "アーカイブ",
        className: "bg-stone-100 text-stone-500 ring-1 ring-stone-200",
      };
    default:
      return {
        label: status,
        className: "bg-stone-100 text-stone-700 ring-1 ring-stone-200",
      };
  }
};
