import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getUserByEmail } from '@/lib/supabase'
import { appendRow } from '@/lib/sheets'

async function createGmailDraft(accessToken: string, to: string, subject: string, body: string) {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`
  const encodedBody = Buffer.from(body).toString('base64')

  const message = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodedBody,
  ].join('\r\n')

  const raw = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw } }),
  })

  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error?.message || `Gmail API エラー (${res.status})`)
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const accessToken = (session as { accessToken?: string }).accessToken
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Google の権限がありません。一度ログアウトして再ログインしてください。', needsReauth: true },
      { status: 403 }
    )
  }

  let user
  try {
    user = await getUserByEmail(session.user.email)
  } catch (e) {
    console.error('[save] getUserByEmail error:', e)
    return NextResponse.json({ error: 'DB接続エラー: ' + (e instanceof Error ? e.message : String(e)) }, { status: 500 })
  }
  if (!user) {
    return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
  }

  let body: { fields: Record<string, string>; createGmailDraft: boolean; emailSubject: string; emailBody: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエストが不正です' }, { status: 400 })
  }

  const { fields, createGmailDraft: wantDraft, emailSubject, emailBody } = body

  const errors: string[] = []
  let sheets = false
  let draft = false

  if (!user.sheet_id) {
    errors.push('スプレッドシートが未設定です。一度ログアウトして再ログインしてください。')
  } else {
    try {
      const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
      await appendRow(accessToken, user.sheet_id, [
        now,
        fields.name    ?? '',
        fields.kana    ?? '',
        fields.company ?? '',
        fields.title   ?? '',
        fields.email   ?? '',
        fields.tel     ?? '',
        fields.mobile  ?? '',
        fields.address ?? '',
        fields.web     ?? '',
      ])
      sheets = true
    } catch (e) {
      console.error('[save] appendRow error:', e)
      errors.push(e instanceof Error ? e.message : 'Sheets 保存エラー')
    }
  }

  if (wantDraft && fields.email && emailSubject && emailBody) {
    try {
      await createGmailDraft(accessToken, fields.email, emailSubject, emailBody)
      draft = true
    } catch (e) {
      console.error('[save] createGmailDraft error:', e)
      errors.push(e instanceof Error ? e.message : 'Gmail 下書きエラー')
    }
  }

  if (errors.length > 0 && !sheets) {
    return NextResponse.json({ error: errors[0], errors }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sheets, draft, errors })
}
