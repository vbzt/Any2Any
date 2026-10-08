import { FileImage, FileAudio, FileVideo, X, Check, LoaderCircle, RotateCcw, Download, CircleAlert } from 'lucide-react'
import CustomDropdown from '../CustomDropdown/CustomDropdown'
import { formatSize } from '../../lib/files'
import type { QueueFile } from '../../lib/files'

interface FileUploadProps {
  item: QueueFile
  disabled: boolean
  removeFile: (id: string) => void
  updateFileFormat: (id: string, format: string) => void
  retry: (id: string) => void
}

const labels = { image: 'imagem', audio: 'áudio', video: 'vídeo' }
const statuses = { pending: 'aguardando', queued: 'na fila', converting: 'convertendo', done: 'pronto', error: 'falhou' }

const FileUpload = ({ item, disabled, removeFile, updateFileFormat, retry }: FileUploadProps) => {
  const Icon = { image: FileImage, audio: FileAudio, video: FileVideo }[item.kind]
  return (
    <li className={`file-row ${item.status === 'error' ? 'file-row-error' : ''}`}>
      <div className="file-main">
        <Icon className="file-icon" size={24} strokeWidth={1.5} aria-hidden="true" />
        <div className="file-info">
          <h4 title={item.file.name}>{item.file.name}</h4>
          <p>{labels[item.kind]} <span>·</span> {formatSize(item.file.size)}</p>
        </div>
      </div>
      <CustomDropdown id={`format-${item.id}`} fileName={item.file.name} fileType={item.kind}
        value={item.format} disabled={disabled} onFormatSelect={format => updateFileFormat(item.id, format)} />
      <span className={`file-status status-${item.status}`}>
        {item.status === 'converting' && <LoaderCircle className="spinner" size={15} aria-hidden="true" />}
        {item.status === 'done' && <Check size={15} aria-hidden="true" />}
        {item.status === 'error' && <CircleAlert size={15} aria-hidden="true" />}
        {statuses[item.status]}
      </span>
      <div className="file-actions">
        {item.result && <a className="download-button" href={item.result.url} download={item.result.name} aria-label={`baixar ${item.result.name}`}>
          <Download size={16} aria-hidden="true" /><span>baixar</span>
        </a>}
        {item.status === 'error' && <button type="button" className="icon-button" disabled={disabled}
          aria-label={`tentar novamente ${item.file.name}`} onClick={() => retry(item.id)}><RotateCcw size={17} aria-hidden="true" /></button>}
        <button type="button" className="icon-button remove-button" disabled={disabled}
          aria-label={`remover ${item.file.name}`} onClick={() => removeFile(item.id)}><X size={18} aria-hidden="true" /></button>
      </div>
      {item.error && <p className="file-error" role="alert">{item.error}</p>}
      {item.result && <p className="result-info">{item.result.name} · {formatSize(item.result.size)}</p>}
    </li>
  )
}

export default FileUpload
