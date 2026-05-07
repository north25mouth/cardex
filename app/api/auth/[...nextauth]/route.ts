import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth-options'

export const dynamic = 'force-dynamic'

const handler = NextAuth(authOptions)

/** App Router から確実に (req, context) で渡す（ビルド／バージョン差での undefined 回避） */
export async function GET(req: Request, context: { params: { nextauth: string[] } }) {
  return handler(req, context)
}

export async function POST(req: Request, context: { params: { nextauth: string[] } }) {
  return handler(req, context)
}
