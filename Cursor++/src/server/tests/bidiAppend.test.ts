import { create, toBinary } from '@bufbuild/protobuf'
import { createClient, createRouterTransport } from '@connectrpc/connect'
import { expect, it } from 'vitest'
import { AgentClientMessageSchema, ClientHeartbeatSchema } from '../gen/agent_v1_pb'
import { BidiService } from '../gen/aiserver_v1_pb'
import { closeSession, getOrCreateSession, waitForMessage } from '../handlers/agent/session'
import registerBidi from '../services/core/BidiService'

const client = createClient(BidiService, createRouterTransport(registerBidi))
const encoded = toBinary(AgentClientMessageSchema, create(AgentClientMessageSchema, {
  message: { case: 'clientHeartbeat', value: create(ClientHeartbeatSchema) },
}))

it.each([
  { data: Buffer.from(encoded).toString('hex') },
  { dataBinary: encoded },
])('queues the same client message from either BidiAppend encoding', async (payload) => {
  const requestId = { requestId: 'dual-encoding' }
  try {
    await client.bidiAppend({ requestId, ...payload })
    expect(await waitForMessage(getOrCreateSession(requestId.requestId), 5)).toEqual({ clientHeartbeat: {} })
  }
  finally {
    closeSession(requestId.requestId)
  }
})

it('ignores invalid hex and messages without a recognized payload', async () => {
  const requestId = { requestId: 'invalid-append' }
  try {
    await client.bidiAppend({ requestId, data: 'not hex' })
    await client.bidiAppend({ requestId, dataBinary: new Uint8Array([0x78, 0]) })
    expect(await waitForMessage(getOrCreateSession(requestId.requestId), 5)).toBeNull()
    await client.bidiAppend({ requestId, dataBinary: encoded })
    expect(await waitForMessage(getOrCreateSession(requestId.requestId), 5)).toEqual({ clientHeartbeat: {} })
  }
  finally {
    closeSession(requestId.requestId)
  }
})
