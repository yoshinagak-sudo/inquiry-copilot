import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { generateDraft } from "../src/lib/llm";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

const CATEGORIES = [
  { name: "予約・利用方法", description: "予約方法・利用手順・キャンセル等" },
  { name: "料金・プラン", description: "時間貸し料金・月額プラン・法人契約" },
  { name: "設備・備品", description: "Wi-Fi・プロジェクター・備品関連" },
  { name: "アクセス・施設", description: "最寄り駅・駐車場・営業時間等" },
  { name: "イベント・撮影利用", description: "撮影・イベント・大型集客の利用" },
  { name: "採用", description: "求人・アルバイト" },
  { name: "その他", description: "上記以外の問い合わせ" },
];

const KNOWLEDGE = [
  {
    title: "予約・キャンセルポリシー",
    category: "予約・利用方法",
    body: `# 予約・キャンセルポリシー

## 予約方法
- Web 予約サイトから 24 時間受付
- 利用開始 30 分前まで予約可能
- 当日予約は 1 時間前まで（決済完了が必要）

## キャンセルポリシー
- 利用 7 日前まで: 無料キャンセル
- 6〜3 日前: 利用料金の 30%
- 2 日前〜前日: 50%
- 当日: 100%

法人契約の場合は別途条件あり、専用窓口までお問い合わせください。`,
  },
  {
    title: "料金プラン一覧",
    category: "料金・プラン",
    body: `# 料金プラン

## 時間貸し
- 4 名用個室: 1,500 円/時
- 8 名用会議室: 2,800 円/時
- 12 名用会議室: 4,200 円/時
- イベントスペース（最大 30 名）: 6,800 円/時

## 月額プラン
- スタンダード: 月 22,000 円（月 20 時間まで）
- ビジネス: 月 44,000 円（月 50 時間まで）
- 月超過分は時間貸し料金の 80%

## 法人契約
年間契約で 15% 割引、専用窓口および 24 時間利用が可能です。`,
  },
  {
    title: "設備・備品の標準装備",
    category: "設備・備品",
    body: `# 標準装備（全室共通）
- 高速 Wi-Fi（実測 200Mbps）
- プロジェクター（HDMI / USB-C / AirPlay 対応）
- 4K モニター 55 インチ（会議室）
- ホワイトボード
- 電源タップ（各席）
- 空調・空気清浄機

## 無料オプション備品
- マイク・スピーカー（要事前予約）
- ビデオ会議用カメラ
- 文具一式

## 持ち込み可能
PC、周辺機器、撮影機材はすべて持ち込みいただけます。`,
  },
  {
    title: "営業時間・アクセス",
    category: "アクセス・施設",
    body: `# 営業時間
- 平日: 7:00〜23:00
- 土日祝: 9:00〜22:00
- 年末年始休業（12/30〜1/3）

## 24 時間利用
法人契約の場合のみ、24 時間利用可能（鍵貸与）。

## アクセス
JR 各駅から徒歩 5 分以内の主要拠点に出店しております。

## 駐車場
ビル併設の有料駐車場をご利用いただけます（1 時間 600 円）。
4 時間以上のご利用で 2 時間分無料サービスがございます。`,
  },
  {
    title: "飲食物の持ち込みルール",
    category: "予約・利用方法",
    body: `# 飲食物の持ち込み

## 持ち込み可能
- ペットボトル飲料・コーヒー等
- 軽食・お弁当
- ケータリング（30 名以上は事前申請推奨）

## 制限事項
- アルコール類は会議室・個室では不可（イベントスペースのみ可）
- 強い臭いを発するもの（カレー・焼肉等）はご遠慮ください
- ゴミは原則お持ち帰りいただきます

## ケータリング
提携業者があり、Web 予約時にオプション選択いただけます。`,
  },
  {
    title: "イベント・撮影利用",
    category: "イベント・撮影利用",
    body: `# イベント・撮影でのご利用

## 撮影
- YouTube 配信・商品撮影など全般可
- 機材搬入は 30 分前から無料
- 大型機材搬入時は事前連絡をお願いします

## イベント
- セミナー・ワークショップ・交流会
- 30 名以上は事前打ち合わせ推奨
- 受付スタッフ派遣サービスあり（別料金）

## 注意事項
- 騒音を伴うイベントは事前申請必須
- 23 時以降の音出し不可（防音室除く）
- 設営・撤去時間は利用時間内に含まれます`,
  },
  {
    title: "法人契約の詳細",
    category: "料金・プラン",
    body: `# 法人契約

## 対象
月 30 時間以上のご利用、または継続的にご利用いただく企業様。

## 申込手順
1. 法人窓口（contact@sample-space.example）にメール
2. 担当より 2 営業日以内に折り返し
3. ヒアリング → お見積もり提示
4. 契約書締結（請求書月次払い）

## 法人特典
- 利用料金 15% 割引
- 24 時間利用可能（鍵貸与）
- 専用窓口・優先予約
- 月次利用レポート提供`,
  },
  {
    title: "採用情報",
    category: "採用",
    body: `# 採用情報

## 正社員
- 募集職種: 店舗運営マネージャー / マーケティング / IT エンジニア
- 応募方法: 採用ページ sample-space.example/recruit から

## アルバイト・パート
- 受付・施設管理スタッフ募集中
- 時給 1,200 円〜（経験により）
- シフト制、週 2 日〜
- 学生歓迎

## 業務委託
イベント運営・撮影サポートの業務委託も募集しております。`,
  },
  {
    title: "鍵の受け取り・退室方法",
    category: "予約・利用方法",
    body: `# 鍵・入退室

## 入室方法
- 予約完了メールに記載の **6 桁の暗証番号** で入室
- 入口・各部屋ともにスマートロック対応
- 利用開始 15 分前から入室可能

## 退室方法
- 利用時間終了までに退室をお願いします
- 退室時は備品の原状回復をご確認ください
- 物理鍵を貸与する場合（法人契約等）はオフィスに直接ご返却

## トラブル時
入室できない・備品故障等の緊急連絡先:
0120-XXX-XXX（24 時間対応）`,
  },
  {
    title: "団体・大人数での利用",
    category: "イベント・撮影利用",
    body: `# 大人数（30 名以上）でのご利用

## 対応スペース
- イベントスペース A: 最大 60 名
- イベントスペース B（複数室つなげて）: 最大 120 名

## 事前打ち合わせ
30 名以上のご利用は事前ヒアリングをお願いしています
（レイアウト・受付・備品確認のため、利用 1 週間前までにご連絡ください）。

## 追加サービス
- 受付スタッフ派遣
- ケータリング手配
- 看板・案内表示の制作
- 撮影・配信機材一式

これらは別料金にて承ります。お見積もりいたします。`,
  },
];

const INQUIRIES = [
  {
    fromName: "山田 太郎",
    fromEmail: "yamada@example.com",
    subject: "明日 10 名で会議室を借りたい",
    body: "明日午後 14:00〜17:00 で 10 名程度の会議でご利用したいのですが、空きはありますでしょうか。プロジェクターとホワイトボードは必須でお願いします。",
    category: "予約・利用方法",
  },
  {
    fromName: "鈴木 花子",
    fromEmail: "suzuki@startup.example",
    subject: "法人契約のプラン詳細を教えてください",
    body: "都内のスタートアップで、月に 60 時間ほど会議室・イベントスペースを利用したいと考えております。法人契約の料金体系と特典について詳しく教えていただけますでしょうか。",
    category: "料金・プラン",
  },
  {
    fromName: "高橋 一郎",
    fromEmail: "takahashi@example.com",
    subject: "予約のキャンセルについて",
    body: "5 日後の予約をキャンセルしたいのですが、キャンセル料がいくらかかるか教えてください。予約番号は RSV-2026-04-1832 です。",
    category: "予約・利用方法",
  },
  {
    fromName: "田中 美咲",
    fromEmail: "tanaka.misaki@example.com",
    subject: "Wi-Fi の速度と配信機材について",
    body: "オンライン配信を行うため、Wi-Fi の実測速度を教えてください。また、配信用カメラとマイクは備え付けがありますでしょうか？",
    category: "設備・備品",
  },
  {
    fromName: "佐藤 健",
    fromEmail: "sato@university.example.ac.jp",
    subject: "受付アルバイトの応募について",
    body: "都内の大学に通う 2 年生です。受付スタッフのアルバイトに興味があります。週 2 日〜とのことですが、テスト期間中にシフトを減らせるかなど、応募方法と条件を詳しく教えてください。",
    category: "採用",
  },
  {
    fromName: "渡辺 真由美",
    fromEmail: "watanabe@event-corp.example",
    subject: "50 名規模の社内イベントでの利用",
    body: "弊社の社内総会を 50 名規模で開催したいと考えております。プロジェクター・マイクの設備、ケータリング手配、受付スタッフ派遣の可否を教えてください。日程は来月の第 3 土曜日を希望します。",
    category: "イベント・撮影利用",
  },
  {
    fromName: "伊藤 翔",
    fromEmail: "ito@yt-channel.example",
    subject: "YouTube 撮影での利用は可能ですか",
    body: "YouTube チャンネル運営をしております。トーク番組形式の撮影で 4 時間ほど利用したいのですが、撮影機材の搬入や、機材設置のための事前入室は可能でしょうか？防音性能についても教えてください。",
    category: "イベント・撮影利用",
  },
  {
    fromName: "中村 久美子",
    fromEmail: "nakamura@example.com",
    subject: "23 時以降の利用について",
    body: "深夜帯にチームでの作業合宿を行いたいのですが、23 時以降も利用できるプランはありますでしょうか？個人での利用です。",
    category: "アクセス・施設",
  },
  {
    fromName: "小林 大輔",
    fromEmail: "kobayashi@example.com",
    subject: "飲食物の持ち込みについて",
    body: "セミナー利用で、参加者にお弁当とコーヒーを提供したいのですが、持ち込みは可能でしょうか？また、ケータリング業者を呼ぶ場合の手続きを教えてください。",
    category: "予約・利用方法",
  },
  {
    fromName: "加藤 さくら",
    fromEmail: "kato@example.com",
    subject: "駐車場の利用について",
    body: "車で訪問予定です。駐車場の有無、料金、最大で何台まで停められるか教えてください。半日利用の予定です。",
    category: "アクセス・施設",
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
