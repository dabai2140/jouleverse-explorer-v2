// pin 表达式求值器（轻量安全子集，递归下降解析，不使用 eval/Function）
//
// 支持的语法：
//   - 字面量：数字（含小数）、字符串（单/双引号）、true / false
//   - 变量：$name（name 可为中文/字母/数字/下划线）、内建 now（当前秒时间戳）
//   - 取值：$v[4]（数组下标）、$v.name（对象属性）
//   - 运算符：+ - * / % ｜ 比较 == != > >= < <= ｜ 逻辑 && || ! ｜ 三元 ?:
//   - 括号
//
// 值语义：bigint 参与运算时转 number（展示类指标可接受；超大数精度场景勿用算术），
// 非数值运算（字符串拼接、比较、bool）保持原类型。

export type PinValue = number | string | boolean | bigint | PinValue[] | { [k: string]: PinValue }

export type PinEnv = Record<string, PinValue>

// ---------- Tokenizer ----------

type Token =
  | { type: 'num'; value: number }
  | { type: 'str'; value: string }
  | { type: 'var'; name: string } // $name
  | { type: 'ident'; name: string } // now / true / false
  | { type: 'op'; value: string } // 运算符与括号
  | { type: 'eof' }

const IDENT_RE = /[\w\u4e00-\u9fa5]/

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
      continue
    }
    if (ch >= '0' && ch <= '9') {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j])) j++
      const num = Number(src.slice(i, j))
      tokens.push({ type: 'num', value: num })
      i = j
      continue
    }
    if (ch === "'" || ch === '"') {
      const quote = ch
      let j = i + 1
      let out = ''
      while (j < src.length && src[j] !== quote) {
        if (src[j] === '\\' && j + 1 < src.length) {
          out += src[j + 1]
          j += 2
        } else {
          out += src[j]
          j++
        }
      }
      if (j >= src.length) throw new Error(`pin 表达式字符串未闭合: ${src.slice(i, i + 20)}...`)
      tokens.push({ type: 'str', value: out })
      i = j + 1
      continue
    }
    if (ch === '$') {
      let j = i + 1
      if (j < src.length && (IDENT_RE.test(src[j]) || src[j] === '_')) {
        while (j < src.length && (IDENT_RE.test(src[j]) || src[j] === '_')) j++
        tokens.push({ type: 'var', name: src.slice(i + 1, j) })
        i = j
        continue
      }
      throw new Error(`pin 表达式变量名非法: ${src.slice(i, i + 10)}...`)
    }
    if (IDENT_RE.test(ch) || ch === '_') {
      let j = i
      while (j < src.length && (IDENT_RE.test(src[j]) || src[j] === '_')) j++
      tokens.push({ type: 'ident', name: src.slice(i, j) })
      i = j
      continue
    }
    // 运算符（含双字符）
    const two = src.slice(i, i + 2)
    if (['==', '!=', '>=', '<=', '&&', '||'].includes(two)) {
      tokens.push({ type: 'op', value: two })
      i += 2
      continue
    }
    if ('+-*/%<>!?:().[]'.includes(ch)) {
      tokens.push({ type: 'op', value: ch })
      i++
      continue
    }
    throw new Error(`pin 表达式无法解析的字符: "${ch}"`)
  }
  tokens.push({ type: 'eof' })
  return tokens
}

// ---------- Parser (递归下降) ----------

class Parser {
  private pos = 0
  private tokens: Token[]

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private peek(): Token {
    return this.tokens[this.pos]
  }
  private next(): Token {
    return this.tokens[this.pos++]
  }
  private expectOp(v: string) {
    const t = this.next()
    if (t.type !== 'op' || t.value !== v) throw new Error(`pin 表达式语法错误: 期望 "${v}"`)
  }

  parse(): PinValue {
    return this.ternary()
  }

  private ternary(): PinValue {
    const cond = this.or()
    if (this.peek().type === 'op' && (this.peek() as { value: string }).value === '?') {
      this.next()
      const a = this.ternary()
      this.expectOp(':')
      const b = this.ternary()
      return truthy(cond) ? a : b
    }
    return cond
  }

  private or(): PinValue {
    let left = this.and()
    while (this.peek().type === 'op' && (this.peek() as { value: string }).value === '||') {
      this.next()
      const right = this.and()
      left = truthy(left) || truthy(right)
    }
    return left
  }

  private and(): PinValue {
    let left = this.equality()
    while (this.peek().type === 'op' && (this.peek() as { value: string }).value === '&&') {
      this.next()
      const right = this.equality()
      left = truthy(left) && truthy(right)
    }
    return left
  }

  private equality(): PinValue {
    let left = this.relational()
    for (;;) {
      const t = this.peek()
      if (t.type === 'op' && (t.value === '==' || t.value === '!=')) {
        this.next()
        const right = this.relational()
        left = t.value === '==' ? looseEq(left, right) : !looseEq(left, right)
      } else return left
    }
  }

  private relational(): PinValue {
    let left = this.additive()
    for (;;) {
      const t = this.peek()
      if (t.type === 'op' && ['<', '<=', '>', '>='].includes(t.value)) {
        this.next()
        const right = this.additive()
        const l = toNum(left)
        const r = toNum(right)
        switch (t.value) {
          case '<': left = l < r; break
          case '<=': left = l <= r; break
          case '>': left = l > r; break
          case '>=': left = l >= r; break
        }
      } else return left
    }
  }

  private additive(): PinValue {
    let left = this.multiplicative()
    for (;;) {
      const t = this.peek()
      if (t.type === 'op' && (t.value === '+' || t.value === '-')) {
        this.next()
        const right = this.multiplicative()
        if (t.value === '+') {
          if (typeof left === 'string' || typeof right === 'string') left = `${left}${right}`
          else left = toNum(left) + toNum(right)
        } else left = toNum(left) - toNum(right)
      } else return left
    }
  }

  private multiplicative(): PinValue {
    let left = this.unary()
    for (;;) {
      const t = this.peek()
      if (t.type === 'op' && ['*', '/', '%'].includes(t.value)) {
        this.next()
        const right = this.unary()
        const l = toNum(left)
        const r = toNum(right)
        if (t.value === '*') left = l * r
        else if (t.value === '/') left = r === 0 ? NaN : l / r
        else left = r === 0 ? NaN : l % r
      } else return left
    }
  }

  private unary(): PinValue {
    const t = this.peek()
    if (t.type === 'op' && (t.value === '!' || t.value === '-')) {
      this.next()
      const v = this.unary()
      return t.value === '!' ? !truthy(v) : -toNum(v)
    }
    return this.postfix()
  }

  private postfix(): PinValue {
    let v = this.primary()
    for (;;) {
      const t = this.peek()
      if (t.type === 'op' && t.value === '[') {
        this.next()
        const idx = this.additive()
        this.expectOp(']')
        const arr = v as unknown
        if (Array.isArray(arr)) v = arr[Math.trunc(toNum(idx))] as PinValue
        else throw new Error('pin 表达式: 对非数组取值 [n]')
      } else if (t.type === 'op' && t.value === '.') {
        this.next()
        const nameTok = this.next()
        if (nameTok.type !== 'ident') throw new Error('pin 表达式: . 后需跟属性名')
        const obj = v as unknown
        if (obj && typeof obj === 'object') v = (obj as Record<string, PinValue>)[nameTok.name]
        else throw new Error('pin 表达式: 对非对象取属性')
      } else return v
    }
  }

  private primary(): PinValue {
    const t = this.next()
    switch (t.type) {
      case 'num': return t.value
      case 'str': return t.value
      case 'var': {
        const env = this.env
        if (!(t.name in env)) throw new Error(`pin 表达式: 未定义的引用 $${t.name}`)
        return env[t.name]
      }
      case 'ident':
        if (t.name === 'true') return true
        if (t.name === 'false') return false
        if (t.name === 'now') return Date.now() / 1000
        throw new Error(`pin 表达式: 未知标识符 "${t.name}"`)
      case 'op':
        if (t.value === '(') {
          const v = this.ternary()
          this.expectOp(')')
          return v
        }
        throw new Error(`pin 表达式: 意外的 "${t.value}"`)
      default:
        throw new Error('pin 表达式: 语法错误')
    }
  }

  env: PinEnv = {}
}

// ---------- 辅助 ----------

function truthy(v: PinValue): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0 && !Number.isNaN(v)
  if (typeof v === 'string') return v.length > 0
  return Boolean(v)
}

function toNum(v: PinValue): number {
  if (typeof v === 'bigint') return Number(v) // bigint 参与运算时转 number
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  const n = Number(v)
  return Number.isNaN(n) ? NaN : n
}

function looseEq(a: PinValue, b: PinValue): boolean {
  // bigint 与 number 比较时统一转 number
  if ((typeof a === 'bigint' || typeof b === 'bigint')) {
    return toNum(a) === toNum(b)
  }
  return a === b
}

// ---------- 对外接口 ----------

/** 求值 pin 表达式；返回原始值（含 bigint，未参与运算时保留） */
export function evaluatePinExpr(expr: string, env: PinEnv): PinValue {
  const tokens = tokenize(expr)
  const parser = new Parser(tokens)
  parser.env = env
  return parser.parse()
}

/** 提取表达式里引用的所有 $变量 名（用于依赖排序） */
export function extractPinRefs(expr: string): string[] {
  const refs = new Set<string>()
  const re = /\$([\w\u4e00-\u9fa5]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(expr)) !== null) refs.add(m[1])
  return [...refs]
}
