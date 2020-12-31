//
require('./lib/setup')('production', {
  // 这些环境变量强制被使用
  ENABLE_PRODUCTION_DEBUG: 'false',
  GENERATE_FULL_SOURCEMAP: 'false',
  GENERATE_SOURCEMAP: 'false',
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
  run(getCommandArgs()).catch(printErrorAndExit)
}

async function run(commandArgs = {}) {
  const taskNames = ['rebuild-app-deps', 'build-production', 'pack-resources']
  createPrefixedLogger.registerNames(taskNames)

  log.info('Command arguments:')
  log.info(commandArgs)
  // 清理构建输出目录
  emptyDirSync(BUILD_PATH)
  log.info('Rebuild native addons for current platform...')
  // 构建本地插件
  await rebuildNativeModules({
    ...commandArgs,
    logger: createPrefixedLogger(taskNames[0], 'yellow'),
  })
  log.info('Build app resources...')
  // 编译构建
  await buildResources({
    ...commandArgs,
    logger: createPrefixedLogger(taskNames[1], 'red', (s) => s),
  })
  log.info('Package app resources...')
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
  const {
    platform = process.platform,
    arch = process.arch,
    config = 'build.yml',
    publish = 'never',
    dir,
  } = minimist(rawArgv, {
    boolean: ['dir'],
  })
  return { platform, arch, dir, config, publish }
}

function noop() {}

function getElectronVersion() {
  return require('electron/package.json').version
}

// 重新编译本地插件
async function rebuildNativeModules({ arch, logger }) {
  const electronVersion = getElectronVersion()
  const args = ['--types', 'prod', '--version', electronVersion]
  if (arch) {
    args.push('--arch', arch)
  }
  if (process.env.CI) {
    args.push('--force')
  }
  await runScript({
    exitHandle: noop,
    logger,
    script: 'electron-rebuild',
    args,
  })
}

// 编译构建
async function buildResources({ logger }) {
  await runScript({
    exitHandle: noop,
    logger,
    env: { WRITE_LOGS_TO_FILE: 'false' },
    script: path.join(__dirname, 'build.js'),
  })
}

// 打包产品
async function packApplication({ platform, arch, dir, logger, publish, config }) {
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
    exitHandle: noop,
    logger,
    script: 'electron-builder',
    args,
  })
}

async function synchronizeBuilderConfig(filepath, { dir, publish }) {
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
    npmRebuild: false,
    electronVersion: getElectronVersion(),
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
}
