import './App.css'
import Header from './components/Header'
import Introduction from './components/Introduction'
import Dropzone from './components/Dropzone'
import FileUpload from './components/FileUpload'
import { useEffect, useState } from 'react'

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { Spinner } from '@radix-ui/themes'

function App() {

  const [upload, setUpload] = useState<boolean>(false)
  const [files, setFiles] = useState<File[]>([])
  const [fileFormats, setFileFormats] = useState<{ [key: string]: string }>({})
  const [fileStatuses, setFileStatuses] = useState<{ [key: string]: 'pending' | 'loading' | 'done' | 'error' }>({})
  const [loading, setLoading] = useState<boolean>(false)
  const [done, setDone] = useState<boolean>(false)
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

  const convertAudio = async (file: File, newFormat: string) => {
    try {
      setFileStatuses(prev => ({ ...prev, [file.name]: 'loading' }))
      await loadFFmpeg()

      const newFileName = `${file.name.split('.')[0]}.${newFormat}`
      await ffmpeg.writeFile(file.name, await fetchFile(file))
      await ffmpeg.exec(['-i', file.name, newFileName])
      const data = await ffmpeg.readFile(newFileName)

      const url = URL.createObjectURL(new Blob([data], { type: `audio/${newFormat}` }))
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

  const convertVideo = async (file: File, newFormat: string) => {
    try {
      setFileStatuses(prev => ({ ...prev, [file.name]: 'loading' }))
      await loadFFmpeg()

      const newFileName = `${file.name.split('.')[0]}.${newFormat}`
      await ffmpeg.writeFile(file.name, await fetchFile(file))
      const codecOptions = await getVideoCodec(newFormat)
      await ffmpeg.exec(['-i', file.name, ...codecOptions, newFileName])
      const data = await ffmpeg.readFile(newFileName)

      const url = URL.createObjectURL(new Blob([data], { type: `video/${newFormat}` }))
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

  const getVideoCodec = (format: string) => {
    switch (format) {
      case 'mp4':
      case 'mov':
      case 'mkv':
        return ['-c:v', 'libx264', '-preset', 'ultrafast']
      case 'webm':
        return ['-c:v', 'libvpx', '-b:v', '1M']
      case 'avi':
        return ['-c:v', 'mpeg4', '-q:v', '5']
      case 'wmv':
        return ['-c:v', 'wmv2', '-b:v', '1M']
      case 'ogv':
        return ['-c:v', 'libtheora', '-b:v', '1M']
      default:
        throw new Error(`Formato ${format} não suportado`)
    }
  }
  
  const handleConvert = async () => {
    setLoading(true)
    setDone(false)
  
    const convertPromises = Object.entries(fileFormats).map(async ([fileName, newFormat]) => {
      const file = files.find(f => f.name === fileName)
      if (file) {
        const fileType = file.type.split('/')[0]
  
        switch(fileType){
          case 'video': await convertVideo(file, newFormat); break
          case 'image': await convertImage(file, newFormat); break
          case 'audio': await convertAudio(file, newFormat);break
        }
      }
    })
  
    await Promise.all(convertPromises)
  
    setLoading(false)
    setDone(true)
  }
  
  
  
  const handleClearFiles = async () => {
    setFiles([])
    setUpload(false)
    setDone(false)
    setLoading(false)
    setFileStatuses({})
  } 


  useEffect(() => {
    if (files.length === 0) {
      setUpload(false)
      setDone(false)
      setLoading(false)
      setFileStatuses({})
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
            
              {!loading && !done && (
                <div className="add">
                 <button onClick={handleConvert}>Convert files</button>
               </div>
              )}

              {loading && (
                <div className="loading">
                 <button disabled > <Spinner size= '2'/> </button>
               </div>
              )}

              {done && (
                <div className="done">
                 <button onClick={handleClearFiles}>Convert more files</button>
               </div>
              )}
          </section>
        )}
      </main>
    </>
  )
}

export default App
