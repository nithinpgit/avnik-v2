import type { RootState } from '../../app/store'
import { parseScreenShareSync, SCREEN_SHARE_SYNC_CHANNEL } from './screenShareSync'

export function selectScreenShareSync(state: RootState) {
  return parseScreenShareSync(state.roomSync.channels[SCREEN_SHARE_SYNC_CHANNEL])
}
