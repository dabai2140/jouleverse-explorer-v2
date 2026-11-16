// @vitest-environment node
import { expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { compareBaseline, parseDocBaseline, readNodeTap, readVitestJson } from '../scripts/check-test-baseline'

/**
 * 基线门禁自身的用例（2026-11-16）。
 *
 * 要点：这道闸的价值全在「会失败」——正向能过只是及格线。
 * 所以下面「负向」一组必须覆盖真实发生过的腐烂形态：
 * vitest 涨了没改文档 / files 涨了没改 / node:test 涨了没改 / 合计对不上 / 口径提醒行忘了同步 / 文档自身不自洽。
 */

const baselineLine =
  '**当前基线**（`explorer-v2` 分支 `abc1234`，2026-11-16 实测）：`npm run build` EXIT 0 / `vitest run` **276 passed**（23 files）/ `node --test tests/jvaddress.test.ts` **3 passed**（合计 **279** 条）。'
const counterLine = '> ⚠️ 计数口径提醒：`npm test` = vitest **276** + node:test 3 = **279 条**。别抄错。'
const goodDoc = `## 四、代码质量\n\n${baselineLine}\n\n${counterLine}\n`

const measured = { vitestPassed: 276, vitestFiles: 23, vitestFailed: 0, nodePassed: 3, nodeFailed: 0 }

it('真实仓库：基线行可解析且文档自身自洽', () => {
  const { baseline, errors } = parseDocBaseline(readFileSync('docs/feature-roadmap.md', 'utf8'))
  expect(errors).toEqual([])
  expect(baseline).not.toBeNull()
  // 故意不硬编码具体用例数：写死数字会让本用例自己成为下一个腐烂点（这用例的职责只是「能解析、自洽」，
  // 「与实测相等」由 CI 的 `npm run check:baseline --run` 负责——那里拿的是**真跑出来的数字**）。
  const doc = baseline!
  expect(doc.total).toBe(doc.vitestPassed + doc.nodePassed)
  expect(doc.counter).not.toBeNull()
  expect(doc.counter).toEqual({ vitest: doc.vitestPassed, node: doc.nodePassed, total: doc.total })
  expect(doc.vitestFiles).toBeGreaterThan(0)
})

it('解析出基线行与计数口径提醒的四个 + 三个数字', () => {
  const { baseline, errors } = parseDocBaseline(goodDoc)
  expect(errors).toEqual([])
  expect(baseline).toEqual({
    vitestPassed: 276,
    vitestFiles: 23,
    nodePassed: 3,
    total: 279,
    counter: { vitest: 276, node: 3, total: 279 },
  })
})

it.each([
  ['基线行缺失', '## 四、代码质量\n\n没有基线行。\n'],
  ['基线行格式不再可解析', goodDoc.replace('**276 passed**（23 files）', '276 passed / 23 files')],
  ['合计格式丢失', goodDoc.replace('（合计 **279** 条）', '合计 279')],
  ['计数口径提醒行格式坏掉', goodDoc.replace('vitest **276** + node:test 3 = **279 条**', 'vitest 276 加 node 3 等于 279')],
])('解析失败要报错而不是静默放行：%s', (_name, doc) => {
  const { errors } = parseDocBaseline(doc)
  expect(errors.length).toBeGreaterThan(0)
})

it.each([
  ['vitest 涨了没改文档（11-16 真实形态）', { ...measured, vitestPassed: 280 }, { vitestPassed: 276 }],
  ['files 涨了没改文档', { ...measured, vitestFiles: 24 }, { vitestFiles: 23 }],
  ['node:test 涨了没改文档', { ...measured, nodePassed: 4 }, { nodePassed: 3 }],
])('负向：%s → 必须失败', (_name, actual, docPatch) => {
  const { baseline } = parseDocBaseline(goodDoc)
  const errors = compareBaseline({ ...baseline!, ...docPatch }, actual as typeof measured)
  expect(errors.length).toBeGreaterThan(0)
})

it('负向：合计对不上 → 必须失败', () => {
  const { baseline } = parseDocBaseline(goodDoc)
  const errors = compareBaseline({ ...baseline!, total: 275 }, measured)
  expect(errors.some(error => error.includes('合计'))).toBe(true)
})

it('负向：文档自身不自洽（合计 ≠ vitest + node）→ 必须失败', () => {
  const { baseline } = parseDocBaseline(goodDoc)
  const errors = compareBaseline({ ...baseline!, total: 300, counter: null }, measured)
  expect(errors.some(error => error.includes('不自洽'))).toBe(true)
})

it('负向：口径提醒行忘了同步 → 必须失败', () => {
  const { baseline } = parseDocBaseline(goodDoc)
  const errors = compareBaseline({ ...baseline!, counter: { vitest: 272, node: 3, total: 275 } }, measured)
  expect(errors.some(error => error.includes('计数口径提醒'))).toBe(true)
})

it('负向：测试自身有失败 → 拒绝给绿灯', () => {
  const { baseline } = parseDocBaseline(goodDoc)
  const errors = compareBaseline(baseline!, { ...measured, vitestFailed: 2 })
  expect(errors.some(error => error.includes('基线比对无意义'))).toBe(true)
})

it('readVitestJson / readNodeTap 按真实产物格式取数', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'baseline-gate-'))
  try {
    // 形状取自 vitest 5 的 JSON reporter：顶层 numPassedTests + testResults[].assertionResults
    const jsonPath = resolve(dir, 'vitest.json')
    writeFileSync(
      jsonPath,
      JSON.stringify({
        numTotalTests: 5,
        numPassedTests: 5,
        numFailedTests: 0,
        testResults: [
          { name: '/a.spec.ts', assertionResults: [{ status: 'passed' }, { status: 'passed' }] },
          { name: '/b.spec.ts', assertionResults: [{ status: 'passed' }] },
          { name: '/c.spec.ts', assertionResults: [{ status: 'passed' }, { status: 'passed' }] },
          // 无断言的空文件不应计入 files（与 route-gap「拒绝空目录假绿」同精神）
          { name: '/empty.spec.ts', assertionResults: [] },
        ],
      }),
    )
    expect(readVitestJson(jsonPath)).toEqual({ passed: 5, files: 3, failed: 0 })

    // 形状取自 node:test 的 TAP：以汇总行 # pass / # fail 为权威
    const tapPath = resolve(dir, 'node.tap')
    writeFileSync(tapPath, 'TAP version 13\nok 1 - a\nok 2 - b\nnot ok 3 - c\n1..3\n# tests 3\n# pass 2\n# fail 1\n')
    expect(readNodeTap(tapPath)).toEqual({ passed: 2, failed: 1 })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

it('负向：产物缺少 TAP 汇总行 → 抛错而非当作 0', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'baseline-gate-'))
  try {
    const tapPath = resolve(dir, 'broken.tap')
    writeFileSync(tapPath, 'TAP version 13\nok 1 - a\n')
    expect(() => readNodeTap(tapPath)).toThrow()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
