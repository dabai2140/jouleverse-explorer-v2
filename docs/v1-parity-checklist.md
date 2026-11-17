# v1 → v2 功能对等清单（100% 移植目标）

**文档日期**：2026-11-17
**维护人**：大白（💎）
**状态**：📋 立项（本节为后续开发的唯一“对等基线”）

---

## 一、目标修订：从「MVP + 选择性移植」改为「100% 对等替代 v1」

### 1.1 旧目标（2026-03-18 制定，现作废）

`explorer-v2-mvp-plan.md` 与 `jouleverse-explorer-refactor-plan.md` 当初的判定是：

> MVP 原型 → 增量移植 → **果断废弃旧功能**

并按「使用频率低 / 与浏览器核心定位不符 / 复杂度高」为理由，把以下模块列为「考虑废弃」：

- CryptoJunks NFT（`/#/cryptojunks`）
- Redpacket 链上红包（`/#/redpacket`）
- 合约验证功能（v1 地址页内嵌的 solc 编译 + 字节码比对）

### 1.2 新目标（2026-11-17 教链确认，本文件为准）

> **v1 的全部功能 100% 移植到 v2，尽快达到可替代 v1 的可用性。**

废弃结论**全部作废**。理由：

1. **离线即失守**：只要 v1 还托管着任何一个独占功能，v1 就一天不能下线，v2 就永远是「更好的前端」而不是「替代品」。运维成本、双份 RPC 压力、双份安全面都持续存在。
2. **废弃判断本身证据不足**：「使用频率低」没有量化依据；实际上 `redpacket` 是社区发红包的入口、`cryptojunks` 是 10000 枚铭文的唯一浏览入口，两者都不是「可以悄悄消失」的功能。
3. **钱包交互链路已打通**：v2 已有 wagmi/viem + 设计系统 + 多签治理端，原先「复杂度高」的阻力已大幅降低。
4. **替代要能真正切换**：切换动作（DNS / 302 / 公告）之前，必须先做到 100% 对等，否则切换即回滚。

### 1.3 达成判据（可执行，不靠主观判断）

一个功能算「已对等」，必须同时满足：

1. **入口等价**：v1 的路由在 v2 有对应路由（或明确的功能合并说明），站内导航可直达；
2. **读写等价**：v1 能查的字段、能发的交易，v2 都能做；数值口径一致（单位、精度、舍入）；
3. **边界等价**：v1 的限制与告警（额度上限、资格校验、不可逆提示）在 v2 同样存在，且**不得放宽**；
4. **门禁覆盖**：该视图已在 `docs/feature-roadmap.md` 登记，`node scripts/check-feature-roadmap.ts` 通过；有可离线验证的逻辑必须有 spec（见 AGENTS.md 原则五）；
5. **真实链验证**：至少一次对 `https://rpc.jnsdao.com` 的真实读写验证记录（脚本或人工截图），写进 PR 描述。

> ⚠️ 只写「已实现」不算数。第 5 条是硬要求——历史上多次出现「代码合了但线上不可用」。

---

## 二、v1 功能全量盘点（权威基线：`jscan.jnsdao.com` / `~/git/explorer`）

> 基线取自本地 v1 仓库 `~/git/explorer`（HEAD `7371e07`，RPC 已切无端口端点），
> 路由表来自 `app/app.js`，页面来自 `app/views/*.html`，控制器来自 `app/scripts/controllers/*.js`。

### 2.1 v1 路由与 v2 现状对照

| v1 路由 | v1 页面 / 控制器 | v2 对应 | 对等状态 |
|---|---|---|---|
| `/#/` | `main.html` / `mainController.js` | `/` `Home.vue` | 🟡 部分（见 §三 A） |
| `/#/block/:blockId` | `blockInfos.html` | `/block/:number` `BlockDetail.vue` | 🟡 部分（仅支持高度，不支持哈希；缺确认数/extraData 文本） |
| `/#/tx/:transactionId` | `transactionInfos.html` | `/tx/:hash` `TransactionDetail.vue` | 🟡 部分（缺 ABI 解码、地址标签、区块哈希跳转） |
| `/#/address/:addressId` | `addressInfo.html`（618 行） | `/address/:address` `AddressDetail.vue` | 🟡 部分（资产面板只覆盖 6 类，见 §三 C） |
| `/#/did/:jnsId` | `addressInfo.html`（DID 视图复用） | ❌ **无路由** | ❌ 缺失 |
| `/#/cryptojunks` | `junksInfo.html` | ❌ 无 | ❌ 缺失（原判「废弃」，现要求移植） |
| `/#/cryptojunks/page/:pageId` | 同上 | ❌ 无 | ❌ 缺失 |
| `/#/cryptojunks/page/:pageId/id/:junkId` | 同上 | ❌ 无 | ❌ 缺失 |
| `/#/redpacket`（创建） | `redpacketInfo.html` | ❌ 无（仅 toolbox 里有 redpacket 合约工具页） | ❌ 缺失（原判「废弃」，现要求移植） |
| `/#/redpacket/:redpacketId`（抢） | 同上 | ❌ 无 | ❌ 缺失 |
| `/#/jns/:jnsId` | `jnsInfo.html` | `/jns/:name` `JNSQuery.vue` | 🟡 部分（缺打赏/owner-only mint） |
| `/#/jnsvote/` | `jnsVoteInfo.html` | `/jnsvote` `JNSVote.vue` | ✅ 对等并超出（v2 有详情页 + 治理端） |
| `/#/core/checkin/` | `coreCheckInInfo.html` | `/core/checkin` `CoreCheckinStats.vue` | ✅ 对等 |
| `/tools/index.html` | 工具集入口 | `/tools` `ToolsHome.vue` | 🟡 部分（`contractx` 仍外链 v1） |
| `/tools/core/index.html` | 核心合约工具（部署/调用/事件订阅） | `/tools/contract/:key` × 12 | 🟡 部分（缺**事件查询面板**、缺自定义 ABI） |
| `/tools/contractx/index.html` | 其他合约工具（含自定义 ABI 输入） | ❌ 仍外链 v1 | ❌ 缺失 |
| `/tools/airdrop/merkle-proof-generator.html` | 默克尔证明生成 | `/tools/merkle` | ✅ 对等 |

### 2.2 v1 全局能力（不在路由里但影响可用性）

| 能力 | v1 实现 | v2 现状 |
|---|---|---|
| 全局搜索框 | `index.html:processRequest()`，支持 区块号 / 区块哈希 / 交易哈希 / 40 位 hex 地址 / `j3...` JVA-B32 / `.j` 域名，无法识别时弹帮助 | 🟡 `Home.vue:handleSearch` 只识别 区块号 / `.j` / 66 位 tx / hex+JVA；**40 位 hex 会被当区块号**、不认识区块哈希、无帮助提示 |
| 顶部「连接账户」+ 网络标识 | `showHideConnect()`，含 chainId 显示、JNS 头像、切网按钮 | 🟡 `App.vue` 有连接按钮与地址，无网络标识/切网入口 |
| 一键添加 Jouleverse 主网（EIP-3085） | 首页底部按钮 `switchNetwork()`，`wallet_addEthereumChain` 带完整参数 | ❌ **无入口**（仅 `stores/wallet.ts` 连接失败时静默兜底） |
| 地址标签（`address2tag`） | `deployments.js:getAddressTag()`，区块/交易/地址三页都用 | 🟡 仅 `BlockDetail.vue` 内置本地映射，`TransactionDetail` / `AddressDetail` 没有 |
| 地址格式三态展示（JVA/B32/HEX） | 地址页顶部同屏展示 | ✅ `AddressDetail.vue` 已做且更好（可切换 + 可选中） |
| JNS 反查（地址 → 域名） | `getAddressNS()` | ✅ `jvaddress` + `AddressDetail` 主域名展示 |
| 合约源码展示 + 一致性验证 | `addressInfoController.js` + `contractVerificationService.js` + `scripts/workers/solcWorker.js`（Web Worker 编译 + 去元数据比对 + 相似度） | ❌ 无（`ContractDeployment.vue` 只做代码摘要比对，**不是**源码编译验证） |

### 2.3 v1 各页面字段级清单（用于逐项打勾）

#### A. 首页 `main.html`（70 行）

| 卡片 | 字段 | v2 `Home.vue` |
|---|---|---|
| 区块链实时状态 | 状态文案（🟢 数据正常 / 🔴 数据异常，判据：最新块龄 <60s）+ 最新区块号 | 🟡 有「网络在线/离线」（判据 <300s）+ 最新区块 |
| 稳定运行时间 | `{{updays}}` 年/天 + since block 0 链接 | ✅ 有（`networkUptime`），但无 block 0 链接 |
| Free Energy | `free` + `total`（M 单位，`released/used/available` 三分法） | 🟡 Timelock 面板展示 月度预算/已使用/已释放/可用余额，**无 Free/Reserved 口径** |
| Reserved Energy | `reserved` + `reserved_core` + `reserved_eco` | 🟡 同上 |
| 最新区块表 | Block / Txn / Size / Timestamp 四列 | 🟡 卡片式，含哈希/交易数/Gas，**无 size** |
| 一键添加主网 | `switchNetwork()` 按钮 | ❌ 无 |

> ⚠️ Free / Reserved 是焦耳宇宙的核心语义（流通能量 / 时间锁中能量），v1 用 `released/available/used` 三值映射：
> `free = used`、`reserved = available`、`total = released`。
> v2 的 Timelock 面板口径是「预算/已用/已释放/可用」，**语义不同**，不能算对等。

#### B. 区块详情 `blockInfos.html`（114 行）

字段：区块哈希（可点自身）、区块高度、上一区块、时间戳（含本地串）、难度、尺寸、燃料上限、**确认数**、燃料消耗量、**附加数据 extraData**（含 `hex2a` 转文本）；下方交易列表含 从/至（带标签）/ 燃料消耗量 / 传输能量 / 输入数据。

v2 缺：确认数、extraData、交易列表里的「输入数据」与「gas（桶）」口径。

#### C. 交易详情 `transactionInfos.html`（104 行）

字段：交易哈希、时间戳、区块高度、**区块哈希**、从/至（带标签）、传输能量、**每桶燃料能量值（gasPrice，J + Gwei 双单位）**、燃料消耗量（桶）、燃料消耗限制、**交易手续费（J + Gwei 双单位，已确认用 receipt.gasUsed 实算，未确认用 gas×gasPrice 预估）**、Nonce、**输入数据（ABI 解码 ←→ 原始数据切换）**、确认数。

v2 缺：区块哈希行、ABI 解码切换、地址标签、双单位换算说明（v2 用 JvAmount 只给一档）。

> ABI 解码在 v1 是**离线可验证**的纯函数（`abi-decoder.js` + 12 份 ABI），
> 在 v2 应该抽成 `src/utils/abi-decode.ts` 并配 spec —— 这是 AGENTS.md 原则五「10ms 能测完的逻辑别埋在组件里」的典型例子。

#### D. 地址详情 `addressInfo.html`（618 行）

| 区块 | 内容 | v2 现状 |
|---|---|---|
| 头部 | JNS 头像 + description +「查看该 DID 数字身份资料」链接 | 🟡 有域名，无 DID 链接（DID 页也没了） |
| 格式 | JVA / B32 / HEX / DID（含 Core ID 头像） | 🟡 DID 行缺失 |
| 能量余额 | J + wei 双单位；**「新手加油 0.005 J」**按钮（余额 0 且有 JTI2 时出现，走 `withdrawTo` 且跳过余额校验） | ❌ 无新手加油 |
| 数字资产 | WJ 余额 + unwrap / send 按钮（**send 支持 `.j` 域名解析**） | 🟡 有 WJ 操作，但**接收地址不支持 `.j`** |
| 藏品和徽章 | Planet / JTI(v2)（含认证编号+日期）/ FlyingJ / CryptoJunks / JNS / **JNSVote POAP** / **JNSDAO V**（含 npub 生成 + register 按钮） | ❌ Planet、FlyingJ、JNSDAO V、npub 均缺（`core-assets.ts` 只 6 类） |
| Core ID | 逐个列 `#id` + 头像 | ✅ |
| Core 链上签到 | POP 徽章按月墙（失效置灰） | ✅（且带分批保护） |
| CryptoJunks 墙 | 64px 像素图 + 金标/灰标 + 稀有度 👑💎🌟 + 跳详情 | ❌ 无 |
| JNS 墙 | 头像 + `#id` + 跳域名页 | ✅（更细，含分页加载） |
| 合约源码区 | 部署信息（tag/network/src/key）+ 源码高亮 + 复制/下载 | ❌ 无 |
| 合约一致性验证 | 编译 → 去元数据比对 → 相似度/编译版本/optimizer/evmVersion/构造参数/字节码长度/对比预览 | ❌ 无 |

#### E. JNS 域名页 `jnsInfo.html`（197 行）

| 功能 | v1 | v2 |
|---|---|---|
| 概要（合约地址 / NFT 编号 / 图案 / 持有者 / 绑定地址） | ✅ | ✅ |
| DID 链接（绑定后 `/#/did/:name`） | ✅ | ❌ |
| 绑定 / 解绑 | ✅ | ✅ |
| **赠予（give）** | ✅ 支持 `.j` 目标解析，二次确认弹窗 | 🟡 有「转移域名」，但**只支持地址，不支持 `.j`** |
| **打赏（endorse）** | ✅ 1/2/5/10 WJ 快选 + 手动（0<x≤100），转 WJ 到绑定地址 | ❌ 无 |
| owner-only **mint** | ✅ 合约 owner 才显示 🔨 | ⏸ 原判「暂不实现（合约 owner-only）」，**但 UI 对等要求保留入口**（见 §四 P5-11） |
| 错误提示（名称格式、`GM.j`/`Nana.j` 大小写例外） | ✅ | 🟡 部分 |

#### F. CryptoJunks `junksInfo.html`（108 行）

- `Current supply / Supply limit 10000 / Sealed` 状态行
- 分页导航（100 一页，里程碑标记 💔🌟💎👑）
- 每页铭文墙：tokenURI 元数据（像素图、稀有度、金/灰标）
- 标注说明 + **静态统计表**（legend/rare/precious/normal × good/broken/total）
- 合约地址展示
- 依赖 `scripts/misc/punks/{pageId}.json` 本地参照表 + `golden_idx.json`

#### G. 链上红包 `redpacketInfo.html`（212 行）

| 功能 | 细节 |
|---|---|
| 创建红包 | 总额（≤2000 WJ）+ 个数（≤500）+ WJ 授权（allowance 展示 + 变更授权）→ `createRedPacket()` |
| 红包信息 | 总额 / 总个数 / 剩余金额 / 剩余个数 |
| 抢红包 | 幸运数字输入（`preGenLuckyNum` 预生成，0~2^256-1）+ `openRedPacket()`；资格：JTI 认证；每地址每包一次；抢完显示「抢完了」 |
| 网络提示 | 未切链时给「切换网络」按钮 |
| 复制红包信息 | `copyRedpacketInfoToClipboard()` |
| 我的入口 | 「我也发一个」→ `/#/redpacket` |

#### H. 工具集（`/tools/*`）

| 工具 | v1 能力 | v2 现状 |
|---|---|---|
| `core/index.html`（1286 行） | 11 个合约（含 `节点PoS` / `投票权PoS` / `CJDAO多签` / `Timelock0` 等 v2 注册表里没有的）；读/写函数表单；**主控台 console**；**事件订阅面板**（`allEvents`，可按「最近 N 块」或「从块号」拉取 + WS 实时） | 🟡 v2 有 12 合约读写表单 + 交易回执事件数，**缺事件查询/订阅面板**，**缺 4 个合约**（`节点PoS` `0xDb11…3646`、`投票权PoS` `0xB17b…8dC3`、`CJDAO多签` `0x7494…54a6`、`Timelock0` `0x0De0…75E8`、`JTI2Config` `0x7713…24db`、`ecofund1` `0x50fe…9760`） |
| `contractx/index.html`（1380 行） | 同上 + **任意 ABI 粘贴交互 / calldata 生成**；`CryptoJunks` 带源码校验标记 | ❌ 仍外链 v1 |
| `airdrop/merkle-proof-generator.html` | 默克尔证明 | ✅ 已迁移 |

#### I. 合约验证（`contractVerificationService.js`，283 行）

流程：本地源码（`/scripts/contracts/*.sol`）→ Web Worker（`solcWorker.js`）按部署清单里的 `solc.version / evmVersion / optimizer` 编译 → 与 `eth_getCode` 比对 → 去 metadata 后再比 → 输出 `verified / message / similarity / compilerVersion / optimizer / evmVersion / contractName / constructorArgs / onChainLength / compiledLength / partialMatch / exactMatch`。

这是 v1 独有的、**纯客户端**能力，是「浏览器内置合约审计」的差异化点，必须移植。

---

## 三、按模块的缺口汇总（这就是后续开发的工作面）

### A. 首页 / 全局（P5-1 ~ P5-3）
1. 首页 Free / Reserved Energy 四宫格（`free / total / reserved / reserved_core / reserved_eco`）
2. 一键添加 Jouleverse 主网（EIP-3085，带 `iconUrls` 注释说明）
3. 全局搜索补全：区块哈希、40 位 hex 地址、`.j` 之外的 `j3…`、无法识别时给帮助弹层

### B. 区块 / 交易详情（P5-4 ~ P5-5）
4. 区块详情：确认数、`extraData` 及 hex→文本、交易列表「输入数据」+ 「gas 桶」口径
5. 交易详情：区块哈希行、**ABI 解码切换（12 份 ABI，纯函数 + spec）**、地址标签、gasPrice/手续费双单位
6. 区块详情支持区块哈希入参（v1 `/#/block/:blockId` 同时接受高度和哈希）

### C. 地址页资产与操作（P5-6 ~ P5-8）
7. 资产面板补齐 4 类：Planet、FlyingJ、JNSDAO V（含 npub 展示）、CryptoJunks 墙
8. 「新手加油 0.005 J」入口（余额 0 且有 JTI2 时）
9. WJ 发送 / JNS 转移支持 `.j` 域名解析（v1 两处都有）

### D. JNS（P5-9 ~ P5-11）
10. DID 页 `/#/did/:jnsId`（复用地址视图，按域名反查地址）
11. 打赏 endorse（1/2/5/10 + 手动 ≤100 WJ）
12. owner-only mint 入口（保留 🔨，仅合约 owner 可见）

### E. CryptoJunks（P5-12）
13. 全量浏览页：supply 状态、分页、铭文墙、标注说明、统计表、本地参照表 `punks/*.json`

### F. 链上红包（P5-13）
14. 创建（总额/个数/授权）+ 红包信息 + 抢（幸运数字）+ 资格校验 + 复制

### G. 工具集（P5-14 ~ P5-16）
15. 合约工具补 **事件查询/订阅面板**（最近 N 块 / 从块号 + WS 实时）
16. 补 6 个缺失合约注册：`节点PoS`、`投票权PoS`、`CJDAO多签`、`Timelock0`、`JTI2Config`、`ecofund1`
17. **自定义 ABI 交互工具**（`/tools/custom`，粘贴 ABI + 地址 → 函数表单 + calldata 生成），下线 `contractx` 外链

### H. 合约验证（P5-17）
18. 源码展示 + solc 编译比对（Web Worker，版本/optimizer/evmVersion 取自部署清单）

---

## 四、批次划分与验收

> 排序原则：**先补「影响日常浏览与钱包操作」的，再补「工具型/运营型」的**。
> 每一批独立可交付、独立可验收、独立可上线；不追求一次推平。

| 批次 | 内容 | 对应项 | 预估 | 验收要点 |
|---|---|---|---|---|
| **P5-1 浏览基础对等** | 首页能量四宫格 + 一键添加主网 + 全局搜索补全 + 区块/交易详情缺字段 | A + B | 1.5–2 天 | 搜索 6 类输入全部命中；区块页有确认数/extraData；交易页能切 ABI 解码 |
| **P5-2 地址页对等** | 资产 4 类 + 新手加油 + `.j` 解析 | C | 1.5–2 天 | 4 类徽章显示且分批保护；两处 `.j` 解析成功 |
| **P5-3 JNS 对等** | DID 页 + 打赏 + owner-only mint | D | 1–1.5 天 | DID 页可从地址页/域名页双向进入；打赏金额边界 0<x≤100 |
| **P5-4 CryptoJunks** | 全量浏览 + 统计 | E | 1–1.5 天 | 10000 枚分页不漏；元数据来源与 v1 一致（不额外压 RPC） |
| **P5-5 链上红包** | 创建 / 抢 / 授权 | F | 1.5–2 天 | 2000 WJ / 500 个上限；JTI 资格校验；抢过提示 |
| **P5-6 工具集对等** | 事件面板 + 6 合约 + 自定义 ABI | G | 2–3 天 | 事件按块号区间拉取不扫全链；自定义 ABI calldata 与 v1 一致 |
| **P5-7 合约验证** | 源码 + solc 编译比对 | H | 2–3 天 | 对 3 个已知合约复现 v1 的 `exactMatch/partialMatch` 结论 |
| **P5-8 切换就绪** | 全量回归 + 双跑对照 + 切换方案 | — | 1–2 天 | 清单 100% 打勾；v1 可安全 302 |

**合计约 11–17 人天**（不含 review 与等待）。

### 每批的硬性门禁（缺一不可）

1. `npm run build` EXIT 0（不是 `vue-tsc --noEmit`，见 AGENTS.md 原则五）
2. `npm test` 全绿（vitest + `node --test`）
3. `node scripts/check-feature-roadmap.ts` 通过（新视图必须登记）
4. 新增的纯逻辑必须有 spec，并做**反向验证**（拿掉依赖看是否变红）
5. 真实链验证记录写进 PR
6. 双主题（暗/亮）视觉验证（有 UI 改动时）

---

## 五、明确不做的部分（避免误解「100%」）

以下**不是** v1 功能，不在移植范围：

- SEO / SSR：v1 是 `html5Mode(false)` 纯 hash 静态站，v2 同为 hash 路由，无对等义务
- Angular 1.x / Bower / jQuery / Bootstrap 3 的技术栈复刻（v2 用 Vue 3 + Naive UI 是既定方向）
- v1 遗留的 `:8503` / `:8505` 带端口 RPC 端点（已于 2026-10-29 统一废弃）
- 已注释掉的历史代码路径（如 v1 `addressInfo.html` 里被 `<!-- -->` 注释掉的 JTI v1 / Planet 星球来源展示）

以下**保留 v1 行为但不放宽**：

- `JNS mint` 仍只对合约 owner 显示（v1 就是 owner-only，不新增公开注册）
- 红包创建上限 2000 WJ / 500 个
- WJ 发送上限 2000 WJ
- 打赏 0 < x ≤ 100 WJ

---

## 六、与既有文档的关系

| 文档 | 关系 |
|---|---|
| `docs/feature-roadmap.md` | **状态追踪主表**。本清单是「要做什么」，路线图是「做到哪了」。§二 P4「废弃功能评估」作废，改为 P5 批次 |
| `docs/explorer-v2-mvp-plan.md` | 历史规划（2026-03-18）。§「废弃建议」段已加超链接指向本文件，**不再作为范围依据** |
| `docs/jouleverse-explorer-refactor-plan.md` | 历史重构方案。同上，废弃结论作废 |
| `docs/tools-migration.md` | 工具集专项。`contractx` 从「外链」改为「必须重写迁移」；`core` 补事件面板与缺失合约 |
| `AGENTS.md` | 工程门禁（构建/测试/PR 流程），与本清单 §四 门禁一致 |

---

*创建时间：2026-11-17*
*创建人：大白（💎）*
*依据：教链 2026-11-17 指示「v1 全部功能 100% 移植，尽快达到替代 v1 的可用性」*
