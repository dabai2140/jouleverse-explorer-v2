// revert data 解码：Error(string) 与 Panic(uint256)
//
// 从 ContractTool.vue 抽出（2026-11-17），原因有二：
// 1. 原实现的 Error(string) 分支偏移量算错，任何标准 revert 消息都解不出来（返回空串），
//    而它在组件内部、无任何测试覆盖，所以错了很久没人发现。
// 2. 合约交互工具里「交易失败原因」是唯一的可诊断信息，必须可单独测。
import { hexToString } from 'viem'

const PANIC_REASONS: Record<string, string> = {
  '1': 'assert 失败',
  '17': '算术溢出',
  '18': '除以零',
  '33': '枚举值越界',
  '34': '存储字节数组越界',
  '49': 'pop 空数组',
  '50': '数组越界',
  '65': '分配内存溢出',
  '81': '内部函数调用错误',
}

/**
 * 解码 revert data。
 *
 * @param data 0x 开头的 revert data
 * @returns 人类可读原因；无法识别时返回 `revert data: 0x....` 摘要；解析异常返回空串
 *
 * ABI 编码（Error(string)）：
 *   selector 0x08c379a0
 *   word[0]  offset  = 0x20（指向长度字，以 selector 之后为起点）
 *   word[1]  length  = 字符串字节数
 *   word[2+] content = 字符串本体，右补零到 32 字节整数倍
 *
 * 注意 offset 单位是**字节**，而我们按 hex 字符切串，所以 line 里 `* 2` 已经把字节换算成
 * 字符了，后面不能再额外 +32 字节（即 +64 字符）。原实现 `slice(offset + 64, offset + 128)`
 * 正是多加了这一格，读到的其实是字符串内容的头 32 字节，parseInt 得到 4.7e76 这种天文数字，
 * 最终 slice 越界 → 空串。
 */
export function decodeRevertReason(data: string): string {
  try {
    if (data.startsWith('0x08c379a0')) {
      const body = data.slice(10)
      const offset = parseInt(body.slice(0, 64), 16) * 2
      const length = parseInt(body.slice(offset, offset + 64), 16)
      const content = body.slice(offset + 64, offset + 64 + length * 2)
      return hexToString(`0x${content}`)
    }
    if (data.startsWith('0x4e487b71')) {
      const code = BigInt(`0x${data.slice(10, 74)}`)
      return `Panic(${code}): ${PANIC_REASONS[code.toString()] ?? '未知错误'}`
    }
    return `revert data: ${data.slice(0, 18)}...`
  } catch {
    return ''
  }
}
