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

export function applyModerationAction(
  current: ParticipantModerationPayload,
  targetUserId: string,
  action: ParticipantControlAction,
): ParticipantModerationPayload {
  const users = { ...current.users }
  const prev = users[targetUserId] ?? { ...DEFAULT_USER_MODERATION }

  switch (action) {
    case 'mute_mic':
      users[targetUserId] = { ...prev, micAllowed: false }
      break
    case 'unmute_mic':
      users[targetUserId] = { ...prev, micAllowed: true }
      break
    case 'disable_cam':
      users[targetUserId] = { ...prev, camAllowed: false }
      break
    case 'enable_cam':
      users[targetUserId] = { ...prev, camAllowed: true }
      break
    case 'make_presenter':
      users[targetUserId] = { ...prev, isPresenter: true }
      break
    case 'revoke_presenter':
      users[targetUserId] = { ...prev, isPresenter: false }
      break
    case 'kick':
      delete users[targetUserId]
      break
    default:
      break
  }

  return { users }
}
