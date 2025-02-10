import './App.css'
import Header from './components/Header'
import Introduction from './components/Introduction'
import Dropzone from './components/Dropzone'
import { useEffect, useState } from 'react'
import FileUpload from './components/FileUpload'

function App() {
  const [upload, setUpload] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [fileFormats, setFileFormats] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false)


  const handleDrop = (acceptedFiles: File[]) => {
    setFiles(prevFiles => [...prevFiles, ...acceptedFiles])
    setUpload(true)
  }

  const removeFile = (fileToRemove: File) => {
    setFiles(prevFiles => prevFiles.filter(file => file !== fileToRemove))
  }

  const updateFileFormat = (fileName: string, fileFormat: string) => { 
    setFileFormats(prevFormat => ({...prevFormat, [fileName]: fileFormat}))
  }

  const convertImage = (file: File) =>  {   

  }   

  const handleConvert = () => {
    console.log('Arquivos:', files)
    console.log('Formatos escolhidos:', fileFormats)
    files.forEach((file, i) => {
      console.log(i + ' ' + file.name)
    })
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
              {files.map((file) => (
                <FileUpload 
                  key={file.name} 
                  file={file} 
                  removeFile={removeFile}
                  updateFileFormat={updateFileFormat}
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

export default App;
