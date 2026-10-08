import type { FFmpeg } from '@ffmpeg/ffmpeg'
import type { ConversionResult, QueueFile } from './files'
import { extension, formats, outputName } from './files'

let engine: FFmpeg | undefined
let loading: Promise<FFmpeg> | undefined

async function getEngine(): Promise<FFmpeg> {
  if (engine?.loaded) return engine
  if (loading) return loading
  loading = (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    const instance = new FFmpeg()
    let scriptURL: string | undefined
    try {
      const base = new URL(`${import.meta.env.BASE_URL}ffmpeg/`, window.location.href)
      const response = await fetch(new URL('ffmpeg-core.js', base))
      if (!response.ok) throw new Error('core unavailable')
      // Vite rejects dynamic imports of public assets in development.
      scriptURL = URL.createObjectURL(new Blob([await response.text()], { type: 'text/javascript' }))
      await instance.load({ coreURL: scriptURL, wasmURL: new URL('ffmpeg-core.wasm', base).href })
      engine = instance
      return instance
    } catch {
      instance.terminate()
      throw new Error('não foi possível carregar o conversor. verifique sua conexão e tente novamente.')
    } finally {
      if (scriptURL) URL.revokeObjectURL(scriptURL)
    }
  })()
  try {
    return await loading
  } finally {
    loading = undefined
  }
}

const mimeTypes: Record<string, string> = {
  jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac', flac: 'audio/flac',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska',
}

function isSameFormat(name: string, format: string): boolean {
  const inputFormat = extension(name)
  return (inputFormat === 'jpeg' ? 'jpg' : inputFormat) === format
}

export function conversionArgs(item: Pick<QueueFile, 'kind' | 'format'>, input: string, output: string): string[] {
  const { kind, format } = item
  if (!formats[kind].includes(format)) throw new Error('selecione um formato disponível.')
  const sameFormat = isSameFormat(input, format)
  const args = ['-i', input]
  if (kind === 'image') {
    args.push('-frames:v', '1')
    if (sameFormat) args.push('-c:v', 'copy')
    else if (format === 'jpg') args.push('-q:v', '2')
    else if (format === 'webp') args.push('-c:v', 'libwebp', '-quality', '85')
  } else if (kind === 'audio' || format === 'mp3') {
    args.push('-map', '0:a:0', '-vn')
    const codecs: Record<string, string[]> = {
      mp3: ['-c:a', 'libmp3lame', '-b:a', '192k'],
      wav: ['-c:a', 'pcm_s16le'], ogg: ['-c:a', 'libvorbis', '-q:a', '5'],
      aac: ['-c:a', 'aac', '-b:a', '192k'], flac: ['-c:a', 'flac'],
    }
    args.push(...(sameFormat ? ['-c:a', 'copy'] : codecs[format]))
  } else {
    args.push('-map', '0:v:0', '-map', '0:a:0?')
    if (sameFormat) args.push('-c', 'copy')
    else {
      args.push('-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-pix_fmt', 'yuv420p')
      args.push(...(format === 'webm'
        ? ['-c:v', 'libvpx', '-b:v', '1M', '-c:a', 'libvorbis']
        : ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-c:a', 'aac']))
    }
    if (format === 'mp4' || format === 'mov') args.push('-movflags', '+faststart')
  }
  return [...args, output]
}

export async function convertFile(item: QueueFile, onReady: () => void): Promise<ConversionResult> {
  const ffmpeg = await getEngine()
  onReady()
  const input = `input-${item.id}.${extension(item.file.name) || 'bin'}`
  const output = `output-${item.id}.${item.format}`
  try {
    const args = conversionArgs(item, input, output)
    await ffmpeg.writeFile(input, new Uint8Array(await item.file.arrayBuffer()))
    if (item.kind === 'image' && isSameFormat(input, item.format)) {
      // Image stream copy alone can succeed without decoding corrupt image data.
      const validation = await ffmpeg.exec(['-i', input, '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-'])
      if (validation !== 0) throw new Error('invalid image')
    }
    const code = await ffmpeg.exec(args)
    if (code !== 0) throw new Error('conversion failed')
    const data = await ffmpeg.readFile(output)
    if (typeof data === 'string' || data.byteLength === 0) throw new Error('empty output')
    const blob = new Blob([new Uint8Array(data)], { type: mimeTypes[item.format] })
    return { url: URL.createObjectURL(blob), name: outputName(item.file.name, item.format), size: blob.size }
  } catch {
    // A failed WASM execution can leave a loaded instance unusable.
    if (engine === ffmpeg) engine = undefined
    ffmpeg.terminate()
    throw new Error(item.kind === 'video' && item.format === 'mp3'
      ? 'não foi possível extrair o áudio. confira se o vídeo tem uma faixa de áudio.'
      : 'não foi possível converter este arquivo. ele pode estar corrompido ou usar um codec incompatível.')
  } finally {
    if (ffmpeg.loaded) await Promise.allSettled([ffmpeg.deleteFile(input), ffmpeg.deleteFile(output)])
  }
}
