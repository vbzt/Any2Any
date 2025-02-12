import styles from './Footer.module.css'

const Footer = () => {
  return (
    <footer className = {styles.footer}>
       <p>Made with 💙 by <a className = {styles.github} target="_blank" href="https://github.com/vbzt/Any2Any">vbzt</a> &copy;.</p>
    </footer>
  )
}

export default Footer