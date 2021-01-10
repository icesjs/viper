import React from 'react'
import ReactDOM from 'react-dom'
import './index.scss'
import { App, App2 } from './layouts/App'
import { store } from './app/store'
import { Provider } from 'react-redux'

ReactDOM.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
      <App2 />
    </Provider>
  </React.StrictMode>,
  document.getElementById('root')
)
