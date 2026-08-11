// JNSVote 提案结果判定规则（移植自 v1 jnsVoteInfoController.js decisionMaker）
// V1 规则（提案 id <= 2）：支持率 ar > 2/3 且 代表率 rr > 1/2
// V2 规则（提案 id >= 3）：支持率 ar > 2/3 且 代表率 rr > 0.4
// 支持率 ar = 赞成票数 / (赞成 + 反对)
// 代表率 rr = 赞成票代表 JNS 持仓量 / JNS 总量快照

export type Decision = 1 | -1 | 0  // 1=通过, -1=未通过, 0=未出结果

export function jnsvoteDecision(
  proposalId: number,
  countVotesFor: bigint,
  countVotesAgainst: bigint,
  countJNSvotedFor: bigint,
  totalJNS: bigint
): Decision {
  const totalVotes = countVotesFor + countVotesAgainst
  if (totalVotes === 0n || totalJNS === 0n) return 0

  // 使用大数运算避免精度丢失：ar = countVotesFor / totalVotes，比较 ar > 2/3 ⇔ 3*countVotesFor > 2*totalVotes
  const arPass = countVotesFor * 3n > totalVotes * 2n

  // rr = countJNSvotedFor / totalJNS
  // V1: rr > 1/2 ⇔ 2*countJNSvotedFor > totalJNS
  // V2: rr > 0.4 ⇔ 5*countJNSvotedFor > 2*totalJNS
  let rrPass: boolean
  if (proposalId <= 2) {
    rrPass = countJNSvotedFor * 2n > totalJNS
  } else {
    rrPass = countJNSvotedFor * 5n > totalJNS * 2n
  }

  if (arPass && rrPass) return 1
  return -1
}

// 计算支持率百分比（0-100，保留 2 位小数）
export function approvalRate(countVotesFor: bigint, countVotesAgainst: bigint): number | null {
  const total = countVotesFor + countVotesAgainst
  if (total === 0n) return null
  return Number((countVotesFor * 10000n) / total) / 100
}

// 计算代表率百分比（0-100，保留 2 位小数）
export function representativeRate(countJNSvotedFor: bigint, totalJNS: bigint): number | null {
  if (totalJNS === 0n) return null
  return Number((countJNSvotedFor * 10000n) / totalJNS) / 100
}
