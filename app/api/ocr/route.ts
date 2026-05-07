import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import Anthropic from '@anthropic-ai/sdk'
import {
  getUserByEmail,
  getMonthlyScans,
  recordScan,
} from '@/lib/supabase'
import { getPlanLimit } from '@/lib/plans'

export async function POST(req: NextRequest) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  })
  // ── 1. 認証チェック ──────────────────────────────────
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  // ── 2. ユーザー取得 ──────────────────────────────────
  let user
  try {
    user = await getUserByEmail(session.user.email)
  } catch (e) {
    console.error('[OCR] getUserByEmail error:', e)
    return NextResponse.json({ error: 'DB接続エラー: ' + (e instanceof Error ? e.message : String(e)) }, { status: 500 })
  }
  if (!user) {
    return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
  }

  // ── 3. 回数制限チェック ──────────────────────────────
  let used: number
  try {
    used  = await getMonthlyScans(user.id)
  } catch (e) {
    console.error('[OCR] getMonthlyScans error:', e)
    return NextResponse.json({ error: 'DB接続エラー: ' + (e instanceof Error ? e.message : String(e)) }, { status: 500 })
  }
  const limit = getPlanLimit(user.plan)

  if (used >= limit) {
    return NextResponse.json(
      {
        error: '今月のスキャン上限に達しました',
        used,
        limit,
        plan: user.plan,
        upgradeMessage: user.plan === 'free'
          ? 'Starterプラン（月100枚・¥980）にアップグレードすると続けて使えます'
          : user.plan === 'starter'
          ? 'Proプラン（月500枚・¥2,980）にアップグレードできます'
          : null,
      },
      { status: 429 }
    )
  }

  // ── 4. リクエストボディのバリデーション ─────────────
  let body: { imageBase64: string; mediaType: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエストが不正です' }, { status: 400 })
  }

  const { imageBase64, mediaType } = body
  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: '画像データが必要です' }, { status: 400 })
  }

  // ── 5. Claude Vision API呼び出し ────────────────────
  let result: Record<string, string>
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `この名刺画像から情報を読み取り、以下のJSON形式のみで返答してください。前置き不要。
{
  "name": "氏名",
  "kana": "フリガナ（不明なら空文字）",
  "company": "会社名",
  "title": "役職",
  "email": "メールアドレス",
  "tel": "電話番号",
  "mobile": "携帯番号",
  "address": "住所",
  "web": "WebサイトURL"
}
情報がない項目は空文字。JSONのみ返してください。`,
            },
          ],
        },
      ],
    })

    const raw = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('JSONパースに失敗しました')
    result = JSON.parse(match[0])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'OCR処理に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // ── 6. スキャン回数を記録 ────────────────────────────
  await recordScan(user.id)

  // ── 7. 使用状況と結果を返す ──────────────────────────
  return NextResponse.json({
    result,
    usage: {
      used: used + 1,
      limit,
      plan: user.plan,
      remaining: limit - (used + 1),
    },
  })
}
