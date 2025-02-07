import styles from './Introduction.module.css'

const Introduction = () => {
  return (
    <div className={styles.body}>
      <h1 className={styles.title}>Unlimited File Converter</h1>
      <p className={styles.description}>
        Welcome to Any2Any, an open-source tool designed for unlimited and free multimedia file conversion. <span className="colored">All processing is done client-side, prioritizing your security and privacy.</span> Whether you're working with images, audio, or video, you can easily convert files between various formats without any restrictions.
      </p>
    </div>
  )
}

export default Introduction
