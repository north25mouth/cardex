/** HEIC / HEIF（拡張子または MIME） */
export function isHeicLike(file: File): boolean {
  const t = (file.type || '').toLowerCase()
  if (t === 'image/heic' || t === 'image/heif') return true
  return /\.(heic|heif)$/i.test(file.name)
}

export function isSelectableImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  return isHeicLike(file)
}

/** Claude API 前にブラウザで扱える Blob へ（HEIC → JPEG） */
export async function prepareBlobForPreview(file: File): Promise<Blob> {
  if (isHeicLike(file)) {
    const heic2any = (await import('heic2any')).default
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    })
    const blob = Array.isArray(result) ? result[0] : result
    if (!blob) throw new Error('HEIC の変換に失敗しました')
    return blob
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('画像ファイルを選んでください')
  }
  return file
}
