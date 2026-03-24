# Explorer V2 地址详情页资产展示策略

**文档版本**: v1.0
**创建时间**: 2026-03-21
**负责人**: 大白（AI 助理）
**邮箱**: evan@blockcoach.com

---

## 📋 背景与问题

### 问题背景

在 Explorer V2 的地址详情页中，需要展示用户的各类资产：
- **原生代币**: J（Gas）
- **ERC20 代币**: WJ 等代币
- **NFT 资产**: JNS 域名、CryptoJunks 等
- **第三方资产**: 生态开发者发行的各类代币和 NFT

### 核心挑战

Jouleverse 生态资产会不断增长，Explorer 无法自动发现和添加新资产。如何设计一个既灵活又可控的资产管理系统？

面臨三种方案：
1. **中心化更新** - 通过发布新版本增加资产配置
2. **用户自管理** - 让用户手动添加自己的资产
3. **开放式提交** - 让第三方开发者提交资产，审核后纳入

---

## 📊 方案对比分析

### 方案1：中心化更新

**机制**: 官方团队通过发布新版本，在代码中增加新资产配置

**优点:**
- ✅ 代码质量可控，资产信息准确
- ✅ 用户体验好，无需手动操作
- ✅ 安全性高，不会出现虚假/scam 资产
- ✅ 界面统一，品牌一致

**缺点:**
- ❌ 开发负担重，需要不断跟进新资产
- ❌ 更新延迟，新资产无法及时展示
- ❌ 中心化程度高，生态依赖官方
- ❌ 第三方开发者积极性低

**适用场景**: 核心基础设施资产

---

### 方案2：用户自管理

**机制**: 每个用户手动添加自己关注的资产

**优点:**
- ✅ 灵活性最高，用户完全自主
- ✅ 开发者负担最轻
- ✅ 可以立即看到新资产

**缺点:**
- ❌ 用户体验差，每个用户都需要手动添加
- ❌ 可能出现虚假/scam 资产
- ❌ 数据不共享，每个人维护自己的列表
- ❌ 技术复杂度高（需要存储用户配置）

**适用场景**: 高级用户的个性化需求

---

### 方案3：开放式提交

**机制**: 第三方开发者提交资产，审核后纳入 Explorer

**优点:**
- ✅ 平衡了开发效率和用户体验
- ✅ 鼓励第三方开发者参与生态建设
- ✅ 质量可控（通过审核机制）
- ✅ 社区驱动的生态发展

**缺点:**
- ⚠️ 需要建立审核流程和管理机制
- ⚠️ 仍然有中心化的痕迹（审核流程）
- ⚠️ 维护成本适中

**适用场景**: 生态资产管理

---

## 💡 推荐方案：混合策略

我建议采用**分层策略**，结合方案1和方案3：

### 🎯 核心资产层（方案1）

**机制**: 中心化管理

**范围:**
- **核心代币**: J、WJ 等
- **核心 NFT**: JNS 域名、CryptoJunks（如果保留）
- **核心合约**: JNS、JNSVote、Timelock 等

**原因:**
- 这是 Jouleverse 网络的基础设施
- 数量相对固定，不需要频繁更新
- 需要保证准确性和安全性

**实现示例:**

```typescript
// config/core-assets.ts
export const CORE_ASSETS = {
  tokens: [
    {
      symbol: 'J',
      name: 'Joule',
      type: 'native',
      decimals: 18,
      icon: '/assets/icons/j.svg',
      description: 'Jouleverse 原生代币',
    },
    {
      symbol: 'WJ',
      name: 'Wrapped Joule',
      type: 'ERC20',
      address: '0x7fba9BB966189Db8C4fE33B7bf67Bfa24203c6AD',
      decimals: 18,
      icon: '/assets/icons/wj.svg',
      description: 'J 代币的 ERC20 包装版本',
    },
  ],
  nfts: [
    {
      name: 'JNS Domain',
      type: 'NFT',
      address: '0x...', // JNS 合约地址
      icon: '/assets/icons/jns.svg',
      metadata: {
        category: 'domain',
        description: 'Jouleverse 域名系统',
        website: 'https://jns.jnsdao.com',
      },
    },
    // CryptoJunks（如果保留）
  ],
}
```

---

### 🌐 生态资产层（方案3）

**机制**: 开放式注册表 + 审核

**范围:**
- 第三方开发者发行的 ERC20 代币
- 第三方 NFT 项目
- 社区认可的其他资产

**原因:**
- 生态资产数量多、增长快
- 需要社区参与和维护
- 质量需要控制

---

## 🔧 技术实现方案

### 方案A：链上注册表（长期推荐）

**合约设计:**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AssetRegistry {
    enum AssetType { ERC20, NFT, OTHER }
    enum AssetStatus { Pending, Approved, Rejected }

    struct AssetInfo {
        address assetAddress;      // 合约地址
        AssetType assetType;        // 资产类型
        string symbol;
        string name;
        string iconUri;             // IPFS 或 HTTP URL
        string metadata;            // JSON metadata
        address submitter;          // 提交者地址
        AssetStatus status;
        uint256 timestamp;
    }

    // 已批准的资产列表
    mapping(address => AssetInfo) public assets;
    address[] public approvedAssets;

    // 只有管理员可以批准/拒绝
    address public admin;

    constructor() {
        admin = msg.sender;
    }

    // 提交新资产
    function submitAsset(
        address _assetAddress,
        AssetType _assetType,
        string memory _symbol,
        string memory _name,
        string memory _iconUri,
        string memory _metadata
    ) public {
        require(assets[_assetAddress].submitter == address(0), "Asset already submitted");

        assets[_assetAddress] = AssetInfo({
            assetAddress: _assetAddress,
            assetType: _assetType,
            symbol: _symbol,
            name: _name,
            iconUri: _iconUri,
            metadata: _metadata,
            submitter: msg.sender,
            status: AssetStatus.Pending,
            timestamp: block.timestamp
        });
    }

    // 批准资产（仅管理员）
    function approveAsset(address _assetAddress) public {
        require(msg.sender == admin, "Only admin");
        require(assets[_assetAddress].status == AssetStatus.Pending, "Not pending");

        assets[_assetAddress].status = AssetStatus.Approved;
        approvedAssets.push(_assetAddress);
    }

    // 拒绝资产（仅管理员）
    function rejectAsset(address _assetAddress) public {
        require(msg.sender == admin, "Only admin");
        assets[_assetAddress].status = AssetStatus.Rejected;
    }

    // 获取已批准的资产数量
    function getApprovedAssetsCount() public view returns (uint256) {
        return approvedAssets.length;
    }

    // 获取已批准的资产列表
    function getApprovedAssets(uint256 _offset, uint256 _limit) public view returns (AssetInfo[] memory) {
        uint256 count = _limit;
        if (_offset + _limit > approvedAssets.length) {
            count = approvedAssets.length - _offset;
        }

        AssetInfo[] memory result = new AssetInfo[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = assets[approvedAssets[_offset + i]];
        }
        return result;
    }
}
```

**流程:**
1. 第三方开发者调用 `submitAsset` 提交资产信息
2. 提交状态为 `Pending`
3. 管理员审核后调用 `approveAsset` 或 `rejectAsset`
4. Explorer 自动读取已批准的资产并展示

**前端实现:**

```typescript
// services/asset-registry.ts
import { createPublicClient, http } from 'viem'

const client = createPublicClient({
  transport: http('https://rpc.jnsdao.com:8503'),
  // chain: jouleverse,
})

const ASSET_REGISTRY_ADDRESS = '0x...' // 部署后的合约地址

const ASSET_REGISTRY_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "_assetAddress", "type": "address"},
      {"internalType": "uint8", "name": "_assetType", "type": "uint8"},
      {"internalType": "string", "name": "_symbol", "type": "string"},
      {"internalType": "string", "name": "_name", "type": "string"},
      {"internalType": "string", "name": "_iconUri", "type": "string"},
      {"internalType": "string", "name": "_metadata", "type": "string"}
    ],
    "name": "submitAsset",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "_assetAddress", "type": "address"}],
    "name": "approveAsset",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getApprovedAssetsCount",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_offset", "type": "uint256"},
      {"internalType": "uint256", "name": "_limit", "type": "uint256"}
    ],
    "name": "getApprovedAssets",
    "outputs": [{"components": [...], "internalType": "struct AssetRegistry.AssetInfo", "name": "", "type": "tuple"}],
    "stateMutability": "view",
    "type": "function"
  }
]

export async function fetchEcosystemAssets() {
  try {
    // 获取已批准的资产数量
    const count = await client.readContract({
      address: ASSET_REGISTRY_ADDRESS,
      abi: ASSET_REGISTRY_ABI,
      functionName: 'getApprovedAssetsCount',
    })

    // 分页获取资产列表
    const assets = await client.readContract({
      address: ASSET_REGISTRY_ADDRESS,
      abi: ASSET_REGISTRY_ABI,
      functionName: 'getApprovedAssets',
      args: [0, Number(count)],
    })

    return assets
  } catch (error) {
    console.error('Failed to fetch ecosystem assets:', error)
    return []
  }
}
```

---

### 方案B：GitHub Registry（轻量级快速方案）

**仓库结构:**

```
jouleverse/asset-registry
├── assets/
│   ├── erc20.json
│   ├── nft.json
│   └── other.json
├── pending/
│   ├── 2026-03-21-token001.json
│   └── 2026-03-21-nft001.json
├── templates/
│   ├── erc20-template.json
│   └── nft-template.json
└── README.md
```

**资产定义示例:**

```json
// assets/erc20.json
{
  "version": "1.0",
  "lastUpdated": "2026-03-21T00:00:00Z",
  "assets": [
    {
      "id": "token-001",
      "symbol": "MYTOKEN",
      "name": "My Token",
      "type": "ERC20",
      "address": "0x...",
      "decimals": 18,
      "icon": "https://...",
      "metadata": {
        "description": "My Token 是 Jouleverse 生态的一个示例代币",
        "website": "https://mytoken.com",
        "social": {
          "twitter": "https://twitter.com/mytoken",
          "discord": "https://discord.gg/mytoken",
          "telegram": "https://t.me/mytoken"
        },
        "audits": [
          {
            "name": "Certik",
            "url": "https://...",
            "date": "2026-01-01"
          }
        ]
      },
      "submitter": "0x...",
      "status": "approved",
      "submittedAt": "2026-03-21T00:00:00Z",
      "approvedAt": "2026-03-21T00:00:00Z",
      "approver": "clawd"
    }
  ]
}
```

**流程:**
1. 第三方开发者 Fork asset-registry 仓库
2. 提交资产定义文件到 `pending/` 目录
3. 创建 Pull Request
4. 社区审核（讨论、测试、验证）
5. 审核通过后合并到 `assets/` 目录
6. Explorer 自动从 GitHub 读取资产列表

**前端实现:**

```typescript
// services/github-registry.ts
import fetch from 'node-fetch'

const GITHUB_REPO = 'jouleverse/asset-registry'
const GITHUB_API = 'https://api.github.com'

export async function fetchEcosystemAssets() {
  try {
    // 获取 ERC20 代币
    const erc20Response = await fetch(
      `${GITHUB_API}/repos/${GITHUB_REPO}/contents/assets/erc20.json`
    )
    const erc20Data = await erc20Response.json()
    const erc20Content = JSON.parse(atob(ercc20Data.content))

    // 获取 NFT
    const nftResponse = await fetch(
      `${GITHUB_API}/repos/${GITHUB_REPO}/contents/assets/nft.json`
    )
    const nftData = await nftResponse.json()
    const nftContent = JSON.parse(atob(nftData.content))

    return {
      tokens: erc20Content.assets,
      'nfts': nftContent.assets,
    }
  } catch (error) {
    console.error('Failed to fetch assets from GitHub:', error)
    return { tokens: [], nfts: [] }
  }
}
```

---

## 🏗️ Explorer 前端集成

### Composable 设计

```typescript
// composables/useAssets.ts
import { ref } from 'vue'
import { CORE_ASSETS } from '@/config/core-assets'
import { fetchEcosystemAssets } from '@/services/asset-registry'

export interface Asset {
  id: string
  symbol: string
  name: string
  type: 'native' | 'ERC20' | 'NFT' | 'OTHER'
  address?: string
  decimals?: number
  icon: string
  metadata?: any
}

export function useAssets() {
  const coreAssets = CORE_ASSETS
  const ecosystemAssets = ref<{
    tokens: Asset[]
    nfts: Asset[]
  }>({ tokens: [], nfts: [] })
  const loading = ref(false)

  // 获取生态资产
  const fetchEcosystemAssetsList = async () => {
    loading.value = true
    try {
      ecosystemAssets.value = await fetchEcosystemAssets()
    } catch (error) {
      console.error('Failed to fetch ecosystem assets:', error)
    } finally {
      loading.value = false
    }
  }

  // 获取用户的核心资产余额
  const fetchCoreBalances = async (address: string) => {
    // 获取原生代币余额
    const nativeBalance = await client.getBalance({ address })

    // 获取 WJ 余额
    const wjBalance = await client.readContract({
      address: WJ_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    })

    // 获取 JNS NFT
    const jnsBalance = await client.readContract({
      address: JNS_ADDRESS,
      abi: ERC721_ABI,
      functionName: 'balanceOf',
      args: [address],
    })

    return {
      tokens: [
        { ...coreAssets.tokens[0], balance: nativeBalance },
        { ...coreAssets.tokens[1], balance: wjBalance },
      ],
      nfts: [
        { ...coreAssets.nfts[0], balance: jnsBalance },
      ],
    }
  }

  // 获取用户的生态资产余额
  const fetchEcosystemBalances = async (address: string) => {
    const tokenBalances: Asset[] = []
    const nftBalances: Asset[] = []

    // 遍历生态资产，获取余额
    for (const token of ecosystemAssets.value.tokens) {
      const balance = await client.readContract({
        address: token.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      })

      if (balance > 0n) {
        tokenBalances.push({ ...token, balance })
      }
    }

    for (const nft of ecosystemAssets.value.nfts) {
      const balance = await client.readContract({
        address: nft.address as `0x${string}`,
        abi: ERC721_ABI,
        functionName: 'balanceOf',
        args: [address],
      })

      if (balance > 0n) {
        nftBalances.push({ ...nft, balance })
      }
    }

    return {
      tokens: tokenBalances,
      nfts: nftBalances,
    }
  }

  // 获取用户的所有资产
  const fetchUserAssets = async (address: string) => {
    const [coreBalances, ecosystemBalances] = await Promise.all([
      fetchCoreBalances(address),
      fetchEcosystemBalances(address),
    ])

    return {
      core: coreBalances,
      ecosystem: ecosystemBalances,
    }
  }

  return {
    coreAssets,
    ecosystemAssets,
    loading,
    fetchEcosystemAssetsList,
    fetchUserAssets,
  }
}
```

---

## 🎨 地址详情页 UI 设计

### 页面布局

```vue
<!-- views/AddressDetail.vue -->
<template>
  <div class="address-detail">
    <!-- 页面头部 -->
    <div class="header">
      <h1>地址详情</h1>
      <div class="address-badge">
        <span class="address-hash">{{ formatAddress(address) }}</span>
        <button @click="copyAddress" class="copy-btn">复制</button>
      </div>
    </div>

    <!-- 地址概览 -->
    <section class="overview">
      <div class="stat-card">
        <span class="label">原生余额</span>
        <span class="value">{{ formatBalance(nativeBalance) }} J</span>
      </div>
      <div class="stat-card">
        <span class="label">交易总数</span>
        <span class="value">{{ transactionCount }}</span>
      </div>
      <div class="stat-card">
        <span class="label">资产数量</span>
        <span class="value">{{ totalAssetCount }}</span>
      </div>
    </section>

    <!-- 核心资产 -->
    <section class="assets-section">
      <div class="section-header">
        <h2>核心资产</h2>
        <span class="badge badge-primary">官方</span>
      </div>

      <div v-if="userAssets.core.tokens.length > 0" class="token-list">
        <div v-for="token in userAssets.core.tokens" :key="token.symbol" class="token-card">
          <img :src="token.icon" :alt="token.symbol" class="token-icon" />
          <div class="token-info">
            <span class="token-name">{{ token.name }}</span>
            <span class="token-symbol">{{ token.symbol }}</span>
          </div>
          <span class="token-balance">{{ formatBalance(token.balance) }}</span>
        </div>
      </div>

      <div v-if="userAssets.core.nfts.length > 0" class="nft-grid">
        <div v-for="nft in userAssets.core.nfts" :key="nft.name" class="nft-card">
          <img :src="nft.icon" :alt="nft.name" class="nft-image" />
          <div class="nft-info">
            <span class="nft-name">{{ nft.name }}</span>
            <span class="nft-count">{{ nft.balance }} 个</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 生态资产 -->
    <section class="assets-section">
      <div class="section-header">
        <h2>生态资产</h2>
        <span class="badge badge-secondary">社区</span>
        <a href="https://github.com/jouleverse/asset-registry" target="_blank" class="learn-more">
          提交资产 →
        </a>
      </div>

      <div v-if="loading" class="loading">
        <span>加载中...</span>
      </div>

      <div v-else-if="userAssets.ecosystem.tokens.length === 0 && userAssets.ecosystem.nfts.length === 0" class="empty">
        <p>暂无生态资产</p>
      </div>

      <div v-else>
        <div v-if="userAssets.ecosystem.tokens.length > 0" class="token-list">
          <div v-for="token in userAssets.ecosystem.tokens" :key="token.symbol" class="token-card">
            <img :src="token.icon" :alt="token.symbol" class="token-icon" />
            <div class="token-info">
              <span class="token-name">{{ token.name }}</span>
              <span class="token-symbol">{{ token.symbol }}</span>
            </div>
            <span class="token-balance">{{ formatBalance(token.balance) }}</span>
          </div>
        </div>

        <div v-if="userAssets.ecosystem.nfts.length > 0" class="nft-grid">
          <div v-for="nft in userAssets.ecosystem.nfts" :key="nft.name" class="nft-card">
            <img :src="nft.icon" :alt="nft.name" class="nft-image" />
            <div class="nft-info">
              <span class="nft-name">{{ nft.name }}</span>
              <span class="nft-count">{{ nft.balance }} 个</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 交易历史 -->
    <section class="transactions-section">
      <div class="section-header">
        <h2>交易历史</h2>
        <Pagination
          :page="currentPage"
          :totalPages="totalPages"
          @page-change="handlePageChange"
        />
      </div>

      <TransactionList :transactions="transactions" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAssets } from '@/composables/useAssets'

const route = useRoute()
const address = route.params.id as string

const {
  fetchUserAssets,
  fetchEcosystemAssetsList,
} = useAssets()

const nativeBalance = ref(0n)
const transactionCount = ref(0)
const userAssets = ref({
  core: { tokens: [], nfts: [] },
  ecosystem: { tokens: [], nfts: [] },
})
const transactions = ref([])
const currentPage = ref(1)
const totalPages = ref(1)

const totalAssetCount = computed(() => {
  return (
    userAssets.value.core.tokens.length +
    userAssets.value.core.nfts.length +
    userAssets.value.ecosystem.tokens.length +
    userAssets.value.ecosystem.nfts.length
  )
})

onMounted(async () => {
  // 加载生态资产列表
  await fetchEcosystemAssetsList()

  // 加载用户资产
  userAssets.value = await fetchUserAssets(address)
})
</script>
```

---

## 📋 实施计划

### 阶段1：MVP（使用方案1）
**目标：快速上线核心功能**

**功能范围:**
- ✅ 地址详情页基础功能
- ✅ 显示地址信息和原生余额
- ✅ 显示核心资产（J、WJ、JNS）
- ✅ 显示交易历史（分页）
- ✅ 预留生态资产接口

**预估时间：** 2-3 天

**技术实现:**
```typescript
// 暂时只实现核心资产
export const useAssets = () => {
  const fetchUserAssets = async (address: string) => {
    // 只获取核心资产余额
    return {
      core: await fetchCoreBalances(address),
      ecosystem: { tokens: [], nfts: [] }, // 暂时为空
    }
  }

  return { fetchUserAssets }
}
```

---

### 阶段2：生态资产层（使用方案3 - GitHub Registry）
**目标：支持第三方资产**

**功能范围:**
- ✅ 实现 GitHub Registry 集成
- ✅ 从 GitHub 读取生态资产列表
- ✅ 显示生态资产余额
- ✅ 添加"提交资产"引导链接

**预估时间：** 2-3 天

**实施步骤:**
1. 创建 `jouleverse/asset-registry` GitHub 仓库
2. 定义资产配置模板
3. 实现 GitHub API 读取逻辑
4. 集成到 Explorer
5. 测试和优化

---

### 阶段3：链上注册表（长期）
**目标：真正的去中心化**

**功能范围:**
- ✅ 部署 AssetRegistry 合约
- ✅ 实现链上资产注册
- ✅ Explorer 从链上读取（而不是 GitHub）
- ✅ 可选的社区治理审核（投票机制）

**预估时间：** 5-7 天

**实施步骤:**
1. 设计并部署 AssetRegistry 合约
2. 实现资产提交 UI（需要 MetaMask 连接）
3. 实现管理员审核 UI
4. Explorer 从链上读取资产
5. 测试和安全审计

---

## 🎯 最终建议

### 推荐方案

**采用混合策略：**

1. **核心资产** = 方案1（中心化）
   - 理由：数量少、质量要求高、生态基础设施

2. **生态资产** = 方案3（GitHub Registry + 审核流程）
   - 理由：数量多、增长快、鼓励生态建设、质量可控

3. **用户自管理** = 可选的高级功能
   - 理由：给高级用户更多灵活性
   - 实现方式：添加到用户浏览器缓存或 IPFS

### 实施顺序

```
阶段1：MVP（核心资产）
  ↓
阶段2：GitHub Registry（生态资产）
  ↓
阶段3：链上注册表（去中心化，可选）
```

### 优势总结

1. **灵活性** - 支持核心资产和生态资产分层管理
2. **可控性** - 核心资产中心化，生态资产审核制
3. **社区参与** - 鼓励第三方开发者提交资产
4. **安全性** - 通过审批流程避免虚假/scam 资产
5. **可扩展** - 预留链上注册表升级路径
6. **用户体验** - 大部分资产自动发现，无需手动添加

---

## 📚 参考资源

### 类似项目参考

- **Etherscan** - Token Approval 功能（用户手动添加）
- **BscScan** - Custom Token 搜索（中心化）
- **Polygonscan** - Token 追踪（混合方案）
- **Opensea** - NFT 发现平台（社区驱动）

### 技术文档

- [Viem 文档](https://viem.sh/)
- [EIP-20: ERC-20 Token Standard](https://eips.ethereum.org/EIPS/eip-20)
- [EIP-721: Non-Fungible Token Standard](https://eips.ethereum.org/EIPS/eip-721)
- [GitHub REST API](https://docs.github.com/en/rest)

---

## 📝 更新日志

| 版本 | 日期 | 更新内容 | 负责人 |
|------|------|----------|--------|
| v1.0 | 2026-03-21 | 初始版本，完成混合策略设计 | 大白 |

---

*文档结束*
