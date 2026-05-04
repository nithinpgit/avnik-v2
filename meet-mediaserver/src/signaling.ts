import type { DtlsParameters, RtpCapabilities, RtpParameters } from 'mediasoup/types'
import type { MediaRoom } from './mediaRoom.js'
import { logger } from './logger.js'

type ClientMsg =
  | { t: 'getRouterRtpCapabilities'; req: number }
  | { t: 'createWebRtcTransport'; req: number; d: { producing: boolean; consuming: boolean } }
  | { t: 'connectTransport'; req: number; d: { transportId: string; dtlsParameters: unknown } }
  | {
      t: 'produce'
      req: number
      d: {
        transportId: string
        kind: 'audio' | 'video'
        rtpParameters: RtpParameters
        appData?: Record<string, unknown>
      }
    }
  | {
      t: 'consume'
      req: number
      d: { transportId: string; producerId: string; rtpCapabilities: RtpCapabilities }
    }
  | { t: 'resumeConsumer'; req: number; d: { consumerId: string } }
  | { t: 'listProducers'; req: number }

function reply(t: string, req: number | undefined, ok: boolean, data?: unknown, error?: string) {
  return { t, ok, req, data, error }
}

export async function handleClientMessage(
  room: MediaRoom,
  peerId: string,
  raw: unknown,
  send: (o: Record<string, unknown>) => void,
): Promise<void> {
  const msg = raw as ClientMsg
  const req = 'req' in msg ? msg.req : undefined
  try {
    switch (msg.t) {
      case 'getRouterRtpCapabilities': {
        send(reply('routerRtpCapabilities', req, true, room.getRtpCapabilities()))
        return
      }
      case 'createWebRtcTransport': {
        const tr = await room.createWebRtcTransport(peerId, msg.d.producing, msg.d.consuming)
        send(reply('transportCreated', req, true, tr))
        return
      }
      case 'connectTransport': {
        await room.connectTransport(peerId, msg.d.transportId, msg.d.dtlsParameters as DtlsParameters)
        send(reply('transportConnected', req, true, {}))
        return
      }
      case 'produce': {
        const { id } = await room.produce(peerId, msg.d.transportId, msg.d.kind, msg.d.rtpParameters, msg.d.appData ?? {})
        send(reply('produced', req, true, { id }))
        return
      }
      case 'consume': {
        const data = await room.consume(peerId, msg.d.transportId, msg.d.producerId, msg.d.rtpCapabilities)
        send(reply('consumed', req, true, data))
        return
      }
      case 'resumeConsumer': {
        await room.resumeConsumer(peerId, msg.d.consumerId)
        send(reply('consumerResumed', req, true, {}))
        return
      }
      case 'listProducers': {
        const producers = room.listProducerMetaForPeer(peerId)
        send(reply('producerList', req, true, { producers }))
        return
      }
      default:
        send(reply('error', req, false, undefined, `unknown type: ${(msg as { t: string }).t}`))
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn({ peerId, message, t: (msg as { t?: string }).t }, 'signaling error')
    send(reply('error', req, false, undefined, message))
  }
}
