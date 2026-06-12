import { createCanvas, registerFont } from 'canvas'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'public/icons')
const fontPath = '/System/Library/Fonts/STHeiti Medium.ttc'
const RED = '#ff2442'

mkdirSync(outDir, { recursive: true })
registerFont(fontPath, { family: 'HeitiSC' })

for (const size of [16, 48, 128]) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = RED
  ctx.fillRect(0, 0, size, size)

  const fontSize = Math.max(10, Math.round(size * 0.62))
  ctx.fillStyle = '#ffffff'
  ctx.font = `600 ${fontSize}px HeitiSC`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('抄', size / 2, size / 2 + size * 0.02)

  const buffer = canvas.toBuffer('image/png')
  const filePath = join(outDir, `icon-${size}.png`)
  writeFileSync(filePath, buffer)
  console.info(`[RedCopy] 已生成 ${filePath} (${size}x${size})`)
}
