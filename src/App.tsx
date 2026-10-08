import './App.css'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import Introduction from './components/Introduction/Introduction'
import Dropzone from './components/Dropzone/Dropzone'
import FileUpload from './components/FileUpload/FileUpload'
import Footer from './components/Footer/Footer'
import ThemeToggle from './components/ThemeToggle'
import BrandMark from './components/BrandMark'
import { useConverter } from './hooks/useConverter'
function App() {
  const { files, busy, message, phase, addFiles, remove, clear, changeFormat, run } = useConverter()
  const unfinished = files.filter(file => file.status !== 'done')
  const ready = unfinished.length > 0 && unfinished.every(file => file.format)
  const completed = files.filter(file => file.status === 'done').length
  return (
    <div className="app-shell">
      <a className="skip-link" href="#converter">ir para o conversor</a>
      <header className="site-header">
        <BrandMark />
        <div className="header-actions">
          <span className="header-caption">gratuito e código aberto</span>
          <ThemeToggle />
        </div>
      </header>
      <main>
        <Introduction />
        <section className="converter" id="converter" aria-labelledby="converter-title">
          <div className="section-heading">
            <h2 id="converter-title">arquivos para converter</h2>
          </div>
          <Dropzone onDrop={addFiles} disabled={busy} compact={files.length > 0} />
          {message && <p className="upload-error" role="alert">{message}</p>}
          {files.length > 0 && (
            <div className="queue">
              <div className="queue-heading">
                <h3>seus arquivos <span className="file-count">{files.length}</span></h3>
                <button type="button" className="text-button" onClick={clear} disabled={busy}>limpar fila</button>
              </div>
              <ul className="file-list" aria-label="fila de conversão">
                {files.map(item => (
                  <FileUpload key={item.id} item={item} disabled={busy}
                    removeFile={remove} updateFileFormat={changeFormat} retry={id => void run(id)} />
                ))}
              </ul>
              <div className="queue-actions">
                <p className="queue-hint" role="status">
                  {busy ? phase : completed === files.length
                    ? 'conversão concluída'
                    : ready ? 'pronto para converter'
                    : 'escolha o formato de saída de cada arquivo'}
                </p>
                <button type="button" className="primary-button convert-button" disabled={busy || !ready} onClick={() => void run()}>
                  {busy ? <><LoaderCircle className="spinner" aria-hidden="true" /> convertendo</>
                    : <>converter {unfinished.length === 1 ? 'arquivo' : 'arquivos'} <ArrowRight size={18} aria-hidden="true" /></>}
                </button>
              </div>
              {!busy && phase && <p className="sr-only" role="status">{phase}</p>}
            </div>
          )}
          <div className="converter-note">
            <span>seus arquivos ficam no seu dispositivo</span>
          </div>
        </section>
        <section className="format-guide" aria-labelledby="formats-title">
          <div className="guide-intro">
            <h2 id="formats-title">formatos disponíveis</h2>
          </div>
          <dl className="format-list">
            <div><dt>imagem</dt><dd>jpg, png, webp</dd></div>
            <div><dt>áudio</dt><dd>mp3, wav, ogg, aac, flac</dd></div>
            <div><dt>vídeo</dt><dd>mp4, webm, mov, mkv <span>ou extraia o áudio em mp3</span></dd></div>
          </dl>
          <p className="limitations">arquivos grandes podem levar mais tempo, dependendo do seu dispositivo. imagens animadas são convertidas pelo primeiro quadro.</p>
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default App
