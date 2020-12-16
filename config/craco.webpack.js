//
const StyleLintPlugin = require('stylelint-webpack-plugin')
const {
  PROJECT_CONTEXT,
  RENDERER_CONTEXT,
  RENDERER_TARGET,
  RENDERER_CONTEXT_ALIAS,
} = require('./consts')

module.exports = {
  target: RENDERER_TARGET,
  alias: {
    [RENDERER_CONTEXT_ALIAS]: RENDERER_CONTEXT,
  },
  plugins: [
    new StyleLintPlugin({
      configBasedir: PROJECT_CONTEXT,
      context: RENDERER_CONTEXT,
      files: ['**/*.{css,scss}'],
    }),
  ],
}
