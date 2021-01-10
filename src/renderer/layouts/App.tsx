import React from 'react'
import logo from '../assets/images/logo.png'
import { Counter } from '../features/counter/Counter'
import { Counter2 } from '../features/counter2/Counter'
import './App.scss'

import { Translate, getLocale } from './lang.yml'
import { Translate as Translate2 } from './lang2.yml'

const LocaleContext = React.createContext(getLocale())
const LocaleContext2 = React.createContext(getLocale())

// Translate.contextType = LocaleContext
Translate2.contextType = LocaleContext2

export class App2 extends React.Component<any, any> {
  state = {
    locale: getLocale(),
  }

  changeLocale = (locale) => {
    this.setState({
      locale,
    })
  }

  render() {
    const { locale } = this.state
    return (
      <LocaleContext2.Provider value={locale}>
        <div className="App">
          <header className="App-header">
            <h2>App2</h2>
            <div>
              <button onClick={() => this.changeLocale(locale === 'en' ? 'zh' : 'en')}>
                <Translate2 id="toggleLang2" fallback="en" plugins={[]} />
              </button>
            </div>
            <Counter2 />
          </header>
        </div>
      </LocaleContext2.Provider>
    )
  }
}
// App2.contextType = LocaleContext2

export class App extends React.Component<any, any> {
  state = {
    locale: this.context,
  }

  changeLocale = (locale) => {
    this.setState({
      locale,
    })
  }

  render() {
    const { locale } = this.state

    return (
      <LocaleContext.Provider value={locale}>
        <div className="App">
          <header className="App-header">
            <img src={logo} className="App-logo" alt="logo" />
            <div>
              <button onClick={() => this.changeLocale(locale === 'en' ? 'zh' : 'en')}>
                <Translate id="toggleLang" fallback="en" plugins={[]} />
              </button>
            </div>
            <Counter />
          </header>
        </div>
      </LocaleContext.Provider>
    )
  }
}
