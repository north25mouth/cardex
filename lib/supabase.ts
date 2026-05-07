import { createClient } from '@supabase/supabase-js'
import type { Plan } from './plans'

// ── ブラウザ用（anon key） ──────────────────────────────
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── サーバー用（service role key / RLSをバイパス） ──────
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    },
  })
}

// ── 型定義 ─────────────────────────────────────────────
export interface DbUser {
  id: string
  email: string
  name: string | null
  image: string | null
  plan: Plan
  sheet_id: string | null
  created_at: string
}

export interface DbScan {
  id: string
  user_id: string
  scanned_at: string
}

// ── ユーザーをupsert（初回ログイン時に自動作成） ────────
export async function upsertUser(email: string, name: string | null, image: string | null) {
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('users')
    .upsert({ email, name, image }, { onConflict: 'email' })
    .select()
    .single()

  if (error) throw error
  return data as DbUser
}

// ── ユーザー取得 ───────────────────────────────────────
export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const admin = supabaseAdmin()
  const { data } = await admin
    .from('users')
    .select('*')
    .eq('email', email)
    .single()
  return data as DbUser | null
}

// ── 今月のスキャン回数を取得 ───────────────────────────
export async function getMonthlyScans(userId: string): Promise<number> {
  const admin = supabaseAdmin()
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count } = await admin
    .from('scans')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('scanned_at', startOfMonth.toISOString())

  return count ?? 0
}

// ── シートIDを保存 ────────────────────────────────────
export async function saveSheetId(userId: string, sheetId: string) {
  const admin = supabaseAdmin()
  const { error } = await admin
    .from('users')
    .update({ sheet_id: sheetId })
    .eq('id', userId)
  if (error) throw error
}

// ── スキャン記録を追加 ─────────────────────────────────
export async function recordScan(userId: string) {
  const admin = supabaseAdmin()
  const { error } = await admin
    .from('scans')
    .insert({ user_id: userId, scanned_at: new Date().toISOString() })
  if (error) throw error
}
