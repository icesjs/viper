import log, { LevelOption } from 'electron-log'
import { app } from 'electron'

const developmentLogger = log.create('development')
const productionLogger = log.create('production')

const devLogLevel = (process.env.ELECTRON_APP_DEV_LOG_LEVEL || 'silly') as LevelOption
const proLogLevel = (process.env.ELECTRON_APP_PRO_LOG_LEVEL || 'silly') as LevelOption

developmentLogger.transports.file.level = false
developmentLogger.transports.console.level = devLogLevel

productionLogger.transports.file.level = 'silly'
productionLogger.transports.console.level = proLogLevel

if (!app.isPackaged) {
  developmentLogger.transports.console.format = '{text}'
  productionLogger.transports.console.format = '{text}'
}

export { developmentLogger, productionLogger }
