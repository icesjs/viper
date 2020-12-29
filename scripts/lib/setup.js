const fs = require('fs-extra')
const path = require('path')
const logger = require('./logger')
const dotenv = require('./dotenv')
const { relativePath, emptyDirSync } = require('./utils')
const { MAIN_BUILD_PATH, MAIN_BUILD_FILE_NAME, ADDONS_BUILD_PATH } = require('../../config/consts')

//
function catchUncaughtException() {
  process.on('unhandledRejection', (reason) => logger.log.error(reason))
  process.on('uncaughtException', (err) => {
    logger.log.error(err)
    process.exit(1)
  })
}

//
function getReady() {
  const index = path.resolve('index.js')
  const main = path.resolve(MAIN_BUILD_PATH, MAIN_BUILD_FILE_NAME)
  const entry = relativePath(process.cwd(), main)
  // 根据配置文件中的定义参数，更新应用的执行入口信息
  fs.writeFileSync(index, `require('${entry}')\n`)

  // 保存至环境变量中，发布时有用到
  process.env.ELECTRON_MAIN_ENTRY_PATH = path.resolve(entry)

  // 清空addons构建输出目录
  emptyDirSync(ADDONS_BUILD_PATH)
}

function setEnvironment(NODE_ENV, forced) {
  const envFromConfig = dotenv.parseEnv(NODE_ENV)
  const envFromProcess = process.env
  const envs = { ...envFromProcess, ...envFromConfig, NODE_ENV }

  for (const [name, value] of Object.entries(envs)) {
    if (!value || value === 'undefined') {
      delete envFromProcess[name]
      delete envs[name]
    }
  }

  NODE_ENV = envs.NODE_ENV
  if (!NODE_ENV) {
    throw new Error('NODE_ENV is not set')
  }

  const {
    ENABLE_PRODUCTION_DEBUG = 'false',
    GENERATE_FULL_SOURCEMAP = 'false',
    DEBUG,
  } = Object.assign(
    envFromProcess,
    envFromConfig,
    {
      NODE_ENV,
      FORCE_COLOR: 2,
    },
    forced
  )

  if (ENABLE_PRODUCTION_DEBUG !== 'false' || GENERATE_FULL_SOURCEMAP !== 'false') {
    envFromProcess.GENERATE_SOURCEMAP = 'true'
  }
  if (DEBUG === 'false') {
    delete envFromProcess.DEBUG
  }

  return envFromProcess
}

//
catchUncaughtException()
getReady()

module.exports = setEnvironment
