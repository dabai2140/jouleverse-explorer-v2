// @vitest-environment node
// 审计整改：通过 TypeScript AST 解析真实模块导入，不使用全文字符串匹配。
// 覆盖 src/views 下的嵌套视图，并避免注释、普通字符串造成假阳性。
//
// 第二轮加固（2026-11-10）：从「有没有人引用」升级为「从入口能不能走到」。
//
// 原实现的盲区（2026-11-09 审计实测）：断言只要求「views 下每个 .vue 被任一 src 模块引用」，
// 不要求「引用链能从入口出发」。于是删掉 src/router/index.ts 的 /validators 路由、
// 同时新增一个死模块 src/dead-gate-probe.ts（内容 export { default as V } from './views/Validators.vue'），
// 门禁 2 passed 全绿，而路由确已删除、页面已无任何入口。
// 缺陷只是从「无引用」变成「有引用但不可达」，门禁照样放行。
//
// 现在改为：从入口（src/main.ts + src/router/*）做传递闭包 BFS，只有真正可达的视图才算数。
import { expect, it } from 'vitest'
import * as ts from 'typescript'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, relative, resolve } from 'node:path'

const SOURCE_EXTENSIONS = ['', '.vue', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.vue', '/index.ts']

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, name.name)
    if (name.isDirectory()) walkFiles(file, out)
    else if (/\.(vue|ts|tsx|js|jsx|mjs|cjs)$/.test(name.name)) out.push(file)
  }
  return out
}

function readModuleSpecifiers(file: string, cache?: Map<string, string[]>): string[] {
  const cached = cache?.get(file)
  if (cached) return cached
  const text = readFileSync(file, 'utf8')
  const scripts = extname(file) === '.vue'
    ? [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1])
    : [text]
  const imports: string[] = []

  for (const script of scripts) {
    const source = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const visit = (node: ts.Node): void => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
        imports.push(node.moduleSpecifier.text)
      }
      if (ts.isCallExpression(node) && node.arguments.length === 1 &&
          ts.isStringLiteralLike(node.arguments[0]) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
           (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        imports.push(node.arguments[0].text)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  cache?.set(file, imports)
  return imports
}

/** 把模块说明符解析为仓库内的真实文件路径；解析不到（如外部依赖）返回 null。 */
function resolveSpecifier(specifier: string, sourceFile: string, srcDir: string): string | null {
  let base: string
  if (specifier.startsWith('@/')) base = resolve(srcDir, specifier.slice(2))
  else if (specifier.startsWith('/src/')) base = resolve(dirname(srcDir), specifier.slice(1))
  else if (specifier.startsWith('.')) base = resolve(dirname(sourceFile), specifier)
  else return null

  for (const extension of SOURCE_EXTENSIONS) {
    const candidate = extension ? base + extension : base
    // 必须是真实文件：`''` 扩展名会把 './components' 这类目录说明符一并命中，
    // 直接 readFileSync 会报 EISDIR。
    if (existsSync(candidate) && statSync(candidate).isFile()) return resolve(candidate)
  }
  return null
}

/** 入口：src/main.ts（应用引导）+ src/router 下所有模块（路由表）。 */
function findEntryFiles(repositoryRoot: string): string[] {
  const srcDir = resolve(repositoryRoot, 'src')
  const entries: string[] = []
  for (const candidate of ['main.ts', 'main.js', 'main.tsx', 'main.jsx']) {
    const file = join(srcDir, candidate)
    if (existsSync(file)) entries.push(resolve(file))
  }
  const routerDir = join(srcDir, 'router')
  if (existsSync(routerDir)) walkFiles(routerDir).forEach(file => entries.push(resolve(file)))
  return entries
}

/** 从入口出发的传递闭包：只有在这个集合里的文件才算「可达」。 */
export function findReachableFiles(repositoryRoot: string): Set<string> {
  const srcDir = resolve(repositoryRoot, 'src')
  const cache = new Map<string, string[]>()
  const reached = new Set<string>()
  const queue = findEntryFiles(repositoryRoot)

  while (queue.length > 0) {
    const file = queue.pop() as string
    if (reached.has(file)) continue
    reached.add(file)
    for (const specifier of readModuleSpecifiers(file, cache)) {
      const resolved = resolveSpecifier(specifier, file, srcDir)
      if (resolved && !reached.has(resolved)) queue.push(resolved)
    }
  }
  return reached
}

/** 返回从入口不可达的视图（即「页面存在但用户点不进去」）。 */
export function findOrphanViews(repositoryRoot: string): string[] {
  const srcDir = resolve(repositoryRoot, 'src')
  const viewsDir = resolve(srcDir, 'views')
  if (!existsSync(viewsDir)) return []
  const views = walkFiles(viewsDir).filter(file => extname(file) === '.vue')
  // AST 解析是热点：每个源文件只解析一次（含 BFS 与视图枚举两处复用同一 cache）。
  // 不缓存时 22 视图 × 80 源文件 ≈ 1760 次解析，全量跑会超过默认 5s 超时。
  const reached = findReachableFiles(repositoryRoot)

  return views
    .filter(view => !reached.has(resolve(view)))
    .map(view => relative(repositoryRoot, view).split('\\').join('/'))
    .sort()
}

it('每个 views 目录及嵌套目录中的视图都必须从入口可达', () => {
  const orphans = findOrphanViews(process.cwd())
  expect(orphans, `孤立视图（从 main/router 入口不可达）：\n${orphans.join('\n')}`).toEqual([])
})

it('检测嵌套视图，并忽略注释和普通字符串中的伪引用', () => {
  const root = mkdtempSync(join(tmpdir(), 'route-gap-'))
  try {
    mkdirSync(join(root, 'src/views/nested'), { recursive: true })
    mkdirSync(join(root, 'src/router'), { recursive: true })
    writeFileSync(join(root, 'src/views/Home.vue'), '<template><div /></template>')
    writeFileSync(join(root, 'src/views/nested/Child.vue'), '<template><div /></template>')
    writeFileSync(join(root, 'src/router/index.ts'), [
      '// import("../views/Home.vue") is only a comment',
      'const note = "../views/nested/Child.vue"',
      'export const routes = [{ component: () => import("../views/Home.vue") }]',
    ].join('\n'))
    expect(findOrphanViews(root)).toEqual(['src/views/nested/Child.vue'])
    writeFileSync(join(root, 'src/router/index.ts'),
      'export const routes = [{ component: () => import("../views/Home.vue") }, { component: () => import("../views/nested/Child.vue") }]')
    expect(findOrphanViews(root)).toEqual([])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// 反向用例：这正是 2026-11-09 实测出的绕过手法——删掉路由，再用一个死模块「引用」住视图。
// 旧实现（只查「有没有人引用」）会放行；新实现必须报孤立。
it('删除路由但保留死模块引用时，必须报为孤立（不得因「有引用」而放行）', () => {
  const root = mkdtempSync(join(tmpdir(), 'route-gap-dead-'))
  try {
    mkdirSync(join(root, 'src/views'), { recursive: true })
    mkdirSync(join(root, 'src/router'), { recursive: true })
    writeFileSync(join(root, 'src/views/Home.vue'), '<template><div /></template>')
    writeFileSync(join(root, 'src/views/Validators.vue'), '<template><div /></template>')
    // 路由里只有 Home —— Validators 的路由被「删掉」了
    writeFileSync(join(root, 'src/router/index.ts'),
      'export const routes = [{ component: () => import("../views/Home.vue") }]')
    // 死模块：没有任何入口引用它，但它引用了 Validators
    writeFileSync(join(root, 'src/dead-gate-probe.ts'),
      "export { default as V } from './views/Validators.vue'")

    expect(findOrphanViews(root)).toEqual(['src/views/Validators.vue'])

    // 把路由补回来（真正可达）后应当转绿
    writeFileSync(join(root, 'src/router/index.ts'),
      'export const routes = [{ component: () => import("../views/Home.vue") }, { component: () => import("../views/Validators.vue") }]')
    expect(findOrphanViews(root)).toEqual([])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// 反向用例：死模块链条再长（A → B → Validators），只要 A 从入口不可达，就仍然要报。
it('多级不可达引用链不得让视图冒充可达', () => {
  const root = mkdtempSync(join(tmpdir(), 'route-gap-chain-'))
  try {
    mkdirSync(join(root, 'src/views'), { recursive: true })
    mkdirSync(join(root, 'src/router'), { recursive: true })
    writeFileSync(join(root, 'src/views/Home.vue'), '<template><div /></template>')
    writeFileSync(join(root, 'src/views/Validators.vue'), '<template><div /></template>')
    writeFileSync(join(root, 'src/router/index.ts'),
      'export const routes = [{ component: () => import("../views/Home.vue") }]')
    writeFileSync(join(root, 'src/dead-a.ts'), "export * from './dead-b'")
    writeFileSync(join(root, 'src/dead-b.ts'), "export { default as V } from './views/Validators.vue'")

    expect(findOrphanViews(root)).toEqual(['src/views/Validators.vue'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
