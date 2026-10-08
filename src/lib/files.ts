export type MediaKind = 'image' | 'audio' | 'video'
export type FileStatus = 'pending' | 'queued' | 'converting' | 'done' | 'error'

export interface ConversionResult {
  url: string
  name: string
  size: number
}

export interface QueueFile {
  id: string
  file: File
  kind: MediaKind
  format: string
  status: FileStatus
  error?: string
  result?: ConversionResult
}

export const MAX_FILE_SIZE = 200 * 1024 * 1024
export const formats: Record<MediaKind, readonly string[]> = {
  image: ['jpg', 'png', 'webp'],
  audio: ['mp3', 'wav', 'ogg', 'aac', 'flac'],
  video: ['mp4', 'webm', 'mov', 'mkv', 'mp3'],
}

const inputExtensions: Record<MediaKind, string[]> = {
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'ico', 'tga', 'tif', 'tiff', 'avif'],
  audio: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'opus', 'aiff', 'wma'],
  video: ['mp4', 'webm', 'mov', 'mkv', 'avi', 'wmv', 'ogv', 'm4v', 'mpeg', 'mpg'],
}

export const fileAccept = Object.values(inputExtensions)
  .flatMap(extensions => extensions.map(extension => `.${extension}`))
  .join(',')

export function extension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function mediaKind(file: Pick<File, 'name' | 'type'>): MediaKind | null {
  const type = file.type.split('/')[0]
  if (type === 'image' || type === 'audio' || type === 'video') return type
  if (file.type && file.type !== 'application/octet-stream') return null
  return (Object.keys(inputExtensions) as MediaKind[])
    .find(kind => inputExtensions[kind].includes(extension(file.name))) ?? null
}

export function outputName(name: string, format: string): string {
  const dot = name.lastIndexOf('.')
  return `${dot > 0 ? name.slice(0, dot) : name}.${format}`
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} b`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kb`
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mb`
}
