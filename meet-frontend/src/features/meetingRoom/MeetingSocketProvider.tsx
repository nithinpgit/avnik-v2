import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { store } from '../../app/store'
import {
  selectMeetingDisplayName,
  selectMeetingProfileImage,
  selectMeetingRole,
  selectMeetingRoomId,
  selectMeetingUserId,
} from '../meetingSession/meetingSessionSlice'
import { selectPreMeetingEntryCompleted } from '../preMeeting/preMeetingSlice'
import { applyRoomSyncBulk, applyRoomSyncPatch, resetRoomSync } from '../roomSync/roomSyncSlice'
import {
  applyRoomSnapshot,
  removeParticipant,
  upsertParticipant,
} from '../videoConference/videoConferenceSlice'
import { resolveMeetingSocketUrl } from './socketUrl'

export type MeetingSocketContextValue = {
  socket: Socket | null
  /** Emit a persisted room document update (same contract for whiteboard and future channels). */
  emitRoomSync: (channel: string, payload: unknown) => void
}

const MeetingSocketContext = createContext<MeetingSocketContextValue | null>(null)

export function useMeetingSocket(): MeetingSocketContextValue {
  const ctx = useContext(MeetingSocketContext)
  if (!ctx) {
    throw new Error('useMeetingSocket must be used within MeetingSocketProvider')
  }
  return ctx
}

/**
 * Owns the Socket.IO client for the meeting: peers, and centralized room_sync / room_sync_bulk.
 */
export function MeetingSocketProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const entryCompleted = useAppSelector(selectPreMeetingEntryCompleted)
  const roomId = useAppSelector(selectMeetingRoomId)
  const userId = useAppSelector(selectMeetingUserId)
  const displayName = useAppSelector(selectMeetingDisplayName)
  const role = useAppSelector(selectMeetingRole)
  const profileImage = useAppSelector(selectMeetingProfileImage)

  const [socket, setSocket] = useState<Socket | null>(null)
  const socketRef = useRef<Socket | null>(null)

  const emitRoomSync = useCallback((channel: string, payload: unknown) => {
    const s = socketRef.current
    const rid = store.getState().meetingSession.roomId
    if (!s?.connected || !rid) return
    s.emit('room_sync', { roomId: rid, channel, payload })
  }, [])

  useEffect(() => {
    if (!entryCompleted || !roomId || !userId) {
      return
    }

    const baseUrl = resolveMeetingSocketUrl()
    const socketOptions = {
      path: '/socket.io',
      transports: ['websocket', 'polling'] as ('websocket' | 'polling')[],
      autoConnect: true,
      withCredentials: true,
    }
    const client = baseUrl ? io(baseUrl, socketOptions) : io(socketOptions)
    socketRef.current = client
    setSocket(client)

    const onSnapshot = (payload: { roomId: string; peers: PeerDto[] }) => {
      dispatch(applyRoomSnapshot({ peers: payload.peers.map((p) => mapPeer(p)) }))
    }

    const onPeerJoined = (payload: { peer: PeerDto }) => {
      dispatch(upsertParticipant(mapPeer(payload.peer)))
    }

    const onPeerLeft = (payload: { userId: string }) => {
      dispatch(removeParticipant(payload.userId))
    }

    const onJoinError = (payload: { message?: string }) => {
      console.error('join_error', payload)
    }

    const onRoomSyncBulk = (payload: { states: Record<string, unknown> }) => {
      dispatch(applyRoomSyncBulk({ states: payload.states ?? {} }))
    }

    const onRoomSync = (payload: { channel: string; payload: unknown }) => {
      dispatch(applyRoomSyncPatch({ channel: payload.channel, payload: payload.payload }))
    }

    const onConnect = () => {
      client.emit('join_room', {
        roomId,
        userId,
        name: displayName,
        role,
        profileImage: profileImage ?? undefined,
      })
    }

    client.on('connect', onConnect)
    client.on('room_snapshot', onSnapshot)
    client.on('peer_joined', onPeerJoined)
    client.on('peer_left', onPeerLeft)
    client.on('join_error', onJoinError)
    client.on('room_sync_bulk', onRoomSyncBulk)
    client.on('room_sync', onRoomSync)

    return () => {
      client.off('connect', onConnect)
      client.off('room_snapshot', onSnapshot)
      client.off('peer_joined', onPeerJoined)
      client.off('peer_left', onPeerLeft)
      client.off('join_error', onJoinError)
      client.off('room_sync_bulk', onRoomSyncBulk)
      client.off('room_sync', onRoomSync)
      client.disconnect()
      socketRef.current = null
      setSocket(null)
      dispatch(resetRoomSync())
    }
  }, [entryCompleted, roomId, userId, displayName, role, profileImage, dispatch])

  const value = useMemo<MeetingSocketContextValue>(
    () => ({ socket, emitRoomSync }),
    [socket, emitRoomSync],
  )

  return <MeetingSocketContext.Provider value={value}>{children}</MeetingSocketContext.Provider>
}

type PeerDto = {
  userId: string
  name: string
  role: 'host' | 'participant'
  profileImage: string | null
}

function mapPeer(p: PeerDto) {
  return {
    id: p.userId,
    name: p.name,
    role: p.role,
    profileImage: p.profileImage,
  }
}
