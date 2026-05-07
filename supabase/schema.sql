-- ============================================================
-- Cardex — Supabase テーブル定義
-- Supabase ダッシュボード > SQL Editor で実行してください
-- ============================================================

-- ── users テーブル ──────────────────────────────────────────
create table if not exists users (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  name       text,
  image      text,
  plan       text not null default 'free'  -- 'free' | 'starter' | 'pro'
             check (plan in ('free', 'starter', 'pro')),
  sheet_id   text,                          -- Google スプレッドシート ID（初回ログイン時に自動作成）
  created_at timestamptz not null default now()
);

-- ── scans テーブル ──────────────────────────────────────────
create table if not exists scans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  scanned_at timestamptz not null default now()
);

-- ── インデックス（月次集計を高速化） ─────────────────────────
create index if not exists scans_user_month
  on scans (user_id, scanned_at);

-- ── RLS（Row Level Security）を有効化 ──────────────────────
alter table users enable row level security;
alter table scans enable row level security;

-- service_role はRLSをバイパスするため、
-- バックエンドはservice_role keyを使用してアクセスします。
-- anon keyからの直接アクセスは全てブロックされます。
