// @vitest-environment node
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

/**
 * 路线图「状态词 vs 真实路由」一致性门禁。
 *
 * 背景（2026-11-11 实测）：#32–#35 四个工具页在 11-05 已随 PR #65/#67/#68 合入并上线
 * （线上 dist 内 4 条路由全部可达，HTTP 200），但 §一 的状态列仍写「待审核发布 / 待审未上线」，
 * 连续多日给出错误的上线信号。此前的 route-gap / feature-roadmap 门禁只校验
 * 「视图是否登记、编号是否连续、计数是否正确」，**从不校验状态词本身的真伪**。
 *
 * 判据（可执行、非人工判断）：一条登记为「未上线/待审」的模块，其路由**不应**出现在
 * src/router/index.ts 里——路由已接线且页面可达，就是已上线。反之「✅ 已完成」的模块，
 * 其声明的路由**必须**真实存在，避免文档写了一个不存在的入口。
 */

const PENDING_WORDS = ['待审', '待审核', '未上线', '待发布', '待审核发布', '待审未上线']

interface Row { id: number; status: string; paths: string[] }

export function parseRows(markdown: string): Row[] {
  const section = markdown.split('## 一、当前 v2 实现状态总览')[1]?.split('\n---')[0]
  if (!section) throw new Error('状态总览章节缺失')
  const rows: Row[] = []
  for (const line of section.split('\n')) {
    const m = /^\|\s*(\d+)\s*\|([^|]+)\|([^|]+)\|(.*)$/.exec(line)
    if (!m) continue
    const paths = [...m[4]!.matchAll(/`(\/[A-Za-z0-9_:/.-]+)`/g)].map(x => x[1]!)
    rows.push({ id: Number(m[1]), status: m[3]!.trim(), paths })
  }
  return rows
}

export function routesOf(routerSource: string): Set<string> {
  return new Set([...routerSource.matchAll(/path:\s*'([^']+)'/g)].map(m => m[1]!))
}

/** 返回违例描述；空数组即通过。 */
export function checkStatusConsistency(markdown: string, routerSource: string): string[] {
  const errors: string[] = []
  const routes = routesOf(routerSource)
  for (const row of parseRows(markdown)) {
    const pending = PENDING_WORDS.some(w => row.status.includes(w))
    const wired = row.paths.filter(p => routes.has(p))
    if (pending && wired.length) {
      errors.push(`#${row.id} 标记为「${row.status}」，但路由 ${wired.join(', ')} 已接线（页面可直接访问）`)
    }
    if (!pending && row.paths.length && wired.length !== row.paths.length) {
      const missing = row.paths.filter(p => !routes.has(p))
      errors.push(`#${row.id} 标记为「${row.status}」，但声明的路由 ${missing.join(', ')} 在 src/router/index.ts 中不存在`)
    }
  }
  return errors
}

it('真实仓库：状态词与路由一致（#32–#35 已上线的登记为已完成）', () => {
  const errors = checkStatusConsistency(
    readFileSync('docs/feature-roadmap.md', 'utf8'),
    readFileSync('src/router/index.ts', 'utf8'),
  )
  expect(errors).toEqual([])
})

// 反向用例：证明这条门禁真的拦得住，而不是空转。
it.each([
  ['未上线却已接线', '| 1 | 面板 | 🚧 待审未上线 | `Panel.vue` | `/tools/panel` |', ["path: '/tools/panel'"], 1],
  ['待审核发布却已接线', '| 1 | 面板 | 🚧 本分支实现，待审核发布 | `Panel.vue` | `/tools/panel` |', ["path: '/tools/panel'"], 1],
  ['已完成但路由不存在', '| 1 | 面板 | ✅ 已完成 | `Panel.vue` | `/nowhere` |', ["path: '/tools/panel'"], 1],
] as const)('%s 应报错', (_name, row, paths, expected) => {
  const doc = `## 一、当前 v2 实现状态总览\n\n| # | 功能模块 | 状态 | 实现位置 | 备注 |\n|---|---|---|---|---|\n${row}\n\n## 二、\n`
  const router = `const routes = [\n${paths.map(p => `  { ${p} },`).join('\n')}\n]`
  expect(checkStatusConsistency(doc, router).length).toBe(expected)
})

it.each([
  ['未上线且未接线', '| 1 | 面板 | 🚧 待审未上线 | `Panel.vue` | `/tools/panel2` |'],
  ['已完成且路由存在', '| 1 | 面板 | ✅ 已完成 | `Panel.vue` | `/tools/panel` |'],
  ['无路由声明的行不误伤', '| 1 | 组件层 | ✅ 已完成 | `Panel.vue` + `use.ts` | 无独立路由 |'],
] as const)('%s 应通过', (_name, row) => {
  const doc = `## 一、当前 v2 实现状态总览\n\n| # | 功能模块 | 状态 | 实现位置 | 备注 |\n|---|---|---|---|---|\n${row}\n\n## 二、\n`
  const router = `const routes = [\n  { path: '/tools/panel' },\n]`
  expect(checkStatusConsistency(doc, router)).toEqual([])
})
