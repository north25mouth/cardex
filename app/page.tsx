'use client'
import { useSession, signIn, signOut } from 'next-auth/react'
import dynamic from 'next/dynamic'
import { useState, useEffect, useRef } from 'react'
import { isSelectableImageFile, prepareBlobForPreview } from '@/lib/heic'
import { getFullImageAsJpeg } from '@/lib/crop-image'
import styles from './page.module.css'

const ImageCropModal = dynamic(
  () => import('@/components/ImageCropModal').then((m) => m.ImageCropModal),
  { ssr: false }
)

// ── プラン表示バー ─────────────────────────────────────
function UsageBar({ onSheetId }: { onSheetId?: (id: string | null) => void }) {
  const [usage, setUsage] = useState<{
    planLabel: string; used: number; limit: number; remaining: number; percentage: number; sheetId: string | null
  } | null>(null)

  useEffect(() => {
    fetch('/api/usage').then(r => r.json()).then(data => {
      setUsage(data)
      onSheetId?.(data.sheetId ?? null)
    }).catch(() => {})
  }, [])

  if (!usage) return null

  return (
    <div className={styles.usageBar}>
      <span className={styles.usagePlan}>{usage.planLabel}</span>
      <div className={styles.usageTrack}>
        <div
          className={styles.usageFill}
          style={{
            width: `${Math.min(usage.percentage, 100)}%`,
            background: usage.percentage >= 90 ? 'var(--red)' : usage.percentage >= 70 ? 'var(--amber)' : 'var(--green)',
          }}
        />
      </div>
      <span className={styles.usageCount}>{usage.used} / {usage.limit}</span>
    </div>
  )
}

// ── ログイン画面 ───────────────────────────────────────
function LoginScreen() {
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has('error') && !params.has('callbackUrl')) return

    const err = params.get('error')
    if (err === 'OAuthSignin') {
      setAuthError(
        'Google ログインを開始できませんでした。Google Cloud の OAuth 設定と .env.local（GOOGLE_CLIENT_ID / SECRET、NEXTAUTH_URL のポート）を確認してください。'
      )
    } else if (err === 'AccessDenied') {
      setAuthError('ログインが拒否されました。')
    } else if (err === 'OAuthCallback') {
      const o = typeof window !== 'undefined' ? window.location.origin : ''
      setAuthError(
        `Google から戻ったあとの検証に失敗しました。① 常に同じURLで開く（.env.local の NEXTAUTH_URL と一致。localhost と 127.0.0.1 の混在は不可）。② Google Cloud の承認済みリダイレクト URI に「${o}/api/auth/callback/google」を追加。③ 当サイトの Cookie を削除するかシークレットウィンドウで再試行。④ 改善しない場合は .env.local に NEXTAUTH_DISABLE_PKCE=1 を追加して dev を再起動。ターミナルの [next-auth][error] に詳細が出ます。`
      )
    } else if (err) {
      setAuthError(`ログインに失敗しました（${err}）。`)
    }

    window.history.replaceState({}, '', window.location.pathname || '/')
  }, [])

  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginCard}>
        <div className={styles.loginLogo}>
          Cardex<span className={styles.logoDot} />
        </div>
        <h1 className={styles.loginTitle}>
          名刺を撮る。<br /><em>それだけでいい。</em>
        </h1>
        <p className={styles.loginDesc}>
          スキャンから名刺管理・お礼メール下書き作成まで、ワンタップで完結します。
        </p>
        <div className={styles.loginFeatures}>
          <div className={styles.loginFeature}><span className={styles.dot} />AI で名刺を自動読み取り</div>
          <div className={styles.loginFeature}><span className={styles.dot} />Google Sheets に自動保存</div>
          <div className={styles.loginFeature}><span className={styles.dot} />Gmail にお礼メール下書き作成</div>
        </div>
        {authError ? <p className={styles.loginError}>{authError}</p> : null}
        <button
          className={styles.googleBtn}
          onClick={() => signIn('google', { callbackUrl: '/' })}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google でログイン
        </button>
        <p className={styles.loginNote}>
          無料プラン：月10枚まで。データはあなたのGoogle Sheetsにのみ保存されます。
        </p>
      </div>
    </div>
  )
}

// ── メインアプリ ───────────────────────────────────────
type Fields = {
  name: string; kana: string; company: string; title: string
  email: string; tel: string; mobile: string; address: string; web: string
}
const EMPTY: Fields = { name:'', kana:'', company:'', title:'', email:'', tel:'', mobile:'', address:'', web:'' }

export default function Page() {
  const { data: session, status } = useSession()

  // State
  const [preview, setPreview]     = useState<string | null>(null)
  const [base64, setBase64]       = useState<string | null>(null)
  const [fields, setFields]       = useState<Fields>(EMPTY)
  const [step, setStep]           = useState<1|2|3>(1)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [ocrError, setOcrError]   = useState('')
  const [saveError, setSaveError] = useState('')
  const [saveOk, setSaveOk]       = useState('')
  const [sheetId, setSheetId]     = useState<string | null>(null)
  const [senderName, setSenderName] = useState('')
  const [emailSubject, setEmailSubject] = useState('先日はお世話になりました')
  const [emailTemplate, setEmailTemplate] = useState(
    '{name} 様\n\n先日はお目にかかれて大変光栄でした。\n改めてご挨拶申し上げます。\n\n引き続きよろしくお願い申し上げます。\n\n{senderName}'
  )
  const [createGmailDraft, setCreateGmailDraft] = useState(true)
  const [configOpen, setConfigOpen] = useState(false)
  const [formatMsg, setFormatMsg] = useState('')
  const [cropModalOpen, setCropModalOpen] = useState(false)
  /** 画像選択直後〜OCR前のプレビュー用 blob URL（このまま使う / 切り取る の選択中） */
  const [stagedImageUrl, setStagedImageUrl] = useState<string | null>(null)
  const blobObjectUrlRef = useRef<string | null>(null)
  const [imagePreparing, setImagePreparing] = useState(false)
  const [dragging, setDragging]   = useState(false)
  const [history, setHistory]     = useState<{name:string;company:string;time:string;ok:boolean}[]>([])
  const step2Ref = useRef<HTMLDivElement>(null)
  const step3Ref = useRef<HTMLDivElement>(null)

  // Load config from localStorage
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem('cardex_v4') || '{}')
      if (c.senderName)    setSenderName(c.senderName)
      if (c.emailSubject)  setEmailSubject(c.emailSubject)
      if (c.emailTemplate) setEmailTemplate(c.emailTemplate)
      if (typeof c.createGmailDraft === 'boolean') setCreateGmailDraft(c.createGmailDraft)
    } catch {}
  }, [])

  if (status === 'loading') return null
  if (!session) return <LoginScreen />

  // ── Handlers ──────────────────────────────────────────
  function saveConfig() {
    localStorage.setItem(
      'cardex_v4',
      JSON.stringify({ senderName, emailSubject, emailTemplate, createGmailDraft })
    )
    setConfigOpen(false)
  }

  function revokeBlobUrl() {
    if (blobObjectUrlRef.current) {
      URL.revokeObjectURL(blobObjectUrlRef.current)
      blobObjectUrlRef.current = null
    }
    setStagedImageUrl(null)
  }

  async function startImageImport(f: File | undefined) {
    if (!f || !isSelectableImageFile(f)) return
    revokeBlobUrl()
    setCropModalOpen(false)
    setOcrError('')
    setImagePreparing(true)
    try {
      const blob = await prepareBlobForPreview(f)
      const url = URL.createObjectURL(blob)
      blobObjectUrlRef.current = url
      setStagedImageUrl(url)
    } catch (e) {
      setOcrError(
        e instanceof Error
          ? e.message
          : '画像の読み込みに失敗しました。HEIC の場合は別ブラウザでも試してください。'
      )
    } finally {
      setImagePreparing(false)
    }
  }

  function handleCropCancel() {
    setCropModalOpen(false)
  }

  async function useStagedImageWithoutCrop() {
    if (!stagedImageUrl) return
    setOcrError('')
    try {
      const { dataUrl, base64 } = await getFullImageAsJpeg(stagedImageUrl)
      revokeBlobUrl()
      setPreview(dataUrl)
      setBase64(base64)
    } catch (e) {
      setOcrError(e instanceof Error ? e.message : '画像の変換に失敗しました')
    }
  }

  function openCropModal() {
    if (!stagedImageUrl) return
    setCropModalOpen(true)
  }

  function abandonStagedImage() {
    revokeBlobUrl()
    setCropModalOpen(false)
    setOcrError('')
  }

  function handleCropComplete(dataUrl: string, b64: string) {
    revokeBlobUrl()
    setCropModalOpen(false)
    setPreview(dataUrl)
    setBase64(b64)
  }

  function resetAll() {
    revokeBlobUrl()
    setCropModalOpen(false)
    setPreview(null)
    setBase64(null)
    setFields(EMPTY)
    setStep(1)
    setOcrError('')
    setSaveError('')
    setSaveOk('')
  }

  async function runOCR() {
    if (!base64) return
    setOcrLoading(true); setOcrError('')
    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: 'image/jpeg' }),
      })
      const data = await res.json()
      if (!res.ok) {
        // 回数上限エラーを分かりやすく表示
        if (res.status === 429) {
          setOcrError(`${data.error}${data.upgradeMessage ? `\n${data.upgradeMessage}` : ''}`)
        } else {
          setOcrError(data.error || 'OCR処理に失敗しました')
        }
        return
      }
      setFields(data.result)
      setStep(2)
      setTimeout(() => step2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch {
      setOcrError('通信エラーが発生しました')
    } finally {
      setOcrLoading(false)
    }
  }

  function buildBody() {
    return emailTemplate
      .replace(/\{name\}/g, fields.name || '（お名前）')
      .replace(/\{senderName\}/g, senderName)
  }

  function goStep3() {
    if (!fields.name) { setSaveError('氏名は必須です'); return }
    setSaveError(''); setSaveOk('')
    setStep(3)
    setTimeout(() => step3Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  async function saveAll(withDraft = createGmailDraft) {
    setSaveLoading(true); setSaveError(''); setSaveOk('')
    const body = buildBody()
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields,
          createGmailDraft: withDraft,
          emailSubject,
          emailBody: fields.email ? body : null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.status === 403 && json.needsReauth) {
        setSaveError('Google の権限がありません。一度ログアウトして再ログインしてください。')
        return
      }
      if (!res.ok) {
        setSaveError(json.error || '保存に失敗しました')
        return
      }
      if (json.errors?.length) {
        setSaveError(json.errors.join(' / '))
        return
      }
      const parts: string[] = []
      if (json.sheets) parts.push('Sheetsに保存しました')
      if (!createGmailDraft) {
        parts.push('Gmail下書きはオフ（設定）')
      } else if (json.draft) {
        parts.push('Gmailに下書きを作成しました — Gmailを開いて送信してください')
      } else if (!fields.email) {
        parts.push('メールアドレスなし — 下書き作成はスキップされました')
      }
      setSaveOk(parts.join(' · '))
      setHistory(h => [{ name: fields.name || '(unnamed)', company: fields.company, time: new Date().toLocaleTimeString('ja-JP', {hour:'2-digit',minute:'2-digit'}), ok: true }, ...h])
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '通信エラー'
      setSaveError(message)
    } finally {
      setSaveLoading(false)
    }
  }

  const emailBody = buildBody()

  // ── Render ────────────────────────────────────────────
  return (
    <div className={styles.wrap}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          Cardex<span className={styles.logoDot} />
        </div>
        <UsageBar onSheetId={setSheetId} />
        <div className={styles.headerRight}>
          {sheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.sheetLink}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              シートを開く
            </a>
          )}
          <img src={session.user?.image ?? ''} alt="" className={styles.avatar} />
          <button className={styles.signOutBtn} onClick={() => signOut()}>ログアウト</button>
        </div>
      </header>

      <div className={styles.shell}>
        {/* Page title */}
        <div className={styles.pageTitle}>
          <h2 className={styles.pageTitleH}>名刺を撮る。それだけでいい。</h2>
          <p className={styles.pageTitleSub}>スキャン → Sheets保存 → Gmailお礼メール下書き、ワンタップで完結</p>
        </div>

        {/* Config */}
        <div className={styles.config}>
          <button className={styles.configToggle} onClick={() => setConfigOpen(o => !o)}>
            <span className={styles.configLabel}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
              設定
            </span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{transform: configOpen ? 'rotate(180deg)' : 'none', transition:'0.2s'}}><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {configOpen && (
            <div className={styles.configBody}>
              <div className={styles.checkField}>
                <input
                  id="createGmailDraft"
                  type="checkbox"
                  checked={createGmailDraft}
                  onChange={(e) => setCreateGmailDraft(e.target.checked)}
                />
                <label className={styles.checkFieldLabel} htmlFor="createGmailDraft">
                  Gmail にお礼メールの下書きを作成する（オフにすると Sheets のみ保存）
                </label>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>差出人名</label>
                <input className={styles.input} value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="山田 太郎" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>件名</label>
                <input className={styles.input} value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>本文テンプレート — {'{name}'} と {'{senderName}'} が置換されます</label>
                <textarea className={styles.textarea} value={emailTemplate} onChange={e => setEmailTemplate(e.target.value)} rows={6} />
              </div>
              <button className={styles.btnPrimary} onClick={saveConfig}>保存する</button>
              <div style={{borderTop:'1px solid var(--rule)',paddingTop:'0.9rem',marginTop:'0.2rem'}}>
                <button
                  className={styles.btnGhost}
                  style={{fontSize:'11.5px'}}
                  onClick={async () => {
                    setFormatMsg('適用中...')
                    const res = await fetch('/api/format-sheet', { method: 'POST' })
                    const json = await res.json().catch(() => ({}))
                    setFormatMsg(res.ok ? '✓ デザインを適用しました' : (json.error || '失敗しました'))
                  }}
                >
                  スプレッドシートのデザインを適用する
                </button>
                {formatMsg && <p style={{fontSize:'11px',marginTop:'6px',color: formatMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)'}}>{formatMsg}</p>}
              </div>
            </div>
          )}
        </div>

        {/* STEP 1 */}
        <div className={styles.stepCard}>
          <div className={styles.stepHead}>
            <span className={styles.stepIdx}>01</span>
            <span className={styles.stepLabel}>名刺を撮影 / アップロード</span>
          </div>
          <div className={styles.stepBody}>
            {!preview && !stagedImageUrl ? (
              <div
                className={`${styles.dropZone} ${dragging ? styles.over : ''}`}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => {
                  e.preventDefault()
                  setDragging(false)
                  const f = e.dataTransfer.files[0]
                  if (f) void startImageImport(f)
                }}
                onClick={() => document.getElementById('fileInput')?.click()}
              >
                <input
                  id="fileInput"
                  type="file"
                  accept="image/*,.heic,.heif"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    void startImageImport(f)
                    e.target.value = ''
                  }}
                />
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{opacity:0.25,margin:'0 auto 12px',display:'block'}}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <div className={styles.dropPrimary}>
                  {imagePreparing ? '画像を読み込み中…' : '撮影 / 画像をここにドロップ'}
                </div>
                <div className={styles.dropSub}>JPG · PNG · WebP · GIF · HEIC（自動でJPEG化）</div>
              </div>
            ) : !preview && stagedImageUrl ? (
              <div>
                <img src={stagedImageUrl} alt="" className={styles.previewImg} />
                <p className={styles.dropSub} style={{ marginTop: '10px', textAlign: 'center' }}>
                  そのまま読み取るか、必要なら範囲を切り取ってから読み取れます。
                </p>
                <div className={styles.btnRow}>
                  <button type="button" className={styles.btnPrimary} onClick={() => void useStagedImageWithoutCrop()}>
                    このまま AI で読み取る
                  </button>
                  <button type="button" className={styles.btnGhost} onClick={openCropModal}>
                    範囲を切り取る
                  </button>
                  <button type="button" className={styles.btnGhost} onClick={abandonStagedImage}>
                    別の画像にする
                  </button>
                </div>
                {ocrError && <div className={styles.noticeErr}>{ocrError}</div>}
              </div>
            ) : preview ? (
              <div>
                <img src={preview} alt="" className={styles.previewImg} />
                <div className={styles.btnRow}>
                  <button className={styles.btnPrimary} onClick={runOCR} disabled={ocrLoading}>
                    {ocrLoading ? '解析中...' : 'AI で読み取る'}
                  </button>
                  <button className={styles.btnGhost} onClick={resetAll}>やり直す</button>
                </div>
                {ocrError && <div className={styles.noticeErr}>{ocrError}</div>}
              </div>
            ) : null}
          </div>
        </div>

        {/* STEP 2 */}
        {step >= 2 && (
          <div className={styles.stepCard} ref={step2Ref}>
            <div className={styles.stepHead}>
              <span className={styles.stepIdx}>02</span>
              <span className={styles.stepLabel}>読み取り内容を確認</span>
              <span className={styles.stepStatus}>誤認があれば修正してください</span>
            </div>
            <div className={styles.stepBody}>
              <div className={styles.ocrGrid}>
                {([['name','氏名'],['kana','フリガナ'],['company','会社名'],['title','役職']] as const).map(([k,l]) => (
                  <div key={k} className={styles.ocrField}>
                    <label className={styles.ocrLabel}>{l}</label>
                    <input className={styles.input} value={fields[k]} onChange={e => setFields(f => ({...f,[k]:e.target.value}))} />
                  </div>
                ))}
                <div className={styles.ocrField} style={{gridColumn:'1/-1'}}>
                  <label className={styles.ocrLabel}>メール</label>
                  <input className={styles.input} type="email" value={fields.email} onChange={e => setFields(f => ({...f,email:e.target.value}))} />
                </div>
                {([['tel','電話番号'],['mobile','携帯番号']] as const).map(([k,l]) => (
                  <div key={k} className={styles.ocrField}>
                    <label className={styles.ocrLabel}>{l}</label>
                    <input className={styles.input} value={fields[k]} onChange={e => setFields(f => ({...f,[k]:e.target.value}))} />
                  </div>
                ))}
                <div className={styles.ocrField} style={{gridColumn:'1/-1'}}>
                  <label className={styles.ocrLabel}>住所</label>
                  <input className={styles.input} value={fields.address} onChange={e => setFields(f => ({...f,address:e.target.value}))} />
                </div>
                <div className={styles.ocrField} style={{gridColumn:'1/-1'}}>
                  <label className={styles.ocrLabel}>Webサイト</label>
                  <input className={styles.input} value={fields.web} onChange={e => setFields(f => ({...f,web:e.target.value}))} />
                </div>
              </div>
              <div className={styles.btnRow}>
                <button className={styles.btnPrimary} onClick={() => saveAll(true)} disabled={saveLoading}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                  {saveLoading ? '処理中...' : '保存 & Gmail下書き作成'}
                </button>
                <button className={styles.btnGhost} onClick={() => saveAll(false)} disabled={saveLoading}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                  Sheetsのみ保存
                </button>
                <button className={styles.btnGhost} onClick={goStep3} disabled={saveLoading}>
                  メール内容を確認 →
                </button>
              </div>
              {saveOk && (
                <>
                  <div className={styles.noticeOk}>{saveOk}</div>
                  <div className={styles.btnRow}>
                    <button className={styles.btnPrimary} onClick={resetAll}>次の名刺をスキャン</button>
                  </div>
                </>
              )}
              {saveError && <div className={styles.noticeErr}>{saveError}</div>}
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step >= 3 && (
          <div className={styles.stepCard} ref={step3Ref}>
            <div className={styles.stepHead}>
              <span className={styles.stepIdx}>03</span>
              <span className={styles.stepLabel}>完了 — 3つ同時に実行します</span>
              <span className={styles.stepStatus}>送信前の最終確認</span>
            </div>
            <div className={styles.stepBody}>
              <div className={styles.emailMeta}>
                <div className={styles.emailMetaRow}><span className={styles.emailKey}>宛先</span><span>{fields.email || '(メールアドレスなし)'}</span></div>
                <div className={styles.emailMetaRow}><span className={styles.emailKey}>件名</span><span>{emailSubject}</span></div>
              </div>
              <pre className={styles.emailBody}>{emailBody}</pre>
              <div className={styles.noticeInfo}>
                このボタン1回で：<strong>① Sheetsに名刺を保存</strong>　<strong>② Gmailに下書きを作成</strong>（オン時）。
                下書きは<strong>ログイン中の Google アカウントの Gmail</strong> に作成されます。
                スプレッドシートも同じアカウントからアクセスできるものを指定してください。
              </div>
              <div className={styles.btnRow}>
                <button className={styles.btnPrimary} onClick={() => saveAll()} disabled={saveLoading}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                  {saveLoading ? '処理中...' : '実行する — 保存 & 下書き作成'}
                </button>
                <button className={styles.btnGhost} onClick={() => setStep(2)}>← 戻って修正する</button>
              </div>
              {saveOk && (
                <>
                  <div className={styles.noticeOk}>{saveOk}</div>
                  <div className={styles.btnRow}>
                    <button className={styles.btnPrimary} onClick={resetAll}>次の名刺をスキャン</button>
                  </div>
                </>
              )}
              {saveError && <div className={styles.noticeErr}>{saveError}</div>}
            </div>
          </div>
        )}

        <ImageCropModal
          imageSrc={cropModalOpen ? stagedImageUrl : null}
          open={cropModalOpen}
          onCancel={handleCropCancel}
          onComplete={handleCropComplete}
          onError={(msg) => setOcrError(msg)}
        />

        {/* Session log */}
        <div className={styles.stepCard} style={{marginTop:'1rem'}}>
          <div className={styles.stepHead}>
            <span className={styles.stepIdx} style={{opacity:0.4}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </span>
            <span className={styles.stepLabel}>今日のスキャン履歴</span>
            {history.length > 0 && <span className={styles.stepStatus}>{history.length}件</span>}
          </div>
          <div className={styles.stepBody}>
            {history.length === 0
              ? <div className={styles.histEmpty}>まだスキャンした名刺はありません</div>
              : history.map((h, i) => (
                <div key={i} className={styles.histItem}>
                  <div className={`${styles.histDot} ${h.ok ? styles.histOk : styles.histWarn}`} />
                  <span className={styles.histName}>{h.name}</span>
                  <span className={styles.histCo}>{h.company}</span>
                  <span className={styles.histTime}>{h.time}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}
