const fs = require('fs')
const path = require('path')
const { MAIN_BUILD_PATH, MAIN_BUILD_FILE_NAME } = require('../../config/consts')
const { relativePath } = require('./utils')

const cwd = process.cwd()
const index = path.join(cwd, 'index.js')
const main = path.join(MAIN_BUILD_PATH, MAIN_BUILD_FILE_NAME)

fs.writeFileSync(index, `require('${relativePath(cwd, main)}')\n`)
