/** Extract an 11-character YouTube video id from a URL or raw id. */
export function parseYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed

  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]

  for (const re of patterns) {
    const m = trimmed.match(re)
    if (m?.[1]) return m[1]
  }
  return null
}

export function youtubeEmbedUrl(videoId: string, startSec = 0, autoplay = true): string {
  const start = Math.max(0, Math.floor(startSec))
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  })
  if (start > 0) params.set('start', String(start))
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`
}
