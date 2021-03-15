import { useCallback } from 'react'
import { useTrans } from './lang.yml'
import styles from './ToggleLocale.module.scss'

export default function ToggleLocale() {
  const [trans, locale, setLocale] = useTrans()
  const toggle = useCallback(() => {
    setLocale(locale === 'en' ? 'zh-CN' : 'en')
  }, [locale, setLocale])
  localStorage.setItem('lang', locale)
  return (
    <button className={styles.button} onClick={toggle}>
      {trans('toggle')}
    </button>
  )
}
