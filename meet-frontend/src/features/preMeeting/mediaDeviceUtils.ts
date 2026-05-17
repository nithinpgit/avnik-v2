import type { PreMeetingMediaMode } from './preMeetingSlice'

export function mediaConstraintsFor(
  mode: PreMeetingMediaMode,
  videoDeviceId: string,
  audioInId: string,
): MediaStreamConstraints | null {
  if (mode === 'none') {
    return null
  }
  const wantVideo = mode === 'webcam_only' || mode === 'both'
  const wantAudio = mode === 'mic_only' || mode === 'both'
  if (!wantVideo && !wantAudio) {
    return null
  }
  const video = wantVideo
    ? videoDeviceId
      ? { deviceId: { exact: videoDeviceId } }
      : true
    : false
  const audio = wantAudio
    ? audioInId
      ? { deviceId: { exact: audioInId } }
      : true
    : false
  return { video, audio }
}

export function liveMediaTrack(
  stream: MediaStream | null | undefined,
  kind: 'audio' | 'video',
): MediaStreamTrack | undefined {
  return stream?.getTracks().find((t) => t.kind === kind && t.readyState === 'live')
}

/** True when the stream has live tracks required for the chosen media mode. */
export function localStreamMeetsMode(
  stream: MediaStream | null | undefined,
  mode: PreMeetingMediaMode,
): boolean {
  if (mode === 'none') {
    return true
  }
  const wantVideo = mode === 'webcam_only' || mode === 'both'
  const wantAudio = mode === 'mic_only' || mode === 'both'
  if (wantVideo && !liveMediaTrack(stream, 'video')) {
    return false
  }
  if (wantAudio && !liveMediaTrack(stream, 'audio')) {
    return false
  }
  return true
}

export function deviceIdsFromStream(stream: MediaStream | null): {
  videoDeviceId: string
  audioInDeviceId: string
} {
  const videoDeviceId = stream?.getVideoTracks()[0]?.getSettings().deviceId ?? ''
  const audioInDeviceId = stream?.getAudioTracks()[0]?.getSettings().deviceId ?? ''
  return { videoDeviceId, audioInDeviceId }
}
