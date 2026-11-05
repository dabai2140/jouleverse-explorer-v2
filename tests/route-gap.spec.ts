// @vitest-environment node
// 审计盲区补全（#69 后续）：路线图检查器只校验「视图是否被登记」，不校验「视图是否可达」。
// 本测试补上这条边界：src/views/ 下的每个 .vue 都必须被路由或其它源文件引用，否则用户永远打不开该页面。
// 判定用 `/Xxx.vue`（文件名前带斜杠）锚定 import 路径，避免 `MyHome.vue` 之类前缀误命中 `Home.vue`。
import { expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(vue|ts)$/.test(name)) out.push(p)
  }
  return out
}

it('每个 views 视图都必须可达（被路由或其它源文件引用）', () => {
  const viewsDir = resolve('src/views')
  const views = readdirSync(viewsDir).filter((f) => f.endsWith('.vue'))
  const sources = walk(resolve('src'))
  const orphans = views.filter((view) => {
    const ref = `/${view}` // 例如 /Home.vue；内嵌子视图（如 ./CoreIdSection.vue）同样命中
    return !sources.some((p) => {
      if (p.endsWith(join('views', view))) return false // 排除视图自身
      return readFileSync(p, 'utf8').includes(ref)
    })
  })
  expect(orphans, `孤立视图（无任何入口）：${orphans.join(', ')}`).toEqual([])
})
