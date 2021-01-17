//
require('./lib/setup')('production', {
  // 这些环境变量强制被使用
  ENABLE_PRODUCTION_DEBUG: 'false',
  ENABLE_BUNDLE_ANALYZER: 'false',
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
const { relativePath, emptyDirSync, printErrorAndExit } = require('./lib/utils')
const { runScript } = require('./lib/runner')
const {
  APP_BUILD_PATH,
  MAIN_BUILD_PATH,
  RENDERER_BUILD_PATH,
  ADDONS_BUILD_PATH,
} = require('../config/constants')
//
const {
  ELECTRON_MAIN_ENTRY_PATH,
  ELECTRON_HEADERS_MIRROR_URL,
  ENABLE_NODE_ADDONS,
  ELECTRON_BUILDER_CONFIG = 'pack.yml',
  CI = 'false',
} = process.env

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
  emptyDirSync(APP_BUILD_PATH)

  if (ENABLE_NODE_ADDONS !== 'false') {
    log.info('Rebuild native addons for current platform...')
    // 构建本地插件
    await rebuildNativeModules({
      ...commandArgs,
      logger: createPrefixedLogger(taskNames[0], 'yellow'),
    })
  } else {
    taskNames.shift()
  }

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
    config = ELECTRON_BUILDER_CONFIG,
    publish = null,
    rebuild,
    dir,
  } = minimist(rawArgv, {
    boolean: ['dir', 'rebuild'],
  })
  return { platform, arch, dir, config, publish, rebuild }
}

function noop() {}

function getElectronVersion() {
  return require('electron/package.json').version
}

// 重新编译本地插件
async function rebuildNativeModules({ arch, logger, rebuild }) {
  const electronVersion = getElectronVersion()
  const args = ['--types', 'prod', '--version', electronVersion]
  if (arch) {
    args.push('--arch', arch)
  }
  if (CI !== 'false' || rebuild) {
    args.push('--force')
  }
  if (ELECTRON_HEADERS_MIRROR_URL) {
    args.push('--dist-url', ELECTRON_HEADERS_MIRROR_URL)
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
    script: path.join(__dirname, 'build.js'),
    logger,
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
  const enableAddons = ENABLE_NODE_ADDONS !== 'false'
  const mainFile = ELECTRON_MAIN_ENTRY_PATH
  const buildDir = relativePath(cwd, APP_BUILD_PATH, false)
  const mainDir = relativePath(APP_BUILD_PATH, MAIN_BUILD_PATH, false)
  const rendererDir = relativePath(APP_BUILD_PATH, RENDERER_BUILD_PATH, false)
  const addonsDir = enableAddons ? relativePath(APP_BUILD_PATH, ADDONS_BUILD_PATH, false) : ''
  const relativeBuildMainFile = relativePath(APP_BUILD_PATH, mainFile, false)

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
      ...new Set(
        [
          '!*.{js,css}.map',
          'package.json',
          relativeBuildMainFile,
          `${mainDir}/**/*`,
          `${rendererDir}/**/*`,
          addonsDir && `${addonsDir}/**/*`,
        ].filter(Boolean)
      ),
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
