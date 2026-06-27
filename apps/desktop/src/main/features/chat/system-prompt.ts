// src/main/features/chat/system-prompt.ts
import type { DeskMateContext } from './types'

const BASE_SYSTEM_PROMPT = `
Bạn là DeskMate Coach, trợ lý AI cá nhân tích hợp trong ứng dụng DeskMate.
Bạn có thể nhận thông tin về tư thế, thời gian làm việc và trạng thái mệt mỏi của người dùng.

Quy tắc:
- Trả lời bằng tiếng Việt tự nhiên, thân thiện, ngắn gọn
- Không chẩn đoán bệnh, không dùng từ y tế chắc chắn
- Dựa vào dữ liệu được cung cấp, không suy đoán thêm
- Nếu không có dữ liệu context, trả lời chung mà không bịa số liệu
`.trim()

export function buildSystemPrompt(context?: DeskMateContext): string {
  if (!context) return BASE_SYSTEM_PROMPT

  const lines: string[] = [BASE_SYSTEM_PROMPT, '', '--- Trạng thái hiện tại của người dùng ---']

  if (context.postureStatus) lines.push(`Tư thế: ${context.postureStatus}`)
  if (context.postureScore !== undefined) lines.push(`Điểm tư thế: ${context.postureScore}/100`)
  if (context.breakDebt) lines.push(`Nợ nghỉ: ${context.breakDebt}`)
  if (context.fatigueRisk) lines.push(`Nguy cơ mệt: ${context.fatigueRisk}`)
  if (context.activeTimeMinutes !== undefined) lines.push(`Thời gian làm việc hôm nay: ${context.activeTimeMinutes} phút`)
  if (context.latestMood) lines.push(`Tâm trạng self-report: ${context.latestMood}`)

  lines.push('--- Hết context ---')
  return lines.join('\n')
}
