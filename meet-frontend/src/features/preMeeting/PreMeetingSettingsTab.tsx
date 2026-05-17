import type { MutableRefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { mediaConstraintsFor } from './mediaDeviceUtils'
import type { PreMeetingMediaMode } from './preMeetingSlice'

export type PreMeetingSettingsReport = {
  stream: MediaStream | null
  mediaMode: PreMeetingMediaMode
  videoDeviceId: string
  audioInDeviceId: string
  audioOutDeviceId: string
}

type PreMeetingSettingsTabProps = {
  onStateChange: (state: PreMeetingSettingsReport) => void
  skipStopTracksOnUnmountRef: MutableRefObject<boolean>
  initialMediaMode?: PreMeetingMediaMode | null
  initialVideoDeviceId?: string | null
  initialAudioInDeviceId?: string | null
  initialAudioOutDeviceId?: string | null
}

type DeviceLists = {
  videoInputs: MediaDeviceInfo[]
  audioInputs: MediaDeviceInfo[]
  audioOutputs: MediaDeviceInfo[]
}

function reportFrom(
  stream: MediaStream | null,
  mode: PreMeetingMediaMode,
  videoDeviceId: string,
  audioInDeviceId: string,
  audioOutDeviceId: string,
): PreMeetingSettingsReport {
  return { stream, mediaMode: mode, videoDeviceId, audioInDeviceId, audioOutDeviceId }
}

async function refreshDevices(): Promise<DeviceLists> {
  const all = await navigator.mediaDevices.enumerateDevices()
  return {
    videoInputs: all.filter((d) => d.kind === 'videoinput'),
    audioInputs: all.filter((d) => d.kind === 'audioinput'),
    audioOutputs: all.filter((d) => d.kind === 'audiooutput'),
  }
}

export function PreMeetingSettingsTab({
  onStateChange,
  skipStopTracksOnUnmountRef,
  initialMediaMode = null,
  initialVideoDeviceId = null,
  initialAudioInDeviceId = null,
  initialAudioOutDeviceId = null,
}: PreMeetingSettingsTabProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  /** Set true when the preview effect cleans up or deps change; in-flight getUserMedia must bail before setState. */
  const streamApplyCancelledRef = useRef(false)

  const [mediaMode, setMediaMode] = useState<PreMeetingMediaMode>(initialMediaMode ?? 'both')
  const [devices, setDevices] = useState<DeviceLists>({
    videoInputs: [],
    audioInputs: [],
    audioOutputs: [],
  })
  /** Empty string means “use first available device” (derived in render). */
  const [videoId, setVideoId] = useState(initialVideoDeviceId ?? '')
  const [audioInId, setAudioInId] = useState(initialAudioInDeviceId ?? '')
  const [audioOutId, setAudioOutId] = useState(initialAudioOutDeviceId ?? '')
  const [error, setError] = useState<string | null>(null)

  const firstVideoId = devices.videoInputs[0]?.deviceId ?? ''
  const firstAudioInId = devices.audioInputs[0]?.deviceId ?? ''
  const firstAudioOutId = devices.audioOutputs[0]?.deviceId ?? ''
  const effectiveVideoId = videoId || firstVideoId
  const effectiveAudioInId = audioInId || firstAudioInId

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const applyStream = useCallback(
    async (mode: PreMeetingMediaMode, vId: string, aId: string) => {
      stopStream()
      setError(null)
      const cons = mediaConstraintsFor(mode, vId, aId)
      if (!cons) {
        onStateChange(reportFrom(null, mode, vId, aId, audioOutId || firstAudioOutId))
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia(cons)
        if (streamApplyCancelledRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.muted = true
          void videoRef.current.play().catch(() => {})
        }
        onStateChange(reportFrom(stream, mode, vId, aId, audioOutId || firstAudioOutId))
        const next = await refreshDevices()
        if (streamApplyCancelledRef.current) {
          return
        }
        setDevices(next)
      } catch (e) {
        if (streamApplyCancelledRef.current) {
          return
        }
        const msg = e instanceof Error ? e.message : 'Could not access media devices'
        setError(msg)
        onStateChange(reportFrom(null, mode, vId, aId, audioOutId || firstAudioOutId))
      }
    },
    [onStateChange, stopStream, audioOutId, firstAudioOutId],
  )

  useEffect(() => {
    if (initialMediaMode) {
      setMediaMode(initialMediaMode)
    }
    if (initialVideoDeviceId) {
      setVideoId(initialVideoDeviceId)
    }
    if (initialAudioInDeviceId) {
      setAudioInId(initialAudioInDeviceId)
    }
    if (initialAudioOutDeviceId) {
      setAudioOutId(initialAudioOutDeviceId)
    }
  }, [
    initialMediaMode,
    initialVideoDeviceId,
    initialAudioInDeviceId,
    initialAudioOutDeviceId,
  ])

  useEffect(() => {
    streamApplyCancelledRef.current = false
    queueMicrotask(() => {
      if (streamApplyCancelledRef.current) return
      void applyStream(mediaMode, effectiveVideoId, effectiveAudioInId)
    })
    return () => {
      streamApplyCancelledRef.current = true
      // Read latest: PreMeetingModal sets this to true on Enter before this tab unmounts.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional latest read at cleanup
      if (skipStopTracksOnUnmountRef.current) return
      stopStream()
    }
  }, [
    mediaMode,
    effectiveVideoId,
    effectiveAudioInId,
    applyStream,
    stopStream,
    skipStopTracksOnUnmountRef,
  ])

  useEffect(() => {
    void refreshDevices().then(setDevices)
  }, [])

  const playTestSound = () => {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 440
      gain.gain.value = 0.08
      osc.start()
      osc.stop(ctx.currentTime + 0.25)
      void ctx.resume()
    } catch {
      /* ignore */
    }
  }

  const radios: { mode: PreMeetingMediaMode; label: string }[] = [
    { mode: 'webcam_only', label: 'Webcam Only' },
    { mode: 'mic_only', label: 'Enable Mic Only' },
    { mode: 'both', label: 'Enable Webcam & Mic' },
    { mode: 'none', label: 'None' },
  ]

  const videoSelectValue = effectiveVideoId
  const audioInSelectValue = effectiveAudioInId
  const audioOutSelectValue = audioOutId || firstAudioOutId

  return (
    <div className="pre-meeting-settings">
      <div className="pre-meeting-settings__row">
        <div className="pre-meeting-settings__col pre-meeting-settings__col--video">
          <div className="e-info-lft-video">
            <video
              ref={videoRef}
              className="video-call-screen"
              muted
              playsInline
              autoPlay
              aria-label="Camera preview"
            />
          </div>
        </div>
        <div className="pre-meeting-settings__col pre-meeting-settings__col--form">
          <div className="form-group">
            <label className="form-label" htmlFor="pre-meeting-video-select">
              Camera
            </label>
            <div className="icon-input-box camera-input">
              <div className="custom-select-bx">
                <select
                  id="pre-meeting-video-select"
                  className="form-control"
                  value={videoSelectValue}
                  onChange={(e) => setVideoId(e.target.value)}
                  disabled={mediaMode === 'none' || mediaMode === 'mic_only'}
                >
                  {devices.videoInputs.length === 0 ? (
                    <option value="">-Select-</option>
                  ) : (
                    devices.videoInputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <i className="mr-webcam-on-icon webcam_icon_content" aria-hidden />
            </div>
          </div>

          <div className="form-group form_section">
            <label className="form-label mic-lab" htmlFor="pre-meeting-audio-in-select">
              Microphone
              <div className="audio-chker-blk" aria-hidden>
                <div className="first-dot" />
                <div className="second-dot" />
                <div className="third-dot" />
              </div>
            </label>
            <div className="icon-input-box">
              <div className="custom-select-bx">
                <select
                  id="pre-meeting-audio-in-select"
                  className="form-control"
                  value={audioInSelectValue}
                  onChange={(e) => setAudioInId(e.target.value)}
                  disabled={mediaMode === 'none' || mediaMode === 'webcam_only'}
                >
                  {devices.audioInputs.length === 0 ? (
                    <option value="">Default</option>
                  ) : (
                    devices.audioInputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <i className="mr-mic-on-icon webcam_icon_content" aria-hidden />
            </div>
          </div>

          <div className="form-group outputaudio-grp">
            <label className="form-label" htmlFor="pre-meeting-audio-out-select">
              Audio Output
            </label>
            <div className="icon-input-box">
              <div className="custom-select-bx">
                <select
                  id="pre-meeting-audio-out-select"
                  className="form-control"
                  value={audioOutSelectValue}
                  onChange={(e) => setAudioOutId(e.target.value)}
                >
                  {devices.audioOutputs.length === 0 ? (
                    <option value="">Default</option>
                  ) : (
                    devices.audioOutputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <i className="mr-audio-output-icon webcam_icon_content" aria-hidden />
            </div>
          </div>

          <button type="button" className="btn gray-btn play-test-sound" onClick={playTestSound}>
            Play Test Sound
          </button>
          {error ? (
            <p className="pre-meeting-settings__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="webcam-radio-btns icon_settings_page">
        <ul className="cmn-ul-list">
          {radios.map(({ mode, label }) => (
            <li key={mode}>
              <div className="radio custom">
                <label>
                  <input
                    type="radio"
                    name="pre-meeting-media-mode"
                    className="radio_button"
                    checked={mediaMode === mode}
                    onChange={() => setMediaMode(mode)}
                  />{' '}
                  {label}
                </label>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
