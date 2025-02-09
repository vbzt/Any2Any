import './App.css'
import Header from './components/Header'
import Introduction from './components/Introduction'
import Dropzone from './components/Dropzone'
import { useEffect, useState } from 'react'
import FileUpload from './components/FileUpload'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

function App() {
  const [upload, setUpload] = useState(false)
  const [files, setFiles] = useState<File[]>([])

  const handleDrop = (acceptedFiles: File[]) => {
    setFiles(prevFiles => [...prevFiles, ...acceptedFiles])
    setUpload(true)
  }

  const handleConversion = async (file: File) => { 
    const ffmpeg = new FFmpeg()
    await ffmpeg.load() 
  }

  const removeFile = (fileToRemove: File) => {
    setFiles(prevFiles => prevFiles.filter(file => file !== fileToRemove))
    console.log(false)
  }

  useEffect(() => { 
    if(files.length === 0){
      setUpload(false)
    }
  }, [upload, files])

  return (
    <>
      <Header />
      <main>
        <Introduction />
        {!upload ? ( 
          <Dropzone onDrop={handleDrop} />) 
          : 
          (
          <section className= 'fileConvert'>
            <ul>
              {files.map((file, index) => (
                <FileUpload 
                  key={index} 
                  file={file} 
                  removeFile={removeFile}
                  handleConversion = {handleConversion}
                />
              ))}
            </ul>
            <div className="add">
              <button >Convert files</button>
            </div> 
          </section>         
        )}
      </main>
    </>
  )
}

export default App;
