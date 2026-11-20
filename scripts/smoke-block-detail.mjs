#!/usr/bin/env node
/**
 * 真实链验证：区块详情页新增的三个字段（确认数 / extraData / 输入数据判据）
 *
 * 跑法：node scripts/smoke-block-detail.mjs
 * 判据：不只是「不报错」，而是拿链上真实区块逐项复核预期语义。
 */
import { createPublicClient, http, defineChain } from 'viem'
import {
  confirmationCount,
  decodeHexToText,
  hasInputData,
} from '../src/utils/block-detail.ts'

const chain = defineChain({
  id: 3666,
  name: 'Jouleverse Mainnet',
  nativeCurrency: { name: 'J', symbol: 'J', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.jnsdao.com'] } },
})

const client = createPublicClient({
  chain,
  transport: http('https://rpc.jnsdao.com', { timeout: 60_000 }),
})

let fail = 0
const ok = (msg) => console.log(`✅ ${msg}`)
const bad = (msg) => { console.error(`❌ ${msg}`); fail = 1 }

const latest = await client.getBlockNumber()
console.log(`最新块高：${latest}\n`)

// ── 1. 确认数：最新块自身必须是 0；往前 1000 块必须等于手算差值
{
  const target = latest - 1000n
  const blk = await client.getBlock({ blockNumber: target })
  const conf = confirmationCount(latest, blk.number)
  const expected = Number(latest - target)
  if (conf === expected) ok(`确认数：块 ${target} → ${conf}（= ${latest} - ${target}）`)
  else bad(`确认数不符：得到 ${conf}，应为 ${expected}`)

  const confLatest = confirmationCount(latest, latest)
  if (confLatest === 0) ok('最新块确认数为 0（无负数）')
  else bad(`最新块确认数应为 0，实得 ${confLatest}`)
}

// ── 2. extraData：clique 链的 extraData = vanity(32B) + signers + seal(65B)
{
  const blk = await client.getBlock({ blockNumber: latest })
  const raw = blk.extraData
  const decoded = decodeHexToText(raw)
  const rawBytes = (raw.length - 2) / 2
  console.log(`\nextraData: ${raw.slice(0, 40)}…（${rawBytes} 字节）`)
  console.log(
    `  解码结果: text=${decoded.text === null ? 'null' : JSON.stringify(decoded.text)}` +
    ` nonPrintable=${decoded.nonPrintable} bytes=${decoded.bytes}`,
  )

  if (decoded.bytes === rawBytes) ok(`字节数与链上一致（${rawBytes}）`)
  else bad(`字节数不符：解码 ${decoded.bytes}，链上 ${rawBytes}`)

  // clique extraData 含 65 字节 ECDSA seal 与 32 字节 vanity，必然有不可打印字节
  // → 解码器必须给出 text=null，而不是把控制字符吐到界面上
  if (decoded.nonPrintable > 0 && decoded.text === null) {
    ok(`含 ${decoded.nonPrintable} 个不可打印字节，正确判为「无文本」而非吐乱码`)
  } else if (decoded.nonPrintable === 0) {
    bad('clique extraData 不应全为可打印字符，解码器可能没在解真实字节')
  } else {
    bad('含不可打印字节却仍返回了 text，会把乱码显示到界面')
  }

  if (rawBytes >= 97) ok(`extraData 长度 ${rawBytes} ≥ 97（vanity 32 + seal 65）`)
  else bad(`extraData 长度异常偏短：${rawBytes}`)
}

// ── 3. 输入数据判据
// ⚠️ 本链极空闲：实测近 600 块连续空块、稀疏采样 30000 块全为空块。
// 所以不能「现扫最新区块找交易」，否则永远扫不到、静默跳过等于没验证。
// 锚点块是 2026-11-19 通过 Transfer 事件反查定位到的真实含 calldata 区块；
// 若该块数据变动（重组/裁剪），脚本会显式报错而不是跳过。
const ANCHOR_BLOCK = 8664408n
{
  const blk = await client.getBlock({ blockNumber: ANCHOR_BLOCK, includeTransactions: true })
  const txs = blk.transactions.filter((t) => typeof t !== 'string')
  console.log(`\n锚点区块 ${blk.number}：${txs.length} 笔交易`)

  if (txs.length === 0) {
    bad(`锚点区块 ${ANCHOR_BLOCK} 已无交易，锚点失效需重新选点`)
  } else {
    const withInput = txs.filter((t) => hasInputData(t.input))
    const withoutInput = txs.filter((t) => !hasInputData(t.input))
    if (withInput.length > 0) {
      const t = withInput[0]
      ok(`带 calldata 的交易被判为需展示：${t.hash.slice(0, 14)}…` +
        `（input ${t.input.length} 字符，selector ${t.input.slice(0, 10)}）`)
    } else {
      bad('锚点区块内本应有带 calldata 的交易，判据却全判为无输入数据')
    }
    if (withoutInput.length > 0) {
      ok(`${withoutInput.length} 笔纯转账被判为无需展示输入数据（对齐 v1 ng-if）`)
    } else {
      console.log('（该块内无纯转账，纯转账分支由单测覆盖）')
    }
  }

  const conf = confirmationCount(latest, blk.number)
  const expected = Number(latest - blk.number)
  if (conf === expected) ok(`锚点块确认数 ${conf} = ${latest} - ${blk.number}`)
  else bad(`锚点块确认数不符：${conf} vs ${expected}`)
}

console.log(fail ? '\n❌ 存在不符合项' : '\n✅ 全部通过')
process.exit(fail)
