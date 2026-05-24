export const PARTICIPANT_MODERATION_CHANNEL = 'participant_moderation'

export type UserModerationState = {
  micAllowed: boolean
  camAllowed: boolean
  isPresenter: boolean
}

export type ParticipantModerationPayload = {
  users: Record<string, UserModerationState>
}

export const DEFAULT_USER_MODERATION: UserModerationState = {
  micAllowed: true,
  camAllowed: true,
  isPresenter: false,
}

export type ParticipantControlAction =
  | 'mute_mic'
  | 'unmute_mic'
  | 'disable_cam'
  | 'enable_cam'
  | 'make_presenter'
  | 'revoke_presenter'
  | 'kick'

export function parseModerationPayload(raw: unknown): ParticipantModerationPayload {
  if (!raw || typeof raw !== 'object') {
    return { users: {} }
  }
  const o = raw as Record<string, unknown>
  const usersRaw = o.users
  if (!usersRaw || typeof usersRaw !== 'object') {
    return { users: {} }
  }
  const users: Record<string, UserModerationState> = {}
  for (const [userId, value] of Object.entries(usersRaw)) {
    if (!value || typeof value !== 'object') continue
    const v = value as Record<string, unknown>
    users[userId] = {
      micAllowed: v.micAllowed !== false,
      camAllowed: v.camAllowed !== false,
      isPresenter: v.isPresenter === true,
    }
  }
  return { users }
}

export function moderationForUser(
  payload: ParticipantModerationPayload,
  userId: string,
): UserModerationState {
  return payload.users[userId] ?? DEFAULT_USER_MODERATION
}
