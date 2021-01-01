import React from 'react'
import ReactDOM from 'react-dom'
import './index.scss'
import App from './layouts/App'
import { store } from './app/store'
import { Provider } from 'react-redux'
import * as serviceWorker from './serviceWorker'
// @ts-ignore

import helloAddonsTest from '../addons/hello'
import helloAddonsLibTest from '@ices/node-addons-hello'
import callbackAddonsLibTest from '@ices/node-addons-callbacks'

console.log(`Addons say: ${helloAddonsTest.hello()}`)
console.log(`AddonsLib say: ${helloAddonsLibTest.hello()}`)
callbackAddonsLibTest(async (msg) => {
  console.log(`AddonsLib callbacks say: ${msg}`)
})

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
