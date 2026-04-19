import { Peer, type MeetingRole, type PeerProps, type PeerPublicView } from './peer'

export type RoomSnapshot = {
  roomId: string
  peers: PeerPublicView[]
}

/**
 * One meeting room and its peers (in-memory).
 */
export class Room {
  readonly peersByUserId = new Map<string, Peer>()
  hostUserId: string | null = null

  constructor(readonly id: string) {}

  /**
   * Registers or refreshes a peer. Enforces a single host per room.
   */
  upsertPeer(input: {
    userId: string
    name: string
    requestedRole: MeetingRole
    profileImage?: string | null
    socketId: string
  }): { peer: Peer; roleAssigned: MeetingRole } {
    let role: MeetingRole = input.requestedRole

    if (role === 'host') {
      if (this.hostUserId !== null && this.hostUserId !== input.userId) {
        role = 'participant'
      } else {
        this.hostUserId = input.userId
      }
    } else if (this.hostUserId === input.userId) {
      this.hostUserId = null
    }

    const props: PeerProps = {
      userId: input.userId,
      name: input.name,
      role,
      profileImage: input.profileImage ?? null,
      socketId: input.socketId,
    }
    const peer = new Peer(props)
    this.peersByUserId.set(input.userId, peer)
    return { peer, roleAssigned: role }
  }

  removeBySocketId(socketId: string): Peer | undefined {
    for (const [userId, peer] of this.peersByUserId) {
      if (peer.socketId === socketId) {
        this.peersByUserId.delete(userId)
        if (this.hostUserId === userId) {
          this.hostUserId = null
        }
        return peer
      }
    }
    return undefined
  }

  removeByUserId(userId: string): Peer | undefined {
    const peer = this.peersByUserId.get(userId)
    if (!peer) return undefined
    this.peersByUserId.delete(userId)
    if (this.hostUserId === userId) {
      this.hostUserId = null
    }
    return peer
  }

  snapshot(): RoomSnapshot {
    return {
      roomId: this.id,
      peers: [...this.peersByUserId.values()].map((p) => p.toPublic()),
    }
  }
}
