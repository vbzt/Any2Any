import { copyFile, mkdir } from 'node:fs/promises'

for (const [packageName, folder, files] of [
  ['core', '', ['ffmpeg-core.js', 'ffmpeg-core.wasm']],
  ['core-mt', 'mt/', ['ffmpeg-core.js', 'ffmpeg-core.wasm', 'ffmpeg-core.worker.js']],
]) {
  const destination = new URL(`../public/ffmpeg/${folder}`, import.meta.url)
  await mkdir(destination, { recursive: true })
  await Promise.all(files.map(name => copyFile(
    new URL(`../node_modules/@ffmpeg/${packageName}/dist/esm/${name}`, import.meta.url),
    new URL(name, destination),
  )))
}
