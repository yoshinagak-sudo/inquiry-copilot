import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { generateDraft, classifyInquiry, extractMetadata } from "../src/lib/llm";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

const CATEGORIES = [
  { name: "トロフィー（オリジナル）", description: "完全カスタム設計のアクリルトロフィー" },
  { name: "トロフィー（既成型）", description: "既成型ベースで印字・色変えなど部分カスタム" },
  { name: "アクリルプロダクト", description: "ケース・什器・特殊形状のカスタム製品" },
  { name: "アクリルPOP", description: "値札・商品説明・ディスプレイPOP" },
  { name: "アクリルディスプレイ", description: "展示用ディスプレイ・展示ケース" },
  { name: "見積もり・納期", description: "価格・納期・データ入稿関連" },
  { name: "その他", description: "上記以外の問い合わせ" },
];

const KNOWLEDGE = [
  {
    title: "製品ライン全体（受注対応可能な製品の種類）",
    category: "アクリルプロダクト",
    body: `# 取り扱い製品

## 主要製品ライン
- **アクリルトロフィー（オリジナル）** — 完全カスタム設計、デザイン段階からご相談承ります
- **アクリルトロフィー（既成型）** — 既存の型をベースに印字・色変え・サイズ調整で対応
- **アクリルプロダクト** — 模型ケース・展示ケース・什器・かぶせ箱型ケースなどカスタム製品
- **アクリルPOP** — 値札・商品説明POP・スプリット型POP（透明アクリル間に紙を挟む形式）
- **アクリルディスプレイ** — 展示用ディスプレイ、半導体ウェーハ展示ケース等の特殊用途
- **アクリル枡（mas/mas）** — 日本紋様彫刻入り、1合・0.3合・OJUサイズ

## 共通仕様
透明アクリル t3（厚み3mm）が標準。鏡面仕上げ、任意型抜き、レーザー彫刻に対応します。`,
  },
  {
    title: "既成型とオリジナルの違い・使い分け",
    category: "トロフィー（オリジナル）",
    body: `# 既成型 vs オリジナル

## 既成型トロフィー
- 既存の金型を流用、印字・色・サイズ変更でカスタム
- **納期: 2〜3 週間**、コストを抑えられます
- 1 個 5,000〜15,000 円が目安
- 弊社サイトの製品ページ（過去納品事例）URL を共有いただけると、ベース型の選定がスムーズです

## オリジナルトロフィー
- デザイン・形状から完全カスタム
- **納期: 4〜6 週間**（型製作期間を含む）
- 個数・サイズ・形状により価格は大きく変動、別途お見積もり
- ロゴ・モチーフ画像からの起こし対応可

## 予算と納期で迷われた場合
ご予算が厳しい場合は既成型を、独自デザインを重視される場合はオリジナルをご提案します。両案併記でのお見積もりも承ります。`,
  },
  {
    title: "データ入稿方法・推奨ファイル形式",
    category: "見積もり・納期",
    body: `# データ入稿について

## 推奨ファイル形式
- **Adobe Illustrator (.ai)** が最も望ましい形式です
- PDF データも対応可（ベクター推奨）
- ロゴのみの場合は PNG / JPG でも一旦受付、最終入稿時に Illustrator データへの変換をご相談

## 大容量ファイルの送付方法
- **ギガファイル便** / **Google Drive** / **Dropbox** などの共有リンクをお問い合わせ時に併記してください
- パスワード付き ZIP もご対応いただけます

## データが手元にない場合
- ラフスケッチ・写真からデザインを起こすことも可能（別途デザイン費が発生する場合があります）
- 過去納品事例のURLを参考としてご提示いただければ、それをベースに進めます`,
  },
  {
    title: "見積もり依頼から納品までの流れ",
    category: "見積もり・納期",
    body: `# 見積もり依頼の流れ

1. **お問い合わせフォームから送信** — 製品種別・数量・希望納期・予算・データ有無をご記入ください
2. **担当より 2 営業日以内に折り返し** — 詳細ヒアリング、必要に応じて電話でも対応いたします
3. **概算お見積もりの提示** — 仕様確定前でもレンジでご提示可能です
4. **データ入稿・サンプル製作（必要時）** — サンプル製作は有料、量産前の確認用としてご活用ください
5. **本発注・製造** — 既成型は 2〜3 週間、オリジナルは 4〜6 週間が目安
6. **納品** — 発送日のご連絡、納品書同梱`,
  },
  {
    title: "納期の目安と短納期対応",
    category: "見積もり・納期",
    body: `# 納期の目安

| 製品 | 標準納期 |
|---|---|
| 既成型トロフィー（印字・色変え） | 2〜3 週間 |
| オリジナルトロフィー（型から製作） | 4〜6 週間 |
| アクリルPOP | 2〜3 週間 |
| アクリルプロダクト・ディスプレイ | 仕様により 3〜6 週間 |
| 大量生産（数千個〜） | 別途打ち合わせ、短納期は追加費用 |

## 短納期のご相談
記念式典・展示会・キャンペーン等、納期が確定している案件は早めにご相談ください。製造ライン調整により対応可能な場合があります。`,
  },
  {
    title: "印刷・加工オプション",
    category: "アクリルプロダクト",
    body: `# 加工・印刷の選択肢

## 印刷
- **フルカラー印刷（4C）** — 写真・グラデーションも再現可
- **白引き** — 透明アクリルの裏面に白を入れて発色を高める
- **UV印刷** — 耐久性が高く、屋外使用にも対応

## 加工
- **レーザー彫刻** — ロゴ・文字・モチーフを彫り込み
- **任意型抜き** — キャラクター形状などの自由な切り抜き
- **鏡面仕上げ** — 切断面を磨いて高級感を出す
- **金属脚・スタンド付け** — A4 アクリルパネル等で対応

## 個包装
- 透明 OPP 袋入れ
- プチプチ＋無地段ボール
- 支給シール貼付（裏面 1〜2 枚）も対応`,
  },
  {
    title: "個数レンジと価格の目安",
    category: "見積もり・納期",
    body: `# 個数別の対応・価格目安

## 少量（1〜10 個）
- 既成型トロフィー: 1 個 5,000〜15,000 円
- オリジナルトロフィー: 型代込みで合計 5〜30 万円
- アクリルプロダクト（特殊形状）: 1 個 8,000 円〜

## 中量（10〜100 個）
- アクリルPOP: 単価 500〜1,500 円が目安
- アクリル枡: 単価 800 円前後（ロゴ入り、100 個以上）
- 表彰用トロフィー: 単価 8,000〜15,000 円

## 大量（100 個以上、商業生産）
- アクリルキーホルダー・スタンド: 個数により単価大きく低減
- 数千〜数十万個の生産も対応実績あり
- バルク納品（弊社で内職せず）の単価設定もご相談可

## 注意
記載は目安です。仕様（厚み・印刷・加工）により大きく変動しますので、必ずお見積もりをお取りください。`,
  },
  {
    title: "サンプル製作・量産前確認",
    category: "アクリルプロダクト",
    body: `# サンプル製作

## 対応内容
- **量産前のサンプル 1 個製作** に対応します
- 工程・型代に応じた有料対応となります
- 量産との材料・印刷条件は同一にて製作

## 推奨される使い方
- 複雑な仕様（カスタム形状、新規データ）の場合
- 配色・質感の最終確認が必要な場合
- 大量発注前に色校正したい場合

## サンプル料金
- 既成型ベース: 5,000〜15,000 円程度
- オリジナル（新規型）: 型代込みで別途お見積もり

サンプル承認後、量産工程に進みます。サンプル代は本発注時に充当する場合もご相談可能です。`,
  },
  {
    title: "大量発注・継続取引・法人契約",
    category: "アクリルプロダクト",
    body: `# 大量・継続発注の対応

## 対象
- 数千〜数十万個の商業生産案件
- アクリルキーホルダー、スタンド、パネル等の大量プロダクト
- 月次・四半期での継続発注

## 提供形態
- **完成品納品**: 個包装・シール貼付・検品まで弊社で対応
- **バルク納品**: アクリル単体での納品、内職はお客様側で実施
- いずれもお見積もりにて対応

## 法人契約
- 専用窓口の設置
- 月次レポート提供
- 優先生産枠の確保
- 価格レンジは案件ごとに個別協議

## 申込フロー
お問い合わせフォームに「大量・継続案件」とご記載の上、想定数量・納期・配送先・データ仕様をご教示ください。担当より 2 営業日以内にご連絡いたします。`,
  },
  {
    title: "過去納品事例の URL を活用したご相談",
    category: "トロフィー（既成型）",
    body: `# 過去納品事例 URL のご活用

## 推奨される参照方法
弊社サイトの製品ページ URL（archives/product/tk_XX 形式）を、お問い合わせ時にご共有ください。

## 参照URLがあるとスムーズな点
- ベース型の特定が即座に可能
- サイズ・素材・印刷方法のすり合わせが省略できる
- 概算お見積もりが当日中に可能なケースもあります

## 参照URL例
- 過去のオリジナル制作事例
- 既成型のラインナップ
- 競合他社サイトの製品 URL でも、近い仕様を提案可能です（その場合「これに近そうな既成型」をご提案）

## 重要なご相談例
- 「○○の URL に似たトロフィーを X 個、Y 円程度で作れるか」
- 「URL の形をベースに、印字内容を変更したい」
- 「URL の製品より一回り小さく、または素材変更で安くできないか」`,
  },
];

const INQUIRIES = [
  {
    fromName: "佐藤 太郎",
    fromEmail: "sato@example.com",
    subject: "オリジナルトロフィーの製作見積もり",
    body: `初めまして、株式会社サンプルクリエイトの佐藤と申します。
弊社が運営するクラシックカー団体の年次表彰式で使用するトロフィーを制作したく、お問い合わせいたします。

添付した写真資料と同じものを製作した場合の費用をお知らせ頂けないでしょうか。
2 つのデザイン案がありまして、1 つは金属プレート付き、もう 1 つは完全アクリル製です。

可能であれば、金属プレート付きでの製作を希望しますが、デザイン・素材次第では、プレート無しでも問題ありません。

◇トロフィー大きさ
・プレート有：高さ 17cm × 幅 13cm × 奥行 4.5cm
・プレート無：高さ 19cm × 幅 8cm × 奥行 6cm

個数: 2 個
納期: 来月中旬までに納品希望

ご検討よろしくお願いいたします。`,
    category: "トロフィー（オリジナル）",
  },
  {
    fromName: "田中 美咲",
    fromEmail: "tanaka@example.com",
    subject: "既成型トロフィーで会社設立記念品を制作したい",
    body: `お世話になっております。
企業設立記念に、企業ロゴ入りのトロフィーを 6 点ほど作りたく、お見積もりをお願いいたします。

例えば、御社サイトの過去納品事例（tk_18 番のトロフィー）のようなものを参考にしております。
1 点 6,000 円程度で 6 点作れないかと考えていますが、価格面のご調整は難しいでしょうか？

ロゴデータは Illustrator 形式で別途お送りいたします。
設立年月日も入れる予定です。

ご検討のほどよろしくお願いいたします。`,
    category: "トロフィー（既成型）",
  },
  {
    fromName: "渡辺 健司",
    fromEmail: "watanabe@startup-example.co.jp",
    subject: "アクリルキーホルダー・スタンドの大量発注見積もり依頼",
    body: `初めまして、サンプルプロダクト株式会社の渡辺と申します。
弊社はキャラクターグッズ全般の企画・製造・販売を行っております。

弊社の中でも特にアクリル製品の需要が大変高まっており、
現在の生産体制では対応が難しい受注計画がございまして、新規工場の開拓を検討しております。

もし新規取引を前向きにご検討いただけるようでしたら、以下の内容に基づいてお見積りを作成して頂くことは可能でしょうか。

◆アクリルキーホルダー
素材：透明アクリル t3
サイズ：60×60mm 以内 / 100×100mm 以内
印刷：4C+白引き
個包装：透明 OPP 袋入れ + 裏面シール 2 枚貼り
数量：30 / 50 / 100 / 300 / 500

◆アクリルスタンド
素材：透明アクリル t3
サイズ：キャラ部分 130×80mm 以内、台座 60×50mm 以内
印刷：4C+白引き

完成品納品の場合と、バルク納品（内職は弊社対応）の両方の単価をお伺いしたく存じます。

よろしくお願いいたします。`,
    category: "アクリルプロダクト",
  },
  {
    fromName: "高橋 由美",
    fromEmail: "takahashi@example.com",
    subject: "3D 模型用アクリルケースの製作",
    body: `お世話になります。
3D 模型を展示するためのアクリルケースを 1 点製作いただきたく、ご相談です。

仕様:
- かぶせ箱形式（土台部に落とし込み）
- サイズ: 縦 360mm × 横 248mm × 高さ 90mm（土台部 20mm）
- 透明アクリル

データはギガファイル便にて別途お送りします。

製作可否、概算見積もり、納期をお知らせください。
よろしくお願いいたします。`,
    category: "アクリルプロダクト",
  },
  {
    fromName: "中村 大輔",
    fromEmail: "nakamura@example.com",
    subject: "スプリット型 POP のオリジナルサイズ製作",
    body: `スプリット型 POP をオリジナルのサイズでお作りいただきたいと考えております。

サイズ: 100mm × 210mm × 7mm
隙間: コピー用紙程度の厚みのものを挟む予定です（1mm 未満で問題なし）

数量: 100 個以上を予定

上記のものを作成していただけるか、また価格感を伺いたいです。
あわせて、可能であればサンプルを 1 つ来週中にいただけませんでしょうか。

ご検討のほどよろしくお願いいたします。`,
    category: "アクリルPOP",
  },
  {
    fromName: "小林 さくら",
    fromEmail: "kobayashi@example.com",
    subject: "以前製作した POP の追加発注について",
    body: `数年前に御社でアクリル POP を作成していただきました。
今回は数量少ないのですが、4 種類を各 5 個ずつの追加発注をお願いできますでしょうか。

サイズ: W15 × H5 × D2 cm
仕様: 背面に印刷パターン

印刷の色イメージや、以前作成していただいたものの写真、サイズイメージをファイルにしてアップしております（共有リンクは別途お送りします）。

何卒よろしくお願いいたします。`,
    category: "アクリルPOP",
  },
  {
    fromName: "伊藤 翔",
    fromEmail: "ito@example.com",
    subject: "高級感のあるアクリルディスプレイの製作相談",
    body: `こんにちは。個人事業主ですが、制作するものは大手メーカー向けです。

A5 サイズ程度で、高級感・重厚感のあるアクリルディスプレイを制作したいです。

希望仕様:
- アクリルの任意型抜き（自立型、厚みあり）
- 鏡面仕上げ
- ロゴや文字の彫刻（150mm × 150mm 程度）
- データは Adobe Illustrator 形式
- 用途: プレゼント用
- 製作クオリティを重視します

必要製作日数とお見積りをいただけますと幸いです。
よろしくお願いいたします。`,
    category: "アクリルディスプレイ",
  },
  {
    fromName: "山田 健",
    fromEmail: "yamada@example.com",
    subject: "ブラックトロフィー希望、概算見積もり",
    body: `お世話になっております。
表彰式用にブラックトロフィーを 30 個ほど制作したいと考えております。

参考 URL（他社サイト）: （参考URL）
こちらに似たブラックトロフィー希望ですが、金額が厳しい場合、近そうな既成型や仕様をご提案いただきたいです。

入れる情報:
- 受賞者名・受賞内容（添付資料参照）
- 弊社ロゴ

予算: 1 個 1 万円前後を希望
納期: 来月末までに納品

入稿期限と概算見積もりをご教示ください。`,
    category: "トロフィー（既成型）",
  },
  {
    fromName: "加藤 美咲",
    fromEmail: "kato@example.com",
    subject: "アクリル枡の製作（ロゴ入り）",
    body: `お世話になります。
昨日はお電話で対応いただきありがとうございました。

NPO 団体の周年記念品としてアクリル枡を 160〜180 個ほど製作したいと考えております。

仕様:
- ロゴ入り（最終的にはイラレ入稿予定）
- 単価 800 円程度を目安に検討中

最終データ入稿前に、ロゴデザインを一旦確認いただきたく、共有リンクからアップしました。
黒い四角からモチーフが伸びているようなデザインなのですが、レーザー彫刻で再現可能でしょうか。

本発注前にご確認いただけますと幸いです。`,
    category: "アクリルプロダクト",
  },
  {
    fromName: "鈴木 大輔",
    fromEmail: "suzuki@example.com",
    subject: "全社総会の表彰用トロフィー制作（昨年に続き今年も）",
    body: `いつもお世話になっております。
昨年の 10 月頃にも依頼させていただきましたが、今年も全社総会を 10 月に予定しており、表彰用トロフィーの制作をお願いしたいと考えております。

参照: 過去納品事例 URL（tk_15 番）

ベースの形は変更なし、印字するデザインのみ変更予定です。

個数（受賞者数で前後しますが想定）:
- 大: 3〜4 個（予算 3 万円目安）
- 中: 4〜7 個（予算 2 万円目安）
- 小: 最大 10 個（予算 1.5 万円目安）

入稿期限と納期、最終的な概算見積もりをご教示ください。
よろしくお願いいたします。`,
    category: "トロフィー（オリジナル）",
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
  const categoryNames = CATEGORIES.map((c) => c.name);

  for (const i of INQUIRIES) {
    // 受信時の自動処理: メタ抽出 + カテゴリ分類
    const meta = await extractMetadata(i);
    const classifiedName = await classifyInquiry(i, categoryNames);

    const inq = await prisma.inquiry.create({
      data: {
        fromName: i.fromName,
        fromEmail: i.fromEmail,
        subject: i.subject,
        body: i.body,
        categoryId: classifiedName ? (categoryMap.get(classifiedName) ?? null) : null,
        budgetText: meta.budgetText,
        quantityText: meta.quantityText,
        summaryNote: meta.summaryNote,
        productRefs: meta.productRefs.length ? JSON.stringify(meta.productRefs) : null,
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
