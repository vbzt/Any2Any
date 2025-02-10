import './App.css'
import Header from './components/Header'
import Introduction from './components/Introduction'
import Dropzone from './components/Dropzone'
import { useEffect, useState } from 'react'
import FileUpload from './components/FileUpload'

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

function App() {
  const [upload, setUpload] = useState<boolean>(false)
  const [files, setFiles] = useState<File[]>([])
  const [fileFormats, setFileFormats] = useState({})
  const [loading, setLoading] = useState<boolean>(false)
  const [convertingError, setConvertingError] = useState<boolean>(false)
  const ffmpeg = new FFmpeg()

  const handleDrop = (acceptedFiles: File[]) => {
    setFiles(prevFiles => [...prevFiles, ...acceptedFiles])
    setUpload(true)
  }

  const removeFile = (fileToRemove: File) => {
    setFiles(prevFiles => prevFiles.filter(file => file !== fileToRemove))
  }

  const updateFileFormat = (fileName: string, fileFormat: string) => { 
    setFileFormats(prevFormat => ({ ...prevFormat, [fileName]: fileFormat }))
  }

  const loadFFmpeg = async () => {
    if (!ffmpeg.loaded) {
      console.log('Loading FFmpeg...');
      await ffmpeg.load()
    }
  }

  const convertImage = async (file: File, newFormat: string) => {
    try {
      setLoading(true)
      await loadFFmpeg()

      const newFile = `${file.name.split('.')[0]}.${newFormat}`
      await ffmpeg.writeFile(file.name, await fetchFile(file))
      await ffmpeg.exec(['-i', file.name, newFile])
      const data = await ffmpeg.readFile(newFile)
      const url = URL.createObjectURL(new Blob([data], { type: `image/${newFormat}` }))
      const a = document.createElement('a')
      a.href = url
      a.download = newFile
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setLoading(false)
    } catch (error) {
      console.error('Error converting image:', error)
      setConvertingError(true)
    }
  }

  const handleConvert = async () => {
    for (const [fileName, newFormat] of Object.entries(fileFormats)) {
      const file = files.find(f => f.name === fileName)
      if (file) {
        console.log(`Starting conversion for: ${file.name}`);
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
          <Dropzone onDrop={handleDrop} />) 
          : 
          (
          <section className='fileConvert'>
            <ul>
              {files.map((file) => (
                <FileUpload 
                  key={file.name} 
                  file={file} 
                  removeFile={removeFile}
                  updateFileFormat={updateFileFormat}
                  loading = {loading}
                  convertingError = {convertingError}
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
