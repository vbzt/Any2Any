import styles from './Introduction.module.css'

const Introduction = () => {
  return (
    <div className={styles.body}>
      <h1 className={styles.title}>Introducing Any2<span className="colored">Any</span></h1>
      <p className={styles.description}>
          Any2Any is an open-source tool designed for unlimited and free multimedia file conversion. <span className="colored">All processing is done client-side, prioritizing your security and privacy.</span> Whether you're working with images, audio, or video, you can easily convert files between various formats without any restrictions.
      </p>
    </div>
  )
}

export default Introduction
