/**
 * Google スプレッドシートの共有 URL または ID 文字列からスプレッドシート ID を取り出す
 */
export function extractSpreadsheetId(input: string): string | null {
  const t = input.trim()
  if (!t) return null

  const fromUrl = t.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (fromUrl) return fromUrl[1]

  // URL なしで ID だけ貼られた場合（英数字と - _ のみ）
  if (/^[a-zA-Z0-9_-]+$/.test(t) && t.length >= 20) return t

  return null
}
