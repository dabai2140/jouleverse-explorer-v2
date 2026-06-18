<template>
  <div class="core-id-section">
    <div v-if="isLoading" class="loading-state">⏳ 加载中...</div>
    <div v-else-if="error" class="error-message">{{ error }}</div>
    <template v-else>
      <div v-if="coreId === null" class="empty-state">该地址尚未拥有 Core ID。</div>

      <template v-else>
        <div class="core-id-card">
          <img v-if="metadata?.image" :src="metadata.image" :alt="metadata?.name" class="core-id-avatar" />
          <div class="core-id-info">
            <div class="core-id-title">Core ID #{{ coreId.toString() }}</div>
            <div class="core-id-status" :class="{ live: metadata?.liveness, expired: !metadata?.liveness }">
              {{ metadata?.liveness ? '活跃' : '已过期' }}
            </div>
          </div>
        </div>

        <CoreIdCheckIn
          :address="address"
          :coreId="coreId"
          :metadata="metadata"
          :formatAddress="formatAddress"
          @checkedIn="load"
        />
      </template>

      <!-- TODO: D-全网签到统计页，参考 v1 coreCheckInInfo.html + coreCheckInInfoController.js -->
      <div class="pop-history">
        <h3>签到徽章历史</h3>
        <div v-if="popHistory.length === 0" class="empty-state">暂无签到记录</div>
        <div v-else class="pop-badge-list">
          <div
            v-for="entry in popHistory"
            :key="entry.tokenId.toString()"
            class="pop-badge"
            :class="{ invalid: !entry.isValid }"
          >
            <img :src="entry.metadata?.image" :alt="entry.metadata?.name" class="pop-badge-img" />
            <div class="pop-month">{{ entry.monthLabel }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useCoreId } from '../composables/useCoreId'
import CoreIdCheckIn from './CoreIdCheckIn.vue'

interface Props {
  address: string
  formatAddress: (addr: string) => string
}

const props = defineProps<Props>()

const { coreIds, popHistory, isLoading, error, load } = useCoreId(props.address)

const coreId = computed(() => (coreIds.value.length > 0 ? coreIds.value[0].tokenId : null))
const metadata = computed(() => (coreIds.value.length > 0 ? coreIds.value[0].metadata : null))

onMounted(() => {
  load()
})
</script>

<style scoped>
.core-id-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.loading-state {
  color: #64748b;
}

.empty-state {
  color: #94a3b8;
  font-size: 0.9rem;
  padding: 12px 0;
}

.error-message {
  color: #ef4444;
  font-size: 0.9rem;
}

.core-id-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
}

.core-id-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  object-position: left center;
}

.core-id-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.core-id-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1e293b;
}

.core-id-status {
  display: inline-block;
  width: fit-content;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 999px;
}

.core-id-status.live {
  background: #dcfce7;
  color: #15803d;
}

.core-id-status.expired {
  background: #fee2e2;
  color: #b91c1c;
}

.pop-history h3 {
  margin: 0 0 12px 0;
  font-size: 1rem;
  color: #1e293b;
}

.pop-badge-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.pop-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px;
  min-width: 56px;
}

.pop-badge-img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.pop-month {
  font-size: 0.75rem;
  color: #64748b;
}

.pop-badge.invalid {
  opacity: 0.4;
}

.pop-badge.invalid .pop-badge-img {
  filter: grayscale(1);
}
</style>
