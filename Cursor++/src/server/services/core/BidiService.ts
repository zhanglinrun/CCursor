/**
 * aiserver.v1.BidiService — Bidi 辅助服务
 *
 * 1 方法:
 *   - BidiAppend (unary) — 向 bidi 流追加消息
 *     SSE 降级模式下，客户端通过此方法发送 AgentClientMessage，
 *     requestId 关联到 RunSSE，载荷为 raw data_binary 或旧版 hex data。
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
      const binary = req.dataBinary.length > 0
      const hex = req.data
      const seqno = Number(req.appendSeqno)
      if (!requestId || (!binary && !hex)) {
        logger.warn({ hasRequestId: !!requestId, hasData: !!req.data, dataBinaryLen: req.dataBinary.length, seqno }, '[SVC] BidiAppend missing fields')
      }
      else if (!binary && (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex))) {
        logger.warn({ requestId, dataLen: hex.length, seqno }, '[SVC] BidiAppend invalid hex')
      }
      else {
        const bytes = binary ? req.dataBinary : Buffer.from(hex, 'hex')
        logger.info({ requestId, seqno, via: binary ? 'dataBinary' : 'data', bytes: bytes.length }, '[SVC] BidiAppend')
        appendMessage(requestId, bytes)
      }
      return {}
    },
  })
}
