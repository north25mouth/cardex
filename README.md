# Cardex

> 名刺を撮るだけ。Sheetsへの自動保存とGmailお礼メール下書き作成まで、ワンタップで完結。

## 技術スタック

- **Next.js 14** (App Router)
- **NextAuth.js** — Google OAuth 認証
- **Supabase** — ユーザー管理・スキャン回数トラッキング
- **Anthropic Claude Vision API** — 名刺OCR
- **Vercel** — ホスティング

## セットアップ手順

### 1. Supabase プロジェクトを作成

1. [supabase.com](https://supabase.com) でプロジェクトを作成
2. `supabase/schema.sql` の内容を **SQL Editor** で実行
3. **Settings > API** から以下をコピー：
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Google OAuth を設定

1. [console.cloud.google.com](https://console.cloud.google.com) でプロジェクトを作成
2. **APIs & Services > Credentials** で OAuth 2.0 クライアントIDを作成
3. 承認済みリダイレクトURIに追加：
   - `http://localhost:3000/api/auth/callback/google`（開発用）
   - `https://your-domain.vercel.app/api/auth/callback/google`（本番用）
4. クライアントID・シークレットをコピー

### 3. 環境変数を設定

`.env.local.example` をコピーして `.env.local` を作成：

```bash
cp .env.local.example .env.local
```

NEXTAUTH_SECRET は以下で生成：

```bash
openssl rand -base64 32
```

### 4. ローカルで起動

```bash
npm install
npm run dev
```

`http://localhost:3000` でアクセス

### 5. Vercel にデプロイ

```bash
npm i -g vercel
vercel
```

Vercel ダッシュボードの **Settings > Environment Variables** に
`.env.local` の全変数を追加してください。

---

## プラン設定

`lib/plans.ts` で変更できます：

| プラン  | 月スキャン上限 | 価格    |
|---------|---------------|---------|
| Free    | 10枚          | ¥0      |
| Starter | 100枚         | ¥980/月 |
| Pro     | 500枚         | ¥2,980/月|

ユーザーのプランを変更するには Supabase ダッシュボードから：

```sql
update users set plan = 'starter' where email = 'user@example.com';
```

---

## GAS（Google Apps Script）の設定

ユーザー自身が以下を設定します：

1. **`template/cardex_ja.xlsx`** を Google スプレッドシートで開く（または独自のシートを用意）
2. `script.google.com` で新しいプロジェクトを作成し、**`template/Code.gs`** の内容を貼り付けてデプロイ（**Webアプリ / 全員**）  
   - Cardex は **`action: "saveAndDraft"`** と **`sheetId`** で POST します
3. Cardex の **Configuration** に **GAS WebApp URL** と、スプレッドシートの **ブラウザ URL をそのまま**（コピペ）貼り付けて保存  
   - アプリ側で ID を抜き出します。GAS の `SHEET_ID` は空のままでも動作します

詳細は **`template/README.md`** を参照してください。

---

## ディレクトリ構成

```
cardex/
├── app/
│   ├── page.tsx              # メインUI
│   ├── page.module.css       # スタイル
│   ├── layout.tsx
│   ├── providers.tsx         # SessionProvider
│   ├── globals.css
│   └── api/
│       ├── auth/[...nextauth]/route.ts  # 認証
│       ├── ocr/route.ts                 # OCR + 回数制限
│       └── usage/route.ts              # 使用状況
├── lib/
│   ├── supabase.ts           # DB操作
│   └── plans.ts              # プラン定義
├── supabase/
│   └── schema.sql            # テーブル定義
├── template/
│   ├── cardex_ja.xlsx        # スプレッドシート雛形（日本語）
│   ├── Code.gs               # GAS 本体（Cardex と連携）
│   └── README.md
├── .env.local.example
└── README.md
```
