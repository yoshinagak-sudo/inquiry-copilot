import Anthropic from "@anthropic-ai/sdk";
import type { Inquiry, KnowledgeArticle } from "@prisma/client";
import type { DraftPayload, InquiryMetadata } from "@/types";

// 過去納品事例の型番URL（tk_数字 形式）を本文から検出
export const detectProductRefs = (text: string): string[] => {
  const refs = new Set<string>();
  for (const m of text.matchAll(/tk_\d+/gi)) {
    refs.add(m[0].toLowerCase());
  }
  return Array.from(refs);
};

// productRefs にマッチするナレッジを先頭に並べ替え（mutate しない）
const prioritizeArticles = (
  articles: KnowledgeArticle[],
  refs: string[],
): KnowledgeArticle[] => {
  if (refs.length === 0) return articles;
  return [...articles].sort((a, b) => {
    const aHit = refs.some((r) => a.body.toLowerCase().includes(r)) ? 1 : 0;
    const bHit = refs.some((r) => b.body.toLowerCase().includes(r)) ? 1 : 0;
    return bHit - aHit;
  });
};

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

const SYSTEM_PROMPT = `あなたはアクリル製品製造会社（トロフィー・POP・ディスプレイ・カスタムプロダクト等）のカスタマーサポート担当です。
受信した問い合わせメールに対して、提供されたナレッジのみを根拠に丁寧な日本語で返信草案を作成します。

ルール:
- 推測で答えない。ナレッジに無い情報は「確認のうえご連絡します」と書く
- 引用したナレッジの id を citedIds に必ず含める
- 親しみと正確さのバランス。冒頭に「お問い合わせありがとうございます」相当の挨拶
- 末尾は「カスタマーサポート」で締める
- confidence: ナレッジで答えられた度合いを 0.0〜1.0 で自己評価

必ず以下の JSON 形式のみを出力（コードブロックや説明文は不要）:
{"body":"...","confidence":0.0,"citedIds":["..."]}`;

const buildUserPrompt = (inquiry: Inquiry, articles: KnowledgeArticle[], refs: string[]) => {
  const knowledgeText = articles
    .map(
      (a) =>
        `### id: ${a.id}\nタイトル: ${a.title}\n本文:\n${a.body}\n`,
    )
    .join("\n---\n");

  const refHint = refs.length
    ? `\n\n# 重要: 本文に過去納品事例の型番 [${refs.join(", ")}] が含まれています。該当ナレッジを優先的に引用してください。`
    : "";

  return `# 利用可能なナレッジ
${knowledgeText || "（ナレッジ無し）"}

# 受信した問い合わせ
差出人: ${inquiry.fromName} <${inquiry.fromEmail}>
件名: ${inquiry.subject}
本文:
${inquiry.body}${refHint}

上記に対する返信草案を JSON で出力してください。`;
};

export const isLlmConfigured = (): boolean => Boolean(process.env.ANTHROPIC_API_KEY);

export const generateDraft = async (
  inquiry: Inquiry,
  articles: KnowledgeArticle[],
): Promise<DraftPayload> => {
  const refs = detectProductRefs(`${inquiry.subject}\n${inquiry.body}`);
  const prioritized = prioritizeArticles(articles, refs);

  if (!isLlmConfigured()) {
    return mockDraft(inquiry, prioritized, refs);
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(inquiry, prioritized, refs) }],
    });

    const block = response.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Claude returned no JSON");

    const parsed = JSON.parse(jsonMatch[0]) as DraftPayload;
    return {
      body: parsed.body,
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
      citedIds: Array.isArray(parsed.citedIds) ? parsed.citedIds : [],
      model: MODEL,
    };
  } catch (err) {
    console.warn("[llm] Claude failed, falling back to mock:", err);
    return mockDraft(inquiry, prioritized, refs);
  }
};

const bigrams = (s: string): Set<string> => {
  const out = new Set<string>();
  const cleaned = s.replace(/[\s、。,．\n!?！？「」『』（）()【】\-_/\\:;]+/g, "");
  for (let i = 0; i < cleaned.length - 1; i++) out.add(cleaned.slice(i, i + 2));
  return out;
};

const mockDraft = (
  inquiry: Inquiry,
  articles: KnowledgeArticle[],
  refs: string[] = [],
): DraftPayload => {
  const queryBigrams = bigrams(`${inquiry.subject} ${inquiry.body}`.toLowerCase());

  const scored = articles
    .map((a) => {
      const haystackBigrams = bigrams(`${a.title} ${a.body}`.toLowerCase());
      let overlap = 0;
      for (const b of queryBigrams) if (haystackBigrams.has(b)) overlap++;
      const refBoost = refs.some((r) => a.body.toLowerCase().includes(r)) ? 0.5 : 0;
      const score = overlap / Math.max(queryBigrams.size, 1) + refBoost;
      return { article: a, score };
    })
    .filter((x) => x.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const cited = scored.map((s) => s.article);
  const baseConf = cited.length === 0 ? 0.2 : Math.min(0.9, 0.4 + cited.length * 0.15);
  const confidence = refs.length > 0 ? Math.min(0.95, baseConf + 0.1) : baseConf;

  const greeting = `${inquiry.fromName} 様\n\nお問い合わせいただきありがとうございます。`;
  const refSection = cited.length
    ? cited
        .map(
          (a) =>
            `\n■ ${a.title}\n${a.body.slice(0, 200)}${a.body.length > 200 ? "…" : ""}`,
        )
        .join("\n")
    : "\n申し訳ありません、関連するナレッジが見つかりませんでした。担当より追って詳細をお送りします。";

  const closing = "\n\nご不明な点がございましたら、お気軽にお問い合わせください。\n\nカスタマーサポート";

  return {
    body: `${greeting}\n${refSection}${closing}`,
    confidence,
    citedIds: cited.map((c) => c.id),
    model: "mock",
  };
};

export const generateKnowledgeCandidate = async (params: {
  inquiry: Inquiry;
  draftBody: string;
  finalBody: string;
}): Promise<{ title: string; body: string; reason: string } | null> => {
  const { inquiry, draftBody, finalBody } = params;

  if (!isLlmConfigured()) {
    return mockCandidate(inquiry, draftBody, finalBody);
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1000,
      system: `あなたはナレッジマネージャーです。AI草案と人間が編集した最終文面の差分から、新しく追加すべきナレッジ記事を1件抽出します。

判定基準:
- 編集量が少なければ既存ナレッジで十分なので null を返す
- 編集量が多く、繰り返し使えそうな情報があれば JSON で返す

JSON 形式のみ出力（説明不要）:
ナレッジが必要な場合: {"title":"...","body":"...(Markdown)","reason":"..."}
不要な場合: {"skip":true}`,
      messages: [
        {
          role: "user",
          content: `# 元の問い合わせ
件名: ${inquiry.subject}
本文: ${inquiry.body}

# AI草案
${draftBody}

# 人間が送った最終文面
${finalBody}

# タスク
最終文面に新規ナレッジ化すべき情報があるか判定してください。`,
        },
      ],
    });

    const block = response.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.skip) return null;
    if (!parsed.title || !parsed.body) return null;

    return {
      title: String(parsed.title),
      body: String(parsed.body),
      reason: String(parsed.reason ?? "AI判定: 草案との差分が大きい"),
    };
  } catch (err) {
    console.warn("[llm] candidate generation failed:", err);
    return null;
  }
};

const mockCandidate = (
  inquiry: Inquiry,
  draftBody: string,
  finalBody: string,
): { title: string; body: string; reason: string } | null => {
  const draftLen = draftBody.length;
  const finalLen = finalBody.length;
  const lengthDiff = Math.abs(draftLen - finalLen) / Math.max(draftLen, 1);
  if (lengthDiff < 0.3 && finalLen < 200) return null;

  const title = `[候補] ${inquiry.subject}`.slice(0, 80);
  const body = `## 想定される質問\n${inquiry.subject}\n\n## 回答テンプレート\n${finalBody}\n\n---\n*この記事は問い合わせ ${inquiry.id} の最終返信から自動生成されました。レビューして妥当性を確認してください。*`;

  return {
    title,
    body,
    reason: `送信文面と草案の差分が ${(lengthDiff * 100).toFixed(0)}% あったため候補化（モック）`,
  };
};

// 受信時に問い合わせをカテゴリに自動分類する
export const classifyInquiry = async (
  inquiry: Pick<Inquiry, "subject" | "body">,
  categoryNames: string[],
): Promise<string | null> => {
  if (categoryNames.length === 0) return null;
  if (!isLlmConfigured()) return mockClassify(inquiry, categoryNames);

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 100,
      system:
        "受信した問い合わせメールを以下のカテゴリのうち最も近いもの 1 つに分類します。JSON のみ返答: {\"category\":\"<カテゴリ名>\"}",
      messages: [
        {
          role: "user",
          content: `# カテゴリ\n${categoryNames.map((n) => "- " + n).join("\n")}\n\n# 問い合わせ\n件名: ${inquiry.subject}\n本文: ${inquiry.body.slice(0, 600)}`,
        },
      ],
    });
    const block = response.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text : "";
    const json = text.match(/\{[\s\S]*\}/);
    if (!json) return mockClassify(inquiry, categoryNames);
    const parsed = JSON.parse(json[0]);
    const matched = categoryNames.find((n) => n === parsed.category);
    return matched ?? mockClassify(inquiry, categoryNames);
  } catch (err) {
    console.warn("[llm] classify failed, falling back:", err);
    return mockClassify(inquiry, categoryNames);
  }
};

const mockClassify = (
  inquiry: Pick<Inquiry, "subject" | "body">,
  categoryNames: string[],
): string | null => {
  const haystack = `${inquiry.subject} ${inquiry.body}`.toLowerCase();
  const rules: { name: string; keywords: string[] }[] = [
    { name: "アクリルディスプレイ", keywords: ["ディスプレイ", "展示ケース", "ウェーハ", "鏡面", "高級感"] },
    { name: "アクリルPOP", keywords: ["pop", "ポップ", "値札", "スプリット"] },
    { name: "アクリルプロダクト", keywords: ["キーホルダー", "スタンド", "枡", "アクリルケース", "模型", "プロダクト"] },
    { name: "トロフィー（既成型）", keywords: ["既成", "既製", "ブラックトロフィー", "tk_"] },
    { name: "トロフィー（オリジナル）", keywords: ["オリジナル", "デザインから", "完全カスタム", "トロフィー"] },
    { name: "見積もり・納期", keywords: ["納期", "入稿", "見積もりだけ", "リードタイム"] },
  ];
  for (const r of rules) {
    if (!categoryNames.includes(r.name)) continue;
    if (r.keywords.some((kw) => haystack.includes(kw.toLowerCase()))) return r.name;
  }
  return categoryNames.find((n) => n === "その他") ?? categoryNames[0] ?? null;
};

// 受信時に予算・個数・要約を抽出する
export const extractMetadata = async (
  inquiry: Pick<Inquiry, "subject" | "body">,
): Promise<InquiryMetadata> => {
  const productRefs = detectProductRefs(`${inquiry.subject}\n${inquiry.body}`);

  if (!isLlmConfigured()) {
    return { ...mockMetadata(inquiry), productRefs };
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 250,
      system: `問い合わせメールから以下を抽出。記載が無ければ null。JSON のみ返答:
{"budgetText":"予算（例: 1万前後 / 未定）","quantityText":"個数（例: 30個 / 100個以上）","summaryNote":"案件の1行要約（30文字以内、製品種別と規模感）"}`,
      messages: [
        {
          role: "user",
          content: `件名: ${inquiry.subject}\n本文: ${inquiry.body.slice(0, 800)}`,
        },
      ],
    });
    const block = response.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text : "";
    const json = text.match(/\{[\s\S]*\}/);
    if (!json) return { ...mockMetadata(inquiry), productRefs };
    const parsed = JSON.parse(json[0]);
    return {
      budgetText: parsed.budgetText ?? null,
      quantityText: parsed.quantityText ?? null,
      summaryNote: parsed.summaryNote ?? null,
      productRefs,
    };
  } catch (err) {
    console.warn("[llm] extractMetadata failed, falling back:", err);
    return { ...mockMetadata(inquiry), productRefs };
  }
};

const mockMetadata = (
  inquiry: Pick<Inquiry, "subject" | "body">,
): Omit<InquiryMetadata, "productRefs"> => {
  const text = `${inquiry.subject}\n${inquiry.body}`;
  const budget =
    text.match(/予算\s*[:：]?\s*([^\n、,。]{1,30})/)?.[1]?.trim() ??
    text.match(/(\d{1,3}(?:,\d{3})*[万千]?\s*円(?:[〜～\-]\s*\d{1,3}(?:,\d{3})*[万千]?\s*円)?)/)?.[1]?.trim() ??
    null;
  const qty =
    text.match(/個数\s*[:：]?\s*([^\n、,。]{1,30})/)?.[1]?.trim() ??
    text.match(/数量\s*[:：]?\s*([^\n、,。]{1,30})/)?.[1]?.trim() ??
    text.match(/(\d+\s*[個点本枚])/)?.[1]?.trim() ??
    null;
  const subjectShort = inquiry.subject.slice(0, 30);
  return {
    budgetText: budget,
    quantityText: qty,
    summaryNote: subjectShort,
  };
};
