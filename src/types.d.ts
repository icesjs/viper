// 公用文件用于定义ts类型

// 定义区域语言模块
declare module '*.yml' {
  export interface TranslateFunction<T> {
    (key: string, ...data: T[]): string
  }
  export interface SetLocaleFunction {
    (locale: string): void
  }
  export type UseLocaleResult = [TranslateFunction, SetLocaleFunction]
  export function useLocale(
    plugins?: Function | Function[] | null,
    fallback?: string
  ): UseLocaleResult
  export const setLocale: SetLocaleFunction
  export default useLocale
}
declare module '*.yaml' {
  export * from '*.yml'
}

//
