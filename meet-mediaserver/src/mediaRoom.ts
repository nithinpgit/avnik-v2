import type {
  Consumer,
  DtlsParameters,
  Producer,
  RtpCapabilities,
  RtpParameters,
  Router,
  WebRtcTransport,
} from 'mediasoup/types'
import { config } from './config.js'
import { logger } from './logger.js'

type PeerRecord = {
  peerId: string
  displayName: string
  send: (msg: Record<string, unknown>) => void
  sendTransport?: WebRtcTransport
  recvTransport?: WebRtcTransport
  producers: Map<string, Producer>
  consumers: Map<string, Consumer>
}

export class MediaRoom {
  private readonly peers = new Map<string, PeerRecord>()

  constructor(
    readonly id: string,
    private readonly router: Router,
    private readonly onEmpty: () => void,
  ) {}

  addPeer(peerId: string, displayName: string, send: (msg: Record<string, unknown>) => void): void {
    if (this.peers.has(peerId)) {
      this.closePeer(peerId)
    }
    const rec: PeerRecord = {
      peerId,
      displayName,
      send,
      producers: new Map(),
      consumers: new Map(),
    }
    this.peers.set(peerId, rec)
    logger.info({ roomId: this.id, peerId }, 'peer joined media room')
  }

  removePeer(peerId: string): void {
    this.closePeer(peerId)
    if (this.peers.size === 0) {
      this.onEmpty()
    }
  }

  private closePeer(peerId: string): void {
    const p = this.peers.get(peerId)
    if (!p) return
    for (const c of p.consumers.values()) {
      c.close()
    }
    for (const pr of p.producers.values()) {
      pr.close()
    }
    p.recvTransport?.close()
    p.sendTransport?.close()
    this.peers.delete(peerId)
    logger.info({ roomId: this.id, peerId }, 'peer left media room')
  }

  getRtpCapabilities(): RtpCapabilities {
    return this.router.rtpCapabilities
  }

  async createWebRtcTransport(
    peerId: string,
    producing: boolean,
    consuming: boolean,
  ): Promise<{
    id: string
    iceParameters: WebRtcTransport['iceParameters']
    iceCandidates: WebRtcTransport['iceCandidates']
    dtlsParameters: WebRtcTransport['dtlsParameters']
  }> {
    const peer = this.peers.get(peerId)
    if (!peer) throw new Error('peer not found')
    if (producing === consuming) {
      throw new Error('createWebRtcTransport: set exactly one of producing or consuming')
    }

    const listenIps = [{ ip: '0.0.0.0' as const, announcedIp: config.announcedIp }]

    const transport = await this.router.createWebRtcTransport({
      listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 1_000_000,
      appData: { producing, consuming },
    })

    if (producing) {
      peer.sendTransport?.close()
      peer.sendTransport = transport
    }
    if (consuming) {
      peer.recvTransport?.close()
      peer.recvTransport = transport
    }

    transport.on('dtlsstatechange', (dtlsState: string) => {
      if (dtlsState === 'closed') transport.close()
    })

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    }
  }

  async connectTransport(peerId: string, transportId: string, dtlsParameters: DtlsParameters): Promise<void> {
    const peer = this.peers.get(peerId)
    if (!peer) throw new Error('peer not found')
    const t =
      peer.sendTransport?.id === transportId
        ? peer.sendTransport
        : peer.recvTransport?.id === transportId
          ? peer.recvTransport
          : undefined
    if (!t) throw new Error('transport not found')
    await t.connect({ dtlsParameters })
  }

  async produce(
    peerId: string,
    transportId: string,
    kind: 'audio' | 'video',
    rtpParameters: RtpParameters,
    appData: Record<string, unknown>,
  ): Promise<{ id: string }> {
    const peer = this.peers.get(peerId)
    if (!peer) throw new Error('peer not found')
    if (peer.sendTransport?.id !== transportId) throw new Error('wrong send transport')

    for (const [pid, prod] of peer.producers) {
      if (prod.kind === kind) {
        prod.close()
        peer.producers.delete(pid)
      }
    }

    const producer = await peer.sendTransport.produce({
      kind,
      rtpParameters,
      appData: { ...appData, peerId },
    })
    peer.producers.set(producer.id, producer)

    producer.on('transportclose', () => {
      peer.producers.delete(producer.id)
    })

    this.broadcastNewProducer(peerId, producer.id, kind)

    return { id: producer.id }
  }

  private broadcastNewProducer(fromPeerId: string, producerId: string, kind: 'audio' | 'video'): void {
    const msg = {
      t: 'newProducer',
      data: { peerId: fromPeerId, producerId, kind },
    }
    for (const [pid, peer] of this.peers) {
      if (pid === fromPeerId) continue
      peer.send(msg)
    }
  }

  findProducerById(producerId: string): { peerId: string; producer: Producer } | undefined {
    for (const [peerId, peer] of this.peers) {
      const pr = peer.producers.get(producerId)
      if (pr) return { peerId, producer: pr }
    }
    return undefined
  }

  listProducerMetaForPeer(exceptPeerId: string): { peerId: string; producerId: string; kind: 'audio' | 'video' }[] {
    const out: { peerId: string; producerId: string; kind: 'audio' | 'video' }[] = []
    for (const [peerId, peer] of this.peers) {
      if (peerId === exceptPeerId) continue
      for (const prod of peer.producers.values()) {
        out.push({ peerId, producerId: prod.id, kind: prod.kind as 'audio' | 'video' })
      }
    }
    return out
  }

  async consume(
    peerId: string,
    transportId: string,
    producerId: string,
    rtpCapabilities: RtpCapabilities,
  ): Promise<{
    id: string
    producerPeerId: string
    kind: 'audio' | 'video'
    rtpParameters: RtpParameters
    producerId: string
  }> {
    const peer = this.peers.get(peerId)
    if (!peer) throw new Error('peer not found')
    if (peer.recvTransport?.id !== transportId) throw new Error('wrong recv transport')

    const found = this.findProducerById(producerId)
    if (!found) throw new Error('producer not found')
    if (found.peerId === peerId) throw new Error('cannot consume own producer')

    if (!this.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error('cannot consume')
    }

    const consumer = await peer.recvTransport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    })
    peer.consumers.set(consumer.id, consumer)

    consumer.on('transportclose', () => {
      peer.consumers.delete(consumer.id)
    })

    return {
      id: consumer.id,
      producerPeerId: found.peerId,
      kind: consumer.kind as 'audio' | 'video',
      rtpParameters: consumer.rtpParameters,
      producerId,
    }
  }

  async resumeConsumer(peerId: string, consumerId: string): Promise<void> {
    const peer = this.peers.get(peerId)
    if (!peer) throw new Error('peer not found')
    const c = peer.consumers.get(consumerId)
    if (!c) throw new Error('consumer not found')
    await c.resume()
  }
}
