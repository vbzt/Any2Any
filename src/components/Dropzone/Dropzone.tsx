import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { fileAccept } from '../../lib/files'

interface DropzoneProps {
  onDrop: (files: File[]) => void
  disabled: boolean
  compact: boolean
}

const Dropzone = ({ onDrop, disabled, compact }: DropzoneProps) => {
  const input = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)

  return (
    <div className={`dropzone ${compact ? 'dropzone-compact' : ''} ${dragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`}
      onDragEnter={event => {
        event.preventDefault()
        dragDepth.current += 1
        if (!disabled) setDragging(true)
      }}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = disabled ? 'none' : 'copy' }}
      onDragLeave={event => { event.preventDefault(); dragDepth.current -= 1; if (dragDepth.current <= 0) setDragging(false) }}
      onDrop={event => {
        event.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        if (!disabled) onDrop(Array.from(event.dataTransfer.files))
      }}>
      <input ref={input} type="file" multiple accept={fileAccept} hidden disabled={disabled}
        aria-label="selecionar arquivos"
        onChange={event => { onDrop(Array.from(event.target.files ?? [])); event.target.value = '' }} />
      <Upload size={28} strokeWidth={1.5} aria-hidden="true" />
      <div className="dropzone-copy">
        <p>{dragging ? 'solte os arquivos' : compact ? 'adicione mais arquivos' : 'arraste seus arquivos aqui'}</p>
        <span>imagens, áudio e vídeo · até 200 mb por arquivo</span>
      </div>
      <button type="button" className="primary-button" disabled={disabled} onClick={() => input.current?.click()}>
        {compact ? 'adicionar arquivos' : 'selecionar arquivos'}
      </button>
    </div>
  )
}

export default Dropzone
