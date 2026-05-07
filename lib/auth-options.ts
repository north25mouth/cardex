import type { NextAuthOptions } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import GoogleProvider from 'next-auth/providers/google'
import { upsertUser, saveSheetId } from '@/lib/supabase'
import { createCardexSpreadsheet } from '@/lib/sheets'

const googleChecks =
  process.env.NEXTAUTH_DISABLE_PKCE === '1' ||
  process.env.NEXTAUTH_DISABLE_PKCE === 'true'
    ? (['state'] as const)
    : (['pkce', 'state'] as const)

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === 'development',

  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      checks: [...googleChecks],
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/gmail.compose',
          ].join(' '),
        },
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      try {
        const dbUser = await upsertUser(user.email!, user.name ?? null, user.image ?? null)
        if (!dbUser.sheet_id && account?.access_token) {
          const sheetId = await createCardexSpreadsheet(account.access_token)
          await saveSheetId(dbUser.id, sheetId)
        }
        return true
      } catch {
        return false
      }
    },

    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },

    async session({ session, token }) {
      ;(session as { accessToken?: string }).accessToken = (token as JWT & { accessToken?: string }).accessToken
      return session
    },
  },

  pages: {
    signIn: '/',
  },
}
