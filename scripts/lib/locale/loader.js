const path = require('path')
const yaml = require('js-yaml')
const loaderUtils = require('loader-utils')

module.exports = function (source) {
  // 解析语言配置
  let definitions = yaml.safeLoad(source, {
    json: true,
    onWarning: (err) => {
      const warning = new Error(err)
      warning.name = 'Warning'
      warning.stack = ''
      this.emitWarning(warning)
    },
  })
  if (!definitions || typeof definitions !== 'object') {
    definitions = {}
  }
  const hooksModule = path.join(__dirname, 'hooks.js')
  // 导出模块定义
  return `
    import { useLocale, setLocale, getLocale } from ${loaderUtils.stringifyRequest(
      this,
      hooksModule
    )}
    const definitions = ${JSON.stringify(definitions)}
    const useLocaleMessage = (plugins, fallback) => useLocale(plugins, fallback, definitions)
    export { useLocaleMessage as useLocale, setLocale, getLocale }
    export default useLocaleMessage
  `
}
