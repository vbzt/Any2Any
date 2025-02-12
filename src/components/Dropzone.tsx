import { useDropzone } from 'react-dropzone'
import styles from './Dropzone.module.css'
import { CloudUpload, Upload } from 'lucide-react'

type DropzoneProps = {
  onDrop: (acceptedFiles: File[]) => void
}

const Dropzone = ({ onDrop }: DropzoneProps) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': [],  
      'audio/*': [], 
      'video/*': []
    },
  })

  return (
    <div className={styles.dropzone} {...getRootProps()}>
      <input {...getInputProps()} />
      {isDragActive ? (
        <>
          <Upload className={styles.upload} />
          <p>Yea, right here</p>
        </>
      ) : (
        <>
          <CloudUpload className={styles.cloud} />
          <p>Click, or drag your files here</p>
        </>
      )}
    </div>
  )
}

export default Dropzone
