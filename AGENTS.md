# Jouleverse Explorer v2 — 协作原则

## 原则一：纯前端部署

Explorer v2（Jscan v2）必须是纯前端项目，无需后端服务器即可完整运行。所有代码须能通过静态托管（如 GitHub Pages、Cloudflare Pages 等）直接部署，不依赖任何自建后端服务。

## 原则二：RPC 节点零负担

计算压力尽量放在用户端侧，不给 RPC 节点增加额外负担。Jouleverse 的 RPC 节点（`rpc.jnsdao.com:8503`）是小型公共节点，资源有限。应保证：

- 单页面的 RPC 调用次数尽量少、尽量并行
- 不使用全量扫描（如 `eth_getLogs` fromBlock: 0 toBlock: 'latest'）、大范围遍历等可能压榨 RPC 节点的操作
- 可重复利用的数据优先在客户端缓存（localStorage / IndexedDB）
- 尽可能将计算和数据聚合放在浏览器端完成

## 已知链特性

以下 Jouleverse 链特性对开发有直接影响，需知悉：

- **无原生 J 转账**：Jouleverse 链已禁用原生币转账（`tx.value > 0` 的普通转账）。所有链上转账均通过 wJ（ERC-20 代币）进行。因此地址交易历史只需处理 ERC-20 Transfer 事件，无需考虑原生转账场景。

## 原则三：不得绕过 PR 流程

1. 任何代码进入主线，必须经由 PR 合并（merge / squash merge / rebase merge）。禁止关闭 PR 后由他人手工重新提交 commit 的方式落地。
2. 审计者如需修改提交内容，应在 PR 内提出修改意见由作者更新，或使用 GitHub 官方合并功能，不得另起 commit。
3. 非 PR 路径进入主线的代码，即使保留 trailer，也视为流程违规——primary authorship 无法保证。发现后应要求按 PR 流程重走，或至少在 PR 内注明实际来源与合并方式。

理由：PR #19 即因绕过流程导致 author 字段被改写。「合入方式锚定段」只对走 PR 的路径有效，无法约束绕过行为。

## 原则四：PR 提交与署名保护（铁律，每个 PR 必照走，不靠记忆）

**背景（2026-10-16 PR #19 教训）**：PR #19 未走合并流程即被关闭（state=CLOSED、mergeCommit=null），代码由他人手工重提为 b86a579：

- author 字段被改为「大白」，primary authorship 丢失
- 仅因 commit message 末尾保留 Co-Authored-By trailer，co-author 署名侥幸保留（contributions 图仍计入）
- ⚠️ 署名是靠 trailer 偶然保住的，不是流程保证的

**署名是否保留，取决于「代码是怎么进主线的」，与点哪个按钮无关：**

- 走 merge / squash / rebase 三种官方合并：author 与 Co-authored-by trailer 都保留。
- 手工 git cherry-pick / 重新 commit 再 push：author 变成执行者，只剩 trailer 能保住 co-author 署名。
- 「Squash and merge」并不特殊，它唯一的作用是让分支上的多个 commit 变成一个干净的 commit —— 这是减少噪音，不是保护署名。

⚠️ 因此：不要因为担心「署名会丢」而要求作者把分支 rebase 成单 commit。只要走官方合并按钮，多 commit 同样保留署名。

为避免重演，每个 PR 严格照以下三步走：

### 1. 提交前 checklist（逐项打勾，缺一不可）

- [ ] `git fetch` 最新 upstream，分支 rebase 到最新基线；`git status` / `gh pr view` 确认 `behind=0`、`mergeable_state=clean`。**落后就必须先 rebase**，否则维护者只能手工重提（#19 的直接诱因）。
- [ ] 单 commit + 规范 message（`type(scope): 描述`），减少合并噪音（多 commit/杂乱历史会诱导维护者手工 cherry-pick）。
- [ ] `git status` 工作区干净，无与任务无关改动。
- [ ] `npm run build` 通过（`vue-tsc -b` + `vite build`）。
- [ ] 视觉改动完成双主题验证。
- [ ] 核对署名：`git log -1 --format='%an <%ae>'` 应为 `fangsheng-sudo <fangsheng-sudo@users.noreply.github.com>`。

### 2. PR 正文锚定句式（必写，温和锚定合入方式）

PR 正文末尾固定加这一段，不删改：

> **合入方式**：请直接用 GitHub 的 **Squash and merge** 按钮合入即可，无需手工 cherry-pick / re-commit。若分支有冲突，请告知，我会 rebase 到最新再推。

### 3. 合入后校验（10 秒闭环）

- [ ] 以 PR 页面上显示的 merge commit 或 `git log` 核对为准（squash 合入时 `gh api ... --jq '.merge_commit_sha'` 拿到的是 GitHub 预生成的 sha，不一定等于入库后的真实 commit）。
- [ ] 核对 author：`git log <sha> --format='%an <%ae>'` 应为 fangsheng-sudo。
- [ ] 核对尾巴：`git log <sha> --format='%B'` 应含 `Co-authored-by: fangsheng-sudo`。
- [ ] squash 按钮默认生成的标题是「标题 (#N)」，若仓库未开启「默认使用 PR 标题」，需手工确认标题与正文锚定段一致。
- [ ] 若署名丢失，**当场**发一条友好 comment（不攒着，当场成本最低、对方压力最小）：「这条合入似乎没带上 `Co-authored-by` 署名，麻烦看下是否漏了？」

**关键认知**：署名是否保留，只取决于「代码怎么进主线」（走官方合并 vs 手工重提），与点哪个按钮、单 commit 还是多 commit 无关。
