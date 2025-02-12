import { FileImage, FileAudio, FileVideo, X, Check, TriangleAlert } from 'lucide-react'
import styles from './FileUpload.module.css'
import CustomDropdown from './CustomDropdown'
import { useEffect } from 'react'
import { Spinner } from '@radix-ui/themes'

interface FileUploadProps {
  file: File
  removeFile: (file: File) => void
  updateFileFormat: (fileName: string, format: string) => void
  status: 'pending' | 'loading' | 'done' | 'error'
}

const FileUpload = ({ file, removeFile, updateFileFormat, status }: FileUploadProps) => {
  const formatFileName = (name: string) => {
    if (name.length <= 16) return name
    const firstPart = name.slice(0, 10)
    const lastPart = name.slice(-6)
    return `${firstPart}...${lastPart}`
  }

  const setFileIcon = (type: string) => {
    const fileType = type.split('/')[0]
    if (fileType === 'video') return <FileVideo />
    if (fileType === 'image') return <FileImage />
    if (fileType === 'audio') return <FileAudio />
    return null
  }

  const handleFormatChange = (newFormat: string) => {
    updateFileFormat(file.name, newFormat)
  }

  const fileType = file.type.split('/')[0]
  const formatFileSize = (size: number) => {
    if (size >= 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(2)} MB`
    }
    return `${(size / 1024).toFixed(2)} KB`
  }
  

  return (
    <li className={styles.file} key={file.name}>
      <div className={styles.fileInfo}>
        <div className={styles.fileDesc}>
          {setFileIcon(file.type)}
          <div className = {styles.fileTitle}>
            <h3>{formatFileName(file.name)}</h3>
            <span className={styles.size}>{formatFileSize(file.size)}</span>

          </div>
        </div>

        {status === 'pending' && (
          <CustomDropdown fileType={fileType as 'image' | 'video' | 'audio'} onFormatSelect={handleFormatChange} />
        )}

        {status === 'loading' && <div className={styles.progress}>Converting... <Spinner size= '1'/></div>}

        {status === 'done' && <div className={styles.done}>Done <Check color='#e4e4e4' className={styles.check} /></div>}

        {status === 'error' && <div className={styles.error}>Error converting file <TriangleAlert color='#e4e4e4' className={styles.check} /></div>}

        <button className={styles.remove} onClick={() => removeFile(file)}><X /></button>
      </div>
    </li>
  )
}

export default FileUpload
