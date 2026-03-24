# Jouleverse Explorer 重构方案

**文档版本**：v1.0  
**创建时间**：2026-03-18  
**负责人**：大白（AI 私人助理）  
**审核人**：刘教链

---

## 📊 现状分析

### 当前技术栈

| 技术 | 版本 | 状态 |
|------|------|------|
| **前端框架** | Angular.js 1.x | ⚠️ 已停止维护 |
| **构建工具** | Bower + npm | ⚠️ 已过时 |
| **Web3 库** | web3.js 1.x | ⚠️ 已升级，但 API 较旧 |
| **路由** | ngRoute（hash 模式） | ⚠️ 不支持 HTML5 History |
| **代码规模** | 37 个 JS 文件，10+ 个视图 | 📊 中型项目 |
| **TypeScript** | ❌ 未使用 | ❌ 无类型检查 |

### 主要功能模块

#### 1. 基础功能
- ✅ 区块浏览（区块列表、区块详情）
- ✅ 交易查询（交易详情、支持 MetaMask `/tx` 路由）
- ✅ 地址信息查看（余额、交易历史）
- ✅ 搜索框（区块/交易/地址搜索）

#### 2. Jouleverse 特有功能
- ✅ **JNS（Jouleverse Name Service）** 域名系统
  - 域名查询：`/#/jns/{name}.j`
  - MetaMask 连接和 mint 功能
  - JNS 记录展示
- ✅ **JNSVote 治理投票**
  - 投票资格检查
  - POAP 徽章验证
  - 投票进度展示
  - 投票结果展示（V1/V2 规则）

#### 3. 其他功能
- ✅ **CryptoJunks** NFT NFT 功能
- ✅ **Redpacket** 红包功能
- ✅ **Timelock** 能量释放信息展示
- ✅ **合约验证** 多合约验证功能（JNS、FlyingJ、CryptoJunks）

### 现有代码问题

#### 技术债务
1. **框架过时**：Angular.js 1.x 已于 2018 年停止维护
2. **无类型检查**：JavaScript 代码容易出错，维护困难
3. **依赖过时**：Bower 已停止维护，npm 依赖版本过旧
4. **性能问题**：
   - 频繁的 DOM 操作
   - 缺乏虚拟滚动
   - 大量同步请求（`setTimeout` 包装）
5. **路由限制**：hash 模式，不支持 SEO 优化

#### 代码质量问题
1. **代码组织**：
   - 控制器文件过大（`addressInfoController.js` 43KB）
   - 缺乏模块化
   - 逻辑耦合严重
2. **错误处理**：
   - 缺乏统一的错误处理机制
   - Promise 错误处理不完善
3. **测试覆盖**：
   - 无单元测试
   - 无 E2E 测试
4. **文档缺失**：
   - 缺乏 API 文档
   - 缺乏架构文档

#### 用户体验问题
1. **加载速度**：首页加载较慢（获取 15 个区块）
2. **移动端适配**：响应式设计不完善
3. **交互体验**：
   - 缺乏加载状态提示
   - 错误提示不够友好
   - 无骨架屏加载

---

## 🎯 重构目标

### 技术目标

| 目标 | 说明 | 优先级 |
|------|------|--------|
| **现代化框架** | Vue 3 + TypeScript + Vite | 🔴 P0 |
| **类型安全** | 全 TypeScript，合约类型自动生成 | 🔴 P0 |
| **性能优化** | 虚拟滚动、懒加载、SSR（可选） | 🟡 P1 |
| **开发体验** | 热更新、组件化、清晰的项目结构 | 🔴 P0 |
| **可维护性** | 模块化、可测试、文档完善 | 🔴 P0 |
| **包体积优化** | 减少不必要的依赖，优化构建体积 | 🟡 P1 |

### 业务目标

| 目标 | 说明 | 优先级 |
|------|------|--------|
| **UI/UX 提升** | 更现代的界面，更好的交互体验 | 🔴 P0 |
| **响应式设计** | 完美支持移动端，适配各种屏幕 | 🔴 P0 |
| **SEO 优化** | SSR 支持，提升搜索引擎可见性 | 🟢 P2 |
| **安全性** | 更好的输入验证、XSS 防护 | 🔴 P0 |
| **性能** | 更快的加载速度，更少的资源消耗 | 🔴 P0 |
| **功能保持** | 确保所有现有功能正常工作 | 🔴 P0 |

---

## 🏗️ 重构架构方案

### 方案一：渐进式重构（✅ 推荐）

**适用场景**：保持现有功能正常运行，逐步迁移到新框架

#### 优势
- ✅ **风险低**：可以边开发边测试
- ✅ **可回滚**：出现问题可以快速回退到旧版本
- ✅ **持续交付**：逐步替换模块，不会导致服务中断
- ✅ **平滑过渡**：团队可以逐步适应新技术

#### 劣势
- ⚠️ **维护成本**：短期内需要同时维护两套代码
- ⚠️ **周期较长**：需要 10-15 周完成全部迁移

#### 实施计划

##### 阶段 1：基础设施搭建（1-2 周）

**目标**：搭建新项目的基础架构，为后续迁移做好准备

**任务清单**：
- [ ] 创建 Monorepo 项目结构
- [ ] 配置 Vue 3 + TypeScript + Vite
- [ ] 配置 Pinia 状态管理
- [ ] 配置 Vue Router
- [ ] 配置 Tailwind CSS
- [ ] 创建核心库（`packages/core`）
- [ ] 创建 UI 组件库（`packages/ui`）
- [ ] 创建合约定义库（`packages/contracts`）
- [ ] 配置 ESLint + Prettier
- [ ] 配置 Vitest + Playwright
- [ ] 编写 CI/CD 配置

**核心库设计**：

```typescript
// packages/core/src/web3/index.ts
import { createPublicClient, http, type PublicClient } from 'viem';
import { jouleverseChain } from './constants/chain';

export class JouleverseWeb3 {
  private client: PublicClient;
  
  constructor(rpcUrl?: string) {
    const finalRpc = this.resolveRpcUrl(rpcUrl);
    this.client = createPublicClient({
      transport: http(finalRpc),
      chain: jouleverseChain,
    });
  }
  
  private resolveRpcUrl(rpcUrl?: string): string {
    if (rpcUrl) return rpcUrl;
    
    // 从 .rpc.txt 读取
    try {
      const rpcConfig = JSON.parse(fs.readFileSync('.rpc.txt', 'utf-8'));
      if (Array.isArray(rpcConfig)) {
        return rpcConfig[Math.floor(Math.random() * rpcConfig.length)];
      }
      return rpcConfig;
    } catch {
      return 'https://rpc.jnsdao.com:8503';
    }
  }
  
  // 查询区块
  async getBlock(blockNumber: number | 'latest' = 'latest') {
    return await this.client.getBlock({ blockNumber });
  }
  
  // 查询交易
  async getTransaction(txHash: string) {
    return await this.client.getTransaction({ hash: txHash as `0x${string}` });
  }
  
  // 批量查询区块
  async getBlocks(fromRange: number, toRange: number) {
    const promises = [];
    for (let i = fromRange; i <= toRange; i++) {
      promises.push(this.getBlock(i));
    }
    return await Promise.all(promises);
  }
  
  // 查询余额
  async getBalance(address: string) {
    return await this.client.getBalance({
      address: address as `0x${string}`,
    });
  }
}
```

**验收标准**：
- ✅ 可以成功创建并运行 Vue 3 项目
- ✅ 类型检查正常工作
- ✅ 测试框架可以正常运行
- ✅ 代码格式化工具正常工作

---

##### 阶段 2：核心功能迁移（2-3 周）

**目标**：迁移最基础的功能，验证新架构的可行性

**优先级排序**（按复杂度和重要性）：

1. **区块列表页**（简单，先练手）
   - 迁移 `mainController.js` → `views/Home.vue`
   - 实现虚拟滚动（性能优化）
   - 实现实时更新（WebSocket 或轮询）
   - 预估：3 天

2. **区块详情页**
   - 迁移 `blockInfosController.js` → `views/BlockDetail.vue`
   - 优化数据展示
   - 添加交易列表分页
   - 预估：2 天

3. **交易详情页**
   - 迁移 `transactionInfosController.js` → `views/TransactionDetail.vue`
   - 优化解码逻辑（更好的错误处理）
   - 添加交易状态追踪
   - 预估：2 天

4. **地址详情页**（复杂度高，重点优化）
   - 迁移 `addressInfoController.js` → `views/AddressDetail.vue`
   - 实现代码模块化（拆分多个 composables）
   - 优化 Token 余额查询（批量查询）
   - 预估：5-7 天

**组件设计示例**：

```vue
<!-- views/Home.vue -->
<template>
  <div class="home">
    <PageHeader title="Jouleverse 区块浏览器" />
    
    <!-- 网络状态 -->
    <NetworkStatus :status="networkStatus" />
    
    <!-- 运行时间 -->
    <UptimeBadge :uptime="uptime" />
    
    <!-- 能量信息 -->
    <EnergyInfo :energy="energy" />
    
    <!-- 区块列表 -->
    <BlockList 
      :blocks="blocks"
      :loading="loading"
      @load-more="loadMore"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useBlockchain } from '@/composables/useBlockchain';

const {
  networkStatus,
  uptime,
  energy,
  blocks,
  loading,
  fetchLatestBlocks,
  loadMore
} = useBlockchain();

onMounted(() => {
  fetchLatestBlocks(15);
});
</script>
```

```typescript
// composables/useBlockchain.ts
import { ref, computed } from 'vue';
import { JouleverseWeb3 } from '@jouleverse-explorer/core';

export function useBlockchain() {
  const web3 = new JouleverseWeb3();
  
  const networkStatus = ref<'online' | 'offline'>('online');
  const uptime = ref<string>('');
  const energy = ref<EnergyInfo | null>(null);
  const blocks = ref<Block[]>([]);
  const loading = ref(false);
  
  // 获取最新区块
  const fetchLatestBlocks = async (count: number) => {
    loading.value = true;
    try {
      const latestBlock = await web3.getBlock('latest');
      if (!latestBlock) return;
      
      const fromRange = Math.max(0, Number(latestBlock.number) - count);
      const toRange = Number(latestBlock.number);
      
      blocks.value = await web3.getBlocks(fromRange, toRange);
      
      // 更新网络状态
      const currentTime = Math.floor(Date.now() / 1000);
      const timeDiff = currentTime - latestBlock.timestamp;
      networkStatus.value = timeDiff < 60 ? 'online' : 'offline';
    } catch (error) {
      console.error('Failed to fetch blocks:', error);
    } finally {
      loading.value = false;
    }
  };
  
  // 加载更多区块
  const loadMore = async () => {
    // 实现虚拟滚动加载逻辑
  };
  
  return {
    networkStatus,
    uptime,
    energy,
    blocks,
    loading,
    fetchLatestBlocks,
    loadMore,
  };
}
```

**验收标准**：
- ✅ 区块列表页可以正常显示最新区块
- ✅ 区块详情页可以正常显示区块信息
- ✅ 交易详情页可以正常显示交易信息
- ✅ 地址详情页可以正常显示地址信息
- ✅ 所有页面性能优于旧版本

---

##### 阶段 3：JNS 系统迁移（3-4 周）

**目标**：迁移 JNS 核心功能，这是最复杂的模块

**模块拆分**：

```
views/jns/
├── JNSHome.vue              # JNS 首页（搜索框）
├── JNSDetail.vue            # JNS 详情页
├── JNSMint.vue              # JNS Mint 页面
├── components/
│   ├── JNSInfoCard.vue      # JNS 信息卡片
│   ├── JNSRecordList.vue    # JNS 记录列表
│   ├── JNSMintForm.vue      # JNS Mint 表单
│   └── MetaMaskButton.vue   # MetaMask 连接按钮
└── composables/
    ├── useJNS.ts            # JNS 核心逻辑
    ├── useMetaMask.ts       # MetaMask 连接逻辑
    └── useContract.ts       # 合约调用封装
```

**Composables 设计**：

```typescript
// composables/useJNS.ts
import { ref, computed } from 'vue';
import { useContract } from './useContract';
import { useMetaMask } from './useMetaMask';

export function useJNS() {
  const { call, send, estimateGas } = useContract(JNS_ABI, JNS_ADDRESS);
  const { isConnected, account, connect } = useMetaMask();
  
  const jnsInfo = ref<JNSInfo | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  // 查询 JNS 信息
  const lookup = async (name: string): Promise<JNSInfo> => {
    loading.value = true;
    error.value = null;
    
    try {
      const nameHash = await call('addr', [name]);
      const owner = await call('ownerOf', [nameHash]);
      const record = await call('getRecord', [nameHash]);
      
      jnsInfo.value = {
        name,
        nameHash,
        address: nameHash,
        owner,
        record,
      };
      
      return jnsInfo.value;
    } catch (err: any) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };
  
  // Mint JNS
  const mint = async (name: string): Promise<string> => {
    if (!isConnected.value) {
      await connect();
    }
    
    try {
      // Dry-run: 估算 gas
      await estimateGas('mint', [name]);
      
      // 发送交易
      const txHash = await send('mint', [name]);
      
      return txHash;
    } catch (err: any) {
      error.value = err.message;
      throw err;
    }
  };
  
  // 检查名称是否可用
  const checkAvailability = async (name: string): Promise<boolean> => {
    try {
      const nameHash = await call('addr', [name]);
      const owner = await call('ownerOf', [nameHash]);
      return owner === '0x0000000000000000000000000000000000000000';
    } catch {
      return true;
    }
  };
  
  return {
    jnsInfo,
    loading,
    error,
    lookup,
    mint,
    checkAvailability,
    isConnected,
    account,
  };
}
```

```typescript
// composables/useMetaMask.ts
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { createWalletClient, custom } from 'viem';
import { injected } from 'viem/chains';

export function useMetaMask() {
  const isConnected = ref(false);
  const account = ref<`0x${string}` | null>(null);
  const chainId = ref<number | null>(null);
  
  let walletClient: ReturnType<typeof createWalletClient> | null = null;
  
  // 检查 MetaMask 是否安装
  const isMetaMaskInstalled = computed(() => {
    return typeof window !== 'undefined' && 
           typeof window.ethereum !== 'undefined';
  });
  
  // 连接 MetaMask
  const connect = async () => {
    if (!isMetaMaskInstalled.value
      const txHash = await send('mint', [name]);
      
      return txHash;
    } catch (err: any) {
      error.value = err.message;
      throw err;
    }
  };
  
  // 检查名称是否可用
  const checkAvailability = async (name: string): Promise<boolean> => {
    try {
      const nameHash = await call('addr', [name]);
      const owner = await call('ownerOf', [nameHash]);
      return owner === '0x0000000000000000000000000000000000000000';
    } catch {
      return true;
    }
  };
  
  return {
    jnsInfo,
    loading,
    error,
    lookup,
    mint,
    checkAvailability,
    isConnected,
    account,
  };
}
```

**验收标准**：
- ✅ JNS 可以正常查询
- ✅ JNS Mint 功能正常工作
- ✅ MetaMask 连接和断开正常
- ✅ 错误处理完善

---

##### 阶段 4：JNSVote 治理系统迁移（2-3 周）

**目标**：迁移 JNSVote 治理投票功能

**重点优化**：
- POAP 验证逻辑
- 投票资格检查
- 投票进度展示
- 投票结果计算（V1/V2 规则）

**验收标准**：
- ✅ 投票列表正常显示
- ✅ 投票详情正常显示
- ✅ POAP 验证正常工作
- ✅ 投票资格检查正常工作
- ✅ 投票功能正常工作

---

##### 阶段 5：其他功能迁移（2 周）

**迁移清单**：
- [ ] CryptoJunks NFT
- [ ] Redpacket 红包
- [ ] 合约验证
- [ ] Timelock 信息

**验收标准**：
- ✅ 所有功能正常工作
- ✅ 性能优于旧版本

---

##### 阶段 6：优化和测试（1-2 周）

**性能优化**：
- [ ] 虚拟滚动实现
- [ ] 组件懒加载
- [ ] 图片优化（WebP、懒加载）
- [ ] 代码分割（Code Splitting）
- [ ] CDN 加速
- [ ] 缓存策略优化

**测试**：
- [ ] 单元测试（覆盖率 > 80%）
- [ ] E2E 测试（Playwright）
- [ ] 浏览器兼容性测试（Chrome、Firefox、Safari）
- [ ] 移动端测试（iOS、Android）
- [ ] 性能测试（Lighthouse Score > 90）

**文档**：
- [ ] API 文档（Swagger/OpenAPI）
- [ ] 组件文档（Storybook）
- [ ] 部署文档
- [ ] 维护手册

---

##### 阶段 7：部署和上线（1 周）

**部署清单**：
- [ ] 配置生产环境
- [ ] 配置 CI/CD
- [ ] 配置监控和告警
- [ ] 灰度发布
- [ ] 全量上线
- [ ] 监控数据对比

---

### 方案二：全面重构（大版本）

**适用场景**：有时间窗口，可以完全重写

**优势**：
- ✅ 可以彻底优化架构
- ✅ 可以引入新特性（SSR、PWA）
- ✅ 代码更简洁
- ✅ 长期维护成本低

**劣势**：
- ⚠️ 风险高
- ⚠️ 开发周期长（15-20 周）
- ⚠️ 可能丢失部分功能细节
- ⚠️ 需要更长的测试周期

**实施计划**：
1. 需求分析和设计（2 周）
2. 架构设计和技术选型（1 周）
3. 基础设施搭建（1 周）
4. 核心功能开发（8-10 周）
5. 测试和优化（3-4 周）
6. 部署和上线（1 周）

---

## 🛠️ 技术选型

### 前端框架：Vue 3 + TypeScript

**选型理由**：
- ✅ 生态成熟，社区活跃
- ✅ 性能优秀（虚拟 DOM、编译优化）
- ✅ Composition API 更好的逻辑复用
- ✅ TypeScript 支持完善
- ✅ 与现有 Vue 项目（如 faucet）技术栈一致
- ✅ 学习曲线相对平缓

**核心技术栈**：

```json
{
  "dependencies": {
    "vue": "^3.4.0",
    "vue-router": "^4.2.0",
    "pinia": "^2.1.0",
    "viem": "^1.20.0",
    "wagmi": "^1.4.0",
    "vue-virtual-scroller": "^2.0.0-beta.8"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.3.0",
    "@vitejs/plugin-vue": "^5.0.0",
    "vitest": "^1.0.0",
    "playwright": "^1.40.0",
    "@types/node": "^20.0.0",
    "prettier": "^3.0.0",
    "eslint": "^8.50.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

---

### Web3 库：Viem + Wagmi

**选型理由**：
- ✅ 比 web3.js 性能更好（更快的 RPC 调用）
- ✅ TypeScript 支持完善
- ✅ 更现代的 API 设计（Promise based）
- ✅ 更小的包体积
- ✅ 更好的错误处理

**Web3.js vs Viem 对比**：

| 特性 | web3.js | Viem |
|------|---------|-------|
| **包体积** | ~600KB | ~200KB |
| **性能** | 较慢 | 快 |
| **TypeScript** | 部分支持 | 完整支持 |
| **API 设计** | 回调风格 | Promise 风格 |
| **错误处理** | 较弱 | 完善 |
| **文档质量** | 一般 | 优秀 |

---

### 状态管理：Pinia

**选型理由**：
- ✅ Vue 3 官方推荐
- ✅ 类型安全
- ✅ 更简洁的 API（相比 Vuex）
- ✅ 支持 DevTools
- ✅ 更小的包体积

**Pinia Store 设计示例**：

```typescript
// stores/blockchain.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { JouleverseWeb3 } from '@jouleverse-explorer/core';

export const useBlockchainStore = defineStore('blockchain', () => {
  const web3 = new JouleverseWeb3();
  
  const latestBlock = ref<Block | null>(null);
  const networkStatus = ref<'online' | 'offline'>('online');
  
  const fetchLatestBlock = async () => {
    try {
      const block = await web3.getBlock('latest');
      latestBlock.value = block;
      
      // 更新网络状态
      const currentTime = Math.floor(Date.now() / 1000);
      const timeDiff = currentTime - block.timestamp;
      networkStatus.value = timeDiff < 60 ? 'online' : 'offline';
    } catch (error) {
      console.error('Failed to fetch latest block:', error);
      networkStatus.value = 'offline';
    }
  };
  
  return {
    latestBlock,
    networkStatus,
    fetchLatestBlock,
  };
});
```

---

### UI 组件库

#### 选项一：Element Plus（推荐）

**优势**：
- ✅ 功能完善，组件丰富（60+ 组件）
- ✅ 文档齐全，中文友好
- ✅ 社区活跃，更新频繁
- ✅ 适合企业级应用

**劣势**：
- ⚠️ 包体积较大（需要 tree-shaking）

#### 选项二：Naive UI

**优势**：
- ✅ 性能优秀
- ✅ 主题系统强大
- ✅ TypeScript 支持好
- ✅ 更现代的设计

**劣势**：
- ⚠️ 文档相对较少
- ⚠️ 社区相对较小

#### 选项三：Tailwind CSS + Headless UI（推荐）

**优势**：
- ✅ 更灵活的样式控制
- ✅ 更小的包体积
- ✅ 更好的性能
- ✅ 完全自定义

**劣势**：
- ⚠️ 需要自己实现部分组件

**推荐方案**：Tailwind CSS + 自定义组件库（`packages/ui`）

---

### 测试框架

#### 单元测试：Vitest

**优势**：
- ✅ 与 Vite 完美集成
- ✅ 更快的执行速度
- ✅ 兼容 Jest API
- ✅ 支持热更新

**测试示例**：

```typescript
// composables/__tests__/useBlockchain.test.ts
import { describe, it, expect, vi } from 'vitest';
import { useBlockchain } from '../useBlockchain';

describe('useBlockchain', () => {
  it('should fetch latest blocks', async () => {
    const { blocks, fetchLatestBlocks } = useBlockchain();
    
    await fetchLatestBlocks(5);
    
    expect(blocks.value.length).toBe(5);
  });
});
```

#### E2E 测试：Playwright

**优势**：
- ✅ 跨浏览器支持（Chrome、Firefox、Safari）
- ✅ 更快的执行速度（相比 Cypress）
- ✅ 更好的 TypeScript 支持
- ✅ 支持并行测试

**测试示例**：

```typescript
// e2e/block.spec.ts
import { test, expect } from '@playwright/test';

test('should display block list', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // 等待区块列表加载
  await page.waitForSelector('[data-testid="block-list"]');
  
  // 检查区块数量
  const blocks = await page.locator('[data-testid="block-item"]').count();
  expect(blocks).toBeGreaterThan(0);
});
```

---

## 📁 项目结构设计

```
jouleverse-explorer-vue/
├── packages/
│   ├── core/                      # 核心库
│   │   ├── src/
│   │   │   ├── web3/
│   │   │   │   ├── index.ts       # Web3 封装
│   │   │   │   ├── public.ts      # 公共客户端
│   │   │   │   └── wallet.ts      # 钱包客户端
│   │   │   ├── utils/
│   │   │   │   ├── format.ts      # 格式化工具
│   │   │   │   ├── time.ts        # 时间工具
│   │   │   │   └── validate.ts    # 验证工具
│   │   │   └── constants/
│   │   │       └── chain.ts       # 链配置
│   │   └── package.json
│   │
│   ├── contracts/                 # 合约定义
│   │   ├── src/
│   │   │   ├── jns.ts             # JNS 合约
│   │   │   ├── jns-vote.ts        # JNSVote 合约
│   │   │   ├── timelock.ts        # Timelock 合约
│   │   │   ├── cryptojunks.ts     # CryptoJunks 合约
│   │   │   ├── flyingj.ts         # FlyingJ 合约
│   │   │   ├── wj.ts              # WJ 合约
│   │   │   └── index.ts           # 统一导出
│   │   ├── abis/                  # ABI 文件
│   │   │   ├── JNS.json
│   │   │   ├── JNSVote.json
│   │   │   ├── Timelock.json
│   │   │   └── ...
│   │   └── package.json
│   │
│   └── ui/                        # UI 组件库
│       ├── src/
│       │   ├── components/
│       │   │   ├── BlockCard.vue  # 区块卡片
│       │   │   ├── TxCard.vue     # 交易卡片
│       │   │   ├── AddressBadge.vue # 地址徽章
│       │   │   ├── LoadingSpinner.vue # 加载动画
│       │   │   ├── PageHeader.vue # 页面头部
│       │   │   └── NetworkStatus.vue # 网络状态
│       │   └── index.ts
│       └── package.json
│
├── apps/
│   └── explorer/                  # 主应用
│       ├── src/
│       │   ├── main.ts            # 入口文件
│       │   ├── App.vue            # 根组件
│       │   │
│       │   ├── router/
│       │   │   └── index.ts       # 路由配置
│       │   │
│       │   ├── stores/
│       │   │   ├── blockchain.ts  # 区块链状态
│       │   │   ├── wallet.ts      # 钱包状态
│       │   │   └── ui.ts          # UI 状态
│       │   │
│       │   ├── views/
│       │   │   ├── Home.vue       # 首页（区块列表）
│       │   │   ├── BlockDetail.vue # 区块详情
│       │   │   ├── TransactionDetail.vue # 交易详情
│       │   │   ├── AddressDetail.vue # 地址详情
│       │   │   │
│       │   │   ├── jns/           # JNS 模块
│       │   │   │   ├── JNSHome.vue
│       │   │   │   ├── JNSDetail.vue
│       │   │   │   └── JNSMint.vue
│       │   │   │
│       │   │   └── vote/          # 投票模块
│       │   │       ├── JNSVoteHome.vue
│       │   │       └── JNSVoteDetail.vue
│       │   │
│       │   ├── composables/
│       │   │   ├── useBlockchain.ts # 区块链逻辑
│       │   │   ├── useBlock.ts     # 区块逻辑
│       │   │   ├── useTransaction.ts # 交易逻辑
│       │   │   ├── useAddress.ts   # 地址逻辑
│       │   │   ├── useJNS.ts       # JNS 逻辑
│       │   │   ├── useJNSVote.ts   # JNSVote 逻辑
│       │   │   ├── useMetaMask.ts  # MetaMask 逻辑
│       │   │   └── useContract.ts  # 合约调用封装
│       │   │
│       │   ├── services/
│       │   │   ├── blockchain.service.ts
│       │   │   ├── jns.service.ts
│       │   │   └── explorer.service.ts
│       │   │
│       │   ├── hooks/
│       │   │   ├── useWindowSize.ts
│       │   │   └── useScroll.ts
│       │   │
│       │   └── assets/
│       │       ├── styles/
│       │       │   └── main.css
│       │       └── images/
│       │
│       ├── public/
│       │   ├── favicon.ico
│       │   ├── .rpc.txt
│       │   └── robots.txt
│       │
│       ├── index.html
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── tailwind.config.js
│       └── .env.example
│
├── scripts/
│   ├── generate-types.ts           # 生成合约类型
│   ├── sync-contracts.ts           # 同步合约
│   └── deploy.sh                   # 部署脚本
│
├── docs/
│   ├── architecture.md             # 架构文档
│   ├── migration.md                # 迁移文档
│   ├── api.md                      # API 文档
│   └── deployment.md               # 部署文档
│
├── tests/
│   ├── e2e/                        # E2E 测试
│   └── unit/                       # 单元测试
│
├── .github/
│   └── workflows/
│       ├── ci.yml                  # CI 配置
│       └── deploy.yml              # 部署配置
│
├── .gitignore
├── package.json                    # Monorepo 配置
├── pnpm-workspace.yaml             # PNPM workspace 配置
├── turbo.json                      # Turborepo 配置
└── README.md
```

---

## 🔑 关键技术实现

### 1. 路由配置（Vue Router）

```typescript
// apps/explorer/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: { title: '首页' }
  },
  {
    path: '/block/:id',
    name: 'BlockDetail',
    component: () => import('@/views/BlockDetail.vue'),
    meta: { title: '区块详情' }
  },
  {
    path: '/tx/:hash',
    name: 'TransactionDetail',
    component: () => import('@/views/TransactionDetail.vue'),
    meta: { title: '交易详情' }
  },
  {
    path: '/address/:id',
    name: 'AddressDetail',
    component: () => import('@/views/AddressDetail.vue'),
    meta: { title: '地址详情' }
  },
  {
    path: '/jns/:name',
    name: 'JNSDetail',
    component: () => import('@/views/jns/JNSDetail.vue'),
    meta: { title: 'JNS 详情' }
  },
  {
    path: '/vote',
    name: 'JNSVoteHome',
    component: () => import('@/views/vote/JNSVoteHome.vue'),
    meta: { title: 'JNS 治理投票' }
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title} - Jouleverse Explorer`;
  next();
});

export default router;
```

---

### 2. 合约调用封装

```typescript
// composables/useContract.ts
import { ref } from 'vue';
import { useAccount, useContractRead, useContractWrite } from 'wagmi';

export function useContract(abi: any, address: string) {
  const { address: account } = useAccount();
  
  // 只读调用
  const call = async (methodName: string, args: any[] = []) => {
    const { data } = await useContractRead({
      address: address as `0x${string}`,
      abi,
      functionName: methodName,
      args,
    });
    return data;
  };
  
  // 写操作（需要 wallet）
  const send = async (methodName: string, args: any[] = []) => {
    if (!account.value) {
      throw new Error('请先连接钱包');
    }
    
    const { data, write } = await useContractWrite({
      address: address as `0x${string}`,
      abi,
      functionName: methodName,
      args,
      account: account.value,
    });
    
    await write();
    return data;
  };
  
  // 估算 gas
  const estimateGas = async (methodName: string, args: any[] = []) => {
    if (!account.value) {
      throw new Error('请先连接钱包');
    }
    
    const { data } = await useContractRead({
      address: address as `0x${string}`,
      abi,
      functionName: methodName,
      args,
      account: account.value,
    });
    
    return data;
  };
  
  return { call, send, estimateGas };
}
```

---

### 3. 虚拟滚动实现

```vue
<!-- components/VirtualBlockList.vue -->
<template>
  <div class="virtual-scroll">
    <RecycleScroller
      class="scroller"
      :items="blocks"
      :item-size="100"
      key-field="number"
      v-slot="{ item }"
    >
      <BlockCard :block="item" />
    </RecycleScroller>
  </div>
</template>

<script setup lang="ts">
import { RecycleScroller } from 'vue-virtual-scroller';
import { ref } from 'vue';
import type { Block } from '@jouleverse-explorer/core';
import BlockCard from './BlockCard.vue';

defineProps<{
  blocks: Block[];
}>();
</script>

<style scoped>
.scroller {
  height: calc(100vh - 200px);
}
</style>
```

---

### 4. 错误处理

```typescript
// utils/errorHandler.ts
import { ElMessage } from 'element-plus';

export const handleWeb3Error = (error: any) => {
  console.error('Web3 Error:', error);
  
  if (error.code === 4001) {
    // 用户拒绝交易
    ElMessage.error('您已取消交易');
  } else if (error.code === -32000) {
    // Insufficient funds
    ElMessage.error('余额不足');
  } else if (error.message?.includes('insufficient funds')) {
    ElMessage.error('Gas 费用不足');
  } else {
    ElMessage.error(error.message || '操作失败');
  }
};
```

---

## 📊 性能优化策略

### 1. 代码分割（Code Splitting）

```typescript
// 使用动态导入
const BlockDetail = () => import('@/views/BlockDetail.vue');
const TransactionDetail = () => import('@/views/TransactionDetail.vue');
```

### 2. 组件懒加载

```vue
<template>
  <Suspense>
    <template #default>
      <LazyComponent />
    </template>
    <template #fallback>
      <LoadingSpinner />
    </template>
  </Suspense>
</template>
```

### 3. 图片优化

```vue
<template>
  <img
    :src="blockImage"
    loading="lazy"
    decoding="async"
    alt="Block"
  />
</template>
```

### 4. 请求优化

```typescript
// 批量请求
const fetchBlocks = async (from: number, to: number) => {
  const promises = [];
  for (let i = from; i <= to; i++) {
    promises.push(web3.getBlock(i));
  }
  return await Promise.all(promises);
};

// 请求去重
const requestCache = new Map();
const cachedRequest = async (key: string, fn: () => Promise<any>) => {
  if (requestCache.has(key)) {
    return requestCache.get(key);
  }
  const result = await fn();
  requestCache.set(key, result);
  return result;
};
```

---

## 🚀 部署方案

### 1. 开发环境

```bash
cd apps/explorer
npm run dev
```

访问：http://localhost:5173

### 2. 生产环境构建

```bash
cd apps/explorer
npm run build
```

输出：`dist/` 目录

### 3. Nginx 配置

```nginx
server {
    listen 80;
    server_name explorer.jouleverse.com;
    
    # 前端静态文件
    location / {
        root /var/www/jouleverse-explorer-vue/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # 启用 gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # 缓存静态资源
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 4. Docker 部署

```dockerfile
FROM node:20-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

---

## 📅 时间规划（渐进式重构）

| 阶段 | 任务 | 时间 | 负责人 | 状态 |
|------|------|------|--------|------|
| 1 | 基础设施搭建 | 1-2 周 | 大白 | ⏳ 待开始 |
| 2 | 核心功能迁移 | 2-3 周 | 大白 | ⏳ 待开始 |
| 3 | JNS 系统迁移 | 3-4 周 | 大白 | ⏳ 待开始 |
| 4 | JNSVote 治理系统迁移 | 2-3 周 | 大白 | ⏳ 待开始 |
| 5 | 其他功能迁移 | 2 周 | 大白 | ⏳ 待开始 |
| 6 | 优化和测试 | 1-2 周 | 大白 | ⏳ 待开始 |
| 7 | 部署和上线 | 1 周 | 大白 | ⏳ 待开始 |

**总计**：12-17 周（约 3-4 个月）

---

## 💰 成本估算

### 人力成本

| 角色 | 时间 | 时薪 | 成本 |
|------|------|------|------|
| 全栈开发（大白） | 12-17 周 | - | - |

### 基础设施成本

| 资源 | 月费 | 年费 |
|------|------|------|
| 服务器（VPS） | ¥50-100 | ¥600-1200 |
| CDN（可选） | ¥100-200 | ¥1200-2400 |
| 域名 | - | ¥60/年 |

**总计**：约 ¥1860-3660/年

---

## ⚠️ 风险评估

### 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Viem API 不兼容 | 低 | 中 | 充分测试，准备降级方案 |
| TypeScript 类型错误 | 中 | 中 | 逐步迁移，及时修复 |
| 性能不如预期 | 中 | 中 | 性能测试，优化关键路径 |
| MetaMask 兼容性 | 低 | 高 | 多钱包测试，提供降级方案 |

### 业务风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 功能缺失 | 中 | 高 | 详细测试，功能对比 |
| 用户体验下降 | 低 | 中 | 灰度发布，收集反馈 |
| 上线延期 | 中 | 中 | 合理规划，预留缓冲 |

---

## 📝 成功标准

### 技术指标

- ✅ Lighthouse Performance Score > 90
- ✅ 首屏加载时间 < 2s
- ✅ 代码覆盖率 > 80%
- ✅ TypeScript 编译无错误
- ✅ 无 console.error 日志

### 业务指标

- ✅ 所有现有功能正常工作
- ✅ 用户留存率不下降
- ✅ 页面访问量保持稳定
- ✅ 用户反馈正面 > 80%

---

## 📚 附录

### A. 参考资源

- [Vue 3 官方文档](https://vuejs.org/)
- [Viem 文档](https://viem.sh/)
- [Wagmi 文档](https://wagmi.sh/)
- [Pinia 文档](https://pinia.vuejs.org/)
- [Playwright 文档](https://playwright.dev/)

### B. 类似项目

- [Etherscan](https://etherscan.io/)
- [BscScan](https://bscscan.com/)
- [Blockchair](https://blockchair.com/)

### C. 联系方式



---

**文档结束**

*最后更新：2026-03-18*
