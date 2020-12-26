const fs = require('fs-extra')
const path = require('path')
const dotenv = require('./dotenv')
const {
  MAIN_BUILD_PATH,
  MAIN_BUILD_FILE_NAME,
  NATIVE_ADDONS_OUTPUT_PATH,
} = require('../../config/consts')
const { relativePath, isProtectedDirectory, PROJECT_CONTEXT: cwd } = require('./utils')
const { createLogger } = require('./logger')

createLogger('builder-scripts:script', true)

//
function getReady() {
  const index = path.resolve('index.js')
  const main = path.resolve(MAIN_BUILD_PATH, MAIN_BUILD_FILE_NAME)

  // 根据配置文件中的定义参数，更新应用的执行入口信息
  fs.writeFileSync(index, `require('${relativePath(cwd, main)}')\n`)

  // 清空addons构建输出目录
  if (!isProtectedDirectory(NATIVE_ADDONS_OUTPUT_PATH)) {
    fs.emptyDirSync(NATIVE_ADDONS_OUTPUT_PATH)
  }
}

function setEnvironment(NODE_ENV) {
  if (!NODE_ENV) {
    throw new Error('NODE_ENV is not set')
  }
  const envFromConfig = dotenv.parseEnv(NODE_ENV)
  const envFromProcess = process.env
  const envs = { ...envFromProcess, ...envFromConfig, NODE_ENV }
  for (const [name, value] of Object.entries(envs)) {
    if (!value || value === 'undefined') {
      delete envFromProcess[name]
      delete envs[name]
    }
  }
  Object.assign(envFromProcess, envFromConfig, { NODE_ENV })
  if (envFromProcess.DEBUG === 'false') {
    delete envFromProcess.DEBUG
  }
  return envFromProcess
}

//
getReady()

// 设置环境变量
module.exports = setEnvironment
