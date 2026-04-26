# inquiry-copilot UI ワイヤーフレーム

## デザイントークン

- ベース背景: `bg-stone-50`（米の温かみを残しつつ業務系の落ち着き）
- カード: `bg-white border border-stone-200 shadow-sm rounded-lg`
- アクセント: 舞台ファームの深緑 `emerald-700` （primary）/ 稲穂アンバー `amber-500`（warn）
- テキスト: `text-stone-900` 主、`text-stone-600` 副、`text-stone-500` 補助
- フォーカスリング: `focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1`

### カテゴリ色マッピング（背景/枠/テキストの3点セット）
- 商品・購入 → `bg-amber-50 text-amber-800 border-amber-200`（米=黄土色）
- 配送・送料 → `bg-sky-50 text-sky-800 border-sky-200`（青）
- クレーム → `bg-rose-50 text-rose-800 border-rose-200`（赤）
- 採用 → `bg-emerald-50 text-emerald-800 border-emerald-200`（緑）
- ふるさと納税 → `bg-violet-50 text-violet-800 border-violet-200`（紫）
- その他 → `bg-stone-100 text-stone-700 border-stone-200`（グレー）

### ステータスバッジ
- new（未着手）  → `bg-stone-100 text-stone-700 ring-1 ring-stone-200`
- drafted（草案あり）→ `bg-amber-50 text-amber-700 ring-1 ring-amber-200`
- sent（送信済）→ `bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200`
- archived → `bg-stone-100 text-stone-500`

### 信頼度バッジ
- 高 (≥0.7) → `bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200`
- 中 (0.4-0.7) → `bg-amber-50 text-amber-700 ring-1 ring-amber-200`
- 低 (<0.4) → `bg-rose-50 text-rose-700 ring-1 ring-rose-200`

## 画面1: 受信箱 `/`
- AppHeader（sticky、3 リンク）
- ステータスサマリ 4 枚カード（合計 / new / drafted / sent）
- フィルタタブ（すべて / 未着手 / 草案あり / 送信済）— SSR `?status=` 切替
- リストテーブル（PC）/ カードリスト（モバイル）
  - 列: 差出人 + メール（2 行）/ 件名 / カテゴリバッジ / 信頼度（草案あれば）/ 受信（相対時刻）/ ステータス
  - 行クリック（Link）で詳細へ

## 画面2: 詳細 `/inquiries/[id]`
- 戻るリンク + 件名 H1 + ステータス
- 問い合わせカード（差出人 / 受信日時 / 本文 pre-wrap）
- 草案セクション（送信前）
  - 信頼度 / モデル / 引用ナレッジ件数
  - 引用ナレッジ折りたたみ（`<details>`）→ title + excerpt
  - textarea（編集可、初期値=草案、文字数カウンタ）
  - 「再生成」ボタン（confirm dialog）
  - 「送信する」ボタン → 30秒カウントダウン UI（プログレスバー + キャンセル）
- 送信済みセクション（送信後）
  - 「送信済み」ピル + 送信日時 + diffRatio %
  - 最終文面（pre-wrap）
- 候補生成トースト（送信成功後 7 秒で消える）

## 画面3: ナレッジ `/knowledge`
- 検索ボックス（タイトル部分一致）/ 「新規追加」ボタン
- リストテーブル
  - 列: タイトル / カテゴリ / 出典（manual/candidate ピル）/ 引用回数 / 最終利用 / 操作
  - 行クリックで編集モーダル
- モーダル（`<dialog>` 利用、Tailwind だけで装飾）
  - title / category select / body textarea（Markdown）
  - 削除ボタン（編集時のみ、別 confirm ダイアログ）

## 画面4: 候補レビュー `/knowledge/candidates`
- ステータスタブ（pending / approved / rejected）— SSR `?status=` 切替
- カードリスト（縦並び 1 列、md以上で 1 列固定で十分）
  - ヘッダ: タイトル + 「pending」ピル + 生成日時
  - 生成理由（`text-sm text-stone-600`）
  - 折りたたみ「ソース問い合わせを表示」（`<details>`）
  - 編集 textarea（タイトル / 本文）
  - フッター: 「却下」secondary + 「承認してナレッジ化」primary
- 状態切替後はリストから消える（reload）

## 共通レイアウト
- AppHeader: 左ロゴ「inquiry-copilot」+ 右3リンク。active な時は下線で強調
- Container: `max-w-7xl mx-auto px-4 md:px-8 py-6`
- フォントは system-ui 系（CSS で指定）

## アクセシビリティ
- `<a>` には clickable 領域を取り、`focus-visible` で ring 表示
- 全ボタン aria-label を付ける
- 動的に切替わる領域は `aria-live="polite"`（トースト・カウントダウン）
- 色だけで状態を判別させない（テキストラベル必須）
