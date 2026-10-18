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

## 原则三：PR 提交与署名保护（铁律，每个 PR 必照走，不靠记忆）

**背景（2026-10-16 PR #19 教训）**：分支落后时，维护者没有走「Squash and merge」按钮，而是把咱们的 tree 原样重打成自己的新 commit，author/committer 改成「大白」，commit message 里没有 `Co-authored-by` → 代码内容 100% 是咱们写的，但主线 authorship 完全丢失（contributions 图不计入）。根因是「分支落后 + 维护者习惯手工重提」，不是恶意。

为避免重演，每个 PR 严格照以下三步走：

### 1. 提交前 checklist（逐项打勾，缺一不可）

- [ ] `git fetch` 最新 upstream，分支 rebase 到最新基线；`git status` / `gh pr view` 确认 `behind=0`、`mergeable_state=clean`。**落后就必须先 rebase**，否则维护者只能手工重提（#19 的直接诱因）。
- [ ] 单 commit + 规范 message（`type(scope): 描述`），适配「Squash and merge」（这是唯一会自动加 `Co-authored-by` 保留署名的按钮）。多 commit/杂乱历史会诱导维护者手工 cherry-pick。
- [ ] `git status` 工作区干净，无与任务无关改动。
- [ ] `npm run build` 通过（`vue-tsc -b` + `vite build`）。
- [ ] 视觉改动完成双主题验证（见「视觉改动必须双主题验证」）。
- [ ] 核对署名：`git log -1 --format='%an <%ae>'` 应为 `fangsheng-sudo <fangsheng-sudo@users.noreply.github.com>`。

### 2. PR 正文锚定句式（必写，温和锚定合入方式）

PR 正文末尾固定加这一段，不删改：

> **合入方式**：请直接用 GitHub 的 **Squash and merge** 按钮合入即可（会自动保留 `Co-authored-by` 署名），无需手工 cherry-pick / re-commit。若分支有冲突，请告知，我会 rebase 到最新再推。

### 3. 合入后校验（10 秒闭环）

- [ ] 取 merge commit sha：`gh api repos/{owner}/{repo}/pulls/{n} --jq '.merge_commit_sha'`。
- [ ] 核对 author：`git log <sha> --format='%an <%ae>'` 应为 fangsheng-sudo。
- [ ] 核对尾巴：`git log <sha> --format='%B'` 应含 `Co-authored-by: fangsheng-sudo`。
- [ ] 若署名丢失，**当场**发一条友好 comment（不攒着，当场成本最低、对方压力最小）：「这条合入似乎没带上 `Co-authored-by` 署名，麻烦看下是否漏了？」

**关键认知**：问题只出在「维护者手工重提」这一个动作上；只要分支 0 落后 + 单 commit + 正文锚定「用 Squash and merge 按钮」，署名就不会丢。
