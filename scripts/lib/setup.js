const fs = require('fs')
const path = require('path')
const { MAIN_BUILD_PATH, MAIN_BUILD_FILE_NAME } = require('../../config/consts')
const { relativePath } = require('./utils')

const cwd = process.cwd()
const index = path.join(cwd, 'index.js')
const main = path.join(MAIN_BUILD_PATH, MAIN_BUILD_FILE_NAME)

// 根据配置文件中的定义参数，更新应用的执行入口信息
fs.writeFileSync(index, `require('${relativePath(cwd, main)}')\n`)
