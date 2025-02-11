import './App.css'
import Header from './components/Header'
import Introduction from './components/Introduction'
import Dropzone from './components/Dropzone'
import FileUpload from './components/FileUpload'
import { useEffect, useState } from 'react'

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

function App() {
  const [upload, setUpload] = useState<boolean>(false)
  const [files, setFiles] = useState<File[]>([])
  const [fileFormats, setFileFormats] = useState<{ [key: string]: string }>({})
  const [fileStatuses, setFileStatuses] = useState<{ [key: string]: 'pending' | 'loading' | 'done' | 'error' }>({})
  const ffmpeg = new FFmpeg()

  const loadFFmpeg = async () => {
    if (!ffmpeg.loaded) {
      await ffmpeg.load()
    }
  }

  const handleDrop = (acceptedFiles: File[]) => {
    setFiles(prevFiles => [...prevFiles, ...acceptedFiles])
    setUpload(true)
  }

  const removeFile = (fileToRemove: File) => {
    setFiles(prevFiles => prevFiles.filter(file => file !== fileToRemove))

    setFileStatuses(prevStatuses => {
      const newStatuses = { ...prevStatuses }
      delete newStatuses[fileToRemove.name]
      return newStatuses
    })

    setFileFormats(prevFormats => {
      const newFormats = { ...prevFormats }
      delete newFormats[fileToRemove.name]
      return newFormats
    })
  }

  const updateFileFormat = (fileName: string, fileFormat: string) => {
    setFileFormats(prevFormats => ({ ...prevFormats, [fileName]: fileFormat }))
  }

  const convertImage = async (file: File, newFormat: string) => {
    try {
      setFileStatuses(prev => ({ ...prev, [file.name]: 'loading' }))
      await loadFFmpeg()

      const newFileName = `${file.name.split('.')[0]}.${newFormat}`
      await ffmpeg.writeFile(file.name, await fetchFile(file))
      await ffmpeg.exec(['-i', file.name, newFileName])
      const data = await ffmpeg.readFile(newFileName)

      const url = URL.createObjectURL(new Blob([data], { type: `image/${newFormat}` }))
      const a = document.createElement('a')
      a.href = url
      a.download = newFileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      setFileStatuses(prev => ({ ...prev, [file.name]: 'done' }))
    } catch (error) {
      console.error(error)
      setFileStatuses(prev => ({ ...prev, [file.name]: 'error' }))
    }
  }

  const handleConvert = async () => {
    for (const [fileName, newFormat] of Object.entries(fileFormats)) {
      const file = files.find(f => f.name === fileName)
      if (file) {
        await convertImage(file, String(newFormat))
      }
    }
  }

  useEffect(() => {
    if (files.length === 0) {
      setUpload(false)
    }
  }, [files])

  return (
    <>
      <Header />
      <main>
        <Introduction />
        {!upload ? (
          <Dropzone onDrop={handleDrop} />
        ) : (
          <section className="fileConvert">
            <ul>
              {files.map((file) => (
                <FileUpload
                  key={file.name}
                  file={file}
                  removeFile={removeFile}
                  updateFileFormat={updateFileFormat}
                  status={fileStatuses[file.name] || 'pending'}
                />
              ))}
            </ul>
            <div className="add">
              <button onClick={handleConvert}>Convert files</button>
            </div>
          </section>
        )}
      </main>
    </>
  )
}

export default App
