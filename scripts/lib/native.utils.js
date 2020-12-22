const fs = require('fs-extra')
const loaderName = 'native-addons-loader'

//
module.exports = exports = {
  loaderName,
  //
  getBindingsCodeSnippet(addonsList) {
    return `/* ${addonsList.map(({ modulePath }) => modulePath).join('\n * ')} */
  
  function getAddonsByBindingName(name = 'bindings.node') {
    const addonsList = ${JSON.stringify(addonsList)};
    for (const addons of addonsList) {
      if (name === addons.name || \`\${name}.node\` === addons.name) {
        return addons
      }
    }
  }
 
  function getAddonsModuleExports(addons) {
    const module = {exports: {}}
    try {
      const path = __non_webpack_require__('path');
      const {
      fromBuildOutputModulePath,
      fromRootContextModulePath,
      isFromNodeModules,
      isMainProcess,
      flags,
    } = addons;
      const usedFlags = typeof flags !== 'undefined';
      if (isMainProcess) {
         const requirePath = isFromNodeModules 
              ? fromBuildOutputModulePath 
              : path.join(__dirname, fromBuildOutputModulePath);
         if (usedFlags) {
            process.dlopen(module,requirePath,flags)
         } else {
            module.exports = __non_webpack_require__(requirePath)
         }
      } else {
         const { remote } = __non_webpack_require__('electron');
         if (!remote) {
           throw new Error('Can not get remote module from electron. (enableRemoteModule)')
         }
         const appPath = remote.app.getAppPath();
         const requirePath = isFromNodeModules 
              ? fromRootContextModulePath 
              : path.join(appPath, fromRootContextModulePath);
         if (usedFlags) {
            remote.process.dlopen(module,requirePath,flags)
         } else {
            module.exports = remote.require(requirePath)
         }
      }
    } catch(error) {
      throw new Error('${loaderName}: ' + error)
    }
    return module.exports
  }
  
  module.exports = exports = function fakedBindings(opts) {
    if (typeof opts === 'string') {
      opts = { bindings: opts }
    }
    const { bindings } = Object.assign({}, opts);
    const addons = getAddonsByBindingName(bindings);
    if(!addons) {
      throw new Error('${loaderName}: Could not locate the bindings file.')
    }
    if (opts.path) {
      // un_safe
      return addons.path
    }
    return getAddonsModuleExports(addons)
  }
  
  exports.getRoot = () => '';
  exports.getFileName = () => '';
  `
  },

  //
  getCodeSnippet({
    fromBuildOutputModulePath,
    fromRootContextModulePath,
    isFromNodeModules,
    isMainProcess,
    modulePath,
    flags,
  }) {
    const usedFlags = typeof flags !== 'undefined'
    return `
      try {
         /* ${modulePath} */
         const path = __non_webpack_require__('path')
         if (${JSON.stringify(isMainProcess)}) {
           ${usedFlags ? 'process.dlopen(module,' : 'module.exports=__non_webpack_require__('}
           ${isFromNodeModules ? '' : 'path.join(__dirname,'}
           ${JSON.stringify(fromBuildOutputModulePath)}
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
           ${JSON.stringify(fromRootContextModulePath)}
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
