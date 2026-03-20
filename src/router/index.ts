import { createRouter, createWebHistory } from 'vue-router';
import Home from '@/views/Home.vue';
import BlockDetail from '@/views/BlockDetail.vue';
import TransactionDetail from '@/views/TransactionDetail.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: Home,
    },
    {
      path: '/block/:number',
      name: 'BlockDetail',
      component: BlockDetail,
    },
    {
      path: '/tx/:hash',
      name: 'TransactionDetail',
      component: TransactionDetail,
    },
  ],
});

export default router;
