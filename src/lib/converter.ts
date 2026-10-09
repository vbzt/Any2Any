import type { FFmpeg } from '@ffmpeg/ffmpeg'
import type { ConversionResult, QueueFile } from './files'
import { extension, formats, outputName } from './files'

interface LoadedEngine {
  ffmpeg: FFmpeg
  mode: 'single' | 'multi'
  scriptURL: string
  threads: number
}

export interface MediaStream {
  codec_type: string
  codec_name: string
  pix_fmt?: string
}

interface ConversionOptions {
  streams?: MediaStream[]
  threads?: number
  forceTranscode?: boolean
}

class ConversionError extends Error {}
class CopyError extends ConversionError {}

let engine: LoadedEngine | undefined
let loading: Promise<LoadedEngine> | undefined
let multithreadDisabled = false

function canUseMultithread(): boolean {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return !multithreadDisabled && globalThis.crossOriginIsolated
    && typeof SharedArrayBuffer !== 'undefined'
    && navigator.hardwareConcurrency >= 4 && (memory === undefined || memory >= 4)
}

function discardEngine(current: LoadedEngine) {
  if (engine === current) engine = undefined
  current.ffmpeg.terminate()
  URL.revokeObjectURL(current.scriptURL)
}

async function loadEngine(multi: boolean): Promise<LoadedEngine> {
  const { FFmpeg } = await import('@ffmpeg/ffmpeg')
  const instance = new FFmpeg()
  let scriptURL: string | undefined
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 60_000)
  try {
    const base = new URL(`${import.meta.env.BASE_URL}ffmpeg/${multi ? 'mt/' : ''}`, window.location.href)
    const response = await fetch(new URL('ffmpeg-core.js', base), { signal: controller.signal })
    if (!response.ok) throw new Error('core unavailable')
    // Blob imports work for public assets in Vite development and in nested WASM workers.
    scriptURL = URL.createObjectURL(new Blob([await response.text()], { type: 'text/javascript' }))
    await instance.load({
      coreURL: scriptURL,
      wasmURL: new URL('ffmpeg-core.wasm', base).href,
      ...(multi ? { workerURL: new URL('ffmpeg-core.worker.js', base).href } : {}),
    }, { signal: controller.signal })
    return {
      ffmpeg: instance, scriptURL, mode: multi ? 'multi' : 'single',
      threads: multi ? Math.min(4, Math.floor(navigator.hardwareConcurrency / 2)) : 1,
    }
  } catch (error) {
    instance.terminate()
    if (scriptURL) URL.revokeObjectURL(scriptURL)
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function getEngine(preferMulti: boolean): Promise<LoadedEngine> {
  if (loading) await loading
  const multi = preferMulti && canUseMultithread()
  if (engine?.ffmpeg.loaded && (!multi || engine.mode === 'multi')) return engine
  if (engine) discardEngine(engine)
  loading = (async () => {
    if (multi) {
      try {
        engine = await loadEngine(true)
        return engine
      } catch {
        multithreadDisabled = true
      }
    }
    try {
      engine = await loadEngine(false)
      return engine
    } catch {
      throw new Error('não foi possível carregar o conversor. verifique sua conexão e tente novamente.')
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

function copyStreams(format: string, streams: MediaStream[] = []) {
  const video = streams.find(stream => stream.codec_type === 'video')
  const audio = streams.find(stream => stream.codec_type === 'audio')
  const webm = format === 'webm'
  return {
    video: Boolean(video && (webm
      ? ['vp8', 'vp9'].includes(video.codec_name)
      : video.codec_name === 'h264' && ['yuv420p', 'yuvj420p'].includes(video.pix_fmt ?? ''))),
    audio: Boolean(audio && (webm ? ['opus', 'vorbis'].includes(audio.codec_name) : audio.codec_name === 'aac')),
  }
}

export function conversionArgs(
  item: Pick<QueueFile, 'kind' | 'format'>, input: string, output: string,
  { streams, threads = 1, forceTranscode = false }: ConversionOptions = {},
): string[] {
  const { kind, format } = item
  if (!formats[kind].includes(format)) throw new Error('selecione um formato disponível.')
  const sameFormat = isSameFormat(input, format)
  const args = ['-filter_threads', String(threads), '-threads', String(threads), '-i', input]
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
      const copy = forceTranscode ? { video: false, audio: false } : copyStreams(format, streams)
      if (copy.video) args.push('-c:v', 'copy')
      else {
        args.push('-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-pix_fmt', 'yuv420p', '-threads:v', String(threads))
        args.push(...(format === 'webm'
          ? ['-c:v', 'libvpx', '-b:v', '1M']
          : ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23']))
      }
      args.push(...(copy.audio ? ['-c:a', 'copy'] : format === 'webm'
        ? ['-c:a', 'libvorbis'] : ['-c:a', 'aac']))
    }
    if (format === 'mp4' || format === 'mov') args.push('-movflags', '+faststart')
  }
  return [...args, output]
}

async function inspectStreams(ffmpeg: FFmpeg, input: string, probe: string): Promise<MediaStream[]> {
  const code = await ffmpeg.ffprobe([
    '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,pix_fmt',
    '-of', 'json', input, '-o', probe,
  ])
  // core 0.12.10 leaves ffprobe's exit status at -1 even after writing valid JSON.
  if (code !== 0 && code !== -1) throw new ConversionError('invalid media')
  const data = await ffmpeg.readFile(probe, 'utf8')
  if (typeof data !== 'string') throw new ConversionError('invalid probe')
  const result = JSON.parse(data) as { streams?: MediaStream[] }
  if (!Array.isArray(result.streams) || !result.streams.some(stream => stream.codec_type === 'video')) throw new ConversionError('invalid streams')
  return result.streams
}

export async function convertFile(item: QueueFile, onReady: () => void): Promise<ConversionResult> {
  const input = `input-${item.id}.${extension(item.file.name) || 'bin'}`
  const output = `output-${item.id}.${item.format}`
  const probe = `probe-${item.id}.json`
  const video = item.kind === 'video' && item.format !== 'mp3'
  let forceTranscode = false
  let retrySingle = false

  for (;;) {
    const current = await getEngine(video && !retrySingle)
    const ffmpeg = current.ffmpeg
    onReady()
    try {
      await ffmpeg.writeFile(input, new Uint8Array(await item.file.arrayBuffer()))
      const streams = video && !isSameFormat(input, item.format) && !forceTranscode
        ? await inspectStreams(ffmpeg, input, probe) : undefined
      const args = conversionArgs(item, input, output, { streams, threads: current.threads, forceTranscode })
      if (item.kind === 'image' && isSameFormat(input, item.format)) {
        // Stream copy alone can accept corrupt images without decoding a frame.
        const code = await ffmpeg.exec(['-threads', '1', '-i', input, '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-'])
        if (code !== 0) throw new ConversionError('invalid image')
      }
      const code = await ffmpeg.exec(args)
      if (code !== 0) {
        if (streams && (args.includes('copy'))) throw new CopyError('stream copy failed')
        throw new ConversionError('conversion failed')
      }
      const data = await ffmpeg.readFile(output)
      if (typeof data === 'string' || data.byteLength === 0) throw new ConversionError('empty output')
      const blob = new Blob([new Uint8Array(data)], { type: mimeTypes[item.format] })
      return { url: URL.createObjectURL(blob), name: outputName(item.file.name, item.format), size: blob.size }
    } catch (error) {
      // Failed WASM execution must be discarded before cleanup or another attempt.
      discardEngine(current)
      if (error instanceof CopyError && !forceTranscode) {
        forceTranscode = true
        continue
      }
      if (current.mode === 'multi' && !(error instanceof ConversionError) && !retrySingle) {
        multithreadDisabled = true
        retrySingle = true
        continue
      }
      throw new Error(item.kind === 'video' && item.format === 'mp3'
        ? 'não foi possível extrair o áudio. confira se o vídeo tem uma faixa de áudio.'
        : 'não foi possível converter este arquivo. ele pode estar corrompido ou usar um codec incompatível.')
    } finally {
      if (ffmpeg.loaded) await Promise.allSettled([input, output, probe].map(path => ffmpeg.deleteFile(path)))
    }
  }
}
