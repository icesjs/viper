import * as React from 'react'
import { useCallback } from 'react'
import { useTheme } from '@ices/theme/react'
import useTrans from './lang.yml'
import style from './index.module.scss'

function ThemeSelect() {
  const [trans] = useTrans()
  const [theme, themeList, changeTheme] = useTheme(
    localStorage.getItem('preferred-theme-name') || '',
  )

  const handleChange = useCallback(
    (event) => {
      changeTheme(event.target.value).then((theme) => {
        localStorage.setItem('preferred-theme-name', theme)
      })
    },
    [changeTheme],
  )

  return (
    <div>
      <label className={style.label}>{trans('chooseTheme')}</label>
      <select value={theme} onChange={handleChange}>
        {themeList.map((theme) => (
          <option key={theme} value={theme}>
            {trans(theme as any)}
          </option>
        ))}
      </select>
    </div>
  )
}

export default ThemeSelect
