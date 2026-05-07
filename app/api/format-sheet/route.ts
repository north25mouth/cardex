import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getUserByEmail } from '@/lib/supabase'
import { applySpreadsheetFormat } from '@/lib/sheets'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const accessToken = (session as { accessToken?: string }).accessToken
  if (!accessToken) {
    return NextResponse.json({ error: '再ログインが必要です', needsReauth: true }, { status: 403 })
  }

  let user
  try {
    user = await getUserByEmail(session.user.email)
  } catch (e) {
    return NextResponse.json({ error: 'DB接続エラー' }, { status: 500 })
  }

  if (!user?.sheet_id) {
    return NextResponse.json({ error: 'スプレッドシートが未設定です' }, { status: 404 })
  }

  try {
    await applySpreadsheetFormat(accessToken, user.sheet_id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'フォーマット適用に失敗しました' }, { status: 500 })
  }
}
