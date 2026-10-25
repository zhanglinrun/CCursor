import type { AgentServerMessage } from '../../gen/agent_v1_pb'
import type { ParsedRunRequest } from './protocol'
import type { AgentSession } from './session'
import { randomUUID } from 'node:crypto'
import { persistConversationCheckpoint } from '../../database/checkpoints'
import { logger } from '../../logger'
import { makeProviderError } from '../errors'
import { resolveProviderRuntime } from '../llm'
import { createCompactionArtifacts, estimateMessagesTokens, formatMessageForSummary, planCheckpointCompaction } from './compactionStrategy'
import { hydrateHistoryEntries, repairHistoryEntries } from './historyManager'
import { executePreCompactHook } from './hookRuntime'
import { workspaceUris } from './protocol'
import { checkpoint, heartbeat, kvMessage, summaryCompleted, summaryStarted } from './stream'
import { generateModelSummary } from './summaryRequest'
import { clampTokenDetails, computeContextUsagePercent } from './usage'
import { isAgentRunAbortedError, throwIfSessionCancelled } from './wait'

export async function* handleSummarizeAction(
  parsed: ParsedRunRequest,
  session: AgentSession | null,
): AsyncIterable<AgentServerMessage> {
  const route = resolveProviderRuntime(parsed.modelId)
  const hydratedHistoryEntries = hydrateHistoryEntries(parsed.historyBlobIds)
  const missingHistoryBlobs = Math.max(0, parsed.historyBlobIds.length - hydratedHistoryEntries.length)
  const historyEntries = repairHistoryEntries(hydratedHistoryEntries)
  const compactionPlan = planCheckpointCompaction(historyEntries)
  const currentTokenDetails = clampTokenDetails(
    parsed.historyTokenDetails?.usedTokens ?? estimateMessagesTokens(historyEntries.map(entry => entry.message)),
    parsed.historyTokenDetails?.maxTokens ?? parsed.contextTokenLimit ?? route.contextTokenLimit,
  )
  const contextUsagePercent = computeContextUsagePercent(currentTokenDetails.usedTokens, currentTokenDetails.maxTokens)
  const generationId = randomUUID()

  logger.info({
    conversationId: parsed.conversationId,
    model: route.model,
    historyBlobIds: parsed.historyBlobIds.length,
    hydratedEntries: hydratedHistoryEntries.length,
    missingBlobs: missingHistoryBlobs,
    summarizeEntries: compactionPlan.summarizeEntries.length,
    keepTail: compactionPlan.keepTail.length,
    contextUsagePercent: contextUsagePercent.toFixed(1),
    usedTokens: currentTokenDetails.usedTokens,
    maxTokens: currentTokenDetails.maxTokens,
  }, '[SUMMARIZE] action started')

  yield heartbeat()

  const hookMessage = yield* executePreCompactHook({
    session,
    conversationId: parsed.conversationId,
    generationId,
    modelId: parsed.modelId,
    contextUsagePercent,
    contextTokens: currentTokenDetails.usedTokens,
    contextWindowSize: currentTokenDetails.maxTokens,
    messageCount: historyEntries.length,
    messagesToCompact: compactionPlan.summarizeEntries.length,
    isFirstCompaction: parsed.historySummaryArchiveIds.length === 0,
    execMessageId: 1,
  })

  yield summaryStarted()

  if (missingHistoryBlobs > 0) {
    logger.warn({
      conversationId: parsed.conversationId,
      requestedBlobs: parsed.historyBlobIds.length,
      resolvedBlobs: hydratedHistoryEntries.length,
      missingHistoryBlobs,
    }, '[AGENT] summarizeAction skipped due to incomplete history')

    persistConversationCheckpoint({
      kind: 'committed',
      conversationId: parsed.conversationId,
      rootBlobIds: parsed.historyBlobIds,
      turnBlobIds: parsed.historyTurnBlobIds,
      summaryArchiveIds: parsed.historySummaryArchiveIds,
      tokenDetails: currentTokenDetails,
      mode: parsed.mode,
      updatedAt: Date.now(),
    })

    yield checkpoint(
      parsed.historyBlobIds,
      currentTokenDetails.usedTokens,
      currentTokenDetails.maxTokens,
      parsed.mode,
      undefined,
      {
        turnBlobIds: parsed.historyTurnBlobIds,
        summaryArchiveIds: parsed.historySummaryArchiveIds,
        workspaceUris: workspaceUris(parsed),
        readPaths: parsed.readPaths,
        modelName: route.model,
        gitRepos: parsed.gitRepos?.map(r => ({ path: r.path, branchName: r.branchName })),
      },
    )
    yield summaryCompleted(hookMessage ?? 'Compaction deferred: conversation history is incomplete.')
    return
  }

  if (compactionPlan.summarizeEntries.length === 0) {
    persistConversationCheckpoint({
      kind: 'committed',
      conversationId: parsed.conversationId,
      rootBlobIds: parsed.historyBlobIds,
      turnBlobIds: parsed.historyTurnBlobIds,
      summaryArchiveIds: parsed.historySummaryArchiveIds,
      tokenDetails: currentTokenDetails,
      mode: parsed.mode,
      updatedAt: Date.now(),
    })

    yield summaryCompleted(hookMessage ?? 'Conversation already compact enough.')
    yield checkpoint(
      parsed.historyBlobIds,
      currentTokenDetails.usedTokens,
      currentTokenDetails.maxTokens,
      parsed.mode,
      undefined,
      {
        turnBlobIds: parsed.historyTurnBlobIds,
        summaryArchiveIds: parsed.historySummaryArchiveIds,
        workspaceUris: workspaceUris(parsed),
        readPaths: parsed.readPaths,
        modelName: route.model,
        gitRepos: parsed.gitRepos?.map(r => ({ path: r.path, branchName: r.branchName })),
      },
    )
    return
  }

  const summarySourceText = compactionPlan.summarizeEntries
    .map(entry => formatMessageForSummary(entry.message))
    .filter(text => text.length > 0)
    .join('\n\n')

  let summaryText = ''
  const llmStartTime = Date.now()
  logger.info({
    conversationId: parsed.conversationId,
    model: route.model,
    sourceTextLen: summarySourceText.length,
    summarizeEntries: compactionPlan.summarizeEntries.length,
    keepTail: compactionPlan.keepTail.length,
  }, '[SUMMARIZE] LLM summary starting')

  try {
    summaryText = yield* generateModelSummary({ source: summarySourceText, route, parsed, contextTokenLimit: currentTokenDetails.maxTokens, session })
  }
  catch (error) {
    if (isAgentRunAbortedError(error))
      throw error
    logger.warn({ error: (error as Error).message, durationMs: Date.now() - llmStartTime }, '[SUMMARIZE] LLM failed; preserving history')
    yield summaryCompleted('Compaction failed; conversation history preserved.')
    throw makeProviderError(error, { operation: 'summarize', modelId: parsed.modelId })
  }
  if (session)
    throwIfSessionCancelled(session)

  logger.info({
    conversationId: parsed.conversationId,
    summaryLen: summaryText.length,
    durationMs: Date.now() - llmStartTime,
  }, '[SUMMARIZE] LLM summary done')

  const artifacts = createCompactionArtifacts({
    plan: compactionPlan,
    summaryText,
    previousSummaryArchiveIds: parsed.historySummaryArchiveIds,
    knownBlobIds: parsed.historyBlobIds,
  })

  let summaryBlobCounter = 0
  for (const historyBlob of artifacts.historyBlobs)
    yield kvMessage(++summaryBlobCounter, historyBlob.blobId, historyBlob.blobData)
  yield kvMessage(++summaryBlobCounter, artifacts.summaryBlobId, artifacts.summaryBlobData)
  for (const archiveBlob of artifacts.archiveBlobs) {
    yield kvMessage(++summaryBlobCounter, archiveBlob.blobId, archiveBlob.blobData, archiveBlob.blobDataRaw)
  }

  const compactedUsedTokens = clampTokenDetails(
    estimateMessagesTokens([
      ...compactionPlan.leading.map(entry => entry.message),
      { role: 'assistant', content: `Previous conversation summary:\n${artifacts.summaryText}` },
      ...compactionPlan.keepTail.map(entry => entry.message),
    ]),
    currentTokenDetails.maxTokens,
  )

  if (session)
    throwIfSessionCancelled(session)
  persistConversationCheckpoint({
    kind: 'committed',
    conversationId: parsed.conversationId,
    rootBlobIds: artifacts.nextRootBlobIds,
    turnBlobIds: parsed.historyTurnBlobIds,
    summaryArchiveIds: artifacts.nextSummaryArchiveIds,
    tokenDetails: compactedUsedTokens,
    mode: parsed.mode,
    updatedAt: Date.now(),
  })

  yield checkpoint(
    artifacts.nextRootBlobIds,
    compactedUsedTokens.usedTokens,
    compactedUsedTokens.maxTokens,
    parsed.mode,
    undefined,
    {
      turnBlobIds: parsed.historyTurnBlobIds,
      summaryArchiveIds: artifacts.nextSummaryArchiveIds,
      workspaceUris: workspaceUris(parsed),
      readPaths: parsed.readPaths,
      modelName: route.model,
      gitRepos: parsed.gitRepos?.map(r => ({ path: r.path, branchName: r.branchName })),
    },
  )
  yield summaryCompleted(hookMessage ?? 'Chat context summarized.')
}
