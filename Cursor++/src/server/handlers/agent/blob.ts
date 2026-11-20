/**
 * KV Blob Store 处理
 *
 * Agent 协议使用 KV Blob Store 传输大块数据:
 *   - Server → Client: kvServerMessage.setBlobArgs { blobId, blobData }
 *   - Client → Server: kvClientMessage.setBlobResult { id? }
 *
 * 缓存保存 payload 的 base64；KV 帧发送原始 UTF-8 JSON 或 protobuf bytes。
 */
import { createHash } from 'node:crypto'

function finalizeBlobData(blobData: string): { blobId: string, blobData: string } {
  const blobId = createHash('sha256').update(blobData).digest('base64')
  return { blobId, blobData }
}

/** JSON IDs hash the wire bytes so a new write cannot alias a legacy Base64-text write. */
export function encodeBlob(data: unknown): { blobId: string, blobData: string } {
  const bytes = Buffer.from(JSON.stringify(data), 'utf8')
  return {
    blobId: createHash('sha256').update(bytes).digest('base64'),
    blobData: bytes.toString('base64'),
  }
}

/**
 * 将 protobuf / binary 数据编码为 blob (base64) 并计算 blobId (sha256)。
 *  blobDataRaw 保留原始 bytes，供 kvMessage 直接发给客户端（fork 时客户端 fromBinary 需要 raw protobuf）。
 */
export function encodeBinaryBlob(bytes: Uint8Array): { blobId: string, blobData: string, blobDataRaw: Uint8Array } {
  const { blobId, blobData } = finalizeBlobData(Buffer.from(bytes).toString('base64'))
  return { blobId, blobData, blobDataRaw: bytes }
}

/** Convert a Base64 cache value to the exact payload stored by the client. */
export function cachedBlobPayloadBytes(blobData: string): Buffer {
  return Buffer.from(blobData, 'base64')
}

function parseCachedJson(blobData: string): { json: string, value: unknown, legacyWire?: boolean } {
  const direct = blobData.trimStart()
  if (direct.startsWith('{') || direct.startsWith('['))
    return { json: blobData, value: JSON.parse(blobData) }

  const json = cachedBlobPayloadBytes(blobData).toString('utf8')
  try {
    return { json, value: JSON.parse(json) }
  }
  catch (error) {
    // Legacy uploads encode the client's Base64-text wire payload a second time.
    const unwrapped = cachedBlobPayloadBytes(json).toString('utf8')
    if (Buffer.from(unwrapped).toString('base64') !== json)
      throw error
    return { json: unwrapped, value: JSON.parse(unwrapped), legacyWire: true }
  }
}

export function decodeBlob(blobData: string): unknown {
  return parseCachedJson(blobData).value
}

/** Identify JSON addressed by the old server, regardless of how it entered this cache. */
export function decodeLegacyHistoryBlob(blobId: string, blobData: string): unknown {
  const { json, value, legacyWire } = parseCachedJson(blobData)
  const legacyCacheValue = Buffer.from(json, 'utf8').toString('base64')
  if (legacyWire || finalizeBlobData(legacyCacheValue).blobId === blobId)
    return value
}

/** 构造 system prompt blob */
export function buildSystemPromptBlob(modelId: string): { blobId: string, blobData: string } {
  return encodeBlob({
    role: 'system',
    content: `You are an AI coding assistant, powered by ${modelId}.\n\nYou operate in Cursor.\n\nYou are a coding agent that helps the USER with software engineering tasks.`,
  })
}

/** 构造 user message blob */
export function buildUserMessageBlob(
  text: string,
  env?: { osVersion?: string, shell?: string, workspacePaths?: string[] },
): { blobId: string, blobData: string } {
  let content = ''

  if (env) {
    content += '<user_info>\n'
    if (env.osVersion)
      content += `OS Version: ${env.osVersion}\n`
    if (env.shell)
      content += `Shell: ${env.shell}\n`
    if (env.workspacePaths?.length)
      content += `Workspace Path: ${env.workspacePaths[0]}\n`
    content += '</user_info>\n\n'
  }

  content += `<user_query>\n${text}\n</user_query>`

  return encodeBlob({ role: 'user', content: [{ type: 'text', text: content }] })
}
