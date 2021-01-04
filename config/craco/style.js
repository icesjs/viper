const { CSS_MODULE_LOCAL_IDENT_NAME } = require('../constants')

module.exports = {
  modules: {
    localIdentName: CSS_MODULE_LOCAL_IDENT_NAME,
  },
  sass: {
    loaderOptions: {
      implementation: require('sass'),
    },
  },
}
