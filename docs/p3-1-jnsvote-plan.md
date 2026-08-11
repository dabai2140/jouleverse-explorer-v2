# P3-1 JNSVote 治理投票 — V2 实现方案

**撰写**：2026-08-11（大白 💎）
**状态**：📋 方案已定，待排期实现
**参考源码**：`docs/reference/jnsvote/`（v1 完整代码，含合约/ABI/控制器/页面/部署配置）

---

## 一、合约信息（mainnet，已从 v1 deployments.js 确认）

| 合约 | 地址 | 说明 |
|------|------|------|
| **JNSVote** | `0xEf1f38e95dd7F4FB564535F9317ecB3Bd419DA50` | 治理投票合约（SBT） |
| JNS | `0xf8AbF36Bb2dc525b1E566d6B42F6Fd1BB2035b89` | 域名 NFT（持仓资格） |
| JTI | `0x826971d988d7d86Fdc9062A3f63E7b18D32Bc8EB` | JTI 认证标识（投票资格） |

> ⚠️ roadmap 中的"POAP 徽章验证"实为 **JNSVote SBT 徽章**（投票后 mint 的参与证明 NFT），与 Core ID 的 POPBadge 无关。资格校验实际依赖 **JTI + JNS 持仓**，徽章是投票产出物。

## 二、合约核心接口（viem 重写用）

### 只读（view）
| 方法 | 返回 | 用途 |
|------|------|------|
| `_totalProposals()` | uint | 提案总数 |
| `_proposals(uint id)` | Proposal 结构体 | 提案详情（title/link/timeBegin/timeEnd/countVotesFor/countVotesAgainst/countJNSvoted/countJNSvotedFor/totalJNS/disabled） |
| `_totalVotes()` | uint | 投票总数 |
| `_votes(uint tokenId)` | Vote 结构体 | 单票详情（proposal/voter/isFor/timestamp/hash） |
| `balanceOf(addr)` | uint | 某地址 JNSVote 徽章数（继承 ERC721） |
| `tokenOfOwnerByIndex(addr, i)` | uint | 徽章 tokenId 遍历 |
| `tokenURI(tokenId)` | string | 徽章 metadata（base64 JSON + SVG，含提案号/颜色） |
| `owner()` | address | 合约 owner |

### 写（需钱包签名）
| 方法 | 参数 | 说明 |
|------|------|------|
| `voteFor(uint proposal)` | 提案 id | 投赞成票 |
| `voteAgainst(uint proposal)` | 提案 id | 投反对票 |

**投票约束**（合约内 require）：
- 当前区块 ∈ (timeBegin, timeEnd)
- 未投过票（`_jti_voted[proposal][msg.sender] == 0`）
- JTI 余额 > 0（`jtiContract.balanceOf`）
- JNS 余额 > 0（`jnsContract.balanceOf`）
- 投票后自动 mint 1 枚 JNSVote SBT 徽章，并统计该地址全部 JNS 持仓计入票权

## 三、v1 页面功能 → V2 映射

| # | v1 功能 | V2 实现 | 优先级 |
|---|---------|---------|--------|
| 1 | 提案列表（遍历 `_totalProposals` + `_proposals(id)`） | 列表页 + 状态标签（未开始/进行中/已结束） | P0 |
| 2 | 投票进度（赞成/反对票数+百分比、JNS 代表持仓+百分比、总 JNS 快照） | 进度条 + 百分比（已有 pin 面板基础，可复用 pinExpr 表达式） | P0 |
| 3 | 资格检查（JTI + JNS 余额） | 页面顶部状态卡片（✅/❌） | P0 |
| 4 | 结果判定 decisionMaker：提案 ≤2 用 V1 规则（ar>2/3 且 rr>1/2），≥3 用 V2 规则（ar>2/3 且 rr>0.4） | 已结束提案显示 通过/未通过 | P0 |
| 5 | 倒计时（区块差 × 15s） | 区块高度 + 预计时间倒计时 | P1 |
| 6 | 投票操作 voteFor/voteAgainst（钱包签名） | JvActionButton + wallet store + 交易状态提示 | P1 |
| 7 | JNSVote 徽章展示（balanceOf + tokenOfOwnerByIndex + tokenURI 渲染 SVG） | 徽章画廊（可点击查看） | P1 |
| 8 | accountsChanged/chainChanged 监听自动刷新 | wallet store 已内置响应式 | P0（天然支持） |
| 9 | 实时更新（WS/轮询） | 投票进行中提案轮询刷新（如 15s） | P2（roadmap 已列） |

## 四、实现方案

### 文件规划
```
src/
├── contracts/jnsvote.ts      ← 合约常量 + ABI（从 jnsvote.sbt.js 提取精简）
├── composables/useJNSVote.ts ← 数据层：提案列表/徽章/资格/投票方法
├── views/JNSVote.vue         ← 主页面（列表 + 详情合一，或分列表/详情两页）
└── router/index.ts           ← 新增路由 /tools/jnsvote（工具集入口挂载）
```

### 技术要点
1. **viem 重写**：`readContract` 批量读 `_proposals(id)`（并行 Promise.all + 分批保护，参照 PERF-2 经验），`writeContract` 走 `stores/wallet.ts`
2. **ABI 精简**：从 `jnsvote.sbt.js`（13.7KB 完整 ABI）提取 JNSVote 所需方法 + JNS/JTI 的 `balanceOf`，避免全量引入
3. **设计系统**：`JvStatusTag`（进度状态）、`JvLoading`（加载）、`JvPageState`（异常/空态）、`JvActionButton`（投票防重复提交）、`JvAmount`（票数展示）
4. **决策规则**：`decisionMaker` 移植为纯函数 `src/utils/jnsvote-decision.ts`（V1/V2 规则按提案 id 分界）
5. **时间换算**：区块差 × 15s（Jouleverse 平均出块时间），`timestamp-to-block.ts` 已有锚点可复用
6. **CID 链接**：`cid2link` 需 `multiformats` 依赖（v1 用 Multiformats.CID），或简化为直接展示原始 CID

### 排期建议（拆分 3 个迭代）
| 迭代 | 内容 | 预估工时 |
|------|------|---------|
| **I1** | 路由 + 合约层（jnsvote.ts ABI）+ 提案列表只读展示（进度/票数/状态/结果判定） | 4-6h |
| **I2** | 资格检查卡片 + 投票操作（writeContract + 交易反馈）+ 徽章画廊 | 4-6h |
| **I3** | 实时更新轮询 + 倒计时 + 体验打磨（设计系统接入、空态/异常态） | 2-4h |

## 五、前置依赖
- [x] 合约地址/ABI 确认（已完成，见上）
- [x] v1 参考代码归档（已完成 → `docs/reference/jnsvote/`）
- [ ] 确认 v2 中 JNS/JTI 合约 ABI 是否已有（JNS 已有 `contracts/jns.ts`，JTI 需确认）
- [ ] 确认路由挂载位置（`/tools/jnsvote` vs 独立 `/jnsvote`，建议前者，随 P2-2 工具集）

---

*方案版本：v1.0（2026-08-11）*
