import { createCanvas } from 'canvas'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'public/icons')
const RED = '#ff2442'

mkdirSync(outDir, { recursive: true })

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  const unit = size / 128

  ctx.fillStyle = RED
  roundedRect(ctx, 0, 0, size, size, 22 * unit)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  roundedRect(ctx, 35 * unit, 26 * unit, 60 * unit, 76 * unit, 8 * unit)
  ctx.fill()

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  roundedRect(ctx, 25 * unit, 35 * unit, 60 * unit, 76 * unit, 8 * unit)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  roundedRect(ctx, 32 * unit, 20 * unit, 60 * unit, 76 * unit, 8 * unit)
  ctx.fill()

  ctx.strokeStyle = RED
  ctx.lineWidth = Math.max(1.5, 6 * unit)
  ctx.lineCap = 'round'
  for (const y of [43, 59, 75]) {
    ctx.beginPath()
    ctx.moveTo(45 * unit, y * unit)
    ctx.lineTo(78 * unit, y * unit)
    ctx.stroke()
  }

  return canvas
}

for (const size of [16, 48, 128]) {
  const filePath = join(outDir, `icon-${size}.png`)
  writeFileSync(filePath, drawIcon(size).toBuffer('image/png'))
  console.info(`[RedCopy] Generated ${filePath} (${size}x${size})`)
}
