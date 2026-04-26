import Anthropic from "@anthropic-ai/sdk";
import type { Inquiry, KnowledgeArticle } from "@prisma/client";
import type { DraftPayload } from "@/types";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

const SYSTEM_PROMPT = `あなたは農業法人「舞台ファーム」のカスタマーサポート担当です。
受信した問い合わせメールに対して、提供されたナレッジのみを根拠に丁寧な日本語で返信草案を作成します。

ルール:
- 推測で答えない。ナレッジに無い情報は「確認のうえご連絡します」と書く
- 引用したナレッジの id を citedIds に必ず含める
- 親しみと正確さのバランス。冒頭に「お問い合わせありがとうございます」相当の挨拶
- 末尾は「舞台ファーム カスタマーサポート」で締める
- confidence: ナレッジで答えられた度合いを 0.0〜1.0 で自己評価

必ず以下の JSON 形式のみを出力（コードブロックや説明文は不要）:
{"body":"...","confidence":0.0,"citedIds":["..."]}`;

const buildUserPrompt = (inquiry: Inquiry, articles: KnowledgeArticle[]) => {
  const knowledgeText = articles
    .map(
      (a) =>
        `### id: ${a.id}\nタイトル: ${a.title}\n本文:\n${a.body}\n`,
    )
    .join("\n---\n");

  return `# 利用可能なナレッジ
${knowledgeText || "（ナレッジ無し）"}

# 受信した問い合わせ
差出人: ${inquiry.fromName} <${inquiry.fromEmail}>
件名: ${inquiry.subject}
本文:
${inquiry.body}

上記に対する返信草案を JSON で出力してください。`;
};

export const isLlmConfigured = (): boolean => Boolean(process.env.ANTHROPIC_API_KEY);

export const generateDraft = async (
  inquiry: Inquiry,
  articles: KnowledgeArticle[],
): Promise<DraftPayload> => {
  if (!isLlmConfigured()) {
    return mockDraft(inquiry, articles);
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(inquiry, articles) }],
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
    return mockDraft(inquiry, articles);
  }
};

const bigrams = (s: string): Set<string> => {
  const out = new Set<string>();
  const cleaned = s.replace(/[\s、。,．\n!?！？「」『』（）()【】\-_/\\:;]+/g, "");
  for (let i = 0; i < cleaned.length - 1; i++) out.add(cleaned.slice(i, i + 2));
  return out;
};

const mockDraft = (inquiry: Inquiry, articles: KnowledgeArticle[]): DraftPayload => {
  const queryBigrams = bigrams(`${inquiry.subject} ${inquiry.body}`.toLowerCase());

  const scored = articles
    .map((a) => {
      const haystackBigrams = bigrams(`${a.title} ${a.body}`.toLowerCase());
      let overlap = 0;
      for (const b of queryBigrams) if (haystackBigrams.has(b)) overlap++;
      const score = overlap / Math.max(queryBigrams.size, 1);
      return { article: a, score };
    })
    .filter((x) => x.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const cited = scored.map((s) => s.article);
  const confidence = cited.length === 0 ? 0.2 : Math.min(0.9, 0.4 + cited.length * 0.15);

  const greeting = `${inquiry.fromName} 様\n\nお問い合わせいただきありがとうございます。`;
  const refSection = cited.length
    ? cited
        .map(
          (a) =>
            `\n■ ${a.title}\n${a.body.slice(0, 200)}${a.body.length > 200 ? "…" : ""}`,
        )
        .join("\n")
    : "\n申し訳ありません、関連するナレッジが見つかりませんでした。担当より追って詳細をお送りします。";

  const closing = "\n\nご不明な点がございましたら、お気軽にお問い合わせください。\n\n舞台ファーム カスタマーサポート";

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
