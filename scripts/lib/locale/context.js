// 默认的区域语言设置
export const defaultLocale = process.env.REACT_APP_DEFAULT_LOCALE || 'zh-CN'

// 当前已订阅区域语言变化的处理程序
const consumers = []

// 当前设置的区域语言
let currentLocale = defaultLocale

// 获取当前生效的区域语言
export function getCurrentLocale() {
  return currentLocale
}

// 标记是否在更新区域语言设置，避免无限循环设置
let isUpdating = false

// 设置当前生效的区域语言
export function setCurrentLocale(locale) {
  if (isUpdating) {
    return
  }
  if (!locale || typeof locale !== 'string') {
    throw new Error('Locale must be a valid string')
  }
  currentLocale = locale
  try {
    isUpdating = true
    for (const handle of consumers) {
      handle(locale)
    }
  } catch (e) {
    throw e
  } finally {
    isUpdating = false
  }
}

// 订阅区域语言变化
export function subscribe(handle) {
  if (typeof handle !== 'function') {
    throw new Error('Handle is not a function')
  }
  consumers.push(handle)
  return function unsubscribe() {
    consumers.splice(consumers.indexOf(handle), 1)
  }
}
