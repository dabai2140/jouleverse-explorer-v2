// JNS 域名总览页的 feature-scoped i18n。
// 零依赖：纯字典 + 响应式 ref；默认语种为中文（zh-Hans）。
// 约束（vue-feature-i18n skill）：只服务自建页面，不改全局 App.vue；
// 以 locales/zh-Hans.ts 为键来源，其余语种标注 I18nDict，漏键/多键即编译失败。
//
// 当前仅保留中文单一语种；未来新增语种：
//   1. 新建 src/i18n/locales/<code>.ts，import type { I18nDict } from './zh-Hans'
//   2. 在下方 Lang / LANGS / DICTS 中登记
// 语言切换器会在「语种数 > 1」时自动显示，无需再改业务代码。

import { ref } from 'vue'
import zhHans from './locales/zh-Hans'
import type { I18nDict } from './locales/zh-Hans'

export type Lang = 'zh-Hans'

/** 语言切换器选项（仅含已接入语种） */
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'zh-Hans', label: '简体中文' },
]

/** 当前接入的语种（用于判断切换器是否显示） */
export const availableLocales: Lang[] = LANGS.map((l) => l.code)

export const DICTS: Record<Lang, I18nDict> = {
  'zh-Hans': zhHans,
}

const STORAGE_KEY = 'jns-domains.lang'

function readLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LANGS.some((l) => l.code === saved)) return saved as Lang
  } catch {
    // localStorage 不可用（隐私模式等）→ 回退默认中文
  }
  return 'zh-Hans'
}

/** 当前语种（响应式：模板中调用 t() 会自动重渲染） */
export const lang = ref<Lang>(readLang())

export function setLang(l: Lang): void {
  lang.value = l
  try { localStorage.setItem(STORAGE_KEY, l) } catch { /* 持久化失败静默 */ }
}

/**
 * 翻译：取当前语种字典，缺失返回键名本身。
 * 支持 {name} 形式的插值参数。
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const current: Record<string, string> = DICTS[lang.value] ?? DICTS['zh-Hans']
  let s = current[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v))
    }
  }
  return s
}
