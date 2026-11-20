import type { StoredBlock, StoredMessage } from '../llm/storedTranscript'
import type { LLMContentBlock, LLMMessage } from '../llm/types'
import {
  llmMessageToStoredMessage,
  normalizeStoredMessage,
  restoreStoredMessage,
  storedMessageToLLMMessage,
} from '../llm/storedTranscript'

export interface BlobMessage {
  role: string
  content: unknown
  toolCallId?: string
  toolName?: string
  isError?: boolean
  id?: string
  providerOptions?: Record<string, unknown>
  toolResult?: LLMMessage['toolResult']
}

export function normalizeBlobMessage(message: BlobMessage): StoredMessage {
  return normalizeStoredMessage(message)
}

export function restoreBlobMessageToLLMMessage(message: Record<string, unknown>): LLMMessage | null {
  const stored = restoreStoredMessage(message)
  if (!stored)
    return null

  if (stored.role === 'tool') {
    if (typeof stored.content === 'string')
      return storedMessageToLLMMessage({ ...stored, toolCallId: stored.toolCallId ?? stored.id })
    const canonical = storedMessageToLLMMessage({ ...stored, role: 'user' })
    const [result] = canonical.content
    if (canonical.content.length === 1 && typeof result !== 'string' && result?.type === 'tool_result') {
      return {
        role: 'tool',
        content: result.content,
        toolCallId: result.toolUseId || stored.toolCallId || stored.id,
        toolName: result.toolName || stored.toolName,
        isError: result.isError ?? stored.isError,
        ...(result.toolResult ? { toolResult: result.toolResult } : {}),
      }
    }
    // The provider repair path already expands grouped results and preserves residual blocks.
    if (stored.content.some(block => block.type === 'tool-result'))
      return canonical
  }

  if (stored.role === 'user' && Array.isArray(stored.content) && stored.content.length > 0 && stored.content.every(block => block.type === 'text'))
    return storedMessageToLLMMessage({ ...stored, content: textContent(stored.content) })

  return storedMessageToLLMMessage(stored)
}

export function llmMessageToBlobMessage(message: LLMMessage): StoredMessage {
  return llmMessageToStoredMessage(message)
}

function textContent(content: string | StoredBlock[]): string {
  return typeof content === 'string'
    ? content
    : content.flatMap(block => block.type === 'text' || block.type === 'reasoning' ? [block.text] : []).join('')
}

function officialToolMessage(message: StoredMessage): Record<string, unknown> {
  const blocks = Array.isArray(message.content) ? message.content : []
  const resultBlocks = blocks.filter(block => block.type === 'tool-result')
  const fallback = { type: 'tool-result' as const, toolCallId: '', result: textContent(message.content) }
  const content: Record<string, unknown>[] = (resultBlocks.length > 0 ? resultBlocks : [fallback]).map(block => ({
    ...block,
    toolCallId: block.toolCallId || message.toolCallId || message.id || '',
    toolName: ('toolName' in block && block.toolName) || message.toolName || '',
    isError: ('isError' in block ? block.isError : undefined) ?? message.isError,
  }))
  const images = blocks.filter(block => block.type === 'image')
  if (images.length > 0)
    content[0]!.experimental_content = [...(resultBlocks[0]?.experimental_content ?? []), ...images]

  return {
    role: 'tool',
    content,
    id: message.id || content[0]!.toolCallId || undefined,
    providerOptions: message.providerOptions,
  }
}

function officialMessage(message: StoredMessage): Record<string, unknown> {
  const { role, content, id, providerOptions } = message
  if (role === 'tool')
    return officialToolMessage(message)
  if (role === 'system' || (role === 'assistant' && typeof content === 'string'))
    return { role, content: textContent(content), id, providerOptions }

  const blocks = typeof content === 'string' ? [{ type: 'text' as const, text: content }] : content
  if (role === 'assistant' && blocks.length === 1 && blocks[0]?.type === 'text')
    return { role, content: blocks[0].text, id, providerOptions }

  const parts = blocks.map((block) => {
    if (block.type !== 'image')
      return block
    const { data, mimeType } = block
    const image = /^(?:data:|https?:\/\/)/i.test(data) ? data : `data:${mimeType};base64,${data}`
    return { type: 'image', image, mimeType }
  })
  return { role, content: parts, id, providerOptions }
}

/** Build Cursor CoreMessage JSON. Old Anthropic history can mix tool results and user content. */
export function toOfficialCoreMessages(message: StoredMessage): Record<string, unknown>[] {
  if (message.role !== 'user' || !Array.isArray(message.content) || !message.content.some(block => block.type === 'tool-result'))
    return [officialMessage(message)]

  const groups: Array<{ role: 'tool' | 'user', content: StoredBlock[] }> = []
  for (const block of message.content) {
    const role = block.type === 'tool-result' ? 'tool' : 'user'
    const last = groups.at(-1)
    if (last?.role === role)
      last.content.push(block)
    else
      groups.push({ role, content: [block] })
  }
  return groups.map((group, index) => officialMessage({ ...message, ...group, id: index === 0 ? message.id : undefined }))
}

export function summarizeAssistantContent(content: string | LLMContentBlock[] | undefined): { thinking?: string, text?: string } {
  if (!Array.isArray(content)) {
    return { text: typeof content === 'string' && content ? content : undefined }
  }

  const thinking = content
    .filter(block => block.type === 'thinking')
    .map(block => block.text)
    .join('')
  const text = content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')

  return {
    thinking: thinking || undefined,
    text: text || undefined,
  }
}
