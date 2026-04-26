# inquiry-copilot 引き継ぎ

## 何をするシステムか
サンプル農園の問い合わせメールに対して、AIがナレッジベースから返信草案を生成し、人間が編集→ワンクリック送信する仕組み。送信内容を学習してナレッジ候補を提案する自動更新ループ付き。

## 現状（2026-04-26 デモ完成）
- Next.js **16.2.4** + React 19 + Tailwind v4 + Prisma **7.8.0**(SQLite) + better-sqlite3 adapter で構築
- メール受信は **シードデータでモック化**（問い合わせ10件＋ナレッジ10件＋カテゴリ6件）
- 送信は **モック（DB に sent フラグを立てるだけ）**、実送信はしない（30秒キャンセル可カウントダウン UI 実装済み）
- LLM は **`src/lib/llm.ts` で抽象化**。`ANTHROPIC_API_KEY` 未設定時は bigram マッチでナレッジ抽出するモック草案を返す
- 4画面実装済み: 受信箱 / 詳細・送信 / ナレッジ管理 / 候補レビュー
- フルループ動作確認済み（受信→草案→編集→30秒送信→候補化→承認→ナレッジ昇格）

## アーキテクチャ
- DB: SQLite（`prisma/dev.db`）。本番化時に Postgres + pgvector へ移行する前提
- ナレッジ: DB に `KnowledgeArticle` として保存。デモ規模（〜20件）では全件をプロンプトに詰める方式
- 草案生成: 受信メール + 全ナレッジを Claude に渡し、引用元IDと信頼度を JSON で返させる
- ナレッジ自動更新: 送信時に「草案 vs 最終文面」の diff が一定以上なら `KnowledgeCandidate` を生成。同種カテゴリ N 回でも候補化。承認で `KnowledgeArticle` に昇格

## データモデル（主要）
- `Inquiry` 受信メール
- `DraftReply` AI生成草案（信頼度・引用ナレッジID配列を保持）
- `SentReply` 送信済み返信（編集後の最終文面）
- `KnowledgeArticle` 確定ナレッジ（Markdown）
- `KnowledgeCandidate` 自動生成された候補（要承認）
- `Category` 問い合わせ分類タグ
- `AuditLog` 操作ログ

## API 境界
- `GET  /api/inquiries` 一覧
- `GET  /api/inquiries/:id` 詳細＋草案
- `POST /api/inquiries/:id/regenerate` 草案再生成
- `POST /api/inquiries/:id/send` 送信（モック）
- `GET/POST/PUT/DELETE /api/knowledge` ナレッジCRUD
- `GET  /api/knowledge/candidates` 候補一覧
- `POST /api/knowledge/candidates/:id/approve` 候補承認
- `POST /api/knowledge/candidates/:id/reject` 候補却下

## 落とし穴・決定事項
- **API キー未登録**: `claude-anthropic-api-key` は Keychain 未登録。デモはモックで動く。本物に切り替える時は secretary 経由で登録 → `.env.local` に展開
- **完全自動更新は禁止**: ナレッジ更新は必ず人間承認ゲートを通す（毒入り学習防止）
- **送信はモック**: 実送信は Phase 2 で Gmail API + 30秒取消ウィンドウを実装する
- **Turbopack 不使用**: パスは英語のみだが念のため `next dev` で運用

## 動作確認
```bash
cd /Users/butaifarm/Desktop/system-dev/inquiry-copilot
pnpm prisma migrate dev --name init
pnpm tsx prisma/seed.ts
pnpm dev
# http://localhost:3000
```

## 次の一手
- ANTHROPIC_API_KEY を Keychain `claude-anthropic-api-key` に登録すれば、自動で Claude 草案生成に切替（モックフォールバック削除不要）
- Phase 2: Gmail API 実接続（OAuth + Pub/Sub watch）
- Phase 2: 実送信（Gmail API messages.send + 取消キュー）

## 起動方法
```bash
cd /Users/butaifarm/Desktop/system-dev/inquiry-copilot
pnpm dev   # http://localhost:3001（3000 は他プロセスが使用中）
```
DB 初期化やり直し:
```bash
pnpm prisma migrate reset --force
pnpm tsx prisma/seed.ts
```

## 残タスク（Phase 2 以降）
- Gmail API + Pub/Sub による実受信
- 30秒取消ウィンドウ付き実送信
- pgvector でベクトル検索
- Slack 高信頼度ワンタップ承認
- NextAuth + Google ドメイン制限
