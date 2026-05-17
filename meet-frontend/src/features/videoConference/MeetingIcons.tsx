import type { CSSProperties } from 'react'

export type IconProps = {
  size?: number
  className?: string
  style?: CSSProperties
}

function MrIcon(baseClass: string, { size = 20, className, style }: IconProps = {}) {
  return (
    <i
      className={[baseClass, className].filter(Boolean).join(' ')}
      aria-hidden
      style={{
        fontSize: size,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    />
  )
}

function LmIcon(suffixClass: string, { size = 20, className, style }: IconProps = {}) {
  return (
    <i
      className={['lm', suffixClass, className].filter(Boolean).join(' ')}
      aria-hidden
      style={{
        fontSize: size,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    />
  )
}

export function IconClose(props: IconProps) {
  return MrIcon('mr-close-icon', props)
}

export function IconGear(props: IconProps) {
  return MrIcon('mr-setting-icon', props)
}

export function IconCrown(props: IconProps) {
  return MrIcon('mr-present-icon', props)
}

export function IconPause(props: IconProps) {
  return MrIcon('mr-pause-timer-icon', props)
}

export function IconPlay(props: IconProps) {
  return MrIcon('mr-start-timer-icon', props)
}

/** Legacy join UI used a red dot for recording — no dedicated avnik glyph in use here. */
export function IconRecord({ size = 12, className, style }: IconProps) {
  const s = size
  return (
    <span
      className={['meeting-record-dot', className].filter(Boolean).join(' ')}
      aria-hidden
      style={{
        width: s,
        height: s,
        borderRadius: '50%',
        background: 'currentColor',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}

export function IconExit(props: IconProps) {
  return MrIcon('mr-exit-user-icon', props)
}

export function IconBell(props: IconProps) {
  return LmIcon('lm-notification-icon', props)
}

export function IconMonitor(props: IconProps) {
  return MrIcon('mr-desktop-view-icon', props)
}

export function IconUser(props: IconProps) {
  return MrIcon('mr-invite-icon', props)
}

export function IconSearch(props: IconProps) {
  return MrIcon('mr-search-icon', props)
}

export function IconGridLayout(props: IconProps) {
  return MrIcon('mr-grid-view-icon', props)
}

export function IconDocument(props: IconProps) {
  return MrIcon('mr-document-share-icon', props)
}

export function IconVideoCam(props: IconProps) {
  return MrIcon('mr-video-share-icon', props)
}

export function IconFullscreen(props: IconProps) {
  return MrIcon('mr-full-screen-icon', props)
}

export function IconMic(props: IconProps) {
  return MrIcon('mr-mic-on-icon', props)
}

/** Thin stroke to match avnik dock glyphs (filled hand.svg read as much bolder). */
export function IconHand({ size = 22, className, style }: IconProps) {
  const stroke = {
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.35,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={['meeting-icon', className].filter(Boolean).join(' ')}
      aria-hidden
      style={style}
    >
      <path
        d="M7 11V9a1.5 1.5 0 0 1 3 0v2M10 11V7.5a1.5 1.5 0 0 1 3 0V11M13 11V8a1.5 1.5 0 0 1 3 0v6a4 4 0 0 1-4 4h-1"
        {...stroke}
      />
    </svg>
  )
}

export function IconHelp(props: IconProps) {
  return MrIcon('mr-help-icon', props)
}

export function IconChat(props: IconProps) {
  return MrIcon('mr-chat-icon', props)
}

export function IconMoreVertical(props: IconProps) {
  return MrIcon('mr-vertical-more-icon', props)
}
