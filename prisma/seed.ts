import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { generateDraft } from "../src/lib/llm";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

const CATEGORIES = [
  { name: "商品・購入", description: "白米/玄米/ギフト/業務用などの購入相談" },
  { name: "配送・送料", description: "発送状況・送料・配送エリアの問い合わせ" },
  { name: "ふるさと納税", description: "ふるさと納税返礼品の納期・内容" },
  { name: "クレーム", description: "品質・対応へのクレーム" },
  { name: "採用", description: "求人・インターン・収穫体験" },
  { name: "その他", description: "上記に当てはまらないもの" },
];

const KNOWLEDGE = [
  {
    title: "白米・玄米のラインナップと価格",
    category: "商品・購入",
    body: `# 白米・玄米のラインナップ

## 主力商品
- ササニシキ 白米 5kg / 10kg / 30kg
- ひとめぼれ 白米 5kg / 10kg / 30kg
- 環境保全米（特別栽培米）5kg / 10kg

## 価格（税込・送料別）
- 5kg: 2,800〜3,500円
- 10kg: 5,400〜6,800円
- 30kg（業務用）: 14,800〜18,000円

無洗米加工は +200円/kg で対応可能。`,
  },
  {
    title: "配送エリアと送料",
    category: "配送・送料",
    body: `# 配送エリアと送料

## 国内配送
- 全国対応（離島は除く）
- 送料: 5kg まで 880円 / 10kg まで 1,100円 / 30kg は 1,650円
- 北海道・沖縄は +500円
- 5,000円以上のご注文で送料無料（北海道・沖縄は 8,000円以上）

## 配送業者
ヤマト運輸 / 佐川急便（重量により切替）

## 納期
通常受注後 2〜3 営業日で発送。繁忙期（年末・お盆）は 5〜7 営業日かかる場合あり。`,
  },
  {
    title: "業務用大量注文の見積もりプロセス",
    category: "商品・購入",
    body: `# 業務用大量注文

## 対象
飲食店・宿泊業・給食施設・小売店等。月間 100kg 以上の継続購入を想定。

## 見積もり手順
1. 必要な品種・等級・月間使用量・配送先・希望納期を info@sampleagri.example までメール
2. 弊社営業（業務用担当: 高橋）が 2 営業日以内に折り返し
3. サンプル送付（無償、5kg まで）も対応可
4. 契約は月次請求書払い（与信審査あり）

## 価格メリット
小売価格より 10〜20% お得。年間契約でさらに割引あり。`,
  },
  {
    title: "ふるさと納税の発送スケジュール",
    category: "ふるさと納税",
    body: `# ふるさと納税の発送について

## 対応自治体
仙台市・名取市・岩沼市の返礼品として登録。

## 発送時期
- 寄付確定から 1〜2 ヶ月後に順次発送
- 新米シーズン（10〜12月）は混雑のため 2〜3 ヶ月かかる場合あり
- 12 月末駆け込み寄付分は翌年 2 月までの発送となります

## 配送状況の確認
寄付者本人がふるなび/さとふる等のマイページから確認可能。
個別問い合わせは寄付サイト経由でお願いします。`,
  },
  {
    title: "返品・返金ポリシー（クレーム対応）",
    category: "クレーム",
    body: `# 返品・返金ポリシー

## 不良品の場合
- 商品到着後 7 日以内に info@sampleagri.example へ写真付きで連絡
- カビ・虫害・破損が確認できた場合、無償で交換または全額返金
- 開封後でも対応可（食品なので柔軟に判断）

## お客様都合の返品
食品のため原則お受けできません。誤発注の場合のみ未開封・到着後 3 日以内に限り対応。

## 対応窓口
カスタマーサポート: info@sampleagri.example（営業時間 平日 9:00-17:00）`,
  },
  {
    title: "採用情報（正社員・パート・インターン）",
    category: "採用",
    body: `# 採用情報

## 正社員
- 募集職種: 営業 / 商品企画 / IT エンジニア / 農場マネージャー
- 応募方法: 採用ページ sampleagri.example/recruit から

## パート・アルバイト
- 仙台事業所での選別・包装作業
- 時給 1,100円〜（経験により）
- 週 3 日〜 OK

## インターン・収穫体験
- 大学生向けインターン: 春・夏・秋に募集（要 Web 申込）
- 一般向け収穫体験: 9〜10 月の土日に開催（事前予約制、参加費 2,000円）`,
  },
  {
    title: "ギフト・贈答用パッケージ",
    category: "商品・購入",
    body: `# ギフト・贈答用商品

## 商品ライン
- 食べ比べ 3 品種セット（各 2kg） 6,500円
- 高級木箱入り 環境保全米 5kg 8,800円
- のし対応（無料）: 御祝 / 内祝 / 御礼 / お中元 / お歳暮

## 配送
- 全国一律 送料無料（一部離島除く）
- メッセージカード同梱可（200 文字まで）
- 直接お届け（差出人と送り先が異なる場合）も対応`,
  },
  {
    title: "工場見学の受付状況",
    category: "その他",
    body: `# 精米工場見学

## 受付
- 平日のみ 10:00 / 14:00 の 1 日 2 回
- 1 回あたり最大 20 名
- 事前予約制（2 週間前まで）
- 申込: sampleagri.example/factory-tour

## 内容
精米工程・品質検査・パッケージング工程の見学。所要 60 分。

## 料金
無料。10 名以上の団体は要相談。`,
  },
  {
    title: "無洗米と特別栽培米の違い",
    category: "商品・購入",
    body: `# 商品の特徴

## 無洗米
研ぎ洗い不要。米の表面のヌカを除去済み。
時短調理に便利。ササニシキ・ひとめぼれ両方で対応。

## 特別栽培米（環境保全米）
通常米より農薬・化学肥料を 50% 以上削減。
宮城県の認証取得済み。価格は通常米 + 10〜15%。
お子様や健康志向の方に人気。`,
  },
  {
    title: "保育園向け野菜デリバリー（仙台限定）",
    category: "商品・購入",
    body: `# 保育園向け野菜デリバリー

## サービス概要
仙台市内の保育園・幼稚園向けに、産地直送野菜を週 1〜2 回配送。
デイサービスの送迎車を活用するため低コスト・低 CO2。

## 対応エリア
仙台市青葉区 / 宮城野区 / 若林区（2026年 4月時点）。
順次拡大予定。

## 申込
営業担当（保育園事業: 佐藤）まで。sampleagri.example/daycare から問い合わせ可。`,
  },
];

const INQUIRIES = [
  {
    fromName: "山田 太郎",
    fromEmail: "yamada@example.com",
    subject: "白米10kgの注文について",
    body: "ササニシキの白米10kgを購入したいのですが、東京への配送料金と納期を教えてください。\nまた、無洗米にできるかも知りたいです。",
    category: "商品・購入",
  },
  {
    fromName: "鈴木 花子",
    fromEmail: "suzuki@gourmet-restaurant.example.jp",
    subject: "業務用米の継続購入について見積もり依頼",
    body: "都内で和食店を経営しております。月50kgほど業務用でササニシキかひとめぼれを継続購入したいのですが、見積もりとサンプルをお願いできますでしょうか。",
    category: "商品・購入",
  },
  {
    fromName: "高橋 一郎",
    fromEmail: "takahashi@example.com",
    subject: "ふるさと納税の返礼品 まだ届きません",
    body: "12月に仙台市にふるさと納税で寄付し、サンプル農園のお米を返礼品として選びました。3月になっても発送通知が来ないのですが、状況を教えてください。寄付番号は SND-2025-12-3421 です。",
    category: "ふるさと納税",
  },
  {
    fromName: "田中 美咲",
    fromEmail: "tanaka.misaki@example.com",
    subject: "届いたお米にカビが生えていました",
    body: "先週注文した10kgのお米を開封したところ、底のほうにカビらしき青い斑点が見つかりました。写真を添付します。返品・交換は可能でしょうか。",
    category: "クレーム",
  },
  {
    fromName: "佐藤 健",
    fromEmail: "sato@university.example.ac.jp",
    subject: "農場インターンに参加したい",
    body: "宮城の大学に通う大学2年生です。夏休みに2週間ほど農場でインターンをさせていただけないでしょうか。条件や応募方法を教えてください。",
    category: "採用",
  },
  {
    fromName: "渡辺 真由美",
    fromEmail: "watanabe@example.com",
    subject: "母の日ギフトについて",
    body: "母の日に贈り物としてお米のギフトを送りたいです。3品種食べ比べセットと高級木箱入りの違いを教えてください。のし対応もお願いできますか？",
    category: "商品・購入",
  },
  {
    fromName: "伊藤 翔",
    fromEmail: "ito@daycare-himawari.example.jp",
    subject: "保育園野菜デリバリーの利用について",
    body: "仙台市泉区で保育園を運営しております。野菜デリバリーサービスに興味がありますが、泉区も対応エリアでしょうか？料金体系も知りたいです。",
    category: "商品・購入",
  },
  {
    fromName: "中村 久美子",
    fromEmail: "nakamura@example.com",
    subject: "工場見学の予約方法",
    body: "小学生の子供と一緒に精米工場を見学したいのですが、土日も対応していますか？親子2名で参加可能か教えてください。",
    category: "その他",
  },
  {
    fromName: "小林 大輔",
    fromEmail: "kobayashi@example.com",
    subject: "環境保全米について詳しく知りたい",
    body: "通常米と環境保全米でどのような違いがありますか？農薬の削減率や認証など、具体的な数字があれば教えてください。価格差にも納得感が欲しいです。",
    category: "商品・購入",
  },
  {
    fromName: "加藤 さくら",
    fromEmail: "kato@example.com",
    subject: "海外への発送は可能ですか",
    body: "シンガポール在住です。日本の家族にプレゼントとしてサンプル農園のお米を贈りたいのですが、海外への直接発送は可能でしょうか？",
    category: "その他",
  },
];

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.knowledgeCandidate.deleteMany();
  await prisma.sentReply.deleteMany();
  await prisma.draftReply.deleteMany();
  await prisma.inquiry.deleteMany();
  await prisma.knowledgeArticle.deleteMany();
  await prisma.category.deleteMany();

  const categoryMap = new Map<string, string>();
  for (const c of CATEGORIES) {
    const created = await prisma.category.create({ data: { name: c.name, description: c.description } });
    categoryMap.set(c.name, created.id);
  }

  for (const k of KNOWLEDGE) {
    await prisma.knowledgeArticle.create({
      data: {
        title: k.title,
        body: k.body,
        categoryId: categoryMap.get(k.category) ?? null,
      },
    });
  }

  const articles = await prisma.knowledgeArticle.findMany();

  for (const i of INQUIRIES) {
    const inq = await prisma.inquiry.create({
      data: {
        fromName: i.fromName,
        fromEmail: i.fromEmail,
        subject: i.subject,
        body: i.body,
        categoryId: categoryMap.get(i.category) ?? null,
        receivedAt: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 48),
      },
    });

    const generated = await generateDraft(inq, articles);
    await prisma.draftReply.create({
      data: {
        inquiryId: inq.id,
        body: generated.body,
        confidence: generated.confidence,
        citedIds: JSON.stringify(generated.citedIds),
        model: generated.model,
        isLatest: true,
      },
    });
    await prisma.inquiry.update({
      where: { id: inq.id },
      data: { status: "drafted" },
    });
    await prisma.auditLog.create({
      data: {
        inquiryId: inq.id,
        action: "draft_generated",
        detail: JSON.stringify({ model: generated.model, confidence: generated.confidence, source: "seed" }),
      },
    });
  }

  const inquiries = await prisma.inquiry.count();
  const drafts = await prisma.draftReply.count();
  const knowledge = await prisma.knowledgeArticle.count();
  console.log(`Seeded: ${CATEGORIES.length} categories, ${knowledge} knowledge articles, ${inquiries} inquiries, ${drafts} drafts`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
