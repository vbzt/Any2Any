import { FileImage, FileAudio, FileVideo, X } from 'lucide-react'
import styles from './FileUpload.module.css'
import CustomDropdown from './CustomDropdown'

interface FileUploadProps {
  file: File
  removeFile: (file: File) => void
  updateFileFormat: (fileName: string, format: string) => void
}

const FileUpload = ({ file, removeFile, updateFileFormat }: FileUploadProps) => {
  const formatFileName = (name: string) => {
    if (name.length <= 20) return name
    const firstPart = name.slice(0, 10)
    const lastPart = name.slice(-10)
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


  return (
    <li className={styles.file} key={file.name}>
      <div className={styles.fileInfo}>
        <div className={styles.fileDesc}>
          {setFileIcon(file.type)}
          <h3>{formatFileName(file.name)}</h3>
          <span className={styles.size}>{(file.size / 1024).toFixed(2)} KB</span>
        </div>
        <CustomDropdown fileType={fileType as 'image' | 'video' | 'audio'} onFormatSelect={handleFormatChange} />
        <button className={styles.remove} onClick={() => removeFile(file)}><X /></button>
      </div>
    </li>
  )
}

export default FileUpload
