import React from 'react'
import logo from '../assets/images/logo.png'
import { Counter } from '../features/counter/Counter'
import ToggleLocale from '../features/locale/ToggleLocale'

import './App.scss'

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <Counter />
        <ToggleLocale />
      </header>
    </div>
  )
}

export default App
