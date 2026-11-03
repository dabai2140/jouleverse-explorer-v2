<script lang="ts">
import { publicClient } from '../config/client'
import { createCheckpointLoader } from '../utils/clique-signers'
// 同一标签页共享一分钟缓存及并发请求，避免重复查询公共节点。
const loadCheckpoint = createCheckpointLoader(publicClient)
</script>

<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import { NAlert } from 'naive-ui'
import { JvHashText, JvPageState, JvActionButton } from '../design-system'
import type { SignerSnapshot } from '../utils/clique-signers'

const snapshot = shallowRef<SignerSnapshot>()
const loading = ref(false)
const error = ref('')
async function load() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try { snapshot.value = await loadCheckpoint() }
  catch (e) { error.value = e instanceof Error ? e.message : '读取检查点失败' }
  finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <main class="validators" :aria-busy="loading">
    <RouterLink to="/tools">← 工具集</RouterLink>
    <h1>验证者 / 签名人目录</h1>
    <p>Jouleverse 主网 · 网络编号 3666 · Clique PoA 检查点签名人集合</p>
    <NAlert type="info" :show-icon="false">
      这是最近 epoch 检查点的地址快照。检查点之后的共识投票可能改变授权集合，本页不重放投票，不能据此断言当前集合或节点在线状态。Miner 字段不承载出块者。
    </NAlert>
    <div class="actions">
      <JvActionButton :loading="loading" @click="load">{{ loading ? '读取中' : '刷新目录' }}</JvActionButton>
      <span>缓存 60 秒；未命中时仅查询最新高度及一个检查点区块。</span>
    </div>
    <div v-if="error" role="alert">
      <h2>无法更新检查点</h2>
      <JvPageState type="network-error" :description="error" />
    </div>
    <p v-if="loading && !snapshot" role="status">正在读取检查点，请稍候…</p>
    <section v-if="snapshot">
      <NAlert v-if="error" type="warning" :show-icon="false">以下保留上次成功读取的快照，刷新失败，非最新结果。</NAlert>
      <div class="summary">
        <div><span>检查点签名人数</span><strong data-testid="signer-count">{{ snapshot.signers.length }}</strong></div>
        <div><span>检查点区块</span><JvHashText :value="String(snapshot.epochBlock)" type="block" :truncate="0" /></div>
        <div><span>查询时最新高度</span><strong>{{ snapshot.observedHead }}</strong></div>
      </div>
      <p>检查点哈希：<JvHashText :value="snapshot.hash" type="plain" :truncate="12" /></p>
      <p>读取时间：{{ new Date(snapshot.fetchedAt).toLocaleString() }}</p>
      <h2>签名人地址</h2>
      <ol class="signers">
        <li v-for="address in snapshot.signers" :key="address"><JvHashText :value="address" type="address" :truncate="0" /></li>
      </ol>
    </section>
    <p class="scope">本页仅解析节点返回的 extraData，不独立验证区块签名。逐块出块者恢复、出块分布及活跃度统计：未做。无需连接钱包，不发送交易。</p>
  </main>
</template>

<style scoped>
.validators { max-width: 1100px; margin: auto; padding: 28px 24px; color: var(--jv-text-primary); }
a { color: var(--jv-link); }
p, .actions { color: var(--jv-text-secondary); line-height: 1.7; }
.actions { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin: 20px 0; }
.summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-top: 20px; }
.summary > div { padding: 18px; background: var(--jv-bg-surface); border: 1px solid var(--jv-border); border-radius: var(--jv-radius-lg); }
.summary span, .summary strong { display: block; }
.summary strong { font-size: 1.6rem; }
.signers { padding-left: 28px; }
.signers li { padding: 12px 8px; border-bottom: 1px solid var(--jv-border); overflow-wrap: anywhere; }
.scope { padding: 16px; background: var(--jv-bg-subtle); border-radius: var(--jv-radius-md); }
@media (max-width: 640px) { .validators { padding: 20px 14px; } }
</style>
