// 公用文件用于定义ts类型

type Nullable<T> = T | null

interface AppDomain {}

interface API {}

declare interface Window {
  domain: AppDomain
  api: API
}
