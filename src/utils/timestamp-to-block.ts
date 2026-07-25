/**
 * timestamp-to-block.ts
 *
 * 利用区块 1 的时间戳锚点，按平均出块时间估算区块号。
 * 适用于 getLogs 的 block range 估算，误差约 ±100 区块。
 * 缓存年份→区块号结果，避免重复计算。
 */

// 锚点：Jouleverse 区块 1 的时间戳（2022-10-02 17:30:07 UTC）
const BLOCK_1_TIMESTAMP = 1664703007
// 平均出块时间缓存（秒），首次计算后缓存在模块级
let avgBlockTime: number | null = null
const yearCache = new Map<number, bigint>()

/**
 * 计算平均出块时间并对年份缓存做 warm-up
 * @param latestBlockNumber 最新区块号
 * @param latestTimestamp 最新区块时间戳（秒）
 */
export function initTimeCache(
  latestBlockNumber: bigint,
  latestTimestamp: number,
): void {
  const elapsed = latestTimestamp - BLOCK_1_TIMESTAMP
  const blocks = Number(latestBlockNumber)
  avgBlockTime = elapsed / blocks
  yearCache.clear()
}

/**
 * 估算给定年份 1 月 1 日 00:00 UTC 对应的区块号
 * 结果会被缓存，重复调用无额外开销
 */
export function estimateBlockForYear(year: number): bigint {
  if (yearCache.has(year)) return yearCache.get(year)!
  const ts = Date.UTC(year, 0, 1, 0, 0, 0, 0) / 1000
  // 如果年份早于链启动，返回区块 1
  if (ts <= BLOCK_1_TIMESTAMP) {
    yearCache.set(year, 1n)
    return 1n
  }
  const avg = avgBlockTime ?? 15.0
  const block = BigInt(Math.floor((ts - BLOCK_1_TIMESTAMP) / avg))
  yearCache.set(year, block)
  return block
}

/**
 * 获取某年包含的 block range（带缓冲）
 * 前后各扩展 200 区块，覆盖估算误差
 */
export function getYearBlockRange(year: number): { fromBlock: bigint; toBlock: bigint } {
  const from = estimateBlockForYear(year)
  const to = estimateBlockForYear(year + 1)
  return {
    fromBlock: from > 200n ? from - 200n : 1n,
    toBlock: to + 200n,
  }
}

/**
 * 获取可用年份列表（从链启动年份到当前年份）
 */
export function getAvailableYears(_latestBlockNumber: bigint): number[] {
  const launchYear = 2022
  const now = new Date()
  const years: number[] = []
  for (let y = launchYear; y <= now.getFullYear(); y++) {
    years.push(y)
  }
  return years
}
