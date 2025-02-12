import styles from './Footer.module.css'

const Footer = () => {
  return (
    <footer className = {styles.footer}>
       <p>Made with 💗 by <a className = {styles.github} target="_blank" href="https://github.com/vbzt/Any2Any">vbzt</a>.</p>
       
      <p>Any2<span className="colored">Any</span>&copy; 2025</p>
    </footer>
  )
}

export default Footer