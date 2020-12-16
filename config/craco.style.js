const { CSS_MODULE_LOCAL_IDENT_NAME } = require('./consts')

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
