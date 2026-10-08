import { ChevronDown } from 'lucide-react'
import { formats } from '../../lib/files'
import type { MediaKind } from '../../lib/files'

interface CustomDropdownProps {
  id: string
  fileName: string
  fileType: MediaKind
  value: string
  disabled: boolean
  onFormatSelect: (format: string) => void
}

const CustomDropdown = ({ id, fileName, fileType, value, disabled, onFormatSelect }: CustomDropdownProps) => (
  <div className="format-select">
    <label className="sr-only" htmlFor={id}>formato de saída de {fileName}</label>
    <select id={id} value={value} disabled={disabled} onChange={event => onFormatSelect(event.target.value)}>
      <option value="">formato de saída</option>
      {formats[fileType].map(format => (
        <option key={format} value={format}>{fileType === 'video' && format === 'mp3' ? 'mp3 (áudio)' : format}</option>
      ))}
    </select>
    <ChevronDown size={16} aria-hidden="true" />
  </div>
)

export default CustomDropdown
