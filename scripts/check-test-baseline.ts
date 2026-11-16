/**
 * 测试基线一致性门禁（2026-11-16 新增，治「基线腐烂」）
 *
 * 背景：`docs/feature-roadmap.md` 的「当前基线」一行把 vitest / node:test 用例数当作健康度锚点，
 * 但这个数字**从来没有任何会失败的检查绑定它**，靠「记得同批更新」的自觉维持，
 * 于是反复腐烂：11-10 落后 231 条、11-11 落后 238 条、11-16 落后 4 条。
 *
 * 判据：文档里写的 vitest passed / files、node:test passed、合计，必须与**实测**逐项相等。
 * 不相等即 fail —— 加用例的 PR 必须同批改文档，否则 CI 红。
 *
 * 用法：
 *   node scripts/check-test-baseline.ts --run
 *       自己跑一遍 vitest（JSON reporter）+ node:test（TAP reporter）再比对（CI 用这个）
 *   node scripts/check-test-baseline.ts --vitest-json <path> --node-tap <path>
 *       复用已有产物比对，不重复跑测试
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROADMAP = 'docs/feature-roadmap.md'
const NODE_TEST_FILE = 'tests/jvaddress.test.ts'
const ARTIFACT_DIR = '.test-artifacts'

export interface DocBaseline {
  vitestPassed: number
  vitestFiles: number
  nodePassed: number
  total: number
  /** 「计数口径提醒」一行里的三个数字，缺该行时为 null */
  counter: { vitest: number; node: number; total: number } | null
}

export interface Measured {
  vitestPassed: number
  vitestFiles: number
  vitestFailed: number
  nodePassed: number
  nodeFailed: number
}

/** 从路线图文本解析「当前基线」行 + 计数口径提醒行。缺失的字段直接报错，不做默认值兜底。 */
export function parseDocBaseline(markdown: string): { baseline: DocBaseline | null; errors: string[] } {
  const errors: string[] = []
  const lines = markdown.split(/\r?\n/)
  const baselineLine = lines.find(line => line.includes('**当前基线**'))
  if (!baselineLine) {
    return { baseline: null, errors: ['未找到「**当前基线**」行'] }
  }
  const vitest = /\*\*(\d+) passed\*\*\s*（\s*(\d+) files\s*）/.exec(baselineLine)
  const node = /\*\*(\d+) passed\*\*\s*（合计\s*\*\*(\d+)\*\*\s*条）/.exec(baselineLine)
  if (!vitest) errors.push('基线行缺少 `vitest run` **N passed**（M files）格式')
  if (!node) errors.push('基线行缺少 `node --test` **N passed**（合计 **T** 条）格式')
  const counterLine = lines.find(line => /`npm test`\s*=\s*vitest/.test(line))
  // 去掉强调符与反引号再匹配，避免 `**279 条**` 这类「加粗包住单位」的写法把正则卡死
  const counterMatch = counterLine
    ? /vitest(\d+)\+node:test(\d+)=(\d+)条/.exec(counterLine.replace(/[*`\s]/g, ''))
    : null
  if (counterLine && !counterMatch) errors.push('计数口径提醒行格式无法解析')
  if (!vitest || !node) return { baseline: null, errors }
  const baseline: DocBaseline = {
    vitestPassed: Number(vitest[1]),
    vitestFiles: Number(vitest[2]),
    nodePassed: Number(node[1]),
    total: Number(node[2]),
    counter: counterMatch
      ? { vitest: Number(counterMatch[1]), node: Number(counterMatch[2]), total: Number(counterMatch[3]) }
      : null,
  }
  return { baseline, errors }
}

/** 纯比对：文档数字 vs 实测数字。返回违例描述，空数组即通过。 */
export function compareBaseline(baseline: DocBaseline, measured: Measured): string[] {
  const errors: string[] = []
  if (measured.vitestFailed > 0) errors.push(`vitest 实测有 ${measured.vitestFailed} 条失败，基线比对无意义（先修测试）`)
  if (measured.nodeFailed > 0) errors.push(`node:test 实测有 ${measured.nodeFailed} 条失败，基线比对无意义（先修测试）`)
  if (baseline.vitestPassed !== measured.vitestPassed) {
    errors.push(`vitest passed：文档 **${baseline.vitestPassed}** / 实测 **${measured.vitestPassed}**`)
  }
  if (baseline.vitestFiles !== measured.vitestFiles) {
    errors.push(`vitest files：文档 **${baseline.vitestFiles}** / 实测 **${measured.vitestFiles}**`)
  }
  if (baseline.nodePassed !== measured.nodePassed) {
    errors.push(`node:test passed：文档 **${baseline.nodePassed}** / 实测 **${measured.nodePassed}**`)
  }
  const measuredTotal = measured.vitestPassed + measured.nodePassed
  if (baseline.total !== measuredTotal) {
    errors.push(`合计：文档 **${baseline.total}** / 实测 **${measuredTotal}**（vitest ${measured.vitestPassed} + node ${measured.nodePassed}）`)
  }
  const docSum = baseline.vitestPassed + baseline.nodePassed
  if (baseline.total !== docSum) {
    errors.push(`文档自身不自洽：合计写 **${baseline.total}**，但 vitest ${baseline.vitestPassed} + node ${baseline.nodePassed} = ${docSum}`)
  }
  if (baseline.counter) {
    const c = baseline.counter
    if (c.vitest !== baseline.vitestPassed || c.node !== baseline.nodePassed || c.total !== baseline.total) {
      errors.push(
        `「计数口径提醒」与基线行不一致：提醒写 vitest ${c.vitest} + node:test ${c.node} = ${c.total}，基线行写 ${baseline.vitestPassed} + ${baseline.nodePassed} = ${baseline.total}`,
      )
    }
  }
  return errors
}

/** 解析 vitest 的 JSON reporter 产物。文件数取真实跑出断言的测试文件数，passed 取实测通过数。 */
export function readVitestJson(path: string): { passed: number; files: number; failed: number } {
  const report = JSON.parse(readFileSync(path, 'utf8')) as {
    numPassedTests?: number
    numFailedTests?: number
    testResults?: { assertionResults?: unknown[] }[]
  }
  const testResults = report.testResults ?? []
  const passed = report.numPassedTests ?? 0
  const failed = report.numFailedTests ?? 0
  const files = testResults.filter(file => (file.assertionResults ?? []).length > 0).length
  return { passed, files, failed }
}

/** 解析 node:test 的 TAP 产物。以 `# pass N` / `# fail N` 为权威，避免把子测试重复计入。 */
export function readNodeTap(path: string): { passed: number; failed: number } {
  const text = readFileSync(path, 'utf8')
  const pass = /^# pass (\d+)$/m.exec(text)
  const fail = /^# fail (\d+)$/m.exec(text)
  if (!pass) throw new Error(`TAP 产物缺少 "# pass N" 汇总行：${path}`)
  return { passed: Number(pass[1]), failed: fail ? Number(fail[1]) : 0 }
}

function runVitest(root: string): { passed: number; files: number; failed: number; exitCode: number } {
  mkdirSync(resolve(root, ARTIFACT_DIR), { recursive: true })
  const out = resolve(root, ARTIFACT_DIR, 'vitest.json')
  const bin = resolve(root, 'node_modules/.bin/vitest')
  if (!existsSync(bin)) throw new Error(`找不到 vitest 可执行文件：${bin}（先 npm ci）`)
  const result = spawnSync(bin, ['run', '--reporter=default', `--reporter=json`, `--outputFile.json=${out}`], {
    cwd: root,
    stdio: 'inherit',
  })
  if (!existsSync(out)) throw new Error(`vitest 未产出 JSON 报告：${out}`)
  return { ...readVitestJson(out), exitCode: result.status ?? 1 }
}

function runNodeTest(root: string): { passed: number; failed: number; exitCode: number } {
  mkdirSync(resolve(root, ARTIFACT_DIR), { recursive: true })
  const out = resolve(root, ARTIFACT_DIR, 'node-tap.txt')
  // 两个 reporter：spec 上屏给人看，tap 落盘给本门禁解析
  const result = spawnSync(
    process.execPath,
    [
      '--test',
      '--test-reporter=spec',
      '--test-reporter-destination=stdout',
      '--test-reporter=tap',
      `--test-reporter-destination=${out}`,
      NODE_TEST_FILE,
    ],
    { cwd: root, stdio: 'inherit' },
  )
  if (!existsSync(out)) throw new Error(`node:test 未产出 TAP 产物：${out}`)
  return { ...readNodeTap(out), exitCode: result.status ?? 1 }
}

export function checkRepository(root: string): string[] {
  const { baseline, errors } = parseDocBaseline(readFileSync(resolve(root, ROADMAP), 'utf8'))
  if (!baseline) return errors
  const vitest = runVitest(root)
  const nodeTest = runNodeTest(root)
  const measured: Measured = {
    vitestPassed: vitest.passed,
    vitestFiles: vitest.files,
    vitestFailed: vitest.failed,
    nodePassed: nodeTest.passed,
    nodeFailed: nodeTest.failed,
  }
  const violations = compareBaseline(baseline, measured)
  if (vitest.exitCode !== 0) violations.push(`vitest 退出码 ${vitest.exitCode}（测试未通过）`)
  if (nodeTest.exitCode !== 0) violations.push(`node:test 退出码 ${nodeTest.exitCode}（测试未通过）`)
  return [...errors, ...violations]
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const root = process.cwd()
  const args = process.argv.slice(2)
  const vitestJson = args.indexOf('--vitest-json')
  const nodeTap = args.indexOf('--node-tap')
  let errors: string[]
  if (vitestJson >= 0 && nodeTap >= 0) {
    const { baseline, errors: docErrors } = parseDocBaseline(readFileSync(resolve(root, ROADMAP), 'utf8'))
    if (!baseline) {
      errors = docErrors
    } else {
      const v = readVitestJson(args[vitestJson + 1]!)
      const n = readNodeTap(args[nodeTap + 1]!)
      errors = [
        ...docErrors,
        ...compareBaseline(baseline, {
          vitestPassed: v.passed,
          vitestFiles: v.files,
          vitestFailed: v.failed,
          nodePassed: n.passed,
          nodeFailed: n.failed,
        }),
      ]
    }
  } else {
    errors = checkRepository(root)
  }
  if (errors.length) {
    console.error('\n❌ 测试基线门禁未通过：\n')
    for (const error of errors) console.error('  - ' + error)
    console.error(`\n修法：把 ${ROADMAP} 的「**当前基线**」行与「计数口径提醒」行改成上面实测值。`)
    console.error('规则（本文件自订）：凡测试用例数有变化，当次 PR 必须同批更新该行。\n')
    process.exit(1)
  }
  console.log('✅ 测试基线与实测一致')
}
