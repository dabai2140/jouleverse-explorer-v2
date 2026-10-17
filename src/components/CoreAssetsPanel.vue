<template>
  <div class="core-assets-panel">
    <JvLoading v-if="isLoading" label="资产加载中..." />
    <JvPageState
      v-else-if="error"
      type="network-error"
      :description="error"
      action="重试"
      @action="load"
    />
    <template v-else>
      <!-- 余额类（native / erc20）+ NFT 数量概览：一次 multicall 结果 -->
      <div class="asset-list">
        <div
          v-for="item in balances"
          :key="item.asset.key"
          class="asset-row"
        >
          <span class="asset-icon">{{ item.asset.icon }}</span>
          <div class="asset-main">
            <span class="asset-name">{{ item.asset.name }}</span>
            <span class="asset-symbol muted">{{ item.asset.symbol }}</span>
          </div>
          <div class="asset-value">
            <JvAmount
              v-if="isFungible(item.asset) && item.value !== null"
              :value="item.value"
              :decimals="item.asset.decimals ?? 18"
              :unit="item.asset.symbol"
            />
            <span v-else-if="isFungible(item.asset)" class="muted">—</span>
            <span v-else class="asset-count">
              {{ item.value === null ? '—' : `${formatCount(item.value)} 个` }}
            </span>
          </div>
        </div>
      </div>

      <!-- JNS 域名枚举：分页懒加载，首屏只出前几个 -->
      <div v-if="jnsTotal !== 0 || loadingJns" class="jns-detail">
        <div class="jns-detail-head">
          <span class="muted">JNS 域名持有明细</span>
        </div>
        <JvLoading v-if="loadingJns && jnsNames.length === 0" label="加载中..." />
        <div v-else-if="jnsTotal === null" class="jns-unknown muted">
          域名数量读取失败，无法确定持有数量
        </div>
        <div v-else>
          <div class="jns-list">
            <span v-for="name in jnsNames" :key="name" class="jns-tag" @click="goJnsDetail(name)">{{ name }}.j</span>
          </div>
          <div v-if="jnsLoaded < Math.min(jnsTotalNum, JNS_MAX_DISPLAY)" class="jns-more">
            <button class="btn-load-more" :disabled="loadingJns" @click="loadMoreJns">
              {{ loadingJns ? '加载中...' : `加载更多（已显示 ${jnsLoaded} / ${Math.min(jnsTotalNum, JNS_MAX_DISPLAY)}）` }}
            </button>
          </div>
          <p v-if="jnsTotalNum > JNS_MAX_DISPLAY" class="jns-overflow-hint muted">
            前往 <a @click.prevent="$router.push('/jns')" href="#">JNS 查询页</a> 可查看全部域名
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { fetchJnsHoldingBatch } from '../utils/jns-holdings'
import { useCoreAssets } from '../composables/useCoreAssets'
import { JvLoading, JvPageState, JvAmount } from '../design-system'
import type { CoreAsset } from '../config/core-assets'

interface Props { address: string }
const props = defineProps<Props>()

const router = useRouter()

const { balances, isLoading, error, load } = useCoreAssets(() => props.address)

const isFungible = (a: CoreAsset) => a.kind === 'native' || a.kind === 'erc20'

const formatCount = (n: bigint): string => {
  try { return BigInt(n).toString() } catch { return '0' }
}

// ── JNS 域名枚举（分页懒加载）──
const JNS_BATCH_SIZE = 10
const JNS_MAX_DISPLAY = 50
const jnsTotal = ref<number | null>(null)
const jnsTotalNum = computed(() => jnsTotal.value ?? 0)
const jnsNames = ref<string[]>([])
const jnsLoaded = ref(0)
const loadingJns = ref(false)
// 竞态保护：与 useCoreAssets 相同的请求序号，防止旧地址慢响应覆盖新地址
let jnsRequestId = 0

const loadJns = async () => {
  const myReq = ++jnsRequestId
  loadingJns.value = true
  try {
    // multicall 聚合：balanceOf + tokenOfOwnerByIndex×10 + _allTokensName×10 → 2 次 RPC
    const { balance, balanceUnknown, names } = await fetchJnsHoldingBatch(props.address as `0x${string}`, 0, JNS_BATCH_SIZE, true)
    if (myReq !== jnsRequestId) return // 过期请求，丢弃
    // 失败 ≠ 零：balanceUnknown 时置 null，UI 显式提示「未知」，绝不用 0 掩盖
    if (balanceUnknown) {
      jnsTotal.value = null
      jnsNames.value = []
      jnsLoaded.value = 0
      return
    }
    const total = Number(balance ?? 0n)
    jnsTotal.value = total
    jnsNames.value = []
    if (total === 0) return
    const end = Math.min(JNS_BATCH_SIZE, Math.min(total, JNS_MAX_DISPLAY))
    jnsNames.value.push(...names.slice(0, end))
    jnsLoaded.value = Math.min(end, names.length)
  } catch (e) {
    if (myReq !== jnsRequestId) return
    // 请求级失败同样不能掩盖成 0：置 null 提示未知，而非清零
    jnsTotal.value = null
    jnsNames.value = []
    jnsLoaded.value = 0
    console.error('[CoreAssetsPanel] JNS 枚举加载失败:', e)
  } finally {
    if (myReq === jnsRequestId) loadingJns.value = false
  }
}

const goJnsDetail = (name: string) => router.push(`/jns/${name}`)

const loadMoreJns = async () => {
  if (loadingJns.value) return
  const myReq = ++jnsRequestId
  loadingJns.value = true
  try {
    const start = jnsLoaded.value
    const end = Math.min(start + JNS_BATCH_SIZE, Math.min(jnsTotal.value ?? 0, JNS_MAX_DISPLAY))
    if (start >= end) return
    const { names } = await fetchJnsHoldingBatch(props.address as `0x${string}`, start, end - start, false)
    if (myReq !== jnsRequestId) return
    jnsNames.value.push(...names)
    jnsLoaded.value = Math.min(end, start + names.length)
  } catch (e) {
    if (myReq !== jnsRequestId) return
    console.error('[CoreAssetsPanel] JNS 加载更多失败:', e)
  } finally {
    if (myReq === jnsRequestId) loadingJns.value = false
  }
}

onMounted(() => {
  load()
  loadJns()
})

watch(() => props.address, () => {
  load()
  loadJns()
})
</script>

<style scoped>
.core-assets-panel { display: flex; flex-direction: column; gap: 16px; }

.asset-list { display: flex; flex-direction: column; gap: 8px; }

.asset-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--jv-bg-subtle);
  border-radius: var(--jv-radius-md);
}

.asset-icon { font-size: 1.2rem; line-height: 1; flex-shrink: 0; }

.asset-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }

.asset-name { color: var(--jv-text-primary); font-size: 0.9rem; }

.asset-symbol { font-size: 0.78rem; }

.asset-value { flex-shrink: 0; }

.asset-count { color: var(--jv-text-primary); font-weight: 600; font-size: 0.9rem; }

.muted { color: var(--jv-text-muted); font-size: 0.82rem; }

.jns-detail { border-top: 1px dashed var(--jv-border); padding-top: 14px; }

.jns-detail-head { margin-bottom: 8px; }

.jns-unknown { padding: 8px 0; }

.jns-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }

.jns-tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: var(--jv-radius-full);
  background: var(--jv-brand-subtle);
  color: var(--jv-brand);
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
}

.btn-load-more {
  background: none;
  border: 1px solid var(--jv-border);
  color: var(--jv-text-secondary);
  padding: 6px 16px;
  border-radius: var(--jv-radius-md);
  cursor: pointer;
  font-size: 0.85rem;
  transition: border-color var(--jv-duration-fast) var(--jv-ease),
              color var(--jv-duration-fast) var(--jv-ease);
}

.btn-load-more:hover:not(:disabled) { border-color: var(--jv-brand); color: var(--jv-brand); }
.btn-load-more:disabled { opacity: 0.5; cursor: not-allowed; }

.jns-overflow-hint { margin-top: 8px; font-size: 0.85rem; }

.jns-overflow-hint a { color: var(--jv-link); cursor: pointer; text-decoration: none; }
.jns-overflow-hint a:hover { text-decoration: underline; }
</style>
