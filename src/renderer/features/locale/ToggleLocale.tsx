import { useCallback } from 'react'
import { useTrans, utils } from './lang.yml'
import styles from './ToggleLocale.module.scss'

function initLocale() {
  return utils.determineLocale({
    fallbackLocale: 'zh-CN',
  })
}

export default function ToggleLocale() {
  const [trans, locale, setLocale] = useTrans(null, initLocale, 'zh')
  const toggle = useCallback(() => {
    setLocale(locale === 'en' ? 'zh-CN' : 'en')
  }, [locale, setLocale])
  return (
    <button className={styles.button} onClick={toggle}>
      {trans('toggle')}
    </button>
  )
}
