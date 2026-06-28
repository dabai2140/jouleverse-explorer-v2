<template>
  <div class="jns-query">
    <div class="header">
      <button @click="$router.push('/')" class="back-btn">← 返回首页</button>
      <h1>🔍 JNS 域名查询</h1>
    </div>

    <!-- 搜索框 -->
    <div class="search-section">
      <div class="search-box">
        <input 
          v-model="searchQuery" 
          @keyup.enter="searchDomain"
          type="text" 
          placeholder="输入 JNS 域名 (例如: xxx.j)"
          class="search-input"
          :disabled="loading"
        >
        <JvActionButton :loading="loading" :disabled="!searchQuery" @click="searchDomain">查询</JvActionButton>
      </div>
      <p class="search-hint">域名必须以 .j 结尾</p>
    </div>

    <!-- 错误提示 -->
    <JvPageState v-if="error" type="search-empty" :description="error" />

    <!-- 域名信息 -->
    <div v-if="domainInfo" class="domain-info">
      <!-- 域名卡片 -->
      <div class="domain-card">
        <div class="domain-header">
          <img v-if="domainInfo.logo" :src="domainInfo.logo" class="domain-logo" alt="JNS domain logo" />
          <div class="domain-title">
            <h2>{{ domainInfo.name }}.j</h2>
            <span class="domain-status" :class="{ 'bound': domainInfo.isBound, 'unbound': !domainInfo.isBound }">
              {{ domainInfo.isBound ? '✅ 已绑定' : '⚠️ 未绑定' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 详细信息 -->
      <div class="info-section">
        <h3>📋 基本信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Token ID</span>
            <span class="value">{{ domainInfo.tokenId }}</span>
          </div>
          <div class="info-item">
            <span class="label">域名名称</span>
            <span class="value">{{ domainInfo.name }}.j</span>
          </div>
        </div>
      </div>

      <div class="info-section">
        <h3>👤 NFT 所有者</h3>
        <div class="info-grid">
          <div class="info-item full-width">
            <span class="label">所有者地址</span>
            <JvHashText :value="domainInfo.owner" type="address" :truncate="8" />
          </div>
        </div>
      </div>

      <div class="info-section">
        <h3>🔗 绑定信息</h3>
        <div class="info-grid">
          <div class="info-item full-width">
            <span class="label">绑定钱包地址</span>
            <JvHashText v-if="domainInfo.isBound" :value="domainInfo.boundAddress" type="address" :truncate="8" />
            <span v-else class="value unbound-address">未绑定到任何地址</span>
          </div>
        </div>
        <div class="info-note">
          <p>💡 JNS 域名可以绑定到一个钱包地址，实现域名解析功能。绑定后可通过地址反向查询域名。</p>
        </div>
      </div>

      <!-- 域名描述 -->
      <div v-if="domainInfo.description" class="info-section">
        <h3>📝 描述</h3>
        <div class="info-note">
          <p>{{ domainInfo.description }}</p>
        </div>
      </div>

      <!-- 扩展属性（Twitter/GitHub 等社交记录） -->
      <div v-if="domainInfo.attributes.length > 0" class="info-section">
        <h3>🏷️ 域名记录</h3>
        <div class="info-grid">
          <div
            v-for="attr in domainInfo.attributes"
            :key="attr.trait_type"
            class="info-item"
          >
            <span class="label">{{ attr.trait_type }}</span>
            <span class="value">{{ attr.value }}</span>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-section">
        <JvActionButton type="default" @click="goToAddress(domainInfo.owner)">查看所有者详情</JvActionButton>
        <JvActionButton v-if="domainInfo.isBound" type="default" @click="goToAddress(domainInfo.boundAddress)">查看绑定地址详情</JvActionButton>
      </div>
    </div>

    <!-- 地址反查区域 -->
    <div class="reverse-lookup-section">
      <h3>🔄 地址反查</h3>
      <p class="hint">输入钱包地址查询其绑定的 JNS 域名</p>
      <div class="reverse-search-box">
        <input 
          v-model="reverseQuery" 
          @keyup.enter="reverseLookup"
          type="text" 
          placeholder="输入钱包地址"
          class="search-input"
          :disabled="reverseLoading"
        >
        <JvActionButton :loading="reverseLoading" :disabled="!reverseQuery" @click="reverseLookup">反查</JvActionButton>
      </div>
      <div v-if="reverseResult" class="reverse-result">
        <p>该地址绑定的域名：<strong>{{ reverseResult }}.j</strong></p>
        <JvActionButton type="default" size="small" @click="searchDomainByName(reverseResult)">查看详情</JvActionButton>
      </div>
      <div v-if="reverseError" class="error-message small">
        <p>{{ reverseError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createPublicClient, http } from 'viem'
import { JNS_ADDRESS, jnsABI } from '@/contracts/jns'
import { jouleverseChain } from '@/config/chain'
import { JvActionButton, JvHashText, JvPageState } from '../design-system'

const router = useRouter()

// 搜索状态
const searchQuery = ref('')
const loading = ref(false)
const error = ref('')
const domainInfo = ref<{
  name: string
  tokenId: number
  owner: string
  boundAddress: string
  isBound: boolean
  logo: string
  description: string
  attributes: { trait_type: string; value: string }[]
} | null>(null)

// 反查状态
const reverseQuery = ref('')
const reverseLoading = ref(false)
const reverseError = ref('')
const reverseResult = ref('')

// 创建 public client
const publicClient = createPublicClient({
  transport: http(jouleverseChain.rpcUrls.default.http[0]),
})

// 搜索域名
const searchDomain = async () => {
  if (!searchQuery.value) return
  
  const query = searchQuery.value.trim().toLowerCase()
  
  // 验证格式
  if (!query.endsWith('.j')) {
    error.value = '域名必须以 .j 结尾'
    domainInfo.value = null
    return
  }
  
  const name = query.slice(0, -2) // 去掉 .j 后缀
  if (name.length === 0) {
    error.value = '请输入有效的域名'
    domainInfo.value = null
    return
  }

  loading.value = true
  error.value = ''
  domainInfo.value = null
  
  try {
    // 查询 tokenId
    const tokenId = await publicClient.readContract({
      address: JNS_ADDRESS,
      abi: jnsABI,
      functionName: '_nslookup',
      args: [name]
    }) as bigint
    
    if (tokenId === BigInt(0)) {
      error.value = `域名 ${query} 不存在`
      return
    }
    
    // 并行获取 owner / 绑定地址 / tokenURI
    const [owner, boundAddress, tokenURI] = await Promise.all([
      publicClient.readContract({
        address: JNS_ADDRESS,
        abi: jnsABI,
        functionName: 'ownerOf',
        args: [tokenId]
      }) as Promise<string>,
      publicClient.readContract({
        address: JNS_ADDRESS,
        abi: jnsABI,
        functionName: '_bound',
        args: [tokenId]
      }) as Promise<string>,
      publicClient.readContract({
        address: JNS_ADDRESS,
        abi: jnsABI,
        functionName: 'tokenURI',
        args: [tokenId]
      }) as Promise<string>,
    ])

    // tokenURI 格式：data:application/json;base64,<JSON>
    let logo = '', description = '', attributes: { trait_type: string; value: string }[] = []
    const [prefix, payload] = tokenURI.split(',')
    if (prefix === 'data:application/json;base64' && payload) {
      try {
        const meta = JSON.parse(atob(payload))
        logo = meta.image || ''
        description = meta.description || ''
        attributes = Array.isArray(meta.attributes) ? meta.attributes : []
      } catch { }
    }

    domainInfo.value = {
      name,
      tokenId: Number(tokenId),
      owner,
      boundAddress,
      isBound: boundAddress !== '0x0000000000000000000000000000000000000000',
      logo,
      description,
      attributes,
    }
    
  } catch (e: any) {
    console.error('JNS query error:', e)
    error.value = `查询失败: ${e.message || '未知错误'}`
    domainInfo.value = null
  } finally {
    loading.value = false
  }
}

// 反查域名
const reverseLookup = async () => {
  if (!reverseQuery.value) return
  
  const address = reverseQuery.value.trim()
  
  // 简单验证地址格式
  if (!address.startsWith('0x') || address.length !== 42) {
    reverseError.value = '请输入有效的以太坊地址'
    reverseResult.value = ''
    return
  }
  
  reverseLoading.value = true
  reverseError.value = ''
  reverseResult.value = ''
  
  try {
    const name = await publicClient.readContract({
      address: JNS_ADDRESS,
      abi: jnsABI,
      functionName: 'addr2name',
      args: [address as `0x${string}`]
    }) as string
    
    if (name) {
      reverseResult.value = name
    } else {
      reverseError.value = '该地址未绑定任何 JNS 域名'
    }
  } catch (e: any) {
    if (e.message && e.message.includes('address without bound JNS')) {
      reverseError.value = '该地址未绑定任何 JNS 域名'
    } else {
      reverseError.value = `反查失败: ${e.message || '未知错误'}`
    }
    reverseResult.value = ''
  } finally {
    reverseLoading.value = false
  }
}

// 跳转到地址详情页
const goToAddress = (address: string) => {
  router.push(`/address/${address}`)
}

// 通过名称直接查询（用于反查后的操作）
const searchDomainByName = (name: string) => {
  searchQuery.value = name + '.j'
  searchDomain()
}

// 从 URL 获取查询参数
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

onMounted(() => {
  const domain = route.query.domain as string
  if (domain) {
    searchQuery.value = domain
    searchDomain()
  }
})
</script>

<style scoped>
.jns-query {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.header { margin-bottom: 24px; }

.back-btn {
  background: var(--jv-bg-subtle);
  color: var(--jv-text-muted);
  border: none;
  padding: 8px 16px;
  border-radius: var(--jv-radius-md);
  cursor: pointer;
  margin-bottom: 12px;
  font-size: 14px;
  transition: background var(--jv-duration-fast) var(--jv-ease);
}
.back-btn:hover { background: var(--jv-bg-hover); }

h1 { font-size: 24px; color: var(--jv-text-primary); margin: 0; }

.search-section {
  background: var(--jv-bg-subtle);
  padding: 20px;
  border-radius: var(--jv-radius-lg);
  margin-bottom: 20px;
}

.search-box { display: flex; gap: 10px; }

.search-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--jv-border);
  border-radius: var(--jv-radius-md);
  font-size: 16px;
  background: var(--jv-bg-surface);
  color: var(--jv-text-primary);
  transition: border-color var(--jv-duration-fast) var(--jv-ease);
}
.search-input:focus {
  outline: none;
  border-color: var(--jv-border-focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--jv-brand) 12%, transparent);
}

.search-hint { margin-top: 8px; color: var(--jv-text-muted); font-size: 13px; }

.domain-info {
  background: var(--jv-bg-surface);
  border: 1px solid var(--jv-border);
  border-radius: var(--jv-radius-lg);
  padding: 20px;
}

.domain-card {
  background: linear-gradient(135deg, var(--jv-brand) 0%, var(--jv-brand-pressed) 100%);
  color: white;
  padding: 24px;
  border-radius: var(--jv-radius-lg);
  margin-bottom: 20px;
}

.domain-header { display: flex; align-items: center; gap: 20px; }

.domain-logo {
  width: 80px;
  height: 80px;
  border-radius: var(--jv-radius-md);
  object-fit: contain;
  background: white;
}

.domain-title h2 { margin: 0 0 8px 0; font-size: 28px; }

.domain-status {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 14px;
  background: rgba(255,255,255,0.2);
}

.domain-status.bound { background: rgba(255,255,255,0.3); }
.domain-status.unbound { background: rgba(0,0,0,0.2); }

.info-section { margin-bottom: 20px; }

.info-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: var(--jv-text-primary);
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.info-item {
  background: var(--jv-bg-subtle);
  padding: 12px 16px;
  border-radius: var(--jv-radius-md);
}

.info-item.full-width { grid-column: 1 / -1; }

.info-item .label {
  display: block;
  color: var(--jv-text-muted);
  font-size: 13px;
  margin-bottom: 4px;
}

.info-item .value { font-size: 15px; color: var(--jv-text-primary); word-break: break-all; }
.info-item .value.unbound-address { color: var(--jv-text-disabled); font-style: italic; }

.info-note {
  margin-top: 12px;
  padding: 10px 14px;
  background: var(--jv-brand-subtle);
  border-radius: var(--jv-radius-md);
  font-size: 13px;
  color: var(--jv-text-secondary);
}

.action-section { display: flex; gap: 12px; margin-top: 20px; }

.reverse-lookup-section {
  margin-top: 24px;
  background: var(--jv-bg-subtle);
  padding: 20px;
  border-radius: var(--jv-radius-lg);
  border: 1px solid var(--jv-border);
}

.reverse-lookup-section h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: var(--jv-text-primary);
}

.reverse-lookup-section .hint {
  margin: 0 0 12px 0;
  color: var(--jv-text-muted);
  font-size: 13px;
}

.reverse-search-box { display: flex; gap: 10px; }

.reverse-result {
  margin-top: 16px;
  padding: 12px 16px;
  background: var(--jv-brand-subtle);
  border: 1px solid var(--jv-brand);
  border-radius: var(--jv-radius-md);
}

.reverse-result p { margin: 0; font-size: 14px; color: var(--jv-text-primary); }
.reverse-result strong { color: var(--jv-brand); }

.error-message.small {
  margin-top: 8px;
  padding: 8px 12px;
  font-size: 14px;
  background: var(--jv-error-bg);
  border: 1px solid var(--jv-error);
  border-radius: var(--jv-radius-md);
  color: var(--jv-error);
}
</style>
