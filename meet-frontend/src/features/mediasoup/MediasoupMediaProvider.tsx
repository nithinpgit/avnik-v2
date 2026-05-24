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
import { selectUserModeration } from '../participantControls/participantModerationSlice'
import { SCREEN_SHARE_SYNC_CHANNEL } from '../screenShare/screenShareSync'
import { selectScreenShareSync } from '../screenShare/selectScreenShareSync'
import {
  selectMeetingDisplayName,
  selectMeetingRoomId,
  selectMeetingUserId,
} from '../meetingSession/meetingSessionSlice'
import { selectIsMeetingLive, selectSfuSessionKey } from '../meeting/meetingLifecycleSlice'
import { liveMediaTrack } from '../preMeeting/mediaDeviceUtils'
import { selectPreMeetingLastMediaMode } from '../preMeeting/preMeetingSlice'
import {
  selectLocalStream,
  selectParticipants,
} from '../videoConference/videoConferenceSlice'
import { MediaSignaling } from './MediaSignaling'
import { resolveMediaWsBaseUrl } from './resolveMediaWsUrl'

export type MediaTrackSource = 'camera' | 'mic' | 'screen' | 'screen-audio'

type LocalProducers = {
  audio?: Producer
  video?: Producer
  screenVideo?: Producer
  screenAudio?: Producer
}

export type MediasoupMediaContextValue = {
  /** Remote camera/mic per Socket.IO peer id (SFU). */
  remoteStreams: Readonly<Record<string, MediaStream>>
  /** Remote screen share (video + optional tab audio) per peer id. */
  remoteScreenStreams: Readonly<Record<string, MediaStream>>
  /** Peer currently presenting screen share (null = hide remote stage). */
  remoteScreenPresenterId: string | null
  localScreenStream: MediaStream | null
  isScreenSharing: boolean
  sfuStatus: 'idle' | 'connecting' | 'connected' | 'error'
  sfuError: string | null
  /** Swap camera/mic tracks on active producers without reconnecting the SFU session. */
  syncLocalMedia: (stream: MediaStream | null) => Promise<void>
  startScreenShare: () => Promise<void>
  stopScreenShare: () => void
}

const MediasoupMediaContext = createContext<MediasoupMediaContextValue | null>(null)

export function useMediasoupMedia(): MediasoupMediaContextValue {
  const ctx = useContext(MediasoupMediaContext)
  if (!ctx) {
    throw new Error('useMediasoupMedia must be used within MediasoupMediaProvider')
  }
  return ctx
}

const liveTrack = liveMediaTrack

function isScreenSource(source: string): boolean {
  return source === 'screen' || source === 'screen-audio'
}

function hasLiveScreenVideo(stream: MediaStream | undefined): boolean {
  return Boolean(
    stream?.getVideoTracks().some((t) => t.kind === 'video' && t.readyState === 'live'),
  )
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
  const { presenceJoined, emitRoomSync, socket } = useMeetingSocket()
  const screenShareSync = useAppSelector(selectScreenShareSync)
  const meetingLive = useAppSelector(selectIsMeetingLive)
  const sfuSessionKey = useAppSelector(selectSfuSessionKey)
  const localStream = useAppSelector(selectLocalStream)
  const roomId = useAppSelector(selectMeetingRoomId)
  const userId = useAppSelector(selectMeetingUserId)
  const displayName = useAppSelector(selectMeetingDisplayName)
  const lastMediaMode = useAppSelector(selectPreMeetingLastMediaMode)
  const participants = useAppSelector(selectParticipants)
  const selfModeration = useAppSelector(selectUserModeration(userId ?? ''))

  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({})
  const [remoteScreenPresenterId, setRemoteScreenPresenterId] = useState<string | null>(null)
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [sfuStatus, setSfuStatus] = useState<MediasoupMediaContextValue['sfuStatus']>('idle')
  const [sfuError, setSfuError] = useState<string | null>(null)

  const teardownRef = useRef<(() => void) | null>(null)
  const producersRef = useRef<LocalProducers>({})
  const sendTransportRef = useRef<Transport | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const stopScreenShareRef = useRef<() => void>(() => undefined)

  const broadcastScreenShare = useCallback(
    (active: boolean) => {
      if (!userId) return
      emitRoomSync(SCREEN_SHARE_SYNC_CHANNEL, {
        active,
        presenterId: active ? userId : null,
        presenterName: active ? displayName || undefined : undefined,
      })
    },
    [emitRoomSync, userId, displayName],
  )

  const syncLocalMedia = useCallback(async (stream: MediaStream | null) => {
    const producers = producersRef.current
    const sendTransport = sendTransportRef.current
    const mode = store.getState().preMeeting.lastMediaMode ?? 'both'
    const pubVideo = mode === 'both' || mode === 'webcam_only'
    const pubAudio = mode === 'both' || mode === 'mic_only'

    if (producers.video) {
      const vt = pubVideo ? liveTrack(stream, 'video') : undefined
      if (vt) {
        await producers.video.replaceTrack({ track: vt })
      } else {
        producers.video.pause()
      }
    } else if (pubVideo && sendTransport) {
      const vt = liveTrack(stream, 'video')
      if (vt) {
        producersRef.current.video = await sendTransport.produce({
          track: vt,
          appData: { source: 'camera' },
        })
      }
    }

    if (producers.audio) {
      const at = pubAudio ? liveTrack(stream, 'audio') : undefined
      if (at) {
        await producers.audio.replaceTrack({ track: at })
      } else {
        producers.audio.pause()
      }
    } else if (pubAudio && sendTransport) {
      const at = liveTrack(stream, 'audio')
      if (at) {
        producersRef.current.audio = await sendTransport.produce({
          track: at,
          appData: { source: 'mic' },
        })
      }
    }
  }, [])

  const applyHostMediaPolicy = useCallback(
    async (policy: { micAllowed?: boolean; camAllowed?: boolean }) => {
      const producers = producersRef.current
      if (policy.micAllowed === false) {
        try {
          await producers.audio?.pause()
        } catch {
          /* ignore */
        }
      } else if (policy.micAllowed === true) {
        try {
          await producers.audio?.resume()
        } catch {
          /* ignore */
        }
      }
      if (policy.camAllowed === false) {
        try {
          await producers.video?.pause()
        } catch {
          /* ignore */
        }
      } else if (policy.camAllowed === true) {
        try {
          await producers.video?.resume()
        } catch {
          /* ignore */
        }
      }
    },
    [],
  )

  const stopScreenShare = useCallback(() => {
    broadcastScreenShare(false)
    const producers = producersRef.current
    try {
      producers.screenVideo?.close()
    } catch {
      /* ignore */
    }
    try {
      producers.screenAudio?.close()
    } catch {
      /* ignore */
    }
    delete producers.screenVideo
    delete producers.screenAudio
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    setLocalScreenStream(null)
    setIsScreenSharing(false)
    setRemoteScreenPresenterId(null)
  }, [broadcastScreenShare])

  stopScreenShareRef.current = stopScreenShare

  useEffect(() => {
    if (sfuStatus !== 'connected') return
    void applyHostMediaPolicy({
      micAllowed: selfModeration.micAllowed,
      camAllowed: selfModeration.camAllowed,
    })
  }, [selfModeration.micAllowed, selfModeration.camAllowed, sfuStatus, applyHostMediaPolicy])

  useEffect(() => {
    if (!socket) return
    const onPolicy = (payload: { micAllowed?: boolean; camAllowed?: boolean }) => {
      void applyHostMediaPolicy(payload)
    }
    socket.on('participant_media_policy', onPolicy)
    return () => {
      socket.off('participant_media_policy', onPolicy)
    }
  }, [socket, applyHostMediaPolicy])

  const startScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      stopScreenShare()
      return
    }
    const sendTransport = sendTransportRef.current
    if (!sendTransport || sfuStatus !== 'connected') {
      throw new Error('Connect to the meeting before sharing your screen')
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    })
    const videoTrack = stream.getVideoTracks()[0]
    if (!videoTrack) {
      stream.getTracks().forEach((t) => t.stop())
      throw new Error('No screen video track')
    }
    screenStreamRef.current = stream
    videoTrack.onended = () => stopScreenShareRef.current()

    const producers = producersRef.current
    producers.screenVideo = await sendTransport.produce({
      track: videoTrack,
      appData: { source: 'screen' },
    })

    const audioTrack = stream.getAudioTracks()[0]
    if (audioTrack) {
      producers.screenAudio = await sendTransport.produce({
        track: audioTrack,
        appData: { source: 'screen-audio' },
      })
    }

    const previewTracks = [videoTrack, ...(audioTrack ? [audioTrack] : [])]
    setLocalScreenStream(new MediaStream(previewTracks))
    setIsScreenSharing(true)
    broadcastScreenShare(true)
  }, [isScreenSharing, sfuStatus, stopScreenShare, broadcastScreenShare])

  const upsertRemote = useCallback((producerPeerId: string, track: MediaStreamTrack) => {
    setRemoteStreams((prev) => mergeRemoteTrack(prev, producerPeerId, track))
  }, [])

  const clearRemoteScreenShare = useCallback((peerId: string) => {
    setRemoteScreenPresenterId((prev) => (prev === peerId ? null : prev))
    setRemoteScreenStreams((prev) => {
      const stream = prev[peerId]
      if (!stream) return prev
      const next = { ...prev }
      for (const t of stream.getTracks()) {
        t.stop()
      }
      delete next[peerId]
      return next
    })
  }, [])

  const upsertRemoteScreen = useCallback(
    (producerPeerId: string, track: MediaStreamTrack, source: string) => {
      if (source === 'screen') {
        setRemoteScreenPresenterId(producerPeerId)
      }
      setRemoteScreenStreams((prev) => mergeRemoteTrack(prev, producerPeerId, track))
    },
    [],
  )

  useEffect(() => {
    if (screenShareSync?.active) return
    setRemoteScreenPresenterId(null)
    setRemoteScreenStreams((prev) => {
      if (Object.keys(prev).length === 0) return prev
      const next = { ...prev }
      for (const stream of Object.values(next)) {
        for (const t of stream.getTracks()) {
          t.stop()
        }
      }
      return {}
    })
  }, [screenShareSync?.active, screenShareSync?.presenterId])

  useEffect(() => {
    const ids = new Set(participants.map((p) => p.id))
    const prune = (prev: Record<string, MediaStream>) => {
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
    }
    setRemoteStreams(prune)
    setRemoteScreenStreams(prune)
  }, [participants])

  useEffect(() => {
    if (!presenceJoined || !meetingLive || !roomId || !userId) {
      return
    }

    const mode = lastMediaMode ?? 'both'
    const wantsVideoPub = mode === 'both' || mode === 'webcam_only'
    const wantsAudioPub = mode === 'both' || mode === 'mic_only'
    const canPublishVideo = !wantsVideoPub || Boolean(liveTrack(localStream, 'video'))
    const canPublishAudio = !wantsAudioPub || Boolean(liveTrack(localStream, 'audio'))

    if (wantsVideoPub || wantsAudioPub) {
      if (!canPublishVideo || !canPublishAudio) {
        return
      }
    }

    let cancelled = false
    const consumers = new Map<string, Consumer>()
    const producers: LocalProducers = {}
    let sendTransport: Transport | null = null
    let recvTransport: Transport | null = null
    let sig: MediaSignaling | null = null
    let ws: WebSocket | null = null
    let unlistenSignalingPush: (() => void) | null = null

    const dropRemoteScreenPeer = (peerId: string) => {
      clearRemoteScreenShare(peerId)
    }

    const teardown = () => {
      cancelled = true
      unlistenSignalingPush?.()
      unlistenSignalingPush = null
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
        producers.screenVideo?.close()
      } catch {
        /* ignore */
      }
      try {
        producers.screenAudio?.close()
      } catch {
        /* ignore */
      }
      stopScreenShareRef.current()
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
      sendTransportRef.current = null
      producersRef.current = {}
      sig?.dispose()
      sig = null
      try {
        ws?.close()
      } catch {
        /* ignore */
      }
      ws = null
      setRemoteStreams({})
      setRemoteScreenStreams({})
      setRemoteScreenPresenterId(null)
    }

    teardownRef.current?.()
    teardownRef.current = teardown

    const consumedProducerIds = new Set<string>()

    const releaseProducer = (
      producerId: string,
      producerPeerId: string,
      source: string,
      track?: MediaStreamTrack,
    ) => {
      for (const [consumerId, consumer] of consumers) {
        if (consumer.producerId !== producerId) continue
        try {
          consumer.close()
        } catch {
          /* ignore */
        }
        consumers.delete(consumerId)
      }
      consumedProducerIds.delete(producerId)

      if (!isScreenSource(source)) return

      if (source === 'screen') {
        dropRemoteScreenPeer(producerPeerId)
        return
      }

      if (track) {
        setRemoteScreenStreams((prev) => {
          const existing = prev[producerPeerId]
          if (!existing) return prev
          const next = { ...prev }
          if (existing.getTracks().includes(track)) {
            existing.removeTrack(track)
            track.stop()
          }
          return next
        })
      }
    }

    async function consumeProducer(
      device: Device,
      recvT: Transport,
      signaling: MediaSignaling,
      producerId: string,
      sourceHint?: string,
    ): Promise<void> {
      if (cancelled) return
      if (consumedProducerIds.has(producerId)) return
      let data: {
        id: string
        producerPeerId: string
        kind: 'audio' | 'video'
        rtpParameters: unknown
        producerId: string
        source?: string
      }
      try {
        data = (await signaling.request('consume', {
        transportId: recvT.id,
        producerId,
          rtpCapabilities: device.rtpCapabilities,
        })) as typeof data
      } catch {
        return
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
      const source =
        data.source ?? sourceHint ?? (data.kind === 'audio' ? 'mic' : 'camera')
      if (isScreenSource(source)) {
        upsertRemoteScreen(data.producerPeerId, consumer.track, source)
        if (source === 'screen') {
          consumer.track.addEventListener('ended', () => {
            dropRemoteScreenPeer(data.producerPeerId)
          })
        }
      } else {
        upsertRemote(data.producerPeerId, consumer.track)
      }

      const release = () => {
        releaseProducer(producerId, data.producerPeerId, source, consumer.track)
      }
      consumer.on('trackended', release)
      consumer.on('producerclose', release)
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
        sendTransportRef.current = sendTransport

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
        const publishMode = store.getState().preMeeting.lastMediaMode ?? 'both'

        const pubVideo = publishMode === 'both' || publishMode === 'webcam_only'
        const pubAudio = publishMode === 'both' || publishMode === 'mic_only'

        if (pubVideo) {
          const vt = liveTrack(stream, 'video')
          if (vt) {
            const p = await sendTransport.produce({ track: vt, appData: { source: 'camera' } })
            producers.video = p
          }
        }
        if (pubAudio) {
          const at = liveTrack(stream, 'audio')
          if (at) {
            const p = await sendTransport.produce({ track: at, appData: { source: 'mic' } })
            producers.audio = p
          }
        }
        producersRef.current = producers

        const mod = selectUserModeration(userId)(store.getState())
        if (!mod.micAllowed) {
          try {
            await producers.audio?.pause()
          } catch {
            /* ignore */
          }
        }
        if (!mod.camAllowed) {
          try {
            await producers.video?.pause()
          } catch {
            /* ignore */
          }
        }

        const list = (await signaling.request('listProducers')) as {
          producers: { peerId: string; producerId: string; kind: string; source?: string }[]
        }
        for (const row of list.producers ?? []) {
          if (cancelled) return
          if (row.peerId === userId) continue
          if (isScreenSource(row.source ?? '') && row.kind === 'audio') {
            const hasScreenVideo = (list.producers ?? []).some(
              (p) => p.peerId === row.peerId && p.source === 'screen',
            )
            if (!hasScreenVideo) continue
          }
          await consumeProducer(device, recvT, signaling, row.producerId, row.source)
        }

        unlistenSignalingPush = signaling.onPush((msg) => {
          if (msg.t === 'newProducer') {
            const d = msg.data as { peerId?: string; producerId?: string; source?: string }
            if (!d.producerId || d.peerId === userId) return
            void consumeProducer(device, recvT, signaling, d.producerId, d.source)
            return
          }
          if (msg.t === 'producerClosed') {
            const d = msg.data as {
              peerId?: string
              producerId?: string
              source?: string
            }
            if (!d.producerId || !d.peerId) return
            releaseProducer(d.producerId, d.peerId, d.source ?? 'camera')
          }
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
    meetingLive,
    sfuSessionKey,
    localStream,
    roomId,
    userId,
    displayName,
    lastMediaMode,
    upsertRemote,
    upsertRemoteScreen,
    clearRemoteScreenShare,
  ])

  const value = useMemo<MediasoupMediaContextValue>(
    () => ({
      remoteStreams,
      remoteScreenStreams,
      remoteScreenPresenterId,
      localScreenStream,
      isScreenSharing,
      sfuStatus,
      sfuError,
      syncLocalMedia,
      startScreenShare,
      stopScreenShare,
    }),
    [
      remoteStreams,
      remoteScreenStreams,
      remoteScreenPresenterId,
      localScreenStream,
      isScreenSharing,
      sfuStatus,
      sfuError,
      syncLocalMedia,
      startScreenShare,
      stopScreenShare,
    ],
  )

  return <MediasoupMediaContext.Provider value={value}>{children}</MediasoupMediaContext.Provider>
}
