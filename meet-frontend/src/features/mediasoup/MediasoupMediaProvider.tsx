import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Device } from 'mediasoup-client'
import type {
  Consumer,
  DtlsParameters,
  IceCandidate,
  IceParameters,
  Producer,
  RtpParameters,
  Transport,
} from 'mediasoup-client/types'
import { useAppSelector } from '../../app/hooks'
import { store } from '../../app/store'
import { useMeetingSocket } from '../meetingRoom/MeetingSocketProvider'
import {
  selectMeetingDisplayName,
  selectMeetingRoomId,
  selectMeetingUserId,
} from '../meetingSession/meetingSessionSlice'
import { selectPreMeetingLastMediaMode } from '../preMeeting/preMeetingSlice'
import { selectLocalStream, selectParticipants } from '../videoConference/videoConferenceSlice'
import { MediaSignaling } from './MediaSignaling'
import { resolveMediaWsBaseUrl } from './resolveMediaWsUrl'

export type MediasoupMediaContextValue = {
  /** Remote A/V per Socket.IO peer id (SFU). */
  remoteStreams: Readonly<Record<string, MediaStream>>
  sfuStatus: 'idle' | 'connecting' | 'connected' | 'error'
  sfuError: string | null
}

const MediasoupMediaContext = createContext<MediasoupMediaContextValue | null>(null)

export function useMediasoupMedia(): MediasoupMediaContextValue {
  const ctx = useContext(MediasoupMediaContext)
  if (!ctx) {
    throw new Error('useMediasoupMedia must be used within MediasoupMediaProvider')
  }
  return ctx
}

function liveTrack(stream: MediaStream | null, kind: 'audio' | 'video'): MediaStreamTrack | undefined {
  return stream?.getTracks().find((t) => t.kind === kind && t.readyState === 'live')
}

function mergeRemoteTrack(
  prev: Record<string, MediaStream>,
  producerPeerId: string,
  track: MediaStreamTrack,
): Record<string, MediaStream> {
  const existing = prev[producerPeerId]
  const next = { ...prev }
  if (existing) {
    for (const t of existing.getTracks()) {
      if (t.kind === track.kind && t.id !== track.id) {
        existing.removeTrack(t)
        t.stop()
      }
    }
    if (!existing.getTracks().some((t) => t.id === track.id)) {
      existing.addTrack(track)
    }
    next[producerPeerId] = existing
  } else {
    next[producerPeerId] = new MediaStream([track])
  }
  return next
}

export function MediasoupMediaProvider({ children }: { children: ReactNode }) {
  const { presenceJoined } = useMeetingSocket()
  const roomId = useAppSelector(selectMeetingRoomId)
  const userId = useAppSelector(selectMeetingUserId)
  const displayName = useAppSelector(selectMeetingDisplayName)
  const localStream = useAppSelector(selectLocalStream)
  const lastMediaMode = useAppSelector(selectPreMeetingLastMediaMode)
  const participants = useAppSelector(selectParticipants)

  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const [sfuStatus, setSfuStatus] = useState<MediasoupMediaContextValue['sfuStatus']>('idle')
  const [sfuError, setSfuError] = useState<string | null>(null)

  const teardownRef = useRef<(() => void) | null>(null)

  const upsertRemote = useCallback((producerPeerId: string, track: MediaStreamTrack) => {
    setRemoteStreams((prev) => mergeRemoteTrack(prev, producerPeerId, track))
  }, [])

  useEffect(() => {
    const ids = new Set(participants.map((p) => p.id))
    setRemoteStreams((prev) => {
      let changed = false
      const next = { ...prev }
      for (const id of Object.keys(next)) {
        if (!ids.has(id)) {
          for (const t of next[id].getTracks()) {
            t.stop()
          }
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [participants])

  useEffect(() => {
    if (!presenceJoined || !roomId || !userId) {
      return
    }

    const wantsVideoPub = lastMediaMode === 'both' || lastMediaMode === 'webcam_only'
    const wantsAudioPub = lastMediaMode === 'both' || lastMediaMode === 'mic_only'
    const canPublishVideo = !wantsVideoPub || Boolean(liveTrack(localStream, 'video'))
    const canPublishAudio = !wantsAudioPub || Boolean(liveTrack(localStream, 'audio'))

    if (wantsVideoPub || wantsAudioPub) {
      if (!canPublishVideo || !canPublishAudio) {
        return
      }
    }

    let cancelled = false
    const consumers = new Map<string, Consumer>()
    const producers: { audio?: Producer; video?: Producer } = {}
    let sendTransport: Transport | null = null
    let recvTransport: Transport | null = null
    let sig: MediaSignaling | null = null
    let ws: WebSocket | null = null
    let unlistenNewProducer: (() => void) | null = null

    const teardown = () => {
      cancelled = true
      unlistenNewProducer?.()
      unlistenNewProducer = null
      for (const c of consumers.values()) {
        try {
          c.close()
        } catch {
          /* ignore */
        }
      }
      consumers.clear()
      try {
        producers.audio?.close()
      } catch {
        /* ignore */
      }
      try {
        producers.video?.close()
      } catch {
        /* ignore */
      }
      try {
        sendTransport?.close()
      } catch {
        /* ignore */
      }
      try {
        recvTransport?.close()
      } catch {
        /* ignore */
      }
      sendTransport = null
      recvTransport = null
      sig?.dispose()
      sig = null
      try {
        ws?.close()
      } catch {
        /* ignore */
      }
      ws = null
      setRemoteStreams({})
    }

    teardownRef.current?.()
    teardownRef.current = teardown

    const consumedProducerIds = new Set<string>()

    async function consumeProducer(
      device: Device,
      recvT: Transport,
      signaling: MediaSignaling,
      producerId: string,
    ): Promise<void> {
      if (cancelled) return
      if (consumedProducerIds.has(producerId)) return
      const data = (await signaling.request('consume', {
        transportId: recvT.id,
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      })) as {
        id: string
        producerPeerId: string
        kind: 'audio' | 'video'
        rtpParameters: unknown
        producerId: string
      }
      if (cancelled) return
      const consumer = await recvT.consume({
        id: data.id,
        producerId: data.producerId,
        kind: data.kind,
        rtpParameters: data.rtpParameters as RtpParameters,
      })
      consumers.set(consumer.id, consumer)
      await signaling.request('resumeConsumer', { consumerId: consumer.id })
      if (cancelled) return
      consumedProducerIds.add(producerId)
      upsertRemote(data.producerPeerId, consumer.track)
      consumer.on('trackended', () => {
        consumers.delete(consumer.id)
      })
    }

    async function run(): Promise<void> {
      setSfuStatus('connecting')
      setSfuError(null)
      try {
        const tokenRes = await fetch('/api/media/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            roomId,
            peerId: userId,
            name: displayName || undefined,
          }),
        })
        if (!tokenRes.ok) {
          throw new Error(`media token ${tokenRes.status}`)
        }
        const { accessToken } = (await tokenRes.json()) as { accessToken?: string }
        if (!accessToken) throw new Error('missing accessToken')

        const base = resolveMediaWsBaseUrl()
        ws = new WebSocket(`${base}/ws?token=${encodeURIComponent(accessToken)}`)
        await MediaSignaling.waitReady(ws)
        if (cancelled) return

        sig = new MediaSignaling(ws)
        const signaling = sig

        const caps = (await signaling.request('getRouterRtpCapabilities')) as Parameters<
          Device['load']
        >[0]['routerRtpCapabilities']
        const device = new Device()
        await device.load({ routerRtpCapabilities: caps })
        if (cancelled) return

        const sendParams = (await signaling.request('createWebRtcTransport', {
          producing: true,
          consuming: false,
        })) as {
          id: string
          iceParameters: unknown
          iceCandidates: unknown
          dtlsParameters: unknown
        }

        sendTransport = device.createSendTransport({
          id: sendParams.id,
          iceParameters: sendParams.iceParameters as IceParameters,
          iceCandidates: sendParams.iceCandidates as IceCandidate[],
          dtlsParameters: sendParams.dtlsParameters as DtlsParameters,
        })

        sendTransport.on(
          'connect',
          (
            { dtlsParameters }: { dtlsParameters: DtlsParameters },
            callback: () => void,
            errback: (e: Error) => void,
          ) => {
            void signaling
              .request('connectTransport', { transportId: sendTransport!.id, dtlsParameters })
              .then(() => callback())
              .catch(errback)
          },
        )

        sendTransport.on(
          'produce',
          (
            {
              kind,
              rtpParameters,
              appData,
            }: { kind: 'audio' | 'video'; rtpParameters: RtpParameters; appData?: Record<string, unknown> },
            callback: (o: { id: string }) => void,
            errback: (e: Error) => void,
          ) => {
            void signaling
              .request('produce', {
                transportId: sendTransport!.id,
                kind,
                rtpParameters,
                appData,
              })
              .then((created) => callback({ id: (created as { id: string }).id }))
              .catch(errback)
          },
        )

        const recvParams = (await signaling.request('createWebRtcTransport', {
          producing: false,
          consuming: true,
        })) as {
          id: string
          iceParameters: unknown
          iceCandidates: unknown
          dtlsParameters: unknown
        }

        recvTransport = device.createRecvTransport({
          id: recvParams.id,
          iceParameters: recvParams.iceParameters as IceParameters,
          iceCandidates: recvParams.iceCandidates as IceCandidate[],
          dtlsParameters: recvParams.dtlsParameters as DtlsParameters,
        })

        const recvT = recvTransport

        recvT.on(
          'connect',
          (
            { dtlsParameters }: { dtlsParameters: DtlsParameters },
            callback: () => void,
            errback: (e: Error) => void,
          ) => {
            void signaling
              .request('connectTransport', { transportId: recvT.id, dtlsParameters })
              .then(() => callback())
              .catch(errback)
          },
        )

        const stream = store.getState().videoConference.localStream
        const mode = store.getState().preMeeting.lastMediaMode

        const pubVideo = mode === 'both' || mode === 'webcam_only'
        const pubAudio = mode === 'both' || mode === 'mic_only'

        if (pubVideo) {
          const vt = liveTrack(stream, 'video')
          if (vt) {
            const p = await sendTransport.produce({ track: vt })
            producers.video = p
          }
        }
        if (pubAudio) {
          const at = liveTrack(stream, 'audio')
          if (at) {
            const p = await sendTransport.produce({ track: at })
            producers.audio = p
          }
        }

        const list = (await signaling.request('listProducers')) as {
          producers: { peerId: string; producerId: string; kind: string }[]
        }
        for (const row of list.producers ?? []) {
          if (cancelled) return
          if (row.peerId === userId) continue
          await consumeProducer(device, recvT, signaling, row.producerId)
        }

        unlistenNewProducer = signaling.onPush((msg) => {
          if (msg.t !== 'newProducer') return
          const d = msg.data as { peerId?: string; producerId?: string }
          if (!d.producerId || d.peerId === userId) return
          void consumeProducer(device, recvT, signaling, d.producerId)
        })

        if (!cancelled) {
          setSfuStatus('connected')
        }
      } catch (e) {
        if (!cancelled) {
          setSfuStatus('error')
          setSfuError(e instanceof Error ? e.message : String(e))
        }
        teardown()
      }
    }

    void run()

    return () => {
      teardownRef.current?.()
      teardownRef.current = null
      setSfuStatus('idle')
      setSfuError(null)
    }
  }, [
    presenceJoined,
    roomId,
    userId,
    displayName,
    localStream,
    lastMediaMode,
    upsertRemote,
  ])

  const value = useMemo<MediasoupMediaContextValue>(
    () => ({
      remoteStreams,
      sfuStatus,
      sfuError,
    }),
    [remoteStreams, sfuStatus, sfuError],
  )

  return <MediasoupMediaContext.Provider value={value}>{children}</MediasoupMediaContext.Provider>
}
