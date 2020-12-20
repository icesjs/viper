const fs = require('fs-extra')
const path = require('path')
const {
  MAIN_BUILD_PATH,
  MAIN_BUILD_FILE_NAME,
  NATIVE_ADDONS_OUTPUT_PATH,
} = require('../../config/consts')
const { relativePath, PROJECT_CONTEXT: cwd } = require('./utils')

const index = path.join(cwd, 'index.js')
const main = path.resolve(MAIN_BUILD_PATH, MAIN_BUILD_FILE_NAME)

// 根据配置文件中的定义参数，更新应用的执行入口信息
fs.writeFileSync(index, `require('${relativePath(cwd, main)}')\n`)

// 清空addons目录
fs.emptyDirSync(NATIVE_ADDONS_OUTPUT_PATH)
