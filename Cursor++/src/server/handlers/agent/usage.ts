import type { LLMStreamRequest, LLMUsage } from '../llm/types'

export interface UsageTotals {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export function emptyUsageTotals(): UsageTotals {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  }
}

export function addUsage(totals: UsageTotals, usage: LLMUsage): UsageTotals {
  return {
    inputTokens: totals.inputTokens + usage.inputTokens,
    outputTokens: totals.outputTokens + usage.outputTokens,
    cacheReadTokens: totals.cacheReadTokens + (usage.cacheReadTokens ?? 0),
    cacheWriteTokens: totals.cacheWriteTokens + (usage.cacheWriteTokens ?? 0),
  }
}

/**
 * 近似当前会话上下文占用。
 *
 * inputTokens 代表本轮完整 prompt 规模(含全部历史消息), 是最准确的上下文大小信号。
 * outputTokens 代表本轮新增 assistant 内容, 下一轮会被加入 prompt。
 * 两者相加 ≈ 下一轮的预期 inputTokens, 作为"下一轮上下文压力"的近似。
 */
export function estimateContextTokens(usage: LLMUsage): number {
  return Math.max(0, usage.inputTokens + usage.outputTokens)
}

export function clampTokenDetails(usedTokens: number, maxTokens: number): { usedTokens: number, maxTokens: number } {
  const safeMax = Math.max(1, maxTokens)
  return {
    usedTokens: Math.max(0, Math.min(usedTokens, safeMax)),
    maxTokens: safeMax,
  }
}

export function computeContextUsagePercent(usedTokens: number, maxTokens: number): number {
  const { usedTokens: safeUsed, maxTokens: safeMax } = clampTokenDetails(usedTokens, maxTokens)
  return Number(((safeUsed / safeMax) * 100).toFixed(2))
}

export interface ContextBudgetLimits {
  requestHeadroom: number
  hardLimit: number
  autoCompactThreshold: number
  retainedUserTokens: number
}

/** PI-Desktop context-budget.ts (7a95fd0): 先扣输出/提示预留，再以安全预算的 90% 提前压缩。 */
export function getContextBudgetLimits(maxTokens: number, maxOutputTokens = 8192): ContextBudgetLimits {
  const window = Number.isFinite(maxTokens) && maxTokens > 0 ? Math.max(1, Math.round(maxTokens)) : 128000
  const output = Number.isFinite(maxOutputTokens) && maxOutputTokens > 0 ? Math.round(maxOutputTokens) : 8192
  const outputReserve = Math.min(Math.max(1, output), Math.max(1, Math.floor(window * 0.25)))
  const reserveFloor = Math.min(16384, Math.max(1, Math.floor(window * 0.5)))
  const requestHeadroom = Math.min(window - 1, Math.max(reserveFloor, outputReserve, Math.ceil(window * 0.05)))
  const hardLimit = Math.max(1, window - requestHeadroom)
  return {
    requestHeadroom,
    hardLimit,
    autoCompactThreshold: Math.max(1, Math.floor(hardLimit * 0.9)),
    retainedUserTokens: Math.max(1, Math.min(20000, Math.floor(hardLimit * 0.5))),
  }
}

export function getAutoCompactThreshold(maxTokens: number, maxOutputTokens = 8192): number {
  return getContextBudgetLimits(maxTokens, maxOutputTokens).autoCompactThreshold
}

export function shouldTriggerCompaction(usedTokens: number, maxTokens: number, thresholdPercent?: number, maxOutputTokens = 8192): boolean {
  if (thresholdPercent !== undefined)
    return computeContextUsagePercent(usedTokens, maxTokens) >= thresholdPercent
  return usedTokens >= getAutoCompactThreshold(maxTokens, maxOutputTokens)
}

/** 不覆盖省略输出上限的显式配置；显式 thinking budget 必须小于动态输出上限。 */
export function capRequestOutput(request: LLMStreamRequest, contextTokenLimit: number, inputTokens: number): LLMStreamRequest {
  if (request.maxTokens === undefined)
    return request
  const maxTokens = Math.max(1, Math.min(request.maxTokens, Math.floor(contextTokenLimit - inputTokens)))
  if (!request.thinking || request.thinkingBudgetTokens === undefined || request.thinkingBudgetTokens < maxTokens)
    return { ...request, maxTokens }
  if (maxTokens <= 1024)
    return { ...request, maxTokens, thinking: false, thinkingBudgetTokens: undefined, thinkingLevel: undefined }
  return { ...request, maxTokens, thinkingBudgetTokens: maxTokens - 1 }
}
