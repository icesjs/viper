import React from 'react'
import logo from '../assets/images/logo.png'
import { Counter } from '../features/counter/Counter'
import './App.scss'

import { useLocale } from './lang.yml'

function App() {
  const [trans, setLocale, locale] = useLocale()
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <div>
          <button onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}>
            {trans('toggleLang')}
          </button>
        </div>
        <Counter />
      </header>
    </div>
  )
}

export default App
