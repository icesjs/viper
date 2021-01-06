import { useState, useEffect, useCallback } from 'react'
import { defaultLocale, getCurrentLocale, setCurrentLocale, subscribe } from './context'

/**
 * 获取区域化的内容。
 * @param locale
 * @param fallback
 * @param plugins
 * @param definitions
 * @param key
 * @param args
 * @return string
 */
function getLocaleMessage({ locale, fallback, plugins, definitions }, key, ...args) {
  const getMessage = (dataList, preference) => {
    for (const { locale, data } of dataList) {
      // 数据集要是一个对象，才进行取值
      if (data && typeof data === 'object') {
        const message = data[key]
        if (typeof message !== 'undefined') {
          if (locale !== preference) {
            if (process.env.NODE_ENV === 'development') {
              console.warn(
                `Missing message with key of "${key}" for locale [${preference}], using default message of locale [${locale}] as fallback.`
              )
            }
          }
          // 应用插件，插件必须返回处理后的字符串，并作为后一个插件的输入
          return plugins.reduce((message, plugin) => plugin(message, [...args], locale), message)
        }
      }
    }
    return ''
  }
  // 尝试的locale
  const locales = new Set([
    locale,
    locale.replace(/[-_].+/, ''),
    fallback,
    fallback.replace(/[-_].+/, ''),
  ])
  const dataList = [...locales].map((locale) => ({ locale, data: definitions[locale] }))
  const message = getMessage(dataList, locale)
  if (message === '' || typeof message === 'undefined') {
    throw new Error(`Unknown localized message for key: ${key}`)
  }
  return message
}

/**
 * 使用区域语言。
 * @param plugins 插件函数，或包含插件函数的数组。
 * @param fallback 当前区域语言没有匹配到相关定义时，备选的区域语言。默认值为默认的区域语言设置。
 * @param definitions 区域语言内容定义。
 */
function useLocale(plugins = null, fallback = defaultLocale, definitions = {}) {
  // 用到的转换插件
  const usedPlugins = (Array.isArray(plugins) ? [...plugins] : [plugins]).filter(
    (plugin) => typeof plugin === 'function'
  )
  // 定义locale状态
  const [locale, setLocale] = useState(getCurrentLocale())
  // 订阅区域语言更新
  useEffect(() => subscribe(setLocale), [])
  // 定义语言转换方法
  const translate = useCallback(
    getLocaleMessage.bind(null, { locale, fallback, definitions, plugins: usedPlugins }),
    [locale, fallback, definitions, ...usedPlugins]
  )
  return [translate, setCurrentLocale, locale]
}

// 导出hooks
export { useLocale, setCurrentLocale as setLocale, getCurrentLocale as getLocale }
