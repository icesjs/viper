// 产品模式预定义加载的代码
// 用来声明应用加载页面的路径信息
const path = require('path')
const url = require('url')

const indexHTMLPath = process.env.ELECTRON_RENDERER_INDEX_HTML_PATH
// 这里的 __dirname 为运行时的目录名，存在与app包中
const absIndexHTMLPath = path.join(__dirname, indexHTMLPath)
// 将绝对路径转换为file协议路径
const indexHTMLFileURL = url.format({
  protocol: 'file',
  pathname: absIndexHTMLPath,
})
// 设置为环境变量
process.env.ELECTRON_RENDERER_INDEX_HTML_URL = indexHTMLFileURL
