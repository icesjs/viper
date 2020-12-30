//
require('./lib/setup')('production', {
  // 这些环境变量强制被使用
  ENABLE_PRODUCTION_DEBUG: 'false',
  GENERATE_FULL_SOURCEMAP: 'false',
  GENERATE_SOURCEMAP: 'false',
  // WRITE_LOGS_TO_FILE: 'false',
  // DEBUG命名空间强制为构建相关命名
  DEBUG: `${process.env.npm_package_name}:*,electron-builder`,
})

const path = require('path')
const fs = require('fs-extra')
const { promisify } = require('util')
const yaml = require('js-yaml')
const merge = require('deepmerge')
const minimist = require('minimist')
const { log, createPrefixedLogger } = require('./lib/logger')
const { relativePath, emptyDirSync, getPackageJson, printErrorAndExit } = require('./lib/utils')
const { runScript } = require('./lib/runner')
const {
  BUILD_PATH,
  MAIN_BUILD_PATH,
  RENDERER_BUILD_PATH,
  ADDONS_BUILD_PATH,
} = require('../config/consts')

if (require.main === module) {
  // 从命令行进入
  run({ ...getCommandArgs(), publish: null }).catch(printErrorAndExit)
}

async function run(commandArgs = {}) {
  const taskNames = ['install-app-deps', 'build-production', 'packs-production']
  createPrefixedLogger.registeredNames.push(...taskNames)
  // 清理构建输出目录
  emptyDirSync(BUILD_PATH)
  // 安装依赖
  await reinstallDependencies({
    ...commandArgs,
    logger: createPrefixedLogger(taskNames[0], 'yellow'),
  })
  // 编译构建
  await buildResources({
    ...commandArgs,
    logger: createPrefixedLogger(taskNames[1], 'red'),
  })
  // 打包产品
  await packApplication({
    ...commandArgs,
    logger: createPrefixedLogger(taskNames[2], 'blue'),
  })
  // 打包成功
  log.info('Packaged successfully!')
}

//
function getCommandArgs() {
  const rawArgv = process.argv.slice(2)
  const { platform, arch, dir, config, publish } = minimist(rawArgv, {
    boolean: ['dir'],
  })
  return { platform, arch, dir, config, publish }
}

function noop() {}

// 重新安装平台相关的依赖
async function reinstallDependencies({ platform, arch, logger }) {
  const args = ['install-app-deps']
  if (platform) {
    args.push('--platform', platform)
  }
  if (arch) {
    args.push('--arch', arch)
  }
  await runScript({
    logger,
    script: 'electron-builder',
    args,
    exitHandle: noop,
  })
}

// 编译构建
async function buildResources({ logger }) {
  await runScript({
    logger,
    env: { WRITE_LOGS_TO_FILE: 'false' },
    script: path.join(__dirname, 'build.js'),
    exitHandle: noop,
  })
}

// 打包产品
async function packApplication({ platform, arch, dir, logger, publish, config = 'build.yml' }) {
  // 同步打包配置文件
  await synchronizeBuilderConfig(config, { dir, publish })
  const args = ['build']
  const platformArg = {
    darwin: '--mac',
    win32: '--win',
    linux: '--linux',
  }[platform]
  if (platformArg) {
    args.push(platformArg)
  }
  if (arch) {
    args.push(`--${arch}`)
  }
  args.push('--config', config)
  await runScript({
    logger,
    script: 'electron-builder',
    args,
    exitHandle: noop,
  })
}

async function synchronizeBuilderConfig(filepath, { dir, publish = null }) {
  const cwd = process.cwd()
  const mainFile = process.env.ELECTRON_MAIN_ENTRY_PATH
  const buildDir = relativePath(cwd, BUILD_PATH, false)
  const mainDir = relativePath(BUILD_PATH, MAIN_BUILD_PATH, false)
  const rendererDir = relativePath(BUILD_PATH, RENDERER_BUILD_PATH, false)
  const addonsDir = relativePath(BUILD_PATH, ADDONS_BUILD_PATH, false)
  const relativeBuildMainFile = relativePath(BUILD_PATH, mainFile, false)

  // 生成打包用的package.json
  const { name, version, description } = getPackageJson()
  await promisify(fs.outputFile)(
    path.resolve(buildDir, 'package.json'),
    JSON.stringify({
      name,
      version,
      description,
      private: true,
      dependencies: {},
      main: relativeBuildMainFile,
    })
  )
  // 同步打包配置
  await writeBuilderConfig(filepath, {
    publish,
    asar: !dir,
    extends: null,
    directories: {
      app: `${buildDir}/`,
      buildResources: `${buildDir}/`,
    },
    // 文件路径都是相对构建目录
    files: [
      '!*.{js,css}.map',
      'package.json',
      relativeBuildMainFile,
      `${mainDir}/**/*`,
      `${rendererDir}/**/*`,
      `${addonsDir}/**/*`,
    ],
    extraMetadata: {
      main: relativeBuildMainFile,
    },
  })
}

async function writeBuilderConfig(filepath, updates) {
  const configPath = path.resolve(filepath)
  const content = await promisify(fs.readFile)(configPath, 'utf8')
  const config = yaml.safeLoad(content)
  const updatedConfig = merge(config, updates, {
    arrayMerge: (dest, src) => src,
  })
  const dumped = yaml.safeDump(updatedConfig)
  await promisify(fs.outputFile)(configPath, dumped)
  return updatedConfig
}

module.exports = {
  pack: run,
  getCommandArgs,
}
