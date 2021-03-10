module.exports = {
  rendererContextAlias: '@',
  rendererContext: 'src/renderer/',
  rendererEntry: 'src/renderer/index.tsx',
  rendererPublicAssets: 'public/web/',
  mainContextAlias: '#',
  mainContext: 'src/main/',
  mainEntry: 'src/main/index.ts',
  themePlugin: {
    themes: ['src/renderer/themes/*.scss'],
  },
  localePlugin: {
    extract: false,
  },
}
