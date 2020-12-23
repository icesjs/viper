import React from 'react'
import ReactDOM from 'react-dom'
import './index.scss'
import App from './layouts/App'
import { store } from './app/store'
import { Provider } from 'react-redux'
import * as serviceWorker from './serviceWorker'
// @ts-ignore

// const ev = require('fsevents')

// const he = require('../../scripts/test-addons')

// const hellow = require('hello_world')
//
// const hellow_other = require('hello_world_other')
//
// const hellow_other_3 = require('../addons/hello_other_three')

// import * as addons from '../main/settings/test-addons.node'

// console.log(addons)

ReactDOM.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
  document.getElementById('root')
)

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.register()
