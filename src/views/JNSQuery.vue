<template>
  <div class="jns-query">
    <div class="header">
      <button @click="$router.push('/')" class="back-btn">← 返回首页</button>
      <h1 v-if="!domainInfo">🔍 JNS 域名查询</h1>
      <h1 v-else>{{ domainInfo.name }}.j 详情</h1>
    </div>

    <!-- 搜索框 -->
    <div class="search-section">
      <div class="search-box">
        <input
          v-model="searchQuery"
          @keyup.enter="onSearchKeyup"
          type="text" 
          placeholder="输入 JNS 域名 (例如: xxx.j)"
          class="search-input"
          :disabled="loading"
        >
        <JvActionButton :loading="loading" :disabled="!searchQuery" @click="onSearchClick">查询</JvActionButton>
      </div>
      <p class="search-hint">域名必须以 .j 结尾</p>
    </div>

    <!-- 错误提示 -->
    <JvPageState v-if="error" type="search-empty" :description="error" />

    <!-- ===== 域名信息 ===== -->
    <div v-if="domainInfo" class="domain-info">
      <!-- 域名卡片 -->
      <div class="domain-card">
        <div class="domain-header">
          <img v-if="domainInfo.logo" :src="domainInfo.logo" class="domain-logo" alt="JNS logo" />
          <div class="domain-title">
            <h2>{{ domainInfo.name }}.j</h2>
            <span class="domain-status" :class="{ bound: domainInfo.isBound, unbound: !domainInfo.isBound }">
              {{ domainInfo.isBound ? '✅ 已绑定' : '⚠️ 未绑定' }}
            </span>
            <span class="domain-token-id">#{{ domainInfo.tokenId }}</span>
          </div>
        </div>
      </div>

      <!-- 基本信息 -->
      <div class="info-section">
        <h3>📋 基本信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">域名名称</span>
            <span class="value">{{ domainInfo.name }}.j</span>
          </div>
          <div class="info-item">
            <span class="label">Token ID</span>
            <span class="value">#{{ domainInfo.tokenId }}</span>
          </div>
        </div>
      </div>

      <!-- NFT 所有者 -->
      <div class="info-section">
        <h3>👤 NFT 所有者</h3>
        <div class="info-grid">
          <div class="info-item full-width">
            <span class="label">所有者地址</span>
            <JvHashText :value="domainInfo.owner" type="address" :truncate="8" />
          </div>
        </div>
      </div>

      <!-- 绑定信息 -->
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
          <p>💡 JNS 域名可以绑定到一个钱包地址,绑定后可通过地址反向查询域名。</p>
        </div>
      </div>

      <!-- 域名描述 -->
      <div v-if="domainInfo.description" class="info-section">
        <h3>📝 域名描述</h3>
        <div class="info-note">
          <p>{{ domainInfo.description }}</p>
        </div>
      </div>

      <!-- 域名记录(Twitter / GitHub / Email / URL 等) -->
      <div v-if="domainInfo.attributes.length > 0" class="info-section">
        <h3>🏷️ 域名记录</h3>
        <div class="records-grid">
          <div
            v-for="attr in domainInfo.attributes"
            :key="attr.trait_type"
            class="record-item"
            :class="'record-' + attr.trait_type.toLowerCase().replace(/\s+/g, '-')"
          >
            <span class="record-icon">{{ getRecordIcon(attr.trait_type) }}</span>
            <div class="record-body">
              <span class="record-label">{{ attr.trait_type }}</span>
              <span v-if="isAddressRecord(attr)" class="record-value">
                <JvHashText :value="attr.value" type="address" :truncate="6" />
              </span>
              <span v-else-if="isUrlRecord(attr)" class="record-value">
                <a :href="attr.value" target="_blank" rel="noopener" class="record-link">{{ attr.value }}</a>
              </span>
              <span v-else class="record-value">{{ attr.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-section">
        <JvActionButton type="default" @click="goToAddress(domainInfo.owner)">查看所有者详情</JvActionButton>
        <JvActionButton v-if="domainInfo.isBound" type="default" @click="goToAddress(domainInfo.boundAddress)">查看绑定地址详情</JvActionButton>
        <button class="share-btn" @click="copyShareLink">📋 复制分享链接</button>
      </div>
    </div>

    <!-- ===== 持有者其他域名 ===== -->
    <div v-if="domainInfo && (ownerJnsTotal > 1 || loadingOwnerJns)" class="owner-domains-section">
      <h3>🏷️ 该持有者的其他 JNS 域名</h3>
      <JvLoading v-if="loadingOwnerJns && ownerJnsNames.length === 0" label="加载中..." />
      <div v-else>
        <p class="owner-jns-summary">
          该地址共持有 <strong>{{ ownerJnsTotal }}</strong> 个 JNS 域名
          {{ ownerJnsTotal > OWNER_JNS_MAX ? `,仅显示前 ${OWNER_JNS_MAX} 个` : '' }}
        </p>
        <div class="jns-tag-list">
          <span
            v-for="item in ownerJnsNames"
            :key="item.name"
            class="jns-tag"
            :class="{ 'is-current': item.name === domainInfo.name }"
            @click="searchDomainByName(item.name)"
          >
            {{ item.name }}.j
            <span v-if="item.name === domainInfo.name" class="current-badge">当前</span>
          </span>
        </div>
        <div v-if="ownerJnsLoaded < Math.min(ownerJnsTotal, OWNER_JNS_MAX)" class="load-more-row">
          <JvActionButton
            :loading="loadingOwnerJns"
            size="small"
            type="default"
            @click="loadMoreOwnerJns"
          >
            加载更多({{ ownerJnsLoaded }} / {{ Math.min(ownerJnsTotal, OWNER_JNS_MAX) }})
          </JvActionButton>
        </div>
        <div v-if="ownerJnsTotal > OWNER_JNS_MAX" class="overflow-hint">
          前往 <a @click.prevent="$router.push('/jns')" href="#">JNS 查询页</a> 可查看更多
        </div>
      </div>
    </div>

    <!-- ===== 地址反查 ===== -->
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
        <p>该地址绑定的域名:<strong>{{ reverseResult }}.j</strong></p>
        <JvActionButton type="default" size="small" @click="searchDomainByName(reverseResult)">查看详情</JvActionButton>
      </div>
      <div v-if="reverseError" class="error-message small">
        <p>{{ reverseError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { createPublicClient, http } from 'viem'
import { JNS_ADDRESS, jnsABI } from '@/contracts/jns'
import { jouleverseChain } from '@/config/chain'
import { JvActionButton, JvHashText, JvPageState, JvLoading } from '../design-system'

const router = useRouter()
const route = useRoute()

// ===== 公共客户端 =====
const publicClient = createPublicClient({
  transport: http(jouleverseChain.rpcUrls.default.http[0]),
})

// ===== 搜索状态 =====
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

// ===== 反查状态 =====
const reverseQuery = ref('')
const reverseLoading = ref(false)
const reverseError = ref('')
const reverseResult = ref('')

// ===== 持有者其他域名 =====
const OWNER_JNS_BATCH = 10
const OWNER_JNS_MAX = 50
const ownerJnsTotal = ref(0)
const ownerJnsNames = ref<{ name: string; tokenId: number }[]>([])
const ownerJnsLoaded = ref(0)
const loadingOwnerJns = ref(false)

// ===== 记录类型图标映射 =====
const RECORD_ICONS: Record<string, string> = {
  'twitter': '🐦',
  'github': '🐙',
  'email': '📧',
  'url': '🔗',
  'website': '🌐',
  'telegram': '✈️',
  'discord': '💬',
  'description': '📝',
  'avatar': '🖼️',
  'ethereum': '💎',
  'ethereum address': '💎',
  'eth address': '💎',
  'bsc': '🟡',
  'polygon': '🟣',
}

// ===== 方法 =====

/** 搜索框回车事件 */
const onSearchKeyup = () => { searchDomain() }

/** 搜索按钮点击事件 */
const onSearchClick = () => { searchDomain() }

/** 搜索域名 */
const searchDomain = async (domainName?: string) => {
  const query = (domainName || searchQuery.value || '').trim().toLowerCase()
  if (!query) return

  if (!query.endsWith('.j')) {
    error.value = '域名必须以 .j 结尾'
    domainInfo.value = null
    return
  }

  const name = query.slice(0, -2)
  if (!name) {
    error.value = '请输入有效的域名'
    domainInfo.value = null
    return
  }

  loading.value = true
  error.value = ''
  domainInfo.value = null
  // 重置持有者域名
  ownerJnsTotal.value = 0
  ownerJnsNames.value = []
  ownerJnsLoaded.value = 0

  try {
    const tokenId = await publicClient.readContract({
      address: JNS_ADDRESS,
      abi: jnsABI,
      functionName: '_nslookup',
      args: [name],
    }) as bigint

    if (tokenId === BigInt(0)) {
      error.value = `域名 ${query} 不存在`
      return
    }

    const [owner, boundAddress, tokenURIRaw] = await Promise.all([
      publicClient.readContract({
        address: JNS_ADDRESS, abi: jnsABI, functionName: 'ownerOf', args: [tokenId],
      }) as Promise<string>,
      publicClient.readContract({
        address: JNS_ADDRESS, abi: jnsABI, functionName: '_bound', args: [tokenId],
      }) as Promise<string>,
      publicClient.readContract({
        address: JNS_ADDRESS, abi: jnsABI, functionName: 'tokenURI', args: [tokenId],
      }) as Promise<string>,
    ])

    // 解析 tokenURI metadata
    let logo = '', description = '', attributes: { trait_type: string; value: string }[] = []
    const [prefix, payload] = tokenURIRaw.split(',')
    if (prefix === 'data:application/json;base64' && payload) {
      try {
        const meta = JSON.parse(atob(payload))
        logo = meta.image || ''
        description = meta.description || ''
        attributes = Array.isArray(meta.attributes) ? meta.attributes : []
      } catch { /* 解析失败忽略 */ }
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

    // 加载持有者的其他域名
    loadOwnerJnsHoldings(owner)
  } catch (e: any) {
    console.error('JNS query error:', e)
    error.value = `查询失败: ${e.message || '未知错误'}`
    domainInfo.value = null
  } finally {
    loading.value = false
  }
}

/** 加载持有者的 JNS 域名列表 */
const loadOwnerJnsHoldings = async (ownerAddr: string) => {
  loadingOwnerJns.value = true
  try {
    const total = await publicClient.readContract({
      address: JNS_ADDRESS, abi: jnsABI, functionName: 'balanceOf', args: [ownerAddr as `0x${string}`],
    }) as bigint
    ownerJnsTotal.value = Number(total)
    if (ownerJnsTotal.value <= 1) return // 只有当前域名,不显示
    await loadOwnerJnsBatch(ownerAddr, OWNER_JNS_BATCH)
  } catch { /* 加载失败静默处理 */ }
  finally { loadingOwnerJns.value = false }
}

/** 分批加载持有者域名 */
const loadOwnerJnsBatch = async (ownerAddr: string, count: number) => {
  const start = ownerJnsLoaded.value
  const end = Math.min(start + count, Math.min(ownerJnsTotal.value, OWNER_JNS_MAX))
  if (start >= end) return

  const tokenIds = await Promise.all(
    Array.from({ length: end - start }, (_, i) => BigInt(start + i)).map(idx =>
      publicClient.readContract({
        address: JNS_ADDRESS, abi: jnsABI, functionName: 'tokenOfOwnerByIndex', args: [ownerAddr as `0x${string}`, idx],
      }) as Promise<bigint>
    )
  )
  const names = await Promise.all(
    tokenIds.map(id =>
      publicClient.readContract({
        address: JNS_ADDRESS, abi: jnsABI, functionName: '_allTokensName', args: [id],
      }) as Promise<string>
    )
  )
  for (let i = 0; i < names.length; i++) {
    ownerJnsNames.value.push({ name: names[i], tokenId: Number(tokenIds[i]) })
  }
  ownerJnsLoaded.value = end
}

/** 加载更多持有者域名 */
const loadMoreOwnerJns = async () => {
  if (loadingOwnerJns.value || !domainInfo.value) return
  loadingOwnerJns.value = true
  try {
    await loadOwnerJnsBatch(domainInfo.value.owner, OWNER_JNS_BATCH)
  } finally { loadingOwnerJns.value = false }
}

/** 地址反查 */
const reverseLookup = async () => {
  if (!reverseQuery.value) return
  const address = reverseQuery.value.trim()
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
      address: JNS_ADDRESS, abi: jnsABI, functionName: 'addr2name', args: [address as `0x${string}`],
    }) as string
    if (name) {
      reverseResult.value = name
    } else {
      reverseError.value = '该地址未绑定任何 JNS 域名'
    }
  } catch (e: any) {
    if (e.message?.includes('address without bound JNS')) {
      reverseError.value = '该地址未绑定任何 JNS 域名'
    } else {
      reverseError.value = `反查失败: ${e.message || '未知错误'}`
    }
  } finally { reverseLoading.value = false }
}

/** 获取记录类型的图标 */
const getRecordIcon = (traitType: string): string => {
  const key = traitType.toLowerCase().trim()
  return RECORD_ICONS[key] || '🏷️'
}

/** 判断是否为地址类型记录 */
const isAddressRecord = (attr: { trait_type: string; value: string }): boolean => {
  const key = attr.trait_type.toLowerCase()
  return (key.includes('address') || key.includes('ethereum') || key.includes('eth')) &&
    attr.value.startsWith('0x') && attr.value.length === 42
}

/** 判断是否为 URL 类型记录 */
const isUrlRecord = (attr: { trait_type: string; value: string }): boolean => {
  return attr.value.startsWith('http://') || attr.value.startsWith('https://')
}

/** 跳转到地址详情 */
const goToAddress = (address: string) => {
  router.push(`/address/${address}`)
}

/** 通过域名搜索 */
const searchDomainByName = (name: string) => {
  searchQuery.value = name + '.j'
  searchDomain()
}

/** 复制分享链接 */
const copyShareLink = () => {
  if (!domainInfo.value) return
  const url = `${window.location.origin}${window.location.pathname}#/jns/${domainInfo.value.name}`
  navigator.clipboard.writeText(url).then(() => {
    // 简单提示
    alert('链接已复制到剪贴板')
  }).catch(() => {
    // fallback
    const ta = document.createElement('textarea')
    ta.value = url
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    alert('链接已复制到剪贴板')
  })
}

// ===== 路由参数处理 =====
onMounted(() => {
  // 支持 /jns/:name 路径参数或 ?domain=xxx 查询参数
  const nameParam = route.params.name as string
  const queryParam = route.query.domain as string

  if (nameParam) {
    searchQuery.value = nameParam.endsWith('.j') ? nameParam : nameParam + '.j'
    searchDomain()
  } else if (queryParam) {
    searchQuery.value = queryParam
    searchDomain()
  }
})
</script>

<style scoped>
.jns-query {
  max-width: 860px;
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

/* 搜索框 */
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

/* 域名详情卡片 */
.domain-info {
  background: var(--jv-bg-surface);
  border: 1px solid var(--jv-border);
  border-radius: var(--jv-radius-lg);
  padding: 24px;
  margin-bottom: 20px;
}

/* 域名头部 */
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
  flex-shrink: 0;
}

.domain-title h2 { margin: 0 0 6px 0; font-size: 28px; }

.domain-status {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  background: rgba(255,255,255,0.2);
  margin-right: 8px;
}

.domain-token-id {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  background: rgba(0,0,0,0.15);
}

/* 信息区块 */
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

/* 域名记录展示 */
.records-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.record-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: var(--jv-bg-subtle);
  padding: 14px 16px;
  border-radius: var(--jv-radius-md);
  border-left: 3px solid var(--jv-border);
}

.record-icon {
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 2px;
}

.record-body {
  flex: 1;
  min-width: 0;
}

.record-label {
  display: block;
  color: var(--jv-text-muted);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.record-value {
  font-size: 14px;
  color: var(--jv-text-primary);
  word-break: break-all;
}

.record-link {
  color: var(--jv-brand);
  text-decoration: none;
}
.record-link:hover { text-decoration: underline; }

/* 操作按钮 */
.action-section {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  flex-wrap: wrap;
}

.share-btn {
  background: var(--jv-bg-subtle);
  color: var(--jv-text-muted);
  border: 1px solid var(--jv-border);
  padding: 8px 16px;
  border-radius: var(--jv-radius-md);
  cursor: pointer;
  font-size: 14px;
  transition: all var(--jv-duration-fast) var(--jv-ease);
}
.share-btn:hover {
  background: var(--jv-bg-hover);
  color: var(--jv-text-primary);
}

/* 持有者其他域名 */
.owner-domains-section {
  background: var(--jv-bg-surface);
  border: 1px solid var(--jv-border);
  border-radius: var(--jv-radius-lg);
  padding: 20px 24px;
  margin-bottom: 20px;
}

.owner-domains-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: var(--jv-text-primary);
}

.owner-jns-summary {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--jv-text-secondary);
}

.owner-jns-summary strong { color: var(--jv-brand); }

.jns-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.jns-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  background: var(--jv-brand-subtle);
  color: var(--jv-brand);
  border: 1px solid color-mix(in srgb, var(--jv-brand) 20%, transparent);
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
  transition: all var(--jv-duration-fast) var(--jv-ease);
}
.jns-tag:hover {
  background: var(--jv-brand);
  color: white;
}
.jns-tag.is-current {
  background: var(--jv-brand);
  color: white;
  cursor: default;
}
.jns-tag .current-badge {
  font-size: 11px;
  opacity: 0.8;
}

.load-more-row {
  margin-top: 12px;
  display: flex;
  justify-content: center;
}

.overflow-hint {
  margin-top: 10px;
  font-size: 13px;
  color: var(--jv-text-muted);
}
.overflow-hint a {
  color: var(--jv-brand);
  cursor: pointer;
  text-decoration: underline;
}

/* 反查区域 */
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

.reverse-result p { margin: 0 0 8px 0; font-size: 14px; color: var(--jv-text-primary); }
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

/* 响应式 */
@media (max-width: 640px) {
  .info-grid { grid-template-columns: 1fr; }
  .records-grid { grid-template-columns: 1fr; }
  .action-section { flex-direction: column; }
  .domain-header { flex-direction: column; text-align: center; }
  .domain-logo { width: 64px; height: 64px; }
}
</style>
