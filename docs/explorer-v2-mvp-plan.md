# Jouleverse Explorer V2 - 完全重构方案

**项目代号**：Explorer V2  
**分支名称**：`explorer-v2`  
**创建时间**：2026-03-18  
**负责人**：大白（AI 助理）  
**重构策略**：MVP 原型驱动 + 增量功能移植

---

## 🎯 重构策略

### 核心理念

**最小化 MVP 原型 → 增量功能移植 → 废弃旧功能**

- ✅ **从零开始**：不受旧代码束缚，用现代化架构重新设计
- ✅ **MVP 优先**：快速构建最小可用版本，验证核心功能
- ✅ **增量移植**：逐个功能移植，每完成一个即可测试
- ✅ **果断废弃**：在移植过程中识别并废弃过时功能
- ✅ **持续交付**：每个功能模块完成后即可发布

---

## 📋 功能分析

### V1 功能清单（完整）

| # | 功能模块 | 优先级 | 复杂度 | 废弃建议 | 说明 |
|---|---------|--------|--------|----------|------|
| 1 | 区块列表（首页） | 🔴 P0 | 低 | 保留 | 核心功能 |
| 2 | 区块详情页 | 🔴 P0 | 低 | 保留 | 核心功能 |
| 3 | 交易详情页 | 🔴 P0 | 低 | 保留 | 核心功能 |
| 4 | 地址详情页 | 🔴 P0 | 中 | 保留 | 核心功能 |
| 5 | 搜索框（区块/交易/） | 🔴 P0 | 低 | 保留 | 核心功能 |
| 6 | JNS 域名查询 | 🟡 P1 | 高 | 保留 | 重要功能 |
| 7 | JNS Mint（MetaMask） | 🟡 P1 | 高 | 保留 | 重要功能 |
| 8 | JNS 记录展示 | 🟡 P1 | 中 | 保留 | 重要功能 |
| 9 | JNSVote 治理投票 | 🟢 P2 | 高高 | **保留** | 重要但复杂 |
| 10 | POAP 徽章验证 | 🟢 P2 | 中 | **保留** | JNSVote 依赖 |
| 11 | 投票资格检查 | 🟢 P2 | 高 | **保留** | JNSVote 依赖 |
| 12 | 投票进度展示 | 🟢 P2 | 中 | **保留** | JNSVote 依赖 |
| 13 | CryptoJunks NFT | 🟢 P2 | 中 | **考虑废弃** | 使用频率低 |
| 14 | Redpacket 红包 | 🟢 P2 | 中 | **考虑废弃** | 使用频率低 |
| 15 | Timelock 能量信息 | 🔴 P0 | 低 | 保留 | 首页展示 |
| 16 | 网络状态指示 | 🔴 P0 | 低 | 保留 | 首页展示 |
| 17 | 运行时间统计 | 🟡 P1 | 低 | 保留 | 首页展示 |
| 18 | 合约验证功能 | 🟢 P2 | 高高 | **考虑废弃** | 使用频率低，可单独做 |
| 19 | MetaMask 连接按钮 | 🟡 P1 | 中 | 保留 | JNS 等功能依赖 |

### 废弃建议总结

#### ✅ **保留功能**（MVP + 增量）

**MVP 阶段（P0）**：
1. 区块列表（首页）
2. 区块详情页
3. 交易详情页
4. 地址详情页
5. 搜索框
6. 网络状态指示
7. Timelock 能量信息

**增量阶段（P1）**：
1. JNS 域名查询
2. JNS Mint（MetaMask）
3. JNS 记录展示
4. MetaMask 连接按钮
5. 运行时间统计

**高级阶段（P2）**：
1. JNSVote 治理投票
2. POAP 徽章验证
3. 投票资格检查
4. 投票进度展示

#### ⚠️ **考虑废弃**（或独立项目）

1. **CryptoJunks NFT**
   - 理由：使用频率低，与其他功能关联度低
   - 建议：独立为专门的项目或页面
   
2. **Redpacket 红包**
   - 理由：使用频率低，可能与 Explorer 核心定位不符
   - 建议：独立为专门的项目或页面

3. **合约验证功能**
   - 理由：使用频率低，复杂度高，维护成本高
   - 建议：独立为专门的验证工具项目

---

## 🚀 MVP 原型设计（Phase 0）

### MVP 范围

**目标**：1-2 周完成，验证核心功能可行性

#### 功能清单

| # | 功能 | 子功能 | 优先级 | 预估时间 |
|---|------|--------|--------|----------|
| 1 | 首页区块列表 | 显示最新 10 个区块 | P0 | 1 天 |
| 2 | | 网络状态指示（绿/红点） | P0 | 0.5 天 |
| 3 | | 运行时间统计 | P0 | 0.5 天 |
| 4 | | Timelock 能量信息 | P0 | 1 天 |
| 5 | 区块详情页 | 显示区块信息 | P0 | 1 天 |
| 6 | | 显示交易列表（分页） | P0 | 1 天 |
| 7 | 交易详情页 | 显示交易信息 | P0 | 1 天 |
| 8 | | 显示交易输入/输出 | P0 | 0.5 天 |
| 9 | 地址详情页 | 显示地址信息 | P0 | 1 天 |
| 10 | | 显示余额 | P0 | 0.5 天 |
| 11 | | 显示交易历史（分页） | P0 | 1 天 |
| 12 | 搜索框 | 搜索区块（区块号/哈希） | P0 | 1 天 |
| 13 | | 搜索交易（交易哈希） | P0 | 0.5 天 |
| 14 | | 搜索地址（地址） | P0 | 0.5 天 |
| 15 | 基础优化 | 响应式设计 | P0 | 1 天 |
| 16 | | 错误处理 | P0 | 0.5 天 |
| 17 | | 加载状态 | P0 | 0.5 天 |

**总计**：约 12-13 天（约 2 周）

---

## 🏗️ 技术架构

### 技术选型（现代化）

| 技术领域 | 选择 | 版本 | 理由 |
|---------|------|------|------|
| **前端框架** | Vue 3 | ^3.4.0 | Composition API、性能优秀 |
| **开发语言** | TypeScript | ^5.3.0 | 类型安全、智能提示 |
| **构建工具** | Vite | ^5.0.0 | 快速、HMR、ESM |
| **路由** | Vue Router | ^4.2.0 | 官方路由、SSR 支持 |
| **状态管理** | Pinia | ^2.1.0 | 类型安全、简单易用 |
| **Web3 库** | Viem | ^1.20.0 | 性能优秀、TypeScript 支持 |
| **钱包集成** | Wagmi | ^1.4.0 | React 生态（或用 viem） |
| **UI 框架** | Tailwind CSS | ^3.3.0 | 原子化 CSS、灵活 |
| **UI 组件** | Element Plus | ^2.4.0 | 功能完善、中文友好 |
| **虚拟滚动** | vue-virtual-scroller | ^2.0.0 | 性能优化 |
| **测试框架** | Vitest | ^1.0.0 | 单元测试 |
| | Playwright | ^1.40.0 | E2E 测试 |
| **代码规范** | ESLint + Prettier | - | 代码风格统一 |
| **包管理器** | pnpm | ^8.0.0 | 更快、更省空间 |

---

## 📁 项目结构

```
jouleverse-explorer-v2/
├── apps/
│   └── explorer/                  # 主应用
│       ├── public/
│       │   ├── favicon.ico
│       │   └── .rpc.txt
│       │
│       ├── src/
│       │   ├── main.ts
│       │   ├── App.vue
│       │   │
│       │   ├── assets/
│       │   │   └── styles/
│       │   │       └── main.css
│       │   │
│       │   ├── router/
│       │   │   └── index.ts
│       │   │
│       │   ├── stores/
│       │   │   ├── blockchain.ts
│       │   │   └── ui.ts
│       │   │
│       │   ├── views/
│       │   │   ├── Home.vue
│       │   │   ├── BlockDetail.vue
│       │   │   ├── TransactionDetail.vue
│       │   │   └── AddressDetail.vue
│       │   │
│       │   ├── components/
│       │   │   ├── BlockCard.vue
│       │   │   ├── TxCard.vue
│       │   │   ├── AddressBadge.vue
│       │   │   ├── LoadingSpinner.vue
│       │   │   └── NetworkStatus.vue
│       │   │
│       │   ├── composables/
│       │   │   ├── useBlockchain.ts
│       │   │   ├── useBlock.ts
│       │   │   ├── useTransaction.ts
│       │   │   ├── useAddress.ts
│       │   │   └── useSearch.ts
│       │   │
│       │   ├── services/
│       │   │   ├── blockchain.service.ts
│       │   │   └── explorer.service.ts
│       │   │
│       │   └── types/
│       │       ├── block.ts
│       │       ├── transaction.ts
│       │       └── address.ts
│       │
│       ├── index.html
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── tailwind.config.js
│
├── packages/
│   ├── core/                      # 核心库（可选）
│   │   ├── src/
│   │   │   ├── web3/
│   │   │   │   └── index.ts
│   │   │   └── utils/
│   │   │       └── format.ts
│   │   └── package.json
│   │
│   └── contracts/                 # 合约定义（可选）
│       ├── src/
│       │   ├── jns.ts
│       │   └── timelock.ts
│       └── package.json
│
├── scripts/
│   └── setup.sh                    # 快速启动脚本
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── migration.md
│
├── .gitignore
├── package.json
└── README.md
```

---

## 📅 迁移计划

### Phase 0：MVP 原型（2 周）

**目标**：验证核心功能可行性

| 步骤 | 任务 | 预估时间 | 状态 |
|------|------|----------|------|
| 0.1 | 项目初始化（Vite + Vue 3 + TS） | 0.5 天 | ⏳ |
| 0.2 | 配置 Tailwind CSS + Element Plus | 0.5 天 | ⏳ |
| 0.3 | 配置 Vue Router | 0.5 天 | ⏳ |
| 0.4 | 配置 Pinia | 0.5 天 | ⏳ |
| 0.5 | 配置 Viem Web3 客户端 | 1 天 | ⏳ |
| 0.6 | 首页区块列表 | 1 天 | ⏳ |
| 0.7 | 网络状态 + 运行时间 | 1 天 | ⏳ |
| 0.8 | Timelock 能量信息 | 1 天 | ⏳ |
| 0.9 | 区块详情页 | 2 天 | ⏳ |
| 0.10 | 交易详情页 | 1.5 天 | ⏳ |
| 0.11 | 地址详情页 | 1.5 天 | ⏳ |
| 0.12 | 搜索框功能 | 1.5 天 | ⏳ |
| 0.13 | 响应式设计 + 基础优化 | 1 天 | ⏳ |
| 0.14 | 错误处理 + 加载状态 | 0.5 天 | ⏳ |
| 0.15 | 测试 + 部署 | 1 天 | ⏳ |

---

### Phase 1：JNS 功能（3-4 周）

**目标**：移植 JNS 核心功能

| 步骤 | 任务 | 预估时间 | 状态 |
|------|------|----------|------|
| 1.1 | MetaMask 连接组件 | 1 天 | ⏳ |
| 1.2 | JNS 域名查询 | 2 天 | ⏳ |
| 1.3 | JNS 详情页 | 2 天 | ⏳ |
| 1.4 | JNS Mint 功能 | 3 天 | ⏳ |
| 1.5 | JNS 记录展示 | 2 天 | ⏳ |
| 1.6 | 错误处理 + 用户反馈 | 1 天 | ⏳ |
| 1.7 | 测试 + 部署 | 1 天 | ⏳ |

---

### Phase 2：JNSVote 治理（2-3 周）

**目标**：移植 JNSVote 投票功能

| 步骤 | 任务 | 预估时间 | 状态 |
|------|------|----------|------|
| 2.1 | POAP 徽章验证 | 2 天 | ⏳ |
| 2.2 | 投票资格检查 | 2 天 | ⏳ |
| 2.3 | 投票列表页 | 1.5 天 | ⏳ |
| 2.4 | 投票详情页 | 2 天 | ⏳ |
| 2.5 | 投票功能 | 3 天 | ⏳ |
| 2.6 | 投票进度展示 | 1.5 天 | ⏳ |
| 2.7 | 测试 + 部署 | 1 天 | ⏳ |

---

### Phase 3：性能优化与测试（1-2 周）

| 步骤 | 任务 | 预估时间 | 状态 |
|------|------|----------|------|
| 3.1 | 虚拟滚动实现 | 1 天 | ⏳ |
| 3.2 | 组件懒加载 | 0.5 天 | ⏳ |
| 3.3 | 图片优化 | 0.5 天 | ⏳ |
| 3.4 | 代码分割 | 0.5 天 | ⏳ |
| 3.5 | 单元测试（覆盖率 > 80%） | 2 天 | ⏳ |
| 3.6 | E2E 测试 | 1 天 | ⏳ |
| 3.7 | 性能测试（Lighthouse > 90） | 1 天 | ⏳ |

---

### Phase 4：部署与上线（1 周）

| 步骤 | 任务 | 预估时间 | 状态 |
|------|------|----------|------|
| 4.1 | 生产环境配置 | 0.5 天 | ⏳ |
| 4.2 | CI/CD 配置 | 0.5 天 | ⏳ |
| 4.3 | 灰度发布 | 1 天 | ⏳ |
| 4.4 | 监控配置 | 0.5 天 | ⏳ |
| 4.5 | 全量上线 | 0.5 天 | ⏳ |
| 4.6 | 旧版本下线 | 1 天 | ⏳ |

---

**总计**：9-13 周（约 2-3 个月）

---

## 🔄 分支策略

### 主分支

- `main` - 稳定版本（V1，当前生产版本）
- `explorer-v2` - V2 开发分支
- `explorer-v2-mvp` - MVP临时分支
- `phase-1-jns` - JNS 功能开发
- `phase-2-vote` - JNSVote 功能开发
- `phase-3-optimization` - 性能优化

### 分支工作流

1. 从 `explorer-v2` 分支创建功能分支
2. 完成功能开发后，合并回 `explorer-v2`
3. 每完成一个 Phase，打一个 tag

示例：
```bash
# 创建 V2 分支
git checkout -b explorer-v2

# 开发 MVP
git checkout -b explorer-v2-mvp
# ... 开发 MVP ...
git checkout explorer-v2
git merge explorer-v2-mvp

# 打 MVP tag
git tag -a v2.0.0-mvp -m "Explorer V2 MVP"

# 开发 JNS 功能
git checkout -b phase-1-jns
# ... 开发 JNS ...
git checkout explorer-v2
git merge phase-1-jns

# 打 Phase 1 tag
git tag -a v2.1.0 -m "Explorer V2 Phase 1 - JNS"
```

---

## 📝 MVP 实现细节

### 1. 首页区块列表

#### 功能需求
- 显示最新 10 个区块
- 每个区块显示：区块号、区块哈希、时间、交易数、矿工
- 网络状态指示（绿/红点）
- 运行时间统计
- Timelock 能量信息

#### 组件设计

```vue
<!-- views/Home.vue -->
<template>
  <div class="home">
    <!-- 页面头部 -->
    <PageHeader title="Jouleverse Explorer" />
    
    <!-- 网络状态 -->
    <div class="status-bar">
      <NetworkStatus :status="networkStatus" />
      <UptimeBadge :uptime="uptime" />
    </div>
    
    <!-- 能量信息 -->
    <EnergyInfo v-if="energy" :energy="energy" />
    
    <!-- 区块列表 -->
    <BlockList :blocks="blocks" :loading="loading" />
    
    <!-- 搜索框 -->
    <SearchBox @search="handleSearch" />
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
  fetchLatestBlocks
} = useBlockchain();

onMounted(() => {
  fetchLatestBlocks(10);
});
</script>
```

#### Composable 设计

```typescript
// composables/useBlockchain.ts
import { ref, onMounted } from 'vue';
import { createPublicClient, http } from 'viem';
import { jouleverseChain } from '@/config/chain';

export function useBlockchain() {
  const client = createPublicClient({
    transport: http('https://rpc.jnsdao.com:8503'),
    chain: jouleverseChain,
  });
  
  const networkStatus = ref<'online' | 'offline'>('online');
  const uptime = ref<string>('');
  const energy = ref<EnergyInfo | null>(null);
  const blocks = ref<Block[]>([]);
  const loading = ref(false);
  
  // 获取最新区块
  const fetchLatestBlocks = async (count: number) => {
    loading.value = true;
    try {
      const latestBlock = await client.getBlock({ blockTag: 'latest' });
      if (!latestBlock) return;
      
      const fromRange = Math.max(0, Number(latestBlock.number) - count);
      const toRange = Number(latestBlock.number);
      
      blocks.value = [];
      for (let i = toRange; i >= fromRange; i--) {
        const block = await client.getBlock({ blockNumber: BigInt(i) });
        if (block) {
          blocks.value.push({
            number: Number(block.number),
            hash: block.hash,
            timestamp: Number(block.timestamp),
            transactionCount: block.transactions.length,
            miner: block.miner,
          });
        }
      }
      
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
  
  return {
    networkStatus,
    uptime,
    energy,
    blocks,
    loading,
    fetchLatestBlocks,
  };
}
```

---

### 2. 区块详情页

#### 功能需求
- 显示区块基本信息（区块号、哈希、时间、矿工、Gas等）
- 显示交易列表（分页，每页 20 条）
- 提供交易详情链接

#### 组件设计

```vue
<!-- views/BlockDetail.vue -->
<template>
  <div class="block-detail">
    <PageHeader :title="`区块 #${blockNumber}`" />
    
    <!-- 区块信息 -->
    <BlockInfo v-if="block" :block="block" />
    
    <!-- 交易列表 -->
    <TransactionList
      :transactions="transactions"
      :loading="loading"
      :page="page"
      :total-pages="totalPages"
      @page-change="handlePageChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useBlock } from '@/composables/useBlock';

const route = useRoute();
const blockNumber = route.params.id as string;

const {
  block,
  transactions,
  loading,
  page,
  totalPages,
  fetchBlock,
  fetchTransactions
} = useBlock();

onMounted(async () => {
  await fetchBlock(blockNumber);
  await fetchTransactions(blockNumber, 1);
});
</script>
```

---

### 3. 交易详情页

#### 功能需求
- 显示交易基本信息（哈希、区块号、时间、发送者、接收者、值、Gas等）
- 解码交易输入数据（如果是合约调用）
- 显示交易状态（成功/失败）

---

### 4. 地址详情页

#### 功能需求
- 显示地址基本信息（地址、余额、交易数等）
- 显示交易历史（分页）
- 显示 Token 余额（如果有）

---

## 🧪 测试策略



### 单元测试

```typescript
// composables/__tests__/useBlockchain.test.ts
import { describe, it, expect, vi } from 'vitest';
import { useBlockchain } from '../useBlockchain';

describe('useBlockchain', () => {
  it('should fetch latest blocks', async () => {
    const { blocks, fetchLatestBlocks } = useBlockchain();
    
    await fetchLatestBlocks(5);
    
    expect(blocks.value.length).toBe(5);
    expect(blocks.value[0].number).toBeGreaterThan(0);
  });
  
  it('should handle network status', async () => {
    const { networkStatus, fetchLatestBlocks } = useBlockchain();
    
    await fetchLatestBlocks(1);
    
    expect(['online', 'offline']).toContain(networkStatus.value);
  });
});
```

### E2E 测试

```typescript
// e2e/home.spec.ts
import { test, expect } from '@playwright/test';

test('should display block list', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // 等待区块列表加载
  await page.waitForSelector('[data-testid="block-list"]');
  
  // 检查区块数量
  const blocks = await page.locator('[data-testid="block-item"]').count();
  expect(blocks).toBeGreaterThan(0);
  
  // 检查网络状态
  const networkStatus = await page.locator('[data-testid="network-status"]').textContent();
  expect(networkStatus).toMatch(/在线|离线/);
});

test('should navigate to block detail', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // 点击第一个区块
  await page.locator('[data-testid="block-item"]').first().click();
  
  // 检查 URL
  expect(page.url()).toMatch(/\/block\/\d+/);
  
  // 检查区块信息
  await expect(page.locator('[data-testid="block-info"]')).toBeVisible();
});
```

---

## 🚀 快速启动

### 项目初始化

```bash
# 1. 创建项目
npm create vite@latest jouleverse-explorer-v2 -- --template vue-ts

# 2. 进入项目目录
cd jouleverse-explorer-v2

# 3. 安装依赖
npm install

# 4. 安装额外依赖
npm install vue-router pinia viem
npm install -D tailwindcss postcss autoprefixer
npm install element-plus

# 5. 初始化 Tailwind CSS
npx tailwindcss init -p

# 6. 初始化 Git
git init
git add .
git commit -m "init: Explorer V2 项目初始化"
```

### 启动开发服务器

```bash
npm run dev
```

访问：http://localhost:5173

---

## 📊 成功标准

### MVP 阶段

- ✅ 所有 P0 功能正常工作
- ✅ Lighthouse Performance Score > 80
- ✅ 首屏加载时间 < 3s
- ✅ 无重大 Bug
- ✅ 通过基础测试

### 最终阶段

- ✅ 所有保留功能正常工作
- ✅ Lighthouse Performance Score > 90
- ✅ 首屏加载时间 < 2s
- ✅ 代码覆盖率 > 80%
- ✅ 无线上 Bug
- ✅ 用户反馈正面

---

## 🎉 总结

Explorer V2 完全重构方案：

- **策略**：MVP 原型驱动 + 增量功能移植
- **优势**：不受旧代码束缚，现代化架构，果断废弃
- **周期**：9-13 周（约 2-3 个月）
- **废弃**：CryptoJunks、Redpacket、合约验证功能
- **保留**：核心浏览功能、JNS、JNSVote

这是一个勇敢而明智的选择，可以最大程度减少老系统的累赘！

---

*最后更新：2026-03-18*
