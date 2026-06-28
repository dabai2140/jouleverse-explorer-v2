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
