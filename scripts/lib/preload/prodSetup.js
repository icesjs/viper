// 产品模式预定义加载的代码
// 用来声明应用加载页面的路径信息
const path = require('path')
const url = require('url')

const relativeIndexHTMLPath = process.env.ELECTRON_APP_INDEX_HTML_PATH
// 这里的 __dirname 为运行时的目录名，存在于app包中
const absIndexHTMLPath = path.join(__dirname, relativeIndexHTMLPath)
// 将绝对路径转换为file协议路径
const indexHTMLFileURL = url.format({
  protocol: 'file',
  pathname: absIndexHTMLPath,
})
// 设置为环境变量
process.env.ELECTRON_APP_INDEX_HTML_URL = indexHTMLFileURL

// 禁用安全警告
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
