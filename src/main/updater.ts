import { autoUpdater } from 'electron-updater'
import { productionLogger } from './logger'

export default class AppUpdater {
  constructor() {
    autoUpdater.logger = productionLogger
  }

  async check() {
    await autoUpdater.checkForUpdatesAndNotify()
  }
}
