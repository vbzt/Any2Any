import styles from './Header.module.css'
import logo from '/logo.svg'

const Header = () => {
  return (
    <header className={styles.header}>
      <img className={styles.logo} src={logo} alt="logo" />
    </header>
  )
}

export default Header