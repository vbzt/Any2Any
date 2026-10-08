import { useEffect, useRef, useState } from 'react'
import { MAX_FILE_SIZE, mediaKind } from '../lib/files'
import type { QueueFile } from '../lib/files'
import { convertFile } from '../lib/converter'

export function useConverter() {
  const [files, setFiles] = useState<QueueFile[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [phase, setPhase] = useState('')
  const locked = useRef(false)
  const converterWasLoaded = useRef(false)
  const mounted = useRef(true)
  const urls = useRef(new Set<string>())

  useEffect(() => {
    mounted.current = true
    const results = urls.current
    return () => {
      mounted.current = false
      results.forEach(url => URL.revokeObjectURL(url))
      results.clear()
    }
  }, [])

  function release(item: QueueFile) {
    if (item.result) {
      URL.revokeObjectURL(item.result.url)
      urls.current.delete(item.result.url)
    }
  }

  function addFiles(incoming: File[]) {
    if (locked.current) return
    const accepted: QueueFile[] = []
    const rejected: string[] = []
    for (const file of incoming) {
      const kind = mediaKind(file)
      if (!file.size) rejected.push(`${file.name}: o arquivo está vazio.`)
      else if (file.size > MAX_FILE_SIZE) rejected.push(`${file.name}: o limite é 200 mb por arquivo.`)
      else if (!kind) rejected.push(`${file.name}: escolha uma imagem, áudio ou vídeo compatível.`)
      else accepted.push({ id: crypto.randomUUID(), file, kind, format: '', status: 'pending' })
    }
    setFiles(previous => [...previous, ...accepted])
    setMessage(rejected.join(' '))
    setPhase('')
  }

  function remove(id: string) {
    if (locked.current) return
    const item = files.find(file => file.id === id)
    if (item) release(item)
    setFiles(previous => previous.filter(file => file.id !== id))
  }

  function clear() {
    if (locked.current) return
    files.forEach(release)
    setFiles([])
    setMessage('')
    setPhase('')
  }

  function changeFormat(id: string, format: string) {
    if (locked.current) return
    const item = files.find(file => file.id === id)
    if (item) release(item)
    setFiles(previous => previous.map(file => file.id === id
      ? { ...file, format, status: 'pending', error: undefined, result: undefined } : file))
  }

  async function run(onlyId?: string) {
    if (locked.current) return
    const batch = files.filter(file => (onlyId ? file.id === onlyId : file.status !== 'done') && file.format)
    if (!batch.length) return
    locked.current = true
    setBusy(true)
    setMessage('')
    setFiles(previous => previous.map(file => batch.some(item => item.id === file.id)
      ? { ...file, status: 'queued', error: undefined } : file))
    try {
      for (const [index, item] of batch.entries()) {
        if (!mounted.current) break
        setPhase(converterWasLoaded.current ? `preparando arquivo ${index + 1} de ${batch.length}` : 'carregando conversor')
        setFiles(previous => previous.map(file => file.id === item.id ? { ...file, status: 'converting' } : file))
        try {
          const result = await convertFile(item, () => {
            converterWasLoaded.current = true
            if (mounted.current) setPhase(`convertendo arquivo ${index + 1} de ${batch.length}`)
          })
          if (!mounted.current) { URL.revokeObjectURL(result.url); break }
          urls.current.add(result.url)
          setFiles(previous => previous.map(file => file.id === item.id ? { ...file, status: 'done', result } : file))
        } catch (error) {
          if (mounted.current) setFiles(previous => previous.map(file => file.id === item.id
            ? { ...file, status: 'error', error: error instanceof Error ? error.message : 'tente novamente.' } : file))
        }
      }
    } finally {
      locked.current = false
      if (mounted.current) { setBusy(false); setPhase('conversões finalizadas. confira os resultados abaixo.') }
    }
  }

  return { files, busy, message, phase, addFiles, remove, clear, changeFormat, run }
}
