import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'dark' | 'light'

const ThemeToggle = () => {
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
  const label = theme === 'dark' ? 'ativar tema claro' : 'ativar tema escuro'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('link[rel="icon"]')?.setAttribute('href', theme === 'dark' ? '/favicon.svg' : '/favicon-light.svg')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#15171b' : '#f4f3ef')
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme)
  }, [theme])

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    try {
      localStorage.setItem('any2any-theme', nextTheme)
    } catch {
      // Theme switching remains available when browser storage is blocked.
    }
  }

  return (
    <button type="button" className="icon-button theme-toggle" onClick={toggleTheme} aria-label={label} title={label}>
      {theme === 'dark' ? <Sun size={20} strokeWidth={1.5} aria-hidden="true" /> : <Moon size={20} strokeWidth={1.5} aria-hidden="true" />}
    </button>
  )
}

export default ThemeToggle
