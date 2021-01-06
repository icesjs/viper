const { addBeforeLoader, loaderByName } = require('@craco/craco')

module.exports = {
  //
  addBeforeLoader(webpackConfig, rule, tries) {
    const { module = {} } = webpackConfig
    const { rules = [] } = module
    module.rules = rules
    webpackConfig.module = module

    const getMatcher = (name) => (rule) => {
      let matched = loaderByName(name)(rule)
      if (!matched) {
        if (typeof rule === 'string') {
          matched = rule === name
        } else if (typeof rule.loader === 'string') {
          matched = rule.loader === name
        }
      }
      return matched
    }

    for (const name of tries) {
      if (addBeforeLoader(webpackConfig, getMatcher(name), rule).isAdded) {
        return
      }
    }
    rules.push(rule)
  },
}
