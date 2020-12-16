const { CSS_MODULE_LOCAL_IDENT_NAME } = require('./consts')

module.exports = {
  plugins: [
    [
      'babel-plugin-react-css-modules',
      {
        generateScopedName: CSS_MODULE_LOCAL_IDENT_NAME,
        attributeNames: { activeStyleName: 'activeClassName' },
      },
    ],
  ],
}
