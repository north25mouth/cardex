'use client'

import { useState, useCallback, useEffect } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { getCroppedImgAsJpeg } from '@/lib/crop-image'
import styles from './ImageCropModal.module.css'

type Props = {
  imageSrc: string | null
  open: boolean
  onCancel: () => void
  onComplete: (dataUrl: string, base64: string) => void
  onError?: (message: string) => void
}

export function ImageCropModal({ imageSrc, open, onCancel, onComplete, onError }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  useEffect(() => {
    if (!imageSrc) return
    setZoom(1)
    setCrop({ x: 0, y: 0 })
    setCroppedAreaPixels(null)
  }, [imageSrc])

  async function handleConfirm() {
    if (!imageSrc || !croppedAreaPixels) return
    setBusy(true)
    try {
      const { dataUrl, base64 } = await getCroppedImgAsJpeg(imageSrc, croppedAreaPixels)
      onComplete(dataUrl, base64)
    } catch (e) {
      onError?.(e instanceof Error ? e.message : '切り取りに失敗しました')
    } finally {
      setBusy(false)
    }
  }

  if (!open || !imageSrc) return null

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="crop-title">
      <div className={styles.modal}>
        <p id="crop-title" className={styles.title}>
          必要な範囲だけ切り取り
        </p>
        <p className={styles.hint}>
          スライダーで拡大してから範囲を合わせ、「この範囲で使う」で確定します。戻る場合はキャンセルでプレビューに戻れます。
        </p>
        <div className={styles.cropWrap}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className={styles.zoomRow}>
          <span>拡大</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.02}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="拡大スライダー"
          />
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={onCancel} disabled={busy}>
            キャンセル
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleConfirm} disabled={busy}>
            {busy ? '処理中…' : 'この範囲で使う'}
          </button>
        </div>
      </div>
    </div>
  )
}
