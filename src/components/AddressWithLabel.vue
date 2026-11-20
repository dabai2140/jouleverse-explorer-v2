<script setup lang="ts">
/**
 * 带合约标签的地址展示（v1 `address2tag()` 对等）
 *
 * v1 交易/区块详情里「从 / 至」显示的是可读名字（`JNS合约`、`红包`…），
 * v2 原来只显示截断地址。本组件保留地址本体（可点、可复制），
 * 在它前面加一枚标签，标签可点进对应合约工具页。
 *
 * 未注册地址不显示标签，不占位、不留空 span —— 避免出现「一个空框」。
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { lookupAddressLabel } from '../utils/address-label'
import { JvHashText } from '../design-system'

const props = withDefaults(defineProps<{
  address: string
  /** 地址截断长度，透传给 JvHashText */
  truncate?: number
}>(), {
  truncate: 8,
})

const router = useRouter()

const label = computed(() => lookupAddressLabel(props.address))

const openContractTool = () => {
  const current = label.value
  if (!current) return
  router.push(`/tools/contract/${current.key}`)
}
</script>

<template>
  <span class="addr-with-label">
    <button
      v-if="label"
      class="addr-label"
      :title="`${label.tag}（点击打开合约工具）`"
      @click.stop="openContractTool"
    >{{ label.name }}</button>
    <JvHashText :value="address" type="address" :truncate="truncate" />
  </span>
</template>

<style scoped>
.addr-with-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: 70%;
}

.addr-label {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--jv-border);
  background: var(--jv-bg-surface);
  color: var(--jv-text-secondary);
  font-size: 0.78rem;
  padding: 1px 7px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color var(--jv-duration-fast) var(--jv-ease),
              color var(--jv-duration-fast) var(--jv-ease);
}

.addr-label:hover {
  border-color: var(--jv-brand);
  color: var(--jv-brand);
}

.addr-label:focus-visible {
  outline: 2px solid var(--jv-brand);
  outline-offset: 2px;
}
</style>
