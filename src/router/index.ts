import { createRouter, createWebHistory } from 'vue-router'
import Blocks from '../views/Blocks.vue'
import BlockDetail from '../views/BlockDetail.vue'
import TransactionDetail from '../views/TransactionDetail.vue'
import AddressDetail from '../views/AddressDetail.vue'
import Home from '../views/Home.vue'
import WagmiTest from '../views/WagmiTest.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: Home
  },
  {
    path: '/blocks',
    name: 'blocks',
    component: Blocks
  },
  {
    path: '/block/:number',
    name: 'blockDetail',
    component: BlockDetail,
    props: true
  },
  {
    path: '/tx/:hash',
    name: 'transactionDetail',
    component: TransactionDetail,
    props: true
  },
  {
    path: '/address/:address',
    name: 'addressDetail',
    component: AddressDetail,
    props: true
  },
  {
    path: '/address/:address/block/:blockNumber',
    name: 'addressDetailWithBlock',
    component: AddressDetail,
    props: true
  },
  {
    path: '/test-wagmi',
    name: 'wagmiTest',
    component: WagmiTest
  }
]

const router = createRouter({
  history: createWebHistory('/'),
  routes
})

export default router
