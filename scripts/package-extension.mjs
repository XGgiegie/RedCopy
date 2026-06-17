import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { platform } from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const distDir = join(root, 'dist')
const manifest = JSON.parse(readFileSync(join(distDir, 'manifest.json'), 'utf8'))
const version = manifest.version ?? '1.0.0'
const zipName = `redcopy-v${version}.zip`
const zipPath = join(root, zipName)

rmSync(zipPath, { force: true })

if (platform === 'win32') {
  execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      "$ErrorActionPreference = 'Stop'; Compress-Archive -Path (Join-Path $env:DIST_DIR '*') -DestinationPath $env:ZIP_PATH -Force",
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        DIST_DIR: distDir,
        ZIP_PATH: zipPath,
      },
    },
  )
} else {
  execFileSync('zip', ['-r', zipPath, '.'], { cwd: distDir, stdio: 'inherit' })
}

console.info(`\n[RedCopy] Package created: ${zipPath}`)
