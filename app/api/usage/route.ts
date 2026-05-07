import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getUserByEmail, getMonthlyScans } from '@/lib/supabase'
import { getPlanLimit, PLANS } from '@/lib/plans'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await getUserByEmail(session.user.email)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const used  = await getMonthlyScans(user.id)
  const limit = getPlanLimit(user.plan)

  return NextResponse.json({
    plan: user.plan,
    planLabel: PLANS[user.plan].label,
    used,
    limit,
    remaining: limit - used,
    percentage: Math.round((used / limit) * 100),
    sheetId: user.sheet_id ?? null,
  })
}
