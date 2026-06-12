import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const distDir = join(root, 'dist')
const manifest = JSON.parse(readFileSync(join(distDir, 'manifest.json'), 'utf8'))
const version = manifest.version ?? '1.0.0'
const zipName = `薯薯小抄-v${version}.zip`
const zipPath = join(root, zipName)

execSync(`cd "${distDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' })

console.info(`\n✅ 打包完成: ${zipPath}`)
console.info('上传到 Chrome 网上应用店时，选择此 zip 文件即可。')
