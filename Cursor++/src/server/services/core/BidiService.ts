/**
 * aiserver.v1.BidiService — Bidi 辅助服务
 *
 * 1 方法:
 *   - BidiAppend (unary) — 向 bidi 流追加消息
 *     SSE 降级模式下，客户端通过此方法发送 AgentClientMessage，
 *     data 字段包含 base64 编码的序列化 protobuf，requestId 关联到 RunSSE 流。
 *
 * Transport: backendUrl (api2.cursor.sh)
 */
import type { ConnectRouter } from '@connectrpc/connect'
import { BidiService } from '../../gen/aiserver_v1_pb'
import { appendMessage } from '../../handlers/agent/session'
import { logger } from '../../logger'

export default (router: ConnectRouter) => {
  router.service(BidiService, {
    bidiAppend: async (req) => {
      const requestId = req.requestId?.requestId
      // 新版客户端（Cursor 3.29+）把消息体放在 bytes 字段 data_binary 里，
      // 旧版放在 string 字段 data 里（hex 编码的 protobuf）。
      // 这里统一归一化为 appendMessage 期望的 hex 字符串。
      const hex = req.data
        || (req.dataBinary?.length ? Buffer.from(req.dataBinary).toString('hex') : '')
      if (requestId && hex) {
        logger.info({ requestId, dataLen: hex.length, seqno: Number(req.appendSeqno), via: req.data ? 'data' : 'dataBinary' }, '[SVC] BidiAppend')
        appendMessage(requestId, hex)
      }
      else {
        logger.warn({ hasRequestId: !!requestId, hasData: !!req.data, dataBinaryLen: req.dataBinary?.length ?? 0, seqno: Number(req.appendSeqno) }, '[SVC] BidiAppend missing fields')
      }
      return {}
    },
  })
}
