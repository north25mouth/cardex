export const SHEET_NAME = '名刺リスト'
export const SHEET_HEADERS = [
  '登録日', '氏名', 'フリガナ', '会社名', '役職',
  'メール', '電話番号', '携帯番号', '住所', 'Webサイト',
]

const COL_WIDTHS = [140, 100, 100, 160, 120, 220, 120, 120, 260, 200]

/** 既存スプレッドシートにデザインを適用する */
export async function applySpreadsheetFormat(accessToken: string, spreadsheetId: string) {
  // シートのタブIDを取得
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!metaRes.ok) {
    const e = await metaRes.json().catch(() => ({}))
    throw new Error(e.error?.message || 'シート情報の取得に失敗しました')
  }
  const meta = await metaRes.json()
  const tab = (meta.sheets as { properties: { title: string; sheetId: number } }[])
    .find(s => s.properties.title === SHEET_NAME)
  if (!tab) throw new Error(`「${SHEET_NAME}」タブが見つかりません`)
  const sheetId = tab.properties.sheetId

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          // 先頭行を固定
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
              fields: 'gridProperties.frozenRowCount',
            },
          },
          // ヘッダー行: ダーク背景 + 白太字
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.10, green: 0.10, blue: 0.10 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                    fontSize: 10,
                    fontFamily: 'Arial',
                  },
                  verticalAlignment: 'MIDDLE',
                  padding: { top: 8, bottom: 8, left: 10, right: 10 },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,padding)',
            },
          },
          // データ行フォント・余白
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 1, endRowIndex: 1000 },
              cell: {
                userEnteredFormat: {
                  textFormat: { fontSize: 10, fontFamily: 'Arial' },
                  verticalAlignment: 'MIDDLE',
                  padding: { top: 6, bottom: 6, left: 10, right: 10 },
                },
              },
              fields: 'userEnteredFormat(textFormat,verticalAlignment,padding)',
            },
          },
          // 縞模様
          {
            addBanding: {
              bandedRange: {
                range: { sheetId, startRowIndex: 1, endRowIndex: 1000 },
                rowProperties: {
                  firstBandColor: { red: 1, green: 1, blue: 1 },
                  secondBandColor: { red: 0.97, green: 0.97, blue: 0.97 },
                },
              },
            },
          },
          // ヘッダー行の高さ
          {
            updateDimensionProperties: {
              range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
              properties: { pixelSize: 36 },
              fields: 'pixelSize',
            },
          },
          // データ行の高さ
          {
            updateDimensionProperties: {
              range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 1000 },
              properties: { pixelSize: 30 },
              fields: 'pixelSize',
            },
          },
          // 列幅
          ...COL_WIDTHS.map((px, i) => ({
            updateDimensionProperties: {
              range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
              properties: { pixelSize: px },
              fields: 'pixelSize',
            },
          })),
        ],
      }),
    }
  )
}

/** スプレッドシートを新規作成してIDを返す */
export async function createCardexSpreadsheet(accessToken: string): Promise<string> {
  // 1. スプレッドシート作成
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: 'Cardex — 名刺管理' },
      sheets: [{ properties: { title: SHEET_NAME, gridProperties: { frozenRowCount: 1 } } }],
    }),
  })

  if (!createRes.ok) {
    const e = await createRes.json().catch(() => ({}))
    throw new Error(e.error?.message || 'スプレッドシートの作成に失敗しました')
  }

  const { spreadsheetId, sheets } = await createRes.json()
  const sheetId: number = sheets[0].properties.sheetId

  // 2. ヘッダー行を書き込む
  const range = encodeURIComponent(`${SHEET_NAME}!A1`)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [SHEET_HEADERS] }),
    }
  )

  // 3. デザイン適用（batchUpdate）
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          // ヘッダー行: ダーク背景 + 白太字
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.10, green: 0.10, blue: 0.10 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                    fontSize: 10,
                    fontFamily: 'Arial',
                  },
                  verticalAlignment: 'MIDDLE',
                  padding: { top: 8, bottom: 8, left: 10, right: 10 },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,padding)',
            },
          },
          // データ行: フォント・行の高さ
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 1, endRowIndex: 1000 },
              cell: {
                userEnteredFormat: {
                  textFormat: { fontSize: 10, fontFamily: 'Arial' },
                  verticalAlignment: 'MIDDLE',
                  padding: { top: 6, bottom: 6, left: 10, right: 10 },
                },
              },
              fields: 'userEnteredFormat(textFormat,verticalAlignment,padding)',
            },
          },
          // 偶数行に薄いグレー背景
          {
            addBanding: {
              bandedRange: {
                bandedRangeId: 1,
                range: { sheetId, startRowIndex: 1, endRowIndex: 1000 },
                rowProperties: {
                  headerColor: { red: 0.10, green: 0.10, blue: 0.10 },
                  firstBandColor: { red: 1, green: 1, blue: 1 },
                  secondBandColor: { red: 0.97, green: 0.97, blue: 0.97 },
                },
              },
            },
          },
          // ヘッダー行の高さ
          {
            updateDimensionProperties: {
              range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
              properties: { pixelSize: 36 },
              fields: 'pixelSize',
            },
          },
          // データ行の高さ
          {
            updateDimensionProperties: {
              range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 1000 },
              properties: { pixelSize: 30 },
              fields: 'pixelSize',
            },
          },
          // 列幅
          ...COL_WIDTHS.map((px, i) => ({
            updateDimensionProperties: {
              range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
              properties: { pixelSize: px },
              fields: 'pixelSize',
            },
          })),
          // シート全体のデフォルトフォント
          {
            updateSpreadsheetProperties: {
              properties: {
                defaultFormat: {
                  textFormat: { fontFamily: 'Arial', fontSize: 10 },
                },
              },
              fields: 'defaultFormat.textFormat',
            },
          },
        ],
      }),
    }
  )

  return spreadsheetId as string
}

/** シートに1行追記する */
export async function appendRow(accessToken: string, sheetId: string, row: string[]) {
  const range = encodeURIComponent(`${SHEET_NAME}!A:J`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [row] }),
  })

  if (res.ok) return

  if (res.status === 400) {
    const addSheet = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }),
      }
    )
    if (!addSheet.ok) {
      const e = await addSheet.json().catch(() => ({}))
      throw new Error(e.error?.message || 'シートの作成に失敗しました')
    }
    await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [SHEET_HEADERS] }),
    })
    const retry = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] }),
    })
    if (!retry.ok) {
      const e = await retry.json().catch(() => ({}))
      throw new Error(e.error?.message || 'Sheets 保存に失敗しました')
    }
    return
  }

  const e = await res.json().catch(() => ({}))
  throw new Error(e.error?.message || `Sheets API エラー (${res.status})`)
}
