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

export function deviceIdsFromStream(stream: MediaStream | null): {
  videoDeviceId: string
  audioInDeviceId: string
} {
  const videoDeviceId = stream?.getVideoTracks()[0]?.getSettings().deviceId ?? ''
  const audioInDeviceId = stream?.getAudioTracks()[0]?.getSettings().deviceId ?? ''
  return { videoDeviceId, audioInDeviceId }
}
