import { readdirSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

// 防止新增视图却沿用旧的“0 漏项”声明；不依赖固定行号或固定模块总数。
it('路线图覆盖所有视图、编号连续且自检数字与本分支一致', () => {
  const doc = readFileSync('docs/feature-roadmap.md', 'utf8')
  const section = doc.split('## 一、当前 v2 实现状态总览')[1]?.split('\n---')[0]
  expect(section).toBeDefined()
  const rows = [...section!.matchAll(/^\| (\d+) \|.*$/gm)]
  expect(rows.length).toBeGreaterThan(0)
  expect(rows.map(row => Number(row[1]))).toEqual(rows.map((_, i) => i + 1))
  const table = rows.map(row => row[0]).join('\n')
  const views = readdirSync('src/views/').filter(f => f.endsWith('.vue'))
  for (const view of views) expect(table, `MISSING ${view}`).toContain(`\`${view}\``)
  expect(section).toContain(`共 **${views.length}** 个视图`)
  expect(section).toContain(`本表 #1–#${rows.length}`)
})
