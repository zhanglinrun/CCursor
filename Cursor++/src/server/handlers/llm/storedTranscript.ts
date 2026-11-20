import type { LLMContentBlock, LLMMessage, ToolResultMetadata } from './types'

export interface StoredMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | StoredBlock[]
  toolCallId?: string
  toolName?: string
  isError?: boolean
  id?: string
  providerOptions?: Record<string, unknown>
}

export type StoredBlock
  = | { type: 'text', text: string }
    | { type: 'image', mimeType: string, data: string }
    | { type: 'reasoning', text: string, signature?: string, providerOptions?: Record<string, unknown> }
    | { type: 'tool-call', toolCallId: string, toolName: string, args: Record<string, unknown> }
    | { type: 'tool-result', toolCallId: string, toolName?: string, result: unknown, isError?: boolean, structured?: unknown, experimental_content?: ToolResultMetadata['images'] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeStoredMessage(message: {
  role: string
  content: unknown
  toolCallId?: string
  toolName?: string
  isError?: boolean
  id?: string
  providerOptions?: Record<string, unknown>
  toolResult?: ToolResultMetadata
}): StoredMessage {
  if (!Array.isArray(message.content)) {
    const metadata = message.role === 'tool' ? message.toolResult : undefined
    const text = typeof message.content === 'string' ? message.content : ''
    let content: StoredMessage['content'] = text
    if (metadata) {
      content = [{
        type: 'tool-result',
        toolCallId: message.toolCallId ?? '',
        toolName: message.toolName,
        result: metadata.raw === undefined ? text : metadata.raw,
        isError: message.isError,
        structured: metadata.structured,
        experimental_content: metadata.images,
      }]
    }
    return {
      role: message.role as StoredMessage['role'],
      content,
      toolCallId: message.toolCallId,
      toolName: message.toolName,
      isError: message.isError,
      id: message.id,
      providerOptions: message.providerOptions,
    }
  }

  return {
    role: message.role as StoredMessage['role'],
    content: parseStoredBlocks(message.content),
    toolCallId: message.toolCallId,
    toolName: message.toolName,
    isError: message.isError,
    id: message.id,
    providerOptions: message.providerOptions,
  }
}

function parseStoredImage(block: Record<string, unknown>): Extract<StoredBlock, { type: 'image' }> {
  const data = typeof block.image === 'string' ? block.image : typeof block.data === 'string' ? block.data : ''
  const dataUrl = /^data:([^;,]+);base64,([\s\S]*)$/i.exec(data)
  return {
    type: 'image',
    mimeType: dataUrl?.[1] ?? (typeof block.mimeType === 'string' ? block.mimeType : 'image/png'),
    data: dataUrl?.[2] ?? data,
  }
}

function parseToolArgs(args: unknown): Record<string, unknown> {
  if (typeof args !== 'string')
    return isRecord(args) ? args : {}
  try {
    const parsed: unknown = JSON.parse(args)
    return isRecord(parsed) ? parsed : {}
  }
  catch {
    return {}
  }
}

function parseStoredBlocks(blocks: unknown[]): StoredBlock[] {
  const normalized: StoredBlock[] = []
  for (const block of blocks) {
    if (!isRecord(block) || typeof block.type !== 'string')
      continue
    switch (block.type) {
      case 'text':
        normalized.push({ type: 'text', text: typeof block.text === 'string' ? block.text : '' })
        break
      case 'image':
        normalized.push(parseStoredImage(block))
        break
      case 'reasoning':
      case 'thinking':
        normalized.push({
          type: 'reasoning',
          text: typeof block.text === 'string' ? block.text : '',
          ...(typeof block.signature === 'string' ? { signature: block.signature } : {}),
          ...(isRecord(block.providerOptions) ? { providerOptions: block.providerOptions } : {}),
        })
        break
      case 'tool-call':
        normalized.push({
          type: 'tool-call',
          toolCallId: typeof block.toolCallId === 'string' ? block.toolCallId : '',
          toolName: typeof block.toolName === 'string' ? block.toolName : '',
          args: parseToolArgs(block.args),
        })
        break
      case 'tool_use':
        normalized.push({
          type: 'tool-call',
          toolCallId: typeof block.id === 'string' ? block.id : '',
          toolName: typeof block.name === 'string' ? block.name : '',
          args: parseToolArgs(block.input),
        })
        break
      case 'tool-result': {
        const images = Array.isArray(block.experimental_content)
          ? block.experimental_content.filter(item => isRecord(item) && item.type === 'image').map(parseStoredImage)
          : []
        normalized.push({
          type: 'tool-result',
          toolCallId: typeof block.toolCallId === 'string' ? block.toolCallId : '',
          ...(typeof block.toolName === 'string' ? { toolName: block.toolName } : {}),
          result: block.result === undefined ? '' : block.result,
          ...(typeof block.isError === 'boolean' ? { isError: block.isError } : {}),
          ...(block.structured !== undefined ? { structured: block.structured } : {}),
          ...(images.length ? { experimental_content: images } : {}),
        })
        break
      }
      case 'tool_result':
        normalized.push({
          type: 'tool-result',
          toolCallId: typeof block.toolUseId === 'string' ? block.toolUseId : '',
          ...(typeof block.toolName === 'string' ? { toolName: block.toolName } : {}),
          result: typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? ''),
          ...(typeof block.isError === 'boolean' ? { isError: block.isError } : {}),
        })
        break
      default:
        break
    }
  }

  return normalized
}

export function restoreStoredMessage(message: Record<string, unknown>): StoredMessage | null {
  if (typeof message.role !== 'string')
    return null

  return normalizeStoredMessage({
    role: message.role,
    content: message.content,
    toolCallId: typeof message.toolCallId === 'string' ? message.toolCallId : undefined,
    toolName: typeof message.toolName === 'string' ? message.toolName : undefined,
    isError: typeof message.isError === 'boolean' ? message.isError : undefined,
    id: typeof message.id === 'string' ? message.id : undefined,
    providerOptions: isRecord(message.providerOptions) ? message.providerOptions : undefined,
  })
}

export function storedMessageToLLMMessage(message: StoredMessage): LLMMessage {
  if (typeof message.content === 'string') {
    return {
      role: message.role,
      content: message.content,
      toolCallId: message.toolCallId,
      toolName: message.toolName,
      isError: message.isError,
    }
  }

  const content: LLMContentBlock[] = []
  for (const block of message.content) {
    switch (block.type) {
      case 'text':
        content.push({ type: 'text', text: block.text })
        break
      case 'image':
        content.push({ type: 'image', mimeType: block.mimeType, data: block.data })
        break
      case 'reasoning':
        content.push({
          type: 'thinking',
          text: block.text,
          ...(block.signature ? { signature: block.signature } : {}),
          ...(block.providerOptions ? { providerOptions: block.providerOptions } : {}),
        })
        break
      case 'tool-call':
        content.push({ type: 'tool_use', id: block.toolCallId, name: block.toolName, input: block.args })
        break
      case 'tool-result': {
        const { result, structured, experimental_content: images } = block
        const raw = typeof result === 'string' ? undefined : result
        const toolResult = raw !== undefined || structured !== undefined || images?.length ? { raw, structured, images } : undefined
        content.push({
          type: 'tool_result',
          toolUseId: block.toolCallId,
          toolName: block.toolName,
          content: typeof result === 'string' ? result : JSON.stringify(result) ?? '',
          ...(block.isError ? { isError: true } : {}),
          ...(toolResult ? { toolResult } : {}),
        })
        break
      }
    }
  }

  return {
    role: message.role,
    content,
    toolCallId: message.toolCallId,
    toolName: message.toolName,
    isError: message.isError,
  }
}

export function llmMessageToStoredMessage(message: LLMMessage): StoredMessage {
  if (typeof message.content === 'string')
    return normalizeStoredMessage(message)

  const content: StoredBlock[] = []
  for (const block of message.content) {
    switch (block.type) {
      case 'text':
        content.push({ type: 'text', text: block.text })
        break
      case 'image':
        content.push({ type: 'image', mimeType: block.mimeType, data: block.data })
        break
      case 'thinking':
        content.push({
          type: 'reasoning',
          text: block.text,
          ...(typeof block.signature === 'string' ? { signature: block.signature } : {}),
          ...(block.providerOptions ? { providerOptions: block.providerOptions } : {}),
        })
        break
      case 'tool_use':
        content.push({ type: 'tool-call', toolCallId: block.id, toolName: block.name, args: block.input })
        break
      case 'tool_result':
        content.push({
          type: 'tool-result',
          toolCallId: block.toolUseId,
          toolName: block.toolName,
          result: block.toolResult?.raw === undefined ? block.content : block.toolResult.raw,
          ...(block.toolResult?.structured !== undefined ? { structured: block.toolResult.structured } : {}),
          ...(block.toolResult?.images?.length ? { experimental_content: block.toolResult.images } : {}),
          ...(block.isError ? { isError: true } : {}),
        })
        break
    }
  }

  return {
    role: message.role,
    content,
    toolCallId: message.toolCallId,
    toolName: message.toolName,
    isError: message.isError,
  }
}
