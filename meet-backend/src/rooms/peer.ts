export type MeetingRole = 'host' | 'participant'

export type PeerPublicView = {
  userId: string
  name: string
  role: MeetingRole
  profileImage: string | null
}

export type PeerProps = {
  userId: string
  name: string
  role: MeetingRole
  profileImage?: string | null
  socketId: string
}

/**
 * Domain peer for a meeting room (transport-agnostic).
 */
export class Peer {
  constructor(private data: PeerProps) {}

  get userId(): string {
    return this.data.userId
  }

  get socketId(): string {
    return this.data.socketId
  }

  get role(): MeetingRole {
    return this.data.role
  }

  setSocketId(socketId: string): void {
    this.data.socketId = socketId
  }

  setRole(role: MeetingRole): void {
    this.data.role = role
  }

  toPublic(): PeerPublicView {
    return {
      userId: this.data.userId,
      name: this.data.name,
      role: this.data.role,
      profileImage: this.data.profileImage ?? null,
    }
  }
}
