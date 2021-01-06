// 公用文件用于定义ts类型

// 定义区域语言模块
declare module '*.yml' {
  export interface TranslateFunction<T> {
    (key: string, ...data: T[]): string
  }
  export interface SetLocaleFunction {
    (locale: string): void
  }
  export interface GetLocaleFunction {
    (): string
  }
  export interface PluginFunction<T> {
    (message: string | number, args: T[], locale: string): string | number
  }
  export type CurrentLocale = string
  export type UseLocaleResult = [TranslateFunction, SetLocaleFunction, CurrentLocale]
  export function useLocale(
    plugins?: PluginFunction | PluginFunction[] | null,
    fallback?: string
  ): UseLocaleResult
  export const setLocale: SetLocaleFunction
  export const getLocale: GetLocaleFunction
  export default useLocale
}
declare module '*.yaml' {
  export * from '*.yml'
}

//
