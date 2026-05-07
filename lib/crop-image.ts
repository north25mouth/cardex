import type { Area } from 'react-easy-crop'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    img.src = src
  })
}

/** 切り取り範囲を JPEG（base64）に焼き込む — Claude 送信用は image/jpeg 固定でよい */
export async function getCroppedImgAsJpeg(
  imageSrc: string,
  pixelCrop: Area,
  quality = 0.92
): Promise<{ dataUrl: string; base64: string }> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas が使えません')

  canvas.width = Math.max(1, Math.round(pixelCrop.width))
  canvas.height = Math.max(1, Math.round(pixelCrop.height))

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height
  )

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const base64 = dataUrl.split(',')[1]
  if (!base64) throw new Error('画像のエンコードに失敗しました')
  return { dataUrl, base64 }
}

/** 切り取りなしで全体を JPEG（base64）にする */
export async function getFullImageAsJpeg(
  imageSrc: string,
  quality = 0.92
): Promise<{ dataUrl: string; base64: string }> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas が使えません')

  const w = image.naturalWidth
  const h = image.naturalHeight
  if (!w || !h) throw new Error('画像のサイズを取得できません')

  canvas.width = w
  canvas.height = h
  ctx.drawImage(image, 0, 0)

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const base64 = dataUrl.split(',')[1]
  if (!base64) throw new Error('画像のエンコードに失敗しました')
  return { dataUrl, base64 }
}
