const fs = require('fs-extra')
const loaderName = 'native-addons-loader'

//
module.exports = exports = {
  loaderName,
  //
  getBindingsCodeSnippet(addonsList, runtime) {
    return `/* ${addonsList.map(({ filePath }) => filePath).join('\n * ')} */
      const runtime = require(${runtime});
      module.exports = exports = function fakedBindings(bindingsOptions) {
        return runtime(bindingsOptions, ${JSON.stringify(
          addonsList.map(({ filePath, ...addon }) => addon)
        )}, ${JSON.stringify(loaderName)})
      }
      exports.getRoot = function getRoot(){return ''}
      exports.getFileName = function getFileName(){return ''}
    `
  },

  //
  getCodeSnippet({ isFromNodeModules, isMainProcess, modulePath, filePath, flags }) {
    const usedFlags = typeof flags !== 'undefined'
    return `
      try {
         /* ${filePath} */
         const path = __non_webpack_require__('path')
         if (${JSON.stringify(isMainProcess)}) {
           ${usedFlags ? 'process.dlopen(module,' : 'module.exports=__non_webpack_require__('}
           ${isFromNodeModules ? '' : 'path.join(__dirname,'}
           ${JSON.stringify(modulePath)}
           ${isFromNodeModules ? '' : ')'}
           ${usedFlags ? `,${JSON.stringify(flags)}` : ''})
         } else {
           const { remote } = __non_webpack_require__('electron')
           if (!remote) {
             throw new Error('Can not get remote module from electron. (enableRemoteModule)')
           }
           const appPath = remote.app.getAppPath();
           ${usedFlags ? 'remote.process.dlopen(module,' : 'module.exports=remote.require('}
           ${isFromNodeModules ? '' : 'path.join(appPath,'}
           ${JSON.stringify(modulePath)}
           ${isFromNodeModules ? '' : ')'}
           ${usedFlags ? `,${JSON.stringify(flags)}` : ''})
         }
      } catch (error) {
          throw new Error('${loaderName}: ' + error)
      }
    `
  },

  //
  getFileReader(thisArg) {
    const fis = (thisArg || this).fs || fs
    return (fp) =>
      new Promise((resolve, reject) => {
        fis.readFile(fp, (err, data) => {
          if (err) {
            reject(err)
          } else {
            resolve(data)
          }
        })
      })
  },

  //
  optionsScheme: {
    title: `${loaderName} options`,
    type: 'object',
    properties: {
      output: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'The output filename that the native addons file will be use',
          },
          path: {
            type: 'string',
            description: 'The output path that the native addons info will be generated in',
          },
        },
        additionalProperties: false,
      },
      appBuildPath: {
        description: 'App build dir, for packaged',
        type: 'string',
      },
      flags: {
        description: 'An integer that allows to specify dlopen behavior. See the [process.dlopen]',
        type: 'integer',
      },
      makeNativeDependencyPackageJson: {
        description: 'Used to generate dependency lists',
        type: 'boolean',
      },
    },
    additionalProperties: false,
  },
}
