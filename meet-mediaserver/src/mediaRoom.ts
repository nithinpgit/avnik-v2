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

  private producerSource(producer: Producer): string {
    const src = (producer.appData as { source?: string } | undefined)?.source
    if (typeof src === 'string' && src.length > 0) return src
    return producer.kind === 'audio' ? 'mic' : 'camera'
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

    const source =
      typeof appData.source === 'string' && appData.source.length > 0
        ? appData.source
        : kind === 'audio'
          ? 'mic'
          : 'camera'

    for (const [, prod] of peer.producers) {
      if (prod.kind === kind && this.producerSource(prod) === source) {
        prod.close()
      }
    }

    const producer = await peer.sendTransport.produce({
      kind,
      rtpParameters,
      appData: { ...appData, source, peerId },
    })
    peer.producers.set(producer.id, producer)

    producer.observer.on('close', () => {
      if (!peer.producers.delete(producer.id)) return
      this.broadcastProducerClosed(peerId, producer.id, kind, source)
    })

    producer.on('transportclose', () => {
      if (peer.producers.delete(producer.id)) {
        this.broadcastProducerClosed(peerId, producer.id, kind, source)
      }
    })

    this.broadcastNewProducer(peerId, producer.id, kind, source)

    return { id: producer.id }
  }

  private broadcastNewProducer(
    fromPeerId: string,
    producerId: string,
    kind: 'audio' | 'video',
    source: string,
  ): void {
    const msg = {
      t: 'newProducer',
      data: { peerId: fromPeerId, producerId, kind, source },
    }
    for (const [pid, peer] of this.peers) {
      if (pid === fromPeerId) continue
      peer.send(msg)
    }
  }

  private broadcastProducerClosed(
    fromPeerId: string,
    producerId: string,
    kind: 'audio' | 'video',
    source: string,
  ): void {
    const msg = {
      t: 'producerClosed',
      data: { peerId: fromPeerId, producerId, kind, source },
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

  listProducerMetaForPeer(
    exceptPeerId: string,
  ): { peerId: string; producerId: string; kind: 'audio' | 'video'; source: string }[] {
    const out: { peerId: string; producerId: string; kind: 'audio' | 'video'; source: string }[] = []
    for (const [peerId, peer] of this.peers) {
      if (peerId === exceptPeerId) continue
      for (const prod of peer.producers.values()) {
        out.push({
          peerId,
          producerId: prod.id,
          kind: prod.kind as 'audio' | 'video',
          source: this.producerSource(prod),
        })
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
    source: string
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
      source: this.producerSource(found.producer),
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
