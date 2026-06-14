import type { NFTMetadata } from '../types/coreid'

// 解析 tokenURI 返回的 data:application/json;base64,... 格式
// 1:1 port自 v1 addressInfoController.js parseTokenURI（第736-748行）
export function parseTokenURI(tokenURI: string): NFTMetadata | null {
  const [prefix, payload] = tokenURI.split(',')
  if (prefix === 'data:application/json;base64' && payload) {
    try {
      return JSON.parse(atob(payload)) as NFTMetadata
    } catch {
      return null
    }
  }
  return null
}
